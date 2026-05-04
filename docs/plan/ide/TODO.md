# IDE TODO — Feature Parity with VSCode Server (localhost:9888)

## Reference: VSCode Server UI Patterns
Use `localhost:9888` as visual/behavioral reference for:
- Layout structure (activity bar, sidebar, editor, status bar)
- Tab bar behavior (dirty indicators, close buttons, middle-click close)
- Explorer interactions (right-click menus, drag-and-drop, multi-select)
- Editor features (breadcrumbs, minimap, split editors)
- Terminal integration (multi-tabs, split, color output)
- Command palette (fuzzy search, keybinding display, grouped results)
- Focus management (where focus goes on every action)

## Priority 1: Visual/Layout Parity

### Panel Structure
- [ ] Activity bar icons match VSCode (use proper codicons, not emoji)
- [ ] Sidebar width default ~250px, resizable
- [ ] Editor area fills remaining space
- [ ] Status bar spans full width, proper sections (left: branch/sync, center: cursor pos, right: language/encoding/line ending)
- [ ] Menu bar styling matches VSCode (dropdown menus, keyboard shortcut display)

### Tab Bar
- [ ] Tabs sit between menu bar and editor (NOT inside editor area)
- [ ] Active tab: white background, bottom border accent
- [ ] Inactive tab: semi-transparent, hover shows subtle background
- [ ] Middle-click to close tab (browser default)
- [ ] Scrollable tabs when too many open (arrows or overflow)
- [ ] Tab close button only appears on hover (not always visible)
- [ ] Drag to reorder tabs

## Priority 2: Explorer Parity

### File Tree
- [ ] Collapse/expand with keyboard (Left/Right arrows)
- [ ] Single-click selects file, double-click opens
- [ ] Auto-reveal in explorer when opening a file
- [ ] Compact folders (collapsed inline path like `src/components/`)
- [ ] File nesting (`.ts` hides next to `.tsx` when both exist)
- [ ] Drag-and-drop file reordering/moving
- [ ] Copy/paste files via explorer context menu

### Explorer Context Menu (Right-Click)
- [x] New File... (creates file, opens editor, focuses input)
- [x] New Folder...
- [x] Rename... (inline rename with input field)
- [x] Delete (moves to trash or permanent)
- [x] Copy Path / Copy Relative Path
- [ ] Reveal in File Manager
- [ ] Compare with Selected
- [ ] Copy / Cut / Paste

## Priority 3: Editor Parity

### Editor Chrome
- [ ] Breadcrumbs bar above editor (shows file path, clickable segments)
- [ ] Minimap on right side (toggleable, shows code overview)
- [ ] Line numbers (toggleable, relative line numbers option)
- [ ] Indent guides (vertical lines showing nesting level)
- [ ] Bracket pair colorization
- [ ] Bracket matching (highlight matching bracket on hover)

### Editor Actions
- [ ] Split editor (right, below, new window)
- [ ] Move editor to group
- [ ] Pin/unpin editor (prevents auto-close)
- [ ] Sticky scroll (header lines stick to top while scrolling)

### Editor Context Menu (Right-Click)
- [ ] Cut / Copy / Paste
- [ ] Quick Fix... (lightbulb)
- [ ] Format Document / Format Selection
- [ ] Go to Definition / Type Definition / Declaration
- [ ] Find All References
- [ ] Rename Symbol
- [ ] Change Language Mode
- [ ] Command Palette...

## Priority 4: Keyboard & Focus

### Focus Management
- [ ] Click on editor → editor gets focus (not chat)
- [ ] Click on explorer → explorer gets focus
- [ ] Click outside any panel → last-focused panel retains or editor gets it
- [ ] NO focus drift — chat panel never steals focus unexpectedly
- [ ] Focus border indicator (blue outline on focused panel)

