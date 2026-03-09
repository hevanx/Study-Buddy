/* ===============================
   EXISTING TAB LOGIC
================================ */
const tabButtons = document.querySelectorAll('.tab');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

/* ===============================
   CUSTOMIZE BUDDY
================================ */

/* --- Item catalog ---
   requiredXp: minimum XP needed to equip this item.
   To add items, push to this array.
   To change a unlock threshold, edit requiredXp here — nothing else needs to change.
   Glasses share the 'hat' slot — only one head item can be worn at a time. */
const COSMETIC_ITEMS = [
  { id: 'hat-1',     name: 'Hat',     category: 'hat',   icon: 'assets/Hat.png',     requiredXp: 600,  requiredRankName: 'Gold'    },
  { id: 'crown-1',   name: 'Crown',   category: 'hat',   icon: 'assets/Crown.png',   requiredXp: 1000, requiredRankName: 'Diamond' },
  { id: 'glasses-1', name: 'Glasses', category: 'hat',   icon: 'assets/Glasses.png', requiredXp: 100,  requiredRankName: 'Bronze'  },
  { id: 'shirt-1',   name: 'Shirt',   category: 'shirt', icon: 'assets/Shirt.png',   requiredXp: 600,  requiredRankName: 'Gold'    },
  { id: 'shoes-1',   name: 'Shoes',   category: 'shoes', icon: 'assets/Shoes.png',   requiredXp: 300,  requiredRankName: 'Silver'  },
];

/* Returns the player's current XP from the live XP system. */
function getCurrentXp() {
  if (window._sbXp) return window._sbXp.totalXp;
  return 0;
}

/* Maps category -> equipped-state key */
const CATEGORY_KEY = {
  hat:   'hatId',
  shirt: 'shirtId',
  shoes: 'shoesId',
};

const DEFAULT_DUCK = 'assets/Duck.png';

/* Returns the correct duck image for the current combination of equipped items.
   Uses pre-rendered combination assets (e.g. SSH.png = Shirt + Shoes + Hat). */
function getDuckImage(eq) {
  const hasShirt = eq.shirtId === 'shirt-1';
  const hasShoes = eq.shoesId === 'shoes-1';
  const headKey  = eq.hatId === 'hat-1'     ? 'hat'
                 : eq.hatId === 'crown-1'   ? 'crown'
                 : eq.hatId === 'glasses-1' ? 'glasses'
                 : null;

  /* Three-item combinations */
  if (headKey && hasShirt && hasShoes) {
    if (headKey === 'hat')     return 'assets/SSH.png';
    if (headKey === 'crown')   return 'assets/SSC.png';
    if (headKey === 'glasses') return 'assets/SSG.png';
  }

  /* Two-item combinations */
  if (headKey && hasShirt) {
    if (headKey === 'hat')     return 'assets/HShirt.png';
    if (headKey === 'crown')   return 'assets/CShirt.png';
    if (headKey === 'glasses') return 'assets/GShirt.png';
  }
  if (headKey && hasShoes) {
    if (headKey === 'hat')     return 'assets/HS.png';
    if (headKey === 'crown')   return 'assets/CS.png';
    if (headKey === 'glasses') return 'assets/GS.png';
  }
  if (hasShirt && hasShoes) return 'assets/SS.png';

  /* Single items */
  if (headKey === 'hat')     return 'assets/DuckHat.png';
  if (headKey === 'crown')   return 'assets/DuckCrown.png';
  if (headKey === 'glasses') return 'assets/DuckGlasses.png';
  if (hasShirt)              return 'assets/DuckShirt.png';
  if (hasShoes)              return 'assets/DuckShoes.png';

  return DEFAULT_DUCK;
}

