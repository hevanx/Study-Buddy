'use strict';

/* =============================================================
   XP SYSTEM
   =============================================================
   Manages XP accumulation and rank calculation while the study
   timer is actively running.

   RANK THRESHOLDS  (default curve — see RANKS array below)
   ──────────────────────────────────────────────────────────
   XP rate    : 100 XP per hour  (≈ 0.02778 XP / second)

     Rank       Hours  XP
     ─────────────────────
     Unranked   0 h    0 XP     (starting state — not a rank you "earn")
     Bronze     1 h    100 XP   ← Rank 1
     Silver     3 h    300 XP   ← Rank 2
     Gold       6 h    600 XP   ← Rank 3
     Diamond   10 h   1000 XP   ← Rank 4 (max)

   Alternative curve (steeper, suits dedicated long-term users):
     Bronze 1h / Silver 5h / Gold 15h / Diamond 30h
     (100 / 500 / 1500 / 3000 XP)
   Default is implemented. To switch, edit the RANKS array.

   ANTI-DRIFT & ANTI-ABUSE
   ──────────────────────────────────────────────────────────
   • Timing is timestamp-based (Date.now()), NOT setInterval-count-based.
     setInterval counts drift: the 250 ms interval can fire at 300 ms,
     500 ms, or not at all if the tab is throttled. Using Date.now()
     means we always measure real elapsed wall-clock time.

   • Per-tick delta is capped at MAX_DELTA_MS (5 000 ms = 5 seconds).
     Without the cap, waking from a 2-hour laptop sleep would grant
     2 hours of XP in a single tick. With the cap the worst case is
     a 5-second bonus — negligible and stops all meaningful abuse.
     The cap also transparently handles hidden/background tabs where
     browsers throttle timers to once per second or less.
   ============================================================= */

/* ── XP rate ──────────────────────────────────────────────── */
const XP_PER_HOUR   = 100;
const XP_PER_SECOND = XP_PER_HOUR / 3600;   // ≈ 0.027 78

/* ── Rank definitions ─────────────────────────────────────── */
const RANKS = [
  { id: 0, name: 'Unranked', minXp:    0, hours:  0, img: 'assets/RankLogo.png'     },
  { id: 1, name: 'Bronze',   minXp:  100, hours:  1, img: 'assets/BronzeAward.png'  },  // Rank 1
  { id: 2, name: 'Silver',   minXp:  300, hours:  3, img: 'assets/SilverAward.png'  },  // Rank 2
  { id: 3, name: 'Gold',     minXp:  600, hours:  6, img: 'assets/GoldAward.png'    },  // Rank 3
  { id: 4, name: 'Diamond',  minXp: 1000, hours: 10, img: 'assets/DiamondAward.png' },  // Rank 4 (max)
];

/* ── Timing constants ─────────────────────────────────────── */
const TICK_MS       = 250;           // 4 updates per second
const MAX_DELTA_MS  = 5_000;         // abuse / sleep cap (5 s)
const SAVE_EVERY_MS = 30_000;        // checkpoint save interval

/* ── Pure helpers ─────────────────────────────────────────── */

/**
 * Given a totalXp value, returns:
 *   current  — the rank the user is currently in
 *   next     — the next rank (null if at max)
 *   pct      — 0–100 progress percentage toward the next rank
 */
function getRankInfo(totalXp) {
  let current = RANKS[0];
  let next    = RANKS[1];

  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (totalXp >= RANKS[i].minXp) {
      current = RANKS[i];
      next    = RANKS[i + 1] || null;
      break;
    }
  }

  let pct;
  if (!next) {
    pct = 100;   // Diamond — full bar
  } else {
    const span   = next.minXp - current.minXp;
    const earned = totalXp   - current.minXp;
    pct = Math.min(100, Math.max(0, (earned / span) * 100));
  }

  return { current, next, pct };
}