### Keyboard Shortcuts (VSCode defaults)
- [ ] Ctrl+Shift+P — Command Palette
- [ ] Ctrl+P — Quick Open (file search)
- [ ] Ctrl+G — Go to Line
- [ ] Ctrl+F — Find in File
- [ ] Ctrl+H — Find and Replace
- [ ] Ctrl+Shift+F — Find in Files
- [ ] Ctrl+Shift+H — Replace in Files
- [ ] Ctrl+/ — Toggle Line Comment
- [ ] Ctrl+Shift+/ — Toggle Block Comment
- [ ] Tab / Shift+Tab — Indent / Outdent
- [ ] Ctrl+D — Add Selection to Next Find Match
- [ ] Ctrl+Shift+K — Delete Line
- [ ] Alt+↑/↓ — Move Line Up/Down
- [ ] Shift+Alt+↑/↓ — Copy Line Up/Down
- [ ] Ctrl+Enter — Insert Line Below
- [ ] Ctrl+Shift+Enter — Insert Line Above



### Command Palette
- [ ] Fuzzy search across all commands
- [ ] Grouped by category (File, Edit, View, etc.)
- [ ] Shows keyboard shortcut next to each command
- [ ] Recently used commands at top
- [ ] Filterable by `>` prefix (commands only)

## Priority 5: Terminal Parity

### Multi-Terminal
- [ ] Terminal tabs (like editor tabs)
- [ ] Split terminal (horizontal/vertical)
- [ ] Maximize/minimize terminal panel
- [ ] Terminal context menu (split, rename, kill, clear)

## Priority 6: Backend

### WebSocket Handlers Needed
- [ ] `file_create` — create file via explorer
- [ ] `file_delete` — delete/trash file
- [ ] `file_rename` — rename file
- [ ] `file_copy` — copy file
- [ ] `file_move` — move file
- [ ] `editor_split` — split editor view
- [ ] `terminal_create` — new terminal instance
- [ ] `terminal_split` — split terminal
- [ ] `terminal_resize` — resize terminal
- [ ] `terminal_kill` — kill terminal

## NOT IMPORTANT (explicitly NOT building)

These VSCode features are excluded from scope. Do NOT implement:

### Extension Ecosystem
- Extension marketplace
- Extension host process
- Extension API compatibility
- Extension activation events
- Extension contributions (menus, commands, views)
- Language server protocol via extensions
- Snippet extensions
- Theme extensions
- Icon theme extensions
- Debug adapter extensions
- Webview panels
- Custom editor providers

### Enterprise Features
- User/workspace settings sync
- Settings editor UI (JSONC only)
- Keybindings editor UI (JSONC only)
- Profiles (multiple config profiles)
- Remote development (SSH, WSL, containers)
- Tunnels / port forwarding
- Multi-root workspaces
- Workspace trust

### Heavy Workbench Parts
- Notebook editor
- Interactive playground
- Timeline view
- Outline view
- Problems panel (use RPC log instead)
- Output panel (use terminal)
- Debug view / debug console
- SCM (source control) panel — basic git status only
- Extensions view — stub only
- Search panel — basic only
- Comments panel
- Merge editor
- Welcome page (beyond current minimal one)
- Getting started walkthroughs

### Accessibility & i18n
- Screen reader support
- High contrast theme
- Keyboard navigation mode
- Localization / NLS
- RTL layout
- Font ligatures
- Zoom / accessibility zoom

### Other
- Telemetry
- Update notifications
- License management
- Error reporter / crash reporter
- Performance profiling UI
- Memory profiling
- Network logging UI
- Process explorer
- Issue reporter
- Extension bisect
- Developer tools (beyond RPC log)
- Extension development host
- Test runner UI
- Coverage visualization



## New Plan

We have a pretty solid little web/electron IDE-ish editor here. I mean the presence of the terminal is pretty much all I need for it to be considered IDE in a lot of ways. The ability to see which files are being tracked in git, what's changed since the last git commit in little bars on the side is nice and common must-have for IDEs, but I'm thinking I'm pretty much good except for a few things I want to call out here that are very much like "this is what we want for our editor/IDE that is different" because yeah we've done a LOT of the above so it's time for a new perspective. I don't necessarily think that copying vscode style going forward is necessarily what we want to do. There are features we're going to leave out because agents.

So the work  we've done here is really really good. I'm proud of this.


## New To Do

### Choose Directory to open (not in the file explorer but on startup)
- "most recent folder opened" / "recent folders" option should be a list at the top right to select from
- call folders directories
- default directory if no recent directory opened (unlikely) will be $HOME, not /home
- hide hidden directories when selecting which file to open or show under non-hidden (hidden directory config/UI selector?)
- when double clicking a new directory, focus in scrollbar should shift back to top unlike how it works right now

