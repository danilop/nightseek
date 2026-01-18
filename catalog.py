"""Catalog of notable celestial objects for observation."""

from dataclasses import dataclass
from typing import List, Optional

from skyfield.api import Star, Loader
from skyfield.data import mpc

from cache_manager import CacheManager
from opengc_loader import OpenNGCLoader


@dataclass
class CelestialObject:
    """A celestial object in the catalog."""

    name: str
    common_name: str
    obj_type: str  # dso, planet, moon, milky_way
    ra_hours: float  # Right ascension in hours (0-24)
    dec_degrees: float  # Declination in degrees (-90 to 90)
    magnitude: float
    priority: int  # 1=highest, 5=lowest
    dso_subtype: str = ""  # For DSOs: galaxy, nebula, cluster, etc.
    angular_size_arcmin: float = 1.0  # Angular size for surface brightness
    surface_brightness: Optional[float] = None  # mag/arcsec²
    position_angle: Optional[float] = None  # Orientation in degrees (0-180)
    minor_axis_arcmin: Optional[float] = None  # Minor axis for elongation


@dataclass
class Comet:
    """A comet with orbital elements."""

    designation: str  # e.g., "C/2023 A3" or "12P"
    name: str  # e.g., "Tsuchinshan-ATLAS" or "Pons-Brooks"
    magnitude_g: float  # Absolute magnitude (intrinsic brightness)
    is_interstellar: bool  # True if eccentricity > 1.0 (hyperbolic orbit)
    row: object  # pandas Series with all orbital elements for Skyfield
    skyfield_obj: object = None  # Pre-computed Skyfield object (set by analyzer)
    apparent_magnitude: Optional[float] = (
        None  # Current apparent magnitude (computed by analyzer)
    )


@dataclass
class MinorPlanet:
    """A dwarf planet or asteroid with orbital elements."""

    designation: str  # e.g., "Pluto", "Ceres", "4 Vesta"
    name: str  # Display name
    category: str  # "dwarf_planet" or "asteroid"
    magnitude_h: float  # Absolute magnitude
    row: object  # MPC orbital elements (pandas Series)
    skyfield_obj: object = None  # Pre-computed Skyfield object


# Known dwarf planets (official IAU-recognized)
DWARF_PLANETS = [
    {"name": "Pluto", "designation": "134340", "magnitude_h": -0.7},
    {"name": "Ceres", "designation": "1", "magnitude_h": 3.34},
    {"name": "Eris", "designation": "136199", "magnitude_h": -1.2},
    {"name": "Makemake", "designation": "136472", "magnitude_h": -0.3},
    {"name": "Haumea", "designation": "136108", "magnitude_h": 0.2},
]

# Notable asteroids worth observing
NOTABLE_ASTEROIDS = [
    {"name": "Vesta", "designation": "4", "magnitude_h": 3.2},
    {"name": "Pallas", "designation": "2", "magnitude_h": 4.13},
    {"name": "Juno", "designation": "3", "magnitude_h": 5.33},
    {"name": "Hygiea", "designation": "10", "magnitude_h": 5.43},
]


# DSO_CATALOG is replaced by OpenNGC loader for ~13,000 objects
# No fallback - if OpenNGC download fails, DSO list will be empty


# Milky Way core is a special target
MILKY_WAY = CelestialObject(
    "MW_CORE",
    "Milky Way Core",
    "milky_way",
    17.761,  # Sagittarius A* approximate RA
    -29.008,  # Sagittarius A* approximate Dec
    0.0,
    1,
)


