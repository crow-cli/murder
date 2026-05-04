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
| 3 | **Terminal as tab** | Terminal opens as tab in `WorkspacePane`. Survives tab switches. Line wrapping fixed. |
| — | **Remove "Workspace" title bar** | Mosaic window toolbar hidden via CSS. Clean editor/terminal area. |
| — | **Ctrl+` opens terminal tab** | Keyboard shortcut now calls `globalOpenTerminal()` instead of old bottom panel toggle. |

## ⬜ Pending
| # | Task | Status | Notes |
|---|------|--------|-------|
| 3 | Terminal as tab | ⬜ Pending | Terminal can be spawned but not tabbed in `WorkspacePane` yet. |
| 2 | Mosaic split controls | ⬜ Pending | Need L/R/U/D split buttons in workspace toolbar. |
| 4 | Layout persistence | ⬜ Pending | Save/restore mosaic tree to SQLite. |
| 6 | Explorer state persistence | ⬜ Pending | Save expanded dirs, focused file per workspace. |
| 7 | Git watching | ⬜ Pending | Gray `.gitignore`d files, highlight untracked/changed in explorer. |
| 8 | Drag and drop between panes | ⬜ Pending | |
| 9 | Explorer pane resizable | ⬜ Pending | |
| 10 | Split panes resizeable | ⬜ Pending | |
| 11 | **UNFREEZE ACP CLIENT** | ⬜ Pending | `ChatPane`/`ChatSessionPane` frozen per `AGENTS.md`. |
| 12 | Resurrect ACP UI | ⬜ Pending | Rebuild with shadcn/tailwind. |
| 13 | Streamdown with shadcn/tailwind | ⬜ Pending | Code controls, link safety. |
| 14 | Tiptap rich text editor | ⬜ Pending | `@`-context like Zed. |
| 15 | ACP pane as first-class | ⬜ Pending | View stdout/stderr, JSON-RPC stream, agent control. |
| 16 | Multi-agent orchestration | ⬜ Pending | Split + add agent. |
