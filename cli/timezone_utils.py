"""Timezone utilities for converting and displaying times."""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional

from timezonefinder import TimezoneFinder


class TimezoneConverter:
    """Handle timezone detection and conversion."""

    def __init__(self, latitude: float, longitude: float):
        """Initialize timezone converter.

        Args:
            latitude: Observer latitude
            longitude: Observer longitude
        """
        self.latitude = latitude
        self.longitude = longitude

        # Detect timezone from coordinates
        tf = TimezoneFinder()
        self.tz_name = tf.timezone_at(lat=latitude, lng=longitude)

        if self.tz_name:
            self.tz = ZoneInfo(self.tz_name)
        else:
            # Fallback to UTC if timezone can't be determined
            self.tz_name = "UTC"
            self.tz = ZoneInfo("UTC")

    def to_local(self, dt: Optional[datetime]) -> Optional[datetime]:
        """Convert UTC datetime to local timezone.

        Args:
            dt: UTC datetime (may be timezone-naive or aware)

        Returns:
            Local datetime, or None if input is None
        """
        if dt is None:
            return None

        # Ensure datetime is timezone-aware UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        elif dt.tzinfo != timezone.utc:
            dt = dt.astimezone(timezone.utc)

        # Convert to local timezone
        return dt.astimezone(self.tz)

    def format_time(self, dt: Optional[datetime]) -> str:
        """Format datetime in local timezone.

        Args:
            dt: UTC datetime

        Returns:
            Formatted time string (e.g., "11:48 PM")
        """
        if dt is None:
            return "N/A"

        local_dt = self.to_local(dt)
        # Type narrowing: local_dt is guaranteed to be datetime since dt is not None
        assert local_dt is not None
        return local_dt.strftime("%I:%M %p").lstrip("0")

    def get_utc_offset_str(self) -> str:
        """Get UTC offset string for current timezone.

        Returns:
            Offset string like "UTC+0" or "UTC-5"
        """
        # Get offset at a specific time (using now)
        now = datetime.now(self.tz)
        offset = now.utcoffset()

        if offset is None:
            return "UTC+0"

        total_seconds = int(offset.total_seconds())
        hours = total_seconds // 3600
        minutes = abs((total_seconds % 3600) // 60)

        if minutes == 0:
            return f"UTC{hours:+d}"
        else:
            sign = "+" if hours >= 0 else "-"
            return f"UTC{sign}{abs(hours)}:{minutes:02d}"

    def get_display_info(self) -> str:
        """Get timezone display string for header.

        Returns:
            String like "Local time (Europe/London, GMT, UTC+0)"
        """
        # Get timezone abbreviation for current time
        now = datetime.now(self.tz)
        tz_abbrev = now.strftime("%Z")

        offset_str = self.get_utc_offset_str()
        return f"Local time ({self.tz_name}, {tz_abbrev}, {offset_str})"
