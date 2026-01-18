"""Weather forecast integration using Open-Meteo API."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import requests


@dataclass
class ClearWindow:
    """A window of clear weather during the night."""

    start: datetime
    end: datetime
    avg_cloud_cover: float  # Average cloud cover during this window


@dataclass
class NightWeather:
    """Weather conditions for a single night."""

    date: datetime
    avg_cloud_cover: float  # Average cloud cover during astronomical night (0-100)
    min_cloud_cover: float  # Minimum cloud cover during astronomical night (0-100)
    max_cloud_cover: float  # Maximum cloud cover during astronomical night (0-100)
    clear_duration_hours: float  # Hours with <20% cloud cover during night
    clear_windows: List[ClearWindow]  # Windows with <40% sustained cloud cover
    hourly_data: Dict[datetime, float]  # Hourly cloud cover for the night
    # NEW: Additional weather fields for observation quality
    avg_visibility_km: Optional[float] = None  # Atmospheric visibility in km
    avg_wind_speed_kmh: Optional[float] = None  # Wind speed in km/h
    max_wind_speed_kmh: Optional[float] = None  # Maximum wind speed (gusts)
    avg_humidity: Optional[float] = None  # Relative humidity percentage
    avg_temperature_c: Optional[float] = None  # Temperature in Celsius
    # Derived transparency score (combines visibility + aerosols)
    transparency_score: Optional[float] = None  # 0-100 (higher = better)


class WeatherForecast:
    """Fetch and manage weather forecasts from Open-Meteo."""

    # Open-Meteo provides up to 16 days of hourly forecasts
    MAX_FORECAST_DAYS = 16

    def __init__(self, latitude: float, longitude: float):
        """Initialize weather forecast.

        Args:
            latitude: Observer latitude in degrees
            longitude: Observer longitude in degrees
        """
        self.latitude = latitude
        self.longitude = longitude
        self._cache: Dict[str, NightWeather] = {}
        self.timezone_name: Optional[str] = None

    def fetch_forecast(self, num_days: int) -> bool:
        """Fetch weather forecast from Open-Meteo with caching.

        Only fetches if num_days <= MAX_FORECAST_DAYS.
        Returns False if weather data is not available.
        Caches responses for 1 hour to avoid repeated API calls.

        Args:
            num_days: Number of days to fetch

        Returns:
            True if weather data was fetched, False otherwise
        """
        if num_days > self.MAX_FORECAST_DAYS:
            # Don't fetch if user requested more days than API provides
            return False

        # Check cache first
        from cache_manager import CacheManager
        import json
        import hashlib

        cache = CacheManager()
        cache_key = f"weather_{hashlib.md5(f'{self.latitude}_{self.longitude}_{num_days}'.encode()).hexdigest()}.json"
        cache_info = cache.check(cache_key, max_age_seconds=3600)  # 1 hour cache

        if cache_info.exists and cache_info.is_valid:
            try:
                with open(cache.get_path(cache_key)) as f:
                    data = json.load(f)
                    self._parse_forecast_data(data)
                    return True
            except Exception:
                pass  # Fall through to fetch

        try:
            # Open-Meteo API endpoint
            url = "https://api.open-meteo.com/v1/forecast"

            # Request additional weather fields for observation quality
            params = {
                "latitude": self.latitude,
                "longitude": self.longitude,
                "hourly": ",".join(
                    [
                        "cloud_cover",
                        "visibility",  # Atmospheric visibility in meters
                        "wind_speed_10m",  # Wind speed at 10m in km/h
                        "wind_gusts_10m",  # Wind gusts at 10m in km/h
                        "relative_humidity_2m",  # Humidity percentage
                        "temperature_2m",  # Temperature in Celsius
                    ]
                ),
                "forecast_days": min(num_days, self.MAX_FORECAST_DAYS),
                "timezone": "auto",
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            # Save to cache
            try:
                with open(cache.get_path(cache_key), "w") as f:
                    json.dump(data, f)
            except Exception:
                pass  # Don't fail if cache write fails

            self._parse_forecast_data(data)
            return True
        except Exception:
            return False

    def _parse_forecast_data(self, data: dict):
        """Parse forecast data from API response."""
        # Parse hourly data
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        cloud_cover = hourly.get("cloud_cover", [])
        visibility = hourly.get("visibility", [])
        wind_speed = hourly.get("wind_speed_10m", [])
        wind_gusts = hourly.get("wind_gusts_10m", [])
        humidity = hourly.get("relative_humidity_2m", [])
        temperature = hourly.get("temperature_2m", [])

        if not times or not cloud_cover:
            return

        # Build hourly data maps
        self._hourly_data = {}
        self._hourly_visibility = {}
        self._hourly_wind = {}
        self._hourly_gusts = {}
        self._hourly_humidity = {}
        self._hourly_temperature = {}

        for i, time_str in enumerate(times):
            # Parse time string (ISO 8601 format)
            dt = datetime.fromisoformat(time_str)
            # Convert to timezone-naive UTC for easier comparison
            if dt.tzinfo is not None:
                dt = dt.astimezone(None).replace(tzinfo=None)

            self._hourly_data[dt] = (
                cloud_cover[i]
                if i < len(cloud_cover) and cloud_cover[i] is not None
                else 0.0
            )
            if i < len(visibility) and visibility[i] is not None:
                self._hourly_visibility[dt] = visibility[i] / 1000.0  # Convert m to km
            if i < len(wind_speed) and wind_speed[i] is not None:
                self._hourly_wind[dt] = wind_speed[i]
            if i < len(wind_gusts) and wind_gusts[i] is not None:
                self._hourly_gusts[dt] = wind_gusts[i]
            if i < len(humidity) and humidity[i] is not None:
                self._hourly_humidity[dt] = humidity[i]
            if i < len(temperature) and temperature[i] is not None:
                self._hourly_temperature[dt] = temperature[i]

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
        # Check if we have any hourly data
        if not hasattr(self, "_hourly_data") or not self._hourly_data:
            return None

        # If no astronomical night at this location/date
        if not night_start or not night_end:
            return None

        # Convert timezone-aware times to local naive times for comparison
        if night_start.tzinfo is not None:
            night_start = night_start.astimezone(None).replace(tzinfo=None)
        if night_end.tzinfo is not None:
            night_end = night_end.astimezone(None).replace(tzinfo=None)

        # Handle night spanning midnight
        if night_end <= night_start:
            night_end = night_end + timedelta(days=1)

        # Collect cloud cover values during the night
        cloud_values = []
        hourly_night_data = {}
        current = night_start.replace(minute=0, second=0, microsecond=0)
        end = night_end.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)

        while current < end:
            # Check if this hour falls within the night
            if night_start <= current <= night_end:
                if current in self._hourly_data:
                    cc = self._hourly_data[current]
                    cloud_values.append(cc)
                    hourly_night_data[current] = cc
            current += timedelta(hours=1)

        # If no data found for this night
        if not cloud_values:
            return None

        # Calculate statistics
        avg_cloud = sum(cloud_values) / len(cloud_values)
        min_cloud = min(cloud_values)
        max_cloud = max(cloud_values)

        # Calculate clear duration (hours with <20% cloud cover)
        clear_hours = sum(1 for cc in cloud_values if cc < 20)

        # Find clear windows (consecutive hours with <40% cloud cover, minimum 2 hours)
        clear_windows = self._find_clear_windows(
            hourly_night_data, threshold=40, min_duration=2
        )

        # Collect additional weather data for the night hours
        visibility_values = []
        wind_values = []
        gust_values = []
        humidity_values = []
        temp_values = []

        for hour in hourly_night_data.keys():
            if hasattr(self, "_hourly_visibility") and hour in self._hourly_visibility:
                visibility_values.append(self._hourly_visibility[hour])
            if hasattr(self, "_hourly_wind") and hour in self._hourly_wind:
                wind_values.append(self._hourly_wind[hour])
            if hasattr(self, "_hourly_gusts") and hour in self._hourly_gusts:
                gust_values.append(self._hourly_gusts[hour])
            if hasattr(self, "_hourly_humidity") and hour in self._hourly_humidity:
                humidity_values.append(self._hourly_humidity[hour])
            if (
                hasattr(self, "_hourly_temperature")
                and hour in self._hourly_temperature
            ):
                temp_values.append(self._hourly_temperature[hour])

        # Calculate averages/max
        avg_visibility = (
            sum(visibility_values) / len(visibility_values)
            if visibility_values
            else None
        )
        avg_wind = sum(wind_values) / len(wind_values) if wind_values else None
        max_wind = max(gust_values) if gust_values else None
        avg_humidity = (
            sum(humidity_values) / len(humidity_values) if humidity_values else None
        )
        avg_temp = sum(temp_values) / len(temp_values) if temp_values else None

        # Calculate transparency score (0-100, higher = better)
        # Based on visibility (>20km = excellent) and low clouds
        transparency = None
        if avg_visibility is not None:
            # Score visibility: 50km+ = 100, 20km = 80, 10km = 50, <5km = 20
            if avg_visibility >= 50:
                vis_score = 100
            elif avg_visibility >= 20:
                vis_score = 80 + (avg_visibility - 20) * 20 / 30
            elif avg_visibility >= 10:
                vis_score = 50 + (avg_visibility - 10) * 30 / 10
            elif avg_visibility >= 5:
                vis_score = 20 + (avg_visibility - 5) * 30 / 5
            else:
                vis_score = avg_visibility * 4  # 0-20 for poor visibility

            # Combine with cloud factor (clear sky = full visibility benefit)
            cloud_factor = 1.0 - (avg_cloud / 100.0)
            transparency = vis_score * cloud_factor

        return NightWeather(
            date=date,
            avg_cloud_cover=avg_cloud,
            min_cloud_cover=min_cloud,
            max_cloud_cover=max_cloud,
            clear_duration_hours=float(clear_hours),
            clear_windows=clear_windows,
            hourly_data=hourly_night_data,
            avg_visibility_km=avg_visibility,
            avg_wind_speed_kmh=avg_wind,
            max_wind_speed_kmh=max_wind,
            avg_humidity=avg_humidity,
            avg_temperature_c=avg_temp,
            transparency_score=transparency,
        )

    @staticmethod
    def _find_clear_windows(
        hourly_data: Dict[datetime, float],
        threshold: float = 40,
        min_duration: int = 2,
    ) -> List[ClearWindow]:
        """Find consecutive clear weather windows.

        Args:
            hourly_data: Hourly cloud cover data
            threshold: Maximum cloud cover to be considered "clear"
            min_duration: Minimum hours for a valid window

        Returns:
            List of ClearWindow objects
        """
        if not hourly_data:
            return []

        # Sort hours
        sorted_hours = sorted(hourly_data.items())

        windows = []
        window_start = None
        window_clouds = []

        for i, (hour, clouds) in enumerate(sorted_hours):
            if clouds < threshold:
                # Clear hour
                if window_start is None:
                    window_start = hour
                    window_clouds = [clouds]
                else:
                    window_clouds.append(clouds)
            else:
                # Cloudy hour - close current window if exists
                if window_start is not None and len(window_clouds) >= min_duration:
                    window_end = sorted_hours[i - 1][0]
                    avg_clouds = sum(window_clouds) / len(window_clouds)
                    windows.append(ClearWindow(window_start, window_end, avg_clouds))

                window_start = None
                window_clouds = []

        # Close final window if exists
        if window_start is not None and len(window_clouds) >= min_duration:
            window_end = sorted_hours[-1][0]
            avg_clouds = sum(window_clouds) / len(window_clouds)
            windows.append(ClearWindow(window_start, window_end, avg_clouds))

        return windows

    @staticmethod
    def get_cloud_cover_description(avg_cloud_cover: float) -> str:
        """Get human-readable cloud cover description.

        Args:
            avg_cloud_cover: Average cloud cover percentage (0-100)

        Returns:
            Description string
        """
        if avg_cloud_cover < 20:
            return "Clear"
        elif avg_cloud_cover < 40:
            return "Mostly Clear"
        elif avg_cloud_cover < 60:
            return "Partly Cloudy"
        elif avg_cloud_cover < 80:
            return "Mostly Cloudy"
        else:
            return "Cloudy"

    @staticmethod
    def get_observing_quality(
        moon_illumination: float,
        avg_cloud_cover: Optional[float],
    ) -> tuple[str, str]:
        """Calculate overall observing quality combining moon and clouds.

        Args:
            moon_illumination: Moon illumination percentage (0-100)
            avg_cloud_cover: Average cloud cover (0-100), or None if unavailable

        Returns:
            Tuple of (quality_level, quality_description)
            quality_level: "excellent", "good", "fair", "poor"
            quality_description: Human-readable description
        """
        # If no weather data, fall back to moon-only assessment
        if avg_cloud_cover is None:
            if moon_illumination < 20:
                return ("excellent", "Excellent (DSO) - No weather data")
            elif moon_illumination < 40:
                return ("good", "Good (DSO) - No weather data")
            elif moon_illumination < 70:
                return ("fair", "Fair (Planets) - No weather data")
            else:
                return ("poor", "Poor (DSO) - No weather data")

        # Combined assessment with weather
        # Score based on both factors (lower is better)
        moon_score = moon_illumination  # 0-100
        cloud_score = avg_cloud_cover  # 0-100

        # Weight clouds more heavily (clouds block everything)
        combined_score = (cloud_score * 0.7) + (moon_score * 0.3)

        if combined_score < 20:
            return ("excellent", "Excellent - Dark & Clear")
        elif combined_score < 35:
            if avg_cloud_cover < 30:
                return ("good", "Good - Clear skies")
            else:
                return ("good", "Good - Some clouds")
        elif combined_score < 55:
            if avg_cloud_cover > 60:
                return ("fair", "Fair - Cloudy")
            elif moon_illumination > 60:
                return ("fair", "Fair - Bright moon")
            else:
                return ("fair", "Fair")
        else:
            if avg_cloud_cover > 70:
                return ("poor", "Poor - Very cloudy")
            else:
                return ("poor", "Poor - Bright moon & clouds")
