---
title: "How to write a CTF write-up"
date: "September 15, 2026"
author: "CISA E-Board"
reading: "4 min read"
description: "The shape we use for write-ups on this site, what to include, what to leave out, and how to get yours published."
tags: guide, ctf
---

A write-up is the part of a CTF that outlives the CTF. The box gets retired,
the scoreboard closes, and what is left is your explanation of how it went.
Written well, it is proof of work you can hand to a recruiter, a study guide
for the next person, and a record of the thing you learned at 1 a.m. that you
will otherwise forget by Thursday.

This is the shape we use here. It is a starting point, not a form to fill in.

## Summary

Open with three or four sentences that give the whole story: what the target
was, how you got in, how you escalated, and the one idea that made it click.
Someone skimming the index should be able to read only this section and know
whether the rest is for them.

## Recon

What you scanned, what you found, and what you decided to chase first. Include
the actual commands and trim the output to the lines that mattered.

```sh
nmap -sC -sV -oN nmap/initial 10.10.11.42
```

```text
22/tcp open  ssh     OpenSSH 8.9p1
80/tcp open  http    Apache httpd 2.4.52
```

Say what you skipped and why. Recon is where most of the judgment happens, and
the judgment is the interesting part.

## Foothold

The step that got you a shell or a login. Walk through it as if the reader has
your recon notes but not your hindsight: what you tried that did not work is
worth a sentence, because it shows the reasoning, not just the answer.

Screenshots go in `posts/Attachments/` and are referenced relative to the
write-up, the way an Obsidian vault stores them:

```markdown
![](Attachments/foothold-shell.png)
```

## Privilege escalation

Same treatment. Name the misconfiguration or vulnerability plainly, show the
check that found it, then the exploitation.

| Check | Command | What it told us |
|---|---|---|
| SUID binaries | `find / -perm -4000 -type f 2>/dev/null` | `/usr/bin/bash` was SUID root |
| Sudo rules | `sudo -l` | nothing useful |

## Lessons learned

Two or three bullets. What would you do faster next time? What did you
misread? Which rabbit hole cost you an hour, and what would have let you spot
it sooner? This section is the one people actually reuse.

## What to leave out

- **Flags for live challenges.** If the platform's rules say not to publish
  flags or solutions for active boxes, respect that. Retired machines are
  fine.
- **Credentials that are not yours.** Redact anything that touches a real
  account or a real system.
- **Padding.** A tight 600 words beats a loose 2,000. If a section has nothing
  to say, delete the heading.

## Formatting that works here

Standard Markdown, fenced code blocks, tables, and images all render. Inline
math like $2^{32}$ and display math

$$
H(m) = \text{SHA-256}(m) \pmod{2^{64}}
$$

render too, for the crypto write-ups. A literal dollar sign in prose is
written `\$`.

## Getting it published

1. Save your write-up as a Markdown file in `posts/`, starting with the same
   frontmatter block as the top of this file (`title`, `date`, `author`,
   `reading`, `description`, `tags`).
2. Add one line for it to `posts.json`.
3. Open a pull request, or commit to `main` if you have access. The site
   updates within a minute or so.

The [README](https://github.com/psu-abington-cisa/writing#readme) has the
full field reference. If anything is unclear, ask in the club chat.
