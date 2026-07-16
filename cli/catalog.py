"""Catalog of notable celestial objects for observation."""

from dataclasses import dataclass
from typing import List, Optional

from skyfield.api import Star, Loader
from skyfield.data import mpc

from cache_manager import CacheManager
from logging_config import get_logger
from opengc_loader import OpenNGCLoader

logger = get_logger(__name__)


@dataclass
class CelestialObject:
    """A celestial object in the catalog."""

    name: str
    common_name: str
    obj_type: str  # dso, planet, moon, milky_way
    ra_hours: float  # Right ascension in hours (0-24)
    dec_degrees: float  # Declination in degrees (-90 to 90)
    magnitude: Optional[float]
    priority: int  # 1=highest, 5=lowest
    dso_subtype: str = ""  # For DSOs: galaxy, nebula, cluster, etc.
    angular_size_arcmin: float = 1.0  # Angular size for surface brightness
    surface_brightness: Optional[float] = None  # mag/arcsec²
    position_angle: Optional[float] = None  # Orientation in degrees (0-180)
    minor_axis_arcmin: Optional[float] = None  # Minor axis for elongation
    constellation: str = ""  # Constellation abbreviation


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
    slope_parameter: float = 0.15  # IAU H-G slope parameter
    row: object = None  # MPC orbital elements (pandas Series) - optional
    skyfield_obj: object = None  # Pre-computed Skyfield object
    # Embedded orbital elements (used when row is None)
    semi_major_axis: float = 0.0  # AU
    eccentricity: float = 0.0
    inclination: float = 0.0  # degrees
    lon_asc_node: float = 0.0  # degrees
    arg_perihelion: float = 0.0  # degrees
    mean_anomaly: float = 0.0  # degrees
    epoch_jd: float = 2451545.0  # Julian date of epoch


# Dwarf-planet osculating elements from JPL SBDB, equinox J2000.
# This avoids needing the 150MB MPCORB download
DWARF_PLANETS = [
    {
        "name": "Pluto",
        "designation": "134340",
        "magnitude_h": -0.7,
        "semi_major_axis": 39.58862938517124,
        "eccentricity": 0.2518378778576892,
        "inclination": 17.14771140999114,
        "lon_asc_node": 110.2923840543057,
        "arg_perihelion": 113.7090015158565,
        "mean_anomaly": 38.68366347318184,
        "epoch_jd": 2457588.5,
    },
    {
        "name": "Ceres",
        "designation": "1",
        "magnitude_h": 3.34,
        "slope_parameter": 0.12,
        "semi_major_axis": 2.765552595034094,
        "eccentricity": 0.07969229514816586,
        "inclination": 10.58802780183462,
        "lon_asc_node": 80.24862682043221,
        "arg_perihelion": 73.29421453021587,
        "mean_anomaly": 274.4193463761342,
        "epoch_jd": 2461200.5,
    },
    {
        "name": "Eris",
        "designation": "136199",
        "magnitude_h": -1.2,
        "semi_major_axis": 67.93394687853566,
        "eccentricity": 0.4382385347971672,
        "inclination": 43.9258279471791,
        "lon_asc_node": 36.00477044417249,
        "arg_perihelion": 150.7949235840312,
        "mean_anomaly": 211.774434275007,
        "epoch_jd": 2461200.5,
    },
    {
        "name": "Makemake",
        "designation": "136472",
        "magnitude_h": -0.3,
        "semi_major_axis": 45.57093317300052,
        "eccentricity": 0.1588889953992523,
        "inclination": 29.02785603743067,
        "lon_asc_node": 79.2948338209406,
        "arg_perihelion": 297.0922733397207,
        "mean_anomaly": 169.9379962048232,
        "epoch_jd": 2461200.5,
    },
    {
        "name": "Haumea",
        "designation": "136108",
        "magnitude_h": 0.2,
        "semi_major_axis": 43.06029023650952,
        "eccentricity": 0.1944430148898797,
        "inclination": 28.20847393040364,
        "lon_asc_node": 121.7860561329425,
        "arg_perihelion": 240.6905472508661,
        "mean_anomaly": 223.2104118812299,
        "epoch_jd": 2461200.5,
    },
]

