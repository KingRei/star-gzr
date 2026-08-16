#!/usr/bin/env node
/* 觀星者 StarGZR — MCP server (stdio, zero dependencies)
   讓任何支援 MCP 的 AI(Claude Desktop、Cline、Continue…)可以:
   1) 直接算天文數字(無頭引擎,和網頁同一份程式碼)
   2) 產生一條深連結,使用者點開就是「已經擺好」的觀星畫面
   協定:JSON-RPC 2.0,以換行分隔的 JSON 走 stdin/stdout。 */
'use strict';
const E = require('./engine.js');

const APP_URL = process.env.STARGZR_URL || 'https://gazer.star-gzr.com';
const DEF_LAT = parseFloat(process.env.STARGZR_LAT ?? '25.033');
const DEF_LON = parseFloat(process.env.STARGZR_LON ?? '121.565');

/* ── 深連結 ─────────────────────────────────────────────── */
const BODIES = ['sun','moon','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto'];
function buildLink(a = {}) {
  const q = new URLSearchParams();
  if (a.datetime) {
    const ms = E.parseTime(a.datetime);
    q.set('dt', new Date(ms).toISOString().slice(0, 16));
  }
  if (a.latitude != null) q.set('lat', String(a.latitude));
  if (a.longitude != null) q.set('lon', String(a.longitude));
  if (a.language) q.set('lang', a.language);
  if (a.speed != null) q.set('speed', String(a.speed));
  const tour = (a.tour || []).filter(Boolean);
  if (tour.length > 1) q.set('tour', tour.join(','));
  else if (tour.length === 1) q.set('target', tour[0]);
  else if (a.target) q.set('target', a.target);
  if (a.settings && typeof a.settings === 'object') {
    const s = Object.entries(a.settings)
      .map(([k, v]) => `${k}:${v === true ? 1 : v === false ? 0 : v}`).join(',');
    if (s) q.set('set', s);
  }
  if (a.click && a.click.length) q.set('click', a.click.join(','));
  if (a.fov != null) q.set('fov', String(a.fov));
  if (a.compass) q.set('compass', '1');
  const qs = q.toString();
  return qs ? `${APP_URL}/?${qs}` : APP_URL + '/';
}

/* ── 工具定義 ───────────────────────────────────────────── */
const S = (d, extra = {}) => ({ type: 'string', description: d, ...extra });
const timeArg = S('時間 / time, ISO like 2026-08-16T21:30 (無時區視為 UTC). 省略 = 現在');
const latArg = { type: 'number', description: `觀測緯度 / observer latitude (default ${DEF_LAT})` };
const lonArg = { type: 'number', description: `觀測經度 / observer longitude (default ${DEF_LON})` };

