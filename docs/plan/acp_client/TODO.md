# ACP Client TODO — Agent Chat Integration

## Current State
- Multi-session support (create, close, switch sessions)
- Chat tabs in editor area (minimize/expand)
- Message rendering (Streamdown with code, mermaid, math)
- Tool call accordions (read, write, edit, terminal, web fetch, web search)
- File view integration (Monaco read-only, write, diff editors)
- Inline terminal (xterm.js, PTY-backed)
- Plan/task list display
- Permission request bar
- Connection status indicator

## NOT DOING (explicitly excluded)

These features are NOT in scope. Do NOT implement:

### Permission System
- Accept/Reject/Always-Accept buttons
- Permission request dialogs
- Permission policy configuration
- Tool allowlists/denylists

### Extension/Plugin Support
- Agent plugin system
- MCP server discovery UI
- Agent marketplace
- Agent configuration editor (use JSONC config file)

### Heavy Chat Features
- Voice input/output
- Image generation in chat
- Video playback
- File attachments / drag-and-drop into chat
- @-mentions (file/symbol references)
- Context awareness UI
- Chat history persistence across sessions
- Chat export (markdown, PDF)
- Chat search/filter
- Conversation branching
- Multi-agent collaboration view
- Agent self-modification
- Agent memory/knowledge base UI

### Enterprise
- Chat audit logging
- Chat encryption
- Multi-user chat
- Chat sharing/collaboration
- Rate limiting UI
- Usage/cost tracking
- Agent switching without restart (backend concern)

## TODO (if/when we come back to chat)

### Visual Polish
- [ ] Chat panel border styling matches VSCode panel borders
- [ ] Message spacing/typography parity with reference implementations
- [ ] Tool call status indicators (running, completed, failed)
- [ ] Syntax-highlighted chat input (Monaco-style, not plain textarea)
- [ ] Agent avatar/identity display
- [ ] Session name editing

### Input
- [ ] Draft persistence (typing + click away ≠ lost text)
- [ ] Syntax-highlighted input area
- [ ] @-mentions for file/symbol references
- [ ] Drag-and-drop into chat

### Backend
- [ ] MCP session/prompt endpoints
- [ ] Session/cancel endpoints
- [ ] Active agent status endpoints
- [ ] Session persistence (save/restore conversations)

### Testing
- [ ] Playwright E2E tests for chat flow
- [ ] Agent evaluation framework
