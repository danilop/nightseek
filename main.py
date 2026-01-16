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
        "[bold blue]Loading ephemeris data...[/bold blue] [italic](cached locally)[/italic]",
        console=console,
        spinner="dots",
    ) as status:
        # Lazy import heavy modules
        from analyzer import VisibilityAnalyzer

        analyzer = VisibilityAnalyzer(
            config.latitude, config.longitude, comet_mag=comet_mag or 12.0
        )
        num_comets = len(analyzer.comets)
        status.update(
            f"[green]Loaded {num_comets} comets[/green] [italic](updates daily)[/italic]"
        )

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
        status.update(
            f"[green]Analyzed {num_dsos} DSOs, {num_comets} comets, 7 planets[/green]"
        )

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
    )


if __name__ == "__main__":
    app()
