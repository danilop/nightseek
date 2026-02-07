"""Configuration management for NightSeek using pydantic-settings."""

import sys
from pathlib import Path
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from platformdirs import user_config_dir

from logging_config import get_logger
from models import LocationData

logger = get_logger(__name__)


def _get_config_file() -> Path:
    """Get the path to the config file."""
    config_dir = Path(user_config_dir("nightseek"))
    return config_dir / "config"


class Config(BaseSettings):
    """Application configuration with validation."""

    model_config = SettingsConfigDict(
        env_file=str(_get_config_file()),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    latitude: Optional[float] = Field(
        default=None,
        ge=-90,
        le=90,
        description="Observer latitude in degrees (-90 to 90)",
    )
    longitude: Optional[float] = Field(
        default=None,
        ge=-180,
        le=180,
        description="Observer longitude in degrees (-180 to 180)",
    )
    forecast_days: int = Field(
        default=7,
        ge=1,
        le=30,
        description="Number of days to forecast (1-30)",
    )
    max_objects: int = Field(
        default=8,
        ge=1,
        le=50,
        description="Maximum objects to show per night (1-50)",
    )

    @field_validator("latitude", "longitude", mode="before")
    @classmethod
    def parse_float_or_none(cls, v):
        """Parse string to float, treating empty strings as None."""
        if v is None or v == "":
            return None
        if isinstance(v, str):
            try:
                return float(v)
            except ValueError:
                return None
        return v

    @staticmethod
    def _geocode_address(address: str) -> Optional[tuple[float, float]]:
        """Convert address to latitude/longitude using Nominatim (OpenStreetMap).

        Args:
            address: Address string (e.g., "London, UK" or "New York, USA")

        Returns:
            Tuple of (latitude, longitude) or None if geocoding fails
        """
        try:
            import requests

            url = "https://nominatim.openstreetmap.org/search"
            params = {"q": address, "format": "json", "limit": 1}
            headers = {"User-Agent": "nightseek/0.1.0"}

            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()

            results = response.json()
            if results:
                lat = float(results[0]["lat"])
                lon = float(results[0]["lon"])
                return (lat, lon)
            return None
        except (requests.RequestException, KeyError, ValueError) as e:
            logger.warning("Geocoding error: %s", e)
            return None

    @staticmethod
    def _detect_location_from_ip() -> Optional[LocationData]:
        """Detect location from IP address using IP-API.com.

        Returns:
            LocationData instance or None if detection fails
        """
        try:
            import requests

            url = "http://ip-api.com/json/"
            params = {"fields": "status,lat,lon,city,country,timezone"}

            response = requests.get(url, params=params, timeout=5)
            response.raise_for_status()

            data = response.json()
            if data.get("status") == "success":
                return LocationData(
                    latitude=data["lat"],
                    longitude=data["lon"],
                    city=data.get("city", "Unknown"),
                    country=data.get("country", "Unknown"),
                    timezone=data.get("timezone", ""),
                )
            return None
        except (requests.RequestException, KeyError, ValueError) as e:
            logger.debug("IP location detection failed: %s", e)
            return None

    @classmethod
    def _interactive_setup(cls):
        """Interactive setup wizard for first-time configuration."""
        print("\n" + "=" * 70)
        print("Welcome to NightSeek! Let's set up your default location.")
        print("=" * 70)
        print()
        print("You need to configure your observation location.")
        print()

        # Try to detect location from IP first
        print("Detecting your location from IP address...")
        detected = cls._detect_location_from_ip()

        # Build options dynamically
        options = []
        if detected:
            print(
                f"Found: {detected.city}, {detected.country} "
                f"({detected.latitude:.4f}, {detected.longitude:.4f})"
            )
            print()
            options.append(
                (
                    "ip",
                    f"Use detected location: {detected.city}, {detected.country}",
                )
            )
        else:
            print("Could not detect location from IP.")
            print()

        options.append(
            ("address", "Enter address (e.g., 'London, UK' or 'New York, USA')")
        )
        options.append(("coords", "Enter coordinates (latitude and longitude)"))

        # Display options
        print("How would you like to provide your location?")
        for i, (_, label) in enumerate(options, 1):
            print(f"  {i}. {label}")
        print()

        valid_choices = [str(i) for i in range(1, len(options) + 1)]
        choice = input(f"Choice ({'/'.join(valid_choices)}): ").strip()

        if choice not in valid_choices:
            print("Invalid choice.")
            return

        selected = options[int(choice) - 1][0]
        lat, lon = None, None

        if selected == "ip" and detected:
            # Use detected location
            lat, lon = detected.latitude, detected.longitude
            print(f"\nUsing: {detected.city}, {detected.country}")

        elif selected == "address":
            # Address-based setup
            address = input("\nEnter your address or city: ").strip()
            if address:
                print(f"Looking up coordinates for '{address}'...")
                coords = cls._geocode_address(address)
                if coords:
                    lat, lon = coords
                    print(f"Found: {lat:.4f}, {lon:.4f}")
                else:
                    print(
                        "Could not find location. Please try entering coordinates manually."
                    )

        if selected == "coords" or (selected == "address" and lat is None):
            # Coordinate-based setup
            try:
                print()
                lat_str = input("Enter latitude (-90 to 90): ").strip()
                lon_str = input("Enter longitude (-180 to 180): ").strip()
                lat = float(lat_str)
                lon = float(lon_str)

                if not -90 <= lat <= 90:
                    print("Error: Latitude must be between -90 and 90")
                    return
                if not -180 <= lon <= 180:
                    print("Error: Longitude must be between -180 and 180")
                    return
            except ValueError:
                print("Error: Invalid coordinates")
                return

        if lat is None or lon is None:
            print("\nSetup cancelled. You can run nightseek with coordinates:")
            print("  nightseek -lat LAT -lon LON")
            return

        # Create config file (cross-platform)
        config_file = _get_config_file()

        try:
            config_file.parent.mkdir(parents=True, exist_ok=True)

            with open(config_file, "w") as f:
                f.write(f"LATITUDE={lat}\n")
                f.write(f"LONGITUDE={lon}\n")
                f.write("FORECAST_DAYS=7\n")

            print()
            print(f"Configuration saved to {config_file}")
            print()
            print("You can now run: nightseek")
            print()
            print("To change your location later, edit:")
            print(f"  {config_file}")
            print()
        except Exception as e:
            print(f"\nError saving configuration: {e}")
            print("\nYou can manually create the config file at:")
            print(f"  {config_file}")
            print("\nWith contents:")
            print(f"  LATITUDE={lat}")
            print(f"  LONGITUDE={lon}")

    @classmethod
    def load(
        cls,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        days: Optional[int] = None,
        max_objects: Optional[int] = None,
    ) -> "Config":
        """Load configuration from environment variables and CLI parameters.

        CLI parameters override environment variables.
        If location is not provided, the application will exit.

        Args:
            latitude: Override latitude from CLI
            longitude: Override longitude from CLI
            days: Override forecast days from CLI
            max_objects: Maximum objects to show per night from CLI

        Returns:
            Config instance
        """
        # Build overrides from CLI parameters
        overrides = {}
        if latitude is not None:
            overrides["latitude"] = latitude
        if longitude is not None:
            overrides["longitude"] = longitude
        if days is not None:
            overrides["forecast_days"] = days
        if max_objects is not None:
            overrides["max_objects"] = max_objects

        try:
            config = cls(**overrides)
        except Exception as e:
            print(f"Error: Invalid configuration: {e}")
            sys.exit(1)

        # Validate that we have location
        if config.latitude is None or config.longitude is None:
            # Offer interactive setup
            cls._interactive_setup()
            sys.exit(1)

        return config
