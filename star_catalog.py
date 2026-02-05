"""Load and cache IAU named stars catalog."""

from dataclasses import dataclass
from typing import List, Optional

from cache_manager import CacheManager
from logging_config import get_logger

logger = get_logger(__name__)

# IAU Catalog of Star Names URL
IAU_CSN_URL = "https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt"


@dataclass
class NamedStar:
    """A named star from the IAU catalog."""

    name: str  # IAU proper name (e.g., "Sirius", "Betelgeuse")
    designation: str  # Catalog designation (e.g., "HR 2491", "HIP 32349")
    constellation: str  # 3-letter IAU abbreviation
    ra_hours: float  # Right ascension in hours (J2000)
    dec_degrees: float  # Declination in degrees (J2000)
    magnitude: float  # Visual magnitude
    hipparcos_id: Optional[int] = None  # Hipparcos catalog number


class StarCatalogLoader:
    """Load and cache IAU named stars catalog."""

    CACHE_FILENAME = "iau-csn.txt"

    def __init__(self):
        """Initialize the loader."""
        self._cache = CacheManager()
        self.was_downloaded = False
        self.cache_age_days = None

    def load_named_stars(self, verbose: bool = False) -> List[NamedStar]:
        """Load named stars from IAU catalog.

        Args:
            verbose: If True, print status messages

        Returns:
            List of NamedStar objects
        """
        # Ensure cache is fresh (30 days max age - stars don't change often)
        info = self._cache.ensure_fresh(
            url=IAU_CSN_URL,
            filename=self.CACHE_FILENAME,
            max_age_seconds=30 * 24 * 60 * 60,  # 30 days
            verbose=verbose,
            description="IAU star names (~30KB)",
        )

        self.was_downloaded = info.was_downloaded
        self.cache_age_days = info.age_days

        if not info.exists:
            return []

        stars = []
        try:
            with open(info.path, "r", encoding="utf-8") as f:
                for line in f:
                    # Skip empty lines and comments (# or $)
                    line = line.rstrip()
                    if not line or line.startswith("#") or line.startswith("$"):
                        continue

                    # The file uses fixed-width columns, but with variable spacing
                    # We need to handle this carefully
                    # Format: Name(ASCII) Name(UTF8) Designation ID ID2 Con # WDS mag bnd HIP HD RA Dec Date Notes
                    parts = line.split()
                    if len(parts) < 14:
                        continue

                    try:
                        name = parts[0]  # ASCII name (e.g., "Sirius")

                        # Find designation - typically starts with HR, HD, GJ, HIP, etc.
                        # It's the 3rd field
                        designation = parts[2]

                        # Constellation is the 6th field (3-letter code)
                        constellation = parts[5]

                        # Find magnitude - it's a float followed by V or G
                        # Scan backwards from the date field to find it
                        # The date is always in YYYY-MM-DD format
                        mag_idx = None
                        for i, p in enumerate(parts):
                            # Look for magnitude (numeric, followed by V or G band)
                            if i + 1 < len(parts) and parts[i + 1] in ("V", "G"):
                                try:
                                    float(p)
                                    mag_idx = i
                                    break
                                except ValueError:
                                    continue

                        if mag_idx is None:
                            continue

                        mag_str = parts[mag_idx]
                        if mag_str == "_":
                            continue
                        magnitude = float(mag_str)

                        # Band is mag_idx + 1, HIP is mag_idx + 2, HD is mag_idx + 3
                        # RA is mag_idx + 4, Dec is mag_idx + 5
                        hip_str = (
                            parts[mag_idx + 2] if mag_idx + 2 < len(parts) else "_"
                        )
                        hipparcos_id = int(hip_str) if hip_str != "_" else None

                        ra_deg = float(parts[mag_idx + 4])
                        dec_deg = float(parts[mag_idx + 5])

                        # Convert RA from degrees to hours
                        ra_hours = ra_deg / 15.0

                        stars.append(
                            NamedStar(
                                name=name,
                                designation=designation,
                                constellation=constellation,
                                ra_hours=ra_hours,
                                dec_degrees=dec_deg,
                                magnitude=magnitude,
                                hipparcos_id=hipparcos_id,
                            )
                        )
                    except (ValueError, IndexError) as e:
                        logger.debug("Could not parse star line: %s - %s", line[:50], e)
                        continue

        except OSError as e:
            logger.warning("Could not read star catalog: %s", e)
            return []

        return stars


def search_stars(query: str, stars: List[NamedStar]) -> List[NamedStar]:
    """Search for stars by name.

    Args:
        query: Search query string
        stars: List of NamedStar objects to search

    Returns:
        List of matching stars
    """
    query_lower = query.lower().strip()
    results = []

    for star in stars:
        # Match by name
        if query_lower in star.name.lower():
            results.append(star)
        # Match by designation
        elif query_lower in star.designation.lower():
            results.append(star)
        # Match by constellation
        elif query_lower == star.constellation.lower():
            results.append(star)

    # Sort by magnitude (brightest first)
    results.sort(key=lambda s: s.magnitude)

    return results[:20]  # Limit results