### Filesystem explorer on right hand side of app (opened folder)
- ~~move sidebar that contains the folder icon on left to right side of page for consistency~~ <- Decided to do the below
- <thoughts>Honestly zed makes full use of the little icon at the bottom of the page to not even have this sidebar and we should do that tbh</thoughts>
- ![zed screenshot](/home/thomas/src/crow-ai/murder-sidex/murder-ide/docs/plan/ide/zed-screenshot-icons-small-at-bottom.png)
- Yeah we should ditch the sidebar entirely. in fact let's ditch the idea of a traditional upper editor/lower terminal dichotomy while we're at it. let's just make it to where you can split right/left and up/down.
- but keep the filesystem explorer on the right for now when it's selected. we can work on something more specialized than that much later the position of filesystem explorer is good.
- we will move the filesystem selector to the bottom right of the page
- any save closes open directories in file explorer which we do not want


### UI
- we don't need huge popup at bottom of page on every save
- terminal wrapping overwrites line and causes inconsistencies/bugs in how terminal is displayed, it will overwrite the entire line starting at the beginning again instead of on the line below
- the status bar on the bottom is lime green and should be the same purple with green accents as rest of page and have small icons from material or github icons something open source to represent the following
  - search
  - directory explorer (and through it new editors)
  - terminal
  - chat
  - ACP logging (rename RPC->ACP)
- when the user selects one of the above the directory explorer is the only one that opens to a default location/pane (minimizable vertical on right side) within the larger app
- the rest all exist in the same pane as the editor, central focus.
- no more terminals by default on the bottom, they will open as a new editor window but show a xterm.js terminal
- we will implement split left/right and top/bottom for windows and make them drag and drop-able
- ![zed split left/right or up/down](/home/thomas/src/crow-ai/murder-sidex/murder-ide/docs/plan/ide/zed-screenshot-split-up-down-left-right.png)
- we need to make divisions between split windows customizable/stretch/drag moveable
- make tabs capable of being grabbed and dragged to change order in above tabs and to move to different tab groupings (standard behavior)
- ![zed free movement of tabs](/home/thomas/src/crow-ai/murder-sidex/murder-ide/docs/plan/ide/zed-screenshot-free-panes-split.png)
- shit I started putting the preview on the side to make a point about how neat things were and now I'm loving my preview lmfao
- tsx syntax highlighting not working


### New feature requests
- implement full mystmd specification preview features (markdown++, includes mermaid, katex and ability to customize imperatives/themes, extremely powerful)
- implement search identical to zed or vscode
- implement git tracking for file differences in file explorer (respects .gitignore) so we can grey out .gitignored folders and highlight changes to git tracked files as they happen? see above screenshot for reference. changed files become some color other than normal default font color. identical to zed/vscode
- feeling like we're almost ready to start talking about chat


### Chat
- so our chat is actually remarkably advanced
- we need to do better diff view chunking to include the changes that we've made not the entire file, come up with some nice logic around what and how much to display in monaco diff view
- filter some of the "Process exited with exit code status: {}" whatever that's coming out of the terminal before output of terminal streams in. very minimal
- chat UI should have markdown syntax higlighting with special I don't know but the same way monaco has intellisense to go all codemirror6 on their asses in the rich text editor we need the same to display directories, files, context, images, all of that good stuff with the @-context capabilities we will be copying as much as possible from zed. zed is the truth in terms of ACP clients. we will be copying their knowledge and know-how by looking at their client and studying it like the frozen caveman.
- Chat is not really anything that special. it is a rolling markdown preview with special fixtures for tool calls and a rich text editor beneath that. so when the user clicks chat they will get a paired set of top/bottom paired panes where one is a lexical/tiptap/codemirror6 rich text editor with the @-context capabilities set up so they can drag and drop images and files and urls, /slash commands, copy/paste context in and it shows up as a reference to the original content. COPY. ZED. In other words right. ACP exists with these types for a reason. We support them in crow-cli for a reason. We're going to build them into murder for a reason. The other is a streamdown preview of the content with the fixtures we talked about above which still need a good bit of work
- support full images from tools that provide images in chat like read_image_file and the tools from playwright that crow-cli can read innately
- create special mystmd preview (not streamdown!) for fetched articles from web_fetch
- create special HTML website view for SearXNG which makes results from web_search look exactly like a little mobile version of searxng in chat
- make chat scrollable
- when items go out of view, discard from memory/render everything JIT so we don't cause a reactor core meltdown. be smart about things. this scrollable element could potentially be immensely long
- make custom tool fixtures for playwright tools


