# Murder IDE — TODO

## Architecture
- **Session State (`~/.crow/state.db`)**: SQLite-backed. Workspaces, layout, open tabs, cursor positions, explorer state.
- **Preferences (`~/.crow/murder.json`)**: JSONC-backed. Editor settings, themes, fonts, word wrap.
- **Config Path**: `get_config_path` handler returns `~/.crow/murder.json`.
- **Database Path**: `Database::open_default()` opens `~/.crow/state.db`.

## ✅ Completed
| # | Task | Notes |
|---|------|-------|
| 5 | **Auto-open last workspace** | SQLite-backed via `recent_workspaces` table. Instant resume on launch. |
| 1 | **Fix Monaco worker warnings** | Vite `?worker` imports (`editor.worker`, `ts.worker`, etc.). Real threads, zero warnings. |
| — | **Monaco rendering in mosaic** | `absolute inset-0` fix for editor container inside `relative` parent. Content visible. |
| — | **SQLite session architecture** | Separated session state (SQLite) from preferences (JSON). Clean, scalable. |
| — | **Terminal as tab** | Terminals open as tabs in `TerminalTile`. Distinct PTYs per tab. Line wrapping fixed. |
| — | **Remove "Workspace" title bar** | Mosaic window toolbar hidden via CSS. Clean editor/terminal area. |
| — | **Ctrl+` opens terminal tab** | Keyboard shortcut now calls `globalOpenTerminal()` instead of old bottom panel toggle. |
| — | **Typed tiles architecture** | `EditorTile` (file tabs) + `TerminalTile` (terminal tabs) + `ChatTile` (agent sessions). Each with tab bar, minimize/restore, state persistence. |
| — | **Tile drag-and-drop** | `MosaicWindow` wrapper with custom drag strip. Rearrange tiles by dragging header strip. |
| — | **Minimize/Restore tiles** | Click bottom bar icons to hide/restore all tiles of a type. State preserved in `tileRegistry`. |
| — | **Chat tile integration** | Chat spawns as a mosaic tile (not sidebar). Tabbed ACP sessions, Streamdown rendering, tool call accordions, minimize/restore, `globalOpenChat()`. |

## ⬜ Pending
| # | Task | Status | Notes |
|---|------|--------|-------|
| 2 | Mosaic split controls | ⬜ Pending | Need L/R/U/D split buttons in workspace toolbar (context menu works but fragile). |
| 4 | Layout persistence | ⬜ Pending | Save/restore mosaic tree to SQLite (partially done — save works, restore needs polish). |
| 6 | Explorer state persistence | ⬜ Pending | Save expanded dirs, focused file per workspace. |
| 7 | Git watching | ⬜ Pending | Gray `.gitignore`d files, highlight untracked/changed in explorer. |
| 8 | Drag and drop between panes | ⬜ Pending | File tabs can drag between editor tiles. Need explorer → editor drag. |
| 9 | Explorer pane resizable | ⬜ Pending | |
| 10 | Split panes resizeable | ⬜ Pending | Mosaic borders are draggable but need visual feedback. |
| 11 | **UNFREEZE ACP CLIENT** |  Done | Chat tile integration complete. Chat spawns as mosaic tile with tabbed sessions. |
| 12 | Multi-agent orchestration | ⬜ Pending | Multiple agent sessions per tile via tab bar + button. |
| 13 | Streamdown with shadcn/tailwind | ⬜ Pending | Code controls, link safety — basic rendering works. |
| 14 | Tiptap rich text editor | ⬜ Pending | `@`-context like Zed. |
| 15 | ACP pane as first-class | ⬜ Done | Chat tile is first-class mosaic tile with full ACP support. |
