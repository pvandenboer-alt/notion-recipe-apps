"use strict";
/* Brew book: Android app (Capacitor) reading and writing a Notion database. */

/* ---------- config & storage ---------- */
const API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2025-09-03';
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } }
};
const cfg = Object.assign({ token: '', ds: '', db: '', batchL: 23, eff: 72 }, ls.get('bb.cfg') || {});
const saveCfg = () => ls.set('bb.cfg', cfg);
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
const fx = (n, d = 0) => (n == null || !isFinite(n)) ? '–' : Number(n).toFixed(d);
const grav = n => (n == null || !isFinite(n)) ? '–' : Number(n).toFixed(3);
const kgTxt = kg => kg == null ? '–' : (kg < 1 ? Math.round(kg * 1000) + ' g' : kg.toFixed(2) + ' kg');
const gTxt = g => g == null ? '–' : (g < 10 ? (Math.round(g * 10) / 10) : Math.round(g)) + ' g';
const mmss = s => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60), r = s % 60; return m + ':' + String(r).padStart(2, '0'); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cleanId = id => String(id || '').replace(/-/g, '');
const timeStr = t => new Date(t).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
const I = {
  back: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  refresh: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
  gear: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  compose: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  search: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  close: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  status: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor"/></svg>'
};

/* ---------- brewing maths ---------- */
const PPG_DEFAULT = { grain: 37, adjunct: 34, extract: 36, sugar: 46 };
const MASHED = t => !t || t === 'grain' || t === 'adjunct';
const SRM_HEX = ['#FFE699','#FFD878','#FFCA5A','#FFBF42','#FBB123','#F8A600','#F39C00','#EA8F00','#E58500','#DE7C00','#D77200','#CF6900','#CB6200','#C35900','#BB5100','#B54C00','#B04500','#A63E00','#A13700','#9B3200','#952D00','#8E2900','#882300','#821E00','#7B1A00','#771900','#701400','#6A0E00','#660D00','#5E0B00','#5A0A02','#600903','#520907','#4C0505','#470606','#440607','#3F0708','#3B0607','#3A070B','#36080A'];
const ebcHex = ebc => (ebc == null || !isFinite(ebc)) ? null : SRM_HEX[Math.min(40, Math.max(1, Math.round(ebc / 1.97))) - 1];
function tinseth(og, t) { return !(t > 0) ? 0 : 1.65 * Math.pow(0.000125, og - 1) * (1 - Math.exp(-0.04 * t)) / 4.15; }
function hopUtil(h, og, boil) {
  const t = num(h.time);
  if (h.use === 'boil') return tinseth(og, Math.min(t ?? boil, boil));
  if (h.use === 'fwh') return tinseth(og, boil) * 1.1;
  if (h.use === 'whirlpool') return tinseth(og, Math.min(t ?? 20, 30)) * 0.1;   // hop stand at 75–80°C: roughly a tenth of boil utilisation
  return 0;
}
function stats(r, L, eff) {
  L = num(L); eff = num(eff) || 72;
  if (!L) return null;
  let pts = 0, sugarPts = 0, mcu = 0, any = false;
  for (const f of r.fermentables || []) {
    const kg = num(f.kg); if (!kg) continue; any = true;
    const ppg = num(f.ppg) || PPG_DEFAULT[f.type] || 37;
    const p = kg * ppg * 8.3454 / L * (MASHED(f.type) ? eff / 100 : 1);
    pts += p; if (f.type === 'sugar') sugarPts += p;
    const ebc = num(f.ebc); if (ebc != null) mcu += kg * 2.20462 * (ebc / 1.97) / (L * 0.264172);
  }
  if (!any) return null;
  const og = 1 + pts / 1000;
  const att = num((r.yeast || [])[0]?.atten) || 75;
  const fg = 1 + (pts - sugarPts) * (1 - att / 100) / 1000;
  const boil = num(r.boilMin) || 60;
  let ibu = 0;
  const perHop = (r.hops || []).map(h => { const g = num(h.g), aa = num(h.aa); if (!g || !aa) return null; const v = hopUtil(h, og, boil) * aa / 100 * g * 1000 / L; ibu += v; return v; });
  return { og, fg, abv: (og - fg) * 131.25, ibu, ebc: mcu > 0 ? 1.4922 * Math.pow(mcu, 0.6859) * 1.97 : null, perHop };
}
const baseL = r => num(r.batchL) || cfg.batchL;
const baseEff = r => num(r.efficiency) || cfg.eff;
function scaled(r, L, eff) {
  const L0 = baseL(r), e0 = baseEff(r), f = L / L0;
  const out = JSON.parse(JSON.stringify(r));
  out.batchL = L; out.efficiency = eff; out.factor = f;
  out.fermentables = (r.fermentables || []).map(x => ({ ...x, kg: num(x.kg) != null ? num(x.kg) * f * (MASHED(x.type) ? e0 / eff : 1) : null }));
  out.hops = (r.hops || []).map(h => ({ ...h, g: num(h.g) != null ? num(h.g) * f : null }));
  return out;
}
function colourOf(sum) {
  const full = state.full[sum.id];
  const stated = num(sum.ebc ?? full?.ebc);
  if (stated != null) return ebcHex(stated);
  if (!full) return null;
  const s = stats(full, baseL(full), baseEff(full));
  return s && s.ebc ? ebcHex(s.ebc) : null;
}
const USE_RANK = { mash: 0, fwh: 1, boil: 2, whirlpool: 3, dryhop: 4 };
const hopOrder = hops => hops.map((h, i) => ({ h, i })).sort((a, b) => (USE_RANK[a.h.use] ?? 2) - (USE_RANK[b.h.use] ?? 2) || ((num(b.h.time) ?? 0) - (num(a.h.time) ?? 0)) * (a.h.use === 'dryhop' ? -1 : 1));
function useTxt(h) {
  const t = num(h.time);
  switch (h.use) {
    case 'boil': return (t ?? '?') + ' min';
    case 'fwh': return 'First wort';
    case 'whirlpool': return 'Whirlpool' + (t != null ? ', ' + t + ' min' : '');
    case 'dryhop': return 'Dry hop' + (t != null ? ', ' + t + (t === 1 ? ' day' : ' days') : '');
    case 'mash': return 'Mash';
    default: return h.use || '';
  }
}
const TAGS = { Belgian: 'orange', Dutch: 'orange', German: 'yellow', British: 'red', American: 'blue', Pale: 'yellow', Amber: 'brown', Dark: 'gray', Session: 'green', Strong: 'red', Hoppy: 'green', Malty: 'brown', Roasty: 'gray', Spiced: 'pink', Wheat: 'yellow', Smoked: 'brown', Sour: 'purple', Clone: 'purple', Competition: 'purple', Course: 'blue' };
/* The Notion database this app uses: found by these columns, or created with this schema on first setup. */
const BOOK = {
  name: 'Brew book', icon: '🍺', marker: ['Batch (L)', 'OG', 'Times brewed'],
  schema: () => {
    const n = { number: { format: 'number' } }, t = { rich_text: {} };
    return {
      'Name': { title: {} },
      'Status': { select: { options: [{ name: 'To review', color: 'yellow' }, { name: 'Ready', color: 'green' }] } },
      'Style': t, 'Source': t,
      'Batch (L)': n, 'Boil (min)': n, 'Efficiency (%)': n, 'OG': n, 'FG': n, 'ABV (%)': n, 'IBU': n, 'EBC': n,
      'Malts': t, 'Hops': t, 'Yeast': t,
      'Tags': { multi_select: { options: Object.entries(TAGS).map(([name, color]) => ({ name, color })) } },
      'Last brewed': { date: {} }, 'Times brewed': n,
      'Updated': { last_edited_time: {} }
    };
  }
};
const TAG_GROUPS = [['Origin', ['Belgian', 'Dutch', 'German', 'British', 'American']], ['Colour', ['Pale', 'Amber', 'Dark']], ['Strength', ['Session', 'Strong']], ['Character', ['Hoppy', 'Malty', 'Roasty', 'Spiced', 'Wheat', 'Smoked', 'Sour']], ['Recipe', ['Clone', 'Competition', 'Course']]];
const tagPill = t => `<span class="pill ${TAGS[t] || 'gray'}">${esc(t)}</span>`;
const dateStr = d => { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); };
const STYLE_COLOURS = ['orange', 'brown', 'blue', 'green', 'yellow', 'gray'];
const styleColour = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return STYLE_COLOURS[h % STYLE_COLOURS.length]; };

/* ---------- Notion API ---------- */
async function napi(path, { method = 'GET', body, form, read = false } = {}) {
  if (!cfg.token) throw { code: 'no_token' };
  const headers = { Authorization: 'Bearer ' + cfg.token, 'Notion-Version': NOTION_VERSION };
  const opts = { method, headers };
  if (body) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  if (form) opts.body = form;
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
  object_not_found: 'The app can\'t see your Brew book database. In Notion, open Brew book, tap ••• → Connections and add your integration.',
  restricted_resource: 'Your integration doesn\'t have access to Brew book yet. In Notion, open Brew book, tap ••• → Connections and add it.',
  offline: 'No connection. You\'re seeing your saved copy.',
  rate_limited: 'Notion is busy. Try again in a minute.',
  conflict_error: 'Notion was busy saving something else. Try again.'
};
const errText = e => ERRORS[e && e.code] || (e && e.code === 'validation_error' ? 'Notion refused the data: ' + String(e.message).slice(0, 180) : 'Notion error' + (e && e.message ? ': ' + String(e.message).slice(0, 160) : '. Try again.'));

