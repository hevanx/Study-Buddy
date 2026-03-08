'use strict';

/* =============================================================
   STUDY TIMER
   =============================================================
   Drift-resistant timer that drives both the mm:ss display and
   XP accumulation in the XP system.

   TIMING APPROACH
   ──────────────────────────────────────────────────────────
   Uses Date.now() snapshots rather than counting setInterval
   ticks. setInterval is used only as a "wake-up" signal; the
   actual elapsed time is always computed from wall-clock stamps.

     _accumulatedMs  — total ms from completed (paused) segments
     _segmentStart   — Date.now() when the current segment began
     elapsed         = _accumulatedMs + (Date.now() - _segmentStart)

   This means a brief lag in setInterval (throttled tab, heavy GC)
   only delays the next *display refresh* — it never skews the
   elapsed time value.

   STATE MACHINE
   ──────────────────────────────────────────────────────────
     STOPPED  ──start()──>   RUNNING
     RUNNING  ──pause()──>   PAUSED
     PAUSED   ──resume()──>  RUNNING
     RUNNING  ──reset()──>   STOPPED
     PAUSED   ──reset()──>   STOPPED

   XP is earned ONLY in the RUNNING state.
   The timer notifies the XpSystem via startSession() / endSession().
   ============================================================= */

const _TIMER_STATES = Object.freeze({
  STOPPED: 'stopped',
  RUNNING: 'running',
  PAUSED:  'paused',
});

const _DISPLAY_TICK_MS  = 250;              // refresh display 4× per second
const _TIMER_STORAGE_KEY = 'sb-timer-state'; // localStorage key for session persistence
                                              // TODO: swap to API call when MySQL is ready

class StudyTimer {
  /**
   * @param {XpSystem} xpSystem
   */
  constructor(xpSystem) {
    this._xp    = xpSystem;
    this._state = _TIMER_STATES.STOPPED;

    this._accumulatedMs = 0;     // ms from completed segments
    this._segmentStart  = null;  // Date.now() when current segment started

    this._intervalId = null;

    /* DOM elements — only present on index.html */
    this._displayEl = document.getElementById('timer-display');
    this._btnEl     = document.getElementById('timer-btn');
    this._iconEl    = document.getElementById('timer-btn-icon');
    this._labelEl   = document.getElementById('timer-btn-label');
    this._resetEl   = document.getElementById('timer-reset-btn');

    this._bindEvents();
    this._load();     // restore elapsed time from previous session if any
    this._render();   // show correct time immediately on page load
  }

  /* ── Public methods ─────────────────────────────────────── */

  start() {
    if (this._state !== _TIMER_STATES.STOPPED) return;
    this._state        = _TIMER_STATES.RUNNING;
    this._segmentStart = Date.now();
    this._startTicker();
    this._xp.startSession();
    this._render();
  }

  pause() {
    if (this._state !== _TIMER_STATES.RUNNING) return;
    this._accumulatedMs += Date.now() - this._segmentStart;
    this._segmentStart   = null;
    this._state          = _TIMER_STATES.PAUSED;
    this._stopTicker();
    this._xp.endSession();
    this._save();
    this._render();
  }

  resume() {
    if (this._state !== _TIMER_STATES.PAUSED) return;
    this._state        = _TIMER_STATES.RUNNING;
    this._segmentStart = Date.now();
    this._startTicker();
    this._xp.startSession();
    this._render();
  }

  reset() {
    if (this._state === _TIMER_STATES.STOPPED) return;
    if (this._state === _TIMER_STATES.RUNNING) {
      this._xp.endSession();   // save XP earned so far
    }
    this._stopTicker();
    this._state         = _TIMER_STATES.STOPPED;
    this._accumulatedMs = 0;
    this._segmentStart  = null;
    this._clearSave();   // intentional reset — don't restore on next load
    this._render();
  }

  /* ── Internal ───────────────────────────────────────────── */

  _elapsedMs() {
    const running = this._segmentStart ? (Date.now() - this._segmentStart) : 0;
    return this._accumulatedMs + running;
  }

  _startTicker() {
    if (this._intervalId !== null) return;
    this._intervalId = setInterval(() => this._render(), _DISPLAY_TICK_MS);
  }

  _stopTicker() {
    if (this._intervalId === null) return;
    clearInterval(this._intervalId);
    this._intervalId = null;
  }

