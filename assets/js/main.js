/* =========================================================================
   CISA @ Penn State Abington — site script
   Vanilla JS, no build step, no third-party requests.
   Pure helpers live at the top and are exported for Node unit tests via the
   guarded `module.exports` block at the bottom. DOM code only runs when
   `document` exists, inside init().
   ========================================================================= */

(function (root) {
  'use strict';

  // =======================================================================
  // Pure helpers (safe to run in Node or the browser)
  // =======================================================================

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var EVENT_TYPES = ['meeting', 'come-hack', 'workshop', 'social', 'competition', 'other'];

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /**
   * Parse a YYYY-MM-DD date (and optional HH:MM time) into a local Date
   * object WITHOUT using `new Date('YYYY-MM-DD')`, which parses as UTC and
   * can shift the calendar day for viewers west of UTC.
   */
  function parseLocal(dateStr, timeStr) {
    var dparts = String(dateStr).split('-');
    var y = parseInt(dparts[0], 10);
    var m = parseInt(dparts[1], 10);
    var d = parseInt(dparts[2], 10);
    var hh = 0, mm = 0;
    if (timeStr) {
      var tparts = String(timeStr).split(':');
      hh = parseInt(tparts[0], 10);
      mm = parseInt(tparts[1], 10);
    }
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }

  /** Add whole days to a YYYY-MM-DD string, returning a YYYY-MM-DD string. */
  function addDaysToDateStr(dateStr, days) {
    var dparts = String(dateStr).split('-');
    var d = new Date(parseInt(dparts[0], 10), parseInt(dparts[1], 10) - 1, parseInt(dparts[2], 10));
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function dateStrOf(y, m, d) {
    return y + '-' + pad2(m) + '-' + pad2(d);
  }

  function fmtDate(date) {
    return WEEKDAY_NAMES[date.getDay()] + ', ' + MONTH_NAMES[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
  }

  function fmtTime12(hh, mm) {
    var period = hh >= 12 ? 'PM' : 'AM';
    var h12 = hh % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + pad2(mm) + ' ' + period;
  }

  /** "12:15 – 1:15 PM" style range from HH:MM strings (end optional). */
  function fmtTime(start, end) {
    if (!start) return '';
    var s = start.split(':').map(function (n) { return parseInt(n, 10); });
    if (!end) return fmtTime12(s[0], s[1]);
    var e = end.split(':').map(function (n) { return parseInt(n, 10); });
    var startPeriod = s[0] >= 12 ? 'PM' : 'AM';
    var endPeriod = e[0] >= 12 ? 'PM' : 'AM';
    var sh = s[0] % 12; if (sh === 0) sh = 12;
    if (startPeriod === endPeriod) {
      return sh + ':' + pad2(s[1]) + ' – ' + fmtTime12(e[0], e[1]);
    }
    return fmtTime12(s[0], s[1]) + ' – ' + fmtTime12(e[0], e[1]);
  }

  /**
   * Expand a single event definition (which may carry a `repeat` block)
   * into concrete occurrences. Each occurrence is a shallow copy of the
   * event with `date` set to that occurrence's date and `occId` set to
   * `<id>` (no repeat) or `<id>@<date>` (repeated occurrence).
   */
  function expandRepeat(event) {
    var occurrences = [];
    if (!event || !event.repeat) {
      var single = shallowCopy(event);
      single.occId = event.id;
      occurrences.push(single);
      return occurrences;
    }
    var step = event.repeat.every === '2w' ? 14 : 7;
    var until = event.repeat.until;
    var skip = event.repeat.skip || [];
    var cur = event.date;
    var guard = 0;
    while (cur <= until && guard < 500) {
      guard++;
      if (skip.indexOf(cur) === -1) {
        var occ = shallowCopy(event);
        occ.date = cur;
        occ.occId = event.id + '@' + cur;
        occurrences.push(occ);
      }
      cur = addDaysToDateStr(cur, step);
    }
    return occurrences;
  }

  function shallowCopy(obj) {
    var out = {};
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
    }
    return out;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
      if (ch === '&') return '&amp;';
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      if (ch === '"') return '&quot;';
      return '&#39;';
    });
  }

  /** Only http(s) and mailto URLs are allowed as href targets. */
  function isSafeUrl(url) {
    return /^(https?:|mailto:)/i.test(String(url || ''));
  }

  /**
   * Resolve the effective theme ('light' | 'dark') from an explicit stored
   * choice plus the OS-level preference. An explicit stored choice ('light'
   * or 'dark') always wins; any other value (including null/undefined, e.g.
   * localStorage was empty or unavailable) falls back to the system
   * preference.
   */
  function resolveTheme(stored, systemPrefersLight) {
    if (stored === 'light' || stored === 'dark') return stored;
    return systemPrefersLight ? 'light' : 'dark';
  }

  /** The theme the toggle switches TO from the given current theme. */
  function nextTheme(current) {
    return current === 'light' ? 'dark' : 'light';
  }

  function toGCalDatesParam(dateStr, start, end) {
    var d = dateStr.replace(/-/g, '');
    if (!start) {
      var endDate = addDaysToDateStr(dateStr, 1).replace(/-/g, '');
      return d + '/' + endDate;
    }
    var s = start.replace(':', '') + '00';
    var e = (end || start).replace(':', '') + '00';
    return d + 'T' + s + '/' + d + 'T' + e;
  }

  /** Build a "Add to Google Calendar" URL for one occurrence. */
  function toGCal(occ) {
    var params = [];
    params.push('action=TEMPLATE');
    params.push('text=' + encodeURIComponent(occ.title || ''));
    params.push('dates=' + toGCalDatesParam(occ.date, occ.start, occ.end));
    var detailsText = occ.summary || '';
    if (occ.url) detailsText += (detailsText ? '\n\n' : '') + occ.url;
    params.push('details=' + encodeURIComponent(detailsText));
    params.push('location=' + encodeURIComponent(occ.location || ''));
    params.push('ctz=America/New_York');
    return 'https://calendar.google.com/calendar/render?' + params.join('&');
  }

  function icsEscape(str) {
    return String(str == null ? '' : str)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  /**
   * UTF-8 octet length of a single JS "character" as produced by iterating a
   * string with `Array.from` / `for...of` (i.e. one full Unicode code point,
   * with surrogate pairs already combined). No Buffer/TextEncoder needed so
   * this runs identically in Node and the browser.
   */
  function charUtf8Len(ch) {
    var code = ch.codePointAt(0);
    if (code <= 0x7F) return 1;
    if (code <= 0x7FF) return 2;
    if (code <= 0xFFFF) return 3;
    return 4;
  }

  /**
   * Fold one logical iCalendar content line (no CRLF in `line`) per RFC 5545
   * §3.1: physical lines SHOULD be no longer than 75 octets, and folding is
   * done by inserting CRLF followed by a single space before the octet that
   * would exceed the limit. Folding is done per-code-point (never splitting
   * a multi-byte UTF-8 character) by counting octet length per character
   * rather than relying on Buffer/TextEncoder, so it also works unmodified
   * in the browser.
   */
  function foldLine(line) {
    var chars = Array.from(String(line == null ? '' : line));
    var maxOctets = 75;
    var out = [];
    var cur = '';
    var curOctets = 0;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      var chLen = charUtf8Len(ch);
      if (cur !== '' && curOctets + chLen > maxOctets) {
        out.push(cur);
        cur = ' ' + ch;
        curOctets = 1 + chLen;
      } else {
        cur += ch;
        curOctets += chLen;
      }
    }
    out.push(cur);
    return out.join('\r\n');
  }

  /** Build a floating-local-time .ics VCALENDAR document for one occurrence. */
  function toIcs(occ) {
    var dt = occ.date.replace(/-/g, '');
    var lines = [];
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//CISA Penn State Abington//Events//EN');
    lines.push('CALSCALE:GREGORIAN');
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + (occ.occId || occ.id) + '@psu-abington-cisa.github.io');
    if (occ.start) {
      lines.push('DTSTART:' + dt + 'T' + occ.start.replace(':', '') + '00');
      lines.push('DTEND:' + dt + 'T' + (occ.end || occ.start).replace(':', '') + '00');
    } else {
      lines.push('DTSTART;VALUE=DATE:' + dt);
      lines.push('DTEND;VALUE=DATE:' + addDaysToDateStr(occ.date, 1).replace(/-/g, ''));
    }
    lines.push('SUMMARY:' + icsEscape(occ.title));
    var desc = occ.description || occ.summary;
    if (desc) lines.push('DESCRIPTION:' + icsEscape(desc));
    if (occ.location) lines.push('LOCATION:' + icsEscape(occ.location));
    if (occ.url) lines.push('URL:' + icsEscape(occ.url));
    lines.push('END:VEVENT');
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n');
  }

  // =======================================================================
  // Browser-only code
  // =======================================================================

  function initBrowser() {
    var STORAGE_KEY = 'cisa-calendar-view';
    var THEME_KEY = 'cisa-theme';

    var state = {
      events: [],       // raw events from JSON (unexpanded)
      occurrences: [],  // expanded + sorted occurrences
      board: [],
      founders: [],
      view: null,       // 'month' | 'list'
      cursorYear: null,
      cursorMonth: null, // 0-based
      selectedOccId: null
    };

    document.addEventListener('DOMContentLoaded', function () {
      wireStaticUI();
      wireThemeToggle();
      loadEvents();
      loadBoard();
      loadFounders();
    });

    function wireStaticUI() {
      var year = document.getElementById('footer-year');
      if (year) year.textContent = String(new Date().getFullYear());
    }

    function safeLocalGet(key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }
    function safeLocalSet(key, val) {
      try { window.localStorage.setItem(key, val); } catch (e) { /* ignore */ }
    }

    // ---------------- Theme toggle ----------------

    function wireThemeToggle() {
      var btn = document.getElementById('theme-toggle');
      var metaThemeColor = document.querySelector('meta[name="theme-color"]');
      var mql = null;
      try { mql = window.matchMedia('(prefers-color-scheme: light)'); } catch (e) { mql = null; }

      function systemPrefersLight() {
        return !!(mql && mql.matches);
      }

      function applyLabelAndMeta(theme) {
        if (btn) btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
        if (metaThemeColor) metaThemeColor.setAttribute('content', theme === 'light' ? '#f4f7fc' : '#050b18');
      }

      var current = resolveTheme(safeLocalGet(THEME_KEY), systemPrefersLight());
      applyLabelAndMeta(current);

      if (btn) {
        btn.addEventListener('click', function () {
          current = nextTheme(current);
          document.documentElement.setAttribute('data-theme', current);
          safeLocalSet(THEME_KEY, current);
          applyLabelAndMeta(current);
        });
      }

      if (mql) {
        var onSystemChange = function () {
          var stored = safeLocalGet(THEME_KEY);
          if (stored === 'light' || stored === 'dark') return; // explicit choice wins
          current = resolveTheme(null, systemPrefersLight());
          applyLabelAndMeta(current);
        };
        if (mql.addEventListener) mql.addEventListener('change', onSystemChange);
        else if (mql.addListener) mql.addListener(onSystemChange); // older Safari
      }
    }

    // ---------------- data loading ----------------

    function loadEvents() {
      fetch('./data/events.json', { cache: 'no-cache' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          state.events = Array.isArray(data.events) ? data.events : [];
          var all = [];
          state.events.forEach(function (ev) {
            expandRepeat(ev).forEach(function (occ) { all.push(occ); });
          });
          all.sort(function (a, b) {
            var da = parseLocal(a.date, a.start || '00:00');
            var db = parseLocal(b.date, b.start || '00:00');
            return da - db;
          });
          state.occurrences = all;

          var now = new Date();
          state.cursorYear = now.getFullYear();
          state.cursorMonth = now.getMonth();

          var initialView = safeLocalGet(STORAGE_KEY);
          if (initialView !== 'month' && initialView !== 'list') {
            initialView = window.innerWidth >= 720 ? 'month' : 'list';
          }
          state.view = initialView;

          renderNextUp();
          renderScheduleControls();
          renderCalendar();
        })
        .catch(function (err) {
          console.error('Failed to load events.json', err);
          renderEventsError();
        });
    }

    function loadBoard() {
      fetch('./data/board.json', { cache: 'no-cache' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          state.board = Array.isArray(data.members) ? data.members : [];
          renderBoard();
        })
        .catch(function (err) {
          console.error('Failed to load board.json', err);
          renderBoardError();
        });
    }

    function loadFounders() {
      fetch('./data/founders.json', { cache: 'no-cache' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          state.founders = Array.isArray(data.founders) ? data.founders : [];
          renderFounders();
        })
        .catch(function (err) {
          console.error('Failed to load founders.json', err);
          renderFoundersError();
        });
    }

    // ---------------- Next Up ----------------

    function findNextOccurrence() {
      var now = new Date();
      for (var i = 0; i < state.occurrences.length; i++) {
        var occ = state.occurrences[i];
        if (occ.cancelled) continue;
        var end = parseLocal(occ.date, occ.end || occ.start || '23:59');
        if (end >= now) return occ;
      }
      return null;
    }

    function renderNextUp() {
      var el = document.getElementById('next-card');
      if (!el) return;
      var occ = findNextOccurrence();
      if (!occ) {
        el.innerHTML = '<p class="next-empty">No upcoming meetings scheduled yet &mdash; check Instagram for updates.</p>';
        return;
      }
      var d = parseLocal(occ.date, occ.start || '00:00');
      el.innerHTML = buildNextCardHtml(occ, d);
    }

    function buildNextCardHtml(occ, d) {
      var html = '';
      html += '<div class="next-datebox"><span class="mon">' + MONTH_SHORT[d.getMonth()] + '</span><span class="day">' + d.getDate() + '</span></div>';
      html += '<div class="next-body">';
      html += '<h3>' + escapeHtml(occ.title) + '</h3>';
      html += '<div class="next-meta">';
      html += '<span>' + escapeHtml(fmtDate(d)) + '</span>';
      if (occ.start) html += '<span>' + escapeHtml(fmtTime(occ.start, occ.end)) + '</span>';
      if (occ.location) html += '<span>' + escapeHtml(occ.location) + '</span>';
      html += '</div>';
      if (occ.summary) html += '<p>' + escapeHtml(occ.summary) + '</p>';
      html += '<div class="next-links">';
      if (occ.url && isSafeUrl(occ.url)) {
        html += '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(occ.url) + '" target="_blank" rel="noopener">Details</a>';
      }
      html += '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(toGCal(occ)) + '" target="_blank" rel="noopener">Add to Google Calendar</a>';
      html += '<a class="btn btn-ghost btn-sm" href="' + icsHref(occ) + '" download="cisa-' + escapeHtml(occ.occId || occ.id) + '.ics">Download .ics</a>';
      html += '</div></div>';
      return html;
    }

    function icsHref(occ) {
      return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(toIcs(occ));
    }

    function renderEventsError() {
      ['next-card'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '<p class="cal-error">Could not load the schedule right now. Please check back later or see our Instagram for updates.</p>';
      });
      var cal = document.getElementById('cal-wrap');
      if (cal) cal.innerHTML = '<p class="cal-error">Could not load the schedule right now. Please check back later or see our Instagram for updates.</p>';
    }

    // ---------------- Schedule: controls (view toggle, month nav) ----------------

    function renderScheduleControls() {
      var viewToggle = document.getElementById('view-toggle');
      if (viewToggle) {
        var monthBtn = viewToggle.querySelector('[data-view="month"]');
        var listBtn = viewToggle.querySelector('[data-view="list"]');
        function updatePressed() {
          if (monthBtn) monthBtn.setAttribute('aria-pressed', String(state.view === 'month'));
          if (listBtn) listBtn.setAttribute('aria-pressed', String(state.view === 'list'));
        }
        updatePressed();
        if (monthBtn) monthBtn.addEventListener('click', function () {
          state.view = 'month';
          safeLocalSet(STORAGE_KEY, 'month');
          updatePressed();
          renderCalendar();
        });
        if (listBtn) listBtn.addEventListener('click', function () {
          state.view = 'list';
          safeLocalSet(STORAGE_KEY, 'list');
          updatePressed();
          renderCalendar();
        });
      }

      var prevBtn = document.getElementById('cal-prev');
      var nextBtn = document.getElementById('cal-next');
      var todayBtn = document.getElementById('cal-today');
      if (prevBtn) prevBtn.addEventListener('click', function () {
        state.cursorMonth -= 1;
        if (state.cursorMonth < 0) { state.cursorMonth = 11; state.cursorYear -= 1; }
        renderCalendar();
      });
      if (nextBtn) nextBtn.addEventListener('click', function () {
        state.cursorMonth += 1;
        if (state.cursorMonth > 11) { state.cursorMonth = 0; state.cursorYear += 1; }
        renderCalendar();
      });
      if (todayBtn) todayBtn.addEventListener('click', function () {
        var now = new Date();
        state.cursorYear = now.getFullYear();
        state.cursorMonth = now.getMonth();
        renderCalendar();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeDetailPanel();
      });
    }

    // ---------------- Calendar rendering ----------------

    function renderCalendar() {
      var monthNav = document.getElementById('cal-nav');
      var calBody = document.getElementById('cal-body');
      var calWrap = document.getElementById('cal-wrap');
      if (!calBody) return;

      if (monthNav) monthNav.hidden = state.view !== 'month';

      if (state.view === 'month') {
        renderMonthGrid(calBody);
      } else {
        closeDetailPanel();
        renderListView(calBody);
      }
      if (calWrap) calWrap.classList.toggle('has-detail', !!state.selectedOccId && state.view === 'month');
    }

    function occurrencesOnDate(dateStr) {
      return state.occurrences.filter(function (o) { return o.date === dateStr; });
    }

    function renderMonthGrid(container) {
      var heading = document.getElementById('cal-heading');
      if (heading) heading.textContent = MONTH_NAMES[state.cursorMonth] + ' ' + state.cursorYear;

      var firstOfMonth = new Date(state.cursorYear, state.cursorMonth, 1);
      var startWeekday = firstOfMonth.getDay();
      var daysInMonth = new Date(state.cursorYear, state.cursorMonth + 1, 0).getDate();

      var now = new Date();
      var todayStr = dateStrOf(now.getFullYear(), now.getMonth() + 1, now.getDate());

      var cells = [];
      // leading days from previous month
      var prevMonthDays = new Date(state.cursorYear, state.cursorMonth, 0).getDate();
      for (var i = 0; i < startWeekday; i++) {
        var pm = state.cursorMonth - 1, py = state.cursorYear;
        if (pm < 0) { pm = 11; py -= 1; }
        var pd = prevMonthDays - startWeekday + i + 1;
        cells.push({ y: py, m: pm, d: pd, dim: true });
      }
      // days of current month
      for (var d = 1; d <= daysInMonth; d++) {
        cells.push({ y: state.cursorYear, m: state.cursorMonth, d: d, dim: false });
      }
      // trailing days to fill full weeks (multiple of 7, up to 6 rows)
      var totalCells = Math.ceil(cells.length / 7) * 7;
      var nextIdx = 1;
      while (cells.length < totalCells) {
        var nm = state.cursorMonth + 1, ny = state.cursorYear;
        if (nm > 11) { nm = 0; ny += 1; }
        cells.push({ y: ny, m: nm, d: nextIdx, dim: true });
        nextIdx++;
      }

      var html = '';
      WEEKDAY_SHORT.forEach(function (wd) { html += '<div class="wd">' + wd + '</div>'; });

      cells.forEach(function (cell) {
        var dateStr = dateStrOf(cell.y, cell.m + 1, cell.d);
        var dayOccs = occurrencesOnDate(dateStr);
        var classes = ['day-cell'];
        if (cell.dim) classes.push('dim');
        if (dateStr === todayStr) classes.push('today');
        var interactiveAttrs = '';
        if (dayOccs.length > 0) {
          var cellWeekday = WEEKDAY_NAMES[new Date(cell.y, cell.m, cell.d).getDay()];
          var cellLabel = 'Events on ' + cellWeekday + ', ' + MONTH_NAMES[cell.m] + ' ' + cell.d;
          interactiveAttrs = ' tabindex="0" role="button" aria-label="' + escapeHtml(cellLabel) + '"';
        }
        html += '<div class="' + classes.join(' ') + '" data-date="' + dateStr + '"' + interactiveAttrs + '>';
        html += '<span class="day-num">' + cell.d + '</span>';
        dayOccs.slice(0, 3).forEach(function (occ) {
          var typeVar = 'var(--type-' + typeSlug(occ.type) + ')';
          var chipClass = 'day-chip' + (occ.cancelled ? ' cancelled' : '');
          html += '<button type="button" class="' + chipClass + '" style="border-left-color:' + typeVar + '" data-occ="' + escapeHtml(occ.occId) + '" title="' + escapeHtml(occ.title) + '">' + escapeHtml(occ.title) + '</button>';
        });
        if (dayOccs.length > 3) {
          html += '<span class="day-chip" style="background:transparent;border:none;color:var(--muted)">+' + (dayOccs.length - 3) + ' more</span>';
        }
        html += '</div>';
      });

      container.innerHTML = '<div class="month-grid">' + html + '</div>';

      container.querySelectorAll('.day-chip[data-occ]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          openDetailForOccId(btn.getAttribute('data-occ'));
        });
      });
      container.querySelectorAll('.day-cell').forEach(function (cellEl) {
        function activateCell() {
          var dateStr = cellEl.getAttribute('data-date');
          var occs = occurrencesOnDate(dateStr);
          if (occs.length > 0) openDetailForOccId(occs[0].occId);
        }
        cellEl.addEventListener('click', activateCell);
        cellEl.addEventListener('keydown', function (e) {
          // Ignore keydowns bubbling up from a nested chip <button> — those
          // handle their own activation (and their click stopPropagation()s).
          if (e.target !== cellEl) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            activateCell();
          }
        });
      });

      renderDetailPanel();
    }

    function typeSlug(type) {
      if (type === 'come-hack') return 'comehack';
      if (EVENT_TYPES.indexOf(type) === -1) return 'other';
      return type;
    }

    function openDetailForOccId(occId) {
      state.selectedOccId = occId;
      var calWrap = document.getElementById('cal-wrap');
      if (calWrap) calWrap.classList.add('has-detail');
      renderDetailPanel();
    }

    function closeDetailPanel() {
      if (!state.selectedOccId) return;
      state.selectedOccId = null;
      var calWrap = document.getElementById('cal-wrap');
      if (calWrap) calWrap.classList.remove('has-detail');
      renderDetailPanel();
    }

    function renderDetailPanel() {
      var slot = document.getElementById('detail-panel-slot');
      if (!slot) return;
      if (!state.selectedOccId) { slot.innerHTML = ''; return; }
      var occ = state.occurrences.filter(function (o) { return o.occId === state.selectedOccId; })[0];
      if (!occ) { slot.innerHTML = ''; return; }
      var d = parseLocal(occ.date, occ.start || '00:00');
      var typeColor = 'var(--type-' + typeSlug(occ.type) + ')';

      var html = '<div class="detail-panel" style="color:' + typeColor + '" role="region" aria-label="Event details">';
      html += '<button type="button" class="close-btn" aria-label="Close details">&times;</button>';
      html += '<span class="type-badge">' + escapeHtml(occ.type) + '</span>';
      if (occ.cancelled) html += '<span class="cancelled-badge">Cancelled</span>';
      var titleClass = occ.cancelled ? ' class="row-cancelled"' : '';
      html += '<h3' + titleClass + ' style="color:var(--heading)">' + escapeHtml(occ.title) + '</h3>';
      html += '<div class="detail-meta">' + escapeHtml(fmtDate(d));
      if (occ.start) html += ' &middot; ' + escapeHtml(fmtTime(occ.start, occ.end));
      html += '</div>';
      if (occ.location) html += '<div class="detail-meta">' + escapeHtml(occ.location) + '</div>';
      if (occ.summary) html += '<p style="color:var(--text)">' + escapeHtml(occ.summary) + '</p>';
      if (occ.description) html += '<p style="color:var(--muted)">' + escapeHtml(occ.description) + '</p>';
      if (occ.tags && occ.tags.length) {
        html += '<div class="detail-tags">' + occ.tags.map(function (t) { return '<span>' + escapeHtml(t) + '</span>'; }).join('') + '</div>';
      }
      html += '<div class="detail-links">';
      if (occ.url && isSafeUrl(occ.url)) html += '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(occ.url) + '" target="_blank" rel="noopener">Event page</a>';
      html += '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(toGCal(occ)) + '" target="_blank" rel="noopener">Google Calendar</a>';
      html += '<a class="btn btn-ghost btn-sm" href="' + icsHref(occ) + '" download="cisa-' + escapeHtml(occ.occId || occ.id) + '.ics">Download .ics</a>';
      html += '</div></div>';

      slot.innerHTML = html;
      var closeBtn = slot.querySelector('.close-btn');
      if (closeBtn) closeBtn.addEventListener('click', closeDetailPanel);
    }

    // ---------------- List view ----------------

    function renderListView(container) {
      var now = new Date();
      var upcoming = [];
      var past = [];
      state.occurrences.forEach(function (occ) {
        var end = parseLocal(occ.date, occ.end || occ.start || '23:59');
        if (end >= now) upcoming.push(occ); else past.push(occ);
      });

      var html = '<div class="event-list">';
      html += '<h3 class="list-heading">Upcoming</h3>';
      if (upcoming.length === 0) {
        html += '<p class="empty-msg">No upcoming meetings scheduled yet &mdash; check Instagram for updates.</p>';
      } else {
        upcoming.forEach(function (occ) { html += renderEventRow(occ); });
      }
      if (past.length > 0) {
        html += '<details class="past-details"><summary>Past events (' + past.length + ')</summary>';
        past.slice().reverse().forEach(function (occ) { html += renderEventRow(occ); });
        html += '</details>';
      }
      html += '</div>';
      container.innerHTML = html;
    }

    function renderEventRow(occ) {
      var d = parseLocal(occ.date, occ.start || '00:00');
      var rowClasses = 'event-row' + (occ.featured ? ' featured' : '');
      var titleClass = occ.cancelled ? ' class="row-cancelled"' : '';
      var html = '<div class="' + rowClasses + '">';
      html += '<div class="row-date"><span class="mon">' + MONTH_SHORT[d.getMonth()] + '</span><span class="day">' + d.getDate() + '</span></div>';
      html += '<div class="row-body">';
      html += '<h4' + titleClass + '>' + escapeHtml(occ.title) + (occ.cancelled ? ' <span class="cancelled-badge">Cancelled</span>' : '') + '</h4>';
      var metaBits = [];
      if (occ.start) metaBits.push(fmtTime(occ.start, occ.end));
      if (occ.location) metaBits.push(occ.location);
      if (metaBits.length) html += '<div class="row-meta">' + escapeHtml(metaBits.join(' · ')) + '</div>';
      if (occ.summary) html += '<p>' + escapeHtml(occ.summary) + '</p>';
      html += '<div class="row-links">';
      if (occ.url && isSafeUrl(occ.url)) html += '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(occ.url) + '" target="_blank" rel="noopener">Details</a>';
      html += '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(toGCal(occ)) + '" target="_blank" rel="noopener">Add to calendar</a>';
      html += '<a class="btn btn-ghost btn-sm" href="' + icsHref(occ) + '" download="cisa-' + escapeHtml(occ.occId || occ.id) + '.ics">.ics</a>';
      html += '</div></div></div>';
      return html;
    }

    // ---------------- People (e-board + founders) ----------------

    function initials(name) {
      var parts = String(name).trim().split(/\s+/);
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    // Renders one person card. `imgDir` is the folder their photo lives in.
    function personCard(m, imgDir) {
      var isTbd = m.name === 'Name TBD';
      var html = '<div class="board-card">';
      if (m.photo) {
        html += '<img class="board-avatar" src="' + escapeHtml(imgDir + m.photo) + '" alt="' + escapeHtml(m.name) + '">';
      } else {
        html += '<img class="board-avatar" src="assets/img/avatar-placeholder.svg" alt="' + (isTbd ? '?' : escapeHtml(initials(m.name))) + '">';
      }
      html += '<h3>' + escapeHtml(m.name) + '</h3>';
      html += '<div class="board-role">' + escapeHtml(m.role) + '</div>';
      if (m.title || m.org) {
        var bits = [];
        if (m.title) bits.push(m.title);
        if (m.org) bits.push(m.org);
        html += '<div class="board-title">' + escapeHtml(bits.join(' \u00b7 ')) + '</div>';
      }
      if (isTbd) {
        html += '<div class="board-soon">Photo coming soon</div>';
      }
      var links = [];
      if (m.email && isSafeUrl('mailto:' + m.email)) {
        links.push('<a href="mailto:' + escapeHtml(m.email) + '">Email</a>');
      }
      if (m.linkedin && isSafeUrl(m.linkedin)) {
        links.push('<br><a href="' + escapeHtml(m.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>');
      }
      if (m.portfolio && isSafeUrl(m.portfolio)) {
        links.push('<a href="' + escapeHtml(m.portfolio) + '" target="_blank" rel="noopener">Portfolio</a>');
      }
      if (links.length) html += '<div class="board-links">' + links.join('') + '</div>';
      html += '</div>';
      return html;
    }

    function renderBoard() {
      var el = document.getElementById('board-grid');
      if (!el) return;
      if (state.board.length === 0) {
        el.innerHTML = '<p class="empty-msg">E-board information is not available right now.</p>';
        return;
      }
      var html = '';
      state.board.forEach(function (m) {
        html += personCard(m, 'assets/img/board/');
      });
      el.innerHTML = html;
    }

    function renderBoardError() {
      var el = document.getElementById('board-grid');
      if (el) el.innerHTML = '<p class="empty-msg">Could not load the e-board roster right now. Please check back later.</p>';
    }

    function renderFounders() {
      var el = document.getElementById('founders-grid');
      if (!el) return;
      if (state.founders.length === 0) {
        el.innerHTML = '<p class="empty-msg">Founder information is not available right now.</p>';
        return;
      }
      var html = '';
      state.founders.forEach(function (f) {
        html += personCard(f, 'assets/img/founders/');
      });
      el.innerHTML = html;
    }

    function renderFoundersError() {
      var el = document.getElementById('founders-grid');
      if (el) el.innerHTML = '<p class="empty-msg">Could not load the founders right now. Please check back later.</p>';
    }
  }

  if (typeof document !== 'undefined') {
    initBrowser();
  }

  // =======================================================================
  // Node export (guarded so the browser ignores it)
  // =======================================================================
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseLocal: parseLocal,
      addDaysToDateStr: addDaysToDateStr,
      expandRepeat: expandRepeat,
      fmtDate: fmtDate,
      fmtTime: fmtTime,
      fmtTime12: fmtTime12,
      toGCal: toGCal,
      toGCalDatesParam: toGCalDatesParam,
      toIcs: toIcs,
      icsEscape: icsEscape,
      foldLine: foldLine,
      escapeHtml: escapeHtml,
      isSafeUrl: isSafeUrl,
      resolveTheme: resolveTheme,
      nextTheme: nextTheme
    };
  }
})(typeof window !== 'undefined' ? window : this);