const rtText = arr => (arr || []).map(t => t.plain_text ?? t.text?.content ?? '').join('');
function propVal(p) {
  if (!p) return null;
  switch (p.type) {
    case 'title': return rtText(p.title);
    case 'rich_text': return rtText(p.rich_text);
    case 'number': return p.number;
    case 'select': return p.select ? p.select.name : '';
    case 'multi_select': return (p.multi_select || []).map(o => o.name);
    case 'date': return p.date ? p.date.start : null;
    default: return null;
  }
}
function pageToSummary(pg) {
  const P = pg.properties || {}; const v = k => propVal(P[k]);
  return {
    id: cleanId(pg.id), url: pg.url, updated: pg.last_edited_time,
    name: v('Name') || 'Untitled recipe', status: v('Status') || '', review: v('Status') === 'To review',
    style: v('Style') || '', source: v('Source') || '',
    batchL: v('Batch (L)'), boilMin: v('Boil (min)'), efficiency: v('Efficiency (%)'),
    og: v('OG'), fg: v('FG'), abv: v('ABV (%)'), ibu: v('IBU'), ebc: v('EBC'),
    malts: v('Malts') || '', hops: v('Hops') || '', yeast: v('Yeast') || '',
    tags: v('Tags') || [], lastBrewed: v('Last brewed') || '', timesBrewed: v('Times brewed') || 0
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
function parseJsonText(s) {
  const raw = String(s).split('\n').map(l => l.replace(/^\t+/, '')).join('');
  try { return JSON.parse(raw); } catch { return null; }
}
async function readPage(id) {
  const blocks = await children(id);
  const images = blocks.filter(b => b.type === 'image').map(b => ({ block: b.id, url: b.image.file?.url || b.image.external?.url || '' })).filter(x => x.url);
  let data = null;
  const heads = blocks.filter(b => /^heading_/.test(b.type) && b.has_children && /app data/i.test(blockText(b)));
  for (const h of heads.reverse()) {
    const kids = await children(h.id);
    const code = kids.find(k => k.type === 'code');
    if (code) { data = parseJsonText(rtText(code.code.rich_text)); if (data) break; }
  }
  if (!data) {
    const code = blocks.filter(b => b.type === 'code').pop();
    if (code) data = parseJsonText(rtText(code.code.rich_text));
  }
  return { data, images, blocks };
}

/* ---------- writing pages ---------- */
const rt = (s, ann) => { s = String(s ?? ''); const out = []; for (let i = 0; i < s.length; i += 2000) out.push({ type: 'text', text: { content: s.slice(i, i + 2000) }, ...(ann ? { annotations: ann } : {}) }); return out; };
const B = {
  h2: (t, kids) => ({ type: 'heading_2', heading_2: { rich_text: rt(t), ...(kids ? { is_toggleable: true, children: kids } : {}) } }),
  p: t => ({ type: 'paragraph', paragraph: { rich_text: rt(t) } }),
  li: t => ({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(t) } }),
  h3: t => ({ type: 'heading_3', heading_3: { rich_text: rt(t) } }),
  step: (title, text, kids) => ({ type: 'numbered_list_item', numbered_list_item: { rich_text: [...rt(title + '.', { bold: true }), ...rt(' ' + text)], ...(kids.length ? { children: kids.map(k => B.li(k)) } : {}) } }),
  hr: () => ({ type: 'divider', divider: {} }),
  table: (head, rows) => ({ type: 'table', table: { table_width: head.length, has_column_header: true, has_row_header: false, children: [head, ...rows].map(r => ({ type: 'table_row', table_row: { cells: r.map(c => rt(c)) } })) } }),
  callout: (title, items) => ({ type: 'callout', callout: { rich_text: rt(title, { bold: true }), icon: { type: 'emoji', emoji: '⚠️' }, color: 'yellow_background', children: items.map(i => B.li(i)) } }),
  code: s => ({ type: 'code', code: { language: 'json', rich_text: rt(s) } }),
  img: fid => ({ type: 'image', image: { type: 'file_upload', file_upload: { id: fid } } })
};
const n3 = (v, d) => v == null || !isFinite(v) ? '' : (d == null ? String(+(+v).toFixed(3)) : (+v).toFixed(d));
function useTxtPlain(h) { const t = h.time; switch (h.use) { case 'boil': return (t ?? '?') + ' min'; case 'fwh': return 'First wort'; case 'whirlpool': return 'Whirlpool' + (t != null ? ', ' + t + ' min' : ''); case 'dryhop': return 'Dry hop' + (t != null ? ', ' + t + ' days' : ''); case 'mash': return 'Mash'; default: return h.use || ''; } }
function buildBlocks(r) {
  const out = [];
  const glance = [];
  if (r.source) glance.push('Source: ' + r.source);
  if ((r.tags || []).length) glance.push('Tags: ' + r.tags.join(', '));
  const st = (v, u) => v != null ? n3(v) + u : 'not set';
  glance.push(`Batch ${st(r.batchL, ' L')}, boil ${st(r.boilMin, ' min')}, efficiency ${st(r.efficiency, '%')}`);
  const t = [r.og != null && 'OG ' + n3(r.og, 3), r.fg != null && 'FG ' + n3(r.fg, 3), r.abv != null && 'ABV ' + n3(r.abv) + '%', r.ibu != null && 'IBU ' + n3(r.ibu), r.ebc != null && 'EBC ' + n3(r.ebc)].filter(Boolean);
  if (t.length) glance.push('Targets: ' + t.join(', '));
  out.push(B.h2('At a glance'), ...glance.map(B.li));
  if (r.review && (r.uncertain || []).length) out.push(B.callout('Check before brewing', r.uncertain));
  else if ((r.uncertain || []).length) out.push(B.h2('Assumptions'), ...r.uncertain.map(B.li));
  if (r.story) out.push(B.h2('Story'), ...String(r.story).split(/\n+/).filter(x => x.trim()).map(B.p));
  const ing = [];
  if ((r.fermentables || []).length) ing.push(B.h3('Fermentables'), ...r.fermentables.map(x => B.li(`${x.kg != null ? (x.kg < 1 ? Math.round(x.kg * 1000) + ' g' : n3(x.kg) + ' kg') : ''} ${x.name}${x.ebc != null ? `, ${n3(x.ebc)} EBC` : ''}${x.type && x.type !== 'grain' ? ', ' + x.type : ''}`.trim())));
  if ((r.hops || []).length) ing.push(B.h3('Hops'), ...hopOrder(r.hops).map(({ h }) => B.li(`${h.g != null ? n3(h.g) + ' g ' : ''}${h.name}${h.aa != null ? ` (${n3(h.aa)}% AA)` : ''}, ${useTxtPlain(h).toLowerCase()}`)));
  if ((r.yeast || []).length) ing.push(B.h3('Yeast'), ...r.yeast.map(y => B.li(`${y.name}${y.amount ? ': ' + y.amount : ''}${y.atten != null ? ' (' + n3(y.atten) + '% attenuation)' : ''}`)));
  if ((r.other || []).length) ing.push(B.h3('Other'), ...r.other.map(o => B.li(`${o.name}${o.amount ? ', ' + o.amount : ''}${o.when ? ' (' + o.when + ')' : ''}`)));
  if (ing.length) out.push(B.h2('Ingredients'), ...ing);
  const boil = num(r.boilMin) || 60;
  out.push(B.h2('Method'), ...methodSteps(r, 1).map(st => B.step(st.title, st.text, [...(st.adds || []).map(a => `${addLabel(a.t, boil)}: ${a.txt}`), ...(st.list || []).filter(() => st.k !== 'prep'), ...(st.tip ? ['Tip: ' + st.tip] : [])])));
  if ((r.brews || []).length) out.push(B.h2('Brew history'), B.table(['Date', 'Into fermenter', 'OG', 'FG', 'ABV', 'Notes'], [...r.brews].reverse().map(b => [b.date, b.litres != null ? n3(b.litres) + ' L' : '', b.og != null ? n3(b.og, 3) : '', b.fg != null ? n3(b.fg, 3) : '', b.abv != null ? n3(b.abv) + '%' : '', b.notes || ''])));
  if (r.notes) out.push(B.h2('Notes'), ...String(r.notes).split(/\n+/).filter(s => s.trim()).map(B.p));
  if (r.transcript) out.push(B.h2('Transcription', String(r.transcript).split(/\n+/).filter(s => s.trim()).slice(0, 90).map(B.p)));
  const data = { v: 1, ...r }; delete data.id; delete data.url; delete data.updated;
  out.push(B.hr(), B.h2('App data', [B.p('Used by the Brew book app. Edit recipes in the app or with the Brew book skill so this stays in sync.'), B.code(JSON.stringify(data))]));
  return out;
}
const T = s => (s ? rt(s) : []);
function apiProps(r) {
  const n = v => ({ number: v == null ? null : +v });
  const uniq = a => [...new Set(a.filter(Boolean))];
  return {
    'Name': { title: T(r.name || 'Untitled recipe') },
    'Status': { select: { name: r.review ? 'To review' : 'Ready' } },
    'Style': { rich_text: T(r.style) }, 'Source': { rich_text: T(r.source) },
    'Batch (L)': n(r.batchL), 'Boil (min)': n(r.boilMin), 'Efficiency (%)': n(r.efficiency),
    'OG': n(r.og), 'FG': n(r.fg), 'ABV (%)': n(r.abv), 'IBU': n(r.ibu), 'EBC': n(r.ebc),
    'Malts': { rich_text: T(uniq((r.fermentables || []).map(x => x.name)).join(', ')) },
    'Hops': { rich_text: T(uniq((r.hops || []).map(x => x.name)).join(', ')) },
    'Yeast': { rich_text: T(uniq((r.yeast || []).map(x => x.name)).join(', ')) },
    'Tags': { multi_select: (r.tags || []).filter(t => TAGS[t]).map(name => ({ name })) },
    'Last brewed': { date: r.brews && r.brews.length ? { start: r.brews[r.brews.length - 1].date } : null },
    'Times brewed': { number: r.brews && r.brews.length ? r.brews.length : null }
  };
}
async function appendBlocks(id, blocks) {
  for (let i = 0; i < blocks.length; i += 90) await napi(`/blocks/${id}/children`, { method: 'PATCH', body: { children: blocks.slice(i, i + 90) } });
}
async function pool(items, n, fn) { let i = 0; const run = async () => { while (i < items.length) { const it = items[i++]; await fn(it); } }; await Promise.all(Array.from({ length: Math.min(n, items.length) }, run)); }
/* Save a recipe. New pages are created whole. For existing pages the new content is appended first and the
   old blocks deleted afterwards, so an interruption never leaves the page without its latest app data. */
async function savePage(r, id, newImageIds = []) {
  const blocks = [...newImageIds.map(B.img), ...buildBlocks(r)];
  if (!id) {
    const pg = await napi('/pages', { method: 'POST', body: { parent: { type: 'data_source_id', data_source_id: cfg.ds }, icon: { type: 'emoji', emoji: '🍺' }, properties: apiProps(r), children: blocks.slice(0, 90) } });
    id = cleanId(pg.id);
    if (blocks.length > 90) await appendBlocks(id, blocks.slice(90));
    return { id, url: pg.url };
  }
  await napi(`/pages/${id}`, { method: 'PATCH', body: { properties: apiProps(r) } });
  const old = (await children(id)).filter(b => b.type !== 'image').map(b => b.id);
  await appendBlocks(id, blocks);
  await pool(old, 3, bid => napi(`/blocks/${bid}`, { method: 'DELETE' }).catch(e => { if (e.code !== 'object_not_found') throw e; }));
  return { id };
}
async function uploadImage(blob, name) {
  const fu = await napi('/file_uploads', { method: 'POST', body: { filename: name, content_type: 'image/jpeg' } });
  const fd = new FormData();
  fd.append('file', new File([blob], name, { type: 'image/jpeg' }));
  await napi(`/file_uploads/${fu.id}/send`, { method: 'POST', form: fd });
  return fu.id;
}
async function compress(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
    if (blob) return blob;
  } catch { }
  return file;
}

