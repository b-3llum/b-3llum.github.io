/* app.js — loads the write-ups listed in posts.json, renders the index
   (searchable and filterable by tag) as rows grouped by year, and shows a
   single write-up when the URL hash matches its slug. */

const indexView = document.querySelector("#index-view");
const list = document.querySelector("#post-list");
const count = document.querySelector("#post-count");
const postView = document.querySelector("#post-view");
const postContent = document.querySelector("#post-content");
const pageIndex = document.querySelector("#page-index");
const tagFilter = document.querySelector("#tag-filter");
const search = document.querySelector("#search");
const actionRow = document.querySelector("#post-actions");
const siteTitle = document.title;

let manifest = [];    // entries from posts.json: { slug, file }
let current = null;   // the write-up on screen, or null on the index
let rendered = null;  // the write-up whose content is in #post-content
let allPosts = [];    // every loaded write-up, newest first
let activeTag = "all";
let query = "";

function parseFrontmatter(source) {
  const match = source.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
  if (!match) return { attributes: {}, body: source };

  const attributes = {};
  match[1].split("\n").forEach((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return;
    const key = line.slice(0, separator).trim();
    attributes[key] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
  });
  return { attributes, body: match[2] };
}

/* Images are written relative to the write-up file (Attachments/…), but the
   page is served from the site root. Resolve those paths against the folder
   the write-up itself lives in. */
let assetBase = "";

/* Math. Write-ups put TeX between $...$ and $$...$$. Two things go wrong if
   that text reaches Markdown and MathJax untouched: Markdown treats the
   underscores and asterisks inside formulas as emphasis, and MathJax treats
   any stray "$" in prose (prices, shell prompts) as the start of a formula.
   So the tokenizers below lift math out before Markdown sees it and emit it
   with \(...\) and \[...\] delimiters, which are the only ones MathJax is
   told to look for. Anything else containing "$" is left alone. */
const mathBlock = {
  name: "mathBlock",
  level: "block",
  start(src) { return src.match(/^\$\$/m)?.index; },
  tokenizer(src) {
    const match = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n|$)/.exec(src);
    if (match) return { type: "mathBlock", raw: match[0], text: match[1].trim() };
  },
  renderer(token) { return `<p class="math-block">\\[${escapeHtml(token.text)}\\]</p>\n`; }
};

const mathInline = {
  name: "mathInline",
  level: "inline",
  start(src) { return src.indexOf("$") === -1 ? undefined : src.indexOf("$"); },
  tokenizer(src) {
    const display = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (display) return { type: "mathInline", raw: display[0], text: display[1].trim(), display: true };
    // No lookbehind: it is a parse-time SyntaxError on Safari/iOS < 16.4,
    // which would break this whole file. Forbid a trailing space in code instead.
    const inline = /^\$(?=\S)((?:\\\$|[^$\n])+?)\$(?![0-9$])/.exec(src);
    if (inline && !/\s$/.test(inline[1])) return { type: "mathInline", raw: inline[0], text: inline[1], display: false };
  },
  renderer(token) {
    return token.display
      ? `<span class="math-block">\\[${escapeHtml(token.text)}\\]</span>`
      : `<span class="math">\\(${escapeHtml(token.text)}\\)</span>`;
  }
};

marked.use({
  extensions: [mathBlock, mathInline],
  walkTokens(token) {
    if (token.type !== "image" || !assetBase) return;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(token.href)) return;
    token.href = assetBase + token.href;
  }
});

/* MathJax reads this configuration when its bundle runs. Only the delimiters
   emitted above are recognised; code and pre are skipped by MathJax's
   defaults, so "$" inside shell snippets is never typeset. */
window.MathJax = {
  tex: { inlineMath: [["\\(", "\\)"]], displayMath: [["\\[", "\\]"]] }
};

/* The MathJax bundle is over 1 MB, so it is fetched only the first time a
   write-up on screen actually contains math. Three states after that: the
   bundle is still downloading (its own startup pass will typeset whatever
   is on the page when it runs), it is running its startup (wait for that,
   then typeset), or it is ready. */
