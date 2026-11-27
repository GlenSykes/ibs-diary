// Data screen: CSV export for analysis, JSON backup and restore, storage status.

import { h, toast, downloadFile, shareFile, canShareFiles, toLocalInput } from './ui.js';
import { FODMAP_TAGS, OTHER_TAGS } from './data.js';
import * as db from './db.js';

export const APP_VERSION = '1.3.0';
const FODMAP_KEYS = new Set(FODMAP_TAGS.map((t) => t.key));
const OTHER_KEYS = new Set(OTHER_TAGS.map((t) => t.key));
const today = () => toLocalInput(Date.now()).slice(0, 10);

const COLUMNS = [
  'date', 'time', 'type', 'item', 'portion', 'recipe', 'amount_in_recipe',
  'fodmap', 'other_triggers', 'measure', 'value', 'entry_id',
];

const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

/**
 * One row per thing, "long" format, which is what spreadsheets and analysis
 * tools handle best: a food eaten is a row; each symptom rating is a row.
 * Recipes are expanded into their ingredients so FODMAPs can be traced.
 */
export async function buildCsv() {
  const everything = await db.changesSince(0);
  const foods = new Map(everything.foods.map((f) => [f.id, f])); // incl. deleted, for tags
  const entries = everything.entries.filter((e) => !e.deleted).sort((a, b) => a.time - b.time);
  const rows = [COLUMNS];

  for (const e of entries) {
    const [date, time] = toLocalInput(e.time).split('T');
    const base = { date, time, type: e.type, entry_id: e.id };
    const push = (o) => rows.push(COLUMNS.map((c) => ({ ...base, ...o })[c]));
    const tagCols = (foodId) => {
      const tags = foods.get(foodId)?.tags || [];
      return {
        fodmap: tags.filter((t) => FODMAP_KEYS.has(t)).join(' '),
        other_triggers: tags.filter((t) => OTHER_KEYS.has(t)).join(' '),
      };
    };

    if (e.type === 'intake') {
      for (const it of e.items) {
        if (it.kind === 'recipe') {
          for (const ing of it.ingredients || []) {
            push({
              type: 'food', item: ing.name, portion: it.portion, recipe: it.name,
              amount_in_recipe: ing.portion, ...tagCols(ing.foodId),
            });
          }
        } else {
          push({ type: 'food', item: it.name, portion: it.portion, ...tagCols(it.refId) });
        }
      }
    } else {
      const measures = {
        symptoms: ['pain', 'bloating', 'wind', 'belching', 'incontinence'],
        bowel: ['bristol', 'urgency'],
        mood: ['mood', 'stress', 'energy'],
        sleep: ['hours', 'quality'],
      }[e.type] || [];
      for (const m of measures) {
        if (e[m] == null) continue;
        push({ measure: e.type === 'sleep' && m === 'quality' ? 'sleep_quality' : m, value: e[m] });
      }
    }
  }
  return rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

/** Full backup, including deleted records so a restore carries deletes too. */
export async function buildBackup() {
  const data = await db.changesSince(0);
  return JSON.stringify({ app: 'ibs-diary', format: 1, exportedAt: Date.now(), ...data });
}

async function markBackedUp() {
  await db.setMeta('lastBackup', Date.now());
}

export async function dataView() {
  const lastBackup = await db.getMeta('lastBackup');
  const entries = await db.all('entries');
  const share = canShareFiles();
  const persisted = (await navigator.storage?.persisted?.()) ?? false;

  const status = h(
    'p',
    { class: 'hint' },
    `${entries.length} diary entries. Last backup: ` +
      (lastBackup ? new Date(lastBackup).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'never') +
      '.'
  );

  const backupName = () => `ibs-diary-backup-${today()}.json`;
  // Chrome on Android only shares an allow-list of file types, and JSON is not
  // on it: sharing a .json fails with "Permission denied". So a SHARED backup
  // is the same JSON in a .txt file; restore accepts either.
  const sharedBackupName = () => `ibs-diary-backup-${today()}.txt`;
  const csvName = () => `ibs-diary-${today()}.csv`;

  const fileInput = h('input', {
    type: 'file',
    accept: '.json,.txt,application/json,text/plain',
    class: 'visually-hidden',
    onchange: async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.app !== 'ibs-diary') throw new Error('not an IBS diary backup');
        const n = await db.merge(data);
        toast(n ? `Restored ${n} records` : 'Nothing new in that backup');
        location.hash = '#/';
      } catch (e) {
        toast('Could not restore: ' + e.message);
      }
      fileInput.value = '';
    },
  });

  return h(
    'div',
    { class: 'view' },
    h('h1', {}, 'Your data'),
    h(
      'p',
      { class: 'hint' },
      'Everything is stored only on this phone. Back up regularly: if the phone is lost or the app is uninstalled, the diary goes with it.'
    ),
    status,

    h('h2', {}, 'Back up'),
    h('p', { class: 'hint' }, 'A complete copy you can restore from. Save it to Google Drive or email it to yourself. A shared backup arrives as a .txt file; Restore takes it as it is.'),
    h(
      'div',
      { class: 'actions' },
      share &&
        h('button', {
          type: 'button',
          class: 'btn primary',
          onclick: async () => {
            if (await shareFile(sharedBackupName(), await buildBackup(), 'text/plain')) await markBackedUp();
          },
        }, 'Share backup'),
      h('button', {
        type: 'button',
        class: share ? 'btn' : 'btn primary',
        onclick: async () => {
          downloadFile(backupName(), await buildBackup(), 'application/json');
          await markBackedUp();
          toast('Backup saved to Downloads');
        },
      }, 'Download backup')
    ),

    h('h2', {}, 'Export for analysis'),
    h('p', { class: 'hint' }, 'A spreadsheet file (CSV): one row per food or rating, with FODMAP tags. Open it in Excel or Google Sheets, or give it to Claude.'),
    h(
      'div',
      { class: 'actions' },
      share &&
        h('button', {
          type: 'button',
          class: 'btn',
          onclick: async () => shareFile(csvName(), await buildCsv(), 'text/csv'),
        }, 'Share CSV'),
      h('button', {
        type: 'button',
        class: 'btn',
        onclick: async () => {
          downloadFile(csvName(), await buildCsv(), 'text/csv');
          toast('Saved to Downloads');
        },
      }, 'Download CSV')
    ),

    h('h2', {}, 'Restore'),
    h('p', { class: 'hint' }, 'Load a backup file. It merges with what is here: nothing is lost, and the newest version of each entry wins.'),
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, 'Choose backup file'), fileInput),

    h('h2', {}, 'Storage'),
    persisted
      ? h('p', { class: 'hint' }, '✓ The phone has agreed to keep this data permanently.')
      : h(
          'div',
          {},
          h('p', { class: 'hint' }, 'The phone may clear this data if storage runs low. Ask it to keep it:'),
          h('button', {
            type: 'button',
            class: 'btn',
            onclick: async () => {
              const ok = await navigator.storage?.persist?.();
              toast(ok ? 'Data will be kept permanently' : 'Not granted yet. Installing the app to the home screen usually allows it.');
              if (ok) location.reload();
            },
          }, 'Keep data permanently')
        ),

    h('h2', {}, 'About'),
    h(
      'p',
      { class: 'hint' },
      'FODMAP tags in the starter library are approximate, based on general low-FODMAP guidance at a normal serving. They are not lab values. Edit any food to correct them. For authoritative figures use the Monash University FODMAP app.'
    ),
    h('p', { class: 'hint' }, `Version ${APP_VERSION}`)
  );
}
