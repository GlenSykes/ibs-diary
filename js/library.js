// Library screens: browse/edit foods, and build recipes from them.

import { h, choice, field, toast } from './ui.js';
import { CATEGORIES, PORTIONS, FODMAP_TAGS, tagLabel } from './data.js';
import { foodForm } from './foodform.js';
import { openPicker } from './picker.js';
import * as db from './db.js';

const FODMAP_KEYS = new Set(FODMAP_TAGS.map((t) => t.key));

function libTabs(active) {
  return h(
    'div',
    { class: 'tabs' },
    [
      ['foods', 'Foods'],
      ['recipes', 'Recipes'],
    ].map(([k, l]) =>
      h('a', { class: 'tab', href: `#/library/${k}`, 'aria-selected': String(active === k) }, l)
    )
  );
}

// ---- Foods -----------------------------------------------------------------

export async function foodsView() {
  const foods = await db.all('foods');
  const list = h('div', {});
  const search = h('input', {
    type: 'search',
    class: 'text-input search',
    placeholder: `Search ${foods.length} foods`,
    oninput: render,
  });

  function render() {
    const q = search.value.trim().toLowerCase();
    const out = [];
    for (const c of CATEGORIES) {
      const inCat = foods
        .filter((f) => f.category === c.key && (!q || f.name.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!inCat.length) continue;
      out.push(h('h3', { class: 'section-title' }, c.label));
      for (const f of inCat) {
        const tags = (f.tags || []).map(tagLabel);
        out.push(
          h(
            'a',
            { class: 'pick-row', href: `#/library/food/${f.id}` },
            h('span', { class: 'pick-name' }, f.name, h('span', { class: 'pick-sub' }, tags.length ? tags.join(', ') : 'Low FODMAP'))
          )
        );
      }
    }
    if (!out.length) out.push(h('p', { class: 'empty' }, 'No foods match.'));
    list.replaceChildren(...out);
  }
  render();

  return h(
    'div',
    { class: 'view' },
    h('h1', {}, 'Library'),
    libTabs('foods'),
    h('div', { class: 'row' }, search, h('a', { class: 'btn primary', href: '#/library/food/new' }, '+ New')),
    list
  );
}

export async function foodEditView(id) {
  const allFoods = await db.all('foods');
  const food = id === 'new' ? {} : await db.get('foods', id);
  if (!food) return h('div', { class: 'view' }, h('p', {}, 'That food no longer exists.'));

  async function onDelete() {
    const recipes = (await db.all('recipes')).filter((r) => r.items.some((i) => i.foodId === food.id));
    const msg = recipes.length
      ? `"${food.name}" is used in: ${recipes.map((r) => r.name).join(', ')}.\n\nDelete it anyway? Past diary entries keep its name.`
      : `Delete "${food.name}"? Past diary entries keep its name.`;
    if (!confirm(msg)) return;
    await db.remove('foods', food.id);
    toast('Deleted');
    location.hash = '#/library/foods';
  }

  return h(
    'div',
    { class: 'view' },
    h('h1', {}, id === 'new' ? 'New food' : 'Edit food'),
    foodForm(food, {
      allFoods,
      onSave: () => {
        toast('Saved');
        location.hash = '#/library/foods';
      },
      onCancel: () => (location.hash = '#/library/foods'),
      onDelete: id === 'new' ? null : onDelete,
    })
  );
}

// ---- Recipes ---------------------------------------------------------------

export async function recipesView() {
  const recipes = (await db.all('recipes')).sort((a, b) => a.name.localeCompare(b.name));
  return h(
    'div',
    { class: 'view' },
    h('h1', {}, 'Library'),
    libTabs('recipes'),
    h(
      'p',
      { class: 'hint' },
      'A recipe is a set of library foods you eat together, like "Toast with jam" or "Taco Friday". Log it in one tap.'
    ),
    h('a', { class: 'btn primary', href: '#/library/recipe/new' }, '+ New recipe'),
    recipes.length
      ? h(
          'div',
          { class: 'list-gap' },
          recipes.map((r) =>
            h(
              'a',
              { class: 'pick-row', href: `#/library/recipe/${r.id}` },
              h('span', { class: 'pick-name' }, r.name, h('span', { class: 'pick-sub' }, r.items.map((i) => i.name).join(', ')))
            )
          )
        )
      : h('p', { class: 'empty' }, 'No recipes yet.')
  );
}

export async function recipeEditView(id) {
  let foods = await db.all('foods');
  const recipe = id === 'new' ? { items: [] } : await db.get('recipes', id);
  if (!recipe) return h('div', { class: 'view' }, h('p', {}, 'That recipe no longer exists.'));
  const foodMap = () => new Map(foods.map((f) => [f.id, f]));
  const items = recipe.items.map((i) => ({ ...i }));

  const name = h('input', { type: 'text', class: 'text-input', value: recipe.name || '', placeholder: 'e.g. Porridge with blueberries' });
  const list = h('div', { class: 'item-list' });
  const tagLine = h('p', { class: 'hint' });

  function render() {
    const fm = foodMap();
    list.replaceChildren(
      ...(items.length
        ? items.map((it, idx) =>
            h(
              'div',
              { class: 'item' },
              h(
                'div',
                { class: 'item-head' },
                h('span', { class: 'item-name' }, fm.get(it.foodId)?.name ?? it.name),
                h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove', onclick: () => (items.splice(idx, 1), render()) }, '✕')
              ),
              choice(PORTIONS.map((p) => ({ value: p.key, label: p.label })), it.portion, {
                cls: 'portion',
                onChange: (v) => (it.portion = v),
              }).el
            )
          )
        : [h('p', { class: 'empty' }, 'No ingredients yet.')])
    );
    const tags = new Set(items.flatMap((i) => (fm.get(i.foodId)?.tags || []).filter((t) => FODMAP_KEYS.has(t))));
    tagLine.textContent = tags.size ? 'Contains: ' + [...tags].map(tagLabel).join(', ') : '';
  }

  function pick() {
    openPicker({
      foods,
      recipes: [],
      recent: [],
      includeRecipes: false,
      selected: new Set(items.map((i) => 'food:' + i.foodId)),
      onFoodCreated: (f) => (foods = [...foods, f]),
      onToggle: (it, on) => {
        if (on) items.push({ foodId: it.id, name: it.name, portion: 'normal' });
        else {
          const i = items.findIndex((x) => x.foodId === it.id);
          if (i >= 0) items.splice(i, 1);
        }
      },
      onDone: render,
    });
  }

  async function save() {
    const n = name.value.trim();
    if (!n) return toast('Give the recipe a name');
    if (!items.length) return toast('Add at least one ingredient');
    const fm = foodMap();
    await db.put('recipes', {
      ...recipe,
      name: n,
      items: items.map((i) => ({ foodId: i.foodId, name: fm.get(i.foodId)?.name ?? i.name, portion: i.portion })),
    });
    toast('Saved');
    location.hash = '#/library/recipes';
  }

  async function del() {
    if (!confirm(`Delete "${recipe.name}"? Past diary entries keep what was in it.`)) return;
    await db.remove('recipes', recipe.id);
    toast('Deleted');
    location.hash = '#/library/recipes';
  }

  render();
  return h(
    'div',
    { class: 'view' },
    h('h1', {}, id === 'new' ? 'New recipe' : 'Edit recipe'),
    field('Name', name),
    field(
      'Ingredients',
      h('div', {}, list, h('button', { type: 'button', class: 'btn add', onclick: pick }, '+ Add ingredient'), tagLine),
      'Portion here means how much of each goes into one normal serving.'
    ),
    h(
      'div',
      { class: 'actions' },
      h('button', { type: 'button', class: 'btn primary', onclick: save }, 'Save recipe'),
      h('a', { class: 'btn', href: '#/library/recipes' }, 'Cancel'),
      id !== 'new' && h('button', { type: 'button', class: 'btn danger', onclick: del }, 'Delete')
    )
  );
}
