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

    @staticmethod
    def _get_weather_category(clouds: float) -> tuple[str, str, str]:
        """Get weather category, description, and color based on cloud cover.

        Args:
            clouds: Cloud cover percentage (0-100)

        Returns:
            Tuple of (category, description, color)
        """
        if clouds < 30:
            return "clear", "Clear", "green"
        elif clouds < 60:
            return "partly", f"Partly cloudy ({clouds:.0f}%)", "yellow"
        return "cloudy", f"Cloudy ({clouds:.0f}%)", "red"

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

        # Highlight best nights with context
        if best_dark_nights:
            best_dates = [
                forecasts[i].night_info.date.strftime("%b %d")
                for i in best_dark_nights[:3]
            ]
            if has_weather:
                self.console.print(
                    f"[green]★ Top nights for dark sky observing:[/green] {', '.join(best_dates)} "
                    "[italic](darkest skies with clearest weather)[/italic]"
                )
            else:
                self.console.print(
                    f"[green]★ Darkest nights for observing:[/green] {', '.join(best_dates)} "
                    "[italic](lowest moon interference)[/italic]"
                )
            self.console.print()

    def _print_tonight_highlights(self, forecast: NightForecast, max_objects: int):
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
        self.console.print(
            f"[italic]{date_str} • Moon: {moon_pct} illuminated[/italic]"
        )
        self.console.print()

        # Group objects by time windows
        time_windows = self._group_by_time_windows(forecast, scores, max_objects)

        # Print each time window
        for window_info in time_windows:
            self._print_time_window(window_info, forecast)

        self.console.print()

    def _group_by_time_windows(self, forecast, scores, max_objects: int):
        """Group objects by weather-based time windows.

        Windows are grouped by weather conditions (clear/partly/cloudy),
        split if longer than 2 hours, with balanced selection per window.
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

        # Build weather-based windows
        windows: list[dict[str, Any]] = []

        if forecast.weather and forecast.weather.hourly_data:
            # Sort hours within our night window
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
                # Group consecutive hours with same weather
                current_start = night_hours[0][0]
                current_cat = self._get_weather_category(night_hours[0][1])[0]
                current_clouds = [night_hours[0][1]]

                for i in range(1, len(night_hours)):
                    hour, clouds = night_hours[i]
                    cat = self._get_weather_category(clouds)[0]

                    if cat != current_cat:
                        # Save current window
                        windows.append(
                            {
                                "start": current_start.replace(tzinfo=timezone.utc),
                                "end": hour.replace(tzinfo=timezone.utc),
                                "avg_clouds": sum(current_clouds) / len(current_clouds),
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
                        "objects": [],
                    }
                )

        # Fallback: single window if no weather data
        if not windows:
            windows = [{"start": dusk, "end": dawn, "avg_clouds": None, "objects": []}]

        # Split windows longer than 2 hours
        split_windows: list[dict[str, Any]] = []
        for w in windows:
            w_start: datetime = w["start"]
            w_end: datetime = w["end"]
            duration = (w_end - w_start).total_seconds() / 3600
            if duration > 2:
                # Split into 2-hour chunks
                current = w_start
                while current < w_end:
                    chunk_end = min(current + timedelta(hours=2), w_end)
                    split_windows.append(
                        {
                            "start": current,
                            "end": chunk_end,
                            "avg_clouds": w["avg_clouds"],
                            "objects": [],
                        }
                    )
                    current = chunk_end
            else:
                split_windows.append(w)

        windows = split_windows

        # Build lookup of all scored objects
        all_objects = []
        for score in scores:
            for obj in (
                forecast.planets
                + forecast.dsos
                + forecast.comets
                + [forecast.milky_way]
            ):
                if score.object_name in obj.object_name:
                    all_objects.append(
                        {"name": score.object_name, "obj": obj, "score": score}
                    )
                    break

        # Assign ALL visible objects to each window (object visible if above horizon during window)
        for window in windows:
            for item in all_objects:
                obj = item["obj"]
                # Check if object is visible during this window (has altitude data and peaks tonight)
                if obj.max_altitude_time and obj.max_altitude and obj.max_altitude > 30:
                    # Object is visible tonight - add to this window
                    window["objects"].append(item.copy())

        # Apply balanced selection per window: 50% DSOs, 25% planets, 25% comets
        # Interstellar objects always shown at top, don't count against limit
        for window in windows:
            objs = window["objects"]

            # Extract interstellar objects (always shown, don't count against limit)
            interstellar = [
                o
                for o in objs
                if any(
                    c.object_name == o["name"] or o["name"] in c.object_name
                    for c in forecast.comets
                    if c.is_interstellar
                )
            ]
            regular_objs = [o for o in objs if o not in interstellar]

            if len(regular_objs) <= max_objects:
                # Sort and prepend interstellar
                window["objects"] = sorted(
                    interstellar, key=lambda x: x["score"].score, reverse=True
                ) + sorted(regular_objs, key=lambda x: x["score"].score, reverse=True)
                continue

            planets = [
                o
                for o in regular_objs
                if any(p.object_name == o["name"] for p in forecast.planets)
            ]
            comets = [
                o
                for o in regular_objs
                if any(
                    c.object_name == o["name"] or o["name"] in c.object_name
                    for c in forecast.comets
                    if not c.is_interstellar
                )
            ]
            dsos = [
                o
                for o in regular_objs
                if any(
                    d.object_name == o["name"] or o["name"] in d.object_name
                    for d in forecast.dsos
                )
            ]

            n_dsos = max(1, max_objects // 2)
            n_planets = max(1, max_objects // 4)
            n_comets = max_objects - n_dsos - n_planets

            selected = dsos[:n_dsos] + planets[:n_planets] + comets[:n_comets]

            # Fill remaining from best available
            remaining = max_objects - len(selected)
            if remaining > 0:
                for o in sorted(
                    regular_objs, key=lambda x: x["score"].score, reverse=True
                ):
                    if o not in selected:
                        selected.append(o)
                        remaining -= 1
                        if remaining == 0:
                            break

            # Prepend interstellar objects (always at top)
            window["objects"] = sorted(
                interstellar, key=lambda x: x["score"].score, reverse=True
            ) + sorted(selected, key=lambda x: x["score"].score, reverse=True)

        # Filter out empty windows
        return [w for w in windows if w["objects"]]

    def _print_time_window(self, window_info, forecast):
        """Print a single time window with its objects."""
        start_str = self.tz.format_time(window_info["start"])
        end_str = self.tz.format_time(window_info["end"])

        # Format weather info
        weather_str = ""
        weather_color = ""
        if window_info["avg_clouds"] is not None:
            _, weather_str, weather_color = self._get_weather_category(
                window_info["avg_clouds"]
            )

        # Print window header
        if weather_str:
            self.console.print(
                f"[bold]{start_str} - {end_str}[/bold] "
                f"[{weather_color}]{weather_str}[/{weather_color}]"
            )
        else:
            self.console.print(f"[bold]{start_str} - {end_str}[/bold]")

        # Print objects in this window
        for obj_info in window_info["objects"]:
            obj = obj_info["obj"]
            name = obj_info["name"]

            # Get magnitude
            mag = None
            if hasattr(obj, "magnitude") and obj.magnitude is not None:
                mag = obj.magnitude
            elif name in self.PLANET_MAGNITUDES:
                mag = self.PLANET_MAGNITUDES[name]

            mag_str = f" (mag {mag:.1f})" if mag is not None else ""

            self.console.print(
                f"  • {name}{mag_str} - {obj_info['score'].reason} "
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
                header = f"[bold yellow]★ {date_str}[/bold yellow] [italic]Best Night[/italic]"
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
            self.console.print(f"[italic]{conditions}[/italic]")

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
                            self.PLANET_MAGNITUDES.get(planet.object_name),
                        )
                    )

            # Comets (use ✨ for interstellar, ☄️ for regular)
            for comet in forecast.comets:
                if comet.is_visible and comet.max_altitude >= 30:
                    score = comet.max_altitude
                    if has_weather and forecast.weather:
                        score -= forecast.weather.avg_cloud_cover * 0.3
                    # Use sparkles emoji for interstellar objects
                    icon = "✨" if comet.is_interstellar else "☄️"
                    objects.append(
                        (icon, comet.object_name, comet, score, comet.magnitude)
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

            # Extract interstellar objects first (always shown, don't count against limit)
            interstellar = sorted(
                [o for o in objects if o[0] == "✨"], key=lambda x: x[3], reverse=True
            )
            regular_objects = [o for o in objects if o[0] != "✨"]

            # Sort by score and take balanced mix: 25% comets, 25% planets, 50% DSOs
            comets = sorted(
                [o for o in regular_objects if o[0] == "☄️"],
                key=lambda x: x[3],
                reverse=True,
            )
            planets = sorted(
                [o for o in regular_objects if o[0] == "🪐"],
                key=lambda x: x[3],
                reverse=True,
            )
            dsos = sorted(
                [o for o in regular_objects if o[0] == "🌌"],
                key=lambda x: x[3],
                reverse=True,
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
                all_sorted = sorted(regular_objects, key=lambda x: x[3], reverse=True)
                for obj in all_sorted:
                    if obj not in selected:
                        selected.append(obj)
                        remaining -= 1
                        if remaining == 0:
                            break

            # Sort final selection by score
            selected.sort(key=lambda x: x[3], reverse=True)

            # Prepend interstellar objects (always shown at top, don't count against limit)
            selected = interstellar + selected

            if not selected:
                self.console.print(
                    "  [italic]No objects visible above threshold[/italic]"
                )
            else:
                # Note: interstellar objects are prepended and don't count against max_objects
                for icon, name, obj, score, mag in selected:
                    quality = self._get_quality_color(obj.max_altitude)
                    time_str = self.tz.format_time(obj.max_altitude_time)
                    mag_str = (
                        f" [italic](mag {mag:.1f})[/italic]" if mag is not None else ""
                    )

                    # Warnings
                    warning = ""
                    if hasattr(obj, "moon_warning") and obj.moon_warning:
                        warning = " [italic](moon)[/italic]"

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
                cat, desc, _ = self._get_weather_category(
                    best_night.weather.avg_cloud_cover
                )
                # Use simpler descriptions for Milky Way
                simple_desc = {
                    "clear": "Clear skies",
                    "partly": "Partly cloudy",
                    "cloudy": "Cloudy",
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
