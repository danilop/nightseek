"""Astronomy observation planning tool."""

from datetime import datetime
from typing import Optional

import typer
from rich.console import Console
from rich.status import Status

# Show banner immediately on import (before heavy imports)
console = Console()

app = typer.Typer(help="Plan your astronomy observations based on object visibility.")


@app.command()
def forecast(
    latitude: Optional[float] = typer.Option(
        None,
        "--latitude",
        "-lat",
        help="Observer latitude in degrees (-90 to 90)",
    ),
    longitude: Optional[float] = typer.Option(
        None,
        "--longitude",
        "-lon",
        help="Observer longitude in degrees (-180 to 180)",
    ),
    days: Optional[int] = typer.Option(
        None,
        "--days",
        "-d",
        help="Number of days to forecast (1-30)",
    ),
    max_objects: Optional[int] = typer.Option(
        None,
        "--max-objects",
        "-n",
        help="Maximum objects to show per night (1-50, default: 8)",
    ),
    comet_mag: Optional[float] = typer.Option(
        None,
        "--comet-mag",
        "-cm",
        help="Maximum comet magnitude to include (default: 12, lower=brighter=faster)",
    ),
    setup: bool = typer.Option(
        False,
        "--setup",
        help="Run interactive setup to configure your location",
    ),
):
    """Generate an astronomy observation forecast.

    Analyzes celestial object visibility for the next N nights,
    considering altitude thresholds and moon interference.
    """
    # Show welcome message FIRST (before any heavy loading)
    console.print()
    console.print(
        "[bold cyan]NightSeek[/bold cyan] [italic]- Astronomy Observation Planner[/italic]"
    )
    console.print()

    # Handle setup mode (lazy import config only when needed)
    from config import Config

    if setup:
        Config._interactive_setup()
        return

    # Load configuration (lightweight)
    config = Config.load(
        latitude=latitude, longitude=longitude, days=days, max_objects=max_objects
    )

    # Initialize analyzer with status updates (heavy loading happens here)
    with Status(
        "[bold blue]Loading ephemeris data...[/bold blue]",
        console=console,
        spinner="dots",
    ) as status:
        # Lazy import heavy modules
        from analyzer import VisibilityAnalyzer

        # Create analyzer (loads ephemeris and comets)
        analyzer = VisibilityAnalyzer(
            config.latitude, config.longitude, comet_mag=comet_mag or 12.0
        )

        # Load DSOs
        status.update("[bold blue]Loading DSO catalog...[/bold blue]")
        num_dsos = len(analyzer.catalog.get_all_dsos(verbose=False))

        # Comets are already loaded during analyzer init
        num_comets = len(analyzer.comets)

        status.update(f"[green]Loaded {num_dsos} DSOs, {num_comets} comets[/green]")

    # Show cache status after spinner completes
    cache_info = []
    opengc = analyzer.catalog._opengc_loader
    if opengc.was_downloaded:
        cache_info.append("[yellow]DSOs: downloaded[/yellow]")
    elif opengc.cache_age_days is not None:
        cache_info.append(f"DSOs: {opengc.cache_age_days:.0f}d cache")

    if analyzer.catalog.comets_downloaded:
        cache_info.append("[yellow]comets: downloaded[/yellow]")
    elif analyzer.catalog.comets_cache_age_hours is not None:
        cache_info.append(
            f"comets: {analyzer.catalog.comets_cache_age_hours:.0f}h cache"
        )

    if cache_info:
        console.print(f"[italic]Data: {', '.join(cache_info)}[/italic]")

    # Fetch weather forecast (only if ≤16 days)
    weather_forecast = None
    from weather import WeatherForecast

    if config.forecast_days <= WeatherForecast.MAX_FORECAST_DAYS:
        with Status(
            "[bold blue]Fetching weather forecast...[/bold blue]",
            console=console,
            spinner="dots",
        ) as status:
            weather_forecast = WeatherForecast(config.latitude, config.longitude)
            weather_forecast.fetch_forecast(config.forecast_days)
            status.update("[green]Weather data received[/green]")

    # Analyze forecast
    with Status(
        f"[bold blue]Calculating visibility for {config.forecast_days} night(s)...[/bold blue]",
        console=console,
        spinner="dots",
    ) as status:
        start_date = datetime.now()
        forecasts = analyzer.analyze_forecast(
            start_date,
            config.forecast_days,
            weather_forecast,
        )
        num_dsos = len(analyzer.catalog.get_all_dsos())
        num_dwarf_planets = len(analyzer.dwarf_planets)
        num_asteroids = len(analyzer.asteroids)

        # Build status message
        parts = [f"{num_dsos} DSOs"]
        if num_comets > 0:
            parts.append(f"{num_comets} comets")
        parts.append("7 planets")
        if num_dwarf_planets > 0:
            parts.append(f"{num_dwarf_planets} dwarf planets")
        if num_asteroids > 0:
            parts.append(f"{num_asteroids} asteroids")

        status.update(f"[green]Analyzed {', '.join(parts)}[/green]")

    console.print()

    # Get best dark nights
    best_dark_nights = analyzer.get_best_dark_nights(forecasts)

    # Create timezone converter and formatter (lazy imports)
    from timezone_utils import TimezoneConverter
    from formatter import ForecastFormatter

    tz_converter = TimezoneConverter(config.latitude, config.longitude)
    formatter = ForecastFormatter(tz_converter)
    formatter.format_forecast(
        forecasts,
        config.latitude,
        config.longitude,
        best_dark_nights,
        config.max_objects,
        analyzer,  # Pass analyzer to avoid reloading comets
    )

    # Check for updates after showing forecast
    try:
        from update_checker import check_for_updates, update_tool

        if check_for_updates():
            console.print(
                "\n[cyan]ℹ️  Update available. Installing latest version...[/cyan]"
            )
            if update_tool():
                console.print(
                    "[green]✓ Updated successfully. Changes apply on next run.[/green]"
                )
            else:
                console.print(
                    "[yellow]⚠ Update failed. Run 'uv tool install --force git+https://github.com/danilop/nightseek' manually.[/yellow]"
                )
    except Exception:
        pass  # Silently fail if update check fails


if __name__ == "__main__":
    app()
