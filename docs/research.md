# 研究與實作決策

## 2026-10-30 更正：Google 個人版應接 Antigravity

先前選用 Gemini CLI / Code Assist OAuth 作為個人配額來源不正確。Google 官方已在 2026-06-18 停止對個人 Free、Google AI Pro／Ultra 帳號提供舊 Gemini CLI 服務，改用 Antigravity CLI；企業 Code Assist 與付費 API Key 不在此停用範圍。

- 官方公告：https://github.com/google-gemini/gemini-cli/discussions/28017
- 官方配額指令：https://antigravity.google/docs/cli/commands/usage
- 官方遷移指南：https://antigravity.google/docs/cli/gcli-migration/
- 開源本機 RPC 參考：https://github.com/steipete/CodexBar/blob/main/docs/antigravity.md

正確指令是 `agy`，配額檢查是互動 CLI 中的 `/usage`（別名 `/quota`），不是把自然語言 quota 指令送給模型。

已在使用者本機 Antigravity 的 language_server 上以唯讀 GetUserStatus 取得實際 Gemini 配額。0.1.4 預設改用這個本機來源：只向 127.0.0.1 的已發現程序所屬埠送出配額請求，CSRF token 僅留在主程序記憶體，不輸出到 UI／報告或寫入設定。自簽 TLS 例外僅適用這個 loopback 請求，不全域關閉 TLS 驗證。

新 adapter 只取 Antigravity 中 Gemini 的已知 remainingFraction，不把 Claude/GPT 模型的額度移到其他廠牌卡片；保留原模型窗口與重設時間，不由模型 reset 時間自行推斷週期。不知道的比例不補成 0%。摘要依剩餘最少的模型排序。原 Code Assist 流程保留為設定中的明確企業版選項。

以下保留最初的研究紀錄；涉及個人 Gemini 來源的結論以本更正為準。

研究日期：2026-10-30（Asia/Taipei）。附件只有 QuotaDeck 文字，無法唯一辨識原專案，因此同時比較名稱相近的方案。

## 開源方案

