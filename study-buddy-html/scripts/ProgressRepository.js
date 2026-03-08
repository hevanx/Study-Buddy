'use strict';

/* =============================================================
   PROGRESS REPOSITORY — Storage Abstraction Layer
   =============================================================
   Defines the persistence contract for XP + study-time data.
   Both implementations satisfy the same interface:

     getProgress(userId)
       → { totalXp: number, totalStudySeconds: number, lastUpdatedAt: number }

     saveProgress(userId, payload)
       → void  (sync for LocalStorage)  |  Promise<void>  (async for API)

   To swap storage when your MySQL backend is ready:
     1. Replace  `new LocalStorageProgressRepository()`
        with     `new ApiProgressRepository('https://your-api.com')`
        in the ONE place each HTML page creates the repo.
     2. Nothing else in the codebase needs to change.
   ============================================================= */

const _PROGRESS_KEY_PREFIX = 'sb-progress';

/* ── LocalStorage Implementation ────────────────────────────────────────────── */

class LocalStorageProgressRepository {
  /**
   * Returns the stored progress for a user, or a zeroed default.
   * Gracefully handles corrupt / missing data.
   * @param {string} userId
   * @returns {{ totalXp: number, totalStudySeconds: number, lastUpdatedAt: number }}
   */
  getProgress(userId) {
    try {
      const raw = localStorage.getItem(`${_PROGRESS_KEY_PREFIX}-${userId}`);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          totalXp:           Math.max(0, Number(p.totalXp)           || 0),
          totalStudySeconds: Math.max(0, Number(p.totalStudySeconds) || 0),
          lastUpdatedAt:     Number(p.lastUpdatedAt)                 || Date.now(),
        };
      }
    } catch (_) { /* corrupt data — fall through to defaults */ }
    return { totalXp: 0, totalStudySeconds: 0, lastUpdatedAt: Date.now() };
  }

  /**
   * Persists progress for a user.
   * @param {string} userId
   * @param {{ totalXp: number, totalStudySeconds: number }} payload
   */
  saveProgress(userId, payload) {
    localStorage.setItem(
      `${_PROGRESS_KEY_PREFIX}-${userId}`,
      JSON.stringify({
        totalXp:           payload.totalXp,
        totalStudySeconds: payload.totalStudySeconds,
        lastUpdatedAt:     Date.now(),
      })
    );
  }
}

/* ── API Stub (future MySQL / REST integration) ─────────────────────────────── */

class ApiProgressRepository {
  /**
   * @param {string} [baseUrl] - Base URL of your REST API.
   *   Example: 'https://api.studybuddy.com'
   */
  constructor(baseUrl = '/api') {
    this._base = baseUrl;
  }

  /**
   * Fetches progress from the REST API.
   *
   * TODO (MySQL integration):
   *   1. Uncomment the fetch block below.
   *   2. Your GET endpoint should return JSON matching:
   *        { totalXp, totalStudySeconds, lastUpdatedAt }
   *      from a `user_progress` table keyed by userId.
   *
   * @param {string} userId
   * @returns {Promise<{ totalXp: number, totalStudySeconds: number, lastUpdatedAt: number }>}
   */
  async getProgress(userId) {
    try {
      const res = await fetch(
        `${this._base}/users/${encodeURIComponent(userId)}/progress`,
        {
          headers:     { 'Accept': 'application/json' },
          credentials: 'include',
        }
      );
      if (!res.ok) throw new Error(`[ApiRepo] getProgress HTTP ${res.status}`);
      return res.json();
    } catch (_) {
      return { totalXp: 0, totalStudySeconds: 0, lastUpdatedAt: Date.now() };
    }
  }

  /**
   * Saves progress to the REST API.
   *
   * TODO (MySQL integration):
   *   1. Uncomment the fetch block below.
   *   2. Your PATCH endpoint should do an upsert on `user_progress`
   *      for the given userId, updating totalXp, totalStudySeconds,
   *      and last_updated_at (server-side timestamp preferred).
   *
   * @param {string} userId
   * @param {{ totalXp: number, totalStudySeconds: number }} payload
   * @returns {Promise<void>}
   */
  async saveProgress(userId, payload) {
    try {
      await fetch(
        `${this._base}/users/${encodeURIComponent(userId)}/progress`,
        {
          method:      'PATCH',
          headers:     { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          keepalive:   true,
          body:        JSON.stringify(payload),
        }
      );
    } catch (_) { /* silently ignore network errors */ }
  }
}
