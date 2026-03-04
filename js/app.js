// ── Navigation ──
const SCREENS = {
  home:     { el: document.getElementById('screen-home'),     title: null },
  cooldown: { el: document.getElementById('screen-cooldown'), title: 'COOLDOWN' },
  range:    { el: document.getElementById('screen-range'),    title: 'RANGE CALC' },
};
const toolCards  = document.querySelectorAll('.tool-card[data-screen]');
const topbarBack = document.getElementById('topbar-back');
const topbarScreenName = document.getElementById('topbar-screen-name');
const topbarLogo = document.getElementById('topbar-logo');
let currentScreen = 'home';

function goTo(name) {
  if (!SCREENS[name]) return;
  SCREENS[currentScreen].el.classList.remove('active');
  SCREENS[name].el.classList.add('active');
  currentScreen = name;

  const isHome = name === 'home';
  topbarBack.classList.toggle('visible', !isHome);
  topbarScreenName.classList.toggle('visible', !isHome);
  topbarLogo.style.opacity = isHome ? '1' : '0.5';
  topbarScreenName.textContent = SCREENS[name].title || '';

  SCREENS[name].el.scrollTop = 0;
}

toolCards.forEach(c => c.addEventListener('click', () => goTo(c.dataset.screen)));
topbarBack.addEventListener('click', () => goTo('home'));

// ── Cooldown Timer ──
const BUBBLE_SIZE = 76;
const C = 2 * Math.PI * 36;

let timers = JSON.parse(localStorage.getItem('xm-timers3') || '[]');
let selectedDur = 30;
const bubbleMap = {};

// Duration buttons
const durScroll = document.getElementById('dur-scroll');
for (let s = 30; s <= 300; s += 10) {
  const btn = document.createElement('button');
  btn.className = 'dur-btn' + (s === selectedDur ? ' selected' : '');
  btn.dataset.dur = s;
  btn.textContent = `${s}s`;
  durScroll.appendChild(btn);
  btn.addEventListener('click', () => {
    durScroll.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedDur = s;
  });
}

// Add timer
document.getElementById('add-btn').addEventListener('click', addTimer);
document.getElementById('portal-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTimer();
});

function addTimer() {
  // Request notification permission on user gesture (required for iOS PWA)
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  const input = document.getElementById('portal-name-input');
  const name = input.value.trim() || `Portal ${timers.length + 1}`;
  const t = { id: Date.now(), name, startedAt: Date.now(), duration: selectedDur * 1000, hacks: 1 };
  timers.push(t);
  input.value = '';
  save();
  spawnBubble(t);
  scheduleNotification(t);
  updateHint();
}

function removeTimer(id) {
  timers = timers.filter(t => t.id !== id);
  if (bubbleMap[id]) { bubbleMap[id].remove(); delete bubbleMap[id]; }
  cancelNotification(id);
  save();
  updateHint();
}

function save() { localStorage.setItem('xm-timers3', JSON.stringify(timers)); }

function updateHint() {
  document.getElementById('hint').textContent = timers.length === 0
          ? 'Each portal gets its own floating bubble'
          : `${timers.length} portal${timers.length > 1 ? 's' : ''} tracked — drag bubbles anywhere`;
}

// ── Spawn bubble ──
function spawnBubble(t) {
  const el = document.createElement('div');
  el.className = 'portal-bubble';

  const existingCount = Object.keys(bubbleMap).length;
  const rowsPerCol = Math.max(1, Math.floor((window.innerHeight - 100) / 88));
  const col = Math.floor(existingCount / rowsPerCol);
  const row = existingCount % rowsPerCol;
  const x = window.innerWidth - BUBBLE_SIZE - 12 - col * (BUBBLE_SIZE + 10);
  const y = 80 + row * 88;
  el.style.left = Math.max(0, x) + 'px';
  el.style.top = Math.min(y, window.innerHeight - BUBBLE_SIZE - 10) + 'px';

  el.innerHTML = `
    <svg class="pb-ring" viewBox="0 0 84 84">
      <circle cx="42" cy="42" r="36" fill="none" stroke="rgba(0,229,255,0.1)" stroke-width="3"/>
      <circle class="pb-arc" cx="42" cy="42" r="36" fill="none" stroke="var(--enl)" stroke-width="3"
        stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}"
        style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1s linear,stroke 0.3s;filter:drop-shadow(0 0 4px currentColor)"/>
    </svg>
    <div class="pb-time">--s</div>
    <div class="pb-name">${escHtml(t.name)}</div>
    <div class="pb-hack-count">HACK 1</div>
    <button class="pb-delete" data-id="${t.id}">✕</button>
  `;

  el.querySelector('.pb-delete').addEventListener('pointerdown', e => e.stopPropagation());
  el.querySelector('.pb-delete').addEventListener('click', e => {
    e.stopPropagation();
    removeTimer(t.id);
  });

  el.addEventListener('click', () => {
    if (el._wasDragged) { el._wasDragged = false; return; }
    const timerObj = timers.find(x => x.id === t.id);
    if (!timerObj) return;
    const now = Date.now();
    const isDone = (now - timerObj.startedAt) >= timerObj.duration;
    if (isDone) {
      timerObj.startedAt = now;
      prevDoneIds.delete(timerObj.id);
      scheduleNotification(timerObj);
    } else {
      timerObj.hacks = (timerObj.hacks || 1) + 1;
      timerObj.startedAt = now - timerObj.duration;
      prevDoneIds.add(timerObj.id);
      cancelNotification(timerObj.id);
    }
    save();
    tick();
  });

  makeDraggable(el);
  document.body.appendChild(el);
  bubbleMap[t.id] = el;
}

