#!/usr/bin/env node
/* 從 ../celestial-simulator.js 重新產生 core.generated.js。
   只抓「純計算 + 星座資料」那幾段,並把 THREE.Vector3 換成純物件,
   這樣 Node 不需要 three.js 也能跑。網頁改了數值就重跑一次:npm run sync */
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'celestial-simulator.js');
const OUT = path.join(__dirname, 'core.generated.js');
const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\r?\n/);

/* 用「起點標記 → 終點標記(不含)」切段,標記必須是行首,才不會誤抓 */
function slice(startRe, endRe, label) {
  const a = lines.findIndex(l => startRe.test(l));
  if (a < 0) throw new Error(`找不到起點 / start not found: ${label}`);
  const b = lines.findIndex((l, i) => i > a && endRe.test(l));
  if (b < 0) throw new Error(`找不到終點 / end not found: ${label}`);
  return lines.slice(a, b).join('\n').replace(/\s+$/, '');
}
/* 大括號配對切一整個宣告(如 const ZODIAC = { … };),比找空行可靠 */
function block(startRe, label) {
  const a = lines.findIndex(l => startRe.test(l));
  if (a < 0) throw new Error(`找不到宣告 / declaration not found: ${label}`);
  let depth = 0;
  for (let i = a; i < lines.length; i++) {
    for (const ch of lines[i]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth === 0 && i > a) return lines.slice(a, i + 1).join('\n');
  }
  throw new Error(`大括號沒有配對 / unbalanced braces: ${label}`);
}
/* 核心:const DEG … rotEclZ 結束(農曆那段之前都是純數學) */
const core = slice(/^const DEG\s*=/, /^\/\*\s*──\s*農曆|^function sunLonDeg/, 'core');
if (!/function rotEclZ/.test(core)) throw new Error('核心缺少 rotEclZ / core missing rotEclZ');
const zodiac = block(/^const ZODIAC\s*=/, 'ZODIAC');
const extra = block(/^const EXTRA_CONST\s*=/, 'EXTRA_CONST');

/* three.js 去相依:new THREE.Vector3(a,b,c) → ({x:a,y:b,z:c})
   引數本身可能含括號(例如 Math.cos(dec)*Math.cos(ra)),所以自己配對括號,
   不能用正則的 [^)]* —— 那會在第一個內層 ) 就截斷。 */
function noThree(s) {
  const TAG = 'new THREE.Vector3(';
  let out = '', i = 0;
  for (;;) {
    const k = s.indexOf(TAG, i);
    if (k < 0) { out += s.slice(i); break; }
    out += s.slice(i, k);
    let d = 1, j = k + TAG.length;
    const parts = []; let cur = '';
    for (; j < s.length && d > 0; j++) {
      const ch = s[j];
      if (ch === '(') d++;
      else if (ch === ')') { d--; if (d === 0) break; }
      if (d === 1 && ch === ',') { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim() !== '') parts.push(cur);
    const p = parts.map(x => x.trim());
    out += p.length === 3 ? `({x:${p[0]},y:${p[1]},z:${p[2]}})` : '({x:0,y:0,z:0})';
    i = j + 1;
  }
  /* out=out||new THREE.Vector3() 這種預設值改寫後多一層括號,拿掉比較好讀 */
  return out.replace(/out=out\|\|\(\{x:0,y:0,z:0\}\);/g, 'out=out||{x:0,y:0,z:0};');
}

const banner = `/* 由 ../celestial-simulator.js 自動擷取 —— 請勿手改,執行 \`npm run sync\` 重新產生。
   內容:天文引擎核心(克卜勒根數、低精度月球、歲差)與星座資料。 */
'use strict';
`;
const exportLine = `
module.exports={DEG,OBLQ,AU_KM,J2000_MS,centuries,days,julianDay,wrap360,wrap180,
  ELEM,EARTH_IDX,helio,moonGeo,gmstDeg,eclToEq,eqToEclWorld,eclToWorld,eqUnit,
  geoEcl,geoLon,retroRate,PRECESS_DEG_YR,YR_MS,psiDeg,rotEclZ,ZODIAC,EXTRA_CONST};
`;
fs.writeFileSync(OUT, banner + '\n' + noThree(core) + '\n\n' + zodiac + '\n\n' + extra + '\n' + exportLine);

/* 自我驗證:載得起來、資料量合理 */
delete require.cache[require.resolve(OUT)];
const C = require(OUT);
if (C.ELEM.length !== 9) throw new Error('行星數不對 / planet count');
if (Object.keys(C.ZODIAC).length !== 12) throw new Error('黃道十二宮不完整 / zodiac count');
console.log(`core.generated.js 已更新 / regenerated: ${C.ELEM.length} planets, ` +
  `${Object.keys(C.ZODIAC).length} zodiac, ${Object.keys(C.EXTRA_CONST).length} extra constellations`);
