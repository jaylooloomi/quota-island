# 1.19.0：不依賴 CLI／Hook 的桌面任務來源

日期：2026-11-03。使用者明確要求已記錄於專案根目錄 `AGENTS.md`。

## 實作

產品任務入口使用 `LocalTaskMonitor`，其相依只有唯讀的 `CodexSessionReader`。不建立 Codex CLI、app-server 或 proxy 程序，不讀取 Hook 事件，不安裝 Hook。原有配額查詢是另一條流程，並不是任務狀態來源。

資料來自 `$CODEX_HOME/sessions`，未設定時使用 `~/.codex/sessions`。顯示名稱由相鄰的 `session_index.jsonl` 取得；名稱與檔案修改時間不會成為執行中的證據。已移除任務頁的「安裝狀態橋接」入口，也移除本機先前由 Pebble 建立的八個 Hook 設定，保留備份與其他工具的設定。

參考 [Ocelin](https://github.com/m-sanchez/ocelin) 的設計思路，獨立實作有界讀取與事件狀態機：

- [reader.mjs](https://github.com/m-sanchez/ocelin/blob/main/server/monitor/reader.mjs)：有上限的頭尾／增量讀取。
- [records.mjs](https://github.com/m-sanchez/ocelin/blob/main/server/monitor/records.mjs)：將 session 事件整理為生命週期證據。
- [model.mjs](https://github.com/m-sanchez/ocelin/blob/main/server/monitor/model.mjs)：區分執行、等待、結束與過期。

不複製其聊天預覽、工具參數或訊息內容功能。解析後僅保留 ID、專案、標題、回合 ID、事件種類與事件時間；不保存原始紀錄、提示詞、輸出、Token 或密碼。

## 狀態語意

所有本機記錄來源均標示「本機事件 · 推定」，任務狀態以 `*` 提醒其推定性。這不是官方 Runtime 的當下確認。

| 證據 | 呈現 |
|---|---|
| task_started／turn_started、新近具回合 ID 的活動或工具執行 | 執行中（推定） |
| 記錄中的 request_user_input／授權要求 | 等待確認；一般 Token 活動不能清掉等待 |
| task_complete／turn_complete 等明確結束事件 | 閒置，代表上一回合已結束，不代表整個專案完成 |
| turn_aborted | 閒置，保留中斷原因 |
| 只有 assistant final 文字 | 未知；它可能先於 Stop-hook 繼續執行 |
| 未結束且五分鐘沒有有效事件 | 未知，不永久保留執行中 |
| 缺少事件、格式不支援、讀取落後、檔案消失 | 未知或移除該來源，不補造狀態 |

同一 session 去重；排除 subagent 檔案。已完成的回合不會被晚到的 Token／工具活動重新開啟；舊回合的終止事件不會結束新回合。等待提問維持到對應工具結果出現，或回合明確結束。

## 範圍與效能

- 已發現檔案每兩秒檢查，新檔案最多約十秒發現。
- 最多發現 5,000 個候選檔案、追蹤最近 200 個檔案，畫面最多 100 筆；達上限會標示部分資料。
- 大檔啟動最多讀 64 KiB 檔頭與 256 KiB 檔尾；增量每檔每次最多兩個 256 KiB 區塊，每輪總讀取預算 16 MiB。
- 只解析完整 JSONL 記錄，跳過超大／損毀記錄；支援截斷、替換、刪除及暫時不存在後重新出現。
- 來源只涵蓋本機落地記錄。雲端未落地任務、未支援的版本或缺失事件仍可能漏掉；沒有結束事件也不能永久當作執行中。
- 保持清單三筆高度與捲動條，資料更新保留捲動位置；四語系、收合尺寸與寵物偏好維持。

## 本機實測

使用自然執行中的桌面聊天比對，不發送測試推理、不啟動 CLI、不使用 Hook：

- 本聊天：本機記錄判為 running，桌面工具同一 ID 回傳 active。
- 另一個已結束聊天：記錄含 task_complete，讀取器判為 idle，桌面工具也回傳 idle。
- 後續該聊天重新執行時，1.19.0 打包版同時顯示兩個 running，與桌面聊天清單的兩個 active ID 相符。來源明確標示「本機事件 · 推定」。
- 此聊天記錄超過 800 MB；首次掃描全部候選約讀 10 MB、169 ms，緊接的增量檢查約 2 KB、18 ms。這是單次測量，不是效能保證。

測試涵蓋多會話、等待、明確完成、舊回合晚到事件、過期、巨型／半寫入記錄、刪除、重新出現、子代理排除、隱私欄位，以及沒有 CLI／Hook 的產品入口。

```sh
npm run test:coverage
npm run test:tasks
npm run test:sessions
npm run check:tasks
node scripts/task-monitor-live-ui.cjs --live
```

`check:tasks` 與 `--live` 都是唯讀觀察既有資料，不會建立、繼續或停止任何任務。

本機驗證：138 項單元測試通過，整體行覆蓋率 90.93%、分支覆蓋率 86.62%；桌面基本功能、趨勢線圖、任務頁四語系及打包版 session 測試通過。首次掃描完成前不發布局部筆數，避免狀態與計數不一致。
