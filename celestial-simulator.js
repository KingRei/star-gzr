/* 觀星者 StarGZR — application (requires three.js r128 loaded first) */
'use strict';
/* ══════════════════════════════════════════════════════════
   1. 天文計算引擎(J2000 近似克卜勒根數 + 低精度月球)
   ══════════════════════════════════════════════════════════ */
const DEG = Math.PI/180;
const OBLQ = 23.4393*DEG;
const AU_KM = 149597870.7;
const J2000_MS = Date.UTC(2000,0,1,12,0,0);

function centuries(ms){ return (ms - J2000_MS)/86400000/36525; }
function days(ms){ return (ms - J2000_MS)/86400000; }
function julianDay(ms){ return ms/86400000 + 2440587.5; }
function wrap360(x){ x%=360; return x<0? x+360 : x; }
function wrap180(x){ x=wrap360(x); return x>180? x-360 : x; }

const ELEM = [
 {name:'水星', en:'Mercury', color:0x9fa4ab, size:0.9,
  e0:[0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593],
  e1:[0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081]},
 {name:'金星', en:'Venus', color:0xe8c66f, size:1.4,
  e0:[0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255],
  e1:[0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418]},
 {name:'地球', en:'Earth', color:0x4f8fe6, size:1.5,
  e0:[1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0.0],
  e1:[0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0.0]},
 {name:'火星', en:'Mars', color:0xe0603c, size:1.1,
  e0:[1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],
  e1:[0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343]},
 {name:'木星', en:'Jupiter', color:0xd8a76a, size:3.2,
  e0:[5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909],
  e1:[-0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106]},
 {name:'土星', en:'Saturn', color:0xe5c98f, size:2.8,
  e0:[9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448],
  e1:[-0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794]},
 {name:'天王星', en:'Uranus', color:0x7fd1e0, size:2.2,
  e0:[19.18916464,0.04725744,0.77263783,313.23810451,170.95427630,74.01692503],
  e1:[-0.00196176,-0.00004397,-0.00242939,428.48202785,0.40805281,0.04240589]},
 {name:'海王星', en:'Neptune', color:0x4f6fe6, size:2.2,
  e0:[30.06992276,0.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],
  e1:[0.00026291,0.00005105,0.00035372,218.45945325,-0.32241464,-0.00508664]},
 {name:'冥王星', en:'Pluto', color:0xb7a08c, size:0.8,
  e0:[39.48211675,0.24882730,17.14001206,238.92903833,224.06891629,110.30393684],
  e1:[-0.00031596,0.00005170,0.00004818,145.20780515,-0.04062942,-0.01183482]}
];
const EARTH_IDX = 2;

function helio(idx, T){
  const p = ELEM[idx];
  const a  = p.e0[0]+p.e1[0]*T,  e  = p.e0[1]+p.e1[1]*T;
  const I  =(p.e0[2]+p.e1[2]*T)*DEG;
  const L  = p.e0[3]+p.e1[3]*T;
  const pe = p.e0[4]+p.e1[4]*T,  Om = p.e0[5]+p.e1[5]*T;
  const w  = (pe-Om)*DEG, O = Om*DEG;
  let M = wrap180(L-pe)*DEG;
  let E = M + e*Math.sin(M);
  for(let k=0;k<8;k++){ E -= (E-e*Math.sin(E)-M)/(1-e*Math.cos(E)); }
  const xp = a*(Math.cos(E)-e), yp = a*Math.sqrt(1-e*e)*Math.sin(E);
  const cw=Math.cos(w),sw=Math.sin(w),cO=Math.cos(O),sO=Math.sin(O),ci=Math.cos(I),si=Math.sin(I);
  return {
    x:(cw*cO - sw*sO*ci)*xp + (-sw*cO - cw*sO*ci)*yp,
    y:(cw*sO + sw*cO*ci)*xp + (-sw*sO + cw*cO*ci)*yp,
    z:(sw*si)*xp + (cw*si)*yp
  };
}
function moonGeo(T){
  const S=x=>Math.sin(wrap360(x)*DEG), C=x=>Math.cos(wrap360(x)*DEG);
  const lam = 218.32 + 481267.881*T
    + 6.29*S(135.0+477198.87*T) - 1.27*S(259.3-413335.36*T)
    + 0.66*S(235.7+890534.22*T) + 0.21*S(269.9+954397.74*T)
    - 0.19*S(357.5+35999.05*T)  - 0.11*S(186.5+966404.03*T);
  const bet = 5.13*S(93.3+483202.02*T) + 0.28*S(228.2+960400.9*T)
    - 0.28*S(318.3+6003.2*T) - 0.17*S(217.6-407332.2*T);
  const par = 0.9508 + 0.0518*C(134.9+477198.85*T) + 0.0095*C(259.2-413335.38*T)
    + 0.0078*C(235.7+890534.23*T) + 0.0028*C(269.9+954397.70*T);
  const distKm = 6378.14/Math.sin(par*DEG);
  const l=wrap360(lam)*DEG, b=bet*DEG, d=distKm/AU_KM;
  return { x:d*Math.cos(b)*Math.cos(l), y:d*Math.cos(b)*Math.sin(l), z:d*Math.sin(b),
           lon:wrap360(lam), distKm };
}
function gmstDeg(ms){
  const d = days(ms), T = d/36525;
  return wrap360(280.46061837 + 360.98564736629*d + 0.000387933*T*T);
}
function eclToEq(v){
  const c=Math.cos(OBLQ), s=Math.sin(OBLQ);
  return {x:v.x, y:v.y*c - v.z*s, z:v.y*s + v.z*c};
}
function eqToEclWorld(v){
  const c=Math.cos(OBLQ), s=Math.sin(OBLQ);
  const ex=v.x, ey=v.y*c+v.z*s, ez=-v.y*s+v.z*c;
  return new THREE.Vector3(ex, ez, -ey);
}
function eclToWorld(v,out){ out=out||new THREE.Vector3(); out.set(v.x, v.z, -v.y); return out; }
function eqUnit(ra,dec){ return new THREE.Vector3(Math.cos(dec)*Math.cos(ra), Math.cos(dec)*Math.sin(ra), Math.sin(dec)); }
function geoEcl(idx, T){
  const e = helio(EARTH_IDX,T);
  if(idx==='sun') return {x:-e.x, y:-e.y, z:-e.z};
  const p = helio(idx,T);
  return {x:p.x-e.x, y:p.y-e.y, z:p.z-e.z};
}
function geoLon(idx,T){ const g=geoEcl(idx,T); return wrap360(Math.atan2(g.y,g.x)/DEG); }
function retroRate(idx,ms){
  return wrap180(geoLon(idx,centuries(ms+43200000))-geoLon(idx,centuries(ms-43200000)));
}
/* 歲差:春分點沿黃道每年退行 50.29″,週期約 25,772 年 */
const PRECESS_DEG_YR = 50.29/3600, YR_MS = 31557600000;
function psiDeg(ms){ return PRECESS_DEG_YR*(ms-J2000_MS)/YR_MS; }
function rotEclZ(g,psiRad){
  const c=Math.cos(psiRad), s=Math.sin(psiRad);
  return {x:g.x*c-g.y*s, y:g.x*s+g.y*c, z:g.z};
}

/* ── 農曆(天文定朔法):月首=朔所在之 UTC+8 民用日;含冬至之月為十一月;
      兩冬至之間有 13 個朔望月時,其後第一個無中氣之月為閏月 ── */
function sunLonDeg(ms){ const g=geoEcl('sun',centuries(ms)); return wrap360(Math.atan2(g.y,g.x)/DEG); }
function moonElongSigned(ms){ return wrap180(moonGeo(centuries(ms)).lon - sunLonDeg(ms)); }
function civilDay(ms){ return Math.floor((ms+28800000)/86400000); } /* UTC+8 */
function civilYear(ms){ return new Date(ms+28800000).getUTCFullYear(); }
function newMoonNear(ms){ /* 最接近 ms(不晚於太多)的朔時刻 */
  const e=wrap360(moonGeo(centuries(ms)).lon - sunLonDeg(ms));
  let t=ms - e/12.19*86400000;
  let a=t-3*86400000, b=t+3*86400000, g=0;
  while(moonElongSigned(a)>0&&g++<5)a-=86400000;
  g=0; while(moonElongSigned(b)<0&&g++<5)b+=86400000;
  for(let k=0;k<42;k++){const m=(a+b)/2;(moonElongSigned(m)<0? a=m : b=m);}
  return (a+b)/2;
}
function solarTermTime(lamDeg, approxMs){ /* 太陽視黃經=lamDeg 的時刻 */
  const f=x=>wrap180(sunLonDeg(x)-lamDeg);
  let a=approxMs-25*86400000, b=approxMs+25*86400000, g=0;
  while(f(a)>0&&g++<4)a-=15*86400000;
  g=0; while(f(b)<0&&g++<4)b+=15*86400000;
  for(let k=0;k<42;k++){const m=(a+b)/2;(f(m)<0? a=m : b=m);}
  return (a+b)/2;
}
function monthStartOnOrBefore(ms){ /* 該民用日所屬農曆月的月首(朔日)時刻 */
  let nm=newMoonNear(ms);
  const nx=newMoonNear(nm+32*86400000);
  return civilDay(nx)<=civilDay(ms)? nx : nm;
}
function chineseDate(ms){
  const Y=civilYear(ms);
  if(Y<1700||Y>2300)return null; /* 超出可靠範圍 */
  const mStart=monthStartOnOrBefore(ms);
  let ws1=solarTermTime(270,Date.UTC(Y-1,11,21)), ws2=solarTermTime(270,Date.UTC(Y,11,21));
  let a=monthStartOnOrBefore(ws1), b=monthStartOnOrBefore(ws2);
  if(civilDay(mStart)<civilDay(a)){
    ws2=ws1; b=a;
    ws1=solarTermTime(270,Date.UTC(Y-2,11,21)); a=monthStartOnOrBefore(ws1);
  }else if(civilDay(mStart)>=civilDay(b)){
    ws1=ws2; a=b;
    ws2=solarTermTime(270,Date.UTC(Y+1,11,21)); b=monthStartOnOrBefore(ws2);
  }
  const starts=[a]; /* 本「歲」的各月首(自十一月起) */
  let t=a;
  for(let i=0;i<14;i++){
    const n=newMoonNear(t+32*86400000);
    if(civilDay(n)>=civilDay(b))break;
    starts.push(n); t=n;
  }
  const L=starts.length; /* 12 或 13 */
  const hasZhong=(t0,t1)=>{ /* 該月(民用日區間)內是否含中氣:
       依官方規則以 UTC+8 民用日歸屬——中氣與次月朔同日時歸次月 */
    const l0=sunLonDeg(t0), span=wrap360(sunLonDeg(t1)-l0);
    const k0=Math.floor(l0/30), k1=Math.floor((l0+span)/30);
    for(let k=k0+1;k<=k1;k++){
      const approx=t0+((k*30-l0)/span)*(t1-t0);
      const tm=solarTermTime(wrap360(k*30),approx);
      if(civilDay(tm)>=civilDay(t0)&&civilDay(tm)<civilDay(t1))return true;
    }
    return false;
  };
  let leapIdx=-1;
  if(L===13){
    for(let i=1;i<L;i++){
      const t1=(i+1<L)? starts[i+1] : b;
      if(!hasZhong(starts[i],t1)){ leapIdx=i; break; }
    }
  }
  let idx=0;
  for(let i=0;i<L;i++){ if(civilDay(starts[i])<=civilDay(ms)) idx=i; }
  let num=11, isLeap=false;
  for(let i=1;i<=idx;i++){
    if(i===leapIdx){ isLeap=true; }
    else{ num=num%12+1; isLeap=false; }
  }
  const day=civilDay(ms)-civilDay(starts[idx])+1;
  const lunarYear=(num>=11)? civilYear(ws1) : civilYear(ws1)+1;
  return {y:lunarYear, m:num, d:day, leap:isLeap};
}
const GAN='甲乙丙丁戊己庚辛壬癸', ZHI='子丑寅卯辰巳午未申酉戌亥';
const GAN_EN=['Jia','Yi','Bing','Ding','Wu','Ji','Geng','Xin','Ren','Gui'];
const ZHI_EN=['Zi','Chou','Yin','Mao','Chen','Si','Wu','Wei','Shen','You','Xu','Hai'];
const CMON=['正','二','三','四','五','六','七','八','九','十','冬','臘'];
const CNUM=['','一','二','三','四','五','六','七','八','九','十'];
function cDayName(d){
  if(d<=10)return '初'+CNUM[d];
  if(d<20)return '十'+CNUM[d-10];
  if(d===20)return '二十';
  if(d<30)return '廿'+CNUM[d-20];
  return '三十';
}
function formatLunar(ms,langK){
  const cd=chineseDate(ms);
  if(!cd)return '—';
  const st=(cd.y-4)%10, br=(cd.y-4)%12;
  const s10=(st+10)%10, b12=(br+12)%12;
  if(langK==='zh')
    return '農曆'+GAN[s10]+ZHI[b12]+'年'+(cd.leap?'閏':'')+CMON[cd.m-1]+'月'+cDayName(cd.d);
  return 'Lunar '+GAN_EN[s10]+'-'+ZHI_EN[b12]+' · '+(cd.leap?'Leap ':'')+'M'+cd.m+' D'+cd.d;
}

/* ══════════════════════════════════════════════════════════
   2. 黃道十二星座:主星 J2000 座標 [RA°, Dec°, 星等] 與連線
   ══════════════════════════════════════════════════════════ */
const ZODIAC = {
 '牡羊座':{en:'Aries',s:[[31.79,23.46,2.0],[28.66,20.81,2.6],[28.38,19.29,3.9],[42.50,27.26,3.6]],
   l:[[2,1],[1,0],[0,3]]},
 '金牛座':{en:'Taurus',s:[[68.98,16.51,0.9],[81.57,28.61,1.7],[64.95,15.63,3.6],[65.73,17.54,3.8],[67.15,19.18,3.5],[67.17,15.87,3.4],[84.41,21.14,3.0],[60.17,12.49,3.4]],
   l:[[7,2],[2,3],[3,4],[4,1],[2,5],[5,0],[0,6]]},
 '雙子座':{en:'Gemini',s:[[113.65,31.89,1.6],[116.33,28.03,1.1],[99.43,16.40,1.9],[100.98,25.13,3.0],[95.74,22.51,2.9],[110.03,21.98,3.5]],
   l:[[0,3],[3,4],[1,5],[5,2],[0,1]]},
 '巨蟹座':{en:'Cancer',s:[[124.13,9.19,3.5],[131.17,18.15,3.9],[130.82,21.47,4.7],[134.62,11.86,4.3],[131.67,28.76,4.0]],
   l:[[4,2],[2,1],[1,0],[1,3]]},
 '獅子座':{en:'Leo',s:[[152.09,11.97,1.4],[177.26,14.57,2.1],[154.99,19.84,2.0],[168.53,20.52,2.6],[146.46,23.77,3.0],[154.17,23.42,3.4],[151.83,16.76,3.5],[168.56,15.43,3.3],[148.19,26.01,3.9]],
   l:[[0,6],[6,2],[2,5],[5,8],[8,4],[2,3],[3,1],[1,7],[7,0],[7,3]]},
 '處女座':{en:'Virgo',s:[[201.30,-11.16,1.0],[190.42,-1.45,2.7],[195.54,10.96,2.8],[193.90,3.40,3.4],[177.67,1.76,3.6],[184.98,-0.67,3.9],[197.49,-5.54,4.4],[203.67,-0.60,3.4]],
   l:[[4,5],[5,1],[1,3],[3,2],[1,6],[6,0],[0,7],[7,3]]},
 '天秤座':{en:'Libra',s:[[222.72,-16.04,2.8],[229.25,-9.38,2.6],[233.88,-14.79,3.9],[226.02,-25.28,3.3]],
   l:[[3,0],[0,1],[1,2],[2,0]]},
 '天蠍座':{en:'Scorpius',s:[[247.35,-26.43,1.1],[241.36,-19.81,2.6],[240.08,-22.62,2.3],[239.71,-26.11,2.9],[245.30,-25.59,2.9],[248.97,-28.22,2.8],[252.54,-34.29,2.3],[253.08,-38.05,3.0],[253.50,-42.36,3.6],[258.04,-43.24,3.3],[264.33,-43.00,1.9],[266.90,-40.13,3.0],[265.62,-39.03,2.4],[263.40,-37.10,1.6],[262.69,-37.30,2.7]],
   l:[[1,2],[3,2],[2,4],[4,0],[0,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14]]},
 '射手座':{en:'Sagittarius',s:[[276.04,-34.38,1.85],[275.25,-29.83,2.7],[276.99,-25.42,2.8],[281.41,-26.99,3.2],[283.82,-26.30,2.05],[286.17,-27.67,3.3],[285.65,-29.88,2.6],[271.45,-30.42,3.0]],
   l:[[7,1],[7,0],[1,3],[3,6],[6,0],[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]]},
 '摩羯座':{en:'Capricornus',s:[[304.51,-12.54,3.6],[305.25,-14.78,3.1],[311.52,-25.27,4.1],[312.96,-26.92,4.1],[321.67,-22.41,3.7],[326.76,-16.13,2.9],[325.02,-16.66,3.7],[316.49,-17.23,4.1]],
   l:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]]},
 '水瓶座':{en:'Aquarius',s:[[331.45,-0.32,2.9],[322.89,-5.57,2.9],[335.41,-1.39,3.8],[337.21,-0.02,3.65],[338.84,-0.12,4.0],[311.92,-9.50,3.8],[334.21,-7.78,4.2],[343.15,-7.58,3.7],[342.40,-13.59,4.0],[343.66,-15.82,3.3]],
   l:[[5,1],[1,0],[0,2],[2,3],[3,4],[0,6],[6,7],[7,8],[8,9]]},
 '雙魚座':{en:'Pisces',s:[[349.29,3.28,3.7],[351.99,6.38,4.3],[354.99,5.63,4.1],[355.51,1.78,4.5],[351.73,1.26,4.9],[359.83,6.86,4.0],[12.17,7.58,4.4],[18.44,7.89,4.3],[25.36,5.49,4.4],[30.51,2.76,3.8],[26.35,9.16,4.3],[22.87,15.35,3.6],[18.29,24.58,4.7],[17.34,30.09,4.5],[19.87,27.26,4.8]],
   l:[[0,1],[1,2],[2,3],[3,4],[4,0],[2,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,14],[14,13]]}
};

/* ══════════════════════════════════════════════════════════
   3. 語系、標籤系統、拖曳/縮放控制
   ══════════════════════════════════════════════════════════ */
let lang='zh';
function T(zh,en){ return lang==='zh'? zh : en; }
function pname(i){ return lang==='zh'? ELEM[i].name : ELEM[i].en; }

const labelsL=[], labelsR=[]; /* {sp, base} 供螢幕等大縮放 */
const labelReg=[];            /* {sp,getText,color,h,bold,base} 供語系切換重繪 */
function paintLabel(text,colorHex,bold){
  const c=document.createElement('canvas'), ctx=c.getContext('2d');
  const px=48, font=(bold?'700 ':'500 ')+px+'px "PingFang TC","Microsoft JhengHei",sans-serif';
  ctx.font=font;
  c.width=Math.ceil(ctx.measureText(text).width)+18; c.height=px+18;
  ctx.font=font; ctx.textBaseline='middle';
  ctx.shadowColor='rgba(0,0,0,.85)'; ctx.shadowBlur=7;
  ctx.fillStyle=colorHex; ctx.fillText(text,9,c.height/2+2);
  const tex=new THREE.CanvasTexture(c); tex.minFilter=THREE.LinearFilter;
  return {tex, w:c.width, h:c.height};
}
function mkLbl(group,getText,colorHex,worldH,bold){
  const p=paintLabel(getText(),colorHex,bold);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:p.tex,transparent:true,depthWrite:false,depthTest:false}));
  sp.scale.set(worldH*p.w/p.h, worldH, 1);
  sp.renderOrder=10;
  const rec={sp,getText,color:colorHex,h:worldH,bold,base:sp.scale.clone()};
  labelReg.push(rec);
  if(group==='L')labelsL.push(rec);
  else if(group==='R')labelsR.push(rec);
  return sp;
}
function relabelAll(){
  for(const r of labelReg){
    const p=paintLabel(r.getText(),r.color,r.bold);
    const old=r.sp.material.map;
    r.sp.material.map=p.tex; r.sp.material.needsUpdate=true;
    if(old)old.dispose();
    r.base.set(r.h*p.w/p.h, r.h, 1);
    r.sp.scale.copy(r.base);
  }
}
function glowTexture(rgb, ring){
  /* 手工 DataTexture:全圖恆定色相、僅 alpha 變化。行動 GPU 的
     canvas 預乘 alpha 與取樣內插不一致,是「太陽周圍綠點」的元兇;
     恆定 RGB 讓任何內插誤差都只能是同色系,不可能偏綠。 */
  const N=64, data=new Uint8Array(N*N*4);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const dx=(x+0.5)/N*2-1, dy=(y+0.5)/N*2-1;
    const r=Math.min(1,Math.hypot(dx,dy));
    const a=ring? Math.exp(-Math.pow((r-0.58)/0.14,2)) : Math.pow(1-r,2.4)*1.5;
    const i=(y*N+x)*4;
    data[i]=rgb[0]; data[i+1]=rgb[1]; data[i+2]=rgb[2];
    data[i+3]=Math.round(255*Math.min(1,Math.max(0,a)));
  }
  const tex=new THREE.DataTexture(data,N,N,THREE.RGBAFormat);
  tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter; tex.needsUpdate=true;
  return tex;
}
function makeGlow(colorInner, colorOuter, worldSize){
  const m=colorOuter.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  const rgb=m? [+m[1],+m[2],+m[3]] : [255,220,160];
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(rgb,false),
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  sp.scale.set(worldSize,worldSize,1);
  return sp;
}
function regGlowL(sp){ labelsL.push({sp,base:sp.scale.clone()}); return sp; }
function regGlowR(sp){ labelsR.push({sp,base:sp.scale.clone()}); return sp; }

