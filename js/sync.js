// NAS sync: keeps a copy of the diary on a server you run, and pulls in
// anything another device sent there. Off until an address and key are
// entered on the Data screen. The address is typed in, never written into this
// code, because this code is public.
//
// Each sync sends every record changed since the last one (db.changesSince)
// and merges back everything the server received since then (db.merge, newest
// wins). The server hands out a cursor; the phone never relies on its own clock
// to decide what it has already received.
//
// It syncs on opening the app, a few seconds after each save, when the phone
// comes back online, and from the "Sync now" button. Android does not let a
// web app sync reliably while it is closed.

import * as db from './db.js';
import { h, toast } from './ui.js';

const AFTER_SAVE_MS = 4000;
const TIMEOUT_MS = 20000;
const RESYNC_ON_RETURN_MS = 60000;

let running = null;
let again = false;
let timer = null;
const listeners = new Set();

const notify = (info) => listeners.forEach((fn) => fn(info));
/** fn({ changed }) after every sync attempt. Returns an unsubscribe function. */
export function onSync(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function settings() {
  return { url: await db.getMeta('syncUrl'), key: await db.getMeta('syncKey') };
}

export async function isOn() {
  const s = await settings();
  return !!(s.url && s.key);
}

export async function state() {
  return {
    ...(await settings()),
    lastSync: await db.getMeta('syncLast'),
    error: await db.getMeta('syncError'),
    counts: await db.getMeta('syncCounts'),
  };
}

/** Accepts "diary.example.com" or a full address; returns "https://diary.example.com". */
export function normaliseUrl(input) {
  let s = (input || '').trim();
  if (!s) throw new Error('Enter the NAS address.');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error('That does not look like a web address.');
  }
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !local) throw new Error('The address must start with https://');
  return (u.origin + u.pathname).replace(/\/+$/, '');
}

export async function connect(url, key) {
  await db.setMeta('syncUrl', normaliseUrl(url));
  await db.setMeta('syncKey', (key || '').trim());
  await db.setMeta('syncCursor', 0); // fresh start: exchange everything
  await db.setMeta('syncPushedTo', 0);
  await db.setMeta('syncError', null);
  await db.setMeta('syncLast', null);
  await db.setMeta('syncCounts', null);
  return syncNow();
}

/** Stops syncing on this phone. The copy on the NAS is untouched. */
export async function disconnect({ silent = false } = {}) {
  for (const k of ['syncUrl', 'syncKey', 'syncCursor', 'syncPushedTo', 'syncError', 'syncLast', 'syncCounts']) {
    await db.setMeta(k, null);
  }
  if (!silent) notify({ changed: 0 });
}

/** After a restore from file: its records may be older than the "sent up to"
 *  mark, so send everything again. The server ignores what it already has. */
export async function resendEverything() {
  await db.setMeta('syncPushedTo', 0);
  schedule(0);
}

export function schedule(delay = AFTER_SAVE_MS) {
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), delay);
}

export function syncNow() {
  if (running) {
    again = true;
    return running;
  }
  running = run().finally(() => {
    running = null;
    if (again) {
      again = false;
      schedule(0);
    }
  });
  return running;
}

function explain(status) {
  if (status === 401) return 'The NAS did not accept the key. Check it matches the one set on the NAS.';
  if (status === 429) return 'Too many wrong keys were tried from here. Wait ten minutes.';
  if (status === 404) return 'That address answered, but it is not the diary sync service.';
  if (status === 413) return 'Too much to send in one go.';
  return `The NAS replied with an error (${status}).`;
}

async function run() {
  const { url, key } = await settings();
  if (!url || !key) return { off: true };
  const cursor = (await db.getMeta('syncCursor')) || 0;
  const pushedTo = (await db.getMeta('syncPushedTo')) || 0;
  const changes = await db.changesSince(pushedTo);
  let sentUpTo = pushedTo;
  for (const list of Object.values(changes)) for (const r of list) sentUpTo = Math.max(sentUpTo, r.updatedAt);

  const abort = new AbortController();
  const t = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url + '/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor, changes }),
      cache: 'no-store',
      signal: abort.signal,
    });
  } catch {
    return fail('Could not reach the NAS. Check you have signal and that the address is right.');
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) return fail(explain(res.status));
  let body;
  try {
    body = await res.json();
  } catch {
    return fail('That address answered, but it is not the diary sync service.');
  }
  const changed = await db.merge(body.changes || {});
  await db.setMeta('syncCursor', body.cursor || 0);
  await db.setMeta('syncPushedTo', sentUpTo);
  await db.setMeta('syncLast', Date.now());
  await db.setMeta('syncError', null);
  await db.setMeta('syncCounts', body.counts || null);
  notify({ changed });
  return { changed };
}