class Catalog:
    """Manage the celestial object catalog."""

    # Cache filenames
    COMET_CACHE_FILE = "CometEls.txt"
    MPCORB_CACHE_FILE = "MPCORB.DAT"

    def __init__(self, observer_latitude: Optional[float] = None):
        """Initialize the catalog.

        Args:
            observer_latitude: Observer latitude for filtering objects by visibility
        """
        self.observer_latitude = observer_latitude
        self.milky_way = MILKY_WAY
        self._comets_df = None  # Lazy load comets
        self._mpcorb_df = None  # Lazy load asteroids
        self._dso_objects = None  # Lazy load DSOs
        self._opengc_loader = OpenNGCLoader()
        self._cache = CacheManager()
        # Track download/cache status
        self.comets_downloaded = False
        self.comets_cache_age_hours = None

    def get_all_dsos(
        self,
        max_magnitude: float = 14.0,
        min_altitude: float = 30.0,
        verbose: bool = False,
    ) -> List[CelestialObject]:
        """Get all deep sky objects from OpenNGC.

        Args:
            max_magnitude: Maximum visual magnitude to include
            min_altitude: Minimum useful altitude for filtering
            verbose: If True, print status messages

        Returns:
            List of CelestialObject instances
        """
        if self._dso_objects is None:
            # Load from OpenNGC
            opengc_objects = self._opengc_loader.load_dsos(
                max_magnitude=max_magnitude,
                observer_latitude=self.observer_latitude,
                min_useful_altitude=min_altitude,
                verbose=verbose,
            )

            # Convert OpenNGCObject to CelestialObject
            self._dso_objects = [
                CelestialObject(
                    name=obj.name,
                    common_name=obj.common_name,
                    obj_type="dso",
                    ra_hours=obj.ra_hours,
                    dec_degrees=obj.dec_degrees,
                    magnitude=obj.magnitude,
                    priority=2,  # Default priority
                    dso_subtype=obj.dso_subtype,
                    angular_size_arcmin=obj.angular_size_arcmin,
                    surface_brightness=obj.surface_brightness,
                    position_angle=obj.position_angle,
                    minor_axis_arcmin=obj.minor_axis_arcmin,
                )
                for obj in opengc_objects
            ]

        return self._dso_objects

    def get_priority_dsos(self, max_priority: int = 2) -> List[CelestialObject]:
        """Get high-priority deep sky objects.

        Args:
            max_priority: Maximum priority level to include (1=highest)

        Returns:
            List of high-priority DSO objects
        """
        all_dsos = self.get_all_dsos()
        return [obj for obj in all_dsos if obj.priority <= max_priority]

    def load_dwarf_planets(self) -> List[MinorPlanet]:
        """Load dwarf planets from MPC data.

        Returns:
            List of MinorPlanet objects for known dwarf planets
        """
        dwarf_planets = []

        # Load MPCORB data if not cached
        if self._mpcorb_df is None:
            self._load_mpcorb_data()

        if self._mpcorb_df is None:
            return []

        for dp_info in DWARF_PLANETS:
            try:
                # Look up in MPCORB data by designation
                designation = str(dp_info["designation"])
                if designation in self._mpcorb_df.index:
                    row = self._mpcorb_df.loc[designation]
                    dwarf_planets.append(
                        MinorPlanet(
                            designation=designation,
                            name=str(dp_info["name"]),
                            category="dwarf_planet",
                            magnitude_h=float(dp_info["magnitude_h"]),
                            row=row,
                        )
                    )
            except Exception:
                continue

        return dwarf_planets

    def load_bright_asteroids(self, max_magnitude: float = 12.0) -> List[MinorPlanet]:
        """Load bright asteroids from MPC data.

        Args:
            max_magnitude: Maximum absolute magnitude to include

        Returns:
            List of MinorPlanet objects for bright asteroids
        """
        asteroids = []

        # Load MPCORB data if not cached
        if self._mpcorb_df is None:
            self._load_mpcorb_data()

        if self._mpcorb_df is None:
            return []

        # First add notable asteroids
        for ast_info in NOTABLE_ASTEROIDS:
            try:
                designation = str(ast_info["designation"])
                if designation in self._mpcorb_df.index:
                    row = self._mpcorb_df.loc[designation]
                    asteroids.append(
                        MinorPlanet(
                            designation=designation,
                            name=str(ast_info["name"]),
                            category="asteroid",
                            magnitude_h=float(ast_info["magnitude_h"]),
                            row=row,
                        )
                    )
            except Exception:
                continue

        return asteroids

    def _load_mpcorb_data(self):
        """Load MPC orbital elements database (cached)."""
        try:
            # Check cache status (7-day expiry for MPCORB)
            cache_info = self._cache.check(
                self.MPCORB_CACHE_FILE, CacheManager.ONE_WEEK
            )

            if cache_info.is_valid:
                # Load from cache
                with open(cache_info.path, "rb") as f:
                    self._mpcorb_df = mpc.load_mpcorb_dataframe(f)
            else:
                # Download fresh - this is slow (~150MB file)
                # For now, just use the notable asteroids list
                # Full MPCORB download is optional and can be enabled later
                self._mpcorb_df = None

        except Exception as e:
            print(f"Note: Could not load asteroid data: {e}")
            self._mpcorb_df = None

    def ra_dec_to_star(self, obj: CelestialObject) -> Star:
        """Convert RA/Dec to a Skyfield Star object.

        Args:
            obj: Celestial object with RA/Dec coordinates

        Returns:
            Skyfield Star object
        """
        return Star(
            ra_hours=obj.ra_hours,
            dec_degrees=obj.dec_degrees,
        )

    def load_bright_comets(
        self, max_magnitude: float = 12.0, verbose: bool = False
    ) -> List[Comet]:
        """Load bright comets from Minor Planet Center with local caching.

        Args:
            max_magnitude: Maximum magnitude to include (default: 12.0)
                          Typical values: 6 = naked eye, 10 = binoculars, 12 = telescope
            verbose: If True, print status messages

        Returns:
            List of Comet objects
        """
        try:
            # Check cache status (24-hour expiry for comets)
            cache_info = self._cache.check(self.COMET_CACHE_FILE, CacheManager.ONE_DAY)
            cache_path = cache_info.path

            if self._comets_df is None:
                loader = Loader(str(self._cache.cache_dir))

                if cache_info.is_valid:
                    # Use cached data
                    self.comets_cache_age_hours = cache_info.age_hours
                    self.comets_downloaded = False
                    if verbose:
                        print(
                            f"Using cached MPC comet data ({cache_info.age_display} old)"
                        )
                    with open(cache_path, "rb") as f:
                        self._comets_df = mpc.load_comets_dataframe(f)
                else:
                    # Cache is stale or missing - need to download
                    # Delete stale file first (Skyfield's Loader won't re-download if file exists)
                    if cache_info.exists:
                        self._cache.invalidate(self.COMET_CACHE_FILE)

                    if verbose:
                        print("Downloading MPC comet orbital elements...")
                    with loader.open(mpc.COMET_URL) as f:
                        self._comets_df = mpc.load_comets_dataframe(f)
                    self.comets_downloaded = True
                    self.comets_cache_age_hours = 0
                    if verbose:
                        print(f"Cached to {cache_path}")

            # Filter for bright comets
            bright = self._comets_df[self._comets_df["magnitude_g"] < max_magnitude]

            comets = []
            for idx, row in bright.iterrows():
                # Parse designation and name from various MPC formats:
                # - "C/2023 A3 (Tsuchinshan-ATLAS)" → code="C/2023 A3", name="Tsuchinshan-ATLAS"
                # - "186P/Garradd" → code="186P", name="Garradd"
                # - "C/2023 A3" → code="C/2023 A3", name="C/2023 A3" (no common name)
                full_designation = row["designation"]

                # Check for name in parentheses first (e.g., "C/2023 A3 (Name)")
                if "(" in full_designation and ")" in full_designation:
                    paren_start = full_designation.index("(")
                    code = full_designation[:paren_start].strip()
                    name = full_designation[
                        paren_start + 1 : full_designation.rindex(")")
                    ]
                # Check for periodic comet format (e.g., "186P/Garradd")
                elif "/" in full_designation:
                    parts = full_designation.split("/", 1)
                    code = parts[0]  # e.g., "186P"
                    name = parts[1] if len(parts) > 1 else full_designation
                else:
                    code = full_designation
                    name = full_designation

                # Use code as designation for display purposes
                designation = code

                # Check if interstellar (eccentricity > 1.0 = hyperbolic orbit)
                # The row has 'e' field for eccentricity
                eccentricity = float(row.get("e", 0))
                is_interstellar = eccentricity > 1.0

                comet = Comet(
                    designation=designation,
                    name=name,
                    magnitude_g=row["magnitude_g"],
                    is_interstellar=is_interstellar,
                    row=row,
                )
                comets.append(comet)

            return comets

        except Exception as e:
            # If comet loading fails, return empty list (graceful degradation)
            if hasattr(self, "_comets_df") and self._comets_df is not None:
                print(f"Warning: Could not parse comet data: {e}")
                print(
                    f"Available columns: {list(self._comets_df.columns[:10])}"
                )  # Show first 10
            else:
                print(f"Warning: Could not load comet data: {e}")
            # traceback.print_exc()  # Uncomment for debugging
            return []
