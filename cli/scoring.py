"""Professional merit-based scoring algorithm for astronomical objects."""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional, Dict, Any

from opengc_loader import DSO_MOON_SENSITIVITY

if TYPE_CHECKING:
    from sky_calculator import ObjectVisibility


@dataclass
class ScoredObject:
    """An astronomical object with its computed score."""

    object_name: str
    category: str  # planet, dso, comet, dwarf_planet, asteroid, milky_way
    subtype: str  # For DSOs: galaxy, nebula, etc. For planets: inner, outer, etc.
    total_score: float
    score_breakdown: Dict[str, float]
    reason: str  # Human-readable summary of why this score
    visibility: "ObjectVisibility"  # ObjectVisibility reference
    magnitude: Optional[float] = None


@dataclass
class ScoreWeights:
    """Configurable weights for scoring components."""

    # Imaging quality (0-100 total)
    altitude_weight: float = 40.0
    moon_interference_weight: float = 30.0
    peak_timing_weight: float = 15.0
    weather_weight: float = 15.0

    # Object characteristics (0-50 total)
    surface_brightness_weight: float = 20.0
    magnitude_weight: float = 15.0
    type_suitability_weight: float = 15.0

    # Priority/rarity bonus (0-50 total)
    transient_bonus_weight: float = 25.0
    seasonal_window_weight: float = 15.0
    novelty_weight: float = 10.0


DEFAULT_WEIGHTS = ScoreWeights()


