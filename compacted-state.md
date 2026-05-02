Murder IDE: Project Context & State

## Goal
Build a lightweight, web-deployable IDE by laundering components from **sidex** (MIT licensed). The architecture is a single Rust binary (Axum + WebSocket) serving a React frontend, replacing Tauri/native shells.

## Current Architecture
```
┌────────────┬────────────────────────┬─────────────┐
│ ChatPanel  │                        │ Explorer    │
│ (ACP Chat) │    Monaco Editor       │ (right)     │
│  LEFT      │       CENTER           │             │
├────────────────────────────────────┴─────────────┤
│             Terminal (bottom)                      │
└───────────────────────────────────────────────────┘
```

### Backend (`murder-ide/backend/crates/`)
- **murder-server**: Axum + WebSocket. Handles file system, workspace, terminal PTY, and ACP agent spawning.
- **murder-acp**: Spawns agent subprocesses (stdio). Bridges agent stdout to WebSocket broadcast channel.
- **Protocol**: `acp_spawn`, `acp_send`, `acp_kill`, `acp_read_file`, `acp_write_file`.
- **Key file**: `backend/crates/murder-acp/src/agent.rs` — `AgentManager` manages child processes and broadcast events.

### Frontend (`murder-ide/frontend/src/`)
- **App.tsx**: Layout manager. Loads agent config from `agent-config.json` at startup.
- **ChatPane.tsx**: ACP chat UI. Uses `streamdown` for markdown rendering. Tool call accordions expanded by default.
- **acp-client.ts**: Wraps `@agentclientprotocol/sdk`. Implements `Client` trait. Connects via WebSocket.
- **Key detail**: `protocolVersion` in `initialize()` must be integer `1`.
- **EditorPane.tsx**: Monaco editor with dirty tracking, tab system.
- **TerminalPane.tsx**: xterm.js connected to PTY via WebSocket.

### Agent Configuration
- **File**: `frontend/public/agent-config.json`
- **Content**:
  ```json
  {
    "name": "crow-cli",
    "command": "/home/thomas/.local/bin/crow-cli",
    "args": ["acp"],
    "env": []
  }
  ```
- **Command**: `/home/thomas/.local/bin/crow-cli acp` — Crow ACP agent over stdio.

## Build & Run

### Dev Mode
```bash
# Terminal 1: Backend
cd murder-ide && cargo run --package murder-server --bin murder-server

# Terminal 2: Frontend
cd murder-ide/frontend && npm run dev
# Open http://localhost:5173
```

### Release (Single Binary)
```bash
cd murder-ide/frontend && npm run build
cd murder-ide && cargo build --release --package murder-server --bin murder-server
./target/release/murder-server
# Open http://localhost:3928
```

## Testing Protocol

1. **Kill existing processes**:
   ```bash
   pkill -f murder-server; pkill -f vite; sleep 2
   ```

2. **Start Backend**:
   ```bash
   cd murder-ide && RUST_LOG=info cargo run --package murder-server --bin murder-server &
   ```

3. **Start Frontend**:
   ```bash
   cd murder-ide/frontend && npx vite --port 5173 &
   ```

4. **Browser Actions**:
   - Navigate to `http://localhost:5173`.
   - Click "Open Folder" → Enter `/home/thomas/src/crow-ai/murder-sidex` → Select.
   - **Verify**: Chat panel on left shows `crow-cli` status: Connecting → Initializing → Ready.
   - **Verify**: Backend logs show `Spawning agent 'crow-cli'` and JSON-RPC traffic.
   - **Test**: Type prompt in chat → Enter → Verify `agent_message_chunk` streaming.
   - **Test**: Verify tool calls render as expanded accordions with file content.

## Next Steps
- **File Watcher**: Use `notify` crate to detect external file changes (agent writes) and update explorer/editor.
- **LSP Integration**: Wire `murder-lsp` through WebSocket.
- **Git Pane**: Status, diff, commit via `murder-git`.
- **Settings UI**: JSONC editor for agent config.
- **Multi-Agent**: Switch agents without restart.

## Critical Details
- **ACP Protocol**: Integer version `1` in `initialize()`.
- **Agent Command**: `/home/thomas/.local/bin/crow-cli acp`.
- **Transport**: WebSocket → Backend stdio → Crow-CLI.
- **Layout**: Chat left, Editor center, Explorer right, Terminal bottom.


okay so we're really happy about how well this is going along. We might need a smaller notification on when the file is saved than what we have now. Because I save compulsively. Oh yeah we need to turn down/off the spellchecker intellisense for markdown completely.

So yeah this is working really realy well
