'use strict';

const express      = require('express');
const { db }       = require('../db');
const requireAuth  = require('../middleware/requireAuth');
const router       = express.Router();

function checkOwner(req, res) {
  if (String(req.session.userId) !== req.params.userId) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

/* GET /api/users/:userId/cosmetics */
router.get('/:userId/cosmetics', requireAuth, async (req, res) => {
  if (!checkOwner(req, res)) return;

  try {
    const [rows] = await db.execute(
      'SELECT hat_id, glasses_id, shirt_id, shoes_id FROM user_cosmetics WHERE user_id = ?',
      [req.params.userId]
    );
    if (!rows.length) {
      return res.json({ hatId: null, glassesId: null, shirtId: null, shoesId: null });
    }
    const r = rows[0];
    return res.json({
      hatId:     r.hat_id,
      glassesId: r.glasses_id,
      shirtId:   r.shirt_id,
      shoesId:   r.shoes_id,
    });
  } catch (err) {
    console.error('[cosmetics/GET]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* PATCH /api/users/:userId/cosmetics */
router.patch('/:userId/cosmetics', requireAuth, async (req, res) => {
  if (!checkOwner(req, res)) return;

  const { hatId, glassesId, shirtId, shoesId } = req.body || {};

  try {
    await db.execute(
      `INSERT INTO user_cosmetics (user_id, hat_id, glasses_id, shirt_id, shoes_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         hat_id     = VALUES(hat_id),
         glasses_id = VALUES(glasses_id),
         shirt_id   = VALUES(shirt_id),
         shoes_id   = VALUES(shoes_id)`,
      [req.params.userId, hatId || null, glassesId || null, shirtId || null, shoesId || null]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[cosmetics/PATCH]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
