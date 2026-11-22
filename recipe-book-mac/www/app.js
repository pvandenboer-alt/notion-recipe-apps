"use strict";
/* Recipe book for Mac: a desktop reader for the Notion Recipe book database. Read-only, like the Android app:
   recipes are added and edited with the Recipe book skill. The Notion, recipe-data and quantity code mirrors
   recipe-book/www/app.js; keep the two in step when the App data format changes. */

/* ---------- config & storage ---------- */
const API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2025-09-03';
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } }
};
const cfg = Object.assign({ token: '', ds: '', db: '', sort: 'name', nosb: false, closed: { Tags: true, Equipment: true } }, ls.get('rbm.cfg') || {});
const saveCfg = () => ls.set('rbm.cfg', cfg);
const native = window.rb || null;
if (native) document.documentElement.classList.add('native');

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const sidebar = $('#sidebar'), toolbar = $('#toolbar'), main = $('#main'), overlay = $('#overlay'), alertsEl = $('#alerts');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).trim().replace(',', '.')); return isFinite(n) ? n : null; };
const mmss = s => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0'); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cleanId = id => String(id || '').replace(/-/g, '');
const dateStr = d => { if (!d) return ''; const x = new Date(String(d).slice(0, 10) + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); };
const ago = t => { const s = (Date.now() - t) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return dateStr(new Date(t).toISOString()); };
const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();   // search ignores accents (Dutch recipes)
const httpUrl = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : '';
/* Shopify's CDN can resize: ask for a sensible size instead of the original (often 5000+ px). */
const imgUrl = (u, w = 1400) => /\/cdn\/shop\//.test(u) && !/[?&]width=/.test(u) ? u + (u.includes('?') ? '&' : '?') + 'width=' + w : u;
const trimNum = (v, d) => String(+Number(v).toFixed(d));
const svg = (d, extra = '') => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const I = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  next: svg('<path d="M9 18l6-6-6-6"/>'),
  sidebar: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M9.5 4.5v15"/>'),
  refresh: svg('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 'stroke-width="2"'),
  tick: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  timer: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M10 3h4M18.5 6.5l1.5-1.5"/>'),
  book: svg('<path d="M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10.5"/>'),
  sparkle: svg('<path d="M12 4l1.8 4.7L18.5 10.5l-4.7 1.8L12 17l-1.8-4.7L5.5 10.5l4.7-1.8z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
  pot: svg('<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 10h2M20 10h2M9 4.5c0 1 1 1.5 1 2.5M13 4.5c0 1 1 1.5 1 2.5"/>'),
  star: svg('<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>'),
  bolt: svg('<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>'),
  flag: svg('<path d="M5 21V4.5M5 4.5h11l-2 4 2 4H5"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>', 'stroke-width="2"'),
  play: '<svg class="i" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg class="i" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5.5" width="4" height="13" rx="1"/><rect x="13.5" y="5.5" width="4" height="13" rx="1"/></svg>',
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  notion: svg('<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M9 16.5v-9l6 9v-9"/>'),
  minus: svg('<path d="M6 12h12"/>', 'stroke-width="2"'),
  plus: svg('<path d="M12 6v12M6 12h12"/>', 'stroke-width="2"'),
  sort: svg('<path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3"/>')
};

/* Notion option colours. Refreshed from the database on every sync; these cover the first start. */
const FALLBACK_SCHEMA = {
  Course: [['Main', 'red'], ['Side', 'orange'], ['Starter', 'yellow'], ['Soup', 'brown'], ['Salad', 'green'], ['Breakfast', 'yellow'], ['Lunch', 'blue'], ['Snack', 'pink'], ['Baking', 'brown'], ['Dessert', 'purple'], ['Sauce', 'gray'], ['Drink', 'blue']],
  Cuisine: [['Chinese', 'red'], ['Asian', 'orange'], ['Dutch', 'orange'], ['American', 'blue'], ['Italian', 'green'], ['French', 'blue'], ['Indian', 'yellow'], ['Mexican', 'red'], ['Japanese', 'pink'], ['Thai', 'green'], ['Middle Eastern', 'brown'], ['Australian', 'yellow'], ['German', 'gray']],
  'Main ingredient': [['Beef', 'red'], ['Pork', 'pink'], ['Chicken', 'yellow'], ['Lamb', 'brown'], ['Fish', 'blue'], ['Seafood', 'blue'], ['Eggs', 'yellow'], ['Vegetables', 'green'], ['Mushrooms', 'brown'], ['Rice', 'gray'], ['Pasta', 'orange'], ['Bread & dough', 'brown'], ['Chocolate', 'brown']],
  Tags: [['Quick', 'green'], ['Weeknight', 'green'], ['Make-ahead', 'blue'], ['Freezer-friendly', 'blue'], ['Party', 'purple'], ['Kids', 'pink'], ['Vegetarian', 'green'], ['Gluten-free option', 'gray'], ['Spicy', 'red'], ['Comfort food', 'orange'], ['Outdoor', 'brown'], ['Festive', 'red']],
  Equipment: [['Wok', 'red'], ['Oven', 'orange'], ['Pizza oven', 'orange'], ['BBQ', 'brown'], ['Cast iron pan', 'gray'], ['Air fryer', 'blue'], ['Slow cooker', 'brown'], ['Stand mixer', 'purple'], ['Food processor', 'gray'], ['Waffle iron', 'yellow']]
};
/* The Notion database this app reads: found by these columns, or created with this schema on first setup. */
const BOOK = {
  name: 'Recipe book', icon: '📖', marker: ['Course', 'Servings', 'Times cooked'],
  createNote: 'This needs the integration to have "Insert content"; reading recipes afterwards only needs "Read content".',
  schema: () => {
    const n = { number: { format: 'number' } }, t = { rich_text: {} };
    const opts = prop => FALLBACK_SCHEMA[prop].map(([name, color]) => ({ name, color }));
    return {
      'Name': { title: {} },
      'Status': { select: { options: [{ name: 'To review', color: 'yellow' }, { name: 'Ready', color: 'green' }] } },
      'Course': { select: { options: opts('Course') } },
      'Cuisine': { multi_select: { options: opts('Cuisine') } },
      'Main ingredient': { multi_select: { options: opts('Main ingredient') } },
      'Tags': { multi_select: { options: opts('Tags') } },
      'Equipment': { multi_select: { options: opts('Equipment') } },
      'Servings': n, 'Yield': t, 'Prep (min)': n, 'Cook (min)': n, 'Total (min)': n,
      'Key ingredients': t, 'Source': t, 'Link': { url: {} },
      'Language': { select: { options: [{ name: 'English', color: 'blue' }, { name: 'Dutch', color: 'orange' }] } },
      'Rating': { select: { options: [1, 2, 3, 4, 5].map(i => ({ name: '★'.repeat(i), color: 'yellow' })) } },
      'Last cooked': { date: {} }, 'Times cooked': n,
      'Updated': { last_edited_time: {} }
    };
  }
};
const options = prop => (state.schema && state.schema[prop]) || FALLBACK_SCHEMA[prop] || [];
const colourOf = (prop, name) => { const o = options(prop).find(x => x[0] === name); const c = o && o[1]; return !c || c === 'default' ? 'gray' : c; };
const pill = (prop, name) => `<span class="pill ${colourOf(prop, name)}">${esc(name)}</span>`;
const starsHtml = n => n ? `<span class="stars" aria-label="${n} out of 5">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>` : '';

/* ---------- quantities ---------- */
/* Units the scaler changes; anything else (cup, can, pinch…) stays as written. An empty unit is a count. */
const UNIT = { g: 'g', gr: 'g', gram: 'g', grams: 'g', kg: 'kg', ml: 'ml', l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l', tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', tl: 'tsp', tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', el: 'tbsp', '': '' };
const FR_SPOON = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, '']];
const FR_COUNT = FR_SPOON.filter(f => f[0] !== 1 / 8);
function kitchen(v, set = FR_SPOON) {
  if (v == null || !isFinite(v)) return '';
  if (v >= 10) return String(Math.round(v));
  let whole = Math.floor(v), best = set[0];
  const frac = v - whole;
  for (const f of set) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  if (best[0] === 1) { whole += 1; best = set[0]; }
  if (!whole && !best[1]) return v > 0 ? set[1][1] : '0';
  return (whole || '') + best[1];
}
const roundSmall = b => b < 10 ? Math.round(b * 2) / 2 : b < 100 ? Math.round(b) : Math.round(b / 5) * 5;
function amountText(it, f) {
  const q = num(it.qty), qm = num(it.qtyMax), u = String(it.unit || '').trim();
  if (q == null) return { txt: u, unscaled: false };
  const k = UNIT[u.toLowerCase()];
  const ff = k === undefined ? 1 : f;
  const a = q * ff, b = qm != null ? qm * ff : null;
  const range = (x, y, fn) => fn(x) + (y != null ? '–' + fn(y) : '');
  let txt;
  if (k === 'g' || k === 'kg' || k === 'ml' || k === 'l') {
    if (ff === 1) txt = range(q, qm, x => trimNum(x, 2)) + ' ' + u;
    else {
      const small = k === 'g' || k === 'kg' ? 'g' : 'ml', mul = k === 'kg' || k === 'l' ? 1000 : 1;
      const A = a * mul, B = b != null ? b * mul : null;
      if ((B ?? A) >= 1000) txt = range(A, B, x => trimNum(x / 1000, 2)) + ' ' + (small === 'g' ? 'kg' : k === 'l' ? u : 'L');
      else txt = range(A, B, x => trimNum(roundSmall(x), 1)) + ' ' + (k === small ? u : small);
    }
  } else if (k === 'tsp' || k === 'tbsp') txt = range(a, b, x => kitchen(x)) + ' ' + u;
  else if (k === '') txt = range(a, b, x => kitchen(x, FR_COUNT));
  else txt = range(q, qm, x => kitchen(x)) + ' ' + u;
  return { txt, unscaled: k === undefined && f !== 1 };
}
const fmtMin = m => { m = num(m); if (m == null) return ''; if (m < 60) return (m % 1 ? kitchen(m) : m) + ' min'; const h = Math.floor(m / 60), r = Math.round(m % 60); return h + ' h' + (r ? ' ' + r + ' min' : ''); };

