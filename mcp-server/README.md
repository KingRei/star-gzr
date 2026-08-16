# StarGZR MCP Server

讓任何支援 **MCP（Model Context Protocol）** 的 AI 客戶端接上觀星者。
Connect any MCP-capable AI client to the StarGZR planetarium.

它做兩件事 / It does two things:

1. **無頭天文引擎 / Headless astronomy** — 直接算出行星方位、月相、逆行區間、星座可見度。數字直接取自 `../celestial-simulator.js` 的同一份程式碼，所以 AI 講的和畫面畫的一致。
2. **深連結產生器 / Deep-link builder** — 把「2026 年 8 月 16 日晚上、在台北、依序飛過水星金星地球火星、打開星座線」變成一條網址，使用者點開就是那個畫面。

零相依套件，只需要 Node 18+。No dependencies; Node 18+ only.

## 安裝 / Install

Claude Desktop：編輯 `claude_desktop_config.json`（macOS 在 `~/Library/Application Support/Claude/`，Windows 在 `%APPDATA%\Claude\`）：

```json
{
  "mcpServers": {
    "stargzr": {
      "command": "node",
      "args": ["C:\\path\\to\\Planétarium\\mcp-server\\index.js"],
      "env": {
        "STARGZR_URL": "https://gazer.star-gzr.com",
        "STARGZR_LAT": "25.033",
        "STARGZR_LON": "121.565"
      }
    }
  }
}
```

三個環境變數都可省略；`STARGZR_LAT/LON` 只是預設觀測地，工具呼叫時仍可覆寫。
All three env vars are optional; lat/lon are just defaults that any tool call can override.

其他客戶端（Cline、Continue、Zed…）用法相同：stdio 傳輸，指令 `node index.js`。

## 工具 / Tools

| 工具 | 用途 |
|---|---|
| `stargzr_open` | 產生深連結：時間、地點、語言、導覽目標或多站巡航、勾選項、視野、指南針提示 |
| `stargzr_sky` | 整片天空快照：日月九星的高度角/方位角、此刻可見清單、月相 |
| `stargzr_body` | 單一天體：赤經赤緯、地平方位與羅盤方向、距離、順行/逆行與黃經速率 |
| `stargzr_moon_phase` | 距角、照亮比例、月齡、月相名稱 |
| `stargzr_retrogrades` | 某行星某年的所有逆行區間（起訖 UTC 與天數，二分法逼近到分鐘） |
| `stargzr_constellation` | 星座中心座標（J2000 與當日歲差後）、地平高度方位、最亮星等，附一條開啟連結 |
| `stargzr_list_constellations` | 列出全部 35 個星座（12 黃道 + 23 知名星座） |

### 對話示範 / Example

> 「火星今晚幾點在哪個方向？順便給我一條連結。」

AI 會呼叫 `stargzr_body{body:"mars"}` 得到高度 49.5°、方位 82°（正東），
再呼叫 `stargzr_open{target:"mars"}` 回你 `https://gazer.star-gzr.com/?target=mars`。

> 「做一條連結，從水星依序飛到火星，把星座線打開。」

`stargzr_open{tour:["mercury","venus","earth","mars"], settings:{constChk:true}}`

## 深連結參數 / Deep-link parameters

網頁端由 `applyDeepLink()` 解析，走的是和語音指令同一份白名單 `runActions()`：

`dt` 時間、`lat`/`lon` 觀測地、`lang` 語言、`speed` 模擬速度、`target` 單一目標、
`tour` 逗號分隔多站、`set` 逗號分隔的 `id:value`、`click` 逗號分隔按鈕 id、
`fov` 地平視野角度、`compass=1` 提示開啟指南針對準。

## 同步 / Keeping in sync

天文核心與星座資料是從主程式擷取出來的。主程式改過之後跑：

```bash
npm run sync   # 重新產生 core.generated.js
npm test       # 冒煙測試：座標範圍、逆行次數、歲差量、深連結、每個工具
```

`core.generated.js` 是自動產生的，別手改。
`core.generated.js` is generated — edit `../celestial-simulator.js` instead.

## 為什麼是「深連結」而不是遙控 / Why links, not remote control

瀏覽器裡的模擬器沒有對外開埠，要即時遙控就得架 WebSocket 中繼、處理配對與授權。
深連結零設定、零雲端成本，而且使用者永遠握有「要不要點開」的決定權。
若之後想要真正的即時遙控，前端已經預留 `window.stargzrRun(actions)` 這個統一入口。
