"""Data models for NightSeek.

Contains dataclasses for structured data like locations, API responses, etc.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class LocationData:
    """Location information from IP geolocation or geocoding."""

    latitude: float
    longitude: float
    city: str
    country: str
    timezone: str = ""


@dataclass
class GeocodingResult:
    """Result from address geocoding."""

    latitude: float
    longitude: float


@dataclass
class CacheStatus:
    """Status of a cached data source."""

    downloaded: bool
    age_hours: Optional[float]

    @property
    def age_display(self) -> str:
        """Human-readable age display."""
        if self.downloaded:
            return "just downloaded"
        if self.age_hours is None:
            return "unknown age"
        if self.age_hours < 1:
            return f"{int(self.age_hours * 60)}m"
        if self.age_hours < 24:
            return f"{int(self.age_hours)}h"
        return f"{int(self.age_hours / 24)}d"