let invDrag=true, trackMode='off', lockMode='none'; /* 黃道軸置中預設關閉 */
let trackOffset=30*DEG; /* 黃道軸置中時沿黃道往上看的角度(可拖曳調整) */
function attachPinch(el, onPinch, onDrag){
  const pts=new Map(); let lastDist=0;
  el.addEventListener('pointerdown',e=>{
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    el.setPointerCapture(e.pointerId);
    if(pts.size===2){const a=[...pts.values()];lastDist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
  });
  el.addEventListener('pointermove',e=>{
    if(!pts.has(e.pointerId))return;
    const prev=pts.get(e.pointerId);
    const dx=e.clientX-prev.x, dy=e.clientY-prev.y;
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===2){
      const a=[...pts.values()];
      const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      if(lastDist>0){
        const f=d/lastDist;
        /* 死區 + 阻尼:過濾觸控微顫,避免鎖定模式下畫面忽大忽小 */
        if(Math.abs(f-1)>0.004) onPinch(Math.pow(f,0.85),(a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2);
      }
      lastDist=d;
    }else if(pts.size===1){
      onDrag(dx,dy);
    }
  });
  const up=e=>{pts.delete(e.pointerId); lastDist=0;};
  el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up);
}
class OrbitDrag{
  constructor(el,cam,target,r){
    this.cam=cam; this.target=target;
    this.theta=0.55; this.phi=1.05; this.r=r;
    this.min=r*0.06; this.max=r*2.2;
    this.el=el;
    attachPinch(el,
      (f,mx,my)=>{ this.zoomTo(this.r/f, mx, my); },
      (dx,dy)=>{
        this.theta-=dx*0.006; this.phi-=dy*0.006;
        this.phi=Math.max(0.05,Math.min(Math.PI-0.05,this.phi)); this.apply();
      });
    el.addEventListener('wheel',e=>{e.preventDefault();
      this.zoomTo(this.r*(1+e.deltaY*0.001), e.clientX, e.clientY);
    },{passive:false});
    this.apply();
  }
  /* 錨定縮放:放大時朝指定螢幕點(滑鼠游標或雙指中點)靠攏,
     縮小時漸進回歸原點,拉到最遠固定以太陽為中心。滑鼠與觸控共用同一套。 */
  zoomTo(newR, clientX, clientY){
    const r0=this.r;
    this.r=Math.max(this.min,Math.min(this.max,newR));
    if(this.r<r0 && clientX!=null && this.el){
      const rect=this.el.getBoundingClientRect();
      const nx=((clientX-rect.left)/rect.width)*2-1;
      const ny=-((clientY-rect.top)/rect.height)*2+1;
      const dir=new THREE.Vector3(nx,ny,0.5).unproject(this.cam).sub(this.cam.position).normalize();
      const fwd=new THREE.Vector3().subVectors(this.target,this.cam.position).normalize();
      const denom=dir.dot(fwd);
      if(denom>1e-6){
        const t=new THREE.Vector3().subVectors(this.target,this.cam.position).dot(fwd)/denom;
        const P=new THREE.Vector3().copy(this.cam.position).addScaledVector(dir,t);
        this.target.lerp(P,1-this.r/r0);
      }
    }else if(this.r>r0){
      const w=Math.max(0,(this.r/this.max-0.45))*0.5;
      if(w>0)this.target.lerp(new THREE.Vector3(0,0,0),Math.min(0.6,w));
      if(this.r>=this.max*0.97)this.target.set(0,0,0);
    }
    this.apply();
  }
  move(f,rgt,dt,boost){ /* 自由飛行:沿視線前後、左右平移(樞紐點跟著移動,
       縮放不再以太陽為中心);步幅與當前距離成正比,任何尺度皆順手 */
    const fwd=new THREE.Vector3().subVectors(this.target,this.cam.position).normalize();
    const rv=new THREE.Vector3().crossVectors(fwd,new THREE.Vector3(0,1,0)).normalize();
    const step=this.r*0.22*dt*(boost||1); /* 步幅收斂:精細易控,長按仍可加速(前進放慢) */
    this.target.addScaledVector(fwd,f*step).addScaledVector(rv,rgt*step);
    this.apply();
  }
  apply(){
    const s=Math.sin(this.phi);
    this.cam.position.set(
      this.target.x + this.r*s*Math.sin(this.theta),
      this.target.y + this.r*Math.cos(this.phi),
      this.target.z + this.r*s*Math.cos(this.theta));
    this.cam.lookAt(this.target);
  }
}
class LookDrag{
  constructor(el,cam,baseFov){
    this.cam=cam; this.baseFov=baseFov;
    this.yaw=Math.PI; this.pitch=0.42;
    attachPinch(el,
      f=>{ this.setFov(this.cam.fov/f); },
      (dx,dy)=>{
        if(lockMode!=='none')return; /* 鎖定天體時視線交由追蹤 */
        if(trackMode!=='off'){ /* 黃道軸置中:垂直拖曳沿黃道調整仰角 */
          const sg=invDrag? -1 : 1;
          trackOffset=Math.max(-0.26,Math.min(1.48,trackOffset+sg*dy*0.0032));
          return;
        }
        if(typeof compassOn!=='undefined'&&compassOn){ setCompass(false); return; }
        const sg=invDrag? -1 : 1;
        this.yaw+=sg*dx*0.0032; this.pitch+=sg*dy*0.0032;
        this.pitch=Math.max(-0.45,Math.min(1.52,this.pitch)); this.apply();
      });
    el.addEventListener('wheel',e=>{e.preventDefault();
      this.setFov(this.cam.fov+e.deltaY*0.05);
    },{passive:false});
    this.apply();
  }
  setFov(f){
    /* 18° = 4.0×;162.2° ≈ 0.10×(超廣角) */
    this.cam.fov=Math.max(18,Math.min(162.2,f));
    this.cam.updateProjectionMatrix();
  }
  get zoom(){ return Math.tan(this.baseFov/2*DEG)/Math.tan(this.cam.fov/2*DEG); }
  syncFromCamera(){ /* 離開追蹤模式時同步視線 */
    const d=new THREE.Vector3(); this.cam.getWorldDirection(d);
    this.pitch=Math.asin(Math.max(-1,Math.min(1,d.y)));
    this.yaw=Math.atan2(d.x,-d.z);
    this.apply();
  }
  apply(){
    const cp=Math.cos(this.pitch);
    this.cam.lookAt(
      this.cam.position.x + cp*Math.sin(this.yaw),
      this.cam.position.y + Math.sin(this.pitch),
      this.cam.position.z - cp*Math.cos(this.yaw));
  }
}
/* 星座連線註冊表:同名跨兩窗;導覽到該星座時把連線點亮 */
const CONST_LINES={};
function highlightConst(nm){
  for(const k in CONST_LINES){ const on=(k===nm);
    CONST_LINES[k].forEach(e=>{ e.mat.color.setHex(on?0xFFE08A:0x6a7db3); e.mat.opacity=on?1:0.5; }); }
}
function clearConstHighlight(){ highlightConst(null); }
/* 星點貼圖:PointsMaterial 預設是方塊,貼一張圓形 alpha 圖才會是圓點(只做一次) */
let _starDiscTex=null;
function starDisc(){
  if(_starDiscTex)return _starDiscTex;
  const N=64, cv=document.createElement('canvas'); cv.width=cv.height=N;
  const x=cv.getContext('2d');
  const g=x.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(0.55,'rgba(255,255,255,1)');
  g.addColorStop(0.78,'rgba(255,255,255,0.72)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.beginPath(); x.arc(N/2,N/2,N/2,0,Math.PI*2); x.fill();
  _starDiscTex=new THREE.CanvasTexture(cv);
  return _starDiscTex;
}
function buildConstellations(parent, radius, toVec, labelH, group, ptScale, stripGlyph, dataset){
  const DATA=dataset||ZODIAC;
  const buckets=[[],[],[],[]];
  for(const name in DATA){
    const c=DATA[name];
    const vs=c.s.map(st=>toVec(eqUnit(st[0]*DEG,st[1]*DEG)).multiplyScalar(radius));
    c.s.forEach((st,i)=>{
      const m=st[2];
      const b=m<2?0:m<3?1:m<4?2:3;
      buckets[b].push(vs[i].x,vs[i].y,vs[i].z);
    });
    if(c.l&&c.l.length){
      const cpts=[]; c.l.forEach(pair=>cpts.push(vs[pair[0]],vs[pair[1]]));
      const cmat=new THREE.LineBasicMaterial({color:0x6a7db3,transparent:true,opacity:0.5});
      parent.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cpts),cmat));
      (CONST_LINES[name]=CONST_LINES[name]||[]).push({mat:cmat});
    }
    const cen=new THREE.Vector3();
    vs.forEach(v=>cen.add(v));
    cen.normalize().multiplyScalar(radius);
    const getText=c.zh
      ? ()=>T(c.zh, c.en)
      : ()=>T(name, c.en);
    const lbl=mkLbl(group,getText,'#E3B34C',labelH,false);
    lbl.position.copy(cen); parent.add(lbl);
  }
  const sizes=[4.6,3.4,2.5,1.8].map(s=>s*ptScale);
  buckets.forEach((arr,i)=>{
    if(!arr.length)return;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
    parent.add(new THREE.Points(g,new THREE.PointsMaterial({
      color:0xdbe4ff,size:sizes[i],sizeAttenuation:false,transparent:true,opacity:i<2?1:0.85,
      map:starDisc(),alphaTest:0.35,depthWrite:false})));
  });
}

/* ══════════════════════════════════════════════════════════
   4. 左視窗:日心太陽系
   ══════════════════════════════════════════════════════════ */
const paneL=document.getElementById('paneL');
const rendL=new THREE.WebGLRenderer({antialias:true});
rendL.setPixelRatio(Math.min(devicePixelRatio,2));
paneL.appendChild(rendL.domElement);
const sceneL=new THREE.Scene(); sceneL.background=new THREE.Color(0x070A16);
const camL=new THREE.PerspectiveCamera(45,1,0.1,90000);
const CAM_REF=360;
const ctrlL=new OrbitDrag(rendL.domElement,camL,new THREE.Vector3(0,0,0),CAM_REF);

sceneL.add(new THREE.AmbientLight(0xffffff,0.55));
const sunLight=new THREE.PointLight(0xfff2cc,1.4,0,2); sceneL.add(sunLight);

const SCALE=30, POW=0.42, K_TRUE=323; /* 正確比例:1 AU = 323 顯示單位(尺寸與距離同尺度) */
let trueScale=false;
function mapR(vEclWorld){ /* 顯示用距離映射:壓縮(易讀)或線性(正確比例) */
  const r=vEclWorld.length(); if(r<1e-9)return vEclWorld;
  const rd=trueScale? K_TRUE*r : SCALE*Math.pow(r,POW);
  return vEclWorld.multiplyScalar(rd/r);
}
const SPHERE_R=170;
let sphereScale=1;
/* 真實半徑(km)。正確比例模式為完全單一尺度:太陽 1.50、木星 0.151、
   地球 0.0138、月距 0.83——次像素天體以標記點呈現,可縮放深潛驗證 */
const TRUE_KM=[2440,6052,6371,3390,69911,58232,25362,24622,1188];

const sunMesh=new THREE.Mesh(new THREE.SphereGeometry(5,32,24),
  new THREE.MeshBasicMaterial({color:0xffd75e}));
sceneL.add(sunMesh);
const sunGlow=makeGlow('rgba(255,236,160,1)','rgba(255,180,60,.45)',34);
sunMesh.add(sunGlow);
/* 正確比例時的太陽核心視覺錨點(半透明巨殼中央) */
const sunCore=new THREE.Mesh(new THREE.SphereGeometry(0.8,20,14),
  new THREE.MeshBasicMaterial({color:0xffe9a0}));
sunCore.visible=false; sceneL.add(sunCore);
const sunLbl=mkLbl('L',()=>T('太陽','Sun'),'#ffd75e',7,true); sunLbl.position.set(0,6.5,0); sunMesh.add(sunLbl);
/* 正確比例:行星與月球的位置標記點(真實尺寸多為次像素) */
const markerPts=(()=>{
  const n=ELEM.length+1;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(n*3),3));
  const cols=[];
  for(const p of ELEM){const c=new THREE.Color(p.color);cols.push(c.r,c.g,c.b);}
  cols.push(0.85,0.87,0.92);
  g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  const pts=new THREE.Points(g,new THREE.PointsMaterial({size:5,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:0.95,depthWrite:false}));
  pts.visible=false; sceneL.add(pts);
  return pts;
})();

const planetMeshes=[], orbitGroup=new THREE.Group(); sceneL.add(orbitGroup);
for(let i=0;i<ELEM.length;i++){
  const p=ELEM[i];
  const m=new THREE.Mesh(new THREE.SphereGeometry(p.size,24,18),
    new THREE.MeshStandardMaterial({color:p.color,roughness:0.7,metalness:0.05}));
  const lbl=mkLbl('L',()=>pname(i),'#'+p.color.toString(16).padStart(6,'0'),6,i===EARTH_IDX);
  lbl.position.set(0,p.size+4.5,0); m.add(lbl);
  /* 環系(多環帶擬真;半徑單位=行星半徑倍數,傾角=各行星赤道面):
     木星=暈環+主環(稀薄);土星=C/B 環、卡西尼縫、A/F 環;
     天王星=數道窄環與最亮的 ε 環(近垂直);海王星=Galle/LeVerrier/Adams */
  const RING_BANDS={
   4:[[1.55,1.70,0x9a8f7c,0.10],[1.72,1.81,0xb8a98c,0.22]],
   5:[[1.24,1.52,0x8a7a5e,0.22],[1.53,1.94,0xd8c294,0.85],[2.03,2.26,0xcdb684,0.55],[2.30,2.34,0xb59f6e,0.28]],
   6:[[1.60,1.63,0x9fc4ce,0.30],[1.72,1.74,0x9fc4ce,0.32],[1.86,1.88,0xa8ccd6,0.35],[1.99,2.05,0xc2e2ea,0.60]],
   7:[[1.68,1.78,0x77879c,0.10],[2.14,2.17,0x8ea6cc,0.20],[2.50,2.55,0x9db4d8,0.30]]
  };
  const RING_TILT={4:0.05,5:0.466,6:1.707,7:0.494};
  if(RING_BANDS[i]){
    const rg=new THREE.Group(); rg.rotation.x=Math.PI/2-RING_TILT[i];
    for(const [ri,ro,col,op] of RING_BANDS[i]){
      rg.add(new THREE.Mesh(new THREE.RingGeometry(p.size*ri,p.size*ro,64),
        new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide,transparent:true,opacity:op,depthWrite:false})));
    }
    m.add(rg);
  }
  sceneL.add(m); planetMeshes.push(m);
}
function buildOrbits(){
  while(orbitGroup.children.length){
    const o=orbitGroup.children.pop(); o.geometry.dispose();
  }
  const Tn=centuries(Date.now());
  for(let i=0;i<ELEM.length;i++){
    const pts=[], a=ELEM[i].e0[0], per=Math.pow(a,1.5)*365.25;
    for(let k=0;k<=180;k++){
      const Tk=Tn + (k/180)*per/36525;
      pts.push(mapR(eclToWorld(helio(i,Tk))));
    }
    const g=new THREE.BufferGeometry().setFromPoints(pts);
    orbitGroup.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:ELEM[i].color,transparent:true,opacity:0.32})));
  }
}
buildOrbits();
function applyScaleMode(){
  /* 正確比例=完全單一線性尺度:km × (K_TRUE/AU_KM) → 顯示單位。
     太陽、行星、月球、軌道、月距、影錐全部同尺度,無任何截幅或誇大。 */
  const kSize=K_TRUE/AU_KM;
  let earthF=1, moonF=1;
  for(let i=0;i<ELEM.length;i++){
    const f=trueScale? (TRUE_KM[i]*kSize)/ELEM[i].size : 1;
    planetMeshes[i].scale.setScalar(f);
    if(i===EARTH_IDX)earthF=f;
  }
  sunMesh.scale.setScalar(trueScale? (696000*kSize)/5 : 1); /* 真實比例太陽半徑 1.50 */
  moonF=trueScale? (1737.4*kSize)/0.55 : 1;
  moonMesh.scale.setScalar(moonF);
  moonVisR=trueScale? 384400*kSize : 3.1;   /* 真實月距 0.83(60.3 地球半徑,絕不及金星) */
  /* 影錐:真實幾何長度(地影 ~138 萬 km、月影 ~37.4 萬 km 恰達地球) */
  const uLen=trueScale? (1380000*kSize)/UMBRA_LEN : 1;
  umbraCone.scale.set(earthF,uLen,earthF);
  umbraHalf=UMBRA_LEN*uLen/2;
  const mLen=trueScale? (374000*kSize)/3.6 : 1;
  mShadowCone.scale.set(moonF,mLen,moonF);
  mShadHalf=3.6*mLen/2;
  tidalGroup.scale.setScalar(trueScale? 0.15 : 1);
  /* 天球與宮位帶外推到冥王星軌道之外 */
  sphereScale=trueScale? 110 : 1;
  sphereGroup.scale.setScalar(sphereScale);
  signBelt.scale.setScalar(sphereScale);
  markerPts.visible=trueScale;
  /* 相機:兩種模式各自的縮放範圍與視角狀態,互不影響;
     非正確比例永遠以太陽(原點)為中心 */
  if(trueScale){ ctrlL.min=0.002; ctrlL.max=45000; }
  else{ ctrlL.min=CAM_REF*0.06; ctrlL.max=CAM_REF*2.2; camStateN.tx=0;camStateN.ty=0;camStateN.tz=0; }
  loadCam(trueScale? camStateT : camStateN);
  document.getElementById('flyDock').style.display=trueScale?'flex':'none';
  observeIdx='none';
  document.getElementById('obsSel').value='none';
  buildOrbits();
}

/* 主要衛星:伽利略四衛(木)、泰坦與瑞亞(土)、崔頓(海,逆行)。
   軌道半徑經壓縮以利辨識(實際為 6~26 個行星半徑),週期與方向真實。 */
const SAT_DEFS={
 4:[[1.9,1.769,0xE8D08A,0.20],[2.4,3.551,0xF0EDE6,0.17],[3.0,7.155,0xBDB6A8,0.26],[3.9,16.689,0x8F8578,0.24]],
 5:[[3.4,15.945,0xE0B36A,0.26,'Titan'],[2.4,4.518,0xCFCFD6,0.15]],
 6:[[2.3,2.520,0xC8D2DA,0.14],[2.9,8.706,0xD8DEE6,0.18],[3.5,13.463,0xB9C2CE,0.17]],
 7:[[2.6,-5.877,0xBFE0E8,0.22]]
};
const SAT_TILT={4:0.05,5:0.466,6:1.707,7:0.494};
const satMoons=[];
for(const pi in SAT_DEFS){
  const i=+pi, host=planetMeshes[i], base=ELEM[i].size;
  const grp=new THREE.Group();
  grp.rotation.x=Math.PI/2-SAT_TILT[i]; /* 與環同面(行星赤道面) */
  host.add(grp);
  for(const [rr,per,col,sz,named] of SAT_DEFS[i]){
    const R=base*rr;
    const m=new THREE.Mesh(new THREE.SphereGeometry(sz,10,8),
      new THREE.MeshStandardMaterial({color:col,roughness:0.8}));
    grp.add(m);
    if(named){ /* 泰坦文字標記 */
      const tl=mkLbl('L',()=>T('泰坦','Titan'),'#E0B36A',3.0,false);
      tl.position.set(0,sz+0.5,0); m.add(tl);
    }
    const op=[]; for(let k=0;k<=48;k++){const a=k/48*2*Math.PI;op.push(new THREE.Vector3(Math.cos(a)*R,Math.sin(a)*R,0));}
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(op),
      new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.22})));
    satMoons.push({mesh:m,R,per});
  }
}
const earthMesh=planetMeshes[EARTH_IDX];
const earthSpin=new THREE.Group();
earthMesh.add(earthSpin);
/* 地球貼圖(程序化簡圖:海洋、陸塊、冰帽、雲),隨 GMST 自轉 */
function makeEarthTexture(){
  const W=512,H=256,c=document.createElement('canvas');c.width=W;c.height=H;
  const ctx=c.getContext('2d');
  const X=lon=>(lon+180)/360*W, Y=lat=>(90-lat)/180*H;
  const og=ctx.createLinearGradient(0,0,0,H);
  og.addColorStop(0,'#25507f');og.addColorStop(.5,'#2c66a6');og.addColorStop(1,'#25507f');
  ctx.fillStyle=og;ctx.fillRect(0,0,W,H);
  function land(pts,fill){
    ctx.beginPath();
    pts.forEach((p,i)=>{const px=X(p[0]),py=Y(p[1]);i?ctx.lineTo(px,py):ctx.moveTo(px,py);});
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    ctx.strokeStyle='rgba(15,35,25,.4)';ctx.lineWidth=1.2;ctx.stroke();
  }
  const G='#4d7f44';
  /* 非洲+阿拉伯 */
  land([[-17,15],[0,32],[10,37],[32,31],[35,28],[44,12],[51,12],[59,23],[48,30],[35,36],[43,11],[51,-1],[40,-16],[35,-24],[19,-35],[12,-18],[9,4],[-8,4],[-17,15]],G);
  /* 歐亞 */
  land([[-10,36],[3,43],[10,44],[25,40],[27,41],[41,41],[50,45],[60,55],[90,50],[100,40],[105,22],[109,12],[104,8],[100,14],[98,25],[92,22],[88,22],[78,8],[72,20],[68,24],[60,25],[57,38],[48,42],[36,45],[28,45],[13,46],[3,47],[-9,43],[-10,36]],G);
  land([[-5,50],[10,55],[30,60],[60,68],[100,72],[140,72],[170,66],[178,64],[160,60],[135,55],[128,42],[122,38],[121,30],[110,20],[105,22],[100,40],[90,50],[60,55],[50,45],[41,41],[27,54],[10,54],[-5,50]],G);
  /* 北美 */
  land([[-168,66],[-150,70],[-130,70],[-110,72],[-90,72],[-75,72],[-60,60],[-65,45],[-70,42],[-75,35],[-81,25],[-90,29],[-97,26],[-97,16],[-85,12],[-80,8],[-92,15],[-105,20],[-114,30],[-124,40],[-125,48],[-140,60],[-155,58],[-168,66]],G);
  /* 南美 */
  land([[-80,8],[-70,12],[-62,10],[-52,4],[-42,-4],[-38,-12],[-40,-22],[-50,-28],[-58,-35],[-62,-40],[-66,-48],[-70,-54],[-73,-46],[-72,-32],[-70,-18],[-77,-8],[-80,8]],G);
  /* 澳洲 */
  land([[114,-22],[122,-14],[131,-11],[137,-12],[142,-11],[146,-15],[151,-25],[150,-33],[146,-39],[140,-38],[131,-32],[124,-33],[115,-33],[113,-26],[114,-22]],G);
  /* 格陵蘭 */
  land([[-55,60],[-45,60],[-32,68],[-20,70],[-22,76],[-32,80],[-55,78],[-60,72],[-55,60]],'#dbe3ea');
  /* 冰帽 */
  ctx.fillStyle='#dde7ee';
  ctx.fillRect(0,0,W,Y(80));
  ctx.fillRect(0,Y(-70),W,H-Y(-70));
  /* 雲 */
  ctx.fillStyle='rgba(255,255,255,.12)';
  for(let i=0;i<44;i++){
    const cx=(i*137.5)%W, cy=H*0.15+((i*89.3)%(H*0.7)), r=6+(i*7)%16;
    ctx.beginPath();ctx.ellipse(cx,cy,r*2.2,r*0.65,0,0,2*Math.PI);ctx.fill();
  }
  const tex=new THREE.CanvasTexture(c);
  return tex;
}
earthMesh.material.visible=false; /* 以貼圖球取代素色球 */
const earthGlobe=new THREE.Mesh(new THREE.SphereGeometry(1.5,48,32),
  new THREE.MeshStandardMaterial({map:makeEarthTexture(),roughness:0.85,metalness:0}));
earthSpin.add(earthGlobe);
{
  const ax=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-4.2,0),new THREE.Vector3(0,4.2,0)]);
  earthMesh.add(new THREE.Line(ax,new THREE.LineBasicMaterial({color:0xE3B34C})));
  const axLbl=mkLbl('L',()=>T('自轉軸','Rotation axis'),'#E3B34C',3.4,false); axLbl.position.set(0,5.6,0); earthMesh.add(axLbl);
  const eqPts=[]; for(let k=0;k<=64;k++){const a=k/64*2*Math.PI;eqPts.push(new THREE.Vector3(Math.cos(a)*2.1,0,Math.sin(a)*2.1));}
  earthMesh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eqPts),
    new THREE.LineBasicMaterial({color:0x7fd1e0,transparent:true,opacity:0.7})));
  const merPts=[]; for(let k=0;k<=32;k++){const a=-Math.PI/2+k/32*Math.PI;merPts.push(new THREE.Vector3(Math.cos(a)*1.55,Math.sin(a)*1.55,0));}
  earthSpin.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(merPts),
    new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.85})));
  window._obsDot=new THREE.Mesh(new THREE.SphereGeometry(0.16,10,8),new THREE.MeshBasicMaterial({color:0xff5a4d}));
  window._obsDot.position.set(1.55,0,0); earthSpin.add(window._obsDot);
}

const moonMesh=new THREE.Mesh(new THREE.SphereGeometry(0.55,20,14),
  new THREE.MeshBasicMaterial({color:0x5c606c}));
sceneL.add(moonMesh);
/* 月相:亮半球罩(r128 SphereGeometry phiStart0..π 面向 +z),朝向太陽 */
const moonLit=new THREE.Mesh(new THREE.SphereGeometry(0.562,24,16,0,Math.PI),
  new THREE.MeshBasicMaterial({color:0xEDEFF5}));
