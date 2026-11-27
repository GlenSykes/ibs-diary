// Entry cards (used on Home and History) and the History screen.

import { h, fmtTime, fmtDay, startOfDay } from './ui.js';
import { ENTRY_TYPES, SEVERITY, URGENCY, MOOD, STRESS, ENERGY, SLEEP_QUALITY, portionLabel } from './data.js';
import * as db from './db.js';

export function summary(e) {
  switch (e.type) {
    case 'intake':
      return e.items
        .map((i) => i.name + (i.portion !== 'normal' ? ` (${portionLabel(i.portion).toLowerCase()})` : ''))
        .join(', ');
    case 'symptoms': {
      const parts = [
        ['Pain', e.pain],
        ['Bloating', e.bloating],
        ['Wind', e.wind],
        ['Belching', e.belching],
      ]
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}: ${SEVERITY[v]}`);
      return parts.length ? parts.join(' · ') : 'No symptoms';
    }
    case 'bowel':
      return `Type ${e.bristol}` + (e.urgency > 0 ? ` · Urgency: ${URGENCY[e.urgency]}` : '');
    case 'mood':
      return [
        e.mood != null && `Mood: ${MOOD[e.mood - 1]}`,
        e.stress != null && `Stress: ${STRESS[e.stress - 1]}`,
        e.energy != null && `Energy: ${ENERGY[e.energy - 1]}`,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'sleep':
      return `${e.hours} h · ${SLEEP_QUALITY[e.quality - 1]} sleep`;
    default:
      return '';
  }
}

export function entryCard(e) {
  const t = ENTRY_TYPES[e.type] || { label: e.type, icon: '•' };
  return h(
    'a',
    { class: 'entry', href: `#/edit/${e.type}/${e.id}` },
    h('span', { class: 'entry-icon', 'aria-hidden': 'true' }, t.icon),
    h(
      'span',
      { class: 'entry-body' },
      h('span', { class: 'entry-top' }, h('span', { class: 'entry-type' }, t.label), h('span', { class: 'entry-time' }, fmtTime(e.time))),
      h('span', { class: 'entry-summary' }, summary(e))
    )
  );
}

export async function historyView() {
  const PAGE_DAYS = 14;
  let to = startOfDay(Date.now()) + 86400000;
  const container = h('div', { class: 'day-list' });
  const more = h('button', { type: 'button', class: 'btn', onclick: load }, 'Show earlier');
  let shownAny = false;

  async function load() {
    const from = to - PAGE_DAYS * 86400000;
    const entries = await db.entriesBetween(from, to);
    to = from;
    const byDay = new Map();
    for (const e of entries) {
      const d = startOfDay(e.time);
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(e);
    }
    for (const [d, list] of byDay) {
      shownAny = true;
      container.append(h('h2', { class: 'day-title' }, fmtDay(d)), h('div', { class: 'entries' }, list.map(entryCard)));
    }
    if (!shownAny && !entries.length) {
      // Keep looking back a little in case the last entries are older.
      const total = (await db.all('entries')).length;
      if (!total) {
        container.replaceChildren(h('p', { class: 'empty' }, 'No entries yet. Log something from the Log tab.'));
        more.remove();
      }
    }
    const remaining = (await db.entriesBetween(0, to)).length;
    more.hidden = !remaining;
  }

  await load();
  return h('div', { class: 'view' }, h('h1', {}, 'History'), container, more);
}
