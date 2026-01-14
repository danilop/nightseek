"""Astronomy observation planning tool."""

from datetime import datetime
from typing import Optional

import typer
from rich.progress import Progress, SpinnerColumn, TextColumn

from analyzer import VisibilityAnalyzer
from config import Config
from formatter import ForecastFormatter
from weather import WeatherForecast
from timezone_utils import TimezoneConverter


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
    # Handle setup mode
    if setup:
        Config._interactive_setup()
        return

    # Load configuration
    config = Config.load(
        latitude=latitude, longitude=longitude, days=days, max_objects=max_objects
    )

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        # Initialize analyzer
        progress.add_task("Loading celestial data and filtering comets...", total=None)
        analyzer = VisibilityAnalyzer(
            config.latitude, config.longitude, comet_mag=comet_mag or 12.0
        )

        # Fetch weather forecast (only if ≤16 days)
        weather_forecast = None
        if config.forecast_days <= WeatherForecast.MAX_FORECAST_DAYS:
            progress.add_task("Fetching weather forecast...", total=None)
            weather_forecast = WeatherForecast(config.latitude, config.longitude)
            weather_forecast.fetch_forecast(config.forecast_days)

        # Analyze forecast
        progress.add_task(
            f"Calculating visibility for {config.forecast_days} night(s)...", total=None
        )
        start_date = datetime.now()
        forecasts = analyzer.analyze_forecast(
            start_date,
            config.forecast_days,
            weather_forecast,
        )

    # Get best dark nights
    best_dark_nights = analyzer.get_best_dark_nights(forecasts)

    # Create timezone converter
    tz_converter = TimezoneConverter(config.latitude, config.longitude)

    # Format and display
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
