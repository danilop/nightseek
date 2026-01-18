"""Auto-update checker for nightseek CLI.

Automatically checks for updates once per day and installs them.
"""

import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import requests
from platformdirs import user_cache_dir

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
    except Exception:
        pass

    # For installed tools, use a marker file with install timestamp
    # This ensures we always check for updates on installed versions
    return "installed"


def get_remote_version() -> Optional[str]:
    """Get the latest commit SHA from GitHub."""
    try:
        response = requests.get(GITHUB_API_URL, timeout=5)
        if response.status_code == 200:
            return response.json()["sha"][:7]
    except Exception:
        pass
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
    except Exception:
        return True


def save_check_timestamp():
    """Save the current timestamp as the last update check time."""
    cache_file = get_update_cache_file()
    try:
        with open(cache_file, "w") as f:
            json.dump({"last_check": datetime.now().isoformat()}, f)
    except Exception:
        pass


def check_for_updates() -> bool:
    """Check if an update is available. Returns True if update available."""
    if not should_check_for_updates():
        return False

    local = get_local_version()
    remote = get_remote_version()

    # Update the last check timestamp
    save_check_timestamp()

    # If we have both versions and they differ, update is available
    # For installed tools (local="installed"), always check if remote exists
    if remote and local:
        if local == "installed":
            # For installed tools, check if remote commit is different from last known
            return check_if_remote_changed(remote)
        elif local != remote:
            return True

    return False


def check_if_remote_changed(current_remote: str) -> bool:
    """Check if remote version changed since last check."""
    cache_file = get_update_cache_file()
    try:
        with open(cache_file) as f:
            data = json.load(f)
            last_remote = data.get("last_remote_version")
            if last_remote and last_remote != current_remote:
                # Save new remote version
                data["last_remote_version"] = current_remote
                with open(cache_file, "w") as fw:
                    json.dump(data, fw)
                return True
            elif not last_remote:
                # First time, save it
                data["last_remote_version"] = current_remote
                with open(cache_file, "w") as fw:
                    json.dump(data, fw)
                return False
    except Exception:
        pass
    return False


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
    except Exception:
        return False