/** Floors XP to an integer for display — avoids "99.999 XP" readouts. */
const fmtXp = (xp) => Math.floor(xp);

/* ── XpSystem class ─────────────────────────────────────────────────────── */

class XpSystem {
  /**
   * @param {LocalStorageProgressRepository|ApiProgressRepository} repository
   */
  constructor(repository) {
    this._repo    = repository;
    this._userId  = 'guest';

    this._totalXp           = 0;
    this._totalStudySeconds = 0;

    this._isRunning    = false;
    this._lastTickTime = null;    // Date.now() stamp of the last processed tick
    this._lastSaveTime = null;    // Date.now() stamp of the last periodic save

    this._intervalId = null;

    /* Dashboard DOM refs — null-safe; elements may not exist on every page */
    this._fillEl         = null;   // #xp-progress-fill
    this._barEl          = null;   // #xp-progress-bar  (progressbar role)
    this._labelEl        = null;   // #xp-label
    this._rankBadgeEl    = null;   // #rank-badge-name  (nav text)
    this._rankBadgeImgEl = null;   // .sb-rank-badge    (nav image)

    /* Ranked page DOM refs */
    this._rankedFillEl    = null;   // #ranked-xp-fill
    this._rankedLabelEl   = null;   // #ranked-xp-label
    this._rankedRankEl    = null;   // #ranked-rank-name
    this._rankedFromBadge = null;   // #ranked-from-badge (current rank img)
    this._rankedToBadge   = null;   // #ranked-to-badge   (next rank img)
  }

  /* ── Public API ─────────────────────────────────────────── */

  /**
   * Load persisted progress and wire up DOM elements.
   * Call exactly once, after the DOM is ready.
   * @param {string} [userId]
   */
  async init(userId = 'guest') {
    this._userId = userId;

    const progress = await Promise.resolve(this._repo.getProgress(userId));
    this._totalXp           = progress.totalXp;
    this._totalStudySeconds = progress.totalStudySeconds;

    /* Grab DOM refs (null if element doesn't exist on this page — handled) */
    this._fillEl         = document.getElementById('xp-progress-fill');
    this._barEl          = document.getElementById('xp-progress-bar');
    this._labelEl        = document.getElementById('xp-label');
    this._rankBadgeEl    = document.getElementById('rank-badge-name');
    this._rankBadgeImgEl = document.querySelector('.sb-rank-badge');

    this._rankedFillEl    = document.getElementById('ranked-xp-fill');
    this._rankedLabelEl   = document.getElementById('ranked-xp-label');
    this._rankedRankEl    = document.getElementById('ranked-rank-name');
    this._rankedFromBadge = document.getElementById('ranked-from-badge');
    this._rankedToBadge   = document.getElementById('ranked-to-badge');

    this._render();   // show persisted state immediately on page load

    /* Guests: save XP locally before unload.
       Logged-in users: server recalculates from session_start on next GET. */
    window.addEventListener('beforeunload', () => {
      const userId = localStorage.getItem('sb-userId');
      if (!userId) this._save();
    });
  }