moonMesh.add(moonLit);
/* 影錐(示意,尺寸誇大):地影錐(月食)與月影錐(日食) */
const UMBRA_LEN=11.5;
const umbraCone=new THREE.Mesh(new THREE.ConeGeometry(1.5,UMBRA_LEN,24,1,true),
  new THREE.MeshBasicMaterial({color:0x7a2a20,transparent:true,opacity:0.16,side:THREE.DoubleSide,depthWrite:false}));
sceneL.add(umbraCone);
const mShadowCone=new THREE.Mesh(new THREE.ConeGeometry(0.55,3.6,20,1,true),
  new THREE.MeshBasicMaterial({color:0x1c2030,transparent:true,opacity:0.32,side:THREE.DoubleSide,depthWrite:false}));
sceneL.add(mShadowCone);
const moonLbl=mkLbl('L',()=>T('月球','Moon'),'#cfd2d8',4,false); moonLbl.position.set(0,2.2,0); moonMesh.add(moonLbl);
function makeSeg(mat){ /* 預配置 2 點線段,之後就地更新(不重建緩衝) */
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(6),3));
  g.setAttribute('lineDistance',new THREE.Float32BufferAttribute(new Float32Array(2),1));
  return new THREE.Line(g,mat);
}
function updateSeg(line,a,b){
  const ap=line.geometry.attributes.position;
  ap.setXYZ(0,a.x,a.y,a.z); ap.setXYZ(1,b.x,b.y,b.z); ap.needsUpdate=true;
  const ld=line.geometry.attributes.lineDistance;
  ld.setX(0,0); ld.setX(1,a.distanceTo(b)); ld.needsUpdate=true;
  line.geometry.computeBoundingSphere();
}
const moonLine=makeSeg(new THREE.LineDashedMaterial({color:0x8B93AD,dashSize:1.2,gapSize:1.2,transparent:true,opacity:0.6}));
sceneL.add(moonLine);
let moonVisR=3.1, umbraHalf=11.5/2, mShadHalf=1.8; /* 月距 3.1:落在金星/火星軌道間隙內 */

const tidalGroup=new THREE.Group(); sceneL.add(tidalGroup); tidalGroup.visible=false;
const tidalArrows=[];
for(let k=0;k<12;k++){
  const a=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),3,0x6FC3D6,1.1,0.65);
  tidalGroup.add(a); tidalArrows.push(a);
}
let tidalBulge;
{
  const cur=new THREE.EllipseCurve(0,0,2.6,1.8,0,2*Math.PI);
  const pts=cur.getPoints(72).map(p=>new THREE.Vector3(p.x,0,p.y));
  tidalBulge=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({color:0x6FC3D6,transparent:true,opacity:0.9}));
  tidalGroup.add(tidalBulge);
  const tl=mkLbl('L',()=>T('潮汐隆起(示意)','Tidal bulge'),'#6FC3D6',3.4,false); tl.position.set(0,3.6,0); tidalGroup.add(tl);
}

/* 天球 */
const sphereGroup=new THREE.Group(); sceneL.add(sphereGroup);
let axisLine, poleMark;
{
  const wire=new THREE.Mesh(new THREE.SphereGeometry(SPHERE_R,36,18),
    new THREE.MeshBasicMaterial({color:0x21305A,wireframe:true,transparent:true,opacity:0.11}));
  sphereGroup.add(wire);
  const ecl=[]; for(let k=0;k<=128;k++){const a=k/128*2*Math.PI;ecl.push(new THREE.Vector3(Math.cos(a)*SPHERE_R,0,-Math.sin(a)*SPHERE_R));}
  sphereGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ecl),
    new THREE.LineBasicMaterial({color:0xE3B34C,transparent:true,opacity:0.5})));
  const eclLbl=mkLbl('L',()=>T('黃道','Ecliptic'),'#E3B34C',5,false);
  eclLbl.position.set(SPHERE_R*0.98,6,0); sphereGroup.add(eclLbl);
  buildConstellations(sphereGroup, SPHERE_R*0.97, v=>eqToEclWorld(v), 7.5, 'L', 1.15, false);
  window._extraGroupL=new THREE.Group(); window._extraGroupL.visible=false; sphereGroup.add(window._extraGroupL);
  const pol=eqToEclWorld(eqUnit(37.95*DEG,89.264*DEG)).multiplyScalar(SPHERE_R*0.98);
  const star=makeGlow('rgba(255,255,255,1)','rgba(160,200,255,.5)',10); star.position.copy(pol);
  sphereGroup.add(star); regGlowL(star);
  const pl=mkLbl('L',()=>T('北極星 Polaris','Polaris'),'#ffffff',7,true); pl.position.copy(pol).multiplyScalar(1.05); sphereGroup.add(pl);
  axisLine=makeSeg(new THREE.LineDashedMaterial({color:0xE3B34C,dashSize:3,gapSize:3,transparent:true,opacity:0.5}));
  sphereGroup.add(axisLine);
  /* 歲差圈 */
  const pc=[]; for(let k=0;k<=96;k++){
    const t=k/96*2*Math.PI, se=Math.sin(OBLQ);
    pc.push(eclToWorld({x:se*Math.cos(t),y:se*Math.sin(t),z:Math.cos(OBLQ)}).multiplyScalar(SPHERE_R*0.98));
  }
  const pcl=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pc),
    new THREE.LineDashedMaterial({color:0x6FC3D6,dashSize:2.4,gapSize:2.4,transparent:true,opacity:0.45}));
  pcl.computeLineDistances(); sphereGroup.add(pcl);
  const pcLbl=mkLbl('L',()=>T('歲差圈 ~25,800 年','Precession circle ~25,800 yr'),'#6FC3D6',5,false);
  pcLbl.position.copy(pc[24]).multiplyScalar(1.06); sphereGroup.add(pcLbl);
  poleMark=new THREE.Mesh(new THREE.SphereGeometry(1.1,10,8),
    new THREE.MeshBasicMaterial({color:0xE3B34C}));
  sphereGroup.add(poleMark);
  const sp=[]; for(let k=0;k<420;k++){
    const u=Math.random()*2-1, t=Math.random()*2*Math.PI, s=Math.sqrt(1-u*u);
    sp.push(s*Math.cos(t)*SPHERE_R*0.995, u*SPHERE_R*0.995, s*Math.sin(t)*SPHERE_R*0.995);
  }
  const sg=new THREE.BufferGeometry();
  sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
  sphereGroup.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xaab6d8,size:1.2,sizeAttenuation:false,transparent:true,opacity:0.6})));
}

/* 黃道十二宮區塊(回歸黃道:固定於當代春分點,隨歲差相對恆星移動) */
const SIGN_ZH=['牡羊','金牛','雙子','巨蟹','獅子','處女','天秤','天蠍','射手','摩羯','水瓶','雙魚'];
const SIGN_EN=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const signBelt=new THREE.Group(); sceneL.add(signBelt);
signBelt.visible=false; /* 預設關閉 */
{
  const R=SPHERE_R*0.965, B=10*DEG;
  /* 各宮傳統色:牡羊紅、金牛綠、雙子黃、巨蟹銀、獅子金、處女大地色、
     天秤淺藍、天蠍黑、射手紫、摩羯深灰、水瓶水藍、雙魚海綠 */
  const SIGN_COL=[0xE0483C,0x4CAF6D,0xEFD35C,0xC9CFD8,0xE3B34C,0xA9805B,
                  0x9CC7E8,0x15151D,0x9A6BD0,0x5A5F6A,0x5BC8E8,0x3FA98E];
  const SIGN_OP =[0.20,0.20,0.20,0.22,0.22,0.22,0.20,0.55,0.22,0.30,0.20,0.20];
  const GLYPH_CSS=['#E0483C','#4CAF6D','#EFD35C','#C9CFD8','#E3B34C','#A9805B',
                   '#9CC7E8','#8F8F9C','#9A6BD0','#A6ACB8','#5BC8E8','#3FA98E'];
  for(let k=0;k<12;k++){
    const verts=[], idx=[], N=10;
    for(let j=0;j<=N;j++){
      const lam=(30*k + 30*j/N)*DEG;
      for(const b of [-B,B]){
        const cb=Math.cos(b);
        verts.push(cb*Math.cos(lam)*R, Math.sin(b)*R, -cb*Math.sin(lam)*R);
      }
    }
    for(let j=0;j<N;j++){
      const o=j*2;
      idx.push(o,o+1,o+2, o+1,o+3,o+2);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    g.setIndex(idx);
    signBelt.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({
      color:SIGN_COL[k],transparent:true,opacity:SIGN_OP[k],side:THREE.DoubleSide,depthWrite:false})));
    const bp=[];
    for(let j=0;j<=8;j++){
      const b=-12*DEG + j/8*24*DEG, lam=30*k*DEG, cb=Math.cos(b);
      bp.push(new THREE.Vector3(cb*Math.cos(lam)*R, Math.sin(b)*R, -cb*Math.sin(lam)*R));
    }
    signBelt.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bp),
      new THREE.LineBasicMaterial({color:0xE3B34C,transparent:true,opacity:0.35})));
    const lam=(30*k+15)*DEG, cb=Math.cos(13*DEG);
    const lbl=mkLbl('L',(idx=>()=>lang==='zh'?SIGN_ZH[idx]:SIGN_EN[idx])(k),GLYPH_CSS[k],9,true);
    lbl.position.set(cb*Math.cos(lam)*R, -Math.sin(13*DEG)*R, -cb*Math.sin(lam)*R);
    signBelt.add(lbl);
  }
}

/* ══════════════════════════════════════════════════════════
   5. 右視窗:地平視角
   ══════════════════════════════════════════════════════════ */
const paneR=document.getElementById('paneR');
const rendR=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); /* 殘影管線需保留繪圖緩衝 */
rendR.setPixelRatio(Math.min(devicePixelRatio,2));
paneR.appendChild(rendR.domElement);
const sceneR=new THREE.Scene();
sceneR.add(new THREE.AmbientLight(0xffffff,0.38));
const sunDirLight=new THREE.DirectionalLight(0xfff3d8,1.25);
sunDirLight.position.set(0,1,0);
sceneR.add(sunDirLight); sceneR.add(sunDirLight.target);
const BASE_FOV=65;
const camR=new THREE.PerspectiveCamera(BASE_FOV,1,0.1,600);
camR.position.set(0,2,0);
const ctrlR=new LookDrag(rendR.domElement,camR,BASE_FOV);
ctrlR.setFov(93.4); /* 預設視野 0.6×(tan 焦距比) */
ctrlR.yaw=Math.PI/2; ctrlR.pitch=0.35; ctrlR.apply(); /* 開場面向正東 */
const DOME=100;

const horizonGroup=new THREE.Group(); sceneR.add(horizonGroup);
let hideHorizon=false;
{
  const ground=new THREE.Mesh(new THREE.CircleGeometry(DOME*1.4,64),
    new THREE.MeshBasicMaterial({color:0x131A2E,transparent:true,opacity:0.82,side:THREE.DoubleSide,depthWrite:false}));
  ground.rotation.x=-Math.PI/2; ground.renderOrder=1; horizonGroup.add(ground);
  const hor=[]; for(let k=0;k<=128;k++){const a=k/128*2*Math.PI;hor.push(new THREE.Vector3(Math.cos(a)*DOME,0,Math.sin(a)*DOME));}
  horizonGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hor),
    new THREE.LineBasicMaterial({color:0xE3B34C})));
  const horLbl=mkLbl('R',()=>T('地平線','Horizon'),'#E3B34C',3.4,false); horLbl.position.set(DOME*0.72,1.8,DOME*0.55); horizonGroup.add(horLbl);
  const gmat=new THREE.LineBasicMaterial({color:0x25335E,transparent:true,opacity:0.55});
  [30,60].forEach(alt=>{
    const r=DOME*Math.cos(alt*DEG), h=DOME*Math.sin(alt*DEG), pts=[];
    for(let k=0;k<=96;k++){const a=k/96*2*Math.PI;pts.push(new THREE.Vector3(Math.cos(a)*r,h,Math.sin(a)*r));}
    horizonGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gmat));
  });
  for(let az=0;az<360;az+=30){
    const pts=[], ca=Math.sin(az*DEG), sa=-Math.cos(az*DEG);
    for(let k=0;k<=24;k++){const al=k/24*Math.PI/2;
      pts.push(new THREE.Vector3(ca*DOME*Math.cos(al), DOME*Math.sin(al), sa*DOME*Math.cos(al)));}
    horizonGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gmat));
  }
  const dirs=[[['北','N'],0,-1],[['東','E'],1,0],[['南','S'],0,1],[['西','W'],-1,0]];
  dirs.forEach(d=>{
    const l=mkLbl('R',()=>T(d[0][0],d[0][1]),'#EDE7D8',6,true);
    l.position.set(d[1]*DOME*0.93,4,d[2]*DOME*0.93); horizonGroup.add(l);
  });
}

const skyGroup=new THREE.Group(); skyGroup.matrixAutoUpdate=false; sceneR.add(skyGroup);
const starFrameR=new THREE.Group(); skyGroup.add(starFrameR); /* 恆星層:隨歲差旋轉 */
const constGroupR=new THREE.Group(); starFrameR.add(constGroupR);
/* 其他知名星座(左面板「其他星座」開啟後顯示)。
   t = 顯示層級:1 少(最重要)、2 多、3 更多(全部);選「多」會同時含 1、2。 */
const EXTRA_CONST={
 'oph':{t:3,zh:'蛇夫座',en:'Ophiuchus',s:[[263.73,12.56,2.1],[257.59,-15.72,2.4],[249.29,-10.57,2.6],[243.59,-3.69,2.7],[244.58,-4.69,3.2],[265.87,4.57,2.8],[254.42,9.38,3.2]],l:[[0,5],[5,1],[1,2],[2,4],[4,3],[3,6],[6,0]]},
 'tri':{t:1,zh:'夏季大三角',en:'Summer Triangle',s:[[279.23,38.78,0.0],[310.36,45.28,1.25],[297.70,8.87,0.77]],l:[[0,1],[1,2],[2,0]]},
 'cen':{t:3,zh:'半人馬座',en:'Centaurus',s:[[219.90,-60.83,0.1],[210.96,-60.37,0.6],[211.67,-36.37,2.1],[190.38,-48.96,2.2],[204.97,-53.47,2.3],[208.89,-47.29,2.5]],l:[[0,1],[1,4],[4,3],[4,5],[5,2]]},
 'ori':{t:1,zh:'獵戶座',en:'Orion',s:[[88.79,7.41,0.5],[78.63,-8.20,0.1],[81.28,6.35,1.6],[86.94,-9.67,2.1],[85.19,-1.94,1.7],[84.05,-1.20,1.7],[83.00,-0.30,2.2],[83.78,9.93,3.4]],l:[[0,2],[2,6],[6,5],[5,4],[4,0],[6,1],[4,3],[0,7],[7,2]]},
 'uma':{t:1,zh:'大熊座·北斗',en:'Ursa Major',s:[[165.93,61.75,1.8],[165.46,56.38,2.4],[178.46,53.69,2.4],[183.86,57.03,3.3],[193.51,55.96,1.8],[200.98,54.93,2.2],[206.89,49.31,1.9]],l:[[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]]},
 'cas':{t:1,zh:'仙后座',en:'Cassiopeia',s:[[2.29,59.15,2.3],[10.13,56.54,2.2],[14.18,60.72,2.5],[21.45,60.24,2.7],[28.60,63.67,3.4]],l:[[0,1],[1,2],[2,3],[3,4]]},
 'cru':{t:1,zh:'南十字座',en:'Crux',s:[[186.65,-63.10,0.8],[187.79,-57.11,1.6],[191.93,-59.69,1.3],[183.79,-58.75,2.8]],l:[[0,1],[2,3]]},
 'cyg':{t:1,zh:'天鵝座',en:'Cygnus',s:[[310.36,45.28,1.25],[305.56,40.26,2.2],[292.68,27.96,3.1],[296.24,45.13,2.9],[311.55,33.97,2.5]],l:[[0,1],[1,2],[3,1],[1,4]]},
 'cma':{t:1,zh:'大犬座',en:'Canis Major',s:[[101.29,-16.72,-1.46],[95.67,-17.96,1.98],[106.03,-23.83,3.0],[107.10,-26.39,1.83],[104.66,-28.97,1.5],[111.02,-29.30,2.45],[95.08,-30.06,3.0]],l:[[1,0],[0,2],[2,3],[3,5],[3,4],[4,6]]},
 'boo':{t:2,zh:'牧夫座',en:'Boötes',s:[[213.92,19.18,-0.05],[221.25,27.07,2.35],[222.20,33.31,3.47],[225.49,40.39,3.5],[218.02,38.31,3.03],[218.02,30.37,3.58],[208.67,18.40,2.68]],l:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,6]]},
 'aur':{t:2,zh:'御夫座',en:'Auriga',s:[[79.17,46.00,0.08],[89.88,44.95,1.9],[89.93,37.21,2.62],[74.25,33.17,2.69],[75.49,43.82,3.03]],l:[[0,1],[1,2],[2,3],[3,4],[4,0]]},
 'lyr':{t:2,zh:'天琴座',en:'Lyra',s:[[279.23,38.78,0.03],[284.10,37.60,4.36],[283.63,36.90,4.30],[284.74,32.69,3.24],[282.52,33.36,3.52]],l:[[0,1],[1,2],[2,3],[3,4],[4,1]]},
 'aql':{t:2,zh:'天鷹座',en:'Aquila',s:[[297.70,8.87,0.76],[296.56,10.61,2.72],[298.83,6.41,3.71],[286.56,3.11,3.36],[286.35,13.86,2.99],[302.83,-0.82,3.23],[286.56,-4.88,3.43]],l:[[4,1],[1,0],[0,2],[0,3],[3,6],[2,5]]},
 'per':{t:2,zh:'英仙座',en:'Perseus',s:[[51.08,49.86,1.79],[47.04,40.96,2.12],[58.53,31.88,2.85],[59.46,40.01,2.89],[46.20,53.51,2.93],[55.73,47.79,3.01],[46.94,38.84,3.39]],l:[[4,0],[0,5],[5,3],[3,2],[0,1],[1,6]]},
 'and':{t:2,zh:'仙女座',en:'Andromeda',s:[[2.10,29.09,2.06],[17.43,35.62,2.06],[30.97,42.33,2.10],[9.83,30.86,3.27],[14.19,38.50,3.86]],l:[[0,3],[3,1],[1,2],[1,4]]},
 'peg':{t:2,zh:'飛馬座',en:'Pegasus',s:[[346.19,15.21,2.48],[345.94,28.08,2.42],[3.31,15.18,2.83],[2.10,29.09,2.06],[326.05,9.88,2.38],[340.37,30.22,2.94],[340.75,10.83,3.40]],l:[[3,2],[2,0],[0,1],[1,3],[0,6],[6,4],[1,5]]},
 'umi':{t:2,zh:'小熊座·小北斗',en:'Ursa Minor',s:[[37.95,89.26,1.98],[222.68,74.16,2.08],[230.18,71.83,3.05],[251.49,75.76,4.23],[236.01,77.79,4.32],[263.05,86.59,4.36],[244.38,75.76,4.95]],l:[[0,5],[5,3],[3,4],[4,1],[1,2],[2,6],[6,4]]},
 'dra':{t:3,zh:'天龍座',en:'Draco',s:[[269.15,51.49,2.23],[262.61,52.30,2.79],[268.38,56.87,3.75],[263.12,55.19,4.88],[288.14,67.66,3.07],[257.20,65.71,3.17],[246.00,61.51,2.73],[231.23,58.97,3.29],[211.10,64.38,3.65],[172.85,69.33,3.84]],l:[[0,2],[2,3],[3,1],[1,0],[2,4],[4,5],[5,6],[6,7],[7,8],[8,9]]},
 'her':{t:3,zh:'武仙座',en:'Hercules',s:[[250.32,31.60,2.81],[255.07,30.93,3.92],[258.76,36.81,3.16],[250.72,38.92,3.48],[247.55,21.49,2.77],[258.66,14.39,3.06],[258.76,24.84,3.12]],l:[[0,1],[1,2],[2,3],[3,0],[0,4],[1,6],[6,5]]},
 'crb':{t:3,zh:'北冕座',en:'Corona Borealis',s:[[233.67,26.71,2.22],[231.96,29.11,3.68],[235.07,26.30,3.84],[237.40,26.07,4.63],[239.40,26.88,4.14],[231.04,31.36,4.14],[241.30,29.85,4.99]],l:[[5,1],[1,0],[0,2],[2,3],[3,4],[4,6]]},
 'cmi':{t:3,zh:'小犬座',en:'Canis Minor',s:[[114.83,5.22,0.34],[111.79,8.29,2.89]],l:[[0,1]]},
 'car':{t:3,zh:'船底座',en:'Carina',s:[[95.99,-52.70,-0.74],[138.30,-69.72,1.68],[125.63,-59.51,1.86],[139.27,-59.28,2.21],[146.10,-65.07,2.97],[160.74,-64.39,2.76]],l:[[0,2],[2,3],[3,4],[4,1],[4,5]]},
 'crv':{t:3,zh:'烏鴉座',en:'Corvus',s:[[182.53,-24.73,4.02],[188.60,-23.40,2.65],[183.95,-17.54,2.59],[187.47,-16.52,2.95],[182.09,-22.62,3.02]],l:[[2,3],[3,1],[1,4],[4,2],[4,0]]}
};
const extraGroupR=new THREE.Group(); extraGroupR.visible=false; starFrameR.add(extraGroupR);
const ECL_POLE_EQ=new THREE.Vector3(0,-Math.sin(OBLQ),Math.cos(OBLQ));
let starsR, eclLineR, eqLineR, signSkyGroup, showEclLines=false; /* 參考線預設關閉 */
{
  const eqp=[]; for(let k=0;k<=128;k++){const a=k/128*2*Math.PI;eqp.push(eqUnit(a,0).multiplyScalar(DOME*0.97));}
  eqLineR=new THREE.Line(new THREE.BufferGeometry().setFromPoints(eqp),
    new THREE.LineBasicMaterial({color:0x6FC3D6,transparent:true,opacity:0.28}));
  eqLineR.visible=false;
  skyGroup.add(eqLineR);
  window._eqLbl=mkLbl('R',()=>T('天球赤道','Celestial equator'),'#6FC3D6',3.6,false);
  window._eqLbl.position.copy(eqUnit(100*DEG,0)).multiplyScalar(DOME*0.97);
  window._eqLbl.visible=false;
  skyGroup.add(window._eqLbl);
  const ecp=[];
  for(let k=0;k<=180;k++){
    const lam=k/180*2*Math.PI;
    const e=eclToEq({x:Math.cos(lam),y:Math.sin(lam),z:0});
    ecp.push(new THREE.Vector3(e.x,e.y,e.z).multiplyScalar(DOME*0.97));
  }
  eclLineR=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ecp),
    new THREE.LineBasicMaterial({color:0xE3B34C,transparent:true,opacity:0.5}));
  eclLineR.visible=false;
  skyGroup.add(eclLineR);
  window._eclLbl=mkLbl('R',()=>T('黃道','Ecliptic'),'#E3B34C',3.6,false);
  {const e2=eclToEq({x:Math.cos(70*DEG),y:Math.sin(70*DEG),z:0});
   window._eclLbl.position.set(e2.x,e2.y,e2.z).multiplyScalar(DOME*0.97);}
  window._eclLbl.visible=false;
  skyGroup.add(window._eclLbl);
  /* 十二宮分界(地平視角):以虛線切分黃道、文字標示宮位,不上色塊。
     宮位為回歸黃道——邊界固定於當代春分點,故與黃道線同一座標系,無需歲差旋轉 */
  signSkyGroup=new THREE.Group(); signSkyGroup.visible=false; skyGroup.add(signSkyGroup);
  for(let k=0;k<12;k++){
    const bp=[];
    for(let j=0;j<=10;j++){
      const b=(-11+22*j/10)*DEG, lam=30*k*DEG, cb=Math.cos(b);
      const e3=eclToEq({x:cb*Math.cos(lam),y:cb*Math.sin(lam),z:Math.sin(b)});
      bp.push(new THREE.Vector3(e3.x,e3.y,e3.z).multiplyScalar(DOME*0.965));
    }
    const dl=new THREE.Line(new THREE.BufferGeometry().setFromPoints(bp),
      new THREE.LineDashedMaterial({color:0xE3B34C,dashSize:2.2,gapSize:2.2,transparent:true,opacity:0.45}));
    dl.computeLineDistances();
    signSkyGroup.add(dl);
    const lam2=(30*k+15)*DEG, b2=14*DEG, cb2=Math.cos(b2);
    const e4=eclToEq({x:cb2*Math.cos(lam2),y:cb2*Math.sin(lam2),z:Math.sin(b2)});
    const sl=mkLbl('R',((idx)=>()=>T(SIGN_ZH[idx]+'宮',SIGN_EN[idx]))(k),'#E3B34C',3.4,false);
    sl.position.set(e4.x,e4.y,e4.z).multiplyScalar(DOME*0.965);
    signSkyGroup.add(sl);
  }
  buildConstellations(constGroupR, DOME*0.95, v=>v.clone(), 4.4, 'R', 1, true);
  /* 其他星座依 t 分成三層各建一個子群組,切換「少/多/更多」時只改 visible,
     不用重建幾何(星點是每次呼叫合併成一個 Points,所以必須分群才切得動) */
  window._extraTierR=[]; window._extraTierL=[];
  for(let t=1;t<=3;t++){
    const sub={}; for(const k in EXTRA_CONST) if((EXTRA_CONST[k].t||3)===t) sub[k]=EXTRA_CONST[k];
    const gR=new THREE.Group(); extraGroupR.add(gR); window._extraTierR.push(gR);
    const gL=new THREE.Group(); window._extraGroupL.add(gL); window._extraTierL.push(gL);
    buildConstellations(gR, DOME*0.95, v=>v.clone(), 4.4, 'R', 1, true, sub);
    buildConstellations(gL, SPHERE_R*0.97, v=>eqToEclWorld(v), 7.5, 'L', 1.15, false, sub);
  }
  const pol=eqUnit(37.95*DEG,89.264*DEG).multiplyScalar(DOME*0.96);
  const star=makeGlow('rgba(255,255,255,1)','rgba(160,200,255,.5)',7); star.position.copy(pol);
  starFrameR.add(star); regGlowR(star);
  const pl=mkLbl('R',()=>T('北極星','Polaris'),'#ffffff',4.2,true); pl.position.copy(pol).multiplyScalar(0.94); pl.position.y-=4; starFrameR.add(pl);
  const sp=[]; for(let k=0;k<500;k++){
    const u=Math.random()*2-1,t=Math.random()*2*Math.PI,s=Math.sqrt(1-u*u);
    sp.push(s*Math.cos(t)*DOME*0.985,s*Math.sin(t)*DOME*0.985,u*DOME*0.985);
  }
  const sg=new THREE.BufferGeometry();
  sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
  starsR=new THREE.Points(sg,new THREE.PointsMaterial({color:0xbcc7e6,size:1.3,sizeAttenuation:false,transparent:true,opacity:0.8}));
  starsR.visible=true; /* 背景星空預設開啟 */
  starFrameR.add(starsR);
}