async function fail(message) {
  await db.setMeta('syncError', message);
  notify({ changed: 0 });
  return { error: message };
}

/** Wire up the automatic triggers. Called once at start-up. */
export function init() {
  window.addEventListener('diary-changed', () => schedule());
  window.addEventListener('online', () => schedule(0));
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const last = (await db.getMeta('syncLast')) || 0;
    if (Date.now() - last > RESYNC_ON_RETURN_MS) schedule(0);
  });
  schedule(0);
}

// ---- Data screen section ----------------------------------------------------

export function ago(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

export function syncSection() {
  const box = h('div', { class: 'sync-box' });
  let unsubscribe = null;
  let busy = false; // while connecting, the button handler owns the screen

  let drawn = false;

  async function render() {
    if (busy) return;
    if (drawn && !box.isConnected) {
      unsubscribe(); // left the Data screen
      return;
    }
    drawn = true; // the first draw happens before the box is on screen
    const s = await state();
    box.replaceChildren(...(s.url && s.key ? connectedView(s) : setupView()).filter(Boolean));
  }

  function setupView() {
    const url = h('input', { class: 'text-input', type: 'url', inputmode: 'url', autocomplete: 'off', placeholder: 'diary.example.com' });
    const key = h('input', { class: 'text-input', type: 'password', autocomplete: 'off', placeholder: 'Device key' });
    const err = h('p', { class: 'notice', hidden: true });
    const go = h('button', {
      type: 'button',
      class: 'btn primary',
      onclick: async () => {
        err.hidden = true;
        try {
          normaliseUrl(url.value);
          if (key.value.trim().length < 20) throw new Error('Enter the device key from the NAS.');
        } catch (e) {
          err.textContent = e.message;
          err.hidden = false;
          return;
        }
        go.disabled = true;
        go.textContent = 'Connecting…';
        busy = true;
        const r = await connect(url.value, key.value);
        if (r.error) {
          await disconnect({ silent: true }); // keep nothing that does not work
          busy = false;
          err.textContent = r.error;
          err.hidden = false;
          go.disabled = false;
          go.textContent = 'Connect';
          return;
        }
        busy = false;
        toast('Connected. Your diary is on the NAS.');
        render();
      },
    }, 'Connect');
    return [
      h('p', { class: 'hint' }, 'Keeps a copy on your NAS, updated automatically, and lets another phone pull the diary back. Optional.'),
      h('div', { class: 'field' }, h('div', { class: 'field-label' }, 'NAS address'), url),
      h('div', { class: 'field' }, h('div', { class: 'field-label' }, 'Device key'), key),
      err,
      h('div', { class: 'actions' }, go),
    ];
  }

  function connectedView(s) {
    const host = s.url.replace(/^https?:\/\//, '');
    const now = h('button', {
      type: 'button',
      class: 'btn primary',
      onclick: async () => {
        now.disabled = true;
        now.textContent = 'Syncing…';
        const r = await syncNow();
        toast(r.error ? 'Sync failed' : r.changed ? `Synced, ${r.changed} updated from the NAS` : 'Synced');
        render();
      },
    }, 'Sync now');
    return [
      h('p', { class: 'hint' }, `Connected to ${host}.`),
      h('p', { class: 'hint' }, s.lastSync ? `Last synced ${ago(s.lastSync)}.` : 'Not synced yet.'),
      s.counts ? h('p', { class: 'hint' }, `The NAS holds ${s.counts.entries} diary entr${s.counts.entries === 1 ? 'y' : 'ies'}.`) : null,
      s.error ? h('p', { class: 'notice' }, s.error) : null,
      h(
        'div',
        { class: 'actions' },
        now,
        h('button', {
          type: 'button',
          class: 'btn',
          onclick: async () => {
            if (!confirm('Stop syncing on this phone? The copy on the NAS is kept.')) return;
            await disconnect();
            render();
          },
        }, 'Disconnect')
      ),
    ];
  }

  unsubscribe = onSync(render);
  render();
  return box;
}
