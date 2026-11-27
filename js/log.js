// The logging screens: food & drink, symptoms, bowel movement, mood & stress, sleep.
// Each one is used both for a new entry and for editing an existing one.

import { h, choice, scale, field, timeField, toast } from './ui.js';
import {
  ENTRY_TYPES, PORTIONS, SEVERITY, URGENCY, MOOD, STRESS, ENERGY, SLEEP_QUALITY, BRISTOL,
} from './data.js';
import { openPicker } from './picker.js';
import * as db from './db.js';

/** Most recently logged foods/recipes, newest first, no repeats. */
export async function recentItems(limit = 25) {
  const entries = await db.entriesBetween(Date.now() - 60 * 86400000, Date.now() + 86400000);
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    if (e.type !== 'intake') continue;
    for (const it of e.items) {
      const k = it.kind + ':' + it.refId;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ kind: it.kind, id: it.refId });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function shell(type, entry, body, collect, { timeLabel } = {}) {
  const time = timeField(entry?.time ?? Date.now(), timeLabel);
  const save = async () => {
    const data = await collect();
    if (!data) return; // collect() already explained what is missing
    await db.put('entries', { ...(entry || {}), ...data, type, time: time.get() });
    toast(entry ? 'Updated' : 'Saved');
    location.hash = entry ? '#/history' : '#/';
  };
  const del = async () => {
    if (!confirm('Delete this entry?')) return;
    await db.remove('entries', entry.id);
    toast('Deleted');
    location.hash = '#/history';
  };
  return h(
    'div',
    { class: 'view log-view' },
    h('h1', {}, (entry ? 'Edit: ' : '') + ENTRY_TYPES[type].label),
    body,
    time.el,
    h(
      'div',
      { class: 'actions sticky' },
      h('button', { type: 'button', class: 'btn primary big', onclick: save }, entry ? 'Save changes' : 'Save'),
      entry && h('button', { type: 'button', class: 'btn danger', onclick: del }, 'Delete')
    )
  );
}

// ---- Food & drink ----------------------------------------------------------

async function intakeForm(entry) {
  let foods = await db.all('foods');
  const recipes = await db.all('recipes');
  const recent = await recentItems();
  const items = (entry?.items || []).map((i) => ({ ...i }));

  const list = h('div', { class: 'item-list' });
  const addBtn = h(
    'button',
    { type: 'button', class: 'btn add', onclick: pick },
    '+ Add food or recipe'
  );

  function renderItems() {
    if (!items.length) {
      list.replaceChildren(h('p', { class: 'empty' }, 'Nothing added yet.'));
      return;
    }
    list.replaceChildren(
      ...items.map((it, idx) =>
        h(
          'div',
          { class: 'item' },
          h(
            'div',
            { class: 'item-head' },
            h('span', { class: 'item-name' }, it.name, it.kind === 'recipe' ? h('span', { class: 'badge' }, 'Recipe') : null),
            h(
              'button',
              {
                type: 'button',
                class: 'icon-btn',
                'aria-label': 'Remove ' + it.name,
                onclick: () => {
                  items.splice(idx, 1);
                  renderItems();
                },
              },
              '✕'
            )
          ),
          choice(
            PORTIONS.map((p) => ({ value: p.key, label: p.label })),
            it.portion,
            { cls: 'portion', onChange: (v) => (it.portion = v) }
          ).el
        )
      )
    );
  }

  function pick() {
    const selected = new Set(items.map((i) => i.kind + ':' + i.refId));
    openPicker({
      foods,
      recipes,
      recent,
      selected,
      includeRecipes: true,
      onFoodCreated: (f) => (foods = [...foods, f]),
      onToggle: (it, on) => {
        if (on) items.push({ kind: it.kind, refId: it.id, name: it.name, portion: 'normal' });
        else {
          const i = items.findIndex((x) => x.kind === it.kind && x.refId === it.id);
          if (i >= 0) items.splice(i, 1);
        }
      },
      onDone: renderItems,
    });
  }

  renderItems();
  const body = h('div', {}, list, addBtn);

  return shell('intake', entry, body, async () => {
    if (!items.length) return toast('Add at least one food or drink'), null;
    const foodMap = new Map((await db.all('foods')).map((f) => [f.id, f]));
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    // Snapshot recipe ingredients now, so editing a recipe later does not
    // rewrite what you actually ate in the past.
    const saved = items.map((it) => {
      if (it.kind !== 'recipe') return it;
      if (it.ingredients) return it;
      const r = recipeMap.get(it.refId);
      return {
        ...it,
        ingredients: (r?.items || []).map((ri) => ({
          foodId: ri.foodId,
          name: foodMap.get(ri.foodId)?.name ?? ri.name ?? '?',
          portion: ri.portion,
        })),
      };
    });
    return { items: saved };
  });
}

