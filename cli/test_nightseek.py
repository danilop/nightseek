"""Tests for nightseek astronomy observation planning tool."""

from datetime import datetime, timezone

from catalog import Catalog, CelestialObject, Comet
from formatter import ForecastFormatter
from analyzer import VisibilityAnalyzer
from event_detection import detect_meteor_showers
from scoring import calculate_solar_ra_hours
from sky_calculator import SkyCalculator, calculate_hg_magnitude


class TestCatalog:
    """Tests for the Catalog class."""

    def test_dso_catalog_not_empty(self):
        """DSO catalog should contain objects."""
        catalog = Catalog()
        dsos = catalog.get_all_dsos()
        assert len(dsos) > 0

    def test_dso_has_required_fields(self):
        """Each DSO should have all required fields."""
        catalog = Catalog()
        for dso in catalog.get_all_dsos():
            assert dso.name, "DSO should have a name (NGC/IC designation)"
            # common_name is optional - many NGC/IC objects only have catalog designation
            # If no common_name, the name field (NGC xxx or IC xxx) serves as identifier
            assert dso.obj_type == "dso", "DSO type should be 'dso'"
            assert 0 <= dso.ra_hours <= 24, "RA should be 0-24 hours"
            assert -90 <= dso.dec_degrees <= 90, "Dec should be -90 to 90 degrees"
            assert 1 <= dso.priority <= 5, "Priority should be 1-5"

    def test_milky_way_coordinates(self):
        """Milky Way core should have correct approximate coordinates."""
        catalog = Catalog()
        mw = catalog.milky_way
        # Sagittarius A* is approximately at RA 17h 45m, Dec -29°
        assert 17 < mw.ra_hours < 18, "Milky Way RA should be near 17-18h"
        assert -30 < mw.dec_degrees < -28, "Milky Way Dec should be near -29°"

    def test_priority_filter(self):
        """get_priority_dsos should filter by priority level."""
        catalog = Catalog()
        priority_1 = catalog.get_priority_dsos(max_priority=1)
        priority_2 = catalog.get_priority_dsos(max_priority=2)
        all_dsos = catalog.get_all_dsos()

        assert len(priority_1) <= len(priority_2) <= len(all_dsos)
        assert all(dso.priority <= 1 for dso in priority_1)
        assert all(dso.priority <= 2 for dso in priority_2)


class TestCometNameParsing:
    """Tests for comet name/designation parsing logic."""

    def test_parse_long_period_comet_with_name(self):
        """Long-period comet with name in parentheses."""
        # Format: "C/2023 A3 (Tsuchinshan-ATLAS)"
        full = "C/2023 A3 (Tsuchinshan-ATLAS)"

        if "(" in full and ")" in full:
            paren_start = full.index("(")
            code = full[:paren_start].strip()
            name = full[paren_start + 1 : full.rindex(")")]
        else:
            code = full
            name = full

        assert code == "C/2023 A3"
        assert name == "Tsuchinshan-ATLAS"

    def test_parse_periodic_comet(self):
        """Periodic comet with format like 186P/Garradd."""
        full = "186P/Garradd"

        if "(" in full and ")" in full:
            paren_start = full.index("(")
            code = full[:paren_start].strip()
            name = full[paren_start + 1 : full.rindex(")")]
        elif "/" in full:
            parts = full.split("/", 1)
            code = parts[0]
            name = parts[1] if len(parts) > 1 else full
        else:
            code = full
            name = full

        assert code == "186P"
        assert name == "Garradd"

    def test_parse_interstellar_object(self):
        """Interstellar object with format like 2I/Borisov."""
        full = "2I/Borisov"

        if "/" in full:
            parts = full.split("/", 1)
            code = parts[0]
            name = parts[1]
        else:
            code = full
            name = full

        assert code == "2I"
        assert name == "Borisov"


