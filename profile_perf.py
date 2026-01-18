"""Performance profiling script for nightseek."""

import cProfile
import pstats
import sys
from io import StringIO

# Add current directory to path
sys.path.insert(0, ".")

from main import forecast


def profile_forecast():
    """Profile a 3-day forecast."""
    profiler = cProfile.Profile()
    profiler.enable()

    # Run forecast with test parameters
    try:
        forecast(
            latitude=51.5,
            longitude=-0.1,
            days=3,
            max_objects=8,
            comet_mag=12.0,
            setup=False,
        )
    except SystemExit:
        pass

    profiler.disable()

    # Print stats
    s = StringIO()
    stats = pstats.Stats(profiler, stream=s)
    stats.sort_stats("cumulative")
    stats.print_stats(30)  # Top 30 functions
    print(s.getvalue())


if __name__ == "__main__":
    profile_forecast()