| 專案 | 取得方式與範圍 | 適合程度 |
| --- | --- | --- |
| [QuotaDeck](https://github.com/devthefuture-org/quotadeck) | Claude、Codex、Z.ai；Go daemon + Preact + SQLite；本機 dashboard | 資料模型值得參考；README 並未宣稱支援 Gemini |
| [AI Quota Deck](https://github.com/JoshuaWang2211/ai-quota-deck) | Tauri / Rust，Windows 系統匣、Widget、Strip；Claude Code、Codex；Gemini 網頁額度需要 Browser Bridge | 最接近桌面浮動監控，但 README 明確要求 Windows，不能因使用 Tauri 就視為跨平台完成 |
| [QuotaPulse](https://github.com/chaoxu/quotapulse) | Node CLI，讀取三家本機登入資料，Gemini 使用 Code Assist 配額服務 | 適合研究資料來源；未直接依賴其憑證更新／持久化實作 |
| [AgentMeter](https://github.com/fdtorres1/AgentMeter) | macOS 選單列，包含 Gemini CLI Cloud Code quota | macOS 原生工具，不適合直接作為 Windows + Linux 共用桌面殼 |

結論：沒有直接把名稱相似的專案當成三家、三平台都已完成的解答。本版自行建立薄桌面殼與 provider adapters，未複製上述專案程式碼。

## 技術棧

選擇 **Electron + TypeScript + 原生 HTML/CSS**。

需求中的主要困難是登入、授權存放、讀取上游配額，而非前端框架。Electron 的 Node 環境可直接使用 Google 授權函式庫、Codex stdio JSON RPC 與 Claude 官方 CLI；透明視窗、跨平台系統匣、置頂、快捷鍵與 safeStorage 均有原生 API。

Tauri 2 也是合理選項，優點是較小體積與通常較低記憶體；但此版本需要額外管理 Node sidecar 或以 Rust 重寫整套授權整合。這不是 Tauri 不支援，而是目前整合成本與交付方式的選擇。Electron 的代價是包體較大，必須實測背景資源用量，不能宣稱它與 Tauri 同樣輕量。

本機缺少 Rust 只是次要環境因素，不是架構決策的唯一理由。前端不引入 React/Vite，避免這個小型工具的額外框架與開發伺服器。

## 三家資料來源

### Codex

[官方 app-server 文件](https://learn.chatgpt.com/docs/app-server) 提供 `initialize`、`account/read`、`account/login/start`、`account/login/completed` 與 `account/rateLimits/read`。

採用官方 CLI 管理登入與 token 更新；應用不自行輪替 Codex refresh token。使用 `rateLimitsByLimitId` 優先，兼容 `rateLimits`。保留實際 `windowDurationMins`，不硬編碼成 5 小時／每週。API Key 登入不適用訂閱配額。

### Claude

[官方登入文件](https://code.claude.com/docs/en/authentication) 支援 `claude auth login`。應用呼叫官方 CLI 的瀏覽器登入流程，然後讀取其本機授權。macOS 支援預設 Claude Code Keychain 項目；Windows/Linux 讀取 `.credentials.json`。

`https://api.anthropic.com/api/oauth/usage` 是開源監控器使用的非公開端點，不能承諾長期穩定。授權過期時請官方 CLI 重新登入或更新；應用不搶先輪替共享 refresh token。缺少數字或格式變更時顯示未知／錯誤，絕不補成 0%。

### Gemini CLI / Code Assist

依據 [Google CLI OAuth 原始碼](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/code_assist/oauth2.ts) 與 [配額型別](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/code_assist/types.ts)，使用 Google 官方 `google-auth-library`，系統瀏覽器、隨機 state、PKCE、127.0.0.1 動態埠回呼。

OAuth 使用上游公開桌面 client 設定，Google 頁面可能顯示 Gemini CLI。本版不是向 Google 註冊的獨立正式 OAuth 應用；上游若撤銷／限制此 client，須改為自有註冊 client 或官方 CLI 整合。這項依賴在介面與第三方聲明均有揭露。

查詢 `loadCodeAssist` 和 `retrieveUserQuota`，保留每個模型的剩餘比例與重設時間。不發送生成請求，不額外消耗模型 token。Google 的 `v1internal` 是內部服務介面，也可能變更。

授權存放於 Electron safeStorage 加密的本機檔案；Linux 若只能使用 basic_text，拒絕儲存。可讀取舊版 CLI 的 oauth_creds.json，但不修改該檔案。新版 CLI 的其他 keychain 格式不自動匯入，可直接在本工具重新登入。

**這不是 Gemini 網頁版的配額。** 網頁版需另行加入瀏覽器擴充套件或橋接並驗證，不以 Code Assist 的數字代替。使用者尚未選定網頁版需求時，本版以 CLI / Code Assist 為範圍。

## 桌面與安全設計

- 收合／展開透明浮窗、置頂、可拖曳、系統匣、快捷鍵、來源開關、剩餘／已用切換、90% 提醒。
- 2 分鐘輪詢；按手動更新仍尊重冷卻時間。獨立請求、去重、指數退避與 Retry-After，避免某一家故障連帶卡住全部來源。
- 快取僅在記憶體，更新失敗標示舊資料；超過 24 小時不顯示數字。登出／授權失效清除舊帳號資料。
- renderer sandbox + contextIsolation，禁止 Node、遠端導覽、任意 IPC、任意 shell command。固定的官方連結白名單。
- 不收集 prompt、對話、專案內容，不建立本機 HTTP 監控服務，不上傳遙測。
- Google 登入回呼只在登入期間暫時監聽 loopback；不對外網開放。

## 平台驗證範圍

有 Windows portable、macOS zip、Linux AppImage 建置配置與 CI matrix。Windows 可在這台機器實際建置、啟動與測試；macOS/Linux 在未實際執行對應 CI／桌面測試前，僅能稱為具備移植與建置配置，不能稱為已完成實機驗證。Linux Wayland 的浮窗置頂與程式化定位取決於 compositor，必要時使用 X11/XWayland。

參考：[Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)、[safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)、[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)。
