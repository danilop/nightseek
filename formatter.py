"""Format and display astronomical forecasts."""

from typing import List

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from analyzer import NightForecast, VisibilityScore
from weather import WeatherForecast


class ForecastFormatter:
    """Format forecast data for terminal display."""

    def __init__(self, tz_converter):
        """Initialize the formatter.

        Args:
            tz_converter: TimezoneConverter instance for time display
        """
        self.console = Console()
        self.tz = tz_converter

    def format_forecast(
        self,
        forecasts: List[NightForecast],
        latitude: float,
        longitude: float,
        best_dark_nights: List[int],
        max_objects: int = 8,
    ):
        """Format and display the complete forecast.

        Args:
            forecasts: List of night forecasts
            latitude: Observer latitude
            longitude: Observer longitude
            best_dark_nights: Indices of best dark nights
            max_objects: Maximum objects to show per night
        """
        # Header
        self._print_header(forecasts[0], forecasts[-1], latitude, longitude)

        # Moon phase summary
        self._print_moon_summary(forecasts, best_dark_nights)

        # Tonight's highlights (first night only)
        self._print_tonight_highlights(forecasts[0])

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
        header.append(f"Period: {start} - {end}\n", style="white")
        header.append(f"Location: {latitude:.4f}°, {longitude:.4f}°\n", style="dim")
        header.append(f"Times: {self.tz.get_display_info()}\n", style="dim")

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
            "[dim]Dark sky window = astronomical night (sun >18° below horizon)[/dim]"
        )
        self.console.print()

        # Build table with conditional weather columns
        table = Table(show_header=True, header_style="bold")
        table.add_column("Date", style="white", width=11)
        table.add_column("Dark Sky Window", style="dim", width=17)
        table.add_column("Moon Phase", style="white", width=18)
        table.add_column("Moon %", justify="right", width=6)

        if has_weather:
            table.add_column("Clouds", justify="right", width=9)

        table.add_column("Observing Quality", style="white", width=23)

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

        # Highlight best nights with context
        if best_dark_nights:
            best_dates = [
                forecasts[i].night_info.date.strftime("%b %d")
                for i in best_dark_nights[:3]
            ]
            if has_weather:
                self.console.print(
                    f"[green]★ Top nights for dark sky observing:[/green] {', '.join(best_dates)} "
                    "[dim](darkest skies with clearest weather)[/dim]"
                )
            else:
                self.console.print(
                    f"[green]★ Darkest nights for observing:[/green] {', '.join(best_dates)} "
                    "[dim](lowest moon interference)[/dim]"
                )
            self.console.print()

    def _print_tonight_highlights(self, forecast: NightForecast):
        """Print tonight's highlights grouped by time windows."""
        from analyzer import VisibilityAnalyzer

        # Create temporary analyzer to rank objects
        analyzer = VisibilityAnalyzer(0, 0)  # Coordinates don't matter for ranking
        scores = analyzer.rank_objects_for_night(forecast)

        if not scores:
            self.console.print("[yellow]No objects above 45° tonight[/yellow]")
            self.console.print()
            return

        self.console.print("[bold cyan]TONIGHT'S OBSERVATION PLAN[/bold cyan]")
        date_str = forecast.night_info.date.strftime("%A, %B %d")
        moon_pct = f"{forecast.night_info.moon_illumination:.0f}%"
        self.console.print(f"[dim]{date_str} • Moon: {moon_pct} illuminated[/dim]")
        self.console.print()

        # Group objects by time windows
        time_windows = self._group_by_time_windows(forecast, scores[:8])

        # Print each time window
        for window_info in time_windows:
            self._print_time_window(window_info, forecast)

        self.console.print()

    def _group_by_time_windows(self, forecast, scores):
        """Group objects by their observation time windows.

        Returns list of time window info dicts.
        """
        if (
            not forecast.night_info.astronomical_dusk
            or not forecast.night_info.astronomical_dawn
        ):
            return []

        # Define time windows (in UTC, will convert to local for display)
        dusk = forecast.night_info.astronomical_dusk
        dawn = forecast.night_info.astronomical_dawn

        # Handle night spanning midnight
        if dawn <= dusk:
            from datetime import timedelta

            dawn = dawn + timedelta(days=1)

        # Create 3-hour windows
        from datetime import timedelta

        windows = []
        current = dusk

        while current < dawn:
            window_end = min(current + timedelta(hours=3), dawn)
            windows.append({"start": current, "end": window_end, "objects": []})
            current = window_end

        # Assign objects to windows based on their peak time
        for score in scores:
            # Find the object
            obj_vis = None
            for obj in (
                forecast.planets
                + forecast.dsos
                + forecast.comets
                + [forecast.milky_way]
            ):
                if score.object_name in obj.object_name:
                    obj_vis = obj
                    break

            if obj_vis and obj_vis.max_altitude_time:
                peak_time = obj_vis.max_altitude_time
                # Ensure peak_time is timezone-aware for comparison
                from datetime import timezone

                if peak_time.tzinfo is None:
                    peak_time = peak_time.replace(tzinfo=timezone.utc)

                # Find which window this peak falls into
                for window in windows:
                    if window["start"] <= peak_time <= window["end"]:
                        window["objects"].append(
                            {"name": score.object_name, "obj": obj_vis, "score": score}
                        )
                        break

        # Calculate weather for each window
        if forecast.weather and forecast.weather.hourly_data:
            for window in windows:
                clouds_in_window = []
                # Convert window boundaries to naive for comparison with hourly_data keys
                window_start_naive = (
                    window["start"].replace(tzinfo=None)
                    if window["start"].tzinfo
                    else window["start"]
                )
                window_end_naive = (
                    window["end"].replace(tzinfo=None)
                    if window["end"].tzinfo
                    else window["end"]
                )
                for hour, clouds in forecast.weather.hourly_data.items():
                    if window_start_naive <= hour <= window_end_naive:
                        clouds_in_window.append(clouds)

                if clouds_in_window:
                    window["avg_clouds"] = sum(clouds_in_window) / len(clouds_in_window)
                else:
                    window["avg_clouds"] = None
        else:
            for window in windows:
                window["avg_clouds"] = None

        # Filter out empty windows
        return [w for w in windows if w["objects"]]

    def _print_time_window(self, window_info, forecast):
        """Print a single time window with its objects."""
        start_str = self.tz.format_time(window_info["start"])
        end_str = self.tz.format_time(window_info["end"])

        # Format weather info
        weather_str = ""
        weather_color = "white"
        if window_info["avg_clouds"] is not None:
            clouds = window_info["avg_clouds"]
            if clouds < 30:
                weather_str = "Clear"
                weather_color = "green"
            elif clouds < 60:
                weather_str = f"Partly cloudy ({clouds:.0f}%)"
                weather_color = "yellow"
            else:
                weather_str = f"Cloudy ({clouds:.0f}%)"
                weather_color = "red"

        # Print window header
        if weather_str:
            self.console.print(
                f"[bold white]{start_str} - {end_str}[/bold white] "
                f"[{weather_color}]{weather_str}[/{weather_color}]"
            )
        else:
            self.console.print(f"[bold white]{start_str} - {end_str}[/bold white]")

        # Print objects in this window
        for obj_info in window_info["objects"]:
            obj = obj_info["obj"]
            self.console.print(
                f"  • {obj_info['name']} - {obj_info['score'].reason} "
                f"(peak {obj.max_altitude:.0f}° at {self.tz.format_time(obj.max_altitude_time)})"
            )

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
        desc.append(f"• {score.object_name}", style="bold white")
        desc.append(f" - {score.reason}", style="green")
        desc.append(
            f"\n  Peak: {obj_vis.max_altitude:.0f}° at {self.tz.format_time(obj_vis.max_altitude_time)}",
            style="dim",
        )

        # Add visibility windows
        if obj_vis.above_60_start and obj_vis.above_60_end:
            start = self.tz.format_time(obj_vis.above_60_start)
            end = self.tz.format_time(obj_vis.above_60_end)
            desc.append(f"\n  Above 60°: {start} - {end}", style="dim")

        self.console.print(desc)

    def _print_weekly_forecast(self, forecasts: List[NightForecast], max_objects: int):
        """Print forecast organized by object type."""
        num_days = len(forecasts)
        if num_days == 1:
            title = "TONIGHT'S TARGETS"
        elif num_days <= 3:
            title = f"{num_days}-NIGHT FORECAST"
        else:
            title = f"{num_days}-DAY FORECAST"

        self.console.print(f"[bold cyan]{title}[/bold cyan]")
        self.console.print()

        # Combined planets and comets section
        self._print_solar_system_forecast(forecasts, max_objects)

        # Deep Sky Objects
        self._print_dso_forecast(forecasts, max_objects)

        # Milky Way
        self._print_milky_way_forecast(forecasts)

    def _print_solar_system_forecast(
        self, forecasts: List[NightForecast], max_objects: int
    ):
        """Print combined planets and comets forecast, ranked by visibility."""
        self.console.print("[bold yellow]Planets & Comets[/bold yellow]")

        has_weather = any(f.weather is not None for f in forecasts)

        # Known planet magnitudes (approximate, varies with distance)
        planet_mags = {
            "Mercury": 0.0,
            "Venus": -4.0,
            "Mars": 0.5,
            "Jupiter": -2.5,
            "Saturn": 0.5,
            "Uranus": 5.7,
            "Neptune": 7.8,
        }

        # Collect all objects with scores
        objects = []

        # Planets
        for forecast in forecasts:
            for planet in forecast.planets:
                if planet.is_visible and planet.max_altitude >= 30:
                    score = planet.max_altitude
                    if has_weather and forecast.weather:
                        score -= forecast.weather.avg_cloud_cover * 0.3
                    mag = planet_mags.get(planet.object_name, None)
                    objects.append(
                        (planet.object_name, "planet", score, forecast, planet, mag)
                    )

        # Comets
        for forecast in forecasts:
            for comet in forecast.comets:
                if comet.is_visible and comet.max_altitude >= 30:
                    score = comet.max_altitude
                    if has_weather and forecast.weather:
                        score -= forecast.weather.avg_cloud_cover * 0.3
                    objects.append(
                        (
                            comet.object_name,
                            "comet",
                            score,
                            forecast,
                            comet,
                            comet.magnitude,
                        )
                    )

        if not objects:
            self.console.print("[dim]No planets or comets visible above 30°[/dim]")
            self.console.print()
            return

        # Keep best score per object
        best_objects = {}
        for name, obj_type, score, forecast, obj, mag in objects:
            if name not in best_objects or score > best_objects[name][2]:
                best_objects[name] = (name, obj_type, score, forecast, obj, mag)

        # Sort by score and take top N
        sorted_objects = sorted(best_objects.values(), key=lambda x: x[2], reverse=True)

        for name, obj_type, score, forecast, obj, mag in sorted_objects[:max_objects]:
            date_str = forecast.night_info.date.strftime("%b %d")
            time_str = self.tz.format_time(obj.max_altitude_time)
            quality = self._get_quality_color(obj.max_altitude)

            # Type indicator
            type_str = "☄️" if obj_type == "comet" else "🪐"

            # Magnitude string
            mag_str = f" (mag {mag:.1f})" if mag is not None else ""

            # Weather info
            weather_str = ""
            if has_weather and forecast.weather:
                clouds = forecast.weather.avg_cloud_cover
                if clouds >= 50:
                    weather_str = " [dim]Cloudy[/dim]"

            # Interstellar marker
            marker = " [bold yellow]INTERSTELLAR![/bold yellow]" if "⭐" in name else ""

            self.console.print(
                f"  {type_str} {name}{mag_str}: {date_str}, {quality}, "
                f"peaks {obj.max_altitude:.0f}° at {time_str}{weather_str}{marker}"
            )

        self.console.print()

    def _print_dso_forecast(self, forecasts: List[NightForecast], max_objects: int):
        """Print deep sky object forecast grouped by date."""
        self.console.print("[bold magenta]Deep Sky Objects[/bold magenta]")

        # Check if we have weather data
        has_weather = any(f.weather is not None for f in forecasts)

        # Group DSOs by their best night (weather-aware)
        nights_with_dsos = {}

        for forecast in forecasts:
            for dso in forecast.dsos:
                if dso.is_visible and dso.max_altitude >= 45:
                    # Score based on altitude and weather
                    score = dso.max_altitude
                    if has_weather and forecast.weather:
                        cloud_penalty = forecast.weather.avg_cloud_cover * 0.5
                        moon_penalty = 20 if dso.moon_warning else 0
                        score = score - cloud_penalty - moon_penalty

                    # Track best night for this DSO
                    date_key = forecast.night_info.date.strftime("%Y-%m-%d")
                    if date_key not in nights_with_dsos:
                        nights_with_dsos[date_key] = {
                            "forecast": forecast,
                            "objects": [],
                        }

                    nights_with_dsos[date_key]["objects"].append(
                        {"name": dso.object_name, "dso": dso, "score": score}
                    )

        if not nights_with_dsos:
            self.console.print("[dim]No DSOs visible above 45°[/dim]")
            self.console.print()
            return

        # Print DSOs grouped by night, showing best nights first
        sorted_nights = sorted(
            nights_with_dsos.items(),
            key=lambda x: sum(obj["score"] for obj in x[1]["objects"][:max_objects]),
            reverse=True,
        )

        # Limit to top 5 nights to avoid repetition
        nights_to_show = min(5, len(sorted_nights))
        if len(sorted_nights) > nights_to_show:
            self.console.print(
                f"[dim]Showing best {nights_to_show} of {len(sorted_nights)} nights[/dim]"
            )
            self.console.print()

        for date_key, night_info in sorted_nights[:nights_to_show]:
            forecast = night_info["forecast"]
            date_str = forecast.night_info.date.strftime("%b %d")

            # Format night header with weather
            weather_desc = ""
            if has_weather and forecast.weather:
                if forecast.weather.clear_windows:
                    window_strs = [
                        f"{self.tz.format_time(w.start)}-{self.tz.format_time(w.end)}"
                        for w in forecast.weather.clear_windows[:2]
                    ]
                    weather_desc = f" - Clear: {', '.join(window_strs)}"
                elif forecast.weather.avg_cloud_cover < 60:
                    weather_desc = " - Partly cloudy"
                else:
                    weather_desc = " - Cloudy"

            self.console.print(f"[bold]{date_str}{weather_desc}[/bold]")

            # Show top N objects for this night
            sorted_objs = sorted(
                night_info["objects"], key=lambda x: x["score"], reverse=True
            )[:max_objects]
            for obj_info in sorted_objs:
                dso = obj_info["dso"]
                quality = self._get_quality_color(dso.max_altitude)

                # Magnitude string
                mag_str = f" (mag {dso.magnitude:.1f})" if dso.magnitude else ""

                notes = []
                if dso.moon_warning:
                    notes.append("[dim](moon)[/dim]")

                note_str = " " + " ".join(notes) if notes else ""
                self.console.print(
                    f"  • {obj_info['name']}{mag_str}: {quality}, "
                    f"peak {dso.max_altitude:.0f}° at {self.tz.format_time(dso.max_altitude_time)}"
                    f"{note_str}"
                )

            self.console.print()

        self.console.print()

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
                if best_night.weather.avg_cloud_cover < 30:
                    weather_info = " (Clear skies)"
                elif best_night.weather.avg_cloud_cover < 60:
                    weather_info = " (Partly cloudy)"
                else:
                    weather_info = " (Cloudy)"

            self.console.print(
                f"  • Best viewing: {date_str}, "
                f"peak {altitude:.0f}° at {time_str} - {quality}{weather_info}"
            )
        else:
            self.console.print(
                "[dim]Not ideally visible this week (moon interference or low altitude)[/dim]"
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
