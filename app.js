/* ═══════════════════════════════════════════════
   ANIMEHUB — APP LOGIC
   Watchlist · LocalStorage · Animations · Particles
═══════════════════════════════════════════════ */

// ── LOCAL STORAGE KEY ───────────────────────────
const STORAGE_KEY = 'animehub_watchlist_v2';

// ── STATE ────────────────────────────────────────
let animeList   = loadFromStorage();
let activeFilter = 'all';
let activeSort   = 'dateAdded';
let viewMode     = 'grid';   // 'grid' | 'list'
let currentRating = 0;
let editingId    = null;
let detailId     = null;

// ── DOM REFS ─────────────────────────────────────
const animeGrid      = document.getElementById('animeGrid');
const emptyState     = document.getElementById('emptyState');
const searchInput    = document.getElementById('searchInput');
const sortSelect     = document.getElementById('sortSelect');
const resultsCount   = document.getElementById('resultsCount');
const viewGridBtn    = document.getElementById('viewGrid');
const viewListBtn    = document.getElementById('viewList');

const modalOverlay   = document.getElementById('modalOverlay');
const modal          = document.getElementById('modal');
const modalTitle     = document.getElementById('modalTitle');
const animeForm      = document.getElementById('animeForm');
const openModalBtn   = document.getElementById('openModal');
const closeModalBtn  = document.getElementById('closeModal');
const cancelModalBtn = document.getElementById('cancelModal');

const detailOverlay  = document.getElementById('detailOverlay');
const detailContent  = document.getElementById('detailContent');
const closeDetailBtn = document.getElementById('closeDetail');

const starRatingEl   = document.getElementById('starRating');
const fRating        = document.getElementById('fRating');
const ratingLabel    = document.getElementById('ratingLabel');
const toast          = document.getElementById('toast');

// Stats
const statTotal     = document.getElementById('statTotal');
const statCompleted = document.getElementById('statCompleted');
const statWatching  = document.getElementById('statWatching');
const statEpisodes  = document.getElementById('statEpisodes');

document.getElementById('footerYear').textContent = new Date().getFullYear();

// ── STORAGE ──────────────────────────────────────
function loadFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(animeList));
}

// ── RENDER ───────────────────────────────────────
function render() {
  const query  = searchInput.value.trim().toLowerCase();

  let filtered = animeList.filter(a => {
    const matchFilter = activeFilter === 'all' || a.status === activeFilter;
    const matchSearch = !query ||
      a.title.toLowerCase().includes(query) ||
      (a.genre && a.genre.toLowerCase().includes(query)) ||
      (a.notes && a.notes.toLowerCase().includes(query));
    return matchFilter && matchSearch;
  });

  // Sort
  filtered.sort((a, b) => {
    if (activeSort === 'dateAdded') return b.addedAt - a.addedAt;
    if (activeSort === 'title')     return a.title.localeCompare(b.title);
    if (activeSort === 'rating')    return (b.rating || 0) - (a.rating || 0);
    if (activeSort === 'episodes')  return (b.episodesWatched || 0) - (a.episodesWatched || 0);
    return 0;
  });

  // Update stats
  updateStats();

  // Results count
  resultsCount.innerHTML =
    `Showing <strong>${filtered.length}</strong> of <strong>${animeList.length}</strong> anime`;

  // Empty state
  if (filtered.length === 0) {
    animeGrid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  animeGrid.innerHTML = filtered.map(buildCard).join('');

  // Staggered animation
  animeGrid.querySelectorAll('.anime-card').forEach((card, i) => {
    card.style.animationDelay = `${i * 0.04}s`;
  });

  // Attach events
  animeGrid.querySelectorAll('.anime-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.card-action-btn')) return;
      openDetail(card.dataset.id);
    });
    card.querySelector('.btn-card-edit')?.addEventListener('click', () => openEdit(card.dataset.id));
    card.querySelector('.btn-card-delete')?.addEventListener('click', () => deleteAnime(card.dataset.id));
  });
}

