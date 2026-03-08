'use strict';

const express      = require('express');
const { db }       = require('../db');
const requireAuth  = require('../middleware/requireAuth');
const router       = express.Router();

/* Validate that the session user matches the URL param */
function checkOwner(req, res) {
  if (String(req.session.userId) !== req.params.userId) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

const XP_PER_SECOND = 100 / 3600;

/* GET /api/users/:userId/progress
   Always returns accurate XP, including any time from an in-progress session
   so other pages (ranked, profile) stay up to date even while the timer runs. */
router.get('/:userId/progress', requireAuth, async (req, res) => {
  if (!checkOwner(req, res)) return;

  try {
    const [[progRows], [timerRows]] = await Promise.all([
      db.execute(
        'SELECT total_xp, total_study_seconds, last_updated_at FROM user_progress WHERE user_id = ?',
        [req.params.userId]
      ),
      db.execute(
        'SELECT session_start FROM timer_state WHERE user_id = ?',
        [req.params.userId]
      ),
    ]);

    let totalXp           = progRows.length ? Number(progRows[0].total_xp)           : 0;
    let totalStudySeconds = progRows.length ? Number(progRows[0].total_study_seconds) : 0;
    const lastUpdatedAt   = progRows.length ? new Date(progRows[0].last_updated_at).getTime() : Date.now();

    /* Add live elapsed time if a session is currently active */
    if (timerRows.length && timerRows[0].session_start) {
      const elapsedSeconds  = (Date.now() - new Date(timerRows[0].session_start).getTime()) / 1000;
      totalXp           += elapsedSeconds * XP_PER_SECOND;
      totalStudySeconds += elapsedSeconds;
    }

    return res.json({ totalXp, totalStudySeconds, lastUpdatedAt });
  } catch (err) {
    console.error('[progress/GET]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* PATCH /api/users/:userId/progress */
router.patch('/:userId/progress', requireAuth, async (req, res) => {
  if (!checkOwner(req, res)) return;

  const { totalXp, totalStudySeconds } = req.body || {};
  const xp      = Number(totalXp)           || 0;
  const seconds = Number(totalStudySeconds) || 0;

  try {
    await db.execute(
      `INSERT INTO user_progress (user_id, total_xp, total_study_seconds)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_xp = VALUES(total_xp),
         total_study_seconds = VALUES(total_study_seconds)`,
      [req.params.userId, xp, seconds]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[progress/PATCH]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
