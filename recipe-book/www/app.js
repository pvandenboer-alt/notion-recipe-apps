"use strict";
/* Recipe book: Android app (Capacitor) reading a Notion recipe database. Read-only: recipes are added and edited with the Recipe book skill. */

/* ---------- config & storage ---------- */
const API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2025-09-03';
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } }
};
const cfg = Object.assign({ token: '', ds: '', db: '' }, ls.get('rb.cfg') || {});
const saveCfg = () => ls.set('rb.cfg', cfg);
const Cap = window.Capacitor || null;
const plugin = n => (Cap && Cap.Plugins && Cap.Plugins[n]) || null;
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const LN = isNative ? plugin('LocalNotifications') : null;
const AppP = isNative ? plugin('App') : null;

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const app = $('#app'), topbar = $('#topbar'), overlay = $('#overlay');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).trim().replace(',', '.')); return isFinite(n) ? n : null; };
const mmss = s => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60), r = s % 60; return m + ':' + String(r).padStart(2, '0'); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cleanId = id => String(id || '').replace(/-/g, '');
const timeStr = t => new Date(t).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
const dateStr = d => { if (!d) return ''; const x = new Date(String(d).slice(0, 10) + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); };
const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();   // search ignores accents (Dutch recipes)
const httpUrl = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : '';
/* Shopify's CDN can resize: ask for a phone-sized cover instead of the original (often 5000+ px). */
const imgUrl = u => /\/cdn\/shop\//.test(u) && !/[?&]width=/.test(u) ? u + (u.includes('?') ? '&' : '?') + 'width=900' : u;
const trimNum = (v, d) => String(+Number(v).toFixed(d));
const I = {
  back: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  refresh: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
  gear: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  search: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  close: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.8 14.8c1.4.6 2.4 2 2.7 4.2"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/></svg>',
  pot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 10h2M20 10h2M9 4.5c0 1 1 1.5 1 2.5M13 4.5c0 1 1 1.5 1 2.5"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.8 3.4-5.6 3.6-9.4 2.6 1.6 3.4 3.8 3.2 5.6 1-.6 1.6-1.6 1.8-2.8 1.8 1.6 3.4 3.6 3.4 6.6 0 3.2-2.4 5.6-6 5.6z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/></svg>',
  rows: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
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
async function napi(path, { method = 'GET', body, read = false } = {}) {
  if (!cfg.token) throw { code: 'no_token' };
  const headers = { Authorization: 'Bearer ' + cfg.token, 'Notion-Version': NOTION_VERSION };
  const opts = { method, headers };
  if (body) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try { res = await fetch(API + path, opts); }
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
  object_not_found: 'The app can\'t see your Recipe book database. In Notion, open Recipe book, tap ••• → Connections and add your integration.',
  restricted_resource: 'Your integration doesn\'t have access to Recipe book yet. In Notion, open Recipe book, tap ••• → Connections and add it.',
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
    id: cleanId(pg.id), url: pg.url, updated: pg.last_edited_time,
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
    if (Object.keys(out).length) { state.schema = out; ls.set('rb.schema', out); }
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
    rating: num(o.rating) >= 1 ? Math.min(5, Math.round(num(o.rating))) : null, cover: httpUrl(o.cover), icon: s(o.icon), review: !!o.review
  };
}

