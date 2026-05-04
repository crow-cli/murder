# ACP Client TODO — Agent Chat Integration

## TODO 

### Visual Polish
- [ ] Chat panel border styling matches VSCode panel borders
- [ ] Message spacing/typography parity with reference implementations
- [ ] Tool call status indicators (running, completed, failed)
- [ ] Syntax-highlighted chat input (Monaco-style, not plain textarea)
- [ ] Agent avatar/identity display
- [ ] Session name editing

### Input
- [ ] 
- [ ] Draft persistence (typing + click away ≠ lost text)
- [ ] tiptap syntax-highlighted input area
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




### Bugs/QA analysis
- any resizing of chat window creates a new session. 
- session should only be created when user goes through session creation menus or UI or whatever
- session must be maintained when chat is moved/refreshed/minimized. those things change the view not the actual underlying model data
- no split capability for agent right now
- when an agent pane spins up it should not automatically initialize a client, at least not for now. we need a start agent dialog.
- we need a dialog/setting where we choose which agent we want to connect with
- we need agent servers in our settings and as a fundamental part of configuration for murder-acp
- we need to add the user's query to the chat
- work on focus. if user scrolls inside the chat, let them and stream beneath
- if user has clicked into prompt window then keep focus glued to bottom and newly streaming text
