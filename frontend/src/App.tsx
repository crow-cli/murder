import { useEffect, useState, useCallback, useRef } from "react";
import EditorPane, {
  type EditorPaneHandle,
  setModelContent,
  disposeModel,
} from "./components/EditorPane";
import ExplorerPane from "./components/ExplorerPane";
import ChatPane from "./components/ChatPane";
import ChatSessionPane from "./components/ChatSessionPane";
import { ChatTabs } from "./components/ChatTabs";
import RpcLogPanel from "./components/RpcLogPanel";
import { FolderPicker } from "./components/FolderPicker";
import { ActivityBar, type ActivityId } from "./components/ActivityBar";
import { StatusBar } from "./components/StatusBar";
import { TabBar } from "./components/TabBar";
import { MenuBar, type MenuGroup } from "./components/MenuBar";
import TerminalPane from "./components/TerminalPane";
import { ws } from "./lib/ws-client";
import { getFileIcon } from "./lib/file-icons";
import type { AgentConfig } from "./lib/acp-client";
import * as acpStore from "./lib/acp-store";

/** Default fallback if config file fails to load */
const FALLBACK_AGENT_CONFIG: AgentConfig = {
  name: "crow-cli",
  command: "crow-cli",
  args: ["acp"],
  env: [],
};

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

