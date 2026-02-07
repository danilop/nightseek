"""Enums and type definitions for NightSeek.

Provides type-safe enumerations for object categories, subtypes, and other constants.
"""

from enum import Enum


class ObjectCategory(str, Enum):
    """Category of celestial object."""

    PLANET = "planet"
    DSO = "dso"
    COMET = "comet"
    DWARF_PLANET = "dwarf_planet"
    ASTEROID = "asteroid"
    MILKY_WAY = "milky_way"
    MOON = "moon"


class PlanetSubtype(str, Enum):
    """Subtype for planets."""

    INNER = "inner"  # Mercury, Venus
    OUTER = "outer"  # Mars, Jupiter, Saturn, Uranus, Neptune


class CometSubtype(str, Enum):
    """Subtype for comets."""

    COMET = "comet"
    INTERSTELLAR = "interstellar"  # Hyperbolic orbit (e > 1)


class DSOSubtype(str, Enum):
    """Deep sky object subtypes from OpenNGC catalog."""

    # Galaxies
    GALAXY = "galaxy"
    GALAXY_PAIR = "galaxy_pair"
    GALAXY_TRIPLET = "galaxy_triplet"
    GALAXY_GROUP = "galaxy_group"

    # Nebulae
    EMISSION_NEBULA = "emission_nebula"
    REFLECTION_NEBULA = "reflection_nebula"
    PLANETARY_NEBULA = "planetary_nebula"
    SUPERNOVA_REMNANT = "supernova_remnant"
    NEBULA = "nebula"  # Generic nebula
    HII_REGION = "hii_region"

    # Clusters
    OPEN_CLUSTER = "open_cluster"
    GLOBULAR_CLUSTER = "globular_cluster"

    # Stars and associations
    DOUBLE_STAR = "double_star"
    ASTERISM = "asterism"
    STAR_ASSOCIATION = "star_association"

    # Dark objects
    DARK_NEBULA = "dark_nebula"

    # Other
    OTHER = "other"


class MinorPlanetCategory(str, Enum):
    """Category for minor planets."""

    DWARF_PLANET = "dwarf_planet"
    ASTEROID = "asteroid"


class WeatherCategory(str, Enum):
    """Weather quality categories for observation."""

    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    BAD = "bad"


# Mapping from OpenNGC type codes to DSOSubtype
OPENGC_TYPE_TO_SUBTYPE: dict[str, DSOSubtype] = {
    "G": DSOSubtype.GALAXY,
    "GPair": DSOSubtype.GALAXY_PAIR,
    "GTrpl": DSOSubtype.GALAXY_TRIPLET,
    "GGroup": DSOSubtype.GALAXY_GROUP,
    "PN": DSOSubtype.PLANETARY_NEBULA,
    "HII": DSOSubtype.HII_REGION,
    "EmN": DSOSubtype.EMISSION_NEBULA,
    "RfN": DSOSubtype.REFLECTION_NEBULA,
    "SNR": DSOSubtype.SUPERNOVA_REMNANT,
    "Neb": DSOSubtype.NEBULA,
    "OCl": DSOSubtype.OPEN_CLUSTER,
    "GCl": DSOSubtype.GLOBULAR_CLUSTER,
    "Cl+N": DSOSubtype.OPEN_CLUSTER,  # Cluster with nebulosity
    "Ast": DSOSubtype.ASTERISM,
    "DN": DSOSubtype.DARK_NEBULA,
}
