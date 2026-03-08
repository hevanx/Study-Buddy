'use strict';

const express     = require('express');
const { db }      = require('../db');
const requireAuth = require('../middleware/requireAuth');
const router      = express.Router();

router.use(requireAuth);

const myId = req => Number(req.session.userId);
const XP_PER_SECOND = 100 / 3600;

/* ── GET /api/friends/search?q=term ────────────────────────────
   Partial-match username search. Returns up to 20 users with a
   'relationship' field: self | friends | request_sent |
                          request_received | none             */
router.get('/search', async (req, res) => {
  const q    = String(req.query.q || '').trim();
  const self = myId(req);
  if (!q) return res.json([]);

  try {
    const [rows] = await db.execute(
      `SELECT
         u.id,
         u.username,
         CASE
           WHEN u.id = ?                                         THEN 'self'
           WHEN fa.status = 'accepted' OR fb.status = 'accepted' THEN 'friends'
           WHEN fa.status = 'pending'                            THEN 'request_sent'
           WHEN fb.status = 'pending'                            THEN 'request_received'
           ELSE 'none'
         END AS relationship,
         COALESCE(fa.id, fb.id) AS friendship_id
       FROM users u
       LEFT JOIN friendships fa ON fa.sender_id   = ? AND fa.receiver_id = u.id
       LEFT JOIN friendships fb ON fb.sender_id   = u.id AND fb.receiver_id = ?
       WHERE u.username LIKE ?
       LIMIT 20`,
      [self, self, self, `%${q}%`]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[friends/search]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ── GET /api/friends ───────────────────────────────────────────
   List all accepted friends for the current user.             */
router.get('/', async (req, res) => {
  const self = myId(req);
  try {
    const [rows] = await db.execute(
      `SELECT
         f.id AS friendship_id,
         u.id,
         u.username,
         COALESCE(p.total_xp, 0) AS total_xp
       FROM friendships f
       JOIN users u ON u.id = IF(f.sender_id = ?, f.receiver_id, f.sender_id)
       LEFT JOIN user_progress p ON p.user_id = u.id
       WHERE (f.sender_id = ? OR f.receiver_id = ?)
         AND f.status = 'accepted'
       ORDER BY u.username ASC`,
      [self, self, self]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[friends/list]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ── GET /api/friends/incoming ──────────────────────────────────
   Pending requests where the current user is the receiver.   */
router.get('/incoming', async (req, res) => {
  const self = myId(req);
  try {
    const [rows] = await db.execute(
      `SELECT f.id, u.id AS user_id, u.username, f.created_at
       FROM friendships f
       JOIN users u ON u.id = f.sender_id
       WHERE f.receiver_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [self]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[friends/incoming]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ── GET /api/friends/outgoing ──────────────────────────────────
   Pending requests that the current user sent.               */
router.get('/outgoing', async (req, res) => {
  const self = myId(req);
  try {
    const [rows] = await db.execute(
      `SELECT f.id, u.id AS user_id, u.username, f.created_at
       FROM friendships f
       JOIN users u ON u.id = f.receiver_id
       WHERE f.sender_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [self]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[friends/outgoing]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ── POST /api/friends/request ──────────────────────────────────
   Body: { receiverId }
   Edge cases handled:
     • self-request           → 400
     • already friends        → 400
     • pending already sent   → 400
     • crossed request        → auto-accept the existing row
     • previously declined    → UPDATE status back to pending  */
router.post('/request', async (req, res) => {
  const self       = myId(req);
  const receiverId = Number(req.body?.receiverId);

  if (!receiverId || isNaN(receiverId)) {
    return res.status(400).json({ error: 'receiverId required' });
  }
  if (receiverId === self) {
    return res.status(400).json({ error: 'Cannot send a friend request to yourself' });
  }

  try {
    /* Verify target user exists */
    const [userRows] = await db.execute(
      `SELECT id FROM users WHERE id = ?`, [receiverId]
    );
    if (!userRows.length) return res.status(404).json({ error: 'User not found' });

    /* Load any existing row between these two users (either direction) */
    const [rows] = await db.execute(
      `SELECT id, sender_id, receiver_id, status
       FROM friendships
       WHERE (sender_id = ? AND receiver_id = ?)
          OR (sender_id = ? AND receiver_id = ?)`,
      [self, receiverId, receiverId, self]
    );

    for (const row of rows) {
      if (row.status === 'accepted') {
        return res.status(400).json({ error: 'Already friends' });
      }
      /* Crossed request: they already sent to me → auto-accept */
      if (row.sender_id === receiverId && row.receiver_id === self && row.status === 'pending') {
        await db.execute(
          `UPDATE friendships SET status = 'accepted' WHERE id = ?`,
          [row.id]
        );
        return res.json({ ok: true, autoAccepted: true });
      }
      /* My own pending request still open */
      if (row.sender_id === self && row.status === 'pending') {
        return res.status(400).json({ error: 'Friend request already sent' });
      }
    }

    /* Insert new row, or reactivate a declined one */
    await db.execute(
      `INSERT INTO friendships (sender_id, receiver_id, status)
       VALUES (?, ?, 'pending')
       ON DUPLICATE KEY UPDATE status = 'pending', updated_at = current_timestamp()`,
      [self, receiverId]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[friends/request]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ── PATCH /api/friends/:id/accept ─────────────────────────────
   Accept an incoming request. Only the receiver may call this.*/
router.patch('/:id/accept', async (req, res) => {
  const self = myId(req);
  const id   = Number(req.params.id);
  try {
    const [rows] = await db.execute(
      `SELECT id FROM friendships
       WHERE id = ? AND receiver_id = ? AND status = 'pending'`,
      [id, self]
    );
    if (!rows.length) return res.status(404).json({ error: 'Request not found' });

    await db.execute(
      `UPDATE friendships SET status = 'accepted' WHERE id = ?`, [id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[friends/accept]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ── PATCH /api/friends/:id/decline ────────────────────────────
   Decline an incoming request. Deletes the row so the sender
   can re-request in the future.                              */
router.patch('/:id/decline', async (req, res) => {
  const self = myId(req);
  const id   = Number(req.params.id);
  try {
    const [rows] = await db.execute(
      `SELECT id FROM friendships
       WHERE id = ? AND receiver_id = ? AND status = 'pending'`,
      [id, self]
    );
    if (!rows.length) return res.status(404).json({ error: 'Request not found' });

    await db.execute(`DELETE FROM friendships WHERE id = ?`, [id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[friends/decline]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ── DELETE /api/friends/:id ────────────────────────────────────
   Cancel an outgoing pending request OR remove an accepted
   friendship. Current user must be a party to the row.      */
router.delete('/:id', async (req, res) => {
  const self = myId(req);
  const id   = Number(req.params.id);
  try {
    const [rows] = await db.execute(
      `SELECT id, sender_id, receiver_id, status FROM friendships WHERE id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const row = rows[0];
    const isSender   = row.sender_id   === self;
    const isReceiver = row.receiver_id === self;

    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    /* Only the sender may cancel a pending request */
    if (row.status === 'pending' && !isSender) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.execute(`DELETE FROM friendships WHERE id = ?`, [id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[friends/delete]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ── GET /api/friends/profile/:userId ──────────────────────────
   Public profile: username, XP (including live session),
   total study seconds, cosmetics. No email or private fields.*/
router.get('/profile/:userId', async (req, res) => {
  const targetId = Number(req.params.userId);
  if (!targetId) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const [[userRows], [progressRows], [cosmeticRows], [timerRows]] = await Promise.all([
      db.execute(`SELECT id, username FROM users WHERE id = ?`, [targetId]),
      db.execute(
        `SELECT total_xp, total_study_seconds FROM user_progress WHERE user_id = ?`,
        [targetId]
      ),
      db.execute(
        `SELECT hat_id, shirt_id, shoes_id FROM user_cosmetics WHERE user_id = ?`,
        [targetId]
      ),
      db.execute(
        `SELECT session_start FROM timer_state WHERE user_id = ?`,
        [targetId]
      ),
    ]);

    if (!userRows.length) return res.status(404).json({ error: 'User not found' });

    const user       = userRows[0];
    let totalXp      = progressRows.length ? Number(progressRows[0].total_xp)           : 0;
    let studySeconds = progressRows.length ? Number(progressRows[0].total_study_seconds) : 0;

    /* Include live session XP if their timer is currently running */
    if (timerRows.length && timerRows[0].session_start) {
      const elapsed  = (Date.now() - new Date(timerRows[0].session_start).getTime()) / 1000;
      totalXp      += elapsed * XP_PER_SECOND;
      studySeconds += elapsed;
    }

    const c = cosmeticRows.length ? cosmeticRows[0] : {};
    return res.json({
      id:                user.id,
      username:          user.username,
      totalXp,
      totalStudySeconds: studySeconds,
      cosmetics: {
        hatId:   c.hat_id   || null,
        shirtId: c.shirt_id || null,
        shoesId: c.shoes_id || null,
      },
    });
  } catch (err) {
    console.error('[friends/profile]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
