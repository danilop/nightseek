"""Object search module for finding celestial objects and their visibility."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, Callable
import math

from rich.console import Console
from rich.rule import Rule

from catalog import Catalog, CelestialObject, Comet, MinorPlanet
from logging_config import get_logger
from sky_calculator import (
    NightInfo,
    ObjectVisibility,
    SkyCalculator,
)

logger = get_logger(__name__)

# Minimum altitude for "visible"
MIN_ALTITUDE = 30

# Optimal altitude for "good observing"
OPTIMAL_ALTITUDE = 45

# Maximum days to search ahead
MAX_SEARCH_DAYS = 365

# Planets list
PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]


@dataclass
class SearchResult:
    """Result of searching for a celestial object."""

    object_name: str
    display_name: str
    object_type: str  # planet, dso, comet, dwarf_planet, asteroid
    ra_hours: float
    dec_degrees: float
    magnitude: Optional[float]

    # Visibility status
    visibility_status: (
        str  # visible_tonight, visible_soon, visible_later, never_visible
    )
    visible_tonight: bool
    next_visible_date: Optional[datetime]
    visibility: Optional[ObjectVisibility]

    # If never visible
    never_visible: bool
    never_visible_reason: Optional[str]
    max_possible_altitude: float

    # For moving objects
    is_moving_object: bool

    # Additional object info
    constellation: Optional[str] = None
    object_subtype: Optional[str] = None  # e.g., "spiral_galaxy", "planetary_nebula"
    angular_size_arcmin: Optional[float] = None  # For extended objects
    azimuth_at_peak: Optional[float] = None  # Compass direction at peak altitude

    # Optimal viewing info (45°+ altitude)
    can_reach_optimal: bool = True  # Can object ever reach 45° from this location?
    optimal_altitude_note: Optional[str] = (
        None  # Message about optimal viewing conditions
    )
    next_optimal_date: Optional[datetime] = None  # When object will next reach 45°+


def can_object_ever_be_visible(
    dec_degrees: float,
    observer_latitude: float,
    min_altitude: float = MIN_ALTITUDE,
) -> tuple[bool, float, Optional[str]]:
    """Check if an object can ever be visible from a given latitude.

    Args:
        dec_degrees: Object declination in degrees
        observer_latitude: Observer latitude in degrees
        min_altitude: Minimum required altitude

    Returns:
        Tuple of (can_be_visible, max_possible_altitude, reason_if_not)
    """
    # Maximum altitude an object can reach from this latitude
    max_alt = 90 - abs(observer_latitude - dec_degrees)

    if max_alt < 0:
        return (
            False,
            max_alt,
            f"Object never rises above the horizon at latitude {observer_latitude:.1f}",
        )

    if max_alt < min_altitude:
        return (
            False,
            max_alt,
            f"Object only reaches {max_alt:.1f} altitude (below {min_altitude} minimum)",
        )

    return True, max_alt, None


def can_object_reach_optimal(
    dec_degrees: float,
    observer_latitude: float,
    optimal_altitude: float = OPTIMAL_ALTITUDE,
) -> tuple[bool, Optional[str]]:
    """Check if an object can ever reach optimal viewing altitude (45°+).

    Args:
        dec_degrees: Object declination in degrees
        observer_latitude: Observer latitude in degrees
        optimal_altitude: Optimal altitude threshold (default 45°)

    Returns:
        Tuple of (can_reach_optimal, note_if_not)
    """
    max_alt = 90 - abs(observer_latitude - dec_degrees)

    if max_alt < optimal_altitude:
        return (
            False,
            f"Best altitude from your location: {max_alt:.0f}° (never reaches optimal {optimal_altitude:.0f}°)",
        )

    return True, None


def check_optimal_for_night(
    ra_hours: float,
    dec_degrees: float,
    calculator: SkyCalculator,
    night_info: NightInfo,
    optimal_altitude: float = OPTIMAL_ALTITUDE,
) -> tuple[bool, Optional[ObjectVisibility]]:
    """Check if an object reaches optimal altitude (45°+) during a given night.

    Args:
        ra_hours: Right ascension in hours
        dec_degrees: Declination in degrees
        calculator: SkyCalculator instance
        night_info: Night information
        optimal_altitude: Optimal altitude threshold

    Returns:
        Tuple of (reaches_optimal, visibility_info)
    """
    # Quick check: can the object ever reach optimal?
    can_reach, _ = can_object_reach_optimal(
        dec_degrees, calculator.latitude, optimal_altitude
    )
    if not can_reach:
        return False, None

    # Create a star object for the position
    from skyfield.api import Star

    star = Star(ra_hours=ra_hours, dec_degrees=dec_degrees)

    # Calculate visibility
    visibility = calculator.calculate_object_visibility(
        star, "search-object", "dso", night_info
    )

    return visibility.max_altitude >= optimal_altitude, visibility


def find_next_optimal_night(
    get_ra_dec: Callable[[datetime], Optional[tuple[float, float]]],
    calculator: SkyCalculator,
    start_date: datetime,
    max_days: int = MAX_SEARCH_DAYS,
) -> Optional[tuple[datetime, NightInfo, ObjectVisibility]]:
    """Find the next night when an object reaches optimal altitude (45°+).

    Uses exponential search followed by binary search for efficiency.

    Args:
        get_ra_dec: Function that returns (ra_hours, dec_degrees) for a given date
        calculator: SkyCalculator instance
        start_date: Start date for search
        max_days: Maximum days to search ahead

    Returns:
        Tuple of (date, night_info, visibility) or None if not found
    """
    # Check dates at exponentially increasing intervals
    check_days = [0, 1, 7, 14, 30, 60, 90, 180, 365]
    check_days = [d for d in check_days if d <= max_days]

    last_not_optimal = 0
    first_optimal = None

    for day_offset in check_days:
        check_date = start_date + timedelta(days=day_offset)
        pos = get_ra_dec(check_date)
        if pos is None:
            continue

        ra, dec = pos
        night_info = calculator.get_night_info(check_date)
        is_optimal, _ = check_optimal_for_night(ra, dec, calculator, night_info)

        if is_optimal:
            first_optimal = day_offset
            break
        last_not_optimal = day_offset

    if first_optimal is None:
        return None

    # Binary search for exact first optimal day
    while first_optimal - last_not_optimal > 1:
        mid = (last_not_optimal + first_optimal) // 2
        check_date = start_date + timedelta(days=mid)
        pos = get_ra_dec(check_date)
        if pos is None:
            last_not_optimal = mid
            continue

        ra, dec = pos
        night_info = calculator.get_night_info(check_date)
        is_optimal, _ = check_optimal_for_night(ra, dec, calculator, night_info)

        if is_optimal:
            first_optimal = mid
        else:
            last_not_optimal = mid

    # Return the first optimal night
    optimal_date = start_date + timedelta(days=first_optimal)
    pos = get_ra_dec(optimal_date)
    if pos is None:
        return None

    ra, dec = pos
    night_info = calculator.get_night_info(optimal_date)
    _, visibility = check_optimal_for_night(ra, dec, calculator, night_info)

    if visibility is None:
        return None

    return optimal_date, night_info, visibility


def search_dsos(query: str, catalog: Catalog) -> List[CelestialObject]:
    """Search for DSOs matching the query.

    Args:
        query: Search query string
        catalog: Catalog instance

    Returns:
        List of matching DSOs
    """
    results = []
    query_lower = query.lower().strip()

    # Handle Messier designations: M1, M 1, m1, etc.
    import re

    messier_match = re.match(r"^m\s*(\d+)$", query_lower)
    if messier_match:
        messier_num = int(messier_match.group(1))
        # Search for Messier objects
        for dso in catalog.get_all_dsos(max_magnitude=20.0):
            if f"m{messier_num}" in dso.name.lower() or (
                dso.common_name and f"m{messier_num}" in dso.common_name.lower()
            ):
                results.append(dso)
            # Also check for NGC names that have this Messier number
            # Many DSOs have names like "NGC 224 (M31)"
        return results

    # Handle NGC/IC designations: NGC 224, NGC224, ngc 224, etc.
    ngc_match = re.match(r"^(ngc|ic)\s*(\d+)$", query_lower)
    if ngc_match:
        prefix = ngc_match.group(1).upper()
        num = ngc_match.group(2)
        search_name = f"{prefix} {num}"
        for dso in catalog.get_all_dsos(max_magnitude=20.0):
            if (
                dso.name.lower() == search_name.lower()
                or dso.name.lower() == f"{prefix}{num}".lower()
            ):
                results.append(dso)
        return results

    # General search: name or common name
    for dso in catalog.get_all_dsos(max_magnitude=20.0):
        if query_lower in dso.name.lower():
            results.append(dso)
        elif dso.common_name and query_lower in dso.common_name.lower():
            results.append(dso)

    return results[:20]  # Limit results


def search_planets(query: str) -> List[str]:
    """Search for planets matching the query."""
    query_lower = query.lower().strip()
    return [p for p in PLANETS if query_lower in p.lower()]


def search_comets(query: str, comets: List[Comet]) -> List[Comet]:
    """Search for comets matching the query."""
    query_lower = query.lower().strip()
    results = []
    for comet in comets:
        if query_lower in comet.designation.lower():
            results.append(comet)
        elif query_lower in comet.name.lower():
            results.append(comet)
    return results[:10]


def search_dwarf_planets(
    query: str, dwarf_planets: List[MinorPlanet]
) -> List[MinorPlanet]:
    """Search for dwarf planets matching the query."""
    query_lower = query.lower().strip()
    return [dp for dp in dwarf_planets if query_lower in dp.name.lower()]


def search_asteroids(query: str, asteroids: List[MinorPlanet]) -> List[MinorPlanet]:
    """Search for asteroids matching the query."""
    query_lower = query.lower().strip()
    return [a for a in asteroids if query_lower in a.name.lower()]


def check_visibility_for_night(
    ra_hours: float,
    dec_degrees: float,
    calculator: SkyCalculator,
    night_info: NightInfo,
    min_altitude: float = MIN_ALTITUDE,
) -> tuple[bool, Optional[ObjectVisibility]]:
    """Check if an object is visible during a given night.

    Args:
        ra_hours: Right ascension in hours
        dec_degrees: Declination in degrees
        calculator: SkyCalculator instance
        night_info: Night information
        min_altitude: Minimum required altitude

    Returns:
        Tuple of (is_visible, visibility_info)
    """
    # Quick check: can the object ever be visible?
    can_be_visible, max_alt, _ = can_object_ever_be_visible(
        dec_degrees, calculator.latitude, min_altitude
    )
    if not can_be_visible:
        return False, None

    # Create a star object for the position
    from skyfield.api import Star

    star = Star(ra_hours=ra_hours, dec_degrees=dec_degrees)

    # Calculate visibility
    visibility = calculator.calculate_object_visibility(
        star, "search-object", "dso", night_info
    )

    return visibility.max_altitude >= min_altitude, visibility


def find_next_visible_night(
    get_ra_dec: Callable[[datetime], Optional[tuple[float, float]]],
    calculator: SkyCalculator,
    start_date: datetime,
    max_days: int = MAX_SEARCH_DAYS,
) -> Optional[tuple[datetime, NightInfo, ObjectVisibility]]:
    """Find the next night when an object is visible.

    Uses exponential search followed by binary search for efficiency.

    Args:
        get_ra_dec: Function that returns (ra_hours, dec_degrees) for a given date
        calculator: SkyCalculator instance
        start_date: Start date for search
        max_days: Maximum days to search ahead

    Returns:
        Tuple of (date, night_info, visibility) or None if not found
    """
    # Check dates at exponentially increasing intervals
    check_days = [0, 1, 7, 14, 30, 60, 90, 180, 365]
    check_days = [d for d in check_days if d <= max_days]

    last_invisible = 0
    first_visible = None

    for day_offset in check_days:
        check_date = start_date + timedelta(days=day_offset)
        pos = get_ra_dec(check_date)
        if pos is None:
            continue

        ra, dec = pos
        night_info = calculator.get_night_info(check_date)
        is_visible, _ = check_visibility_for_night(ra, dec, calculator, night_info)

        if is_visible:
            first_visible = day_offset
            break
        last_invisible = day_offset

    if first_visible is None:
        return None

    # Binary search for exact first visible day
    while first_visible - last_invisible > 1:
        mid = (last_invisible + first_visible) // 2
        check_date = start_date + timedelta(days=mid)
        pos = get_ra_dec(check_date)
        if pos is None:
            last_invisible = mid
            continue

        ra, dec = pos
        night_info = calculator.get_night_info(check_date)
        is_visible, _ = check_visibility_for_night(ra, dec, calculator, night_info)

        if is_visible:
            first_visible = mid
        else:
            last_invisible = mid

    # Return the first visible night
    visible_date = start_date + timedelta(days=first_visible)
    pos = get_ra_dec(visible_date)
    if pos is None:
        return None

    ra, dec = pos
    night_info = calculator.get_night_info(visible_date)
    _, visibility = check_visibility_for_night(ra, dec, calculator, night_info)

    if visibility is None:
        return None

    return visible_date, night_info, visibility


class ObjectSearcher:
    """Search for celestial objects and determine their visibility."""

    def __init__(self, latitude: float, longitude: float, verbose: bool = False):
        """Initialize the searcher.

        Args:
            latitude: Observer latitude in degrees
            longitude: Observer longitude in degrees
            verbose: If True, print status messages
        """
        self.latitude = latitude
        self.longitude = longitude
        self.verbose = verbose

        self.calculator = SkyCalculator(latitude, longitude)
        self.catalog = Catalog(observer_latitude=latitude)
        self.tonight = self.calculator.get_night_info(datetime.now())

        # Load comets
        self.comets = self.catalog.load_bright_comets(
            max_magnitude=20.0, verbose=verbose
        )

        # Load dwarf planets and asteroids
        self.dwarf_planets = self.catalog.load_dwarf_planets()
        self.asteroids = self.catalog.load_bright_asteroids()

        # Set up planets
        self.planets = {
            "Mercury": self.calculator.mercury,
            "Venus": self.calculator.venus,
            "Mars": self.calculator.mars,
            "Jupiter": self.calculator.jupiter,
            "Saturn": self.calculator.saturn,
            "Uranus": self.calculator.uranus,
            "Neptune": self.calculator.neptune,
        }

    def search(self, query: str, max_results: int = 20) -> List[SearchResult]:
        """Search for objects matching the query.

        Args:
            query: Search query string
            max_results: Maximum results to return

        Returns:
            List of SearchResult objects
        """
        results = []

        # Search planets (fast)
        for planet_name in search_planets(query):
            result = self._create_planet_result(planet_name)
            results.append(result)

        # Search dwarf planets (fast)
        for dp in search_dwarf_planets(query, self.dwarf_planets):
            result = self._create_minor_planet_result(dp)
            results.append(result)

        # Search asteroids (fast)
        for ast in search_asteroids(query, self.asteroids):
            result = self._create_minor_planet_result(ast)
            results.append(result)

        # Search DSOs
        for dso in search_dsos(query, self.catalog):
            result = self._create_dso_result(dso)
            results.append(result)
            if len(results) >= max_results:
                break

        # Search comets
        for comet in search_comets(query, self.comets):
            result = self._create_comet_result(comet)
            results.append(result)
            if len(results) >= max_results:
                break

        # Sort by visibility status
        status_order = {
            "visible_tonight": 0,
            "visible_soon": 1,
            "visible_later": 2,
            "below_horizon": 3,
            "never_visible": 4,
        }
        results.sort(key=lambda r: status_order.get(r.visibility_status, 5))

        return results[:max_results]

    def _create_dso_result(self, dso: CelestialObject) -> SearchResult:
        """Create a search result for a DSO."""
        can_be_visible, max_alt, reason = can_object_ever_be_visible(
            dso.dec_degrees, self.latitude
        )

        # Check if object can ever reach optimal altitude (45°+)
        can_optimal, optimal_note = can_object_reach_optimal(
            dso.dec_degrees, self.latitude
        )

        if not can_be_visible:
            return SearchResult(
                object_name=dso.name,
                display_name=dso.common_name or dso.name,
                object_type="dso",
                ra_hours=dso.ra_hours,
                dec_degrees=dso.dec_degrees,
                magnitude=dso.magnitude,
                visibility_status="never_visible",
                visible_tonight=False,
                next_visible_date=None,
                visibility=None,
                never_visible=True,
                never_visible_reason=reason,
                max_possible_altitude=max_alt,
                is_moving_object=False,
                constellation=dso.constellation,
                object_subtype=dso.dso_subtype,
                angular_size_arcmin=dso.angular_size_arcmin,
                can_reach_optimal=can_optimal,
                optimal_altitude_note=optimal_note,
            )

        # DSOs have fixed coordinates
        def get_ra_dec(_: datetime) -> tuple[float, float]:
            return (dso.ra_hours, dso.dec_degrees)

        # Check tonight
        is_visible, visibility = check_visibility_for_night(
            dso.ra_hours, dso.dec_degrees, self.calculator, self.tonight
        )

        if is_visible and visibility:
            visibility.object_name = dso.common_name or dso.name
            visibility.magnitude = dso.magnitude

            # Check if optimal tonight
            is_optimal_tonight = visibility.max_altitude >= OPTIMAL_ALTITUDE
            next_optimal_date = None

            # If visible but not optimal, find when it will be optimal
            if not is_optimal_tonight and can_optimal:
                next_optimal = find_next_optimal_night(
                    get_ra_dec, self.calculator, self.tonight.date + timedelta(days=1)
                )
                if next_optimal:
                    next_optimal_date = next_optimal[0]

            return SearchResult(
                object_name=dso.name,
                display_name=dso.common_name or dso.name,
                object_type="dso",
                ra_hours=dso.ra_hours,
                dec_degrees=dso.dec_degrees,
                magnitude=dso.magnitude,
                visibility_status="visible_tonight",
                visible_tonight=True,
                next_visible_date=self.tonight.date,
                visibility=visibility,
                never_visible=False,
                never_visible_reason=None,
                max_possible_altitude=max_alt,
                is_moving_object=False,
                constellation=dso.constellation,
                object_subtype=dso.dso_subtype,
                angular_size_arcmin=dso.angular_size_arcmin,
                azimuth_at_peak=visibility.azimuth_at_peak,
                can_reach_optimal=can_optimal,
                optimal_altitude_note=optimal_note,
                next_optimal_date=next_optimal_date,
            )

        # Find next visible night
        next_visible = find_next_visible_night(
            get_ra_dec, self.calculator, self.tonight.date
        )

        if next_visible:
            date, night_info, vis = next_visible
            vis.object_name = dso.common_name or dso.name
            vis.magnitude = dso.magnitude
            days_until = (date - self.tonight.date).days
            status = "visible_soon" if days_until <= 30 else "visible_later"

            # Check if optimal on that night, or find when
            is_optimal_that_night = vis.max_altitude >= OPTIMAL_ALTITUDE
            next_optimal_date = None

            if not is_optimal_that_night and can_optimal:
                next_optimal = find_next_optimal_night(
                    get_ra_dec, self.calculator, date + timedelta(days=1)
                )
                if next_optimal:
                    next_optimal_date = next_optimal[0]
            elif is_optimal_that_night:
                next_optimal_date = date

            return SearchResult(
                object_name=dso.name,
                display_name=dso.common_name or dso.name,
                object_type="dso",
                ra_hours=dso.ra_hours,
                dec_degrees=dso.dec_degrees,
                magnitude=dso.magnitude,
                visibility_status=status,
                visible_tonight=False,
                next_visible_date=date,
                visibility=vis,
                never_visible=False,
                never_visible_reason=None,
                max_possible_altitude=max_alt,
                is_moving_object=False,
                constellation=dso.constellation,
                object_subtype=dso.dso_subtype,
                angular_size_arcmin=dso.angular_size_arcmin,
                azimuth_at_peak=vis.azimuth_at_peak,
                can_reach_optimal=can_optimal,
                optimal_altitude_note=optimal_note,
                next_optimal_date=next_optimal_date,
            )

        return SearchResult(
            object_name=dso.name,
            display_name=dso.common_name or dso.name,
            object_type="dso",
            ra_hours=dso.ra_hours,
            dec_degrees=dso.dec_degrees,
            magnitude=dso.magnitude,
            visibility_status="below_horizon",
            visible_tonight=False,
            next_visible_date=None,
            visibility=None,
            never_visible=False,
            never_visible_reason="Object not visible at night within the next year",
            max_possible_altitude=max_alt,
            is_moving_object=False,
            constellation=dso.constellation,
            object_subtype=dso.dso_subtype,
            angular_size_arcmin=dso.angular_size_arcmin,
            can_reach_optimal=can_optimal,
            optimal_altitude_note=optimal_note,
        )

    def _create_planet_result(self, planet_name: str) -> SearchResult:
        """Create a search result for a planet."""
        planet_obj = self.planets[planet_name]

        # Get current position
        now = datetime.now()
        t = self.calculator.ts.utc(now.year, now.month, now.day, now.hour)
        astrometric = self.calculator.earth.at(t).observe(planet_obj)
        ra, dec, _ = astrometric.radec()
        ra_hours = ra.hours
        dec_degrees = dec.degrees

        can_be_visible, max_alt, reason = can_object_ever_be_visible(
            dec_degrees, self.latitude
        )

        # For planets (moving objects), optimal viewing varies throughout the year
        # Check current declination for optimal capability
        can_optimal, optimal_note = can_object_reach_optimal(dec_degrees, self.latitude)

        # Check tonight
        visibility = self.calculator.calculate_object_visibility(
            planet_obj, planet_name, "planet", self.tonight
        )

        # Planet subtype
        planet_subtype = "inner" if planet_name in ("Mercury", "Venus") else "outer"

        # Position function for finding next optimal night
        def get_planet_pos(date: datetime) -> tuple[float, float]:
            t = self.calculator.ts.utc(date.year, date.month, date.day)
            astrometric = self.calculator.earth.at(t).observe(planet_obj)
            ra, dec, _ = astrometric.radec()
            return ra.hours, dec.degrees

        if visibility.is_visible and visibility.max_altitude >= MIN_ALTITUDE:
            is_optimal_tonight = visibility.max_altitude >= OPTIMAL_ALTITUDE
            next_optimal_date = None

            # If visible but not optimal, find when it will be optimal
            if not is_optimal_tonight:
                next_optimal = find_next_optimal_night(
                    get_planet_pos,
                    self.calculator,
                    self.tonight.date + timedelta(days=1),
                )
                if next_optimal:
                    next_optimal_date = next_optimal[0]
                else:
                    # Planet may never reach optimal from this location
                    optimal_note = f"Best tonight: {visibility.max_altitude:.0f}° (optimal is {OPTIMAL_ALTITUDE}°+)"

            return SearchResult(
                object_name=planet_name,
                display_name=planet_name,
                object_type="planet",
                ra_hours=ra_hours,
                dec_degrees=dec_degrees,
                magnitude=visibility.magnitude,
                visibility_status="visible_tonight",
                visible_tonight=True,
                next_visible_date=self.tonight.date,
                visibility=visibility,
                never_visible=False,
                never_visible_reason=None,
                max_possible_altitude=max_alt,
                is_moving_object=True,
                object_subtype=planet_subtype,
                azimuth_at_peak=visibility.azimuth_at_peak,
                can_reach_optimal=is_optimal_tonight or next_optimal_date is not None,
                optimal_altitude_note=optimal_note,
                next_optimal_date=next_optimal_date,
            )

        # Find next visible night
        next_visible = find_next_visible_night(
            get_planet_pos, self.calculator, self.tonight.date
        )

        if next_visible:
            date, night_info, vis = next_visible
            vis.object_name = planet_name
            days_until = (date - self.tonight.date).days
            status = "visible_soon" if days_until <= 30 else "visible_later"

            # Check if optimal on that night
            is_optimal_that_night = vis.max_altitude >= OPTIMAL_ALTITUDE
            next_optimal_date = date if is_optimal_that_night else None

            if not is_optimal_that_night:
                next_optimal = find_next_optimal_night(
                    get_planet_pos, self.calculator, date + timedelta(days=1)
                )
                if next_optimal:
                    next_optimal_date = next_optimal[0]

            return SearchResult(
                object_name=planet_name,
                display_name=planet_name,
                object_type="planet",
                ra_hours=ra_hours,
                dec_degrees=dec_degrees,
                magnitude=None,
                visibility_status=status,
                visible_tonight=False,
                next_visible_date=date,
                visibility=vis,
                never_visible=False,
                never_visible_reason=None,
                max_possible_altitude=max_alt,
                is_moving_object=True,
                object_subtype=planet_subtype,
                azimuth_at_peak=vis.azimuth_at_peak,
                can_reach_optimal=next_optimal_date is not None,
                optimal_altitude_note=optimal_note,
                next_optimal_date=next_optimal_date,
            )

        return SearchResult(
            object_name=planet_name,
            display_name=planet_name,
            object_type="planet",
            ra_hours=ra_hours,
            dec_degrees=dec_degrees,
            magnitude=None,
            visibility_status="below_horizon",
            visible_tonight=False,
            next_visible_date=None,
            visibility=None,
            never_visible=False,
            never_visible_reason="Planet not visible at night within the next year",
            max_possible_altitude=max_alt,
            is_moving_object=True,
            object_subtype=planet_subtype,
            can_reach_optimal=False,
            optimal_altitude_note="Not visible within search period",
        )

    def _create_comet_result(self, comet: Comet) -> SearchResult:
        """Create a search result for a comet."""
        display_name = f"{comet.name} ({comet.designation})"

        try:
            comet_obj = self.calculator.create_comet(comet.row)

            # Get current position
            now = datetime.now()
            t = self.calculator.ts.utc(now.year, now.month, now.day)
            astrometric = self.calculator.earth.at(t).observe(comet_obj)
            ra, dec, dist = astrometric.radec()
            ra_hours = ra.hours
            dec_degrees = dec.degrees

            # Calculate apparent magnitude
            delta = dist.au
            sun_astrometric = self.calculator.sun.at(t).observe(comet_obj)
            _, _, sun_dist = sun_astrometric.radec()
            r = sun_dist.au
            apparent_mag = (
                comet.magnitude_g + 5 * math.log10(delta) + 10 * math.log10(r)
            )

            can_be_visible, max_alt, reason = can_object_ever_be_visible(
                dec_degrees, self.latitude
            )

            # Check optimal altitude capability
            can_optimal, optimal_note = can_object_reach_optimal(
                dec_degrees, self.latitude
            )

            comet_subtype = "interstellar" if comet.is_interstellar else "comet"

            # Position function for finding next optimal night
            def get_comet_pos(date: datetime) -> Optional[tuple[float, float]]:
                try:
                    t = self.calculator.ts.utc(date.year, date.month, date.day)
                    astrometric = self.calculator.earth.at(t).observe(comet_obj)
                    ra, dec, _ = astrometric.radec()
                    return ra.hours, dec.degrees
                except Exception:
                    return None

            if not can_be_visible:
                return SearchResult(
                    object_name=comet.designation,
                    display_name=display_name,
                    object_type="comet",
                    ra_hours=ra_hours,
                    dec_degrees=dec_degrees,
                    magnitude=apparent_mag,
                    visibility_status="never_visible",
                    visible_tonight=False,
                    next_visible_date=None,
                    visibility=None,
                    never_visible=True,
                    never_visible_reason=reason,
                    max_possible_altitude=max_alt,
                    is_moving_object=True,
                    object_subtype=comet_subtype,
                    can_reach_optimal=can_optimal,
                    optimal_altitude_note=optimal_note,
                )

            # Check tonight - use fine sampling (10min) for accurate peak detection
            visibility = self.calculator.calculate_object_visibility(
                comet_obj, display_name, "comet", self.tonight
            )
            visibility.magnitude = apparent_mag
            visibility.is_interstellar = comet.is_interstellar

            if visibility.is_visible and visibility.max_altitude >= MIN_ALTITUDE:
                is_optimal_tonight = visibility.max_altitude >= OPTIMAL_ALTITUDE
                next_optimal_date = None

                if not is_optimal_tonight:
                    next_optimal = find_next_optimal_night(
                        get_comet_pos,
                        self.calculator,
                        self.tonight.date + timedelta(days=1),
                    )
                    if next_optimal:
                        next_optimal_date = next_optimal[0]
                    elif not can_optimal:
                        optimal_note = f"Best tonight: {visibility.max_altitude:.0f}° (optimal is {OPTIMAL_ALTITUDE}°+)"

                return SearchResult(
                    object_name=comet.designation,
                    display_name=display_name,
                    object_type="comet",
                    ra_hours=ra_hours,
                    dec_degrees=dec_degrees,
                    magnitude=apparent_mag,
                    visibility_status="visible_tonight",
                    visible_tonight=True,
                    next_visible_date=self.tonight.date,
                    visibility=visibility,
                    never_visible=False,
                    never_visible_reason=None,
                    max_possible_altitude=max_alt,
                    is_moving_object=True,
                    object_subtype=comet_subtype,
                    azimuth_at_peak=visibility.azimuth_at_peak,
                    can_reach_optimal=is_optimal_tonight
                    or next_optimal_date is not None,
                    optimal_altitude_note=optimal_note,
                    next_optimal_date=next_optimal_date,
                )

            # Find next visible night
            next_visible = find_next_visible_night(
                get_comet_pos, self.calculator, self.tonight.date
            )

            if next_visible:
                date, night_info, vis = next_visible
                vis.object_name = display_name
                vis.magnitude = apparent_mag
                days_until = (date - self.tonight.date).days
                status = "visible_soon" if days_until <= 30 else "visible_later"

                is_optimal_that_night = vis.max_altitude >= OPTIMAL_ALTITUDE
                next_optimal_date = date if is_optimal_that_night else None

                if not is_optimal_that_night:
                    next_optimal = find_next_optimal_night(
                        get_comet_pos, self.calculator, date + timedelta(days=1)
                    )
                    if next_optimal:
                        next_optimal_date = next_optimal[0]

                return SearchResult(
                    object_name=comet.designation,
                    display_name=display_name,
                    object_type="comet",
                    ra_hours=ra_hours,
                    dec_degrees=dec_degrees,
                    magnitude=apparent_mag,
                    visibility_status=status,
                    visible_tonight=False,
                    next_visible_date=date,
                    visibility=vis,
                    never_visible=False,
                    never_visible_reason=None,
                    max_possible_altitude=max_alt,
                    is_moving_object=True,
                    object_subtype=comet_subtype,
                    azimuth_at_peak=vis.azimuth_at_peak,
                    can_reach_optimal=next_optimal_date is not None,
                    optimal_altitude_note=optimal_note,
                    next_optimal_date=next_optimal_date,
                )

            return SearchResult(
                object_name=comet.designation,
                display_name=display_name,
                object_type="comet",
                ra_hours=ra_hours,
                dec_degrees=dec_degrees,
                magnitude=apparent_mag,
                visibility_status="below_horizon",
                visible_tonight=False,
                next_visible_date=None,
                visibility=None,
                never_visible=False,
                never_visible_reason="Comet not visible at night within the next year",
                max_possible_altitude=max_alt,
                is_moving_object=True,
                object_subtype=comet_subtype,
                can_reach_optimal=False,
                optimal_altitude_note="Not visible within search period",
            )

        except Exception as e:
            logger.debug("Error processing comet %s: %s", comet.designation, e)
            return SearchResult(
                object_name=comet.designation,
                display_name=display_name,
                object_type="comet",
                ra_hours=0,
                dec_degrees=0,
                magnitude=None,
                visibility_status="never_visible",
                visible_tonight=False,
                next_visible_date=None,
                visibility=None,
                never_visible=True,
                never_visible_reason="Unable to calculate comet position",
                max_possible_altitude=0,
                is_moving_object=True,
                can_reach_optimal=False,
                optimal_altitude_note="Unable to calculate",
            )

    def _create_minor_planet_result(self, mp: MinorPlanet) -> SearchResult:
        """Create a search result for a dwarf planet or asteroid."""
        obj_type = mp.category

        try:
            if mp.row is None:
                return SearchResult(
                    object_name=mp.name,
                    display_name=mp.name,
                    object_type=obj_type,
                    ra_hours=0,
                    dec_degrees=0,
                    magnitude=mp.magnitude_h,
                    visibility_status="never_visible",
                    visible_tonight=False,
                    next_visible_date=None,
                    visibility=None,
                    never_visible=True,
                    never_visible_reason="No orbital data available",
                    max_possible_altitude=0,
                    is_moving_object=True,
                    object_subtype=obj_type,
                    can_reach_optimal=False,
                    optimal_altitude_note="No orbital data",
                )

            # Create skyfield object
            if getattr(mp, "skyfield_obj", None) is None:
                from skyfield.constants import GM_SUN_Pitjeva_2005_km3_s2 as GM_SUN
                from skyfield.data import mpc

                mp.skyfield_obj = self.calculator.sun + mpc.mpcorb_orbit(
                    mp.row, self.calculator.ts, GM_SUN
                )

            mp_obj = mp.skyfield_obj

            # Get current position
            now = datetime.now()
            t = self.calculator.ts.utc(now.year, now.month, now.day)
            astrometric = self.calculator.earth.at(t).observe(mp_obj)
            ra, dec, _ = astrometric.radec()
            ra_hours = ra.hours
            dec_degrees = dec.degrees

            can_be_visible, max_alt, reason = can_object_ever_be_visible(
                dec_degrees, self.latitude
            )

            # Check optimal altitude capability
            can_optimal, optimal_note = can_object_reach_optimal(
                dec_degrees, self.latitude
            )

            # Position function for finding optimal night
            def get_mp_pos(date: datetime) -> Optional[tuple[float, float]]:
                try:
                    t = self.calculator.ts.utc(date.year, date.month, date.day)
                    astrometric = self.calculator.earth.at(t).observe(mp_obj)
                    ra, dec, _ = astrometric.radec()
                    return ra.hours, dec.degrees
                except Exception:
                    return None

            if not can_be_visible:
                return SearchResult(
                    object_name=mp.name,
                    display_name=mp.name,
                    object_type=obj_type,
                    ra_hours=ra_hours,
                    dec_degrees=dec_degrees,
                    magnitude=mp.magnitude_h,
                    visibility_status="never_visible",
                    visible_tonight=False,
                    next_visible_date=None,
                    visibility=None,
                    never_visible=True,
                    never_visible_reason=reason,
                    max_possible_altitude=max_alt,
                    is_moving_object=True,
                    object_subtype=obj_type,
                    can_reach_optimal=can_optimal,
                    optimal_altitude_note=optimal_note,
                )

            # Check tonight - use fine sampling (10min) for accurate peak detection
            visibility = self.calculator.calculate_object_visibility(
                mp_obj, mp.name, obj_type, self.tonight
            )
            visibility.magnitude = mp.magnitude_h

            if visibility.is_visible and visibility.max_altitude >= MIN_ALTITUDE:
                is_optimal_tonight = visibility.max_altitude >= OPTIMAL_ALTITUDE
                next_optimal_date = None

                if not is_optimal_tonight:
                    next_optimal = find_next_optimal_night(
                        get_mp_pos,
                        self.calculator,
                        self.tonight.date + timedelta(days=1),
                    )
                    if next_optimal:
                        next_optimal_date = next_optimal[0]
                    elif not can_optimal:
                        optimal_note = f"Best tonight: {visibility.max_altitude:.0f}° (optimal is {OPTIMAL_ALTITUDE}°+)"

                return SearchResult(
                    object_name=mp.name,
                    display_name=mp.name,
                    object_type=obj_type,
                    ra_hours=ra_hours,
                    dec_degrees=dec_degrees,
                    magnitude=mp.magnitude_h,
                    visibility_status="visible_tonight",
                    visible_tonight=True,
                    next_visible_date=self.tonight.date,
                    visibility=visibility,
                    never_visible=False,
                    never_visible_reason=None,
                    max_possible_altitude=max_alt,
                    is_moving_object=True,
                    object_subtype=obj_type,
                    azimuth_at_peak=visibility.azimuth_at_peak,
                    can_reach_optimal=is_optimal_tonight
                    or next_optimal_date is not None,
                    optimal_altitude_note=optimal_note,
                    next_optimal_date=next_optimal_date,
                )

            # Find next visible night
            next_visible = find_next_visible_night(
                get_mp_pos, self.calculator, self.tonight.date
            )

            if next_visible:
                date, night_info, vis = next_visible
                vis.object_name = mp.name
                vis.magnitude = mp.magnitude_h
                days_until = (date - self.tonight.date).days
                status = "visible_soon" if days_until <= 30 else "visible_later"

                is_optimal_that_night = vis.max_altitude >= OPTIMAL_ALTITUDE
                next_optimal_date = date if is_optimal_that_night else None

                if not is_optimal_that_night:
                    next_optimal = find_next_optimal_night(
                        get_mp_pos, self.calculator, date + timedelta(days=1)
                    )
                    if next_optimal:
                        next_optimal_date = next_optimal[0]

                return SearchResult(
                    object_name=mp.name,
                    display_name=mp.name,
                    object_type=obj_type,
                    ra_hours=ra_hours,
                    dec_degrees=dec_degrees,
                    magnitude=mp.magnitude_h,
                    visibility_status=status,
                    visible_tonight=False,
                    next_visible_date=date,
                    visibility=vis,
                    never_visible=False,
                    never_visible_reason=None,
                    max_possible_altitude=max_alt,
                    is_moving_object=True,
                    object_subtype=obj_type,
                    azimuth_at_peak=vis.azimuth_at_peak,
                    can_reach_optimal=next_optimal_date is not None,
                    optimal_altitude_note=optimal_note,
                    next_optimal_date=next_optimal_date,
                )

            return SearchResult(
                object_name=mp.name,
                display_name=mp.name,
                object_type=obj_type,
                ra_hours=ra_hours,
                dec_degrees=dec_degrees,
                magnitude=mp.magnitude_h,
                visibility_status="below_horizon",
                visible_tonight=False,
                next_visible_date=None,
                visibility=None,
                never_visible=False,
                never_visible_reason="Object not visible at night within the next year",
                max_possible_altitude=max_alt,
                is_moving_object=True,
                object_subtype=obj_type,
                can_reach_optimal=False,
                optimal_altitude_note="Not visible within search period",
            )

        except Exception as e:
            logger.debug("Error processing %s %s: %s", obj_type, mp.name, e)
            return SearchResult(
                object_name=mp.name,
                display_name=mp.name,
                object_type=obj_type,
                ra_hours=0,
                dec_degrees=0,
                magnitude=mp.magnitude_h,
                visibility_status="never_visible",
                visible_tonight=False,
                next_visible_date=None,
                visibility=None,
                never_visible=True,
                never_visible_reason="Unable to calculate position",
                max_possible_altitude=0,
                is_moving_object=True,
                object_subtype=obj_type,
                can_reach_optimal=False,
                optimal_altitude_note="Unable to calculate",
            )


def _azimuth_to_cardinal(azimuth: float) -> str:
    """Convert azimuth degrees to cardinal direction."""
    azimuth = azimuth % 360
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    index = int((azimuth + 22.5) / 45) % 8
    return directions[index]


def _format_subtype(subtype: Optional[str]) -> str:
    """Format object subtype for display."""
    if not subtype:
        return ""
    # Convert snake_case to Title Case
    return subtype.replace("_", " ").title()


def format_search_results(
    results: List[SearchResult],
    tz_converter,
    console: Console,
) -> None:
    """Format and display search results.

    Args:
        results: List of SearchResult objects
        tz_converter: TimezoneConverter instance
        console: Rich Console instance
    """
    if not results:
        console.print("[yellow]No objects found matching your search.[/yellow]")
        return

    console.print()

    for result in results:
        # Status color and icon
        status_config = {
            "visible_tonight": ("green", "Visible Tonight", "eye"),
            "visible_soon": ("cyan", "Visible Soon", "calendar"),
            "visible_later": ("yellow", "Visible Later", "clock"),
            "below_horizon": ("yellow", "Below Horizon", "alert-circle"),
            "never_visible": ("red", "Never Visible", "x-circle"),
        }
        color, status_text, _ = status_config.get(
            result.visibility_status, ("white", "Unknown", "question")
        )

        # Object type
        type_names = {
            "planet": "Planet",
            "dso": "DSO",
            "comet": "Comet",
            "dwarf_planet": "Dwarf Planet",
            "asteroid": "Asteroid",
        }
        type_name = type_names.get(result.object_type, result.object_type)

        # Header
        title = f"[bold white]{result.display_name}[/bold white]"
        if result.object_name != result.display_name:
            title += f" [dim]({result.object_name})[/dim]"

        console.print(f"\n{title}")

        # Type with subtype
        type_info = type_name
        if result.object_subtype:
            subtype_display = _format_subtype(result.object_subtype)
            if subtype_display and subtype_display.lower() != type_name.lower():
                type_info = f"{type_name} ({subtype_display})"
        console.print(f"  [dim]{type_info}[/dim]  |  [{color}]{status_text}[/{color}]")

        # Magnitude and size
        info_parts = []
        if result.magnitude is not None:
            info_parts.append(f"Mag {result.magnitude:.1f}")
        if result.angular_size_arcmin is not None and result.angular_size_arcmin > 0:
            if result.angular_size_arcmin >= 60:
                info_parts.append(f"Size {result.angular_size_arcmin / 60:.1f}°")
            else:
                info_parts.append(f"Size {result.angular_size_arcmin:.1f}'")
        if result.constellation:
            info_parts.append(f"in {result.constellation}")
        if info_parts:
            console.print(f"  {' | '.join(info_parts)}")

        # Coordinates
        console.print(
            f"  RA: {result.ra_hours:.2f}h  |  Dec: {result.dec_degrees:+.1f}"
        )

        # Max possible altitude
        if result.max_possible_altitude > 0:
            console.print(
                f"  Max possible altitude: {result.max_possible_altitude:.1f}"
            )

        # Visibility details
        if result.visible_tonight and result.visibility:
            vis = result.visibility
            console.print()
            console.print("  [green]Visible tonight![/green]")

            # Peak altitude with direction
            peak_info = f"    Peak altitude: {vis.max_altitude:.0f}°"
            if result.azimuth_at_peak is not None:
                direction = _azimuth_to_cardinal(result.azimuth_at_peak)
                peak_info += f" (looking {direction})"
            console.print(peak_info)

            if vis.max_altitude_time:
                local_time = tz_converter.to_local(vis.max_altitude_time)
                console.print(f"    Peak time: {local_time.strftime('%H:%M')}")

            if vis.above_45_start and vis.above_45_end:
                start = tz_converter.to_local(vis.above_45_start)
                end = tz_converter.to_local(vis.above_45_end)
                console.print(
                    f"    Good observing (>45°): {start.strftime('%H:%M')} - {end.strftime('%H:%M')}"
                )
            elif not result.can_reach_optimal and result.optimal_altitude_note:
                # Object visible but can never reach optimal altitude from this location
                console.print(f"    [yellow]{result.optimal_altitude_note}[/yellow]")
            elif result.next_optimal_date and vis.max_altitude < 45:
                # Object visible tonight but not optimal - show when optimal viewing is available
                days_until_optimal = (result.next_optimal_date - datetime.now()).days
                opt_date_str = result.next_optimal_date.strftime("%b %d")
                if days_until_optimal <= 7:
                    console.print(
                        f"    [cyan]Optimal viewing (45°+): {opt_date_str} (in {days_until_optimal} days)[/cyan]"
                    )
                elif days_until_optimal <= 30:
                    console.print(
                        f"    [cyan]Optimal viewing (45°+): {opt_date_str} (in ~{days_until_optimal // 7} weeks)[/cyan]"
                    )
                else:
                    console.print(
                        f"    [cyan]Optimal viewing (45°+): {opt_date_str}[/cyan]"
                    )

            if vis.moon_separation is not None:
                moon_dist = vis.moon_separation
                warning = " (moon interference)" if vis.moon_warning else ""
                console.print(f"    Moon distance: {moon_dist:.0f}°{warning}")

        elif result.next_visible_date and not result.never_visible:
            days_until = (result.next_visible_date - datetime.now()).days
            date_str = result.next_visible_date.strftime("%b %d, %Y")

            if days_until == 1:
                time_str = "tomorrow"
            elif days_until < 7:
                time_str = f"in {days_until} days"
            elif days_until < 30:
                time_str = f"in {days_until // 7} week(s)"
            elif days_until < 365:
                time_str = f"in {days_until // 30} month(s)"
            else:
                time_str = f"in {days_until // 365} year(s)"

            console.print()
            console.print(f"  [cyan]Next visible: {date_str} ({time_str})[/cyan]")

            if result.visibility:
                peak_info = f"    Peak altitude: {result.visibility.max_altitude:.0f}°"
                if result.azimuth_at_peak is not None:
                    direction = _azimuth_to_cardinal(result.azimuth_at_peak)
                    peak_info += f" (looking {direction})"
                console.print(peak_info)

                # Show optimal viewing info
                if not result.can_reach_optimal and result.optimal_altitude_note:
                    console.print(
                        f"    [yellow]{result.optimal_altitude_note}[/yellow]"
                    )
                elif result.next_optimal_date and result.visibility.max_altitude < 45:
                    if result.next_optimal_date != result.next_visible_date:
                        opt_date_str = result.next_optimal_date.strftime("%b %d")
                        console.print(
                            f"    [cyan]Optimal viewing (45°+): {opt_date_str}[/cyan]"
                        )

        elif result.never_visible and result.never_visible_reason:
            console.print()
            console.print(f"  [red]{result.never_visible_reason}[/red]")

        if result.is_moving_object:
            console.print("  [dim italic]Position changes over time[/dim italic]")

        console.print(Rule(style="dim"))
