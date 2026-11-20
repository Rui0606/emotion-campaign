# 專案設計與技術規格書（AI 交接專用 / AI Handoff Specification）

> 本文件專為協助其他 AI（如 ChatGPT、Claude、Cursor、Gemini 等）快速、完整理解本專案的架構、業務邏輯、多語系文案、靜態資源與已知待修問題而整理。

---

## 1. 專案基本資訊 (Project Overview)

- **專案名稱**：情緒宣導活動：心情溫度計（115年修平特殊教育宣導－「給情緒喘口氣」）
- **用途**：校園特殊教育宣導互動闖關網頁（純前端 SPA，不需後端資料庫）。參與者依序完成「語言選擇 → 活動介紹 → 認識情緒行為障礙知識測驗 → BSRS-5 心情溫度計 → 檢測結果（高分者觸發心理師通關驗證）→ 空氣鳳梨照顧指南彈窗 → 外部 Google 滿意度問卷」，憑送出成功畫面領取空氣鳳梨贈品。
- **目標裝置**：以手機直式瀏覽為主（所有頁面容器皆為 `max-w-md mx-auto`），相容桌機瀏覽。
- **支援語系**：3 種語言
  - `zh`：繁體中文（預設）
  - `en`：English
  - `vi`：Tiếng Việt（越南文）

---

## 2. 技術棧與執行環境 (Tech Stack)

| 項目 | 技術 / 版本 |
|---|---|
| 框架 | React 19 (`react`, `react-dom` ^19.0.1) + TypeScript (~5.8.2) |
| 建置工具 | Vite ^6.2.3 (`@vitejs/plugin-react` ^5.0.4) |
| 樣式系統 | Tailwind CSS v4 (`@tailwindcss/vite` ^4.1.14，透過 `src/index.css` 中 `@import "tailwindcss";` 載入) |
| 動畫函式庫 | Motion (`motion/react` ^12.23.24) |
| 圖示庫 | Lucide React (`lucide-react` ^0.546.0) |
| 音效系統 | 原生 Web Audio API（無外部音檔，純程式碼合成音效） |
| 開發指令 | `npm run dev`（Port 3000）、`npm run build`、`npm run lint` (`tsc --noEmit`) |

> 註：純靜態前端 SPA，未呼叫任何後端 API 或 AI API。已移除 AI Studio 範本套件（`@google/genai`、`express`、`dotenv`）與相關設定。
>
> **部署**：GitHub Pages。`vite.config.ts` 設定 `base: './'`（相對路徑），`.github/workflows/deploy.yml` 會在推送到 `main` 時自動 lint、build 並部署；部署時以 `SITE_URL` 環境變數替換 `index.html` 內的 `__SITE_URL__`（分享預覽圖需要完整網址）。程式內圖片一律透過 `asset()` 輔助函式取得路徑，**不要寫死 `/assets/...` 絕對路徑**，否則在 GitHub Pages 子路徑會失效。

---

## 3. 檔案結構與各檔職責 (Directory Structure)

```text
/
├── index.html                  # HTML 進入點、favicon、SEO / OpenGraph Meta（og:image 用 __SITE_URL__ 佔位）
├── package.json                # 套件與指令定義
├── tsconfig.json               # TypeScript 設定
├── vite.config.ts              # Vite 設定（base './'、Tailwind v4、SITE_URL 替換）
├── PROJECT_SPEC_FOR_AI.md      # 本規格文件
├── .github/workflows/deploy.yml # GitHub Pages 自動部署
├── assets-source/              # 原始大尺寸圖檔（已列入 .gitignore，不會上傳、不會部署）
├── public/
│   ├── favicon.png / apple-touch-icon.png / og-image.jpg  # 網站圖示與分享預覽圖
│   └── assets/
│       ├── background.webp     # 全站背景圖 (33 KB)
│       ├── logo.webp           # 活動 Logo (9 KB，顯示於頁首、語言頁與歡迎頁)
│       ├── pine.webp           # 空氣鳳梨獎品插圖 (30 KB)
│       └── care.webp           # 空氣鳳梨照顧指南 (170 KB)
└── src/
    ├── main.tsx                # React 根節點掛載
    ├── index.css               # Tailwind v4 匯入
    ├── vite-env.d.ts           # Vite 型別（import.meta.env）
    ├── types.ts                # TypeScript 型別定義
    ├── utils/
    │   └── audio.ts            # Web Audio API 合成音效（共用單一 AudioContext）
    ├── data/
    │   └── content.ts          # 三語文案、測驗題庫、BSRS-5 題目、求助專線 HELP_LINES、學校諮商資訊 SCHOOL_COUNSELING
    └── App.tsx                 # 核心邏輯、狀態機、所有步驟畫面與彈窗
```

