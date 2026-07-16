"""Astronomical calculations using Skyfield."""

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from skyfield import almanac
from skyfield.api import Loader, wgs84
from skyfield.constants import GM_SUN_Pitjeva_2005_km3_s2 as GM_SUN
from skyfield.data import mpc
from timezonefinder import TimezoneFinder
from zoneinfo import ZoneInfo


# Planet apparent diameter ranges (arcseconds)
# Min = at superior conjunction (far from Earth), Max = at opposition/inferior conjunction
PLANET_APPARENT_DIAMETERS = {
    # Inner planets: closest at inferior conjunction
    "Mercury": {"min": 4.5, "max": 13.0, "type": "inner"},
    "Venus": {"min": 9.7, "max": 66.0, "type": "inner"},
    # Outer planets: closest at opposition
    "Mars": {"min": 3.5, "max": 25.1, "type": "outer"},
    "Jupiter": {"min": 29.8, "max": 50.1, "type": "outer"},
    "Saturn": {"min": 14.5, "max": 20.1, "type": "outer"},  # Disk only, not rings
    "Uranus": {"min": 3.3, "max": 4.1, "type": "outer"},
    "Neptune": {"min": 2.2, "max": 2.4, "type": "outer"},
}

# Dwarf planet and asteroid physical diameters (km)
SMALL_BODY_DIAMETERS = {
    "Pluto": 2376,
    "Ceres": 939,
    "Eris": 2326,
    "Makemake": 1430,
    "Haumea": 1632,
    "Vesta": 525,
    "Pallas": 512,
    "Juno": 233,
    "Hygiea": 434,
}


def calculate_planet_apparent_diameter(distance_au: float, planet_name: str) -> float:
    """Calculate apparent diameter of a planet given its distance.

    Uses the formula: apparent_diameter = physical_diameter / distance
    where physical_diameter is in km and distance is in AU.

    Args:
        distance_au: Distance from Earth in AU
        planet_name: Name of the planet

    Returns:
        Apparent diameter in arcseconds
    """
    # Physical diameters in km
    physical_diameters = {
        "Mercury": 4879,
        "Venus": 12104,
        "Mars": 6779,
        "Jupiter": 139820,
        "Saturn": 116460,
        "Uranus": 50724,
        "Neptune": 49244,
    }

    if planet_name not in physical_diameters:
        return 0.0

    diameter_km = physical_diameters[planet_name]
    # 1 AU = 149,597,870.7 km
    # Angular diameter in radians = physical_diameter / distance
    # Convert to arcseconds: radians * 206265
    distance_km = distance_au * 149597870.7
    angular_diameter_rad = diameter_km / distance_km
    return angular_diameter_rad * 206265


def calculate_small_body_apparent_diameter(distance_au: float, body_name: str) -> float:
    """Calculate apparent diameter of a dwarf planet or asteroid.

    Args:
        distance_au: Distance from Earth in AU
        body_name: Name of the body

    Returns:
        Apparent diameter in arcseconds, or 0.0 if unknown
    """
    if body_name not in SMALL_BODY_DIAMETERS:
        return 0.0

    diameter_km = SMALL_BODY_DIAMETERS[body_name]
    distance_km = distance_au * 149597870.7
    angular_diameter_rad = diameter_km / distance_km
    return angular_diameter_rad * 206265


def calculate_hg_magnitude(
    absolute_magnitude: float,
    slope_parameter: float,
    heliocentric_distance_au: float,
    observer_distance_au: float,
    phase_angle_degrees: float,
) -> float:
    """Calculate an asteroid's apparent V magnitude with the IAU H-G model.

    The model is intended for inactive minor planets. Distances must be the
    simultaneous heliocentric and observer-centric distances in AU, and the
    phase angle is measured at the minor planet.
    """
    if heliocentric_distance_au <= 0 or observer_distance_au <= 0:
        raise ValueError("Minor-planet distances must be positive")

    phase_radians = math.radians(max(0.0, min(180.0, phase_angle_degrees)))
    tan_half_phase = math.tan(phase_radians / 2.0)
    phi1 = math.exp(-3.33 * (tan_half_phase**0.63))
    phi2 = math.exp(-1.87 * (tan_half_phase**1.22))
    phase_function = (1.0 - slope_parameter) * phi1 + slope_parameter * phi2
    phase_function = max(phase_function, 1e-12)

    return (
        absolute_magnitude
        + 5.0 * math.log10(heliocentric_distance_au * observer_distance_au)
        - 2.5 * math.log10(phase_function)
    )


