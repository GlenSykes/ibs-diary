// Small UI toolkit: element builder, controls, formatting, file saving.
// Text is always set with textContent, never innerHTML, so food names can
// contain anything safely.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/**
 * Row of buttons where exactly one (or none) is selected.
 * options: [{value, label, sub?}]. Returns {el, get(), set(v)}.
 */
export function choice(options, value, { onChange, cls = '' } = {}) {
  let current = value;
  const buttons = options.map((o) =>
    h(
      'button',
      {
        type: 'button',
        class: 'choice-btn',
        'aria-pressed': String(o.value === current),
        onclick: () => {
          current = o.value;
          sync();
          onChange?.(current);
        },
      },
      h('span', { class: 'choice-main' }, o.label),
      o.sub ? h('span', { class: 'choice-sub' }, o.sub) : null
    )
  );
  const sync = () =>
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === current)));
  return {
    el: h('div', { class: 'choice ' + cls, role: 'group' }, buttons),
    get: () => current,
    set: (v) => {
      current = v;
      sync();
    },
  };
}

/** A labelled 1..5 (or 0..3) scale built from a label array. */
export function scale(labels, value, start = 1, opts = {}) {
  return choice(
    labels.map((label, i) => ({ value: i + start, label: String(i + start), sub: label })),
    value,
    { cls: 'scale', ...opts }
  );
}

export function field(label, control, hint) {
  return h(
    'div',
    { class: 'field' },
    h('div', { class: 'field-label' }, label),
    control,
    hint ? h('div', { class: 'field-hint' }, hint) : null
  );
}

// ---- time ------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');

export function toLocalInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "When" control: a date-time input plus quick "earlier" buttons. */
export function timeField(ms, label = 'When') {
  const input = h('input', { type: 'datetime-local', class: 'time-input', value: toLocalInput(ms) });
  const shift = (mins) => {
    input.value = toLocalInput(Date.now() - mins * 60000);
  };
  const quick = h(
    'div',
    { class: 'quick-times' },
    [
      ['Now', 0],
      ['30 min ago', 30],
      ['1 h ago', 60],
      ['2 h ago', 120],
    ].map(([l, m]) => h('button', { type: 'button', class: 'chip', onclick: () => shift(m) }, l))
  );
  return {
    el: field(label, h('div', {}, input, quick)),
    get: () => {
      const t = new Date(input.value).getTime();
      return Number.isFinite(t) ? t : Date.now();
    },
  };
}

export const fmtTime = (ms) =>
  new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function fmtDay(ms) {
  const d = new Date(ms);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ---- feedback --------------------------------------------------------------

export function toast(msg) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2200);
}

// ---- files -----------------------------------------------------------------

export const canShareFiles = () => {
  try {
    return !!navigator.canShare?.({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] });
  } catch {
    return false;
  }
};

/** Download a file. Returns true when done. */
export function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

/** Open the phone's share sheet. Returns true if shared, false if cancelled. */
// If the phone will not share this file, it is downloaded instead, so the tap
// never ends with nothing saved. Returns true once the file is shared or saved.
export async function shareFile(name, text, type) {
  const file = new File([text], name, { type });
  const fallback = (why) => {
    downloadFile(name, text, type);
    toast(`${why}, so it was saved to Downloads instead`);
    return true;
  };
  try {
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return fallback('This phone could not share that file');
    await navigator.share({ files: [file], title: name });
    return true;
  } catch (e) {
    if (e.name === 'AbortError') return false; // you closed the share sheet
    return fallback('Sharing failed');
  }
}