# Notable asteroid osculating elements from JPL SBDB, equinox J2000.
NOTABLE_ASTEROIDS = [
    {
        "name": "Vesta",
        "designation": "4",
        "magnitude_h": 3.2,
        "slope_parameter": 0.32,
        "semi_major_axis": 2.361365965127599,
        "eccentricity": 0.09020374382834395,
        "inclination": 7.143925545058711,
        "lon_asc_node": 103.701293265032,
        "arg_perihelion": 151.4686478221564,
        "mean_anomaly": 81.19015607686903,
        "epoch_jd": 2461200.5,
    },
    {
        "name": "Pallas",
        "designation": "2",
        "magnitude_h": 4.13,
        "slope_parameter": 0.11,
        "semi_major_axis": 2.769559010737709,
        "eccentricity": 0.2307000995648547,
        "inclination": 34.93279321851542,
        "lon_asc_node": 172.8866193357694,
        "arg_perihelion": 310.9699161652136,
        "mean_anomaly": 254.2496521742734,
        "epoch_jd": 2461200.5,
    },
    {
        "name": "Juno",
        "designation": "3",
        "magnitude_h": 5.33,
        "slope_parameter": 0.32,
        "semi_major_axis": 2.670989527103278,
        "eccentricity": 0.2556999836681878,
        "inclination": 12.98659236598085,
        "lon_asc_node": 169.8115953492418,
        "arg_perihelion": 247.8950743075613,
        "mean_anomaly": 262.7322944883855,
        "epoch_jd": 2461200.5,
    },
    {
        "name": "Hygiea",
        "designation": "10",
        "magnitude_h": 5.43,
        "semi_major_axis": 3.150974033963701,
        "eccentricity": 0.1067092741240963,
        "inclination": 3.829529946447122,
        "lon_asc_node": 283.1198927508594,
        "arg_perihelion": 312.4242387344704,
        "mean_anomaly": 252.0344242359649,
        "epoch_jd": 2461200.5,
    },
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
                    constellation=obj.constellation,
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
        """Load dwarf planets with embedded orbital elements.

        Returns:
            List of MinorPlanet objects for known dwarf planets
        """
        dwarf_planets = []

        for dp_info in DWARF_PLANETS:
            dwarf_planets.append(
                MinorPlanet(
                    designation=str(dp_info["designation"]),
                    name=str(dp_info["name"]),
                    category="dwarf_planet",
                    magnitude_h=float(dp_info["magnitude_h"]),
                    slope_parameter=float(dp_info.get("slope_parameter", 0.15)),
                    semi_major_axis=float(dp_info["semi_major_axis"]),
                    eccentricity=float(dp_info["eccentricity"]),
                    inclination=float(dp_info["inclination"]),
                    lon_asc_node=float(dp_info["lon_asc_node"]),
                    arg_perihelion=float(dp_info["arg_perihelion"]),
                    mean_anomaly=float(dp_info["mean_anomaly"]),
                    epoch_jd=float(dp_info["epoch_jd"]),
                )
            )

        return dwarf_planets

    def load_bright_asteroids(self, max_magnitude: float = 12.0) -> List[MinorPlanet]:
        """Load bright asteroids with embedded orbital elements.

        Args:
            max_magnitude: Maximum absolute magnitude to include

        Returns:
            List of MinorPlanet objects for bright asteroids
        """
        asteroids = []

        for ast_info in NOTABLE_ASTEROIDS:
            if float(ast_info["magnitude_h"]) <= max_magnitude:
                asteroids.append(
                    MinorPlanet(
                        designation=str(ast_info["designation"]),
                        name=str(ast_info["name"]),
                        category="asteroid",
                        magnitude_h=float(ast_info["magnitude_h"]),
                        slope_parameter=float(ast_info.get("slope_parameter", 0.15)),
                        semi_major_axis=float(ast_info["semi_major_axis"]),
                        eccentricity=float(ast_info["eccentricity"]),
                        inclination=float(ast_info["inclination"]),
                        lon_asc_node=float(ast_info["lon_asc_node"]),
                        arg_perihelion=float(ast_info["arg_perihelion"]),
                        mean_anomaly=float(ast_info["mean_anomaly"]),
                        epoch_jd=float(ast_info["epoch_jd"]),
                    )
                )

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

        except (OSError, ValueError, KeyError) as e:
            logger.warning("Could not load asteroid data: %s", e)
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

        except (OSError, ValueError, KeyError) as e:
            # If comet loading fails, return empty list (graceful degradation)
            if hasattr(self, "_comets_df") and self._comets_df is not None:
                logger.warning("Could not parse comet data: %s", e)
                logger.debug(
                    "Available columns: %s", list(self._comets_df.columns[:10])
                )
            else:
                logger.warning("Could not load comet data: %s", e)
            return []