class TestForecastFormatter:
    """Tests for the ForecastFormatter class."""

    def test_weather_category_excellent(self):
        """Cloud cover < 10% should be 'excellent'."""
        cat, desc, color = ForecastFormatter._get_weather_category(5)
        assert cat == "excellent"
        assert desc == "Excellent"
        assert color == "green"

    def test_weather_category_good(self):
        """Cloud cover 10-25% should be 'good'."""
        cat, desc, color = ForecastFormatter._get_weather_category(15)
        assert cat == "good"
        assert desc == "Good"
        assert color == "green"

    def test_weather_category_fair(self):
        """Cloud cover 25-40% should be 'fair'."""
        cat, desc, color = ForecastFormatter._get_weather_category(30)
        assert cat == "fair"
        assert desc == "Fair"
        assert color == "yellow"

    def test_weather_category_poor(self):
        """Cloud cover 40-60% should be 'poor'."""
        cat, desc, color = ForecastFormatter._get_weather_category(50)
        assert cat == "poor"
        assert desc == "Poor"
        assert color == "yellow"

    def test_weather_category_bad(self):
        """Cloud cover >= 60% should be 'bad'."""
        cat, desc, color = ForecastFormatter._get_weather_category(80)
        assert cat == "bad"
        assert desc == "Cloudy"
        assert color == "red"

    def test_planet_magnitude_uses_epoch_geometry(self):
        """Planet brightness should come from geometry, not a fixed lookup."""
        from skyfield.magnitudelib import planetary_magnitude

        calculator = SkyCalculator(51.5074, -0.1278)
        january = calculator.ts.utc(2026, 1, 1)
        july = calculator.ts.utc(2026, 7, 1)
        january_mars = planetary_magnitude(
            calculator.earth.at(january).observe(calculator.mars)
        )
        july_mars = planetary_magnitude(
            calculator.earth.at(july).observe(calculator.mars)
        )

        assert abs(float(january_mars) - float(july_mars)) > 0.1


class TestMeteorShowers:
    """Meteor timing uses annual solar-longitude geometry."""

    def test_quadrantids_in_late_december_use_the_upcoming_january_peak(self):
        calculator = SkyCalculator(51.5074, -0.1278)
        night = calculator.get_night_info(datetime(2026, 12, 30))
        moon = calculator.calculate_object_visibility(
            calculator.moon, "Moon", "moon", night
        )

        showers = detect_meteor_showers(calculator, night, moon)
        quadrantids = next(shower for shower in showers if shower.code == "QUA")

        assert quadrantids.days_from_peak is not None
        assert -5 < quadrantids.days_from_peak < 0
        assert quadrantids.radiant_ra_deg < 230.0


class TestVisibilityAnalyzer:
    """Tests for the VisibilityAnalyzer class."""

    def test_quality_description_excellent(self):
        """Altitude >= 75° should be 'Excellent'."""
        analyzer = VisibilityAnalyzer(45.0, -122.0)
        assert analyzer._get_quality_description(75) == "Excellent"
        assert analyzer._get_quality_description(90) == "Excellent"

    def test_quality_description_very_good(self):
        """Altitude 60-74° should be 'Very Good'."""
        analyzer = VisibilityAnalyzer(45.0, -122.0)
        assert analyzer._get_quality_description(60) == "Very Good"
        assert analyzer._get_quality_description(74) == "Very Good"

    def test_quality_description_good(self):
        """Altitude 45-59° should be 'Good'."""
        analyzer = VisibilityAnalyzer(45.0, -122.0)
        assert analyzer._get_quality_description(45) == "Good"
        assert analyzer._get_quality_description(59) == "Good"

    def test_quality_description_fair(self):
        """Altitude < 45° should be 'Fair'."""
        analyzer = VisibilityAnalyzer(45.0, -122.0)
        assert analyzer._get_quality_description(30) == "Fair"
        assert analyzer._get_quality_description(44) == "Fair"


class TestNightBoundaries:
    """Civil-night and polar-condition regressions."""

    def test_requested_night_is_anchored_to_observer_local_noon(self):
        calculator = SkyCalculator(-36.8485, 174.7633)  # Auckland
        night = calculator.get_night_info(datetime(2026, 7, 16))

        local_sunset = night.sunset.astimezone(calculator.timezone)
        local_sunrise = night.sunrise.astimezone(calculator.timezone)
        assert local_sunset.date().isoformat() == "2026-07-16"
        assert local_sunrise.date().isoformat() == "2026-07-17"
        assert night.astronomical_night_mode == "normal"

    def test_midnight_sun_has_no_astronomical_observing_window(self):
        calculator = SkyCalculator(69.6492, 18.9553)  # Tromso
        night = calculator.get_night_info(datetime(2026, 6, 21))

        assert night.astronomical_night_mode == "none"
        assert night.astronomical_dusk == night.astronomical_dawn
        assert not night.sunset_occurs