def calculate_airmass(altitude_degrees: float) -> float:
    """Calculate airmass using Pickering (2002) formula.

    Airmass is the relative amount of atmosphere light must pass through.
    At zenith (90°), airmass = 1.0. At horizon (0°), airmass → infinity.

    Args:
        altitude_degrees: Altitude in degrees (0-90)

    Returns:
        Airmass value (1.0 at zenith, higher at lower altitudes)
    """
    if altitude_degrees <= 0:
        return 99.0  # Effectively infinite

    # Pickering (2002) formula - more accurate than simple 1/sin(alt)
    # Valid down to horizon
    h = altitude_degrees
    # Formula: 1 / sin(h + 244/(165 + 47*h^1.1))
    denominator = h + 244.0 / (165.0 + 47.0 * (h**1.1))
    sin_val = math.sin(math.radians(denominator))

    if sin_val <= 0:
        return 99.0

    return 1.0 / sin_val


@dataclass
class NightInfo:
    """Information about a single night."""

    date: datetime
    sunset: datetime
    sunrise: datetime
    astronomical_dusk: datetime
    astronomical_dawn: datetime
    sunset_occurs: bool
    sunrise_occurs: bool
    astronomical_night_mode: str  # normal, continuous, or none
    moon_phase: float  # 0-1, where 0=new, 0.5=full
    moon_illumination: float  # 0-100%
    moon_rise: Optional[datetime]
    moon_set: Optional[datetime]


@dataclass
class ObjectVisibility:
    """Visibility information for a celestial object."""

    object_name: str
    object_type: str  # planet, dso, comet, dwarf_planet, asteroid, moon, milky_way
    is_visible: bool
    max_altitude: float
    max_altitude_time: Optional[
        datetime
    ]  # Also serves as transit time (meridian crossing)
    above_45_start: Optional[datetime]
    above_45_end: Optional[datetime]
    above_60_start: Optional[datetime]
    above_60_end: Optional[datetime]
    above_75_start: Optional[datetime]
    above_75_end: Optional[datetime]
    moon_separation: Optional[float]  # degrees
    moon_warning: bool  # True if moon interferes
    magnitude: Optional[float] = None  # Visual magnitude if known
    is_interstellar: bool = False  # True for interstellar objects (e.g., 2I/Borisov)
    # Time-altitude samples for window-specific queries (sparse: every 30 min)
    altitude_samples: Optional[list] = None  # List of (datetime, altitude) tuples
    # DSO-specific fields for scoring
    subtype: str = ""  # DSO subtype: galaxy, nebula, open_cluster, etc.
    angular_size_arcmin: float = 1.0  # Angular size for surface brightness
    surface_brightness: Optional[float] = None  # mag/arcsec²
    ra_hours: float = 0.0  # Right ascension for seasonal scoring
    common_name: str = ""  # Common name for novelty scoring
    # NEW: Airmass and azimuth for better observation planning
    min_airmass: float = (
        99.0  # Minimum airmass during night (lower = better, 1.0 = zenith)
    )
    azimuth_at_peak: float = 0.0  # Compass direction at peak altitude (0-360°)
    # NEW: Planet-specific fields
    apparent_diameter_arcsec: Optional[float] = None  # Current apparent size
    apparent_diameter_min: Optional[float] = None  # Minimum size throughout year
    apparent_diameter_max: Optional[float] = None  # Maximum size throughout year
    # NEW: Position angle for DSOs (orientation on sky)
    position_angle: Optional[float] = None  # 0-180° from OpenNGC


