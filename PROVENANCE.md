# Source and dependencies

MindWeave is licensed under AGPL-3.0-only. See LICENSE and NOTICE.

The current implementation was rewritten after prior exposure to Heading Mindmap and an earlier MindWeave implementation. It is not represented as a clean-room implementation. Existing development records state that source files, styles, tests, and build scripts from those implementations were not copied into this implementation; this statement is not an independent legal audit.

The build uses source files in `src/`. Obsidian and CodeMirror modules are supplied by the host application rather than bundled. Development dependencies are recorded in `package-lock.json` and retain their respective licenses. The generated `build-inputs.json` records bundle inputs.

# 來源與依賴

MindWeave 採 AGPL-3.0-only 授權，詳見 LICENSE 與 NOTICE。

目前實作是在曾接觸 Heading Mindmap 與較早 MindWeave 實作後重新撰寫，不宣稱為隔離式 clean-room 開發。既有開發紀錄記載未將其程式檔、樣式、測試與建置腳本複製到目前實作；這不等同獨立法律稽核。

建置來源為 `src/`。Obsidian 與 CodeMirror 模組由宿主提供，不打包其實作。開發依賴列於 `package-lock.json`，各自保留原授權；`build-inputs.json` 記錄打包來源。