interface OpenFile {
  path: string;
  language: string;
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<Map<string, OpenFile>>(new Map());
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeActivity, setActiveActivity] = useState<ActivityId>("chat");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [_menuOpen, setMenuOpen] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [chatSessionVisible, setChatSessionVisible] = useState(false);
  const [chatSessionMinimized, setChatSessionMinimized] = useState(false);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [wordWrap, setWordWrap] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(FALLBACK_AGENT_CONFIG);

  // Load agent config from JSON file
  useEffect(() => {
    fetch("/agent-config.json")
      .then(r => r.json())
      .then(setAgentConfig)
      .catch(() => {});
  }, []);

  const activeFileRef = useRef(activeFile);
  const dirtyFilesRef = useRef(dirtyFiles);
  const openFilesRef = useRef(openFiles);
  const workspaceRootRef = useRef(workspaceRoot);
  const savingRef = useRef(saving);
  const editorRef = useRef<EditorPaneHandle>(null);

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);
  useEffect(() => {
    dirtyFilesRef.current = dirtyFiles;
  }, [dirtyFiles]);
  useEffect(() => {
    openFilesRef.current = openFiles;
  }, [openFiles]);
  useEffect(() => {
    workspaceRootRef.current = workspaceRoot;
  }, [workspaceRoot]);
  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  // Connect WebSocket on mount
  useEffect(() => {
    ws.connect()
      .then(() => setConnected(true))
      .catch(console.error);
    return () => ws.disconnect();
  }, []);

  // Show notification briefly
  const notify = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  }, []);

  // Save file
  const saveFile = useCallback(
    async (path: string) => {
      if (savingRef.current) return;
      setSaving(true);
      try {
        const content = editorRef.current?.getContent() ?? "";
        await ws.invoke("document_set_content", { path, content });
        await ws.invoke("document_save", { path });
        setDirtyFiles((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
        notify(`Saved ${path.split("/").pop()}`);
      } catch (e: any) {
        notify(`Save failed: ${e.message || e}`);
      } finally {
        setSaving(false);
      }
    },
    [notify],
  );

  // Close tab
  const closeTab = useCallback((path: string) => {
    disposeModel(path);
    ws.invoke("document_close", { path }).catch(console.error);
    setOpenFiles((prev) => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
    const remaining = Array.from(openFilesRef.current.keys()).filter(
      (p) => p !== path,
    );
    if (activeFileRef.current === path) {
      setActiveFile(
        remaining.length > 0 ? remaining[remaining.length - 1] : null,
      );
    }
  }, []);

  // Global keyboard shortcuts (non-editor — editor handles its own via Monaco)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === "o" && !e.shiftKey && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        setShowFolderPicker(true);
        return;
      }
      if (ctrl && e.key === "s") {
        // Always save active file, regardless of what has focus
        e.preventDefault();
        e.stopPropagation();
        const af = activeFileRef.current;
        if (af) saveFile(af);
        return;
      }
      if (ctrl && e.key === "b" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        setSidebarVisible((v) => !v);
        return;
      }
      if (ctrl && e.key === "`" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        setTerminalVisible((v) => !v);
        return;
      }
      if (e.altKey && e.key === "z" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        setWordWrap((v) => !v);
        return;
      }
      if (ctrl && e.key === "l" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        setActiveActivity("chat");
        if (acpStore.getSessionIds().length === 0 && workspaceRootRef.current) {
          handleNewChatSessionRef.current();
        } else {
          setChatSessionVisible((v) => {
            if (!v) {
              setChatVisible(false);
              setChatSessionMinimized(false);
              return true;
            }
            // Already visible — toggle minimized
            setChatSessionMinimized((m) => !m);
            return true;
          });
        }
        return;
      }
      if (ctrl && e.shiftKey && e.key === "R" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        setActiveActivity("rpc");
        setSidebarVisible(true);
        return;
      }
      if (e.key === "Escape") {
        setMenuOpen(null);
        setShowFolderPicker(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Listen for Monaco Ctrl+S custom event (save)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) saveFile(detail.path);
    };
    window.addEventListener("editor-save", handler);
    return () => window.removeEventListener("editor-save", handler);
  }, [saveFile]);

  // Listen for Monaco Ctrl+W custom event (close tab)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) closeTab(detail.path);
    };
    window.addEventListener("editor-close-tab", handler);
    return () => window.removeEventListener("editor-close-tab", handler);
  }, [closeTab]);

  const handleOpenFolder = async (path: string) => {
    setShowFolderPicker(false);
    try {
      await ws.invoke<{ root: string }>("workspace_open", { path });
      setWorkspaceRoot(path);
      setOpenFiles(new Map());
      setActiveFile(null);
      setDirtyFiles(new Set());
      notify(`Opened ${path.split("/").pop()}`);
      // Initialize persistent ACP client and track session ID
      const sessionId = acpStore.initialize(agentConfig, path);
      setActiveChatSessionId(sessionId);
      setChatSessionVisible(true);
      setChatSessionMinimized(false);
      setChatVisible(false); // Hide left panel chat when editor-area chat is active
    } catch (e: any) {
      notify(`Failed to open: ${e.message || e}`);
    }
  };

  const handleFileClick = async (path: string, isDir: boolean) => {
    if (isDir) return;
    if (openFilesRef.current.has(path)) {
      setActiveFile(path);
      return;
    }
    try {
      const result = await ws.invoke<{ content: string }>("read_file", {
        path,
      });
      const content = result.content;
      const language = getLanguage(path);
      await ws.invoke("document_open", { path, content });
      setModelContent(path, content, language);
      setOpenFiles((prev) => new Map(prev).set(path, { path, language }));
      setActiveFile(path);
    } catch (e: any) {
      notify(`Failed to read: ${e.message || e}`);
    }
  };

  const handleCursorChange = useCallback((line: number, col: number) => {
    setCursorLine(line);
    setCursorCol(col);
  }, []);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    const af = activeFileRef.current;
    if (!af) return;
    if (dirty) setDirtyFiles((prev) => new Set(prev).add(af));
  }, []);

  // Agent file change handler — update explorer/monaco when agent writes files
  const handleAgentFileChange = useCallback((path: string, content: string) => {
    // If file is open in editor, update the model
    setModelContent(path, content, getLanguage(path));
    // Clear dirty flag since agent wrote it
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  // Chat session management
  const handleNewChatSession = useCallback(() => {
    if (!workspaceRootRef.current) return;
    const sessionId = `session-${Date.now()}`;
    acpStore.createSession(sessionId, agentConfig, workspaceRootRef.current);
    setActiveChatSessionId(sessionId);
    setChatSessionVisible(true);
    setChatSessionMinimized(false);
  }, [agentConfig]);

  const handleNewChatSessionRef = useRef(handleNewChatSession);
  useEffect(() => {
    handleNewChatSessionRef.current = handleNewChatSession;
  }, [handleNewChatSession]);

  const handleCloseChatSession = useCallback((sessionId: string) => {
    acpStore.closeSession(sessionId);
    const remaining = acpStore.getSessionIds();
    setActiveChatSessionId(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    if (remaining.length === 0) setChatSessionVisible(false);
  }, []);

  const handleChatTabClick = useCallback((sessionId: string) => {
    setActiveChatSessionId(sessionId);
  }, []);

  const handleToggleChatMinimize = useCallback(() => {
    setChatSessionMinimized((m) => !m);
  }, []);

  const handleMenuAction = useCallback(
    (action: string) => {
      switch (action) {
        case "open_folder":
          setShowFolderPicker(true);
          break;
        case "save": {
          const af = activeFileRef.current;
          if (af) saveFile(af);
          break;
        }
        case "save_all": {
          for (const path of dirtyFilesRef.current) saveFile(path);
          break;
        }
        case "close_editor": {
          const af = activeFileRef.current;
          if (af) closeTab(af);
          break;
        }
        case "toggle_sidebar":
          setSidebarVisible((v) => !v);
          break;
        case "toggle_terminal":
          setTerminalVisible((v) => !v);
          break;
        case "word_wrap":
          setWordWrap((v) => !v);
          break;
        case "explorer":
          setActiveActivity("explorer");
          setSidebarVisible(true);
          break;
        case "search":
          setActiveActivity("search");
          setSidebarVisible(true);
          break;
        case "source_control":
          setActiveActivity("git");
          setSidebarVisible(true);
          break;
        case "terminal":
          setTerminalVisible(true);
          break;
        case "new_terminal":
          setTerminalVisible(true);
          notify("Terminal panel");
          break;
        case "extensions":
          setActiveActivity("extensions");
          setSidebarVisible(true);
          break;
        case "chat":
          setActiveActivity("chat");
          if (acpStore.getSessionIds().length === 0 && workspaceRoot) {
            handleNewChatSession();
          } else if (!chatSessionVisible) {
            setChatVisible(false);
            setChatSessionVisible(true);
            setChatSessionMinimized(false);
          } else {
            setChatSessionMinimized((m) => !m);
          }
          break;
        case "rpc_log":
          setActiveActivity("rpc");
          setSidebarVisible(true);
          break;
      }
    },
    [saveFile, closeTab],
  );

  const currentFile = activeFile ? openFiles.get(activeFile) : null;
  const openFilesList = Array.from(openFiles.values());

  // Determine which side panels are visible
  const showLeftPanel = chatVisible && activeActivity === "chat" && !chatSessionVisible;
  const showRightPanel =
    sidebarVisible &&
    (activeActivity === "explorer" ||
      activeActivity === "search" ||
      activeActivity === "git" ||
      activeActivity === "extensions" ||
      activeActivity === "rpc");

  const menuItems: MenuGroup[] = [
    {
      label: "File",
      items: [
        { label: "Open Folder…", action: "open_folder", shortcut: "Ctrl+O" },
        { separator: true },
        {
          label: "Save",
          action: "save",
          shortcut: "Ctrl+S",
          enabled: activeFile !== null,
        },
        {
          label: "Save All",
          action: "save_all",
          shortcut: "Ctrl+Shift+S",
          enabled: dirtyFiles.size > 0,
        },
        { separator: true },
        {
          label: "Close Editor",
          action: "close_editor",
          shortcut: "Ctrl+W",
          enabled: activeFile !== null,
        },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", action: "undo", shortcut: "Ctrl+Z" },
        { label: "Redo", action: "redo", shortcut: "Ctrl+Shift+Z" },
        { separator: true },
        { label: "Cut", action: "cut", shortcut: "Ctrl+X" },
        { label: "Copy", action: "copy", shortcut: "Ctrl+C" },
        { label: "Paste", action: "paste", shortcut: "Ctrl+V" },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Agent Chat", action: "chat", shortcut: "Ctrl+L" },
        { label: "Explorer", action: "explorer", shortcut: "Ctrl+Shift+E" },
        { label: "Search", action: "search", shortcut: "Ctrl+Shift+F" },
        {
          label: "Source Control",
          action: "source_control",
          shortcut: "Ctrl+Shift+G",
        },
        { label: "Terminal", action: "terminal", shortcut: "Ctrl+`" },
        { label: "Extensions", action: "extensions", shortcut: "Ctrl+Shift+X" },
        { label: "RPC Log", action: "rpc_log", shortcut: "Ctrl+Shift+R" },
        { separator: true },
        {
          label: "Toggle Sidebar",
          action: "toggle_sidebar",
          shortcut: "Ctrl+B",
        },
        {
          label: "Toggle Terminal",
          action: "toggle_terminal",
          shortcut: "Ctrl+`",
        },
        { separator: true },
        {
          label: wordWrap ? "Disable Word Wrap" : "Word Wrap",
          action: "word_wrap",
          shortcut: "Alt+Z",
        },
      ],
    },
    {
      label: "Go",
      items: [
        { label: "Back", action: "back", shortcut: "Alt+Left" },
        { label: "Forward", action: "forward", shortcut: "Alt+Right" },
        { separator: true },
        { label: "Go to File…", action: "go_to_file", shortcut: "Ctrl+P" },
        { label: "Go to Line…", action: "go_to_line", shortcut: "Ctrl+G" },
      ],
    },
    {
      label: "Run",
      items: [
        { label: "Start Debugging", action: "start_debug", shortcut: "F5" },
        {
          label: "Run Without Debugging",
          action: "run_no_debug",
          shortcut: "Ctrl+F5",
        },
        { label: "Stop", action: "stop_debug", shortcut: "Shift+F5" },
      ],
    },
    {
      label: "Terminal",
      items: [
        {
          label: "New Terminal",
          action: "new_terminal",
          shortcut: "Ctrl+Shift+`",
        },
        {
          label: "Split Terminal",
          action: "split_terminal",
          shortcut: "Ctrl+Shift+5",
        },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Welcome", action: "welcome" },
        { label: "Documentation", action: "docs" },
        {
          label: "Keyboard Shortcuts",
          action: "shortcuts",
          shortcut: "Ctrl+K Ctrl+S",
        },
      ],
    },
  ];

  const COLORS = {
    bg: "#1a1230",
    bgDark: "#14101f",
    bgLight: "#1e1640",
    bgLighter: "#251d4a",
    border: "#2d2350",
    borderLight: "#3a2d60",
    text: "#d4c4ff",
    textMuted: "#8b7bb5",
    textDim: "#5a4d80",
    accent: "#4ade80",
    accentDim: "#36a860",
    accentBg: "#4ade8022",
    danger: "#f87171",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 13,
        overflow: "hidden",
      }}
    >
      <MenuBar
        items={menuItems}
        onAction={handleMenuAction}
        onOpenChange={setMenuOpen}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <ActivityBar
          active={activeActivity}
          onActivate={(id) => {
            if (id === activeActivity) {
              // Toggle visibility
              if (id === "chat") setChatVisible((v) => !v);
              else setSidebarVisible((v) => !v);
            } else {
              setActiveActivity(id);
              if (id === "chat") setChatVisible(true);
              else setSidebarVisible(true);
            }
          }}
        />

        {/* LEFT PANEL: Chat */}
        {showLeftPanel && (
          <div
            style={{
              width: 380,
              minWidth: 280,
              maxWidth: 600,
              background: COLORS.bgDark,
              borderRight: `1px solid ${COLORS.border}`,
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                height: 35,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 12px",
                borderBottom: `1px solid ${COLORS.border}`,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: COLORS.textMuted,
                }}
              >
                Agent Chat
              </span>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: COLORS.textMuted,
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "0 4px",
                }}
                onClick={() => setChatVisible(false)}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              {workspaceRoot ? (
                <ChatPane
                  onClose={() => setChatVisible(false)}
                  onFileChanged={handleAgentFileChange}
                />
              ) : (
                <div
                  style={{
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 13, opacity: 0.5 }}>
                    Open a folder first
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CENTER: Editor + Terminal + Chat Sessions */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Chat session tabs + panel (when visible in editor area) */}
          {chatSessionVisible && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: chatSessionMinimized ? 35 : "50%",
                minHeight: chatSessionMinimized ? 35 : 150,
                borderBottom: `1px solid ${COLORS.border}`,
                flexShrink: 0,
                overflow: "hidden",
                transition: chatSessionMinimized ? "none" : "height 0.15s ease",
              }}
            >
              <div
                onClick={() => chatSessionMinimized && setChatSessionMinimized(false)}
                style={{ cursor: chatSessionMinimized ? "pointer" : "default" }}
              >
                <ChatTabs
                  activeTabId={activeChatSessionId}
                  onTabClick={handleChatTabClick}
                  onNewTab={handleNewChatSession}
                  onCloseTab={handleCloseChatSession}
                  minimized={chatSessionMinimized}
                  onToggleMinimize={handleToggleChatMinimize}
                />
              </div>
              {!chatSessionMinimized && (
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {activeChatSessionId && (
                    <ChatSessionPane
                      sessionId={activeChatSessionId}
                      onClose={() => {
                        setChatSessionVisible(false);
                        setChatSessionMinimized(false);
                      }}
                      onFileChanged={handleAgentFileChange}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Editor area */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <TabBar
              openFiles={openFilesList}
              activePath={activeFile}
              dirtyFiles={dirtyFiles}
              onTabClick={setActiveFile}
              onTabClose={closeTab}
            />

            {currentFile ? (
              <EditorPane
                ref={editorRef}
                path={currentFile.path}
                language={currentFile.language}
                wordWrap={wordWrap}
                onCursorChange={handleCursorChange}
                onDirtyChange={handleDirtyChange}
              />
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 24,
                  opacity: 0.6,
                }}
              >
                <div
                  style={{ fontSize: 64, color: COLORS.accent, lineHeight: 1 }}
                >
                  ◆
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 300,
                    color: COLORS.textMuted,
                  }}
                >
                  Welcome
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    style={{
                      padding: "10px 24px",
                      background: "transparent",
                      border: `1px solid ${COLORS.borderLight}`,
                      borderRadius: 6,
                      color: COLORS.text,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                    onClick={() => setShowFolderPicker(true)}
                  >
                    Open Folder
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    fontSize: 12,
                    color: COLORS.textMuted,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <kbd style={kbdStyle}>Ctrl+O</kbd> Open Folder
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <kbd style={kbdStyle}>Ctrl+L</kbd> Agent Chat
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <kbd style={kbdStyle}>Ctrl+B</kbd> Toggle Sidebar
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <kbd style={kbdStyle}>Ctrl+`</kbd> Toggle Terminal
                  </div>
                </div>
              </div>
            )}
          </div>

          {terminalVisible && (
            <div
              style={{
                height: 220,
                minHeight: 100,
                borderTop: `1px solid ${COLORS.border}`,
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
                background: COLORS.bgDark,
              }}
            >
              <div
                style={{
                  height: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 12px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: COLORS.textMuted,
                  }}
                >
                  TERMINAL
                </span>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: COLORS.textMuted,
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                    padding: "0 4px",
                  }}
                  onClick={() => setTerminalVisible(false)}
                >
                  ×
                </button>
              </div>
              <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
                {workspaceRoot ? (
                  <TerminalPane workspaceRoot={workspaceRoot} />
                ) : (
                  <div
                    style={{
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 13, opacity: 0.5 }}>
                      Open a folder first to use the terminal
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Explorer */}
        {showRightPanel && (
          <div
            style={{
              width: 260,
              background: COLORS.bgDark,
              borderLeft: `1px solid ${COLORS.border}`,
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                height: 35,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 12px",
                borderBottom: `1px solid ${COLORS.border}`,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: COLORS.textMuted,
                }}
              >
                {activeActivity === "explorer" && "Explorer"}
                {activeActivity === "search" && "Search"}
                {activeActivity === "git" && "Source Control"}
                {activeActivity === "extensions" && "Extensions"}
                {activeActivity === "rpc" && "RPC Log"}
              </span>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: COLORS.textMuted,
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "0 4px",
                }}
                onClick={() => setSidebarVisible(false)}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              {activeActivity === "explorer" && workspaceRoot && (
                <ExplorerPane
                  root={workspaceRoot}
                  onFileClick={handleFileClick}
                />
              )}
              {activeActivity === "explorer" && !workspaceRoot && (
                <div
                  style={{
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <button
                    style={{
                      padding: "8px 20px",
                      background: COLORS.accent,
                      color: "#0d1f17",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                    onClick={() => setShowFolderPicker(true)}
                  >
                    Open Folder
                  </button>
                  <div style={{ fontSize: 11, color: COLORS.textDim }}>
                    or press Ctrl+O
                  </div>
                </div>
              )}
              {activeActivity === "search" && (
                <div
                  style={{
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 13, opacity: 0.5 }}>
                    Search in files
                  </div>
                  <input
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 12,
                      background: COLORS.bgLighter,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 3,
                      color: COLORS.text,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    placeholder="Search"
                  />
                </div>
              )}
              {activeActivity === "git" && (
                <div
                  style={{
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 13, opacity: 0.5 }}>
                    Source Control
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.3, marginTop: 8 }}>
                    {workspaceRoot
                      ? "No changes detected"
                      : "Open a folder to see Git status"}
                  </div>
                </div>
              )}
              {activeActivity === "extensions" && (
                <div
                  style={{
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 13, opacity: 0.5 }}>Extensions</div>
                  <div style={{ fontSize: 11, opacity: 0.3, marginTop: 8 }}>
                    Extension marketplace coming soon
                  </div>
                </div>
              )}
              {activeActivity === "rpc" && <RpcLogPanel />}
            </div>
          </div>
        )}
      </div>

      <StatusBar
        connected={connected}
        saving={saving}
        dirty={currentFile ? dirtyFiles.has(currentFile.path) : false}
        language={currentFile?.language || "plaintext"}
        line={cursorLine}
        col={cursorCol}
        encoding="UTF-8"
        lineEnding="LF"
        wordWrap={wordWrap}
        workspaceName={workspaceRoot?.split("/").pop() || ""}
      />

      {showFolderPicker && (
        <FolderPicker
          onSelect={handleOpenFolder}
          onClose={() => setShowFolderPicker(false)}
        />
      )}

      {notification && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 16px",
            background: COLORS.accent,
            color: "#0d1f17",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            zIndex: 2000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {notification}
        </div>
      )}
    </div>
  );
}

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    rs: "rust",
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    py: "python",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    css: "css",
    html: "html",
    json: "json",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml",
    sh: "shell",
  };
  return map[ext] || "plaintext";
}

const kbdStyle: React.CSSProperties = {
  padding: "2px 6px",
  background: "#251d4a",
  border: "1px solid #2d2350",
  borderRadius: 3,
  fontSize: 11,
  fontFamily: "monospace",
  color: "#4ade80",
};
