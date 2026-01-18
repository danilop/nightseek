"""Shared caching utilities for data files."""

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.error import URLError
from urllib.request import urlopen

from platformdirs import user_cache_dir


@dataclass
class CacheInfo:
    """Information about a cached file."""

    path: Path
    exists: bool
    is_valid: bool
    age_seconds: Optional[float] = None
    was_downloaded: bool = False

    @property
    def age_hours(self) -> Optional[float]:
        """Age in hours, or None if file doesn't exist."""
        return self.age_seconds / 3600 if self.age_seconds is not None else None

    @property
    def age_days(self) -> Optional[float]:
        """Age in days, or None if file doesn't exist."""
        return self.age_seconds / 86400 if self.age_seconds is not None else None

    @property
    def age_display(self) -> str:
        """Human-readable age string (e.g., '2h', '3d')."""
        if self.age_seconds is None:
            return "unknown"
        if self.age_seconds < 3600:
            return f"{self.age_seconds / 60:.0f}m"
        elif self.age_seconds < 86400:
            return f"{self.age_seconds / 3600:.0f}h"
        else:
            return f"{self.age_seconds / 86400:.0f}d"


class CacheManager:
    """Manage cached data files with expiry times.

    Provides a unified interface for caching remote data files with
    configurable expiry periods. Used by both DSO and comet loaders.

    Example:
        cache = CacheManager()
        info = cache.ensure_fresh(
            url="https://example.com/data.csv",
            filename="data.csv",
            max_age_seconds=7 * 24 * 3600,  # 7 days
        )
        if info.exists:
            with open(info.path) as f:
                data = f.read()
    """

    # Common cache expiry constants
    ONE_HOUR = 3600
    ONE_DAY = 24 * 3600
    ONE_WEEK = 7 * 24 * 3600

    def __init__(self, app_name: str = "nightseek"):
        """Initialize cache manager.

        Args:
            app_name: Application name for cache directory
        """
        self._cache_dir = Path(user_cache_dir(app_name))
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    @property
    def cache_dir(self) -> Path:
        """Get the cache directory path."""
        return self._cache_dir

    def get_path(self, filename: str) -> Path:
        """Get full path for a cache file.

        Args:
            filename: Name of the cache file

        Returns:
            Full path to the cache file
        """
        return self._cache_dir / filename

    def check(self, filename: str, max_age_seconds: float) -> CacheInfo:
        """Check cache status for a file.

        Args:
            filename: Name of the cache file
            max_age_seconds: Maximum age in seconds before cache is invalid

        Returns:
            CacheInfo with status details
        """
        path = self.get_path(filename)

        if not path.exists():
            return CacheInfo(path=path, exists=False, is_valid=False)

        age = time.time() - path.stat().st_mtime
        is_valid = age < max_age_seconds

        return CacheInfo(
            path=path,
            exists=True,
            is_valid=is_valid,
            age_seconds=age,
        )

    def invalidate(self, filename: str) -> bool:
        """Delete a cached file to force re-download.

        Args:
            filename: Name of the cache file to delete

        Returns:
            True if file was deleted, False if it didn't exist
        """
        path = self.get_path(filename)
        if path.exists():
            path.unlink()
            return True
        return False

    def download(
        self,
        url: str,
        filename: str,
        verbose: bool = False,
        description: str = "data",
    ) -> CacheInfo:
        """Download a URL to the cache.

        Args:
            url: URL to download
            filename: Local filename to save as
            verbose: If True, print status messages
            description: Human-readable description for status messages

        Returns:
            CacheInfo with download status
        """
        path = self.get_path(filename)

        try:
            if verbose:
                print(f"Downloading {description}...")

            with urlopen(url, timeout=30) as response:
                data = response.read()
                with open(path, "wb") as f:
                    f.write(data)

            if verbose:
                print(f"Cached to {path}")

            return CacheInfo(
                path=path,
                exists=True,
                is_valid=True,
                age_seconds=0,
                was_downloaded=True,
            )

        except (URLError, OSError) as e:
            if verbose:
                print(f"Warning: Could not download {description}: {e}")

            # Return status of existing cache if any (stale but usable)
            if path.exists():
                age = time.time() - path.stat().st_mtime
                return CacheInfo(
                    path=path,
                    exists=True,
                    is_valid=False,
                    age_seconds=age,
                    was_downloaded=False,
                )

            return CacheInfo(
                path=path,
                exists=False,
                is_valid=False,
                was_downloaded=False,
            )

    def ensure_fresh(
        self,
        url: str,
        filename: str,
        max_age_seconds: float,
        verbose: bool = False,
        description: str = "data",
    ) -> CacheInfo:
        """Ensure cache is fresh, downloading if needed.

        This is the main entry point for most use cases. It checks if the
        cached file exists and is fresh enough, and downloads a new copy
        if needed.

        Args:
            url: URL to download from
            filename: Local filename
            max_age_seconds: Maximum cache age before re-download
            verbose: If True, print status messages
            description: Human-readable description for messages

        Returns:
            CacheInfo with current status (check was_downloaded to see if fresh)
        """
        info = self.check(filename, max_age_seconds)

        if info.is_valid:
            if verbose:
                print(f"Using cached {description} ({info.age_display} old)")
            return info

        return self.download(url, filename, verbose, description)


# Singleton instance for convenience
_default_manager: Optional[CacheManager] = None


def get_cache_manager() -> CacheManager:
    """Get the default cache manager instance.

    Returns:
        Shared CacheManager instance
    """
    global _default_manager
    if _default_manager is None:
        _default_manager = CacheManager()
    return _default_manager
