// ── Navigation ──
const SCREENS = {
  home:     { el: document.getElementById('screen-home'),     title: null },
  cooldown: { el: document.getElementById('screen-cooldown'), title: 'COOLDOWN' },
  range:    { el: document.getElementById('screen-range'),    title: 'RANGE CALC' },
  drone:    { el: document.getElementById('screen-drone'),    title: 'DRONE' },
  settings: { el: document.getElementById('screen-settings'), title: 'SETTINGS' },
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
  const input = document.getElementById('portal-name-input');
  const name = input.value.trim() || `Portal ${timers.length + 1}`;
  const t = { id: Date.now(), name, startedAt: Date.now(), duration: selectedDur * 1000, hacks: 1 };
  timers.push(t);
  input.value = '';
  save();
  spawnBubble(t);
  if (sysNotifEnabled) scheduleNotification(t);
  sendNtfyNotification(t.id, t.name, (t.hacks || 1) + 1, Math.round(t.duration / 1000));
  updateHint();
}

function removeTimer(id) {
  timers = timers.filter(t => t.id !== id);
  if (bubbleMap[id]) { bubbleMap[id].remove(); delete bubbleMap[id]; }
  cancelNotification(id);
  cancelNtfyNotification(id);
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
      if (sysNotifEnabled) scheduleNotification(timerObj);
      sendNtfyNotification(timerObj.id, timerObj.name, (timerObj.hacks || 1) + 1, Math.round(timerObj.duration / 1000));
    } else {
      timerObj.hacks = (timerObj.hacks || 1) + 1;
      timerObj.startedAt = now - timerObj.duration;
      prevDoneIds.add(timerObj.id);
      cancelNotification(timerObj.id);
      cancelNtfyNotification(timerObj.id);
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

// ── Drone state (declared early so tick() can call updateDroneUI) ──
const DRONE_ARC_C = 2 * Math.PI * 62;
let droneState = { lastHack: null, hacks: 0 };
let droneConfig = { cooldown: 60, idleAfter: 4, idleRepeat: 8 };

function loadDroneState() {
  try { const d = JSON.parse(localStorage.getItem('xm-drone')); if (d) droneState = d; } catch {}
}
function saveDroneState() { localStorage.setItem('xm-drone', JSON.stringify(droneState)); }
function loadDroneConfig() {
  try { const d = JSON.parse(localStorage.getItem('xm-drone-config')); if (d) droneConfig = d; } catch {}
}
function saveDroneConfig() { localStorage.setItem('xm-drone-config', JSON.stringify(droneConfig)); }

loadDroneState();
loadDroneConfig();

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
  updateDroneUI();
}

// ── Init ──
timers.forEach(t => { if (!t.hacks) t.hacks = 1; spawnBubble(t); });
updateHint();
setInterval(tick, 1000);
tick();

