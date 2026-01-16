"""Catalog of notable celestial objects for observation."""

from dataclasses import dataclass
from typing import List

from skyfield.api import Star, Loader
from skyfield.data import mpc


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


@dataclass
class Comet:
    """A comet with orbital elements."""

    designation: str  # e.g., "C/2023 A3" or "12P"
    name: str  # e.g., "Tsuchinshan-ATLAS" or "Pons-Brooks"
    magnitude_g: float  # Absolute magnitude
    is_interstellar: bool  # True if eccentricity > 1.0 (hyperbolic orbit)
    row: object  # pandas Series with all orbital elements for Skyfield
    skyfield_obj: object = None  # Pre-computed Skyfield object (set by analyzer)


# Curated catalog of notable deep sky objects
# Focus on objects that photograph well with smart telescopes
DSO_CATALOG = [
    # Galaxies - High Priority
    CelestialObject("M31", "Andromeda Galaxy", "dso", 0.712, 41.269, 3.4, 1),
    CelestialObject("M33", "Triangulum Galaxy", "dso", 1.564, 30.660, 5.7, 2),
    CelestialObject("M51", "Whirlpool Galaxy", "dso", 13.498, 47.195, 8.4, 2),
    CelestialObject("M81", "Bode's Galaxy", "dso", 9.927, 69.065, 6.9, 2),
    CelestialObject("M82", "Cigar Galaxy", "dso", 9.928, 69.680, 8.4, 2),
    CelestialObject("M101", "Pinwheel Galaxy", "dso", 14.054, 54.349, 7.9, 2),
    CelestialObject("M104", "Sombrero Galaxy", "dso", 12.666, -11.623, 8.0, 2),
    CelestialObject("M65", "Leo Triplet Galaxy", "dso", 11.309, 13.093, 9.3, 3),
    CelestialObject("M66", "Leo Triplet Galaxy", "dso", 11.334, 12.993, 8.9, 3),
    CelestialObject("NGC253", "Sculptor Galaxy", "dso", 0.792, -25.288, 7.1, 2),
    CelestialObject("NGC4565", "Needle Galaxy", "dso", 12.602, 25.988, 9.6, 3),
    # Nebulae - Emission/Reflection - High Priority
    CelestialObject("M42", "Orion Nebula", "dso", 5.588, -5.391, 4.0, 1),
    CelestialObject("M8", "Lagoon Nebula", "dso", 18.062, -24.380, 6.0, 1),
    CelestialObject("M16", "Eagle Nebula", "dso", 18.312, -13.763, 6.4, 2),
    CelestialObject("M17", "Omega Nebula", "dso", 18.344, -16.178, 6.0, 2),
    CelestialObject("M20", "Trifid Nebula", "dso", 18.036, -23.033, 6.3, 2),
    CelestialObject("M78", "Reflection Nebula in Orion", "dso", 5.779, 0.048, 8.3, 3),
    CelestialObject("NGC7000", "North America Nebula", "dso", 20.975, 44.533, 4.0, 2),
    CelestialObject("IC5070", "Pelican Nebula", "dso", 20.837, 44.367, 8.0, 2),
    CelestialObject("IC1396", "Elephant's Trunk Nebula", "dso", 21.653, 57.500, 3.5, 2),
    CelestialObject("NGC2237", "Rosette Nebula", "dso", 6.535, 4.950, 9.0, 2),
    CelestialObject("IC1805", "Heart Nebula", "dso", 2.543, 61.467, 6.5, 2),
    CelestialObject("IC1848", "Soul Nebula", "dso", 2.893, 60.433, 6.5, 2),
    CelestialObject("NGC6960", "Western Veil Nebula", "dso", 20.756, 30.717, 7.0, 2),
    CelestialObject("NGC6992", "Eastern Veil Nebula", "dso", 20.937, 31.717, 7.0, 2),
    CelestialObject("NGC6888", "Crescent Nebula", "dso", 20.200, 38.350, 7.4, 3),
    CelestialObject("IC434", "Horsehead Nebula", "dso", 5.678, -2.458, 7.3, 2),
    CelestialObject("NGC2024", "Flame Nebula", "dso", 5.679, -1.912, 7.2, 2),
    CelestialObject("NGC1499", "California Nebula", "dso", 4.050, 36.617, 5.0, 2),
    CelestialObject("Sh2-129", "Flying Bat Nebula", "dso", 21.183, 59.983, 7.5, 3),
    # Planetary Nebulae
    CelestialObject("M27", "Dumbbell Nebula", "dso", 19.992, 22.721, 7.5, 2),
    CelestialObject("M57", "Ring Nebula", "dso", 18.888, 33.029, 8.8, 2),
    CelestialObject("NGC7293", "Helix Nebula", "dso", 22.495, -20.838, 7.6, 2),
    CelestialObject("M97", "Owl Nebula", "dso", 11.247, 55.017, 9.9, 3),
    CelestialObject("NGC6826", "Blinking Planetary", "dso", 19.744, 50.526, 8.8, 3),
    # Star Clusters
    CelestialObject("M13", "Hercules Cluster", "dso", 16.694, 36.460, 5.8, 2),
    CelestialObject("M44", "Beehive Cluster", "dso", 8.667, 19.983, 3.7, 3),
    CelestialObject("M45", "Pleiades", "dso", 3.790, 24.117, 1.6, 1),
    CelestialObject("M7", "Ptolemy Cluster", "dso", 17.895, -34.793, 3.3, 3),
    CelestialObject("M1", "Crab Nebula", "dso", 5.576, 22.015, 8.4, 2),
    CelestialObject("M11", "Wild Duck Cluster", "dso", 18.854, -6.267, 6.3, 3),
    CelestialObject("M35", "Open Cluster in Gemini", "dso", 6.150, 24.333, 5.3, 3),
    CelestialObject(
        "NGC869", "Double Cluster (h Persei)", "dso", 2.323, 57.139, 4.3, 2
    ),
    CelestialObject("M22", "Sagittarius Cluster", "dso", 18.607, -23.905, 5.1, 3),
    CelestialObject("M92", "Globular in Hercules", "dso", 17.285, 43.137, 6.4, 3),
]


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

    def __init__(self):
        """Initialize the catalog."""
        self.dso_objects = DSO_CATALOG
        self.milky_way = MILKY_WAY
        self._comets_df = None  # Lazy load comets
        self._setup_cache_directory()

    def _setup_cache_directory(self):
        """Set up cache directory for Skyfield data."""
        from pathlib import Path
        from platformdirs import user_cache_dir

        cache_dir = Path(user_cache_dir("nightseek"))
        cache_dir.mkdir(parents=True, exist_ok=True)
        self._cache_dir = cache_dir

    def get_all_dsos(self) -> List[CelestialObject]:
        """Get all deep sky objects.

        Returns:
            List of DSO objects
        """
        return self.dso_objects

    def get_priority_dsos(self, max_priority: int = 2) -> List[CelestialObject]:
        """Get high-priority deep sky objects.

        Args:
            max_priority: Maximum priority level to include (1=highest)

        Returns:
            List of high-priority DSO objects
        """
        return [obj for obj in self.dso_objects if obj.priority <= max_priority]

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

    def load_bright_comets(self, max_magnitude: float = 12.0) -> List[Comet]:
        """Load bright comets from Minor Planet Center with local caching.

        Args:
            max_magnitude: Maximum magnitude to include (default: 12.0)
                          Typical values: 6 = naked eye, 10 = binoculars, 12 = telescope

        Returns:
            List of Comet objects
        """
        import time

        try:
            # Check for cached comet data (24-hour expiry)
            cache_file = self._cache_dir / "CometEls.txt"
            cache_max_age = 24 * 60 * 60  # 24 hours in seconds

            use_cache = False
            if cache_file.exists():
                file_age = time.time() - cache_file.stat().st_mtime
                if file_age < cache_max_age:
                    use_cache = True

            if self._comets_df is None:
                loader = Loader(str(self._cache_dir))
                if use_cache:
                    # Load from local cache without network request
                    with open(cache_file, "rb") as f:
                        self._comets_df = mpc.load_comets_dataframe(f)
                else:
                    # Download fresh data (Skyfield caches to cache_dir)
                    with loader.open(mpc.COMET_URL) as f:
                        self._comets_df = mpc.load_comets_dataframe(f)

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
