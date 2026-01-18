"""Astronomical events calendar (meteor showers, etc.)."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class MeteorShower:
    """A meteor shower event."""

    name: str
    code: str  # IAU three-letter code
    peak_month: int
    peak_day: int
    start_month: int
    start_day: int
    end_month: int
    end_day: int
    zhr: int  # Zenithal Hourly Rate at peak
    radiant_ra_deg: float  # Right ascension in degrees
    radiant_dec_deg: float  # Declination in degrees
    velocity_kms: float  # Entry velocity in km/s
    parent_object: str

    # Calculated fields (set during analysis)
    is_active: bool = False
    days_from_peak: Optional[float] = None
    radiant_altitude: Optional[float] = None
    moon_illumination: Optional[float] = None
    moon_separation_deg: Optional[float] = None


# Major meteor showers for 2026
# Data source: International Meteor Organization (IMO)
# https://www.imo.net/resources/calendar/
METEOR_SHOWERS_2026 = [
    MeteorShower(
        name="Quadrantids",
        code="QUA",
        peak_month=1,
        peak_day=3,
        start_month=12,
        start_day=28,
        end_month=1,
        end_day=12,
        zhr=120,
        radiant_ra_deg=230.0,  # 15:20h * 15 = 230°
        radiant_dec_deg=49.0,
        velocity_kms=40.4,
        parent_object="2003 EH1 (Asteroid)",
    ),
    MeteorShower(
        name="Lyrids",
        code="LYR",
        peak_month=4,
        peak_day=22,
        start_month=4,
        start_day=14,
        end_month=4,
        end_day=30,
        zhr=18,
        radiant_ra_deg=271.0,  # 18:04h * 15 = 271°
        radiant_dec_deg=34.0,
        velocity_kms=49.0,
        parent_object="C/1861 G1 (Thatcher)",
    ),
    MeteorShower(
        name="Eta Aquariids",
        code="ETA",
        peak_month=5,
        peak_day=6,
        start_month=4,
        start_day=19,
        end_month=5,
        end_day=28,
        zhr=50,
        radiant_ra_deg=338.0,  # 22:32h * 15 = 338°
        radiant_dec_deg=-1.0,
        velocity_kms=65.4,
        parent_object="1P/Halley",
    ),
    MeteorShower(
        name="Southern Delta Aquariids",
        code="SDA",
        peak_month=7,
        peak_day=30,
        start_month=7,
        start_day=12,
        end_month=8,
        end_day=23,
        zhr=25,
        radiant_ra_deg=340.0,  # 22:40h * 15 = 340°
        radiant_dec_deg=-16.4,
        velocity_kms=41.0,
        parent_object="96P/Machholz",
    ),
    MeteorShower(
        name="Alpha Capricornids",
        code="CAP",
        peak_month=7,
        peak_day=30,
        start_month=7,
        start_day=3,
        end_month=8,
        end_day=15,
        zhr=5,
        radiant_ra_deg=307.0,  # 20:28h * 15 = 307°
        radiant_dec_deg=-10.0,
        velocity_kms=23.0,
        parent_object="169P/NEAT",
    ),
    MeteorShower(
        name="Perseids",
        code="PER",
        peak_month=8,
        peak_day=12,
        start_month=7,
        start_day=17,
        end_month=8,
        end_day=24,
        zhr=100,
        radiant_ra_deg=48.0,  # 03:12h * 15 = 48°
        radiant_dec_deg=58.1,
        velocity_kms=59.0,
        parent_object="109P/Swift-Tuttle",
    ),
    MeteorShower(
        name="Orionids",
        code="ORI",
        peak_month=10,
        peak_day=21,
        start_month=10,
        start_day=2,
        end_month=11,
        end_day=7,
        zhr=20,
        radiant_ra_deg=95.0,  # 06:20h * 15 = 95°
        radiant_dec_deg=15.8,
        velocity_kms=66.0,
        parent_object="1P/Halley",
    ),
    MeteorShower(
        name="Southern Taurids",
        code="STA",
        peak_month=11,
        peak_day=5,
        start_month=9,
        start_day=20,
        end_month=11,
        end_day=20,
        zhr=5,
        radiant_ra_deg=52.0,  # 03:28h * 15 = 52°
        radiant_dec_deg=14.5,
        velocity_kms=27.0,
        parent_object="2P/Encke",
    ),
    MeteorShower(
        name="Northern Taurids",
        code="NTA",
        peak_month=11,
        peak_day=12,
        start_month=10,
        start_day=20,
        end_month=12,
        end_day=10,
        zhr=5,
        radiant_ra_deg=58.0,  # 03:52h * 15 = 58°
        radiant_dec_deg=22.2,
        velocity_kms=29.0,
        parent_object="2P/Encke",
    ),
    MeteorShower(
        name="Leonids",
        code="LEO",
        peak_month=11,
        peak_day=17,
        start_month=11,
        start_day=6,
        end_month=11,
        end_day=30,
        zhr=15,
        radiant_ra_deg=152.0,  # 10:08h * 15 = 152°
        radiant_dec_deg=21.8,
        velocity_kms=69.7,
        parent_object="55P/Tempel-Tuttle",
    ),
    MeteorShower(
        name="Geminids",
        code="GEM",
        peak_month=12,
        peak_day=14,
        start_month=12,
        start_day=4,
        end_month=12,
        end_day=17,
        zhr=150,
        radiant_ra_deg=112.0,  # 07:28h * 15 = 112°
        radiant_dec_deg=33.0,
        velocity_kms=35.0,
        parent_object="3200 Phaethon (Asteroid)",
    ),
    MeteorShower(
        name="Ursids",
        code="URS",
        peak_month=12,
        peak_day=22,
        start_month=12,
        start_day=17,
        end_month=12,
        end_day=26,
        zhr=10,
        radiant_ra_deg=217.0,  # 14:28h * 15 = 217°
        radiant_dec_deg=76.0,
        velocity_kms=33.1,
        parent_object="8P/Tuttle",
    ),
]