/* ---------- Notion API ---------- */
/* Notion doesn't allow browser requests (CORS), so on the Mac they go through the app (main.js). */
async function send(url, opts) {
  if (!native) return fetch(url, opts);
  const r = await native.http({ url, method: opts.method, headers: opts.headers, body: opts.body });
  if (r.error) throw new TypeError(r.error);
  return { ok: r.status >= 200 && r.status < 300, status: r.status, statusText: '', headers: { get: k => /retry-after/i.test(k) ? r.retryAfter : null }, json: async () => JSON.parse(r.text) };
}
async function napi(path, { method = 'GET', body, read = false } = {}) {
  if (!cfg.token) throw { code: 'no_token' };
  const headers = { Authorization: 'Bearer ' + cfg.token, 'Notion-Version': NOTION_VERSION };
  const opts = { method, headers };
  if (body) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try { res = await send(API + path, opts); }
    catch (e) { if (read && attempt === 0) { await sleep(800); continue; } throw { code: 'offline', message: String(e && e.message || e) }; }
    if (res.status === 429) { await sleep((num(res.headers.get('Retry-After')) || 1) * 1000 + 200); continue; }
    let data = null; try { data = await res.json(); } catch { }
    if (res.ok) return data;
    if (res.status >= 500 && read && attempt === 0) { await sleep(900); continue; }
    throw { code: (data && data.code) || 'http_' + res.status, status: res.status, message: (data && data.message) || res.statusText || '' };
  }
  throw { code: 'rate_limited' };
}
const ERRORS = {
  no_token: 'Connect your Notion account in Settings first.',
  unauthorized: 'Notion rejected the connection key. Paste a fresh one in Settings.',
  object_not_found: 'The app can\'t see your Recipe book database. In Notion, open Recipe book, click ••• → Connections and add your integration.',
  restricted_resource: 'Your integration doesn\'t have access to Recipe book yet. In Notion, open Recipe book, click ••• → Connections and add it.',
  offline: 'No connection. You\'re seeing your saved copy.',
  rate_limited: 'Notion is busy. Try again in a minute.',
  bad_app_data: 'The App data block on this page isn\'t valid JSON. Save the recipe again with the Recipe book skill.'
};
const errText = e => ERRORS[e && e.code] || ('Notion error' + (e && e.message ? ': ' + String(e.message).slice(0, 160) : '. Try again.'));

const rtText = arr => (arr || []).map(t => t.plain_text ?? t.text?.content ?? '').join('');
function propVal(p) {
  if (!p) return null;
  switch (p.type) {
    case 'title': return rtText(p.title);
    case 'rich_text': return rtText(p.rich_text);
    case 'number': return p.number;
    case 'url': return p.url || '';
    case 'select': return p.select ? p.select.name : '';
    case 'multi_select': return (p.multi_select || []).map(o => o.name);
    case 'date': return p.date ? p.date.start : null;
    default: return null;
  }
}
const coverOf = c => c ? httpUrl(c.external?.url || c.file?.url) : '';
function pageToSummary(pg) {
  const P = pg.properties || {}; const v = k => propVal(P[k]);
  const stars = (String(v('Rating') || '').match(/★/g) || []).length || null;
  return {
    id: cleanId(pg.id), url: pg.url, updated: pg.last_edited_time, created: pg.created_time,
    name: v('Name') || 'Untitled recipe', review: v('Status') === 'To review',
    course: v('Course') || '', cuisine: v('Cuisine') || [], main: v('Main ingredient') || [], tags: v('Tags') || [], equipment: v('Equipment') || [],
    prepMin: v('Prep (min)'), cookMin: v('Cook (min)'), totalMin: v('Total (min)'), servings: v('Servings'), rating: stars,
    keyIngredients: v('Key ingredients') || '', source: v('Source') || '', link: v('Link') || '',
    timesCooked: v('Times cooked') || 0, lastCooked: v('Last cooked') || '',
    cover: coverOf(pg.cover), icon: pg.icon && pg.icon.type === 'emoji' ? pg.icon.emoji : ''
  };
}
async function queryAll() {
  const out = []; let cursor = null, guard = 0;
  do {
    const d = await napi(`/data_sources/${cfg.ds}/query`, { method: 'POST', body: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }, read: true });
    out.push(...(d.results || []).filter(p => p.object === 'page' && !p.in_trash));
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor && ++guard < 50);
  return out;
}
async function children(id) {
  const out = []; let cursor = null, guard = 0;
  do {
    const d = await napi(`/blocks/${id}/children?page_size=100${cursor ? '&start_cursor=' + encodeURIComponent(cursor) : ''}`, { read: true });
    out.push(...(d.results || []));
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor && ++guard < 50);
  return out;
}
const blockText = b => { const v = b && b[b.type]; return v ? rtText(v.rich_text) : ''; };
/* The skill writes the JSON across several lines (Notion splits long code text), sometimes mid-value: strip leading tabs and join without a separator. */
function parseJsonText(s) {
  const raw = String(s).split('\n').map(l => l.replace(/^\t+/, '')).join('');
  try { const d = JSON.parse(raw); return d && typeof d === 'object' && !Array.isArray(d) ? d : null; } catch { return null; }
}
/* Only the "App data" toggle is read; the readable part of the page is for people. */
async function readAppData(id) {
  const blocks = await children(id);
  const holders = blocks.filter(b => (/^heading_/.test(b.type) || b.type === 'toggle') && b.has_children && /app data/i.test(blockText(b)));
  let sawCode = false;
  for (const h of holders.reverse()) {
    const code = (await children(h.id)).find(k => k.type === 'code');
    if (!code) continue;
    sawCode = true;
    const d = parseJsonText(rtText(code.code.rich_text));
    if (d) return d;
  }
  throw { code: sawCode ? 'bad_app_data' : 'no_app_data' };
}
async function syncSchema() {
  try {
    const d = await napi(`/data_sources/${cfg.ds}`, { read: true });
    const out = {};
    for (const [k, p] of Object.entries(d.properties || {})) { const o = p && p[p.type] && p[p.type].options; if (Array.isArray(o)) out[k] = o.map(x => [x.name, x.color]); }
    if (Object.keys(out).length) { state.schema = out; ls.set('rbm.schema', out); }
  } catch { }
}