let mathjaxRequested = false;

function typeset(element) {
  const mathjax = window.MathJax;
  if (mathjax.typesetPromise) {
    mathjax.typesetPromise([element]).catch((error) => console.error(error));
  } else if (mathjax.startup && mathjax.startup.promise) {
    mathjax.startup.promise.then(() => mathjax.typesetPromise([element])).catch((error) => console.error(error));
  } else if (!mathjaxRequested) {
    mathjaxRequested = true;
    const script = document.createElement("script");
    script.src = "vendor/mathjax/tex-mml-chtml.js";
    script.async = true;
    document.head.appendChild(script);
  }
}

function clearTypeset(element) {
  if (window.MathJax.typesetClear) MathJax.typesetClear([element]);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function uniqueId(base) {
  let id = base;
  let n = 2;
  while (document.getElementById(id) || manifest.some((entry) => entry.slug === id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

function timestamp(post) {
  const value = Date.parse(post.attributes.date || "");
  return Number.isNaN(value) ? -Infinity : value;
}

function yearOf(post) {
  const match = (post.attributes.date || "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

function metaLine(post) {
  return [post.attributes.date, post.attributes.author, post.attributes.reading]
    .filter(Boolean).map(escapeHtml).join(" · ");
}

/* Tags are a comma-separated frontmatter field: `tags: ctf, linux, privesc`. */
function tagsOf(post) {
  return (post.attributes.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
}

async function loadManifest() {
  const response = await fetch("posts.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`Could not load posts.json (HTTP ${response.status})`);
  const data = await response.json();
  return Array.isArray(data.posts) ? data.posts : [];
}

async function loadPost(entry) {
  const response = await fetch(entry.file);
  if (!response.ok) throw new Error(`Could not load ${entry.file}`);
  return { ...entry, ...parseFrontmatter(await response.text()) };
}

function setPageIndex(items) {
  pageIndex.innerHTML = items.length
    ? `<li><span class="sh">On this page</span></li>` +
      items.map((item) => `<li><a href="#${escapeHtml(item.id)}">${escapeHtml(item.label)}</a></li>`).join("")
    : "";
}

/* ---- index: search + tag filter ---- */

function allTags() {
  const set = new Set();
  allPosts.forEach((post) => tagsOf(post).forEach((t) => set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function renderTagFilter() {
  if (!tagFilter) return;
  const tags = allTags();
  if (!tags.length) { tagFilter.innerHTML = ""; return; }
  const pill = (value, label, active) =>
    `<li><button class="pill${active ? " active" : ""}" data-filter="${escapeHtml(value)}">${escapeHtml(label)}</button></li>`;
  tagFilter.innerHTML =
    `<li><span class="sh">Filter</span></li>` +
    pill("all", "All", activeTag === "all") +
    tags.map((t) => pill(t, t, activeTag === t)).join("");
  tagFilter.querySelectorAll(".pill").forEach((button) => {
    button.addEventListener("click", () => {
      activeTag = button.dataset.filter;
      renderTagFilter();
      applyFilter();
    });
  });
}

function matchesFilter(post) {
  if (activeTag !== "all" && !tagsOf(post).includes(activeTag)) return false;
  if (!query) return true;
  const hay = [post.attributes.title, post.attributes.description, post.attributes.author, tagsOf(post).join(" "), post.body]
    .filter(Boolean).join(" ").toLowerCase();
  return hay.includes(query);
}

function applyFilter() {
  renderList(allPosts.filter(matchesFilter));
}

/* ---- list ---- */

function renderRow(post) {
  const tags = tagsOf(post);
  const item = document.createElement("li");
  item.innerHTML = `
    <a class="row" href="#${escapeHtml(post.slug)}">
      <span class="ttl-row">
        <span class="ttl">${escapeHtml(post.attributes.title || post.slug)}</span>
        ${post.attributes.description ? `<span class="sub">${escapeHtml(post.attributes.description)}</span>` : ""}
        ${tags.length ? `<span class="row-tags">${tags.map((t) => `<span class="row-tag">${escapeHtml(t)}</span>`).join("")}</span>` : ""}
      </span>
      <span class="right">
        <span class="meta">${metaLine(post)}</span>
        <span class="chev" aria-hidden="true">&rsaquo;</span>
      </span>
    </a>`;
  return item;
}

function renderList(loadedPosts) {
  list.innerHTML = "";

  if (!loadedPosts.length) {
    const bits = [];
    if (query) bits.push(`“${escapeHtml(query)}”`);
    if (activeTag !== "all") bits.push(`tag ${escapeHtml(activeTag)}`);
    list.innerHTML = `<div class="notice"><p>No write-ups match${bits.length ? " " + bits.join(" in ") : ""}.</p></div>`;
    count.textContent = allPosts.length ? `0 of ${allPosts.length}` : "";
    return;
  }

  const groups = new Map();
  loadedPosts.forEach((post) => {
    const year = yearOf(post);
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(post);
  });

  groups.forEach((group, year) => {
    const block = document.createElement("div");
    block.className = "year-block";
    if (year) {
      const heading = document.createElement("h2");
      heading.textContent = year;
      block.appendChild(heading);
    }
    const rows = document.createElement("ul");
    rows.className = "row-list";
    group.forEach((post) => rows.appendChild(renderRow(post)));
    block.appendChild(rows);
    list.appendChild(block);
  });

  const noun = loadedPosts.length === 1 ? "write-up" : "write-ups";
  count.textContent = loadedPosts.length === allPosts.length
    ? `${loadedPosts.length} ${noun}`
    : `${loadedPosts.length} of ${allPosts.length}`;
}

function showIndex() {
  current = null;
  postView.hidden = true;
  indexView.hidden = false;
  setPageIndex([{ id: "writeups", label: "Write-ups" }]);
  renderTagFilter();
  document.title = siteTitle;
}

/* ---- single write-up ---- */

function copyText(text, button) {
  const label = button.textContent;
  const done = () => {
    button.textContent = "Copied";
    button.classList.add("copied");
    setTimeout(() => { button.textContent = label; button.classList.remove("copied"); }, 1200);
  };
  const fallback = () => {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); done(); } catch (error) { console.error(error); }
    area.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(fallback);
  } else {
    fallback();
  }
}

/* Heading anchor links and per-block copy buttons, added after the markdown
   is in the DOM but before MathJax runs (MathJax skips pre/code anyway). */
function decoratePost() {
  postContent.querySelectorAll(".markdown-body h2, .markdown-body h3").forEach((heading) => {
    const label = heading.textContent.trim();
    if (!heading.id) heading.id = uniqueId(slugify(label));
    heading.dataset.label = label;
    const anchor = document.createElement("a");
    anchor.className = "anchor";
    anchor.href = `#${heading.id}`;
    anchor.setAttribute("aria-label", `Link to “${label}”`);
    anchor.textContent = "#";
    heading.appendChild(anchor);
  });

  postContent.querySelectorAll(".markdown-body pre").forEach((pre) => {
    if (pre.parentElement && pre.parentElement.classList.contains("code-block")) return;
    const code = pre.querySelector("code");
    const wrap = document.createElement("div");
    wrap.className = "code-block";
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-btn";
    button.textContent = "Copy";
    button.addEventListener("click", () => copyText((code || pre).innerText, button));
    wrap.appendChild(button);
  });
}

function renderPost(post) {
  rendered = post;
  assetBase = post.file.replace(/[^/]*$/, "");
  clearTypeset(postContent);
  const meta = metaLine(post);
  const tags = tagsOf(post);
  postContent.innerHTML = `
    <div class="page-head">
      ${meta ? `<p class="eyebrow">${meta}</p>` : ""}
      <h1>${escapeHtml(post.attributes.title || post.slug)}</h1>
      ${post.attributes.description ? `<p class="lede">${escapeHtml(post.attributes.description)}</p>` : ""}
      ${tags.length ? `<p class="post-tags">${tags.map((t) => `<span class="row-tag">${escapeHtml(t)}</span>`).join("")}</p>` : ""}
    </div>
    <div class="markdown-body">${DOMPurify.sanitize(marked.parse(post.body))}</div>`;

  decoratePost();
  if (postContent.querySelector(".math, .math-block")) typeset(postContent);
}

/* Newest-first order, so the write-up before this one is newer and the one
   after is older. */
function renderActions(post) {
  if (!actionRow) return;
  const i = allPosts.indexOf(post);
  const newer = allPosts[i - 1];
  const older = allPosts[i + 1];
  const link = (target, dir, arrow) => target
    ? `<a class="pn-link pn-${dir}" href="#${escapeHtml(target.slug)}">
         <span class="pn-dir">${arrow}</span>
         <span class="pn-ttl">${escapeHtml(target.attributes.title || target.slug)}</span>
       </a>`
    : `<span class="pn-link pn-empty" aria-hidden="true"></span>`;
  actionRow.innerHTML =
    `<a class="all-posts" href="#writeups">&larr; All write-ups</a>
     <nav class="prev-next" aria-label="More write-ups">
       ${link(newer, "newer", "Newer &uarr;")}
       ${link(older, "older", "Older &darr;")}
     </nav>`;
}

function revealPost(post) {
  current = post;
  indexView.hidden = true;
  postView.hidden = false;
  if (tagFilter) tagFilter.innerHTML = "";
  const headings = Array.from(postContent.querySelectorAll(".markdown-body h2"));
  setPageIndex(headings.map((heading) => ({ id: heading.id, label: heading.dataset.label || heading.textContent })));
  renderActions(post);
  document.title = `${post.attributes.title || post.slug} · ${siteTitle}`;
}

function showPost(post) {
  if (rendered !== post) renderPost(post);
  revealPost(post);
  window.scrollTo({ top: 0 });
}

function route(loadedPosts) {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  const post = loadedPosts.find((entry) => entry.slug === hash);
  if (post) {
    if (post !== current) showPost(post);
    return;
  }

  // A hash that points at a heading inside the last opened write-up (from
  // the side index, an anchor link, or the browser going back to it): keep
  // or restore that write-up and let the browser scroll to the heading.
  const target = hash ? document.getElementById(hash) : null;
  if (rendered && target && postView.contains(target)) {
    if (!current) {
      revealPost(rendered);
      target.scrollIntoView();
    }
    return;
  }

  if (current) {
    showIndex();
    window.scrollTo({ top: 0 });
  }
}

/* Mobile nav: the header collapses behind a toggle on small screens. */
function setupNav() {
  const toggle = document.querySelector("#navToggle");
  const nav = document.querySelector("#siteNav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  nav.addEventListener("click", (event) => {
    if (event.target.tagName === "A") nav.classList.remove("open");
  });
}

function showLoadError() {
  list.innerHTML = `<div class="notice"><p>The write-ups could not be loaded. If you are previewing locally, serve this folder over HTTP, for example <code>python3 -m http.server 8000</code>, then reload.</p></div>`;
}

async function start() {
  setupNav();
  if (search) {
    search.addEventListener("input", () => {
      query = search.value.trim().toLowerCase();
      if (!current) applyFilter();
    });
  }

  try {
    manifest = await loadManifest();
  } catch (error) {
    console.error(error);
    showLoadError();
    return;
  }

  if (!manifest.length) {
    list.innerHTML = `<div class="notice"><p>No write-ups have been published yet.</p></div>`;
    return;
  }

  // allSettled, not all: a single unreachable write-up should not blank the
  // entire index. Render every one that loaded; only show the error when
  // nothing loaded at all.
  const settled = await Promise.allSettled(manifest.map(loadPost));
  allPosts = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  settled.filter((s) => s.status === "rejected").forEach((s) => console.error(s.reason));

  if (!allPosts.length) {
    showLoadError();
    return;
  }

  allPosts.sort((a, b) => timestamp(b) - timestamp(a));
  renderTagFilter();
  applyFilter();
  route(allPosts);
  window.addEventListener("hashchange", () => route(allPosts));
}

start();
