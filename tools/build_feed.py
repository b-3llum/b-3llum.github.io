#!/usr/bin/env python3
"""
Generates feed.xml (Atom 1.0) from the write-ups listed in posts.json.

Usage: python3 tools/build_feed.py
No dependencies. CI runs this on every push to main and commits the result,
so it only needs running by hand for a local preview of the feed.
"""

import os
import sys
from datetime import datetime, timezone
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import writeups  # noqa: E402

SITE = "https://cisa.cybernet.rocks/writing/"
TITLE = "CISA Write-ups"
SUBTITLE = "CTF write-ups, lab notes, and guides from the Cybersecurity & IT Student Association at Penn State Abington."
SITE_AUTHOR = "CISA @ Penn State Abington"
FEED_PATH = os.path.join(writeups.ROOT, "feed.xml")


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    posts = [writeups.read_post(entry) for entry in writeups.load_manifest()]
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    posts.sort(key=lambda p: p["date"] or epoch, reverse=True)

    now = datetime.now(timezone.utc)
    updated = posts[0]["date"] if posts and posts[0]["date"] else now

    entries = []
    for post in posts:
        attrs = post["attributes"]
        url = SITE + "#" + post["slug"]
        categories = "".join(
            '    <category term="{0}"/>\n'.format(escape(t, {'"': "&quot;"}))
            for t in writeups.split_tags(attrs.get("tags"))
        )
        entries.append(
            "  <entry>\n"
            "    <title>{title}</title>\n"
            '    <link href="{url}"/>\n'
            "    <id>{url}</id>\n"
            "    <updated>{updated}</updated>\n"
            "    <author><name>{author}</name></author>\n"
            "{categories}"
            "    <summary>{summary}</summary>\n"
            "  </entry>".format(
                title=escape(attrs.get("title") or post["slug"]),
                url=escape(url, {'"': "&quot;"}),
                updated=iso(post["date"] or now),
                author=escape(attrs.get("author") or SITE_AUTHOR),
                categories=categories,
                summary=escape(attrs.get("description", "")),
            )
        )

    feed = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<feed xmlns="http://www.w3.org/2005/Atom">\n'
        "  <title>{title}</title>\n"
        "  <subtitle>{subtitle}</subtitle>\n"
        '  <link href="{site}"/>\n'
        '  <link rel="self" type="application/atom+xml" href="{site}feed.xml"/>\n'
        "  <id>{site}</id>\n"
        "  <updated>{updated}</updated>\n"
        "  <author><name>{author}</name></author>\n"
        "{entries}\n"
        "</feed>\n"
    ).format(
        title=escape(TITLE),
        subtitle=escape(SUBTITLE),
        site=escape(SITE, {'"': "&quot;"}),
        updated=iso(updated),
        author=escape(SITE_AUTHOR),
        entries="\n".join(entries),
    )

    with open(FEED_PATH, "w", encoding="utf-8") as f:
        f.write(feed)
    print("feed.xml written: {0} entries".format(len(posts)))


if __name__ == "__main__":
    main()
