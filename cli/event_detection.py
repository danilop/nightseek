"""Event detection for astronomical observations.

Detects conjunctions between celestial objects and active meteor showers.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Dict, TYPE_CHECKING

from skyfield.api import Star

from logging_config import get_logger
from events import METEOR_SHOWERS_2026, MeteorShower

if TYPE_CHECKING:
    from sky_calculator import SkyCalculator, NightInfo, ObjectVisibility

logger = get_logger(__name__)


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
    date = night_info.date

    for shower in METEOR_SHOWERS_2026:
        # Check if shower is active on this date
        # Handle year-crossing showers (e.g., Quadrantids)
        start_date = datetime(date.year, shower.start_month, shower.start_day)
        end_date = datetime(date.year, shower.end_month, shower.end_day)
        peak_date = datetime(date.year, shower.peak_month, shower.peak_day)

        # Adjust for year-crossing showers
        if shower.start_month > shower.end_month:
            if date.month >= shower.start_month:
                end_date = datetime(date.year + 1, shower.end_month, shower.end_day)
            else:
                start_date = datetime(
                    date.year - 1, shower.start_month, shower.start_day
                )
                peak_date = datetime(date.year - 1, shower.peak_month, shower.peak_day)

        if not (start_date <= date <= end_date):
            continue

        # Calculate days from peak
        days_from_peak = abs((date - peak_date).days)

        # Calculate radiant altitude at midnight
        if night_info.astronomical_dusk and night_info.astronomical_dawn:
            dusk = night_info.astronomical_dusk
            dawn = night_info.astronomical_dawn
            if dawn <= dusk:
                dawn = dawn + timedelta(days=1)
            mid_night = dusk + (dawn - dusk) / 2

            # Calculate radiant altitude
            t_mid = calculator.ts.utc(
                mid_night.year,
                mid_night.month,
                mid_night.day,
                mid_night.hour,
                mid_night.minute,
            )

            # Create a star at radiant position
            radiant = Star(
                ra_hours=shower.radiant_ra_deg / 15.0,
                dec_degrees=shower.radiant_dec_deg,
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
                radiant_ra_deg=shower.radiant_ra_deg,
                radiant_dec_deg=shower.radiant_dec_deg,
                velocity_kms=shower.velocity_kms,
                parent_object=shower.parent_object,
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

    # Only consider visible objects
    visible_planets = [p for p in planets if p.is_visible and p.max_altitude >= 15]

    # Get a reference time (middle of the night)
    if not night_info.astronomical_dusk or not night_info.astronomical_dawn:
        return []

    dusk = night_info.astronomical_dusk
    dawn = night_info.astronomical_dawn
    if dawn <= dusk:
        dawn = dawn + timedelta(days=1)
    mid_night = dusk + (dawn - dusk) / 2

    t_mid = calculator.ts.utc(
        mid_night.year,
        mid_night.month,
        mid_night.day,
        mid_night.hour,
        mid_night.minute,
    )
    earth = calculator.earth
    observer = earth + calculator.location

    # Check planet-planet conjunctions
    for i, p1 in enumerate(visible_planets):
        for p2 in visible_planets[i + 1 :]:
            try:
                obj1 = planets_dict.get(p1.object_name)
                obj2 = planets_dict.get(p2.object_name)
                if obj1 is None or obj2 is None:
                    continue

                pos1 = observer.at(t_mid).observe(obj1)
                pos2 = observer.at(t_mid).observe(obj2)
                sep = pos1.separation_from(pos2).degrees

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
                            time=mid_night,
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

            pos_planet = observer.at(t_mid).observe(obj)
            pos_moon = observer.at(t_mid).observe(moon)
            sep = pos_planet.separation_from(pos_moon).degrees

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
                        time=mid_night,
                        description=desc,
                    )
                )
        except (ValueError, AttributeError, TypeError) as e:
            logger.debug("Could not compute Moon-%s conjunction: %s", p.object_name, e)
            continue

    # Sort by separation (closest first)
    conjunctions.sort(key=lambda c: c.separation_degrees)

    return conjunctions
