"""Load and cache OpenNGC catalog data."""

import csv
from dataclasses import dataclass
from typing import List, Optional

from cache_manager import CacheManager


@dataclass
class OpenNGCObject:
    """A deep sky object from the OpenNGC catalog."""

    name: str  # NGC/IC designation (e.g., "NGC 224", "IC 1396")
    common_name: str  # Common name if known (e.g., "Andromeda Galaxy")
    obj_type: str  # Always "dso"
    ra_hours: float  # Right ascension in hours
    dec_degrees: float  # Declination in degrees
    magnitude: float  # Visual magnitude
    dso_subtype: (
        str  # galaxy, nebula, open_cluster, globular_cluster, planetary_nebula, etc.
    )
    angular_size_arcmin: float  # Major axis size in arcminutes
    surface_brightness: Optional[float]  # mag/arcsec² (if available)
    constellation: str  # Constellation abbreviation
    # NEW: Position angle and minor axis for composition planning
    position_angle: Optional[float] = None  # Orientation in degrees (0-180)
    minor_axis_arcmin: Optional[float] = None  # Minor axis for elongation calculation


# OpenNGC type mapping to human-readable subtypes
OPENGC_TYPE_MAP = {
    "G": "galaxy",
    "GGroup": "galaxy_group",
    "GPair": "galaxy_pair",
    "GTrpl": "galaxy_triplet",
    "GClstr": "galaxy_cluster",
    "PN": "planetary_nebula",
    "HII": "emission_nebula",
    "RN": "reflection_nebula",
    "SNR": "supernova_remnant",
    "EmN": "emission_nebula",
    "Neb": "nebula",
    "OCl": "open_cluster",
    "GCl": "globular_cluster",
    "Cl+N": "cluster_nebula",
    "AGN": "galaxy",  # Active galactic nucleus
    "QSO": "quasar",
    "*": "star",
    "**": "double_star",
    "*Ass": "stellar_association",
    "Ast": "asterism",
    "NonEx": "nonexistent",  # Will be filtered out
    "Other": "other",
    "Dup": "duplicate",  # Will be filtered out
}

# Moon sensitivity by subtype (higher = more sensitive to moonlight)
DSO_MOON_SENSITIVITY = {
    "galaxy": 0.8,
    "galaxy_group": 0.8,
    "galaxy_pair": 0.8,
    "galaxy_triplet": 0.8,
    "galaxy_cluster": 0.7,
    "planetary_nebula": 0.5,  # Often small and bright
    "emission_nebula": 0.9,  # Very sensitive
    "reflection_nebula": 0.95,  # Extremely sensitive
    "supernova_remnant": 0.85,
    "nebula": 0.85,
    "open_cluster": 0.3,  # Stars - less sensitive
    "globular_cluster": 0.4,  # Bright cores
    "cluster_nebula": 0.7,
    "quasar": 0.2,  # Point source
    "star": 0.1,
    "double_star": 0.1,
    "stellar_association": 0.3,
    "asterism": 0.2,
    "other": 0.5,
}