// ── BUILD CARD ───────────────────────────────────
function buildCard(anime) {
  const epWatched = parseInt(anime.episodesWatched) || 0;
  const epTotal   = parseInt(anime.totalEpisodes)   || 0;
  const progress  = epTotal > 0 ? Math.min((epWatched / epTotal) * 100, 100) : 0;
  const badgeCls  = `badge-${CSS.escape ? CSS.escape(anime.status) : anime.status.replace(/ /g,'\ ')}`;

  return `
  <div class="anime-card" data-id="${anime.id}">
    <div class="card-cover">
      ${anime.coverUrl
        ? `<img src="${escHtml(anime.coverUrl)}" alt="${escHtml(anime.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''}
      <div class="cover-placeholder" style="${anime.coverUrl ? 'display:none' : ''}">
        🎌
        <span>${escHtml(anime.title)}</span>
      </div>
      <span class="card-status-badge ${badgeCls}">${escHtml(anime.status)}</span>
      ${anime.rating ? `<span class="card-rating-badge">★ ${anime.rating}/10</span>` : ''}
    </div>
    <div class="card-body">
      <div class="card-title">${escHtml(anime.title)}</div>
      <div class="card-meta">
        ${anime.genre ? `<span class="card-genre">${escHtml(anime.genre)}</span>` : ''}
        ${anime.year  ? `<span class="card-year">${anime.year}</span>` : ''}
      </div>
      ${epTotal > 0 ? `
      <div class="card-eps">
        <span>${epWatched}/${epTotal} eps</span>
        <div class="eps-bar-wrap">
          <div class="eps-bar-fill" style="width:${progress}%"></div>
        </div>
        <span>${Math.round(progress)}%</span>
      </div>` : (epWatched > 0 ? `<div class="card-eps"><span>${epWatched} eps watched</span></div>` : '')}
    </div>
    <div class="card-actions">
      <button class="card-action-btn btn-card-edit">✏️ Edit</button>
      <button class="card-action-btn delete btn-card-delete">🗑 Delete</button>
    </div>
  </div>`;
}

// ── STATS ────────────────────────────────────────
function updateStats() {
  const total     = animeList.length;
  const completed = animeList.filter(a => a.status === 'Completed').length;
  const watching  = animeList.filter(a => a.status === 'Watching').length;
  const episodes  = animeList.reduce((s, a) => s + (parseInt(a.episodesWatched)||0), 0);

  animateNumber(statTotal,     parseInt(statTotal.textContent)     || 0, total);
  animateNumber(statCompleted, parseInt(statCompleted.textContent) || 0, completed);
  animateNumber(statWatching,  parseInt(statWatching.textContent)  || 0, watching);
  animateNumber(statEpisodes,  parseInt(statEpisodes.textContent)  || 0, episodes);
}
function animateNumber(el, from, to) {
  if (from === to) return;
  const dur = 600, steps = 30;
  const inc = (to - from) / steps;
  let cur = from, step = 0;
  const timer = setInterval(() => {
    step++;
    cur += inc;
    el.textContent = Math.round(cur);
    if (step >= steps) { el.textContent = to; clearInterval(timer); }
  }, dur / steps);
}

// ── MODAL ────────────────────────────────────────
function openAddModal() {
  editingId = null;
  animeForm.reset();
  setRating(0);
  document.getElementById('editId').value = '';
  modalTitle.textContent = 'Add New Anime';
  document.getElementById('saveBtn').textContent = 'Save Anime';
  openModal();
}
function openEdit(id) {
  const anime = animeList.find(a => a.id === id);
  if (!anime) return;
  editingId = id;
  document.getElementById('editId').value  = id;
  document.getElementById('fTitle').value  = anime.title || '';
  document.getElementById('fStatus').value = anime.status || '';
  document.getElementById('fGenre').value  = anime.genre || '';
  document.getElementById('fEpisodes').value = anime.episodesWatched || '';
  document.getElementById('fTotalEp').value  = anime.totalEpisodes || '';
  document.getElementById('fCoverUrl').value = anime.coverUrl || '';
  document.getElementById('fNotes').value    = anime.notes || '';
  document.getElementById('fYear').value     = anime.year || '';
  setRating(anime.rating || 0);
  modalTitle.textContent = 'Edit Anime';
  document.getElementById('saveBtn').textContent = 'Update Anime';
  closeDetailModal();
  openModal();
}
function openModal() {
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  animeForm.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

// ── DETAIL MODAL ─────────────────────────────────
function openDetail(id) {
  const anime = animeList.find(a => a.id === id);
  if (!anime) return;
  detailId = id;
  const epWatched = parseInt(anime.episodesWatched) || 0;
  const epTotal   = parseInt(anime.totalEpisodes)   || 0;
  const stars = anime.rating ? '★'.repeat(anime.rating) + '☆'.repeat(10 - anime.rating) : 'Not rated';
  const badgeCls = `badge-${anime.status}`;

  detailContent.innerHTML = `
    ${anime.coverUrl
      ? `<img class="detail-cover" src="${escHtml(anime.coverUrl)}" alt="${escHtml(anime.title)}"
              onerror="this.outerHTML='<div class=detail-cover-placeholder>🎌</div>'">`
      : `<div class="detail-cover-placeholder">🎌</div>`}
    <h2 class="detail-title">${escHtml(anime.title)}</h2>
    <div class="detail-badges">
      <span class="detail-badge card-status-badge ${badgeCls}">${escHtml(anime.status)}</span>
      ${anime.genre ? `<span class="detail-badge card-genre">${escHtml(anime.genre)}</span>` : ''}
    </div>
    <div class="detail-info">
      <div class="detail-info-item">
        <div class="detail-info-label">Rating</div>
        <div class="detail-info-value" style="color:var(--clr-gold)">
          ${anime.rating ? `${anime.rating}/10` : '—'}
        </div>
      </div>
      <div class="detail-info-item">
        <div class="detail-info-label">Year</div>
        <div class="detail-info-value">${anime.year || '—'}</div>
      </div>
      <div class="detail-info-item">
        <div class="detail-info-label">Episodes</div>
        <div class="detail-info-value">
          ${epWatched > 0 ? epWatched : '—'}${epTotal > 0 ? ' / ' + epTotal : ''}
        </div>
      </div>
      <div class="detail-info-item">
        <div class="detail-info-label">Added</div>
        <div class="detail-info-value" style="font-size:0.8rem">${formatDate(anime.addedAt)}</div>
      </div>
    </div>
    ${anime.notes ? `<div class="detail-notes">"${escHtml(anime.notes)}"</div>` : ''}
    <div class="detail-actions">
      <button class="btn-edit" onclick="openEdit('${id}')">✏️ Edit</button>
      <button class="btn-delete" onclick="deleteAnime('${id}')">🗑 Delete</button>
    </div>
  `;
  detailOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDetailModal() {
  detailOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ── FORM SUBMIT ──────────────────────────────────
animeForm.addEventListener('submit', e => {
  e.preventDefault();
  const title  = document.getElementById('fTitle').value.trim();
  const status = document.getElementById('fStatus').value;

  // Validate
  let valid = true;
  if (!title)  { document.getElementById('fTitle').classList.add('error');  valid = false; }
  if (!status) { document.getElementById('fStatus').classList.add('error'); valid = false; }
  if (!valid)  { showToast('Please fill required fields', 'error'); return; }

  const data = {
    title,
    status,
    genre:           document.getElementById('fGenre').value.trim(),
    episodesWatched: parseInt(document.getElementById('fEpisodes').value) || 0,
    totalEpisodes:   parseInt(document.getElementById('fTotalEp').value)  || 0,
    rating:          parseInt(fRating.value) || 0,
    coverUrl:        document.getElementById('fCoverUrl').value.trim(),
    notes:           document.getElementById('fNotes').value.trim(),
    year:            document.getElementById('fYear').value.trim(),
  };

  if (editingId) {
    const idx = animeList.findIndex(a => a.id === editingId);
    if (idx !== -1) {
      animeList[idx] = { ...animeList[idx], ...data, updatedAt: Date.now() };
      showToast('✅ Anime updated!', 'success');
    }
  } else {
    animeList.unshift({ ...data, id: genId(), addedAt: Date.now() });
    showToast('🎌 Anime added to your watchlist!', 'success');
  }

  saveToStorage();
  closeModal();
  render();
});

// ── DELETE ───────────────────────────────────────
function deleteAnime(id) {
  const anime = animeList.find(a => a.id === id);
  if (!anime) return;
  if (!confirm(`Remove "${anime.title}" from your watchlist?`)) return;
  animeList = animeList.filter(a => a.id !== id);
  saveToStorage();
  closeDetailModal();
  render();
  showToast('🗑 Anime removed', 'success');
}

// ── STAR RATING ──────────────────────────────────
function setRating(val) {
  currentRating = val;
  fRating.value = val;
  const stars = starRatingEl.querySelectorAll('.star');
  stars.forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= val);
  });
  ratingLabel.textContent = val === 0 ? 'Not rated' : `${val}/10 — ${ratingText(val)}`;
}
function ratingText(r) {
  const labels = ['','Terrible','Bad','Poor','Below Average','Average','Above Average','Good','Great','Excellent','Masterpiece'];
  return labels[r] || '';
}
starRatingEl.querySelectorAll('.star').forEach(s => {
  s.addEventListener('click', () => setRating(parseInt(s.dataset.val)));
  s.addEventListener('mouseenter', () => {
    starRatingEl.querySelectorAll('.star').forEach(s2 => {
      s2.classList.toggle('active', parseInt(s2.dataset.val) <= parseInt(s.dataset.val));
    });
  });
});
starRatingEl.addEventListener('mouseleave', () => setRating(currentRating));

// ── FILTERS ──────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});

// ── SEARCH ───────────────────────────────────────
let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(render, 250);
});

// ── SORT ─────────────────────────────────────────
sortSelect.addEventListener('change', () => {
  activeSort = sortSelect.value;
  render();
});

// ── VIEW TOGGLE ──────────────────────────────────
viewGridBtn.addEventListener('click', () => {
  viewMode = 'grid';
  viewGridBtn.classList.add('active');
  viewListBtn.classList.remove('active');
  animeGrid.classList.remove('list-view');
});
viewListBtn.addEventListener('click', () => {
  viewMode = 'list';
  viewListBtn.classList.add('active');
  viewGridBtn.classList.remove('active');
  animeGrid.classList.add('list-view');
});

// ── MODAL EVENTS ─────────────────────────────────
openModalBtn.addEventListener('click', openAddModal);
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);
closeDetailBtn.addEventListener('click', closeDetailModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
detailOverlay.addEventListener('click', e => { if (e.target === detailOverlay) closeDetailModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDetailModal(); }
});
// Remove error class on input
document.getElementById('fTitle').addEventListener('input',  () => document.getElementById('fTitle').classList.remove('error'));
document.getElementById('fStatus').addEventListener('change', () => document.getElementById('fStatus').classList.remove('error'));

// ── TOAST ────────────────────────────────────────
let toastTimer;
function showToast(msg, type='success') {
  toast.textContent = msg;
  toast.className   = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── HELPERS ──────────────────────────────────────
function genId()    { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function escHtml(s) { const d=document.createElement('div');d.appendChild(document.createTextNode(s));return d.innerHTML; }
function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

// ── PARTICLE SYSTEM ──────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles = [];

  const COLORS = ['#a855f7','#ec4899','#06b6d4','#7c3aed','#f59e0b'];
  const COUNT  = 60;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkParticle() {
    return {
      x:     Math.random() * W,
      y:     Math.random() * H,
      vx:    (Math.random() - 0.5) * 0.4,
      vy:    -Math.random() * 0.6 - 0.2,
      size:  Math.random() * 2.5 + 0.5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.6 + 0.1,
      life:  Math.random(),
      speed: Math.random() * 0.003 + 0.001,
      type:  Math.random() > 0.7 ? 'sakura' : 'dot',
    };
  }

  function drawSakura(ctx, x, y, r, angle, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(0, -r, r * 0.4, r * 0.7, (i * Math.PI * 2) / 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  resize();
  for (let i = 0; i < COUNT; i++) particles.push(mkParticle());
  window.addEventListener('resize', resize);

  let angle = 0;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    angle += 0.005;

    particles.forEach(p => {
      p.life += p.speed;
      p.x += p.vx + Math.sin(p.life * 3) * 0.3;
      p.y += p.vy;
      p.alpha = Math.sin(p.life * Math.PI) * 0.5;

      if (p.y < -10 || p.life >= 1) {
        Object.assign(p, mkParticle(), { y: H + 10, life: 0 });
      }

      if (p.type === 'sakura') {
        drawSakura(ctx, p.x, p.y, p.size * 2.5, p.life * 5, p.color, p.alpha);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    requestAnimationFrame(loop);
  }
  loop();
})();

// ── SEED SAMPLE DATA (first visit) ───────────────
(function seedIfEmpty() {
  if (animeList.length > 0) return;
  const samples = [
    { title:'Attack on Titan', status:'Completed', genre:'Action',      rating:10, episodesWatched:87,  totalEpisodes:87,  year:'2013', notes:'An absolute masterpiece. The story and animation are breathtaking.',    coverUrl:'https://cdn.myanimelist.net/images/anime/10/47347.jpg' },
    { title:'Demon Slayer',     status:'Completed', genre:'Action',      rating:9,  episodesWatched:44,  totalEpisodes:44,  year:'2019', notes:'Incredible animation quality, especially the Rengoku arc!',            coverUrl:'https://cdn.myanimelist.net/images/anime/1286/99889.jpg' },
    { title:'Fullmetal Alchemist: Brotherhood', status:'Completed', genre:'Adventure', rating:10, episodesWatched:64, totalEpisodes:64, year:'2009', notes:'Perfect storytelling from start to finish.', coverUrl:'https://cdn.myanimelist.net/images/anime/1223/96541.jpg' },
    { title:'Death Note',       status:'Completed', genre:'Psychological', rating:9, episodesWatched:37, totalEpisodes:37, year:'2006', notes:'The cat and mouse game between Light and L is legendary.', coverUrl:'https://cdn.myanimelist.net/images/anime/9/9453.jpg' },
    { title:'One Piece',        status:'Watching',  genre:'Adventure',   rating:9,  episodesWatched:1000, totalEpisodes:1100, year:'1999', notes:'The journey of the Straw Hats is unmatched.', coverUrl:'https://cdn.myanimelist.net/images/anime/6/73245.jpg' },
    { title:'Jujutsu Kaisen',   status:'Watching',  genre:'Action',      rating:9,  episodesWatched:36,  totalEpisodes:48,  year:'2020', notes:'Gojo is the GOAT. Season 2 was fire.',                               coverUrl:'https://cdn.myanimelist.net/images/anime/1171/109222.jpg' },
    { title:'Spy x Family',     status:'Plan to Watch', genre:'Comedy',  rating:0,  episodesWatched:0,   totalEpisodes:25,  year:'2022', coverUrl:'https://cdn.myanimelist.net/images/anime/1441/122795.jpg' },
  ];
  animeList = samples.map((s,i) => ({ ...s, id: genId(), addedAt: Date.now() - i * 86400000 }));
  saveToStorage();
})();

// ── INITIAL RENDER ───────────────────────────────
render();