const skyBodies=[];
function addSkyBody(key,getText,colorCss,dotR,glow,boldLbl){
  const grp=new THREE.Group(); skyGroup.add(grp);
  /* 行星用受光材質(向陽面亮、背陽面暗,呈現光影質感);太陽自發光 */
  const col=new THREE.Color(colorCss);
  const mat=key==='sun'
    ? new THREE.MeshBasicMaterial({color:col,transparent:true})
    : new THREE.MeshStandardMaterial({color:col,roughness:0.55,metalness:0.05,
        emissive:col.clone().multiplyScalar(0.16),transparent:true});
  const dot=new THREE.Mesh(new THREE.SphereGeometry(dotR,18,14),mat);
  grp.add(dot);
  /* 光暈為天體本身的物理泛光:隨場景縮放,不做視角補償
     (舊版補償導致放大後光暈縮進日盤內、太陽看起來不亮的 bug) */
  if(glow){const g=makeGlow(glow[0],glow[1],glow[2]);grp.add(g);}
  const lbl=mkLbl('R',getText,colorCss,4.2,boldLbl);
  lbl.position.set(0,dotR+3.2,0); grp.add(lbl);
  skyBodies.push({key,grp,mat,lbl,dot,dotR});
}
addSkyBody('sun',()=>T('太陽','Sun'),'#ffd75e',2.6,['rgba(255,240,180,1)','rgba(255,190,80,.5)',16],true);
skyBodies[0].grp.traverse(o=>{o.renderOrder=Math.max(o.renderOrder||0,1);}); /* 太陽層級低於月盤 */
/* 日食日冕環(右視窗,日食時顯示) */
const coronaSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture([245,242,235],true),
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
coronaSprite.scale.set(13,13,1); coronaSprite.visible=false;
skyBodies[0].grp.add(coronaSprite); /* 日冕貼著日盤,不做視角補償 */
addSkyBody('moon',()=>T('月亮','Moon'),'#dfe3ea',2.0,['rgba(240,244,255,.9)','rgba(150,170,220,.35)',9],true);
/* 月相盤:繪製受照面(亮面永遠朝向太陽在天空中的方向) */
const moonBody=skyBodies.find(b=>b.key==='moon');
moonBody.grp.remove(moonBody.grp.children[0]); /* 移除純色圓點 */
function drawPhase(elDeg){
  const c=document.createElement('canvas'); c.width=c.height=96;
  const ctx=c.getContext('2d'), R=44, cx=48, cy=48;
  ctx.fillStyle='#3b3f4c';
  ctx.beginPath(); ctx.arc(cx,cy,R,0,2*Math.PI); ctx.fill();
  const el=Math.max(0.5,Math.min(179.5,elDeg));
  ctx.fillStyle='#EDEFF5';
  ctx.beginPath(); ctx.arc(cx,cy,R,-Math.PI/2,Math.PI/2,false); ctx.fill(); /* 亮半圓在 +x(朝日側) */
  const k=Math.abs(Math.cos(el*DEG))*R;
  ctx.fillStyle= el<90? '#3b3f4c' : '#EDEFF5'; /* 眉月遮回暗、凸月補亮 */
  ctx.beginPath(); ctx.ellipse(cx,cy,k,R,0,0,2*Math.PI); ctx.fill();
  ctx.strokeStyle='rgba(237,239,245,.5)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(cx,cy,R,0,2*Math.PI); ctx.stroke();
  const tex=new THREE.CanvasTexture(c); tex.minFilter=THREE.LinearFilter;
  return tex;
}
const moonSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:drawPhase(90),transparent:true,depthWrite:false}));
moonSprite.scale.set(4.6,4.6,1);
moonSprite.renderOrder=5; /* 日食時月盤蓋在日盤之上(月球較近,物理正確) */
/* 地平視角月食:地球本影盤,置於反日點——食分與方向由真實幾何自然呈現 */
const umbraSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:(()=>{
  const N=64,d=new Uint8Array(N*N*4);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const dx=(x+0.5)/N*2-1,dy=(y+0.5)/N*2-1,r=Math.min(1,Math.hypot(dx,dy));
    const a=r<0.85?1:Math.max(0,(1-r)/0.15); /* 硬核心+軟邊(半影) */
    const i2=(y*N+x)*4;
    d[i2]=58;d[i2+1]=12;d[i2+2]=8;d[i2+3]=Math.round(205*a);
  }
  const t=new THREE.DataTexture(d,N,N,THREE.RGBAFormat);
  t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
})(),transparent:true,depthWrite:false,depthTest:false}));
umbraSprite.visible=false; umbraSprite.renderOrder=6;
skyGroup.add(umbraSprite);
moonBody.grp.add(moonSprite);
moonBody.mat=moonSprite.material; /* 沿用地平線下調暗邏輯 */
let phaseBucket=-1;
const phaseTexCache=new Map(); /* 月相貼圖快取:重播時零配置、零上傳 */
for(let i=0;i<ELEM.length;i++){
  if(i===EARTH_IDX)continue;
  addSkyBody(i,()=>pname(i),'#'+ELEM[i].color.toString(16).padStart(6,'0'),1.1,null,false);
}
addSkyBody(EARTH_IDX,()=>T('地球','Earth'),'#5B8FD9',1.6,['rgba(160,200,255,.9)','rgba(90,140,220,.35)',7],true); /* 從其他觀察地可見 */
/* 土星在天空中的環系:與日心視角同款多環帶(C/B/卡西尼縫/A/F),
   依土星真實自轉極定向——從泰坦看去隨視尺寸放大成壯觀的帶環巨球 */
{
  const sb=skyBodies.find(b=>b.key===5);
  const SKYBANDS=[[1.24,1.52,0x8a7a5e,0.30],[1.53,1.94,0xd8c294,0.9],[2.03,2.26,0xcdb684,0.6],[2.30,2.34,0xb59f6e,0.3]];
  const rg2=new THREE.Group();
  for(const [ri,ro,col,op] of SKYBANDS){
    rg2.add(new THREE.Mesh(new THREE.RingGeometry(sb.dotR*ri,sb.dotR*ro,48),
      new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide,transparent:true,opacity:op,depthWrite:false})));
  }
  const sp2=eqUnit(40.589*DEG,83.537*DEG); /* 土星自轉極(赤道座標) */
  rg2.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(sp2.x,sp2.y,sp2.z));
  sb.dot.add(rg2);
}
/* 月球(或火星/泰坦)天空中的地球:程序化貼圖球,依 GMST 自轉,
   受光材質呈現真實晝夜明暗界線 */
{
  const eb=skyBodies.find(b=>b.key===EARTH_IDX);
  eb.dot.material=new THREE.MeshStandardMaterial({map:makeEarthTexture(),roughness:0.85,metalness:0,transparent:true});
  eb.mat=eb.dot.material;
  const axg=new THREE.Group();
  axg.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)); /* 地軸=赤道座標北極 */
  eb.grp.add(axg); axg.add(eb.dot);
  eb.dot.renderOrder=8; /* 從月球看:地球在太陽之前(遮日圖層正確) */
  window._earthSkySpin=eb.dot;
  window._earthSkyBody=eb;
  /* 月食(=月球上看的日食):陽光經地球大氣折射的紅色環——血月的成因 */
  window._earthRim=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture([230,80,50],true),
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  window._earthRim.visible=false; window._earthRim.renderOrder=9;
  eb.grp.add(window._earthRim);
}
/* 觀察地:地平視角的觀測者所在天體 */
let viewBody='earth';
function eqToEclP(v){ /* 赤道→黃道(純物件版) */
  const c=Math.cos(OBLQ), s2=Math.sin(OBLQ);
  return {x:v.x, y:v.y*c+v.z*s2, z:-v.y*s2+v.z*c};
}
const OBS_POLE={ /* 自轉極(黃道座標) */
  moon:{x:0,y:0,z:1},
  mars:(()=>{const e=eqUnit(317.68*DEG,52.887*DEG);return eqToEclP({x:e.x,y:e.y,z:e.z});})(),
  titan:(()=>{const e=eqUnit(40.589*DEG,83.537*DEG);return eqToEclP({x:e.x,y:e.y,z:e.z});})()
};
const OBS_SPIN={moon:27.321661, mars:1.02595675, titan:15.945}; /* 自轉週期(日);泰坦潮汐鎖定 */
/* 手機端 option.hidden 不可靠(iOS/Android picker 仍會列出),
   故以「實際從 DOM 移除/插回」來控制選項存在與否 */
function setOptPresent(sel, value, present, buildFn){
  let o=[...sel.options].find(x=>x.value===value);
  if(present){
    if(!o){ o=buildFn(); sel.appendChild(o); }
  }else if(o){
    if(sel.value===value)sel.value='none';
    o.remove();
  }
  return o;
}
function syncObserverUI(){
  /* 逆行軌跡是地球視角的現象(視逆行=地球超車幾何),其他觀察地整欄隱藏 */
  document.getElementById('retroRow').style.display=(viewBody==='earth')?'':'none';
  const tv=showTrail&&viewBody==='earth';
  if(trailPast){ trailPast.visible=trailFuture.visible=tv; trailMarks.forEach(m=>m.visible=tv); }
  /* 鎖定・月亮/地球:地球觀察地=「月亮」,月球觀察地=「地球」;火星/泰坦移除 */
  setOptPresent(lockSelEl,'moon', viewBody==='earth'||viewBody==='moon', ()=>{
    const o=document.createElement('option'); o.value='moon'; return o;
  });
  {const mo=[...lockSelEl.options].find(x=>x.value==='moon');
   if(mo)mo.textContent=(viewBody==='moon')? T('地球','Earth') : T('月亮','Moon');}
  /* 鎖定・土星:僅泰坦;插在星座選項之前(緊接天體選項之後) */
  setOptPresent(lockSelEl,'sat', viewBody==='titan', ()=>{
    const o=document.createElement('option'); o.value='sat'; o.textContent=T('土星','Saturn'); return o;
  });
  {const so=[...lockSelEl.options].find(o=>o.value==='sat');
   if(so){const fc=[...lockSelEl.options].find(o=>o.value.startsWith('c:'));
     if(fc&&so.nextSibling!==fc)lockSelEl.insertBefore(so,fc);}}
  /* 白道軸置中:僅地球(其他觀察地上月球軌道面不構成天空參考線) */
  const lunPresent=viewBody==='earth';
  if(lunPresent){
    if(![...trackSelEl.options].some(o=>o.value==='lun_e')){
      const oe=document.createElement('option'); oe.value='lun_e'; oe.textContent=TRACK_STR[3][lang==='zh'?0:1];
      const ow=document.createElement('option'); ow.value='lun_w'; ow.textContent=TRACK_STR[4][lang==='zh'?0:1];
      trackSelEl.appendChild(oe); trackSelEl.appendChild(ow); /* ecl_w 之後即末端,順序正確 */
    }
  }else{
    if(trackSelEl.value.startsWith('lun'))trackSelEl.value='off';
    [...trackSelEl.options].filter(o=>o.value.startsWith('lun')).forEach(o=>o.remove());
  }
  applyTrack();
  updateObsDotParent();
  updateLoc();
}
/* 觀察者紅點:移到所選觀察地的星體上(左視窗示意) */
/* 非地球觀察地的自轉群組:+Y 對齊該天體自轉極(世界座標),
   每幀以 rotation.y = 自轉角 轉動,紅點因此隨自轉繞行 */
const obsSpinGroups={};
function getObsSpin(body){
  if(obsSpinGroups[body])return obsSpinGroups[body];
  const host={moon:moonMesh, mars:planetMeshes[3], titan:satMoons[4].mesh}[body];
  const g=new THREE.Group();
  const P=OBS_POLE[body];
  const pw=eclToWorld({x:P.x,y:P.y,z:P.z}).normalize(); /* 極軸 → 世界座標 */
  /* host 本身無旋轉,故可直接以世界極軸定向 */
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),pw);
  host.add(g);
  obsSpinGroups[body]=g;
  return g;
}
function updateObsDotParent(){
  const dot=window._obsDot;
  if(dot.parent)dot.parent.remove(dot);
  if(viewBody==='earth'){ earthSpin.add(dot); }
  else{ getObsSpin(viewBody).add(dot); }
}
document.getElementById('viewBodySel').addEventListener('change',e=>{
  viewBody=e.target.value;
  needTrailClear=true;
  syncObserverUI();
  try{ syncViewBodyChip(); }catch(_){}
});

/* 白道:月球軌道面在天球上的路徑(對黃道傾約 5.1°,交點 18.6 年退行一圈) */
let moonPathLine=null, moonPathEpoch=NaN;
const moonPathLbl=mkLbl('R',()=>T('白道','Lunar orbit'),'#c9cfdd',3.6,false);
moonPathLbl.visible=false;
skyGroup.add(moonPathLbl);
function buildMoonPath(ms){
  if(moonPathLine){skyGroup.remove(moonPathLine);moonPathLine.geometry.dispose();moonPathLine.material.dispose();}
  const psi0=psiDeg(ms)*DEG, pts=[];
  for(let k=0;k<=88;k++){
    const t=ms+((k/88)-0.5)*27.55*86400000; /* 近一個近點月 */
    const g=eclToEq(rotEclZ(moonGeo(centuries(t)),psi0));
    const v=new THREE.Vector3(g.x,g.y,g.z).normalize().multiplyScalar(DOME*0.92);
    if(isFinite(v.x+v.y+v.z))pts.push(v); /* NaN 防護 */
  }
  moonPathLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineDashedMaterial({color:0xc9cfdd,dashSize:1.1,gapSize:1.3,transparent:true,opacity:0.42}));
  moonPathLine.computeLineDistances();
  moonPathLine.visible=showEclLines;
  skyGroup.add(moonPathLine);
  moonPathLbl.position.copy(pts[8]).multiplyScalar(1.04);
  moonPathEpoch=ms;
}

/* 逆行軌跡(預設水星) */
let trailPast=null, trailFuture=null, trailMarks=[];
let trailEpoch=NaN, trailPlanet=0;
const TRAIL_WIN={0:70,1:150,3:220,4:280,5:300,6:330,7:330,8:360};
function rebuildTrail(ms){
  [trailPast,trailFuture,...trailMarks].forEach(o=>{if(o){skyGroup.remove(o);o.geometry.dispose();o.material.dispose();}});
  trailMarks=[];
  const W=TRAIL_WIN[trailPlanet], step=W/110;
  const psi0=psiDeg(ms)*DEG;
  const past=[],future=[];
  for(let dd=-W;dd<=W;dd+=step){
    const T2=centuries(ms+dd*86400000);
    const g=eclToEq(rotEclZ(geoEcl(trailPlanet,T2),psi0));
    const v=new THREE.Vector3(g.x,g.y,g.z).normalize().multiplyScalar(DOME*0.9);
    if(isFinite(v.x+v.y+v.z))(dd<=0?past:future).push(v); /* NaN 防護 */
  }
  if(past.length) future.unshift(past[past.length-1].clone());
  const col=ELEM[trailPlanet].color;
  trailPast=new THREE.Line(new THREE.BufferGeometry().setFromPoints(past),
    new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.95}));
  trailFuture=new THREE.Line(new THREE.BufferGeometry().setFromPoints(future),
    new THREE.LineDashedMaterial({color:col,dashSize:1.4,gapSize:1.1,transparent:true,opacity:0.65}));
  trailFuture.computeLineDistances();
  skyGroup.add(trailPast); skyGroup.add(trailFuture);
  for(let dd=-W;dd<=W;dd+=30){
    const T2=centuries(ms+dd*86400000);
    const g=eclToEq(rotEclZ(geoEcl(trailPlanet,T2),psi0));
    const v=new THREE.Vector3(g.x,g.y,g.z).normalize().multiplyScalar(DOME*0.9);
    const m=new THREE.Mesh(new THREE.SphereGeometry(0.45,8,6),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.8}));
    m.position.copy(v); skyGroup.add(m); trailMarks.push(m);
  }
  trailEpoch=ms;
  trailPast.visible=trailFuture.visible=showTrail;
  trailMarks.forEach(m=>m.visible=showTrail);
}

/* ══════════════════════════════════════════════════════════
   6. 逆行偵測、通知與年度時刻表
   ══════════════════════════════════════════════════════════ */
const toastsEl=document.getElementById('toasts');
function toast(msg,isRetro,force){
  if(!notifyOn&&!force)return; /* 通知關閉時僅放行強制訊息(AI 回覆等) */
  const d=document.createElement('div');
  d.className='toast '+(isRetro?'retro':'pro');
  d.textContent=msg;
  toastsEl.appendChild(d);
  try{ speak(msg); }catch(_){}   /* TTS 宣告在後面,開場的通知略過 */
  while(toastsEl.children.length>4)toastsEl.firstChild.remove();
  setTimeout(()=>{d.style.opacity='0';d.style.transition='opacity .4s';setTimeout(()=>d.remove(),420);},5500);
}
const retroState=new Array(ELEM.length).fill(null);
/* 日月食偵測(真實幾何,非畫面示意尺寸;受低精度月球理論限制,
   時刻誤差可達 ~1 小時,邊緣性偏食判定僅供參考) */
let eclipseState=null;
const eclipseChip=document.getElementById('eclipseChip');
/* 食的幾何量(時刻表與即時判定共用):角距、角半徑、地影半徑 */
function eclipseGeom(ms){
  const T3=centuries(ms);
  const m=moonGeo(T3), su=geoEcl('sun',T3);
  const md=Math.hypot(m.x,m.y,m.z), sd=Math.hypot(su.x,su.y,su.z);
  const mh={x:m.x/md,y:m.y/md,z:m.z/md}, sh={x:su.x/sd,y:su.y/sd,z:su.z/sd};
  const dot=mh.x*sh.x+mh.y*sh.y+mh.z*sh.z;
  const distKm=m.distKm;
  const rm=Math.atan(1737.4/distKm);              /* 月角半徑(地心) */
  const rmTop=Math.asin(1737.4/Math.max(1,distKm-6378)); /* 月角半徑(地表,判全/環食用) */
  const par=Math.asin(6378/distKm);               /* 月地平視差 */
  const rs=0.00465/sd;                            /* 日角半徑(隨日距變化) */
  const sigL=Math.acos(Math.max(-1,Math.min(1,-dot))); /* 月心↔反日點 */
  const sigS=Math.acos(Math.max(-1,Math.min(1,dot)));  /* 月心↔日心 */
  const u=1.02*(par-0.00465+0.0000426);           /* Danjon 地影半徑 */
  return {rm,rmTop,par,rs,sigL,sigS,u,distKm};
}
function eclipseCheck(ms){
  const g=eclipseGeom(ms);
  /* 月食:月心與反日點角距 vs 地影錐半徑(~4650km@月距) */
  if(g.sigL<g.u-g.rm)return 'lunarT';
  if(g.sigL<g.u+g.rm)return 'lunarP';
  /* 日食:日月角距 < 月半徑+日半徑+視差 → 地表某處可見 */
  if(g.sigS<g.rm+g.rs+g.par)return 'solar';
  return null;
}
/* ── 一整年的日月食:20 分鐘掃描找出食窗,再二分逼近到分鐘 ──
   只判「全球某處看得到」,不做地方可見性;半影月食不列(本影判定)。
   位置用的是站內同一套簡化日月理論,所以時刻是估計值(見表下註記)。 */
