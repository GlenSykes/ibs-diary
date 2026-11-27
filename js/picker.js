// Full-screen chooser for foods and recipes. Search, recent items, recipes,
// and the whole library by category. Tapping an item toggles it; the sheet
// stays open so a whole meal can be picked in one go.

import { h } from './ui.js';
import { CATEGORIES, tagLabel, FODMAP_TAGS } from './data.js';
import { foodForm } from './foodform.js';

const FODMAP_KEYS = new Set(FODMAP_TAGS.map((t) => t.key));
const keyOf = (kind, id) => kind + ':' + id;

/**
 * opts: {
 *   foods, recipes, recent: [{kind,id}], includeRecipes,
 *   selected: Set of "kind:id", onToggle(item, isSelected), onDone()
 * }
 * item: {kind: 'food'|'recipe', id, name}
 */
export function openPicker(opts) {
  let { foods, recipes } = opts;
  const { selected, includeRecipes = true } = opts;
  let tab = opts.recent.length ? 'recent' : 'all';
  let query = '';

  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Choose food' });
  const search = h('input', {
    type: 'search',
    class: 'text-input search',
    placeholder: includeRecipes ? 'Search foods and recipes' : 'Search foods',
    autocomplete: 'off',
    oninput: () => {
      query = search.value.trim().toLowerCase();
      render();
    },
  });
  const doneBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => close() }, 'Done');
  const tabs = h('div', { class: 'tabs' });
  const list = h('div', { class: 'pick-list' });

  sheet.append(h('div', { class: 'sheet-head' }, search, doneBtn), tabs, list);
  document.body.append(sheet);
  document.body.classList.add('sheet-open');

  // Android's back button closes the sheet rather than leaving the screen.
  history.pushState({ sheet: true }, '');
  const teardown = () => {
    window.removeEventListener('popstate', teardown);
    sheet.remove();
    document.body.classList.remove('sheet-open');
    opts.onDone?.();
  };
  window.addEventListener('popstate', teardown);
  const close = () => history.back();

  const foodById = () => new Map(foods.map((f) => [f.id, f]));
  const recipeById = () => new Map(recipes.map((r) => [r.id, r]));

  function row(kind, rec) {
    const k = keyOf(kind, rec.id);
    const fodmaps = kind === 'food' ? (rec.tags || []).filter((t) => FODMAP_KEYS.has(t)) : [];
    const sub =
      kind === 'recipe'
        ? `Recipe · ${rec.items.length} ingredient${rec.items.length === 1 ? '' : 's'}`
        : fodmaps.length
          ? fodmaps.map(tagLabel).join(', ')
          : '';
    return h(
      'button',
      {
        type: 'button',
        class: 'pick-row',
        'aria-pressed': String(selected.has(k)),
        onclick: (e) => {
          const on = !selected.has(k);
          on ? selected.add(k) : selected.delete(k);
          e.currentTarget.setAttribute('aria-pressed', String(on));
          opts.onToggle({ kind, id: rec.id, name: rec.name }, on);
          updateDone();
        },
      },
      h('span', { class: 'pick-name' }, rec.name, sub ? h('span', { class: 'pick-sub' }, sub) : null),
      h('span', { class: 'pick-check', 'aria-hidden': 'true' })
    );
  }

  function updateDone() {
    doneBtn.textContent = selected.size ? `Done (${selected.size})` : 'Done';
  }

  function addNewButton(name) {
    return h(
      'button',
      { type: 'button', class: 'btn add-new', onclick: () => quickAdd(name) },
      name ? `Add "${name}" to the library` : 'Add a new food to the library'
    );
  }

  function quickAdd(name) {
    list.replaceChildren(
      h('h3', { class: 'section-title' }, 'New food'),
      foodForm(
        { name: name ? name[0].toUpperCase() + name.slice(1) : '' },
        {
          allFoods: foods,
          onCancel: render,
          onSave: (food) => {
            foods = [...foods, food];
            opts.onFoodCreated?.(food);
            selected.add(keyOf('food', food.id));
            opts.onToggle({ kind: 'food', id: food.id, name: food.name }, true);
            search.value = '';
            query = '';
            updateDone();
            render();
          },
        }
      )
    );
  }

  function render() {
    tabs.replaceChildren(
      ...[
        ['recent', 'Recent'],
        includeRecipes && ['recipes', 'Recipes'],
        ['all', 'All foods'],
      ]
        .filter(Boolean)
        .map(([key, label]) =>
          h(
            'button',
            {
              type: 'button',
              class: 'tab',
              'aria-selected': String(!query && tab === key),
              onclick: () => {
                tab = key;
                search.value = '';
                query = '';
                render();
              },
            },
            label
          )
        )
    );

    const out = [];
    if (query) {
      const score = (n) => {
        const s = n.toLowerCase();
        if (s.startsWith(query)) return 0;
        if (s.split(/[\s(/,-]+/).some((w) => w.startsWith(query))) return 1;
        return s.includes(query) ? 2 : -1;
      };
      const hits = [
        ...(includeRecipes ? recipes.map((r) => ['recipe', r]) : []),
        ...foods.map((f) => ['food', f]),
      ]
        .map(([k, r]) => [k, r, score(r.name)])
        .filter((x) => x[2] >= 0)
        .sort((a, b) => a[2] - b[2] || a[1].name.localeCompare(b[1].name));
      hits.forEach(([k, r]) => out.push(row(k, r)));
      if (!hits.length) out.push(h('p', { class: 'empty' }, 'Nothing matches.'));
      out.push(addNewButton(search.value.trim()));
    } else if (tab === 'recent') {
      const fm = foodById();
      const rm = recipeById();
      const items = opts.recent
        .map((r) => (r.kind === 'food' ? ['food', fm.get(r.id)] : ['recipe', rm.get(r.id)]))
        .filter(([k, r]) => r && (k === 'food' || includeRecipes));
      if (!items.length) out.push(h('p', { class: 'empty' }, 'Things you log will show up here.'));
      items.forEach(([k, r]) => out.push(row(k, r)));
    } else if (tab === 'recipes') {
      if (!recipes.length)
        out.push(h('p', { class: 'empty' }, 'No recipes yet. Make them in Library → Recipes.'));
      [...recipes].sort((a, b) => a.name.localeCompare(b.name)).forEach((r) => out.push(row('recipe', r)));
    } else {
      for (const c of CATEGORIES) {
        const inCat = foods.filter((f) => f.category === c.key).sort((a, b) => a.name.localeCompare(b.name));
        if (!inCat.length) continue;
        out.push(h('h3', { class: 'section-title' }, c.label));
        inCat.forEach((f) => out.push(row('food', f)));
      }
      out.push(addNewButton(''));
    }
    list.replaceChildren(...out);
    list.scrollTop = 0;
  }

  updateDone();
  render();
}
