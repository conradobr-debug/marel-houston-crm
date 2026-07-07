#!/usr/bin/env python3
"""Dependency-free structural smoke check for the Phase 3 static frontend."""

from __future__ import annotations

import argparse
import re
import sys
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_FILES = [
    "js/data/crm-mappers.js",
    "js/data/mock-crm-repository.js",
    "js/data/supabase-crm-repository.js",
    "js/data/crm-repository-contract.js",
    "js/data/crm-data-service.js",
]


def fail(message: str) -> None:
    raise AssertionError(message)


def validate_files() -> None:
    for relative in DATA_FILES:
        if not (ROOT / relative).is_file():
            fail(f"Missing required data-access file: {relative}")

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    positions = [index.find(f'<script src="{relative}"></script>') for relative in DATA_FILES]
    if any(position < 0 for position in positions):
        fail("index.html does not load every data-access script")
    if positions != sorted(positions):
        fail("data-access scripts are loaded in the wrong order")

    service_worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    for relative in DATA_FILES:
        if f'"./{relative}"' not in service_worker:
            fail(f"service worker does not cache {relative}")

    repository = (ROOT / "js/data/supabase-crm-repository.js").read_text(encoding="utf-8")
    required_tables = {"leads", "partners", "opportunities", "projects", "profiles", "crm_settings"}
    missing = sorted(table for table in required_tables if f'from("{table}")' not in repository)
    if missing:
        fail(f"normalized repository is missing tables: {', '.join(missing)}")

    legacy_tables = ("crm_records", "crm_profiles", "crm_config", "crm_record_events")
    for relative in DATA_FILES:
        contents = (ROOT / relative).read_text(encoding="utf-8")
        found = [table for table in legacy_tables if table in contents]
        if found:
            fail(f"{relative} references legacy tables: {', '.join(found)}")

    ui_text = "\n".join((ROOT / relative).read_text(encoding="utf-8") for relative in ("index.html", "partners.js"))
    obsolete_ui_tokens = legacy_tables + ("crm_weekly_reports", "crm_pending_items", "crm_pending_attachments", "outlook-calendar")
    found_ui = sorted(token for token in obsolete_ui_tokens if token in ui_text)
    if found_ui:
        fail(f"active UI files retain obsolete persistence tokens: {', '.join(found_ui)}")

    tracked_text = "\n".join((ROOT / relative).read_text(encoding="utf-8") for relative in DATA_FILES)
    if re.search(r"https://[a-z0-9_-]+\.supabase\.co", tracked_text, re.IGNORECASE):
        fail("data-access files contain a remote Supabase URL")


def validate_preview(url: str) -> None:
    with urllib.request.urlopen(url, timeout=5) as response:
        html = response.read().decode("utf-8")
    if "Marel Houston CRM" not in html:
        fail("preview did not return the Marel Houston CRM shell")
    for relative in DATA_FILES:
        with urllib.request.urlopen(f"{url.rstrip('/')}/{relative}", timeout=5) as response:
            if response.status != 200:
                fail(f"preview did not serve {relative}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", help="Optional running preview URL, for example http://127.0.0.1:8766")
    args = parser.parse_args()
    try:
        validate_files()
        if args.url:
            validate_preview(args.url)
    except (AssertionError, OSError) as error:
        print(f"Frontend smoke validation failed: {error}", file=sys.stderr)
        return 1
    print("Frontend smoke validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