# Common names for well-known NGC/IC objects
# Merged from both CLI and Web to ensure consistent search results
COMMON_NAMES = {
    # Galaxies
    "NGC 224": "Andromeda Galaxy",
    "NGC 253": "Sculptor Galaxy",
    "NGC 598": "Triangulum Galaxy",
    "NGC 2683": "UFO Galaxy",
    "NGC 3031": "Bode's Galaxy",
    "NGC 3034": "Cigar Galaxy",
    "NGC 3556": "Surfboard Galaxy",
    "NGC 4038": "Antennae Galaxies",
    "NGC 4039": "Antennae Galaxies",
    "NGC 4258": "Messier 106",
    "NGC 4486": "Virgo A",
    "NGC 4565": "Needle Galaxy",
    "NGC 4594": "Sombrero Galaxy",
    "NGC 4631": "Whale Galaxy",
    "NGC 4656": "Hockey Stick Galaxy",
    "NGC 4736": "Cat's Eye Galaxy",
    "NGC 4826": "Black Eye Galaxy",
    "NGC 5128": "Centaurus A",
    "NGC 5194": "Whirlpool Galaxy",
    "NGC 5195": "Whirlpool Galaxy Companion",
    "NGC 5457": "Pinwheel Galaxy",
    "NGC 5866": "Spindle Galaxy",
    # Nebulae - Emission/Reflection
    "NGC 281": "Pacman Nebula",
    "NGC 1333": "NGC 1333 Nebula",
    "NGC 1499": "California Nebula",
    "NGC 1952": "Crab Nebula",
    "NGC 1976": "Orion Nebula",
    "NGC 1982": "De Mairan's Nebula",
    "NGC 2024": "Flame Nebula",
    "NGC 2070": "Tarantula Nebula",
    "NGC 2174": "Monkey Head Nebula",
    "NGC 2237": "Rosette Nebula",
    "NGC 2264": "Cone Nebula",
    "NGC 2359": "Thor's Helmet",
    "NGC 3372": "Carina Nebula",
    "NGC 6188": "Fighting Dragons Nebula",
    "NGC 6302": "Butterfly Nebula",
    "NGC 6334": "Cat's Paw Nebula",
    "NGC 6357": "War and Peace Nebula",
    "NGC 6514": "Trifid Nebula",
    "NGC 6523": "Lagoon Nebula",
    "NGC 6611": "Eagle Nebula",
    "NGC 6618": "Omega Nebula",
    "NGC 6888": "Crescent Nebula",
    "NGC 6960": "Western Veil Nebula",
    "NGC 6992": "Eastern Veil Nebula",
    "NGC 6995": "Network Nebula",
    "NGC 7000": "North America Nebula",
    "NGC 7380": "Wizard Nebula",
    "NGC 7635": "Bubble Nebula",
    # Planetary Nebulae
    "NGC 650": "Little Dumbbell Nebula",
    "NGC 2392": "Eskimo Nebula",
    "NGC 3132": "Eight-Burst Nebula",
    "NGC 3242": "Ghost of Jupiter",
    "NGC 3587": "Owl Nebula",
    "NGC 6210": "Turtle Nebula",
    "NGC 6543": "Cat's Eye Nebula",
    "NGC 6720": "Ring Nebula",
    "NGC 6751": "Glowing Eye Nebula",
    "NGC 6826": "Blinking Planetary",
    "NGC 6853": "Dumbbell Nebula",
    "NGC 7009": "Saturn Nebula",
    "NGC 7027": "Magic Carpet Nebula",
    "NGC 7293": "Helix Nebula",
    "NGC 7662": "Blue Snowball Nebula",
    # Open Clusters
    "NGC 869": "Double Cluster (h Persei)",
    "NGC 884": "Double Cluster (chi Persei)",
    "NGC 1912": "Starfish Cluster",
    "NGC 1960": "Pinwheel Cluster",
    "NGC 2099": "Salt and Pepper Cluster",
    "NGC 2244": "Rosette Cluster",
    "NGC 2632": "Beehive Cluster",
    "NGC 3603": "NGC 3603 Cluster",
    "NGC 6405": "Butterfly Cluster",
    "NGC 6530": "Lagoon Cluster",
    "NGC 6705": "Wild Duck Cluster",
    # Globular Clusters
    "NGC 104": "47 Tucanae",
    "NGC 362": "NGC 362 Cluster",
    "NGC 5139": "Omega Centauri",
    "NGC 6093": "Messier 80",
    "NGC 6205": "Hercules Cluster",
    "NGC 6341": "Messier 92",
    "NGC 6397": "NGC 6397 Cluster",
    "NGC 6752": "NGC 6752 Cluster",
    "NGC 6779": "Messier 56",
    "NGC 6809": "Messier 55",
    "NGC 7078": "Great Pegasus Cluster",
    "NGC 7331": "Deer Lick Group",
    "NGC 7789": "Caroline's Rose",
    # IC Objects
    "IC 434": "Horsehead Nebula",
    "IC 1318": "Sadr Region",
    "IC 1396": "Elephant Trunk Nebula",
    "IC 1805": "Heart Nebula",
    "IC 1848": "Soul Nebula",
    "IC 2118": "Witch Head Nebula",
    "IC 2177": "Seagull Nebula",
    "IC 4604": "Rho Ophiuchi Complex",
    "IC 4703": "Eagle Nebula",
    "IC 5067": "Pelican Nebula",
    "IC 5070": "Pelican Nebula",
    "IC 5146": "Cocoon Nebula",
}

# Messier objects NOT in NGC/IC catalog (need to be added manually)
# These are primarily open clusters in Melotte/Collinder catalogs
MESSIER_NOT_IN_NGC = [
    # M45 - Pleiades (most famous missing Messier object)
    {
        "name": "Mel 22",
        "common_name": "M45 Pleiades",
        "ra_hours": 3.7833,
        "dec_degrees": 24.1167,
        "magnitude": 1.6,
        "dso_subtype": "open_cluster",
        "angular_size_arcmin": 110.0,
        "constellation": "Tau",
    },
    # M40 - Double star (not really a DSO, but included for completeness)
    {
        "name": "WNC 4",
        "common_name": "M40 Winnecke 4",
        "ra_hours": 12.3667,
        "dec_degrees": 58.0833,
        "magnitude": 8.4,
        "dso_subtype": "double_star",
        "angular_size_arcmin": 0.8,
        "constellation": "UMa",
    },
    # M73 - Asterism (4 stars)
    {
        "name": "Asterism",
        "common_name": "M73",
        "ra_hours": 20.9833,
        "dec_degrees": -12.6333,
        "magnitude": 9.0,
        "dso_subtype": "asterism",
        "angular_size_arcmin": 2.8,
        "constellation": "Aqr",
    },
]