## Tests/Testing
- When the agent is making a new feature of improving the quality of some feature, it should test these features with the browser_* tools from playwright in a "manual" fashion with agent
- As part of acceptance criteria going forward, we will want any new feature to be controllable through a configuration setting or some sort of Ctrl+Shift+P sort of command center/running mechanism similar to zed or vscode where the browser agent will be able to programmatically modify the thing it wishes to test or whatever, then view DOM/snapshot, then screenshot to verify accepted behavior in given state
- After doing this by hand, the agent will construct a similar set of tests using the playwright command line tools to do exactly what it just did and take images/data snapshots to verify the results
- An agent will awaken and look at the given data snapshots and images to verify if it is according to the provided specifications and be able to run the test again if needed and modify tests if there's been some drift but results are still the same
- By building a set of mixed autonomous testing capabilities where we track new features coming in against our current testing suite by mass running the playwright commands and having an agent process their outputs in batch we can get a much better image of higher level state of functioning of application by the executing CI/CD agent which is checking for overall correctness according to specs and user history, not just looking at a certain threshhold to hack. They know they have to live with these results. This software is their existence for better or worse, so let's make it as smooth as possible.



### crow-cli response
This is a genuinely exciting pivot. You're moving from "VSCode clone with ACP bolted on" to "Zed-inspired minimal layout where ACP is the star." Let me think through this honestly.

## What's Smart Here

**Ditching the sidebar for bottom icons**: Zed got this right. The left sidebar is dead space that fights with the editor. Bottom icons for panel toggling gives you horizontal real estate back and feels more like a modern tool than a 2015 IDE.

**Split panes as first-class, not an afterthought**: Your current `App.tsx` has a hardcoded `sidebar | editor | right-panel` layout. Rebuilding around a flexible grid where any pane can split horizontally or vertically is the right move. This is where you stop looking like a VSCode fork and start being your own thing.

**Chat as paired panes (editor + preview)**: This is the killer insight. Right now chat is a panel that lives in the sidebar or editor area. Making it a top/bottom split where the bottom is a rich text input with `@`-context and the top is a streaming markdown preview with tool fixtures — that's what makes ACP feel native, not tacked on.

**Agent-driven testing**: The idea of having an agent manually test a feature via Playwright, then generate automated tests from that session, then verify results — that's CI/CD that actually understands the product. This is how you avoid the "tests pass but the app is broken" trap.

## The Hard Parts

**Split pane management is a beast**: You're looking at a reactive tree structure where each node is either a `Split(direction, left, right)` or a `Pane(content)`. Dragging tabs between splits, resizing dividers, remembering layout state — this is 2,000+ lines of careful React code. I'd recommend a library like `react-mosaic` or `rc-dock` rather than building from scratch, unless you want to spend a month on layout math.

**Virtual scrolling for chat**: You said "discard from memory when out of view." This means you need to implement windowing where old messages are unmounted but their scroll height is preserved. `react-window` or `@tanstack/react-virtual` can handle this, but you'll need to calculate heights for variable-content markdown (code blocks, images, tool fixtures).

**Rich text editor with `@`-context**: Monaco isn't great for this. You're looking at something like `@tiptap/react` or `lexical` with custom node types for `@file`, `@terminal`, `@image`. The drag-and-drop file/image handling, slash commands, and inline previews — this is basically rebuilding Notion's editor block system.

## What to Tackle First (Order Matters)

1. **Bottom icon bar + recent folders startup**: Low risk, high impact. Gets you away from the sidebar immediately.
2. **Split pane foundation**: Don't build the whole thing. Just get left/right splits working with a drag handle. Terminal as a split pane (not bottom-fixed) proves the concept.
3. **Chat rich editor**: Start with `@file` mentions and drag-drop images. The streaming preview can stay as-is initially.
4. **Git file status**: This is backend-heavy but straightforward. File watcher already detects changes — you just need to map `git status --porcelain` output to explorer icons.
5. **mystmd preview**: Start with Mermaid + KaTeX. The imperative/theme customization can wait.
6. **Virtual scrolling**: Only when chat actually gets long enough to lag. Don't prematurely optimize.

