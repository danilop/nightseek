"""Weather forecast integration using Open-Meteo API."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence
from statistics import mean

import requests


# =============================================================================
# Constants
# =============================================================================


class WeatherThresholds:
    """Constants for weather assessment thresholds."""

    # Cloud cover thresholds (%)
    CLEAR_SKY = 20
    MOSTLY_CLEAR = 40
    PARTLY_CLOUDY = 60
    MOSTLY_CLOUDY = 80

    # Aerosol Optical Depth thresholds
    AOD_EXCELLENT = 0.1
    AOD_GOOD = 0.2
    AOD_MODERATE = 0.4
    AOD_HAZY_PENALTY = 0.3  # Threshold for quality penalty

    # Visibility thresholds (km)
    VIS_EXCELLENT = 50
    VIS_GOOD = 20
    VIS_MODERATE = 10
    VIS_POOR = 5

    # Dew risk
    DEW_RISK_MARGIN_C = 3.0

    # Quality scoring weights
    CLOUD_WEIGHT = 0.7
    MOON_WEIGHT = 0.3
    PRECIP_WEIGHT = 0.3

    # Quality score thresholds
    QUALITY_EXCELLENT = 20
    QUALITY_GOOD = 35
    QUALITY_FAIR = 55

    # API limits
    MAX_FORECAST_DAYS = 16
    AIR_QUALITY_MAX_DAYS = 5
    CACHE_SECONDS = 3600


# =============================================================================
# Helper Functions
# =============================================================================


def safe_avg(values: Sequence[float]) -> Optional[float]:
    """Calculate average, returning None for empty sequences."""
    return mean(values) if values else None


def safe_min(values: Sequence[float]) -> Optional[float]:
    """Calculate minimum, returning None for empty sequences."""
    return min(values) if values else None


def safe_max(values: Sequence[float]) -> Optional[float]:
    """Calculate maximum, returning None for empty sequences."""
    return max(values) if values else None


def safe_sum(values: Sequence[float]) -> Optional[float]:
    """Calculate sum, returning None for empty sequences."""
    return sum(values) if values else None


# =============================================================================
# Data Classes
# =============================================================================


@dataclass
class HourlyWeatherData:
    """All weather measurements for a single hour."""

    cloud_cover: float = 0.0
    cloud_cover_low: Optional[float] = None
    cloud_cover_mid: Optional[float] = None
    cloud_cover_high: Optional[float] = None
    visibility_km: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    wind_gust_kmh: Optional[float] = None
    humidity: Optional[float] = None
    temperature_c: Optional[float] = None
    dew_point_c: Optional[float] = None
    precip_probability: Optional[float] = None
    precipitation_mm: Optional[float] = None
    pressure_hpa: Optional[float] = None
    cape: Optional[float] = None
    # Air quality
    aod: Optional[float] = None  # Aerosol optical depth
    pm2_5: Optional[float] = None
    pm10: Optional[float] = None
    dust: Optional[float] = None

    @property
    def dew_margin(self) -> Optional[float]:
        """Temperature margin above dew point (risk if < 3°C)."""
        if self.temperature_c is not None and self.dew_point_c is not None:
            return self.temperature_c - self.dew_point_c
        return None


@dataclass
class ClearWindow:
    """A window of clear weather during the night."""

    start: datetime
    end: datetime
    avg_cloud_cover: float


@dataclass
class BestObservingTime:
    """Best time to observe during the night based on conditions."""

    time: datetime
    cloud_cover: float
    precip_probability: float
    combined_score: float  # Lower is better


@dataclass
class NightWeather:
    """Weather conditions for a single night."""

    date: datetime
    # Cloud cover statistics
    avg_cloud_cover: float
    min_cloud_cover: float
    max_cloud_cover: float
    clear_duration_hours: float
    clear_windows: List[ClearWindow]
    hourly_data: Dict[datetime, float]  # Hourly cloud cover for compatibility

    # Additional weather fields
    avg_visibility_km: Optional[float] = None
    avg_wind_speed_kmh: Optional[float] = None
    max_wind_speed_kmh: Optional[float] = None
    avg_humidity: Optional[float] = None
    avg_temperature_c: Optional[float] = None
    transparency_score: Optional[float] = None

    # Cloud layers
    cloud_cover_low: Optional[float] = None
    cloud_cover_mid: Optional[float] = None
    cloud_cover_high: Optional[float] = None

    # Precipitation
    min_precip_probability: Optional[float] = None
    max_precip_probability: Optional[float] = None
    total_precipitation_mm: Optional[float] = None

    # Dew risk
    min_dew_margin: Optional[float] = None
    dew_risk_hours: int = 0

    # Atmospheric stability
    avg_pressure_hpa: Optional[float] = None
    max_cape: Optional[float] = None

    # Best time to observe
    best_time: Optional[BestObservingTime] = None

    # Air quality
    avg_aerosol_optical_depth: Optional[float] = None
    avg_pm2_5: Optional[float] = None
    avg_pm10: Optional[float] = None
    avg_dust: Optional[float] = None


@dataclass
class NightWeatherStats:
    """Intermediate statistics calculated from hourly data."""

    cloud_values: List[float] = field(default_factory=list)
    visibility_values: List[float] = field(default_factory=list)
    wind_values: List[float] = field(default_factory=list)
    gust_values: List[float] = field(default_factory=list)
    humidity_values: List[float] = field(default_factory=list)
    temp_values: List[float] = field(default_factory=list)
    cloud_low_values: List[float] = field(default_factory=list)
    cloud_mid_values: List[float] = field(default_factory=list)
    cloud_high_values: List[float] = field(default_factory=list)
    precip_prob_values: List[float] = field(default_factory=list)
    precipitation_values: List[float] = field(default_factory=list)
    pressure_values: List[float] = field(default_factory=list)
    cape_values: List[float] = field(default_factory=list)
    dew_margins: List[float] = field(default_factory=list)
    aod_values: List[float] = field(default_factory=list)
    pm2_5_values: List[float] = field(default_factory=list)
    pm10_values: List[float] = field(default_factory=list)
    dust_values: List[float] = field(default_factory=list)

    def add_hourly_data(self, data: HourlyWeatherData) -> None:
        """Add data from a single hour to the statistics."""
        self.cloud_values.append(data.cloud_cover)

        if data.visibility_km is not None:
            self.visibility_values.append(data.visibility_km)
        if data.wind_speed_kmh is not None:
            self.wind_values.append(data.wind_speed_kmh)
        if data.wind_gust_kmh is not None:
            self.gust_values.append(data.wind_gust_kmh)
        if data.humidity is not None:
            self.humidity_values.append(data.humidity)
        if data.temperature_c is not None:
            self.temp_values.append(data.temperature_c)
        if data.cloud_cover_low is not None:
            self.cloud_low_values.append(data.cloud_cover_low)
        if data.cloud_cover_mid is not None:
            self.cloud_mid_values.append(data.cloud_cover_mid)
        if data.cloud_cover_high is not None:
            self.cloud_high_values.append(data.cloud_cover_high)
        if data.precip_probability is not None:
            self.precip_prob_values.append(data.precip_probability)
        if data.precipitation_mm is not None:
            self.precipitation_values.append(data.precipitation_mm)
        if data.pressure_hpa is not None:
            self.pressure_values.append(data.pressure_hpa)
        if data.cape is not None:
            self.cape_values.append(data.cape)
        if data.dew_margin is not None:
            self.dew_margins.append(data.dew_margin)
        if data.aod is not None:
            self.aod_values.append(data.aod)
        if data.pm2_5 is not None:
            self.pm2_5_values.append(data.pm2_5)
        if data.pm10 is not None:
            self.pm10_values.append(data.pm10)
        if data.dust is not None:
            self.dust_values.append(data.dust)


# =============================================================================
# Main Weather Forecast Class
# =============================================================================


class WeatherForecast:
    """Fetch and manage weather forecasts from Open-Meteo."""

    # Backward compatibility - expose threshold as class attribute
    MAX_FORECAST_DAYS = WeatherThresholds.MAX_FORECAST_DAYS

    # API endpoints
    WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast"
    AIR_QUALITY_API_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

    # Weather parameters to fetch
    WEATHER_PARAMS = [
        "cloud_cover",
        "cloud_cover_low",
        "cloud_cover_mid",
        "cloud_cover_high",
        "visibility",
        "wind_speed_10m",
        "wind_gusts_10m",
        "relative_humidity_2m",
        "temperature_2m",
        "dew_point_2m",
        "precipitation_probability",
        "precipitation",
        "pressure_msl",
        "cape",
    ]

    AIR_QUALITY_PARAMS = ["pm2_5", "pm10", "aerosol_optical_depth", "dust"]

    def __init__(self, latitude: float, longitude: float):
        """Initialize weather forecast.

        Args:
            latitude: Observer latitude in degrees
            longitude: Observer longitude in degrees
        """
        self.latitude = latitude
        self.longitude = longitude
        self._hourly_data: Dict[datetime, HourlyWeatherData] = {}
        self.timezone_name: Optional[str] = None

    def fetch_forecast(self, num_days: int) -> bool:
        """Fetch weather forecast from Open-Meteo with caching.

        Args:
            num_days: Number of days to fetch

        Returns:
            True if weather data was fetched, False otherwise
        """
        if num_days > WeatherThresholds.MAX_FORECAST_DAYS:
            return False

        # Try cache first
        if self._load_from_cache(num_days):
            self._fetch_air_quality(num_days)
            return True

        # Fetch from API
        if not self._fetch_weather_api(num_days):
            return False

        self._fetch_air_quality(num_days)
        return True

    def _load_from_cache(self, num_days: int) -> bool:
        """Try to load weather data from cache."""
        from cache_manager import CacheManager
        import json

        cache = CacheManager()
        cache_key = self._get_cache_key(num_days)
        cache_info = cache.check(
            cache_key, max_age_seconds=WeatherThresholds.CACHE_SECONDS
        )

        if not (cache_info.exists and cache_info.is_valid):
            return False

        try:
            with open(cache.get_path(cache_key)) as f:
                data = json.load(f)
                self._parse_weather_response(data)
                return True
        except Exception:
            return False

    def _get_cache_key(self, num_days: int) -> str:
        """Generate cache key for weather data."""
        import hashlib

        key_str = f"{self.latitude}_{self.longitude}_{num_days}"
        return f"weather_{hashlib.md5(key_str.encode()).hexdigest()}.json"

    def _fetch_weather_api(self, num_days: int) -> bool:
        """Fetch weather data from Open-Meteo API."""
        from cache_manager import CacheManager
        import json

        try:
            params = {
                "latitude": self.latitude,
                "longitude": self.longitude,
                "hourly": ",".join(self.WEATHER_PARAMS),
                "forecast_days": min(num_days, WeatherThresholds.MAX_FORECAST_DAYS),
                "timezone": "auto",
            }

            response = requests.get(self.WEATHER_API_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            # Cache the response
            cache = CacheManager()
            try:
                with open(cache.get_path(self._get_cache_key(num_days)), "w") as f:
                    json.dump(data, f)
            except Exception:
                pass

            self._parse_weather_response(data)
            return True

        except Exception:
            return False

    def _fetch_air_quality(self, num_days: int) -> None:
        """Fetch air quality data from Open-Meteo Air Quality API."""
        try:
            params = {
                "latitude": self.latitude,
                "longitude": self.longitude,
                "hourly": ",".join(self.AIR_QUALITY_PARAMS),
                "forecast_days": min(num_days, WeatherThresholds.AIR_QUALITY_MAX_DAYS),
                "timezone": "auto",
            }

            response = requests.get(self.AIR_QUALITY_API_URL, params=params, timeout=10)
            response.raise_for_status()
            self._parse_air_quality_response(response.json())

        except Exception:
            pass  # Air quality is optional

    def _parse_weather_response(self, data: dict) -> None:
        """Parse weather API response into hourly data."""
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])

        if not times:
            return

        self._hourly_data = {}

        for i, time_str in enumerate(times):
            dt = self._parse_datetime(time_str)
            self._hourly_data[dt] = HourlyWeatherData(
                cloud_cover=self._get_value(hourly, "cloud_cover", i) or 0.0,
                cloud_cover_low=self._get_value(hourly, "cloud_cover_low", i),
                cloud_cover_mid=self._get_value(hourly, "cloud_cover_mid", i),
                cloud_cover_high=self._get_value(hourly, "cloud_cover_high", i),
                visibility_km=self._get_value_scaled(hourly, "visibility", i, 0.001),
                wind_speed_kmh=self._get_value(hourly, "wind_speed_10m", i),
                wind_gust_kmh=self._get_value(hourly, "wind_gusts_10m", i),
                humidity=self._get_value(hourly, "relative_humidity_2m", i),
                temperature_c=self._get_value(hourly, "temperature_2m", i),
                dew_point_c=self._get_value(hourly, "dew_point_2m", i),
                precip_probability=self._get_value(
                    hourly, "precipitation_probability", i
                ),
                precipitation_mm=self._get_value(hourly, "precipitation", i),
                pressure_hpa=self._get_value(hourly, "pressure_msl", i),
                cape=self._get_value(hourly, "cape", i),
            )

    def _parse_air_quality_response(self, data: dict) -> None:
        """Parse air quality API response and merge into hourly data."""
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])

        for i, time_str in enumerate(times):
            dt = self._parse_datetime(time_str)
            if dt in self._hourly_data:
                self._hourly_data[dt].aod = self._get_value(
                    hourly, "aerosol_optical_depth", i
                )
                self._hourly_data[dt].pm2_5 = self._get_value(hourly, "pm2_5", i)
                self._hourly_data[dt].pm10 = self._get_value(hourly, "pm10", i)
                self._hourly_data[dt].dust = self._get_value(hourly, "dust", i)

    @staticmethod
    def _parse_datetime(time_str: str) -> datetime:
        """Parse ISO datetime and convert to naive local time."""
        dt = datetime.fromisoformat(time_str)
        if dt.tzinfo is not None:
            dt = dt.astimezone(None).replace(tzinfo=None)
        return dt

    @staticmethod
    def _get_value(
        hourly: dict, key: str, index: int, default: Optional[float] = None
    ) -> Optional[float]:
        """Safely get a value from hourly data."""
        values = hourly.get(key, [])
        if index < len(values) and values[index] is not None:
            return values[index]
        return default

    @staticmethod
    def _get_value_scaled(
        hourly: dict, key: str, index: int, scale: float
    ) -> Optional[float]:
        """Safely get a value and apply scaling."""
        values = hourly.get(key, [])
        if index < len(values) and values[index] is not None:
            return values[index] * scale
        return None

    def get_night_weather(
        self,
        date: datetime,
        night_start: Optional[datetime],
        night_end: Optional[datetime],
    ) -> Optional[NightWeather]:
        """Get weather conditions for a specific night.

        Args:
            date: The date of the night
            night_start: Start of astronomical night (astronomical dusk)
            night_end: End of astronomical night (astronomical dawn)

        Returns:
            NightWeather object, or None if data not available
        """
        if not self._hourly_data or not night_start or not night_end:
            return None

        # Normalize times
        night_start = self._normalize_datetime(night_start)
        night_end = self._normalize_datetime(night_end)

        # Handle night spanning midnight
        if night_end <= night_start:
            night_end = night_end + timedelta(days=1)

        # Collect data for night hours
        night_hours = self._get_night_hours(night_start, night_end)
        if not night_hours:
            return None

        # Calculate statistics
        stats = self._collect_night_statistics(night_hours)
        hourly_cloud_data = {h: self._hourly_data[h].cloud_cover for h in night_hours}

        return self._build_night_weather(date, stats, hourly_cloud_data, night_hours)

    @staticmethod
    def _normalize_datetime(dt: datetime) -> datetime:
        """Convert timezone-aware datetime to naive local time."""
        if dt.tzinfo is not None:
            dt = dt.astimezone(None).replace(tzinfo=None)
        return dt

    def _get_night_hours(
        self, night_start: datetime, night_end: datetime
    ) -> List[datetime]:
        """Get list of hours within the night period that have data."""
        hours = []
        current = night_start.replace(minute=0, second=0, microsecond=0)
        end = night_end.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)

        while current < end:
            if night_start <= current <= night_end and current in self._hourly_data:
                hours.append(current)
            current += timedelta(hours=1)

        return hours

    def _collect_night_statistics(
        self, night_hours: List[datetime]
    ) -> NightWeatherStats:
        """Collect weather statistics for the given night hours."""
        stats = NightWeatherStats()
        for hour in night_hours:
            stats.add_hourly_data(self._hourly_data[hour])
        return stats

    def _build_night_weather(
        self,
        date: datetime,
        stats: NightWeatherStats,
        hourly_cloud_data: Dict[datetime, float],
        night_hours: List[datetime],
    ) -> NightWeather:
        """Build NightWeather object from collected statistics."""
        avg_cloud = safe_avg(stats.cloud_values) or 0.0
        avg_aod = safe_avg(stats.aod_values)
        avg_visibility = safe_avg(stats.visibility_values)

        return NightWeather(
            date=date,
            avg_cloud_cover=avg_cloud,
            min_cloud_cover=safe_min(stats.cloud_values) or 0.0,
            max_cloud_cover=safe_max(stats.cloud_values) or 0.0,
            clear_duration_hours=float(
                sum(1 for c in stats.cloud_values if c < WeatherThresholds.CLEAR_SKY)
            ),
            clear_windows=self._find_clear_windows(hourly_cloud_data),
            hourly_data=hourly_cloud_data,
            avg_visibility_km=avg_visibility,
            avg_wind_speed_kmh=safe_avg(stats.wind_values),
            max_wind_speed_kmh=safe_max(stats.gust_values),
            avg_humidity=safe_avg(stats.humidity_values),
            avg_temperature_c=safe_avg(stats.temp_values),
            transparency_score=self._calculate_transparency(
                avg_visibility, avg_cloud, avg_aod
            ),
            cloud_cover_low=safe_avg(stats.cloud_low_values),
            cloud_cover_mid=safe_avg(stats.cloud_mid_values),
            cloud_cover_high=safe_avg(stats.cloud_high_values),
            min_precip_probability=safe_min(stats.precip_prob_values),
            max_precip_probability=safe_max(stats.precip_prob_values),
            total_precipitation_mm=safe_sum(stats.precipitation_values),
            min_dew_margin=safe_min(stats.dew_margins),
            dew_risk_hours=sum(
                1 for m in stats.dew_margins if m < WeatherThresholds.DEW_RISK_MARGIN_C
            ),
            avg_pressure_hpa=safe_avg(stats.pressure_values),
            max_cape=safe_max(stats.cape_values),
            best_time=self._find_best_observing_time(night_hours),
            avg_aerosol_optical_depth=avg_aod,
            avg_pm2_5=safe_avg(stats.pm2_5_values),
            avg_pm10=safe_avg(stats.pm10_values),
            avg_dust=safe_avg(stats.dust_values),
        )

    def _calculate_transparency(
        self,
        avg_visibility: Optional[float],
        avg_cloud: float,
        avg_aod: Optional[float],
    ) -> Optional[float]:
        """Calculate transparency score (0-100, higher = better)."""
        if avg_visibility is None:
            return None

        # Score visibility
        T = WeatherThresholds
        if avg_visibility >= T.VIS_EXCELLENT:
            vis_score = 100
        elif avg_visibility >= T.VIS_GOOD:
            vis_score = 80 + (avg_visibility - T.VIS_GOOD) * 20 / (
                T.VIS_EXCELLENT - T.VIS_GOOD
            )
        elif avg_visibility >= T.VIS_MODERATE:
            vis_score = 50 + (avg_visibility - T.VIS_MODERATE) * 30 / (
                T.VIS_GOOD - T.VIS_MODERATE
            )
        elif avg_visibility >= T.VIS_POOR:
            vis_score = 20 + (avg_visibility - T.VIS_POOR) * 30 / (
                T.VIS_MODERATE - T.VIS_POOR
            )
        else:
            vis_score = avg_visibility * 4

        # AOD factor
        aod_factor = 1.0
        if avg_aod is not None:
            if avg_aod < T.AOD_EXCELLENT:
                aod_factor = 1.0
            elif avg_aod < T.AOD_GOOD:
                aod_factor = 0.9
            elif avg_aod < T.AOD_MODERATE:
                aod_factor = 0.7
            else:
                aod_factor = 0.5

        cloud_factor = 1.0 - (avg_cloud / 100.0)
        return vis_score * cloud_factor * aod_factor

    def _find_best_observing_time(
        self, night_hours: List[datetime]
    ) -> Optional[BestObservingTime]:
        """Find the best hour to observe based on conditions."""
        if not night_hours:
            return None

        best_hour = None
        best_score = float("inf")
        best_cloud = 0.0
        best_precip = 0.0

        for hour in night_hours:
            data = self._hourly_data[hour]
            precip = data.precip_probability or 0.0
            score = (data.cloud_cover * WeatherThresholds.CLOUD_WEIGHT) + (
                precip * WeatherThresholds.PRECIP_WEIGHT
            )

            if score < best_score:
                best_score = score
                best_hour = hour
                best_cloud = data.cloud_cover
                best_precip = precip

        if best_hour is None:
            return None

        return BestObservingTime(
            time=best_hour,
            cloud_cover=best_cloud,
            precip_probability=best_precip,
            combined_score=best_score,
        )

    @staticmethod
    def _find_clear_windows(
        hourly_data: Dict[datetime, float],
        threshold: float = WeatherThresholds.MOSTLY_CLEAR,
        min_duration: int = 2,
    ) -> List[ClearWindow]:
        """Find consecutive clear weather windows."""
        if not hourly_data:
            return []

        sorted_hours = sorted(hourly_data.items())
        windows = []
        window_start = None
        window_clouds: List[float] = []

        for i, (hour, clouds) in enumerate(sorted_hours):
            if clouds < threshold:
                if window_start is None:
                    window_start = hour
                    window_clouds = [clouds]
                else:
                    window_clouds.append(clouds)
            else:
                if window_start is not None and len(window_clouds) >= min_duration:
                    windows.append(
                        ClearWindow(
                            start=window_start,
                            end=sorted_hours[i - 1][0],
                            avg_cloud_cover=mean(window_clouds),
                        )
                    )
                window_start = None
                window_clouds = []

        # Close final window
        if window_start is not None and len(window_clouds) >= min_duration:
            windows.append(
                ClearWindow(
                    start=window_start,
                    end=sorted_hours[-1][0],
                    avg_cloud_cover=mean(window_clouds),
                )
            )

        return windows

    # =========================================================================
    # Static utility methods
    # =========================================================================

    @staticmethod
    def get_cloud_cover_description(avg_cloud_cover: float) -> str:
        """Get human-readable cloud cover description."""
        T = WeatherThresholds
        if avg_cloud_cover < T.CLEAR_SKY:
            return "Clear"
        elif avg_cloud_cover < T.MOSTLY_CLEAR:
            return "Mostly Clear"
        elif avg_cloud_cover < T.PARTLY_CLOUDY:
            return "Partly Cloudy"
        elif avg_cloud_cover < T.MOSTLY_CLOUDY:
            return "Mostly Cloudy"
        else:
            return "Cloudy"

    @staticmethod
    def get_observing_quality(
        moon_illumination: float,
        avg_cloud_cover: Optional[float],
        avg_aod: Optional[float] = None,
    ) -> tuple[str, str]:
        """Calculate overall observing quality combining moon, clouds, and air quality.

        Returns:
            Tuple of (quality_level, quality_description)
        """
        T = WeatherThresholds

        # No weather data - moon-only assessment
        if avg_cloud_cover is None:
            if moon_illumination < 20:
                return ("excellent", "Excellent (DSO) - No weather data")
            elif moon_illumination < 40:
                return ("good", "Good (DSO) - No weather data")
            elif moon_illumination < 70:
                return ("fair", "Fair (Planets) - No weather data")
            else:
                return ("poor", "Poor (DSO) - No weather data")

        # Combined assessment
        combined_score = (avg_cloud_cover * T.CLOUD_WEIGHT) + (
            moon_illumination * T.MOON_WEIGHT
        )

        # Air quality penalty
        haze_note = ""
        if avg_aod is not None and avg_aod > T.AOD_HAZY_PENALTY:
            combined_score += 10
            haze_note = ", hazy"

        # Determine quality level
        if combined_score < T.QUALITY_EXCELLENT:
            return ("excellent", f"Excellent - Dark & Clear{haze_note}")
        elif combined_score < T.QUALITY_GOOD:
            desc = "Clear skies" if avg_cloud_cover < 30 else "Some clouds"
            return ("good", f"Good - {desc}{haze_note}")
        elif combined_score < T.QUALITY_FAIR:
            if avg_cloud_cover > 60:
                desc = "Cloudy"
            elif moon_illumination > 60:
                desc = "Bright moon"
            else:
                desc = "Fair conditions"
            return ("fair", f"Fair - {desc}{haze_note}")
        else:
            desc = "Very cloudy" if avg_cloud_cover > 70 else "Bright moon & clouds"
            return ("poor", f"Poor - {desc}{haze_note}")
