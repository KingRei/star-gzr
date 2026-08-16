#!/usr/bin/env node
/* 冒煙測試:確認引擎數字合理、每個 MCP 工具都能回話。node test.js */
'use strict';
const E = require('./engine.js');
const { HANDLERS, TOOLS, buildLink } = require('./index.js');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };

const ms = E.parseTime('2026-08-16T21:30');
ok(Math.abs(ms - Date.UTC(2026, 7, 16, 21, 30)) < 1000, '無時區字串視為 UTC / naive ISO parsed as UTC');

/* 太陽在 8 月中的赤經約 145–150°、赤緯約 +13° */
const sun = E.bodyReport('sun', ms, 25.03, 121.56);
ok(sun.ra_deg > 140 && sun.ra_deg < 155, `太陽赤經合理 / sun RA ${sun.ra_deg}`);
ok(sun.dec_deg > 10 && sun.dec_deg < 17, `太陽赤緯合理 / sun Dec ${sun.dec_deg}`);
ok(sun.altitude_deg < 0, '台北當地半夜太陽在地平線下 / sun below horizon at local night');

/* 地平座標自洽:高度角在 ±90 內、方位角 0–360 */
for (const b of E.skySnapshot(ms, 25.03, 121.56).bodies) {
  if (!(b.altitude_deg >= -90 && b.altitude_deg <= 90 && b.azimuth_deg >= 0 && b.azimuth_deg < 360)) {
    ok(false, `地平座標超出範圍 / alt-az out of range: ${b.body}`);
  }
}
ok(true, '所有天體地平座標在範圍內 / all alt-az within range');

/* 月相:照亮比例 0–1,且與距角一致 */
const mp = E.moonPhase(ms);
ok(mp.illuminated_fraction >= 0 && mp.illuminated_fraction <= 1, `照亮比例合理 / illum ${mp.illuminated_fraction}`);

/* 水星一年約 3 次逆行、每次 3 週上下 */
const r = E.retrogrades('mercury', 2026).retrograde_periods;
ok(r.length === 3, `水星 2026 逆行三次 / Mercury retrogrades ${r.length}`);
ok(r.every(x => x.days > 15 && x.days < 30), '每次逆行 15–30 天 / each 15–30 days');

/* 星座:23 額外 + 12 黃道 */
ok(E.allConstellations().length === 35, `星座總數 35 / ${E.allConstellations().length} constellations`);
ok(E.findConstellation('獵戶座').en === 'Orion', '中文名可查 / Chinese lookup works');
ok(E.findConstellation('orion').zh === '獵戶座', '英文名可查 / English lookup works');
ok(E.findConstellation('Leo').zodiac === true, '獅子座屬黃道 / Leo is zodiac');

/* 歲差:2026 年比 J2000 前進約 0.36° */
const oc = E.constellationReport('Orion', ms, 25.03, 121.56);
const dRa = oc.centre_ra_deg_of_date - oc.centre_ra_deg_j2000;
ok(dRa > 0.25 && dRa < 0.45, `歲差量合理 / precession ΔRA ${dRa.toFixed(3)}°`);

/* 深連結 */
const url = buildLink({ tour: ['mercury', 'mars'], datetime: '2026-08-16T21:30', language: 'zh', settings: { constChk: true }, fov: 60 });
ok(url.includes('tour=mercury%2Cmars') && url.includes('set=constChk%3A1') && url.includes('fov=60'), '深連結參數齊全 / deep link params');
ok(buildLink({ target: 'Orion' }).includes('target=Orion'), '單一目標用 target / single target');

/* 每個工具都能被呼叫 */
const ARGS = {
  stargzr_open: { target: 'mars' }, stargzr_sky: {}, stargzr_body: { body: 'jupiter' },
  stargzr_moon_phase: {}, stargzr_retrogrades: { planet: 'mars', year: 2026 },
  stargzr_constellation: { name: 'Orion' }, stargzr_list_constellations: {},
};
for (const t of TOOLS) {
  try { const out = HANDLERS[t.name](ARGS[t.name]); ok(out && typeof out === 'object', `工具可用 / tool ${t.name}`); }
  catch (e) { ok(false, `工具失敗 / tool ${t.name}: ${e.message}`); }
}
console.log(fail ? `\n${fail} 項失敗 / failures` : '\n全部通過 / all checks passed');
process.exit(fail ? 1 : 0);
