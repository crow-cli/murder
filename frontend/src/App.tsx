import { useEffect, useState, useCallback, useRef } from "react";
import EditorPane, {
  type EditorPaneHandle,
  setModelContent,
  disposeModel,
} from "./components/EditorPane";
import ExplorerPane from "./components/ExplorerPane";
import { FolderPicker } from "./components/FolderPicker";
import { ActivityBar, type ActivityId } from "./components/ActivityBar";
import { StatusBar } from "./components/StatusBar";
import { TabBar } from "./components/TabBar";
import { MenuBar, type MenuGroup } from "./components/MenuBar";
import { ws } from "./lib/ws-client";
import { getFileIcon } from "./lib/file-icons";

export { getFileIcon };

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

/** Minimal open file tracking — content lives in Monaco models, not React state */
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
  const [activeActivity, setActiveActivity] = useState<ActivityId>("explorer");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [_menuOpen, setMenuOpen] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);

  // Refs for stable access inside closures/event handlers
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

  // Listen for Ctrl+S from Monaco editor
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const path = e.detail.path as string;
      if (path) saveFile(path);
    };
    window.addEventListener("editor-save", handler as EventListener);
    return () =>
      window.removeEventListener("editor-save", handler as EventListener);
  }, []);

  // Show notification briefly
  const notify = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  }, []);

  // Save file — reads content DIRECTLY from Monaco model, no React state lag
  const saveFile = useCallback(
    async (path: string) => {
      if (savingRef.current) return;
      setSaving(true);
      try {
        // Read content directly from the Monaco model — always fresh
        const content = editorRef.current?.getContent() ?? "";

        // Sync to backend model, then write to disk
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

  // Close tab — dispose Monaco model, clean up state
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

  // Global keyboard shortcuts
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

      if (ctrl && e.key === "s" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        const af = activeFileRef.current;
        if (af) saveFile(af);
        return;
      }

      if (ctrl && e.key === "w" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        const af = activeFileRef.current;
        if (af) closeTab(af);
        return;
      }

      if (ctrl && e.key === "b" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        setSidebarVisible((v) => !v);
        return;
      }

      if (e.key === "Escape") {
        setMenuOpen(null);
        setShowFolderPicker(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [saveFile, closeTab]);

  const handleOpenFolder = async (path: string) => {
    setShowFolderPicker(false);
    try {
      await ws.invoke<{ root: string }>("workspace_open", { path });
      setWorkspaceRoot(path);
      setOpenFiles(new Map());
      setActiveFile(null);
      setDirtyFiles(new Set());
      notify(`Opened ${path.split("/").pop()}`);
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

      // Register with backend document store
      await ws.invoke("document_open", { path, content });

      // Populate Monaco model with content
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
    if (dirty) {
      setDirtyFiles((prev) => new Set(prev).add(af));
    }
  }, []);

  // Menu actions
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
          for (const path of dirtyFilesRef.current) {
            saveFile(path);
          }
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
          setActiveActivity("terminal");
          setSidebarVisible(true);
          break;
        case "extensions":
          setActiveActivity("extensions");
          setSidebarVisible(true);
          break;
      }
    },
    [saveFile, closeTab],
  );

  const currentFile = activeFile ? openFiles.get(activeFile) : null;
  const openFilesList = Array.from(openFiles.values());

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
        { label: "Explorer", action: "explorer", shortcut: "Ctrl+Shift+E" },
        { label: "Search", action: "search", shortcut: "Ctrl+Shift+F" },
        {
          label: "Source Control",
          action: "source_control",
          shortcut: "Ctrl+Shift+G",
        },
        { label: "Terminal", action: "terminal", shortcut: "Ctrl+`" },
        { label: "Extensions", action: "extensions", shortcut: "Ctrl+Shift+X" },
        { separator: true },
        {
          label: "Toggle Sidebar",
          action: "toggle_sidebar",
          shortcut: "Ctrl+B",
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

  return (
    <div style={styles.root}>
      <MenuBar
        items={menuItems}
        onAction={handleMenuAction}
        onOpenChange={setMenuOpen}
      />

      <div style={styles.mainArea}>
        <ActivityBar
          active={activeActivity}
          onActivate={(id) => {
            if (id === activeActivity) setSidebarVisible((v) => !v);
            else {
              setActiveActivity(id);
              setSidebarVisible(true);
            }
          }}
        />

        {sidebarVisible && (
          <div style={styles.sidebar}>
            <div style={styles.sidebarHeader}>
              <span style={styles.sidebarTitle}>
                {activeActivity === "explorer" && "Explorer"}
                {activeActivity === "search" && "Search"}
                {activeActivity === "git" && "Source Control"}
                {activeActivity === "terminal" && "Terminal"}
                {activeActivity === "extensions" && "Extensions"}
              </span>
              <button
                style={styles.sidebarClose}
                onClick={() => setSidebarVisible(false)}
              >
                ×
              </button>
            </div>
            <div style={styles.sidebarContent}>
              {activeActivity === "explorer" && workspaceRoot && (
                <ExplorerPane
                  root={workspaceRoot}
                  onFileClick={handleFileClick}
                />
              )}
              {activeActivity === "explorer" && !workspaceRoot && (
                <div style={styles.emptyState}>
                  <button
                    style={styles.openFolderBtn}
                    onClick={() => setShowFolderPicker(true)}
                  >
                    Open Folder
                  </button>
                  <div style={styles.emptyHint}>or press Ctrl+O</div>
                </div>
              )}
              {activeActivity === "search" && (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 13, opacity: 0.5 }}>
                    Search in files
                  </div>
                  <input style={styles.searchInput} placeholder="Search" />
                </div>
              )}
              {activeActivity === "git" && (
                <div style={styles.emptyState}>
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
              {activeActivity === "terminal" && (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 13, opacity: 0.5 }}>Terminal</div>
                  <div style={{ fontSize: 11, opacity: 0.3, marginTop: 8 }}>
                    Terminal panel coming soon
                  </div>
                </div>
              )}
              {activeActivity === "extensions" && (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 13, opacity: 0.5 }}>Extensions</div>
                  <div style={{ fontSize: 11, opacity: 0.3, marginTop: 8 }}>
                    Extension marketplace coming soon
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={styles.editorArea}>
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
              onCursorChange={handleCursorChange}
              onDirtyChange={handleDirtyChange}
            />
          ) : (
            <div style={styles.welcomeScreen}>
              <div style={styles.welcomeLogo}>◆</div>
              <div style={styles.welcomeTitle}>Welcome</div>
              <div style={styles.welcomeActions}>
                <button
                  style={styles.welcomeBtn}
                  onClick={() => setShowFolderPicker(true)}
                >
                  Open Folder
                </button>
              </div>
              <div style={styles.welcomeShortcuts}>
                <div style={styles.welcomeShortcut}>
                  <kbd style={styles.kbd}>Ctrl+O</kbd> Open Folder
                </div>
                <div style={styles.welcomeShortcut}>
                  <kbd style={styles.kbd}>Ctrl+P</kbd> Quick Open
                </div>
                <div style={styles.welcomeShortcut}>
                  <kbd style={styles.kbd}>Ctrl+B</kbd> Toggle Sidebar
                </div>
              </div>
            </div>
          )}
        </div>
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
        workspaceName={workspaceRoot?.split("/").pop() || ""}
      />

      {showFolderPicker && (
        <FolderPicker
          onSelect={handleOpenFolder}
          onClose={() => setShowFolderPicker(false)}
        />
      )}

      {notification && <div style={styles.notification}>{notification}</div>}
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
  tabActive: "#1e1640",
  tabInactive: "#14101f",
  statusBg: "#0d7a3e",
  statusBgNoFolder: "#3b2d5a",
  menuHover: "#2d2350",
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
    overflow: "hidden",
    userSelect: "none",
  },
  mainArea: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: {
    width: 260,
    background: COLORS.bgDark,
    borderRight: `1px solid ${COLORS.border}`,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },
  sidebarHeader: {
    height: 35,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    borderBottom: `1px solid ${COLORS.border}`,
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: COLORS.textMuted,
  },
  sidebarClose: {
    background: "none",
    border: "none",
    color: COLORS.textMuted,
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    padding: "0 4px",
  },
  sidebarContent: { flex: 1, overflow: "auto" },
  editorArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  emptyState: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  openFolderBtn: {
    padding: "8px 20px",
    background: COLORS.accent,
    color: "#0d1f17",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
  },
  emptyHint: { fontSize: 11, color: COLORS.textDim },
  searchInput: {
    width: "100%",
    padding: "6px 10px",
    fontSize: 12,
    background: COLORS.bgLighter,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 3,
    color: COLORS.text,
    outline: "none",
    boxSizing: "border-box",
  },
  welcomeScreen: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    opacity: 0.6,
  },
  welcomeLogo: { fontSize: 64, color: COLORS.accent, lineHeight: 1 },
  welcomeTitle: { fontSize: 28, fontWeight: 300, color: COLORS.textMuted },
  welcomeActions: { display: "flex", gap: 12 },
  welcomeBtn: {
    padding: "10px 24px",
    background: "transparent",
    border: `1px solid ${COLORS.borderLight}`,
    borderRadius: 6,
    color: COLORS.text,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  welcomeShortcuts: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  welcomeShortcut: { display: "flex", alignItems: "center", gap: 8 },
  kbd: {
    padding: "2px 6px",
    background: COLORS.bgLighter,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 3,
    fontSize: 11,
    fontFamily: "monospace",
    color: COLORS.accent,
  },
  notification: {
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
  },
};
