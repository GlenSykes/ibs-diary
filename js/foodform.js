// The add/edit form for a library food. Used by the Library screen and by
// the "not in the library? add it" shortcut inside the food picker.

import { h, field, toast } from './ui.js';
import { CATEGORIES, FODMAP_TAGS, OTHER_TAGS } from './data.js';
import * as db from './db.js';

function tagToggles(tags, selected) {
  return h(
    'div',
    { class: 'chips' },
    tags.map((t) => {
      const b = h(
        'button',
        {
          type: 'button',
          class: 'chip toggle',
          'aria-pressed': String(selected.has(t.key)),
          onclick: () => {
            selected.has(t.key) ? selected.delete(t.key) : selected.add(t.key);
            b.setAttribute('aria-pressed', String(selected.has(t.key)));
          },
        },
        t.label
      );
      return b;
    })
  );
}

/**
 * food: existing record or {name?, category?}. Calls onSave(savedRecord).
 */
export function foodForm(food, { onSave, onCancel, onDelete, allFoods = [] }) {
  const name = h('input', {
    type: 'text',
    class: 'text-input',
    value: food.name || '',
    placeholder: 'e.g. Rye crispbread',
    autocomplete: 'off',
  });
  const category = h(
    'select',
    { class: 'text-input' },
    CATEGORIES.map((c) =>
      h('option', { value: c.key, selected: c.key === (food.category || 'other') }, c.label)
    )
  );
  const tags = new Set(food.tags || []);

  async function save() {
    const n = name.value.trim();
    if (!n) return toast('Give the food a name');
    const clash = allFoods.find(
      (f) => f.id !== food.id && f.name.toLowerCase() === n.toLowerCase()
    );
    if (clash) return toast(`"${clash.name}" is already in the library`);
    const saved = await db.put('foods', { ...food, name: n, category: category.value, tags: [...tags] });
    onSave(saved);
  }

  return h(
    'div',
    { class: 'form' },
    field('Name', name),
    field('Category', category),
    field(
      'FODMAPs it contains',
      tagToggles(FODMAP_TAGS, tags),
      'At a normal serving. Leave all off if it is low-FODMAP.'
    ),
    field('Other possible triggers', tagToggles(OTHER_TAGS, tags)),
    h(
      'div',
      { class: 'actions' },
      h('button', { type: 'button', class: 'btn primary', onclick: save }, 'Save food'),
      onCancel && h('button', { type: 'button', class: 'btn', onclick: onCancel }, 'Cancel'),
      onDelete && h('button', { type: 'button', class: 'btn danger', onclick: onDelete }, 'Delete')
    )
  );
}
