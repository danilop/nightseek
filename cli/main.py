"""Astronomy observation planning tool."""

from datetime import datetime
from typing import Optional

import typer
from rich.console import Console
from rich.status import Status
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    BarColumn,
    TaskProgressColumn,
)

from logging_config import setup_logging, get_logger

# Show banner immediately on import (before heavy imports)
console = Console()
logger = get_logger(__name__)

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
    search: Optional[str] = typer.Option(
        None,
        "--search",
        "-s",
        help="Search for a celestial object by name or code (e.g., M31, Andromeda, Jupiter)",
    ),
    setup: bool = typer.Option(
        False,
        "--setup",
        help="Run interactive setup to configure your location",
    ),
    update: bool = typer.Option(
        False,
        "--update",
        "-u",
        help="Check for updates and install if available",
    ),
    verbose: bool = typer.Option(
        False,
        "--verbose",
        "-v",
        help="Show debug output for troubleshooting",
    ),
):
    """Generate an astronomy observation forecast.

    Analyzes celestial object visibility for the next N nights,
    considering altitude thresholds and moon interference.
    """
    # Initialize logging based on verbose flag
    setup_logging(verbose=verbose)

    # Show welcome message FIRST (before any heavy loading)
    console.print()
    console.print(
        "[bold cyan]NightSeek[/bold cyan] [italic]- Astronomy Observation Planner[/italic]"
    )
    console.print()

    # Handle update mode
    if update:
        from update_checker import (
            get_remote_version,
            get_local_version,
            update_tool,
            is_update_available,
            save_installed_version,
        )

        with Status(
            "[bold blue]Checking for updates...[/bold blue]",
            console=console,
            spinner="dots",
        ):
            local = get_local_version()
            remote = get_remote_version()

        if remote is None:
            console.print(
                "[yellow]⚠ Could not check for updates (network error)[/yellow]"
            )
            return

        if local and is_update_available(local, remote):
            with Status(
                "[cyan]Update available! Installing...[/cyan]",
                console=console,
                spinner="dots",
            ):
                success = update_tool()
            if success:
                save_installed_version(remote)
                console.print(
                    "[green]✓ Updated successfully.[/green] Changes apply on next run."
                )
            else:
                console.print(
                    "[red]✗ Update failed.[/red] Try: uv tool install --force git+https://github.com/danilop/nightseek"
                )
        else:
            version_str = remote if local == "installed" else local
            console.print(
                f"[green]✓ Already up to date[/green] (version: {version_str})"
            )
        return

    # Handle setup mode (lazy import config only when needed)
    from config import Config

    if setup:
        Config._interactive_setup()
        return

    # Load configuration (lightweight)
    config = Config.load(
        latitude=latitude, longitude=longitude, days=days, max_objects=max_objects
    )

    # Validate required coordinates
    if config.latitude is None or config.longitude is None:
        console.print(
            "[red]Error: Location not configured. Run 'nightseek --setup' first.[/red]"
        )
        raise typer.Exit(1)

    # Type narrowing: after validation, these are guaranteed non-None
    lat: float = config.latitude
    lon: float = config.longitude

    # Handle search mode
    if search:
        _handle_search(search, lat, lon, verbose)
        return

    # Initialize analyzer with progress bar showing each step
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("Loading data...", total=4)

        # Step 1: Import modules
        progress.update(task, description="Importing modules...")
        from analyzer import VisibilityAnalyzer

        progress.advance(task)

        # Step 2: Load ephemeris and planets
        progress.update(task, description="Loading ephemeris...")
        analyzer = VisibilityAnalyzer(lat, lon, comet_mag=comet_mag or 12.0)
        progress.advance(task)

        # Step 3: Load DSOs
        progress.update(task, description="Loading DSO catalog...")
        num_dsos = len(analyzer.catalog.get_all_dsos(verbose=False))
        progress.advance(task)

        # Step 4: Count comets (already loaded)
        progress.update(task, description="Loading comets...")
        num_comets = len(analyzer.comets)
        progress.advance(task)

    console.print(f"[green]✓ Loaded {num_dsos} DSOs, {num_comets} comets[/green]")

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
        with Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task("Fetching weather...", total=1)

            weather_forecast = WeatherForecast(lat, lon)
            success = weather_forecast.fetch_forecast(config.forecast_days)
            progress.advance(task)

        if success:
            console.print("[green]✓ Weather data received[/green]")
        else:
            weather_forecast = None
            console.print(
                "[yellow]⚠ Weather data unavailable (network/cache error)[/yellow]"
            )

    # Analyze forecast with progress bar
    start_date = datetime.now()
    num_dsos = len(analyzer.catalog.get_all_dsos())
    num_dwarf_planets = len(analyzer.dwarf_planets)
    num_asteroids = len(analyzer.asteroids)

    if config.forecast_days > 1:
        # Multi-day: show progress bar
        with Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TextColumn("[dim]{task.fields[date]}[/dim]"),
            console=console,
        ) as progress:
            task = progress.add_task(
                "Analyzing nights",
                total=config.forecast_days,
                date="",
            )

            def update_progress(day_num, _total, date):
                progress.update(
                    task,
                    completed=day_num,
                    date=date.strftime("%b %d"),
                )

            forecasts = analyzer.analyze_forecast(
                start_date,
                config.forecast_days,
                weather_forecast,
                progress_callback=update_progress,
            )
    else:
        # Single day: use simple spinner
        with Status(
            "[bold blue]Analyzing tonight...[/bold blue]",
            console=console,
            spinner="dots",
        ):
            forecasts = analyzer.analyze_forecast(
                start_date,
                config.forecast_days,
                weather_forecast,
            )

    # Build status message
    parts = [f"{num_dsos} DSOs"]
    if num_comets > 0:
        parts.append(f"{num_comets} comets")
    parts.append("7 planets")
    if num_dwarf_planets > 0:
        parts.append(f"{num_dwarf_planets} dwarf planets")
    if num_asteroids > 0:
        parts.append(f"{num_asteroids} asteroids")
    console.print(f"[green]✓ Analyzed {', '.join(parts)}[/green]")

    console.print()

    # Get best dark nights
    best_dark_nights = analyzer.get_best_dark_nights(forecasts)

    # Create timezone converter and formatter (lazy imports)
    from timezone_utils import TimezoneConverter
    from formatter import ForecastFormatter

    tz_converter = TimezoneConverter(lat, lon)
    formatter = ForecastFormatter(tz_converter)
    formatter.format_forecast(
        forecasts,
        lat,
        lon,
        best_dark_nights,
        config.max_objects,
        analyzer,  # Pass analyzer to avoid reloading comets
    )

    # Check for updates after showing forecast
    try:
        from update_checker import check_for_updates, update_tool

        if check_for_updates():
            console.print()
            with Status(
                "[cyan]ℹ️  Update available. Installing...[/cyan]",
                console=console,
                spinner="dots",
            ):
                success = update_tool()
            if success:
                console.print(
                    "[green]✓ Updated successfully. Changes apply on next run.[/green]"
                )
            else:
                console.print(
                    "[yellow]⚠ Update failed. Run 'nightseek --update' to retry.[/yellow]"
                )
    except Exception as e:
        logger.debug("Update check failed: %s", e)


