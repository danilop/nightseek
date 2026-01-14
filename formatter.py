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
        all_scores = analyzer.rank_objects_for_night(forecast)

        if not all_scores:
            self.console.print("[yellow]No objects above 45° tonight[/yellow]")
            self.console.print()
            return

        # Balance selection: 50% DSOs, 25% planets, 25% comets
        planets = [
            s
            for s in all_scores
            if any(p.object_name == s.object_name for p in forecast.planets)
        ]
        comets = [
            s
            for s in all_scores
            if any(
                c.object_name == s.object_name or s.object_name in c.object_name
                for c in forecast.comets
            )
        ]
        dsos = [
            s
            for s in all_scores
            if any(
                d.object_name == s.object_name or s.object_name in d.object_name
                for d in forecast.dsos
            )
        ]

        max_objects = 8
        n_dsos = max(1, max_objects // 2)
        n_planets = max(1, max_objects // 4)
        n_comets = max_objects - n_dsos - n_planets

        scores = dsos[:n_dsos] + planets[:n_planets] + comets[:n_comets]

        # Fill remaining slots if any category is short
        remaining = max_objects - len(scores)
        if remaining > 0:
            for s in all_scores:
                if s not in scores:
                    scores.append(s)
                    remaining -= 1
                    if remaining == 0:
                        break

        # Sort by score
        scores.sort(key=lambda x: x.score, reverse=True)

        self.console.print("[bold cyan]TONIGHT'S OBSERVATION PLAN[/bold cyan]")
        date_str = forecast.night_info.date.strftime("%A, %B %d")
        moon_pct = f"{forecast.night_info.moon_illumination:.0f}%"
        self.console.print(f"[dim]{date_str} • Moon: {moon_pct} illuminated[/dim]")
        self.console.print()

        # Group objects by time windows
        time_windows = self._group_by_time_windows(forecast, scores)

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
        """Print forecast with all objects grouped by night."""
        num_days = len(forecasts)
        if num_days == 1:
            title = "TONIGHT'S TARGETS"
        elif num_days <= 3:
            title = f"{num_days}-NIGHT FORECAST"
        else:
            title = f"{num_days}-DAY FORECAST"

        self.console.print(f"[bold cyan]{title}[/bold cyan]")
        self.console.print()

        has_weather = any(f.weather is not None for f in forecasts)

        # Planet magnitudes
        planet_mags = {
            "Mercury": 0.0,
            "Venus": -4.0,
            "Mars": 0.5,
            "Jupiter": -2.5,
            "Saturn": 0.5,
            "Uranus": 5.7,
            "Neptune": 7.8,
        }

        # Score each night for ranking
        night_scores = []
        for forecast in forecasts:
            score = 100 - forecast.night_info.moon_illumination
            if has_weather and forecast.weather:
                score -= forecast.weather.avg_cloud_cover * 0.7
            night_scores.append((forecast, score))

        # Sort nights by score (best first)
        night_scores.sort(key=lambda x: x[1], reverse=True)
        best_night_date = night_scores[0][0].night_info.date.strftime("%Y-%m-%d")

        # Show each night
        for forecast, night_score in night_scores:
            date_str = forecast.night_info.date.strftime("%a, %b %d")
            is_best = forecast.night_info.date.strftime("%Y-%m-%d") == best_night_date

            # Build header
            if is_best and len(forecasts) > 1:
                header = (
                    f"[bold yellow]★ {date_str}[/bold yellow] [dim]Best Night[/dim]"
                )
            else:
                header = f"[bold]{date_str}[/bold]"

            # Conditions
            moon_pct = forecast.night_info.moon_illumination
            conditions = f"Moon {moon_pct:.0f}%"
            if has_weather and forecast.weather:
                clouds = forecast.weather.avg_cloud_cover
                if clouds < 20:
                    conditions += " • Clear"
                elif clouds < 50:
                    conditions += " • Partly cloudy"
                else:
                    conditions += " • Cloudy"

            self.console.print(f"{header}")
            self.console.print(f"[dim]{conditions}[/dim]")

            # Collect all objects for this night
            objects = []

            # Planets (bonus - always interesting targets, easy to find)
            for planet in forecast.planets:
                if planet.is_visible and planet.max_altitude >= 30:
                    score = planet.max_altitude + 15  # Bonus for planets
                    if has_weather and forecast.weather:
                        score -= forecast.weather.avg_cloud_cover * 0.3
                    objects.append(
                        (
                            "🪐",
                            planet.object_name,
                            planet,
                            score,
                            planet_mags.get(planet.object_name),
                        )
                    )

            # Comets
            for comet in forecast.comets:
                if comet.is_visible and comet.max_altitude >= 30:
                    score = comet.max_altitude
                    if has_weather and forecast.weather:
                        score -= forecast.weather.avg_cloud_cover * 0.3
                    objects.append(
                        ("☄️", comet.object_name, comet, score, comet.magnitude)
                    )

            # DSOs (slight bonus - main astrophotography targets)
            for dso in forecast.dsos:
                if dso.is_visible and dso.max_altitude >= 45:
                    score = dso.max_altitude + 5  # Bonus for DSOs
                    if has_weather and forecast.weather:
                        score -= forecast.weather.avg_cloud_cover * 0.5
                    if dso.moon_warning:
                        score -= 20
                    objects.append(("🌌", dso.object_name, dso, score, dso.magnitude))

            # Sort by score and take balanced mix: 25% comets, 25% planets, 50% DSOs
            comets = sorted(
                [o for o in objects if o[0] == "☄️"], key=lambda x: x[3], reverse=True
            )
            planets = sorted(
                [o for o in objects if o[0] == "🪐"], key=lambda x: x[3], reverse=True
            )
            dsos = sorted(
                [o for o in objects if o[0] == "🌌"], key=lambda x: x[3], reverse=True
            )

            # Allocate slots: 50% DSOs, 25% planets, 25% comets
            n_dsos = max(1, max_objects // 2)
            n_planets = max(1, max_objects // 4)
            n_comets = max_objects - n_dsos - n_planets

            # Take top from each category, fill remaining with best available
            selected = dsos[:n_dsos] + planets[:n_planets] + comets[:n_comets]

            # If any category is short, fill from others
            remaining = max_objects - len(selected)
            if remaining > 0:
                all_sorted = sorted(objects, key=lambda x: x[3], reverse=True)
                for obj in all_sorted:
                    if obj not in selected:
                        selected.append(obj)
                        remaining -= 1
                        if remaining == 0:
                            break

            # Sort final selection by score
            selected.sort(key=lambda x: x[3], reverse=True)

            if not selected:
                self.console.print("  [dim]No objects visible above threshold[/dim]")
            else:
                for icon, name, obj, score, mag in selected[:max_objects]:
                    quality = self._get_quality_color(obj.max_altitude)
                    time_str = self.tz.format_time(obj.max_altitude_time)
                    mag_str = f" [dim](mag {mag:.1f})[/dim]" if mag is not None else ""

                    # Warnings
                    warning = ""
                    if hasattr(obj, "moon_warning") and obj.moon_warning:
                        warning = " [dim](moon)[/dim]"
                    if "⭐" in name:
                        warning += " [bold yellow]INTERSTELLAR![/bold yellow]"

                    self.console.print(
                        f"  {icon} {name}{mag_str}: {quality}, "
                        f"{obj.max_altitude:.0f}° at {time_str}{warning}"
                    )

            self.console.print()

        # Milky Way (separate - needs special dark sky conditions)
        self._print_milky_way_forecast(forecasts)

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
