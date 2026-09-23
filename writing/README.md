# CISA Write-ups

Source for [cisa.cybernet.rocks/writing](https://cisa.cybernet.rocks/writing/),
the write-ups site for the Cybersecurity & IT Student Association (CISA) at Penn State Abington.
CTF write-ups, lab notes, and guides live here; the club's main site is
[cisa.cybernet.rocks](https://cisa.cybernet.rocks/).

It's a plain static site — no build step, no framework, no third-party requests — served straight
from this repo by GitHub Pages. Write-ups are Markdown files rendered in the browser.

This README is written for club members who aren't developers. If you can edit a file on
GitHub.com, you can publish a write-up.

## Publish a write-up

1. **Write it in Markdown** and save it as `posts/<slug>.md`, where `<slug>` is lowercase letters,
   digits and hyphens (e.g. `posts/lumon-writeup.md`). Start the file with this block:

   ```markdown
   ---
   title: "The Lumon Incident"
   date: "September 12, 2026"
   author: "Moussa Toure"
   reading: "7 min read"
   description: "A Linux CTF end to end: enumeration, an SSH foothold, and a SUID bash to root."
   tags: ctf, linux, privesc
   ---
   ```

2. **Add it to [`posts.json`](posts.json)** — one line in the `posts` array:

   ```json
   { "slug": "lumon-writeup", "file": "posts/lumon-writeup.md" }
   ```

   The slug is what appears in the URL (`…/writing/#lumon-writeup`), so it must be unique.

3. **Commit to `main`** (or open a pull request). The site updates within about a minute. A check
   runs on every change and will tell you if something is missing.

**Frontmatter reference:**

| Field | Required? | Notes |
|---|---|---|
| `title` | yes | Shown in the index and at the top of the write-up. |
| `date` | yes | `September 12, 2026` or `2026-09-12`. Write-ups are sorted by it and grouped by year. |
| `author` | yes | Your name as you want it shown. |
| `reading` | no | e.g. `"7 min read"`. |
| `description` | no | One sentence, shown under the title in the index and as the feed summary. |
| `tags` | no | Comma-separated, e.g. `ctf, linux, privesc`. Tags become the filter list in the sidebar. |

Title, description, tags, author and the body are all searchable from the box on the index.

**Images** go in `posts/Attachments/` and are referenced relative to the write-up, the way an
Obsidian vault stores them:

```markdown
![](Attachments/Pasted%20image%2020260912180602.png)
```

**Formatting:** standard Markdown, fenced code blocks (with a copy button), tables, and images.
LaTeX between `$...$` or `$$...$$` renders too. A literal dollar sign in prose is written `\$`.

**Before you publish:** don't post flags or solutions for challenges that are still live if the
platform's rules forbid it, and redact any real credentials. See
[How to write a CTF write-up](https://cisa.cybernet.rocks/writing/#how-to-write-a-ctf-writeup)
for the structure we use.

## Preview locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (Opening `index.html` directly from Finder won't work — the
browser blocks `fetch()` on `file://` URLs.)

## Checks

```sh
python3 tools/validate.py     # posts.json is valid, every write-up has its frontmatter, images exist
python3 tools/build_feed.py   # regenerates feed.xml (CI does this automatically on main)
```

`tools/validate.py` runs in GitHub Actions on every push and pull request that touches a write-up.
It checks that `posts.json` is valid JSON, every listed file exists and has `title`/`date`/`author`,
dates parse, referenced images exist, and no `.md` in `posts/` has been left out of `posts.json`.

## How it is served

- GitHub Pages serves the `main` branch of this repo at `cisa.cybernet.rocks/writing/`. The
  main site's repo sets `cisa.cybernet.rocks` as the organization's custom domain, and GitHub
  serves every other repo's Pages site under that domain as a subpath — so this repo needs no
  `CNAME` file or DNS record of its own. (`psu-abington-cisa.github.io/writing/` redirects
  there.) Every path in the code is relative, so it would also work from any other base URL.
- `.nojekyll` must stay. Without it GitHub runs Jekyll, which turns every `posts/*.md` with
  frontmatter into an `.html` page and stops serving the raw `.md` files that `app.js` fetches.
- No third-party requests. `vendor/` holds pinned copies of marked 18.0.12, DOMPurify 3.4.15 and
  MathJax 3.2.2 (licenses alongside). MathJax is loaded on demand, only when a write-up on screen
  contains math. Roboto is self-hosted in `fonts/`, the same file the main site uses.
- `feed.xml` is a committed Atom feed. The validate workflow rebuilds and commits it whenever
  write-ups change on `main`.
- Cache-busting: `styles.css`, `theme.js` and `app.js` are referenced with a `?v=<stamp>` query
  in `index.html`. Bump the stamp when you change one of those three files, or returning visitors
  can keep a stale copy for a while. `posts.json` and the write-ups themselves are fetched fresh.
- `styles.css` takes its colors and type from the main site's `assets/css/style.css`; keep the
  variables at the top in step when the main site's look changes.

## Layout

```
index.html                 The one page; app.js swaps between the index and a write-up
app.js                     Loads posts.json, renders the index and write-ups
theme.js                   Light/dark toggle (runs before first paint)
styles.css                 Site skin
posts.json                 The list of published write-ups — edit this to publish one
posts/                     Write-ups, one Markdown file each
posts/Attachments/         Images referenced by write-ups
feed.xml                   Atom feed (rebuilt by CI)
fonts/                     Self-hosted Roboto
img/                       Logo used for the favicon and link previews
vendor/                    Pinned marked, DOMPurify, MathJax
tools/validate.py          Checks posts.json and write-ups (used by CI)
tools/build_feed.py        Generates feed.xml
```