function eclipseKind(ms){
  const g=eclipseGeom(ms);
  if(g.sigL<g.u+g.rm)return 'lunar';
  if(g.sigS<g.rm+g.rs+g.par)return 'solar';
  return null;
}
function eclipseEdge(outMs,inMs,kind){        /* out=食外,in=食內 */
  for(let i=0;i<22;i++){ const mid=(outMs+inMs)/2;
    if(eclipseKind(mid)===kind)inMs=mid; else outMs=mid; }
  return Math.round(inMs/60000)*60000;
}
function eclipseEvents(year){
  const t0=Date.UTC(year,0,1), t1=Date.UTC(year+1,0,1), STEP=20*60000;
  const out=[]; let cur=null, prevMs=t0;
  for(let ms=t0;ms<=t1;ms+=STEP){
    const k=eclipseKind(ms);
    if(k&&!cur)cur={kind:k,sLo:prevMs,sHi:ms,peak:ms,best:Infinity};
    if(cur){
      const g=eclipseGeom(ms), sig=(cur.kind==='lunar')?g.sigL:g.sigS;
      if(sig<cur.best){cur.best=sig;cur.peak=ms;}
      if(!k){ cur.start=eclipseEdge(cur.sLo,cur.sHi,cur.kind);
              cur.end=eclipseEdge(ms,prevMs,cur.kind);
              out.push(cur); cur=null; }
    }
    prevMs=ms;
  }
  if(cur){ cur.start=eclipseEdge(cur.sLo,cur.sHi,cur.kind); cur.end=t1; out.push(cur); }
  /* 食甚時刻附近再細查一次(20 分鐘網格對「食甚」太粗) */
  for(const e of out){
    let best=e.best, pk=e.peak;
    for(let ms=e.peak-20*60000;ms<=e.peak+20*60000;ms+=60000){
      const g=eclipseGeom(ms), sig=(e.kind==='lunar')?g.sigL:g.sigS;
      if(sig<best){best=sig;pk=ms;}
    }
    e.peak=pk;
    const g=eclipseGeom(pk);
    if(e.kind==='lunar') e.type=(g.sigL<g.u-g.rm)?'lunarT':'lunarP';
    else e.type=(g.sigS<g.par)?(g.rmTop>g.rs?'solarT':'solarA'):'solarP';
  }
  return out;
}
const ECL_STR={
  lunarT:['月全食進行中(血月)','Total lunar eclipse (blood moon)'],
  lunarP:['月偏食進行中','Partial lunar eclipse'],
  solar:['日食(地表某處可見)','Solar eclipse (visible somewhere on Earth)']
};
function updateEclipse(){
  const st=eclipseCheck(simMs);
  if(st!==eclipseState){
    if(st&&playing)toast(ECL_STR[st][lang==='zh'?0:1]+' · '+fmtDate(simMs),st!=='solar');
    eclipseState=st;
    eclipseChip.style.display=st?'block':'none';
    if(st)eclipseChip.textContent=ECL_STR[st][lang==='zh'?0:1];
    moonMesh.material.color.setHex(st==='lunarT'?0xB0452F:0x5c606c); /* 血月 */
    moonLit.material.color.setHex(st==='lunarT'?0xC96A50:0xEDEFF5);
    /* 月食:地影錐轉紅增亮;日食:月影錐轉近黑實體 + 右視窗日冕環 */
    const lun=st==='lunarT'||st==='lunarP';
    umbraCone.material.color.setHex(lun?0xE04830:0x7a2a20);
    umbraCone.material.opacity=lun?0.34:0.16;
    mShadowCone.material.color.setHex(st==='solar'?0x05070D:0x1c2030);
    mShadowCone.material.opacity=st==='solar'?0.85:0.32;
    coronaSprite.visible=(st==='solar');
  }
}
function fmtDate(ms){const d=new Date(ms);return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())}`;}
function checkRetroFlips(){
  if(viewBody!=='earth')return; /* 逆行為地球視角現象 */
  for(let i=0;i<ELEM.length;i++){
    if(i===EARTH_IDX)continue;
    const r=retroRate(i,simMs)<0;
    if(retroState[i]===null){retroState[i]=r;continue;}
    if(r!==retroState[i]){
      retroState[i]=r;
      if(playing){
        const msg=lang==='zh'
          ? `${pname(i)}${r?' 開始逆行':' 結束逆行,恢復順行'} · ${fmtDate(simMs)}`
          : `${pname(i)} ${r?'entered retrograde':'resumed prograde motion'} · ${fmtDate(simMs)}`;
        toast(msg,r);
      }
    }
  }
}
function refineFlip(i,a,b){
  const ra=retroRate(i,a);
  for(let k=0;k<24;k++){
    const m=(a+b)/2;
    if(ra*retroRate(i,m)<=0)b=m; else a=m;
  }
  return (a+b)/2;
}
function retroIntervals(year){
  const out=[];
  const t0=Date.UTC(year,0,1), t1=Date.UTC(year+1,0,1), step=86400000;
  for(let i=0;i<ELEM.length;i++){
    if(i===EARTH_IDX)continue;
    const iv=[];
    let prev=retroRate(i,t0)<0;
    let start=prev? {ms:t0,open:true} : null;
    for(let t=t0+step;t<=t1;t+=step){
      const r=retroRate(i,t)<0;
      if(!prev&&r) start={ms:refineFlip(i,t-step,t),open:false};
      if(prev&&!r&&start){ iv.push({s:start,e:{ms:refineFlip(i,t-step,t),open:false}}); start=null; }
      prev=r;
    }
    if(start) iv.push({s:start,e:{ms:t1,open:true}});
    out.push({i,iv});
  }
  return out;
}
const modalBg=document.getElementById('modalBg');
const yLbl=document.getElementById('yLbl');
const rowsEl=document.getElementById('retroRows');
const tblNote=document.getElementById('tblNote');
let tableYear=new Date().getFullYear();
let tableTab='retro';                      /* retro | ecl */
function fmtDateTime(ms){const d=new Date(ms);
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;}
const ECL_TYPE={
  lunarT:['月全食','Total lunar'], lunarP:['月偏食','Partial lunar'],
  solarT:['日全食','Total solar'], solarA:['日環食','Annular solar'], solarP:['日偏食','Partial solar']
};
/* 表頭文字隨分頁換;th 的 id 在 UI_STR 裡也有,所以這裡要在 applyLang 之後再蓋一次 */
const TH_STR={
  retro:[['行星','Planet'],['開始逆行','Retrograde begins'],['恢復順行','Direct again'],['期間','Duration']],
  ecl:[['類型','Type'],['開始','Begins'],['食甚','Greatest'],['結束','Ends']]
};
function renderTable(){
  const k=lang==='zh'?0:1;
  document.getElementById('tabRetro').classList.toggle('on',tableTab==='retro');
  document.getElementById('tabEcl').classList.toggle('on',tableTab==='ecl');
  ['thP','thS','thE','thD'].forEach((id,i)=>{
    const el=document.getElementById(id); if(el)el.textContent=TH_STR[tableTab][i][k];
  });
  if(tableTab==='ecl')renderEclTable(); else renderRetroTable();
}
function renderEclTable(){
  yLbl.textContent=tableYear;
  rowsEl.innerHTML='';
  tblNote.innerHTML=T(
    '＊ 只列全球某處看得到的日食與本影月食(不含半影月食);時刻為本機時區。<br>＊ 日月位置用的是站內同一套簡化理論,時刻約有 ±1 小時的誤差,全食/環食/偏食的判別在臨界個案也可能不準——查精確資料請以 NASA 的 eclipse 目錄為準。',
    '* Solar eclipses visible somewhere on Earth, plus umbral lunar eclipses (penumbral ones are omitted); times in your local zone.<br>* Positions come from the same simplified theory the rest of the site uses, so times can be off by up to ~1 hour and total/annular/partial calls may be wrong in marginal cases — check NASA\'s eclipse catalog for authoritative data.');
  const evs=eclipseEvents(tableYear);
  if(!evs.length){
    rowsEl.insertAdjacentHTML('beforeend',
      `<tr class="none"><td colspan="4">${T('本年無日月食','No eclipses this year')}</td></tr>`);
    return;
  }
  for(const e of evs){
    const ty=ECL_TYPE[e.type]||ECL_TYPE.solarP;
    rowsEl.insertAdjacentHTML('beforeend',
      `<tr><td class="pname">${ty[lang==='zh'?0:1]}</td><td>${fmtDateTime(e.start)}</td>`+
      `<td>${fmtDateTime(e.peak)}</td><td>${fmtDateTime(e.end)}</td></tr>`);
  }
}
function renderRetroTable(){
  yLbl.textContent=tableYear;
  rowsEl.innerHTML='';
  tblNote.textContent='';
  const data=retroIntervals(tableYear);
  for(const rec of data){
    const name=pname(rec.i);
    if(rec.iv.length===0){
      rowsEl.insertAdjacentHTML('beforeend',
        `<tr class="none"><td class="pname">${name}</td><td colspan="3">${T('本年無逆行','No retrograde this year')}</td></tr>`);
      continue;
    }
    rec.iv.forEach((v,k)=>{
      const sTxt=v.s.open? T(`${tableYear-1} 年起`,`since ${tableYear-1}`) : fmtDate(v.s.ms);
      const eTxt=v.e.open? T(`持續至 ${tableYear+1} 年`,`into ${tableYear+1}`) : fmtDate(v.e.ms);
      const dur=Math.round((v.e.ms-v.s.ms)/86400000);
      rowsEl.insertAdjacentHTML('beforeend',
        `<tr><td class="pname">${k===0?name:''}</td><td>${sTxt}</td><td>${eTxt}</td><td><span class="dur">${dur} ${T('天','days')}</span></td></tr>`);
    });
  }
}
document.getElementById('retroTableBtn').addEventListener('click',()=>{
  tableYear=new Date(simMs).getFullYear();
  renderTable();
  modalBg.classList.add('open');
});
document.getElementById('tabRetro').addEventListener('click',()=>{tableTab='retro';renderTable();});
document.getElementById('tabEcl').addEventListener('click',()=>{tableTab='ecl';renderTable();});
document.getElementById('mClose').addEventListener('click',()=>modalBg.classList.remove('open'));
modalBg.addEventListener('click',e=>{if(e.target===modalBg)modalBg.classList.remove('open');});
document.getElementById('yPrev').addEventListener('click',()=>{tableYear--;renderTable();});
document.getElementById('yNext').addEventListener('click',()=>{tableYear++;renderTable();});

/* ══════════════════════════════════════════════════════════
   7. 語系切換
   ══════════════════════════════════════════════════════════ */
const UI_STR={
  uiTime:['時刻','Time'], uiSpeed:['速度','Speed'], uiLat:['緯度','Lat'], uiLon:['經度','Lon'],
  nowBtn:['切現在','Jump now'],
  resetViewBtn:['回初始位','Initial view'],
  retroTableBtn:['時刻表','Almanac'],
  tabRetro:['行星逆行','Retrogrades'],
  tabEcl:['日月食','Eclipses'],
  chipL:['日心視角 · SOLAR SYSTEM','HELIOCENTRIC · SOLAR SYSTEM'],
  chipR:['地平視角 · SKY VIEW','HORIZON · SKY VIEW'],
  uiTidal:['月球潮汐力示意','Lunar tidal forces'],
  uiSphere:['天球與星座','Celestial sphere & constellations'],
  uiSign:['十二宮區塊(隨歲差)','Zodiac sign sectors (precessing)'],
  uiExtraConst:['其他星座','More constellations'],
  uiViewBody:['觀察地','Observer'],
  micHint:['試著說: 導覽九大行星 / 介紹各個星座','Try: "Tour the nine planets" / "Introduce the constellations"'],
  micBtn:['AI語音命令','AI Voice'],
  uiOrbit:['軌道線','Orbit lines'],
  uiTrail:['逆行軌跡','Retrograde trail'], uiShow:['顯示','Show'],
  uiConst:['星座圖形','Constellation figures'],
  uiBgStar:['背景星空','Background stars'],
  uiTrack:['軸置中','Axis lock'],
  uiInv:['反向拖曳','Invert drag'],
  uiHideHor:['隱藏地平線','Hide horizon'],
  uiTts:['唸出通知','Read notifications aloud'],
  uiHideBtn:['隱藏按鈕','Hide buttons'],
  uiTrailFx:['運動殘影(星軌)','Motion trails (star arcs)'],
  anchorHint:['＊ 周日運動已凍結(等效每天同一時刻觀測):日夜循環與昇落暫停;地平線仍是該時刻的真實地平',
    '* Diurnal motion frozen — like observing at the same clock time each day: day/night & risings pause; the horizon is still the true horizon for that instant'],
  homeBtn:['回到原點','Reset view'],
  uiObserve:['觀察','Observe'],
  uiLock:['鎖定','Lock'],
  uiDay:['日夜背景變化','Day–night background'],
  uiText:['文字標籤','Text labels'],
  uiEclLine:['黃道/白道/天球赤道線','Ecliptic / lunar / equator lines'],
  uiPhase:['月相與影錐','Moon phase & shadows'],
  uiScale:['正確比例(距離線性)','True scale (linear distances)'],
  uiFootTime:['模擬時刻','Sim time'], uiFootLoc:['觀測地','Observer'],
  uiHint:['拖曳旋轉 · 滾輪/雙指縮放 · 逆行軌跡:實線=過去 虛線=未來',
          'Drag to rotate · wheel / pinch to zoom · trail: solid = past, dashed = future'],
  uiModalTitle:['時刻表','Almanac'],
  thP:['行星','Planet'], thS:['開始逆行','Starts'], thE:['恢復順行','Ends'], thD:['期間','Duration']
};
const TRACK_STR=[['無置中','No axis'],['黃道軸・日出','Ecliptic · Sunrise'],['黃道軸・日沒','Ecliptic · Sunset'],
  ['白道軸・月出','Lunar orbit · Moonrise'],['白道軸・月沒','Lunar orbit · Moonset']];
const LOCK_STR=[['無鎖定','No lock'],['太陽','Sun'],['月亮','Moon']];
const VIEWBODY_STR=[['地球','Earth'],['月球','Moon'],['火星','Mars'],['泰坦','Titan']];
const SPEED_STR=[
  ['1 小時 / 秒','1 hr / s'],['2 小時 / 秒','2 hr / s'],
  ['3 小時 / 秒','3 hr / s'],['6 小時 / 秒','6 hr / s'],
  ['1 天 / 秒','1 day / s'],['3 天 / 秒','3 days / s'],['10 天 / 秒','10 days / s'],
  ['倒轉 1 天 / 秒','Reverse 1 day / s']
];
function applyLang(){
  const k=lang==='zh'?0:1;
  for(const id in UI_STR){
    const el=document.getElementById(id);
    if(el)el.textContent=UI_STR[id][k];
  }
  try{ notifyBtn.textContent=notifyOn?T('通知','Notify'):T('靜音','Muted'); }catch(e){} /* 初次呼叫早於宣告,略過 */
  try{ paneModeBtn.textContent=PANE_STR[paneMode][lang==='zh'?0:1]; }catch(e){}
  const sp=document.getElementById('speed');
  [...sp.options].forEach((o,i)=>o.textContent=SPEED_STR[i][k]);
  const ts=document.getElementById('trackSel');
  const TRACK_BY_VAL={off:0,ecl_e:1,ecl_w:2,lun_e:3,lun_w:4};
  [...ts.options].forEach(o=>{const idx=TRACK_BY_VAL[o.value]; if(idx!=null)o.textContent=TRACK_STR[idx][k];});
  [...obsSel.options].forEach(o=>{
    if(o.value==='none')o.textContent='—';
    else if(o.value==='sun')o.textContent=T('太陽','Sun');
    else if(o.value==='moon')o.textContent=T('月球','Moon');
    else o.textContent=pname(+o.value.slice(1));
  });
  const vb=document.getElementById('viewBodySel');
  [...vb.options].forEach((o,i)=>o.textContent=VIEWBODY_STR[i][k]);
  const xl=document.getElementById('extraLvlSel');
  const XLVL_STR={min:['少','Few'],mid:['多','More'],all:['更多','All']};
  [...xl.options].forEach(o=>{ if(XLVL_STR[o.value])o.textContent=XLVL_STR[o.value][k]; });
  const ls=document.getElementById('lockSel');
  [...ls.options].forEach((o,i)=>{
    if(i<LOCK_STR.length)o.textContent=LOCK_STR[i][k];
    else if(o.value!=='sat'){const nm=o.value.slice(2);o.textContent=lang==='zh'? nm:ZODIAC[nm].en;}
  });
  if(typeof viewBody!=='undefined'&&viewBody==='moon'){
    const mo=[...ls.options].find(o=>o.value==='moon');
    if(mo)mo.textContent=T('地球','Earth');
  }
  {const so=[...ls.options].find(o=>o.value==='sat'); if(so)so.textContent=T('土星','Saturn');}
  const rs=document.getElementById('retroSel');
  [...rs.options].forEach(o=>{o.textContent=lang==='zh'?ELEM[+o.value].name:ELEM[+o.value].en;});
  setPlayLabel();
  try{ compassTitle(); }catch(e){}
  try{ syncViewBodyChip(); }catch(e){}
  if(eclipseState)eclipseChip.textContent=ECL_STR[eclipseState][lang==='zh'?0:1];
  lunarCd=NaN; /* 重算農曆顯示語言 */
  relabelAll();
  if(modalBg.classList.contains('open'))renderTable();
}
document.getElementById('langSel').addEventListener('change',e=>{
  lang=e.target.value;
  applyLang();
});

/* ══════════════════════════════════════════════════════════
   8. 時間、UI 與主迴圈
   ══════════════════════════════════════════════════════════ */
let simMs=Date.now(), playing=false;
let showTrail=false, dayNight=true; /* 逆行軌跡線預設關閉 */
const dtInput=document.getElementById('dt');
const playBtn=document.getElementById('playBtn');
const speedSel=document.getElementById('speed');
const latIn=document.getElementById('lat'), lonIn=document.getElementById('lon');
const timeRead=document.getElementById('timeReadout'), jdRead=document.getElementById('jdReadout');
const locRead=document.getElementById('locReadout');
const retroStat=document.getElementById('retroStatus');
const anchorHintEl=document.getElementById('anchorHint');
const zoomChip=document.getElementById('zoomChip');

/* ══ 指南針對準:用手機的方位感測器直接把地平視角指向你面對的天空 ══
   yaw 的定義與場景一致(0=正北、π/2=正東),所以只要把裝置四元數
   轉成視線向量,再取 atan2(x,-z) 就是方位角。
   iOS 的 alpha 原點是任意的,另外用 webkitCompassHeading(真北順時針)校正。 */
const compassBtn=document.getElementById('compassBtn');
let compassOn=false, compassGotEvent=false, compassOffset=null, compassWarnT=0, compassBusy=false;
const _cq0=new THREE.Quaternion();
const _cq1=new THREE.Quaternion(-Math.SQRT1_2,0,0,Math.SQRT1_2); /* 鏡頭朝機背 */
const _cEuler=new THREE.Euler(), _cQ=new THREE.Quaternion();
const _cZee=new THREE.Vector3(0,0,1), _cDir=new THREE.Vector3();

function screenAngleRad(){
  const a=(screen.orientation&&typeof screen.orientation.angle==='number')
    ? screen.orientation.angle : (window.orientation||0);
  return a*DEG;
}
function onDeviceOrient(e){
  if(!compassOn)return;
  if(e.alpha==null&&e.beta==null&&e.gamma==null)return;
  compassGotEvent=true;
  const a=(e.alpha||0)*DEG, b=(e.beta||0)*DEG, g=(e.gamma||0)*DEG;
  _cEuler.set(b,a,-g,'YXZ');
  _cQ.setFromEuler(_cEuler);
  _cQ.multiply(_cq1);
  _cQ.multiply(_cq0.setFromAxisAngle(_cZee,-screenAngleRad()));
  _cDir.set(0,0,-1).applyQuaternion(_cQ);
  let yaw=Math.atan2(_cDir.x,-_cDir.z);
  const pitch=Math.asin(Math.max(-1,Math.min(1,_cDir.y)));
  if(typeof e.webkitCompassHeading==='number'&&!isNaN(e.webkitCompassHeading)){
    compassOffset=e.webkitCompassHeading*DEG+a; /* yaw≈-a,加上這個偏移即真方位 */
  }
  if(compassOffset!==null)yaw+=compassOffset;
  ctrlR.yaw=yaw;
  ctrlR.pitch=Math.max(-0.45,Math.min(1.52,pitch));
  ctrlR.apply();
}
async function setCompass(on){
  if(compassBusy)return; 
  if(!!on===compassOn)return;
  if(on){
    if(!compassAllowed()){
      const i=VIEWBODY_ORDER.indexOf(viewBody);
      const nm=(i>=0?VIEWBODY_STR[i][lang==='zh'?0:1]:viewBody);
      toast(T(nm+'沒有指南針,請在地球上使用','No compass on '+nm+' — use it on Earth'),false,true);
      return;
    }
    if(typeof DeviceOrientationEvent==='undefined'){
      toast(T('這個瀏覽器沒有方位感測器','No orientation sensor in this browser'),false,true); return; }
    if(!window.isSecureContext){
      toast(T('方位感測需要 HTTPS 連線','Orientation sensors need HTTPS'),false,true); return; }
    if(typeof DeviceOrientationEvent.requestPermission==='function'){
      compassBusy=true;
      let res='denied';
      try{ res=await DeviceOrientationEvent.requestPermission(); }catch(err){ res='denied'; }
      compassBusy=false;
      if(res!=='granted'){
        toast(T('未取得方位感測權限,請在瀏覽器設定中允許「動作與方向」',
                'Motion & orientation access denied — allow it in browser settings'),false,true);
        return;
      }
    }
    cancelNav();
    lockMode='none'; lockSelEl.value='none';
    trackMode='off'; trackSelEl.value='off';
    compassGotEvent=false; compassOffset=null; compassOn=true;
    window.addEventListener('deviceorientationabsolute',onDeviceOrient,true);
    window.addEventListener('deviceorientation',onDeviceOrient,true);
    compassBtn.classList.add('on'); compassBtn.setAttribute('aria-pressed','true');
    toast(T('指南針對準開啟:把手機舉起來對準天空。方位不準時,拿著手機畫個 8 字校正磁力計。',
            'Compass aim on: hold your phone up toward the sky. Wave it in a figure-8 to calibrate.'),false,true);
    clearTimeout(compassWarnT);
    compassWarnT=setTimeout(()=>{
      if(compassOn&&!compassGotEvent)
        toast(T('收不到方位資料 — 桌機或不支援的瀏覽器請改用拖曳',
                'No orientation data — use drag on desktop or unsupported browsers'),false,true);
    },2500);
  }else{
    compassOn=false;
    clearTimeout(compassWarnT);
    window.removeEventListener('deviceorientationabsolute',onDeviceOrient,true);
    window.removeEventListener('deviceorientation',onDeviceOrient,true);
    compassBtn.classList.remove('on'); compassBtn.setAttribute('aria-pressed','false');
    ctrlR.syncFromCamera();
    toast(T('指南針對準關閉','Compass aim off'),false,true);
  }
}
compassBtn.addEventListener('click',()=>setCompass(!compassOn));

/* ══ 地平視角左下角:觀察地(與左窗 viewBodySel 同一個真實狀態,點一下換下一顆) ══ */
const viewBodyBtn=document.getElementById('viewBodyBtn');
const viewBodyChip=document.getElementById('viewBodyChip');
const VIEWBODY_ORDER=['earth','moon','mars','titan'];
/* 每個觀察地一個顏色:地球藍、月球白、火星紅、泰坦土黃,圖示與名牌同時上色 */
const VIEWBODY_COLOR={earth:'#4F8FE6',moon:'#E8ECF5',mars:'#E0714F',titan:'#E3B34C'};
function syncViewBodyChip(){
  const sel=document.getElementById('viewBodySel');
  const i=VIEWBODY_ORDER.indexOf(sel.value);
  const nm=(typeof VIEWBODY_STR!=='undefined'&&i>=0)?VIEWBODY_STR[i][lang==='zh'?0:1]:sel.value;
  const lbl=document.getElementById('viewBodyLbl');
  if(lbl)lbl.textContent=T('觀察地','Observer');   /* 圖示旁的固定字樣 */
  viewBodyChip.textContent=nm;                     /* 右邊名牌寫星球名,顏色也跟著換 */
  viewBodyBtn.title=T('觀察地:','Observer: ')+nm+T('(點一下換下一個)',' (click to switch)');
  const dock=viewBodyBtn.parentElement;
  if(dock)dock.style.setProperty('--vb',VIEWBODY_COLOR[sel.value]||'#6FC3D6');
  try{ syncCompassAvail(); }catch(_){}   /* compassBtn 宣告在後面,首次呼叫時略過 */
}
/* 指南針只在地球有意義:別的星球沒有地磁,手機的方位角也對不上那顆星球的天球 */
function compassAllowed(){ return viewBody==='earth'; }
function syncCompassAvail(){
  const ok=compassAllowed();
  compassBtn.classList.toggle('disabled',!ok);
  compassBtn.setAttribute('aria-disabled',ok?'false':'true');
  if(!ok&&compassOn)setCompass(false);
  compassTitle();
}
viewBodyBtn.addEventListener('click',()=>{
  const sel=document.getElementById('viewBodySel');
  const i=VIEWBODY_ORDER.indexOf(sel.value);
  sel.value=VIEWBODY_ORDER[(i+1)%VIEWBODY_ORDER.length];
  sel.dispatchEvent(new Event('change'));
});

/* ══ 隱藏按鈕:收掉地平視角下方所有控制(觀察地/指南針/視野),面板鈕縮成箭頭 ══ */
document.getElementById('hideBtnChk').addEventListener('change',e=>{
  document.getElementById('paneR').classList.toggle('btnHidden',e.target.checked);
});
function compassTitle(){
  compassBtn.title=compassAllowed()
    ?T('指南針對準(手機:對準真實天空)','Compass aim (mobile: point at the real sky)')
    :T('指南針只能在地球上使用','Compass aim only works on Earth');
}
compassTitle();
syncCompassAvail();   /* compassBtn 已就緒,補做一次(前面 syncViewBodyChip 呼叫時它還沒宣告) */

function pad(n){return String(n).padStart(2,'0');}
function setDtInput(ms){
  const d=new Date(ms);
  dtInput.value=`${String(d.getFullYear()).padStart(4,'0')}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