def _handle_search(query: str, lat: float, lon: float, verbose: bool):
    """Handle search mode - find objects and show their visibility.

    Args:
        query: Search query string
        lat: Observer latitude
        lon: Observer longitude
        verbose: If True, show verbose output
    """
    from search import ObjectSearcher, format_search_results
    from timezone_utils import TimezoneConverter

    console.print(f"[bold]Searching for:[/bold] {query}")
    console.print()

    # Initialize searcher
    with Status(
        "[bold blue]Loading catalogs...[/bold blue]",
        console=console,
        spinner="dots",
    ):
        searcher = ObjectSearcher(lat, lon, verbose=verbose)

    # Perform search
    with Status(
        "[bold blue]Searching...[/bold blue]",
        console=console,
        spinner="dots",
    ):
        results = searcher.search(query)

    # Display results
    tz_converter = TimezoneConverter(lat, lon)
    format_search_results(results, tz_converter, console)

    # Summary
    if results:
        visible_tonight = sum(1 for r in results if r.visible_tonight)
        never_visible = sum(1 for r in results if r.never_visible)

        console.print()
        console.print(f"[dim]Found {len(results)} matching object(s)[/dim]")
        if visible_tonight:
            console.print(f"[green]{visible_tonight} visible tonight[/green]")
        if never_visible:
            console.print(
                f"[yellow]{never_visible} never visible from your location[/yellow]"
            )


if __name__ == "__main__":
    app()
