# ACP Client — Fix Plan

> **Status:** In progress
> **Last updated:** 2026-05-04 15:44 EDT
> **Priority:** P0 bugs first, then P1, then P2

---

## Root Cause

Most chat bugs share a single origin: **`ChatTile` loses all React state on every mosaic resize/move/minimize** because tiles are unmounted from the tree. The sessions still exist in the global `acpStore`, but the component has no reference to them on remount. Each mount sees `tabs.length === 0` and creates a new session.

**Fix principle:** Persist `ChatTab[]` and `activeIndex` in `tileRegistry.chatState` (same pattern as `editorState` and `terminalState`). Restore on mount.

---

## Phase 1: Session Persistence (P0)

Solves: "resizing creates new session", "session lost on minimize/refresh/move"

### 1.1 Persist tabs in tileRegistry

**File:** `frontend/src/components/MosaicLayout.tsx`

In `registerTile()`, add `chatState` to registry:

```ts
chatState: type === "chat" ? { sessions: string[]; activeIndex: number } : undefined
```

When a session is created, push its ID to `entry.chatState.sessions`.

When a session is closed, remove from `entry.chatState.sessions`.

### 1.2 Persist active index

Track `activeIndex` in `tileRegistry.chatState.activeIndex`.

### 1.3 Restore on mount

In `ChatTile`, replace:

```tsx
// Current (broken)
if (tabs.length === 0) addSession();
```

With:

```tsx
// Read from tileRegistry on mount
const registryEntry = tileRegistry.get(tileId);
if (registryEntry?.chatState && registryEntry.chatState.sessions.length > 0) {
  setTabs(registryEntry.chatState.sessions.map(id => ({ sessionId: id })));
  setActiveIndex(registryEntry.chatState.activeIndex ?? -1);
} else {
  // No persisted state — create new tab (but don't connect yet, see P0 #2)
}
```

### 1.4 Restore tile state from SQLite

In `MosaicLayout` state loading (the `get_tile_states` handler), add `chat` tile type parsing:

```ts
} else if (tile.tileType === "chat" && parsed.sessions) {
  entry.chatState = {
    sessions: parsed.sessions,
    activeIndex: parsed.activeIndex ?? -1,
  };
  lastActiveTile.set("chat", tile.tileId);
}
```

### 1.5 Save chat state on changes

When `tabs` or `activeIndex` changes, update `tileRegistry` and debounce-save:

```ts
useEffect(() => {
  const entry = tileRegistry.get(tileId);
  if (entry?.chatState) {
    entry.chatState.sessions = tabs.map(t => t.sessionId);
    entry.chatState.activeIndex = activeIndex;
    const ws = getCurrentWorkspace();
    if (ws && tabs.length > 0) {
      debounceSaveTileState(
        ws,
        tileId,
        "chat",
        JSON.stringify({ sessions: tabs.map(t => t.sessionId), activeIndex }),
        false,
      );
    }
  }
}, [tabs, activeIndex, tileId]);
```

---

## Phase 2: Don't Auto-Connect (P0)

Solves: "auto-initializes client on pane spin-up", "need start agent dialog", "choose which agent to connect"

### 2.1 Add connected status to ChatTab

**File:** `frontend/src/components/ChatTile.tsx`

```ts
export interface ChatTab {
  sessionId: string;
  connected: boolean; // false until user starts
}
```

### 2.2 Remove auto-connect on mount

Replace the auto-create effect:

```tsx
// Current (broken)
useEffect(() => {
  if (tabs.length === 0) addSession();
}, []);
```

Change to: create an empty disconnected tab on first mount if no persisted state:

```tsx
useEffect(() => {
  if (tabs.length === 0) {
    // Create a disconnected tab (no client connection yet)
    chatTabCounter++;
    const sessionId = `${sessionPrefix}-${Date.now()}-${chatTabCounter}`;
    setTabs([{ sessionId, connected: false }]);
    setActiveIndex(0);
    // Persist the empty tab
    // ... (registry save)
  }
}, []);
```

### 2.3 Add "Start Agent" to tab

Add a button or indicator on disconnected tabs:

```tsx
<div key={tab.sessionId} onClick={() => { setActiveIndex(idx); onFocus?.(); }}>
  {isActive && <activeIndicator />}
  <span className="text-xs">🤖</span>
  <span>{tab.connected ? label : "Not connected"}</span>
  {!tab.connected && (
    <button onClick={startSession} className="ml-auto">Start</button>
  )}
  <button onClick={(e) => { e.stopPropagation(); closeSession(); }}>×</button>
</div>
```

### 2.4 `startSession()` creates client

```tsx
const startSession = useCallback((sessionId: string) => {
  acpStore.createSession(sessionId, agentConfig, workspaceRoot);
  setTabs(prev => prev.map(t =>
    t.sessionId === sessionId ? { ...t, connected: true } : t
  ));
}, [agentConfig, workspaceRoot, sessionPrefix]);
```

### 2.5 Agent config from settings (P2)

**File:** `murder.json`

```json
{
  "editor": { "wordWrap": false },
  "agents": [
    {
      "name": "crow-cli",
      "command": "crow-cli",
      "args": ["acp"],
      "env": []
    }
  ]
}
```

Default to first agent, or fall back to `FALLBACK_AGENT_CONFIG` if no agents configured.

---

## Phase 3: User Query Display (P1)

Solves: "need to add user's query to the chat"

### 3.1 Add user message to session notifications

**File:** `frontend/src/components/ChatSessionBody.tsx`

In `handleSend`, after calling `prompt()`, also push a notification:

```ts
const handleSend = useCallback(async () => {
  if (!input.trim() || connectionStatus !== "ready") return;
  try {
    // Push user message into notifications FIRST so it renders
    const userNotification: AcpNotification = {
      id: `user-${Date.now()}`,
      type: "session_notification",
      data: {
        update: {
          sessionUpdate: "user_message_chunk",
          content: input.trim(),
        },
      },
    };
    acpStore.addNotification(sessionId, userNotification);

    await acpStore.prompt(sessionId, input.trim());
    setInput("");
  } catch (err) {
    console.error("Prompt failed:", err);
  }
}, [input, connectionStatus, sessionId]);
```

### 3.2 Add `addNotification` to acpStore

**File:** `frontend/src/lib/acp-store.ts`

```ts
export function addNotification(sessionId: string, notification: AcpNotification) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.notifications = [...session.notifications, notification];
  notifySession(sessionId);
}
```

---

## Phase 4: Scroll Behavior (P1)

Solves: "work on focus — if user scrolls inside chat, let them and stream beneath",
"if user has clicked into prompt window, keep focus glued to bottom"

### 4.1 Track `userAtBottom`

**File:** `frontend/src/components/ChatSessionBody.tsx`

```ts
const [userAtBottom, setUserAtBottom] = useState(true);
const messagesRef = useRef<HTMLDivElement>(null);

const checkAtBottom = useCallback(() => {
  const el = messagesRef.current;
  if (!el) return true;
  const threshold = 50; // px from bottom
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}, []);

useEffect(() => {
  const el = messagesRef.current;
  if (!el) return;
  const onScroll = () => setUserAtBottom(checkAtBottom());
  el.addEventListener("scroll", onScroll);
  return () => el.removeEventListener("scroll", onScroll);
}, [checkAtBottom]);
```

### 4.2 Conditional auto-scroll

Replace the current auto-scroll effect:

```ts
// Current (always scrolls)
useEffect(() => {
  if (notifications.length > prevNotifLen.current) {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }
  prevNotifLen.current = notifications.length;
}, [notifications.length]);
```

Change to:

```ts
// Only scroll if user was already at bottom
useEffect(() => {
  if (userAtBottom) {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }
}, [notifications.length, userAtBottom]);
```

### 4.3 Reset on focus

When the input gains focus, set `userAtBottom = true`:

```tsx
const handleInputFocus = useCallback(() => {
  setUserAtBottom(true);
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, []);
```

---

## Phase 5: Draft Persistence (P2)

Solves: "draft persistence — typing + click away ≠ lost text"

### 5.1 Save/restore via localStorage

**File:** `frontend/src/components/ChatSessionBody.tsx`

```tsx
// On mount
useEffect(() => {
  const draft = localStorage.getItem(`draft-${sessionId}`);
  if (draft) setInput(draft);
}, [sessionId]);

// On input change
const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  setInput(e.target.value);
  localStorage.setItem(`draft-${sessionId}`, e.target.value);
}, [sessionId]);

// On send
const handleSend = useCallback(async () => {
  if (!input.trim() || connectionStatus !== "ready") return;
  try {
    localStorage.removeItem(`draft-${sessionId}`);
    // ... rest of send logic
  } catch (err) {
    // ...
  }
}, [input, connectionStatus, sessionId]);
```

---

## Phase 6: Agent Settings (P2)

Solves: "dialog/setting to choose which agent", "agent servers in settings"

### 6.1 Extend murder.json schema

```json
{
  "editor": { "wordWrap": false },
  "agents": [
    {
      "name": "string",
      "command": "string",
      "args": "string[]",
      "env": "string[]"
    }
  ]
}
```

### 6.2 Load agents in App.tsx

```ts
// Load from config
const agents = settings.getSettings().agents ?? [FALLBACK_AGENT_CONFIG];
const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);
const agentConfig = agents[selectedAgentIndex];
```

### 6.3 Add Agent tab to SettingsPane

List agents, add/remove/reorder. Each agent card shows name, command, args.

---

## Phase 7: Split Capability (P2)

Solves: "no split capability for agent right now"

### 7.1 Verify existing split works

Right-click → "Split Right/Left/Up/Down" should already work for chat tiles since:
- `ChatTile` is registered with `meta.type === "chat"`
- `splitTile` uses `entry?.meta.type ?? "editor"` for new tile ID prefix

If it doesn't work, the issue is likely in the `splitNode` callback not matching the new `"chat"` type. Check that `direction` matching includes `"row"`/`"column"` correctly for chat tiles.

### 7.2 Test and fix

Test: split chat tile right → should create new `ChatTile` with `uid("chat")` prefix.

---

## Implementation Order

1. **Phase 1** — Session persistence (tileRegistry + SQLite restore)
2. **Phase 2** — Don't auto-connect (deferred client creation + "Start" flow)
3. **Phase 3** — User query display (add notification on send)
4. **Phase 4** — Scroll behavior (userAtBottom check)
5. **Phase 5** — Draft persistence (localStorage)
6. **Phase 6** — Agent settings (murder.json schema + SettingsPane)
7. **Phase 7** — Split capability (verify + fix)

Each phase builds on the previous. Phase 1 is the highest leverage — it fixes the most critical bugs with the least change to existing behavior.

---

## Testing Checklist

After each phase:

- [ ] Resize chat window — session persists, no new session created
- [ ] Minimize/restore — session state preserved
- [ ] Close chat tile, reopen — sessions restored from SQLite
- [ ] New session starts disconnected — no client connected yet
- [ ] "Start" button connects client
- [ ] Multiple tabs survive resize
- [ ] User messages render in chat history
- [ ] Scrolling up doesn't auto-scroll back during streaming
- [ ] Clicking prompt input scrolls to bottom
- [ ] Typing + switching tabs doesn't lose draft text
- [ ] Switching between agents connects to correct agent