function makeDraggable(el) {
  let active = false, sx, sy, ex, ey;
  el._wasDragged = false;

  el.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('pb-delete')) return;
    active = true; el._wasDragged = false;
    const r = el.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; ex = r.left; ey = r.top;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';
    el.style.animation = 'none';
    el.style.transition = 'none';
  });

  el.addEventListener('pointermove', e => {
    if (!active) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) el._wasDragged = true;
    if (el._wasDragged) {
      el.style.left = Math.max(0, Math.min(ex+dx, window.innerWidth-BUBBLE_SIZE)) + 'px';
      el.style.top  = Math.max(0, Math.min(ey+dy, window.innerHeight-BUBBLE_SIZE)) + 'px';
    }
  });

  el.addEventListener('pointerup', () => {
    if (!active) return;
    active = false;
    el.style.cursor = 'grab';
    el.style.animation = '';
    el.style.transition = '';
    if (el._wasDragged) {
      const r = el.getBoundingClientRect();
      el.style.left = (r.left < window.innerWidth/2 ? 10 : window.innerWidth - BUBBLE_SIZE - 10) + 'px';
    }
  });
}

// ── Toast / vibrate / notify ──
const toast = document.getElementById('done-toast');
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3000);
}
function vibrate() { if (navigator.vibrate) navigator.vibrate([200,100,200]); }

// ── SW-based notification scheduling ──
function swPost(msg) {
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(msg);
  }
}

function scheduleNotification(t) {
  const remaining = t.duration - (Date.now() - t.startedAt);
  if (remaining <= 0) return;
  swPost({
    type: 'schedule',
    id: t.id,
    name: t.name,
    hacks: (t.hacks || 1) + 1,
    delay: remaining,
  });
}

function cancelNotification(id) {
  swPost({ type: 'cancel', id });
}

// ── Main tick ──
let prevDoneIds = new Set(
        timers.filter(t => Date.now() - t.startedAt >= t.duration).map(t => t.id)
);

function tick() {
  const now = Date.now();
  timers.forEach(t => {
    const el = bubbleMap[t.id];
    if (!el) return;

    const remaining = Math.max(0, t.duration - (now - t.startedAt));
    const pct = Math.min(1, (now - t.startedAt) / t.duration);
    const isDone = remaining === 0;
    const isWarn = !isDone && remaining <= 10000;
    const color = isDone ? 'var(--xm)' : isWarn ? 'var(--warn)' : 'var(--enl)';

    el.querySelector('.pb-arc').style.strokeDashoffset = (C * (1 - pct)).toFixed(2);
    el.querySelector('.pb-arc').style.stroke = color;
    el.querySelector('.pb-time').textContent = isDone ? '✓' : `${Math.ceil(remaining/1000)}s`;
    el.querySelector('.pb-time').style.color = color;
    el.className = 'portal-bubble' + (isDone ? ' done' : isWarn ? ' warning' : '');

    const hackEl = el.querySelector('.pb-hack-count');
    if (hackEl) {
      hackEl.textContent = `HACK ${t.hacks || 1}`;
      hackEl.className = 'pb-hack-count' + (isDone ? ' done-count' : '');
    }

    if (isDone && !prevDoneIds.has(t.id)) {
      t.hacks = (t.hacks || 1) + 1;
      save();
      showToast(`⚡ ${t.name} READY — HACK ${t.hacks}`);
      vibrate();
    }
  });

  prevDoneIds = new Set(
          timers.filter(t => Date.now() - t.startedAt >= t.duration).map(t => t.id)
  );
}

// ── Init ──
timers.forEach(t => { if (!t.hacks) t.hacks = 1; spawnBubble(t); });
updateHint();
setInterval(tick, 1000);
tick();

// Schedule SW notifications for any running timers (handles app restart)
navigator.serviceWorker && navigator.serviceWorker.ready.then(() => {
  timers.forEach(t => scheduleNotification(t));
});

// ── Range Calculator ──
const RESO_COLORS = ['','#fece5a','#ffa630','#ff7315','#e40000','#fd2992','#eb26cd','#c124e0','#9627f4'];
const AMP_MULT = { none:0, rla:2, sbul:5, vrla:7 };
const AMP_STACK = [1.0, 0.25, 0.125, 0.125];
const AMP_LABELS = { none:'NONE', rla:'RLA', sbul:'SBUL', vrla:'VRLA' };

