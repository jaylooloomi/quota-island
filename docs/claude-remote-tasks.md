# Claude Code 跨電腦任務 — v1.29.3

## 範圍與來源

使用者確認公司主機 LAPTOP-LASLBBRV 的任務在 Windows 本機 Claude Desktop → Code 執行；Pebble 位於家用主機。舊版只有 Claude 原生本機登錄，因此即使公司端執行正常，家用 Pebble 也不會讀到其檔案。

採用公司 Claude Code 已建立的官方 Remote Control 連線，使用家用現有同帳號／工作區 OAuth 授權，唯讀查詢 `GET https://api.anthropic.com/v1/code/sessions`。

參考：

- [官方 Desktop 跨裝置設定](https://code.claude.com/docs/en/desktop#control-which-sessions-appear-on-your-other-devices)
- [官方 Remote Control](https://code.claude.com/docs/en/remote-control)
- [claude-rc-api 原始介面研究](https://github.com/ThatCrispyToast/claude-rc-api/blob/main/API_REFERENCE.md)
- [cc-tap](https://github.com/es617/cc-tap)

Pebble 自行實作小型唯讀讀取器，未安裝或執行上述專案。`/v1/code/*` 是未保證穩定的介面，不是公開支援的第三方 SDK。

## 真實驗證（2026-11-05，台灣時間）

主要帳號清單 HTTP 200；個人帳號仍 HTTP 401，分開顯示，不以主要帳號成功掩蓋。
使用者指定公司端的「許願池 桌面任務推播系統方案整理」作為自然任務對照：

| 取樣時間 | 來源 | 狀態 |
| --- | --- | --- |
| 01:07:37 | 清單及單筆 GET，兩者 HTTP 200 | connected / idle |
| 01:08:29 | 新讀取器，真實清單 | running |
| 01:09:30 | 新讀取器，真實清單 | idle |
| 01:10:31 | 新讀取器，真實清單 | idle |
| 01:11:32 | 新讀取器，真實清單 | idle |

未送測試訊息、未啟動 CLI、未安裝或讀取 Hook、未架私人接收端、未註冊裝置、未寫入 presence、未讀事件或聊天歷史、未刷新或修改 token。
此輪沒有自然等待確認事件；等待狀態只完成格式與 UI 測試。idle 不等於已驗證工作成功完成，因此不發綠色完成通知；既有藍色閒置提醒可依狀態轉換觸發。

## 行為

- 僅接受 active + bridge；archived 與雲端 Managed Agents 不冒充本機 Code。
- connected + worker_status running / requires_action / idle 分別映射執行中／等待／閒置。其他狀態及失聯為未知。忽略可能延遲的 status_bucket。
- 每個帳號每 60 秒查詢；每輪最多三頁、每頁 50 筆、回應每頁上限 1 MiB；合併最多 100 筆。最多五個已啟用帳號來源，超出範圍不代表不存在。
- 手動重新檢查不增加健康來源的查詢頻率。429 尊重 Retry-After，不允許按鈕跳過冷卻。
- 每輪重新讀取現有授權，401 顯示需重新登入，不搶先旋轉共用 refresh token。
- 舊快照超過 150 秒失效；查詢失敗立即將原任務標為未知，不保留假的執行中。
- 以原生 registry 的 bridgeSessionId 去重；有效本機狀態優先，若本機未知而遠端有效則採遠端。不以任務標題猜測相同任務。
- API 未提供可靠主機名稱，因此畫面標示 Remote Control 與帳號標籤，不假造公司／家用名稱。
- 可複製診斷含帳號標籤、查詢健康、數量與安全錯誤碼；不含 token、組織 ID、原始回應、聊天內容。

## 公司端前置條件

公司 Desktop Code 的任務須開啟 Remote Control；可於工作階段詳情的 Environment 開關啟用。新任務自動連線位於 Settings → Code / Claude Code → Connect new sessions to Remote Control。沒有接入的任務不能從另一台電腦憑空讀到；公司政策或 Trusted Devices 要求仍由官方流程處理。

## 驗證腳本

- `node --test test/claude-remote-tasks.test.cjs`
- `node scripts/claude-remote-tasks-test.cjs`：四語系、來源成功／失敗、來源圖示、三列捲軸及診斷按鈕。
- `node scripts/check-claude-remote-tasks.cjs --live --watch`：明確選擇才讀取既有真實授權；四次一分鐘間隔取樣，報告只含狀態、計數、時間與安全健康資訊。