/* ---------- state & sync ---------- */
const state = {
  recipes: ls.get('rb.list') || [], syncedAt: ls.get('rb.syncedAt') || 0, loaded: !!ls.get('rb.list'), schema: ls.get('rb.schema') || null,
  full: {}, fullErr: {}, listing: false, listErr: null, filter: null, fpanel: false, closed: {},
  serv: ls.get('rb.serv') || {}, cook: null, alerts: [], lastRoute: ''
};
const route = () => { const h = location.hash.replace(/^#\/?/, ''); const [view, id] = h.split('/'); return { view: view || 'list', id: id ? decodeURIComponent(id) : null }; };
const getSum = id => state.recipes.find(r => r.id === id);

async function syncList() {
  if (!connected() || state.listing) return;
  state.listing = true; state.listErr = null; refresh();
  try {
    const [pages] = await Promise.all([queryAll(), syncSchema()]);
    const list = pages.map(pageToSummary);
    for (const s of list) {
      const c = ls.get('rb.full.' + s.id);
      if (c && c.updated !== s.updated) delete state.full[s.id];   // changed in Notion: fetch again
    }
    const keep = new Set(list.map(s => s.id));
    for (const old of state.recipes) if (!keep.has(old.id)) { ls.del('rb.full.' + old.id); ls.del('rb.cook.' + old.id); delete state.full[old.id]; }
    state.recipes = list; state.loaded = true; state.syncedAt = Date.now(); state.fullErr = {};
    ls.set('rb.list', list); ls.set('rb.syncedAt', state.syncedAt);
    prefetch();
  } catch (e) { state.listErr = e; }
  state.listing = false; refresh();
}
/* Fetch every recipe after a sync so the whole book works offline. */
async function prefetch() {
  const todo = state.recipes.filter(r => !state.full[r.id]).map(r => r.id);
  await pool(todo, 2, async id => { try { await loadFull(id); } catch { } if (route().view === 'list') renderRows(); });
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
      ls.set('rb.full.' + id, { updated: sum ? sum.updated : '', data: full });
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
  loadFull(id).then(() => { if (route().id === id) render(false); }, () => { if (route().id === id) render(false); });
}
/* Library facets come from the database columns, with the recipe's own data as a fallback. */
const facet = (r, k, fk) => { const v = r[k]; if (Array.isArray(v) ? v.length : v) return v; const f = state.full[r.id]; return f ? f[fk || k] : v; };
const totalOf = r => { const t = num(facet(r, 'totalMin')); if (t != null) return t; const p = num(facet(r, 'prepMin')), c = num(facet(r, 'cookMin')); return p != null || c != null ? (p || 0) + (c || 0) : null; };
const coverFor = r => (state.full[r.id] && state.full[r.id].cover) || r.cover || '';
const iconFor = r => r.icon || (state.full[r.id] && state.full[r.id].icon) || '🍽️';
const ratingOf = r => r.rating || (state.full[r.id] && state.full[r.id].rating) || null;
const cookedOf = r => { const c = (state.full[r.id] && state.full[r.id].cooks) || []; return { n: r.timesCooked || c.length, last: r.lastCooked || (c[0] && c[0].date) || '' }; };

/* ---------- rendering ---------- */
function render(resetScroll = true) {
  try { renderView(resetScroll); }
  catch (err) { console.error(err); renderCrash(err); }
}
function renderCrash(err) {
  topbar.innerHTML = '';
  app.innerHTML = `<div class="empty"><div class="big">⚠️</div><h3>Something went wrong</h3><p>${esc(err && err.message || err)}</p><p><button class="btn primary" id="crash-reset">Clear cached data and reload</button></p></div>`;
  $('#crash-reset').addEventListener('click', () => {
    try { Object.keys(localStorage).filter(k => /^rb\.(full\.|cook\.|list$|syncedAt$|schema$|serv$)/.test(k)).forEach(k => ls.del(k)); } catch { }
    location.hash = ''; location.reload();
  });
}
function renderView(resetScroll) {
  const r = route(); const key = r.view + '/' + (r.id || '');
  if (key !== state.lastRoute) { closeOverlay(); if (r.view !== 'cook') { stopTick(); releaseWake(); } }
  if (!connected() && !['settings', 'setup'].includes(r.view)) { location.replace('#/setup'); return; }
  let html, bar;
  switch (r.view) {
    case 'r': [bar, html] = recipeView(r.id); break;
    case 'cook': [bar, html] = cookView(r.id); break;
    case 'settings': [bar, html] = settingsView(); break;
    case 'setup': [bar, html] = setupView(); break;
    default: [bar, html] = listView();
  }
  topbar.innerHTML = `<div class="row">${bar}</div>`;
  app.innerHTML = html;
  document.body.classList.toggle('cooking', r.view === 'cook');
  if (r.view === 'list') renderRows();
  if (r.view === 'cook' && state.cook) { startTick(); requestWake(); renderAlerts(); }
  if (key !== state.lastRoute && resetScroll) window.scrollTo(0, 0);
  state.lastRoute = key;
  onScroll();
}
function refresh() {
  const v = route().view;
  if (v === 'list') { const rb = $('#rbtn'); if (rb) rb.classList.toggle('spin', state.listing); renderRows(); }
  else if (v === 'r' || v === 'cook') render(false);
}
window.addEventListener('hashchange', () => render());
function onScroll() { topbar.classList.toggle('scrolled', window.scrollY > 4); }
window.addEventListener('scroll', onScroll, { passive: true });
const backBtn = to => `<a class="ibtn" href="${to}" aria-label="Back">${I.back}</a>`;
const crumb = parts => `<div class="crumb">${parts.map((p, i) => (i ? '<span class="sep">/</span>' : '') + p).join('')}</div>`;
function errorCallout(e, retry) {
  return `<div class="callout red"><div class="ci">⚠️</div><div class="cb">${esc(errText(e))}${retry ? `<div class="actions"><button class="btn small" data-act="${retry}">Try again</button>${e && ['object_not_found', 'restricted_resource', 'unauthorized'].includes(e.code) ? '<a class="btn small ghost" href="#/settings">Settings</a>' : ''}</div>` : ''}</div></div>`;
}
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function keep(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }

/* ---------- library ---------- */
const FACETS = [['cuisine', 'Cuisine', 'Cuisine', 'cuisine'], ['main', 'Main ingredient', 'Main ingredient', 'mainIngredients'], ['tags', 'Tags', 'Tags', 'tags'], ['equipment', 'Equipment', 'Equipment', 'equipment']];
const MAXTIMES = [15, 30, 45, 60, 90, 120];
const FDEF = () => ({ q: '', tab: 'all', cuisine: [], main: [], tags: [], equipment: [], maxMin: null });
/* Sort keys shared by the grid's sort menu and the list's column headers: [label, value, default direction]. Empty values always sort last. */
const courseRank = c => { const i = options('Course').findIndex(o => o[0] === c); return c ? (i < 0 ? 999 : i) : null; };
const SORTS = {
  name: ['Name', r => fold(r.name), 1],
  course: ['Course', r => courseRank(facet(r, 'course')), 1],
  time: ['Total time', r => totalOf(r), 1],
  rating: ['Rating', r => ratingOf(r), -1],
  cuisine: ['Cuisine', r => fold((facet(r, 'cuisine') || [])[0]), 1],
  main: ['Main ingredient', r => fold((facet(r, 'main', 'mainIngredients') || [])[0]), 1],
  cooked: ['Times cooked', r => cookedOf(r).n || null, -1],
  last: ['Last cooked', r => cookedOf(r).last, -1],
  status: ['Status', r => r.review ? 0 : 1, 1]
};
const MENU_SORTS = ['name', 'course', 'cuisine', 'time', 'rating', 'last', 'cooked'];
const viewMode = () => cfg.view === 'list' ? 'list' : 'grid';
const sortKey = () => SORTS[cfg.sort] ? cfg.sort : 'name';
const sortDir = () => cfg.dir === -1 ? -1 : 1;
function sortList(list) {
  const get = SORTS[sortKey()][1], dir = sortDir();
  return list.map(r => [r, get(r)]).sort(([a, x], [b, y]) => {
    const ex = x == null || x === '', ey = y == null || y === '';
    if (ex !== ey) return ex ? 1 : -1;
    return (ex ? 0 : (x < y ? -1 : x > y ? 1 : 0) * dir) || a.name.localeCompare(b.name);
  }).map(x => x[0]);
}
function activeFilters(f) {
  const a = [];
  FACETS.forEach(([k]) => f[k].forEach(v => a.push([k, v, v])));
  if (f.maxMin != null) a.push(['maxMin', '', `Up to ${fmtMin(f.maxMin)}`]);
  return a;
}
function listView() {
  if (!state.filter) state.filter = FDEF();
  const f = state.filter;
  const bar = crumb(['<span>🍲</span>', '<span>Recipe book</span>']) + `<button class="ibtn ${state.listing ? 'spin' : ''}" id="rbtn" data-act="sync" aria-label="Refresh">${I.refresh}</button><a class="ibtn" href="#/settings" aria-label="Settings">${I.gear}</a>`;
  const html = `
  <div class="page-icon">🍲</div>
  <h1 class="title">Recipe book</h1>
  <p class="desc" id="sync"></p>
  <div class="tabs" role="tablist">
    <button class="tab" role="tab" data-act="tab" data-tab="all" aria-selected="${f.tab === 'all'}">All recipes <span class="count" data-count="all"></span></button>
    <button class="tab" role="tab" data-act="tab" data-tab="review" aria-selected="${f.tab === 'review'}">To review <span class="count" data-count="review"></span></button>
  </div>
  <div class="toolbar">
    <label class="search">${I.search}<input id="q" type="search" placeholder="Search names and ingredients…" value="${esc(f.q)}" autocomplete="off"></label>
    <button class="tbtn ${state.fpanel ? 'on' : ''}" data-act="fpanel" aria-expanded="${state.fpanel}">Filter<span class="badge" id="fcount"></span></button>
  </div>
  <div id="fpanel"></div>
  <div class="chips" id="fchips"></div>
  <div class="sortrow"><span class="faint" id="count"></span><span class="viewctl"><select class="filter" id="sortf" aria-label="Sort by">${MENU_SORTS.map(k => `<option value="${k}" ${sortKey() === k ? 'selected' : ''}>${SORTS[k][0]}</option>`).join('')}${MENU_SORTS.includes(sortKey()) ? '' : `<option selected>${SORTS[sortKey()][0]}</option>`}</select><span class="seg"><button data-act="view" data-view="grid" aria-pressed="${viewMode() === 'grid'}" aria-label="Grid view">${I.grid}</button><button data-act="view" data-view="list" aria-pressed="${viewMode() === 'list'}" aria-label="List view">${I.rows}</button></span></span></div>
  <div id="rows"></div>`;
  return [bar, html];
}
function renderSync() {
  const el = $('#sync'); if (!el) return;
  if (state.listErr) { el.outerHTML = `<div id="sync">${errorCallout(state.listErr, 'sync')}</div>`; return; }
  el.textContent = state.listing ? 'Syncing with Notion…' : state.syncedAt ? `Synced with Notion at ${timeStr(state.syncedAt)}` : 'Recipes from your Notion database';
}
const haystack = r => { const f = state.full[r.id]; return fold([r.name, r.keyIngredients, f && f.name, f && f.keyIngredients.join(' ')].join(' ')); };
/* Within cuisine, main ingredient and equipment any selected option matches; tags must all match. */
function filtered() {
  const f = state.filter; const toks = fold(f.q).split(/\s+/).filter(Boolean);
  const any = (sel, have) => !sel.length || sel.some(x => (have || []).includes(x));
  return state.recipes.filter(r => {
    if (f.tab === 'review' && !r.review) return false;
    if (!any(f.cuisine, facet(r, 'cuisine')) || !any(f.main, facet(r, 'main', 'mainIngredients')) || !any(f.equipment, facet(r, 'equipment'))) return false;
    if (!f.tags.every(t => (facet(r, 'tags') || []).includes(t))) return false;
    if (f.maxMin != null) { const t = totalOf(r); if (t == null || t > f.maxMin) return false; }
    return toks.every(t => haystack(r).includes(t));
  });
}
function renderFilters() {
  const f = state.filter;
  document.querySelectorAll('[data-count]').forEach(n => { n.textContent = n.dataset.count === 'all' ? state.recipes.length : state.recipes.filter(r => r.review).length; });
  const act = activeFilters(f);
  const fc = $('#fcount'); if (fc) fc.textContent = act.length ? act.length : '';
  const chips = $('#fchips');
  if (chips) chips.innerHTML = act.length ? act.map(([k, v, label]) => `<button class="fchip" data-act="unf" data-k="${k}" data-v="${esc(v)}">${esc(label)} <span aria-hidden="true">✕</span></button>`).join('') + '<button class="linkbtn" data-act="clearf">Clear all</button>' : '';
  const panel = $('#fpanel'); if (!panel) return;
  if (!state.fpanel) { panel.innerHTML = ''; return; }
  const chip = (k, prop, v, on) => `<button class="tagchip ${colourOf(prop, v)}" data-act="tog" data-k="${k}" data-v="${esc(v)}" aria-pressed="${on}">${esc(v)}</button>`;
  const rowsHtml = FACETS.map(([k, label, prop, fk]) => {
    const have = new Set(state.recipes.flatMap(r => facet(r, k, fk) || []));
    const order = options(prop).map(o => o[0]);
    const vals = [...order.filter(x => have.has(x)), ...[...have].filter(x => !order.includes(x)).sort()];
    return vals.length ? `<div class="frow"><span class="flabel">${label}</span><div class="fopts">${vals.map(v => chip(k, prop, v, f[k].includes(v))).join('')}</div></div>` : '';
  }).join('');
  panel.innerHTML = `<div class="fpanel">${rowsHtml}
    <div class="frow"><span class="flabel">Group by</span><div class="fopts"><button class="tagchip gray" data-act="groupby" data-v="course" aria-pressed="${cfg.group === 'course'}">Course</button><button class="tagchip gray" data-act="groupby" data-v="none" aria-pressed="${cfg.group !== 'course'}">No grouping</button></div></div>
    <div class="frow"><span class="flabel">Total time</span><div class="fopts">${MAXTIMES.map(m => `<button class="tagchip gray" data-act="maxmin" data-v="${m}" aria-pressed="${f.maxMin === m}">≤ ${fmtMin(m)}</button>`).join('')}</div></div>
  </div>`;
}
function renderRows() {
  if (!state.filter) state.filter = FDEF();
  renderSync(); renderFilters();
  const el = $('#rows'); if (!el) return;
  if (!state.loaded) { el.innerHTML = `<p class="faint" style="padding:8px 0">Loading recipes…</p>`; return; }
  if (!state.recipes.length) {
    el.innerHTML = state.listErr ? '' : `<div class="empty"><div class="big">📖</div><h3>No recipes yet</h3><p>Add recipes with the Recipe book skill in Claude. They appear here after the next sync.</p></div>`;
    return;
  }
  const list = sortList(filtered());
  const cnt = $('#count'); if (cnt) cnt.textContent = list.length === state.recipes.length ? `${list.length} recipes` : `${list.length} of ${state.recipes.length}`;
  if (!list.length) { el.innerHTML = `<div class="empty"><div class="big">🔍</div><h3>No matches</h3><p>Try another word or clear the filters.</p><button class="btn small" data-act="clearf">Clear filters</button></div>`; return; }
  const grouped = cfg.group === 'course';
  const groups = [];
  list.forEach(r => { const k = grouped ? facet(r, 'course') || 'Other' : ''; let g = groups.find(g => g.k === k); if (!g) groups.push(g = { k, items: [] }); g.items.push(r); });
  const rank = k => k === 'Other' ? 1e6 : courseRank(k) ?? 1e5;
  groups.sort((a, b) => rank(a.k) - rank(b.k) || a.k.localeCompare(b.k));
  const closed = state.closed;
  const head = g => `<button class="grph" data-act="grp" data-k="${esc(g.k)}" aria-expanded="${!closed[g.k]}"><span class="car ${closed[g.k] ? '' : 'open'}">▸</span>${g.k === 'Other' ? '<span class="pill">No course</span>' : pill('Course', g.k)}<span class="count">${g.items.length}</span></button>`;
  if (viewMode() === 'grid') {
    el.innerHTML = groups.map(g => `${grouped ? head(g) : ''}${grouped && closed[g.k] ? '' : `<div class="gallery">${g.items.map(card).join('')}</div>`}`).join('');
    return;
  }
  const th = ([k, label]) => `<th class="${NUMCOLS.includes(k) ? 'n' : ''} ${k === 'name' ? 'nm' : ''}"><button data-act="sortcol" data-k="${k}">${label}${sortKey() === k ? (sortDir() > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;
  el.innerHTML = `<div class="dbwrap"><table class="db"><thead><tr>${COLS.map(th).join('')}</tr></thead>${groups.map(g => `<tbody>${grouped ? `<tr class="grp"><td colspan="${COLS.length}">${head(g)}</td></tr>` : ''}${grouped && closed[g.k] ? '' : g.items.map(r => `<tr data-href="#/r/${encodeURIComponent(r.id)}">${COLS.map(([k]) => cell(k, r)).join('')}</tr>`).join('')}</tbody>`).join('')}</table></div>`;
}
/* List view: a compact Notion-style table that fits the phone's width; tap a column header to sort by it. */
const COLS = [['name', 'Name'], ['course', 'Course'], ['cuisine', 'Cuisine']];
const NUMCOLS = [];
function cell(k, r) {
  switch (k) {
    case 'name': { const cover = coverFor(r); return `<td class="nm"><a href="#/r/${encodeURIComponent(r.id)}"><span class="thumb ${cover ? '' : 'noimg'}" data-icon="${esc(iconFor(r))}">${cover ? `<img src="${esc(imgUrl(cover))}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ''}</span><span>${esc(r.name)}</span></a></td>`; }
    case 'course': { const c = facet(r, 'course'); return `<td>${c ? pill('Course', c) : ''}</td>`; }
    case 'cuisine': return `<td class="pills">${(facet(r, 'cuisine') || []).map(x => pill('Cuisine', x)).join('')}</td>`;
  }
}
const shortMin = m => m < 60 ? Math.round(m) + ' min' : Math.floor(m / 60) + 'h' + (Math.round(m % 60) ? ' ' + Math.round(m % 60) + 'm' : '');
function card(r) {
  const cover = coverFor(r), t = totalOf(r), stars = ratingOf(r);
  return `<a class="card" href="#/r/${encodeURIComponent(r.id)}">
    <div class="ccover ${cover ? '' : 'noimg'}" data-icon="${esc(iconFor(r))}">${cover ? `<img src="${esc(imgUrl(cover))}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ''}${r.review ? '<span class="rvw">To review</span>' : ''}</div>
    <div class="cbody"><div class="ctitle">${esc(r.name)}</div>
    <div class="cmeta">${t != null ? `<span>${I.clock}${shortMin(t)}</span>` : ''}${stars ? `<span class="st">★ ${stars}</span>` : ''}</div></div></a>`;
}

/* ---------- recipe page ---------- */
const baseServ = r => num(r.servings) > 0 ? num(r.servings) : null;
const MULTS = [0.25, 0.5, 1, 1.5, 2, 3, 4];
const stepOf = b => b > 12 ? Math.max(1, Math.round(b / 10)) : 1;
/* With servings the scaler counts people; without, it is a multiplier. */
const factorOf = r => { const b = baseServ(r), v = state.serv[r.id]; return v == null ? 1 : b ? v / b : v; };
const servLabel = r => { const b = baseServ(r), v = state.serv[r.id]; if (b) { const n = v ?? b; return `${trimNum(n, 2)} serving${n === 1 ? '' : 's'}`; } return `${kitchen(v ?? 1)}× the recipe`; };
function ingredientsHtml(r, f, ck) {
  return r.ingredients.map((g, gi) => `${g.group ? `<h3 class="igroup">${esc(g.group)}</h3>` : ''}<ul class="ings ${ck ? 'checkable' : ''}">${g.items.map((it, ii) => {
    const a = amountText(it, f); const k = gi + ':' + ii; const got = ck && ck.checked[k];
    return `<li class="${got ? 'got' : ''}" ${ck ? `data-act="ingchk" data-k="${k}" role="checkbox" aria-checked="${!!got}"` : ''}>${ck ? `<span class="check">${I.tick}</span>` : ''}<span>${a.txt ? `<b class="amt">${esc(a.txt)}</b> ` : ''}${esc(it.item)}${it.note ? `<span class="muted">, ${esc(it.note)}</span>` : ''}${it.optional ? ' <span class="tagopt">optional</span>' : ''}${a.unscaled ? ' <span class="tagopt">not scaled</span>' : ''}</span></li>`;
  }).join('')}</ul>`).join('');
}
function scalerHtml(r) {
  const f = factorOf(r), b = baseServ(r);
  return `<div class="scaler"><button class="sbtn" data-act="serv" data-d="-1" aria-label="Fewer">−</button><span class="sval">${esc(servLabel(r))}</span><button class="sbtn" data-act="serv" data-d="1" aria-label="More">+</button>${f !== 1 ? '<button class="linkbtn" data-act="servreset">As written</button>' : ''}</div>
  ${f !== 1 && r.yield ? `<p class="caption">As written: ${esc(r.yield)}${b ? ` (${trimNum(b, 2)} servings)` : ''}.</p>` : ''}`;
}
function recipeView(id) {
  const sum = getSum(id);
  const bar0 = backBtn('#/') + crumb(['<span>Recipe book</span>', `<span>${esc(sum?.name || 'Recipe')}</span>`]);
  const r = state.full[id];
  openRecipe(id);
  if (!r) {
    const e = state.fullErr[id];
    if (!e) return [bar0, `<p class="faint" style="padding-top:40px">${connected() ? 'Opening recipe…' : 'Connect Notion in Settings to open this recipe.'}</p>`];
    if (e.code === 'no_app_data') return [bar0, `<h1 class="title" style="margin-top:24px">${esc(sum?.name || 'Recipe')}</h1><div class="callout"><div class="ci">💡</div><div class="cb">This page has no App data toggle, so the app can't read it. Save it again with the Recipe book skill in Claude, or open it in Notion.<div class="actions">${sum?.url ? `<a class="btn small" href="${esc(sum.url)}" target="_blank" rel="noopener">Open in Notion</a>` : ''}</div></div></div>`];
    return [bar0, `<div style="margin-top:24px">${errorCallout(e, 'retryfull')}</div>`];
  }
  const f = factorOf(r), cover = r.cover || sum?.cover || '', icon = r.icon || sum?.icon || '🍽️';
  const ck = ls.get('rb.cook.' + id);
  const total = r.totalMin ?? (r.prepMin != null || r.cookMin != null ? (r.prepMin || 0) + (r.cookMin || 0) : null);
  const times = [r.prepMin != null ? 'Prep ' + fmtMin(r.prepMin) : '', r.cookMin != null ? 'Cook ' + fmtMin(r.cookMin) : '', total != null ? 'Total ' + fmtMin(total) : ''].filter(Boolean).join(' · ');
  const src = [r.source, r.author].filter(Boolean).join(', ');
  const prop = (icon, label, val) => val ? `<div class="prop"><div class="plabel">${icon}${label}</div><div class="pval">${val}</div></div>` : '';
  const rating = r.rating || sum?.rating;
  const bar = backBtn('#/') + crumb([`<span>${esc(icon)}</span>`, `<span>${esc(r.name)}</span>`]);
  const html = `
  <div class="cover ${cover ? '' : 'plain'}">${cover ? `<img src="${esc(imgUrl(cover))}" alt="" onerror="this.parentNode.classList.add('plain');this.remove()">` : ''}</div>
  <div class="cover-icon">${esc(icon)}</div>
  <h1 class="title">${esc(r.name)}</h1>
  <div class="props">
    ${prop(I.link, 'Source', src ? (r.link ? `<a class="plink" href="${esc(r.link)}" target="_blank" rel="noopener">${esc(src)}</a>` : esc(src)) : '')}
    ${prop(I.users, 'Serves', esc(r.yield || (r.servings != null ? trimNum(r.servings, 2) : '')))}
    ${prop(I.clock, 'Time', times ? esc(times) + (r.timeNote ? `<span class="muted">${esc(r.timeNote)}</span>` : '') : '')}
    ${prop(I.list, 'Course', r.course ? pill('Course', r.course) : '')}
    ${prop(I.globe, 'Cuisine', r.cuisine.map(x => pill('Cuisine', x)).join(''))}
    ${prop(I.leaf, 'Main ingredient', r.mainIngredients.map(x => pill('Main ingredient', x)).join(''))}
    ${prop(I.pot, 'Equipment', r.equipment.map(x => pill('Equipment', x)).join('') + (r.equipmentNote ? `<span class="muted">${esc(r.equipmentNote)}</span>` : ''))}
    ${prop(I.tag, 'Tags', r.tags.map(x => pill('Tags', x)).join(''))}
    ${prop(I.flame, 'Energy', r.kcal != null ? `About ${esc(trimNum(r.kcal, 0))} kcal per serving` : '')}
    ${prop(I.star, 'Rating', starsHtml(rating))}
  </div>
  ${r.glance.length ? `<ul class="bullets">${r.glance.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  ${r.review ? `<div class="callout yellow"><div class="ci">⚠️</div><div class="cb"><b>Check before cooking</b>${r.uncertain.length ? `<ul>${r.uncertain.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` : '<p>This recipe hasn\'t been checked yet.</p>'}</div></div>` : ''}
  ${r.about ? `<h2>About</h2>${r.about.split(/\n+/).filter(x => x.trim()).map(x => `<p class="prose">${esc(x)}</p>`).join('')}` : ''}
  <h2>Ingredients</h2>
  ${r.ingredients.length ? scalerHtml(r) + ingredientsHtml(r, f, null) : '<p class="faint">None listed</p>'}
  <h2>Method</h2>
  ${r.steps.length ? `<ol class="method">${r.steps.map(s => `<li>${s.title ? `<b>${esc(s.title)}.</b> ` : ''}${esc(s.text)}${s.timerMin ? ` <span class="tchip">${I.clock}${fmtMin(s.timerMin)}</span>` : ''}</li>`).join('')}</ol>${f !== 1 ? '<p class="caption">Amounts written in the steps are for the original recipe.</p>' : ''}` : '<p class="faint">No steps listed</p>'}
  ${r.tips.length ? `<h2>Tips and variations</h2><ul class="bullets">${r.tips.map(t => `<li>${t.label ? `<b>${esc(t.label)}:</b> ` : ''}${esc(t.text)}</li>`).join('')}</ul>` : ''}
  ${r.storage.length ? `<h2>Storage</h2><ul class="bullets">${r.storage.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  ${r.serveWith ? `<h2>Serve with</h2><p class="prose">${esc(r.serveWith)}</p>` : ''}
  ${r.notes ? `<h2>Notes</h2><p class="prose">${esc(r.notes)}</p>` : ''}
  <h2>Cook log</h2>
  ${r.cooks.length ? `<div class="tablewrap"><table class="nt"><thead><tr><th>Date</th><th class="n">Serves</th><th>Rating</th><th>Notes</th></tr></thead><tbody>${r.cooks.map(c => `<tr><td style="white-space:nowrap">${esc(dateStr(c.date))}</td><td class="n">${c.servings != null ? esc(trimNum(c.servings, 2)) : ''}</td><td style="white-space:nowrap">${starsHtml(c.rating >= 1 ? Math.min(5, Math.round(c.rating)) : null)}</td><td>${esc(c.notes)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="faint" style="font-size:14px">Not cooked yet.</p>'}
  <hr class="div">
  <div class="actions">
    <a class="btn primary" href="#/cook/${encodeURIComponent(id)}">${I.play}${ck && ck.step > 0 ? `Continue cooking (step ${ck.step + 1})` : 'Start cooking'}</a>
    ${ck && ck.step > 0 ? '<button class="btn ghost" data-act="cookreset">Start over</button>' : ''}
    ${sum?.url ? `<a class="btn ghost" href="${esc(sum.url)}" target="_blank" rel="noopener">Open in Notion</a>` : ''}
    ${r.link ? `<a class="btn ghost" href="${esc(r.link)}" target="_blank" rel="noopener">Original recipe</a>` : ''}
  </div>`;
  return [bar, html];
}

/* ---------- cook mode ---------- */
const ckGet = id => Object.assign({ step: 0, checked: {}, timers: {}, fired: {} }, ls.get('rb.cook.' + id) || {});
const ckSave = (id, c) => ls.set('rb.cook.' + id, c);
const tSecs = s => Math.round(s.timerMin * 60);
const tLeft = (t, total) => !t ? total : t.running ? Math.max(0, (t.endAt - Date.now()) / 1000) : (t.remaining ?? total);
function cookView(id) {
  const back = '#/r/' + encodeURIComponent(id);
  const r = state.full[id];
  if (!r) { state.cook = null; openRecipe(id); return [backBtn(back) + crumb(['<span>Cook</span>']), '<p class="faint" style="padding-top:40px">Opening recipe…</p>']; }
  const steps = r.steps.length ? r.steps : [{ title: 'Cook', text: 'This recipe has no method steps. The ingredients are below.', timerMin: null }];
  const ck = ckGet(id); const i = Math.min(Math.max(0, ck.step), steps.length - 1); const s = steps[i];
  state.cook = { id, steps, name: r.name, i };
  const f = factorOf(r), b = baseServ(r);
  const bar = `<a class="ibtn" href="${back}" aria-label="Close cook mode">${I.close}</a>` + crumb([`<span>${esc(r.name)}</span>`]) + `<span class="stepno">${i + 1} / ${steps.length}</span>`;
  const html = `
  <div class="progress"><div style="width:${Math.round((i + 1) / steps.length * 100)}%"></div></div>
  <div class="alerts" id="alerts"></div>
  <div class="running" id="running"></div>
  <div class="cstep">
    <div class="cnum">Step ${i + 1} of ${steps.length}</div>
    ${s.title ? `<h1 class="steptitle">${esc(s.title)}</h1>` : ''}
    <p class="ctext">${esc(s.text)}</p>
    ${s.timerMin ? timerBlock(i, s, ck) : ''}
    ${f !== 1 ? `<p class="caption">Amounts written in the steps are for ${b ? `the original ${trimNum(b, 2)} servings` : 'the original recipe'}. The ingredient list is scaled to ${esc(servLabel(r))}.</p>` : ''}
  </div>
  <div class="cooknav">
    <button class="handle" data-act="ings"><span class="grab"></span><span>Ingredients</span></button>
    <div class="navrow"><button class="btn" data-act="cstep" data-d="-1" ${i === 0 ? 'disabled' : ''}>‹ Back</button><button class="btn primary" data-act="cstep" data-d="1">${i === steps.length - 1 ? 'Done' : 'Next ›'}</button></div>
  </div>`;
  return [bar, html];
}
function timerBlock(i, s, ck) {
  const t = ck.timers[i], total = tSecs(s), rem = tLeft(t, total);
  const label = t && t.running ? 'Pause' : t && t.remaining != null && t.remaining > 0 && t.remaining < total ? 'Resume' : `Start ${fmtMin(s.timerMin)} timer`;
  return `<div class="timer"><div class="clock" data-clock="${i}">${mmss(rem)}</div><div class="actions"><button class="btn ${t && t.running ? '' : 'primary'}" data-act="tgo" data-i="${i}">${label}</button>${t ? `<button class="btn ghost" data-act="treset" data-i="${i}">Reset</button>` : ''}</div></div>`;
}
function renderRunning() {
  const el = $('#running'); const c = state.cook; if (!el || !c) return;
  const ck = ckGet(c.id);
  el.innerHTML = Object.keys(ck.timers).map(Number).filter(j => j !== c.i && ck.timers[j].running && c.steps[j]).map(j => `<button class="rchip" data-act="gostep" data-i="${j}">${I.clock}<span>${esc(c.steps[j].title || 'Step ' + (j + 1))}</span><b data-clock="${j}">${mmss(tLeft(ck.timers[j], tSecs(c.steps[j])))}</b></button>`).join('');
}
function ingSheet() {
  const c = state.cook; if (!c) return; const r = state.full[c.id]; if (!r) return;
  const ck = ckGet(c.id);
  overlay.innerHTML = `<div class="scrim" data-act="closeov"><div class="sheet tall" data-stop="1"><div class="grab"></div>
    <div class="sheethead"><h3>Ingredients</h3><span class="muted">${esc(servLabel(r))}</span></div>
    ${r.ingredients.length ? ingredientsHtml(r, factorOf(r), ck) : '<p class="faint">None listed</p>'}
  </div></div>`;
}
function moveStep(d, finish) {
  const c = state.cook; if (!c) return;
  const ck = ckGet(c.id);
  if (c.i + d >= c.steps.length) {
    if (!finish) return;
    c.steps.forEach((s, j) => { if (s.timerMin) cancelTimer(c.id, j); });
    ls.del('rb.cook.' + c.id); state.alerts = [];
    toast('Enjoy your meal');
    location.hash = '#/r/' + encodeURIComponent(c.id); return;
  }
  if (c.i + d < 0) return;
  ck.step = c.i + d; ckSave(c.id, ck); render(false);
}
/* Native alarms fire with the screen off or the app in the background. */
const nid = key => { let h = 7; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) % 2000000000 + 1; };
async function ensureNotifyPermission() {
  if (!LN) return false;
  try { let p = await LN.checkPermissions(); if (p.display !== 'granted') p = await LN.requestPermissions(); return p.display === 'granted'; } catch { return false; }
}
async function scheduleTimer(id, i, s, endAt, name) {
  if (!LN) return;
  try { await LN.schedule({ notifications: [{ id: nid(id + ':' + i), title: `${s.title || 'Step ' + (i + 1)}: time's up`, body: name, schedule: { at: new Date(endAt), allowWhileIdle: true }, channelId: 'cook' }] }); }
  catch { toast('Couldn\'t set the alarm. Keep the app open.'); }
}
async function cancelTimer(id, i) { if (!LN) return; try { await LN.cancel({ notifications: [{ id: nid(id + ':' + i) }] }); } catch { } }
let tickId = null, audio = null, wake = null;
function startTick() { stopTick(); tickId = setInterval(tick, 500); tick(); }
function stopTick() { if (tickId) clearInterval(tickId); tickId = null; }
function tick() {
  const c = state.cook; if (!c || route().view !== 'cook') return;
  const ck = ckGet(c.id);
  for (const [k, t] of Object.entries(ck.timers)) {
    const j = +k, s = c.steps[j]; if (!s || !s.timerMin) continue;
    const rem = tLeft(t, tSecs(s));
    document.querySelectorAll(`[data-clock="${j}"]`).forEach(el => { el.textContent = mmss(rem); });
    if (t.running && rem <= 0 && !ck.fired[j]) { ck.fired[j] = 1; t.running = false; t.remaining = 0; ckSave(c.id, ck); inAppAlert(`${s.title || 'Step ' + (j + 1)}: time's up`); render(false); return; }
  }
  renderRunning();
}
function inAppAlert(msg) { state.alerts.push({ id: String(Date.now() + Math.random()), msg }); renderAlerts(); beep(); try { navigator.vibrate && navigator.vibrate([300, 120, 300]); } catch { } }
function renderAlerts() { const el = $('#alerts'); if (el) el.innerHTML = state.alerts.map(a => `<div class="alert" role="alert"><span>${esc(a.msg)}</span><button data-act="dismiss" data-id="${a.id}">Done</button></div>`).join(''); }
function beep() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    [0, 0.35, 0.7].forEach(off => { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = 880; o.type = 'square'; g.gain.setValueAtTime(0.0001, audio.currentTime + off); g.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + off + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + off + 0.25); o.connect(g).connect(audio.destination); o.start(audio.currentTime + off); o.stop(audio.currentTime + off + 0.3); });
  } catch { }
}
function primeAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { } }
async function requestWake() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch { } }
function releaseWake() { try { wake && wake.release(); } catch { } wake = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (route().view === 'cook') { requestWake(); tick(); }
  if (route().view === 'list' && Date.now() - state.syncedAt > 5 * 60 * 1000) syncList();
});
/* Swipes in cook mode: left/right changes step, up on the bar at the bottom opens the ingredients, down closes them. */
let touch0 = null;
document.addEventListener('touchstart', e => {
  if (route().view !== 'cook' || e.touches.length !== 1) { touch0 = null; return; }
  const t = e.touches[0]; touch0 = { x: t.clientX, y: t.clientY, el: e.target, at: Date.now() };
}, { passive: true });
document.addEventListener('touchend', e => {
  const st = touch0; touch0 = null; if (!st || Date.now() - st.at > 900) return;
  const t = e.changedTouches[0]; const dx = t.clientX - st.x, dy = t.clientY - st.y;
  const vertical = Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx) * 1.4, horizontal = Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4;
  const sheet = overlay.querySelector('.sheet');
  if (sheet) { if (vertical && dy > 0 && (st.el.closest('.grab, .sheethead') || sheet.scrollTop <= 0)) closeOverlay(); return; }
  if (vertical && dy < 0 && st.el.closest('.cooknav')) { ingSheet(); return; }
  if (horizontal && !st.el.closest('.cooknav, .running')) moveStep(dx < 0 ? 1 : -1, false);
}, { passive: true });

