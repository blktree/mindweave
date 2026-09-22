# MindWeave

[English](#english) | [繁體中文](#繁體中文)

## English

Turn your Markdown notes into interactive, editable mind maps in Obsidian. Understand information faster, organize your thoughts, and develop new ideas while keeping your content in Markdown.

Desktop only, requiring Obsidian 1.13.7 or later. Tested on macOS; Windows and Linux still need live verification. Not yet listed in the Obsidian Community directory.

### Introduction videos

- [English introduction](https://www.youtube.com/watch?v=48iJPPwGENs)
- [Chinese introduction](https://www.youtube.com/watch?v=vD3iUtLDmx0)

![MindWeave mind map and content preview](docs/images/03-existing-note-map.png)

### Features

- View Markdown headings as nodes, with optional body previews and nested lists.
- Add, rename, delete, and drag nodes to reorganize branches and sibling order.
- Read and edit section content in the native Markdown editor below the map.
- Copy, cut, and paste entire subtrees, including their content. Cutting is limited to the same note; copying works across MindWeave notes.
- Paste external text to create one child node per nonempty line.
- Preview linked notes and sections, preserve link aliases, and expand linked outlines.
- Pan by dragging the background or document root. Zoom around the pointer with the mouse wheel.
- Expand or collapse individual branches or the entire map.
- Choose four themes, customize node colors, and set text wrapping (at least 6 characters per line, with no upper limit).
- Choose Traditional Chinese, Simplified Chinese, English, or Japanese toolbar and shortcut labels. Some editor labels and error messages remain in Traditional Chinese.

### Installation and getting started

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/blktree/mindweave/releases/latest).
2. Place them in `.obsidian/plugins/mindweave/` inside your vault.
3. Restart Obsidian or reload plugins, then enable **MindWeave** under **Settings → Community plugins**.
4. Open a Markdown note and click the lightbulb in the left sidebar. The toolbar document icon switches back to Markdown.
5. Choose your interface language under **Settings → MindWeave → Language**. This changes interface labels, not note content.

Back up your vault before using editing features. Read the [bilingual user guide](docs/USER_GUIDE.md) for complete walkthroughs: building a mind map from scratch and converting an existing Markdown note.

Practice notes: [Weekend Trip](docs/examples/01-weekend-trip.md) and [Website Redesign](docs/examples/02-website-redesign.md).

### Keyboard and mouse controls

Select a node and focus the canvas first. While editing text, normal editor shortcuts apply. Use Command on macOS and Ctrl on Windows.

| Action | Shortcut |
| --- | --- |
| Edit title | R or double-click |
| Save title | Enter or click the canvas background |
| Cancel title editing | Esc |
| Add sibling / child | Enter / Tab |
| Promote node | Shift + Tab |
| Delete node and subtree | Delete / Backspace |
| Navigate between nodes | Arrow keys |
| Reorder siblings | Option / Alt + ↑ or ↓ |
| Expand / collapse | Space |
| Copy / cut / paste subtree | Cmd/Ctrl + C / X / V |
| Undo / redo | Cmd/Ctrl + Z / Cmd/Ctrl + Shift + Z |
| Edit section content | Cmd/Ctrl + Enter |
| Show / hide content panel | Cmd/Ctrl + Space |
| Zoom around the pointer | Mouse scroll wheel |

Drag a node onto another node to make it a child, or near its upper/lower edge to change order. Drag the bottom divider upward to reveal the content panel. Body editing uses native autosave; Cmd/Ctrl + S also saves.

### Limitations and privacy

- Markdown supports six heading levels. File roots and read-only outline/list nodes cannot be copied or cut as editable subtrees.
- Expanded external outlines are read-only for structural edits; editing their content writes back to the linked source note.
- Structural undo and native body-editor undo are separate. Body or external file changes clear old structural history to avoid overwriting newer content.
- No plugin-specific account, paid feature lock, telemetry, advertising, or self-update mechanism.
- MindWeave does not upload notes or use its own remote API. Obsidian or other extensions may fetch remote images and embedded content referenced by your notes.
- Editing writes to Markdown files in your vault. Appearance and language preferences are stored in the plugin data file. Copy/cut writes selected content to the system clipboard; paste reads clipboard text when invoked.
- Mobile is not supported. Windows/Linux live testing and large-scale Markdown edge-case testing are still pending.

### Development and license

```sh
npm ci
npm test
npm run build
npm run release:check
node install-preview.mjs /absolute/path/to/vault
```

Build inputs are recorded in `build-inputs.json`. Obsidian and CodeMirror modules are provided by the host rather than bundled. Live verification scripts modify dedicated QA notes and may create attachments; do not point them at personal notes. Automated checks do not constitute Community directory approval.

Copyright (C) 2026 blktree. Licensed under **AGPL-3.0-only**, without warranty. See [LICENSE](LICENSE) and [NOTICE](NOTICE). The package setting `private: true` prevents accidental npm publication; the source repository is public.

Development is supported by voluntary contributions: [Buy Me a Coffee](https://buymeacoffee.com/blktree). Donations do not unlock or restrict features.

---

## 繁體中文

把 Markdown 筆記轉成可閱讀、編輯與重新分類的心智圖。

可從 [GitHub Releases](https://github.com/blktree/mindweave/releases/latest) 下載，目前尚未在社群目錄上架。支援 Obsidian 桌面版 1.13.7 以上；實機測試平台為 macOS，Windows／Linux 尚待實機驗證，手機版不開放安裝。

## 介紹影片 / Introduction videos

觀看 MindWeave 的功能介紹與操作示範。Watch MindWeave in action:

- [English introduction — MindWeave for Obsidian](https://www.youtube.com/watch?v=48iJPPwGENs)
- [中文介紹 — MindWeave Obsidian 心智圖外掛](https://www.youtube.com/watch?v=vD3iUtLDmx0)

## 使用

![MindWeave 中英文範例與正文閱讀 / Bilingual mind map and content preview](docs/images/03-existing-note-map.png)

第一次使用請看 [中英文操作手冊 / Bilingual user guide](docs/USER_GUIDE.md)，包含「從空白建立心智圖」與「既有 Markdown 轉心智圖」的完整步驟、預期結果、快捷鍵及常見問題。

可下載練習筆記：[週末旅行 / Weekend Trip](docs/examples/01-weekend-trip.md)、[網站改版 / Website Redesign](docs/examples/02-website-redesign.md)。範例內容同時包含中文與英文，不含私人資料。


開啟 Markdown 筆記後，使用命令「開啟思維導圖」、檔案選單「以 MindWeave 開啟」，或左側燈泡圖示。工具列的文件圖示可切回 Markdown。

設定 → MindWeave → 語言，可選繁體中文、簡體中文、English、日本語。工具列與快捷鍵說明會即時更新；這不是筆記翻譯功能，部分錯誤訊息與編輯介面仍為繁體中文。

- 空白處或文件根節點拖曳整張圖，滾輪以滑鼠位置為中心縮放；適配全圖時靠左。
- R 或雙擊標題開啟大型文字編輯框；Enter 新增同級、Tab 新增子節點、Shift+Tab 升級。
- 節點拖至另一節點中央變成子節點，上／下緣則調整順序。Delete 刪除節點與子樹，可復原。
- Ctrl/Cmd+Z 復原、Ctrl/Cmd+Shift+Z 重做；復原精確恢復 Markdown 原文。
- 個別或全部收合／展開，操作節點位置固定。
- 四套主題、自訂文字與底色、每行至少 6 字（無上限）、內文與階層清單顯示。
- Ctrl/Cmd+C、X、V 複製、剪下與貼上子樹；剪下限同一筆記。外部文字貼上時，每個非空白行建立一個子節點。
- Wiki／Markdown 連結保留別名；選取後預覽連結章節，雙擊展開外部大綱。外部節點的結構操作唯讀，正文可按鉛筆在下方就地編輯並儲存回來源筆記。
- 正文區預設完全收合，可拖曳底部分隔線展開。Ctrl/Cmd+Enter 在下方原生 Markdown 編輯器編輯；自動儲存或 Ctrl/Cmd+S 儲存，點「完成」回到閱讀。
- 原生編輯器維持完整文件，畫面與輸入僅限目前正文；保留圖片貼上、原生復原和編輯器擴充。
- R／雙擊使用節點旁的寬版輸入框，Enter 或點擊畫布空白處儲存、Esc 取消；不是另開對話框。
- 顯示設定按筆記記憶；重新開啟重新適配全圖。

## 目前界線


- 重新命名、搬移及復原會一起追蹤節點外觀與選取，不需重新上色。
- 標題／結構歷史與正文原生歷史分開；正文或外部檔案更新後會清除舊結構歷史，避免結構復原覆蓋新正文。
- 尚未進行手機版實機測試、大量真實筆記的 Markdown 邊界測試，或官方目錄送審。
- 本專案採用 AGPL-3.0-only，Copyright (C) 2026 blktree。完整條款見 [LICENSE](LICENSE)，著作權聲明見 [NOTICE](NOTICE)。`private: true` 僅防止誤發佈 npm，不代表原始碼不公開。

## 隱私、網路與費用

- 目前外掛沒有登入、付費驗證、遙測、廣告或自動更新機制；不要求外掛專用帳號，也沒有付費功能鎖。
- 外掛程式沒有自建遠端 API 或主動上傳筆記。正文使用 Obsidian 的 Markdown 渲染器；筆記若包含遠端圖片或其他嵌入內容，Obsidian／已安裝擴充仍可能向該內容來源發出請求，因此不保證任意筆記均完全離線。
- 編輯操作會修改目前 vault 中的 Markdown，包含明確選取的連結筆記正文；不主動讀寫 vault 以外的檔案。
- 自訂外觀與語言儲存在外掛的 `data.json`。建議使用前備份 vault；正文與結構的復原歷史分開。
- 允許依 AGPL-3.0-only 使用、修改與散布，軟體不提供擔保。採公開原始碼與自願贊助方向，贊助入口使用 manifest 的 fundingUrl，由 Obsidian 顯示；不影響功能使用。未來若收費或需要帳號，必須先更新本說明。

## 開發與驗證

```sh
npm ci
npm test
npm run build
npm run release:check
node install-preview.mjs /absolute/path/to/vault
```

建置輸出 `build-inputs.json` 可檢查所有打包來源；執行時 external 引用主程式提供的 `obsidian`、`@codemirror/state`、`@codemirror/view`，不打包其實作。

公開測試使用 `tests/` 內的合成資料與 `docs/examples/` 範例，不需要私人筆記。自動測試通過不代表所有平台或 Markdown 邊界情況均已實測，也不代表官方上架審核通過。