---

## 4. 完整使用者流程與狀態機 (User Flow & State Machine)

頁面切換由 `App.tsx` 的 `currentStep: Step` 狀態控制，未使用路由套件（單一 URL），切換時自動捲動至頂部並透過 `AnimatePresence mode="wait"` 呈現轉場動畫。

```text
[language] 語言選擇 (zh / en / vi)
    │
    ▼
[welcome] 活動歡迎與情緒行為障礙介紹頁
    │
    ▼
[quiz] 第一關：認識情緒行為障礙 5 題選擇題（隨機題序與選項、須全對才過關）
    │  └─ 若有錯題：顯示各題紅綠詳解 → 點擊「重新測驗」重新洗牌作答
    │  └─ 全部答對：顯示詳解並解鎖「下一關：心情溫度計」
    ▼
[bsrs] 第二關：BSRS-5 簡式健康表（5 題主要量表 + 第 6 題自殺意念附加題，0~4 分）
    │
    ▼
[bsrs_result] 檢測結果頁（計算前 5 題總分 0~20 分，並獨立判斷第 6 題）
    ├── 若 前五題總分 >= 6 或 第6題分數 >= 2：
    │       ▼
    │   [counselor] 心理師關懷閘門頁（提示尋求現場心理師協助）
    │       └─ 輸入 4 位數通關密碼（目前硬編碼為 "1031"）驗證通過
    │               │
    └── 若 前五題總分 <= 5 且 第6題分數 < 2：
                    ▼
[feedback] 最後一步：領取空氣鳳梨說明卡片（含 PINE.png 懸浮動畫）
    │  └─ 點擊「前往填寫問卷」→ 開啟 [Care Modal] 彈窗顯示 care.png 照顧指南
    │       └─ 點擊「我知道了，前往問卷」→ 新分頁開啟 Google 表單
    │          https://forms.gle/myEPAbGQHhxUiGQZ7
    ▼
完成問卷後，將表單送出畫面出示給工作人員兌換空氣鳳梨
```

---

## 5. 核心功能與業務邏輯規格 (Detailed Feature Specifications)

### 5.1 全域頂部導覽列 (`renderHeader`)
- 在 `language` 步驟隱藏，其餘步驟固定於頂部（`sticky top-0 z-50`，半透明毛玻璃背景）。
- **左側「回首頁」按鈕**：顯示 `/assets/logo.svg`（載入失敗時退回文字佔位框），點擊會清空測驗答案、BSRS 答案與通關密碼，並返回 `welcome` 步驟。
- **右側步驟徽章**：顯示當前階段名稱（準備開始 / 第一關：知識挑戰 / 第二關：心情溫度計 / 檢測結果 / 最後一步）。
- **底部進度條**：動態寬度動畫：`welcome (10%)` → `quiz (30%)` → `bsrs (60%)` → `bsrs_result (85%)` → `counselor / feedback (100%)`。