/* ---------- settings & setup ---------- */
/* ---------- finding (or creating) the database ---------- */
/* Any database the integration can see that has BOOK.marker columns counts as this app's database. */
const dbUrl = () => cfg.db ? 'https://www.notion.so/' + String(cfg.db).replace(/-/g, '') : 'https://www.notion.so';
const connected = () => !!(cfg.token && cfg.ds);
async function searchAll(value, limit = 300) {
  const out = []; let cursor = null;
  do {
    const d = await napi('/search', { method: 'POST', body: { filter: { property: 'object', value }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }, read: true });
    out.push(...(d.results || []).filter(x => !x.in_trash && !x.archived));
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor && out.length < limit);
  return out;
}
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
  cfg.ds = b.id; cfg.db = b.db || ''; saveCfg(); setupState = null;
  const msg = $('#setupmsg');
  if (msg) msg.innerHTML = `<div class="callout"><div class="ci">✅</div><div class="cb">Connected to ${esc(b.name || BOOK.name)}.</div></div>`;
  state.recipes = []; state.loaded = false; syncList();
  if (route().view === 'setup') setTimeout(() => { location.hash = '#/'; }, 600);
}
let setupState = null;
function setupChoices() {
  const s = setupState; if (!s) return '';
  const btn = (act, x) => `<button class="btn small" data-act="${act}" data-id="${esc(x.id)}">${esc(x.name)}</button>`;
  if (s.books.length) return `<div class="callout"><div class="ci">📚</div><div class="cb">Found more than one ${esc(BOOK.name)} database. Which one should the app use?<div class="actions">${s.books.map(b => btn('pickbook', b)).join('')}</div></div></div>`;
  if (s.pages.length) return `<div class="callout"><div class="ci">✨</div><div class="cb">No ${esc(BOOK.name)} database yet. Pick a page and the app creates an empty one in it, with all the right columns.${BOOK.createNote ? ' ' + BOOK.createNote : ''}<div class="actions">${s.pages.map(p => btn('createbook', p)).join('')}</div><p class="faint" style="font-size:13px;margin-top:8px">Already have one? Add the integration to it (••• → Connections) and try again.</p></div></div>`;
  return `<div class="callout"><div class="ci">🔌</div><div class="cb">Connected, but the integration can't see any pages yet. In Notion, open the page where ${esc(BOOK.name)} should live (or your existing ${esc(BOOK.name)} database), tap <b>•••</b> → <b>Connections</b> and add your integration. Then try again.</div></div>`;
}
async function testConnection() {
  const msg = $('#setupmsg'); const tok = ($('#tok')?.value || '').trim(); const dsIn = ($('#ds')?.value || '').trim().replace(/^collection:\/\//, '');
  if (!tok) { msg.innerHTML = errorCallout({ code: 'x', message: 'Paste the secret first.' }); return; }
  const prev = cfg.token;
  cfg.token = tok; setupState = null;
  msg.innerHTML = '<p class="faint" style="font-size:14px">Checking…</p>';
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
  msg.innerHTML = `<p class="faint" style="font-size:14px">Creating ${esc(BOOK.name)}…</p>`;
  try { useBook(await createBook(id)); }
  catch (e) {
    const noInsert = e && (e.code === 'restricted_resource' || e.status === 403);
    msg.innerHTML = (noInsert ? errorCallout({ code: 'x', message: `Your integration isn't allowed to add content. At notion.so/my-integrations, open it, tick "Insert content" under Capabilities, save, and try again.` }) : errorCallout(e)) + setupChoices();
  }
}
function setupView() {
  const html = `
  <div class="page-icon">🍲</div>
  <h1 class="title">Connect Recipe book to Notion</h1>
  <p class="desc">One-time setup. The app reads your Recipe book database directly, with a private key that stays on this phone.</p>
  <ol class="steps-list">
    <li>On a computer, go to <b>notion.so/my-integrations</b>. Use an existing integration, or choose <b>New integration</b> (type <b>Internal</b>). Reading content is enough; also allow inserting content if you want the app to create the database for you.</li>
    <li>Copy the <b>Internal Integration Secret</b>. It starts with <code class="k">ntn_</code> or <code class="k">secret_</code>.</li>
    <li>In Notion, open the page where Recipe book should live (or your existing Recipe book database), tap <b>•••</b> → <b>Connections</b>, and add the integration.</li>
    <li>Paste the secret below. The app finds your Recipe book database, or offers to create an empty one.</li>
  </ol>
  <div class="field"><label>Secret</label><input id="tok" type="password" autocomplete="off" placeholder="ntn_…" value="${esc(cfg.token)}"></div>
  <div id="setupmsg"></div>
  <div class="actions"><button class="btn primary block" data-act="connect">Connect</button></div>`;
  return [crumb(['<span>🍲</span>', '<span>Setup</span>']), html];
}
function settingsView() {
  const saved = state.recipes.filter(r => state.full[r.id]).length;
  const html = `
  <div class="page-icon">⚙️</div>
  <h1 class="title">Settings</h1>
  <h2>Notion</h2>
  <div class="field"><label>Secret</label><input id="tok" type="password" autocomplete="off" value="${esc(cfg.token)}" placeholder="ntn_…"></div>
  <div class="field"><label>Data source ID</label><input id="ds" value="${esc(cfg.ds)}" autocomplete="off" placeholder="Leave empty to find it automatically"></div>
  <div id="setupmsg"></div>
  <div class="actions"><button class="btn small" data-act="connect">Save and test</button><a class="btn small ghost" href="${dbUrl()}" target="_blank" rel="noopener">Open Recipe book in Notion</a></div>
  <h2>Adding and editing recipes</h2>
  <p style="font-size:14px">Use the <b>Recipe book</b> skill in Claude (see the project page on GitHub). It keeps the readable Notion page and the app's data in step. Changes appear here after the next sync.</p>
  <h2>Offline copy</h2>
  <p style="font-size:14px" class="muted">${saved} of ${state.recipes.length} recipes saved on this phone. Cover photos need a connection unless the phone has cached them.</p>
  <div class="actions"><button class="btn small ghost danger" data-act="clearcache">Clear saved copy</button></div>`;
  return [backBtn('#/') + crumb(['<span>Recipe book</span>', '<span>Settings</span>']), html];
}
/* ---------- overlays ---------- */
function closeOverlay() { overlay.innerHTML = ''; }

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  if (e.target.closest('[data-stop]') && !e.target.closest('[data-act]')) return;
  const a = e.target.closest('[data-act]');
  if (!a) { const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a')) location.hash = tr.dataset.href; return; }
  const act = a.dataset.act; const { id } = route();
  switch (act) {
    case 'sync': syncList(); break;
    case 'tab': state.filter.tab = a.dataset.tab; document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t === a)); renderRows(); break;
    case 'fpanel': state.fpanel = !state.fpanel; a.classList.toggle('on', state.fpanel); a.setAttribute('aria-expanded', state.fpanel); renderRows(); break;
    case 'tog': { const f = state.filter, k = a.dataset.k, v = a.dataset.v; f[k] = f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v]; renderRows(); break; }
    case 'maxmin': { const f = state.filter, v = +a.dataset.v; f.maxMin = f.maxMin === v ? null : v; renderRows(); break; }
    case 'unf': { const f = state.filter, k = a.dataset.k, v = a.dataset.v; if (k === 'maxMin') f.maxMin = null; else f[k] = f[k].filter(x => x !== v); renderRows(); break; }
    case 'clearf': state.filter = { ...FDEF(), tab: state.filter.tab, q: state.filter.q }; renderRows(); break;
    case 'grp': state.closed[a.dataset.k] = !state.closed[a.dataset.k]; renderRows(); break;
    case 'view': cfg.view = a.dataset.view; saveCfg(); keep(() => render(false)); break;
    case 'sortcol': { const k = a.dataset.k; if (sortKey() === k) cfg.dir = -sortDir(); else { cfg.sort = k; cfg.dir = SORTS[k][2]; } saveCfg(); renderRows(); break; }
    case 'groupby': cfg.group = a.dataset.v; saveCfg(); renderRows(); break;
    case 'retryfull': delete state.fullErr[id]; delete tried[id]; render(false); break;
    case 'serv': {
      const r = state.full[id]; if (!r) break; const b = baseServ(r), d = +a.dataset.d;
      if (b) { const st = stepOf(b), cur = state.serv[id] ?? b; const v = Math.max(st, Math.min(b * 20, cur + d * st)); if (v === b) delete state.serv[id]; else state.serv[id] = v; }
      else { let k = MULTS.indexOf(state.serv[id] ?? 1); if (k < 0) k = MULTS.indexOf(1); k = Math.max(0, Math.min(MULTS.length - 1, k + d)); if (MULTS[k] === 1) delete state.serv[id]; else state.serv[id] = MULTS[k]; }
      ls.set('rb.serv', state.serv); keep(() => render(false)); break;
    }
    case 'servreset': delete state.serv[id]; ls.set('rb.serv', state.serv); keep(() => render(false)); break;
    case 'cookreset': { const c = ckGet(id); Object.keys(c.timers).forEach(j => cancelTimer(id, +j)); ls.del('rb.cook.' + id); keep(() => render(false)); break; }
    case 'cstep': moveStep(+a.dataset.d, true); break;
    case 'gostep': { const ck = ckGet(id); ck.step = +a.dataset.i; ckSave(id, ck); render(false); break; }
    case 'ings': ingSheet(); break;
    case 'ingchk': { const ck = ckGet(id); const k = a.dataset.k; if (ck.checked[k]) delete ck.checked[k]; else ck.checked[k] = 1; ckSave(id, ck); a.classList.toggle('got', !!ck.checked[k]); a.setAttribute('aria-checked', !!ck.checked[k]); break; }
    case 'closeov': if (e.target === a) closeOverlay(); break;
    case 'tgo': {
      primeAudio();
      const i = +a.dataset.i, s = state.cook && state.cook.steps[i]; if (!s) break;
      const ck = ckGet(id), total = tSecs(s), t = ck.timers[i] || {};
      if (t.running) { t.remaining = Math.max(0, (t.endAt - Date.now()) / 1000); t.running = false; cancelTimer(id, i); }
      else {
        let rem = t.remaining ?? total; if (rem <= 0) rem = total;
        delete ck.fired[i]; t.endAt = Date.now() + rem * 1000; t.running = true; t.remaining = null;
        ck.timers[i] = t; ckSave(id, ck);
        if (await ensureNotifyPermission()) scheduleTimer(id, i, s, t.endAt, state.cook.name);
        else if (LN) toast('Notifications are off, so timers only sound with the app open.');
      }
      ck.timers[i] = t; ckSave(id, ck); render(false); break;
    }
    case 'treset': { const i = +a.dataset.i; const ck = ckGet(id); delete ck.timers[i]; delete ck.fired[i]; ckSave(id, ck); cancelTimer(id, i); render(false); break; }
    case 'dismiss': state.alerts = state.alerts.filter(x => x.id !== a.dataset.id); renderAlerts(); break;
    case 'connect': testConnection(); break;
    case 'pickbook': case 'createbook': setupAction(act, a.dataset.id); break;
    case 'clearcache': {
      if (!a.classList.contains('armed')) { a.classList.add('armed'); a.textContent = 'Tap again to clear'; break; }
      for (const r of state.recipes) ls.del('rb.full.' + r.id);
      ls.del('rb.list'); state.recipes = []; state.full = {}; state.loaded = false; toast('Cleared. Syncing again…'); syncList(); render(false); break;
    }
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { state.filter.q = e.target.value; renderRows(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'sortf' && SORTS[e.target.value]) { cfg.sort = e.target.value; cfg.dir = SORTS[cfg.sort][2]; saveCfg(); renderRows(); }
});

/* ---------- native glue ---------- */
if (AppP) {
  AppP.addListener('backButton', () => {
    if (overlay.innerHTML) { closeOverlay(); return; }
    const r = route();
    if (r.view === 'list' || r.view === 'setup') AppP.exitApp();
    else if (r.view === 'cook') location.hash = '#/r/' + encodeURIComponent(r.id);
    else history.back();
  });
}
if (LN) {
  LN.createChannel({ id: 'cook', name: 'Cooking timers', description: 'Timers from cook mode', importance: 5, visibility: 1, vibration: true, lights: true }).catch(() => { });
}

/* ---------- start ---------- */
for (const r of state.recipes) {
  try {
    const c = ls.get('rb.full.' + r.id);
    if (c && c.data) { const d = normalise(c.data); d.id = r.id; state.full[r.id] = d; }
  } catch (err) { console.error('Dropping bad cached recipe', r.id, err); ls.del('rb.full.' + r.id); }
}
render();
if (connected()) syncList();
