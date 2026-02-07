"""Logging configuration for nightseek.

Provides a consistent logging setup across all modules.
By default, only warnings and errors are shown. Use --verbose for debug output.
"""

import logging
import sys


def setup_logging(verbose: bool = False) -> None:
    """Configure logging for the application.

    Args:
        verbose: If True, show DEBUG level messages. Otherwise show WARNING+.
    """
    level = logging.DEBUG if verbose else logging.WARNING

    # Configure root logger
    logging.basicConfig(
        level=level,
        format="%(levelname)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stderr)],
    )

    # Suppress noisy third-party loggers
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a logger for a module.

    Args:
        name: Module name, typically __name__

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)