/* ---------- recipe data ---------- */
function normalise(o) {
  const s = v => v == null ? '' : String(v);
  const arr = v => Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : [];
  const strs = v => Array.isArray(v) ? v.map(x => typeof x === 'string' ? x : x && typeof x === 'object' ? [x.label, x.text].filter(Boolean).join(': ') : s(x)).map(x => x.trim()).filter(Boolean) : (typeof v === 'string' && v.trim() ? [v.trim()] : []);
  const item = x => typeof x === 'string' ? { qty: null, qtyMax: null, unit: '', item: x, note: '', optional: false }
    : { qty: num(x.qty), qtyMax: num(x.qtyMax), unit: s(x.unit).trim(), item: s(x.item).trim(), note: s(x.note).trim(), optional: !!x.optional };
  return {
    v: num(o.v), name: s(o.name).trim() || 'Untitled recipe', source: s(o.source).trim(), author: s(o.author).trim(), link: httpUrl(o.link), language: s(o.language),
    course: s(o.course).trim(), cuisine: strs(o.cuisine), mainIngredients: strs(o.mainIngredients), tags: strs(o.tags), equipment: strs(o.equipment), equipmentNote: s(o.equipmentNote).trim(),
    servings: num(o.servings), yield: s(o.yield).trim(), prepMin: num(o.prepMin), cookMin: num(o.cookMin), totalMin: num(o.totalMin), timeNote: s(o.timeNote).trim(), kcal: num(o.kcal),
    glance: strs(o.glance), about: s(o.about), keyIngredients: strs(o.keyIngredients),
    ingredients: arr(o.ingredients).map(g => ({ group: s(g.group).trim(), items: (Array.isArray(g.items) ? g.items : []).filter(x => x && (typeof x === 'string' || typeof x === 'object')).map(item).filter(x => x.item || x.qty != null) })).filter(g => g.items.length),
    steps: arr(o.steps).map(x => ({ title: s(x.title).trim(), text: s(x.text).trim(), timerMin: num(x.timerMin) > 0 ? num(x.timerMin) : null })).filter(x => x.title || x.text),
    tips: (Array.isArray(o.tips) ? o.tips : []).map(x => typeof x === 'string' ? { label: '', text: x } : x && typeof x === 'object' ? { label: s(x.label).trim(), text: s(x.text).trim() } : null).filter(x => x && (x.label || x.text)),
    storage: strs(o.storage), serveWith: s(o.serveWith).trim(), notes: s(o.notes), uncertain: strs(o.uncertain),
    cooks: arr(o.cooks).map(x => ({ date: s(x.date).slice(0, 10), servings: num(x.servings), rating: num(x.rating), notes: s(x.notes) })).sort((a, b) => b.date.localeCompare(a.date)),
    rating: num(o.rating) >= 1 ? Math.min(5, Math.round(num(o.rating))) : null, cover: httpUrl(o.cover), icon: s(o.icon), review: !!o.review,
    /* Photos: web images are https links; photos uploaded to Notion are notion-file-block:// references resolved below. */
    images: arr(o.images).map(x => ({ url: s(x.url).trim(), caption: s(x.caption).trim(), step: num(x.step) >= 1 ? Math.round(num(x.step)) : null }))
      .filter(x => /^https:\/\//i.test(x.url) || /^notion-file-block:/i.test(x.url))
  };
}

/* Photos uploaded to Notion live at short-lived signed URLs: look each one up by its block ID, and again after 50 minutes. */
const FILE_TTL = 50 * 60 * 1000;
const fileUrls = {}, filePending = {};
const blockIdOf = u => { const m = String(u).match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i); return m ? cleanId(m[0]) : ''; };
function srcOf(u) {
  if (/^https:\/\//i.test(u)) return u;
  const f = fileUrls[blockIdOf(u)];
  return f && Date.now() - f.at < FILE_TTL ? f.url : '';
}
async function resolveFiles(r) {
  const todo = [...new Set(r.images.map(x => x.url).filter(u => !/^https:/i.test(u)).map(blockIdOf).filter(Boolean))]
    .filter(id => !filePending[id] && !(fileUrls[id] && Date.now() - fileUrls[id].at < FILE_TTL));
  if (!todo.length || !connected()) return;
  todo.forEach(id => { filePending[id] = 1; });
  await pool(todo, 3, async id => {
    try { const b = await napi('/blocks/' + id, { read: true }); const im = b && b.image; const url = im && (im.file?.url || im.external?.url); if (url) fileUrls[id] = { url, at: Date.now() }; }
    catch { }
    delete filePending[id];
  });
  if (route().id === r.id) renderMain(true);
}
/* Compare images ignoring query strings and WordPress/Shopify size suffixes, so the cover isn't shown twice. */
const imgKey = u => String(u).replace(/[?#].*$/, '').replace(/-\d+x\d+(?=\.\w+$)/, '').replace(/-scaled(?=\.\w+$)/, '').replace(/^.*\/opengraph\//, '/').split('/').pop();
function photosOf(r, sum) {
  const all = r.images.map(x => ({ ...x, src: srcOf(x.url) })).filter(x => x.src);
  let hero = r.cover || (sum && sum.cover) || '';
  let gallery = all.filter(x => !x.step);
  if (!hero && gallery.length) { hero = gallery[0].src; gallery = gallery.slice(1); }
  const hk = hero ? imgKey(hero) : '';
  gallery = gallery.filter(x => imgKey(x.src) !== hk);
  const bystep = {};
  for (const x of all) if (x.step) (bystep[x.step] = bystep[x.step] || []).push(x);
  return { hero, gallery, bystep };
}

/* ---------- state & sync ---------- */
const state = {
  recipes: ls.get('rbm.list') || [], syncedAt: ls.get('rbm.syncedAt') || 0, loaded: !!ls.get('rbm.list'), schema: ls.get('rbm.schema') || null,
  full: {}, fullErr: {}, listing: false, listErr: null,
  lib: { sec: 'all', fk: null, fv: null, q: '' },
  serv: ls.get('rbm.serv') || {}, timers: ls.get('rbm.timers') || {}, alerts: [], lastRoute: '', update: null, info: null
};
const route = () => { const h = location.hash.replace(/^#\/?/, ''); const [view, id] = h.split('/'); return { view: ['r', 'setup'].includes(view) ? view : 'list', id: view === 'r' && id ? decodeURIComponent(id) : null }; };
const getSum = id => state.recipes.find(r => r.id === id);
const connected = () => !!(cfg.token && cfg.ds);

async function syncList() {
  if (!connected() || state.listing) return;
  state.listing = true; state.listErr = null; renderSidebar();
  try {
    const [pages] = await Promise.all([queryAll(), syncSchema()]);
    const list = pages.map(pageToSummary);
    for (const s of list) {
      const c = ls.get('rbm.full.' + s.id);
      if (c && c.updated !== s.updated) { delete state.full[s.id]; delete tried[s.id]; }   // changed in Notion: fetch again
    }
    const keep = new Set(list.map(s => s.id));
    for (const old of state.recipes) if (!keep.has(old.id)) { ls.del('rbm.full.' + old.id); ls.del('rbm.cook.' + old.id); delete state.full[old.id]; }
    state.recipes = list; state.loaded = true; state.syncedAt = Date.now(); state.fullErr = {};
    ls.set('rbm.list', list); ls.set('rbm.syncedAt', state.syncedAt);
    prefetch();
  } catch (e) { state.listErr = e; }
  state.listing = false;
  renderSidebar();
  const r = route(); if (r.view === 'list') renderMain(true); else if (r.view === 'r' && !state.full[r.id]) renderMain(true);
}
/* Fetch every recipe after a sync so the whole book works offline. */
async function prefetch() {
  const todo = state.recipes.filter(r => !state.full[r.id]).map(r => r.id);
  let n = 0;
  await pool(todo, 2, async id => {
    try { await loadFull(id); } catch { }
    if (route().id === id) renderMain(true);
    else if (++n % 6 === 0 && route().view === 'list') renderMain(true);
  });
  if (todo.length && route().view === 'list') renderMain(true);
}
async function pool(items, n, fn) { let i = 0; const run = async () => { while (i < items.length) { const it = items[i++]; await fn(it); } }; await Promise.all(Array.from({ length: Math.min(n, items.length) }, run)); }
const inflight = {};
function loadFull(id) {
  if (inflight[id]) return inflight[id];
  inflight[id] = (async () => {
    try {
      const full = normalise(await readAppData(id)); full.id = id;
      const sum = getSum(id);
      state.full[id] = full; state.fullErr[id] = null;
      ls.set('rbm.full.' + id, { updated: sum ? sum.updated : '', data: full });
      return full;
    } catch (e) { state.fullErr[id] = e; throw e; }
    finally { delete inflight[id]; }
  })();
  return inflight[id];
}
const tried = {};
function openRecipe(id) {
  if (state.full[id] || !connected() || inflight[id] || state.fullErr[id]) return;
  if (tried[id] && Date.now() - tried[id] < 30000) return;
  tried[id] = Date.now();
  const again = () => { if (route().id === id) renderMain(false); };
  loadFull(id).then(again, again);
}
/* Library facets come from the database columns, with the recipe's own data as a fallback. */
const facet = (r, k, fk) => { const v = r[k]; if (Array.isArray(v) ? v.length : v) return v; const f = state.full[r.id]; return f ? f[fk || k] : v; };
const totalOf = r => { const t = num(facet(r, 'totalMin')); if (t != null) return t; const p = num(facet(r, 'prepMin')), c = num(facet(r, 'cookMin')); return p != null || c != null ? (p || 0) + (c || 0) : null; };
const iconFor = r => r.icon || (state.full[r.id] && state.full[r.id].icon) || '🍽️';
const ratingOf = r => r.rating || (state.full[r.id] && state.full[r.id].rating) || null;
const cookedOf = r => { const c = (state.full[r.id] && state.full[r.id].cooks) || []; return { n: r.timesCooked || c.length, last: r.lastCooked || (c[0] && c[0].date) || '' }; };
function cardImage(r) {
  if (r.cover) return r.cover;
  const f = state.full[r.id]; if (!f) return '';
  if (f.cover) return f.cover;
  const g = f.images.filter(x => !x.step).map(x => srcOf(x.url)).find(Boolean);
  return g || f.images.map(x => srcOf(x.url)).find(Boolean) || '';
}

/* ---------- library ---------- */
const SECTIONS = [
  ['all', 'All recipes', I.book, () => true],
  ['recent', 'Recently added', I.sparkle, () => true],
  ['quick', '30 minutes or less', I.bolt, r => { const t = totalOf(r); return t != null && t <= 30; }],
  ['fav', 'Favourites', I.star, r => (ratingOf(r) || 0) >= 4],
  ['cooked', 'Cooked before', I.pot, r => cookedOf(r).n > 0],
  ['review', 'To review', I.flag, r => r.review]
];
const FACETS = [['course', 'Course', 'course'], ['cuisine', 'Cuisine', 'cuisine'], ['main', 'Main ingredient', 'mainIngredients'], ['tags', 'Tags', 'tags'], ['equipment', 'Equipment', 'equipment']];
const facetVals = (r, k) => { const fd = FACETS.find(f => f[0] === k); const v = facet(r, k, fd && fd[2]); return Array.isArray(v) ? v : v ? [v] : []; };
const SORTS = {
  name: ['Name', (a, b) => fold(a.name).localeCompare(fold(b.name))],
  recent: ['Recently added', (a, b) => String(b.created || '').localeCompare(String(a.created || ''))],
  time: ['Quickest first', (a, b) => (totalOf(a) ?? 1e9) - (totalOf(b) ?? 1e9)],
  rating: ['Rating', (a, b) => (ratingOf(b) || 0) - (ratingOf(a) || 0)],
  last: ['Last cooked', (a, b) => String(cookedOf(b).last).localeCompare(String(cookedOf(a).last))]
};
function haystack(r) {
  const f = state.full[r.id];
  return fold([r.name, r.keyIngredients, r.source, r.course, ...(r.cuisine || []), ...(r.tags || []), ...(r.main || []),
    ...(f ? f.ingredients.flatMap(g => g.items.map(i => i.item)) : []), f ? f.author : ''].join(' '));
}
function libraryList() {
  const L = state.lib;
  const sec = SECTIONS.find(s => s[0] === L.sec) || SECTIONS[0];
  let list = state.recipes.filter(sec[3]);
  if (L.fk) list = list.filter(r => facetVals(r, L.fk).includes(L.fv));
  const words = fold(L.q).split(/\s+/).filter(Boolean);
  if (words.length) list = list.filter(r => { const h = haystack(r); return words.every(w => h.includes(w)); });
  const key = L.sec === 'recent' ? 'recent' : L.sec === 'cooked' ? 'last' : SORTS[cfg.sort] ? cfg.sort : 'name';
  list.sort((a, b) => SORTS[key][1](a, b) || SORTS.name[1](a, b));
  if (L.sec === 'recent' && !words.length) list = list.slice(0, 24);
  return list;
}
const libTitle = () => { const L = state.lib; if (L.fk) return L.fv; return (SECTIONS.find(s => s[0] === L.sec) || SECTIONS[0])[1]; };

/* ---------- rendering ---------- */
function render() {
  try {
    const r = route(); const key = r.view + '/' + (r.id || '');
    if (!connected() && r.view !== 'setup') { location.replace('#/setup'); return; }
    document.body.classList.toggle('setup', r.view === 'setup');
    document.body.classList.toggle('nosb', !!cfg.nosb);
    renderSidebar();
    const fromList = state.lastRoute.startsWith('list/');
    if (fromList && key !== state.lastRoute) state.libY = main.scrollTop;
    renderMain(key === state.lastRoute);
    if (r.view === 'list' && !fromList && state.libY) main.scrollTop = state.libY;   // back from a recipe: same place in the grid
    if (key !== state.lastRoute) closeOverlay();
    state.lastRoute = key;
    updateAwake();
  } catch (err) { console.error(err); renderCrash(err); }
}
function renderCrash(err) {
  toolbar.innerHTML = '';
  main.innerHTML = `<div class="empty"><div class="big">⚠️</div><h3>Something went wrong</h3><p>${esc(err && err.message || err)}</p><p><button class="btn primary" id="crash-reset">Clear saved recipes and reload</button></p></div>`;
  $('#crash-reset').addEventListener('click', () => {
    try { Object.keys(localStorage).filter(k => /^rbm\.(full\.|cook\.|list$|syncedAt$|schema$|serv$)/.test(k)).forEach(k => ls.del(k)); } catch { }
    location.hash = ''; location.reload();
  });
}
window.addEventListener('hashchange', render);
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2800); }
function errorCallout(e, retry) {
  return `<div class="callout red"><div class="ci">⚠️</div><div class="cb">${esc(errText(e))}${retry ? `<div class="actions"><button class="btn small" data-act="${retry}">Try again</button>${e && ['object_not_found', 'restricted_resource', 'unauthorized'].includes(e.code) ? '<button class="btn small ghost" data-act="settings">Settings</button>' : ''}</div>` : ''}</div></div>`;
}

/* A photo that won't load (offline, moved, expired link) falls back to the recipe's emoji or disappears. Inline onerror handlers are blocked by the page's CSP. */
document.addEventListener('error', e => {
  const img = e.target; if (!img || img.tagName !== 'IMG' || !img.dataset.err) return;
  const kind = img.dataset.err, box = img.parentNode;
  if (kind === 'card') { box.classList.add('noimg'); img.remove(); }
  else if (kind === 'hero') { box.classList.add('noimg'); box.removeAttribute('data-act'); img.remove(); const ic = box.querySelector('.heroicon'); if (ic) { ic.className = ''; if (!ic.textContent) ic.textContent = '🍽️'; } }
  else box.remove();
}, true);

/* ---------- sidebar ---------- */
function renderSidebar() {
  if (route().view === 'setup') { sidebar.innerHTML = ''; return; }
  const qf = document.activeElement && document.activeElement.id === 'q' ? document.activeElement.selectionStart : null;
  const scroll = sidebar.querySelector('.sbscroll')?.scrollTop || 0;
  drawSidebar();
  const sc = sidebar.querySelector('.sbscroll'); if (sc) sc.scrollTop = scroll;
  if (qf !== null) { const q = $('#q'); q.focus(); q.setSelectionRange(qf, qf); }
}
function drawSidebar() {
  const L = state.lib, onList = route().view === 'list';
  const count = fn => state.recipes.filter(fn).length;
  const secs = SECTIONS.map(([k, label, icon, fn]) => {
    const n = k === 'recent' ? '' : count(fn);
    if (k !== 'all' && k !== 'recent' && !n) return '';
    const on = onList && L.sec === k && !L.fk;
    return `<button class="sbi ${on ? 'on' : ''}" data-act="sec" data-k="${k}">${icon}<span class="sbl">${esc(label)}</span><span class="sbn">${n}</span></button>`;
  }).join('');
  const groups = FACETS.map(([k, label]) => {
    const counts = {};
    for (const r of state.recipes) for (const v of facetVals(r, k)) counts[v] = (counts[v] || 0) + 1;
    const prop = label;
    const order = options(prop).map(o => o[0]);
    const vals = Object.keys(counts).sort((a, b) => k === 'course' ? (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) : a.localeCompare(b));
    if (!vals.length) return '';
    const closed = cfg.closed[label];
    return `<div class="sbg ${closed ? 'closed' : ''}"><button class="sbh" data-act="grp" data-k="${esc(label)}">${esc(label)}${I.chev}</button>
      <div class="sbitems">${vals.map(v => `<button class="sbi sub ${onList && L.fk === k && L.fv === v ? 'on' : ''}" data-act="facet" data-k="${k}" data-v="${esc(v)}"><span class="dot ${colourOf(prop, v)}"></span><span class="sbl">${esc(v)}</span><span class="sbn">${counts[v]}</span></button>`).join('')}</div></div>`;
  }).join('');
  const syncLine = state.listing ? 'Syncing…' : state.listErr ? (state.listErr.code === 'offline' ? 'Offline' : 'Sync failed') : state.syncedAt ? 'Synced ' + ago(state.syncedAt) : 'Not synced yet';
  sidebar.innerHTML = `
    <div class="sbtop"></div>
    <label class="search">${I.search}<input id="q" type="search" placeholder="Search recipes" value="${esc(L.q)}" autocomplete="off" spellcheck="false"></label>
    <nav class="sbscroll">
      <div class="sbsecs">${secs}</div>
      ${groups}
    </nav>
    <div class="sbfoot">
      ${state.update ? `<button class="update" data-act="update">${I.sparkle}<span>Version ${esc(state.update.version)} is available</span></button>` : ''}
      <div class="sbfrow">
        <button class="ibtn ${state.listing ? 'spin' : ''}" data-act="sync" title="Sync with Notion (⌘R)">${I.refresh}</button>
        <span class="synctext ${state.listErr ? 'bad' : ''}" title="${esc(state.listErr ? errText(state.listErr) : '')}">${esc(syncLine)}</span>
        <button class="ibtn" data-act="settings" title="Settings (⌘,)">${I.gear}</button>
      </div>
    </div>`;
}

/* ---------- toolbar ---------- */
function timerPills() {
  const list = Object.entries(state.timers).filter(([, t]) => t.running || t.fired).sort((a, b) => (a[1].endAt || 0) - (b[1].endAt || 0));
  return list.map(([k, t]) => `<button class="tpill ${t.fired ? 'done' : ''}" data-act="gotimer" data-k="${esc(k)}" title="${esc(t.recipe)}">${I.timer}<span class="tl">${esc(t.label)}</span><b data-clock="${esc(k)}">${t.fired ? 'Done' : mmss(tLeft(t))}</b></button>`).join('');
}
function renderToolbar() {
  const r = route();
  const sbBtn = `<button class="ibtn sbtoggle" data-act="sidebar" title="Show or hide the sidebar (⌃⌘S)">${I.sidebar}</button>`;
  let left = '', mid = '';
  if (r.view === 'r') {
    const f = state.full[r.id], sum = getSum(r.id);
    left = `<button class="ibtn" data-act="back" title="Back to library (⌘[)">${I.back}</button><div class="tbtitle fade">${esc((f && f.name) || (sum && sum.name) || '')}</div>`;
    const ck = f && ckGet(r.id);
    if (f && ck.cur >= 0 && f.steps.length) {
      const n = f.steps.length, i = Math.min(ck.cur, n - 1);
      mid = `<div class="cookbar"><button class="ibtn" data-act="step" data-d="-1" ${i <= 0 ? 'disabled' : ''} title="Previous step (←)">${I.back}</button>
        <span class="cbtext">Step <b>${i + 1}</b> of ${n}</span>
        <button class="ibtn" data-act="step" data-d="1" title="Next step (→)">${I.next}</button>
        <button class="btn small ghost" data-act="endcook">Finish</button></div>`;
    }
  } else {
    left = `<div class="tbtitle fade">${esc(libTitle())}</div>`;
  }
  toolbar.innerHTML = `<div class="tbl">${sbBtn}${left}</div><div class="tbm">${mid}</div><div class="tbr" id="tpills">${timerPills()}</div>`;
}

/* ---------- main area ---------- */
function renderMain(keepScroll) {
  const r = route();
  const y = main.scrollTop;
  renderToolbar();
  let html;
  if (r.view === 'r') html = recipeView(r.id);
  else if (r.view === 'setup') html = setupView();
  else html = libraryView();
  main.innerHTML = html;
  main.dataset.view = r.view;
  main.scrollTop = keepScroll ? y : 0;
  onScroll();
  if (r.view === 'r') paintCook(false);
}
function onScroll() {
  toolbar.classList.toggle('scrolled', main.scrollTop > 4);
  const t = toolbar.querySelector('.tbtitle.fade'), h = main.querySelector('.rtitle, .libtitle');
  if (t && h) t.classList.toggle('show', h.getBoundingClientRect().bottom < 60);
}
main.addEventListener('scroll', onScroll, { passive: true });

function libraryView() {
  if (!state.loaded) {
    if (state.listErr) return `<div class="libwrap">${errorCallout(state.listErr, 'sync')}</div>`;
    return `<div class="libwrap"><div class="grid">${Array.from({ length: 8 }, () => '<div class="card ghostcard"><div class="ph"></div><div class="ct">&nbsp;</div><div class="cm">&nbsp;</div></div>').join('')}</div></div>`;
  }
  const list = libraryList(), L = state.lib;
  const sortable = !['recent', 'cooked'].includes(L.sec);
  const head = `<div class="libhead"><div><h1 class="libtitle">${esc(libTitle())}</h1><div class="libsub">${list.length} recipe${list.length === 1 ? '' : 's'}${L.q ? ` matching “${esc(L.q)}”` : ''}</div></div>
    ${sortable ? `<label class="sortsel">${I.sort}<select id="sortsel">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${cfg.sort === k ? 'selected' : ''}>${esc(v[0])}</option>`).join('')}</select></label>` : ''}</div>`;
  const err = state.listErr && state.listErr.code !== 'offline' ? errorCallout(state.listErr, 'sync') : '';
  if (!state.recipes.length) return `<div class="libwrap">${head}${err}<div class="empty"><div class="big">📖</div><h3>Your recipe book is empty</h3><p>Send Claude a recipe link or a photo of a cookbook page and ask it to add it to Recipe book. It shows up here after the next sync.</p></div></div>`;
  if (!list.length) return `<div class="libwrap">${head}${err}<div class="empty"><div class="big">🔍</div><h3>Nothing here</h3><p>${L.q ? 'No recipe matches that search.' : 'No recipes in this list yet.'}</p>${L.q ? '<p><button class="btn" data-act="clearq">Clear search</button></p>' : ''}</div></div>`;
  return `<div class="libwrap">${head}${err}<div class="grid">${list.map(card).join('')}</div></div>`;
}
function card(r) {
  const img = cardImage(r), t = totalOf(r), c = facet(r, 'course'), stars = ratingOf(r);
  const cooking = ckGet(r.id).cur >= 0;
  const meta = [t != null ? fmtMin(t) : '', c].filter(Boolean).map(esc).join('<span class="sep">·</span>');
  return `<a class="card" href="#/r/${encodeURIComponent(r.id)}">
    <div class="ph ${img ? '' : 'noimg'}">${img ? `<img src="${esc(imgUrl(img, 700))}" alt="" loading="lazy" data-err="card">` : ''}<span class="emo">${esc(iconFor(r))}</span>
      ${cooking ? '<span class="badge cook">Cooking</span>' : ''}</div>
    <div class="ct">${esc(r.name)}</div>
    <div class="cm">${meta}${stars ? `<span class="cstars">${'★'.repeat(stars)}</span>` : ''}</div>
  </a>`;
}

/* ---------- recipe page ---------- */
const baseServ = r => num(r.servings) > 0 ? num(r.servings) : null;
const MULTS = [0.25, 0.5, 1, 1.5, 2, 3, 4];
const stepOf = b => b > 12 ? Math.max(1, Math.round(b / 10)) : 1;
/* With servings the scaler counts people; without, it is a multiplier. */
const factorOf = r => { const b = baseServ(r), v = state.serv[r.id]; return v == null ? 1 : b ? v / b : v; };
const servLabel = r => { const b = baseServ(r), v = state.serv[r.id]; if (b) { const n = v ?? b; return `${trimNum(n, 2)} serving${n === 1 ? '' : 's'}`; } return `${kitchen(v ?? 1)}× the recipe`; };
function ingredientsHtml(r) {
  const f = factorOf(r), ck = ckGet(r.id);
  return r.ingredients.map((g, gi) => `${g.group ? `<h3 class="igroup">${esc(g.group)}</h3>` : ''}<ul class="ings">${g.items.map((it, ii) => {
    const a = amountText(it, f); const k = gi + ':' + ii; const got = ck.checked[k];
    return `<li class="${got ? 'got' : ''}" data-act="ing" data-k="${k}" role="checkbox" aria-checked="${!!got}"><span class="check">${I.tick}</span><span class="itxt">${a.txt ? `<b class="amt">${esc(a.txt)}</b> ` : ''}${esc(it.item)}${it.note ? `<span class="inote">, ${esc(it.note)}</span>` : ''}${it.optional ? ' <span class="tagopt">optional</span>' : ''}${a.unscaled ? ' <span class="tagopt">not scaled</span>' : ''}</span></li>`;
  }).join('')}</ul>`).join('');
}
function scalerHtml(r) {
  const f = factorOf(r);
  return `<div class="scaler"><button class="sbtn" data-act="serv" data-d="-1" aria-label="Fewer">${I.minus}</button><span class="sval">${esc(servLabel(r))}</span><button class="sbtn" data-act="serv" data-d="1" aria-label="More">${I.plus}</button>${f !== 1 ? '<button class="linkbtn" data-act="servreset">As written</button>' : ''}</div>`;
}
function stat(label, val) { return val ? `<div class="stat"><div class="sl">${label}</div><div class="sv">${val}</div></div>` : ''; }
function recipeView(id) {
  const sum = getSum(id);
  const r = state.full[id];
  openRecipe(id);
  if (!r) {
    const e = state.fullErr[id];
    const title = `<h1 class="rtitle">${esc(sum?.name || 'Recipe')}</h1>`;
    if (!e) return `<div class="recipe"><div class="loading">${title}<p class="faint">${connected() ? 'Opening recipe…' : 'Connect Notion in Settings to open this recipe.'}</p></div></div>`;
    if (e.code === 'no_app_data') return `<div class="recipe"><div class="loading">${title}<div class="callout"><div class="ci">💡</div><div class="cb">This page has no App data toggle, so the app can't read it. Save it again with the Recipe book skill in Claude, or open it in Notion.${sum?.url ? `<div class="actions"><a class="btn small" href="${esc(sum.url)}" target="_blank">Open in Notion</a></div>` : ''}</div></div></div></div>`;
    return `<div class="recipe"><div class="loading">${title}${errorCallout(e, 'retryfull')}</div></div>`;
  }
  resolveFiles(r);
  const P = photosOf(r, sum), f = factorOf(r), ck = ckGet(id), b = baseServ(r);
  const total = r.totalMin ?? (r.prepMin != null || r.cookMin != null ? (r.prepMin || 0) + (r.cookMin || 0) : null);
  const src = r.source ? (r.link ? `<a href="${esc(r.link)}" target="_blank">${esc(r.source)}</a>` : esc(r.source)) + (r.author ? ` <span class="by">by ${esc(r.author)}</span>` : '') : '';
  const eyebrow = [r.course, ...r.cuisine].filter(Boolean).map(esc).join('<span class="sep">·</span>');
  const rating = r.rating || sum?.rating;
  const about = r.about.split(/\n+/).filter(x => x.trim());
  const cooking = ck.cur >= 0;
  /* "Makes" only when the yield says more than the serving count (a tray, 36 pieces, "2–3 people as a meal"). */
  const makes = r.yield && !(r.servings != null && new RegExp('^' + trimNum(r.servings, 2) + '(\\s*(servings?|people|persons?|portions?))?$', 'i').test(r.yield.trim())) ? r.yield : '';
  const html = `
  <article class="recipe">
    <header class="rhead">
      <div class="rtext">
        ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
        <h1 class="rtitle">${esc(r.name)}</h1>
        ${src || rating ? `<div class="rsource">${src}${rating ? `<span class="rstars">${starsHtml(rating)}</span>` : ''}</div>` : ''}
        <div class="stats">
          ${stat('Serves', esc(r.servings != null ? trimNum(r.servings, 2) : r.yield.length <= 18 ? r.yield : ''))}
          ${makes && makes.length <= 22 ? stat('Makes', esc(makes)) : ''}
          ${stat('Prep', esc(fmtMin(r.prepMin)))}${stat('Cook', esc(fmtMin(r.cookMin)))}${stat('Total', esc(fmtMin(total)))}
        </div>
        ${makes && makes.length > 22 ? `<p class="timenote">${I.pot}Makes ${esc(makes)}</p>` : ''}
        ${r.timeNote ? `<p class="timenote">${I.clock}${esc(r.timeNote)}</p>` : ''}
        ${about.map(x => `<p class="about">${esc(x)}</p>`).join('')}
        ${r.glance.length ? `<ul class="glance">${r.glance.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <div class="ractions">${ractionsHtml(r, sum, ck)}</div>
      </div>
      ${P.hero ? `<figure class="hero" data-act="zoom" data-src="${esc(P.hero)}" data-cap="${esc(r.name)}"><img src="${esc(imgUrl(P.hero))}" alt="" data-err="hero"><span class="heroicon">${esc(r.icon || sum?.icon || '')}</span></figure>` : `<figure class="hero noimg"><span>${esc(r.icon || sum?.icon || '🍽️')}</span></figure>`}
    </header>
    ${P.gallery.length ? `<div class="gallery">${P.gallery.map(x => `<figure data-act="zoom" data-src="${esc(x.src)}" data-cap="${esc(x.caption)}"><img src="${esc(imgUrl(x.src, 600))}" alt="${esc(x.caption)}" loading="lazy" data-err="fig">${x.caption ? `<figcaption>${esc(x.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
    ${r.review ? `<div class="callout yellow"><div class="ci">⚠️</div><div class="cb"><b>Check before cooking</b>${r.uncertain.length ? `<ul>${r.uncertain.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` : '<p>This recipe hasn\'t been checked yet.</p>'}</div></div>` : ''}
    <section class="cookgrid ${cooking ? 'cooking' : ''}" id="cookgrid">
      <aside class="ingcol"><div class="ingsticky">
        <div class="colhead"><h2>Ingredients</h2>${Object.keys(ck.checked).length ? '<button class="linkbtn" data-act="uncheck">Clear ticks</button>' : ''}</div>
        ${r.ingredients.length ? scalerHtml(r) + (f !== 1 && r.yield ? `<p class="caption">As written: ${esc(r.yield)}${b ? ` (${trimNum(b, 2)} servings)` : ''}.</p>` : '') + `<div id="inglist">${ingredientsHtml(r)}</div>` : '<p class="faint">None listed</p>'}
        ${r.equipment.length || r.equipmentNote ? `<div class="equip"><h3 class="igroup">Equipment</h3><p>${r.equipmentNote ? esc(r.equipmentNote) : r.equipment.map(esc).join(', ')}</p></div>` : ''}
      </div></aside>
      <section class="methcol">
        <div class="colhead"><h2>Method</h2>${f !== 1 ? '<span class="caption">Amounts in the steps are for the original recipe.</span>' : ''}</div>
        ${r.steps.length ? `<ol class="steps">${r.steps.map((s, i) => stepHtml(r, s, i, P.bystep[i + 1] || [])).join('')}</ol>` : '<p class="faint">No steps listed</p>'}
      </section>
    </section>
    ${extrasHtml(r)}
  </article>`;
  return html;
}
function ractionsHtml(r, sum, ck) {
  return `${r.steps.length ? (ck.cur >= 0 ? `<button class="btn primary" data-act="tocur">${I.play}Continue at step ${Math.min(ck.cur, r.steps.length - 1) + 1}</button><button class="btn ghost" data-act="resetcook">Start over</button>` : `<button class="btn primary" data-act="startcook">${I.play}Start cooking</button>`) : ''}
    ${sum?.url ? `<a class="btn ghost" href="${esc(sum.url)}" target="_blank">${I.notion}Notion</a>` : ''}
    ${r.link ? `<a class="btn ghost" href="${esc(r.link)}" target="_blank">${I.link}Original</a>` : ''}`;
}
function stepHtml(r, s, i, pics) {
  return `<li class="step" data-i="${i}">
    <button class="snum" data-act="goto" data-i="${i}" title="Make this the current step"><span class="n">${i + 1}</span><span class="t">${I.tick}</span></button>
    <div class="sbody" data-act="goto" data-i="${i}">
      ${s.title ? `<h3 class="stitle">${esc(s.title)}</h3>` : ''}
      <p class="stext">${esc(s.text)}</p>
      ${s.timerMin ? `<div class="tchip-wrap" data-tk="${esc(r.id + ':' + i)}">${timerChip(r.id, i, s)}</div>` : ''}
      ${pics.length ? `<div class="spics n${Math.min(pics.length, 3)}">${pics.map(x => `<figure data-act="zoom" data-src="${esc(x.src)}" data-cap="${esc(x.caption)}"><img src="${esc(imgUrl(x.src, 900))}" alt="${esc(x.caption)}" loading="lazy" data-err="fig">${x.caption ? `<figcaption>${esc(x.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
      <div class="snext"><button class="btn small primary" data-act="step" data-d="1">${i === r.steps.length - 1 ? 'Finish' : 'Next step'}${I.next}</button></div>
    </div>
  </li>`;
}
function extrasHtml(r) {
  const box = (title, body) => `<section class="xbox"><h2>${title}</h2>${body}</section>`;
  const parts = [];
  if (r.tips.length) parts.push(box('Tips and variations', `<ul class="bullets">${r.tips.map(t => `<li>${t.label ? `<b>${esc(t.label)}:</b> ` : ''}${esc(t.text)}</li>`).join('')}</ul>`));
  if (r.storage.length) parts.push(box('Storage', `<ul class="bullets">${r.storage.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`));
  if (r.serveWith) parts.push(box('Serve with', `<p>${esc(r.serveWith)}</p>`));
  if (r.notes) parts.push(box('Notes', r.notes.split(/\n+/).map(x => `<p>${esc(x)}</p>`).join('')));
  if (r.kcal != null) parts.push(box('Energy', `<p>About ${esc(trimNum(r.kcal, 0))} kcal per serving.</p>`));
  if (r.cooks.length) parts.push(box('Cook log', `<table class="log"><thead><tr><th>Date</th><th>Serves</th><th>Rating</th><th>Notes</th></tr></thead><tbody>${r.cooks.map(c => `<tr><td class="nw">${esc(dateStr(c.date))}</td><td>${c.servings != null ? esc(trimNum(c.servings, 2)) : ''}</td><td class="nw">${starsHtml(c.rating >= 1 ? Math.min(5, Math.round(c.rating)) : null)}</td><td>${esc(c.notes)}</td></tr>`).join('')}</tbody></table>`));
  const tags = [...r.tags.map(x => pill('Tags', x)), ...r.mainIngredients.map(x => pill('Main ingredient', x))];
  return (parts.length ? `<div class="extras">${parts.join('')}</div>` : '') + (tags.length ? `<div class="rtags">${tags.join('')}</div>` : '');
}

/* ---------- cooking: current step, ticks, timers ---------- */
const ckGet = id => Object.assign({ cur: -1, checked: {} }, ls.get('rbm.cook.' + id) || {});
const ckSave = (id, c) => { if (c.cur < 0 && !Object.keys(c.checked).length) ls.del('rbm.cook.' + id); else ls.set('rbm.cook.' + id, c); };
/* Updates the step highlight without redrawing the page, then brings the current step to the upper third so the step before stays in view. */
function paintCook(scroll) {
  const id = route().id, r = state.full[id]; if (!r) return;
  const ck = ckGet(id), cur = ck.cur;
  const grid = $('#cookgrid'); if (grid) grid.classList.toggle('cooking', cur >= 0);
  $$('.step').forEach(el => { const i = +el.dataset.i; el.classList.toggle('done', cur >= 0 && i < cur); el.classList.toggle('cur', i === cur); el.classList.toggle('upnext', cur >= 0 && i === cur + 1); });
  if (scroll && cur >= 0) {
    const el = $(`.step[data-i="${cur}"]`);
    if (el) { const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop; main.scrollTo({ top: Math.max(0, top - main.clientHeight * 0.28), behavior: 'smooth' }); }
  }
  updateAwake();
}
function setStep(id, i, scroll = true) {
  const r = state.full[id]; if (!r || !r.steps.length) return;
  const ck = ckGet(id);
  if (i >= r.steps.length) { finishCook(id); return; }
  ck.cur = Math.max(0, i); ckSave(id, ck);
  renderToolbar(); paintCook(scroll);
  const act = $('.ractions'); if (act) act.innerHTML = ractionsHtml(r, getSum(id), ck);
}
function finishCook(id) {
  const r = state.full[id];
  Object.keys(state.timers).filter(k => k.startsWith(id + ':')).forEach(k => delete state.timers[k]);
  saveTimers();
  ls.del('rbm.cook.' + id);
  toast('Enjoy your meal');
  renderMain(true);
  main.scrollTo({ top: 0, behavior: 'smooth' });
  if (r && r.steps.length) updateAwake();
}

/* Timers belong to a recipe step but run app-wide, so they keep going while you browse other recipes. */
const tKey = (id, i) => id + ':' + i;
const tLeft = t => t.running ? Math.max(0, (t.endAt - Date.now()) / 1000) : (t.remaining ?? t.total);
const saveTimers = () => ls.set('rbm.timers', state.timers);
function timerChip(id, i, s) {
  const t = state.timers[tKey(id, i)], total = Math.round(s.timerMin * 60);
  if (!t) return `<button class="tchip" data-act="timer" data-i="${i}">${I.timer}<span>${fmtMin(s.timerMin)} timer</span></button>`;
  if (t.fired) return `<button class="tchip fired" data-act="timer" data-i="${i}">${I.timer}<span>Time's up</span><b>Restart</b></button><button class="linkbtn" data-act="treset" data-i="${i}">Clear</button>`;
  const rem = tLeft(t);
  return `<button class="tchip ${t.running ? 'running' : 'paused'}" data-act="timer" data-i="${i}">${t.running ? I.pause : I.play}<b data-clock="${esc(tKey(id, i))}">${mmss(rem)}</b><span>${t.running ? 'Pause' : 'Resume'}</span></button>${rem < total ? `<button class="linkbtn" data-act="treset" data-i="${i}">Reset</button>` : ''}`;
}
function toggleTimer(id, i) {
  primeAudio();
  const r = state.full[id], s = r && r.steps[i]; if (!s || !s.timerMin) return;
  const k = tKey(id, i), total = Math.round(s.timerMin * 60);
  let t = state.timers[k];
  if (!t || t.fired) t = state.timers[k] = { recipe: r.name, label: s.title || 'Step ' + (i + 1), total, running: false, remaining: total, endAt: 0 };
  if (t.running) { t.remaining = tLeft(t); t.running = false; }
  else { t.endAt = Date.now() + (t.remaining > 0 ? t.remaining : total) * 1000; t.running = true; t.remaining = null; }
  saveTimers(); paintTimers(true); updateAwake();
}
function resetTimer(id, i) { delete state.timers[tKey(id, i)]; state.alerts = state.alerts.filter(a => a.k !== tKey(id, i)); saveTimers(); renderAlerts(); paintTimers(true); updateAwake(); }
function paintTimers(full) {
  if (full) {
    const r = route(), f = r.view === 'r' && state.full[r.id];
    if (f) $$('.tchip-wrap').forEach(w => { const [, i] = w.dataset.tk.split(':'); w.innerHTML = timerChip(r.id, +i, f.steps[+i]); });
    const p = $('#tpills'); if (p) p.innerHTML = timerPills();
  }
  $$('[data-clock]').forEach(el => { const t = state.timers[el.dataset.clock]; if (t && !t.fired) el.textContent = mmss(tLeft(t)); });
}
let lastBadge = null;
function tick() {
  let changed = false;
  for (const [k, t] of Object.entries(state.timers)) {
    if (t.running && t.endAt <= Date.now()) { t.running = false; t.fired = true; t.remaining = 0; changed = true; fire(k, t); }
  }
  if (changed) { saveTimers(); paintTimers(true); updateAwake(); }
  else paintTimers(false);
  // Dock badge: the soonest running timer, so it's visible with the window hidden.
  const run = Object.values(state.timers).filter(t => t.running).sort((a, b) => a.endAt - b.endAt);
  const left = run.length ? tLeft(run[0]) : 0;
  const badge = run.length ? (left >= 60 ? Math.ceil(left / 60) + 'm' : Math.ceil(left) + 's') : Object.values(state.timers).some(t => t.fired) ? '!' : '';
  if (badge !== lastBadge && native) { native.badge(badge); lastBadge = badge; }
}
setInterval(tick, 500);
function fire(k, t) {
  const id = k.split(':')[0];
  state.alerts.push({ k, id, msg: `${t.label}: time's up`, sub: t.recipe });
  renderAlerts(); beep();
  if (native) native.notify(`${t.label}: time's up`, t.recipe, id);
}
function renderAlerts() {
  alertsEl.innerHTML = state.alerts.map(a => `<div class="alert" role="alert">${I.timer}<div class="am"><b>${esc(a.msg)}</b><span>${esc(a.sub)}</span></div><button class="btn small" data-act="openalert" data-k="${esc(a.k)}">Show</button><button class="btn small primary" data-act="dismiss" data-k="${esc(a.k)}">OK</button></div>`).join('');
}
let audio = null;
function primeAudio() { try { audio = audio || new AudioContext(); if (audio.state === 'suspended') audio.resume(); } catch { } }
function beep() {
  primeAudio(); if (!audio) return;
  const now = audio.currentTime;
  for (let rep = 0; rep < 3; rep++) for (const [dt, f] of [[0, 880], [0.18, 1175]]) {
    const o = audio.createOscillator(), g = audio.createGain(), t0 = now + rep * 0.9 + dt;
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audio.destination);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    o.start(t0); o.stop(t0 + 0.35);
  }
}
/* The screen stays on while a recipe is being cooked or a timer is running. */
let awake = false;
function updateAwake() {
  const r = route();
  const on = (r.view === 'r' && ckGet(r.id).cur >= 0) || Object.values(state.timers).some(t => t.running);
  if (on !== awake && native) native.keepAwake(on);
  awake = on;
}

/* ---------- photo viewer ---------- */
let viewer = null;
function openViewer(src) {
  const figs = $$('[data-act="zoom"]').map(f => ({ src: f.dataset.src, cap: f.dataset.cap }));
  const uniq = figs.filter((x, i) => figs.findIndex(y => y.src === x.src) === i);
  viewer = { list: uniq, i: Math.max(0, uniq.findIndex(x => x.src === src)) };
  paintViewer();
}
function paintViewer() {
  if (!viewer) return;
  const x = viewer.list[viewer.i], n = viewer.list.length;
  overlay.innerHTML = `<div class="viewer" data-act="closeov">
    <figure data-stop="1"><img src="${esc(imgUrl(x.src, 2000))}" alt="">${x.cap ? `<figcaption>${esc(x.cap)}</figcaption>` : ''}</figure>
    ${n > 1 ? `<button class="vnav prev" data-act="vnav" data-d="-1">${I.back}</button><button class="vnav next" data-act="vnav" data-d="1">${I.next}</button><div class="vcount">${viewer.i + 1} / ${n}</div>` : ''}
    <button class="vclose" data-act="closeov">${I.close}</button></div>`;
}
function closeOverlay() { overlay.innerHTML = ''; viewer = null; }

/* ---------- settings & setup ---------- */
const dbUrl = () => cfg.db ? 'https://www.notion.so/' + String(cfg.db).replace(/-/g, '') : 'https://www.notion.so';
async function searchAll(value, limit = 300) {
  const out = []; let cursor = null;
  do {
    const d = await napi('/search', { method: 'POST', body: { filter: { property: 'object', value }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }, read: true });
    out.push(...(d.results || []).filter(x => !x.in_trash && !x.archived));
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor && out.length < limit);
  return out;
}
/* Any database the integration can see that has BOOK.marker columns counts as this app's database. */
async function findBooks() {
  const isBook = ds => ds.properties ? BOOK.marker.every(k => ds.properties[k]) : rtText(ds.title).toLowerCase() === BOOK.name.toLowerCase();
  return (await searchAll('data_source')).filter(isBook)
    .map(ds => ({ id: ds.id, name: rtText(ds.title) || BOOK.name, db: ds.parent && ds.parent.database_id }));
}
async function sharedPages() {
  const title = p => { const t = Object.values(p.properties || {}).find(x => x.type === 'title'); return (t && rtText(t.title)) || 'Untitled'; };
  return (await searchAll('page', 100)).filter(p => p.parent && ['workspace', 'page_id'].includes(p.parent.type)).slice(0, 12)
    .map(p => ({ id: p.id, name: (p.icon && p.icon.type === 'emoji' ? p.icon.emoji + ' ' : '') + title(p) }));
}
async function createBook(pageId) {
  const d = await napi('/databases', { method: 'POST', body: {
    parent: { type: 'page_id', page_id: pageId }, title: [{ type: 'text', text: { content: BOOK.name } }],
    icon: { type: 'emoji', emoji: BOOK.icon }, initial_data_source: { properties: BOOK.schema() } } });
  const ds = (d.data_sources || [])[0];
  if (!ds) throw { code: 'x', message: 'Notion created the database but returned no data source. Try again to find it.' };
  return { id: ds.id, name: BOOK.name, db: d.id };
}
function useBook(b) {
  const changed = cfg.ds !== b.id;
  cfg.ds = b.id; cfg.db = b.db || ''; saveCfg(); setupState = null;
  const msg = $('#setupmsg');
  if (msg) msg.innerHTML = `<div class="callout green"><div class="ci">✅</div><div class="cb">Connected to ${esc(b.name || BOOK.name)}.</div></div>`;
  if (changed) { state.recipes = []; state.loaded = false; }
  syncList();
  setTimeout(() => { closeOverlay(); if (route().view === 'setup') location.hash = '#/'; else render(); }, 700);
}
let setupState = null;
function setupChoices() {
  const s = setupState; if (!s) return '';
  const btn = (act, x) => `<button class="btn small" data-act="${act}" data-id="${esc(x.id)}">${esc(x.name)}</button>`;
  if (s.books.length) return `<div class="callout"><div class="ci">📚</div><div class="cb">Found more than one ${esc(BOOK.name)} database. Which one should the app use?<div class="actions">${s.books.map(b => btn('pickbook', b)).join('')}</div></div></div>`;
  if (s.pages.length) return `<div class="callout"><div class="ci">✨</div><div class="cb">No ${esc(BOOK.name)} database yet. Pick a page and the app creates an empty one in it, with all the right columns. ${BOOK.createNote}<div class="actions">${s.pages.map(p => btn('createbook', p)).join('')}</div><p class="faint small">Already have one? Add the integration to it (••• → Connections) and try again.</p></div></div>`;
  return `<div class="callout"><div class="ci">🔌</div><div class="cb">Connected, but the integration can't see any pages yet. In Notion, open the page where ${esc(BOOK.name)} should live (or your existing ${esc(BOOK.name)} database), click <b>•••</b> → <b>Connections</b> and add your integration. Then try again.</div></div>`;
}
async function testConnection() {
  const msg = $('#setupmsg'); const tok = ($('#tok')?.value || '').trim(); const dsIn = ($('#ds')?.value || '').trim().replace(/^collection:\/\//, '');
  if (!tok) { msg.innerHTML = errorCallout({ code: 'x', message: 'Paste the secret first.' }); return; }
  const prev = cfg.token;
  cfg.token = tok; setupState = null;
  msg.innerHTML = '<p class="faint small">Checking…</p>';
  try {
    if (dsIn) { const ds = await napi(`/data_sources/${dsIn}`, { read: true }); saveCfg(); useBook({ id: ds.id, name: rtText(ds.title), db: ds.parent && ds.parent.database_id }); return; }
    const books = await findBooks();
    saveCfg();
    if (books.length === 1) { useBook(books[0]); return; }
    setupState = { books, pages: books.length ? [] : await sharedPages() };
    msg.innerHTML = setupChoices();
  } catch (e) { cfg.token = prev; msg.innerHTML = errorCallout(e); }
}
async function setupAction(act, id) {
  const msg = $('#setupmsg'); if (!setupState) return;
  if (act === 'pickbook') { const b = setupState.books.find(x => x.id === id); if (b) useBook(b); return; }
  msg.innerHTML = `<p class="faint small">Creating ${esc(BOOK.name)}…</p>`;
  try { useBook(await createBook(id)); }
  catch (e) {
    const noInsert = e && (e.code === 'restricted_resource' || e.status === 403);
    msg.innerHTML = (noInsert ? errorCallout({ code: 'x', message: `Your integration isn't allowed to add content. At notion.so/my-integrations, open it, tick "Insert content" under Capabilities, save, and try again.` }) : errorCallout(e)) + setupChoices();
  }
}
function setupView() {
  return `<div class="setupwrap"><div class="setupcard">
    <img class="appicon" src="icon-256.png" alt="">
    <h1>Connect Recipe book to Notion</h1>
    <p class="desc">One-time setup. The app reads your Recipe book database straight from Notion, with a private key that stays on this Mac.</p>
    <ol class="steps-list">
      <li>Go to <a href="https://www.notion.so/my-integrations" target="_blank">notion.so/my-integrations</a>. Use the integration you made for the phone app, or choose <b>New integration</b> (type <b>Internal</b>).</li>
      <li>Copy the <b>Internal Integration Secret</b>. It starts with <code>ntn_</code> or <code>secret_</code>.</li>
      <li>In Notion, open your Recipe book database (or the page it should live in), click <b>•••</b> → <b>Connections</b>, and add the integration.</li>
      <li>Paste the secret below.</li>
    </ol>
    <div class="field"><label for="tok">Secret</label><input id="tok" type="password" autocomplete="off" placeholder="ntn_…" value="${esc(cfg.token)}"></div>
    <div id="setupmsg"></div>
    <div class="actions"><button class="btn primary wide" data-act="connect">Connect</button></div>
  </div></div>`;
}
function openSettings() {
  const saved = state.recipes.filter(r => state.full[r.id]).length;
  overlay.innerHTML = `<div class="scrim" data-act="closeov"><div class="sheet" data-stop="1">
    <div class="sheethead"><h2>Settings</h2><button class="ibtn" data-act="closeov">${I.close}</button></div>
    <h3>Notion</h3>
    <div class="field"><label for="tok">Secret</label><input id="tok" type="password" autocomplete="off" value="${esc(cfg.token)}" placeholder="ntn_…"></div>
    <div class="field"><label for="ds">Data source ID</label><input id="ds" value="${esc(cfg.ds)}" autocomplete="off" placeholder="Leave empty to find it automatically"></div>
    <div id="setupmsg"></div>
    <div class="actions"><button class="btn small primary" data-act="connect">Save and test</button><a class="btn small ghost" href="${dbUrl()}" target="_blank">Open Recipe book in Notion</a></div>
    <h3>Adding and editing recipes</h3>
    <p class="small">Use the <b>Recipe book</b> skill in Claude. It keeps the readable Notion page and the app's data in step. Changes show up here after the next sync (⌘R).</p>
    <h3>Saved on this Mac</h3>
    <p class="small muted">${saved} of ${state.recipes.length} recipes are saved for offline use. Photos load from the web and stay cached once seen.</p>
    <div class="actions"><button class="btn small ghost danger" data-act="clearcache">Clear saved copy</button></div>
    <p class="small faint ver">Recipe book for Mac ${esc(state.info ? state.info.version.replace(/\.0$/, '') : '')}</p>
  </div></div>`;
  setTimeout(() => { const t = $('#tok'); if (t && !t.value) t.focus(); }, 50);
}

/* ---------- update check ---------- */
async function checkUpdate() {
  if (!native || !state.info || !state.info.repo) return;
  const last = ls.get('rbm.updChecked') || 0;
  const cached = ls.get('rbm.update');
  if (Date.now() - last < 6 * 3600 * 1000) { if (cached && newer(cached.version, state.info.version)) state.update = cached; renderSidebar(); return; }
  try {
    const r = await native.http({ url: `https://api.github.com/repos/${state.info.repo}/releases/tags/recipe-book-mac`, method: 'GET', headers: { Accept: 'application/vnd.github+json' } });
    if (r.error || r.status !== 200) return;
    const d = JSON.parse(r.text); const m = String(d.name || '').match(/(\d+)\.(\d+)/);
    if (!m) return;
    const u = { version: m[1] + '.' + m[2], url: d.html_url };
    ls.set('rbm.update', u); ls.set('rbm.updChecked', Date.now());
    state.update = newer(u.version, state.info.version) ? u : null; renderSidebar();
  } catch { }
}
const newer = (a, b) => { const p = s => String(s).split('.').map(Number); const [x, y] = [p(a), p(b)]; return x[0] > y[0] || (x[0] === y[0] && (x[1] || 0) > (y[1] || 0)); };

/* ---------- events ---------- */
const goLib = () => { if (route().view !== 'list') location.hash = '#/'; else renderMain(false); };
document.addEventListener('click', e => {
  if (e.target.closest('[data-stop]') && !e.target.closest('[data-act]')) return;
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act; const { id } = route();
  if (a.closest('[data-stop]') && act === 'closeov' && !a.classList.contains('ibtn') && !a.classList.contains('vclose')) return;
  switch (act) {
    case 'sync': syncList(); break;
    case 'settings': openSettings(); break;
    case 'sidebar': cfg.nosb = !cfg.nosb; saveCfg(); document.body.classList.toggle('nosb', cfg.nosb); break;
    case 'sec': state.libY = 0; state.lib.sec = a.dataset.k; state.lib.fk = null; state.lib.fv = null; renderSidebar(); goLib(); break;
    case 'facet': { state.libY = 0; const L = state.lib; if (L.fk === a.dataset.k && L.fv === a.dataset.v && route().view === 'list') { L.fk = null; L.fv = null; } else { L.sec = 'all'; L.fk = a.dataset.k; L.fv = a.dataset.v; } renderSidebar(); goLib(); break; }
    case 'grp': cfg.closed[a.dataset.k] = !cfg.closed[a.dataset.k]; saveCfg(); a.parentNode.classList.toggle('closed', cfg.closed[a.dataset.k]); break;
    case 'clearq': { state.lib.q = ''; const q = $('#q'); if (q) q.value = ''; renderMain(false); break; }
    case 'back': history.length > 1 ? history.back() : (location.hash = '#/'); break;
    case 'update': if (state.update && native) native.open(state.update.url); break;
    case 'retryfull': delete state.fullErr[id]; delete tried[id]; renderMain(true); break;
    case 'serv': {
      const r = state.full[id]; if (!r) break; const b = baseServ(r), d = +a.dataset.d;
      if (b) { const st = stepOf(b), cur = state.serv[id] ?? b; const v = Math.max(st, Math.min(b * 20, cur + d * st)); if (v === b) delete state.serv[id]; else state.serv[id] = v; }
      else { let k = MULTS.indexOf(state.serv[id] ?? 1); if (k < 0) k = MULTS.indexOf(1); k = Math.max(0, Math.min(MULTS.length - 1, k + d)); if (MULTS[k] === 1) delete state.serv[id]; else state.serv[id] = MULTS[k]; }
      ls.set('rbm.serv', state.serv); renderMain(true); break;
    }
    case 'servreset': delete state.serv[id]; ls.set('rbm.serv', state.serv); renderMain(true); break;
    case 'ing': { const ck = ckGet(id), k = a.dataset.k; if (ck.checked[k]) delete ck.checked[k]; else ck.checked[k] = 1; ckSave(id, ck); a.classList.toggle('got', !!ck.checked[k]); a.setAttribute('aria-checked', !!ck.checked[k]); break; }
    case 'uncheck': { const ck = ckGet(id); ck.checked = {}; ckSave(id, ck); renderMain(true); break; }
    case 'startcook': setStep(id, 0); break;
    case 'tocur': paintCook(true); break;
    case 'resetcook': { const ck = ckGet(id); ck.cur = -1; ck.checked = {}; ckSave(id, ck); Object.keys(state.timers).filter(k => k.startsWith(id + ':')).forEach(k => delete state.timers[k]); saveTimers(); renderMain(true); updateAwake(); break; }
    case 'endcook': finishCook(id); break;
    case 'goto': {
      const i = +a.dataset.i; const ck = ckGet(id);
      if (ck.cur === i && a.classList.contains('snum')) setStep(id, i + 1, false); else setStep(id, i, false);
      break;
    }
    case 'step': { const ck = ckGet(id); setStep(id, (ck.cur < 0 ? -1 : ck.cur) + +a.dataset.d); break; }
    case 'timer': toggleTimer(id, +a.dataset.i); break;
    case 'treset': resetTimer(id, +a.dataset.i); break;
    case 'gotimer': case 'openalert': {
      const [rid, i] = a.dataset.k.split(':');
      if (act === 'openalert') { state.alerts = state.alerts.filter(x => x.k !== a.dataset.k); renderAlerts(); }
      const go = () => { const el = $(`.step[data-i="${i}"]`); if (el) { const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop; main.scrollTo({ top: Math.max(0, top - main.clientHeight * 0.28), behavior: 'smooth' }); } };
      if (route().id !== rid) { location.hash = '#/r/' + encodeURIComponent(rid); setTimeout(go, 120); } else go();
      break;
    }
    case 'dismiss': { const k = a.dataset.k; state.alerts = state.alerts.filter(x => x.k !== k); const t = state.timers[k]; if (t && t.fired) delete state.timers[k]; saveTimers(); renderAlerts(); paintTimers(true); break; }
    case 'zoom': openViewer(a.dataset.src); break;
    case 'vnav': if (viewer) { viewer.i = (viewer.i + +a.dataset.d + viewer.list.length) % viewer.list.length; paintViewer(); } break;
    case 'closeov': if (e.target === a || a.classList.contains('ibtn') || a.classList.contains('vclose')) closeOverlay(); break;
    case 'connect': testConnection(); break;
    case 'pickbook': case 'createbook': setupAction(act, a.dataset.id); break;
    case 'clearcache': {
      if (!a.classList.contains('armed')) { a.classList.add('armed'); a.textContent = 'Click again to clear'; break; }
      for (const r of state.recipes) ls.del('rbm.full.' + r.id);
      ls.del('rbm.list'); state.recipes = []; state.full = {}; state.loaded = false; closeOverlay(); toast('Cleared. Syncing again…'); syncList(); render(); break;
    }
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { state.lib.q = e.target.value; if (route().view !== 'list') location.hash = '#/'; else renderMain(false); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'sortsel' && SORTS[e.target.value]) { cfg.sort = e.target.value; saveCfg(); renderMain(false); }
});
document.addEventListener('keydown', e => {
  const typing = e.target.closest && e.target.closest('input, textarea, select');
  if (e.key === 'Escape') {
    if (overlay.innerHTML) { closeOverlay(); return; }
    if (typing && e.target.id === 'q' && e.target.value) { e.target.value = ''; state.lib.q = ''; renderMain(false); return; }
    if (typing) { e.target.blur(); return; }
    if (route().view === 'r') location.hash = '#/';
    return;
  }
  if (viewer && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { viewer.i = (viewer.i + (e.key === 'ArrowLeft' ? -1 : 1) + viewer.list.length) % viewer.list.length; paintViewer(); e.preventDefault(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  const r = route();
  if (r.view === 'r' && state.full[r.id] && ['ArrowRight', 'ArrowLeft', 'j', 'k'].includes(e.key)) {
    e.preventDefault();
    const ck = ckGet(r.id), d = e.key === 'ArrowRight' || e.key === 'j' ? 1 : -1;
    if (ck.cur < 0) { if (d > 0) setStep(r.id, 0); return; }
    if (ck.cur + d >= 0) setStep(r.id, ck.cur + d);
  }
  if (r.view === 'list' && e.key.length === 1 && /\S/.test(e.key)) { const q = $('#q'); if (q) { q.focus(); } }   // start typing to search
});
if (native) {
  native.onMenu((ch, arg) => {
    const r = route(), f = r.view === 'r' && state.full[r.id];
    switch (ch) {
      case 'settings': openSettings(); break;
      case 'sync': syncList(); break;
      case 'notion': { const s = r.view === 'r' && getSum(r.id); native.open(s && s.url ? s.url : dbUrl()); break; }
      case 'back': if (r.view !== 'list') location.hash = '#/'; break;
      case 'find': { if (cfg.nosb) { cfg.nosb = false; saveCfg(); document.body.classList.remove('nosb'); } const q = $('#q'); if (q) { q.focus(); q.select(); } break; }
      case 'sidebar': cfg.nosb = !cfg.nosb; saveCfg(); document.body.classList.toggle('nosb', cfg.nosb); break;
      case 'next': case 'prev': if (f) { const ck = ckGet(r.id); setStep(r.id, ck.cur < 0 ? 0 : ck.cur + (ch === 'next' ? 1 : -1)); } break;
      case 'timer': if (f) { const ck = ckGet(r.id); const i = ck.cur >= 0 ? ck.cur : f.steps.findIndex(s => s.timerMin); if (i >= 0 && f.steps[i] && f.steps[i].timerMin) toggleTimer(r.id, i); else toast('This step has no timer'); } break;
      case 'reset': if (f) { const ck = ckGet(r.id); ck.cur = -1; ck.checked = {}; ckSave(r.id, ck); renderMain(true); updateAwake(); } break;
      case 'open': location.hash = '#/r/' + encodeURIComponent(arg); break;
    }
  });
  native.onFullscreen(on => document.body.classList.toggle('fullscreen', on));
}
window.addEventListener('focus', () => { if (connected() && Date.now() - state.syncedAt > 10 * 60 * 1000) syncList(); });

/* ---------- start ---------- */
for (const r of state.recipes) {
  try {
    const c = ls.get('rbm.full.' + r.id);
    if (c && c.data) { const d = normalise(c.data); d.id = r.id; state.full[r.id] = d; }
  } catch (err) { console.error('Dropping bad cached recipe', r.id, err); ls.del('rbm.full.' + r.id); }
}
for (const [k, t] of Object.entries(state.timers)) if (t.fired) delete state.timers[k];   // old alarms from a previous session
render();
renderAlerts();
if (connected()) syncList();
if (native) native.info().then(i => { state.info = i; checkUpdate(); }).catch(() => { });
