"""Analyze visibility of celestial objects over multiple nights."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional

from catalog import Catalog
from sky_calculator import NightInfo, ObjectVisibility, SkyCalculator
from weather import NightWeather, WeatherForecast


@dataclass
class NightForecast:
    """Forecast for a single night."""

    night_info: NightInfo
    planets: List[ObjectVisibility]
    dsos: List[ObjectVisibility]
    comets: List[ObjectVisibility]  # Bright comets visible tonight
    milky_way: ObjectVisibility
    moon: ObjectVisibility
    weather: Optional[NightWeather]  # None if weather data unavailable


@dataclass
class VisibilityScore:
    """Score for ranking objects by viewing quality."""

    object_name: str
    score: float
    reason: str


class VisibilityAnalyzer:
    """Analyze celestial object visibility over multiple nights."""

    def __init__(self, latitude: float, longitude: float, comet_mag: float = 12.0):
        """Initialize the analyzer.

        Args:
            latitude: Observer latitude in degrees
            longitude: Observer longitude in degrees
            comet_mag: Maximum comet magnitude to include (default: 12.0)
        """
        self.calculator = SkyCalculator(latitude, longitude)
        self.catalog = Catalog()
        self.latitude = latitude
        self.comet_mag = comet_mag

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

        # Load and pre-filter comets by declination (one-time cost)
        self.comets = self._load_filtered_comets()

    def _load_filtered_comets(self, min_useful_alt: float = 30.0):
        """Load comets and filter by declination to remove those that can never reach useful altitude.

        This pre-filtering reduces the number of comets that need full visibility calculations,
        providing significant speedup for multi-night forecasts.
        """
        all_comets = self.catalog.load_bright_comets(max_magnitude=self.comet_mag)
        if not all_comets:
            return []

        # Get reference time for declination check
        t_ref = self.calculator.ts.utc(2026, 1, 1, 0)  # Any reference time works

        filtered = []
        for comet in all_comets:
            try:
                comet_obj = self.calculator.create_comet(comet.row)
                astrometric = self.calculator.earth.at(t_ref).observe(comet_obj)
                ra, dec, dist = astrometric.radec()

                # Max possible altitude = 90 - |latitude - declination|
                max_possible_alt = 90 - abs(self.latitude - dec.degrees)

                if max_possible_alt >= min_useful_alt:
                    # Store pre-computed comet object for reuse
                    comet.skyfield_obj = comet_obj
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
            planet_visibility.append(visibility)

        # Analyze DSOs
        dso_visibility = []
        for dso in self.catalog.get_all_dsos():
            star_obj = self.catalog.ra_dec_to_star(dso)
            visibility = self.calculator.calculate_object_visibility(
                star_obj,
                dso.common_name,
                "dso",
                night_info,
            )
            # Name-first format (consistent with comets): "Pinwheel Galaxy (M101)"
            visibility.object_name = f"{dso.common_name} ({dso.name})"
            visibility.magnitude = dso.magnitude
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
                # Add magnitude and set name format (name-first style)
                visibility.magnitude = comet.magnitude_g
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

        # Analyze Milky Way core
        milky_way_star = self.catalog.ra_dec_to_star(self.catalog.milky_way)
        milky_way_visibility = self.calculator.calculate_object_visibility(
            milky_way_star,
            "Milky Way Core",
            "milky_way",
            night_info,
        )

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

        return NightForecast(
            night_info=night_info,
            planets=planet_visibility,
            dsos=dso_visibility,
            comets=comet_visibility,
            milky_way=milky_way_visibility,
            moon=moon_visibility,
            weather=weather,
        )

    def rank_objects_for_night(self, forecast: NightForecast) -> List[VisibilityScore]:
        """Rank objects by viewing quality for a specific night.

        Scoring combines:
        - Object priority/importance
        - Peak altitude
        - Moon interference

        Args:
            forecast: Night forecast

        Returns:
            List of VisibilityScore objects, sorted by score (highest first)
        """
        scores = []

        # Score planets
        for planet in forecast.planets:
            if planet.is_visible and planet.max_altitude >= 30:
                # Base score for planets
                base_score = 100

                # Altitude bonus (max +50)
                altitude_bonus = min(planet.max_altitude / 2, 50)

                # Priority bonus (bright planets)
                priority_bonus = 0
                if planet.object_name in ["Jupiter", "Saturn", "Mars", "Venus"]:
                    priority_bonus = 30

                total_score = base_score + altitude_bonus + priority_bonus

                reason = self._get_quality_description(planet.max_altitude)
                scores.append(
                    VisibilityScore(
                        object_name=planet.object_name,
                        score=total_score,
                        reason=reason,
                    )
                )

        # Score DSOs
        for dso in forecast.dsos:
            if dso.is_visible and dso.max_altitude >= 30:
                # Base score for DSOs
                base_score = 80

                # Altitude bonus (max +50)
                altitude_bonus = min(dso.max_altitude / 2, 50)

                # Moon penalty
                moon_penalty = 0
                if dso.moon_warning:
                    moon_penalty = 40

                total_score = base_score + altitude_bonus - moon_penalty

                # Only include if score is positive
                if total_score > 0:
                    reason = self._get_quality_description(dso.max_altitude)
                    if dso.moon_warning:
                        reason += " (moon interference)"

                    scores.append(
                        VisibilityScore(
                            object_name=dso.object_name,
                            score=total_score,
                            reason=reason,
                        )
                    )

        # Score comets (high priority - transient events!)
        for comet in forecast.comets:
            if (
                comet.is_visible and comet.max_altitude >= 30
            ):  # Lower threshold for comets
                # High base score for comets (rare, transient)
                base_score = 120

                # Extra bonus for interstellar objects!
                if comet.is_interstellar:
                    base_score = 150

                # Altitude bonus (max +50)
                altitude_bonus = min(comet.max_altitude / 2, 50)

                # Moon penalty (comets often faint)
                moon_penalty = 0
                if comet.moon_warning:
                    moon_penalty = 30

                total_score = base_score + altitude_bonus - moon_penalty

                if total_score > 0:
                    reason = self._get_quality_description(comet.max_altitude)
                    if comet.moon_warning:
                        reason += " (moon interference)"
                    if comet.is_interstellar:
                        reason += " - INTERSTELLAR!"

                    scores.append(
                        VisibilityScore(
                            object_name=comet.object_name,
                            score=total_score,
                            reason=reason,
                        )
                    )

        # Score Milky Way
        if forecast.milky_way.is_visible and forecast.milky_way.max_altitude >= 45:
            # Base score
            base_score = 70

            # Altitude bonus
            altitude_bonus = min(forecast.milky_way.max_altitude / 2, 50)

            # Moon penalty (Milky Way very sensitive to moonlight)
            moon_penalty = 0
            if forecast.night_info.moon_illumination > 30:
                moon_penalty = 50

            total_score = base_score + altitude_bonus - moon_penalty

            if total_score > 0:
                reason = self._get_quality_description(forecast.milky_way.max_altitude)
                if forecast.night_info.moon_illumination > 30:
                    reason += " (moon interference)"

                scores.append(
                    VisibilityScore(
                        object_name="Milky Way Core",
                        score=total_score,
                        reason=reason,
                    )
                )

        # Sort by score (highest first)
        scores.sort(key=lambda x: x.score, reverse=True)

        return scores

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
