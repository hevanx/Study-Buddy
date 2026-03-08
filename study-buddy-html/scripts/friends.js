'use strict';

/* =============================================================
   FRIENDS PAGE CONTROLLER
   Manages four tabs: Friends | Requests | Sent | Find Friends
   All API calls use credentials:'include' for session cookies.
   ============================================================= */

(async function () {
  /* ── Auth guard ──────────────────────────────────────────── */
  const userId = localStorage.getItem('sb-userId');
  if (!userId) {
    location.href = 'login.html';
    return;
  }

  /* ── DOM refs ────────────────────────────────────────────── */
  const tabs = {
    friends:  document.getElementById('tab-friends'),
    requests: document.getElementById('tab-requests'),
    sent:     document.getElementById('tab-sent'),
    search:   document.getElementById('tab-search'),
  };
  const panels = {
    friends:  document.getElementById('panel-friends'),
    requests: document.getElementById('panel-requests'),
    sent:     document.getElementById('panel-sent'),
    search:   document.getElementById('panel-search'),
  };
  const badges = {
    requests: document.getElementById('badge-requests'),
    sent:     document.getElementById('badge-sent'),
  };

  const searchInput  = document.getElementById('friend-search-input');
  const searchBtn    = document.getElementById('friend-search-btn');
  const searchList   = document.getElementById('search-list');

  /* ── Tab switching ───────────────────────────────────────── */
  function activateTab(name) {
    Object.keys(tabs).forEach(k => {
      tabs[k].classList.toggle('sb-friend-tab--active', k === name);
      panels[k].hidden = (k !== name);
    });
    if (name === 'friends')  loadFriends();
    if (name === 'requests') loadIncoming();
    if (name === 'sent')     loadOutgoing();
  }

  Object.keys(tabs).forEach(k => {
    tabs[k].addEventListener('click', () => activateTab(k));
  });

  /* Also allow the search-icon button in the top bar to jump to search tab */
  const topSearchBtn = document.getElementById('top-search-btn');
  if (topSearchBtn) topSearchBtn.addEventListener('click', () => activateTab('search'));

  /* ── Helpers ─────────────────────────────────────────────── */
  function apiFetch(path, opts = {}) {
    return fetch(path, { credentials: 'include', ...opts });
  }

  function setHtml(el, html) {
    if (el) el.innerHTML = html;
  }

  function emptyState(msg) {
    return `<p class="sb-friend-empty">${msg}</p>`;
  }

  function avatarHtml() {
    /* Generic duck avatar for all entries */
    return `<img src="assets/Duck.png" alt="avatar" class="friend-avatar">`;
  }

  function setBadge(el, count) {
    if (!el) return;
    el.textContent  = count > 0 ? count : '';
    el.hidden       = count <= 0;
  }

  /* ── Load counts for badges ─────────────────────────────── */
  async function refreshBadges() {
    try {
      const [inc, out] = await Promise.all([
        apiFetch('/api/friends/incoming').then(r => r.json()),
        apiFetch('/api/friends/outgoing').then(r => r.json()),
      ]);
      setBadge(badges.requests, Array.isArray(inc) ? inc.length : 0);
      setBadge(badges.sent,     Array.isArray(out) ? out.length : 0);
    } catch (_) {}
  }

  /* ── Friends list ────────────────────────────────────────── */
  async function loadFriends() {
    const list = document.getElementById('friends-list');
    setHtml(list, '<p class="sb-friend-loading">Loading…</p>');
    try {
      const res   = await apiFetch('/api/friends');
      const items = await res.json();
      if (!items.length) { setHtml(list, emptyState('No friends yet. Find some!')); return; }

      list.innerHTML = items.map(f => `
        <div class="friend-item" data-uid="${f.id}" data-fid="${f.friendship_id}">
          ${avatarHtml()}
          <span class="friend-name">${escHtml(f.username)}</span>
          <div class="request-actions" style="margin-left:auto">
            <button class="action-btn view-profile-btn"
                    data-uid="${f.id}"
                    title="View profile">
              <img src="assets/person.png" alt="Profile">
            </button>
            <button class="action-btn unfriend-btn"
                    data-fid="${f.friendship_id}"
                    title="Unfriend">
              <img src="assets/cancel.png" alt="Remove">
            </button>
          </div>
        </div>`).join('');

      list.querySelectorAll('.view-profile-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          location.href = `friends-profile.html?userId=${btn.dataset.uid}`;
        });
      });
      list.querySelectorAll('.unfriend-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          removeFriendship(btn.dataset.fid, btn.closest('.friend-item'));
        });
      });
      /* Clicking the row itself also opens profile */
      list.querySelectorAll('.friend-item').forEach(row => {
        row.addEventListener('click', () => {
          location.href = `friends-profile.html?userId=${row.dataset.uid}`;
        });
      });
    } catch (_) {
      setHtml(list, emptyState('Could not load friends.'));
    }
  }

  /* ── Incoming requests ───────────────────────────────────── */
  async function loadIncoming() {
    const list = document.getElementById('incoming-list');
    setHtml(list, '<p class="sb-friend-loading">Loading…</p>');
    try {
      const res   = await apiFetch('/api/friends/incoming');
      const items = await res.json();
      if (!items.length) { setHtml(list, emptyState('No incoming requests.')); return; }

      list.innerHTML = items.map(f => `
        <div class="request-item" data-fid="${f.id}">
          ${avatarHtml()}
          <span class="friend-name">${escHtml(f.username)}</span>
          <div class="request-actions">
            <button class="action-btn accept accept-btn" data-fid="${f.id}" title="Accept">
              <img src="assets/check.png" alt="Accept">
            </button>
            <button class="action-btn decline-btn" data-fid="${f.id}" title="Decline">
              <img src="assets/cancel.png" alt="Decline">
            </button>
          </div>
        </div>`).join('');

      list.querySelectorAll('.accept-btn').forEach(btn =>
        btn.addEventListener('click', () => acceptRequest(btn.dataset.fid, btn.closest('.request-item'))));
      list.querySelectorAll('.decline-btn').forEach(btn =>
        btn.addEventListener('click', () => declineRequest(btn.dataset.fid, btn.closest('.request-item'))));
    } catch (_) {
      setHtml(list, emptyState('Could not load requests.'));
    }
  }

  /* ── Outgoing requests ───────────────────────────────────── */
  async function loadOutgoing() {
    const list = document.getElementById('outgoing-list');
    setHtml(list, '<p class="sb-friend-loading">Loading…</p>');
    try {
      const res   = await apiFetch('/api/friends/outgoing');
      const items = await res.json();
      if (!items.length) { setHtml(list, emptyState('No pending sent requests.')); return; }

      list.innerHTML = items.map(f => `
        <div class="request-item" data-fid="${f.id}">
          ${avatarHtml()}
          <span class="friend-name">${escHtml(f.username)}</span>
          <div class="request-actions">
            <button class="action-btn cancel-btn" data-fid="${f.id}" title="Cancel request">
              <img src="assets/cancel.png" alt="Cancel">
            </button>
          </div>
        </div>`).join('');

      list.querySelectorAll('.cancel-btn').forEach(btn =>
        btn.addEventListener('click', () => cancelRequest(btn.dataset.fid, btn.closest('.request-item'))));
    } catch (_) {
      setHtml(list, emptyState('Could not load sent requests.'));
    }
  }

  /* ── Actions ─────────────────────────────────────────────── */
  async function acceptRequest(fid, rowEl) {
    disableButtons(rowEl);
    try {
      const res = await apiFetch(`/api/friends/${fid}/accept`, { method: 'PATCH' });
      if (res.ok) { rowEl.remove(); refreshBadges(); }
      else showRowError(rowEl, await res.json());
    } catch (_) { showRowError(rowEl, { error: 'Network error' }); }
  }

  async function declineRequest(fid, rowEl) {
    disableButtons(rowEl);
    try {
      const res = await apiFetch(`/api/friends/${fid}/decline`, { method: 'PATCH' });
      if (res.ok) { rowEl.remove(); refreshBadges(); }
      else showRowError(rowEl, await res.json());
    } catch (_) { showRowError(rowEl, { error: 'Network error' }); }
  }

  async function cancelRequest(fid, rowEl) {
    disableButtons(rowEl);
    try {
      const res = await apiFetch(`/api/friends/${fid}`, { method: 'DELETE' });
      if (res.ok) { rowEl.remove(); refreshBadges(); }
      else showRowError(rowEl, await res.json());
    } catch (_) { showRowError(rowEl, { error: 'Network error' }); }
  }

  async function removeFriendship(fid, rowEl) {
    if (!confirm('Remove this friend?')) return;
    disableButtons(rowEl);
    try {
      const res = await apiFetch(`/api/friends/${fid}`, { method: 'DELETE' });
      if (res.ok) rowEl.remove();
      else showRowError(rowEl, await res.json());
    } catch (_) { showRowError(rowEl, { error: 'Network error' }); }
  }

  async function sendRequest(receiverId, btn) {
    btn.disabled    = true;
    btn.textContent = '…';
    try {
      const res  = await apiFetch('/api/friends/request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ receiverId }),
      });
      const data = await res.json();
      if (res.ok) {
        btn.textContent = data.autoAccepted ? 'Friends!' : 'Sent!';
        btn.classList.add('sb-sent-btn');
        refreshBadges();
      } else {
        btn.textContent = data.error || 'Error';
        btn.disabled    = false;
      }
    } catch (_) {
      btn.textContent = 'Error';
      btn.disabled    = false;
    }
  }

  /* ── Search ──────────────────────────────────────────────── */
  function doSearch() {
    const q = searchInput.value.trim();
    if (!q) return;
    setHtml(searchList, '<p class="sb-friend-loading">Searching…</p>');

    apiFetch(`/api/friends/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(items => {
        if (!items.length) { setHtml(searchList, emptyState('No users found.')); return; }

        searchList.innerHTML = items.map(u => {
          let actionHtml = '';
          if (u.relationship === 'self') {
            actionHtml = `<span class="sb-rel-tag">You</span>`;
          } else if (u.relationship === 'friends') {
            actionHtml = `<span class="sb-rel-tag">Friends</span>`;
          } else if (u.relationship === 'request_sent') {
            actionHtml = `<span class="sb-rel-tag">Sent</span>`;
          } else if (u.relationship === 'request_received') {
            actionHtml = `
              <button class="action-btn accept accept-inbox-btn" data-fid="${u.friendship_id}" title="Accept">
                <img src="assets/check.png" alt="Accept">
              </button>`;
          } else {
            actionHtml = `
              <button class="sb-add-btn" data-uid="${u.id}">Add Friend</button>`;
          }

          return `
            <div class="request-item">
              ${avatarHtml()}
              <span class="friend-name">${escHtml(u.username)}</span>
              <div class="request-actions">${actionHtml}</div>
            </div>`;
        }).join('');

        /* Bind add-friend buttons */
        searchList.querySelectorAll('.sb-add-btn').forEach(btn =>
          btn.addEventListener('click', () => sendRequest(Number(btn.dataset.uid), btn)));

        /* Bind accept-from-search buttons */
        searchList.querySelectorAll('.accept-inbox-btn').forEach(btn =>
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            const res = await apiFetch(`/api/friends/${btn.dataset.fid}/accept`, { method: 'PATCH' });
            if (res.ok) { btn.replaceWith(document.createTextNode('')); refreshBadges(); doSearch(); }
          }));
      })
      .catch(() => setHtml(searchList, emptyState('Search failed.')));
  }

  if (searchBtn) searchBtn.addEventListener('click', doSearch);
  if (searchInput) {
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  }

  /* ── Utility ─────────────────────────────────────────────── */
  function disableButtons(rowEl) {
    rowEl.querySelectorAll('button').forEach(b => { b.disabled = true; });
  }

  function showRowError(rowEl, data) {
    const errEl = document.createElement('span');
    errEl.className   = 'sb-row-err';
    errEl.textContent = data.error || 'Error';
    rowEl.querySelector('.request-actions').appendChild(errEl);
    rowEl.querySelectorAll('button').forEach(b => { b.disabled = false; });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Init ────────────────────────────────────────────────── */
  await refreshBadges();
  activateTab('friends');
})();
