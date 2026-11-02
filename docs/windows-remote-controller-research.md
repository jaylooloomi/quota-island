# Windows 遠端任務監控：已驗證路徑

更新：2026-11-03（台灣時間），版本 1.20.0。

## 本次已解決

原生模組原樣複製到隔離目錄後，載入錯誤由 Access is denied 變成相依模組缺失。
PE 匯入表包含官方 App 的 chrome.dll，不能當成一般 Node 套件直接使用。
這些證據縮小原因，但沒有證明單一 Windows 系統政策是最初錯誤的完整根因。

正式實作改用 Windows CNG：公鑰先與既有授權登錄比對，私鑰留在 Windows，
只允許讀公鑰及簽署經驗證的官方挑戰。沒有建立、刪除、匯出官方裝置私鑰或修改官方 App。
這是沿用使用者現有授權，不是替 Pebble 新建獨立登錄；後者仍涉及 step-up 安全驗證。

| 實測 | 結果 |
| --- | --- |
| 既有 CNG 公鑰 | 與登錄一致，非匯出政策為 0 |
| 官方 refresh/start、refresh/finish | 都為 HTTP 200 |
| 獨立 Windows WebSocket 簽章挑戰 | 通過 |
| 遠端 initialize、thread/list | 成功 |
| 指定 MCP 任務 thread/read | 取得真實 runtime 狀態，查詢時 idle |
| 正式模組 | 取得 30 筆近期遠端任務，包含 MCP 任務 |
| 中斷連線／重連 | 即時狀態變未知，重連後可再次讀取 |

全程沒有啟動 Codex CLI、app-server、推理、Hook 或私人接收端，亦未冒用助手聊天執行器身分。
OAuth 權杖與簽章只存在記憶體與受控子程序管道，不寫入 UI、報告或診斷 log。
另以 Pebble 自有測試金鑰驗證 CNG 非匯出政策、公鑰跨程序重開、八次簽章及竄改拒絕；
測試金鑰已刪除，這項離線測試本身不代表遠端授權成功。

## 功能範圍與限制

- Windows 相容的既有 ecdsa_p256_sha256 / os_protected_nonextractable 登錄已驗證。
  未配對、其他金鑰類別或公鑰不符時保留本機監控，不自行重設授權。
- 校驗帳號、client、公鑰、nonce、目標 origin/path、audience、到期、token digest 與 scope。
- 任務只用 thread/list 與 thread/read(includeTurns:false)，不 resume、不讀回合內容、不寫任務。
- 每 30 秒更新，每台最多最近 30 筆、五台遠端主機，含本機合計最多顯示 100 筆。
  後續頁未讀完會標示部分記錄；日期篩選與計數也只涵蓋這個範圍。
- 遠端狀態直接使用 runtime；未載入、無法辨識、查詢失敗、斷線或觀測超過 65 秒顯示未知。
- 各主機 ID 分隔，本機不重複計入遠端。只保存任務中繼資料，不保存逐字稿或原始回應。
- token 到期或登入資料改變會重新驗證。失敗採 30 秒起、最多五分鐘加抖動的退避。
- 限制分段大小、框架頻率、RPC 逾時與掃描預算；不盲目對通知發送 ack。
- 控制端協定不是官方保證穩定的第三方 SDK；目前不代表 macOS/Linux 也已支援。

## 重跑驗證

執行 npm run build、node --test test/remote-task-monitor.test.cjs、node scripts/task-monitor-test.cjs。
真實遠端驗證使用 node scripts/remote-task-live-test.cjs --live，讀取既有授權、測試斷線失效及重連，
不建立任務。可設定 QUOTA_PACKAGED_EXE 驗證打包成品。UI 配額為展示資料，任務為真實遠端資料。
報告與截圖在忽略的 test-results/remote-task-live/，不提交裝置識別資料。

CNG 政策參考 [Microsoft 文件](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.cngexportpolicies)。
協定與官方文件來源見以下歷史研究紀錄。

---

# 第一輪研究紀錄（歷史，並非目前功能狀態）

以下保留當時的卡點與計畫；其中尚未完成的門檻，已由上方本次實測重新確認。

# Windows 遠端任務控制端研究

研究日期：2026-11-03（台灣時間）。分支：`codex/research-windows-remote-controller`。

## 結論

這條方向仍有研究價值，但尚不能納入正式版並宣稱可用。這次實測的卡點是：
Windows 安裝包已存在原生裝置簽章元件，獨立 Node 與 Pebble 的 Electron 執行環境
卻都無法直接載入，均為 `ERR_DLOPEN_FAILED / Access is denied`。
這只證明直接載入失敗；尚不能斷定是套件身分、檔案權限或相依元件造成。
不應把它當成帳號授權失敗，也不能因此要求重新配對。

正式 App 未改動，未新增遠端監控開關，未重啟官方 App。

