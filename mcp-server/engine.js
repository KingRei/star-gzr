/* 觀星者 StarGZR — 無頭天文引擎
   把 celestial-simulator.js 的計算核心包成 Node 可用的查詢 API。
   核心數值來自 core.generated.js(由主程式自動擷取),所以 MCP 回答的
   數字和你在網頁上看到的完全一致。 */
'use strict';
const C = require('./core.generated.js');
const { DEG, ELEM, EARTH_IDX, centuries, julianDay, wrap360, wrap180,
        helio, moonGeo, gmstDeg, eclToEq, eqUnit, geoEcl, geoLon,
        retroRate, psiDeg, rotEclZ, ZODIAC, EXTRA_CONST } = C;

const PLANET_KEYS = ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto'];

/* ── 時間 ───────────────────────────────────────────────── */
/* 沒帶時區的 ISO 字串一律視為 UTC,避免伺服器所在地影響結果 */
function parseTime(iso) {
  if (iso == null || iso === '' || iso === 'now') return Date.now();
  if (typeof iso === 'number') return iso;
  const s = String(iso).trim();
  const naive = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/.test(s);
  const ms = Date.parse(naive ? s.replace(' ', 'T') + 'Z' : s);
  if (!isFinite(ms)) throw new Error(`無法解析時間 / unparseable time: ${iso}`);
  return ms;
}

/* ── 座標 ───────────────────────────────────────────────── */
function norm(v) {
  const m = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}
function raDec(vEq) {
  const u = norm(vEq);
  return { ra: wrap360(Math.atan2(u.y, u.x) / DEG), dec: Math.asin(Math.max(-1, Math.min(1, u.z))) / DEG };
}
/* J2000 赤道向量 → 指定時刻(含歲差)的赤道向量。
   與網頁一致:繞黃極轉 +psi。 */
function precessEq(vEq, ms) {
  const c = Math.cos(C.OBLQ), s = Math.sin(C.OBLQ);
  const ecl = { x: vEq.x, y: vEq.y * c + vEq.z * s, z: -vEq.y * s + vEq.z * c };
  return eclToEq(rotEclZ(ecl, psiDeg(ms) * DEG));
}
/* 赤道座標 → 地平座標(方位角自北起順時針) */
function altAz(raDeg, decDeg, latDeg, lonDeg, ms) {
  const H = (gmstDeg(ms) + lonDeg - raDeg) * DEG;
  const dec = decDeg * DEG, lat = latDeg * DEG;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(-Math.cos(dec) * Math.sin(H),
                        Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H));
  return { alt: alt / DEG, az: wrap360(az / DEG) };
}
const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function compassOf(azDeg) { return COMPASS[Math.round(wrap360(azDeg) / 22.5) % 16]; }

/* ── 天體位置 ───────────────────────────────────────────── */
function bodyGeoEq(key, ms) {
  const T = centuries(ms);
  const psi = psiDeg(ms) * DEG;
  if (key === 'moon') {
    const m = moonGeo(T);
    return { eq: eclToEq(rotEclZ(m, psi)), distKm: m.distKm, distAU: m.distKm / C.AU_KM };
  }
  const idx = key === 'sun' ? 'sun' : PLANET_KEYS.indexOf(key);
  if (idx === -1) throw new Error(`未知天體 / unknown body: ${key}`);
  const g = geoEcl(idx, T);
  return { eq: eclToEq(rotEclZ(g, psi)), distAU: Math.hypot(g.x, g.y, g.z) };
}
function bodyReport(key, ms, lat, lon) {
  const b = bodyGeoEq(key, ms);
  const rd = raDec(b.eq);
  const aa = altAz(rd.ra, rd.dec, lat, lon, ms);
  const out = {
    body: key,
    ra_deg: +rd.ra.toFixed(4), dec_deg: +rd.dec.toFixed(4),
    altitude_deg: +aa.alt.toFixed(3), azimuth_deg: +aa.az.toFixed(3),
    compass: compassOf(aa.az),
    above_horizon: aa.alt > 0,
    distance_au: b.distAU != null ? +b.distAU.toFixed(6) : undefined,
  };
  if (key === 'moon') out.distance_km = Math.round(b.distKm);
  if (key !== 'sun' && key !== 'moon' && key !== 'earth') {
    const idx = PLANET_KEYS.indexOf(key);
    const rate = retroRate(idx, ms);
    out.motion = rate < 0 ? 'retrograde' : 'prograde';
    out.longitude_rate_deg_per_day = +rate.toFixed(4);
    const T = centuries(ms);
    out.heliocentric_longitude_deg = +wrap360(Math.atan2(helio(idx, T).y, helio(idx, T).x) / DEG).toFixed(3);
    out.geocentric_longitude_deg = +geoLon(idx, T).toFixed(3);
  }
  return out;
}

/* ── 月相 ───────────────────────────────────────────────── */
function moonPhase(ms) {
  const T = centuries(ms);
  const sunLon = wrap360(Math.atan2(geoEcl('sun', T).y, geoEcl('sun', T).x) / DEG);
  const elong = wrap360(moonGeo(T).lon - sunLon);
  const illum = (1 - Math.cos(elong * DEG)) / 2;
  const NAMES = [['新月','New moon'],['眉月','Waxing crescent'],['上弦月','First quarter'],
                 ['盈凸月','Waxing gibbous'],['滿月','Full moon'],['虧凸月','Waning gibbous'],
                 ['下弦月','Last quarter'],['殘月','Waning crescent']];
  const i = Math.round(elong / 45) % 8;
  return {
    elongation_deg: +elong.toFixed(2),
    illuminated_fraction: +illum.toFixed(4),
    phase_zh: NAMES[i][0], phase_en: NAMES[i][1],
    age_days: +(elong / 360 * 29.530588).toFixed(2),
  };
}

