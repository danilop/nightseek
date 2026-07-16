"""Event detection for astronomical observations.

Detects conjunctions between celestial objects and active meteor showers.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Dict, TYPE_CHECKING

from skyfield.api import Star
from skyfield.framelib import ecliptic_frame

from logging_config import get_logger
from events import METEOR_SHOWERS, MeteorShower

if TYPE_CHECKING:
    from sky_calculator import SkyCalculator, NightInfo, ObjectVisibility

logger = get_logger(__name__)
DAY_SECONDS = 86_400


def _calendar_day(month: int, day: int) -> int:
    """Return a stable zero-based day index using a non-leap reference year."""
    return (datetime(2001, month, day) - datetime(2001, 1, 1)).days


def _activity_offsets(shower: MeteorShower) -> tuple[int, int]:
    peak = _calendar_day(shower.peak_month, shower.peak_day)
    start = _calendar_day(shower.start_month, shower.start_day)
    end = _calendar_day(shower.end_month, shower.end_day)
    if start > peak:
        start -= 365
    if end < peak:
        end += 365
    return start - peak, end - peak


def _signed_angle_degrees(angle: float) -> float:
    return (angle + 180.0) % 360.0 - 180.0


def _meteor_peak_time(
    calculator: "SkyCalculator", shower: MeteorShower, reference: datetime
) -> datetime:
    """Solve the annual IAU solar-longitude peak nearest the reference time."""

    def solar_longitude(when: datetime) -> float:
        t = calculator.ts.from_datetime(when)
        apparent_sun = calculator.earth.at(t).observe(calculator.sun).apparent()
        _, longitude, _ = apparent_sun.frame_latlon(ecliptic_frame)
        return float(longitude.degrees)

    def solve(candidate_year: int) -> datetime:
        nominal = datetime(
            candidate_year,
            shower.peak_month,
            shower.peak_day,
            12,
            tzinfo=timezone.utc,
        )
        left = nominal - timedelta(days=5)
        right = nominal + timedelta(days=5)
        left_delta = _signed_angle_degrees(
            solar_longitude(left) - shower.solar_longitude_peak
        )
        right_delta = _signed_angle_degrees(
            solar_longitude(right) - shower.solar_longitude_peak
        )
        if not (left_delta <= 0 <= right_delta):
            return nominal

        while (right - left).total_seconds() > 1:
            middle = left + (right - left) / 2
            delta = _signed_angle_degrees(
                solar_longitude(middle) - shower.solar_longitude_peak
            )
            if delta < 0:
                left = middle
            else:
                right = middle
        return left + (right - left) / 2

    reference_utc = (
        reference.replace(tzinfo=timezone.utc)
        if reference.tzinfo is None
        else reference.astimezone(timezone.utc)
    )
    candidates = [
        solve(year) for year in range(reference_utc.year - 1, reference_utc.year + 2)
    ]
    return min(candidates, key=lambda candidate: abs(candidate - reference_utc))


def _nearest_nominal_peak(shower: MeteorShower, reference: datetime) -> datetime:
    reference_utc = (
        reference.replace(tzinfo=timezone.utc)
        if reference.tzinfo is None
        else reference.astimezone(timezone.utc)
    )
    candidates = [
        datetime(
            year,
            shower.peak_month,
            shower.peak_day,
            12,
            tzinfo=timezone.utc,
        )
        for year in range(reference_utc.year - 1, reference_utc.year + 2)
    ]
    return min(candidates, key=lambda candidate: abs(candidate - reference_utc))


@dataclass
class Conjunction:
    """A close approach between two celestial objects."""

    object1_name: str
    object2_name: str
    separation_degrees: float  # Angular separation
    time: datetime  # Time of closest approach
    description: str  # Human-readable description

    @property
    def is_notable(self) -> bool:
        """Check if this conjunction is notable (< 5 degrees)."""
        return self.separation_degrees < 5.0


def detect_meteor_showers(
    calculator: "SkyCalculator",
    night_info: "NightInfo",
    moon: "ObjectVisibility",
) -> List[MeteorShower]:
    """Detect active meteor showers for the given night.

    Args:
        calculator: SkyCalculator instance for position calculations
        night_info: Night information
        moon: Moon visibility information

    Returns:
        List of active meteor showers with calculated properties
    """
    active_showers = []
    if night_info.astronomical_night_mode == "none":
        return active_showers

    for shower in METEOR_SHOWERS:
        # Calculate at the center of astronomical darkness, including the
        # fractional day needed for radiant drift and peak status.
        if night_info.astronomical_dusk and night_info.astronomical_dawn:
            dusk = night_info.astronomical_dusk
            dawn = night_info.astronomical_dawn
            if dawn <= dusk:
                dawn = dawn + timedelta(days=1)
            mid_night = dusk + (dawn - dusk) / 2
            activity_start, activity_end = _activity_offsets(shower)
            nominal_peak = _nearest_nominal_peak(shower, mid_night)
            nominal_days = (mid_night - nominal_peak).total_seconds() / DAY_SECONDS
            if not (activity_start - 2 <= nominal_days <= activity_end + 2):
                continue

            peak_time = _meteor_peak_time(calculator, shower, mid_night)
            days_from_peak = (mid_night - peak_time).total_seconds() / DAY_SECONDS
            if not (activity_start <= days_from_peak <= activity_end):
                continue

            # Calculate radiant altitude
            t_mid = calculator.ts.utc(
                mid_night.year,
                mid_night.month,
                mid_night.day,
                mid_night.hour,
                mid_night.minute,
            )

            # Create a star at radiant position
            radiant_ra_deg = (
                shower.radiant_ra_deg + shower.radiant_ra_drift * days_from_peak
            )
            radiant_dec_deg = (
                shower.radiant_dec_deg + shower.radiant_dec_drift * days_from_peak
            )
            radiant = Star(
                ra_hours=radiant_ra_deg / 15.0,
                dec_degrees=radiant_dec_deg,
            )

            observer = calculator.earth + calculator.location
            alt = observer.at(t_mid).observe(radiant).apparent().altaz()[0].degrees

            # Calculate moon separation
            moon_pos = observer.at(t_mid).observe(calculator.moon)
            radiant_pos = observer.at(t_mid).observe(radiant)
            moon_sep = radiant_pos.separation_from(moon_pos).degrees

            # Create shower copy with calculated values
            shower_copy = MeteorShower(
                name=shower.name,
                code=shower.code,
                peak_month=shower.peak_month,
                peak_day=shower.peak_day,
                start_month=shower.start_month,
                start_day=shower.start_day,
                end_month=shower.end_month,
                end_day=shower.end_day,
                zhr=shower.zhr,
                radiant_ra_deg=radiant_ra_deg,
                radiant_dec_deg=radiant_dec_deg,
                velocity_kms=shower.velocity_kms,
                parent_object=shower.parent_object,
                solar_longitude_peak=shower.solar_longitude_peak,
                radiant_ra_drift=shower.radiant_ra_drift,
                radiant_dec_drift=shower.radiant_dec_drift,
                is_active=True,
                days_from_peak=days_from_peak,
                radiant_altitude=alt,
                moon_illumination=night_info.moon_illumination,
                moon_separation_deg=moon_sep,
            )

            active_showers.append(shower_copy)

    return active_showers


def detect_conjunctions(
    calculator: "SkyCalculator",
    planets: List["ObjectVisibility"],
    planets_dict: Dict[str, object],
    night_info: "NightInfo",
) -> List[Conjunction]:
    """Detect close approaches between bright objects.

    Args:
        calculator: SkyCalculator instance for position calculations
        planets: List of visible planets
        planets_dict: Dict mapping planet names to Skyfield planet objects
        night_info: Night information

    Returns:
        List of notable conjunctions
    """
    conjunctions = []
    if night_info.astronomical_night_mode == "none":
        return conjunctions

    # Only consider visible objects
    visible_planets = [p for p in planets if p.is_visible and p.max_altitude >= 15]

    if not night_info.astronomical_dusk or not night_info.astronomical_dawn:
        return []

    dusk = night_info.astronomical_dusk
    dawn = night_info.astronomical_dawn
    if dawn <= dusk:
        dawn = dawn + timedelta(days=1)
    earth = calculator.earth
    observer = earth + calculator.location

    def closest_approach(obj1, obj2) -> tuple[datetime, float]:
        """Find topocentric minimum separation, refined to a few seconds."""

        def separation(when: datetime) -> float:
            t = calculator.ts.from_datetime(when)
            pos1 = observer.at(t).observe(obj1).apparent()
            pos2 = observer.at(t).observe(obj2).apparent()
            return float(pos1.separation_from(pos2).degrees)

        step = timedelta(minutes=10)
        sample_times = []
        current = dusk
        while current < dawn:
            sample_times.append(current)
            current += step
        sample_times.append(dawn)
        separations = [separation(when) for when in sample_times]
        best_index = min(range(len(sample_times)), key=lambda index: separations[index])

        if best_index in (0, len(sample_times) - 1):
            return sample_times[best_index], separations[best_index]

        left = sample_times[best_index - 1]
        right = sample_times[best_index + 1]
        golden = (5**0.5 - 1) / 2
        c = right - (right - left) * golden
        d = left + (right - left) * golden
        fc = separation(c)
        fd = separation(d)
        while (right - left).total_seconds() > 2:
            if fc < fd:
                right, d, fd = d, c, fc
                c = right - (right - left) * golden
                fc = separation(c)
            else:
                left, c, fc = c, d, fd
                d = left + (right - left) * golden
                fd = separation(d)

        best_time = left + (right - left) / 2
        return best_time, separation(best_time)

    # Check planet-planet conjunctions
    for i, p1 in enumerate(visible_planets):
        for p2 in visible_planets[i + 1 :]:
            try:
                obj1 = planets_dict.get(p1.object_name)
                obj2 = planets_dict.get(p2.object_name)
                if obj1 is None or obj2 is None:
                    continue

                closest_time, sep = closest_approach(obj1, obj2)

                if sep < 10:  # Notable if within 10 degrees
                    desc = f"{p1.object_name} and {p2.object_name} within {sep:.1f}°"
                    if sep < 2:
                        desc = f"Close conjunction: {p1.object_name} and {p2.object_name} only {sep:.1f}° apart!"
                    elif sep < 5:
                        desc = f"{p1.object_name} near {p2.object_name} ({sep:.1f}°)"

                    conjunctions.append(
                        Conjunction(
                            object1_name=p1.object_name,
                            object2_name=p2.object_name,
                            separation_degrees=sep,
                            time=closest_time,
                            description=desc,
                        )
                    )
            except (ValueError, AttributeError, TypeError) as e:
                logger.debug(
                    "Could not compute conjunction between %s and %s: %s",
                    p1.object_name,
                    p2.object_name,
                    e,
                )
                continue

    # Check planet-Moon conjunctions
    moon = calculator.moon
    for p in visible_planets:
        try:
            obj = planets_dict.get(p.object_name)
            if obj is None:
                continue

            closest_time, sep = closest_approach(obj, moon)

            if sep < 10:
                if sep < 2:
                    desc = f"Moon very close to {p.object_name} ({sep:.1f}°) - great photo opportunity!"
                elif sep < 5:
                    desc = f"Moon near {p.object_name} ({sep:.1f}°)"
                else:
                    desc = f"Moon and {p.object_name} within {sep:.1f}°"

                conjunctions.append(
                    Conjunction(
                        object1_name="Moon",
                        object2_name=p.object_name,
                        separation_degrees=sep,
                        time=closest_time,
                        description=desc,
                    )
                )
        except (ValueError, AttributeError, TypeError) as e:
            logger.debug("Could not compute Moon-%s conjunction: %s", p.object_name, e)
            continue

    # Sort by separation (closest first)
    conjunctions.sort(key=lambda c: c.separation_degrees)

    return conjunctions
