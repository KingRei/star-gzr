# 觀星者 · StarGZR

**用講的就能觀星。** 按下麥克風，直接說「帶我從水星飛到冥王星」或「轉到獵戶座」，
畫面就會自己飛過去 —— 這是一座雙視角天文模擬器，完全跑在瀏覽器裡，沒有建置步驟、沒有後端，
除了 three.js CDN 之外不載入任何外部資源。

**Just talk to the sky.** Tap the mic and say *"take me from Mercury out to Pluto"* or
*"turn to Orion"* — the camera flies there itself. StarGZR is a dual-view celestial
simulator that runs entirely in the browser: no build step, no backend, no external
assets beyond the three.js CDN.

[開始觀星 / Start gazing](http://gazer.star-gzr.com/)

![](Screenshot.jpg)

---

## AI 語音指令 / Talk to it

麥克風鈕在右上角。說中文或英文都可以，它會把你的話翻成一串動作，套用到兩個面板上。

The mic button is at the top right. Speak Chinese or English; your sentence is turned
into a whitelisted action list and applied to both panes.

**導覽行星 / Fly to planets**

- 「帶我去火星」 · *"take me to Mars"*
- 「從水星依序飛到火星」 · *"tour from Mercury to Venus to Earth to Mars"*
- 「去最外圍的行星」 · *"go to the outermost planet"*（→ 冥王星 / Pluto）
- 「九顆行星巡一遍」 · *"tour all nine planets"*

**導覽星座 / Fly to constellations**

- 「轉到獵戶座」 · *"turn to Orion"*
- 「鎖定天蠍座」 · *"lock onto Scorpius"*
- 「打開星座線，帶我看夏季大三角」 · *"show the constellation lines and take me to the Summer Triangle"*

**控制時間與設定 / Time and settings**

- 「跳到 2027 年 3 月 20 日」 · *"jump to 2027-03-20"*
- 「用一天一秒的速度播放」 · *"play at one day per second"*
- 「顯示逆行表」 · *"show me the retrograde table"*
- 「切成真實比例」 · *"switch to true scale"*
- 「把觀測地換到冰島」 · *"move the observer to Iceland"*
- 「站到泰坦上看土星」 · *"stand on Titan and look at Saturn"*
- 「其他星座只留最重要的」 · *"show only the few most important extra constellations"*

語音走的是同一份白名單 `runActions()`；深連結與 MCP 也走這個入口，所以三種操作方式行為完全一致。
Voice, deep links and MCP all funnel through the same `runActions()` whitelist, so they behave identically.

---

## 兩個視角 / Two views

**左 · 日心儀 / Left — heliocentric orrery.** 九大行星（含冥王星）繞日運行，位置由 JPL 式克卜勒根數
（J2000 曆元 + 長期變化率）算出。含地球 23.4° 傾斜自轉軸（真恆星速率）與你設定經緯度上的觀測者標記、
帶相位陰影的月球、地球本影錐與月球影錐、月球潮汐力圖、以真實星位畫出的黃道十二星座天球、
歲差圈（地軸在恆星間約 25,800 年的軌跡），以及隨春分點退行而漂移的回歸黃道十二宮扇形。

All nine classical planets orbiting the Sun from JPL-style Keplerian elements; Earth's tilted
rotation axis with your observer marker, the Moon with phase shading, umbral and shadow cones,
a tidal-force diagram, the celestial sphere with the 12 zodiac figures drawn from real star
positions, the precession circle, and the tropical sign sectors drifting against the constellations.

**右 · 地平天空 / Right — horizon sky view.** 從地球任一經緯度看出去的第一人稱視野：地平線、方位、
地平座標網格、黃道與白道（傾斜 5.1°）、真實星座連線、行星、太陽，以及相位正確、亮面永遠朝向太陽的月亮。
逆行環即時描繪（實線＝已走過，虛線＝未來），並顯示順行／逆行狀態。

A first-person view from any latitude/longitude: horizon, cardinal marks, alt-az grid, the ecliptic
and the Moon's path, constellation stick figures, planets, Sun, and a correctly phased Moon whose
bright limb always faces the Sun. Retrograde loops are traced live, solid for past, dashed for future.

### 四種觀察地 / Four worlds to stand on

天空不只從地球看得到 —— 觀察地可以整顆換掉，天空面板會改由那顆星球的表面重新算起：

The sky view is not Earth-only. Move the observer to another world and the whole pane is re-rendered
from that surface — sky colour, air, spin rate, and what hangs overhead all change:

<b style="color:#4F8FE6">■ 地球 Earth</b> ·
<b style="color:#CFCFD6">■ 月球 Moon</b> ·
<b style="color:#E0603C">■ 火星 Mars</b> ·
<b style="color:#E0B36A">■ 泰坦 Titan</b>

| 觀察地 | 天空 | 特別之處 |
|---|---|---|
| <b style="color:#4F8FE6">地球 Earth</b> | 藍天／夜空，23.4° 傾角、1 恆星日 | 預設；日月食、農曆、指南針對準都在這裡 |
| <b style="color:#CFCFD6">月球 Moon</b> | 真空，全黑天空、白晝仍見星 | 27.32 日潮汐鎖定自轉；天上掛著會轉的地球（相位與地照正確） |
| <b style="color:#E0603C">火星 Mars</b> | 塵埃散射的橘紅天空 | 24h37m 自轉；地球退成一顆晨昏星，月球不再單獨可見 |
| <b style="color:#E0B36A">泰坦 Titan</b> | 1.45 atm 甲烷霾，永恆昏橙、整體再暗一階 | 15.945 日潮汐鎖定；土星帶著環佔滿半邊天，可鎖定 |

切換位置有兩個：**左側日心視角**面板的「觀察地」下拉選單（`viewBodySel`），以及**地平視角左下角**那顆地球圖示的圓鈕
——點一下就換下一個觀察地，旁邊的小標籤會顯示現在站在哪。語音也行：說「站到泰坦上看」。
Switch it either from the *Observer* dropdown in the **left, heliocentric pane** (`viewBodySel`), or with the
round globe button at the **bottom-left of the sky pane** (click to cycle; the chip next to it reads
「觀察地：地球」and both the icon and the chip take that world's colour — 地球藍、月球白、火星紅、泰坦土黃)
— or just say *"stand on Titan"*.

地平視角面板裡的「隱藏按鈕」會把下方所有控制（觀察地、指南針、視野）一起收起來，面板鈕也縮成一個箭頭，
留下乾淨的天空。The *Hide buttons* checkbox in the sky pane clears every bottom control and shrinks the panel
toggle down to a single arrow.

標題列「通知」右邊那顆鈕是**隱藏視角**：按一下只留日心視角，再按一下只留地平視角，第三下回到雙窗，
留下的那一窗會自己撐滿整個畫面。AI 也能操作它（`paneModeBtn`）。The button right of *Notify* cycles the
panes: solar-system only → sky only → both, with the surviving pane expanding to fill the window.

---

## 指南針對準真實天空 / Compass aiming

地平視角右下角、視野倍數左邊那顆**指南針**圖示，是給手機用的：
按下去之後，天空面板會跟著手機的方位感測器轉，你把手機舉向哪裡，畫面就看向哪裡 ——
真的「舉起來對著天空找星星」。

The compass-and-telescope button in the sky pane (bottom right, left of the FOV chip) turns your
phone into a viewfinder: the sky pane follows the device's orientation sensor, so whatever direction
you point at, that's what you see. Hold it up at the real sky and the labels line up.

實作細節 / How it works:

- iOS 需要一次性授權，按下按鈕會跳出「允許使用方位感測器」的系統詢問；Android 走 `deviceorientationabsolute`。
  iOS asks permission on first tap (`DeviceOrientationEvent.requestPermission`); Android uses the absolute event.
- 只在 HTTPS（安全內容）下可用；桌機沒有感測器，按下去會提示改用拖曳。
  Requires a secure context; on desktop it explains that there is no sensor and drag-look still works.
- 若 2.5 秒內收不到資料，會提示你做 8 字形晃動校正指南針。
  If no data arrives in 2.5 s you get a figure-eight calibration hint.
- 一拖曳畫面就自動關閉，回到手動視角；按 `重設視角` 也會關閉。
  Dragging the sky cancels it and returns to manual look; resetting the view also turns it off.
- AI 也能開關它：說「打開指南針」即可（`compassBtn` 已在 AI 白名單內）。
- **只有地球能用。** 觀察地切到月球／火星／泰坦時指南針會變灰，點下去（或叫 AI 開）只會跳出說明：
  別的星球沒有地磁，手機的方位角也對不上那顆星球的天球。切回地球就恢復。
  Compass aim is Earth-only; on any other observer world the button greys out and explains why.

  The AI can toggle it too — say *"turn on the compass"*.

---

## MCP：接上其他 AI / MCP: connect other AIs

`mcp-server/` 是一個零相依的 **MCP（Model Context Protocol）** 伺服器，讓 Claude Desktop、Cline、
Continue 等客戶端可以查天文數字、並產生一條「點開就是那個畫面」的深連結。

`mcp-server/` is a zero-dependency MCP server so any MCP client can query the same astronomy engine
and hand you a link that opens the simulator already set up.

```json
{
  "mcpServers": {
    "stargzr": { "command": "node", "args": ["/path/to/Planétarium/mcp-server/index.js"] }
  }
}
```

工具 / Tools：`stargzr_open`（深連結）、`stargzr_sky`（整片天空快照）、`stargzr_body`（單一天體位置）、
`stargzr_moon_phase`、`stargzr_retrogrades`、`stargzr_constellation`、`stargzr_list_constellations`。

天文核心由 `npm run sync` 從 `celestial-simulator.js` 擷取，所以 AI 講的數字和畫面畫的一致。
細節見 [`mcp-server/README.md`](mcp-server/README.md)。
The engine is extracted from the simulator itself, so the numbers an AI quotes match what's on screen.

**深連結也可以自己拼 / Deep links by hand：**

```
https://gazer.star-gzr.com/?dt=2026-08-16T21:30&lat=25.03&lon=121.56
    &tour=mercury,venus,earth,mars&set=sphereChk:1&lang=zh
```

參數 / params：`dt` `lat` `lon` `lang` `speed` `target` `tour` `set` `click` `fov` `compass`。

---

## 其他功能 / More features

- **時間旅行 / Time travel** — 任選日期時間（1700–2300 完整精度），1 小時/秒 到 10 天/秒，可倒轉。
  即時顯示儒略日與農曆（以天文定朔法計算，閏月規則正確）。
- **時刻表 / Almanac** — 一顆「時刻表」鈕，兩個分頁：行星逆行（任一年每顆行星的逆行區間，二分法逼近到日；
  播放時行星留守會跳出提示）與日月食（該年可見的日食／月食及其類型與起訖時刻）。
- **食的偵測 / Eclipse detection** — 地心幾何（Danjon 本影）即時判定月全食／月偏食與日食：
  月亮轉為血紅、影錐高亮、天空視角的太陽浮現日冕環。
- **相機模式 / Camera modes** — 自由視角（拖曳／捏合，可反向）、鎖定太陽／月亮／任一黃道星座，
  以及**黃道軸置中**：把黃道擺成螢幕中央一條筆直的垂線，所有行星串在上面。視野 4.0× 到 0.1× 超廣角。
- **真實比例 / True scale** — 大小與距離共用一把線性尺（1 AU = 323 單位）：太陽 1.5 單位、地球 0.014、
  月球在 0.83 單位（60.3 地球半徑）外，影錐長度幾何精確。
- **處處歲差 / Precession everywhere** — 星位、北極星、極點標記、回歸宮帶都以 50.29″/yr 移動。
  拉過千年，看織女星在約西元 13,800 年成為北極星。
- **35 個星座、三段密度 / 35 constellations, three densities** — 黃道 12 星座之外另有 23 個知名星座，
  在「其他星座」旁邊選 **少 / 多 / 更多**（`extraLvlSel`），天空要清爽還是要熱鬧自己決定：
  - **少 Few（7，預設）** — 獵戶、大熊·北斗、仙后、天鵝、南十字、大犬、夏季大三角：先認得出方位的那幾個。
    一開場就已經勾選並停在這一段，天空乾淨但不空。
  - **多 More（15）** — 再加牧夫、御夫、天琴、天鷹、英仙、仙女、飛馬、小熊·小北斗。
  - **更多 All（23）** — 全部畫出來，補上蛇夫、半人馬、天龍、武仙、北冕、小犬、船底、烏鴉。

  導覽到某個星座時，若它的層級還沒開，會自動放寬到看得見為止。
  Pick Few / More / All next to *More constellations*; navigating to a constellation auto-raises the
  level until it is visible.
- 雙語介面（繁體中文／English），連場景內 3D 標籤都會切換；手機友善（直式堆疊、橫式並排、捏合縮放、面板可收合）。

---

## 檔案 / Files

| 檔案 File | 用途 Purpose |
|---|---|
| `index.html` | 進入點：標記、內嵌 favicon，載入下面兩支檔案 / entry point |
| `celestial-simulator.css` | 全部樣式 / all styles |
| `celestial-simulator.js` | 天文引擎＋兩個場景（需 three.js r128，自 cdnjs 載入） |
| `worker.js` + `wrangler.toml` | Cloudflare Worker：靜態資源 + `/api` AI 代理（語音辨識與語言模型） |
| `mcp-server/` | MCP 伺服器與無頭天文引擎 / MCP server and headless engine |
| `cloudflare-ai-proxy/` | 舊版獨立代理 Worker，保留為備援 / legacy standalone proxy |

部署：把根目錄丟給任何靜態主機即可；語音助理需要 Cloudflare Worker 代理。
語音辨識用 Groq Whisper（`GROQ_API_KEY`）；對話模型三選一 —— GitHub Models（`GH_MODELS_TOKEN`）、
Google Gemini（`GEMINI_API_KEY`）、DeepSeek（`DEEPSEEK_API_KEY`）。沒指定時依 github → gemini → deepseek
挑第一個有金鑰的，也可用 `LLM_PROVIDER` 明講，型號用 `GH_MODEL` / `GEMINI_MODEL` / `DEEPSEEK_MODEL` 覆寫。
三家都走 OpenAI 相容格式，前端不用改；要再加一家只要在 `worker.js` 的 `LLM_PROVIDERS` 表多一列。
所有金鑰一律存成 Secret，切勿寫進 `wrangler.toml` 或 commit 進版控。
本機使用直接開 `index.html`；沒有代理時語音會改問你要不要自帶 API key。
`/api/diag` 會告訴你目前選到哪家、金鑰有沒有設、上游回什麼狀態碼。

### 唸出通知（TTS）/ Spoken notifications

在 Worker 設 `TTS_PROVIDER` 才會啟用；沒設的話前端連「唸出通知」這個選項都不會出現
（`GET /api/tts` 回 `enabled:false`）。有設之後，每一則跳出來的通知都會念一次，逆行、日月食、
AI 回話都算。金鑰只在 Worker 端，瀏覽器拿到的只有音檔。

| `TTS_PROVIDER` | Secret | 預設型號 / 聲音 | 中文 | 申請 |
|---|---|---|---|---|
| `openai` | `OPENAI_API_KEY` | `gpt-4o-mini-tts` / `alloy` | ✅ | platform.openai.com → API keys（用量計費，TTS 很便宜） |
| `elevenlabs` | `ELEVENLABS_API_KEY` | `eleven_flash_v2_5` / Rachel | ✅ | elevenlabs.io → Profile → API Key（免費層每月約 1 萬字元） |
| `groq` | `GROQ_API_KEY`（語音辨識已在用） | `playai-tts` / `Fritz-PlayAI` | ❌ 僅英文 | console.groq.com → API Keys（免費額度大） |

想換聲音或型號設 `TTS_MODEL` / `TTS_VOICE`。要再加一家，就在 `worker.js` 的 `TTS_PROVIDERS`
表多一列，只要寫得出 `build(cfg,text) → {url,headers,body}` 且回傳音檔就行。

Set `TTS_PROVIDER` on the Worker to have every notification read aloud; leave it unset and the
feature stays invisible. Keys live only in Worker Secrets.

Deploy the root directory to any static host. The voice assistant proxies through the Worker: Groq
Whisper for speech, and GitHub Models, Gemini or DeepSeek for the chat model (all OpenAI-compatible).
Keep every key as a dashboard **Secret**, never in `wrangler.toml` or git; `/api/diag` reports which
provider is active.

---

## 精度與驗證 / Accuracy & validation

引擎以真實錨點驗證過：J2000 的 GMST；二分二至的太陽黃經；2025–26 年火星／水星／金星／土星的逆行日期
（與已發表星曆相差 ±1 天）；2025–26 年七次食全部偵測到（一次全食／偏食分類因月球理論截斷而誤判）；
農曆錨點含 2020 閏四月、2023 閏二月、2025 閏六月；歲差行為（北極星最近點約 2100 年、織女星約 13,800 年近極）。
星座資料另以程式檢查：赤經赤緯與星等皆在合理範圍、無孤立星、無重複或自連線段、跨度 ≤45°、
中心與星表中心相差 7° 以內。

Verified against real-world anchors as above; constellation data additionally checked programmatically
for coordinate range, orphan stars, duplicate/self lines, angular span and centroid offset.

已知限制 / Known limits：鄰近幾世紀的行星黃經約 0.1–0.5°；月球黃經 ≲0.3°（食的時刻 ±1 小時，
臨界偏食不可靠）；星座使用 J2000 星位剛體旋轉套用歲差（不含自行）；農曆有效範圍 1700–2300。

## 授權 / License

MIT — 隨意使用，註明出處感激不盡。 Do anything, attribution appreciated.