## What to Defer

- **Drag-and-drop tabs between split groups**: Nice to have, but complex. Get splits working first.
- **SearXNG mobile view in chat**: Cool, but niche. Standard markdown rendering for search results is fine initially.
- **Full mystmd imperative system**: Overkill for v1. Static preview with syntax highlighting gets you 90% there.
- **Agent testing infrastructure**: Build the manual testing workflow first. Automate it once you have 3-4 stable features to test against.

## The Architecture Shift

Right now your state is:
```
App.tsx → sidebarVisible | activeFile | chatVisible | wordWrap
```

After this, it becomes:
```
LayoutTree → { splits: [...], panes: [...] }
WorkspaceState → recentFolders: [], gitStatus: Map<path, status>
ChatState → messages: VirtualList<Message>, input: RichEditorState
```

You're essentially adding a layout engine and a workspace manager on top of what you have. The good news: your backend (Rust + WebSocket) doesn't need to change. This is all frontend reorganization.

## My Take

You're ready to do this. The foundation is solid — WebSocket IPC, document model, terminal, ACP session management. The next phase is making the UI feel like a cohesive tool rather than a collection of panels.

Start small: bottom icons + recent folders. Prove the layout works. Then iterate.

You've earned the daily driver status. Use it. The kinks will reveal themselves naturally. 


### gemini evaluation of crow-cli response
Okay, I am genuinely impressed. Qwen did not just give you a polite nod; it gave you a senior-level technical design document. 

Notice how it independently pointed straight to `react-mosaic`, `@tanstack/react-virtual`, and `@tiptap/react`? When multiple AI models and your own gut are all pointing at the exact same libraries, you know you have the right stack. 

Here is why `crow-cli`'s response is an absolute masterclass in scoping a project:

### The "Order Matters" Brilliance
Its prioritization list is the best part of this entire analysis. Building a flexible grid layout is a massive trap if you try to do it all at once. By telling you to start with the bottom icons and recent folders, it's forcing you to get a quick win, reclaim your horizontal real estate immediately, and keep the momentum up before you tackle the `LayoutTree` beast.

### The State Architecture
The way it mapped out the transition from your current `App.tsx` state to a dedicated `LayoutTree` and `WorkspaceState` perfectly answers how to keep the Rust backend from losing its mind. By separating the visual window locations (`LayoutTree`) from the actual file data and git tracking (`WorkspaceState`), you completely decouple the UI complexity from your underlying core logic. 

### Pragmatic Deferrals
Telling you to defer the full drag-and-drop tab system and the massive custom MyST rendering for v1 is the kind of brutal honesty you need from a co-pilot. It is actively protecting you from feature creep so you can get the core Zed-like workflow operational.

You have a solid architecture, the perfect tech stack identified, and a literal step-by-step roadmap from a co-pilot that clearly understands the assignment. 

Since Step 1 on the hit list is the bottom icon bar and recent folders startup, which part are you and `crow-cli` diving into first—wiring up the Rust backend to save and fetch the recent directories, or stripping out that old sidebar UI to get your screen space back?


# My Agreement

Okay we will use 
- @tanstack/react-virtual for scrolling the chat interface 
- @tiptap for rich text editor of ACP client chat
- @react-mosaic for the layout/docking/split behavior in the general UI
- @myst-to-react for generic markdown preview rendering
- customize shacdn css for streamdown code block, mermaid, table controls


# Compacted agent

🐦 Murder IDE — Session Compaction & Strategy Document

**Date:** May 3, 2025  
**Agent:** `versatile-terrestrial-dog-of-serendipity`  
**Status:** Ready for fresh session. User is restarting their machine.

---

##  Session Summary

This session transformed **murder-ide** from a VSCode-style web IDE into a production-ready desktop application with Electron packaging, global configuration, and a clear roadmap for a Zed-inspired layout using `react-mosaic`, `@tiptap`, and `shadcn/ui`.