def calculate_altitude_score(
    max_altitude: float,
    min_airmass: Optional[float] = None,
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> float:
    """Calculate score based on airmass (preferred) or altitude.

    Airmass is more scientifically accurate than raw altitude.
    Airmass 1.0 = zenith, 2.0 = 30° altitude, higher = worse.

    Args:
        max_altitude: Maximum altitude in degrees during the observation window
        min_airmass: Minimum airmass during observation (1.0 = zenith, lower = better)
        weights: Score weights configuration

    Returns:
        Score from 0 to weights.altitude_weight
    """
    # Use airmass if available (more accurate)
    if min_airmass is not None and min_airmass < 99:
        if min_airmass <= 1.05:
            # Near zenith - excellent (< 1.05 airmass)
            return weights.altitude_weight * 0.95
        elif min_airmass <= 1.15:
            # Very good (75°+ altitude)
            return weights.altitude_weight * 0.90
        elif min_airmass <= 1.41:
            # Good (45°+ altitude, airmass < 1.41)
            return weights.altitude_weight * 0.75
        elif min_airmass <= 2.0:
            # Acceptable (30°+ altitude, airmass < 2.0)
            return weights.altitude_weight * 0.55
        elif min_airmass <= 3.0:
            # Fair (airmass 2-3)
            return weights.altitude_weight * 0.30
        else:
            # Poor (airmass > 3)
            return weights.altitude_weight * 0.10

    # Fallback to altitude-based scoring
    if max_altitude < 15:
        return 0.0
    elif max_altitude >= 75:
        return weights.altitude_weight * 0.95
    elif max_altitude >= 60:
        return weights.altitude_weight * 0.85
    elif max_altitude >= 45:
        return weights.altitude_weight * 0.70
    elif max_altitude >= 30:
        return weights.altitude_weight * 0.50
    else:
        return weights.altitude_weight * 0.30


def calculate_moon_interference_score(
    moon_separation: Optional[float],
    moon_illumination: float,
    object_type: str,
    dso_subtype: str = "",
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> float:
    """Calculate score based on moon interference.

    Args:
        moon_separation: Angular separation from moon in degrees
        moon_illumination: Moon illumination percentage (0-100)
        object_type: Type of object (planet, dso, comet, etc.)
        dso_subtype: DSO subtype for sensitivity lookup
        weights: Score weights configuration

    Returns:
        Score from 0 to weights.moon_interference_weight
    """
    max_score = weights.moon_interference_weight

    # Planets and bright objects are less affected by moon
    if object_type == "planet":
        return max_score * 0.9  # Slight penalty for glare

    # No moon = full points
    if moon_illumination < 5:
        return max_score

    # Get sensitivity factor for this object type
    if object_type == "dso" and dso_subtype:
        sensitivity = DSO_MOON_SENSITIVITY.get(dso_subtype, 0.5)
    elif object_type == "comet":
        sensitivity = 0.7  # Comets moderately affected
    elif object_type == "milky_way":
        sensitivity = 1.0  # Extremely sensitive
    else:
        sensitivity = 0.5

    # Calculate interference
    moon_factor = moon_illumination / 100.0

    # Separation bonus (further from moon = better)
    separation_factor = 1.0
    if moon_separation is not None:
        if moon_separation > 90:
            separation_factor = 0.3  # Far from moon
        elif moon_separation > 60:
            separation_factor = 0.5
        elif moon_separation > 30:
            separation_factor = 0.7
        else:
            separation_factor = 1.0  # Close to moon

    # Combined interference
    interference = moon_factor * sensitivity * separation_factor
    return max_score * (1.0 - interference)


def calculate_peak_timing_score(
    max_altitude_time: Optional[datetime],
    window_start: datetime,
    window_end: datetime,
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> float:
    """Calculate score based on whether object peaks during observation window.

    Args:
        max_altitude_time: Time of maximum altitude
        window_start: Start of observation window
        window_end: End of observation window
        weights: Score weights configuration

    Returns:
        Score from 0 to weights.peak_timing_weight
    """
    max_score = weights.peak_timing_weight

    if max_altitude_time is None:
        return max_score * 0.3  # Some points for being visible

    # Normalize times for comparison
    peak = max_altitude_time.replace(tzinfo=None)
    start = window_start.replace(tzinfo=None) if window_start.tzinfo else window_start
    end = window_end.replace(tzinfo=None) if window_end.tzinfo else window_end

    # Peak during window = best
    if start <= peak <= end:
        return max_score

    # Calculate how far outside window
    if peak < start:
        hours_off = (start - peak).total_seconds() / 3600
    else:
        hours_off = (peak - end).total_seconds() / 3600

    # Decay score based on hours off
    if hours_off < 1:
        return max_score * 0.8
    elif hours_off < 2:
        return max_score * 0.6
    elif hours_off < 4:
        return max_score * 0.4
    else:
        return max_score * 0.2


def calculate_weather_score(
    cloud_cover: Optional[float],
    aod: Optional[float] = None,
    precip_probability: Optional[float] = None,
    wind_gust_kmh: Optional[float] = None,
    transparency: Optional[float] = None,
    is_deep_sky: bool = False,
    is_planet: bool = False,
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> float:
    """Calculate score based on weather conditions.

    Args:
        cloud_cover: Cloud cover percentage (0-100), None if unknown
        aod: Aerosol optical depth (0-1+), None if unknown
        precip_probability: Precipitation probability (0-100), None if unknown
        wind_gust_kmh: Maximum wind gusts in km/h, None if unknown
        transparency: Transparency score (0-100), None if unknown
        is_deep_sky: True for DSOs/Milky Way (more affected by haze/transparency)
        is_planet: True for planets (less affected by wind - short exposures)
        weights: Score weights configuration

    Returns:
        Score from 0 to weights.weather_weight
    """
    max_score = weights.weather_weight

    if cloud_cover is None:
        return max_score * 0.7  # Assume decent weather if unknown

    # Base score from cloud cover
    if cloud_cover < 10:
        base_score = max_score
    elif cloud_cover < 25:
        base_score = max_score * 0.9
    elif cloud_cover < 50:
        base_score = max_score * 0.6
    elif cloud_cover < 75:
        base_score = max_score * 0.3
    else:
        base_score = max_score * 0.1

    # AOD penalty (affects deep sky objects more)
    aod_factor = 1.0
    if aod is not None:
        if aod < 0.1:
            aod_factor = 1.0  # Excellent
        elif aod < 0.2:
            aod_factor = 0.95 if is_deep_sky else 0.98
        elif aod < 0.3:
            aod_factor = 0.85 if is_deep_sky else 0.92
        elif aod < 0.5:
            aod_factor = 0.70 if is_deep_sky else 0.85
        else:
            aod_factor = 0.50 if is_deep_sky else 0.75

    # Transparency bonus/penalty for deep sky (uses calculated transparency score)
    transparency_factor = 1.0
    if transparency is not None and is_deep_sky:
        if transparency >= 80:
            transparency_factor = 1.05  # Bonus for excellent transparency
        elif transparency >= 60:
            transparency_factor = 1.0
        elif transparency >= 40:
            transparency_factor = 0.90
        else:
            transparency_factor = 0.75  # Poor transparency hurts DSOs

    # Precipitation penalty
    precip_factor = 1.0
    if precip_probability is not None:
        if precip_probability > 70:
            precip_factor = 0.3
        elif precip_probability > 50:
            precip_factor = 0.5
        elif precip_probability > 30:
            precip_factor = 0.7
        elif precip_probability > 10:
            precip_factor = 0.9

    # Wind penalty - affects all imaging but DSOs/comets more (long exposures)
    # Planets use short video frames so less affected
    wind_factor = 1.0
    if wind_gust_kmh is not None:
        if wind_gust_kmh < 15:
            wind_factor = 1.0  # Calm - no penalty
        elif wind_gust_kmh < 25:
            # Light wind - minor penalty, less for planets
            wind_factor = 0.98 if is_planet else 0.95
        elif wind_gust_kmh < 40:
            # Moderate wind - noticeable impact on long exposures
            wind_factor = 0.92 if is_planet else 0.80
        elif wind_gust_kmh < 55:
            # Strong wind - significant tracking issues
            wind_factor = 0.80 if is_planet else 0.60
        else:
            # Very strong wind - imaging very difficult
            wind_factor = 0.60 if is_planet else 0.40

    return base_score * aod_factor * transparency_factor * precip_factor * wind_factor


def calculate_surface_brightness_score(
    surface_brightness: Optional[float],
    magnitude: Optional[float],
    angular_size: float = 1.0,
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> float:
    """Calculate score based on surface brightness (easier to image = higher score).

    Args:
        surface_brightness: Surface brightness in mag/arcsec² (lower = brighter)
        magnitude: Visual magnitude
        angular_size: Angular size in arcminutes
        weights: Score weights configuration

    Returns:
        Score from 0 to weights.surface_brightness_weight
    """
    max_score = weights.surface_brightness_weight

    # Use provided surface brightness if available
    if surface_brightness is not None:
        if surface_brightness < 20:
            return max_score  # Very bright
        elif surface_brightness < 22:
            return max_score * 0.8
        elif surface_brightness < 24:
            return max_score * 0.6
        elif surface_brightness < 26:
            return max_score * 0.4
        else:
            return max_score * 0.2

    # Estimate from magnitude and size if no SB available
    if magnitude is not None and angular_size > 0:
        # Rough estimate: SB ≈ mag + 2.5*log10(area in arcsec²)
        area_arcsec2 = (angular_size * 60) ** 2 * math.pi / 4
        estimated_sb = magnitude + 2.5 * math.log10(max(area_arcsec2, 1))

        if estimated_sb < 20:
            return max_score
        elif estimated_sb < 22:
            return max_score * 0.7
        elif estimated_sb < 24:
            return max_score * 0.5
        else:
            return max_score * 0.3

    return max_score * 0.5  # Default if no info


def calculate_magnitude_score(
    magnitude: Optional[float],
    object_type: str,
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> float:
    """Calculate score based on apparent magnitude.

    Args:
        magnitude: Visual magnitude (lower = brighter)
        object_type: Type of object
        weights: Score weights configuration

    Returns:
        Score from 0 to weights.magnitude_weight
    """
    max_score = weights.magnitude_weight

    if magnitude is None:
        return max_score * 0.5

    # Different scales for different object types
    if object_type == "planet":
        # Planets are bright
        if magnitude < -2:
            return max_score
        elif magnitude < 0:
            return max_score * 0.9
        elif magnitude < 2:
            return max_score * 0.7
        else:
            return max_score * 0.5
    elif object_type in ("comet", "asteroid"):
        # Comets/asteroids vary widely
        if magnitude < 6:
            return max_score
        elif magnitude < 8:
            return max_score * 0.8
        elif magnitude < 10:
            return max_score * 0.6
        elif magnitude < 12:
            return max_score * 0.4
        else:
            return max_score * 0.2
    else:
        # DSOs
        if magnitude < 5:
            return max_score
        elif magnitude < 7:
            return max_score * 0.9
        elif magnitude < 9:
            return max_score * 0.7
        elif magnitude < 11:
            return max_score * 0.5
        elif magnitude < 13:
            return max_score * 0.3
        else:
            return max_score * 0.2


def calculate_type_suitability_score(
    object_type: str,
    dso_subtype: str,
    moon_illumination: float,
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> float:
    """Calculate score based on object type suitability for current conditions.

    Dark sky → nebulae and galaxies score higher
    Bright moon → clusters and planets score higher

    Args:
        object_type: Type of object
        dso_subtype: DSO subtype
        moon_illumination: Moon illumination percentage
        weights: Score weights configuration

    Returns:
        Score from 0 to weights.type_suitability_weight
    """
    max_score = weights.type_suitability_weight

    if moon_illumination < 30:
        # Dark sky - favor sensitive objects
        if object_type == "milky_way":
            return max_score
        elif dso_subtype in ("emission_nebula", "reflection_nebula", "galaxy"):
            return max_score * 0.95
        elif dso_subtype in ("planetary_nebula", "supernova_remnant"):
            return max_score * 0.85
        elif object_type == "comet":
            return max_score * 0.8
        elif dso_subtype in ("open_cluster", "globular_cluster"):
            return max_score * 0.7
        elif object_type == "planet":
            return max_score * 0.6
        else:
            return max_score * 0.5
    else:
        # Bright moon - favor resilient objects
        if object_type == "planet":
            return max_score
        elif dso_subtype in ("globular_cluster", "open_cluster"):
            return max_score * 0.9
        elif dso_subtype == "planetary_nebula":
            return max_score * 0.7
        elif object_type == "comet":
            return max_score * 0.5
        elif dso_subtype in ("galaxy", "emission_nebula"):
            return max_score * 0.3
        elif object_type == "milky_way":
            return max_score * 0.1
        else:
            return max_score * 0.4


def calculate_transient_bonus(
    object_type: str,
    is_interstellar: bool = False,
    is_near_perihelion: bool = False,
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> float:
    """Calculate bonus for transient/rare events.

    Args:
        object_type: Type of object
        is_interstellar: True for interstellar objects (very rare!)
        is_near_perihelion: True if comet is near perihelion
        weights: Score weights configuration

    Returns:
        Bonus from 0 to weights.transient_bonus_weight
    """
    max_bonus = weights.transient_bonus_weight

    if is_interstellar:
        return max_bonus  # Maximum bonus for interstellar objects

    if object_type == "comet":
        if is_near_perihelion:
            return max_bonus * 0.7
        return max_bonus * 0.5

    if object_type == "asteroid":
        return max_bonus * 0.3

    return 0.0  # No bonus for static objects


def calculate_seasonal_window_score(
    ra_hours: float,
    observation_date: datetime,
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> float:
    """Calculate score based on seasonal visibility (object opposite sun = peak season).

    Args:
        ra_hours: Right ascension in hours
        observation_date: Date of observation
        weights: Score weights configuration

    Returns:
        Score from 0 to weights.seasonal_window_weight
    """
    max_score = weights.seasonal_window_weight

    # Sun's approximate RA for each month (simplified)
    # Sun is at RA 0h at vernal equinox (March 21)
    day_of_year = observation_date.timetuple().tm_yday
    sun_ra = ((day_of_year - 80) / 365.25 * 24) % 24  # Approximate

    # Object is best when opposite the sun (12h difference)
    ra_diff = abs(ra_hours - sun_ra)
    if ra_diff > 12:
        ra_diff = 24 - ra_diff

    # Score based on how close to opposition
    opposition_factor = ra_diff / 12.0  # 0 = same as sun, 1 = opposite

    return max_score * opposition_factor


def calculate_popularity_score(
    common_name: str, weights: ScoreWeights = DEFAULT_WEIGHTS
) -> float:
    """Calculate bonus based on object popularity/accessibility.

    Messier objects and famous named objects are great targets.

    Args:
        common_name: Common name of object
        weights: Score weights configuration

    Returns:
        Score from 0 to weights.novelty_weight
    """
    max_score = weights.novelty_weight

    if not common_name:
        return 0.0  # Unknown objects get no bonus

    # Messier objects are prime targets - full bonus
    if common_name.startswith("M") and len(common_name) > 1:
        first_part = common_name.split()[0]
        if first_part[1:].isdigit() or (
            len(first_part) > 2 and first_part[1:].replace(" ", "").isdigit()
        ):
            return max_score

    # Other named objects get partial bonus
    return max_score * 0.5


def score_object(
    visibility: Any,
    category: str,
    subtype: str,
    moon_illumination: float,
    observation_date: datetime,
    window_start: datetime,
    window_end: datetime,
    cloud_cover: Optional[float] = None,
    aod: Optional[float] = None,
    precip_probability: Optional[float] = None,
    wind_gust_kmh: Optional[float] = None,
    transparency: Optional[float] = None,
    ra_hours: float = 0.0,
    common_name: str = "",
    surface_brightness: Optional[float] = None,
    angular_size: float = 1.0,
    is_interstellar: bool = False,
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> ScoredObject:
    """Calculate total score for an astronomical object.

    Args:
        visibility: ObjectVisibility instance
        category: Object category (planet, dso, comet, etc.)
        subtype: Subtype (galaxy, nebula, etc.)
        moon_illumination: Moon illumination percentage
        observation_date: Date of observation
        window_start: Start of observation window
        window_end: End of observation window
        cloud_cover: Cloud cover percentage (optional)
        aod: Aerosol optical depth (optional)
        precip_probability: Max precipitation probability (optional)
        wind_gust_kmh: Max wind gusts in km/h (optional)
        transparency: Transparency score 0-100 (optional)
        ra_hours: Right ascension in hours
        common_name: Common name if known
        surface_brightness: Surface brightness in mag/arcsec²
        angular_size: Angular size in arcminutes
        is_interstellar: True for interstellar objects
        weights: Score weights configuration

    Returns:
        ScoredObject with total score and breakdown
    """
    breakdown = {}

    # Imaging quality scores (0-100)
    # Use airmass if available (more scientifically accurate)
    min_airmass = getattr(visibility, "min_airmass", None)
    breakdown["altitude"] = calculate_altitude_score(
        visibility.max_altitude, min_airmass, weights
    )
    breakdown["moon"] = calculate_moon_interference_score(
        visibility.moon_separation, moon_illumination, category, subtype, weights
    )
    breakdown["timing"] = calculate_peak_timing_score(
        visibility.max_altitude_time, window_start, window_end, weights
    )
    is_deep_sky = category in ("dso", "milky_way", "comet")
    is_planet = category == "planet"
    breakdown["weather"] = calculate_weather_score(
        cloud_cover,
        aod,
        precip_probability,
        wind_gust_kmh,
        transparency,
        is_deep_sky,
        is_planet,
        weights,
    )

    # Object characteristics (0-50)
    breakdown["surface_brightness"] = calculate_surface_brightness_score(
        surface_brightness, visibility.magnitude, angular_size, weights
    )
    breakdown["magnitude"] = calculate_magnitude_score(
        visibility.magnitude, category, weights
    )
    breakdown["type_suitability"] = calculate_type_suitability_score(
        category, subtype, moon_illumination, weights
    )

    # Priority/rarity bonus (0-50)
    breakdown["transient"] = calculate_transient_bonus(
        category, is_interstellar, False, weights
    )
    breakdown["seasonal"] = calculate_seasonal_window_score(
        ra_hours, observation_date, weights
    )
    breakdown["novelty"] = calculate_popularity_score(common_name, weights)

    total_score = sum(breakdown.values())

    # Generate reason string
    reason = generate_score_reason(
        breakdown, visibility.max_altitude, moon_illumination
    )

    return ScoredObject(
        object_name=visibility.object_name,
        category=category,
        subtype=subtype,
        total_score=total_score,
        score_breakdown=breakdown,
        reason=reason,
        visibility=visibility,
        magnitude=visibility.magnitude,
    )


def generate_score_reason(
    breakdown: Dict[str, float], max_altitude: float, moon_illumination: float
) -> str:
    """Generate human-readable reason for the score.

    Args:
        breakdown: Score breakdown dictionary
        max_altitude: Maximum altitude
        moon_illumination: Moon illumination percentage

    Returns:
        Human-readable explanation
    """
    reasons = []

    # Altitude assessment
    if max_altitude >= 75:
        reasons.append("excellent altitude")
    elif max_altitude >= 60:
        reasons.append("very good altitude")
    elif max_altitude >= 45:
        reasons.append("good altitude")
    elif max_altitude >= 30:
        reasons.append("acceptable altitude")
    else:
        reasons.append("low altitude")

    # Moon assessment
    if moon_illumination < 20:
        reasons.append("dark sky")
    elif moon_illumination < 50:
        reasons.append("moderate moonlight")
    else:
        if breakdown.get("moon", 0) > 15:
            reasons.append("moon tolerable")
        else:
            reasons.append("moon interference")

    # Highlight exceptional bonuses
    if breakdown.get("transient", 0) > 15:
        reasons.append("rare target")

    if breakdown.get("seasonal", 0) > 10:
        reasons.append("peak season")

    return ", ".join(reasons).capitalize()


# Maximum possible score for percentage calculations
MAX_SCORE = 200.0


def get_score_tier(score: float) -> tuple[str, str]:
    """Get tier name and emoji based on score percentage.

    Uses percentage-based thresholds matching the Web UI for consistency:
    - 75%+ (150+): Excellent
    - 50%+ (100+): Very Good
    - 35%+ (70+): Good
    - 20%+ (40+): Fair
    - Below 20%: Poor

    Args:
        score: Total score (0-200 scale)

    Returns:
        Tuple of (tier_name, star_rating)
    """
    pct = (score / MAX_SCORE) * 100
    if pct >= 75:
        return "Excellent", "[green]★★★★★[/green]"
    elif pct >= 50:
        return "Very Good", "[green]★★★★☆[/green]"
    elif pct >= 35:
        return "Good", "[yellow]★★★☆☆[/yellow]"
    elif pct >= 20:
        return "Fair", "[yellow]★★☆☆☆[/yellow]"
    else:
        return "Poor", "[red]★☆☆☆☆[/red]"


# =============================================================================
# Window Quality Functions (for best window selection)
# These match the Web's imaging-windows.ts for consistent scoring
# =============================================================================


def get_altitude_quality(altitude: float) -> float:
    """Calculate altitude quality score (0-100).

    Higher altitude = better quality (less atmosphere).
    Matches Web's calculateAltitudeQuality().

    Args:
        altitude: Altitude in degrees

    Returns:
        Quality score from 0-100
    """
    if altitude < 20:
        return 0
    elif altitude < 30:
        return 30
    elif altitude < 45:
        return 50
    elif altitude < 60:
        return 70
    elif altitude < 75:
        return 85
    return 100


def get_airmass_quality(altitude: float) -> float:
    """Calculate airmass quality score (0-100).

    Lower airmass = better quality.
    Matches Web's calculateAirmassQuality().

    Args:
        altitude: Altitude in degrees

    Returns:
        Quality score from 0-100
    """
    if altitude <= 0:
        return 0

    # Calculate airmass using Kasten-Young formula
    # Airmass ≈ 1 / sin(altitude) for simple approximation
    import math

    alt_rad = math.radians(altitude)
    if alt_rad <= 0:
        return 0
    airmass = 1.0 / math.sin(alt_rad)

    if airmass <= 1.1:
        return 100  # Near zenith
    elif airmass <= 1.3:
        return 90  # 50-60 degrees
    elif airmass <= 1.5:
        return 75  # 40-50 degrees
    elif airmass <= 2.0:
        return 50  # 30-40 degrees
    elif airmass <= 3.0:
        return 25  # 20-30 degrees
    return 0


def get_moon_quality(
    moon_separation: Optional[float],
    moon_illumination: float,
    moon_altitude: float = 30.0,
) -> float:
    """Calculate moon interference quality score (0-100).

    100 = no interference, 0 = severe interference.
    Matches Web's calculateMoonInterferenceQuality().

    Args:
        moon_separation: Angular separation from moon in degrees
        moon_illumination: Moon illumination percentage (0-100)
        moon_altitude: Moon altitude in degrees (default 30 if unknown)

    Returns:
        Quality score from 0-100
    """
    # Moon below horizon = no interference
    if moon_altitude <= 0:
        return 100

    # Low illumination = minimal interference
    if moon_illumination < 20:
        return 95

    # No separation data
    if moon_separation is None:
        return 50

    # Calculate combined interference
    separation_factor = min(moon_separation / 90.0, 1.0)  # 90+ degrees = full score
    illum_factor = 1.0 - moon_illumination / 100.0

    quality = (separation_factor * 0.6 + illum_factor * 0.4) * 100
    return round(quality)


def get_cloud_quality(cloud_cover: float) -> float:
    """Calculate cloud cover quality score (0-100).

    Matches Web's calculateCloudQuality().

    Args:
        cloud_cover: Cloud cover percentage (0-100)

    Returns:
        Quality score from 0-100
    """
    if cloud_cover <= 10:
        return 100
    elif cloud_cover <= 20:
        return 90
    elif cloud_cover <= 30:
        return 75
    elif cloud_cover <= 50:
        return 50
    elif cloud_cover <= 70:
        return 25
    return 0


def calculate_window_quality(
    avg_altitude: float,
    avg_cloud_cover: float,
    moon_separation: Optional[float],
    moon_illumination: float,
    moon_altitude: float = 30.0,
) -> float:
    """Calculate overall window quality using 4 equally-weighted factors.

    Matches Web's imaging window quality calculation for consistency.
    Each factor is 0-100, weighted equally at 25%.

    Args:
        avg_altitude: Average object altitude during window
        avg_cloud_cover: Average cloud cover percentage
        moon_separation: Angular separation from moon in degrees
        moon_illumination: Moon illumination percentage (0-100)
        moon_altitude: Moon altitude in degrees

    Returns:
        Quality score from 0-100
    """
    altitude_q = get_altitude_quality(avg_altitude)
    airmass_q = get_airmass_quality(avg_altitude)
    moon_q = get_moon_quality(moon_separation, moon_illumination, moon_altitude)
    cloud_q = get_cloud_quality(avg_cloud_cover)

    return (altitude_q + airmass_q + moon_q + cloud_q) / 4


def select_best_objects(
    all_scored_objects: List[ScoredObject],
    max_objects: int,
    min_score: float = 60.0,
    soft_cap_per_subtype: int = 3,
    exceptional_score_threshold: float = 180.0,
    ensure_category_representation: bool = True,
) -> List[ScoredObject]:
    """Select top N objects by score with soft variety caps.

    This is merit-based selection - no fixed category quotas.
    Uses soft caps to prevent showing too many of one subtype,
    but allows exceeding cap for exceptional scores.

    Args:
        all_scored_objects: List of scored objects
        max_objects: Maximum number to select
        min_score: Minimum score threshold
        soft_cap_per_subtype: Maximum per subtype unless exceptional
        exceptional_score_threshold: Score above which cap is ignored
        ensure_category_representation: If True, ensure at least 1 from each visible category

    Returns:
        List of selected objects sorted by score
    """
    # Filter to minimum quality threshold
    viable = [o for o in all_scored_objects if o.total_score >= min_score]

    if not viable:
        # If nothing meets threshold, take best available
        viable = sorted(all_scored_objects, key=lambda x: x.total_score, reverse=True)
        return viable[:max_objects]

    # Sort by score descending
    ranked = sorted(viable, key=lambda x: x.total_score, reverse=True)

    # First, if ensuring category representation, reserve spots
    selected = []
    subtype_counts = defaultdict(int)
    category_represented = set()

    if ensure_category_representation:
        # Get unique categories
        categories = set(o.category for o in ranked)

        # Take best from each category that isn't already selected
        for category in categories:
            best_in_category = next((o for o in ranked if o.category == category), None)
            if best_in_category and best_in_category not in selected:
                selected.append(best_in_category)
                subtype_counts[best_in_category.subtype] += 1
                category_represented.add(category)

    # Fill remaining slots with best available using soft caps
    for obj in ranked:
        if len(selected) >= max_objects:
            break

        if obj in selected:
            continue

        # Allow exceeding cap for exceptional scores
        if (
            subtype_counts[obj.subtype] >= soft_cap_per_subtype
            and obj.total_score < exceptional_score_threshold
        ):
            continue

        selected.append(obj)
        subtype_counts[obj.subtype] += 1

    # Final sort by score
    selected.sort(key=lambda x: x.total_score, reverse=True)

    return selected