// ---- Symptoms --------------------------------------------------------------

function symptomsForm(entry) {
  const opts = SEVERITY.map((label, i) => ({ value: i, label }));
  const pain = choice(opts, entry?.pain ?? 0);
  const bloating = choice(opts, entry?.bloating ?? 0);
  const wind = choice(opts, entry?.wind ?? 0);
  const body = h(
    'div',
    {},
    field('Tummy pain', pain.el),
    field('Bloating', bloating.el),
    field('Wind', wind.el)
  );
  return shell('symptoms', entry, body, () => {
    const v = { pain: pain.get(), bloating: bloating.get(), wind: wind.get() };
    return v;
  });
}

// ---- Bowel movement --------------------------------------------------------

function bowelForm(entry) {
  const bristol = choice(
    BRISTOL.map((b) => ({ value: b.n, label: `Type ${b.n}`, sub: b.label })),
    entry?.bristol ?? null,
    { cls: 'bristol' }
  );
  const urgency = choice(
    URGENCY.map((label, i) => ({ value: i, label })),
    entry?.urgency ?? 0
  );
  const body = h(
    'div',
    {},
    field('Stool type (Bristol scale)', bristol.el, '1 to 2 hard, 3 to 4 normal, 5 to 7 loose.'),
    field('Urgency', urgency.el)
  );
  return shell('bowel', entry, body, () => {
    if (bristol.get() == null) return toast('Choose a stool type'), null;
    return { bristol: bristol.get(), urgency: urgency.get() };
  });
}

// ---- Mood & stress ---------------------------------------------------------

function moodForm(entry) {
  const mood = scale(MOOD, entry?.mood ?? null);
  const stress = scale(STRESS, entry?.stress ?? null);
  const energy = scale(ENERGY, entry?.energy ?? null);
  const body = h(
    'div',
    {},
    field('Mood', mood.el),
    field('Stress', stress.el),
    field('Energy', energy.el, 'Skip any you do not want to rate this time.')
  );
  return shell('mood', entry, body, () => {
    const v = { mood: mood.get(), stress: stress.get(), energy: energy.get() };
    if (v.mood == null && v.stress == null && v.energy == null)
      return toast('Rate at least one'), null;
    return v;
  });
}

// ---- Sleep -----------------------------------------------------------------

async function sleepForm(entry) {
  let hours = entry?.hours ?? 7;
  const out = h('span', { class: 'stepper-value' });
  const show = () => (out.textContent = `${hours} h`);
  const step = (d) => {
    hours = Math.min(16, Math.max(0, hours + d));
    show();
  };
  show();
  const stepper = h(
    'div',
    { class: 'stepper' },
    h('button', { type: 'button', class: 'btn', 'aria-label': 'Less', onclick: () => step(-0.5) }, '−'),
    out,
    h('button', { type: 'button', class: 'btn', 'aria-label': 'More', onclick: () => step(0.5) }, '+')
  );
  const quality = scale(SLEEP_QUALITY, entry?.quality ?? null);
  const body = h('div', {}, field('Hours slept', stepper), field('Sleep quality', quality.el));
  return shell(
    'sleep',
    entry,
    body,
    () => {
      if (quality.get() == null) return toast('Rate your sleep quality'), null;
      return { hours, quality: quality.get() };
    },
    { timeLabel: 'Woke up at' }
  );
}

const FORMS = { intake: intakeForm, symptoms: symptomsForm, bowel: bowelForm, mood: moodForm, sleep: sleepForm };

export async function logView(type, entryId) {
  const form = FORMS[type];
  if (!form) return null;
  const entry = entryId ? await db.get('entries', entryId) : null;
  if (entryId && !entry) return h('div', { class: 'view' }, h('p', {}, 'That entry no longer exists.'));
  return form(entry);
}
