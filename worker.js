/**
 * 觀星者 StarGZR — 單一 Worker（靜態網站 + AI 代理）
 *
 * 瀏覽器 → 這個 Worker
 *   /api/asr → Groq Whisper（可選擇經 AI Gateway）
 *   /api/llm → GitHub Models / Gemini / DeepSeek 擇一（都是 OpenAI 相容格式）
 *   /api/tts → OpenAI / Groq / ElevenLabs 擇一（要設 TTS_PROVIDER 才啟用；GET 問狀態、POST 拿音檔）
 *   /api/diag          → 診斷：看得到哪些變數、上游回什麼
 *   其他所有路徑        → env.ASSETS（index.html / css / js / favicon…）
 *
 * 金鑰只存在 Worker Secrets，永遠不進瀏覽器。
 *
 * 端點選擇：
 *   預設直連供應商原生網址（最不容易出錯）。
 *   把變數 USE_GATEWAY 設成 "1" 才會改走 Cloudflare AI Gateway，
 *   此時 GROQ_BASE / LLM_BASE 可另外覆寫（不同 provider 的路徑格式不一樣）。
 */

const GROQ_DIRECT = 'https://api.groq.com/openai/v1';
// GitHub Models 的新端點（舊的 models.inference.ai.azure.com 已退場）
// 這個端點的 model 名稱要帶 vendor 前綴，例如 openai/gpt-4o-mini
const LLM_DIRECT  = 'https://models.github.ai/inference';

function bases(env) {
  const useGw = String(env.USE_GATEWAY || '') === '1';
  if (!useGw) return { groq: GROQ_DIRECT, llm: LLM_DIRECT, via: 'direct' };
  const gw = `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_ID}`;
  return {
    groq: env.GROQ_BASE || `${gw}/groq`,
    llm:  env.LLM_BASE  || `${gw}/azure-openai`,
    via:  'gateway',
  };
}

/**
 * 對話模型供應商表。三家都提供 OpenAI 相容的 /chat/completions,
 * 所以前端送出的 payload 完全不用改,只差 base / model / 金鑰。
 * 要再加一家,只要在這裡多一列。
 */
const LLM_PROVIDERS = {
  github: {
    keyName: 'GH_MODELS_TOKEN',
    baseVar: 'LLM_BASE',            // 走 AI Gateway 時由 bases() 決定
    modelVar: 'GH_MODEL',
    defModel: 'openai/gpt-4o-mini', // 這個端點的型號要帶 vendor 前綴
    gateway: true,                  // 可以套 AI Gateway 的認證標頭
  },
  gemini: {
    keyName: 'GEMINI_API_KEY',
    baseVar: 'GEMINI_BASE',
    defBase: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelVar: 'GEMINI_MODEL',
    // 2026-08-24:gemini-2.0-flash 已下架(404,上游要求改用 3.6);
    // 換型號時直接設變數 GEMINI_MODEL,不用改這個檔。
    defModel: 'gemini-3.6-flash',
    gateway: false,
    // Gemini 相容層不吃這些 OpenAI 專屬欄位,留著會 400
    strip: ['frequency_penalty', 'presence_penalty', 'logit_bias'],
  },
  deepseek: {
    keyName: 'DEEPSEEK_API_KEY',
    baseVar: 'DEEPSEEK_BASE',
    defBase: 'https://api.deepseek.com/v1',
    modelVar: 'DEEPSEEK_MODEL',
    // 2026-07-24 起舊的 deepseek-chat / deepseek-reasoner 已退役,改用 v4 系列;
    // 若上游又換名,設變數 DEEPSEEK_MODEL 覆蓋即可(另有較慢的 deepseek-v4-pro)。
    defModel: 'deepseek-v4-flash',
    gateway: false,
  },
};
/* 沒指定時的挑選順序:誰的金鑰有設就用誰 */
const LLM_ORDER = ['github', 'gemini', 'deepseek'];

/**
 * 語音朗讀(TTS)。刻意「不自動啟用」:一定要設變數 TTS_PROVIDER 才會開,
 * 否則 GROQ_API_KEY 早就為了 Whisper 而存在,會不小心把只講英文的 playai-tts 打開。
 *   TTS_PROVIDER = openai | groq | elevenlabs
 *   對應金鑰      = OPENAI_API_KEY / GROQ_API_KEY / ELEVENLABS_API_KEY (存成 Secret)
 *   可選覆寫      = TTS_MODEL / TTS_VOICE
 * 前端 GET /api/tts 問「開了沒」,POST /api/tts {text} 拿回一段 audio。
 */