### 5.2 第一關：知識測驗 (`renderQuiz`)
- **題庫來源**：`src/data/content.ts` 中的 `QUIZ_QUESTIONS`，共 **5 題**單選題（`q1` ~ `q5`），每題 4 個選項（`A`~`D`），含三語題目、選項與詳解。
- **插圖機制**：每題卡片上方有插圖區；`q1` 設有 `gifPath: '/assets/q1.gif'`，若圖片載入失敗或無 `gifPath`，則自動顯示對應的 Lucide 圖示（`Brain`, `ListTree`, `HeartHandshake`, `EyeOff`, `Users`）。
- **洗牌機制 (`initQuiz`)**：使用 Fisher-Yates 演算法，同時打亂題目順序與選項順序，並將文字含「以上都／以上皆」的選項鎖定在最後一個位置。
- **互動回饋**：
  - 選項按鈕使用 Motion `whileHover` (`scale: 1.02`, spring) 與 `whileTap` (`scale: 0.98`)。
  - 點選選項播放 `click` 音效。
  - 送出時檢查是否 5 題皆已作答：若有漏題會顯示三語紅色警告橫幅、標紅未答卡片並自動捲動至第一題漏答題；全部答對播放 `success` 琶音音效並解鎖下一關，有錯題播放 `wrong` 音效並要求「重新測驗」。
  - 送出後自動平滑捲動至 `#quiz-top`（補償頂部導覽列高度 `-120px`），方便使用者由第 1 題開始閱讀詳解。

### 5.3 第二關：BSRS-5 心情溫度計 (`renderBsrs` & `renderBsrsResult`)
- **題目結構**：
  - 前 5 題（`q1`~`q5`）：睡眠困難、緊張不安、易苦惱動怒、憂鬱低落、覺得比不上別人。
  - 第 6 題附加題（`q6`）：有自殺的想法。
  - 每題 0~4 分單選圓鈕（完全沒有 0 / 輕微 1 / 中等程度 2 / 厲害 3 / 非常厲害 4），具 `whileHover` (`scale: 1.1`) 彈跳效果。
- **漏題檢查**：未填滿 6 題時顯示紅色警告橫幅、將未答題目外框標紅，並自動平滑捲動至第一題未作答題目。
- **計分與分級規則（嚴格遵循 BSRS-5 標準）**：
  - `totalBaseScore` = 僅加總前 5 題（`q1`~`q5`），範圍 `0 ~ 20` 分。
  - `suicideScore` = 第 6 題（`q6`）獨立計分，範圍 `0 ~ 4` 分。
  - 結果卡片分級：
    | 條件 | 顏色主題 | 標題 (zh) | 下一頁導向 | 按鈕文字 (zh) |
    |---|---|---|---|---|
    | `suicideScore >= 2`（最高優先權，覆蓋總分分級） | 紅色 (`red`) | 需要專業協助（另顯示「★ 第6題：觸發關懷指標」徽章） | `counselor` | 了解後續建議 |
    | `totalBaseScore >= 15` | 紅色 (`red`) | 重度情緒困擾 | `counselor` | 了解後續建議 |
    | `10 <= totalBaseScore <= 14` | 橘色 (`orange`) | 中度情緒困擾 | `counselor` | 了解後續建議 |
    | `6 <= totalBaseScore <= 9` | 黃色 (`yellow`) | 輕度情緒困擾 | `counselor` | 了解後續建議 |
    | `totalBaseScore <= 5` 且 `suicideScore < 2` | 綠色 (`green`) | 正常範圍 | `feedback` | 前往填寫回饋表單 |

### 5.4 心理師關懷閘門 (`renderCounselor`)
- 當 `totalBaseScore >= 6 || suicideScore >= 2` 時進入此頁。
- 引導參與者與現場心理師／輔導老師對談，對談後輸入四位數通關碼解鎖。
- **目前通關碼**：`1031`（定義於 `src/App.tsx` 的 `handleVerifyCode`）。
- 驗證成功後進入 `feedback` 頁面；輸入錯誤則顯示紅字錯誤提示。

### 5.5 最後一步與空氣鳳梨照顧彈窗 (`renderFeedback`)
- 綠松石漸層主卡片，上方顯示 `/assets/PINE.png` 搭配上下漂浮動畫（`y: [-5, 5, -5]`，無限循環 3 秒）與白色光暈；若圖檔遺失則退回 `HeartHandshake` 圖示。
- 點擊「前往填寫問卷」不會直接跳出網頁，而是設定 `showCareModal = true`，開啟置中彈窗：
  - 顯示標題「帶我回家前... 請先看看怎麼照顧我唷 🌱」
  - 顯示圖片 `/assets/care.png`（`max-h-64 object-contain`）
  - 可透過右上角關閉鈕（`X`）或點擊背景遮罩關閉彈窗
  - 點擊「我知道了，前往問卷」後關閉彈窗，並以新分頁（`target="_blank" rel="noopener noreferrer"`）開啟外部問卷連結：`https://forms.gle/myEPAbGQHhxUiGQZ7`。

