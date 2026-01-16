"""Tests for nightseek astronomy observation planning tool."""

from catalog import Catalog, CelestialObject, Comet
from formatter import ForecastFormatter
from analyzer import VisibilityAnalyzer


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
            assert dso.name, "DSO should have a name"
            assert dso.common_name, "DSO should have a common name"
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

    def test_weather_category_clear(self):
        """Cloud cover < 30% should be 'clear'."""
        cat, desc, color = ForecastFormatter._get_weather_category(10)
        assert cat == "clear"
        assert desc == "Clear"
        assert color == "green"

    def test_weather_category_partly(self):
        """Cloud cover 30-60% should be 'partly'."""
        cat, desc, color = ForecastFormatter._get_weather_category(45)
        assert cat == "partly"
        assert "Partly cloudy" in desc
        assert color == "yellow"

    def test_weather_category_cloudy(self):
        """Cloud cover >= 60% should be 'cloudy'."""
        cat, desc, color = ForecastFormatter._get_weather_category(80)
        assert cat == "cloudy"
        assert "Cloudy" in desc
        assert color == "red"

    def test_weather_category_boundary_30(self):
        """Boundary at 30% should be 'partly'."""
        cat, _, _ = ForecastFormatter._get_weather_category(30)
        assert cat == "partly"

    def test_weather_category_boundary_60(self):
        """Boundary at 60% should be 'cloudy'."""
        cat, _, _ = ForecastFormatter._get_weather_category(60)
        assert cat == "cloudy"

    def test_planet_magnitudes_defined(self):
        """All major planets should have magnitudes defined."""
        expected_planets = [
            "Mercury",
            "Venus",
            "Mars",
            "Jupiter",
            "Saturn",
            "Uranus",
            "Neptune",
        ]
        for planet in expected_planets:
            assert planet in ForecastFormatter.PLANET_MAGNITUDES
            assert isinstance(ForecastFormatter.PLANET_MAGNITUDES[planet], (int, float))


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