## 本機實測

| 項目 | 結果 |
| --- | --- |
| 官方 Windows 安裝包 | 26.1027.3384.0 |
| 原生元件 `remote-control-device-key.node` | 存在 |
| 既有控制端登錄資料 | 存在，僅檢查公鑰資料的欄位與類型 |
| 登錄演算法／保護類別 | `ecdsa_p256_sha256` / `os_protected_nonextractable` |
| 獨立 Node 載入元件 | Access is denied |
| Pebble Electron 載入元件 | Access is denied |
| 此次遠端握手／任務查詢 | 未執行，不能宣稱成功 |

上述登錄標籤不證明第三方 App 可使用該金鑰，也不代表已驗證硬體保護。
沒有讀取私鑰、帳號 token、聊天內容；沒有更新權杖、建立／刪除金鑰或變更配對。

可重跑的離線探測：

```powershell
node scripts/research-remote-windows-readiness.cjs "C:\Program Files\WindowsApps\<目前安裝包>\app\resources"
```

只列元件能力及載入結果，不呼叫任何金鑰建立、簽章或刪除方法，也不連網。
本次探測詳細結果位於本機忽略的 `test-results/remote-windows-research/`，不提交裝置識別資料。

## 上游查核

參考 [lucianlamp/codex-monitor 控制端原始碼](https://github.com/lucianlamp/codex-monitor/blob/95a9b5f9e41b099661d7970e5e06c482fcf292cd/src/remote_control.rs)。
該檔案最近提交為 `95a9b5f9e41b099661d7970e5e06c482fcf292cd`；查核時 main 的 Windows
連線、配對 claim、裝置金鑰檢查仍為未實作分支。非 Windows 的流程可作為協定研究參考：
先檢查登錄公鑰，完成 refresh challenge 簽章，再取得短效控制端 token，連線並回應
WebSocket challenge。接收訊息不等於完成任務列舉。

[官方跨裝置文件](https://learn.chatgpt.com/docs/remote-connections) 說明官方安全中繼及裝置授權，
但沒有提供可直接取代上述流程的第三方控制端 SDK 合約。

另有 [Windows 相容層](https://github.com/naipi11/CodexRemote-fix/blob/main/docs/TECHNICAL.md)
採用程序注入與替代簽章實作。這是另一種設計，不能當成官方授權介面；本次未安裝或執行。
不應為了套用它而修改官方程序、繞過功能開放或冒用其裝置身分。

## 後續實作順序與成功門檻

1. **先解決獨立身分與簽章。** 研究 Pebble 自有 Windows CNG 非匯出 P-256 金鑰及
   獨立控制端登錄；不能只新建金鑰便假定官方會接受。需取得可完成的授權流程，
   由使用者辨識並核准「Quota Pebble」這個裝置。不得冒用現有 App 的 client ID，
   不以改標籤方式將軟體金鑰宣稱成硬體／非匯出金鑰。
2. **再驗證官方中繼。** 驗證 challenge 的目標 origin/path、帳號、client、到期、
   nonce、token digest 及 scope；不記錄 token 或簽章。確認如何選定 environment。
   此段 controller 路由仍需實測；不能將公開的 host 端協定直接當成 controller 合約。
3. **取得任務。** 唯讀 `thread/list` 後針對候選任務使用 `thread/read`，
   不傳 `thread/resume`，不啟動回合。保留主機與工作區邊界，只取任務中繼資料。
   [官方 thread/read 文件](https://learn.chatgpt.com/docs/app-server#read-a-stored-thread-without-resuming)
   支援不恢復聊天的狀態查詢，但其可用性仍取決於正確的遠端連線。
4. **狀態與斷線。** 以有來源的 runtime 狀態更新執行／等待／閒置，未載入或證據
   過期顯示未知。斷線立即使即時證據失效；重連重新查詢，不沿用舊執行數。
5. **保護通訊。** bounded queue、訊息與分段大小上限、逾時、抖動退避、重複事件去重。
   [#45071](https://github.com/openai/codex/issues/45071) 的作者曾回報 ack 回授造成訊息風暴，
   並以每條連線的熔斷處理緩解。這是已回報的相容性案例，不代表本機也發生。
   不盲目 ack 所有訊息；先按實際 controller 協定驗證，再測異常循環保護。
6. **驗收。** 同時與官方 App 對照遠端自然執行、等待、完成、斷網、重連及權杖到期。
   每個結果標示「本機離線測試」或「遠端真實測試」；只有後者通過才能開啟正式功能。

## 目前尚未通過的門檻

獨立控制端的正式授權與可用簽章、Windows 遠端握手、指定主機、列舉任務、
逐筆 runtime 更新及斷線恢復，均未完成驗證。不能以已有登錄、裝置 online、
或助手能查到遠端聊天替代以上門檻。
