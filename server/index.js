'use strict';

const express        = require('express');
const session        = require('express-session');
const MySQLStore     = require('express-mysql-session')(session);
const { pool }       = require('./db');

const authRouter     = require('./routes/auth');
const progressRouter = require('./routes/progress');
const cosmeticsRouter = require('./routes/cosmetics');
const timerRouter    = require('./routes/timer');
const friendsRouter  = require('./routes/friends');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Session store ──────────────────────────────────────────── */
const sessionStore = new MySQLStore({
  clearExpired:          true,
  checkExpirationInterval: 900000,   // 15 min
  expiration:            86400000,   // 1 day
  createDatabaseTable:   true,
}, pool);

/* ── Middleware ─────────────────────────────────────────────── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'study-buddy-secret',
  resave:            false,
  saveUninitialized: false,
  store:             sessionStore,
  cookie: {
    httpOnly: true,
    maxAge:   86400000,   // 1 day
  },
}));

/* ── Routes ─────────────────────────────────────────────────── */
app.use('/api/auth',    authRouter);
app.use('/api/users',  progressRouter);
app.use('/api/users',  cosmeticsRouter);
app.use('/api/users',  timerRouter);
app.use('/api/friends', friendsRouter);

/* ── Leaderboard ─────────────────────────────────────────────── */
/* GET /api/leaderboard?filter=friends — future: pass filter=friends to limit to friends only */
app.get('/api/leaderboard', async (req, res) => {
  try {
    const [rows] = await require('./db').db.execute(
      `SELECT u.id, u.username, COALESCE(p.total_xp, 0) AS total_xp
       FROM users u
       LEFT JOIN user_progress p ON p.user_id = u.id
       ORDER BY total_xp DESC
       LIMIT 100`
    );
    return res.json(rows.map(r => ({
      id:       r.id,
      username: r.username,
      totalXp:  Number(r.total_xp),
    })));
  } catch (err) {
    console.error('[leaderboard]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ── Health check ───────────────────────────────────────────── */
app.get('/', (_req, res) => res.json({ ok: true, message: 'Study Buddy API is running' }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ── Start ──────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`[api] listening on port ${PORT}`);
});