/* ---------- state & sync ---------- */
const state = {
  recipes: ls.get('bb.list') || [], syncedAt: ls.get('bb.syncedAt') || 0, loaded: !!ls.get('bb.list'),
  full: {}, images: {}, fullErr: {}, listing: false, listErr: null,
  filter: null, scale: {}, draft: null, draftFor: undefined, draftErr: '',
  brew: null, alerts: [], lastRoute: '', busy: false
};
const route = () => { const h = location.hash.replace(/^#\/?/, ''); const [view, id] = h.split('/'); return { view: view || 'list', id: id ? decodeURIComponent(id) : null }; };
const getSum = id => state.recipes.find(r => r.id === id);

async function syncList() {
  if (!connected() || state.listing) return;
  state.listing = true; state.listErr = null; refresh();
  try {
    const pages = await queryAll();
    const list = pages.map(pageToSummary);
    for (const s of list) {
      const c = ls.get('bb.full.' + s.id);
      if (c && c.updated !== s.updated && c.updated !== 'pending') delete state.full[s.id];
      if (c && c.updated === 'pending') ls.set('bb.full.' + s.id, { updated: s.updated, data: c.data });
    }
    const keep = new Set(list.map(s => s.id));
    for (const old of state.recipes) if (!keep.has(old.id)) { ls.del('bb.full.' + old.id); delete state.full[old.id]; }
    state.recipes = list; state.loaded = true; state.syncedAt = Date.now(); state.fullErr = {};
    ls.set('bb.list', list); ls.set('bb.syncedAt', state.syncedAt);
    prefetch();
  } catch (e) { state.listErr = e; }
  state.listing = false; refresh();
}
async function prefetch() {
  const todo = state.recipes.filter(r => !state.full[r.id]).map(r => r.id);
  await pool(todo, 2, async id => { try { await loadFull(id); } catch { } if (route().view === 'list') renderRows(); });
}
const inflight = {};
function loadFull(id) {
  if (inflight[id]) return inflight[id];
  inflight[id] = (async () => {
    try {
      const { data, images } = await readPage(id);
      state.images[id] = { at: Date.now(), list: images };
      if (!data) throw { code: 'no_app_data' };
      const sum = getSum(id);
      const full = normalise(data); full.id = id;
      state.full[id] = full; state.fullErr[id] = null;
      ls.set('bb.full.' + id, { updated: sum ? sum.updated : 'pending', data: full });
      return full;
    } catch (e) { state.fullErr[id] = e; throw e; }
    finally { delete inflight[id]; }
  })();
  return inflight[id];
}
/* Recipe page: show the cached copy straight away and refresh photos (signed links expire) in the background. */
const tried = {};
function openRecipe(id) {
  if (state.full[id]) return;
  if (!connected() || inflight[id] || state.fullErr[id]) return;
  if (tried[id] && Date.now() - tried[id] < 30000) return;
  tried[id] = Date.now();
  loadFull(id).then(() => { if (route().id === id) render(false); }, () => {
    if (!state.images[id]) state.images[id] = { at: 0, list: [], failed: true };
    if (state.full[id]) state.fullErr[id] = null;
    if (route().id === id) render(false);
  });
}
const STEP_KEYS = [['prep', 'Getting ready'], ['mash', 'Mash'], ['sparge', 'Sparge'], ['boil', 'Boil'], ['chill', 'Chill'], ['ferment', 'Ferment'], ['package', 'Bottling']];
const sg = g => (g != null && g > 2 && g < 2000) ? g / 1000 : g;   // accept 1068 as well as 1.068
function normalise(o) {
  const arr = v => Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : [];
  const s = v => v == null ? '' : String(v);
  const uses = ['boil', 'fwh', 'whirlpool', 'dryhop', 'mash'], types = ['grain', 'adjunct', 'extract', 'sugar'];
  return {
    name: s(o.name).trim() || 'Untitled recipe', style: s(o.style).trim(), source: s(o.source).trim(),
    tags: Array.isArray(o.tags) ? Object.keys(TAGS).filter(t => o.tags.some(x => s(x).trim().toLowerCase() === t.toLowerCase())) : [],
    brews: arr(o.brews).map(x => ({ date: s(x.date).slice(0, 10), litres: num(x.litres), og: sg(num(x.og)), fg: sg(num(x.fg)), abv: num(x.abv), notes: s(x.notes) })).filter(b => /^\d{4}-\d{2}-\d{2}$/.test(b.date)).sort((a, b) => a.date.localeCompare(b.date)),
    batchL: num(o.batchL), boilMin: num(o.boilMin), efficiency: num(o.efficiency), og: sg(num(o.og)), fg: sg(num(o.fg)), abv: num(o.abv), ibu: num(o.ibu), ebc: num(o.ebc),
    fermentables: arr(o.fermentables).map(x => ({ name: s(x.name), kg: num(x.kg), ebc: num(x.ebc), ppg: num(x.ppg), type: types.includes(x.type) ? x.type : 'grain', when: s(x.when) })),
    story: s(o.story),
    water: (() => { const w = o.water && typeof o.water === 'object' ? o.water : {}; return { strikeL: num(w.strikeL), strikeC: num(w.strikeC), spargeL: num(w.spargeL), spargeC: num(w.spargeC), preboilL: num(w.preboilL) }; })(),
    stepNotes: (() => { const t = o.stepNotes && typeof o.stepNotes === 'object' ? o.stepNotes : {}; return Object.fromEntries(STEP_KEYS.map(([k]) => [k, s(t[k])])); })(),
    hops: arr(o.hops).map(x => ({ name: s(x.name), g: num(x.g), aa: num(x.aa), use: uses.includes(x.use) ? x.use : 'boil', time: num(x.time) })),
    yeast: arr(o.yeast).map(x => ({ name: s(x.name), amount: s(x.amount), atten: num(x.atten) })),
    mash: arr(o.mash).map(x => ({ name: s(x.name), tempC: num(x.tempC), min: num(x.min) })),
    ferment: arr(o.ferment).map(x => ({ name: s(x.name), tempC: num(x.tempC), days: num(x.days) })),
    other: arr(o.other).map(x => ({ name: s(x.name), amount: s(x.amount), when: s(x.when) })),
    notes: s(o.notes), transcript: s(o.transcript), uncertain: Array.isArray(o.uncertain) ? o.uncertain.map(s).filter(Boolean) : [],
    photos: Array.isArray(o.photos) ? o.photos.map(s) : [], review: !!o.review, createdAt: o.createdAt || null, updatedAt: o.updatedAt || null
  };
}
async function commit(r, id, newImageIds) {
  r.updatedAt = Date.now(); if (!r.createdAt) r.createdAt = r.updatedAt;
  const res = await savePage(r, id, newImageIds);
  const full = { ...r, id: res.id };
  state.full[res.id] = full; ls.set('bb.full.' + res.id, { updated: 'pending', data: full });
  if (newImageIds && newImageIds.length) delete state.images[res.id];
  const sum = { ...(getSum(res.id) || {}), id: res.id, url: res.url || getSum(res.id)?.url || '', name: r.name, review: r.review, status: r.review ? 'To review' : 'Ready', style: r.style, source: r.source, batchL: r.batchL, boilMin: r.boilMin, efficiency: r.efficiency, og: r.og, fg: r.fg, abv: r.abv, ibu: r.ibu, ebc: r.ebc, malts: r.fermentables.map(x => x.name).join(', '), hops: r.hops.map(x => x.name).join(', '), yeast: r.yeast.map(x => x.name).join(', '), tags: r.tags, lastBrewed: r.brews.length ? r.brews[r.brews.length - 1].date : '', timesBrewed: r.brews.length };
  const i = state.recipes.findIndex(x => x.id === res.id);
  if (i >= 0) state.recipes[i] = sum; else state.recipes.push(sum);
  ls.set('bb.list', state.recipes);
  setTimeout(syncList, 1500);
  return res.id;
}

/* ---------- rendering ---------- */
function render(resetScroll = true) {
  try { renderView(resetScroll); }
  catch (err) { console.error(err); renderCrash(err); }
}
function renderCrash(err) {
  topbar.innerHTML = '';
  app.innerHTML = `<div class="empty"><div class="big">⚠️</div><h3>Something went wrong</h3><p>${esc(err && err.message || err)}</p><p><button class="btn primary" id="crash-reset">Clear cached data and reload</button></p></div>`;
  $('#crash-reset').addEventListener('click', () => {
    try { Object.keys(localStorage).filter(k => k.startsWith('bb.full.') || k === 'bb.list' || k === 'bb.syncedAt').forEach(k => ls.del(k)); } catch { }
    location.hash = ''; location.reload();
  });
}
function renderView(resetScroll) {
  const r = route(); const key = r.view + '/' + (r.id || '');
  if (key !== state.lastRoute) { stopTick(); releaseWake(); closeOverlay(); }
  if (!connected() && !['settings', 'setup'].includes(r.view)) { location.replace('#/setup'); return; }
  let html, bar;
  switch (r.view) {
    case 'r': [bar, html] = recipeView(r.id); break;
    case 'edit': [bar, html] = editView(r.id); break;
    case 'new': [bar, html] = editView(null); break;
    case 'brew': [bar, html] = brewView(r.id); break;
    case 'settings': [bar, html] = settingsView(); break;
    case 'setup': [bar, html] = setupView(); break;
    default: [bar, html] = listView();
  }
  topbar.innerHTML = `<div class="row">${bar}</div>`;
  app.innerHTML = html;
  if (r.view === 'list') renderRows();
  if (r.view === 'brew' && state.full[r.id]) { startTick(); requestWake(); renderAlerts(); }
  if (key !== state.lastRoute && resetScroll) window.scrollTo(0, 0);
  state.lastRoute = key;
  onScroll();
}
function refresh() {
  const v = route().view;
  if (v === 'list') { const rb = $('#rbtn'); if (rb) rb.classList.toggle('spin', state.listing); renderSync(); renderRows(); }
  else if (v === 'r' || v === 'brew' || (v === 'edit' && !state.draft)) render(false);
}
window.addEventListener('hashchange', () => render());
function onScroll() { topbar.classList.toggle('scrolled', window.scrollY > 4); }
window.addEventListener('scroll', onScroll, { passive: true });
const backBtn = to => `<a class="ibtn" href="${to}" aria-label="Back">${I.back}</a>`;
const crumb = (parts) => `<div class="crumb">${parts.map((p, i) => (i ? '<span class="sep">/</span>' : '') + p).join('')}</div>`;
function errorCallout(e, retry) {
  return `<div class="callout red"><div class="ci">⚠️</div><div class="cb">${esc(errText(e))}${retry ? `<div class="actions"><button class="btn small" data-act="${retry}">Try again</button>${e && ['object_not_found', 'restricted_resource', 'unauthorized'].includes(e.code) ? '<a class="btn small ghost" href="#/settings">Settings</a>' : ''}</div>` : ''}</div></div>`;
}
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }

/* ---------- list ---------- */
/* Library: a grouped, sortable table (or compact list) with a filter panel. */
const FAMILIES = [
  ['Stouts & porters', /stout|porter/i], ['Barley wines', /barley ?wine/i], ['Wheat beers', /weizen|wheat|wit|hefe/i],
  ['IPAs & pale ales', /\bipa\b|pale ale|hoppy pale|\bapa\b/i], ['Belgian dubbels & quads', /dubbel|quad|trappist|abbey/i],
  ['Belgian blondes & tripels', /tripel|golden|blond/i], ['Bocks', /\bbock|\bbok/i], ['Saisons & farmhouse', /saison|farmhouse/i],
  ['Lagers & Kölsch', /k[öo]lsch|lager|pils/i]];
const familyOf = r => (FAMILIES.find(([, re]) => re.test(r.style || '') || re.test(r.name || '')) || ['Other'])[0];
const srcGroup = r => (String(r.source || '').split(/[,;(]/)[0].trim() || 'No source');
const COLOURS = [['Pale', 0, 15], ['Amber', 15, 40], ['Dark', 40, 1e9]];
function metrics(r) {
  const f = state.full[r.id]; const c = f ? stats(f, baseL(f), baseEff(f)) : null;
  const pick = (a, b) => a != null ? a : b != null ? b : null;
  return { og: pick(r.og, c?.og), fg: pick(r.fg, c?.fg), abv: pick(r.abv, c?.abv), ibu: pick(r.ibu, c?.ibu), ebc: pick(r.ebc, c?.ebc) };
}
const FDEF = () => ({ q: '', tab: 'all', tags: [], fam: [], colour: [], src: '', brewed: '', abvMin: null, abvMax: null, ibuMin: null, ibuMax: null, sort: 'name', dir: 1, group: cfg.group || 'family' });
function activeFilters(f) {
  const a = [];
  f.fam.forEach(x => a.push(['fam', x, x]));
  f.colour.forEach(x => a.push(['colour', x, x]));
  f.tags.forEach(x => a.push(['tags', x, x]));
  if (f.src) a.push(['src', f.src, 'Source: ' + f.src]);
  if (f.brewed) a.push(['brewed', f.brewed, f.brewed === 'yes' ? 'Brewed' : 'Never brewed']);
  if (f.abvMin != null || f.abvMax != null) a.push(['abv', '', `ABV ${f.abvMin ?? 0}–${f.abvMax ?? '∞'}%`]);
  if (f.ibuMin != null || f.ibuMax != null) a.push(['ibu', '', `IBU ${f.ibuMin ?? 0}–${f.ibuMax ?? '∞'}`]);
  return a;
}
function listView() {
  if (!state.filter) state.filter = FDEF();
  const bar = crumb(['<span>🍺</span>', '<span>Brew book</span>']) + `<button class="ibtn ${state.listing ? 'spin' : ''}" id="rbtn" data-act="sync" aria-label="Refresh">${I.refresh}</button><a class="ibtn" href="#/settings" aria-label="Settings">${I.gear}</a>`;
  const review = state.recipes.filter(r => r.review).length;
  const f = state.filter;
  const view = cfg.view || 'table';
  const html = `
  <div class="page-icon">🍺</div>
  <h1 class="title">Brew book</h1>
  <p class="desc" id="sync"></p>
  <div class="tabs" role="tablist">
    <button class="tab" role="tab" data-act="tab" data-tab="all" aria-selected="${f.tab === 'all'}">All recipes <span class="count">${state.recipes.length}</span></button>
    <button class="tab" role="tab" data-act="tab" data-tab="review" aria-selected="${f.tab === 'review'}">To review <span class="count">${review}</span></button>
    <button class="tab" role="tab" data-act="tab" data-tab="ready" aria-selected="${f.tab === 'ready'}">Ready</button>
  </div>
  <div class="toolbar">
    <label class="search">${I.search}<input id="q" type="search" placeholder="Search name, malts, hops, yeast…" value="${esc(f.q)}" autocomplete="off"></label>
    <button class="tbtn ${state.fpanel ? 'on' : ''}" data-act="fpanel" aria-expanded="${!!state.fpanel}">Filter<span class="badge" id="fcount"></span></button>
  </div>
  <div id="fpanel"></div>
  <div class="chips" id="fchips"></div>
  <div class="sortrow">
    <span class="faint" id="count"></span>
    <span class="viewctl">
      <select class="filter" id="groupf" aria-label="Group by"><option value="family" ${f.group === 'family' ? 'selected' : ''}>Group: beer type</option><option value="source" ${f.group === 'source' ? 'selected' : ''}>Group: source</option><option value="status" ${f.group === 'status' ? 'selected' : ''}>Group: status</option><option value="none" ${f.group === 'none' ? 'selected' : ''}>No grouping</option></select>
      <span class="seg"><button data-act="view" data-view="table" aria-pressed="${view === 'table'}" aria-label="Table">▦</button><button data-act="view" data-view="list" aria-pressed="${view === 'list'}" aria-label="List">☰</button></span>
    </span>
  </div>
  <div id="rows"></div>
  <button class="fab" data-act="newmenu" aria-label="Add recipe">${I.compose}</button>`;
  return [bar, html];
}
function renderSync() {
  const el = $('#sync'); if (!el) return;
  if (state.listErr) { el.outerHTML = `<div id="sync">${errorCallout(state.listErr, 'sync')}</div>`; return; }
  el.textContent = state.listing ? 'Syncing with Notion…' : state.syncedAt ? `Synced with Notion at ${timeStr(state.syncedAt)}` : 'Recipes from your Notion database';
}
function haystack(r) {
  const f = state.full[r.id];
  return [r.name, r.style, r.source, r.malts, r.hops, r.yeast, familyOf(r), (r.tags || []).join(' '), f && f.story, f && f.notes, f && f.other.map(o => o.name).join(' '), f && f.transcript].join(' ').toLowerCase();
}
function renderFilters() {
  const f = state.filter;
  const c = { all: state.recipes.length, review: state.recipes.filter(r => r.review).length };
  document.querySelectorAll('.tab').forEach(t => { const n = t.querySelector('.count'); if (n && c[t.dataset.tab] != null) n.textContent = c[t.dataset.tab]; });
  const act = activeFilters(f);
  const fc = $('#fcount'); if (fc) fc.textContent = act.length ? act.length : '';
  const chips = $('#fchips');
  if (chips) chips.innerHTML = act.length ? act.map(([k, v, label]) => `<button class="fchip" data-act="unf" data-k="${k}" data-v="${esc(v)}">${esc(label)} <span aria-hidden="true">✕</span></button>`).join('') + '<button class="linkbtn" data-act="clearf">Clear all</button>' : '';
  const panel = $('#fpanel'); if (!panel) return;
  if (!state.fpanel) { panel.innerHTML = ''; return; }
  const fams = [...new Set(state.recipes.map(familyOf))].sort();
  const srcs = [...new Set(state.recipes.map(srcGroup))].sort();
  const tags = Object.keys(TAGS).filter(t => state.recipes.some(r => (r.tags || []).includes(t)));
  const chip = (k, v, on, cls = '') => `<button class="tagchip ${cls}" data-act="tog" data-k="${k}" data-v="${esc(v)}" aria-pressed="${on}">${esc(v)}</button>`;
  const numIn = (k, v, ph) => `<input class="numin" inputmode="decimal" data-fnum="${k}" value="${v ?? ''}" placeholder="${ph}">`;
  if (panel.dataset.open === '1' && document.activeElement && panel.contains(document.activeElement) && document.activeElement.dataset.fnum) return;   // don't redraw under a number being typed
  panel.dataset.open = '1';
  panel.innerHTML = `<div class="fpanel">
    <div class="frow"><span class="flabel">Beer type</span><div class="fopts">${fams.map(x => chip('fam', x, f.fam.includes(x), 'gray')).join('')}</div></div>
    <div class="frow"><span class="flabel">Colour</span><div class="fopts">${COLOURS.map(([x]) => chip('colour', x, f.colour.includes(x), x === 'Pale' ? 'yellow' : x === 'Amber' ? 'brown' : 'gray')).join('')}</div></div>
    <div class="frow"><span class="flabel">ABV %</span><div class="fopts range">${numIn('abvMin', f.abvMin, 'min')}<span>to</span>${numIn('abvMax', f.abvMax, 'max')}</div></div>
    <div class="frow"><span class="flabel">IBU</span><div class="fopts range">${numIn('ibuMin', f.ibuMin, 'min')}<span>to</span>${numIn('ibuMax', f.ibuMax, 'max')}</div></div>
    <div class="frow"><span class="flabel">Source</span><div class="fopts"><select class="filter" data-fsel="src"><option value="">Any</option>${srcs.map(x => `<option ${f.src === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div></div>
    <div class="frow"><span class="flabel">Brewed</span><div class="fopts">${chip('brewed', 'Brewed', f.brewed === 'yes')}${chip('brewed', 'Never brewed', f.brewed === 'no')}</div></div>
    <div class="frow"><span class="flabel">Tags</span><div class="fopts">${tags.map(t => chip('tags', t, f.tags.includes(t), TAGS[t])).join('')}</div></div>
  </div>`;
}
function filtered() {
  const f = state.filter; const toks = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const inR = (v, lo, hi) => (lo == null || (v != null && v >= lo)) && (hi == null || (v != null && v <= hi));
  return state.recipes.map(r => ({ r, m: metrics(r) })).filter(({ r, m }) =>
    (f.tab === 'all' || (f.tab === 'review' ? r.review : !r.review)) &&
    (!f.fam.length || f.fam.includes(familyOf(r))) &&
    (!f.colour.length || f.colour.some(c => { const [, lo, hi] = COLOURS.find(x => x[0] === c); return m.ebc != null && m.ebc >= lo && m.ebc < hi; })) &&
    f.tags.every(t => (r.tags || []).includes(t)) &&
    (!f.src || srcGroup(r) === f.src) &&
    (!f.brewed || (f.brewed === 'yes' ? r.timesBrewed > 0 : !r.timesBrewed)) &&
    inR(m.abv, f.abvMin, f.abvMax) && inR(m.ibu, f.ibuMin, f.ibuMax) &&
    toks.every(t => haystack(r).includes(t)));
}
const COLS = [
  ['name', 'Name'], ['style', 'Style'], ['abv', 'ABV'], ['og', 'OG'], ['ibu', 'IBU'], ['ebc', 'Colour'], ['times', 'Brewed'], ['brewed', 'Last brewed'], ['source', 'Source'], ['status', 'Status']];
function sortVal(k, r, m) {
  switch (k) {
    case 'name': return (r.name || '').toLowerCase(); case 'style': return (r.style || '').toLowerCase(); case 'source': return (r.source || '').toLowerCase();
    case 'status': return r.review ? 0 : 1; case 'times': return r.timesBrewed || 0; case 'brewed': return r.lastBrewed || '';
    default: return m[k] ?? -1;
  }
}
function renderRows() {
  if (!state.filter) state.filter = FDEF();
  renderSync(); renderFilters();
  const el = $('#rows'); if (!el) return;
  if (!state.loaded) { el.innerHTML = `<p class="faint" style="padding:8px 0">Loading recipes…</p>`; return; }
  if (!state.recipes.length) {
    el.innerHTML = state.listErr ? '' : `<div class="empty"><div class="big">📖</div><h3>No recipes yet</h3><p>Send recipe photos to Claude with the Brew book skill, or tap the pencil to type one in.</p></div>`;
    return;
  }
  const f = state.filter;
  const list = filtered();
  const cmp = (a, b) => { const x = sortVal(f.sort, a.r, a.m), y = sortVal(f.sort, b.r, b.m); return (x < y ? -1 : x > y ? 1 : 0) * f.dir || a.r.name.localeCompare(b.r.name); };
  list.sort(cmp);
  const cnt = $('#count'); if (cnt) cnt.textContent = list.length === state.recipes.length ? `${list.length} recipes` : `${list.length} of ${state.recipes.length}`;
  if (!list.length) { el.innerHTML = `<div class="empty"><div class="big">🔍</div><h3>No matches</h3><p>Try another word or clear the filters.</p><button class="btn small" data-act="clearf">Clear filters</button></div>`; return; }
  const keyOf = { family: x => familyOf(x.r), source: x => srcGroup(x.r), status: x => x.r.review ? 'To review' : 'Ready', none: () => '' }[f.group] || (() => '');
  const groups = [];
  list.forEach(x => { const k = keyOf(x); let g = groups.find(g => g.k === k); if (!g) groups.push(g = { k, items: [] }); g.items.push(x); });
  groups.sort((a, b) => a.k === 'Other' ? 1 : b.k === 'Other' ? -1 : a.k.localeCompare(b.k));
  const closed = state.closed || (state.closed = {});
  const yr = d => d ? d.slice(0, 4) : '';
  const cell = (k, r, m) => {
    switch (k) {
      case 'name': { const hex = m.ebc != null ? ebcHex(m.ebc) : null; return `<td class="nm"><a href="#/r/${encodeURIComponent(r.id)}"><span class="sw ${hex ? '' : 'none'}" style="${hex ? '--beer:' + hex : ''}"></span><span>${esc(r.name)}</span></a></td>`; }
      case 'style': return `<td class="st">${esc(r.style || '')}</td>`;
      case 'abv': return `<td class="n">${m.abv != null ? fx(m.abv, 1) + '%' : ''}</td>`;
      case 'og': return `<td class="n">${m.og != null ? grav(m.og) : ''}</td>`;
      case 'ibu': return `<td class="n">${m.ibu != null ? fx(m.ibu) : ''}</td>`;
      case 'ebc': return `<td class="n">${m.ebc != null ? fx(m.ebc) : ''}</td>`;
      case 'times': return `<td class="n">${r.timesBrewed ? r.timesBrewed + '×' : ''}</td>`;
      case 'brewed': return `<td class="n">${yr(r.lastBrewed)}</td>`;
      case 'source': return `<td class="src">${esc(r.source || '')}</td>`;
      case 'status': return `<td>${r.review ? '<span class="pill yellow">To review</span>' : '<span class="pill green">Ready</span>'}</td>`;
    }
  };
  if ((cfg.view || 'table') === 'table') {
    const head = `<tr>${COLS.map(([k, label]) => `<th class="${['abv', 'og', 'ibu', 'ebc', 'times', 'brewed'].includes(k) ? 'n' : ''} ${k === 'name' ? 'nm' : ''}"><button data-act="sortcol" data-k="${k}">${label}${f.sort === k ? (f.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr>`;
    el.innerHTML = `<div class="dbwrap"><table class="db"><thead>${head}</thead>${groups.map(g => `<tbody>${f.group !== 'none' ? `<tr class="grp"><td colspan="${COLS.length}"><button data-act="grp" data-k="${esc(g.k)}"><span class="car ${closed[g.k] ? '' : 'open'}">▸</span>${esc(g.k)} <span class="count">${g.items.length}</span></button></td></tr>` : ''}${closed[g.k] ? '' : g.items.map(({ r, m }) => `<tr data-href="#/r/${encodeURIComponent(r.id)}">${COLS.map(([k]) => cell(k, r, m)).join('')}</tr>`).join('')}</tbody>`).join('')}</table></div>`;
  } else {
    el.innerHTML = groups.map(g => `${f.group !== 'none' ? `<button class="grph" data-act="grp" data-k="${esc(g.k)}"><span class="car ${closed[g.k] ? '' : 'open'}">▸</span>${esc(g.k)} <span class="count">${g.items.length}</span></button>` : ''}${closed[g.k] ? '' : `<ul class="rows">${g.items.map(({ r, m }) => { const hex = m.ebc != null ? ebcHex(m.ebc) : colourOf(r); return `<li><a class="rowlink" href="#/r/${encodeURIComponent(r.id)}"><span class="sw ${hex ? '' : 'none'}" style="${hex ? '--beer:' + hex : ''}"></span><span class="rowmain"><div class="rowtitle">${esc(r.name)}</div><div class="rowmeta">${r.review ? '<span class="pill yellow">To review</span>' : ''}${r.style ? `<span>${esc(r.style)}</span>` : ''}${m.abv != null ? `<span class="num">${fx(m.abv, 1)}%</span>` : ''}${m.ibu != null ? `<span class="num">${fx(m.ibu)} IBU</span>` : ''}${r.timesBrewed ? `<span class="num">Brewed ${r.timesBrewed}×, last ${yr(r.lastBrewed)}</span>` : ''}</div>${(r.tags || []).length ? `<div class="rowtags">${r.tags.map(tagPill).join('')}</div>` : ''}</span></a></li>`; }).join('')}</ul>`}`).join('');
  }
}

/* ---------- recipe page ---------- */
const avg = a => { const v = a.filter(x => x != null && isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const getScale = r => state.scale[r.id] || { L: baseL(r), eff: baseEff(r) };
function recipeView(id) {
  const sum = getSum(id);
  const bar0 = backBtn('#/') + crumb(['<span>Brew book</span>', `<span>${esc(sum?.name || 'Recipe')}</span>`]);
  const r = state.full[id];
  openRecipe(id);
  if (!r) {
    const e = state.fullErr[id];
    if (!e) return [bar0, `<p class="faint" style="padding-top:40px">Opening recipe…</p>`];
    if (e.code === 'no_app_data') return [bar0, `<h1 class="title" style="margin-top:24px">${esc(sum?.name || 'Recipe')}</h1><div class="callout"><div class="ci">💡</div><div class="cb">This page has no Brew book data block, so the app can't read it. Re-add it with the Brew book skill in Claude, or open it in Notion.<div class="actions">${sum?.url ? `<a class="btn small" href="${esc(sum.url)}" target="_blank" rel="noopener">Open in Notion</a>` : ''}</div></div></div>`];
    return [bar0, `<div style="margin-top:24px">${errorCallout(e, 'retryfull')}</div>`];
  }
  const sc = getScale(r); const s = scaled(r, sc.L, sc.eff); const calc = stats(s, sc.L, sc.eff);
  const hex = colourOf(sum || r);
  const ferms = s.fermentables.filter(x => x.name || x.kg);
  const total = ferms.reduce((a, x) => a + (num(x.kg) || 0), 0);
  const isScaled = Math.abs(sc.L - baseL(r)) > 0.01 || Math.abs(sc.eff - baseEff(r)) > 0.01;
  const mine = Math.abs(sc.L - cfg.batchL) < 0.01 && Math.abs(sc.eff - cfg.eff) < 0.01;
  const hops = hopOrder(s.hops.filter(h => h.name || h.g));
  const url = sum?.url;
  const bar = backBtn('#/') + `<div class="crumb">${hex ? `<span class="sw" style="--beer:${hex}"></span>` : ''}<span>${esc(r.name)}</span></div><a class="ibtn" href="#/edit/${encodeURIComponent(id)}" aria-label="Edit">${I.compose}</a>`;
  const html = `
  <div class="cover" style="${hex ? '--beer:' + hex : ''}"></div>
  <div class="cover-icon">🍺</div>
  <h1 class="title">${esc(r.name)}</h1>
  <div class="props">
    <div class="prop"><div class="plabel">${I.status}Status</div><div class="pval"><span class="pill ${r.review ? 'yellow' : 'green'}">${r.review ? 'To review' : 'Ready'}</span>${r.review ? '<button class="linkbtn" data-act="markready">Mark as ready</button>' : ''}</div></div>
    <div class="prop"><div class="plabel">${I.text}Style</div><div class="pval ${r.style ? '' : 'empty-val'}">${r.style ? `<span class="pill ${styleColour(r.style)}">${esc(r.style)}</span>` : 'Empty'}</div></div>
    ${r.source ? `<div class="prop"><div class="plabel">${I.link}Source</div><div class="pval">${esc(r.source)}</div></div>` : ''}
    ${r.tags.length ? `<div class="prop"><div class="plabel">${I.tag}Tags</div><div class="pval">${r.tags.map(tagPill).join('')}</div></div>` : ''}
    <div class="prop"><div class="plabel">${I.hash}Brewed</div><div class="pval ${r.brews.length ? '' : 'empty-val'}">${r.brews.length ? `${r.brews.length}×, last ${dateStr(r.brews[r.brews.length - 1].date)}` : 'Not logged yet'}</div></div>
    <div class="prop"><div class="plabel">${I.hash}Batch</div><div class="pval"><input class="pinput num" data-scale="L" inputmode="decimal" value="${esc(+sc.L.toFixed(1))}" aria-label="Batch size in litres"><span class="unit">L</span></div></div>
    <div class="prop"><div class="plabel">${I.hash}Efficiency</div><div class="pval"><input class="pinput num" data-scale="eff" inputmode="decimal" value="${esc(+sc.eff.toFixed(0))}" aria-label="Efficiency percent"><span class="unit">%${num(r.efficiency) == null && !isScaled ? ' (your default)' : ''}</span></div></div>
    <div class="prop"><div class="plabel"></div><div class="pval">${mine ? '' : `<button class="linkbtn" data-act="mysys">Scale to my system (${fx(cfg.batchL)} L, ${fx(cfg.eff)}%)</button>`}${isScaled ? '<button class="linkbtn" data-act="unscale">As written</button>' : ''}</div></div>
  </div>
  ${r.review && r.uncertain.length ? `<div class="callout yellow"><div class="ci">⚠️</div><div class="cb"><b>Check before brewing</b><ul>${r.uncertain.map(u => `<li>${esc(u)}</li>`).join('')}</ul></div></div>` : ''}
  ${r.story ? `<h2>Story</h2>${r.story.split(/\n+/).filter(x => x.trim()).map(x => `<p class="prose">${esc(x)}</p>`).join('')}` : ''}
  <h2>Numbers</h2>
  <div class="tablewrap"><table class="nt"><thead><tr><th></th><th class="n">OG</th><th class="n">FG</th><th class="n">ABV</th><th class="n">IBU</th><th class="n">EBC</th></tr></thead><tbody>
    <tr><td>Recipe</td><td class="n">${grav(num(r.og))}</td><td class="n">${grav(num(r.fg))}</td><td class="n">${num(r.abv) != null ? fx(num(r.abv), 1) + '%' : '–'}</td><td class="n">${fx(num(r.ibu))}</td><td class="n">${num(r.ebc) != null ? `<span class="swatch" style="--beer:${ebcHex(num(r.ebc))}"></span>${fx(num(r.ebc))}` : '–'}</td></tr>
    <tr class="calc"><td>Calculated</td>${calc ? `<td class="n">${grav(calc.og)}</td><td class="n">${grav(calc.fg)}</td><td class="n">${fx(calc.abv, 1)}%</td><td class="n">${fx(calc.ibu)}</td><td class="n">${calc.ebc ? `<span class="swatch" style="--beer:${ebcHex(calc.ebc)}"></span>${fx(calc.ebc)}` : '–'}</td>` : '<td colspan="5" class="faint">Needs a batch size and fermentables</td>'}</tr>
  </tbody></table></div>
  <p class="caption">At ${fx(sc.L, 1)} L and ${fx(sc.eff)}% efficiency${isScaled ? `, amounts ×${s.factor.toFixed(2)}` : ''}. IBU by Tinseth; whirlpool is an estimate.</p>
  <h2>Fermentables</h2>
  ${ferms.length ? `<div class="tablewrap"><table class="nt"><thead><tr><th class="n">Amount</th><th>Fermentable</th><th class="n">%</th></tr></thead><tbody>${ferms.map(x => `<tr><td class="n">${kgTxt(num(x.kg))}</td><td>${esc(x.name || 'Unnamed')}<small>${[num(x.ebc) != null ? fx(num(x.ebc)) + ' EBC' : '', x.type !== 'grain' ? x.type : ''].filter(Boolean).join(', ')}</small></td><td class="n">${total && num(x.kg) ? fx(num(x.kg) / total * 100) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="faint">None listed</p>'}
  <h2>Hops</h2>
  ${hops.length ? `<div class="tablewrap"><table class="nt"><thead><tr><th class="n">Amount</th><th>Hop</th><th class="n">IBU</th></tr></thead><tbody>${hops.map(({ h, i }) => `<tr><td class="n">${gTxt(num(h.g))}</td><td>${esc(h.name || 'Unnamed')}<small>${useTxt(h)}${num(h.aa) != null ? ', ' + fx(num(h.aa), 1) + '% AA' : ''}</small></td><td class="n">${calc && calc.perHop[i] ? fx(calc.perHop[i]) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="faint">None listed</p>'}
  ${r.yeast.some(y => y.name) ? `<h2>Yeast</h2>${r.yeast.filter(y => y.name).map(y => `<p><b style="font-weight:500">${esc(y.name)}</b>${num(y.atten) != null ? ` <span class="muted">· ${fx(num(y.atten))}% attenuation</span>` : ''}${y.amount ? `<br><span class="muted" style="font-size:14px">${esc(y.amount)}</span>` : ''}</p>`).join('')}` : ''}
  ${r.other.some(o => o.name) ? `<h2>Other ingredients</h2><div class="tablewrap"><table class="nt"><thead><tr><th>Ingredient</th><th>Amount</th><th>When</th></tr></thead><tbody>${r.other.filter(o => o.name).map(o => `<tr><td>${esc(o.name)}</td><td>${esc(o.amount)}</td><td>${esc(o.when)}</td></tr>`).join('')}</tbody></table></div>${isScaled ? '<p class="caption">Not scaled automatically.</p>' : ''}` : ''}
  <h2>Method</h2>
  <ol class="method">${methodSteps(s, s.factor || 1).map(st => `<li><b>${esc(st.title)}.</b> ${esc(st.text)}${(st.list || []).length || (st.adds || []).length ? `<ul>${(st.adds || []).map(a => `<li><span class="when">${addLabel(a.t, st.boil)}:</span> ${esc(a.txt)}</li>`).join('')}${st.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${st.tip ? `<div class="tip">💡 ${esc(st.tip)}</div>` : ''}</li>`).join('')}</ol>
  ${isScaled ? '<p class="caption">Amounts and water volumes are scaled; temperatures and times aren\'t.</p>' : ''}
  <h2>Brew history</h2>
  ${r.brews.length ? `<div class="tablewrap"><table class="nt"><thead><tr><th>Date</th><th class="n">L</th><th class="n">OG</th><th class="n">FG</th><th class="n">ABV</th><th>Notes</th></tr></thead><tbody>${[...r.brews].reverse().map(b => `<tr><td style="white-space:nowrap">${esc(dateStr(b.date))}</td><td class="n">${b.litres != null ? fx(b.litres, b.litres % 1 ? 1 : 0) : ''}</td><td class="n">${grav(b.og)}</td><td class="n">${grav(b.fg)}</td><td class="n">${b.abv != null ? fx(b.abv, 1) + '%' : ''}</td><td>${esc(b.notes)}</td></tr>`).join('')}</tbody></table></div>${r.brews.length > 1 ? `<p class="caption">Average OG ${grav(avg(r.brews.map(b => b.og)))}, ABV ${fx(avg(r.brews.map(b => b.abv)), 1)}% across ${r.brews.length} brews.</p>` : ''}` : '<p class="faint" style="font-size:14px">No brews logged yet.</p>'}
  <a class="newrow" href="#/brew/${encodeURIComponent(id)}"><span>＋</span> Log a brew from brew day</a>
  ${r.notes ? `<h2>Notes</h2><p class="prose">${esc(r.notes)}</p>` : ''}
  ${r.transcript ? `<details class="toggle"><summary>Transcription</summary><div class="tbody">${esc(r.transcript)}</div></details>` : ''}
  <hr class="div">
  <div class="actions">
    <a class="btn primary" href="#/brew/${encodeURIComponent(id)}">▶ Start brew day</a>
    <a class="btn" href="#/edit/${encodeURIComponent(id)}">Edit</a>
    ${url ? `<a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">Open in Notion</a>` : ''}
    <button class="btn ghost danger" data-act="del">Delete</button>
  </div>
  <div id="actmsg"></div>`;
  return [bar, html];
}

/* ---------- editor ---------- */
const BLANK = {
  fermentables: () => ({ name: '', kg: null, ebc: null, ppg: null, type: 'grain' }),
  hops: () => ({ name: '', g: null, aa: null, use: 'boil', time: null }),
  yeast: () => ({ name: '', amount: '', atten: null }),
  mash: () => ({ name: 'Mash', tempC: 66, min: 60 }),
  ferment: () => ({ name: 'Primary', tempC: 19, days: 10 }),
  other: () => ({ name: '', amount: '', when: '' }),
  brews: () => ({ date: new Date().toISOString().slice(0, 10), litres: null, og: null, fg: null, abv: null, notes: '' })
};
function startDraft(id, base0) {
  const base = base0 ? JSON.parse(JSON.stringify(base0)) : normalise({ name: '', batchL: cfg.batchL, boilMin: 60, efficiency: cfg.eff, fermentables: [BLANK.fermentables()], hops: [BLANK.hops()], yeast: [BLANK.yeast()], mash: [BLANK.mash()], ferment: [BLANK.ferment()], review: false });
  if (!base0) base.name = '';
  base.tags = base.tags || []; base.brews = base.brews || [];
  state.draft = base; state.draftFor = id; state.draftErr = '';
}
const fld = (label, k, v, t, ph) => `<div class="field"><label>${label}</label><input data-k="${k}" data-t="${t || 'text'}" ${t === 'num' ? 'inputmode="decimal"' : ''} value="${esc(v ?? '')}" placeholder="${esc(ph || 'Empty')}"></div>`;
const cell = (label, k, v, t) => `<label class="cell"><span>${label}</span><input data-k="${k}" data-t="${t || 'text'}" ${t === 'num' ? 'inputmode="decimal"' : ''} value="${esc(v ?? '')}"></label>`;
const selCell = (label, k, v, opts) => `<label class="cell"><span>${label}</span><select data-k="${k}">${opts.map(([a, b]) => `<option value="${a}" ${v === a ? 'selected' : ''}>${b}</option>`).join('')}</select></label>`;
const rm = (list, i) => `<button class="ibtn" data-act="rm" data-list="${list}" data-i="${i}" aria-label="Remove">${I.close}</button>`;
function editView(id) {
  const back = id ? '#/r/' + encodeURIComponent(id) : '#/';
  if (id) {
    const full = state.full[id];
    if (!full) { openRecipe(id); return [backBtn(back) + crumb(['<span>Edit</span>']), state.fullErr[id] ? `<div style="margin-top:24px">${errorCallout(state.fullErr[id], 'retryfull')}</div>` : '<p class="faint" style="padding-top:40px">Opening recipe…</p>']; }
    if (!state.draft || state.draftFor !== id) startDraft(id, full);
  } else if (!state.draft || state.draftFor !== null) startDraft(null, null);
  const d = state.draft;
  const sec = (list, title, add, fn) => `<h2>${title}</h2>${d[list].map((x, i) => `<div class="item">${fn(x, i)}</div>`).join('')}<button class="newrow" data-act="add" data-list="${list}">＋ ${add}</button>`;
  const bar = `<a class="ibtn" href="${back}" data-act="cancel" aria-label="Cancel">${I.close}</a>` + crumb([`<span>${id ? 'Edit recipe' : 'New recipe'}</span>`]) + `<button class="btn small primary" data-act="save" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Saving…' : 'Save'}</button>`;
  const html = `
  <input class="titleinput" data-k="name" data-t="text" value="${esc(d.name)}" placeholder="Untitled" aria-label="Recipe name">
  ${state.draftErr ? errorCallout({ code: 'x', message: state.draftErr }) : ''}
  ${fld('Style', 'style', d.style)}
  ${fld('Source', 'source', d.source, 'text', 'Book, page, course')}
  <div class="field" style="align-items:flex-start"><label style="padding-top:8px">Tags</label><div class="tagpick">${TAG_GROUPS.map(([g, ts]) => `<div class="tg"><span>${g}</span>${ts.map(t => `<button type="button" class="tagchip ${TAGS[t]}" data-act="tagtoggle" data-tag="${t}" aria-pressed="${d.tags.includes(t)}">${t}</button>`).join('')}</div>`).join('')}</div></div>
  ${fld('Batch (L)', 'batchL', d.batchL, 'num')}
  ${fld('Boil (min)', 'boilMin', d.boilMin, 'num')}
  ${fld('Efficiency (%)', 'efficiency', d.efficiency, 'num')}
  ${fld('OG', 'og', d.og, 'num', '1.050')}
  ${fld('FG', 'fg', d.fg, 'num', '1.010')}
  ${fld('ABV (%)', 'abv', d.abv, 'num')}
  ${fld('IBU', 'ibu', d.ibu, 'num')}
  ${fld('EBC', 'ebc', d.ebc, 'num')}
  <h2>Story</h2>
  <textarea class="notes" data-k="story" data-t="text" placeholder="Where the recipe comes from and what the beer is like">${esc(d.story)}</textarea>
  <h2>Water</h2>
  <div class="item"><div class="igrid" style="grid-template-columns:repeat(3,1fr)">${cell('Strike L', 'water.strikeL', d.water.strikeL, 'num')}${cell('Strike °C', 'water.strikeC', d.water.strikeC, 'num')}${cell('Pre-boil L', 'water.preboilL', d.water.preboilL, 'num')}${cell('Sparge L', 'water.spargeL', d.water.spargeL, 'num')}${cell('Sparge °C', 'water.spargeC', d.water.spargeC, 'num')}</div></div>
  <div class="field"><label>Status</label><select data-k="review" data-t="bool"><option value="1" ${d.review ? 'selected' : ''}>To review</option><option value="0" ${!d.review ? 'selected' : ''}>Ready</option></select></div>
  ${sec('fermentables', 'Fermentables', 'Add fermentable', (x, i) => `<div class="ihead"><input data-k="fermentables.${i}.name" value="${esc(x.name)}" placeholder="Fermentable">${rm('fermentables', i)}</div><div class="igrid" style="grid-template-columns:1fr 1fr 1fr 1.3fr">${cell('kg', `fermentables.${i}.kg`, x.kg, 'num')}${cell('EBC', `fermentables.${i}.ebc`, x.ebc, 'num')}${cell('PPG', `fermentables.${i}.ppg`, x.ppg, 'num')}${selCell('Type', `fermentables.${i}.type`, x.type, [['grain', 'Grain'], ['adjunct', 'Adjunct'], ['extract', 'Extract'], ['sugar', 'Sugar']])}</div>${MASHED(x.type) ? '' : `<div class="igrid" style="margin-top:6px">${cell('When (start of the boil, 15 min left, flameout)', `fermentables.${i}.when`, x.when)}</div>`}`)}
  ${sec('hops', 'Hops', 'Add hop', (x, i) => `<div class="ihead"><input data-k="hops.${i}.name" value="${esc(x.name)}" placeholder="Hop">${rm('hops', i)}</div><div class="igrid" style="grid-template-columns:1fr 1fr 1.4fr 1fr">${cell('g', `hops.${i}.g`, x.g, 'num')}${cell('AA %', `hops.${i}.aa`, x.aa, 'num')}${selCell('Use', `hops.${i}.use`, x.use, [['boil', 'Boil'], ['fwh', 'First wort'], ['whirlpool', 'Whirlpool'], ['dryhop', 'Dry hop'], ['mash', 'Mash']])}${cell(x.use === 'dryhop' ? 'Days' : 'Min left', `hops.${i}.time`, x.time, 'num')}</div>`)}
  ${sec('yeast', 'Yeast', 'Add yeast', (x, i) => `<div class="ihead"><input data-k="yeast.${i}.name" value="${esc(x.name)}" placeholder="Yeast">${rm('yeast', i)}</div><div class="igrid" style="grid-template-columns:1.6fr 1fr">${cell('Amount / notes', `yeast.${i}.amount`, x.amount)}${cell('Attenuation %', `yeast.${i}.atten`, x.atten, 'num')}</div>`)}
  ${sec('mash', 'Mash', 'Add step', (x, i) => `<div class="ihead"><input data-k="mash.${i}.name" value="${esc(x.name)}" placeholder="Step">${rm('mash', i)}</div><div class="igrid" style="grid-template-columns:1fr 1fr">${cell('°C', `mash.${i}.tempC`, x.tempC, 'num')}${cell('Minutes', `mash.${i}.min`, x.min, 'num')}</div>`)}
  ${sec('ferment', 'Fermentation', 'Add step', (x, i) => `<div class="ihead"><input data-k="ferment.${i}.name" value="${esc(x.name)}" placeholder="Step">${rm('ferment', i)}</div><div class="igrid" style="grid-template-columns:1fr 1fr">${cell('°C', `ferment.${i}.tempC`, x.tempC, 'num')}${cell('Days', `ferment.${i}.days`, x.days, 'num')}</div>`)}
  ${sec('other', 'Other ingredients', 'Add ingredient', (x, i) => `<div class="ihead"><input data-k="other.${i}.name" value="${esc(x.name)}" placeholder="Ingredient">${rm('other', i)}</div><div class="igrid" style="grid-template-columns:1fr 1.4fr">${cell('Amount', `other.${i}.amount`, x.amount)}${cell('When (e.g. 10 min left in the boil)', `other.${i}.when`, x.when)}</div>`)}
  ${sec('brews', 'Brew history', 'Add brew', (x, i) => `<div class="ihead"><input data-k="brews.${i}.date" type="date" value="${esc(x.date)}" aria-label="Brew date">${rm('brews', i)}</div><div class="igrid" style="grid-template-columns:repeat(4,1fr)">${cell('Litres', `brews.${i}.litres`, x.litres, 'num')}${cell('OG', `brews.${i}.og`, x.og, 'num')}${cell('FG', `brews.${i}.fg`, x.fg, 'num')}${cell('ABV %', `brews.${i}.abv`, x.abv, 'num')}</div><div class="igrid" style="margin-top:6px">${cell('Notes', `brews.${i}.notes`, x.notes)}</div>`)}
  <h2>Method tips</h2>
  <p class="caption" style="margin-top:0">The method is written from the recipe. Add anything extra for a step here.</p>
  ${STEP_KEYS.map(([k, label]) => fld(label, 'stepNotes.' + k, d.stepNotes[k], 'text', 'Optional tip')).join('')}
  <h2>Notes</h2>
  <textarea class="notes" data-k="notes" data-t="text" placeholder="Brew results, variations, what to change next time">${esc(d.notes)}</textarea>
  ${d.uncertain && d.uncertain.length ? `<h2>Check before brewing</h2>${d.uncertain.map((u, i) => `<div class="item"><div class="ihead"><input data-k="uncertain.${i}" value="${esc(u)}">${rm('uncertain', i)}</div></div>`).join('')}` : ''}
  <div class="actions"><button class="btn primary block" data-act="save" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Saving to Notion…' : 'Save to Notion'}</button></div>`;
  return [bar, html];
}
function setPath(obj, path, val) { const ks = path.split('.'); let o = obj; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = val; }
function cleanDraft(d) {
  const r = normalise({ ...d, brews: (d.brews || []).filter(b => b.date) });
  r.fermentables = r.fermentables.filter(x => x.name.trim() || x.kg);
  r.hops = r.hops.filter(x => x.name.trim() || x.g);
  r.yeast = r.yeast.filter(x => x.name.trim());
  r.mash = r.mash.filter(x => x.tempC != null || x.min != null);
  r.ferment = r.ferment.filter(x => x.name.trim() || x.tempC != null);
  r.other = r.other.filter(x => x.name.trim());
  r.uncertain = r.uncertain.filter(u => u.trim());
  r.transcript = d.transcript || ''; r.photos = d.photos || []; r.createdAt = d.createdAt || null;
  return r;
}
async function saveDraft() {
  const d = state.draft; if (!d || state.busy) return;
  if (!String(d.name || '').trim()) { state.draftErr = 'Give the recipe a name first.'; render(false); window.scrollTo(0, 0); return; }
  state.busy = true; state.draftErr = ''; render(false);
  try {
    const id = await commit(cleanDraft(d), state.draftFor || null);
    state.draft = null; state.draftFor = undefined; state.busy = false;
    location.hash = '#/r/' + encodeURIComponent(id);
    toast('Saved to Notion');
  } catch (e) {
    state.busy = false;
    state.draftErr = 'Not saved. ' + errText(e) + (e.code === 'offline' ? ' Your edits are still here; save again when you\'re back online.' : '');
    render(false); window.scrollTo(0, 0);
  }
}

/* ---------- brew day ---------- */
const bsGet = id => ls.get('brew.' + id) || { checked: {}, timers: {}, fired: {} };
const bsSave = (id, s) => ls.set('brew.' + id, s);
/* One method for everything: the recipe page, brew day and the Notion page all use these steps,
   so the instructions always match the (scaled) amounts and the timers. */
const litres = v => { const x = Math.round(v * 10) / 10; return (x % 1 ? x.toFixed(1) : String(x)) + ' L'; };
const degC = v => fx(v, v % 1 ? 1 : 0) + '°C';
function whenMin(w, boil) {
  const s = String(w || '').toLowerCase(); if (!s) return null;
  const m = s.match(/(\d+)\s*min/);
  if (m && /left|remain|before the end/.test(s)) return Math.min(+m[1], boil);
  if (/flame ?out|knock ?out|end of the boil|after the boil/.test(s)) return 0;
  if (/start|begin|with the first wort|whole boil/.test(s)) return boil;
  return null;
}
function addLabel(t, boil) { return t >= boil ? 'At the start' : t === 0 ? 'At flameout' : `${fx(t)} min left`; }
function methodSteps(r, wf = 1) {
  const n = r.stepNotes || {}, w = r.water || {}, steps = [];
  const ferms = r.fermentables.filter(x => x.name), hops = r.hops.filter(h => h.name);
  const boil = num(r.boilMin) || 60;
  const mashedF = ferms.filter(x => MASHED(x.type)), lateF = ferms.filter(x => !MASHED(x.type));
  const W = k => num(w[k]) != null ? num(w[k]) * (/L$/.test(k) ? wf : 1) : null;
  const yeastTxt = r.yeast.filter(y => y.name).map(y => y.name + (y.amount ? ` (${y.amount})` : ''));
  steps.push({ k: 'prep', title: 'Get ready', text: 'Weigh out the ingredients, prepare the yeast and clean and sanitise your kit.', tip: n.prep,
    list: [...ferms.map(x => `${kgTxt(num(x.kg))} ${x.name}`), ...hops.map(h => `${gTxt(num(h.g))} ${h.name} (${useTxt(h)})`), ...yeastTxt, ...r.other.filter(o => o.name).map(o => `${o.name}${o.amount ? ', ' + o.amount : ''}`)] });
  if (W('strikeL') != null || W('strikeC') != null) {
    let tc = W('strikeC'), calc = false;
    const grain = mashedF.reduce((a, x) => a + (num(x.kg) || 0), 0), m0 = num(r.mash.find(m => num(m.tempC) != null)?.tempC);
    if (tc == null && W('strikeL') && grain && m0 != null) { tc = Math.round(0.41 / (W('strikeL') / grain) * (m0 - 18) + m0); calc = true; }
    steps.push({ k: 'strike', title: 'Heat the strike water', text: `Heat ${W('strikeL') != null ? litres(W('strikeL')) + ' of water' : 'the mash water'}${tc != null ? ' to ' + (calc ? 'about ' : '') + degC(tc) : ''}.${calc ? ' (Calculated to land the mash on temperature with grain at 18°C.)' : ''}` });
  }
  const mash = r.mash.filter(m => num(m.tempC) != null || num(m.min) != null);
  mash.forEach((m, i) => {
    const T = num(m.tempC) != null ? degC(num(m.tempC)) : '', M = num(m.min) != null ? fx(num(m.min)) + ' min' : '';
    const out = /out/i.test(m.name || '');
    const title = i === 0 ? `Mash in${T ? ' at ' + T : ''}` : out ? `Mash out${T ? ' at ' + T : ''}` : `Raise to ${T || 'the next rest'}`;
    const text = i === 0 ? `Stir in the grain${T ? ' and hold at ' + T : ''}${M ? ' for ' + M : ''}.` : `Raise the mash to ${T || 'the next temperature'}${M ? ' and hold for ' + M : ''}.`;
    steps.push({ k: 'mash' + i, title, text, tip: i === 0 ? n.mash : '', timer: num(m.min) ? num(m.min) * 60 : null,
      list: i === 0 ? [...mashedF.map(x => `${kgTxt(num(x.kg))} ${x.name}`), ...hops.filter(h => h.use === 'mash').map(h => `${gTxt(num(h.g))} ${h.name}`)] : [] });
  });
  if (mashedF.length) {
    const fwh = hops.filter(h => h.use === 'fwh');
    const parts = [`Sparge${W('spargeL') != null ? ' with ' + litres(W('spargeL')) : ''}${W('spargeC') != null ? ' at ' + degC(W('spargeC')) : ''}`];
    if (W('preboilL') != null) parts.push(`collect about ${litres(W('preboilL'))} of wort`);
    steps.push({ k: 'sparge', title: 'Sparge', text: parts.join(' and ') + '.' + (fwh.length ? ' Put the first wort hops in the kettle as the wort runs in.' : ''), tip: n.sparge,
      list: fwh.map(h => `${gTxt(num(h.g))} ${h.name}`) });
  }
  const adds = hops.filter(h => h.use === 'boil').map(h => ({ t: Math.min(num(h.time) ?? boil, boil), txt: `${gTxt(num(h.g))} ${h.name}` }));
  const loose = [];
  lateF.forEach(x => { const t = whenMin(x.when, boil); const txt = `${kgTxt(num(x.kg))} ${x.name}`; if (t != null) adds.push({ t, txt }); else loose.push(`${txt}${x.when ? ': ' + x.when : ''}`); });
  r.other.forEach(o => { if (!o.name || /bottl|ferment|dry/i.test(o.when)) return; const t = whenMin(o.when, boil); const txt = `${o.amount ? o.amount + ' ' : ''}${o.name}`; if (t != null && /boil|flame|knock/i.test(o.when + '')) adds.push({ t, txt }); else if (/boil/i.test(o.when)) loose.push(`${txt}: ${o.when}`); });
  adds.sort((a, b) => b.t - a.t);
  steps.push({ k: 'boil', title: `Boil for ${fx(boil)} min`, text: 'Bring the wort to a rolling boil and start the timer. Add each item when that many minutes are left.', tip: n.boil, list: loose, adds, timer: boil * 60, boil });
  const wp = hops.filter(h => h.use === 'whirlpool');
  if (wp.length) { const t = Math.max(...wp.map(h => num(h.time) || 20)); steps.push({ k: 'whirl', title: 'Hop stand', text: `Turn off the heat, let the wort cool to below 80°C, add these hops and let them steep for ${fx(t)} min.`, list: wp.map(h => `${gTxt(num(h.g))} ${h.name}`), timer: t * 60 }); }
  const pitchT = num(r.ferment.find(f => num(f.tempC) != null)?.tempC);
  steps.push({ k: 'chill', title: pitchT != null ? `Chill to ${degC(pitchT)}` : 'Chill the wort', text: `Chill the wort${pitchT != null ? ' to ' + degC(pitchT) : ''} and take a gravity reading${num(r.og) ? ` (target OG ${grav(num(r.og))})` : ''}. If it's high, top up with clean water to hit the target.`, tip: n.chill });
  steps.push({ k: 'pitch', title: 'Pitch the yeast', text: 'Transfer the wort to a clean, sanitised fermenter, aerate it well and pitch the yeast.', list: yeastTxt });
  const ferm = r.ferment.filter(m => m.name || num(m.tempC) != null).map(m => `${m.name || 'Ferment'}${num(m.tempC) != null ? ': ' + degC(num(m.tempC)) : ''}${num(m.days) != null ? ', ' + fx(num(m.days)) + ' days' : ''}`);
  const dry = hops.filter(h => h.use === 'dryhop');
  const dryTxt = dry.length ? ` Then dry hop for ${fx(Math.max(...dry.map(h => num(h.time) || 3)))} days.` : '';
  steps.push({ k: 'ferment', title: 'Ferment', text: (ferm.length ? 'Ferment as follows until the gravity holds steady for 3 days.' : 'Ferment until the gravity holds steady for 3 days.') + dryTxt + (num(r.fg) ? ` Target FG ${grav(num(r.fg))}.` : ''), tip: n.ferment,
    list: [...ferm, ...dry.map(h => `Dry hop: ${gTxt(num(h.g))} ${h.name}`)] });
  const bott = r.other.filter(o => o.name && /bottl|ferment|dry/i.test(o.when)).map(o => `${o.name}${o.amount ? ', ' + o.amount : ''}${/bottling/i.test(o.when) && o.when.trim().toLowerCase() === 'bottling' ? '' : ' (' + o.when + ')'}`);
  steps.push({ k: 'package', title: 'Bottle', text: 'Bottle once the gravity has been stable for 3 days.', tip: n.package, list: bott });
  return steps;
}
function brewView(id) {
  const back = '#/r/' + encodeURIComponent(id);
  const r0 = state.full[id];
  if (!r0) { openRecipe(id); return [backBtn(back) + crumb(['<span>Brew day</span>']), '<p class="faint" style="padding-top:40px">Opening recipe…</p>']; }
  const sc = getScale(r0); const r = scaled(r0, sc.L, sc.eff);
  const bs = bsGet(id); const steps = methodSteps(r, r.factor || 1);
  state.brew = { id, steps, name: r0.name };
  const done = steps.filter(s => bs.checked[s.k]).length;
  const bar = backBtn(back) + crumb([`<span>${esc(r0.name)}</span>`, '<span>Brew day</span>']);
  const html = `
  <div class="page-icon">⏱️</div>
  <h1 class="title">Brew day</h1>
  <p class="desc">${esc(r0.name)}, ${fx(sc.L, 1)} L at ${fx(sc.eff)}% efficiency. ${done} of ${steps.length} done.</p>
  <div class="progress"><div style="width:${Math.round(done / steps.length * 100)}%"></div></div>
  ${LN ? '' : '<div class="callout"><div class="ci">🔔</div><div class="cb">Alarms only sound while the app is open on this device.</div></div>'}
  <div class="alerts" id="alerts"></div>
  ${steps.map(s => { const c = !!bs.checked[s.k]; return `<div class="todo ${c ? 'done' : ''}"><button class="check" role="checkbox" aria-checked="${c}" data-act="tick" data-k="${s.k}" aria-label="${esc(s.title)}">${I.tick}</button><div class="tb"><div class="tt">${esc(s.title)}</div>${s.text ? `<p class="muted" style="font-size:14px">${esc(s.text)}</p>` : ''}${s.tip ? `<div class="tip">💡 ${esc(s.tip)}</div>` : ''}${s.list && s.list.length ? `<ul>${s.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${s.timer ? timerBlock(s, bs) : ''}</div></div>`; }).join('')}
  <h2>Log this brew</h2>
  <div class="item"><div class="igrid" style="grid-template-columns:1.4fr 1fr 1fr 1fr">
    <label class="cell"><span>Date</span><input id="lb-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
    <label class="cell"><span>Litres</span><input id="lb-l" inputmode="decimal" value="${esc(+sc.L.toFixed(1))}"></label>
    <label class="cell"><span>OG</span><input id="lb-og" inputmode="decimal" placeholder="1.0__"></label>
    <label class="cell"><span>FG</span><input id="lb-fg" inputmode="decimal" placeholder="later"></label>
  </div><div class="igrid" style="margin-top:6px"><label class="cell"><span>Notes</span><input id="lb-notes" placeholder="Anything worth remembering"></label></div>
  <div class="actions" style="margin-top:10px"><button class="btn small primary" data-act="logbrew">Save to brew history</button></div></div>
  <div class="actions"><button class="btn ghost" data-act="resetbrew">Start over</button></div>`;
  return [bar, html];
}
const tLeft = (t, total) => !t ? total : t.running ? Math.max(0, (t.endAt - Date.now()) / 1000) : (t.remaining ?? total);
function timerBlock(s, bs) {
  const t = bs.timers[s.k]; const rem = tLeft(t, s.timer);
  return `<div class="timer"><div class="clock" data-clock="${s.k}">${mmss(rem)}</div>
  ${s.adds && s.adds.length ? `<ul class="adds">${s.adds.map((a, j) => `<li data-add="${s.k}:${j}" class="${bs.fired[s.k + ':' + j] ? 'fired' : ''}"><span>${esc(a.txt)}</span><span class="when">${a.t >= s.timer / 60 ? 'At start' : fx(a.t) + ' min left'}</span></li>`).join('')}</ul>` : ''}
  <div class="actions" style="margin-top:10px"><button class="btn small ${t && t.running ? '' : 'primary'}" data-act="tgo" data-k="${s.k}">${t && t.running ? 'Pause' : (t && t.remaining != null && t.remaining < s.timer ? 'Resume' : 'Start')}</button><button class="btn small ghost" data-act="treset" data-k="${s.k}">Reset</button></div></div>`;
}
/* Native alarms: scheduled with the system so they fire with the screen off or the app in the background. */
const nid = key => { let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2000000000 + 1; };
async function ensureNotifyPermission() {
  if (!LN) return false;
  try {
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') p = await LN.requestPermissions();
    return p.display === 'granted';
  } catch { return false; }
}
async function scheduleTimer(recipeId, s, endAt, name) {
  if (!LN) return;
  const items = [];
  (s.adds || []).forEach((a, j) => { const at = endAt - a.t * 60000; if (at > Date.now() + 1500) items.push({ id: nid(recipeId + s.k + j), title: `Add ${a.txt}`, body: `${name}: ${a.t} min left in the boil`, schedule: { at: new Date(at), allowWhileIdle: true }, channelId: 'brew' }); });
  items.push({ id: nid(recipeId + s.k + 'end'), title: `${s.title}: time's up`, body: name, schedule: { at: new Date(endAt), allowWhileIdle: true }, channelId: 'brew' });
  try { await LN.schedule({ notifications: items }); } catch (e) { toast('Couldn\'t set the alarm. Keep the app open.'); }
}
async function cancelTimer(recipeId, s) {
  if (!LN) return;
  const ids = [...(s.adds || []).map((a, j) => nid(recipeId + s.k + j)), nid(recipeId + s.k + 'end')];
  try { await LN.cancel({ notifications: ids.map(id => ({ id })) }); } catch { }
}
let tickId = null, audio = null, wake = null;
function startTick() { stopTick(); tickId = setInterval(tick, 500); tick(); }
function stopTick() { if (tickId) clearInterval(tickId); tickId = null; }
function tick() {
  const b = state.brew; if (!b || route().view !== 'brew') return;
  const bs = bsGet(b.id); let changed = false;
  for (const s of b.steps) {
    if (!s.timer) continue;
    const t = bs.timers[s.k]; const rem = tLeft(t, s.timer);
    const el = document.querySelector(`[data-clock="${s.k}"]`); if (el) el.textContent = mmss(rem);
    if (!t || !t.running) continue;
    (s.adds || []).forEach((a, j) => {
      const key = s.k + ':' + j;
      if (!bs.fired[key] && rem <= a.t * 60 + 0.5) { bs.fired[key] = 1; changed = true; inAppAlert(`Add ${a.txt}`); const li = document.querySelector(`[data-add="${key}"]`); if (li) li.classList.add('fired'); }
    });
    if (rem <= 0 && !bs.fired[s.k + ':end']) { bs.fired[s.k + ':end'] = 1; t.running = false; t.remaining = 0; bsSave(b.id, bs); inAppAlert(`${s.title}: time's up`); render(false); return; }
  }
  if (changed) bsSave(b.id, bs);
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
async function requestWake() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch { } }
function releaseWake() { try { wake && wake.release(); } catch { } wake = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (route().view === 'brew') { requestWake(); tick(); }
  if (route().view === 'list' && Date.now() - state.syncedAt > 5 * 60 * 1000) syncList();
});

async function logBrew(btn) {
  const id = route().id; const r = state.full[id]; if (!r || state.busy) return;
  const date = $('#lb-date').value; const og = num($('#lb-og').value), fg = num($('#lb-fg').value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('Pick a date'); return; }
  const fixG = sg;
  const b = { date, litres: num($('#lb-l').value), og: fixG(og), fg: fixG(fg), abv: null, notes: $('#lb-notes').value.trim() };
  if (b.og && b.fg) b.abv = Math.round((b.og - b.fg) * 131.25 * 10) / 10;
  state.busy = true; btn.disabled = true; btn.textContent = 'Saving…';
  try { await commit({ ...r, brews: [...r.brews, b] }, id); toast('Brew logged'); location.hash = '#/r/' + encodeURIComponent(id); }
  catch (e) { toast(errText(e)); btn.disabled = false; btn.textContent = 'Save to brew history'; }
  state.busy = false;
}

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
  <div class="page-icon">🍺</div>
  <h1 class="title">Connect Brew book to Notion</h1>
  <p class="desc">One-time setup, about two minutes. The app talks to Notion directly with a private key that stays on this phone.</p>
  <ol class="steps-list">
    <li>On a computer, go to <b>notion.so/my-integrations</b> and choose <b>New integration</b>.</li>
    <li>Name it <b>Brew book app</b>, pick your workspace, keep type <b>Internal</b>, and save. Under Capabilities, make sure it can read, update and insert content.</li>
    <li>Copy the <b>Internal Integration Secret</b>. It starts with <code class="k">ntn_</code> or <code class="k">secret_</code>.</li>
    <li>In Notion, open the page where Brew book should live (or your existing Brew book database), tap <b>•••</b> → <b>Connections</b>, and add <b>Brew book app</b>.</li>
    <li>Paste the secret below. The app finds your Brew book database, or offers to create an empty one.</li>
  </ol>
  <div class="field"><label>Secret</label><input id="tok" type="password" autocomplete="off" placeholder="ntn_…" value="${esc(cfg.token)}"></div>
  <div id="setupmsg"></div>
  <div class="actions"><button class="btn primary block" data-act="connect">Connect</button></div>`;
  return [crumb(['<span>🍺</span>', '<span>Setup</span>']), html];
}
function settingsView() {
  const html = `
  <div class="page-icon">⚙️</div>
  <h1 class="title">Settings</h1>
  <h2>Your system</h2>
  <p class="desc">"Scale to my system" uses these, and recipes without an efficiency use yours for the numbers.</p>
  <div class="field"><label>Batch size (L)</label><input id="s-batch" inputmode="decimal" value="${esc(cfg.batchL)}"></div>
  <div class="field"><label>Efficiency (%)</label><input id="s-eff" inputmode="decimal" value="${esc(cfg.eff)}"></div>
  <div class="actions"><button class="btn small" data-act="savesys">Save</button></div>
  <h2>Notion</h2>
  <div class="field"><label>Secret</label><input id="tok" type="password" autocomplete="off" value="${esc(cfg.token)}" placeholder="ntn_…"></div>
  <div class="field"><label>Data source ID</label><input id="ds" value="${esc(cfg.ds)}" autocomplete="off" placeholder="Leave empty to find it automatically"></div>
  <div id="setupmsg"></div>
  <div class="actions"><button class="btn small" data-act="connect">Save and test</button><a class="btn small ghost" href="${dbUrl()}" target="_blank" rel="noopener">Open Brew book in Notion</a></div>
  <h2>Adding recipes from photos</h2>
  <p style="font-size:14px">Send the photos to Claude with the <b>Brew book recipe</b> skill installed (see the project page on GitHub) and say "add these to Brew book". They appear here as "To review" after the next sync.</p>
  <h2>Offline copy</h2>
  <p style="font-size:14px" class="muted">${state.recipes.length} recipes saved on this phone. Photos need a connection.</p>
  <div class="actions"><button class="btn small ghost danger" data-act="clearcache">Clear saved copy</button></div>`;
  return [backBtn('#/') + crumb(['<span>Brew book</span>', '<span>Settings</span>']), html];
}
/* ---------- overlays ---------- */
function closeOverlay() { overlay.innerHTML = ''; }
function newMenu() {
  overlay.innerHTML = `<div class="scrim" data-act="closeov"><div class="sheet" data-stop="1"><div class="grab"></div>
    <a class="menuitem" href="#/new"><span class="mi">📝</span><span><b>New recipe</b><span>Type it in yourself</span></span></a>
    <a class="menuitem" href="https://claude.ai/new" target="_blank" rel="noopener"><span class="mi">📷</span><span><b>Add from photos with Claude</b><span>Send the photos to Claude and say "add these to Brew book". They land here as "To review".</span></span></a>
  </div></div>`;
}

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  if (e.target.closest('[data-stop]') && !e.target.closest('[data-act]')) return;
  const a = e.target.closest('[data-act]');
  if (!a) { const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a')) location.hash = tr.dataset.href; return; }
  const act = a.dataset.act; const { id } = route();
  switch (act) {
    case 'sync': syncList(); break;
    case 'tab': state.filter.tab = a.dataset.tab; document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t === a)); renderRows(); break;
    case 'clearf': state.filter = { ...FDEF(), tab: state.filter.tab, sort: state.filter.sort, dir: state.filter.dir, group: state.filter.group }; render(false); break;
    case 'fpanel': state.fpanel = !state.fpanel; a.classList.toggle('on', state.fpanel); a.setAttribute('aria-expanded', state.fpanel); renderRows(); break;
    case 'tog': { const f = state.filter, k = a.dataset.k, v = a.dataset.v; if (k === 'brewed') f.brewed = f.brewed === (v === 'Brewed' ? 'yes' : 'no') ? '' : (v === 'Brewed' ? 'yes' : 'no'); else f[k] = f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v]; renderRows(); break; }
    case 'unf': { const f = state.filter, k = a.dataset.k, v = a.dataset.v; if (Array.isArray(f[k])) f[k] = f[k].filter(x => x !== v); else if (k === 'abv' || k === 'ibu') { f[k + 'Min'] = null; f[k + 'Max'] = null; } else f[k] = ''; state.fpanel && ($('#fpanel').dataset.open = ''); renderRows(); break; }
    case 'sortcol': { const f = state.filter, k = a.dataset.k; if (f.sort === k) f.dir = -f.dir; else { f.sort = k; f.dir = ['abv', 'og', 'ibu', 'ebc', 'times', 'brewed'].includes(k) ? -1 : 1; } renderRows(); break; }
    case 'grp': { const c = state.closed || (state.closed = {}); c[a.dataset.k] = !c[a.dataset.k]; renderRows(); break; }
    case 'view': cfg.view = a.dataset.view; saveCfg(); document.querySelectorAll('[data-act="view"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === cfg.view)); renderRows(); break;
    case 'tagf': { const t = a.dataset.tag, f = state.filter; f.tags = f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t]; document.querySelectorAll('[data-act="tagf"]').forEach(b => b.setAttribute('aria-pressed', f.tags.includes(b.dataset.tag))); renderRows(); break; }
    case 'tagtoggle': { const t = a.dataset.tag, d = state.draft; d.tags = d.tags.includes(t) ? d.tags.filter(x => x !== t) : [...d.tags, t]; a.setAttribute('aria-pressed', d.tags.includes(t)); break; }
    case 'logbrew': logBrew(a); break;
    case 'newmenu': newMenu(); break;
    case 'closeov': if (e.target === a) closeOverlay(); break;
    case 'retryfull': delete state.fullErr[id]; state.images[id] = null; render(false); break;
    case 'mysys': state.scale[id] = { L: cfg.batchL, eff: cfg.eff }; render(false); break;
    case 'unscale': delete state.scale[id]; render(false); break;
    case 'lb': overlay.innerHTML = `<div class="lightbox" data-act="closeov"><img src="${esc(a.dataset.src)}" alt="Recipe photo"></div>`; break;
    case 'markready': {
      const r = state.full[id]; if (!r || state.busy) break;
      state.busy = true; a.textContent = 'Saving…';
      try { await commit({ ...r, review: false }, id); toast('Marked as ready'); } catch (err) { toast(errText(err)); }
      state.busy = false; render(false); break;
    }
    case 'del': {
      if (!a.classList.contains('armed')) { a.classList.add('armed'); a.textContent = 'Tap again to delete'; setTimeout(() => { if (a.isConnected && !a.disabled) { a.classList.remove('armed'); a.textContent = 'Delete'; } }, 4000); break; }
      a.disabled = true; a.textContent = 'Deleting…';
      try {
        await napi(`/pages/${id}`, { method: 'PATCH', body: { in_trash: true } });
        state.recipes = state.recipes.filter(r => r.id !== id); delete state.full[id]; ls.del('bb.full.' + id); ls.del('brew.' + id); ls.set('bb.list', state.recipes);
        location.hash = '#/'; toast('Moved to Notion trash');
      } catch (err) { a.disabled = false; a.classList.remove('armed'); a.textContent = 'Delete'; const m = $('#actmsg'); if (m) m.innerHTML = errorCallout(err); }
      break;
    }
    case 'cancel': state.draft = null; state.draftFor = undefined; state.draftErr = ''; break;
    case 'save': saveDraft(); break;
    case 'add': state.draft[a.dataset.list].push(BLANK[a.dataset.list]()); keep(() => render(false)); break;
    case 'rm': state.draft[a.dataset.list].splice(+a.dataset.i, 1); keep(() => render(false)); break;
    case 'tick': { const bs = bsGet(id); bs.checked[a.dataset.k] = !bs.checked[a.dataset.k]; bsSave(id, bs); keep(() => render(false)); break; }
    case 'tgo': {
      primeAudio();
      const s = state.brew.steps.find(x => x.k === a.dataset.k); const bs = bsGet(id); const t = bs.timers[s.k] || {};
      if (t.running) { t.remaining = Math.max(0, (t.endAt - Date.now()) / 1000); t.running = false; cancelTimer(id, s); }
      else {
        let rem = t.remaining ?? s.timer; if (rem <= 0) { rem = s.timer; clearFired(bs, s.k); }
        t.endAt = Date.now() + rem * 1000; t.running = true; t.remaining = null;
        if (await ensureNotifyPermission()) scheduleTimer(id, s, t.endAt, state.brew.name);
        else if (LN) toast('Notifications are off, so alarms only sound with the app open.');
      }
      bs.timers[s.k] = t; bsSave(id, bs); keep(() => render(false)); tick(); break;
    }
    case 'treset': { const s = state.brew.steps.find(x => x.k === a.dataset.k); const bs = bsGet(id); delete bs.timers[a.dataset.k]; clearFired(bs, a.dataset.k); bsSave(id, bs); cancelTimer(id, s); keep(() => render(false)); break; }
    case 'dismiss': state.alerts = state.alerts.filter(x => x.id !== a.dataset.id); renderAlerts(); break;
    case 'resetbrew': {
      if (!a.classList.contains('armed')) { a.classList.add('armed'); a.textContent = 'Tap again to clear progress'; break; }
      for (const s of state.brew.steps) if (s.timer) cancelTimer(id, s);
      ls.del('brew.' + id); state.alerts = []; render(false); break;
    }
    case 'connect': testConnection(); break;
    case 'pickbook': case 'createbook': setupAction(act, a.dataset.id); break;
    case 'savesys': {
      const L = num($('#s-batch').value), eff = num($('#s-eff').value);
      if (!L || !eff || eff > 100) { toast('Enter a batch size and an efficiency between 1 and 100'); break; }
      cfg.batchL = L; cfg.eff = eff; saveCfg(); toast('Saved'); break;
    }
    case 'clearcache': {
      if (!a.classList.contains('armed')) { a.classList.add('armed'); a.textContent = 'Tap again to clear'; break; }
      for (const r of state.recipes) ls.del('bb.full.' + r.id);
      ls.del('bb.list'); state.recipes = []; state.full = {}; state.loaded = false; toast('Cleared. Syncing again…'); syncList(); render(false); break;
    }
  }
});
function clearFired(bs, k) { Object.keys(bs.fired).forEach(x => { if (x.startsWith(k + ':')) delete bs.fired[x]; }); }
function primeAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { } }
function keep(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { state.filter.q = t.value; renderRows(); return; }
  if (t.dataset.fnum) { state.filter[t.dataset.fnum] = num(t.value); clearTimeout(state.fnumT); state.fnumT = setTimeout(renderRows, 350); return; }
  if (t.dataset.k && state.draft && t.tagName !== 'SELECT') { setPath(state.draft, t.dataset.k, t.dataset.t === 'num' ? num(t.value) : t.value); return; }
  if (t.dataset.scale) {
    const r = state.full[route().id]; const v = num(t.value); if (!r || !v || v <= 0) return;
    const sc = { ...getScale(r) }; sc[t.dataset.scale] = Math.min(t.dataset.scale === 'eff' ? 100 : 10000, v); state.scale[r.id] = sc;
    clearTimeout(state.scaleT); state.scaleT = setTimeout(() => { const f = t.dataset.scale; keep(() => render(false)); const el = document.querySelector(`[data-scale="${f}"]`); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch { } } }, 500);
  }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'groupf') { state.filter.group = t.value; cfg.group = t.value; saveCfg(); renderRows(); return; }
  if (t.dataset.fsel) { state.filter[t.dataset.fsel] = t.value; renderRows(); return; }
  if (t.tagName === 'SELECT' && t.dataset.k && state.draft) { setPath(state.draft, t.dataset.k, t.dataset.t === 'bool' ? t.value === '1' : t.value); if (/\.(use|type)$/.test(t.dataset.k)) keep(() => render(false)); return; }
  if (t.dataset.act === 'addphoto' && t.files && t.files[0]) {
    const id = route().id; const r = state.full[id]; if (!r) return;
    const label = t.closest('label'); if (label) label.firstChild.textContent = '…';
    toast('Uploading photo…');
    try {
      const blob = await compress(t.files[0]);
      const fid = await uploadImage(blob, `${(r.name || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.jpg`);
      await commit({ ...r }, id, [fid]);
      delete state.images[id]; toast('Photo added'); render(false);
    } catch (err) { toast(errText(err)); render(false); }
  }
});

/* ---------- native glue ---------- */
if (AppP) {
  AppP.addListener('backButton', () => {
    if (overlay.innerHTML) { closeOverlay(); return; }
    if (route().view === 'list' || route().view === 'setup') AppP.exitApp(); else history.back();
  });
}
if (LN) {
  LN.createChannel({ id: 'brew', name: 'Brew day alarms', description: 'Hop additions and timers', importance: 5, visibility: 1, vibration: true, lights: true }).catch(() => { });
}

/* ---------- start ---------- */
for (const r of state.recipes) {
  try {
    const c = ls.get('bb.full.' + r.id);
    if (c && c.data) { const d = normalise(c.data); d.id = r.id; state.full[r.id] = d; }
  } catch (err) { console.error('Dropping bad cached recipe', r.id, err); ls.del('bb.full.' + r.id); }
}
render();
if (connected()) syncList();