  /**
   * Called by StudyTimer when the timer starts or resumes.
   * Begins XP accumulation. For logged-in users, notifies the server so it
   * can record session_start — XP is then calculated server-side.
   */
  startSession() {
    if (this._isRunning) return;
    this._isRunning    = true;
    this._lastTickTime = Date.now();
    this._lastSaveTime = Date.now();
    this._startTicker();

    /* Tell the server a session has started (logged-in users only).
       The server records session_start; XP is calculated when session ends. */
    const userId = localStorage.getItem('sb-userId');
    if (userId) {
      fetch(`/api/users/${encodeURIComponent(userId)}/timer-state`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ state: 'running' }),
      }).catch(() => {});
    }
  }

  /**
   * Called by StudyTimer when the timer pauses or resets.
   * Stops XP accumulation. For logged-in users the server calculates and
   * banks XP when it receives the timer-state PATCH (done by timer.js).
   * For guests, XP is saved locally here.
   */
  endSession() {
    if (!this._isRunning) return;
    this._isRunning = false;
    this._stopTicker();
    /* Guests have no server-side session tracking — save locally */
    const userId = localStorage.getItem('sb-userId');
    if (!userId) this._save();
  }

  /** Current total XP (read-only). */
  get totalXp() { return this._totalXp; }

  /* ── Internal ───────────────────────────────────────────── */

  _startTicker() {
    if (this._intervalId !== null) return;
    this._intervalId = setInterval(() => this._tick(), TICK_MS);
  }

  _stopTicker() {
    if (this._intervalId === null) return;
    clearInterval(this._intervalId);
    this._intervalId = null;
  }

  _tick() {
    const now = Date.now();

    /* ── Anti-abuse delta cap ────────────────────────────────────────────
       setInterval fires late when the browser throttles a background tab,
       or when the OS wakes from sleep.  Without the cap, a 2-hour nap
       would credit 2 hours of XP in one shot.
       Capping at 5 000 ms means the maximum bonus per tick is 5 seconds,
       regardless of how long the browser was frozen.                      */
    const rawDelta = now - this._lastTickTime;
    const delta    = Math.min(rawDelta, MAX_DELTA_MS);   // credited ms
    this._lastTickTime = now;

    if (this._isRunning) {
      const xpEarned        = (delta / 1000) * XP_PER_SECOND;
      this._totalXp           += xpEarned;
      this._totalStudySeconds += delta / 1000;
    }

    this._render();

    /* Periodic checkpoint save — guests only.
       Logged-in users: XP is owned by the server (session_start tracking). */
    if (this._isRunning && (now - this._lastSaveTime) >= SAVE_EVERY_MS) {
      const userId = localStorage.getItem('sb-userId');
      if (!userId) this._save();
      this._lastSaveTime = now;
    }
  }

  _render() {
    const { current, next, pct } = getRankInfo(this._totalXp);
    const xpInt  = fmtXp(this._totalXp);
    const nextXp = next ? next.minXp : current.minXp;
    const label  = next
      ? `${current.name}  ·  ${xpInt} / ${nextXp} XP`
      : `${current.name}  ·  ${xpInt} XP  (Max rank!)`;

    /* ── Dashboard progress bar ─────────────────────────── */
    if (this._fillEl) {
      this._fillEl.style.width = `${pct.toFixed(1)}%`;
    }
    if (this._barEl) {
      this._barEl.setAttribute('aria-valuenow', Math.round(pct));
    }
    if (this._labelEl) {
      this._labelEl.textContent = label;
    }
    if (this._rankBadgeEl) {
      this._rankBadgeEl.textContent = current.name;
    }
    if (this._rankBadgeImgEl) {
      this._rankBadgeImgEl.src = current.img;
      this._rankBadgeImgEl.alt = current.name + ' badge';
      this._rankBadgeImgEl.classList.toggle('sb-rank-badge--unranked', current.name === 'Unranked');
    }

    /* ── Ranked page bar ────────────────────────────────── */
    if (this._rankedFillEl) {
      this._rankedFillEl.style.width = `${pct.toFixed(1)}%`;
    }
    if (this._rankedLabelEl) {
      this._rankedLabelEl.textContent = label;
    }
    if (this._rankedRankEl) {
      this._rankedRankEl.textContent = current.name;
    }
    if (this._rankedFromBadge) {
      this._rankedFromBadge.src = current.img;
      this._rankedFromBadge.alt = current.name;
    }
    if (this._rankedToBadge) {
      const toRank = next || current;   // at max rank, mirror the current badge
      this._rankedToBadge.src = toRank.img;
      this._rankedToBadge.alt = toRank.name;
    }
  }

  _save() {
    this._repo.saveProgress(this._userId, {
      totalXp:           this._totalXp,
      totalStudySeconds: this._totalStudySeconds,
    });
  }
}