@dataclass
class _MPCOrbitalRow:
    """Typed adapter for Skyfield's attribute-based MPC orbit API."""

    designation: str
    semimajor_axis_au: float
    eccentricity: float
    inclination_degrees: float
    longitude_of_ascending_node_degrees: float
    argument_of_perihelion_degrees: float
    mean_anomaly_degrees: float
    epoch_packed: str


class SkyCalculator:
    """Calculate astronomical events and object positions."""

    def __init__(self, latitude: float, longitude: float):
        """Initialize the calculator.

        Args:
            latitude: Observer latitude in degrees
            longitude: Observer longitude in degrees
        """
        self.latitude = latitude
        self.longitude = longitude
        timezone_name = TimezoneFinder().timezone_at(lat=latitude, lng=longitude)
        self.timezone = ZoneInfo(timezone_name or "UTC")

        # Set up cache directory for ephemeris data (cross-platform)
        from pathlib import Path
        from platformdirs import user_cache_dir

        cache_dir = Path(user_cache_dir("nightseek"))
        cache_dir.mkdir(parents=True, exist_ok=True)

        # Load ephemeris data with caching
        loader = Loader(str(cache_dir))
        self.ts = loader.timescale()
        self.eph = loader("de421.bsp")  # JPL ephemeris

        # Observer location
        self.location = wgs84.latlon(latitude, longitude)

        # Celestial objects
        self.sun = self.eph["sun"]
        self.moon = self.eph["moon"]
        self.earth = self.eph["earth"]

        # Planets
        self.mercury = self.eph["mercury"]
        self.venus = self.eph["venus"]
        self.mars = self.eph["mars"]
        self.jupiter = self.eph["jupiter barycenter"]
        self.saturn = self.eph["saturn barycenter"]
        self.uranus = self.eph["uranus barycenter"]
        self.neptune = self.eph["neptune barycenter"]

    def create_comet(self, comet_row):
        """Create a Skyfield comet object from MPC orbital elements.

        Args:
            comet_row: pandas Series with MPC comet orbital elements

        Returns:
            Skyfield comet object
        """
        return self.sun + mpc.comet_orbit(comet_row, self.ts, GM_SUN)

    @staticmethod
    def _pack_mpc_epoch(epoch_jd: float, ts) -> str:
        """Encode a midnight TT Julian date in MPC's five-character format."""
        year, month, day, _, _, _ = ts.tt_jd(epoch_jd).tt_calendar()

        def packed_digit(value: int) -> str:
            return str(value) if value < 10 else chr(value + 55)

        year = int(year)
        return (
            f"{packed_digit(year // 100)}{year % 100:02d}"
            f"{packed_digit(int(month))}{packed_digit(int(day))}"
        )

    def create_minor_planet(self, minor_planet):
        """Create a Skyfield vector from an MPC row or embedded elements."""
        if minor_planet.name == "Pluto":
            return self.eph["pluto barycenter"]
        if minor_planet.row is not None:
            return self.sun + mpc.mpcorb_orbit(minor_planet.row, self.ts, GM_SUN)
        if minor_planet.semi_major_axis <= 0:
            raise ValueError(f"No orbital elements for {minor_planet.name}")

        row = _MPCOrbitalRow(
            designation=minor_planet.designation,
            semimajor_axis_au=minor_planet.semi_major_axis,
            eccentricity=minor_planet.eccentricity,
            inclination_degrees=minor_planet.inclination,
            longitude_of_ascending_node_degrees=minor_planet.lon_asc_node,
            argument_of_perihelion_degrees=minor_planet.arg_perihelion,
            mean_anomaly_degrees=minor_planet.mean_anomaly,
            epoch_packed=self._pack_mpc_epoch(minor_planet.epoch_jd, self.ts),
        )
        return self.sun + mpc.mpcorb_orbit(row, self.ts, GM_SUN)

    def calculate_minor_planet_magnitude(
        self, minor_planet, minor_planet_object, when: datetime
    ) -> float:
        """Calculate apparent H-G magnitude at the observation time."""
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        t = self.ts.from_datetime(when)
        observer_distance = self.earth.at(t).observe(minor_planet_object).distance().au
        heliocentric_distance = (
            self.sun.at(t).observe(minor_planet_object).distance().au
        )
        earth_sun_distance = self.sun.at(t).observe(self.earth).distance().au
        denominator = 2.0 * heliocentric_distance * observer_distance
        cosine_phase = (
            heliocentric_distance**2 + observer_distance**2 - earth_sun_distance**2
        ) / denominator
        phase_angle = math.degrees(math.acos(max(-1.0, min(1.0, cosine_phase))))
        return calculate_hg_magnitude(
            minor_planet.magnitude_h,
            minor_planet.slope_parameter,
            heliocentric_distance,
            observer_distance,
            phase_angle,
        )

    def get_night_info(self, date: datetime) -> NightInfo:
        """Calculate night information for a given date.

        Args:
            date: The date to calculate for

        Returns:
            NightInfo object with twilight and moon information
        """
        # Search from local noon to local noon so the requested civil night is
        # selected correctly even when the observer is far from the machine's
        # timezone or a daylight-saving transition occurs.
        local_noon = datetime(
            date.year,
            date.month,
            date.day,
            12,
            tzinfo=self.timezone,
        )
        next_local_noon = local_noon + timedelta(days=1)
        t0 = self.ts.from_datetime(local_noon.astimezone(timezone.utc))
        t1 = self.ts.from_datetime(next_local_noon.astimezone(timezone.utc))

        # Calculate sunset/sunrise
        f_sunrise_sunset = almanac.sunrise_sunset(self.eph, self.location)
        times_ss, events_ss = almanac.find_discrete(t0, t1, f_sunrise_sunset)

        sunset = None
        sunrise = None
        for t, e in zip(times_ss, events_ss):
            dt = t.utc_datetime()
            if e == 0:  # Sunset
                sunset = dt
            else:  # Sunrise
                sunrise = dt

        # Calculate astronomical twilight
        f_twilight = almanac.dark_twilight_day(self.eph, self.location)
        times_tw, events_tw = almanac.find_discrete(t0, t1, f_twilight)

        astronomical_dusk = None
        astronomical_dawn = None
        for t, e in zip(times_tw, events_tw):
            dt = t.utc_datetime()
            if e == 0:  # Dark (end of astronomical twilight)
                if astronomical_dusk is None:
                    astronomical_dusk = dt
            elif e == 1:  # Start of astronomical twilight (dark -> astronomical)
                astronomical_dawn = dt

        # Calculate moon phase and illumination at midnight local time
        # Use midpoint between astronomical dusk and dawn for accuracy during observation
        if astronomical_dusk and astronomical_dawn:
            # Handle night spanning midnight
            dusk = astronomical_dusk
            dawn = astronomical_dawn
            if dawn < dusk:
                dawn = dawn + timedelta(days=1)
            midnight = dusk + (dawn - dusk) / 2
            t_mid = self.ts.from_datetime(midnight)
        else:
            # Fallback to local midnight (next day 00:00)
            local_midnight = (local_noon + timedelta(days=1)).replace(
                hour=0,
                minute=0,
                second=0,
                microsecond=0,
            )
            t_mid = self.ts.from_datetime(local_midnight.astimezone(timezone.utc))
        phase = almanac.moon_phase(self.eph, t_mid)
        phase_fraction = phase.degrees / 360.0

        # Illuminated fraction follows the cosine phase law.
        illumination = (1.0 - math.cos(math.radians(phase.degrees))) / 2.0

        # Calculate moon rise/set
        f_moon_riseset = almanac.risings_and_settings(
            self.eph, self.moon, self.location
        )
        times_moon, events_moon = almanac.find_discrete(t0, t1, f_moon_riseset)

        moon_rise = None
        moon_set = None
        for t, e in zip(times_moon, events_moon):
            dt = t.utc_datetime()
            if e == 1:  # Rise
                moon_rise = dt
            else:  # Set
                moon_set = dt

        sunset_occurs = sunset is not None
        sunrise_occurs = sunrise is not None
        if astronomical_dusk is not None and astronomical_dawn is not None:
            astronomical_night_mode = "normal"
        else:
            initial_twilight_state = int(f_twilight(t0))
            astronomical_night_mode = (
                "continuous" if initial_twilight_state == 0 else "none"
            )
            start_boundary = t0.utc_datetime()
            astronomical_dusk = start_boundary
            astronomical_dawn = (
                t1.utc_datetime()
                if astronomical_night_mode == "continuous"
                else start_boundary
            )

        # Preserve chart bounds while occurrence flags prevent fallback values
        # from being presented as actual rise/set events.
        sunset = sunset or t0.utc_datetime()
        sunrise = sunrise or t1.utc_datetime()

        return NightInfo(
            date=date,
            sunset=sunset,
            sunrise=sunrise,
            astronomical_dusk=astronomical_dusk,
            astronomical_dawn=astronomical_dawn,
            sunset_occurs=sunset_occurs,
            sunrise_occurs=sunrise_occurs,
            astronomical_night_mode=astronomical_night_mode,
            moon_phase=phase_fraction,
            moon_illumination=illumination * 100,
            moon_rise=moon_rise,
            moon_set=moon_set,
        )

    def calculate_object_visibility(
        self,
        obj,
        obj_name: str,
        obj_type: str,
        night_info: NightInfo,
        coarse: bool = False,
    ) -> ObjectVisibility:
        """Calculate visibility of an object during a night.

        Args:
            obj: Skyfield object (planet, star, etc.)
            obj_name: Name of the object
            obj_type: Type of object (planet, dso, etc.)
            night_info: Night information
            coarse: If True, use coarser sampling (faster but less precise)

        Returns:
            ObjectVisibility object
        """
        if night_info.astronomical_night_mode == "none":
            return ObjectVisibility(
                object_name=obj_name,
                object_type=obj_type,
                is_visible=False,
                max_altitude=0.0,
                max_altitude_time=None,
                above_45_start=None,
                above_45_end=None,
                above_60_start=None,
                above_60_end=None,
                above_75_start=None,
                above_75_end=None,
                moon_separation=None,
                moon_warning=False,
            )

        start = night_info.astronomical_dusk
        end = night_info.astronomical_dawn
        if end <= start:
            end = end + timedelta(days=1)

        observer = self.earth + self.location
        sample_interval = 60 if coarse else 10  # minutes

        # Build time array for vectorized calculation
        times = []
        current = start
        while current < end:
            times.append(current)
            current += timedelta(minutes=sample_interval)
        times.append(end)

        # Vectorized Skyfield time array
        t_array = self.ts.utc(
            [t.year for t in times],
            [t.month for t in times],
            [t.day for t in times],
            [t.hour for t in times],
            [t.minute for t in times],
            [t.second + t.microsecond / 1_000_000 for t in times],
        )

        # Single vectorized observation call
        astrometric = observer.at(t_array).observe(obj)
        alt, az, _ = astrometric.apparent().altaz()
        altitudes = alt.degrees
        azimuths = az.degrees

        # Find maximum
        max_idx = altitudes.argmax()
        max_altitude = float(altitudes[max_idx])
        max_altitude_time = times[max_idx]
        azimuth_at_peak = float(azimuths[max_idx])

        # A three-point parabolic vertex removes most of the 10-minute peak
        # quantization at the cost of only one extra Skyfield evaluation.
        if 0 < max_idx < len(times) - 1:
            left_span = (times[max_idx] - times[max_idx - 1]).total_seconds()
            right_span = (times[max_idx + 1] - times[max_idx]).total_seconds()
            if abs(left_span - right_span) < 1e-6:
                y0, y1, y2 = (
                    float(altitudes[i]) for i in range(max_idx - 1, max_idx + 2)
                )
                curvature = y0 - 2.0 * y1 + y2
                if curvature < -1e-12:
                    offset_samples = max(-1.0, min(1.0, 0.5 * (y0 - y2) / curvature))
                    candidate_time = max_altitude_time + timedelta(
                        seconds=offset_samples * left_span
                    )
                    candidate_t = self.ts.from_datetime(candidate_time)
                    candidate_alt, candidate_az, _ = (
                        observer.at(candidate_t).observe(obj).apparent().altaz()
                    )
                    if candidate_alt.degrees > max_altitude:
                        max_altitude = float(candidate_alt.degrees)
                        max_altitude_time = candidate_time
                        azimuth_at_peak = float(candidate_az.degrees)
        is_visible = max_altitude > 0

        # Calculate minimum airmass (at peak altitude)
        min_airmass = calculate_airmass(max_altitude)

        # Find the longest continuous threshold window. Interpolate boundary
        # crossings instead of reporting the nearest 10/60-minute sample, and
        # never bridge two separate arcs above a threshold.
        def find_above_threshold(threshold):
            intervals = []
            interval_start = times[0] if altitudes[0] >= threshold else None

            for i in range(1, len(times)):
                was_above = altitudes[i - 1] >= threshold
                is_above = altitudes[i] >= threshold
                if was_above == is_above:
                    continue

                altitude_span = float(altitudes[i] - altitudes[i - 1])
                fraction = (
                    0.5
                    if abs(altitude_span) < 1e-12
                    else (threshold - float(altitudes[i - 1])) / altitude_span
                )
                crossing = times[i - 1] + (times[i] - times[i - 1]) * max(
                    0.0, min(1.0, fraction)
                )
                if is_above:
                    interval_start = crossing
                elif interval_start is not None:
                    intervals.append((interval_start, crossing))
                    interval_start = None

            if interval_start is not None:
                intervals.append((interval_start, times[-1]))
            if not intervals:
                return None, None
            return max(intervals, key=lambda interval: interval[1] - interval[0])

        above_45 = find_above_threshold(45)
        above_60 = find_above_threshold(60)
        above_75 = find_above_threshold(75)

        # Moon separation at peak
        moon_separation = None
        moon_warning = False
        if is_visible:
            t_peak = self.ts.utc(
                max_altitude_time.year,
                max_altitude_time.month,
                max_altitude_time.day,
                max_altitude_time.hour,
                max_altitude_time.minute,
            )
            obj_pos = observer.at(t_peak).observe(obj)
            moon_pos = observer.at(t_peak).observe(self.moon)
            moon_separation = obj_pos.separation_from(moon_pos).degrees

            if (
                night_info.moon_illumination > 50
                and moon_separation < 30
                and obj_type == "dso"
            ):
                moon_warning = True

        # Store sparse altitude samples (every 30 min) for window-specific display
        altitude_samples = []
        step = max(1, 30 // sample_interval)  # Sample every ~30 minutes
        for i in range(0, len(times), step):
            altitude_samples.append((times[i], float(altitudes[i])))

        return ObjectVisibility(
            object_name=obj_name,
            object_type=obj_type,
            is_visible=is_visible,
            max_altitude=max_altitude,
            max_altitude_time=max_altitude_time if is_visible else None,
            above_45_start=above_45[0],
            above_45_end=above_45[1],
            above_60_start=above_60[0],
            above_60_end=above_60[1],
            above_75_start=above_75[0],
            above_75_end=above_75[1],
            moon_separation=moon_separation,
            moon_warning=moon_warning,
            altitude_samples=altitude_samples,
            min_airmass=min_airmass,
            azimuth_at_peak=azimuth_at_peak,
        )
