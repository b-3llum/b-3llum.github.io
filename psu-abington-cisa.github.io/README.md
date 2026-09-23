# CISA @ Penn State Abington — website

Source for [psu-abington-cisa.github.io](https://psu-abington-cisa.github.io), the site for the
Cybersecurity & IT Student Association (CISA) at Penn State Abington. It's a plain static site —
no build step, no framework, no bundler, and no third-party requests — served straight from this
repo by GitHub Pages. The typeface is self-hosted Roboto (no CDN, no Google Fonts link), and the
site has a light/dark theme toggle in the top nav that remembers the visitor's choice.

This README is written for e-board members who aren't developers. If you can edit a file on
GitHub.com, you can update this site.

## Update the schedule

Meetings and events live in [`data/events.json`](data/events.json). Edit that file, commit to
`main`, and the live site updates automatically within about a minute.

**Field reference:**

| Field | Required? | Format | Notes |
|---|---|---|---|
| `id` | yes | slug string | Must be unique across all events. |
| `title` | yes | string | Shown everywhere as the event name. |
| `date` | yes | `YYYY-MM-DD` | First/only occurrence date. |
| `type` | yes | one of `meeting`, `come-hack`, `workshop`, `social`, `competition`, `other` | Controls the color used in the calendar. |
| `start` | no | `HH:MM` (24h) | Omit both `start` and `end` for an all-day event. |
| `end` | no | `HH:MM` (24h) | Must be after `start`. |
| `location` | no | string | e.g. `"Academic Building 309"`. |
| `summary` | no | string | One line, shown in cards and list rows. |
| `description` | no | string | Longer text, shown in the detail panel. |
| `url` | no | URL | Must start with `http://` or `https://`. Shown as "Details"/"Event page". |
| `tags` | no | array of strings | Small labels shown on the event. |
| `featured` | no | boolean | Adds a highlighted border in the list view. |
| `cancelled` | no | boolean | Strikes the title and shows a "Cancelled" badge. |
| `repeat` | no | object | See below — expands into multiple occurrences. |

**Recurrence example** — a biweekly meeting every other Thursday from Oct 1 through Dec 10,
skipping Thanksgiving week:

```json
{
  "id": "2026-10-01-workshop",
  "title": "Workshop Night",
  "date": "2026-10-01",
  "start": "17:00",
  "end": "18:00",
  "location": "Academic Building 309",
  "type": "workshop",
  "repeat": { "every": "2w", "until": "2026-12-10", "skip": ["2026-11-26"] }
}
```

`repeat.every` is `"1w"` (weekly) or `"2w"` (biweekly). `repeat.until` is the last date to
generate (inclusive). `repeat.skip` is an optional list of dates to omit (e.g. a holiday week) —
the recurrence still counts through the skipped date, it's just left out of the result.

**To edit on GitHub.com (no local setup needed):**

1. Go to [`data/events.json`](https://github.com/psu-abington-cisa/psu-abington-cisa.github.io/blob/main/data/events.json) on GitHub.
2. Click the pencil (✏️) icon to edit.
3. Make your change, keeping the JSON valid (matching commas/brackets).
4. Scroll down, add a short commit message, and choose "Commit directly to the `main` branch."
5. The site rebuilds automatically — check back in about a minute.

If you're unsure whether your edit is valid JSON, paste it into a linter like
[jsonlint.com](https://jsonlint.com) first, or ask someone to run `python3 scripts/validate.py`
(see [Checks](#checks) below) before committing.

## Update the e-board

Roster lives in [`data/board.json`](data/board.json). Each member is:

```json
{ "name": "Full Name", "role": "Role Title", "photo": "", "email": "", "linkedin": "", "portfolio": "" }
```

- `name` and `role` are required. `photo`, `email`, `linkedin`, and `portfolio` are optional —
  leave them as empty strings `""` if unknown, or leave the key out entirely.
- `linkedin` and `portfolio` must be full URLs starting with `http://` or `https://`. Each one
  that's filled in adds a link under the member's name.
- To add a photo: upload a square image (recommended ≥400×400px, JPG or PNG) into
  [`assets/img/board/`](assets/img/board/), then set `"photo"` to the filename only, e.g.
  `"jason-mathew.jpg"` (the site automatically looks inside `assets/img/board/`).
- Members with no photo show a placeholder avatar. A member named exactly `"Name TBD"` shows a
  "Photo coming soon" note instead of initials.

## Update the founders

The club's founders are listed separately, in [`data/founders.json`](data/founders.json), under a
`"founders"` array. Each founder is:

```json
{
  "name": "Full Name",
  "role": "Founder",
  "title": "Job Title",
  "org": "Employer",
  "photo": "",
  "email": "",
  "linkedin": ""
}
```

- Same rules as board members, plus two extra optional fields: `title` (their current job title)
  and `org` (where they work). They render together under the role, as `Job Title · Employer`.
  Fill in either, both, or neither.
- Founder photos go in `assets/img/founders/` (not `assets/img/board/`) — create that folder when
  you add the first one. Founders with no photo show the same placeholder avatar as the e-board.

## Preview locally

No install needed — any static file server works. From the repo root:

```
python3 -m http.server 8080
```

Then open <http://localhost:8080> in a browser.

## Checks

Before committing changes to the data files, it's good practice to run:

```
python3 scripts/validate.py     # validates data/events.json, data/board.json, data/founders.json
node scripts/test-main.js       # unit tests for the calendar/date logic (no dependencies)
```

`scripts/validate.py` checks: valid JSON, required fields present, dates/times in the right
format and internally consistent, `type` is an allowed value, `id`s are unique, `repeat` blocks
are well-formed, URLs start with `http(s)://`, and referenced photos actually exist under
`assets/img/board/` (e-board) or `assets/img/founders/` (founders).

A GitHub Actions workflow ([`.github/workflows/validate-data.yml`](.github/workflows/validate-data.yml))
runs `scripts/validate.py` automatically on every push and pull request that touches the data
files, so a broken JSON file will show up as a failed check before (or right after) it reaches
`main`.

## Project layout

```
index.html                       Single-page site
.nojekyll                        Tells GitHub Pages not to run Jekyll
assets/css/style.css             All styles (self-hosted fonts, no CDN) + theme tokens
assets/js/main.js                Calendar, board rendering, theme toggle, and all interactivity
assets/fonts/roboto-latin.woff2  Self-hosted Roboto variable font (weights 100–900)
assets/fonts/LICENSE-Roboto.txt  Roboto's OFL license
assets/img/cisa-logo.jpg         Club logo (also the favicon)
assets/img/avatar-placeholder.svg  Placeholder avatar for board members with no photo
assets/img/board/                 Board member photos go here
assets/img/founders/              Founder photos go here (create it when you add one)
data/events.json                 Schedule data — edit this to add/change events
data/board.json                  E-board roster — edit this to add/change members
data/founders.json               Club founders — edit this to add/change founders
scripts/validate.py              Validates the three data files (used by CI)
scripts/test-main.js             Node unit tests for assets/js/main.js helpers
.github/workflows/validate-data.yml  CI: runs the validator on push/PR
```

## Hero background image

The photo behind the top section is `assets/img/hero-bg.jpg`. Replace it with any landscape JPG
(recommended at least 1600px wide, ideally under 400 KB). The stylesheet shades it automatically in
both themes so the headline stays readable; if the file is missing, the section simply shows the
flat page background. Only use a photo the club has the rights to publish.

## Font & theme

The site uses **Roboto**, self-hosted from [`assets/fonts/`](assets/fonts/) (OFL-licensed — see
[`LICENSE-Roboto.txt`](assets/fonts/LICENSE-Roboto.txt)). There is no `fonts.googleapis.com` link
and no CDN of any kind — the site still makes zero third-party requests.

A light/dark theme toggle sits at the end of the top nav. It defaults to the visitor's OS-level
preference (`prefers-color-scheme`), and clicking it overrides that and remembers the choice in
`localStorage` so it persists across visits and page reloads.

## Links

- Instagram: [@abingtoncisa](https://www.instagram.com/abingtoncisa)
- Penn State Discover (Engage) org page: <https://psuharrisburg.campuslabs.com/engage/organization/ab-cybersecurity>
- Come Hack: <https://psu-abington-cisa.github.io/come-hack/>
- GitHub org: [psu-abington-cisa](https://github.com/psu-abington-cisa)