const TTS_PROVIDERS = {
  openai: {
    keyName: 'OPENAI_API_KEY',
    defModel: 'gpt-4o-mini-tts',
    defVoice: 'alloy',
    zh: true,                      // 中文念得出來
    build: (cfg, text) => ({
      url: (cfg.base || 'https://api.openai.com/v1') + '/audio/speech',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, voice: cfg.voice, input: text, response_format: 'mp3' }),
    }),
  },
  groq: {
    keyName: 'GROQ_API_KEY',
    defModel: 'playai-tts',
    defVoice: 'Fritz-PlayAI',
    zh: false,                     // playai-tts 目前只有英文/阿拉伯文
    build: (cfg, text) => ({
      url: (cfg.base || 'https://api.groq.com/openai/v1') + '/audio/speech',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, voice: cfg.voice, input: text, response_format: 'wav' }),
    }),
  },
  elevenlabs: {
    keyName: 'ELEVENLABS_API_KEY',
    defModel: 'eleven_flash_v2_5', // 多語(含中文)、延遲低
    defVoice: '21m00Tcm4TlvDq8ikWAM', // Rachel,公用預設聲音
    zh: true,
    build: (cfg, text) => ({
      url: `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voice}?output_format=mp3_44100_128`,
      headers: { 'Content-Type': 'application/json', 'xi-api-key': cfg.key },
      body: JSON.stringify({ text, model_id: cfg.model }),
    }),
  },
};
function ttsCfg(env) {
  const name = String(env.TTS_PROVIDER || '').toLowerCase();
  const P = TTS_PROVIDERS[name];
  if (!P) return { enabled: false, reason: env.TTS_PROVIDER ? 'unknown TTS_PROVIDER' : 'TTS_PROVIDER not set' };
  const key = env[P.keyName];
  if (!key) return { enabled: false, provider: name, reason: `${P.keyName} not set` };
  return {
    enabled: true, provider: name, P, key,
    base: env.TTS_BASE || '',
    model: env.TTS_MODEL || P.defModel,
    voice: env.TTS_VOICE || P.defVoice,
    zh: !!P.zh,
  };
}

/**
 * 決定這次要用哪家。LLM_PROVIDER=github|gemini|deepseek 明講最優先;
 * 沒講就照 LLM_ORDER 找第一個有金鑰的,全都沒有則退回 github(讓錯誤訊息講得清楚)。
 * 注意:gemini / deepseek 走各自的原生相容端點,不吃 AI Gateway 的 azure-openai 路徑;
 * 想經 Gateway 請自行把 GEMINI_BASE / DEEPSEEK_BASE 設成完整前綴。
 */
function llmCfgOf(name, env, B) {
  const P = LLM_PROVIDERS[name];
  return {
    name,
    base: env[P.baseVar] || (P.gateway ? B.llm : P.defBase),
    model: env[P.modelVar] || P.defModel,
    key: env[P.keyName],
    keyName: P.keyName,
    useGwHeaders: !!P.gateway,
    strip: P.strip || [],
  };
}
function llmCfg(env, B) {
  const asked = String(env.LLM_PROVIDER || '').toLowerCase();
  const pick = LLM_PROVIDERS[asked] ? asked
    : (LLM_ORDER.find(n => env[LLM_PROVIDERS[n].keyName]) || 'github');
  return llmCfgOf(pick, env, B);
}

/**
 * 這次可以用的供應商清單:LLM_PROVIDER 指定的排第一,其餘照 LLM_ORDER 補在後面,
 * 只留下真的有金鑰(或走 Gateway 認證)的。用途是「額度用完就換下一家」——
 * 免費層的 429(rate limit / quota)最常見,單靠一家會整個語音功能停擺。
 */
function llmChain(env, B) {
  const asked = String(env.LLM_PROVIDER || '').toLowerCase();
  const order = [];
  if (LLM_PROVIDERS[asked]) order.push(asked);
  for (const n of LLM_ORDER) if (!order.includes(n)) order.push(n);
  return order.map(n => llmCfgOf(n, env, B))
    .filter(c => c.key || (B.via === 'gateway' && c.useGwHeaders));
}
/* 這些狀態碼代表「這家現在不行,但換一家可能可以」 */
const LLM_RETRY = new Set([402, 408, 409, 425, 429, 500, 502, 503, 504]);
/* 剛失敗過的供應商先冷卻,免得每次都要先撞一次牆才換家。
   402(沒餘額)冷卻久一點——儲值前再打幾次都一樣。存在 isolate 記憶體,
   Worker 重啟就清空,所以只是省時間,不會把設定卡死。 */
