'use strict';

const express      = require('express');
const { db }       = require('../db');
const requireAuth  = require('../middleware/requireAuth');
const router       = express.Router();

const XP_PER_SECOND = 100 / 3600;   // matches client xpSystem.js rate

function checkOwner(req, res) {
  if (String(req.session.userId) !== req.params.userId) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

/* GET /api/users/:userId/timer-state */
router.get('/:userId/timer-state', requireAuth, async (req, res) => {
  if (!checkOwner(req, res)) return;

  try {
    const [rows] = await db.execute(
      `SELECT accumulated_ms, state,
              UNIX_TIMESTAMP(saved_at) * 1000 AS saved_at_ms
       FROM timer_state WHERE user_id = ?`,
      [req.params.userId]
    );
    if (!rows.length) {
      return res.json({ accumulatedMs: 0, state: 'stopped', savedAt: Date.now() });
    }
    return res.json({
      accumulatedMs: Number(rows[0].accumulated_ms),
      state:         rows[0].state,
      savedAt:       Number(rows[0].saved_at_ms),
    });
  } catch (err) {
    console.error('[timer/GET]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* PATCH /api/users/:userId/timer-state
   When transitioning TO running   → record session_start (only if not already running).
   When transitioning AWAY from running → calculate elapsed XP and bank it. */
router.patch('/:userId/timer-state', requireAuth, async (req, res) => {
  if (!checkOwner(req, res)) return;

  const accumulatedMs = Number(req.body?.accumulatedMs) || 0;
  const validStates   = ['stopped', 'running', 'paused'];
  const newState      = validStates.includes(req.body?.state) ? req.body.state : 'paused';
  const userId        = req.params.userId;

  try {
    /* Read the current row so we know if a session is already active */
    const [rows] = await db.execute(
      'SELECT state, session_start FROM timer_state WHERE user_id = ?',
      [userId]
    );
    const current = rows[0] || { state: 'stopped', session_start: null };

    if (newState === 'running') {
      /* Start a new session only if we weren't already running */
      const startExpr = current.state === 'running' ? 'session_start' : 'UTC_TIMESTAMP()';
      await db.execute(
        `INSERT INTO timer_state (user_id, accumulated_ms, state, session_start)
         VALUES (?, ?, 'running', UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           accumulated_ms = VALUES(accumulated_ms),
           state          = 'running',
           session_start  = ${startExpr}`,
        [userId, accumulatedMs]
      );

    } else {
      /* Pausing or stopping — bank any XP earned this session */
      if (current.session_start) {
        const elapsedSeconds = (Date.now() - new Date(current.session_start).getTime()) / 1000;
        const xpEarned       = elapsedSeconds * XP_PER_SECOND;

        await db.execute(
          `INSERT INTO user_progress (user_id, total_xp, total_study_seconds)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             total_xp           = total_xp + VALUES(total_xp),
             total_study_seconds = total_study_seconds + VALUES(total_study_seconds)`,
          [userId, xpEarned, elapsedSeconds]
        );
      }

      await db.execute(
        `INSERT INTO timer_state (user_id, accumulated_ms, state, session_start)
         VALUES (?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE
           accumulated_ms = VALUES(accumulated_ms),
           state          = VALUES(state),
           session_start  = NULL`,
        [userId, accumulatedMs, newState]
      );
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[timer/PATCH]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
