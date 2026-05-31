/* ===================================================================
   Stampr — single-page client. Vanilla JS, no build step.
   Handles auth, member mobile view, and merchant desktop dashboard.
=================================================================== */

const API = '/api';
const store = {
  get token() { return localStorage.getItem('stampr_token'); },
  set token(v) { v ? localStorage.setItem('stampr_token', v) : localStorage.removeItem('stampr_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('stampr_user')); } catch { return null; } },
  set user(v) { v ? localStorage.setItem('stampr_user', JSON.stringify(v)) : localStorage.removeItem('stampr_user'); },
};

// --- API helper with auth header + JSON handling ---
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (store.token) headers.Authorization = `Bearer ${store.token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

// --- Toast notifications ---
function toast(msg, kind = 'info') {
  const host = document.getElementById('toast-host');
  const colors = {
    info: 'bg-ink text-cream',
    success: 'bg-moss text-cream',
    error: 'bg-ember text-cream',
  };
  const el = document.createElement('div');
  el.className = `toast pointer-events-auto px-5 py-3 rounded-full shadow-xl text-sm font-medium ${colors[kind]}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

const app = () => document.getElementById('app');
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// --- Router: decides which top-level view to show ---
async function route() {
  const params = new URLSearchParams(location.search);
  const joinCode = params.get('join');

  if (!store.token || !store.user) {
    renderAuth(joinCode);
    return;
  }
  // Refresh identity (token may be stale).
  try {
    const me = await api('/auth/me');
    store.user = { ...store.user, ...me, id: me.id };
  } catch {
    store.token = null; store.user = null;
    return renderAuth(joinCode);
  }

  if (store.user.role === 'merchant' || store.user.role === 'admin') {
    if (store.user.role === 'admin') { /* admin uses merchant dashboard tooling */ }
  }

  if (store.user.role === 'merchant') {
    renderMerchant();
  } else {
    // Pending join code? Auto-join then land on member home.
    if (joinCode) {
      try {
        const r = await api('/member/join', { method: 'POST', body: { joinCode } });
        toast(r.message || 'Joined!', 'success');
      } catch (e) { toast(e.message, 'error'); }
      history.replaceState({}, '', '/');
    }
    renderMember();
  }
}

function logout() {
  store.token = null; store.user = null;
  history.replaceState({}, '', '/');
  route();
}

/* ===================== AUTH SCREENS ===================== */
function renderAuth(joinCode) {
  let mode = 'login';
  let role = 'member';

  function paint() {
    app().innerHTML = `
      <div class="min-h-screen flex items-center justify-center p-5">
        <div class="w-full max-w-md fade-in">
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ink text-gold text-3xl font-display font-black mb-4 rotate-3 shadow-lg">S</div>
            <h1 class="font-display text-4xl font-black tracking-tight">Stampr</h1>
            <p class="text-ink/60 mt-1">Collect stamps. Earn rewards.</p>
            ${joinCode ? `<p class="mt-3 text-sm bg-gold/20 text-ink inline-block px-3 py-1 rounded-full">Joining with code <b>${esc(joinCode)}</b></p>` : ''}
          </div>

          <div class="bg-white/70 backdrop-blur rounded-3xl shadow-xl border border-ink/5 p-7">
            <div class="flex gap-1 p-1 bg-ink/5 rounded-full mb-6">
              <button data-mode="login" class="flex-1 py-2 rounded-full text-sm font-semibold ${mode === 'login' ? 'bg-ink text-cream' : 'text-ink/60'}">Sign in</button>
              <button data-mode="register" class="flex-1 py-2 rounded-full text-sm font-semibold ${mode === 'register' ? 'bg-ink text-cream' : 'text-ink/60'}">Create account</button>
            </div>

            <form id="auth-form" class="space-y-4">
              ${mode === 'register' ? `
                <div class="flex gap-1 p-1 bg-ink/5 rounded-full">
                  <button type="button" data-role="member" class="flex-1 py-1.5 rounded-full text-xs font-semibold ${role === 'member' ? 'bg-gold text-ink' : 'text-ink/50'}">I'm a customer</button>
                  <button type="button" data-role="merchant" class="flex-1 py-1.5 rounded-full text-xs font-semibold ${role === 'merchant' ? 'bg-gold text-ink' : 'text-ink/50'}">I'm a business</button>
                </div>
                <input name="name" placeholder="${role === 'merchant' ? 'Your name' : 'Full name'}" required class="w-full px-4 py-3 rounded-xl border border-ink/10 bg-white focus:outline-none focus:ring-2 focus:ring-gold" />
                ${role === 'merchant' ? `<input name="businessName" placeholder="Business name" required class="w-full px-4 py-3 rounded-xl border border-ink/10 bg-white focus:outline-none focus:ring-2 focus:ring-gold" />` : `<input name="birthday" type="date" class="w-full px-4 py-3 rounded-xl border border-ink/10 bg-white text-ink/70 focus:outline-none focus:ring-2 focus:ring-gold" />`}
              ` : ''}
              <input name="email" type="email" placeholder="Email" required class="w-full px-4 py-3 rounded-xl border border-ink/10 bg-white focus:outline-none focus:ring-2 focus:ring-gold" />
              <input name="password" type="password" placeholder="Password" required minlength="6" class="w-full px-4 py-3 rounded-xl border border-ink/10 bg-white focus:outline-none focus:ring-2 focus:ring-gold" />
              <button type="submit" class="w-full py-3 rounded-xl bg-ember text-cream font-semibold hover:bg-ember/90 transition shadow-lg shadow-ember/20">
                ${mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </div>
        </div>
      </div>`;

    app().querySelectorAll('[data-mode]').forEach((b) =>
      b.onclick = () => { mode = b.dataset.mode; paint(); });
    app().querySelectorAll('[data-role]').forEach((b) =>
      b.onclick = () => { role = b.dataset.role; paint(); });

    app().querySelector('#auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries());
      try {
        const path = mode === 'login' ? '/auth/login' : '/auth/register';
        const payload = mode === 'login'
          ? { email: fd.email, password: fd.password }
          : { ...fd, role };
        const r = await api(path, { method: 'POST', body: payload });
        store.token = r.token;
        store.user = r.user;
        toast(`Welcome${r.user.name ? ', ' + r.user.name : ''}!`, 'success');
        route();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  }
  paint();
}

/* ===================== MEMBER (MOBILE) VIEW ===================== */
let memberTab = 'cards';

async function renderMember() {
  app().innerHTML = `
    <div class="max-w-md mx-auto min-h-screen flex flex-col">
      <header class="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p class="text-ink/50 text-sm">Hello,</p>
          <h1 class="font-display text-2xl font-black leading-tight">${esc(store.user.name)}</h1>
        </div>
        <button id="logout" class="text-xs px-3 py-2 rounded-full bg-ink/5 text-ink/60 hover:bg-ink/10">Log out</button>
      </header>

      <main id="member-body" class="flex-1 px-5 pb-28"></main>

      <nav class="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-white/90 backdrop-blur border-t border-ink/10 flex">
        ${[['cards', 'Cards', 'M3 5h18v4H3zM3 11h18v8H3z'],
           ['scan', 'Scan', 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3z'],
           ['rewards', 'Rewards', 'M12 2l3 6 6 .5-4.5 4 1.5 6L12 15l-5.5 3.5L8 12.5 3.5 8.5 9.5 8z'],
           ['discover', 'Discover', 'M12 2a10 10 0 100 20 10 10 0 000-20zm3 7l-2 5-4 2 2-5z']]
          .map(([id, label, d]) => `
          <button data-tab="${id}" class="flex-1 py-3 flex flex-col items-center gap-1 ${memberTab === id ? 'text-ember' : 'text-ink/40'}">
            <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="${d}"/></svg>
            <span class="text-[10px] font-semibold">${label}</span>
          </button>`).join('')}
      </nav>
    </div>`;

  document.getElementById('logout').onclick = logout;
  app().querySelectorAll('[data-tab]').forEach((b) =>
    b.onclick = () => { memberTab = b.dataset.tab; renderMember(); });

  const body = document.getElementById('member-body');
  if (memberTab === 'cards') return memberCards(body);
  if (memberTab === 'scan') return memberScan(body);
  if (memberTab === 'rewards') return memberRewards(body);
  if (memberTab === 'discover') return memberDiscover(body);
}

function stampGrid(filled, total) {
  let dots = '';
  for (let i = 0; i < total; i++) {
    const on = i < filled;
    dots += `<div class="stamp-dot ${on ? 'filled' : ''} aspect-square rounded-full flex items-center justify-center text-xs font-bold ${on ? 'bg-gold text-ink shadow-inner' : 'bg-ink/5 text-ink/20 border border-dashed border-ink/15'}">${on ? '★' : i + 1}</div>`;
  }
  return `<div class="grid grid-cols-5 gap-2">${dots}</div>`;
}

async function memberCards(body) {
  body.innerHTML = `<p class="text-ink/40 text-sm py-10 text-center">Loading your cards…</p>`;
  try {
    const cards = await api('/member/cards');
    if (!cards.length) {
      body.innerHTML = `
        <div class="text-center py-16 fade-in">
          <div class="text-5xl mb-3">🎟️</div>
          <p class="font-display text-xl font-bold">No cards yet</p>
          <p class="text-ink/50 text-sm mt-1">Scan a join code or discover shops to start collecting.</p>
        </div>`;
      return;
    }
    body.innerHTML = cards.map((c) => {
      const m = c.merchant;
      const avail = c.rewards.filter((r) => r.status === 'available').length;
      return `
        <div class="fade-in bg-white rounded-3xl shadow-lg border border-ink/5 p-5 mb-4">
          <div class="flex items-center gap-3 mb-4">
            <img src="${esc(m.logoUrl)}" class="w-12 h-12 rounded-xl object-cover bg-ink/5" />
            <div class="flex-1">
              <h3 class="font-display font-bold text-lg leading-tight">${esc(m.businessName)}</h3>
              <p class="text-ink/50 text-xs">${esc(m.offerText)}</p>
            </div>
            ${avail ? `<span class="text-[10px] bg-moss text-cream px-2 py-1 rounded-full font-bold">${avail} reward${avail > 1 ? 's' : ''}</span>` : ''}
          </div>
          ${stampGrid(c.currentStampsCount, m.stampsRequired)}
          <p class="text-center text-ink/40 text-xs mt-3">${c.currentStampsCount} / ${m.stampsRequired} stamps</p>
        </div>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<p class="text-ember text-sm py-10 text-center">${esc(e.message)}</p>`;
  }
}

function memberScan(body) {
  body.innerHTML = `
    <div class="fade-in">
      <div class="bg-ink text-cream rounded-3xl p-6 mb-5 relative overflow-hidden">
        <div class="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-gold/20"></div>
        <h2 class="font-display text-2xl font-black mb-1">Earn a stamp</h2>
        <p class="text-cream/60 text-sm">Enter the code shown at the counter, or a single-use OneStamp code.</p>
      </div>

      <div class="bg-white rounded-3xl shadow-lg border border-ink/5 p-5 mb-4">
        <label class="text-xs font-semibold text-ink/50 uppercase tracking-wide">Counter stamp code</label>
        <div class="flex gap-2 mt-2">
          <input id="stampCode" placeholder="e.g. A1B2C3" class="flex-1 px-4 py-3 rounded-xl border border-ink/10 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-gold" />
          <button id="stampBtn" class="px-5 rounded-xl bg-gold text-ink font-bold">Stamp</button>
        </div>
      </div>

      <div class="bg-white rounded-3xl shadow-lg border border-ink/5 p-5">
        <label class="text-xs font-semibold text-ink/50 uppercase tracking-wide">OneStamp (single-use) <span class="text-ember">Pro</span></label>
        <div class="flex gap-2 mt-2">
          <input id="oneCode" placeholder="Unique code" class="flex-1 px-4 py-3 rounded-xl border border-ink/10 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-ember" />
          <button id="oneBtn" class="px-5 rounded-xl bg-ember text-cream font-bold">Redeem</button>
        </div>
      </div>
    </div>`;

  document.getElementById('stampBtn').onclick = async () => {
    const code = document.getElementById('stampCode').value.trim();
    if (!code) return toast('Enter a code first.', 'error');
    try {
      const r = await api('/stamp/code', { method: 'POST', body: { stampCode: code } });
      toast(r.message + ` (${r.currentStampsCount}/${r.stampsRequired})`, r.rewardEarned ? 'success' : 'info');
      document.getElementById('stampCode').value = '';
    } catch (e) { toast(e.message, 'error'); }
  };
  document.getElementById('oneBtn').onclick = async () => {
    const code = document.getElementById('oneCode').value.trim();
    if (!code) return toast('Enter a code first.', 'error');
    try {
      const r = await api('/stamp/one', { method: 'POST', body: { code } });
      toast(r.message + ` (${r.currentStampsCount}/${r.stampsRequired})`, r.rewardEarned ? 'success' : 'info');
      document.getElementById('oneCode').value = '';
    } catch (e) { toast(e.message, 'error'); }
  };
}

let activeTimer = null; // holds the interval for the live redemption countdown

async function memberRewards(body) {
  body.innerHTML = `<p class="text-ink/40 text-sm py-10 text-center">Loading rewards…</p>`;
  try {
    const rewards = await api('/member/rewards');
    if (!rewards.length) {
      body.innerHTML = `
        <div class="text-center py-16 fade-in">
          <div class="text-5xl mb-3">⭐</div>
          <p class="font-display text-xl font-bold">No rewards yet</p>
          <p class="text-ink/50 text-sm mt-1">Fill a card to unlock a voucher.</p>
        </div>`;
      return;
    }
    body.innerHTML = rewards.map((r) => `
      <div class="fade-in bg-white rounded-3xl shadow-lg border border-ink/5 p-5 mb-4" data-reward="${r.rewardId}">
        <div class="flex items-center gap-3 mb-3">
          <img src="${esc(r.merchant.logoUrl)}" class="w-11 h-11 rounded-xl object-cover bg-ink/5" />
          <div class="flex-1">
            <h3 class="font-display font-bold leading-tight">${esc(r.merchant.businessName)}</h3>
            <p class="text-ink/50 text-xs">${esc(r.merchant.offerText)}</p>
          </div>
          ${r.source === 'birthday' ? `<span class="text-base">🎂</span>` : ''}
        </div>
        <div class="bg-cream rounded-2xl p-4 flex items-center justify-between border border-dashed border-gold/40">
          <div>
            <p class="text-[10px] uppercase tracking-widest text-ink/40">Online code</p>
            <p class="font-mono font-bold text-lg tracking-wider">${esc(r.code)}</p>
          </div>
          <button data-redeem='${r.cardId}|${r.rewardId}' class="px-5 py-2.5 rounded-xl bg-ember text-cream font-bold text-sm">Redeem in store</button>
        </div>
      </div>`).join('');

    body.querySelectorAll('[data-redeem]').forEach((b) =>
      b.onclick = () => {
        const [cardId, rewardId] = b.dataset.redeem.split('|');
        startRedemption(cardId, rewardId);
      });
  } catch (e) {
    body.innerHTML = `<p class="text-ember text-sm py-10 text-center">${esc(e.message)}</p>`;
  }
}

// 3-minute in-person redemption screen with a live countdown ring.
async function startRedemption(cardId, rewardId) {
  let data;
  try {
    data = await api(`/member/rewards/${cardId}/${rewardId}/redeem`, { method: 'POST' });
  } catch (e) { return toast(e.message, 'error'); }

  const total = data.windowMs;
  let remaining = data.remainingMs;
  const R = 86, CIRC = 2 * Math.PI * R;

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 bg-ink/95 backdrop-blur flex items-center justify-center p-6 fade-in';
  overlay.innerHTML = `
    <div class="text-center text-cream max-w-sm w-full">
      <p class="uppercase tracking-[0.3em] text-gold text-xs mb-2">Show this to staff</p>
      <h2 class="font-display text-3xl font-black mb-6">Redeeming…</h2>
      <div class="relative inline-flex items-center justify-center mb-6">
        <svg width="200" height="200" class="-rotate-90">
          <circle cx="100" cy="100" r="${R}" stroke="rgba(244,239,230,0.12)" stroke-width="10" fill="none"/>
          <circle id="ring" cx="100" cy="100" r="${R}" stroke="#c9a227" stroke-width="10" fill="none"
            stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="0" class="ring-timer"/>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span id="clock" class="font-display text-4xl font-black">3:00</span>
          <span class="text-cream/50 text-xs">remaining</span>
        </div>
      </div>
      <div class="bg-cream/10 rounded-2xl p-4 mb-6 border border-cream/10">
        <p class="text-[10px] uppercase tracking-widest text-cream/40">Voucher code</p>
        <p class="font-mono font-bold text-xl tracking-wider">${esc(data.code)}</p>
      </div>
      <div class="flex gap-3">
        <button id="cancel" class="flex-1 py-3 rounded-xl bg-cream/10 text-cream font-semibold">Close</button>
        <button id="confirm" class="flex-1 py-3 rounded-xl bg-moss text-cream font-bold">Staff confirm</button>
      </div>
      <p class="text-cream/40 text-xs mt-4">Voucher expires when the timer ends.</p>
    </div>`;
  document.body.appendChild(overlay);

  const ring = overlay.querySelector('#ring');
  const clock = overlay.querySelector('#clock');

  function paintTimer() {
    const secs = Math.max(0, Math.ceil(remaining / 1000));
    clock.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const frac = remaining / total;
    ring.style.strokeDashoffset = String(CIRC * (1 - frac));
  }
  paintTimer();

  if (activeTimer) clearInterval(activeTimer);
  activeTimer = setInterval(() => {
    remaining -= 1000;
    paintTimer();
    if (remaining <= 0) {
      clearInterval(activeTimer);
      activeTimer = null;
      clock.textContent = '0:00';
      toast('Voucher expired.', 'error');
      close();
    }
  }, 1000);

  function close() {
    if (activeTimer) { clearInterval(activeTimer); activeTimer = null; }
    overlay.remove();
    renderMember();
  }

  overlay.querySelector('#cancel').onclick = close;
  overlay.querySelector('#confirm').onclick = async () => {
    try {
      await api(`/member/rewards/${cardId}/${rewardId}/confirm`, { method: 'POST' });
      toast('Reward redeemed. Enjoy!', 'success');
    } catch (e) { toast(e.message, 'error'); }
    close();
  };
}

async function memberDiscover(body) {
  body.innerHTML = `
    <div class="fade-in">
      <div class="flex gap-2 mb-4">
        <input id="search" placeholder="Search shops…" class="flex-1 px-4 py-3 rounded-xl border border-ink/10 bg-white focus:outline-none focus:ring-2 focus:ring-gold" />
        <button id="searchBtn" class="px-5 rounded-xl bg-ink text-cream font-semibold">Go</button>
      </div>
      <div class="bg-white rounded-2xl border border-ink/5 p-4 mb-4 flex gap-2">
        <input id="joinCode" placeholder="Have a join code?" class="flex-1 px-3 py-2 rounded-lg border border-ink/10 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-gold" />
        <button id="joinBtn" class="px-4 rounded-lg bg-gold text-ink font-bold text-sm">Join</button>
      </div>
      <div id="results"></div>
    </div>`;

  const results = document.getElementById('results');
  async function load(q = '') {
    results.innerHTML = `<p class="text-ink/40 text-sm py-6 text-center">Loading…</p>`;
    try {
      const list = await api('/member/merchants' + (q ? `?search=${encodeURIComponent(q)}` : ''));
      results.innerHTML = list.length ? list.map((m) => `
        <div class="bg-white rounded-2xl shadow border border-ink/5 p-4 mb-3 flex items-center gap-3">
          <img src="${esc(m.logoUrl)}" class="w-11 h-11 rounded-xl object-cover bg-ink/5" />
          <div class="flex-1">
            <h3 class="font-display font-bold leading-tight">${esc(m.businessName)}</h3>
            <p class="text-ink/50 text-xs">${esc(m.offerText)}</p>
          </div>
          <button data-join="${esc(m.joinCode)}" class="px-4 py-2 rounded-lg bg-gold text-ink font-bold text-sm">Join</button>
        </div>`).join('') : `<p class="text-ink/40 text-sm py-6 text-center">No shops found.</p>`;
      results.querySelectorAll('[data-join]').forEach((b) =>
        b.onclick = () => doJoin(b.dataset.join));
    } catch (e) { results.innerHTML = `<p class="text-ember text-sm py-6 text-center">${esc(e.message)}</p>`; }
  }
  async function doJoin(code) {
    try {
      const r = await api('/member/join', { method: 'POST', body: { joinCode: code } });
      toast(r.message || 'Joined!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }
  document.getElementById('searchBtn').onclick = () => load(document.getElementById('search').value.trim());
  document.getElementById('joinBtn').onclick = () => {
    const c = document.getElementById('joinCode').value.trim();
    if (c) doJoin(c);
  };
  load();
}

/* ===================== MERCHANT (DESKTOP) DASHBOARD ===================== */
let merchantTab = 'overview';

async function renderMerchant() {
  app().innerHTML = `
    <div class="min-h-screen flex">
      <aside class="w-60 bg-ink text-cream flex flex-col py-6 px-4 sticky top-0 h-screen">
        <div class="flex items-center gap-2 px-2 mb-8">
          <div class="w-9 h-9 rounded-lg bg-gold text-ink grid place-items-center font-display font-black text-xl">S</div>
          <span class="font-display font-black text-xl">Stampr</span>
        </div>
        <nav class="flex-1 space-y-1">
          ${[['overview', 'Overview'], ['members', 'Members'], ['offer', 'Offer & Codes'], ['onestamps', 'OneStamps'], ['marketing', 'Marketing']]
            .map(([id, l]) => `<button data-mtab="${id}" class="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium ${merchantTab === id ? 'bg-gold text-ink' : 'text-cream/60 hover:bg-cream/10'}">${l}</button>`).join('')}
        </nav>
        <div class="px-2 text-xs text-cream/40 mb-3">${esc(store.user.name)}</div>
        <button id="logout" class="w-full px-3 py-2 rounded-xl bg-cream/10 text-cream/80 text-sm hover:bg-cream/20">Log out</button>
      </aside>
      <main id="merchant-body" class="flex-1 p-8 overflow-y-auto"></main>
    </div>`;

  document.getElementById('logout').onclick = logout;
  app().querySelectorAll('[data-mtab]').forEach((b) =>
    b.onclick = () => { merchantTab = b.dataset.mtab; renderMerchant(); });

  const body = document.getElementById('merchant-body');
  if (merchantTab === 'overview') return merchantOverview(body);
  if (merchantTab === 'members') return merchantMembers(body);
  if (merchantTab === 'offer') return merchantOffer(body);
  if (merchantTab === 'onestamps') return merchantOneStamps(body);
  if (merchantTab === 'marketing') return merchantMarketing(body);
}

function statCard(label, value, accent) {
  return `<div class="bg-white rounded-2xl border border-ink/5 shadow-sm p-5">
    <p class="text-ink/40 text-xs uppercase tracking-wide">${label}</p>
    <p class="font-display text-4xl font-black mt-1" style="color:${accent}">${value}</p>
  </div>`;
}

async function merchantOverview(body) {
  body.innerHTML = `<p class="text-ink/40">Loading dashboard…</p>`;
  try {
    const a = await api('/merchant/analytics');
    body.innerHTML = `
      <div class="fade-in">
        <h1 class="font-display text-3xl font-black mb-1">Dashboard</h1>
        <p class="text-ink/50 mb-6">Real-time loyalty activity.</p>
        <div class="grid grid-cols-3 gap-4 mb-8">
          ${statCard('Members', a.totalMembers, '#3f5d4b')}
          ${statCard('Stamps given', a.totalStamps, '#c9a227')}
          ${statCard('Rewards redeemed', a.totalRedemptions, '#d4663a')}
        </div>
        <div class="grid grid-cols-3 gap-4 mb-8">
          <div class="bg-ink text-cream rounded-2xl p-5">
            <p class="text-cream/50 text-xs uppercase tracking-wide">Join code</p>
            <p class="font-mono font-black text-2xl tracking-widest mt-1 text-gold">${esc(a.joinCode)}</p>
            <p class="text-cream/40 text-xs mt-2 break-all">${location.origin}/join/${esc(a.joinCode)}</p>
          </div>
          <div class="bg-white rounded-2xl border border-ink/5 p-5">
            <p class="text-ink/40 text-xs uppercase tracking-wide">Counter stamp code</p>
            <p class="font-mono font-black text-2xl tracking-widest mt-1">${esc(a.stampCode)}</p>
            <p class="text-ink/40 text-xs mt-2">Members enter this to earn a stamp.</p>
          </div>
          <div class="bg-white rounded-2xl border border-ink/5 p-5">
            <p class="text-ink/40 text-xs uppercase tracking-wide">Current offer</p>
            <p class="font-display font-bold text-lg mt-1">${esc(a.offerText)}</p>
            <p class="text-ink/40 text-xs mt-2">${a.stampsRequired} stamps required</p>
          </div>
        </div>
        <h2 class="font-display text-xl font-bold mb-3">Recent activity</h2>
        <div class="bg-white rounded-2xl border border-ink/5 overflow-hidden">
          ${a.recentActivity.length ? a.recentActivity.map((t) => `
            <div class="flex items-center justify-between px-5 py-3 border-b border-ink/5 last:border-0">
              <div class="flex items-center gap-3">
                <span class="w-2 h-2 rounded-full" style="background:${t.type === 'redeem' || t.type === 'birthday_reward' ? '#d4663a' : t.type === 'join' ? '#3f5d4b' : '#c9a227'}"></span>
                <span class="text-sm font-medium">${esc(t.user)}</span>
                <span class="text-ink/40 text-xs">${esc(t.detail)}</span>
              </div>
              <span class="text-ink/30 text-xs">${new Date(t.at).toLocaleString()}</span>
            </div>`).join('') : `<p class="text-ink/40 text-sm p-5">No activity yet.</p>`}
        </div>
      </div>`;
  } catch (e) { body.innerHTML = `<p class="text-ember">${esc(e.message)}</p>`; }
}

async function merchantMembers(body) {
  body.innerHTML = `<p class="text-ink/40">Loading members…</p>`;
  try {
    const members = await api('/merchant/members');
    body.innerHTML = `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-6">
          <div><h1 class="font-display text-3xl font-black">Members</h1><p class="text-ink/50">${members.length} enrolled</p></div>
          <button id="addBtn" class="px-4 py-2.5 rounded-xl bg-ember text-cream font-semibold">+ Add member</button>
        </div>
        <div class="bg-white rounded-2xl border border-ink/5 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-ink/5 text-ink/50 text-xs uppercase tracking-wide">
              <tr><th class="text-left px-5 py-3">Name</th><th class="text-left px-5 py-3">Email</th><th class="px-5 py-3">Stamps</th><th class="px-5 py-3">Rewards</th><th class="px-5 py-3"></th></tr>
            </thead>
            <tbody>
              ${members.length ? members.map((m) => `
                <tr class="border-b border-ink/5 last:border-0">
                  <td class="px-5 py-3 font-medium">${esc(m.name)}</td>
                  <td class="px-5 py-3 text-ink/50">${esc(m.email)}</td>
                  <td class="px-5 py-3 text-center">${m.currentStampsCount}</td>
                  <td class="px-5 py-3 text-center">${m.availableRewards}</td>
                  <td class="px-5 py-3 text-right"><button data-stamp="${m.userId}" class="px-3 py-1.5 rounded-lg bg-gold text-ink font-bold text-xs">+ Stamp</button></td>
                </tr>`).join('') : `<tr><td colspan="5" class="text-ink/40 text-center py-6">No members yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;

    body.querySelectorAll('[data-stamp]').forEach((b) =>
      b.onclick = async () => {
        try {
          const r = await api('/merchant/stamp', { method: 'POST', body: { userId: b.dataset.stamp } });
          toast(r.message, r.rewardEarned ? 'success' : 'info');
          merchantMembers(body);
        } catch (e) { toast(e.message, 'error'); }
      });

    document.getElementById('addBtn').onclick = () => addMemberModal(body);
  } catch (e) { body.innerHTML = `<p class="text-ember">${esc(e.message)}</p>`; }
}

function addMemberModal(body) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-6 fade-in';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-full max-w-md">
      <h3 class="font-display text-xl font-bold mb-4">Add member</h3>
      <form id="addForm" class="space-y-3">
        <input name="name" placeholder="Name" class="w-full px-4 py-3 rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold" />
        <input name="email" type="email" required placeholder="Email" class="w-full px-4 py-3 rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold" />
        <input name="birthday" type="date" class="w-full px-4 py-3 rounded-xl border border-ink/10 text-ink/60 focus:outline-none focus:ring-2 focus:ring-gold" />
        <div class="flex gap-3 pt-2">
          <button type="button" id="cancel" class="flex-1 py-3 rounded-xl bg-ink/5 font-semibold">Cancel</button>
          <button type="submit" class="flex-1 py-3 rounded-xl bg-ember text-cream font-bold">Add</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.querySelector('#addForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    try {
      const r = await api('/merchant/members', { method: 'POST', body: fd });
      toast(r.message, 'success');
      overlay.remove();
      merchantMembers(body);
    } catch (err) { toast(err.message, 'error'); }
  };
}

async function merchantOffer(body) {
  body.innerHTML = `<p class="text-ink/40">Loading…</p>`;
  try {
    const m = await api('/merchant/profile');
    body.innerHTML = `
      <div class="fade-in max-w-2xl">
        <h1 class="font-display text-3xl font-black mb-6">Offer & Codes</h1>
        <form id="offerForm" class="bg-white rounded-2xl border border-ink/5 p-6 space-y-4">
          <div><label class="text-xs font-semibold text-ink/50 uppercase">Business name</label>
            <input name="businessName" value="${esc(m.businessName)}" class="w-full mt-1 px-4 py-3 rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold" /></div>
          <div><label class="text-xs font-semibold text-ink/50 uppercase">Logo URL</label>
            <input name="logoUrl" value="${esc(m.logoUrl)}" class="w-full mt-1 px-4 py-3 rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold" /></div>
          <div><label class="text-xs font-semibold text-ink/50 uppercase">Location</label>
            <input name="location" value="${esc(m.location)}" class="w-full mt-1 px-4 py-3 rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold" /></div>
          <div><label class="text-xs font-semibold text-ink/50 uppercase">Offer text</label>
            <input name="offerText" value="${esc(m.offerText)}" class="w-full mt-1 px-4 py-3 rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold" /></div>
          <div><label class="text-xs font-semibold text-ink/50 uppercase">Stamps required</label>
            <input name="stampsRequired" type="number" min="2" value="${m.stampsRequired}" class="w-full mt-1 px-4 py-3 rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold" /></div>
          <label class="flex items-center gap-3 pt-2">
            <input type="checkbox" name="birthdayClubEnabled" ${m.birthdayClubEnabled ? 'checked' : ''} class="w-5 h-5 accent-ember" />
            <span class="text-sm font-medium">Enable Birthday Club 🎂</span>
          </label>
          <button type="submit" class="w-full py-3 rounded-xl bg-ember text-cream font-bold">Save changes</button>
        </form>
      </div>`;
    document.getElementById('offerForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const payload = {
        businessName: f.businessName.value,
        logoUrl: f.logoUrl.value,
        location: f.location.value,
        offerText: f.offerText.value,
        stampsRequired: Number(f.stampsRequired.value),
        birthdayClubEnabled: f.birthdayClubEnabled.checked,
      };
      try {
        await api('/merchant/profile', { method: 'PUT', body: payload });
        toast('Offer updated.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    };
  } catch (e) { body.innerHTML = `<p class="text-ember">${esc(e.message)}</p>`; }
}

async function merchantOneStamps(body) {
  async function load() {
    body.innerHTML = `<p class="text-ink/40">Loading…</p>`;
    try {
      const codes = await api('/merchant/onestamps');
      body.innerHTML = `
        <div class="fade-in">
          <div class="flex items-center justify-between mb-6">
            <div><h1 class="font-display text-3xl font-black">OneStamps</h1><p class="text-ink/50">Single-use codes. Each works once.</p></div>
            <div class="flex gap-2">
              <input id="qty" type="number" min="1" max="100" value="5" class="w-20 px-3 py-2.5 rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-ember" />
              <button id="genBtn" class="px-4 py-2.5 rounded-xl bg-ember text-cream font-semibold">Generate</button>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            ${codes.length ? codes.map((c) => `
              <div class="bg-white rounded-xl border ${c.isUsed ? 'border-ink/10 opacity-50' : 'border-ember/30'} p-4">
                <p class="font-mono font-bold tracking-wider text-sm break-all">${esc(c.code)}</p>
                <p class="text-xs mt-1 ${c.isUsed ? 'text-ink/40' : 'text-moss'}">${c.isUsed ? 'Used' : 'Available'}</p>
              </div>`).join('') : `<p class="text-ink/40 col-span-3 text-center py-6">No codes generated yet.</p>`}
          </div>
        </div>`;
      document.getElementById('genBtn').onclick = async () => {
        try {
          const qty = Number(document.getElementById('qty').value) || 1;
          const r = await api('/merchant/onestamps', { method: 'POST', body: { quantity: qty } });
          toast(r.message, 'success');
          load();
        } catch (e) { toast(e.message, 'error'); }
      };
    } catch (e) { body.innerHTML = `<p class="text-ember">${esc(e.message)}</p>`; }
  }
  load();
}

async function merchantMarketing(body) {
  body.innerHTML = `
    <div class="fade-in max-w-2xl">
      <h1 class="font-display text-3xl font-black mb-6">Marketing</h1>
      <div class="bg-white rounded-2xl border border-ink/5 p-6 mb-5">
        <h2 class="font-display text-xl font-bold mb-1">Broadcast a message</h2>
        <p class="text-ink/50 text-sm mb-4">Simulate a push notification or SMS to all members.</p>
        <div class="flex gap-2 mb-3">
          <select id="channel" class="px-4 py-3 rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold">
            <option value="push">Push</option><option value="sms">SMS</option><option value="email">Email</option>
          </select>
          <input id="msg" placeholder="Your message…" class="flex-1 px-4 py-3 rounded-xl border border-ink/10 focus:outline-none focus:ring-2 focus:ring-gold" />
        </div>
        <button id="sendBtn" class="px-5 py-3 rounded-xl bg-ink text-cream font-semibold">Send broadcast</button>
      </div>
      <div class="bg-white rounded-2xl border border-ink/5 p-6">
        <h2 class="font-display text-xl font-bold mb-1">Birthday Club 🎂</h2>
        <p class="text-ink/50 text-sm mb-4">Run the birthday check to issue vouchers to members celebrating today. (Enable the club under Offer & Codes.)</p>
        <button id="bdayBtn" class="px-5 py-3 rounded-xl bg-ember text-cream font-semibold">Run birthday check</button>
      </div>
    </div>`;

  document.getElementById('sendBtn').onclick = async () => {
    const message = document.getElementById('msg').value.trim();
    const channel = document.getElementById('channel').value;
    if (!message) return toast('Enter a message.', 'error');
    try {
      const r = await api('/merchant/broadcast', { method: 'POST', body: { channel, message } });
      toast(r.message, 'success');
      document.getElementById('msg').value = '';
    } catch (e) { toast(e.message, 'error'); }
  };
  document.getElementById('bdayBtn').onclick = async () => {
    try {
      const r = await api('/merchant/birthday-run', { method: 'POST' });
      toast(r.message, 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
}

/* ===================== BOOT ===================== */
route();