setDtInput(simMs);
dtInput.addEventListener('change',()=>{const v=new Date(dtInput.value);if(!isNaN(v)){simMs=v.getTime();}});
document.getElementById('nowBtn').addEventListener('click',()=>{simMs=Date.now();setDtInput(simMs);});
function setPlayLabel(){
  playBtn.classList.toggle('is-playing',playing);
  document.getElementById('playLbl').textContent=playing?T('暫停','Pause'):T('播放','Play');
}
playBtn.addEventListener('click',()=>{playing=!playing;setPlayLabel();});
document.getElementById('tidalChk').addEventListener('change',e=>tidalGroup.visible=e.target.checked);
document.getElementById('phaseChk').addEventListener('change',e=>{
  moonLit.visible=umbraCone.visible=mShadowCone.visible=e.target.checked;
});
document.getElementById('textChk').addEventListener('change',e=>{
  for(const L of labelsR){ if(L.getText) L.sp.visible=e.target.checked; }
});
document.getElementById('sphereChk').addEventListener('change',e=>sphereGroup.visible=e.target.checked);
document.getElementById('signChk').addEventListener('change',e=>{
  signBelt.visible=e.target.checked;                       /* 日心:彩色區塊 */
  if(signSkyGroup)signSkyGroup.visible=e.target.checked;   /* 地平:虛線分界+文字 */
});
const EXTRA_LVL={min:1,mid:2,all:3};
function applyExtraLevel(){
  const on=document.getElementById('extraConstChk').checked;
  const lv=EXTRA_LVL[document.getElementById('extraLvlSel').value]||3;
  extraGroupR.visible=on; window._extraGroupL.visible=on;
  for(let i=0;i<3;i++){
    if(window._extraTierR[i])window._extraTierR[i].visible=(i<lv);
    if(window._extraTierL[i])window._extraTierL[i].visible=(i<lv);
  }
}
/* 導覽到某個星座時,若它的層級沒開就自動放寬到看得見為止 */
function ensureExtraVisible(nm){
  const c=EXTRA_CONST[nm]; if(!c)return;
  const sel=document.getElementById('extraLvlSel');
  const want=c.t||3;
  if((EXTRA_LVL[sel.value]||3)<want){
    sel.value=want===1?'min':want===2?'mid':'all';
  }
  applyExtraLevel();
}
document.getElementById('extraConstChk').addEventListener('change',applyExtraLevel);
document.getElementById('extraLvlSel').addEventListener('change',applyExtraLevel);
applyExtraLevel(); /* 開場先對齊一次(預設:已勾選、層級=少 —— 一開場就看得到幾個好認的星座) */
document.getElementById('orbitChk').addEventListener('change',e=>orbitGroup.visible=e.target.checked);
const camStateN={r:CAM_REF,theta:0.55,phi:1.05,tx:0,ty:0,tz:0};
const camStateT={r:2200,theta:0.55,phi:1.05,tx:0,ty:0,tz:0};
function saveCam(st){st.r=ctrlL.r;st.theta=ctrlL.theta;st.phi=ctrlL.phi;
  st.tx=ctrlL.target.x;st.ty=ctrlL.target.y;st.tz=ctrlL.target.z;}
function loadCam(st){ctrlL.r=Math.max(ctrlL.min,Math.min(ctrlL.max,st.r));
  ctrlL.theta=st.theta;ctrlL.phi=st.phi;ctrlL.target.set(st.tx,st.ty,st.tz);ctrlL.apply();}
document.getElementById('scaleChk').addEventListener('change',e=>{
  saveCam(trueScale?camStateT:camStateN); /* 保存離開模式的視角 */
  trueScale=e.target.checked;
  applyScaleMode();                        /* 還原進入模式的視角(互不影響) */
});
constGroupR.visible=true;   /* 星座圖形已無開關,永遠顯示 */
document.getElementById('bgStarChk').addEventListener('change',e=>starsR.visible=e.target.checked);
/* 運動殘影選項:僅速度 ≥1 天/秒時顯示;開啟時強制並鎖定
   日夜背景=關、參考線=關、文字標籤=關、隱藏地平線=開(避免文字殘影) */
const trailFxChk=document.getElementById('trailFxChk');
const trailFxRow=document.getElementById('trailFxRow');
const dayChkEl=document.getElementById('dayChk');
const eclLineChkEl=document.getElementById('eclLineChk');
const textChkEl=document.getElementById('textChk');
const hideHorChkEl=document.getElementById('hideHorChk');
function setChk(el,v){ if(el.checked!==v){ el.checked=v; el.dispatchEvent(new Event('change')); } }
function toggleTrailFx(on){
  trailFxOn=on;
  const locked=[dayChkEl,eclLineChkEl,textChkEl,hideHorChkEl];
  if(on){
    trailFxSaved={day:dayChkEl.checked,ecl:eclLineChkEl.checked,text:textChkEl.checked,hor:hideHorChkEl.checked};
    setChk(dayChkEl,false); setChk(eclLineChkEl,false); setChk(textChkEl,false); setChk(hideHorChkEl,true);
    locked.forEach(el=>el.disabled=true);
  }else{
    locked.forEach(el=>el.disabled=false);
    if(trailFxSaved){
      setChk(dayChkEl,trailFxSaved.day); setChk(eclLineChkEl,trailFxSaved.ecl);
      setChk(textChkEl,trailFxSaved.text); setChk(hideHorChkEl,trailFxSaved.hor);
      trailFxSaved=null;
    }
    needTrailClear=true;
  }
}
trailFxChk.addEventListener('change',e=>toggleTrailFx(e.target.checked));
function updateTrailFxRow(){
  const hs=Math.abs(+speedSel.value)>=86400000;
  trailFxRow.style.display=hs?'':'none';
  if(!hs&&trailFxOn){ trailFxChk.checked=false; toggleTrailFx(false); }
}
speedSel.addEventListener('change',updateTrailFxRow);
document.getElementById('hideHorChk').addEventListener('change',e=>{
  hideHorizon=e.target.checked;
  horizonGroup.visible=!hideHorizon;
});
document.getElementById('eclLineChk').addEventListener('change',e=>{
  showEclLines=e.target.checked;
  eclLineR.visible=showEclLines;
  eqLineR.visible=showEclLines;
  window._eqLbl.visible=showEclLines;
  window._eclLbl.visible=showEclLines;
  if(moonPathLine)moonPathLine.visible=showEclLines;
  moonPathLbl.visible=showEclLines;
});
/* 星座質心(J2000 赤道單位向量)供鎖定用;動態加入下拉選項 */
const CONST_CENTROIDS={};
{
  const ls0=document.getElementById('lockSel');
  for(const name in ZODIAC){
    const cen=new THREE.Vector3();
    ZODIAC[name].s.forEach(st=>cen.add(eqUnit(st[0]*DEG,st[1]*DEG)));
    CONST_CENTROIDS[name]=cen.normalize();
    const o=document.createElement('option');
    o.value='c:'+name; o.textContent=name;
    ls0.appendChild(o);
  }
}
const trackSelEl=document.getElementById('trackSel');
const lockSelEl=document.getElementById('lockSel');
function applyTrack(){
  /* 軸置中(黃道/白道 × 東/西)與鎖定可並用 */
  trackMode=trackSelEl.value;
  lockMode=lockSelEl.value;
  if(trackMode==='off'&&lockMode==='none'){ camR.up.set(0,1,0); ctrlR.syncFromCamera(); }
}
applyTrack();
trackSelEl.addEventListener('change',applyTrack);
lockSelEl.addEventListener('change',()=>{
  applyTrack();
  /* 鎖定星座時,左窗也飛過去(穿過太陽看它本體)並點亮連線;
     「巨蟹座在哪」這種問句多半只會設 lockSel,不設就只有右窗會動 */
  const v=lockSelEl.value;
  if(typeof v==='string'&&v.startsWith('c:'))focusConstellation(v.slice(2));
});
document.getElementById('invChk').addEventListener('change',e=>invDrag=e.target.checked);
document.getElementById('dayChk').addEventListener('change',e=>dayNight=e.target.checked);
document.getElementById('retroSel').addEventListener('change',e=>{trailPlanet=+e.target.value;rebuildTrail(simMs);});
document.getElementById('trailChk').addEventListener('change',e=>{
  showTrail=e.target.checked;
  if(trailPast){trailPast.visible=trailFuture.visible=showTrail;trailMarks.forEach(m=>m.visible=showTrail);}
});
latIn.addEventListener('change',updateLoc); lonIn.addEventListener('change',updateLoc);
function updateLoc(){
  const la=+latIn.value, lo=+lonIn.value;
  locRead.textContent=`${Math.abs(la).toFixed(2)}°${la>=0?'N':'S'} ${Math.abs(lo).toFixed(2)}°${lo>=0?'E':'W'}`;
  /* 紅點=觀測者經緯度;依觀察地放在對應星體表面(地球隨 GMST 自轉,赤經=GMST+λ 正確對應;
     其他觀察地為示意擺放) */
  const laR=la*DEG, loR=lo*DEG;
  const rD={earth:1.55, moon:0.60, mars:(ELEM[3].size*1.1), titan:0.34}[viewBody]||1.55;
  window._obsDot.position.set(rD*Math.cos(laR)*Math.cos(loR), rD*Math.sin(laR), -rD*Math.cos(laR)*Math.sin(loR));
}

const lunarRead=document.getElementById('lunarRead');
let lunarCd=NaN;
const skyMat4=new THREE.Matrix4();
const bgNight=new THREE.Color(0x060912), bgDay=new THREE.Color(0x2E4E86);
/* 各觀察地天空色(依大氣物理):
   月球=無大氣 → 白天天空依然全黑(僅地表被照亮);
   火星=稀薄 CO₂ + 塵埃 → 白晝呈奶油棕(butterscotch),夜近黑;
   泰坦=1.45 atm 濃厚 N₂/CH₄ + 光化學霾(tholins)→ 永恆的昏暗橙光,
        白晝亮度僅地球的千分之一,如深沉暮色 */
const BG_DAY={earth:bgDay, moon:new THREE.Color(0x050608), mars:new THREE.Color(0xB06A38), titan:new THREE.Color(0x8A4E1C)};
const BG_NIGHT={earth:bgNight, moon:new THREE.Color(0x050608), mars:new THREE.Color(0x150A0B), titan:new THREE.Color(0x1E1006)};
const bgCur=new THREE.Color(0x060912);
sceneR.background=bgCur;
/* 運動殘影(高速播放):以半透明底色淡出前幀取代清屏,
   周日旋轉在畫面上化為連續的「長曝星軌」——快而平滑,而非頻閃 */
const fadeScene=new THREE.Scene();
const fadeCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const fadeMat=new THREE.MeshBasicMaterial({color:0x060912,transparent:true,opacity:0.3,depthTest:false,depthWrite:false});
fadeScene.add(new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2),fadeMat));
let trailsPrev=false, needTrailClear=true;
let trailFxOn=false, trailFxSaved=null;
const sunWorld=new THREE.Vector3(), moonWorld=new THREE.Vector3(), earthWorld=new THREE.Vector3(), satWorld=new THREE.Vector3();
const camFwdR=new THREE.Vector3(), tmpVR=new THREE.Vector3();
const camRgt=new THREE.Vector3(), camUpv=new THREE.Vector3();
const mhatV=new THREE.Vector3(), qV=new THREE.Vector3();

