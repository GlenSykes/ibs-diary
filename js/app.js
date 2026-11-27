// App entry point: start-up, screen routing, home screen, bottom navigation.

import { h, fmtDay, startOfDay } from './ui.js';
import { ENTRY_TYPES } from './data.js';
import { seedIfNeeded } from './seed.js';
import { logView } from './log.js';
import { historyView, entryCard } from './history.js';
import { foodsView, foodEditView, recipesView, recipeEditView } from './library.js';
import { dataView } from './export.js';
import * as db from './db.js';

const main = document.getElementById('main');
const BACKUP_NAG_DAYS = 7;

async function homeView() {
  const now = Date.now();
  const today = await db.entriesBetween(startOfDay(now), startOfDay(now) + 86400000);
  const lastBackup = await db.getMeta('lastBackup');
  const anyEntries = today.length || (await db.all('entries')).length;
  const stale = !lastBackup || now - lastBackup > BACKUP_NAG_DAYS * 86400000;

  return h(
    'div',
    { class: 'view' },
    h('h1', { class: 'home-title' }, 'What happened?'),
    anyEntries && stale
      ? h(
          'a',
          { class: 'banner', href: '#/data' },
          lastBackup
            ? `Last backup was ${Math.floor((now - lastBackup) / 86400000)} days ago. Tap to back up.`
            : 'Not backed up yet. Tap to back up.'
        )
      : null,
    h(
      'div',
      { class: 'log-grid' },
      Object.entries(ENTRY_TYPES).map(([type, t]) =>
        h(
          'a',
          { class: 'log-btn log-' + type, href: '#/log/' + type },
          h('span', { class: 'log-icon', 'aria-hidden': 'true' }, t.icon),
          h('span', {}, t.label)
        )
      )
    ),
    h('h2', { class: 'day-title' }, fmtDay(now)),
    today.length
      ? h('div', { class: 'entries' }, today.map(entryCard))
      : h('p', { class: 'empty' }, 'Nothing logged today yet.')
  );
}

const ROUTES = [
  [/^$/, () => homeView(), 'log'],
  [/^log\/(\w+)$/, (m) => logView(m[1]), 'log'],
  [/^edit\/(\w+)\/(.+)$/, (m) => logView(m[1], m[2]), 'history'],
  [/^history$/, () => historyView(), 'history'],
  [/^library(\/foods)?$/, () => foodsView(), 'library'],
  [/^library\/recipes$/, () => recipesView(), 'library'],
  [/^library\/food\/(.+)$/, (m) => foodEditView(m[1]), 'library'],
  [/^library\/recipe\/(.+)$/, (m) => recipeEditView(m[1]), 'library'],
  [/^data$/, () => dataView(), 'data'],
];

let renderSeq = 0;
async function route() {
  const path = location.hash.replace(/^#\/?/, '');
  const seq = ++renderSeq;
  for (const [re, view, tab] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    const el = await view(m);
    if (seq !== renderSeq) return; // a newer navigation started meanwhile
    main.replaceChildren(el || h('p', {}, 'Not found'));
    document.querySelectorAll('.nav a').forEach((a) => a.setAttribute('aria-current', String(a.dataset.tab === tab)));
    window.scrollTo(0, 0);
    return;
  }
  location.hash = '#/';
}

// ---- updates: a new version waits until you tap, so nothing is lost mid-entry

function watchForUpdates(reg) {
  const offer = (worker) => {
    if (document.querySelector('.update-bar')) return;
    document.body.append(
      h(
        'button',
        {
          type: 'button',
          class: 'update-bar',
          onclick: () => worker.postMessage('skipWaiting'),
        },
        'A new version is ready. Tap to update.'
      )
    );
  };
  if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
    });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

async function start() {
  try {
    await seedIfNeeded();
  } catch (e) {
    main.replaceChildren(h('p', { class: 'empty' }, 'Could not open storage: ' + e.message));
    return;
  }
  navigator.storage?.persist?.(); // silent on Android; granted readily once installed
  window.addEventListener('hashchange', route);
  await route();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(watchForUpdates).catch(() => {});
  }
}

start();
