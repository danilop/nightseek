"""Format and display astronomical forecasts."""

from typing import List

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from analyzer import NightForecast, VisibilityScore
from weather import WeatherForecast, NightWeather
from scoring import ScoredObject, get_score_tier


class ForecastFormatter:
    """Format forecast data for terminal display."""

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

        # Tonight's highlights (first night only)
        self._print_tonight_highlights(forecasts[0], max_objects)

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
        header.append("Sky Observation Forecast\n", style="bold cyan")
        header.append(f"Period: {start} - {end}\n")
        header.append(f"Location: {latitude:.4f}°, {longitude:.4f}°\n", style="italic")
        header.append(f"Times: {self.tz.get_display_info()}\n", style="italic")

        self.console.print(Panel(header, border_style="cyan"))
        self.console.print()

    def _print_moon_summary(
        self, forecasts: List[NightForecast], best_dark_nights: List[int]
    ):
        """Print moon phase summary, weather, and observing windows."""
        # Check if we have weather data
        has_weather = any(f.weather is not None for f in forecasts)

        if has_weather:
            self.console.print("[bold cyan]OBSERVING CONDITIONS[/bold cyan]")
        else:
            self.console.print("[bold cyan]MOON PHASE & DARK SKY WINDOWS[/bold cyan]")
        self.console.print(
            "[italic]Dark sky window = astronomical night (sun >18° below horizon)[/italic]"
        )
        self.console.print()

        # Build table with conditional weather columns
        # Note: No hardcoded colors - let terminal theme determine text color
        table = Table(show_header=True, header_style="bold")
        table.add_column("Date", width=11)
        table.add_column("Dark Sky Window", width=17)
        table.add_column("Moon Phase", width=18)
        table.add_column("Moon %", justify="right", width=6)

        if has_weather:
            table.add_column("Clouds", justify="right", width=9)

        table.add_column("Observing Quality", width=23)

        for i, forecast in enumerate(forecasts):
            date_str = forecast.night_info.date.strftime("%a, %b %d")

            # Format night time interval (astronomical dusk to dawn)
            dusk_time = self.tz.format_time(forecast.night_info.astronomical_dusk)
            dawn_time = self.tz.format_time(forecast.night_info.astronomical_dawn)
            night_str = f"{dusk_time}-{dawn_time}"

            phase_str = self._get_moon_phase_name(forecast.night_info.moon_phase)
            moon_str = f"{forecast.night_info.moon_illumination:.0f}%"

            # Get quality rating
            cloud_cover = forecast.weather.avg_cloud_cover if forecast.weather else None
            quality_level, quality_desc = WeatherForecast.get_observing_quality(
                forecast.night_info.moon_illumination,
                cloud_cover,
            )

            # Color code quality
            if quality_level == "excellent":
                quality_colored = f"[green]{quality_desc}[/green]"
            elif quality_level == "good":
                quality_colored = f"[green]{quality_desc}[/green]"
            elif quality_level == "fair":
                quality_colored = f"[yellow]{quality_desc}[/yellow]"
            else:
                quality_colored = f"[red]{quality_desc}[/red]"

            # Build row
            if has_weather:
                if forecast.weather:
                    # Show cloud cover range (min-max) during night
                    cloud_str = f"{forecast.weather.min_cloud_cover:.0f}-{forecast.weather.max_cloud_cover:.0f}%"
                else:
                    cloud_str = "N/A"
                table.add_row(
                    date_str, night_str, phase_str, moon_str, cloud_str, quality_colored
                )
            else:
                table.add_row(date_str, night_str, phase_str, moon_str, quality_colored)

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
                quality_level, _ = WeatherForecast.get_observing_quality(
                    forecast.night_info.moon_illumination, cloud_cover
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

        self.console.print("[bold magenta]CELESTIAL EVENTS[/bold magenta]")

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

    def _print_weather_extras(self, weather: NightWeather):
        """Print additional weather information (wind, visibility, humidity)."""
        extras = []

        if weather.avg_wind_speed_kmh is not None:
            wind = weather.avg_wind_speed_kmh
            if wind > 30:
                extras.append(f"[red]Strong wind ({wind:.0f} km/h)[/red]")
            elif wind > 20:
                extras.append(f"[yellow]Moderate wind ({wind:.0f} km/h)[/yellow]")

        if weather.avg_visibility_km is not None:
            vis = weather.avg_visibility_km
            if vis < 10:
                extras.append(f"[yellow]Limited visibility ({vis:.0f} km)[/yellow]")
            elif vis >= 30:
                extras.append(f"[green]Excellent transparency ({vis:.0f} km)[/green]")

        if weather.avg_humidity is not None:
            hum = weather.avg_humidity
            if hum > 85:
                extras.append(f"[yellow]High humidity ({hum:.0f}%) - dew risk[/yellow]")

        if weather.avg_temperature_c is not None:
            temp = weather.avg_temperature_c
            if temp < 0:
                extras.append(f"Temp: {temp:.0f}°C")

        if extras:
            self.console.print("[italic]" + " • ".join(extras) + "[/italic]")

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

        self.console.print("[bold cyan]TONIGHT'S OBSERVATION PLAN[/bold cyan]")
        date_str = forecast.night_info.date.strftime("%A, %B %d")
        moon_pct = f"{forecast.night_info.moon_illumination:.0f}%"
        self.console.print(
            f"[italic]{date_str} • Moon: {moon_pct} illuminated[/italic]"
        )
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
        if window_data.get("avg_clouds") is not None:
            _, cat_desc, weather_color = self._get_weather_category(
                window_data["avg_clouds"]
            )
            min_c = window_data.get("min_clouds", window_data["avg_clouds"])
            max_c = window_data.get("max_clouds", window_data["avg_clouds"])

            # Show range if it varies, otherwise just the value
            if max_c - min_c > 5:
                weather_str = f"{cat_desc} ({min_c:.0f}-{max_c:.0f}%)"
            else:
                weather_str = f"{cat_desc} ({window_data['avg_clouds']:.0f}%)"

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
                f"[bold]{start_str} - {end_str}[/bold] ({duration_str}) "
                f"[{weather_color}]{weather_str}[/{weather_color}]"
            )
        else:
            self.console.print(f"[bold]{start_str} - {end_str}[/bold] ({duration_str})")

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

            # Build altitude description
            if win_info.get("visible"):
                phase = win_info["phase"]
                start_alt = win_info["start_alt"]
                end_alt = win_info["end_alt"]

                if phase == "peak":
                    peak_time_str = self.tz.format_time(vis.max_altitude_time)
                    alt_desc = f"peaks {vis.max_altitude:.0f}° at {peak_time_str}"
                elif phase == "rising":
                    alt_desc = f"{start_alt:.0f}°→{end_alt:.0f}° rising"
                else:
                    alt_desc = f"{start_alt:.0f}°→{end_alt:.0f}° setting"
            else:
                alt_desc = f"peak {vis.max_altitude:.0f}°"

            # Format: Name (mag) [diameter] - altitude info
            # Why: reason
            self.console.print(
                f"  • {scored.object_name}{mag_str}{diameter_str} - {alt_desc}"
            )
            self.console.print(f"    [italic]Why: {scored.reason}[/italic]")

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

        # Add visibility windows
        if obj_vis.above_60_start and obj_vis.above_60_end:
            start = self.tz.format_time(obj_vis.above_60_start)
            end = self.tz.format_time(obj_vis.above_60_end)
            desc.append(f"\n  Above 60°: {start} - {end}", style="italic")

        self.console.print(desc)

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
            title = "TOMORROW'S TARGETS"
        elif num_days <= 3:
            title = f"NEXT {num_days} NIGHTS"
        else:
            title = f"UPCOMING {num_days} NIGHTS"

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

                    # Warnings
                    warning = ""
                    if hasattr(vis, "moon_warning") and vis.moon_warning:
                        warning = " [italic](moon)[/italic]"

                    self.console.print(
                        f"  {icon} {scored.object_name}{mag_str}: {quality}, "
                        f"{vis.max_altitude:.0f}° at {time_str}{warning}"
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

    def _get_category_icon(self, category: str, subtype: str = "") -> str:
        """Get emoji icon for object category."""
        if category == "planet":
            return "🪐"
        elif category == "comet":
            if subtype == "interstellar":
                return "✨"
            return "☄️"
        elif category == "dwarf_planet":
            return "🔵"
        elif category == "asteroid":
            return "🪨"
        elif category == "milky_way":
            return "🌌"
        elif category == "dso":
            # DSO subtypes
            if subtype in ("galaxy", "galaxy_pair", "galaxy_group", "galaxy_triplet"):
                return "🌀"
            elif subtype in ("emission_nebula", "reflection_nebula", "nebula"):
                return "☁️"
            elif subtype == "planetary_nebula":
                return "💫"
            elif subtype in ("open_cluster", "globular_cluster"):
                return "⭐"
            elif subtype == "supernova_remnant":
                return "💥"
            return "🌌"
        return "•"

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