let lastReal=performance.now(), uiTick=0, flyHeld=0;
let lstAnchorOn=false, lstAnchorKey='', lstH0=0; /* 錨定恆星時狀態 */
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min(0.1,(now-lastReal)/1000); lastReal=now;
  if(playing){ simMs+=(+speedSel.value)*dt; }
  updateNav(dt);
  if(trueScale&&(moveKeys.w||moveKeys.s||moveKeys.a||moveKeys.d)){
    cancelNav();
    flyHeld+=dt;
    const boost=1+Math.min(5,flyHeld*1.4); /* 長按才漸加速,起步更緩,最多 6 倍 */
    ctrlL.move((moveKeys.w?1:0)-(moveKeys.s?1:0),(moveKeys.d?1:0)-(moveKeys.a?1:0),dt,boost);
    if(observeIdx!=='none'){observeIdx='none';obsSel.value='none';} /* 手動飛行即脫離跟隨 */
  }else flyHeld=0;
  const nearL=Math.min(0.1,Math.max(0.0008,ctrlL.r*0.02));
  if(Math.abs(camL.near-nearL)>nearL*0.2){ camL.near=nearL; camL.updateProjectionMatrix(); }

  const T2=centuries(simMs);
  const psi=psiDeg(simMs)*DEG;
  /* ── 左 ── */
  const heliosW=[];
  for(let i=0;i<ELEM.length;i++){
    const w=mapR(eclToWorld(helio(i,T2)));
    planetMeshes[i].position.copy(w);
    heliosW.push(w);
  }
  /* 地軸隨歲差進動 */
  const lamP=Math.PI/2 - psi, se=Math.sin(OBLQ);
  const axisW=eclToWorld({x:se*Math.cos(lamP), y:se*Math.sin(lamP), z:Math.cos(OBLQ)});
  earthMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axisW);
  poleMark.position.copy(axisW).multiplyScalar(SPHERE_R*0.98);
  signBelt.rotation.y=-psi;
  earthSpin.rotation.y=gmstDeg(simMs)*DEG;
  if(viewBody!=='earth'&&obsSpinGroups[viewBody]){
    /* 與地平座標所用自轉角相同,紅點位置與天空同步 */
    obsSpinGroups[viewBody].rotation.y=2*Math.PI*(days(simMs)/OBS_SPIN[viewBody]);
  }
  if(window._earthSkySpin)window._earthSkySpin.rotation.y=gmstDeg(simMs)*DEG;
  /* 衛星公轉(週期與順/逆行方向真實) */
  {
    const dNow=days(simMs);
    for(const sm of satMoons){
      const a=2*Math.PI*(dNow/sm.per);
      /* 方向修正:順行衛星自黃道北望為逆時針(與行星公轉同向);崔頓 per<0 → 順時針(逆行) */
      sm.mesh.position.set(Math.cos(a)*sm.R,-Math.sin(a)*sm.R,0);
    }
  }
  if(trueScale){
    const arr=markerPts.geometry.attributes.position.array;
    for(let i=0;i<ELEM.length;i++){arr[i*3]=heliosW[i].x;arr[i*3+1]=heliosW[i].y;arr[i*3+2]=heliosW[i].z;}
    /* 月球標記在月球更新後寫入(見下方) */
    markerPts.geometry.attributes.position.needsUpdate=true;
  }
  const mg=moonGeo(T2);
  const mdir=eclToWorld(mg).normalize();
  const ew=heliosW[EARTH_IDX];
  moonMesh.position.copy(ew).addScaledVector(mdir,moonVisR);
  if(trueScale){
    const arr=markerPts.geometry.attributes.position.array, o=ELEM.length*3;
    arr[o]=moonMesh.position.x;arr[o+1]=moonMesh.position.y;arr[o+2]=moonMesh.position.z;
  }
  /* 觀察跟隨:樞紐點鎖在所選天體上,隨其公轉移動 */
  if(trueScale&&observeIdx!=='none'){
    if(observeIdx==='sun')ctrlL.target.set(0,0,0);
    else if(observeIdx==='moon')ctrlL.target.copy(moonMesh.position);
    else ctrlL.target.copy(planetMeshes[+observeIdx.slice(1)].position);
    ctrlL.apply();
  }
  /* 月相亮半球朝向太陽(太陽在原點) */
  if(moonLit.visible){
    const toSun=moonMesh.position.clone().negate().normalize();
    moonLit.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),toSun);
  }
  /* 影錐:地影錐沿反日方向、月影錐沿日→月延伸 */
  if(umbraCone.visible){
    const ewn=ew.clone().normalize(); /* 反日方向 */
    umbraCone.position.copy(ew).addScaledVector(ewn,umbraHalf);
    umbraCone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),ewn);
    const mn=moonMesh.position.clone().normalize();
    mShadowCone.position.copy(moonMesh.position).addScaledVector(mn,mShadHalf);
    mShadowCone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),mn);
  }
  updateSeg(moonLine,ew,moonMesh.position);
  updateSeg(axisLine,ew.clone().divideScalar(sphereScale), axisW.clone().multiplyScalar(SPHERE_R*0.98));
  if(tidalGroup.visible){
    tidalGroup.position.copy(ew);
    const u=mdir.clone(); u.y=0; u.normalize();
    const wv=new THREE.Vector3(-u.z,0,u.x);
    for(let k=0;k<12;k++){
      const th=k/12*2*Math.PI;
      const p=u.clone().multiplyScalar(Math.cos(th)).addScaledVector(wv,Math.sin(th));
      const acc=u.clone().multiplyScalar(3*Math.cos(th)).sub(p).normalize();
      const mag=Math.sqrt(1+3*Math.cos(th)*Math.cos(th));
      tidalArrows[k].position.copy(p).multiplyScalar(2.2);
      tidalArrows[k].setDirection(acc);
      tidalArrows[k].setLength(1.4+1.5*mag/2,0.9,0.5);
    }
    tidalBulge.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),u);
  }
  for(const L of labelsL){
    L.sp.getWorldPosition(sunWorld); /* 借用暫存向量 */
    let f=Math.max(0.00001,Math.min(250,sunWorld.distanceTo(camL.position)/CAM_REF)); /* 深潛特寫時文字維持恆定螢幕大小 */
    L.sp.parent.getWorldScale(tmpVR);       /* 抵銷母體(行星)縮放 */
    f/=Math.max(1e-6,tmpVR.x);
    L.sp.scale.set(L.base.x*f,L.base.y*f,1);
  }

  /* ── 右 ── */
  /* 滑順優先的抖動修復:高速播放(≥1 天/秒)且鎖定/置中時,
     周日旋轉(360°/日)的取樣混疊會造成頻閃。捨棄逐日跳格,
     改用「錨定恆星時」:LST 跟隨錨定天體(日/月/星座)的赤經,
     加上進入當下凍結的時角差 H0——錨定目標的周日位置連續固定,
     其餘天體以真實逐日速率平滑流動,任何速度下皆為 60fps 連續動畫。 */
  const TR=T2, psiR=psi, mgR=mg;
  starFrameR.quaternion.setFromAxisAngle(ECL_POLE_EQ, psiR);
  const phi=(+latIn.value||0)*DEG;
  if(viewBody==='earth'){
    const trueLstDeg=wrap360(gmstDeg(simMs)+(+lonIn.value||0));
    let lstDeg=trueLstDeg;
    const anchorActive = playing && Math.abs(+speedSel.value)>=86400000
          && (lockMode!=='none'||trackMode!=='off');
    if(anchorActive){
      let aKey;
      if(lockMode==='sun') aKey='sun';
      else if(lockMode==='moon') aKey='moon';
      else if(lockMode!=='none') aKey=lockMode;                 /* 鎖定星座 */
      else aKey=trackMode.startsWith('lun')? 'moon' : 'sun';    /* 純軸置中 */
      let raDeg;
      if(aKey==='sun'){
        const e=eclToEq(rotEclZ(geoEcl('sun',TR),psiR));
        raDeg=wrap360(Math.atan2(e.y,e.x)/DEG);
      }else if(aKey==='moon'){
        const e=eclToEq(rotEclZ(mgR,psiR));
        raDeg=wrap360(Math.atan2(e.y,e.x)/DEG);
      }else{
        const c=tmpVR.copy(CONST_CENTROIDS[aKey.slice(2)]).applyQuaternion(starFrameR.quaternion);
        raDeg=wrap360(Math.atan2(c.y,c.x)/DEG);
      }
      if(!lstAnchorOn||lstAnchorKey!==aKey){ /* 進入(或換錨)當下無縫接軌 */
        lstAnchorOn=true; lstAnchorKey=aKey;
        lstH0=wrap360(trueLstDeg-raDeg);
      }
      lstDeg=wrap360(raDeg+lstH0);
    }else{ lstAnchorOn=false; }
    const lst=lstDeg*DEG;
    const sL=Math.sin(lst),cL=Math.cos(lst),sP=Math.sin(phi),cP=Math.cos(phi);
    skyMat4.set(
      -sL,     cL,     0,   0,
      cL*cP,   sL*cP,  sP,  0,
      cL*sP,   sL*sP, -cP,  0,
      0,0,0,1);
  }else{
    /* 其他觀察地:以該天體自轉極 P 與均勻自轉角 θ 建構地平座標。
       節點方向 N=eclZ×P 為經度原點(各天體本初子午線取任意零點),
       û=觀測者天頂、ê=東、ŝ=ê×û=南;基底轉回赤道座標後填入矩陣。 */
    lstAnchorOn=false;
    const P=OBS_POLE[viewBody];
    const th=2*Math.PI*(days(simMs)/OBS_SPIN[viewBody]) + (+lonIn.value||0)*DEG;
    let N={x:-P.y,y:P.x,z:0};
    let nl=Math.hypot(N.x,N.y,N.z);
    if(nl<1e-6){N={x:1,y:0,z:0};nl=1;}
    N={x:N.x/nl,y:N.y/nl,z:N.z/nl};
    const B={x:P.y*N.z-P.z*N.y, y:P.z*N.x-P.x*N.z, z:P.x*N.y-P.y*N.x};
    const ct=Math.cos(th), st=Math.sin(th), cP2=Math.cos(phi), sP2=Math.sin(phi);
    const uE={x:cP2*(ct*N.x+st*B.x)+sP2*P.x, y:cP2*(ct*N.y+st*B.y)+sP2*P.y, z:cP2*(ct*N.z+st*B.z)+sP2*P.z};
    const eE={x:-st*N.x+ct*B.x, y:-st*N.y+ct*B.y, z:-st*N.z+ct*B.z};
    const sE={x:eE.y*uE.z-eE.z*uE.y, y:eE.z*uE.x-eE.x*uE.z, z:eE.x*uE.y-eE.y*uE.x};
    const e1=eclToEq(eE), u1=eclToEq(uE), s1=eclToEq(sE);
    skyMat4.set(
      e1.x, e1.y, e1.z, 0,
      u1.x, u1.y, u1.z, 0,
      s1.x, s1.y, s1.z, 0,
      0,0,0,1);
  }
  skyGroup.matrix.copy(skyMat4);

  let sunAlt=-1;
  /* 觀察地在黃道座標中的位置(AU) */
  const ePos=helio(EARTH_IDX,TR);
  let obsV;
  if(viewBody==='earth')obsV=ePos;
  else if(viewBody==='moon'){
    const L=Math.hypot(mgR.x,mgR.y,mgR.z)||1, k2=mgR.distKm/AU_KM/L;
    obsV={x:ePos.x+mgR.x*k2, y:ePos.y+mgR.y*k2, z:ePos.z+mgR.z*k2};
  }else if(viewBody==='mars')obsV=helio(3,TR);
  else{ /* 泰坦:土星 + 真實軌道半徑 0.00817 AU、週期 15.945 日 */
    const sp=helio(5,TR), aT=2*Math.PI*days(simMs)/15.945;
    obsV={x:sp.x+Math.cos(aT)*0.008168, y:sp.y+Math.sin(aT)*0.008168, z:sp.z};
  }
  /* 各觀察地隱藏清單:所在天體本身;火星/泰坦距地月系遙遠,
     月亮緊貼地球無法分辨 → 不顯示 */
  const hideKs={earth:[EARTH_IDX], moon:['moon'], mars:[3,'moon'], titan:['moon']}[viewBody];
  for(const b of skyBodies){
    b.grp.visible=!hideKs.includes(b.key);
    if(!b.grp.visible)continue;
    let g;
    if(b.key==='sun')g={x:-obsV.x,y:-obsV.y,z:-obsV.z};
    else if(b.key==='moon'){
      const L=Math.hypot(mgR.x,mgR.y,mgR.z)||1, k2=mgR.distKm/AU_KM/L;
      g={x:ePos.x+mgR.x*k2-obsV.x, y:ePos.y+mgR.y*k2-obsV.y, z:ePos.z+mgR.z*k2-obsV.z};
    }else{
      const h=helio(b.key,TR);
      g={x:h.x-obsV.x, y:h.y-obsV.y, z:h.z-obsV.z};
    }
    const distAU=Math.hypot(g.x,g.y,g.z);
    const e=eclToEq(rotEclZ(g,psiR));
    const v=new THREE.Vector3(e.x,e.y,e.z).normalize().multiplyScalar(DOME*0.9);
    b.grp.position.copy(v);
    if(b.dot){ /* 視大小:依真實角尺寸放大(近距天體變大),下限=原點大小 */
      const Rkm=b.key==='sun'?696000: b.key==='moon'?1737.4: TRUE_KM[b.key];
      const sc=(DOME*0.9)*Math.atan((Rkm/AU_KM)/Math.max(distAU,1e-9))/b.dotR;
      b.dot.scale.setScalar(Math.min(60,Math.max(1,sc)));
    }
    v.applyMatrix4(skyMat4);
    const below=!hideHorizon && v.y<0;
    const opBase=(viewBody==='titan')?0.82:1; /* 泰坦霾層:整體略降 */
    b.mat.opacity=below?0.22:opBase;
    b.lbl.material.opacity=below?0.28:opBase;
    if(b.key==='sun'){ sunAlt=v.y/(DOME*0.9); sunWorld.copy(v); }
    if(b.key==='moon'){ moonWorld.copy(v); }
    if(b.key===EARTH_IDX){ earthWorld.copy(v); }
    if(b.key===5){ satWorld.copy(v); }
  }
  if(moonPathLine)moonPathLine.visible=showEclLines&&viewBody==='earth';
  moonPathLbl.visible=showEclLines&&viewBody==='earth';
  /* 月相更新與亮面朝向 */
  {
    const el=Math.abs(wrap180(mgR.lon - geoLon('sun',TR)));
    const bk=Math.round(el/2);
    if(bk!==phaseBucket){
      phaseBucket=bk;
      let tex=phaseTexCache.get(bk);
      if(!tex){ tex=drawPhase(el); phaseTexCache.set(bk,tex); }
      moonSprite.material.map=tex;
      moonSprite.material.needsUpdate=true;
    }
  }
  sunDirLight.position.copy(sunWorld); /* 行星光影朝向太陽 */
  /* 月食呈現(地球觀察地):本影盤在反日點,半徑=本影角半徑/月角半徑 × 月盤 */
  const lunEcl=(eclipseState==='lunarT'||eclipseState==='lunarP');
  if(viewBody==='earth'&&lunEcl){
    umbraSprite.position.copy(skyBodies[0].grp.position).multiplyScalar(-1);
    const rmA=Math.atan(1737.4/mgR.distKm);
    const parA=Math.asin(6378/mgR.distKm);
    const uA=1.02*(parA-0.00465+0.0000426);
    umbraSprite.scale.setScalar(moonSprite.scale.x*uA/rmA);
    umbraSprite.visible=true;
  }else umbraSprite.visible=false;
  moonSprite.material.color.setHex(eclipseState==='lunarT'?0xC96A50: eclipseState==='lunarP'?0xE0CFC8 :0xffffff);
  /* 月球觀察地:月食=地球遮日,地球呈背光暗面+大氣折射紅環 */
  if(window._earthRim){
    window._earthRim.visible=(viewBody==='moon'&&lunEcl);
    if(window._earthRim.visible){
      const eb2=window._earthSkyBody;
      window._earthRim.scale.setScalar(eb2.dotR*eb2.dot.scale.x*3.4);
    }
  }
  /* 置中滾轉軸:依選項取黃道北極或白道(月球軌道面)法向 */
  const axisPoleW=()=>{
    if(trackMode.startsWith('lun')){
      const m2g=moonGeo(TR+3/36525);
      const nEcl=new THREE.Vector3(mgR.x,mgR.y,mgR.z)
        .cross(new THREE.Vector3(m2g.x,m2g.y,m2g.z)).normalize();
      const ne=eclToEq(rotEclZ({x:nEcl.x,y:nEcl.y,z:nEcl.z},psiR));
      return new THREE.Vector3(ne.x,ne.y,ne.z).applyMatrix4(skyMat4);
    }
    return ECL_POLE_EQ.clone().applyMatrix4(skyMat4);
  };
  if(lockMode!=='none'){
    let tgt;
    if(lockMode==='sun')tgt=sunWorld;
    else if(lockMode==='moon')tgt=(viewBody==='moon')? earthWorld : moonWorld; /* 月球上=鎖定地球 */
    else if(lockMode==='sat')tgt=satWorld; /* 泰坦上鎖定土星 */
    else{ /* 鎖定星座:質心 → 歲差 → 地平座標 */
      tgt=tmpVR.copy(CONST_CENTROIDS[lockMode.slice(2)])
        .applyQuaternion(starFrameR.quaternion).applyMatrix4(skyMat4).multiplyScalar(DOME*0.9);
    }
    if(tgt.lengthSq()>1e-6){
      /* 以相機位置為原點瞄準天體世界座標:目標嚴格位於畫面正中央 */
      const aim=(tgt===tmpVR? tmpVR : tmpVR.copy(tgt)).sub(camR.position).normalize();
      if(trackMode!=='off'){
        /* 鎖定 + 置中:目標居中,滾轉使所選軌道面(黃道或白道)保持畫面縱向 */
        const up=new THREE.Vector3().crossVectors(axisPoleW(),aim);
        if(up.lengthSq()>1e-8){
          camR.up.copy(up.normalize());
          camR.lookAt(camR.position.x+aim.x, camR.position.y+aim.y, camR.position.z+aim.z);
        }
      }else{
        /* 純鎖定(無滾轉) */
        camR.up.set(0,1,0);
        ctrlR.pitch=Math.asin(Math.max(-1,Math.min(1,aim.y)));
        ctrlR.yaw=Math.atan2(aim.x,-aim.z);
        ctrlR.apply();
      }
    }
  }else if(trackMode!=='off'){
    /* 軸置中(無鎖定):視線沿所選軌道面自地平交點往上偏 trackOffset(垂直拖曳調整) */
    const nW=axisPoleW();
    let d=new THREE.Vector3(-nW.z,0,nW.x);
    if(d.lengthSq()>1e-6){
      d.normalize();
      const east=trackMode.endsWith('_e');
      if(east? d.x<0 : d.x>0) d.negate();
      const tRaw=new THREE.Vector3().crossVectors(nW,d).normalize();
      const sgn=tRaw.y>=0? 1 : -1;
      const co=Math.cos(trackOffset), si=Math.sin(trackOffset);
      const aim=d.clone().multiplyScalar(co).addScaledVector(tRaw,sgn*si);
      const up =d.clone().multiplyScalar(-si).addScaledVector(tRaw,sgn*co);
      camR.up.copy(up.normalize());
      camR.lookAt(camR.position.x+aim.x, camR.position.y+aim.y, camR.position.z+aim.z);
    }
  }
  let dayF=dayNight? Math.max(0,Math.min(1,(sunAlt+0.05)*4)) : 0;
  if(viewBody==='moon')dayF=0;      /* 無大氣無散射:白天天空仍黑 */
  if(viewBody==='titan')dayF*=0.9;  /* 濃霾吸收:白晝僅昏暗橙光 */
  bgCur.copy(BG_NIGHT[viewBody]).lerp(BG_DAY[viewBody],dayF);
  starsR.material.opacity=0.85*(1-dayF*0.92);
  /* 依視角補償(焦距比)+ 邊緣反補償:抵銷超廣角時直線透視在
     畫面外圈的放大(cos^1.6,留一點放大感但不誇張) */
  const fovF=Math.tan(camR.fov/2*DEG)/Math.tan(BASE_FOV/2*DEG);
  camR.updateMatrixWorld();
  camR.getWorldDirection(camFwdR);
  /* 月相亮緣方位角:以 3D 方向計算(太陽方向對月球方向的垂直分量,
     投影到相機的螢幕基底),不受太陽位於相機背後的投影翻轉影響 */
  {
    const eM=camR.matrixWorld.elements;
    camRgt.set(eM[0],eM[1],eM[2]); camUpv.set(eM[4],eM[5],eM[6]);
    mhatV.copy(moonWorld).normalize();
    qV.copy(sunWorld).normalize();
    qV.addScaledVector(mhatV,-qV.dot(mhatV)); /* 垂直於月球視線方向的太陽分量 */
    if(qV.lengthSq()>1e-8){
      moonSprite.material.rotation=Math.atan2(qV.dot(camUpv),qV.dot(camRgt));
    }
  }
  for(const L of labelsR){
    L.sp.getWorldPosition(tmpVR);
    tmpVR.sub(camR.position).normalize();
    const c=Math.max(0.12,Math.min(1,tmpVR.dot(camFwdR)));
    const f=fovF*Math.pow(c,1.6);
    L.sp.scale.set(L.base.x*f,L.base.y*f,1);
  }
  zoomChip.textContent=T('視野 ','FOV ')+ctrlR.zoom.toFixed(1)+'×';

  if(showTrail&&(isNaN(trailEpoch)||Math.abs(simMs-trailEpoch)>TRAIL_WIN[trailPlanet]*0.25*86400000)){
    rebuildTrail(simMs);
  }
  if(isNaN(moonPathEpoch)||Math.abs(simMs-moonPathEpoch)>5*86400000){
    buildMoonPath(simMs);
  }
  uiTick+=dt;
  if(uiTick>0.25){
    uiTick=0;
    checkRetroFlips();
    updateEclipse();
    updateTrailFxRow();
    anchorHintEl.style.display=(playing&&Math.abs(+speedSel.value)>=86400000&&(lockMode!=='none'||trackMode!=='off'))?'':'none';
    const retro=retroState[trailPlanet];
    retroStat.textContent=pname(trailPlanet)+(retro?T('・逆行中','· Retrograde'):T('・順行中','· Prograde'));
    retroStat.className=retro?'retro':'pro';
    const d=new Date(simMs);
    timeRead.textContent=`${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    jdRead.textContent=julianDay(simMs).toFixed(3);
    const cdNow=civilDay(simMs);
    if(cdNow!==lunarCd){ lunarCd=cdNow; lunarRead.textContent=formatLunar(simMs,lang); }
    if(playing&&document.activeElement!==dtInput)setDtInput(simMs);
  }

  rendL.render(sceneL,camL);
  /* 右視窗:高速時走殘影管線,否則正常清屏渲染 */
  const trailsActive = playing && trailFxOn && Math.abs(+speedSel.value)>=86400000;
  if(trailsActive!==trailsPrev){ trailsPrev=trailsActive; needTrailClear=true; }
  if(trailsActive){
    sceneR.background=null;
    const spd=Math.abs(+speedSel.value)/86400000;
    fadeMat.color.copy(bgCur);
    fadeMat.opacity=Math.max(0.10, 0.40/spd); /* 越快殘影越長 */
    rendR.autoClearColor=false;
    if(needTrailClear){ rendR.setClearColor(bgCur,1); rendR.clear(true,true,false); needTrailClear=false; }
    rendR.render(fadeScene,fadeCam);
    rendR.clearDepth();
    rendR.render(sceneR,camR);
  }else{
    rendR.autoClearColor=true;
    sceneR.background=bgCur;
    rendR.render(sceneR,camR);
  }
}

function resize(){
  [[paneL,rendL,camL],[paneR,rendR,camR]].forEach(([pane,r,cam])=>{
    const w=pane.clientWidth,h=pane.clientHeight;
    if(w===0||h===0)return;
    r.setSize(w,h,false);
    cam.aspect=w/h; cam.updateProjectionMatrix();
  });
}
/* 觀察星球:相機樞紐點跟隨所選天體(拖曳/縮放仍可自由調整) */
let observeIdx='none';
const obsSel=document.getElementById('obsSel');
{
  const addOpt=(v,t)=>{const o=document.createElement('option');o.value=v;o.textContent=t;obsSel.appendChild(o);};
  addOpt('sun','太陽');
  for(let i=0;i<ELEM.length;i++)addOpt('p'+i,ELEM[i].name);
  addOpt('moon','月球');
}
function observeBodyRadius(v){
  const k=K_TRUE/AU_KM;
  if(v==='sun')return 696000*k;
  if(v==='moon')return 1737.4*k;
  return TRUE_KM[+v.slice(1)]*k;
}
obsSel.addEventListener('change',()=>{
  observeIdx=obsSel.value;
  if(observeIdx!=='none'){
    ctrlL.r=Math.max(ctrlL.min,observeBodyRadius(observeIdx)*10); /* 進到 10 倍半徑的特寫距離 */
  }
});
document.getElementById('homeBtn').addEventListener('click',()=>{
  observeIdx='none'; obsSel.value='none';
  ctrlL.target.set(0,0,0); ctrlL.r=2200; ctrlL.theta=0.55; ctrlL.phi=1.05; ctrlL.apply();
});
/* 回初始位置:兩窗都回到開場狀態——地平視角面向正東、地平線之上;日心視角預設樞紐與距離 */
function resetInitialView(){
  cancelNav();
  if(typeof compassOn!=='undefined'&&compassOn)setCompass(false);
  observeIdx='none'; if(typeof obsSel!=='undefined'&&obsSel)obsSel.value='none';
  lockMode='none'; if(typeof lockSelEl!=='undefined'&&lockSelEl)lockSelEl.value='none';
  trackMode='off'; if(typeof trackSelEl!=='undefined'&&trackSelEl)trackSelEl.value='off';
  ctrlL.target.set(0,0,0); ctrlL.r=CAM_REF; ctrlL.theta=0.55; ctrlL.phi=1.05; ctrlL.apply();
  camR.up.set(0,1,0); ctrlR.setFov(93.4); ctrlR.yaw=Math.PI/2; ctrlR.pitch=0.35; ctrlR.apply();
  toast(T('回到初始視角','Reset to initial view'),false,true);
}
document.getElementById('resetViewBtn').addEventListener('click',resetInitialView);

/* ══════════════════════════════════════════════════════════
   AI 導覽:雙視窗鏡頭補間(單站 navigate / 多站 tour)
   左窗(日心)移動樞紐點並拉近;右窗(地平)轉向天體並縮小視野。
   目標位置每幀即時讀取,故追蹤移動中的行星。
   ══════════════════════════════════════════════════════════ */
const EN_BODY=['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto'];
const ZH_BODY={'水星':0,'金星':1,'地球':2,'火星':3,'木星':4,'土星':5,'天王星':6,'海王星':7,'冥王星':8};
const CONST_INDEX={};
(function(){
  const add=(a,nm)=>{ if(a)CONST_INDEX[String(a).trim().toLowerCase()]=nm; };
  for(const nm in ZODIAC){ add(nm,nm); add(nm.replace('座',''),nm); add(ZODIAC[nm].en,nm); }
  for(const nm in EXTRA_CONST){ add(nm,nm); add(EXTRA_CONST[nm].zh,nm); if(EXTRA_CONST[nm].zh)add(EXTRA_CONST[nm].zh.replace('座',''),nm); add(EXTRA_CONST[nm].en,nm); }
})();
function resolveBodyKey(x){
  if(x==null)return null;
  const xr=String(x).trim(); if(!xr)return null;
  const low=xr.toLowerCase();
  if(/^p[0-8]$/.test(low))return low;
  if(low==='sun'||xr==='太陽'||xr==='太阳'||xr==='日')return 'sun';
  if(low==='moon'||xr==='月球'||xr==='月亮'||xr==='月')return 'moon';
  const ei=EN_BODY.indexOf(low); if(ei>=0)return 'p'+ei;
  if(xr in ZH_BODY)return 'p'+ZH_BODY[xr];
  if(low==='outer'||low==='outermost'||xr==='最外圍'||xr==='最外围')return 'p8';
  if(low==='inner'||low==='innermost'||xr==='最內圍'||xr==='最内围')return 'p0';
  const cc=CONST_INDEX[low]; if(cc)return 'c:'+cc;
  return null;
}
function navName(key){
  if(typeof key==='string'&&key.startsWith('c:')){ const nm=key.slice(2); const c=ZODIAC[nm]||EXTRA_CONST[nm]; return c?T(c.zh||nm,c.en):nm; }
  if(key==='sun')return T('太陽','Sun');
  if(key==='moon')return T('月球','Moon');
  const i=+key.slice(1); return T(ELEM[i].name,ELEM[i].en);
}
function constDirEcl(nm){
  let u=CONST_CENTROIDS[nm];
  if(!u){ const c=ZODIAC[nm]||EXTRA_CONST[nm]; if(!c)return null;
    const cc=new THREE.Vector3(); c.s.forEach(st=>cc.add(eqUnit(st[0]*DEG,st[1]*DEG))); u=cc.normalize(); }
  return eqToEclWorld(u.clone()).normalize();   /* 星座質心 → 日心世界方向 */
}
/* 回傳左窗(日心)目標鏡頭狀態:行星=移動樞紐點並拉近;星座=穿過太陽飛到它前方,朝外看那片天球
   (樞紐點放在天球上的星座位置,鏡頭停在太陽與星座之間,太陽落在鏡頭背後;
    若把樞紐點留在原點,畫面正中央會是太陽,看起來像在導覽太陽而不是星座) */
function navL(key){
  if(typeof key==='string'&&key.startsWith('c:')){
    const g=constDirEcl(key.slice(2)); if(!g)return null;
    const Rw=SPHERE_R*(sphereGroup.scale.x||1);
    const phi=Math.max(0.05,Math.min(Math.PI-0.05,Math.acos(Math.max(-1,Math.min(1,-g.y)))));
    const theta=Math.atan2(-g.x,-g.z);
    /* 鏡頭位置 = target - g*r,所以 r 取 0.55Rw 會停在 0.43Rw 處(太陽在身後) */
    const r=Math.max(ctrlL.min,Math.min(ctrlL.max,Rw*0.55));
    return {target:g.clone().multiplyScalar(Rw*0.98),r,theta,phi};
  }
  let pos,rad;
  if(key==='sun'){ pos=new THREE.Vector3(0,0,0); rad=5; }
  else if(key==='moon'){ pos=moonMesh.position.clone(); rad=0.55*(moonMesh.scale.x||1); }
  else { const i=+key.slice(1); pos=planetMeshes[i].position.clone(); rad=ELEM[i].size*(planetMeshes[i].scale.x||1); }
  return {target:pos,r:Math.max(ctrlL.min,Math.min(ctrlL.max,rad*9))};
}
function navFaceR(key){
  if(typeof key==='string'&&key.startsWith('c:')){
    const nm=key.slice(2);
    let u=CONST_CENTROIDS[nm];
    if(!u){ const c=ZODIAC[nm]||EXTRA_CONST[nm]; if(!c)return null;
      const cc=new THREE.Vector3(); c.s.forEach(st=>cc.add(eqUnit(st[0]*DEG,st[1]*DEG))); u=cc.normalize(); }
    const d=u.clone().applyQuaternion(starFrameR.quaternion).applyMatrix4(skyMat4);
    if(d.lengthSq()<1e-9)return null; d.normalize();
    return {yaw:Math.atan2(d.x,-d.z),pitch:Math.asin(Math.max(-1,Math.min(1,d.y))),fov:40};
  }
  if(viewBody!=='earth')return null;             /* 行星/日月天空導向:目前僅地球 */
  let sb;
  if(key==='sun')sb=skyBodies.find(b=>b.key==='sun');
  else if(key==='moon')sb=skyBodies.find(b=>b.key==='moon');
  else{ const i=+key.slice(1); if(i===EARTH_IDX)return null; sb=skyBodies.find(b=>b.key===i); }
  if(!sb)return null;
  const wp=new THREE.Vector3(); sb.grp.getWorldPosition(wp);
  wp.sub(camR.position); if(wp.lengthSq()<1e-9)return null; wp.normalize();
  return {yaw:Math.atan2(wp.x,-wp.z),pitch:Math.asin(Math.max(-1,Math.min(1,wp.y))),fov:34};
}
let nav=null;
/* 導覽結束後不要把「鎖定中的星座」一起熄掉 */
function restoreHighlight(){
  if(typeof lockMode==='string'&&lockMode.startsWith('c:'))highlightConst(lockMode.slice(2));
  else clearConstHighlight();
}
function cancelNav(){ nav=null; restoreHighlight(); }
/* 鎖定/詢問某個星座時的共用動作:左窗飛過去、兩窗顯示、連線點亮(保留鎖定狀態) */
function focusConstellation(nm){
  if(!(ZODIAC[nm]||EXTRA_CONST[nm]))return 0;
  return startNav(['c:'+nm],true);
}
function startNav(keys,keepLock){
  keys=(keys||[]).filter(Boolean);
  if(!keys.length)return 0;
  if(!keepLock){
    observeIdx='none'; obsSel.value='none';
    lockMode='none'; if(typeof lockSelEl!=='undefined'&&lockSelEl)lockSelEl.value='none';
    trackMode='off'; if(typeof trackSelEl!=='undefined'&&trackSelEl)trackSelEl.value='off';
  }
  if(playing){ playing=false; setPlayLabel(); toast(T('導覽期間暫停播放','Playback paused during tour'),false,true); }
  nav={keys,i:-1}; navStep();
  return keys.length;
}
function navStep(){
  nav.i++;
  if(nav.i>=nav.keys.length){ nav=null; restoreHighlight(); return; }
  nav.key=nav.keys[nav.i];
  if(typeof nav.key==='string'&&nav.key.startsWith('c:')){   /* 星座站:確保左天球與兩側星座圖形可見,並點亮連線 */
    const nm=nav.key.slice(2);
    const ids=['sphereChk']; if(EXTRA_CONST[nm])ids.push('extraConstChk');
    ids.forEach(id=>{const el=document.getElementById(id); if(el&&!el.checked){el.checked=true; el.dispatchEvent(new Event('change'));}});
    ensureExtraVisible(nm);
    highlightConst(nm);
  } else { restoreHighlight(); }
  nav.L0={target:ctrlL.target.clone(),r:ctrlL.r,theta:ctrlL.theta,phi:ctrlL.phi};
  nav.R0={yaw:ctrlR.yaw,pitch:ctrlR.pitch,fov:ctrlR.cam.fov};
  nav.phase='move'; nav.t=0;
  nav.dur=nav.i===0?1.1:1.4; nav.hold=0.8;
  toast(T('導覽 → ','Tour → ')+navName(nav.key),false,true);
}
function navEase(x){ x=Math.max(0,Math.min(1,x)); return x<0.5?2*x*x:1-Math.pow(-2*x+2,2)/2; }
function updateNav(dt){
  if(!nav)return;
  nav.t+=dt;
  const e=nav.phase==='move'?navEase(nav.t/nav.dur):1;
  const L=navL(nav.key);
  if(L){
    ctrlL.target.copy(nav.L0.target).lerp(L.target,e);
    ctrlL.r=nav.L0.r+(L.r-nav.L0.r)*e;
    const th=(L.theta!=null)?L.theta:nav.L0.theta, ph=(L.phi!=null)?L.phi:nav.L0.phi;
    let dth=th-nav.L0.theta; while(dth>Math.PI)dth-=2*Math.PI; while(dth<-Math.PI)dth+=2*Math.PI;
    ctrlL.theta=nav.L0.theta+dth*e;
    ctrlL.phi=nav.L0.phi+(ph-nav.L0.phi)*e;
    ctrlL.apply();
  }
  const R=navFaceR(nav.key);
  if(R){
    let dy=R.yaw-nav.R0.yaw; while(dy>Math.PI)dy-=2*Math.PI; while(dy<-Math.PI)dy+=2*Math.PI;
    ctrlR.yaw=nav.R0.yaw+dy*e;
    ctrlR.pitch=nav.R0.pitch+(R.pitch-nav.R0.pitch)*e;
    ctrlR.setFov(nav.R0.fov+(R.fov-nav.R0.fov)*e);
    ctrlR.apply();
  }
  if(nav.phase==='move'&&nav.t>=nav.dur){ nav.phase='hold'; nav.t=0; }
  else if(nav.phase==='hold'&&nav.t>=nav.hold){ navStep(); }
}
[rendL.domElement,rendR.domElement].forEach(el=>{
  el.addEventListener('pointerdown',cancelNav);
  el.addEventListener('wheel',()=>cancelNav(),{passive:true});
});

/* 自由飛行輸入:鍵盤 WASD 與螢幕按鍵(按住移動) */
const moveKeys={w:false,a:false,s:false,d:false};
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(k in moveKeys && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){moveKeys[k]=true;e.preventDefault();}
});
window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k in moveKeys)moveKeys[k]=false;});
window.addEventListener('blur',()=>{for(const k in moveKeys)moveKeys[k]=false;});
document.querySelectorAll('#flyPad button').forEach(b=>{
  const k=b.dataset.k;
  b.addEventListener('pointerdown',e=>{e.preventDefault();moveKeys[k]=true;b.setPointerCapture(e.pointerId);});
  const off=()=>moveKeys[k]=false;
  b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);
});
/* ── 通知開關 ── */
let notifyOn=true;
/* ══ 隱藏視角:雙窗 → 只有日心 → 只有地平 → 雙窗 ══
   收掉的那一窗用 display:none,留下的自動撐滿;resize() 會跳過寬高為 0 的窗,
   所以還原時要再叫一次才會重設 aspect(不然畫面會被拉扁)。 */
const paneModeBtn=document.getElementById('paneModeBtn');
const PANE_STR=[['雙窗','Both'],['只有日心','Solar only'],['只有地平','Sky only']];
let paneMode=0;
function applyPaneMode(){
  paneL.classList.toggle('off',paneMode===2);
  paneR.classList.toggle('off',paneMode===1);
  paneModeBtn.textContent=PANE_STR[paneMode][lang==='zh'?0:1];
  paneModeBtn.classList.toggle('on',paneMode!==0);   /* 非雙窗時亮起,提醒有一窗被收掉 */
  resize(); setTimeout(resize,30);   /* 版面重排後再量一次 */
}
paneModeBtn.addEventListener('click',()=>{ paneMode=(paneMode+1)%3; applyPaneMode(); });
/* ══ 朗讀通知(TTS)══
   完全由伺服器決定開不開:Worker 有設 TTS_PROVIDER + 對應金鑰,GET /api/tts 才回 enabled,
   這個選項才會出現。金鑰永遠不進瀏覽器。播放採序列佇列,避免兩則通知疊在一起講。 */
let ttsReady=false, ttsOn=true, ttsFails=0;
const ttsQ=[]; let ttsAudio=null, ttsPlaying=false;
const ttsRow=document.getElementById('ttsRow');
const ttsChk=document.getElementById('ttsChk');
ttsChk.addEventListener('change',e=>{ ttsOn=e.target.checked; if(!ttsOn)ttsStop(); });
function ttsStop(){
  ttsQ.length=0;
  if(ttsAudio){ try{ ttsAudio.pause(); }catch(_){} ttsAudio=null; }
  ttsPlaying=false;
}
async function ttsNext(){
  if(ttsPlaying||!ttsQ.length)return;
  ttsPlaying=true;
  const text=ttsQ.shift();
  try{
    const r=await fetch(AI_PROXY_BASE+'/tts',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    if(!r.ok)throw new Error('tts '+r.status);
    const url=URL.createObjectURL(await r.blob());
    const au=new Audio(url); ttsAudio=au; ttsFails=0;
    await new Promise(res=>{
      au.onended=au.onerror=()=>{ URL.revokeObjectURL(url); res(); };
      au.play().catch(()=>{ URL.revokeObjectURL(url); res(); });  /* 自動播放被擋就安靜跳過 */
    });
  }catch(_){
    /* 連錯三次就收起來,不要每則通知都去打一次上游 */
    if(++ttsFails>=3){ ttsReady=false; ttsRow.style.display='none'; ttsQ.length=0; }
  }
  ttsAudio=null; ttsPlaying=false; ttsNext();
}
function speak(text){
  if(!ttsReady||!ttsOn||!text)return;
  if(ttsQ.length>=2)ttsQ.shift();     /* 通知洗版時只留最新兩則 */
  ttsQ.push(String(text).slice(0,600));
  ttsNext();
}
/* 注意:AI_PROXY_BASE 宣告在這段之後(const 有 TDZ),所以探測要等這一輪執行完再打,
   直接在這裡呼叫會丟 ReferenceError,把後面所有初始化(含算圖迴圈)一起帶走。 */
setTimeout(()=>{
  fetch(AI_PROXY_BASE+'/tts').then(r=>r.json()).then(j=>{
    if(j&&j.enabled){ ttsReady=true; ttsRow.style.display=''; ttsOn=ttsChk.checked; }
  }).catch(()=>{});
},0);

const notifyBtn=document.getElementById('notifyBtn');
notifyBtn.addEventListener('click',()=>{
  notifyOn=!notifyOn;
  notifyBtn.textContent=notifyOn?T('通知','Notify'):T('靜音','Muted');
  notifyBtn.classList.toggle('muted',!notifyOn);
});

/* ── AI 語音指令:Groq Whisper ASR → GitHub Models LLM → 控制面板 API ──
   金鑰以 XOR+Base64 混淆存於原始碼常數(防瀏覽原始碼直讀)。
   產生密文:開發者主控台執行 encodeKey('你的金鑰'),把輸出貼進下方兩個常數。
   常數留空時,首次使用會詢問並以同樣混淆格式存入 localStorage(僅本機)。
   誠實聲明:純前端金鑰對有心人仍可還原,正式公開部署請改走代理伺服器。 */
const _XK='TianXiangYi-Ray-2026';
function _xor(str){let o='';for(let i=0;i<str.length;i++)o+=String.fromCharCode(str.charCodeAt(i)^_XK.charCodeAt(i%_XK.length));return o;}
window.encodeKey=k=>btoa(_xor(k));
function decodeKey(b){ try{ return b? _xor(atob(b)) : ''; }catch(e){ return ''; } }
/* AI 代理端點:填入 Cloudflare Worker 網址
   (如 'https://stargzr-ai.你的帳號.workers.dev'),經 Cloudflare AI Gateway
   集中管理金鑰、速率限制與用量分析。留空則直接使用本機金鑰模式。 */
const AI_PROXY_BASE='/api';
/* 代理失敗時把原因顯示出來,免得只看到「要 API Key」卻不知道哪裡壞掉。
   proxyLast 記下最後一次的狀態碼與上游訊息:代理「有回應但出錯」時就不該再去問
   使用者要 GitHub Token(那是沒有代理時才有意義的退路),直接把真正的錯誤講出來。 */
const proxyLast={asr:null,llm:null};
async function proxyFail(tag,r){
  let d=''; try{ d=(await r.clone().text()).slice(0,200); }catch(_){}
  console.warn('[AI proxy] '+tag+' '+r.status+' '+r.url+' :: '+d);
  proxyLast[tag.toLowerCase()]={status:r.status,detail:d};
  toast('! '+tag+' proxy '+r.status,false,true);
}
/* 代理確實回過話(不是 404 沒這個端點)就報錯不 prompt;回 true 代表已處理完畢 */
function proxyBlocked(kind){
  const p=proxyLast[kind];
  if(!p||p.status===404)return false;
  let why='';
  try{ const j=JSON.parse(p.detail); why=(j.error&&(j.error.message||j.error))||j.message||''; }catch(_){ why=p.detail; }
  why=String(why||'').slice(0,90);
  console.warn('[AI proxy] '+kind+' blocked: '+p.status+' '+why);
  toast(T('! 代理回 ','! Proxy ')+p.status+(why?' — '+why:'')+T('(看 /api/diag)',' (see /api/diag)'),false,true);
  return true;
}
function proxyUrl(kind){
  if(!AI_PROXY_BASE)throw new Error('no proxy');
  return AI_PROXY_BASE.replace(/\/$/,'')+'/'+kind;
}
const GROQ_KEY_ENC='';  /* ← encodeKey('gsk_...') 輸出 */
const GH_TOKEN_ENC='';  /* ← encodeKey('github_pat_...') 輸出 */
function getKey(enc,lsKey,msg){
  if(enc)return decodeKey(enc);
  const ls=localStorage.getItem(lsKey);
  if(ls)return decodeKey(ls);
  const k=prompt(msg)||'';
  if(k)localStorage.setItem(lsKey,window.encodeKey(k));
  return k;
}
const AI_IDS=['dt','speed','lat','lon','langSel','tidalChk','phaseChk','sphereChk','signChk','orbitChk',
 'scaleChk','obsSel','retroSel','trailChk','trackSel','lockSel','eclLineChk','bgStarChk',
 'dayChk','textChk','hideHorChk','hideBtnChk','invChk','trailFxChk','extraConstChk','extraLvlSel','viewBodySel','ttsChk',
 'playBtn','nowBtn','resetViewBtn','homeBtn','retroTableBtn','compassBtn','paneModeBtn'];
const AI_SPEC=`Controls. set:{"type":"set","id":ID,"value":V}; click:{"type":"click","id":ID}.
dt "YYYY-MM-DDTHH:MM"; speed 3600000|7200000|10800000|21600000|86400000|259200000|864000000|-86400000 (ms sim per s); lat -89.9..89.9; lon -180..180; langSel zh|en.
Checkbox bool: tidalChk tidal, phaseChk moon-phase&shadows, sphereChk celestial-sphere, signChk zodiac-sectors, orbitChk orbits, scaleChk true-scale, trailChk retro-trail, eclLineChk ref-lines, bgStarChk stars, dayChk day/night, textChk labels, hideHorChk hide-horizon, hideBtnChk hide the sky-pane bottom buttons, invChk invert-drag, trailFxChk motion-trails(only |speed|>=86400000).
Select: viewBodySel earth|moon|mars|titan = WHERE the observer stands (sky pane is rendered from that world; changed in the LEFT pane); extraLvlSel min|mid|all = how many extra constellations (few / more / all 23, needs extraConstChk true); obsSel none|sun|p0..p8|moon (follow, true-scale only); retroSel 0|1|3|4|5|6|7|8 = Mercury..Pluto; trackSel off|ecl_e|ecl_w|lun_e|lun_w axis-lock; lockSel (locking a c:… constellation ALSO flies the left pane through the Sun to it and lights up its lines) none|sun|moon|c:牡羊座|c:金牛座|c:雙子座|c:巨蟹座|c:獅子座|c:處女座|c:天秤座|c:天蠍座|c:射手座|c:摩羯座|c:水瓶座|c:雙魚座.
Click: compassBtn toggle compass-aim (phone points at the real sky using its orientation sensor; mobile only, asks permission, cancelled by dragging; EARTH ONLY — if viewBodySel is not earth the app refuses and explains, so switch viewBodySel to earth first when the user asks for the compass), playBtn toggle-play, nowBtn now, resetViewBtn initial-view (reset BOTH panes to opening state: sky faces due east above horizon, heliocentric default framing; clears any follow/lock/tour), homeBtn reset-view, retroTableBtn almanac table (retrograde + eclipse tabs), paneModeBtn cycles the panes both → heliocentric only → sky only (click 1x/2x/3x to reach the one you want; "hide the sky pane"=1 click from both).
navigate/tour (camera fly — BOTH panes zoom smoothly): {"type":"navigate","target":BODY} single hop, or {"type":"tour","targets":[BODY,...]} multi-stop. BODY=sun|moon|mercury|venus|earth|mars|jupiter|saturn|uranus|neptune|pluto (Chinese names also accepted). Use for: go to / show me / fly to / navigate / 導覽 / tour from X to Y to Z. "outermost planet / 最外圍行星"=pluto, "innermost / 最內圍"=mercury, "nine planets / 九顆行星"=mercury..pluto in order. BODY may also be a CONSTELLATION name (zodiac or listed), e.g. 牡羊座/Aries, 獅子座/Leo, 天蠍座/Scorpius (zh or en) — a constellation stop turns the sky pane AND flies the heliocentric pane out through the Sun so the constellation itself fills the view, with its lines lit.
"Where is <constellation>? / X 在哪(裡)?" is a SHOW request: always emit {"type":"navigate","target":X} (optionally also set lockSel to c:X to keep it centred) — never answer with words only.`;
const AI_SYS='You operate a celestial simulator and answer astronomy questions ONLY. '+
 'Refuse anything unrelated to astronomy or simulator control (no actions, brief polite reply). '+
 'The user input comes from speech-to-text and may contain homophones or misheard words; silently correct them to the nearest valid body name or command (per the vocabulary below) before acting. Only if genuinely ambiguous, ask one short clarifying question in reply instead of guessing wildly. '+
 'Output STRICT JSON {"actions":[…],"reply":"…"}. reply: user\'s language, MAX 30 characters, no markdown. '+
 'Only use listed ids and legal values. '+AI_SPEC;
const micBtn=document.getElementById('micBtn');
const micWrap=document.getElementById('micWrap');
let mediaRec=null, micChunks=[];
micBtn.addEventListener('click',async()=>{
  if(mediaRec&&mediaRec.state==='recording'){ mediaRec.stop(); return; }
  try{
    const st=await navigator.mediaDevices.getUserMedia({audio:true});
    micChunks=[]; mediaRec=new MediaRecorder(st);
    /* 語音活動偵測(VAD):偵測到人聲後,若停頓約 3 秒即自動送出;
       全程沒偵測到人聲則不送出——等於只節錄有講話那段。 */
    let ac=null, vadRAF=0, vadOn=false, spoke=false;
    const startT=performance.now(); let lastVoice=startT;
    const SIL_MS=3000, MAX_MS=20000, TH=0.02;
    try{
      ac=new (window.AudioContext||window.webkitAudioContext)();
      const src=ac.createMediaStreamSource(st), an=ac.createAnalyser();
      an.fftSize=1024; src.connect(an);
      const buf=new Uint8Array(an.fftSize); vadOn=true;
      const tick=()=>{
        if(!mediaRec||mediaRec.state!=='recording')return;
        an.getByteTimeDomainData(buf);
        let sum=0; for(let i=0;i<buf.length;i++){const v=(buf[i]-128)/128; sum+=v*v;}
        const rms=Math.sqrt(sum/buf.length), np=performance.now();
        if(rms>TH){ spoke=true; lastVoice=np; }
        if((spoke&&np-lastVoice>SIL_MS)||np-startT>MAX_MS){ mediaRec.stop(); return; }
        vadRAF=requestAnimationFrame(tick);
      };
      vadRAF=requestAnimationFrame(tick);
    }catch(e){ vadOn=false; }
    mediaRec.ondataavailable=e=>{ if(e.data.size)micChunks.push(e.data); };
    mediaRec.onstop=async()=>{
      if(vadRAF)cancelAnimationFrame(vadRAF);
      if(ac){ try{ac.close();}catch(_){} }
      st.getTracks().forEach(t=>t.stop());
      micBtn.classList.remove('rec');
      if(vadOn&&!spoke){ if(micWrap)micWrap.classList.remove('recording'); toast(T('! 未偵測到語音','! No speech detected'),false,true); return; }
      micBtn.classList.add('busy');
      try{ await handleVoice(new Blob(micChunks,{type:mediaRec.mimeType||'audio/webm'})); }
      catch(err){ toast('! '+(err&&err.message||err),false,true); }
      micBtn.classList.remove('busy'); if(micWrap)micWrap.classList.remove('recording');
    };
    mediaRec.start();
    micBtn.classList.add('rec');
    if(micWrap){ micWrap.classList.add('recording'); micWrap.classList.add('hintseen'); }
    toast(T('● 錄音中,講完停頓約3秒會自動送出','● Recording — pause ~3s to send'),false,true);
  }catch(e){ toast(T('! 無法取得麥克風','! Microphone unavailable'),false,true); }
});
async function handleVoice(blob){
  /* 代理優先:先打同網域 Netlify Functions(金鑰存於伺服器環境變數,
     使用者零設定);代理不存在或失效(404/500,例如你從後台移除金鑰)
     時,退回本機金鑰模式(prompt 一次、混淆存 localStorage)。 */
  let text='';
  proxyLast.asr=null; proxyLast.llm=null;
  try{
    const r=await fetch(proxyUrl('asr'),
      {method:'POST',headers:{'Content-Type':blob.type||'audio/webm'},body:blob});
    if(!r.ok){ proxyFail('ASR',r); throw 0; }
    text=((await r.json()).text||'').trim();
  }catch(e){
    if(proxyBlocked('asr'))return;
    const gk=getKey(GROQ_KEY_ENC,'tq_groq',T('輸入 Groq API Key(混淆後僅存本機)','Groq API key (obfuscated, stored locally)'));
    if(!gk){ toast(T('! ASR 代理與本機金鑰皆未設定','! No ASR proxy or local key'),false,true); return; }
    const fd=new FormData();
    fd.append('file',blob,'voice.webm');
    fd.append('model','whisper-large-v3');
    const tr=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',
      {method:'POST',headers:{Authorization:'Bearer '+gk},body:fd});
    if(!tr.ok)throw new Error('ASR '+tr.status);
    text=((await tr.json()).text||'').trim();
  }
  if(!text){ toast(T('! 未聽到內容','! Heard nothing'),false,true); return; }
  toast('“'+text.slice(0,40)+'”',false,true);
  const payload={model:'gpt-4o-mini',temperature:0.2,
    response_format:{type:'json_object'},
    messages:[{role:'system',content:AI_SYS},{role:'user',content:text}]};
  let raw;
  try{
    const r=await fetch(proxyUrl('llm'),
      {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!r.ok){ proxyFail('LLM',r); throw 0; }
    raw=await r.json();
  }catch(e){
    if(proxyBlocked('llm'))return;
    const hk=getKey(GH_TOKEN_ENC,'tq_gh',T('輸入 GitHub Models Token(混淆後僅存本機)','GitHub Models token (obfuscated, stored locally)'));
    if(!hk){ toast(T('! LLM 代理與本機金鑰皆未設定','! No LLM proxy or local key'),false,true); return; }
    /* 舊的 models.inference.ai.azure.com 已退場;這個端點的型號要帶 vendor 前綴 */
    const lr=await fetch('https://models.github.ai/inference/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+hk},
      body:JSON.stringify({...payload,model:'openai/gpt-4o-mini'})});
    if(!lr.ok)throw new Error('LLM '+lr.status);
    raw=await lr.json();
  }
  let out;
  try{ out=JSON.parse(raw.choices[0].message.content); }
  catch(e){ throw new Error(T('回覆解析失敗','Bad AI response')); }
  const n=runActions(out.actions);
  toast(String(out.reply||'').slice(0,30)+(n?' ('+n+')':''),false,true);
}

/* 動作執行器:AI 語音、深連結、未來的 MCP 都走這一個入口(同一份白名單) */
function runActions(actions){
  let n=0;
  if(!Array.isArray(actions))return 0;
  for(const a of actions){
    if(!a)continue;
    if(a.type==='navigate'||a.type==='tour'){
      const list=a.type==='tour'?(a.targets||a.stops||[]):[a.target];
      const keys=list.map(resolveBodyKey).filter(Boolean);
      if(keys.length&&startNav(keys))n+=keys.length;
      continue;
    }
    if(!AI_IDS.includes(a.id))continue; /* 白名單:僅允許儀表板 API */
    const el=document.getElementById(a.id); if(!el)continue;
    if(a.type==='click'){ el.click(); n++; }
    else if(a.type==='set'){
      if(el.type==='checkbox')el.checked=(a.value===true||a.value==='true'||a.value===1);
      else el.value=String(a.value);
      el.dispatchEvent(new Event('change')); n++;
    }
  }
  return n;
}
window.stargzrRun=runActions; /* 供外部工具(MCP/自動化)呼叫 */

/* 彩蛋:標題懸停(或長按)1.69 秒後浮現作者 */
{
  const bt=document.getElementById('brandTitle');
  const tag=document.getElementById('authorTag');
  let tmr=null;
  const arm=()=>{clearTimeout(tmr);tmr=setTimeout(()=>tag.classList.add('show'),1690);};
  const disarm=()=>{clearTimeout(tmr);tag.classList.remove('show');};
  bt.addEventListener('pointerenter',arm);
  bt.addEventListener('pointerdown',arm);
  bt.addEventListener('pointerleave',disarm);
  bt.addEventListener('pointerup',()=>{ /* 觸控:放開後若已顯示則保留 3 秒 */
    if(tag.classList.contains('show'))setTimeout(disarm,3000); else disarm();
  });
}
window.addEventListener('resize',()=>{needTrailClear=true;});
window.addEventListener('resize',resize);
/* 點擊視角標籤展開/收合選項面板;小螢幕預設收合以免遮擋畫面 */
document.getElementById('chipL').addEventListener('click',()=>paneL.classList.toggle('panelHidden'));
document.getElementById('chipR').addEventListener('click',()=>paneR.classList.toggle('panelHidden'));
if(window.innerWidth<=860||window.innerHeight<=520){paneL.classList.add('panelHidden');paneR.classList.add('panelHidden');}
resize(); setTimeout(resize,50);
rebuildTrail(simMs);
updateLoc();
updateTrailFxRow();
requestAnimationFrame(animate);

/* ══ 深連結:讓其他 AI(MCP)或任何人用一條 URL 開到指定的天空 ══
   ?dt=2026-08-16T21:30&lat=25.03&lon=121.56&lang=en
   &target=mars            單一天體/星座
   &tour=pluto,earth,mercury   多段導覽
   &set=sphereChk:1,extraConstChk:1,scaleChk:0   任何白名單控制項
   &click=playBtn          按鈕
   &fov=40                 地平視角視野角度(度)
   &compass=1              提示使用者開啟指南針對準(權限需手動點按) */
function applyDeepLink(){
  const q=new URLSearchParams(location.search);
  if(!q.toString())return;
  const acts=[];
  const pass=[['lang','langSel'],['dt','dt'],['lat','lat'],['lon','lon'],['speed','speed'],
              ['observe','obsSel'],['lock','lockSel'],['track','trackSel'],['retro','retroSel']];
  pass.forEach(([k,id])=>{ if(q.get(k)!==null)acts.push({type:'set',id,value:q.get(k)}); });
  (q.get('set')||'').split(',').filter(Boolean).forEach(kv=>{
    const i=kv.indexOf(':'); if(i<0)return;
    const id=kv.slice(0,i).trim(), v=kv.slice(i+1).trim();
    const val=(v==='1'||v==='true')?true:(v==='0'||v==='false')?false:v;
    acts.push({type:'set',id,value:val});
  });
  (q.get('click')||'').split(',').map(x=>x.trim()).filter(Boolean)
    .forEach(id=>{ if(id!=='compassBtn')acts.push({type:'click',id}); });
  const tour=(q.get('tour')||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(tour.length)acts.push({type:'tour',targets:tour});
  else if(q.get('target'))acts.push({type:'navigate',target:q.get('target')});
  if(!acts.length&&!q.get('fov')&&!q.get('compass'))return;
  setTimeout(()=>{
    const n=runActions(acts);
    const fov=parseFloat(q.get('fov'));
    if(isFinite(fov))ctrlR.setFov(fov);
    if(q.get('compass')==='1'||q.get('compass')==='true')
      toast(T('點右下角的指南針鈕即可對準真實天空(需要授權方位感測)',
              'Tap the compass button at bottom-right to aim at the real sky'),false,true);
    if(n)toast(T('已套用連結中的觀星設定','Applied the view from your link'),false,true);
  },700);
}
applyDeepLink();
