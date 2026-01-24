"""Auto-update checker for nightseek CLI.

Checks for updates once per day and installs them automatically after showing the forecast.
"""

import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import requests
from platformdirs import user_cache_dir

from logging_config import get_logger

logger = get_logger(__name__)

GITHUB_REPO = "danilop/nightseek"
GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/commits/main"
UPDATE_CHECK_INTERVAL = timedelta(hours=24)


def get_update_cache_file() -> Path:
    """Get the path to the update check cache file."""
    cache_dir = Path(user_cache_dir("nightseek"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / "update_check.json"


def get_local_version() -> Optional[str]:
    """Get the currently installed version.

    For development (git repo), returns commit SHA.
    For installed tool, returns package version from pyproject.toml.
    """
    # Try git first (for development)
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=sys.path[0],
        )
        if result.returncode == 0:
            return result.stdout.strip()[:7]
    except (subprocess.SubprocessError, OSError) as e:
        logger.debug("Could not get git version: %s", e)

    # For installed tools, use a marker file with install timestamp
    # This ensures we always check for updates on installed versions
    return "installed"


def get_remote_version() -> Optional[str]:
    """Get the latest commit SHA from GitHub."""
    try:
        response = requests.get(GITHUB_API_URL, timeout=5)
        if response.status_code == 200:
            return response.json()["sha"][:7]
    except (requests.RequestException, KeyError, ValueError) as e:
        logger.debug("Could not get remote version: %s", e)
    return None


def should_check_for_updates() -> bool:
    """Check if enough time has passed since last update check."""
    cache_file = get_update_cache_file()

    if not cache_file.exists():
        return True

    try:
        with open(cache_file) as f:
            data = json.load(f)
            last_check = datetime.fromisoformat(data["last_check"])
            return datetime.now() - last_check > UPDATE_CHECK_INTERVAL
    except (OSError, json.JSONDecodeError, KeyError, ValueError) as e:
        logger.debug("Could not read update cache: %s", e)
        return True


def save_check_timestamp():
    """Save the current timestamp as the last update check time."""
    cache_file = get_update_cache_file()
    try:
        # Load existing data to preserve last_remote_version
        data = {}
        if cache_file.exists():
            with open(cache_file) as f:
                data = json.load(f)

        # Update timestamp
        data["last_check"] = datetime.now().isoformat()

        with open(cache_file, "w") as f:
            json.dump(data, f)
    except (OSError, json.JSONDecodeError) as e:
        logger.debug("Could not save check timestamp: %s", e)


def is_update_available(local: str, remote: str) -> bool:
    """Check if an update is available given local and remote versions.

    For dev (git), compares commit SHAs directly.
    For installed tools, compares remote with last known installed version.
    """
    if local == "installed":
        # For installed tools, check against cached version
        cache_file = get_update_cache_file()
        try:
            if cache_file.exists():
                with open(cache_file) as f:
                    data = json.load(f)
                    last_remote = data.get("last_remote_version")
                    if last_remote and last_remote == remote:
                        return False  # Same version, no update needed
        except (OSError, json.JSONDecodeError, KeyError) as e:
            logger.debug("Could not read cached version: %s", e)
        # First time or different version: update available
        return True
    else:
        # For dev (git), compare commit SHAs
        return local != remote


def check_for_updates() -> bool:
    """Check if an update is available (with rate limiting). Returns True if update available."""
    if not should_check_for_updates():
        return False

    local = get_local_version()
    remote = get_remote_version()

    # Update the last check timestamp
    save_check_timestamp()

    if remote and local:
        return is_update_available(local, remote)

    return False


def save_installed_version(version: str) -> None:
    """Save the installed version after a successful update."""
    cache_file = get_update_cache_file()
    try:
        data = {}
        if cache_file.exists():
            with open(cache_file) as f:
                data = json.load(f)
        data["last_remote_version"] = version
        data["last_check"] = datetime.now().isoformat()
        with open(cache_file, "w") as f:
            json.dump(data, f)
    except (OSError, json.JSONDecodeError) as e:
        logger.debug("Could not save installed version: %s", e)


def update_tool() -> bool:
    """Update the tool using uv. Returns True if successful."""
    try:
        result = subprocess.run(
            [
                "uv",
                "tool",
                "install",
                "--force",
                "--reinstall",
                f"git+https://github.com/{GITHUB_REPO}",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        return result.returncode == 0
    except (subprocess.SubprocessError, OSError) as e:
        logger.warning("Update failed: %s", e)
        return False