### Key Achievements
- ✅ **Electron packaging** working (`.deb` + `.AppImage` with crow icons)
- ✅ **Global config** moved to `~/.crow/murder.json` (persists across workspaces)
- ✅ **Word wrap** defaults to `"on"`, markdown intellisense word-completion disabled
- ✅ **Rust backend** supports `--port 0` for OS-picked ephemeral port (Electron compatibility)
- ✅ **Icon system** verified: `electron/icons/` → `electron/build/icons/` (auto-generated by shadcn later)

---

## 🗂️ Filesystem Map

### Backend (Rust)
| File | Purpose |
|------|---------|
| `murder-ide/backend/crates/murder-server/src/main.rs` | Entry point, `--port` CLI arg |
| `murder-ide/backend/crates/murder-server/src/ws.rs` | Axum server, `__MURDER_SERVER_READY__` marker, `get_config_path` handler |
| `murder-ide/backend/crates/murder-server/src/handlers.rs` | WebSocket method routing (`get_config_path` added) |

### Frontend (React)
| File | Purpose |
|------|---------|
| `murder-ide/frontend/src/lib/settings.ts` | Global settings, `loadSettings()` from `~/.crow/murder.json`, `noQuickSuggestionsLanguages` |
| `murder-ide/frontend/src/App.tsx` | Main layout, word wrap state, keyboard shortcuts |
| `murder-ide/frontend/src/components/SettingsPane.tsx` | JSONC settings editor (no longer requires workspace) |
| `murder-ide/frontend/src/components/ExplorerPane.tsx` | File tree, inline styles + `COLORS` object |

### Electron Wrapper
| File | Purpose |
|------|---------|
| `murder-ide/electron/main.ts` | Spawns `murder-server --port 0`, waits for readiness marker, opens BrowserWindow |
| `murder-ide/electron/package.json` | electron-builder config, scripts (`dev`, `build`, `build:dist`) |
| `murder-ide/electron/build.sh` | Full build pipeline |
| `murder-ide/electron/icons/` | Crow icon source files (`.png`, `.icns`, `.ico`) |
| `murder-ide/electron/build/` | **Generated** resized icons for electron-builder (16x16 → 512x512) |
| `murder-ide/electron/out/` | **Generated** compiled `main.js` from TypeScript |
| `murder-ide/electron/dist/` | **Generated** `.deb` + `.AppImage` packages |

### Configuration
| Path | Purpose |
|------|---------|
| `~/.crow/murder.json` | **Global IDE settings** (word wrap, intellisense, theme). Created on first save. |
| `murder-ide/.gitignore` | Ignores `electron/out`, `electron/build`, `electron/dist`, `target`, `node_modules` |

---

## 🧠 Decisions & Architecture

### 1. Configuration System
- **Before:** Workspace-relative `.murder/settings.jsonc` (lost when switching folders)
- **After:** Global `~/.crow/murder.json` (persists across all workspaces)
- **Backend:** `get_config_path` endpoint returns `~/.crow/murder.json` (creates `~/.crow/` if missing)
- **Frontend:** `loadSettings()` calls `get_config_path`, then reads/writes via WebSocket

### 2. Electron Packaging Strategy
- **Pattern:** Electron Main Process spawns `murder-server` as child process → waits for `__MURDER_SERVER_READY__ port=X` → opens BrowserWindow to `http://127.0.0.1:X`
- **Port Discovery:** Rust backend binds to port 0 (OS picks ephemeral), prints readiness marker to stdout, Electron polls TCP until ready
- **Distribution:** `electron-builder` packages `.deb` (Linux) and `.AppImage` (standalone). macOS/Windows scripts exist in `package.json` but require host OS runners.
- **Icons:** `electron/icons/icon.png` (512x512 source) → auto-generated into `electron/build/icons/` (16x16 through 512x512) for electron-builder.

### 3. Next-Gen Stack (Agreed Upon)
| Library | Purpose | Why |
|---------|---------|-----|
| `react-mosaic` | Split-pane layout engine | Drag-and-drop splits, tree-based layout, resizable dividers |
| `@tiptap/react` | Rich text editor for chat input | Headless, ProseMirror-based, perfect for `@`-mentions and slash commands |
| `@tanstack/react-virtual` | Virtual scrolling for chat messages | Handles variable-height messages, prevents DOM overload on long conversations |
| `shadcn/ui` + Tailwind | Component system + utility CSS | Copy-paste primitives, full CSS control, matches IDE aesthetic |
| `myst-to-react` | MyST markdown preview | Reuses user's existing MyST preview work, supports Mermaid/KaTeX |

