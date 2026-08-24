/**
 * 觀星者 StarGZR — 單一 Worker（靜態網站 + AI 代理）
 *
 * 瀏覽器 → 這個 Worker
 *   /api/asr → Groq Whisper（可選擇經 AI Gateway）
 *   /api/llm → GitHub Models / Gemini / DeepSeek 擇一（都是 OpenAI 相容格式）
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
    defModel: 'deepseek-chat',      // 另有 deepseek-reasoner(較慢,會回 reasoning_content)
    gateway: false,
  },
};
/* 沒指定時的挑選順序:誰的金鑰有設就用誰 */
const LLM_ORDER = ['github', 'gemini', 'deepseek'];

/**
 * 決定這次要用哪家。LLM_PROVIDER=github|gemini|deepseek 明講最優先;
 * 沒講就照 LLM_ORDER 找第一個有金鑰的,全都沒有則退回 github(讓錯誤訊息講得清楚)。
 * 注意:gemini / deepseek 走各自的原生相容端點,不吃 AI Gateway 的 azure-openai 路徑;
 * 想經 Gateway 請自行把 GEMINI_BASE / DEEPSEEK_BASE 設成完整前綴。
 */
function llmCfg(env, B) {
  const asked = String(env.LLM_PROVIDER || '').toLowerCase();
  const pick = LLM_PROVIDERS[asked] ? asked
    : (LLM_ORDER.find(n => env[LLM_PROVIDERS[n].keyName]) || 'github');
  const P = LLM_PROVIDERS[pick];
  return {
    name: pick,
    base: env[P.baseVar] || (P.gateway ? B.llm : P.defBase),
    model: env[P.modelVar] || P.defModel,
    key: env[P.keyName],
    keyName: P.keyName,
    useGwHeaders: !!P.gateway,
    strip: P.strip || [],
  };
}

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
        vars: {
          CF_ACCOUNT_ID: has('CF_ACCOUNT_ID'),
          CF_GATEWAY_ID: has('CF_GATEWAY_ID'),
          ALLOWED_ORIGINS: env.ALLOWED_ORIGINS || '(unset → *)',
          CF_AIG_TOKEN: has('CF_AIG_TOKEN'),
          GROQ_API_KEY: has('GROQ_API_KEY'),
          GH_MODELS_TOKEN: has('GH_MODELS_TOKEN'),
          GEMINI_API_KEY: has('GEMINI_API_KEY'),
          DEEPSEEK_API_KEY: has('DEEPSEEK_API_KEY'),
        },
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
        const L = llmCfg(env, B);
        if (!L.key && !(B.via === 'gateway' && L.useGwHeaders)) {
          return new Response(JSON.stringify({ error: `${L.keyName} not set on Worker` }), { status: 500, headers: cors });
        }
        // 前端送 gpt-4o-mini；這裡統一改寫成該端點認得的名稱
        let payload = {};
        try { payload = JSON.parse(await req.text()); } catch (_) {}
        payload.model = L.model;
        // 某些相容層不吃 OpenAI 專屬欄位,依供應商設定先拿掉以免 400
        for (const k of L.strip) delete payload[k];

        const r = await fetch(`${L.base}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', ...(L.useGwHeaders ? aig : {}),
            ...(L.key ? { Authorization: `Bearer ${L.key}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        return new Response(await r.text(), {
          status: r.status,
          headers: { ...cors, 'content-type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: cors });
    }
  },
};
