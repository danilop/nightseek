"""Analyze visibility of celestial objects over multiple nights."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional
import math

from catalog import Catalog
from sky_calculator import (
    NightInfo,
    ObjectVisibility,
    SkyCalculator,
    calculate_planet_apparent_diameter,
    calculate_small_body_apparent_diameter,
    PLANET_APPARENT_DIAMETERS,
    SMALL_BODY_DIAMETERS,
)
from weather import NightWeather, WeatherForecast
from scoring import (
    score_object,
    select_best_objects,
    ScoredObject,
)
from events import METEOR_SHOWERS_2026, MeteorShower


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


@dataclass
class NightForecast:
    """Forecast for a single night."""

    night_info: NightInfo
    planets: List[ObjectVisibility]
    dsos: List[ObjectVisibility]
    comets: List[ObjectVisibility]  # Bright comets visible tonight
    dwarf_planets: List[ObjectVisibility]  # Dwarf planets (Pluto, Ceres, etc.)
    asteroids: List[ObjectVisibility]  # Bright asteroids
    milky_way: ObjectVisibility
    moon: ObjectVisibility
    weather: Optional[NightWeather]  # None if weather data unavailable
    conjunctions: List[Conjunction] = field(
        default_factory=list
    )  # Close approaches between objects
    meteor_showers: List["MeteorShower"] = field(
        default_factory=list
    )  # Active meteor showers


@dataclass
class VisibilityScore:
    """Score for ranking objects by viewing quality (legacy compatibility)."""

    object_name: str
    score: float
    reason: str


class VisibilityAnalyzer:
    """Analyze celestial object visibility over multiple nights."""

    def __init__(
        self,
        latitude: float,
        longitude: float,
        comet_mag: float = 12.0,
        dso_mag: float = 14.0,
        verbose: bool = False,
    ):
        """Initialize the analyzer.

        Args:
            latitude: Observer latitude in degrees
            longitude: Observer longitude in degrees
            comet_mag: Maximum comet magnitude to include (default: 12.0)
            dso_mag: Maximum DSO magnitude to include (default: 14.0)
            verbose: If True, print download/cache status messages
        """
        self.calculator = SkyCalculator(latitude, longitude)
        self.catalog = Catalog(observer_latitude=latitude)
        self.latitude = latitude
        self.comet_mag = comet_mag
        self.dso_mag = dso_mag
        self.verbose = verbose

        # Planet names and objects
        self.planets = {
            "Mercury": self.calculator.mercury,
            "Venus": self.calculator.venus,
            "Mars": self.calculator.mars,
            "Jupiter": self.calculator.jupiter,
            "Saturn": self.calculator.saturn,
            "Uranus": self.calculator.uranus,
            "Neptune": self.calculator.neptune,
        }

        # Load and pre-filter comets by declination (one-time cost, cached)
        self.comets = self._load_filtered_comets()

        # Load dwarf planets and asteroids (cached)
        self.dwarf_planets = self.catalog.load_dwarf_planets()
        self.asteroids = self.catalog.load_bright_asteroids()

    def _load_filtered_comets(self, min_useful_alt: float = 30.0):
        """Load comets and filter by declination first, then apparent magnitude.

        This pre-filtering removes comets that:
        1. Can never reach useful altitude from this latitude (cheap check)
        2. Are currently too faint (apparent magnitude > threshold)

        The apparent magnitude is calculated from absolute magnitude and current distances.
        """

        # Load comets with a generous absolute magnitude filter
        all_comets = self.catalog.load_bright_comets(
            max_magnitude=20.0,  # Very generous - we filter by apparent mag below
            verbose=self.verbose,
        )
        if not all_comets:
            return []

        # Use current date for magnitude calculation
        from datetime import datetime

        now = datetime.now()
        t_ref = self.calculator.ts.utc(now.year, now.month, now.day, 0)

        # OPTIMIZATION: Pre-filter by declination BEFORE expensive position calculations
        # This is a cheap check that eliminates many comets
        declination_filtered = []
        for comet in all_comets:
            try:
                # Get declination from orbital elements (cheap)
                comet_obj = self.calculator.create_comet(comet.row)
                # Quick position check - just get declination
                astrometric = self.calculator.earth.at(t_ref).observe(comet_obj)
                _, dec, _ = astrometric.radec()
                dec_degrees = dec.degrees

                # Check if comet can reach useful altitude
                max_possible_alt = 90 - abs(self.calculator.latitude - dec_degrees)
                if max_possible_alt < min_useful_alt:
                    continue

                declination_filtered.append((comet, comet_obj, astrometric))
            except Exception:
                continue

        # Now calculate apparent magnitude only for comets that passed declination filter
        filtered = []
        for comet, comet_obj, astrometric in declination_filtered:
            try:
                ra, dec, earth_dist = astrometric.radec()
                delta = earth_dist.au  # Distance from Earth in AU

                # Get comet position from Sun (for heliocentric distance)
                sun_astrometric = self.calculator.sun.at(t_ref).observe(comet_obj)
                _, _, sun_dist = sun_astrometric.radec()
                r = sun_dist.au  # Distance from Sun in AU

                # Calculate apparent magnitude using comet magnitude formula:
                # m = g + 5*log10(Δ) + k*log10(r)
                # where g = absolute mag, Δ = Earth distance (AU), r = Sun distance (AU)
                # k = magnitude slope (typically 10, but use MPC value if available)
                g = comet.magnitude_g
                delta = earth_dist.au  # Distance from Earth in AU
                r = sun_dist.au  # Distance from Sun in AU

                # Get magnitude slope k from MPC data (default 10 if not available)
                k = float(
                    getattr(comet.row, "get", lambda x, d: d)("magnitude_k", 10.0)
                )

                # Compute apparent magnitude
                if delta > 0 and r > 0:
                    apparent_mag = g + 5 * math.log10(delta) + k * math.log10(r)
                else:
                    apparent_mag = 99.0  # Invalid, skip

                # Filter by apparent magnitude threshold
                if apparent_mag > self.comet_mag:
                    continue

                # Max possible altitude = 90 - |latitude - declination|
                max_possible_alt = 90 - abs(self.latitude - dec.degrees)

                if max_possible_alt >= min_useful_alt:
                    # Store pre-computed comet object and apparent magnitude for reuse
                    comet.skyfield_obj = comet_obj
                    comet.apparent_magnitude = apparent_mag  # Store for later use
                    filtered.append(comet)
            except Exception:
                continue

        return filtered

    def analyze_forecast(
        self,
        start_date: datetime,
        num_days: int,
        weather_forecast: Optional[WeatherForecast] = None,
    ) -> List[NightForecast]:
        """Analyze visibility for multiple nights.

        Args:
            start_date: Starting date for the forecast
            num_days: Number of nights to analyze
            weather_forecast: Optional weather forecast data

        Returns:
            List of NightForecast objects
        """
        forecasts = []

        for day_offset in range(num_days):
            date = start_date + timedelta(days=day_offset)
            forecast = self._analyze_single_night(date, weather_forecast)
            forecasts.append(forecast)

        return forecasts

    def _analyze_single_night(
        self,
        date: datetime,
        weather_forecast: Optional[WeatherForecast] = None,
    ) -> NightForecast:
        """Analyze visibility for a single night.

        Args:
            date: Date to analyze

        Returns:
            NightForecast object
        """
        # Get night information
        night_info = self.calculator.get_night_info(date)

        # Analyze planets
        planet_visibility = []
        for planet_name, planet_obj in self.planets.items():
            visibility = self.calculator.calculate_object_visibility(
                planet_obj,
                planet_name,
                "planet",
                night_info,
            )
            visibility.subtype = (
                "inner" if planet_name in ("Mercury", "Venus") else "outer"
            )

            # Calculate apparent diameter at current distance
            if visibility.is_visible and visibility.max_altitude_time:
                try:
                    t_peak = self.calculator.ts.utc(
                        visibility.max_altitude_time.year,
                        visibility.max_altitude_time.month,
                        visibility.max_altitude_time.day,
                        visibility.max_altitude_time.hour,
                        visibility.max_altitude_time.minute,
                    )
                    earth = self.calculator.earth
                    astrometric = earth.at(t_peak).observe(planet_obj)
                    distance_au = astrometric.distance().au
                    visibility.apparent_diameter_arcsec = (
                        calculate_planet_apparent_diameter(distance_au, planet_name)
                    )
                    # Add min/max range from table
                    if planet_name in PLANET_APPARENT_DIAMETERS:
                        visibility.apparent_diameter_min = float(
                            PLANET_APPARENT_DIAMETERS[planet_name]["min"]
                        )
                        visibility.apparent_diameter_max = float(
                            PLANET_APPARENT_DIAMETERS[planet_name]["max"]
                        )
                except Exception:
                    pass  # Skip if calculation fails

            planet_visibility.append(visibility)

        # Analyze DSOs from OpenNGC
        dso_visibility = []
        for dso in self.catalog.get_all_dsos(
            max_magnitude=self.dso_mag, verbose=self.verbose
        ):
            star_obj = self.catalog.ra_dec_to_star(dso)
            visibility = self.calculator.calculate_object_visibility(
                star_obj,
                dso.common_name or dso.name,
                "dso",
                night_info,
            )
            # Format name: "Common Name (NGC xxx)" or just "NGC xxx"
            if dso.common_name:
                visibility.object_name = f"{dso.common_name} ({dso.name})"
            else:
                visibility.object_name = dso.name
            visibility.magnitude = dso.magnitude
            visibility.subtype = dso.dso_subtype
            visibility.angular_size_arcmin = dso.angular_size_arcmin
            visibility.surface_brightness = dso.surface_brightness
            visibility.ra_hours = dso.ra_hours
            visibility.common_name = dso.common_name
            dso_visibility.append(visibility)

        # Analyze comets (use pre-computed skyfield objects and coarse sampling)
        comet_visibility = []
        for comet in self.comets:
            try:
                # Use pre-computed skyfield object if available
                comet_obj = getattr(comet, "skyfield_obj", None)
                if comet_obj is None:
                    comet_obj = self.calculator.create_comet(comet.row)

                visibility = self.calculator.calculate_object_visibility(
                    comet_obj,
                    comet.designation,
                    "comet",
                    night_info,
                    coarse=True,
                )
                # Use calculated apparent magnitude (computed in _load_filtered_comets)
                # Fall back to absolute magnitude if apparent not available
                visibility.magnitude = getattr(
                    comet, "apparent_magnitude", comet.magnitude_g
                )
                visibility.subtype = (
                    "interstellar" if comet.is_interstellar else "comet"
                )
                if comet.is_interstellar:
                    # Interstellar objects: "Interstellar Name (Designation)"
                    visibility.object_name = (
                        f"Interstellar {comet.name} ({comet.designation})"
                    )
                    visibility.is_interstellar = True
                else:
                    # Regular comets: "Comet Name (Designation)"
                    visibility.object_name = f"Comet {comet.name} ({comet.designation})"
                comet_visibility.append(visibility)
            except Exception:
                # Skip comets that fail to compute (rare edge cases)
                continue

        # Analyze dwarf planets
        dwarf_planet_visibility = []
        for dp in self.dwarf_planets:
            try:
                # Create skyfield object from MPC data
                dp_obj = getattr(dp, "skyfield_obj", None)
                if dp_obj is None and dp.row is not None:
                    from skyfield.constants import GM_SUN_Pitjeva_2005_km3_s2 as GM_SUN
                    from skyfield.data import mpc

                    dp.skyfield_obj = self.calculator.sun + mpc.mpcorb_orbit(
                        dp.row, self.calculator.ts, GM_SUN
                    )
                    dp_obj = dp.skyfield_obj

                if dp_obj is not None:
                    visibility = self.calculator.calculate_object_visibility(
                        dp_obj,
                        dp.name,
                        "dwarf_planet",
                        night_info,
                        coarse=True,
                    )
                    visibility.magnitude = dp.magnitude_h
                    visibility.subtype = "dwarf_planet"

                    # Calculate apparent diameter
                    if visibility.is_visible and visibility.max_altitude_time:
                        try:
                            t_peak = self.calculator.ts.utc(
                                visibility.max_altitude_time.year,
                                visibility.max_altitude_time.month,
                                visibility.max_altitude_time.day,
                                visibility.max_altitude_time.hour,
                                visibility.max_altitude_time.minute,
                            )
                            earth = self.calculator.earth
                            astrometric = earth.at(t_peak).observe(dp_obj)
                            distance_au = astrometric.distance().au
                            visibility.apparent_diameter_arcsec = (
                                calculate_small_body_apparent_diameter(
                                    distance_au, dp.name
                                )
                            )
                            # Calculate min/max from orbital parameters (approximate)
                            if dp.name in SMALL_BODY_DIAMETERS:
                                # Use typical perihelion/aphelion distances for range
                                # For simplicity, use ±30% of current distance
                                visibility.apparent_diameter_min = (
                                    visibility.apparent_diameter_arcsec * 0.7
                                )
                                visibility.apparent_diameter_max = (
                                    visibility.apparent_diameter_arcsec * 1.3
                                )
                        except Exception:
                            pass

                    dwarf_planet_visibility.append(visibility)
            except Exception:
                continue

        # Analyze asteroids
        asteroid_visibility = []
        for ast in self.asteroids:
            try:
                ast_obj = getattr(ast, "skyfield_obj", None)
                if ast_obj is None and ast.row is not None:
                    from skyfield.constants import GM_SUN_Pitjeva_2005_km3_s2 as GM_SUN
                    from skyfield.data import mpc

                    ast.skyfield_obj = self.calculator.sun + mpc.mpcorb_orbit(
                        ast.row, self.calculator.ts, GM_SUN
                    )
                    ast_obj = ast.skyfield_obj

                if ast_obj is not None:
                    visibility = self.calculator.calculate_object_visibility(
                        ast_obj,
                        ast.name,
                        "asteroid",
                        night_info,
                        coarse=True,
                    )
                    visibility.magnitude = ast.magnitude_h
                    visibility.subtype = "asteroid"

                    # Calculate apparent diameter
                    if visibility.is_visible and visibility.max_altitude_time:
                        try:
                            t_peak = self.calculator.ts.utc(
                                visibility.max_altitude_time.year,
                                visibility.max_altitude_time.month,
                                visibility.max_altitude_time.day,
                                visibility.max_altitude_time.hour,
                                visibility.max_altitude_time.minute,
                            )
                            earth = self.calculator.earth
                            astrometric = earth.at(t_peak).observe(ast_obj)
                            distance_au = astrometric.distance().au
                            visibility.apparent_diameter_arcsec = (
                                calculate_small_body_apparent_diameter(
                                    distance_au, ast.name
                                )
                            )
                            # Calculate min/max from orbital parameters (approximate)
                            if ast.name in SMALL_BODY_DIAMETERS:
                                # Use typical perihelion/aphelion distances for range
                                visibility.apparent_diameter_min = (
                                    visibility.apparent_diameter_arcsec * 0.7
                                )
                                visibility.apparent_diameter_max = (
                                    visibility.apparent_diameter_arcsec * 1.3
                                )
                        except Exception:
                            pass

                    asteroid_visibility.append(visibility)
            except Exception:
                continue

        # Analyze Milky Way core
        milky_way_star = self.catalog.ra_dec_to_star(self.catalog.milky_way)
        milky_way_visibility = self.calculator.calculate_object_visibility(
            milky_way_star,
            "Milky Way Core",
            "milky_way",
            night_info,
        )
        milky_way_visibility.subtype = "milky_way"

        # Analyze Moon
        moon_visibility = self.calculator.calculate_object_visibility(
            self.calculator.moon,
            "Moon",
            "moon",
            night_info,
        )

        # Get weather data if available
        weather = None
        if weather_forecast:
            weather = weather_forecast.get_night_weather(
                date,
                night_info.astronomical_dusk,
                night_info.astronomical_dawn,
            )

        # Detect conjunctions
        conjunctions = self._detect_conjunctions(
            planet_visibility, comet_visibility, night_info
        )

        # Detect meteor showers
        meteor_showers = self._detect_meteor_showers(night_info, moon_visibility)

        return NightForecast(
            night_info=night_info,
            planets=planet_visibility,
            dsos=dso_visibility,
            comets=comet_visibility,
            dwarf_planets=dwarf_planet_visibility,
            asteroids=asteroid_visibility,
            milky_way=milky_way_visibility,
            moon=moon_visibility,
            weather=weather,
            conjunctions=conjunctions,
            meteor_showers=meteor_showers,
        )

    def rank_objects_for_night(
        self,
        forecast: NightForecast,
        max_objects: int = 20,
        min_score: float = 60.0,
    ) -> List[ScoredObject]:
        """Rank objects by viewing quality using professional scoring algorithm.

        Uses merit-based scoring that considers:
        - Imaging quality (altitude, moon, timing, weather)
        - Object characteristics (surface brightness, magnitude, type suitability)
        - Priority/rarity bonus (transient events, seasonal window)

        Args:
            forecast: Night forecast
            max_objects: Maximum objects to return
            min_score: Minimum score threshold

        Returns:
            List of ScoredObject instances, sorted by score (highest first)
        """
        all_scored = []

        # Get observation window
        window_start = forecast.night_info.astronomical_dusk
        window_end = forecast.night_info.astronomical_dawn
        if window_end <= window_start:
            window_end = window_end + timedelta(days=1)

        observation_date = forecast.night_info.date
        moon_illumination = forecast.night_info.moon_illumination
        cloud_cover = forecast.weather.avg_cloud_cover if forecast.weather else None
        aod = forecast.weather.avg_aerosol_optical_depth if forecast.weather else None
        precip_prob = (
            forecast.weather.max_precip_probability if forecast.weather else None
        )

        # Score planets
        for planet in forecast.planets:
            if planet.is_visible and planet.max_altitude >= 30:
                scored = score_object(
                    visibility=planet,
                    category="planet",
                    subtype=planet.subtype,
                    moon_illumination=moon_illumination,
                    observation_date=observation_date,
                    window_start=window_start,
                    window_end=window_end,
                    cloud_cover=cloud_cover,
                    aod=aod,
                    precip_probability=precip_prob,
                )
                all_scored.append(scored)

        # Score DSOs
        for dso in forecast.dsos:
            if dso.is_visible and dso.max_altitude >= 30:
                scored = score_object(
                    visibility=dso,
                    category="dso",
                    subtype=dso.subtype,
                    moon_illumination=moon_illumination,
                    observation_date=observation_date,
                    window_start=window_start,
                    window_end=window_end,
                    cloud_cover=cloud_cover,
                    aod=aod,
                    precip_probability=precip_prob,
                    ra_hours=dso.ra_hours,
                    common_name=dso.common_name,
                    surface_brightness=dso.surface_brightness,
                    angular_size=dso.angular_size_arcmin,
                )
                all_scored.append(scored)

        # Score comets
        for comet in forecast.comets:
            if comet.is_visible and comet.max_altitude >= 30:
                scored = score_object(
                    visibility=comet,
                    category="comet",
                    subtype=comet.subtype,
                    moon_illumination=moon_illumination,
                    observation_date=observation_date,
                    window_start=window_start,
                    window_end=window_end,
                    cloud_cover=cloud_cover,
                    aod=aod,
                    precip_probability=precip_prob,
                    is_interstellar=comet.is_interstellar,
                )
                all_scored.append(scored)

        # Score dwarf planets
        for dp in forecast.dwarf_planets:
            if dp.is_visible and dp.max_altitude >= 30:
                scored = score_object(
                    visibility=dp,
                    category="dwarf_planet",
                    subtype="dwarf_planet",
                    moon_illumination=moon_illumination,
                    observation_date=observation_date,
                    window_start=window_start,
                    window_end=window_end,
                    cloud_cover=cloud_cover,
                    aod=aod,
                    precip_probability=precip_prob,
                )
                all_scored.append(scored)

        # Score asteroids
        for ast in forecast.asteroids:
            if ast.is_visible and ast.max_altitude >= 30:
                scored = score_object(
                    visibility=ast,
                    category="asteroid",
                    subtype="asteroid",
                    moon_illumination=moon_illumination,
                    observation_date=observation_date,
                    window_start=window_start,
                    window_end=window_end,
                    cloud_cover=cloud_cover,
                    aod=aod,
                    precip_probability=precip_prob,
                )
                all_scored.append(scored)

        # Score Milky Way
        if forecast.milky_way.is_visible and forecast.milky_way.max_altitude >= 45:
            scored = score_object(
                visibility=forecast.milky_way,
                category="milky_way",
                subtype="milky_way",
                moon_illumination=moon_illumination,
                observation_date=observation_date,
                window_start=window_start,
                window_end=window_end,
                cloud_cover=cloud_cover,
                aod=aod,
                precip_probability=precip_prob,
            )
            all_scored.append(scored)

        # Select best objects using merit-based selection with soft caps
        selected = select_best_objects(
            all_scored,
            max_objects=max_objects,
            min_score=min_score,
            ensure_category_representation=True,
        )

        return selected

    def rank_objects_legacy(self, forecast: NightForecast) -> List[VisibilityScore]:
        """Legacy ranking method for backwards compatibility.

        Args:
            forecast: Night forecast

        Returns:
            List of VisibilityScore objects
        """
        scored = self.rank_objects_for_night(forecast)
        return [
            VisibilityScore(
                object_name=s.object_name,
                score=s.total_score,
                reason=s.reason,
            )
            for s in scored
        ]

    def _get_quality_description(self, altitude: float) -> str:
        """Get quality description based on altitude.

        Args:
            altitude: Maximum altitude in degrees

        Returns:
            Quality description string
        """
        if altitude >= 75:
            return "Excellent"
        elif altitude >= 60:
            return "Very Good"
        elif altitude >= 45:
            return "Good"
        else:
            return "Fair"

    def _detect_meteor_showers(
        self, night_info: NightInfo, moon: ObjectVisibility
    ) -> List[MeteorShower]:
        """Detect active meteor showers for the given night.

        Args:
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
                    peak_date = datetime(
                        date.year - 1, shower.peak_month, shower.peak_day
                    )

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
                t_mid = self.calculator.ts.utc(
                    mid_night.year,
                    mid_night.month,
                    mid_night.day,
                    mid_night.hour,
                    mid_night.minute,
                )

                # Create a star at radiant position
                from skyfield.api import Star

                radiant = Star(
                    ra_hours=shower.radiant_ra_deg / 15.0,
                    dec_degrees=shower.radiant_dec_deg,
                )

                observer = self.calculator.earth + self.calculator.location
                alt = observer.at(t_mid).observe(radiant).apparent().altaz()[0].degrees

                # Calculate moon separation
                moon_pos = observer.at(t_mid).observe(self.calculator.moon)
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

    def _detect_conjunctions(
        self,
        planets: List[ObjectVisibility],
        comets: List[ObjectVisibility],
        night_info: NightInfo,
    ) -> List[Conjunction]:
        """Detect close approaches between bright objects.

        Args:
            planets: List of visible planets
            comets: List of visible comets
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

        t_mid = self.calculator.ts.utc(
            mid_night.year,
            mid_night.month,
            mid_night.day,
            mid_night.hour,
            mid_night.minute,
        )
        earth = self.calculator.earth
        observer = earth + self.calculator.location

        # Check planet-planet conjunctions
        for i, p1 in enumerate(visible_planets):
            for p2 in visible_planets[i + 1 :]:
                try:
                    obj1 = self.planets.get(p1.object_name)
                    obj2 = self.planets.get(p2.object_name)
                    if obj1 is None or obj2 is None:
                        continue

                    pos1 = observer.at(t_mid).observe(obj1)
                    pos2 = observer.at(t_mid).observe(obj2)
                    sep = pos1.separation_from(pos2).degrees

                    if sep < 10:  # Notable if within 10 degrees
                        desc = (
                            f"{p1.object_name} and {p2.object_name} within {sep:.1f}°"
                        )
                        if sep < 2:
                            desc = f"Close conjunction: {p1.object_name} and {p2.object_name} only {sep:.1f}° apart!"
                        elif sep < 5:
                            desc = (
                                f"{p1.object_name} near {p2.object_name} ({sep:.1f}°)"
                            )

                        conjunctions.append(
                            Conjunction(
                                object1_name=p1.object_name,
                                object2_name=p2.object_name,
                                separation_degrees=sep,
                                time=mid_night,
                                description=desc,
                            )
                        )
                except Exception:
                    continue

        # Check planet-Moon conjunctions
        moon = self.calculator.moon
        for p in visible_planets:
            try:
                obj = self.planets.get(p.object_name)
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
            except Exception:
                continue

        # Sort by separation (closest first)
        conjunctions.sort(key=lambda c: c.separation_degrees)

        return conjunctions

    def get_best_dark_nights(self, forecasts: List[NightForecast]) -> List[int]:
        """Identify the best nights for DSO imaging (darkest + clearest nights).

        Args:
            forecasts: List of night forecasts

        Returns:
            List of night indices (0-based) sorted by quality (best first)
        """
        night_scores = []

        for i, forecast in enumerate(forecasts):
            # Base score on moon illumination (lower moon = higher score)
            moon_score = 100 - forecast.night_info.moon_illumination

            # If weather data available, factor in cloud cover
            if forecast.weather:
                # Cloud score (lower clouds = higher score)
                cloud_score = 100 - forecast.weather.avg_cloud_cover
                # Weight clouds heavily (70%) since they block everything
                combined_score = (cloud_score * 0.7) + (moon_score * 0.3)
            else:
                # No weather data, use moon only
                combined_score = moon_score

            night_scores.append((i, combined_score))

        # Sort by combined score (highest = best)
        night_scores.sort(key=lambda x: x[1], reverse=True)

        return [i for i, _ in night_scores]