---

## 6. 視覺與背景設計 (Visual Design)

- **主色調**：療癒系青綠色（Teal `teal-500/600/700` 與 Emerald `emerald-600`），搭配狀態色（綠/黃/橘/紅）。
- **全站背景**：`url("/assets/background.png")`（`bg-cover bg-center bg-fixed`），並疊加一層 `bg-white/40 backdrop-blur-[2px]` 半透明遮罩確保前景卡片文字清晰可讀。

---

## 7. 程式碼健檢與近期修正紀錄 (Audit & Maintenance Notes)

截至目前（`vite build` 與 `tsc --noEmit` 皆通過，網頁可正常啟動與運作）。

### 已完成修正項目
1. **第一關漏題提示與定位**：未答完 5 題送出時，已補上三語警告提示橫幅、未作答題目紅框標示，並自動平滑捲動至第一題未作答題目。
2. **第一關選項洗牌邏輯修正**：修正為僅鎖定文字包含「以上都／以上皆」的選項在最後（第 2 題），其餘題目的所有 4 個選項皆正常隨機洗牌。
3. **越南文頂部步驟徽章補齊**：`renderHeader()` 已補齊 `vi`（越南文）全部階段標籤（`Sẵn sàng` / `Chặng 1: Kiến thức` / `Chặng 2: BSRS-5` / `Kết quả` / `Bước cuối`）。
4. **照顧指南彈窗關閉功能**：`showCareModal` 彈窗已加上右上角關閉鈕（`X`）及點擊半透明背景遮罩關閉彈窗的功能。

5. **GitHub Pages 部署整理**（2026-11）：
   - 圖片轉 WebP（總量由約 8 MB 降至約 250 KB），改用相對路徑；移除 AI Studio 專用檔案與套件。
   - 結果頁（需關懷時）與心理師頁加入求助專線 1925 / 1995 / 1980（可點擊撥號）；`SCHOOL_COUNSELING.phone` 填入後會顯示學校諮商中心。
   - 音效改為共用單一 AudioContext，修正多次點擊後音效失效。
   - 支援手機「返回」鍵回到上一關（History API），並以 `resolveStep()` 防止用上一頁／下一頁跳過關卡或通關碼。
   - 以 sessionStorage 暫存進度（2 小時過期；按「回首頁」清除），重新整理不會從頭開始。
   - 通關碼欄位改數字鍵盤、只接受 4 位數字、可按 Enter 送出；BSRS 送出不再重複觸發。
   - 視覺：語言頁加入 Logo 與活動名稱、移除國旗 emoji、歡迎頁加入隱私說明與切換語言連結、BSRS 選項文字放大、標題三語化、背景改為固定圖層（修正 iPhone 卡頓）。
   - `<html lang>` 隨語言切換；新增 favicon 與分享預覽圖。

---

## 8. 常用修改快速索引 (Quick Customization Guide for AI)

| 需求 | 檔案與位置 |
|---|---|
| 修改心理師通關密碼 | `src/App.tsx` 頂部常數 `COUNSELOR_CODE`（目前為 `'1031'`） |
| 修改 Google 問卷連結 | `src/App.tsx` 頂部常數 `FEEDBACK_FORM_URL` |
| 修改測驗題目 / BSRS 文字 / 三語文案 | `src/data/content.ts` |
| 修改求助專線 / 學校諮商中心電話 | `src/data/content.ts` 的 `HELP_LINES`、`SCHOOL_COUNSELING` |
| 更換圖片素材 | 轉成 WebP 後覆蓋 `public/assets/` 內的 `logo.webp`, `background.webp`, `pine.webp`, `care.webp` |
| 修改 BSRS-5 觸發心理師門檻 | `src/App.tsx` 的 `needsCounselor`（目前為 `totalBaseScore >= 6 \|\| suicideScore >= 2`） |