/* --- Persistence layer (MySQL via API) --- */
const CosmeticStore = {
  async load() {
    const userId = localStorage.getItem('sb-userId');
    if (!userId) return { hatId: null, glassesId: null, shirtId: null, shoesId: null };
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/cosmetics`, {
        credentials: 'include',
      });
      if (res.ok) return res.json();
    } catch (_) {}
    return { hatId: null, glassesId: null, shirtId: null, shoesId: null };
  },
  async save(eq) {
    const userId = localStorage.getItem('sb-userId');
    if (!userId) return eq;
    try {
      await fetch(`/api/users/${encodeURIComponent(userId)}/cosmetics`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify(eq),
      });
    } catch (_) {}
    return eq;
  },
};

/* --- State --- */
let equipped = { hatId: null, glassesId: null, shirtId: null, shoesId: null };
let activeCategory = 'hat';

/* --- DOM refs (only exist on the dashboard page) --- */
const grid      = document.getElementById('customize-grid');
const mascotImg = document.getElementById('mascot-img');
const catTabs   = document.querySelectorAll('.sb-customize-tab');

/* --- Render items for the active category --- */
function renderGrid() {
  if (!grid) return;

  const key      = CATEGORY_KEY[activeCategory];
  const items    = COSMETIC_ITEMS.filter(i => i.category === activeCategory);
  const xp       = getCurrentXp();
  let html = '';

  /* "None" card */
  const noneSelected = equipped[key] === null;
  html += `
    <button class="sb-customize-card${noneSelected ? ' sb-customize-card--selected' : ''}"
            data-item-id="" type="button">
      <span class="sb-customize-none-icon" aria-hidden="true">&#10005;</span>
      <span class="sb-customize-label">None</span>
    </button>`;

  /* Item cards */
  items.forEach(item => {
    const selected = equipped[key] === item.id;
    const locked   = xp < item.requiredXp;
    let cls = 'sb-customize-card';
    if (selected) cls += ' sb-customize-card--selected';
    if (locked)   cls += ' sb-customize-card--locked';

    html += `
      <button class="${cls}"
              data-item-id="${item.id}"
              ${locked ? 'aria-disabled="true"' : ''}
              type="button">
        <img class="sb-customize-icon" src="${item.icon}" alt="${item.name}" />
        <span class="sb-customize-label">${item.name}</span>
        ${locked ? `<span class="sb-customize-unlock-label">${item.requiredRankName} · ${item.requiredXp} XP</span>` : ''}
      </button>`;
  });

  grid.innerHTML = html;

  /* Attach click handlers */
  grid.querySelectorAll('.sb-customize-card').forEach(card => {
    card.addEventListener('click', () => onCardClick(card));
  });
}

/* --- Handle item click --- */
function onCardClick(card) {
  if (card.classList.contains('sb-customize-card--locked')) {
    const item  = COSMETIC_ITEMS.find(i => i.id === card.dataset.itemId);
    const msgEl = document.getElementById('customize-msg');
    if (msgEl && item) {
      msgEl.textContent = `Reach ${item.requiredRankName} (${item.requiredXp} XP) to unlock ${item.name}.`;
      clearTimeout(msgEl._hideTimer);
      msgEl._hideTimer = setTimeout(() => { msgEl.textContent = ''; }, 3000);
    }
    return;
  }

  const key    = CATEGORY_KEY[activeCategory];
  const itemId = card.dataset.itemId || null;

  equipped[key] = itemId;
  CosmeticStore.save(equipped);
  renderGrid();
  updateMascot();
}

/* --- Update the duck mascot on the dashboard --- */
function updateMascot() {
  if (!mascotImg) return;
  mascotImg.src = getDuckImage(equipped);
}

/* --- Strip any equipped items the user can no longer afford --- */
function enforceEquipRestrictions() {
  const xp = getCurrentXp();
  let changed = false;
  COSMETIC_ITEMS.forEach(item => {
    const key = CATEGORY_KEY[item.category];
    if (equipped[key] === item.id && xp < item.requiredXp) {
      equipped[key] = null;
      changed = true;
    }
  });
  if (changed) {
    CosmeticStore.save(equipped);
    updateMascot();
  }
}

/* --- Category tab switching --- */
catTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    catTabs.forEach(t => t.classList.remove('sb-customize-tab--active'));
    tab.classList.add('sb-customize-tab--active');
    activeCategory = tab.dataset.category;
    renderGrid();
  });
});

/* --- Init on page load: load cosmetics from API then render --- */
CosmeticStore.load().then(eq => {
  /* Migrate: glasses previously stored in glassesId → move to hatId */
  if (eq.glassesId && !eq.hatId) eq.hatId = eq.glassesId;
  eq.glassesId = null;
  equipped = eq;
  if (grid) { renderGrid(); updateMascot(); }
});

/* ── Nav rank badge (all pages) ─────────────────────────────────────────────
   Sets the correct rank icon in the top nav on every page.
   On pages that load xpSystem.js the XpSystem._render() will also keep it
   updated live; this handles pages that don't load xpSystem.js at all.     */
(function () {
  const badgeEl = document.querySelector('.sb-rank-badge');
  if (!badgeEl) return;

  const RANK_IMGS = [
    { minXp: 1000, src: 'assets/DiamondAward.png', alt: 'Diamond badge' },
    { minXp:  600, src: 'assets/GoldAward.png',    alt: 'Gold badge'    },
    { minXp:  300, src: 'assets/SilverAward.png',  alt: 'Silver badge'  },
    { minXp:  100, src: 'assets/BronzeAward.png',  alt: 'Bronze badge'  },
    { minXp:    0, src: 'assets/RankLogo.png',     alt: 'Unranked badge'},
  ];

  /* XpSystem.init() will update the badge once the async fetch resolves.
     Show Unranked as the initial placeholder. */
  const xp = 0;

  const rank = RANK_IMGS.find(r => xp >= r.minXp) || RANK_IMGS[RANK_IMGS.length - 1];
  badgeEl.src = rank.src;
  badgeEl.alt = rank.alt;
})();