// Schedule SW notifications for any running timers (handles app restart)
navigator.serviceWorker && navigator.serviceWorker.ready.then(() => {
  if (sysNotifEnabled) timers.forEach(t => scheduleNotification(t));
  // Reschedule drone ready notification if still cooling
  if (droneState.lastHack) {
    const droneRemaining = (droneConfig.cooldown * 60 * 1000) - (Date.now() - droneState.lastHack);
    if (droneRemaining > 0 && sysNotifEnabled) {
      swPost({ type: 'schedule', id: 'drone-ready', name: 'Drone', hacks: 0, delay: droneRemaining,
        customTitle: 'XM Toolkit', customBody: '\u{1F6F8} DRONE READY \u2014 HACK NOW' });
    }
  }
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

// ── Drone Tracker ──
function cancelDroneNotifications() {
  swPost({ type: 'cancel', id: 'drone-ready' });
  ['drone-ready','drone-idle-1','drone-idle-2','drone-idle-3'].forEach(mid => {
    if (!ntfyConfig.enabled || !ntfyConfig.topic) return;
    fetch(`${ntfyConfig.server}/${ntfyConfig.topic}/${mid}`, {
      method: 'DELETE', headers: ntfyHeaders({}),
    }).catch(() => {});
  });
}

function scheduleDroneNotifications() {
  const cooldownMs = droneConfig.cooldown * 60 * 1000;
  const remaining = cooldownMs - (Date.now() - droneState.lastHack);

  // SW: schedule ready notification if still cooling
  if (remaining > 0 && sysNotifEnabled) {
    swPost({ type: 'schedule', id: 'drone-ready', name: 'Drone', hacks: 0, delay: remaining,
      customTitle: 'XM Toolkit', customBody: '\u{1F6F8} DRONE READY \u2014 HACK NOW' });
  }

  // ntfy: schedule ready + idle reminders
  if (!ntfyConfig.enabled || !ntfyConfig.topic) return;
  const cooldownSec = droneConfig.cooldown * 60;
  const idleAfterSec = droneConfig.idleAfter * 3600;
  const idleRepeatSec = droneConfig.idleRepeat * 3600;

  // Ready notification
  fetch(`${ntfyConfig.server}/${ntfyConfig.topic}`, {
    method: 'POST',
    headers: ntfyHeaders({ 'X-Message-Id': 'drone-ready', 'X-Delay': `${cooldownSec}s`,
      'X-Title': 'XM Toolkit', 'X-Tags': 'flying_saucer', 'X-Icon': ntfyIcon }),
    body: '\u{1F6F8} DRONE READY \u2014 HACK NOW',
  }).catch(() => {});

  // Idle reminders
  for (let i = 1; i <= 3; i++) {
    const delaySec = idleAfterSec + (i - 1) * idleRepeatSec;
    const hoursAgo = Math.round(delaySec / 3600);
    fetch(`${ntfyConfig.server}/${ntfyConfig.topic}`, {
      method: 'POST',
      headers: ntfyHeaders({ 'X-Message-Id': `drone-idle-${i}`, 'X-Delay': `${delaySec}s`,
        'X-Title': 'XM Toolkit', 'X-Tags': 'flying_saucer', 'X-Icon': ntfyIcon }),
      body: `\u{1F6F8} DRONE HACK OVERDUE \u2014 ${hoursAgo}h SINCE LAST HACK`,
    }).catch(() => {});
  }
}

function droneHacked() {
  cancelDroneNotifications();
  droneState.lastHack = Date.now();
  droneState.hacks = (droneState.hacks || 0) + 1;
  saveDroneState();
  scheduleDroneNotifications();
  updateDroneUI();
  showToast('\u{1F6F8} DRONE HACK RECORDED');
}

document.getElementById('drone-hack-btn').addEventListener('click', droneHacked);

function formatDuration(ms) {
  const totalSec = Math.abs(Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatRelative(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  const rm = min % 60;
  return rm > 0 ? `${h}h ${rm}m ago` : `${h}h ago`;
}

function updateDroneUI() {
  const statusEl = document.getElementById('drone-status');
  const arcEl = document.getElementById('drone-arc');
  const countdownEl = document.getElementById('drone-countdown');
  const stateLabel = document.getElementById('drone-state-label');
  const lastHackEl = document.getElementById('drone-last-hack');
  const totalHacksEl = document.getElementById('drone-total-hacks');

  totalHacksEl.textContent = `Total hacks: ${droneState.hacks || 0}`;

  if (!droneState.lastHack) {
    statusEl.className = 'drone-status';
    arcEl.style.strokeDashoffset = DRONE_ARC_C.toFixed(2);
    countdownEl.textContent = '--:--';
    stateLabel.textContent = 'NO HACKS YET';
    lastHackEl.textContent = 'Last hack: never';
    return;
  }

  const now = Date.now();
  const elapsed = now - droneState.lastHack;
  const cooldownMs = droneConfig.cooldown * 60 * 1000;
  const idleAfterMs = droneConfig.idleAfter * 3600 * 1000;

  lastHackEl.textContent = `Last hack: ${formatRelative(elapsed)}`;

  if (elapsed < cooldownMs) {
    // COOLING DOWN
    const remaining = cooldownMs - elapsed;
    const pct = elapsed / cooldownMs;
    statusEl.className = 'drone-status cooling';
    arcEl.style.strokeDashoffset = (DRONE_ARC_C * (1 - pct)).toFixed(2);
    countdownEl.textContent = formatDuration(remaining);
    stateLabel.textContent = 'COOLING DOWN';
  } else if (elapsed < idleAfterMs) {
    // READY
    statusEl.className = 'drone-status ready';
    arcEl.style.strokeDashoffset = '0';
    countdownEl.textContent = 'READY';
    stateLabel.textContent = 'HACK NOW';
  } else {
    // OVERDUE
    const overdueSince = elapsed - cooldownMs;
    statusEl.className = 'drone-status overdue';
    arcEl.style.strokeDashoffset = '0';
    countdownEl.textContent = 'OVERDUE';
    stateLabel.textContent = `${formatDuration(overdueSince)} SINCE READY`;
  }
}

updateDroneUI();

// Drone settings UI
function initDroneSettingsUI() {
  const cooldownInput = document.getElementById('drone-cooldown-input');
  const idleInput = document.getElementById('drone-idle-input');
  const repeatInput = document.getElementById('drone-repeat-input');

  cooldownInput.value = droneConfig.cooldown;
  idleInput.value = droneConfig.idleAfter;
  repeatInput.value = droneConfig.idleRepeat;

  document.getElementById('drone-config-save-btn').addEventListener('click', () => {
    const c = parseInt(cooldownInput.value) || 60;
    const i = parseInt(idleInput.value) || 4;
    const r = parseInt(repeatInput.value) || 8;
    droneConfig.cooldown = Math.max(1, Math.min(1440, c));
    droneConfig.idleAfter = Math.max(1, Math.min(72, i));
    droneConfig.idleRepeat = Math.max(1, Math.min(72, r));
    saveDroneConfig();
    showToast('DRONE SETTINGS SAVED');
  });
}
initDroneSettingsUI();

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

// ── Settings / Notifications config ──
let sysNotifEnabled = false;
let ntfyConfig = { server: 'https://ntfy.sh', topic: '', token: '', enabled: false };

function loadSysNotifConfig() {
  try { const d = JSON.parse(localStorage.getItem('xm-sysnotif')); if (d) sysNotifEnabled = !!d.enabled; } catch {}
}

function loadNtfyConfig() {
  try {
    const d = JSON.parse(localStorage.getItem('xm-ntfy'));
    if (d) { ntfyConfig = d; return; }
  } catch {}
  ntfyConfig.topic = 'xm-' + Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(36)).join('').slice(0, 12);
}

loadSysNotifConfig();
loadNtfyConfig();

// Gear icon
document.getElementById('settings-gear').addEventListener('click', () => goTo('settings'));

// Settings screen init
function initSettingsUI() {
  const sysToggle = document.getElementById('sysnotif-toggle');
  const sysState = document.getElementById('sysnotif-state');
  const ntfyServerInput = document.getElementById('ntfy-server-input');
  const ntfyTopicInput = document.getElementById('ntfy-topic-input');
  const ntfyTokenInput = document.getElementById('ntfy-token-input');
  const ntfyToggle = document.getElementById('ntfy-toggle');

  // Populate
  ntfyServerInput.value = ntfyConfig.server;
  ntfyTopicInput.value = ntfyConfig.topic;
  ntfyTokenInput.value = ntfyConfig.token || '';
  updateSysToggleUI(sysToggle, sysState);
  updateNtfyToggleUI(ntfyToggle);

  // System notif toggle
  sysToggle.addEventListener('click', async () => {
    if (!sysNotifEnabled) {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          sysNotifEnabled = true;
        } else {
          showToast('NOTIFICATION PERMISSION DENIED');
        }
      } else {
        showToast('NOTIFICATIONS NOT SUPPORTED');
      }
    } else {
      sysNotifEnabled = false;
    }
    localStorage.setItem('xm-sysnotif', JSON.stringify({ enabled: sysNotifEnabled }));
    updateSysToggleUI(sysToggle, sysState);
  });

  // ntfy toggle
  ntfyToggle.addEventListener('click', () => {
    ntfyConfig.enabled = !ntfyConfig.enabled;
    updateNtfyToggleUI(ntfyToggle);
  });

  // Copy topic
  document.getElementById('ntfy-copy-btn').addEventListener('click', () => {
    const topic = ntfyTopicInput.value.trim();
    if (!topic) return;
    navigator.clipboard.writeText(topic).then(() => showToast('TOPIC COPIED')).catch(() => showToast('COPY FAILED'));
  });

  // Test
  document.getElementById('ntfy-test-btn').addEventListener('click', () => testNtfy(ntfyServerInput, ntfyTopicInput));

  // Save
  document.getElementById('ntfy-save-btn').addEventListener('click', () => {
    const server = ntfyServerInput.value.trim().replace(/\/+$/, '');
    const topic = ntfyTopicInput.value.trim();
    if (!server) { showToast('SERVER URL REQUIRED'); return; }
    if (!topic) { showToast('TOPIC REQUIRED'); return; }
    ntfyConfig.server = server;
    ntfyConfig.topic = topic;
    ntfyConfig.token = ntfyTokenInput.value.trim();
    localStorage.setItem('xm-ntfy', JSON.stringify(ntfyConfig));
    showToast('SETTINGS SAVED');
  });
}

function updateSysToggleUI(btn, stateEl) {
  btn.textContent = sysNotifEnabled ? 'ENABLED' : 'DISABLED';
  btn.classList.toggle('active', sysNotifEnabled);
  if ('Notification' in window) {
    stateEl.textContent = Notification.permission === 'granted' ? 'PERMISSION: GRANTED'
      : Notification.permission === 'denied' ? 'PERMISSION: DENIED' : '';
  }
}

function updateNtfyToggleUI(btn) {
  btn.textContent = ntfyConfig.enabled ? 'ENABLED' : 'DISABLED';
  btn.classList.toggle('active', ntfyConfig.enabled);
}

// ntfy API calls
const ntfyIcon = location.origin + '/assets/icons/icon-192.png';

function ntfyHeaders(extra) {
  const h = Object.assign({}, extra);
  if (ntfyConfig.token) h['Authorization'] = `Bearer ${ntfyConfig.token}`;
  return h;
}

function sendNtfyNotification(timerId, name, hacks, delaySec) {
  if (!ntfyConfig.enabled || !ntfyConfig.topic) return;
  fetch(`${ntfyConfig.server}/${ntfyConfig.topic}`, {
    method: 'POST',
    headers: ntfyHeaders({
      'X-Message-Id': `timer-${timerId}`,
      'X-Delay': `${delaySec}s`,
      'X-Title': 'XM Toolkit',
      'X-Tags': 'zap',
      'X-Icon': ntfyIcon,
    }),
    body: `${name} READY — HACK ${hacks}`,
  }).catch(() => {});
}

function cancelNtfyNotification(timerId) {
  if (!ntfyConfig.enabled || !ntfyConfig.topic) return;
  fetch(`${ntfyConfig.server}/${ntfyConfig.topic}/timer-${timerId}`, {
    method: 'DELETE',
    headers: ntfyHeaders({}),
  }).catch(() => {});
}

function testNtfy(serverInput, topicInput) {
  const server = serverInput.value.trim().replace(/\/+$/, '');
  const topic = topicInput.value.trim();
  if (!server || !topic) { showToast('ENTER SERVER & TOPIC FIRST'); return; }
  const token = document.getElementById('ntfy-token-input').value.trim();
  const headers = { 'X-Title': 'XM Toolkit', 'X-Tags': 'white_check_mark', 'X-Icon': ntfyIcon };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  fetch(`${server}/${topic}`, {
    method: 'POST',
    headers,
    body: 'Test notification — ntfy is working!',
  }).then(r => {
    showToast(r.ok ? 'TEST SENT — CHECK NTFY APP' : 'TEST FAILED: ' + r.status);
  }).catch(() => showToast('TEST FAILED — CHECK SERVER URL'));
}

initSettingsUI();

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