/* ── 逆行區間(對分法逼近到分鐘)──────────────────────────── */
function retrogrades(planet, year) {
  const idx = typeof planet === 'number' ? planet : PLANET_KEYS.indexOf(planet);
  if (idx < 0 || idx === EARTH_IDX) throw new Error(`不能查地球或未知行星 / bad planet: ${planet}`);
  const start = Date.UTC(year, 0, 1), end = Date.UTC(year + 1, 0, 1);
  const STEP = 86400000;
  const events = [];
  let prev = retroRate(idx, start) < 0;
  for (let t = start + STEP; t <= end; t += STEP) {
    const now = retroRate(idx, t) < 0;
    if (now !== prev) {
      let lo = t - STEP, hi = t;
      for (let k = 0; k < 22; k++) {
        const mid = (lo + hi) / 2;
        if ((retroRate(idx, mid) < 0) === prev) lo = mid; else hi = mid;
      }
      events.push({ t: hi, entering: now });
      prev = now;
    }
  }
  const spans = [];
  let open = retroRate(idx, start) < 0 ? start : null;
  for (const e of events) {
    if (e.entering) open = e.t;
    else if (open != null) { spans.push([open, e.t]); open = null; }
  }
  if (open != null) spans.push([open, end]);
  return {
    planet: PLANET_KEYS[idx], planet_zh: ELEM[idx].name, year,
    retrograde_periods: spans.map(([a, b]) => ({
      start_utc: new Date(a).toISOString().slice(0, 16) + 'Z',
      end_utc: new Date(b).toISOString().slice(0, 16) + 'Z',
      days: +((b - a) / 86400000).toFixed(1),
    })),
  };
}

/* ── 星座 ───────────────────────────────────────────────── */
function allConstellations() {
  const out = [];
  for (const k in ZODIAC) out.push({ key: k, zh: k, en: ZODIAC[k].en, zodiac: true, data: ZODIAC[k] });
  for (const k in EXTRA_CONST) out.push({ key: k, zh: EXTRA_CONST[k].zh, en: EXTRA_CONST[k].en, zodiac: false, data: EXTRA_CONST[k] });
  return out;
}
function findConstellation(name) {
  const n = String(name).trim().toLowerCase();
  return allConstellations().find(c =>
    c.key.toLowerCase() === n || (c.zh || '').toLowerCase() === n ||
    (c.zh || '').replace('座', '').toLowerCase() === n || (c.en || '').toLowerCase() === n);
}
function constellationReport(name, ms, lat, lon) {
  const c = findConstellation(name);
  if (!c) throw new Error(`找不到星座 / unknown constellation: ${name}`);
  let cx = 0, cy = 0, cz = 0;
  for (const st of c.data.s) {
    const u = eqUnit(st[0] * DEG, st[1] * DEG);
    cx += u.x; cy += u.y; cz += u.z;
  }
  const rdJ2000 = raDec({ x: cx, y: cy, z: cz });
  const rd = raDec(precessEq(norm({ x: cx, y: cy, z: cz }), ms));
  const aa = altAz(rd.ra, rd.dec, lat, lon, ms);
  const mags = c.data.s.map(s => s[2]);
  return {
    key: c.key, zh: c.zh, en: c.en, zodiac: c.zodiac,
    star_count: c.data.s.length, line_count: c.data.l.length,
    brightest_magnitude: Math.min(...mags),
    centre_ra_deg_j2000: +rdJ2000.ra.toFixed(3), centre_dec_deg_j2000: +rdJ2000.dec.toFixed(3),
    centre_ra_deg_of_date: +rd.ra.toFixed(3), centre_dec_deg_of_date: +rd.dec.toFixed(3),
    altitude_deg: +aa.alt.toFixed(2), azimuth_deg: +aa.az.toFixed(2),
    compass: compassOf(aa.az), above_horizon: aa.alt > 0,
  };
}

/* ── 綜合快照 ───────────────────────────────────────────── */
function skySnapshot(ms, lat, lon) {
  const bodies = ['sun', 'moon', ...PLANET_KEYS.filter(k => k !== 'earth')]
    .map(k => bodyReport(k, ms, lat, lon));
  return {
    time_utc: new Date(ms).toISOString().slice(0, 19) + 'Z',
    julian_day: +julianDay(ms).toFixed(5),
    gmst_deg: +gmstDeg(ms).toFixed(4),
    observer: { latitude: lat, longitude: lon },
    moon_phase: moonPhase(ms),
    bodies,
    visible_now: bodies.filter(b => b.above_horizon).map(b => b.body),
  };
}

module.exports = {
  PLANET_KEYS, parseTime, raDec, precessEq, altAz, compassOf,
  bodyGeoEq, bodyReport, moonPhase, retrogrades,
  allConstellations, findConstellation, constellationReport, skySnapshot,
};
