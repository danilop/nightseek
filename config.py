"""Configuration management for NightSeek."""

import os
import sys
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv


@dataclass
class Config:
    """Application configuration."""

    latitude: float
    longitude: float
    forecast_days: int
    max_objects: int  # Maximum objects to show per night

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
        except Exception as e:
            print(f"Geocoding error: {e}")
            return None

    @staticmethod
    def _detect_location_from_ip() -> Optional[dict]:
        """Detect location from IP address using IP-API.com.

        Returns:
            Dict with lat, lon, city, country, timezone or None if detection fails
        """
        try:
            import requests

            url = "http://ip-api.com/json/"
            params = {"fields": "status,lat,lon,city,country,timezone"}

            response = requests.get(url, params=params, timeout=5)
            response.raise_for_status()

            data = response.json()
            if data.get("status") == "success":
                return {
                    "lat": data["lat"],
                    "lon": data["lon"],
                    "city": data.get("city", "Unknown"),
                    "country": data.get("country", "Unknown"),
                    "timezone": data.get("timezone", ""),
                }
            return None
        except Exception:
            return None

    @classmethod
    def _interactive_setup(cls):
        """Interactive setup wizard for first-time configuration."""
        from pathlib import Path
        from platformdirs import user_config_dir

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
                f"Found: {detected['city']}, {detected['country']} "
                f"({detected['lat']:.4f}°, {detected['lon']:.4f}°)"
            )
            print()
            options.append(
                (
                    "ip",
                    f"Use detected location: {detected['city']}, {detected['country']}",
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
            lat, lon = detected["lat"], detected["lon"]
            print(f"\nUsing: {detected['city']}, {detected['country']}")

        elif selected == "address":
            # Address-based setup
            address = input("\nEnter your address or city: ").strip()
            if address:
                print(f"Looking up coordinates for '{address}'...")
                coords = cls._geocode_address(address)
                if coords:
                    lat, lon = coords
                    print(f"Found: {lat:.4f}°, {lon:.4f}°")
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
        config_dir = Path(user_config_dir("nightseek"))
        config_file = config_dir / "config"

        try:
            config_dir.mkdir(parents=True, exist_ok=True)

            with open(config_file, "w") as f:
                f.write(f"LATITUDE={lat}\n")
                f.write(f"LONGITUDE={lon}\n")
                f.write("FORECAST_DAYS=7\n")

            print()
            print(f"✓ Configuration saved to {config_file}")
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
        # Load configuration from user's config directory (cross-platform)
        from pathlib import Path
        from platformdirs import user_config_dir

        config_dir = Path(user_config_dir("nightseek"))
        config_file = config_dir / "config"
        if config_file.exists():
            load_dotenv(config_file)

        # Get latitude (CLI param > env var)
        lat = latitude
        if lat is None:
            lat_str = os.getenv("LATITUDE")
            if lat_str:
                try:
                    lat = float(lat_str)
                except ValueError:
                    print(f"Error: Invalid LATITUDE value in .env: {lat_str}")
                    sys.exit(1)

        # Get longitude (CLI param > env var)
        lon = longitude
        if lon is None:
            lon_str = os.getenv("LONGITUDE")
            if lon_str:
                try:
                    lon = float(lon_str)
                except ValueError:
                    print(f"Error: Invalid LONGITUDE value in .env: {lon_str}")
                    sys.exit(1)

        # Validate that we have location
        if lat is None or lon is None:
            # Offer interactive setup
            cls._interactive_setup()
            sys.exit(1)

        # Type narrowing: after None check, lat and lon are guaranteed to be int | float
        assert lat is not None and lon is not None

        # Validate latitude range
        if not -90 <= lat <= 90:
            print(f"Error: Latitude must be between -90 and 90 (got {lat})")
            sys.exit(1)

        # Validate longitude range
        if not -180 <= lon <= 180:
            print(f"Error: Longitude must be between -180 and 180 (got {lon})")
            sys.exit(1)

        # Get forecast days (CLI param > env var > default)
        forecast_days = days
        if forecast_days is None:
            days_str = os.getenv("FORECAST_DAYS")
            if days_str:
                try:
                    forecast_days = int(days_str)
                except ValueError:
                    print(f"Error: Invalid FORECAST_DAYS value in .env: {days_str}")
                    sys.exit(1)
            else:
                forecast_days = 7

        # Type narrowing: forecast_days is guaranteed to be int at this point
        assert forecast_days is not None

        # Validate forecast days
        if forecast_days < 1:
            print(f"Error: Forecast days must be at least 1 (got {forecast_days})")
            sys.exit(1)
        if forecast_days > 30:
            print(f"Error: Forecast days cannot exceed 30 (got {forecast_days})")
            sys.exit(1)

        # Get max objects (CLI param > env var > default)
        max_objs = max_objects
        if max_objs is None:
            max_objs_str = os.getenv("MAX_OBJECTS")
            if max_objs_str:
                try:
                    max_objs = int(max_objs_str)
                except ValueError:
                    print(f"Error: Invalid MAX_OBJECTS value in .env: {max_objs_str}")
                    sys.exit(1)
            else:
                max_objs = 8  # Default: show top 8 objects per night

        # Type narrowing: max_objs is guaranteed to be int at this point
        assert max_objs is not None

        # Validate max objects
        if max_objs < 1:
            print(f"Error: Max objects must be at least 1 (got {max_objs})")
            sys.exit(1)
        if max_objs > 50:
            print(f"Error: Max objects cannot exceed 50 (got {max_objs})")
            sys.exit(1)

        return cls(
            latitude=lat,
            longitude=lon,
            forecast_days=forecast_days,
            max_objects=max_objs,
        )