class TestPrecisionRegressions:
    """Independent and invariant-based astronomy regressions."""

    def test_ceres_matches_jpl_horizons(self):
        calculator = SkyCalculator(0, 0)
        ceres = next(
            body for body in Catalog().load_dwarf_planets() if body.name == "Ceres"
        )
        ceres_object = calculator.create_minor_planet(ceres)
        when = datetime(2026, 7, 16, tzinfo=timezone.utc)
        ra, dec, distance = (
            calculator.earth.at(calculator.ts.from_datetime(when))
            .observe(ceres_object)
            .radec()
        )

        # JPL Horizons geocentric ICRF observer ephemeris (solution 48/DE441).
        assert abs(ra.hours * 15 - 78.270079573) < 0.001
        assert abs(dec.degrees - 21.090624255) < 0.001
        assert abs(distance.au - 3.51684237480505) < 0.00001

    def test_hg_model_includes_distance_and_phase_dimming(self):
        opposition = calculate_hg_magnitude(3.2, 0.32, 2.4, 1.4, 0)
        phased = calculate_hg_magnitude(3.2, 0.32, 2.4, 1.4, 30)

        assert opposition > 3.2
        assert phased > opposition

    def test_seasonal_solar_ra_agrees_with_jpl_ephemeris(self):
        calculator = SkyCalculator(0, 0)
        for when in (
            datetime(2026, 1, 15, tzinfo=timezone.utc),
            datetime(2026, 7, 15, tzinfo=timezone.utc),
        ):
            skyfield_ra = (
                calculator.earth.at(calculator.ts.from_datetime(when))
                .observe(calculator.sun)
                .apparent()
                .radec(epoch="date")[0]
                .hours
            )
            delta_hours = abs(calculate_solar_ra_hours(when) - skyfield_ra)
            delta_hours = min(delta_hours, 24 - delta_hours)
            assert delta_hours < 0.01

    def test_altitude_threshold_times_are_interpolated(self):
        from skyfield.api import Star

        calculator = SkyCalculator(51.5074, -0.1278)
        night = calculator.get_night_info(datetime(2026, 8, 16))
        altair = Star(ra_hours=19.8464, dec_degrees=8.8683)
        visibility = calculator.calculate_object_visibility(
            altair, "Altair", "star", night
        )

        assert visibility.above_45_start is not None
        assert visibility.above_45_end is not None
        observer = calculator.earth + calculator.location
        checked_crossings = 0
        for boundary in (visibility.above_45_start, visibility.above_45_end):
            if boundary in (night.astronomical_dusk, night.astronomical_dawn):
                continue
            altitude = (
                observer.at(calculator.ts.from_datetime(boundary))
                .observe(altair)
                .apparent()
                .altaz()[0]
                .degrees
            )
            assert abs(altitude - 45) < 0.1
            checked_crossings += 1
        assert checked_crossings > 0


class TestCelestialObject:
    """Tests for the CelestialObject dataclass."""

    def test_celestial_object_creation(self):
        """CelestialObject should be created with all fields."""
        obj = CelestialObject(
            name="M31",
            common_name="Andromeda Galaxy",
            obj_type="dso",
            ra_hours=0.712,
            dec_degrees=41.269,
            magnitude=3.4,
            priority=1,
        )
        assert obj.name == "M31"
        assert obj.common_name == "Andromeda Galaxy"
        assert obj.magnitude == 3.4


class TestComet:
    """Tests for the Comet dataclass."""

    def test_comet_creation(self):
        """Comet should be created with all required fields."""
        comet = Comet(
            designation="C/2023 A3",
            name="Tsuchinshan-ATLAS",
            magnitude_g=4.5,
            is_interstellar=False,
            row=None,
        )
        assert comet.designation == "C/2023 A3"
        assert comet.name == "Tsuchinshan-ATLAS"
        assert comet.is_interstellar is False

    def test_interstellar_comet(self):
        """Interstellar comet should have is_interstellar=True."""
        comet = Comet(
            designation="2I",
            name="Borisov",
            magnitude_g=8.0,
            is_interstellar=True,
            row=None,
        )
        assert comet.is_interstellar is True