const TOOLS = [
  {
    name: 'stargzr_open',
    description: '產生一條 StarGZR 深連結,點開就是指定時間/地點/導覽目標的觀星畫面。' +
      ' Build a StarGZR deep link that opens the simulator already set to a given time, place, and guided tour.',
    inputSchema: {
      type: 'object',
      properties: {
        target: S('單一導覽目標:行星(mars/火星)或星座(Orion/獵戶座) / single fly-to target'),
        tour: { type: 'array', items: { type: 'string' }, description: '多站導覽,依序飛過 / multi-stop tour, e.g. ["mercury","venus","earth"]' },
        datetime: timeArg, latitude: latArg, longitude: lonArg,
        language: S('介面語言 / UI language', { enum: ['zh', 'en'] }),
        speed: { type: 'number', description: '模擬速度(每真實秒的模擬毫秒),例如 86400000 = 一天/秒' },
        settings: { type: 'object', description: '勾選項與下拉,例如 {"constChk":true,"lockSel":"c:獅子座"} / checkbox & select ids' },
        click: { type: 'array', items: { type: 'string' }, description: '要按的按鈕 id,例如 ["retroTableBtn"]' },
        fov: { type: 'number', description: '地平視角的視野角度 18–162 度 / horizon-pane field of view' },
        compass: { type: 'boolean', description: '提示使用者開啟指南針對準真實天空 / hint the user to enable compass aiming (mobile)' },
      },
    },
  },
  {
    name: 'stargzr_sky',
    description: '指定時間地點的整片天空快照:日月九星的方位角/高度角、可見與否、月相。' +
      ' Snapshot of the whole sky: alt/az for the Sun, Moon and planets, what is above the horizon, and the moon phase.',
    inputSchema: { type: 'object', properties: { datetime: timeArg, latitude: latArg, longitude: lonArg } },
  },
  {
    name: 'stargzr_body',
    description: '單一天體的位置:赤經赤緯、地平方位(含羅盤方向)、距離、順行/逆行。' +
      ' Position of one body: RA/Dec, altitude/azimuth with compass point, distance, prograde/retrograde.',
    inputSchema: {
      type: 'object',
      properties: {
        body: S('天體 / body', { enum: BODIES }),
        datetime: timeArg, latitude: latArg, longitude: lonArg,
      },
      required: ['body'],
    },
  },
  {
    name: 'stargzr_moon_phase',
    description: '月相:距角、照亮比例、月齡與名稱。 Moon phase: elongation, illuminated fraction, age and name.',
    inputSchema: { type: 'object', properties: { datetime: timeArg } },
  },
  {
    name: 'stargzr_retrogrades',
    description: '某行星在某年的所有逆行區間(起訖時間、天數)。 All retrograde periods of a planet in a given year.',
    inputSchema: {
      type: 'object',
      properties: {
        planet: S('行星 / planet', { enum: BODIES.filter(b => !['sun', 'moon', 'earth'].includes(b)) }),
        year: { type: 'number', description: '西元年 / calendar year' },
      },
      required: ['planet', 'year'],
    },
  },
  {
    name: 'stargzr_constellation',
    description: '星座資訊與此刻可見度:中心赤經赤緯(J2000 與當日歲差後)、地平高度方位、最亮星等。' +
      ' Constellation info and current visibility.',
    inputSchema: {
      type: 'object',
      properties: {
        name: S('星座名,中英皆可 / constellation name in Chinese or English, e.g. 獵戶座 or Orion'),
        datetime: timeArg, latitude: latArg, longitude: lonArg,
      },
      required: ['name'],
    },
  },
  {
    name: 'stargzr_list_constellations',
    description: '列出模擬器內建的所有星座(12 星座 + 額外知名星座)。 List every constellation the simulator can draw.',
    inputSchema: { type: 'object', properties: {} },
  },
];

/* ── 工具實作 ───────────────────────────────────────────── */
function loc(a) {
  return [a.latitude != null ? a.latitude : DEF_LAT, a.longitude != null ? a.longitude : DEF_LON];
}
const HANDLERS = {
  stargzr_open(a) {
    const url = buildLink(a);
    return { url, hint_zh: '把這條連結給使用者,點開就是該畫面', hint_en: 'Give this URL to the user; opening it restores the described view' };
  },
  stargzr_sky(a) { const [la, lo] = loc(a); return E.skySnapshot(E.parseTime(a.datetime), la, lo); },
  stargzr_body(a) { const [la, lo] = loc(a); return E.bodyReport(a.body, E.parseTime(a.datetime), la, lo); },
  stargzr_moon_phase(a) { return E.moonPhase(E.parseTime(a.datetime)); },
  stargzr_retrogrades(a) { return E.retrogrades(a.planet, a.year); },
  stargzr_constellation(a) {
    const [la, lo] = loc(a);
    const r = E.constellationReport(a.name, E.parseTime(a.datetime), la, lo);
    r.open_url = buildLink({ target: a.name, datetime: a.datetime, latitude: a.latitude, longitude: a.longitude });
    return r;
  },
  stargzr_list_constellations() {
    return {
      count: E.allConstellations().length,
      constellations: E.allConstellations().map(c => ({ zh: c.zh, en: c.en, zodiac: c.zodiac, stars: c.data.s.length })),
    };
  },
};

/* ── JSON-RPC over stdio ────────────────────────────────── */
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function ok(id, result) { send({ jsonrpc: '2.0', id, result }); }
function fail(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: (params && params.protocolVersion) || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'stargzr', version: '1.0.0' },
    });
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const name = params && params.name;
    const fn = HANDLERS[name];
    if (!fn) return fail(id, -32602, `Unknown tool: ${name}`);
    try {
      const out = fn((params && params.arguments) || {});
      return ok(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] });
    } catch (e) {
      return ok(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
    }
  }
  if (id !== undefined) fail(id, -32601, `Method not found: ${method}`);
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); }
    catch (e) { fail(null, -32700, 'Parse error: ' + e.message); }
  }
});
process.stdin.on('end', () => process.exit(0));

module.exports = { TOOLS, HANDLERS, buildLink };
