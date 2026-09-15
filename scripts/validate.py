#!/usr/bin/env python3
"""
Validates data/events.json, data/board.json, and data/founders.json.

Usage: python3 scripts/validate.py
Exits 0 if everything is valid, 1 (with a list of problems) otherwise.
"""

import json
import os
import re
import sys
from datetime import date, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVENTS_PATH = os.path.join(ROOT, "data", "events.json")
BOARD_PATH = os.path.join(ROOT, "data", "board.json")
FOUNDERS_PATH = os.path.join(ROOT, "data", "founders.json")
BOARD_IMG_DIR = os.path.join(ROOT, "assets", "img", "board")
FOUNDERS_IMG_DIR = os.path.join(ROOT, "assets", "img", "founders")

ALLOWED_TYPES = {"meeting", "come-hack", "workshop", "social", "competition", "other"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{2}:\d{2}$")

problems = []


def fail(msg):
    problems.append(msg)


def load_json(path, label):
    if not os.path.isfile(path):
        fail("{0}: file not found at {1}".format(label, path))
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        fail("{0}: invalid JSON ({1})".format(label, e))
        return None


def is_valid_date(s):
    if not DATE_RE.match(s or ""):
        return False
    try:
        y, m, d = (int(p) for p in s.split("-"))
        date(y, m, d)
        return True
    except ValueError:
        return False


def validate_events(data):
    if data is None:
        return
    if "events" not in data or not isinstance(data["events"], list):
        fail("events.json: missing top-level 'events' array")
        return

    seen_ids = set()
    for idx, ev in enumerate(data["events"]):
        where = "events.json: event[{0}]".format(idx)
        if not isinstance(ev, dict):
            fail("{0}: not an object".format(where))
            continue

        for field in ("id", "title", "date", "type"):
            if not ev.get(field):
                fail("{0} (id={1}): missing required field '{2}'".format(
                    where, ev.get("id", "?"), field))

        eid = ev.get("id")
        where = "events.json: event '{0}'".format(eid or idx)

        if eid:
            if eid in seen_ids:
                fail("{0}: duplicate id".format(where))
            seen_ids.add(eid)

        ev_date = ev.get("date")
        if ev_date is not None and not is_valid_date(ev_date):
            fail("{0}: 'date' must match YYYY-MM-DD and be a real date, got '{1}'".format(where, ev_date))

        ev_type = ev.get("type")
        if ev_type is not None and ev_type not in ALLOWED_TYPES:
            fail("{0}: 'type' must be one of {1}, got '{2}'".format(
                where, sorted(ALLOWED_TYPES), ev_type))

        start = ev.get("start")
        end = ev.get("end")
        if start is not None:
            if not TIME_RE.match(start):
                fail("{0}: 'start' must match HH:MM, got '{1}'".format(where, start))
        if end is not None:
            if not TIME_RE.match(end):
                fail("{0}: 'end' must match HH:MM, got '{1}'".format(where, end))
        if start and end and TIME_RE.match(start) and TIME_RE.match(end):
            if start >= end:
                fail("{0}: 'start' ({1}) must be before 'end' ({2})".format(where, start, end))

        url = ev.get("url")
        if url:
            if not re.match(r"^https?://", url):
                fail("{0}: 'url' must start with http:// or https://, got '{1}'".format(where, url))

        tags = ev.get("tags")
        if tags is not None and not isinstance(tags, list):
            fail("{0}: 'tags' must be an array".format(where))

        for boolfield in ("featured", "cancelled"):
            if boolfield in ev and not isinstance(ev[boolfield], bool):
                fail("{0}: '{1}' must be a boolean".format(where, boolfield))

        repeat = ev.get("repeat")
        if repeat is not None:
            if not isinstance(repeat, dict):
                fail("{0}: 'repeat' must be an object".format(where))
            else:
                every = repeat.get("every")
                if every not in ("1w", "2w"):
                    fail("{0}: repeat.every must be '1w' or '2w', got '{1}'".format(where, every))
                until = repeat.get("until")
                if not is_valid_date(until or ""):
                    fail("{0}: repeat.until must be a valid YYYY-MM-DD date, got '{1}'".format(where, until))
                elif ev_date and is_valid_date(ev_date) and until < ev_date:
                    fail("{0}: repeat.until ({1}) must be >= date ({2})".format(where, until, ev_date))
                skip = repeat.get("skip", [])
                if not isinstance(skip, list) or any(not is_valid_date(s) for s in skip):
                    fail("{0}: repeat.skip must be an array of YYYY-MM-DD dates".format(where))


def validate_person(m, idx, label, img_dir, img_dir_label):
    """Shared checks for a board member or a founder."""
    where = "{0}[{1}]".format(label, idx)
    if not isinstance(m, dict):
        fail("{0}: not an object".format(where))
        return
    name = m.get("name")
    where = "{0} '{1}'".format(label, name or idx)
    if not name:
        fail("{0}: missing required field 'name'".format(where))
    if not m.get("role"):
        fail("{0}: missing required field 'role'".format(where))

    photo = m.get("photo", "")
    if photo:
        photo_path = os.path.join(img_dir, photo)
        if not os.path.isfile(photo_path):
            fail("{0}: photo '{1}' not found under {2}".format(where, photo, img_dir_label))

    email = m.get("email", "")
    if email and "@" not in email:
        fail("{0}: 'email' does not look like an email address: '{1}'".format(where, email))

    for urlfield in ("linkedin", "portfolio"):
        url = m.get(urlfield, "")
        if url and not re.match(r"^https?://", url):
            fail("{0}: '{1}' must start with http:// or https://, got '{2}'".format(
                where, urlfield, url))


def validate_board(data):
    if data is None:
        return
    if "members" not in data or not isinstance(data["members"], list):
        fail("board.json: missing top-level 'members' array")
        return

    for idx, m in enumerate(data["members"]):
        validate_person(m, idx, "board.json: member", BOARD_IMG_DIR, "assets/img/board/")


def validate_founders(data):
    if data is None:
        return
    if "founders" not in data or not isinstance(data["founders"], list):
        fail("founders.json: missing top-level 'founders' array")
        return

    for idx, f in enumerate(data["founders"]):
        validate_person(f, idx, "founders.json: founder", FOUNDERS_IMG_DIR, "assets/img/founders/")


def main():
    events_data = load_json(EVENTS_PATH, "events.json")
    board_data = load_json(BOARD_PATH, "board.json")
    founders_data = load_json(FOUNDERS_PATH, "founders.json")

    validate_events(events_data)
    validate_board(board_data)
    validate_founders(founders_data)

    if problems:
        print("Found {0} problem(s):\n".format(len(problems)))
        for p in problems:
            print("  - " + p)
        sys.exit(1)

    print("OK: events.json, board.json, and founders.json are valid.")
    sys.exit(0)


if __name__ == "__main__":
    main()
