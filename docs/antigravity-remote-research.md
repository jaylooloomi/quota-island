# Antigravity 官方遠端唯讀驗證（2026-11-05）

## 結果

已整合為 Windows v1.29.4 的正式任務來源：公司主機、任務清單、統計、來源診斷與藍色閒置通知。沿用既有登入，查詢間隔至少 60 秒，遵守 Retry-After；150 秒未更新轉為未知。本機與遠端依任務 UUID 去重。此來源沒有已驗證的成功完成證據，不把閒置當作綠色完成通知。

每輪最多 5 台遠端主機、每台 100 筆摘要、單次回應 1 MiB；合併清單維持最多 100 筆與三列捲動。超量及部分主機失效會標記資料不完整。等待確認尚未自然驗證，無法辨識的原生狀態保留未知。服務協定屬官方網頁使用的介面，仍可能隨版本改變。

- 官方 `ListInstances`：HTTP 200，兩台已授權裝置，狀態均為 CONNECTED。
- 指定公司主機的官方 `ProxyCommand`，內容限定 `GetAllCascadeTrajectories`：HTTP 200。
- 實際收到 22 筆公司端任務摘要，當下全部 IDLE。
- 使用者指定「跨工具Agent調用」有在其中，當下 IDLE；另有 agent-bridge 同專案任務摘要。
- 可重跑版本於台灣時間 02:11、02:12 再次取得相同公司主機與 22 筆摘要。
- 使用者於 02:17 表示已啟動任務；02:17:34 再查同一公司任務，取得 running。公司端此輪共 22 筆：running 1、idle 21、unknown 0。
- 02:34:51 使用 Windows v1.29.4 打包程式內的正式讀取器再查，來源 ready、22 筆 idle，指定任務亦為 idle。已觀察自然 IDLE → RUNNING → IDLE；等待確認、取消與睡眠重連仍待自然對照。
- 229 項單元測試全部通過；打包版四語系 × 四種來源狀態、三列捲軸、立即篩選、固定寬度與診斷複製通過。上述畫面案例使用隔離展示資料；02:34 的官方遠端查詢另為真實資料。

## 可行架構

```text
家用 Pebble
  → Google 官方 ListInstances（只讀裝置）
  → Google 官方 ProxyCommand（白名單只允許讀取任務摘要）
  → 公司 Antigravity 已開啟的 Remote Control
  → GetAllCascadeTrajectories
  → 只留下任務識別、名稱、狀態、來源裝置、觀測時間
```

不需要公司端安裝第三方擴充套件，不需要 CLI、Hook、自架或第三方私人接收端，也不需修改官方 App、啟動推理、送訊息、核准操作或重新配對。

## 介面與格式

端點來源為當日 Google 官方網頁載入的公開 JavaScript，不是猜測 URL：

- `POST https://antigravity.google.com/$rpc/devtools_jetski_boq_api_proto.ApiService/ListInstances`
- `POST https://antigravity.google.com/$rpc/devtools_jetski_boq_api_proto.ApiService/ProxyCommand`
- `Content-Type: application/json+protobuf`
- Google OAuth Bearer authorization。

兩個 POST 都是語意唯讀 RPC；沒有呼叫 UpdateInstance、DeleteInstance、啟動任務或傳送對話。

JSPB 格式：

- ListInstancesRequest：空陣列；可選 project 位於 field 1。
- ListInstancesResponse：field 1 為 instance 陣列。
- InstanceDetails：field 1 UUID、field 2 metadata、field 3 裝置狀態、field 4 狀態時間。
- InstanceMetadata：field 1 名稱、field 2 版本。
- 裝置狀態：0 unspecified、1 connected、2 disconnected、3 idle；這不是任務的執行狀態。
- ProxyCommandRequest：field 1 target UUID、field 2 RPC path、field 3 base64 payload；只送 `{}` 至 `GetAllCascadeTrajectories`。
- ProxyCommandResponse：field 1 base64 JSON payload。
- 任務狀態 RUNNING → running，IDLE → idle；其他值保留 unknown，不把 BUSY 或 CANCELING 猜成等待確認。

這是官方網頁目前使用的內部協定，不是 Google 承諾穩定的公開第三方 API。此次裝置版本為 2.29.0-v2。

## 授權與隱私

- 舊 IDE SQLite 的 OAuth 已過期，沒有更新它，也沒有使用過期 token 硬試。
- Pebble 舊的 Google vault 無法讀取，沒有修改或刪除。
- 成功來源為目前 Windows 使用者的既有 `gemini:antigravity` Credential Manager 項目。
- 只使用仍有效的 access token，未刷新共用 refresh token、未修改 credential、未複製瀏覽器 Cookie。
- token 僅留在查詢程序記憶體並送至固定 Google 官方端點，不出現在 stdout、報告、腳本、Git 或 App renderer。
- 只查指定 credential target，沒有列出其他服務的秘密。

## 可重跑實驗

腳本需要 PowerShell 7；此為研究驗證入口，不是 Pebble runtime 已接入的宣稱。

```powershell
pwsh -NoProfile -File scripts/antigravity-remote-metadata-check.ps1 -SelfTest
pwsh -NoProfile -File scripts/antigravity-remote-metadata-check.ps1 -Live -HostName 'LAPTOP-LASLBBRV' -TaskTitle '跨工具Agent調用'
```

- SelfTest 不讀授權、不連網，驗證裝置格式、任務狀態映射、未知格式拒絕及私密內容排除。
- Live 必須明確指定；從已授權清單找出唯一符合的主機，只允許固定摘要 RPC。
- TLS 正常驗證，禁止轉址，20 秒請求逾時，每個回應最大 1 MiB，最多處理 100 筆任務。
- 失敗回傳安全錯誤碼，不輸出原始回應、憑證、工作目錄、對話或任務 UUID。
- 此次 partial=false 只代表回應沒有超過腳本上限，不保證官方摘要列舉了所有歷史或尚未載入任務。

## 接入 Pebble 前的驗收

1. 再以同一自然公司任務對照 running → idle；等待確認須另找可證明的欄位，不以時間或 BUSY 猜測。
2. 實作背景讀取器，固定官方端點及 RPC 白名單，保留來源健康與錯誤碼。
3. 不把 connected 裝置當成 running 任務；斷線、授權到期、格式不支援立即未知。
4. 以裝置 ID＋任務 ID 隔離跨主機任務；本機與官方遠端相同裝置／任務去重。
5. 初版每 30～60 秒更新、限制主機與任務數、尊重 429 與 Retry-After；不把診斷按鈕變成無限制查詢。
6. 官方摘要可能只包含載入中的任務；不以 LoadTrajectory、恢復聊天或寫入操作補齊清單。
7. 四語系、三筆可見卡片、統計、來源標記與斷線 UI 測試後，才更新正式 App。

## 研究參考

- [Google 官方 Remote Control](https://antigravity.google/docs/remote-control/)
- [官方倉庫 issue 850：ListInstances 與連線故障案例](https://github.com/google-antigravity/antigravity-cli/issues/850)
- [官方倉庫 issue 913：Windows keyring 格式與啟動競態](https://github.com/google-antigravity/antigravity-cli/issues/913)
- [AG-Remote 本機橋接](https://github.com/DrOpenSource/AG-Remote/blob/HEAD/src/adapter-antigravity/ls-bridge.ts)：技術參考，未安裝。

AG-Remote 的額外橋接／中繼不是這次成功使用的路徑。此次資料全程走 Google 官方服務。
