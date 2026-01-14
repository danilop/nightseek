"""Astronomical calculations using Skyfield."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from skyfield import almanac
from skyfield.api import Loader, wgs84
from skyfield.constants import GM_SUN_Pitjeva_2005_km3_s2 as GM_SUN
from skyfield.data import mpc


@dataclass
class NightInfo:
    """Information about a single night."""

    date: datetime
    sunset: datetime
    sunrise: datetime
    astronomical_dusk: datetime
    astronomical_dawn: datetime
    moon_phase: float  # 0-1, where 0=new, 0.5=full
    moon_illumination: float  # 0-100%
    moon_rise: Optional[datetime]
    moon_set: Optional[datetime]


@dataclass
class ObjectVisibility:
    """Visibility information for a celestial object."""

    object_name: str
    object_type: str  # planet, dso, comet, moon, etc.
    is_visible: bool
    max_altitude: float
    max_altitude_time: Optional[datetime]
    above_45_start: Optional[datetime]
    above_45_end: Optional[datetime]
    above_60_start: Optional[datetime]
    above_60_end: Optional[datetime]
    above_75_start: Optional[datetime]
    above_75_end: Optional[datetime]
    moon_separation: Optional[float]  # degrees
    moon_warning: bool  # True if moon interferes


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

    def get_night_info(self, date: datetime) -> NightInfo:
        """Calculate night information for a given date.

        Args:
            date: The date to calculate for

        Returns:
            NightInfo object with twilight and moon information
        """
        # Convert to Skyfield time
        t0 = self.ts.utc(date.year, date.month, date.day, 0, 0, 0)
        t1 = self.ts.utc(date.year, date.month, date.day, 23, 59, 59)

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
            elif e == 4:  # Start of astronomical twilight
                astronomical_dawn = dt

        # If no dusk/dawn found in this day, extend search
        if astronomical_dusk is None or astronomical_dawn is None:
            t2 = self.ts.utc(date.year, date.month, date.day + 1, 23, 59, 59)
            times_tw2, events_tw2 = almanac.find_discrete(t0, t2, f_twilight)
            for t, e in zip(times_tw2, events_tw2):
                dt = t.utc_datetime()
                if e == 0 and astronomical_dusk is None:
                    astronomical_dusk = dt
                elif e == 4 and astronomical_dawn is None:
                    astronomical_dawn = dt

        # Calculate moon phase and illumination
        t_mid = self.ts.utc(date.year, date.month, date.day, 12, 0, 0)
        phase = almanac.moon_phase(self.eph, t_mid)
        phase_fraction = phase.degrees / 360.0

        # Calculate illumination (0 at new moon, 1 at full moon)
        # Phase goes 0->180 (waxing) then 180->360 (waning)
        if phase.degrees <= 180:
            illumination = phase.degrees / 180.0
        else:
            illumination = (360 - phase.degrees) / 180.0

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

        # Type narrowing: ensure required times are not None
        # (They should always exist except in polar regions)
        assert (
            sunset is not None
            and sunrise is not None
            and astronomical_dusk is not None
            and astronomical_dawn is not None
        ), "Could not calculate twilight times (polar region?)"

        return NightInfo(
            date=date,
            sunset=sunset,
            sunrise=sunrise,
            astronomical_dusk=astronomical_dusk,
            astronomical_dawn=astronomical_dawn,
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
        if not night_info.astronomical_dusk or not night_info.astronomical_dawn:
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
        while current <= end:
            times.append(current)
            current += timedelta(minutes=sample_interval)

        # Vectorized Skyfield time array
        t_array = self.ts.utc(
            [t.year for t in times],
            [t.month for t in times],
            [t.day for t in times],
            [t.hour for t in times],
            [t.minute for t in times],
        )

        # Single vectorized observation call
        astrometric = observer.at(t_array).observe(obj)
        alt, _, _ = astrometric.apparent().altaz()
        altitudes = alt.degrees

        # Find maximum
        max_idx = altitudes.argmax()
        max_altitude = altitudes[max_idx]
        max_altitude_time = times[max_idx]
        is_visible = max_altitude > 0

        # Find threshold windows
        def find_above_threshold(threshold):
            above_mask = altitudes >= threshold
            if not above_mask.any():
                return None, None
            indices = [i for i, v in enumerate(above_mask) if v]
            return times[indices[0]], times[indices[-1]]

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
        )
