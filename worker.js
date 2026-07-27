/**
 * 觀星者 StarGZR — 單一 Worker（靜態網站 + AI 代理）
 *
 * 瀏覽器 → 這個 Worker
 *   /api/asr, /api/llm → Cloudflare AI Gateway → Groq / GitHub Models
 *   其他所有路徑        → env.ASSETS（index.html / css / js / favicon…）
 *
 * 金鑰永遠不進瀏覽器。兩種管理方式擇一:
 *   A. Worker Secrets：金鑰存在這裡（wrangler secret put / 儀表板 Settings）
 *   B. AI Gateway BYOK：金鑰存在 AI Gateway 的 Provider Keys（Secrets Store），
 *      此時 Worker 連金鑰都不必知道，只需 CF_AIG_TOKEN。
 */

const CORS = (origin, allowed) => ({
  'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

    // 來源限制：只允許你的網站呼叫（同源請求通常不帶 Origin，會直接放行）
    if (allowed[0] !== '*' && origin && !allowed.includes(origin)) {
      return new Response(JSON.stringify({ error: 'origin not allowed' }), { status: 403, headers: cors });
    }

    const gw = `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_ID}`;
    // Authenticated Gateway（建議開啟）需帶此標頭；BYOK 時 provider 金鑰由 Gateway 注入
    const aig = env.CF_AIG_TOKEN ? { 'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}` } : {};

    try {
      // ── 語音轉文字：Groq Whisper ──
      if (url.pathname === '/api/asr') {
        const fd = new FormData();
        fd.append('file', new Blob([await req.arrayBuffer()], {
          type: req.headers.get('content-type') || 'audio/webm'
        }), 'voice.webm');
        fd.append('model', 'whisper-large-v3');

        const r = await fetch(`${gw}/groq/audio/transcriptions`, {
          method: 'POST',
          headers: {
            ...aig,
            ...(env.GROQ_API_KEY ? { Authorization: `Bearer ${env.GROQ_API_KEY}` } : {}),
          },
          body: fd,
        });
        return new Response(await r.text(), {
          status: r.status,
          headers: { ...cors, 'content-type': 'application/json' },
        });
      }

      // ── 對話模型：GitHub Models（OpenAI 相容）──
      if (url.pathname === '/api/llm') {
        const r = await fetch(`${gw}/azure-openai/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...aig,
            ...(env.GH_MODELS_TOKEN ? { Authorization: `Bearer ${env.GH_MODELS_TOKEN}` } : {}),
          },
          body: await req.text(),
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