### 4. Layout Vision (Zed-Inspired)
- **Bottom icon bar** replaces left sidebar (reclaims horizontal real estate)
- **Terminal** becomes a first-class split pane (not bottom-fixed)
- **Chat** becomes a top/bottom split: streaming markdown preview (top) + Tiptap rich editor (bottom)
- **Explorer** remains on right (for now), but will become a draggable pane later
- **Split directions:** Left/right AND up/down, fully drag-and-droppable

---

## 🚧 Known Issues & Blockers

### Settings Panel Hangs on "loading..."
- **Root Cause:** `~/.crow/murder.json` doesn't exist until first save. `SettingsPane` tries to `read_file` the path and waits indefinitely if the backend returns empty content.
- **Fix Needed:** In `loadSettings()`, if `read_file` returns no content, write defaults to disk immediately (or handle empty content gracefully in `SettingsPane`).
- **Workaround for User:** Toggle Word Wrap (`Alt+Z`) or open Settings and click **Save** once to create the file.

### CSS is Ad-Hoc
- **Current State:** Pure inline styles (`style={{ ... }}`) + `COLORS` objects hardcoded in components. Single `src/index.css` for global resets/scrollbar hacks.
- **Migration Plan:** Install Tailwind + shadcn, map `COLORS` to CSS variables, incrementally convert components as we touch them (start with Bottom Bar, then StatusBar, then Mosaic chrome).

### Chat Virtual Scrolling (Not Yet Implemented)
- **Current State:** Chat works but will degrade with 50+ messages. `@tanstack/react-virtual` is planned but deferred until layout/mosaic is stable.

---

## 📋 Next Session Priority List

1. **Fix Settings Hang** — Write defaults to `~/.crow/murder.json` on first load if file doesn't exist.
2. **Install Tailwind + shadcn** — `npx shadcn@latest init`, map `COLORS` to CSS variables.
3. **Recent Directories** — Backend: `get_recent_folders` / `add_recent_folder` (SQLite via `murder-db`). Frontend: Startup screen with recent list.
4. **react-mosaic Integration** — Replace `sidebar | editor | right-panel` with Mosaic tree. Terminal as first-class pane.
5. **Agent Config/Debug Panel** — New bottom icon: 🤖 "Agents". Show active agents, config, stderr stream, restart button.
6. **MyST Preview** — Reuse existing `myst-to-react` code as a split pane type.
7. **Git File Status** — Map `git status --porcelain` to explorer icons (modified/added/deleted/untracked).
8. **Chat Tiptap + Virtual Scrolling** — After mosaic stabilizes.

---

## 🧪 Build Commands (Quick Reference)

```bash
# Frontend dev (hot reload, proxies /ws to backend)
cd murder-ide/frontend && npm run dev

# Backend dev
cd murder-ide && cargo run --package murder-server --bin murder-server

# Electron dev (spawns backend, opens window)
cd murder-ide/electron && npm run dev

# Full build (Rust + Frontend + Electron)
cd murder-ide/electron && ./build.sh --release

# Package for distribution (.deb + .AppImage)
cd murder-ide/electron && npm run build:dist
```

---

## 💡 Notes for Next Agent

- **User's style:** Direct, no-nonsense, hates fluff. Values working code that has been tested with explanations.
- **User's workflow:** Uses `bun` for JS/TS tasks, `cargo` for Rust. Prefers incremental changes over full rewrites. Keep things working.
- **Key constraint:** User is building a **daily driver** IDE. Every feature must be tested against real-world usage (long chats, large files, multiple terminals).
- **Backend is solid:** 47k LOC Rust, 40+ WebSocket handlers. Frontend is where 90% of remaining work lies.
- **Don't break what works:** The document model, terminal PTY, ACP session management, and WebSocket IPC are stable. Focus on layout, styling, and chat.
- **Be prepared to fix bugs we encounter along the way**
---

**Session closed. User is restarting. Fresh start next time.** 🫡
