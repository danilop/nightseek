"""Format and display astronomical forecasts."""

from typing import List

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.rule import Rule
from rich import box

from analyzer import NightForecast, VisibilityScore
from weather import WeatherForecast, NightWeather
from scoring import ScoredObject, get_score_tier


class ForecastFormatter:
    """Format forecast data for terminal display."""

    # Weather condition icons (consistent width)
    WEATHER_ICONS = {
        "excellent": "☀️",
        "good": "🌤️",
        "fair": "⛅",
        "poor": "☁️",
        "bad": "🌧️",
    }

    # Moon phase icons (8 phases)
    MOON_ICONS = {
        "New Moon": "🌑",
        "Waxing Crescent": "🌒",
        "First Quarter": "🌓",
        "Waxing Gibbous": "🌔",
        "Full Moon": "🌕",
        "Waning Gibbous": "🌖",
        "Last Quarter": "🌗",
        "Waning Crescent": "🌘",
    }

    # Quality rating stars
    QUALITY_STARS = {
        "excellent": "★★★★★",
        "good": "★★★★☆",
        "fair": "★★★☆☆",
        "poor": "★★☆☆☆",
        "bad": "★☆☆☆☆",
    }

    # Object category icons
    CATEGORY_ICONS = {
        "planet": "🪐",
        "dso": "🌌",
        "comet": "☄",
        "asteroid": "🪨",
        "dwarf_planet": "🔵",
        "milky_way": "🌌",
        "galaxy": "🌀",
        "nebula": "☁️",  # Gas cloud representation
        "cluster": "✨",
        "star": "⭐",
        "planetary_nebula": "💫",
        "supernova_remnant": "💥",
    }

    # Planet magnitudes (approximate visual magnitudes)
    PLANET_MAGNITUDES = {
        "Mercury": 0.0,
        "Venus": -4.0,
        "Mars": 0.5,
        "Jupiter": -2.5,
        "Saturn": 0.5,
        "Uranus": 5.7,
        "Neptune": 7.8,
    }

    def __init__(self, tz_converter):
        """Initialize the formatter.

        Args:
            tz_converter: TimezoneConverter instance for time display
        """
        self.console = Console()
        self.tz = tz_converter

    # Minimum altitude threshold for visibility
    MIN_ALTITUDE = 30

    @staticmethod
    def _get_weather_category(clouds: float) -> tuple[str, str, str]:
        """Get weather category, description, and color based on cloud cover.

        Uses 5 tiers for more granular astrophotography planning:
        - Excellent: 0-10% (pristine conditions)
        - Good: 10-25% (minor interference)
        - Fair: 25-40% (noticeable but workable)
        - Poor: 40-60% (challenging conditions)
        - Bad: 60%+ (not recommended)

        Args:
            clouds: Cloud cover percentage (0-100)

        Returns:
            Tuple of (category, description, color)
        """
        if clouds < 10:
            return "excellent", "Excellent", "green"
        elif clouds < 25:
            return "good", "Good", "green"
        elif clouds < 40:
            return "fair", "Fair", "yellow"
        elif clouds < 60:
            return "poor", "Poor", "yellow"
        return "bad", "Cloudy", "red"

    @classmethod
    def _get_weather_icon(cls, category: str) -> str:
        """Get weather icon for a category."""
        return cls.WEATHER_ICONS.get(category, "")

    @classmethod
    def _get_moon_icon(cls, phase_name: str) -> str:
        """Get moon phase icon."""
        return cls.MOON_ICONS.get(phase_name, "🌙")

    @classmethod
    def _get_quality_stars(cls, quality: str) -> str:
        """Get star rating for quality level."""
        return cls.QUALITY_STARS.get(quality, "★☆☆☆☆")

    @staticmethod
    def _azimuth_to_cardinal(azimuth: float) -> str:
        """Convert azimuth degrees to cardinal direction.

        Args:
            azimuth: Compass bearing in degrees (0-360, 0=N, 90=E, 180=S, 270=W)

        Returns:
            Cardinal direction string (N, NE, E, SE, S, SW, W, NW)
        """
        # Normalize to 0-360
        azimuth = azimuth % 360
        # 8 cardinal directions, each spans 45°, centered on their direction
        directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        # Offset by 22.5° so N spans -22.5 to 22.5
        index = int((azimuth + 22.5) / 45) % 8
        return directions[index]

    @classmethod
    def _get_category_icon_from_dict(cls, category: str, subtype: str = "") -> str:
        """Get icon for object category from class dictionary."""
        # Check subtype first for DSOs
        if subtype:
            subtype_lower = subtype.lower()
            if "planetary" in subtype_lower and "nebula" in subtype_lower:
                return cls.CATEGORY_ICONS.get("planetary_nebula", "💫")
            elif "supernova" in subtype_lower:
                return cls.CATEGORY_ICONS.get("supernova_remnant", "💥")
            elif "galaxy" in subtype_lower:
                return cls.CATEGORY_ICONS.get("galaxy", "🌀")
            elif "nebula" in subtype_lower:
                return cls.CATEGORY_ICONS.get("nebula", "☁️")
            elif "cluster" in subtype_lower:
                return cls.CATEGORY_ICONS.get("cluster", "✨")
        return cls.CATEGORY_ICONS.get(category, "⭐")

    @staticmethod
    def _get_altitude_at_time(obj, target_time) -> float | None:
        """Get altitude at a specific time using stored samples.

        Uses linear interpolation between samples.

        Args:
            obj: ObjectVisibility with altitude_samples
            target_time: datetime to query

        Returns:
            Altitude in degrees, or None if no data
        """
        if not obj.altitude_samples:
            return None

        # Make target_time timezone-naive for comparison
        target_naive = (
            target_time.replace(tzinfo=None) if target_time.tzinfo else target_time
        )

        # Find surrounding samples
        prev_sample = None
        next_sample = None

        for sample_time, alt in obj.altitude_samples:
            sample_naive = (
                sample_time.replace(tzinfo=None) if sample_time.tzinfo else sample_time
            )
            if sample_naive <= target_naive:
                prev_sample = (sample_naive, alt)
            elif next_sample is None:
                next_sample = (sample_naive, alt)
                break

        if prev_sample is None and next_sample is None:
            return None
        if prev_sample is None and next_sample is not None:
            return next_sample[1]
        if next_sample is None and prev_sample is not None:
            return prev_sample[1]
        if prev_sample is None or next_sample is None:
            return None  # Shouldn't reach here, but satisfies type checker

        # Linear interpolation
        t1, a1 = prev_sample
        t2, a2 = next_sample
        total_seconds = (t2 - t1).total_seconds()
        if total_seconds == 0:
            return a1
        ratio = (target_naive - t1).total_seconds() / total_seconds
        return a1 + ratio * (a2 - a1)

    def _get_window_altitude_info(self, obj, window_start, window_end):
        """Get altitude info for an object during a specific time window.

        Args:
            obj: ObjectVisibility object
            window_start: Window start datetime
            window_end: Window end datetime

        Returns:
            Dict with 'start_alt', 'end_alt', 'max_alt', 'phase' (rising/peak/setting),
            'visible' (bool), and 'quality_desc'
        """
        start_alt = self._get_altitude_at_time(obj, window_start)
        end_alt = self._get_altitude_at_time(obj, window_end)

        # Check if visible during this window (above minimum)
        if start_alt is None or end_alt is None:
            return {"visible": False}

        max_in_window = max(start_alt, end_alt)
        min_in_window = min(start_alt, end_alt)

        # Check if peak time is within this window
        peak_in_window = False
        if obj.max_altitude_time:
            peak_naive = (
                obj.max_altitude_time.replace(tzinfo=None)
                if obj.max_altitude_time.tzinfo
                else obj.max_altitude_time
            )
            start_naive = (
                window_start.replace(tzinfo=None)
                if window_start.tzinfo
                else window_start
            )
            end_naive = (
                window_end.replace(tzinfo=None) if window_end.tzinfo else window_end
            )
            peak_in_window = start_naive <= peak_naive <= end_naive
            if peak_in_window:
                max_in_window = obj.max_altitude

        # Not visible if below minimum altitude throughout window
        if max_in_window < self.MIN_ALTITUDE:
            return {"visible": False}

        # Determine phase
        if peak_in_window:
            phase = "peak"
        elif end_alt > start_alt:
            phase = "rising"
        else:
            phase = "setting"

        # Quality based on max altitude in window
        if max_in_window >= 75:
            quality = "[green]Excellent[/green]"
        elif max_in_window >= 60:
            quality = "[green]Very Good[/green]"
        elif max_in_window >= 45:
            quality = "[yellow]Good[/yellow]"
        else:
            quality = "[red]Fair[/red]"

        return {
            "visible": True,
            "start_alt": start_alt,
            "end_alt": end_alt,
            "max_alt": max_in_window,
            "min_alt": min_in_window,
            "phase": phase,
            "peak_in_window": peak_in_window,
            "quality_desc": quality,
        }

    def format_forecast(
        self,
        forecasts: List[NightForecast],
        latitude: float,
        longitude: float,
        best_dark_nights: List[int],
        max_objects: int = 8,
        analyzer=None,  # Optional analyzer to avoid reloading data
    ):
        """Format and display the complete forecast.

        Args:
            forecasts: List of night forecasts
            latitude: Observer latitude
            longitude: Observer longitude
            best_dark_nights: Indices of best dark nights
            max_objects: Maximum objects to show per night
            analyzer: Optional VisibilityAnalyzer instance to reuse
        """
        # Store analyzer for use in helper methods
        self.analyzer = analyzer

        # Header
        self._print_header(forecasts[0], forecasts[-1], latitude, longitude)

        # Moon phase summary
        self._print_moon_summary(forecasts, best_dark_nights)

        # Section divider
        self.console.print(Rule(style="dim"))
        self.console.print()

        # Tonight's highlights (first night only)
        self._print_tonight_highlights(forecasts[0], max_objects)

        # Section divider
        self.console.print()
        self.console.print(Rule(style="dim"))
        self.console.print()

        # Weekly forecast by object type
        self._print_weekly_forecast(forecasts, max_objects)

    def _print_header(
        self,
        first_night: NightForecast,
        last_night: NightForecast,
        latitude: float,
        longitude: float,
    ):
        """Print forecast header."""
        start = first_night.night_info.date.strftime("%b %d")
        end = last_night.night_info.date.strftime("%b %d, %Y")

        header = Text()
        header.append("🔭 Sky Observation Forecast\n", style="bold cyan")
        header.append(f"📅 Period: {start} - {end}\n")
        header.append(f"📍 Location: {latitude:.4f}°, {longitude:.4f}°\n", style="dim")
        header.append(f"🕐 Times: {self.tz.get_display_info()}", style="dim")

        self.console.print(Panel(header, border_style="cyan"))
        self.console.print()

    def _print_moon_summary(
        self, forecasts: List[NightForecast], best_dark_nights: List[int]
    ):
        """Print moon phase summary, weather, and observing windows."""
        # Check if we have weather data
        has_weather = any(f.weather is not None for f in forecasts)

        if has_weather:
            self.console.print("[bold cyan]🌤️  OBSERVING CONDITIONS[/bold cyan]")
        else:
            self.console.print(
                "[bold cyan]🌙 MOON PHASE & DARK SKY WINDOWS[/bold cyan]"
            )
        self.console.print(
            "[italic]Dark sky window = astronomical night (sun >18° below horizon)[/italic]"
        )
        self.console.print()

        # Build table with conditional weather columns
        table = Table(
            show_header=True,
            header_style="bold",
            box=box.SIMPLE,
            padding=(0, 1),
        )
        table.add_column("Date")
        table.add_column("Night")
        table.add_column("Moon")

        if has_weather:
            table.add_column("☁️", justify="center")  # Clouds
            table.add_column("Best")

        table.add_column("Rating")

        for i, forecast in enumerate(forecasts):
            date_str = forecast.night_info.date.strftime("%a, %b %d")

            # Format night time interval (astronomical dusk to dawn)
            dusk_time = self.tz.format_time(forecast.night_info.astronomical_dusk)
            dawn_time = self.tz.format_time(forecast.night_info.astronomical_dawn)
            night_str = f"{dusk_time}-{dawn_time}"

            phase_name = self._get_moon_phase_name(forecast.night_info.moon_phase)
            moon_icon = self._get_moon_icon(phase_name)
            moon_pct = forecast.night_info.moon_illumination
            # Compact phase with illumination percentage
            short_phase = (
                phase_name.replace("Waxing ", "")
                .replace("Waning ", "")
                .replace(" Moon", "")
            )
            phase_str = f"{moon_icon} {short_phase} ({moon_pct:.0f}%)"

            # Get quality rating
            cloud_cover = forecast.weather.avg_cloud_cover if forecast.weather else None
            aod = (
                forecast.weather.avg_aerosol_optical_depth if forecast.weather else None
            )
            quality_level, quality_desc = WeatherForecast.get_observing_quality(
                forecast.night_info.moon_illumination,
                cloud_cover,
                aod,
            )

            # Get weather icon and quality stars
            weather_icon = self._get_weather_icon(quality_level)
            quality_stars = self._get_quality_stars(quality_level)

            # Color code quality with stars
            if quality_level == "excellent":
                quality_colored = f"[green]{weather_icon} {quality_stars}[/green]"
            elif quality_level == "good":
                quality_colored = f"[green]{weather_icon} {quality_stars}[/green]"
            elif quality_level == "fair":
                quality_colored = f"[yellow]{weather_icon} {quality_stars}[/yellow]"
            else:
                quality_colored = f"[red]{weather_icon} {quality_stars}[/red]"

            # Build row
            if has_weather:
                if forecast.weather:
                    # Show cloud cover range (min-max) during night
                    cloud_str = f"{forecast.weather.min_cloud_cover:.0f}-{forecast.weather.max_cloud_cover:.0f}%"
                    # Best time to observe (uses shared helper with moon data)
                    time_str, best_cloud = self._get_best_time_str(
                        forecast.weather, forecast.night_info
                    )
                    if time_str:
                        best_time_str = (
                            f"[green]{time_str}[/green]"
                            if best_cloud is not None and best_cloud < 30
                            else time_str
                        )
                    else:
                        best_time_str = "-"
                else:
                    cloud_str = "N/A"
                    best_time_str = "-"
                table.add_row(
                    date_str,
                    night_str,
                    phase_str,
                    cloud_str,
                    best_time_str,
                    quality_colored,
                )
            else:
                table.add_row(date_str, night_str, phase_str, quality_colored)

        self.console.print(table)
        self.console.print()

        # Highlight best nights - but only if they're actually worth observing
        if best_dark_nights:
            # Filter to nights with at least "fair" quality
            recommendable_nights = []
            for i in best_dark_nights[:3]:
                forecast = forecasts[i]
                cloud_cover = (
                    forecast.weather.avg_cloud_cover if forecast.weather else None
                )
                aod = (
                    forecast.weather.avg_aerosol_optical_depth
                    if forecast.weather
                    else None
                )
                quality_level, _ = WeatherForecast.get_observing_quality(
                    forecast.night_info.moon_illumination, cloud_cover, aod
                )
                # Only recommend "excellent", "good", or "fair" nights
                if quality_level in ("excellent", "good", "fair"):
                    recommendable_nights.append((i, quality_level))

            if recommendable_nights:
                best_dates = [
                    forecasts[i].night_info.date.strftime("%b %d")
                    for i, _ in recommendable_nights
                ]
                # Check if top night is excellent/good
                top_quality = recommendable_nights[0][1]
                if top_quality == "excellent":
                    self.console.print(
                        f"[green]★ Excellent nights for observing:[/green] {', '.join(best_dates)} "
                        "[italic](dark skies, clear weather)[/italic]"
                    )
                elif top_quality == "good":
                    self.console.print(
                        f"[green]★ Good nights for observing:[/green] {', '.join(best_dates)} "
                        "[italic](favorable conditions)[/italic]"
                    )
                else:
                    self.console.print(
                        f"[yellow]★ Best available nights:[/yellow] {', '.join(best_dates)} "
                        "[italic](conditions are fair)[/italic]"
                    )
                self.console.print()
            else:
                # All nights are poor - warn the user
                self.console.print(
                    "[red]⚠ No ideal nights this week[/red] "
                    "[italic](high clouds or bright moon throughout)[/italic]"
                )
                self.console.print()

    def _print_celestial_events(self, forecast: NightForecast):
        """Print celestial events (conjunctions, meteor showers)."""
        has_events = False

        # Check for conjunctions
        notable_conjunctions = (
            [c for c in forecast.conjunctions if c.is_notable]
            if forecast.conjunctions
            else []
        )

        # Check for meteor showers
        active_showers = forecast.meteor_showers if forecast.meteor_showers else []

        if not notable_conjunctions and not active_showers:
            return

        self.console.print("[bold magenta]✨ CELESTIAL EVENTS[/bold magenta]")

        # Print conjunctions
        for conj in notable_conjunctions[:3]:  # Show top 3 closest
            if conj.separation_degrees < 2:
                icon = "🌟"
                color = "yellow"
            else:
                icon = "✨"
                color = "cyan"
            self.console.print(f"  {icon} [{color}]{conj.description}[/{color}]")
            has_events = True

        # Print meteor showers
        for shower in active_showers:
            # Only show if radiant gets above horizon
            if shower.radiant_altitude and shower.radiant_altitude > 0:
                # Determine moon interference level
                moon_impact = ""
                if shower.moon_illumination and shower.moon_separation_deg:
                    moon_ill = shower.moon_illumination
                    moon_sep = shower.moon_separation_deg

                    # Moon interference: bright moon + close to radiant = bad
                    if moon_ill > 70 and moon_sep < 60:
                        moon_impact = " [red](moon interference)[/red]"
                    elif moon_ill > 50 and moon_sep < 90:
                        moon_impact = " [yellow](some moon interference)[/yellow]"
                    elif moon_ill < 30:
                        moon_impact = " [green](dark sky)[/green]"

                # Peak status
                if shower.days_from_peak is not None:
                    if shower.days_from_peak == 0:
                        peak_status = "[bold yellow]PEAK TONIGHT[/bold yellow]"
                    elif shower.days_from_peak == 1:
                        peak_status = "near peak"
                    elif shower.days_from_peak <= 3:
                        peak_status = f"{shower.days_from_peak}d from peak"
                    else:
                        peak_status = "active"
                else:
                    peak_status = "active"

                # ZHR info
                zhr_info = f"ZHR ~{shower.zhr}" if shower.zhr >= 20 else ""

                self.console.print(f"  ☄️  {shower.name} ({peak_status}){moon_impact}")
                if zhr_info:
                    self.console.print(f"      {zhr_info}")
                has_events = True

        if has_events:
            self.console.print()

    def _print_conjunctions(self, forecast: NightForecast):
        """Print notable conjunctions for tonight (deprecated - use _print_celestial_events)."""
        # Keep for backward compatibility but redirect to new method
        self._print_celestial_events(forecast)

    def _print_weather_extras(self, weather: NightWeather, night_info=None):
        """Print additional weather information (wind, visibility, humidity, etc.)."""
        extras = []
        warnings = []

        # Wind warning
        if weather.avg_wind_speed_kmh is not None:
            wind = weather.avg_wind_speed_kmh
            if wind > 30:
                warnings.append(
                    f"[red]Strong wind ({wind:.0f} km/h) - unstable imaging[/red]"
                )
            elif wind > 20:
                warnings.append(f"[yellow]Moderate wind ({wind:.0f} km/h)[/yellow]")

        # Visibility/transparency
        if weather.avg_visibility_km is not None:
            vis = weather.avg_visibility_km
            if vis < 10:
                extras.append(f"[yellow]Limited visibility ({vis:.0f} km)[/yellow]")
            elif vis >= 30:
                extras.append(f"[green]Excellent transparency ({vis:.0f} km)[/green]")

        # Dew risk (using actual dew margin instead of just humidity)
        if weather.min_dew_margin is not None:
            if weather.min_dew_margin < 2:
                warnings.append(
                    f"[red]Dew risk - margin {weather.min_dew_margin:.1f}°C[/red]"
                )
            elif weather.min_dew_margin < 3:
                warnings.append(
                    f"[yellow]Dew possible - margin {weather.min_dew_margin:.1f}°C[/yellow]"
                )
        elif weather.avg_humidity is not None and weather.avg_humidity > 85:
            warnings.append(
                f"[yellow]High humidity ({weather.avg_humidity:.0f}%) - dew risk[/yellow]"
            )

        # Precipitation
        if (
            weather.max_precip_probability is not None
            and weather.max_precip_probability > 20
        ):
            if weather.max_precip_probability > 50:
                warnings.append(
                    f"[red]Rain likely ({weather.min_precip_probability:.0f}-{weather.max_precip_probability:.0f}%)[/red]"
                )
            else:
                warnings.append(
                    f"[yellow]Rain possible ({weather.min_precip_probability:.0f}-{weather.max_precip_probability:.0f}%)[/yellow]"
                )

        # CAPE / Storm risk
        if weather.max_cape is not None and weather.max_cape > 500:
            if weather.max_cape > 1500:
                warnings.append(
                    f"[red]Storm risk (CAPE {weather.max_cape:.0f} J/kg)[/red]"
                )
            else:
                warnings.append(
                    f"[yellow]Unstable atmosphere (CAPE {weather.max_cape:.0f} J/kg)[/yellow]"
                )

        # Temperature (cold warning)
        if weather.avg_temperature_c is not None and weather.avg_temperature_c < 0:
            extras.append(f"Temp: {weather.avg_temperature_c:.0f}°C")

        # Humidity - only show if no dew warning already present (avoid redundancy)
        has_dew_warning = (
            weather.min_dew_margin is not None and weather.min_dew_margin < 3
        )
        if weather.avg_humidity is not None and not has_dew_warning:
            hum = weather.avg_humidity
            if hum > 85:
                extras.append(f"[yellow]Humidity: {hum:.0f}%[/yellow]")
            elif hum > 75:
                extras.append(f"Humidity: {hum:.0f}%")
            elif hum < 40:
                extras.append(f"[green]Humidity: {hum:.0f}% (dry)[/green]")
            # Don't show moderate humidity (40-75%) to reduce clutter

        # Print warnings first (important)
        if warnings:
            self.console.print("[italic]⚠ " + " • ".join(warnings) + "[/italic]")

        # Print extras (informational)
        if extras:
            self.console.print("[italic]" + " • ".join(extras) + "[/italic]")

        # Print detailed conditions on separate line
        self._print_weather_details(weather, night_info)

    def _print_weather_details(self, weather: NightWeather, night_info=None):
        """Print detailed weather breakdown (cloud layers, stability, best time)."""
        details = []

        # Cloud layers (always show if available)
        if weather.cloud_cover_low is not None:
            layers = []
            if weather.cloud_cover_low > 10:
                layers.append(f"Low:{weather.cloud_cover_low:.0f}%")
            if weather.cloud_cover_mid is not None and weather.cloud_cover_mid > 10:
                layers.append(f"Mid:{weather.cloud_cover_mid:.0f}%")
            if weather.cloud_cover_high is not None and weather.cloud_cover_high > 10:
                layers.append(f"High:{weather.cloud_cover_high:.0f}%")
            if layers:
                details.append(f"Clouds: {', '.join(layers)}")

        # Atmospheric stability (pressure-based with trend)
        if weather.avg_pressure_hpa is not None:
            pressure = weather.avg_pressure_hpa
            trend = weather.pressure_trend
            # Trend arrows: ↑ = rising (improving), ↓ = falling (deteriorating)
            trend_str = {
                "rising": " ↑",
                "falling": " ↓",
                "steady": "",
            }.get(trend, "")

            if pressure >= 1020:
                details.append(f"[green]Stable ({pressure:.0f} hPa{trend_str})[/green]")
            elif pressure >= 1010:
                if trend == "falling":
                    details.append(f"[yellow]{pressure:.0f} hPa{trend_str}[/yellow]")
                else:
                    details.append(f"{pressure:.0f} hPa{trend_str}")
            else:
                if trend == "rising":
                    # Low pressure but rising = improving
                    details.append(
                        f"[yellow]Unsettled ({pressure:.0f} hPa{trend_str})[/yellow]"
                    )
                else:
                    details.append(
                        f"[red]Unsettled ({pressure:.0f} hPa{trend_str})[/red]"
                    )

        # Air quality / haze (AOD-based)
        if weather.avg_aerosol_optical_depth is not None:
            aod = weather.avg_aerosol_optical_depth
            if aod < 0.1:
                details.append(f"[green]Clear air (AOD {aod:.2f})[/green]")
            elif aod < 0.2:
                details.append(f"Good air (AOD {aod:.2f})")
            elif aod < 0.4:
                details.append(f"[yellow]Hazy (AOD {aod:.2f})[/yellow]")
            else:
                details.append(f"[red]Very hazy (AOD {aod:.2f})[/red]")

        # Dust warning (Saharan dust events)
        if weather.avg_dust is not None and weather.avg_dust > 50:
            details.append(f"[yellow]Dust: {weather.avg_dust:.0f} μg/m³[/yellow]")

        # Transparency score (combined visibility + cloud + AOD assessment)
        if weather.transparency_score is not None:
            ts = weather.transparency_score
            if ts >= 80:
                details.append(f"[green]Transparency: {ts:.0f}%[/green]")
            elif ts >= 60:
                details.append(f"Transparency: {ts:.0f}%")
            elif ts >= 40:
                details.append(f"[yellow]Transparency: {ts:.0f}%[/yellow]")
            else:
                details.append(f"[red]Transparency: {ts:.0f}%[/red]")

        # Best observing time (uses helper for DRY with weekly forecast)
        best_time_info = self._format_best_time_info(
            weather, include_clouds=True, night_info=night_info
        )
        if best_time_info:
            details.append(best_time_info)

        if details:
            self.console.print("[dim]" + " • ".join(details) + "[/dim]")

    def _print_tonight_highlights(self, forecast: NightForecast, max_objects: int):
        """Print tonight's highlights grouped by weather-based time windows.

        Uses merit-based selection - no category quotas.
        """
        # Use provided analyzer or create temporary one
        if hasattr(self, "analyzer") and self.analyzer:
            analyzer = self.analyzer
        else:
            from analyzer import VisibilityAnalyzer

            analyzer = VisibilityAnalyzer(0, 0)  # Coordinates don't matter for ranking

        scored_objects = analyzer.rank_objects_for_night(
            forecast,
            max_objects=max_objects * 2,  # Get more for window distribution
        )

        if not scored_objects:
            self.console.print(
                "[yellow]No objects above minimum altitude tonight[/yellow]"
            )
            self.console.print()
            return

        # Print conjunctions first if any
        self._print_conjunctions(forecast)

        self.console.print("[bold cyan]🔭 TONIGHT'S OBSERVATION PLAN[/bold cyan]")
        date_str = forecast.night_info.date.strftime("%A, %B %d")
        moon_pct = f"{forecast.night_info.moon_illumination:.0f}%"
        self.console.print(
            f"[italic]{date_str} • Moon: {moon_pct} illuminated[/italic]"
        )

        # Print weather warnings and details
        if forecast.weather:
            self._print_weather_extras(forecast.weather, forecast.night_info)

        self.console.print()

        # Group objects by weather-based time windows (dynamic, not fixed 2hr)
        time_windows = self._group_by_weather_windows(
            forecast, scored_objects, max_objects
        )

        # Print each time window
        for window_info in time_windows:
            self._print_time_window_scored(window_info, forecast)

        self.console.print()

    def _group_by_weather_windows(
        self,
        forecast: NightForecast,
        scored_objects: List[ScoredObject],
        max_objects: int,
    ):
        """Group objects by weather-based time windows.

        Windows are grouped by weather conditions (clear/partly/cloudy).
        NO fixed 2-hour splitting - windows reflect actual weather variability.
        """
        from datetime import datetime, timedelta, timezone
        from typing import Any

        if (
            not forecast.night_info.astronomical_dusk
            or not forecast.night_info.astronomical_dawn
        ):
            return []

        dusk: datetime = forecast.night_info.astronomical_dusk
        dawn: datetime = forecast.night_info.astronomical_dawn

        if dawn <= dusk:
            dawn = dawn + timedelta(days=1)

        # Build weather-based windows (no fixed splitting)
        windows: list[dict[str, Any]] = []

        if forecast.weather and forecast.weather.hourly_data:
            dusk_naive = dusk.replace(tzinfo=None) if dusk.tzinfo else dusk
            dawn_naive = dawn.replace(tzinfo=None) if dawn.tzinfo else dawn

            night_hours = sorted(
                [
                    (h, c)
                    for h, c in forecast.weather.hourly_data.items()
                    if dusk_naive <= h <= dawn_naive
                ]
            )

            if night_hours:
                # Group consecutive hours with same weather category
                current_start = night_hours[0][0]
                current_cat = self._get_weather_category(night_hours[0][1])[0]
                current_clouds = [night_hours[0][1]]

                for i in range(1, len(night_hours)):
                    hour, clouds = night_hours[i]
                    cat = self._get_weather_category(clouds)[0]

                    if cat != current_cat:
                        # Save current window - natural boundary
                        windows.append(
                            {
                                "start": current_start.replace(tzinfo=timezone.utc),
                                "end": hour.replace(tzinfo=timezone.utc),
                                "avg_clouds": sum(current_clouds) / len(current_clouds),
                                "min_clouds": min(current_clouds),
                                "max_clouds": max(current_clouds),
                                "weather_category": current_cat,
                                "objects": [],
                            }
                        )
                        current_start = hour
                        current_cat = cat
                        current_clouds = [clouds]
                    else:
                        current_clouds.append(clouds)

                # Add final window
                windows.append(
                    {
                        "start": current_start.replace(tzinfo=timezone.utc),
                        "end": dawn_naive.replace(tzinfo=timezone.utc),
                        "avg_clouds": sum(current_clouds) / len(current_clouds),
                        "min_clouds": min(current_clouds),
                        "max_clouds": max(current_clouds),
                        "weather_category": current_cat,
                        "objects": [],
                    }
                )

        # Fallback: single window if no weather data
        if not windows:
            windows = [
                {
                    "start": dusk,
                    "end": dawn,
                    "avg_clouds": None,
                    "weather_category": None,
                    "objects": [],
                }
            ]

        # Collect all visibility objects for lookups
        all_visibility_objects = (
            forecast.planets
            + forecast.dsos
            + forecast.comets
            + forecast.dwarf_planets
            + forecast.asteroids
            + [forecast.milky_way]
        )

        # Assign scored objects to windows where they're actually visible
        for window in windows:
            window_objects = []

            for scored in scored_objects:
                # Find matching visibility object
                vis_obj = None
                for obj in all_visibility_objects:
                    if (
                        scored.object_name == obj.object_name
                        or scored.object_name in obj.object_name
                    ):
                        vis_obj = obj
                        break

                if vis_obj is None:
                    continue

                # Get window-specific altitude info
                window_info = self._get_window_altitude_info(
                    vis_obj, window["start"], window["end"]
                )
                if window_info["visible"]:
                    window_objects.append(
                        {
                            "scored": scored,
                            "vis": vis_obj,
                            "window_info": window_info,
                        }
                    )

            # Merit-based selection within window (no category quotas)
            # Sort by score and take top max_objects
            window_objects.sort(key=lambda x: x["scored"].total_score, reverse=True)
            window["objects"] = window_objects[:max_objects]

        # Filter out empty windows
        return [w for w in windows if w["objects"]]

    def _group_by_time_windows(self, forecast, scores, max_objects: int):
        """Legacy method - redirects to weather-based grouping."""
        # Convert legacy VisibilityScore to format expected by new method
        from scoring import ScoredObject

        scored_objects = []
        for score in scores:
            # Find the visibility object
            vis = None
            for obj in (
                forecast.planets
                + forecast.dsos
                + forecast.comets
                + forecast.dwarf_planets
                + forecast.asteroids
                + [forecast.milky_way]
            ):
                if score.object_name in obj.object_name:
                    vis = obj
                    break

            if vis:
                scored_objects.append(
                    ScoredObject(
                        object_name=score.object_name,
                        category=vis.object_type,
                        subtype=getattr(vis, "subtype", ""),
                        total_score=score.score,
                        score_breakdown={},
                        reason=score.reason,
                        visibility=vis,
                        magnitude=getattr(vis, "magnitude", None),
                    )
                )

        return self._group_by_weather_windows(forecast, scored_objects, max_objects)

    def _print_time_window(self, window_data, forecast):
        """Print a single time window with its objects (legacy format)."""
        start_str = self.tz.format_time(window_data["start"])
        end_str = self.tz.format_time(window_data["end"])

        # Format weather info
        weather_str = ""
        weather_color = ""
        if window_data["avg_clouds"] is not None:
            _, weather_str, weather_color = self._get_weather_category(
                window_data["avg_clouds"]
            )

        # Print window header
        if weather_str:
            self.console.print(
                f"[bold]{start_str} - {end_str}[/bold] "
                f"[{weather_color}]{weather_str}[/{weather_color}]"
            )
        else:
            self.console.print(f"[bold]{start_str} - {end_str}[/bold]")

        # Print objects in this window with window-specific data
        for obj_info in window_data["objects"]:
            obj = obj_info.get("vis") or obj_info.get("obj")
            scored = obj_info.get("scored")
            name = (
                scored.object_name if scored else obj_info.get("name", obj.object_name)
            )
            win_info = obj_info.get("window_info", {})

            # Get magnitude
            mag = None
            if hasattr(obj, "magnitude") and obj.magnitude is not None:
                mag = obj.magnitude
            elif name in self.PLANET_MAGNITUDES:
                mag = self.PLANET_MAGNITUDES[name]

            mag_str = f" (mag {mag:.1f})" if mag is not None else ""

            # Build window-specific altitude description
            if win_info.get("visible"):
                quality = win_info["quality_desc"]
                phase = win_info["phase"]
                start_alt = win_info["start_alt"]
                end_alt = win_info["end_alt"]

                if phase == "peak":
                    peak_time_str = self.tz.format_time(obj.max_altitude_time)
                    alt_desc = f"peaks {obj.max_altitude:.0f}° at {peak_time_str}"
                elif phase == "rising":
                    alt_desc = f"{start_alt:.0f}°→{end_alt:.0f}° rising"
                else:  # setting
                    alt_desc = f"{start_alt:.0f}°→{end_alt:.0f}° setting"

                self.console.print(f"  • {name}{mag_str} - {quality}, {alt_desc}")
            else:
                self.console.print(
                    f"  • {name}{mag_str} - "
                    f"(peak {obj.max_altitude:.0f}° at {self.tz.format_time(obj.max_altitude_time)})"
                )

        self.console.print()

    def _print_time_window_scored(self, window_data, forecast: NightForecast):
        """Print a time window with scored objects showing quality ratings."""
        start_str = self.tz.format_time(window_data["start"])
        end_str = self.tz.format_time(window_data["end"])

        # Format weather info with cloud % range
        weather_str = ""
        weather_color = ""
        weather_icon = ""
        if window_data.get("avg_clouds") is not None:
            category, cat_desc, weather_color = self._get_weather_category(
                window_data["avg_clouds"]
            )
            weather_icon = self._get_weather_icon(category)
            min_c = window_data.get("min_clouds", window_data["avg_clouds"])
            max_c = window_data.get("max_clouds", window_data["avg_clouds"])

            # Show range if it varies, otherwise just the value
            if max_c - min_c > 5:
                weather_str = f"{weather_icon} {cat_desc} ({min_c:.0f}-{max_c:.0f}%)"
            else:
                weather_str = (
                    f"{weather_icon} {cat_desc} ({window_data['avg_clouds']:.0f}%)"
                )

        # Print window header with duration
        duration_hours = (
            window_data["end"] - window_data["start"]
        ).total_seconds() / 3600
        duration_str = (
            f"{duration_hours:.1f}h"
            if duration_hours != int(duration_hours)
            else f"{int(duration_hours)}h"
        )

        if weather_str:
            self.console.print(
                f"\n[bold]{start_str} - {end_str}[/bold] ({duration_str}) "
                f"[{weather_color}]{weather_str}[/{weather_color}]"
            )
        else:
            self.console.print(
                f"\n[bold]{start_str} - {end_str}[/bold] ({duration_str})"
            )

        # Print objects with score information
        for obj_info in window_data["objects"]:
            scored: ScoredObject = obj_info["scored"]
            vis = obj_info["vis"]
            win_info = obj_info.get("window_info", {})

            # Get score tier and stars
            tier, stars = get_score_tier(scored.total_score)

            # Get magnitude
            mag = scored.magnitude
            if mag is None and scored.object_name in self.PLANET_MAGNITUDES:
                mag = self.PLANET_MAGNITUDES[scored.object_name]
            mag_str = f" (mag {mag:.1f})" if mag is not None else ""

            # Add planet apparent diameter if available
            diameter_str = ""
            if (
                hasattr(vis, "apparent_diameter_arcsec")
                and vis.apparent_diameter_arcsec is not None
            ):
                d = vis.apparent_diameter_arcsec
                d_min = vis.apparent_diameter_min
                d_max = vis.apparent_diameter_max
                if d_min and d_max:
                    # Calculate how good current size is (0-100%)
                    size_quality = (
                        (d - d_min) / (d_max - d_min) * 100 if d_max > d_min else 50
                    )
                    if size_quality > 70:
                        diameter_str = f' [green]• size {d:.1f}" (near max, {d_min:.1f}"-{d_max:.1f}")[/green]'
                    elif size_quality > 40:
                        diameter_str = (
                            f' • size {d:.1f}" (range {d_min:.1f}"-{d_max:.1f}")'
                        )
                    else:
                        diameter_str = f' [dim]• size {d:.1f}" (small, range {d_min:.1f}"-{d_max:.1f}")[/dim]'
                else:
                    diameter_str = f' • size {d:.1f}"'

            # Build altitude description with azimuth direction (consistent format)
            azimuth = getattr(vis, "azimuth_at_peak", None)
            direction_str = (
                f" {self._azimuth_to_cardinal(azimuth)}" if azimuth is not None else ""
            )

            if win_info.get("visible"):
                phase = win_info["phase"]
                start_alt = win_info["start_alt"]
                end_alt = win_info["end_alt"]

                if phase == "peak":
                    peak_time_str = self.tz.format_time(vis.max_altitude_time)
                    alt_desc = f"peaks {vis.max_altitude:.0f}°{direction_str} at {peak_time_str}"
                elif phase == "rising":
                    alt_desc = f"{start_alt:.0f}°→{end_alt:.0f}°{direction_str} rising"
                else:
                    alt_desc = f"{start_alt:.0f}°→{end_alt:.0f}°{direction_str} setting"
            else:
                alt_desc = f"peak {vis.max_altitude:.0f}°{direction_str}"

            # Get category icon
            category = scored.category if hasattr(scored, "category") else "dso"
            subtype = scored.subtype if hasattr(scored, "subtype") else ""
            icon = self._get_category_icon(category, subtype)

            # Format: Icon Name (mag) [diameter] - altitude info
            # Why: reason
            self.console.print(
                f"  {icon} {scored.object_name}{mag_str}{diameter_str} - {alt_desc}"
            )
            self.console.print(f"    [dim italic]Why: {scored.reason}[/dim italic]")

        self.console.print()

    def _print_object_highlight(self, score: VisibilityScore, forecast: NightForecast):
        """Print a single object highlight."""
        # Find the object in forecast
        obj_vis = None
        for obj in forecast.planets + forecast.dsos + [forecast.milky_way]:
            if score.object_name in obj.object_name:
                obj_vis = obj
                break

        if not obj_vis:
            return

        # Build description
        desc = Text()
        desc.append(f"• {score.object_name}", style="bold")
        desc.append(f" - {score.reason}", style="green")
        desc.append(
            f"\n  Peak: {obj_vis.max_altitude:.0f}° at {self.tz.format_time(obj_vis.max_altitude_time)}",
            style="italic",
        )

        # Add visibility windows (show highest threshold that has data)
        windows = self._format_visibility_windows(obj_vis)
        if windows:
            desc.append(f"\n  {windows}", style="italic")

        self.console.print(desc)

    def _format_visibility_windows(self, vis) -> str:
        """Format altitude visibility windows concisely.

        Shows the best available windows (highest altitude threshold).
        """
        parts = []

        # Show windows from highest to lowest threshold
        if vis.above_75_start and vis.above_75_end:
            start = self.tz.format_time(vis.above_75_start)
            end = self.tz.format_time(vis.above_75_end)
            parts.append(f"Above 75°: {start}-{end}")
        if vis.above_60_start and vis.above_60_end:
            start = self.tz.format_time(vis.above_60_start)
            end = self.tz.format_time(vis.above_60_end)
            parts.append(f"Above 60°: {start}-{end}")
        if vis.above_45_start and vis.above_45_end:
            start = self.tz.format_time(vis.above_45_start)
            end = self.tz.format_time(vis.above_45_end)
            parts.append(f"Above 45°: {start}-{end}")

        # Return most relevant (highest threshold first, limit to 2)
        return " • ".join(parts[:2]) if parts else ""

    def _print_weekly_forecast(self, forecasts: List[NightForecast], max_objects: int):
        """Print forecast with merit-based object selection per night."""
        from analyzer import VisibilityAnalyzer

        # Skip tonight (first forecast) since it's already shown in detail
        # Only show subsequent nights in this section
        remaining_forecasts = forecasts[1:] if len(forecasts) > 1 else forecasts

        num_days = len(remaining_forecasts)
        if num_days == 0:
            return  # Nothing to show if only tonight was requested
        elif num_days == 1:
            title = "📆 TOMORROW'S TARGETS"
        elif num_days <= 3:
            title = f"📆 NEXT {num_days} NIGHTS"
        else:
            title = f"📆 UPCOMING {num_days} NIGHTS"

        self.console.print(f"[bold cyan]{title}[/bold cyan]")
        self.console.print()

        has_weather = any(f.weather is not None for f in remaining_forecasts)

        # Score each night for ranking
        night_scores = []
        for forecast in remaining_forecasts:
            score = 100 - forecast.night_info.moon_illumination
            if has_weather and forecast.weather:
                score -= forecast.weather.avg_cloud_cover * 0.7
            night_scores.append((forecast, score))

        # Sort nights by score (best first)
        night_scores.sort(key=lambda x: x[1], reverse=True)
        best_night_date = night_scores[0][0].night_info.date.strftime("%Y-%m-%d")

        # Use provided analyzer or create temporary one
        if hasattr(self, "analyzer") and self.analyzer:
            analyzer = self.analyzer
        else:
            from analyzer import VisibilityAnalyzer

            analyzer = VisibilityAnalyzer(0, 0)

        # Show each night
        for forecast, night_score in night_scores:
            date_str = forecast.night_info.date.strftime("%a, %b %d")
            is_best = forecast.night_info.date.strftime("%Y-%m-%d") == best_night_date

            # Build header
            if is_best and len(forecasts) > 1:
                header = f"[bold yellow]★ {date_str}[/bold yellow] [italic]Best Night[/italic]"
            else:
                header = f"[bold]{date_str}[/bold]"

            # Conditions
            moon_pct = forecast.night_info.moon_illumination
            conditions = f"Moon {moon_pct:.0f}%"
            if has_weather and forecast.weather:
                conditions += f" • {self._format_cloud_conditions(forecast.weather)}"
                # Add best observing time
                best_time_info = self._format_best_time_info(
                    forecast.weather, night_info=forecast.night_info
                )
                if best_time_info:
                    conditions += f" • {best_time_info}"
                # Add air quality if notable
                if forecast.weather.avg_aerosol_optical_depth is not None:
                    aod = forecast.weather.avg_aerosol_optical_depth
                    if aod < 0.1:
                        conditions += " • Clear air"
                    elif aod > 0.3:
                        conditions += f" • [yellow]Hazy (AOD {aod:.2f})[/yellow]"

            self.console.print(f"{header}")
            self.console.print(f"[italic]{conditions}[/italic]")

            # Get scored objects using merit-based selection
            scored_objects = analyzer.rank_objects_for_night(
                forecast, max_objects=max_objects
            )

            if not scored_objects:
                self.console.print(
                    "  [italic]No objects visible above threshold[/italic]"
                )
            else:
                for scored in scored_objects:
                    vis = scored.visibility
                    tier, stars = get_score_tier(scored.total_score)

                    # Get icon based on category
                    icon = self._get_category_icon(scored.category, scored.subtype)

                    # Get magnitude
                    mag = scored.magnitude
                    if mag is None and scored.object_name in self.PLANET_MAGNITUDES:
                        mag = self.PLANET_MAGNITUDES[scored.object_name]
                    mag_str = (
                        f" [italic](mag {mag:.1f})[/italic]" if mag is not None else ""
                    )

                    quality = self._get_quality_color(vis.max_altitude)
                    time_str = self.tz.format_time(vis.max_altitude_time)

                    # Add azimuth direction (check for None, not falsy, since 0° is valid)
                    azimuth = getattr(vis, "azimuth_at_peak", None)
                    direction = (
                        f" {self._azimuth_to_cardinal(azimuth)}"
                        if azimuth is not None
                        else ""
                    )

                    # Warnings
                    warning = ""
                    if hasattr(vis, "moon_warning") and vis.moon_warning:
                        warning = " [italic](moon)[/italic]"

                    self.console.print(
                        f"  {icon} {scored.object_name}{mag_str}: {quality}, "
                        f"{vis.max_altitude:.0f}°{direction} at {time_str}{warning}"
                    )

            self.console.print()

        # Milky Way (separate - needs special dark sky conditions)
        self._print_milky_way_forecast(forecasts)

    def _format_cloud_conditions(self, weather: NightWeather) -> str:
        """Format cloud conditions with detail based on variability.

        Shows percentage and variability when conditions change during the night.
        """
        avg = weather.avg_cloud_cover
        min_c = weather.min_cloud_cover
        max_c = weather.max_cloud_cover
        clear_hours = weather.clear_duration_hours

        # Get base description
        desc = WeatherForecast.get_cloud_cover_description(avg)

        # Check variability (difference between min and max)
        variability = max_c - min_c

        if variability > 40:
            # Highly variable - show range
            return f"Variable ({min_c:.0f}-{max_c:.0f}%)"
        elif variability > 20:
            # Moderately variable - show avg with note
            if clear_hours >= 2:
                return f"{desc} ({avg:.0f}%), {clear_hours:.0f}h clear"
            return f"{desc} ({avg:.0f}%)"
        else:
            # Stable conditions - just show description with percentage
            if avg < 20:
                return f"{desc} ({avg:.0f}%)"
            return f"{desc} ({avg:.0f}%)"

    def _get_best_time_str(
        self, weather: NightWeather, night_info=None
    ) -> tuple[str | None, float | None]:
        """Get best observing time string and cloud cover.

        Selects the best window using quality-based scoring that considers:
        - Cloud cover (primary factor when altitude unavailable)
        - Moon interference (if night_info provided)

        This aligns with the Web's 4-factor scoring approach.

        Args:
            weather: NightWeather with best_time and/or clear_windows
            night_info: Optional NightInfo for moon data

        Returns:
            Tuple of (time_string, cloud_cover) or (None, None) if unavailable
        """
        from scoring import get_cloud_quality, get_moon_quality

        # Prefer clear_windows if available - gives a range
        if weather.clear_windows:
            # Score windows using available factors
            def window_quality(w):
                cloud_q = get_cloud_quality(w.avg_cloud_cover)

                # Add moon quality if we have night_info
                if night_info is not None:
                    # Use a moderate separation estimate since we don't have
                    # per-window object data. Moon illumination is the key factor.
                    moon_q = get_moon_quality(
                        moon_separation=60.0,  # Conservative estimate
                        moon_illumination=night_info.moon_illumination,
                        moon_altitude=30.0,  # Assume moon may be up
                    )
                    # Weight: cloud 50%, moon 50% (since we don't have altitude data)
                    return cloud_q * 0.5 + moon_q * 0.5
                return cloud_q

            best_window = max(weather.clear_windows, key=window_quality)
            start_str = self.tz.format_time(best_window.start)
            end_str = self.tz.format_time(best_window.end)
            return f"{start_str}-{end_str}", best_window.avg_cloud_cover

        # Fall back to single point
        if weather.best_time:
            time_str = self.tz.format_time(weather.best_time.time.replace(tzinfo=None))
            return time_str, weather.best_time.cloud_cover

        return None, None

    def _format_best_time_info(
        self, weather: NightWeather, include_clouds: bool = False, night_info=None
    ) -> str | None:
        """Format best observing time with 'Best:' prefix and coloring.

        Uses _get_best_time_str for consistent time extraction across displays.

        Args:
            weather: NightWeather with best_time and/or clear_windows
            include_clouds: If True, append cloud percentage in parentheses
            night_info: Optional NightInfo for quality-based window selection

        Returns:
            Formatted string like "Best: 2-4 AM" or "Best: 2 AM (25% clouds)"
        """
        best_str, cloud_cover = self._get_best_time_str(weather, night_info)
        if not best_str:
            return None

        # Add cloud percentage if requested
        if include_clouds and cloud_cover is not None:
            best_str = f"{best_str} ({cloud_cover:.0f}% clouds)"

        # Color green for good conditions
        if cloud_cover is not None and cloud_cover < 30:
            return f"[green]Best: {best_str}[/green]"
        return f"Best: {best_str}"

    def _get_category_icon(self, category: str, subtype: str = "") -> str:
        """Get emoji icon for object category.

        Uses CATEGORY_ICONS dictionary with special handling for
        interstellar objects and specific DSO subtypes.
        """
        # Special case: interstellar comets get sparkle
        if category == "comet" and subtype == "interstellar":
            return "✨"

        # DSO subtypes need detailed mapping
        if category == "dso" and subtype:
            subtype_lower = subtype.lower()
            if subtype in ("galaxy", "galaxy_pair", "galaxy_group", "galaxy_triplet"):
                return self.CATEGORY_ICONS.get("galaxy", "🌀")
            elif "planetary" in subtype_lower and "nebula" in subtype_lower:
                return self.CATEGORY_ICONS.get("planetary_nebula", "💫")
            elif subtype == "supernova_remnant":
                return self.CATEGORY_ICONS.get("supernova_remnant", "💥")
            elif subtype in ("emission_nebula", "reflection_nebula", "nebula"):
                return self.CATEGORY_ICONS.get("nebula", "☁️")
            elif subtype in ("open_cluster", "globular_cluster"):
                return self.CATEGORY_ICONS.get("cluster", "✨")
            return self.CATEGORY_ICONS.get("dso", "🌌")

        # Standard categories from dictionary
        return self.CATEGORY_ICONS.get(category, "•")

    def _print_milky_way_forecast(self, forecasts: List[NightForecast]):
        """Print Milky Way visibility forecast."""
        self.console.print("[bold blue]Milky Way Core[/bold blue]")

        # Check if we have weather data
        has_weather = any(f.weather is not None for f in forecasts)

        best_night = None
        best_score = -1000

        for forecast in forecasts:
            if (
                forecast.milky_way.is_visible
                and forecast.night_info.moon_illumination < 30
            ):
                # Score based on altitude, moon, and weather
                altitude = forecast.milky_way.max_altitude
                score = altitude

                # Penalize for moon
                moon_penalty = forecast.night_info.moon_illumination * 0.5
                score -= moon_penalty

                # Penalize for clouds if we have weather data
                if has_weather and forecast.weather:
                    cloud_penalty = forecast.weather.avg_cloud_cover * 0.5
                    score -= cloud_penalty

                if score > best_score:
                    best_score = score
                    best_night = forecast

        if best_night:
            date_str = best_night.night_info.date.strftime("%b %d")
            time_str = self.tz.format_time(best_night.milky_way.max_altitude_time)
            altitude = best_night.milky_way.max_altitude
            quality = self._get_quality_color(altitude)

            # Add weather info if available
            weather_info = ""
            if has_weather and best_night.weather:
                cat, desc, _ = self._get_weather_category(
                    best_night.weather.avg_cloud_cover
                )
                # Use simpler descriptions for Milky Way (5-tier system)
                simple_desc = {
                    "excellent": "Clear skies",
                    "good": "Clear skies",
                    "fair": "Partly cloudy",
                    "poor": "Partly cloudy",
                    "bad": "Cloudy",
                }
                weather_info = f" ({simple_desc[cat]})"

            self.console.print(
                f"  • Best viewing: {date_str}, "
                f"peak {altitude:.0f}° at {time_str} - {quality}{weather_info}"
            )
        else:
            self.console.print(
                "[italic]Not ideally visible this week (moon interference or low altitude)[/italic]"
            )

        self.console.print()

    def _get_moon_phase_name(self, phase: float) -> str:
        """Get moon phase name from phase fraction.

        Args:
            phase: Phase fraction (0-1)

        Returns:
            Phase name
        """
        if phase < 0.03:
            return "New Moon"
        elif phase < 0.22:
            return "Waxing Crescent"
        elif phase < 0.28:
            return "First Quarter"
        elif phase < 0.47:
            return "Waxing Gibbous"
        elif phase < 0.53:
            return "Full Moon"
        elif phase < 0.72:
            return "Waning Gibbous"
        elif phase < 0.78:
            return "Last Quarter"
        else:
            return "Waning Crescent"

    def _get_quality_color(self, altitude: float) -> str:
        """Get quality description with color for astrophotography.

        Args:
            altitude: Altitude in degrees

        Returns:
            Colored quality string with context
        """
        if altitude >= 75:
            return "[green]Excellent (overhead)[/green]"
        elif altitude >= 60:
            return "[green]Very Good (high)[/green]"
        elif altitude >= 45:
            return "[yellow]Good (clear)[/yellow]"
        else:
            return "[red]Fair (low)[/red]"

    def _format_clear_windows(self, clear_windows) -> str:
        """Format clear weather windows.

        Args:
            clear_windows: List of ClearWindow objects

        Returns:
            Formatted string showing clear windows
        """
        if not clear_windows:
            return "None"

        window_strs = []
        for window in clear_windows:
            start_str = self.tz.format_time(window.start)
            end_str = self.tz.format_time(window.end)
            window_strs.append(f"{start_str}-{end_str}")

        return ", ".join(window_strs)
