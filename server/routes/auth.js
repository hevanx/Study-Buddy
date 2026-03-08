'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const { db }  = require('../db');
const router  = express.Router();

/* POST /api/auth/register */
router.post('/register', async (req, res) => {
  const { username, email, password, confirmpassword } = req.body || {};

  if (!username || !email || !password || !confirmpassword) {
    return res.redirect('/register.html?message=' + encodeURIComponent('All fields are required'));
  }
  if (username.length > 32) {
    return res.redirect('/register.html?message=' + encodeURIComponent('Username too long (max 32 chars)'));
  }
  if (password.length < 6) {
    return res.redirect('/register.html?message=' + encodeURIComponent('Password must be at least 6 characters'));
  }
  if (password !== confirmpassword) {
    return res.redirect('/register.html?message=' + encodeURIComponent('Passwords do not match'));
  }

  try {
    const hash = await bcrypt.hash(password, 8);
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hash]
    );
    const userId = result.insertId;

    // Create companion rows so the app has data to work with right away
    await db.execute('INSERT INTO user_progress (user_id) VALUES (?)', [userId]);
    await db.execute('INSERT INTO user_cosmetics (user_id) VALUES (?)', [userId]);
    await db.execute('INSERT INTO timer_state (user_id) VALUES (?)', [userId]);

    return res.redirect('/login.html?message=' + encodeURIComponent('Account created! Please sign in.'));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.redirect('/register.html?message=' + encodeURIComponent('Username or email already taken'));
    }
    console.error('[auth/register]', err);
    return res.redirect('/register.html?message=' + encodeURIComponent('Server error, please try again'));
  }
});

/* POST /api/auth/login */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.redirect('/login.html?message=' + encodeURIComponent('Please enter both email and password'));
  }

  try {
    const [rows] = await db.execute(
      'SELECT id, username, password FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];

    if (!user) {
      return res.redirect('/login.html?message=' + encodeURIComponent('Email not registered'));
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.redirect('/login.html?message=' + encodeURIComponent('Incorrect password'));
    }

    req.session.userId   = user.id;
    req.session.username = user.username;
    return res.redirect(`/index.html?userId=${user.id}&username=${encodeURIComponent(user.username)}`);
  } catch (err) {
    console.error('[auth/login]', err);
    return res.redirect('/login.html?message=' + encodeURIComponent('Server error, please try again'));
  }
});

/* POST /api/auth/logout */
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('[auth/logout]', err);
      return res.status(500).json({ error: 'Server error' });
    }
    res.clearCookie('connect.sid');
    return res.json({ ok: true });
  });
});

/* GET /api/auth/me */
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json({ id: req.session.userId, username: req.session.username });
});

module.exports = router;