  _render() {
    /* ── Timer display ───────────────────────────────────── */
    const totalS  = Math.floor(this._elapsedMs() / 1000);
    const minutes = Math.floor(totalS / 60);
    const seconds = totalS % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (this._displayEl) this._displayEl.textContent = timeStr;

    /* ── Button label + icon ─────────────────────────────── */
    /* .sb-play  = CSS right-pointing triangle (play)
       .sb-pause = CSS two-bar icon (pause)               */
    switch (this._state) {
      case _TIMER_STATES.STOPPED:
        if (this._iconEl)  this._iconEl.className = 'sb-play';
        if (this._labelEl) this._labelEl.textContent = 'START';
        if (this._btnEl)   this._btnEl.setAttribute('aria-label', 'Start timer');
        if (this._resetEl) this._resetEl.hidden = true;
        break;

      case _TIMER_STATES.RUNNING:
        if (this._iconEl)  this._iconEl.className = 'sb-pause';
        if (this._labelEl) this._labelEl.textContent = 'PAUSE';
        if (this._btnEl)   this._btnEl.setAttribute('aria-label', 'Pause timer');
        if (this._resetEl) this._resetEl.hidden = true;
        break;

      case _TIMER_STATES.PAUSED:
        if (this._iconEl)  this._iconEl.className = 'sb-play';
        if (this._labelEl) this._labelEl.textContent = 'RESUME';
        if (this._btnEl)   this._btnEl.setAttribute('aria-label', 'Resume timer');
        if (this._resetEl) this._resetEl.hidden = false;
        break;
    }
  }

  _bindEvents() {
    if (this._btnEl) {
      this._btnEl.addEventListener('click', () => {
        switch (this._state) {
          case _TIMER_STATES.STOPPED: this.start();  break;
          case _TIMER_STATES.RUNNING: this.pause();  break;
          case _TIMER_STATES.PAUSED:  this.resume(); break;
        }
      });
    }

    if (this._resetEl) {
      this._resetEl.addEventListener('click', () => this.reset());
    }

    /* Save timer state when navigating away.
       If running, the state is saved as 'running' so the next page load
       can auto-resume and calculate the elapsed time using saved_at. */
    window.addEventListener('beforeunload', () => {
      if (this._state !== _TIMER_STATES.STOPPED) {
        this._save();
      }
    });
  }

  /* ── Persistence ─────────────────────────────────────────── */

  _load() {
    const userId = localStorage.getItem('sb-userId');
    if (!userId) return;
    fetch(`/api/users/${encodeURIComponent(userId)}/timer-state`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { accumulatedMs: 0, state: 'stopped', savedAt: Date.now() })
      .then(data => {
        if (this._state !== _TIMER_STATES.STOPPED) return; // user already interacted
        const ms      = Number(data.accumulatedMs) || 0;
        const state   = data.state || 'stopped';
        const savedAt = Number(data.savedAt) || Date.now();
        if (state === 'running') {
          this._accumulatedMs = ms + Math.max(0, Date.now() - savedAt);
          this._state         = _TIMER_STATES.RUNNING;
          this._segmentStart  = Date.now();
          this._startTicker();
          this._xp.startSession();
          this._render();
        } else if (state === 'paused' && ms > 0) {
          this._accumulatedMs = ms;
          this._state = _TIMER_STATES.PAUSED;
          this._render();
        }
      })
      .catch(() => {});
  }

  _save() {
    const userId = localStorage.getItem('sb-userId');
    if (!userId) return;
    const msToSave = this._state === _TIMER_STATES.RUNNING && this._segmentStart
      ? this._accumulatedMs + (Date.now() - this._segmentStart)
      : this._accumulatedMs;
    fetch(`/api/users/${encodeURIComponent(userId)}/timer-state`, {
      method:      'PATCH',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive:   true,
      body:        JSON.stringify({ accumulatedMs: msToSave, state: this._state }),
    }).catch(() => {});
  }

  _clearSave() {
    const userId = localStorage.getItem('sb-userId');
    if (!userId) return;
    fetch(`/api/users/${encodeURIComponent(userId)}/timer-state`, {
      method:      'PATCH',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ accumulatedMs: 0, state: 'stopped' }),
    }).catch(() => {});
  }
}
