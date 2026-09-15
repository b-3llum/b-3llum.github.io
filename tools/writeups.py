"""Shared helpers for the write-up tooling: manifest loading, frontmatter and
date parsing. Mirrors what app.js does in the browser so both agree on what a
valid write-up looks like."""

import json
import os
import re
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(ROOT, "posts.json")
POSTS_DIR = os.path.join(ROOT, "posts")

FRONTMATTER_RE = re.compile(r"^---\s*(.*?)\s*---\s*(.*)$", re.S)
DATE_FORMATS = ("%B %d, %Y", "%Y-%m-%d")


def load_manifest():
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        data = json.load(f)
    posts = data.get("posts") if isinstance(data, dict) else None
    if not isinstance(posts, list):
        raise ValueError("posts.json: missing top-level 'posts' array")
    return posts


def parse_frontmatter(source):
    match = FRONTMATTER_RE.match(source)
    if not match:
        return {}, source
    attributes = {}
    for line in match.group(1).split("\n"):
        i = line.find(":")
        if i == -1:
            continue
        key = line[:i].strip()
        value = line[i + 1:].strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        attributes[key] = value
    return attributes, match.group(2)


def parse_date(value):
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def split_tags(value):
    return [t.strip() for t in (value or "").split(",") if t.strip()]


def read_post(entry):
    path = os.path.join(ROOT, entry["file"])
    with open(path, encoding="utf-8") as f:
        attributes, body = parse_frontmatter(f.read())
    return {
        "slug": entry["slug"],
        "file": entry["file"],
        "attributes": attributes,
        "body": body,
        "date": parse_date(attributes.get("date", "")),
    }