const llmCool = new Map();
const coolFor = st => (st === 402 ? 600000 : st === 429 ? 60000 : 30000);
const isCool = n => (llmCool.get(n) || 0) > Date.now();

const CORS = (origin, allowed) => ({
  'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // ── 非 API 路徑：交給靜態資產（同源，所以前端不需要 CORS）──
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(req);
    }

    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
    const cors = CORS(origin, allowed);
    const B = bases(env);
    // Authenticated Gateway 才需要；直連時不送
    const aig = (B.via === 'gateway' && env.CF_AIG_TOKEN)
      ? { 'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}` } : {};

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    // ── 診斷：瀏覽器直接開 /api/diag ──
    // 只回報「有沒有設」，不回報任何金鑰內容。
    if (url.pathname === '/api/diag') {
      const has = k => (env[k] ? 'set' : 'MISSING');
      const L = llmCfg(env, B);
      const out = {
        via: B.via,
        groq_base: B.groq,
        llm_provider: L.name,
        llm_base: L.base,
        llm_model: L.model,
        llm_chain: llmChain(env, B).map(c => `${c.name}:${c.model}`),   // 額度用完會照這個順序換家
        vars: {
          CF_ACCOUNT_ID: has('CF_ACCOUNT_ID'),
          CF_GATEWAY_ID: has('CF_GATEWAY_ID'),
          ALLOWED_ORIGINS: env.ALLOWED_ORIGINS || '(unset → *)',
          CF_AIG_TOKEN: has('CF_AIG_TOKEN'),
          GROQ_API_KEY: has('GROQ_API_KEY'),
          GH_MODELS_TOKEN: has('GH_MODELS_TOKEN'),
          GEMINI_API_KEY: has('GEMINI_API_KEY'),
          DEEPSEEK_API_KEY: has('DEEPSEEK_API_KEY'),
          TTS_PROVIDER: env.TTS_PROVIDER || '(unset → TTS off)',
          OPENAI_API_KEY: has('OPENAI_API_KEY'),
          ELEVENLABS_API_KEY: has('ELEVENLABS_API_KEY'),
        },
        tts: (() => { const t = ttsCfg(env);
          return { enabled: t.enabled, provider: t.provider || null, model: t.model || null,
                   voice: t.voice || null, zh: !!t.zh, reason: t.reason || null }; })(),
        probes: {},
      };
      // 對兩個上游各打一發最便宜的請求，把真實狀態碼帶回來
      try {
        const r = await fetch(`${B.groq}/models`, {
          headers: { ...aig, ...(env.GROQ_API_KEY ? { Authorization: `Bearer ${env.GROQ_API_KEY}` } : {}) },
        });
        out.probes.groq = { status: r.status, body: (await r.text()).slice(0, 200) };
      } catch (e) { out.probes.groq = { error: String(e) }; }
      try {
        const r = await fetch(`${L.base}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', ...(L.useGwHeaders ? aig : {}),
            ...(L.key ? { Authorization: `Bearer ${L.key}` } : {}),
          },
          body: JSON.stringify({ model: L.model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
        });
        out.probes.llm = { status: r.status, body: (await r.text()).slice(0, 200) };
      } catch (e) { out.probes.llm = { error: String(e) }; }
      return new Response(JSON.stringify(out, null, 2), {
        headers: { ...cors, 'content-type': 'application/json; charset=utf-8' },
      });
    }

    // ── 前端開場問一次:朗讀有沒有開、講不講中文 ──
    if (url.pathname === '/api/tts' && req.method === 'GET') {
      const t = ttsCfg(env);
      return new Response(JSON.stringify({
        enabled: t.enabled, provider: t.provider || null, zh: !!t.zh, reason: t.reason || null,
      }), { headers: { ...cors, 'content-type': 'application/json' } });
    }

    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

    // 來源限制：只允許你的網站呼叫（同源請求通常不帶 Origin，會直接放行）
    if (allowed[0] !== '*' && origin && !allowed.includes(origin)) {
      return new Response(JSON.stringify({ error: 'origin not allowed' }), { status: 403, headers: cors });
    }

    try {
      // ── 語音轉文字：Groq Whisper ──
      if (url.pathname === '/api/asr') {
        if (!env.GROQ_API_KEY && B.via === 'direct') {
          return new Response(JSON.stringify({ error: 'GROQ_API_KEY not set on Worker' }), { status: 500, headers: cors });
        }
        const fd = new FormData();
        fd.append('file', new Blob([await req.arrayBuffer()], {
          type: req.headers.get('content-type') || 'audio/webm'
        }), 'voice.webm');
        fd.append('model', env.GROQ_STT_MODEL || 'whisper-large-v3-turbo');
        fd.append('response_format', 'json');

        const r = await fetch(`${B.groq}/audio/transcriptions`, {
          method: 'POST',
          headers: { ...aig, ...(env.GROQ_API_KEY ? { Authorization: `Bearer ${env.GROQ_API_KEY}` } : {}) },
          body: fd,
        });
        return new Response(await r.text(), {
          status: r.status,
          headers: { ...cors, 'content-type': 'application/json' },
        });
      }

      // ── 對話模型：GitHub Models（OpenAI 相容）──
      if (url.pathname === '/api/llm') {
        const chain = llmChain(env, B);
        if (!chain.length) {
          const L = llmCfg(env, B);
          return new Response(JSON.stringify({ error: `${L.keyName} not set on Worker` }), { status: 500, headers: cors });
        }
        let body = {};
        try { body = JSON.parse(await req.text()); } catch (_) {}

        // 冷卻中的先跳過;若全在冷卻就照原順序硬打(總比直接放棄好)
        const hot = chain.filter(c => !isCool(c.name));
        const queue = hot.length ? hot : chain;

        const tried = [];
        let last = null, first = null;
        for (const L of queue) {
          // 前端送 gpt-4o-mini；這裡統一改寫成該端點認得的名稱
          const payload = { ...body, model: L.model };
          // 某些相容層不吃 OpenAI 專屬欄位,依供應商設定先拿掉以免 400
          for (const k of L.strip) delete payload[k];

          let r;
          try {
            r = await fetch(`${L.base}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json', ...(L.useGwHeaders ? aig : {}),
                ...(L.key ? { Authorization: `Bearer ${L.key}` } : {}),
              },
              body: JSON.stringify(payload),
            });
          } catch (e) {
            tried.push(`${L.name}:fetch-failed`);
            last = { status: 502, text: JSON.stringify({ error: String(e).slice(0, 200) }) };
            first = first || last;
            llmCool.set(L.name, Date.now() + coolFor(502));
            continue;
          }
          const text = await r.text();
          tried.push(`${L.name}:${r.status}`);
          if (r.ok) {
            llmCool.delete(L.name);
            return new Response(text, {
              status: 200,
              headers: { ...cors, 'content-type': 'application/json', 'x-llm-provider': L.name },
            });
          }
          last = { status: r.status, text, name: L.name };
          first = first || last;
          if (!LLM_RETRY.has(r.status)) break;   // 金鑰錯/請求壞掉,換家也沒用
          llmCool.set(L.name, Date.now() + coolFor(r.status));
        }
        /* 全軍覆沒:回報「你指定的那家」的狀態碼(前端據此顯示忙線/額度用完),
           tried 一起塞進 body 與標頭,一眼看得出每家各回什麼。 */
        const why = first || last;
        let detail = why.text;
        try { detail = JSON.stringify({ ...JSON.parse(why.text), tried }); }
        catch (_) { detail = JSON.stringify({ error: String(why.text).slice(0, 300), tried }); }
        return new Response(detail, {
          status: why.status,
          headers: { ...cors, 'content-type': 'application/json', 'x-llm-tried': tried.join(',') },
        });
      }

      // ── 文字轉語音:把通知念出來 ──
      if (url.pathname === '/api/tts') {
        const t = ttsCfg(env);
        if (!t.enabled) {
          return new Response(JSON.stringify({ error: t.reason }), { status: 503, headers: cors });
        }
        let text = '';
        try { text = String((JSON.parse(await req.text()) || {}).text || ''); } catch (_) {}
        text = text.trim().slice(0, 600);       // 通知很短,順手擋掉濫用
        if (!text) return new Response(JSON.stringify({ error: 'empty text' }), { status: 400, headers: cors });

        const q = t.P.build(t, text);
        const r = await fetch(q.url, { method: 'POST', headers: q.headers, body: q.body });
        if (!r.ok) {
          return new Response(JSON.stringify({ error: (await r.text()).slice(0, 300) }),
            { status: r.status, headers: { ...cors, 'content-type': 'application/json' } });
        }
        return new Response(r.body, {
          status: 200,
          headers: {
            ...cors,
            'content-type': r.headers.get('content-type') || 'audio/mpeg',
            'cache-control': 'no-store',
          },
        });
      }

      return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: cors });
    }
  },
};
