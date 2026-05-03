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