let resoLevels = [8,7,6,6,5,5,4,4];
let ampTypes = ['none','none','none','none'];
let activeResoSlot = null;
let activeAmpSlot = null;

const resoGrid = document.getElementById('reso-grid');
const resoPicker = document.getElementById('reso-level-picker');
const ampSlotsEl = document.getElementById('amp-slots');
const ampPicker = document.getElementById('amp-type-picker');
const rangeValue = document.getElementById('range-value');

function calcRange() {
  const avg = resoLevels.reduce((a,b) => a+b, 0) / 8;
  const base = 160 * Math.pow(avg, 4);

  const mults = ampTypes.map(t => AMP_MULT[t]).filter(m => m > 0).sort((a,b) => b-a);
  let ampMult = 1;
  if (mults.length) {
    let bonus = 0;
    mults.forEach((m, i) => { bonus += m * AMP_STACK[i]; });
    ampMult = bonus;
  }

  const range = Math.round(base * ampMult);
  rangeValue.textContent = (range / 1000).toFixed(2) + ' km';

  updateResoUI();
  updateAmpUI();
}

function updateResoUI() {
  resoGrid.querySelectorAll('.reso-slot').forEach((slot, i) => {
    const lvl = resoLevels[i];
    slot.classList.toggle('active', activeResoSlot === i);
    const levelEl = slot.querySelector('.reso-level');
    levelEl.textContent = lvl;
    levelEl.style.color = RESO_COLORS[lvl];
    slot.querySelector('.reso-sprite').style.backgroundColor = RESO_COLORS[lvl];
  });
  resoPicker.querySelectorAll('.reso-lvl-btn').forEach(btn => {
    const lvl = parseInt(btn.dataset.lvl);
    btn.style.color = RESO_COLORS[lvl];
    btn.style.borderColor = RESO_COLORS[lvl];
    btn.classList.toggle('selected', activeResoSlot !== null && resoLevels[activeResoSlot] === lvl);
  });
}

function updateAmpUI() {
  ampSlotsEl.querySelectorAll('.amp-slot').forEach((slot, i) => {
    const type = ampTypes[i];
    slot.dataset.aval = type;
    slot.classList.toggle('active', activeAmpSlot === i);
    slot.querySelector('.amp-type').textContent = AMP_LABELS[type];
  });
  ampPicker.querySelectorAll('.amp-pick-btn').forEach(btn => {
    btn.classList.toggle('selected', activeAmpSlot !== null && ampTypes[activeAmpSlot] === btn.dataset.atype);
  });
}

resoGrid.addEventListener('click', e => {
  const slot = e.target.closest('.reso-slot');
  if (!slot) return;
  const idx = parseInt(slot.dataset.slot);
  if (activeResoSlot === idx) {
    activeResoSlot = null;
    resoPicker.classList.remove('visible');
  } else {
    activeResoSlot = idx;
    activeAmpSlot = null;
    resoPicker.classList.add('visible');
    ampPicker.classList.remove('visible');
  }
  calcRange();
});

resoPicker.addEventListener('click', e => {
  const btn = e.target.closest('.reso-lvl-btn');
  if (!btn || activeResoSlot === null) return;
  resoLevels[activeResoSlot] = parseInt(btn.dataset.lvl);
  calcRange();
});

ampSlotsEl.addEventListener('click', e => {
  const slot = e.target.closest('.amp-slot');
  if (!slot) return;
  const idx = parseInt(slot.dataset.amp);
  if (activeAmpSlot === idx) {
    activeAmpSlot = null;
    ampPicker.classList.remove('visible');
  } else {
    activeAmpSlot = idx;
    activeResoSlot = null;
    ampPicker.classList.add('visible');
    resoPicker.classList.remove('visible');
  }
  calcRange();
});

ampPicker.addEventListener('click', e => {
  const btn = e.target.closest('.amp-pick-btn');
  if (!btn || activeAmpSlot === null) return;
  ampTypes[activeAmpSlot] = btn.dataset.atype;
  calcRange();
});

calcRange();

const versionTag = document.getElementById('version-tag');
if (versionTag && typeof APP_VERSION !== 'undefined') versionTag.textContent = `v${APP_VERSION}`;

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Android PWA install prompt ──
let deferredInstallPrompt = null;
const installBanner = document.getElementById('install-banner');
const installBtn = document.getElementById('install-btn');
const installDismiss = document.getElementById('install-dismiss');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const dismissed = localStorage.getItem('install-dismissed');
  if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
    setTimeout(() => installBanner.classList.add('show'), 1500);
  }
});

installBtn.addEventListener('click', async () => {
  installBanner.classList.remove('show');
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  }
});

installDismiss.addEventListener('click', () => {
  installBanner.classList.remove('show');
  localStorage.setItem('install-dismissed', Date.now().toString());
});

window.addEventListener('appinstalled', () => {
  installBanner.classList.remove('show');
  deferredInstallPrompt = null;
});

// ── Service worker ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
          .catch(() => {});
}

// ── Wake lock ──
async function requestWakeLock() {
  try { if ('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch {}
}
requestWakeLock();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { requestWakeLock(); tick(); }
});