class OpenNGCLoader:
    """Load and cache OpenNGC catalog data."""

    OPENGC_URL = "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv"
    CACHE_FILENAME = "opengc.csv"

    def __init__(self):
        """Initialize the loader."""
        self._cache = CacheManager()
        self.was_downloaded = False  # True if fresh download occurred
        self.cache_age_days = None  # Age of cache in days if used

    def _parse_ra(self, ra_str: str) -> Optional[float]:
        """Parse RA string (HH:MM:SS.s) to hours.

        Args:
            ra_str: RA in format "HH:MM:SS.s"

        Returns:
            RA in decimal hours, or None if invalid
        """
        if not ra_str or ra_str.strip() == "":
            return None
        try:
            parts = ra_str.split(":")
            hours = float(parts[0])
            minutes = float(parts[1]) if len(parts) > 1 else 0
            seconds = float(parts[2]) if len(parts) > 2 else 0
            return hours + minutes / 60 + seconds / 3600
        except (ValueError, IndexError):
            return None

    def _parse_dec(self, dec_str: str) -> Optional[float]:
        """Parse Dec string (+/-DD:MM:SS.s) to degrees.

        Args:
            dec_str: Dec in format "+DD:MM:SS.s" or "-DD:MM:SS.s"

        Returns:
            Dec in decimal degrees, or None if invalid
        """
        if not dec_str or dec_str.strip() == "":
            return None
        try:
            sign = -1 if dec_str.startswith("-") else 1
            dec_str = dec_str.lstrip("+-")
            parts = dec_str.split(":")
            degrees = float(parts[0])
            minutes = float(parts[1]) if len(parts) > 1 else 0
            seconds = float(parts[2]) if len(parts) > 2 else 0
            return sign * (degrees + minutes / 60 + seconds / 3600)
        except (ValueError, IndexError):
            return None

    def _parse_size(self, major_str: str, minor_str: str) -> float:
        """Parse angular size from major/minor axis strings.

        Args:
            major_str: Major axis in arcminutes
            minor_str: Minor axis in arcminutes

        Returns:
            Size in arcminutes (uses major axis, or average if both available)
        """
        try:
            major = float(major_str) if major_str else 0
            return major if major > 0 else 1.0  # Default 1 arcmin
        except ValueError:
            return 1.0

    def load_dsos(
        self,
        max_magnitude: float = 14.0,
        observer_latitude: Optional[float] = None,
        min_useful_altitude: float = 30.0,
        verbose: bool = False,
    ) -> List[OpenNGCObject]:
        """Load DSOs from OpenNGC catalog.

        Args:
            max_magnitude: Maximum visual magnitude to include
            observer_latitude: Observer latitude for filtering (optional)
            min_useful_altitude: Minimum altitude to ever reach (for filtering)
            verbose: If True, print status messages

        Returns:
            List of OpenNGCObject instances
        """
        # Ensure cache is fresh (7 days max age)
        info = self._cache.ensure_fresh(
            url=self.OPENGC_URL,
            filename=self.CACHE_FILENAME,
            max_age_seconds=CacheManager.ONE_WEEK,
            verbose=verbose,
            description="OpenNGC catalog (~4MB)",
        )

        # Track status for display
        self.was_downloaded = info.was_downloaded
        self.cache_age_days = info.age_days

        if not info.exists:
            return []

        objects = []
        try:
            with open(info.path, "r", encoding="utf-8") as f:
                # OpenNGC uses semicolon as delimiter
                reader = csv.DictReader(f, delimiter=";")

                for row in reader:
                    # Skip invalid types and non-DSO objects
                    obj_type = row.get("Type", "")
                    # NonEx = nonexistent, Dup = duplicate, * = single star, ** = double star
                    if obj_type in ("NonEx", "Dup", "", "*", "**", "*Ass"):
                        continue

                    # Parse magnitude - allow objects without magnitude (use default for nebulae)
                    mag_str = row.get("V-Mag") or row.get("B-Mag", "")
                    magnitude = None
                    if mag_str:
                        try:
                            magnitude = float(mag_str)
                        except ValueError:
                            pass

                    # For nebulae without magnitude, assign a default based on type
                    # Large emission nebulae are often photographically bright
                    if magnitude is None:
                        if obj_type in ("Neb", "HII", "EmN", "RN", "Cl+N", "SNR"):
                            magnitude = 10.0  # Default for nebulae without mag
                        else:
                            continue  # Skip other types without magnitude

                    # Filter by magnitude
                    if magnitude > max_magnitude:
                        continue

                    # Parse coordinates
                    ra = self._parse_ra(row.get("RA", ""))
                    dec = self._parse_dec(row.get("Dec", ""))
                    if ra is None or dec is None:
                        continue

                    # Filter by declination if observer latitude provided
                    if observer_latitude is not None:
                        max_possible_alt = 90 - abs(observer_latitude - dec)
                        if max_possible_alt < min_useful_altitude:
                            continue

                    # Get name
                    name = row.get("Name", "").strip()
                    if not name:
                        continue

                    # Format name properly (e.g., "NGC0224" -> "NGC 224")
                    if name.startswith("NGC"):
                        num = name[3:].lstrip("0") or "0"
                        name = f"NGC {num}"
                    elif name.startswith("IC"):
                        num = name[2:].lstrip("0") or "0"
                        name = f"IC {num}"

                    # Get Messier designation and common name
                    messier = row.get("M", "").strip()
                    # First try hardcoded common names, then fall back to CSV
                    base_common_name = COMMON_NAMES.get(name, "")
                    if not base_common_name:
                        # Read from CSV "Common names" column
                        csv_common_name = row.get("Common names", "").strip()
                        if csv_common_name:
                            base_common_name = csv_common_name

                    # Build common_name: prefer "M42 Orion Nebula" format
                    if messier:
                        # Remove leading zeros from Messier number
                        messier_num = messier.lstrip("0") or "0"
                        if base_common_name:
                            common_name = f"M{messier_num} {base_common_name}"
                        else:
                            common_name = f"M{messier_num}"
                    else:
                        common_name = base_common_name

                    # Map type to subtype
                    subtype = OPENGC_TYPE_MAP.get(obj_type, "other")

                    # Parse size (major and minor axis)
                    size = self._parse_size(row.get("MajAx", ""), row.get("MinAx", ""))

                    # Parse minor axis separately
                    minor_axis = None
                    minor_str = row.get("MinAx", "")
                    if minor_str:
                        try:
                            minor_axis = float(minor_str)
                        except ValueError:
                            pass

                    # Parse position angle if available
                    position_angle = None
                    pa_str = row.get("PosAng", "")
                    if pa_str:
                        try:
                            position_angle = float(pa_str)
                        except ValueError:
                            pass

                    # Parse surface brightness if available
                    sb_str = row.get("SurfBr", "")
                    surface_brightness = None
                    if sb_str:
                        try:
                            surface_brightness = float(sb_str)
                        except ValueError:
                            pass

                    # Get constellation
                    constellation = row.get("Const", "")

                    obj = OpenNGCObject(
                        name=name,
                        common_name=common_name,
                        obj_type="dso",
                        ra_hours=ra,
                        dec_degrees=dec,
                        magnitude=magnitude,
                        dso_subtype=subtype,
                        angular_size_arcmin=size,
                        surface_brightness=surface_brightness,
                        constellation=constellation,
                        position_angle=position_angle,
                        minor_axis_arcmin=minor_axis,
                    )
                    objects.append(obj)

        except (OSError, csv.Error) as e:
            print(f"Warning: Could not parse OpenNGC catalog: {e}")
            return []

        # Add Messier objects not in NGC/IC catalog
        for m_obj in MESSIER_NOT_IN_NGC:
            # Check magnitude filter
            if float(m_obj["magnitude"]) > max_magnitude:
                continue

            # Check declination filter
            if observer_latitude is not None:
                max_possible_alt = 90 - abs(
                    observer_latitude - float(m_obj["dec_degrees"])
                )
                if max_possible_alt < min_useful_altitude:
                    continue

            objects.append(
                OpenNGCObject(
                    name=str(m_obj["name"]),
                    common_name=str(m_obj["common_name"]),
                    obj_type="dso",
                    ra_hours=float(m_obj["ra_hours"]),
                    dec_degrees=float(m_obj["dec_degrees"]),
                    magnitude=float(m_obj["magnitude"]),
                    dso_subtype=str(m_obj["dso_subtype"]),
                    angular_size_arcmin=float(m_obj["angular_size_arcmin"]),
                    surface_brightness=None,
                    constellation=str(m_obj["constellation"]),
                )
            )

        return objects

    def get_object_count(self) -> int:
        """Get the number of objects in the cached catalog.

        Returns:
            Number of objects, or 0 if cache not available
        """
        cache_path = self._cache.get_path(self.CACHE_FILENAME)
        if not cache_path.exists():
            return 0
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return sum(1 for _ in f) - 1  # Subtract header
        except OSError:
            return 0
