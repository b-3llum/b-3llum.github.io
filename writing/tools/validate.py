#!/usr/bin/env python3
"""
Validates posts.json and every write-up it lists.

Usage: python3 tools/validate.py
Exits 0 if everything is valid, 1 (with a list of problems) otherwise.
"""

import os
import re
import sys
from urllib.parse import unquote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import writeups  # noqa: E402

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
IMAGE_RE = re.compile(r"!\[[^\]]*\]\(\s*<?([^)\s>]+)>?")
EXTERNAL_RE = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//|/|#)", re.I)
# Image syntax inside code is an example, not a rendered image.
CODE_RE = re.compile(r"(```|~~~).*?\1|`[^`\n]*`", re.S)
REQUIRED = ("title", "date", "author")

problems = []


def fail(msg):
    problems.append(msg)


def validate_entry(entry, idx):
    where = "posts.json: posts[{0}]".format(idx)
    if not isinstance(entry, dict):
        fail("{0}: not an object".format(where))
        return None
    slug = entry.get("slug")
    file = entry.get("file")
    if not slug or not isinstance(slug, str):
        fail("{0}: missing required field 'slug'".format(where))
    elif not SLUG_RE.match(slug):
        fail("{0}: slug '{1}' must be lowercase letters, digits and hyphens".format(where, slug))
    if not file or not isinstance(file, str):
        fail("{0}: missing required field 'file'".format(where))
        return None
    if not file.startswith("posts/") or not file.endswith(".md"):
        fail("{0}: file '{1}' must be a posts/*.md path".format(where, file))
        return None
    if not os.path.isfile(os.path.join(writeups.ROOT, file)):
        fail("{0}: file '{1}' does not exist".format(where, file))
        return None
    return entry


def validate_post(entry):
    post = writeups.read_post(entry)
    attrs = post["attributes"]
    where = entry["file"]
    if not attrs:
        fail("{0}: no frontmatter block (the file must start with --- ... ---)".format(where))
        return
    for field in REQUIRED:
        if not attrs.get(field):
            fail("{0}: missing required frontmatter field '{1}'".format(where, field))
    if attrs.get("date") and post["date"] is None:
        fail("{0}: date '{1}' is not 'Month D, YYYY' or 'YYYY-MM-DD'".format(where, attrs["date"]))

    post_dir = os.path.dirname(os.path.join(writeups.ROOT, entry["file"]))
    for ref in IMAGE_RE.findall(CODE_RE.sub("", post["body"])):
        if EXTERNAL_RE.match(ref):
            continue
        if not os.path.isfile(os.path.join(post_dir, unquote(ref))):
            fail("{0}: image '{1}' not found next to the write-up".format(where, ref))


def main():
    try:
        manifest = writeups.load_manifest()
    except (OSError, ValueError) as e:
        fail("posts.json: {0}".format(e))
        return finish()

    entries = [e for e in (validate_entry(entry, i) for i, entry in enumerate(manifest)) if e]

    seen_slugs, seen_files = {}, {}
    for entry in entries:
        slug, file = entry.get("slug"), entry["file"]
        if slug in seen_slugs:
            fail("posts.json: duplicate slug '{0}'".format(slug))
        if file in seen_files:
            fail("posts.json: duplicate file '{0}'".format(file))
        seen_slugs[slug] = seen_files[file] = True
        validate_post(entry)

    listed = set(seen_files)
    for name in sorted(os.listdir(writeups.POSTS_DIR)):
        if name.endswith(".md") and "posts/" + name not in listed:
            fail("posts/{0}: not listed in posts.json, so it will not be published".format(name))

    return finish()


def finish():
    if problems:
        print("Found {0} problem(s):".format(len(problems)))
        for p in problems:
            print("  - " + p)
        return 1
    print("OK: posts.json and all listed write-ups are valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
