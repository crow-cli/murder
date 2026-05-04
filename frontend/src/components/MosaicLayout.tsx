/** Mosaic layout with typed tiles — backend-persisted via SQLite */
import { useState, useCallback, useEffect, useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Mosaic, MosaicNode, MosaicBranch, MosaicWindow } from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";
import EditorPane, { setModelContent } from "./EditorPane";
import TerminalPane from "./TerminalPane";
import ChatTile from "./ChatTile";
import type { AgentConfig } from "../lib/acp-client";
import { ws } from "../lib/ws-client";
import {
  setGlobalOpenFile,
  setGlobalOpenTerminal,
  setGlobalOpenChat,
  setGetLayout,
} from "../lib/workspace-context";
import { FileIcon } from "../lib/file-icons";
import * as settings from "../lib/settings";

// ── Tile metadata registry ───────────────────────────────────────────────────
export type TileType = "editor" | "terminal" | "chat";

export interface TileMeta {
  type: TileType;
}

/** String-keyed mosaic. Metadata stored in the registry. */
export type ViewId = string;

/** Each editor tile tracks its own set of open files + active file */
export interface EditorTileState {
  files: { path: string; language: string }[];
  activeIndex: number;
}

/** Each terminal tile tracks its own terminals */
export interface TerminalTileState {
  terminals: string[];
  activeIndex: number;
}

/** Each chat tile tracks its own sessions */
export interface ChatTileState {
  sessions: string[]; // session IDs
  activeIndex: number;
}

/** Registry: viewId → tile metadata + per-tile state */
const tileRegistry = new Map<
  ViewId,
  {
    meta: TileMeta;
    editorState?: EditorTileState;
    terminalState?: TerminalTileState;
    chatState?: ChatTileState;
    pendingFiles?: string[];
  }
>();

/** Set of minimized (hidden) tile IDs */
const minimizedTiles = new Set<ViewId>();

/** Track the last-active tile for each type — new files go here */
const lastActiveTile = new Map<TileType, ViewId>();

// Debounced save to backend
let layoutSaveTimeout: ReturnType<typeof setTimeout> | null = null;
let tileStateSaveTimeout: ReturnType<typeof setTimeout> | null = null;

function debounceSaveLayout(workspace: string, layoutJson: string) {
  if (layoutSaveTimeout) clearTimeout(layoutSaveTimeout);
  layoutSaveTimeout = setTimeout(() => {
    ws.invoke("save_mosaic_layout", { workspace, layout: layoutJson }).catch(
      console.error,
    );
  }, 300);
}

function debounceSaveTileState(
  workspace: string,
  tileId: string,
  tileType: string,
  stateJson: string,
  isMinimized: boolean,
) {
  if (tileStateSaveTimeout) clearTimeout(tileStateSaveTimeout);
  tileStateSaveTimeout = setTimeout(() => {
    ws.invoke("save_tile_state", {
      workspace,
      tileId,
      tileType,
      state: stateJson,
      isMinimized,
    }).catch(console.error);
  }, 300);
}

// ── Utility: generate unique tile ID ──────────────────────────────────────────
let tileCounter = 0;
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${++tileCounter}`;
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

// ── Tile registration helpers ─────────────────────────────────────────────────
export function registerTile(id: ViewId, type: TileType) {
  if (tileRegistry.has(id)) return;
  tileRegistry.set(id, {
    meta: { type },
    editorState: type === "editor" ? { files: [], activeIndex: -1 } : undefined,
    terminalState:
      type === "terminal" ? { terminals: [], activeIndex: -1 } : undefined,
    chatState: type === "chat" ? { sessions: [], activeIndex: -1 } : undefined,
    pendingFiles: [],
  });
}

export function unregisterTile(id: ViewId) {
  if (minimizedTiles.has(id)) return;
  tileRegistry.delete(id);
}

export function getEditorState(id: ViewId): EditorTileState | null {
  return tileRegistry.get(id)?.editorState ?? null;
}

export function getTerminalState(id: ViewId): TerminalTileState | null {
  return tileRegistry.get(id)?.terminalState ?? null;
}

export function getChatState(id: ViewId): ChatTileState | null {
  return tileRegistry.get(id)?.chatState ?? null;
}

/** Global accessor for current workspace (set by MosaicLayout). */
let currentWorkspace: string | null = null;
export function setCurrentWorkspace(ws: string | null) {
  currentWorkspace = ws;
}
export function getCurrentWorkspace(): string | null {
  return currentWorkspace;
}

// ── Expose tile count helpers ─────────────────────────────────────────────────
export function getVisibleTileCount(type: TileType): number {
  let count = 0;
  for (const [id, entry] of tileRegistry) {
    if (entry.meta.type === type && !minimizedTiles.has(id)) count++;
  }
  return count;
}

export function getMinimizedTileCount(type: TileType): number {
  let count = 0;
  for (const id of minimizedTiles) {
    const entry = tileRegistry.get(id);
    if (entry?.meta.type === type) count++;
  }
  return count;
}

// ── Context Menu ──────────────────────────────────────────────────────────────
interface ContextMenuState {
  x: number;
  y: number;
  tileId: ViewId;
  tileType: TileType;
  tabPath?: string; // for tab-level context menu
  onClose: () => void;
}

function ContextMenu({
  x,
  y,
  tileId,
  tileType,
  tabPath,
  onClose,
}: ContextMenuState) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleAction = (action: string) => {
    onClose();
    switch (action) {
      case "split-left":
        window.dispatchEvent(
          new CustomEvent("split-tile", {
            detail: { tileId, direction: "left" },
          }),
        );
        break;
      case "split-right":
        window.dispatchEvent(
          new CustomEvent("split-tile", {
            detail: { tileId, direction: "right" },
          }),
        );
        break;
      case "split-up":
        window.dispatchEvent(
          new CustomEvent("split-tile", {
            detail: { tileId, direction: "up" },
          }),
        );
        break;
      case "split-down":
        window.dispatchEvent(
          new CustomEvent("split-tile", {
            detail: { tileId, direction: "down" },
          }),
        );
        break;
      case "close-tile":
        window.dispatchEvent(
          new CustomEvent("remove-tile", { detail: { tileId } }),
        );
        break;
      case "close-tab":
        if (tabPath) {
          window.dispatchEvent(
            new CustomEvent("editor-close-tab", { detail: { path: tabPath } }),
          );
        }
        break;
    }
  };

  return (
    <div ref={menuRef} className="context-menu" style={{ left: x, top: y }}>
      <button
        className="context-menu-item"
        onClick={() => handleAction("split-right")}
      >
        <span>Split Right</span>
        <span className="shortcut">⊞→</span>
      </button>
      <button
        className="context-menu-item"
        onClick={() => handleAction("split-left")}
      >
        <span>Split Left</span>
        <span className="shortcut">⊞←</span>
      </button>
      <button
        className="context-menu-item"
        onClick={() => handleAction("split-down")}
      >
        <span>Split Down</span>
        <span className="shortcut">⊞↓</span>
      </button>
      <button
        className="context-menu-item"
        onClick={() => handleAction("split-up")}
      >
        <span>Split Up</span>
        <span className="shortcut">↑</span>
      </button>
      <div className="context-menu-separator" />
      <button
        className="context-menu-item danger"
        onClick={() => handleAction("close-tile")}
      >
        <span>Close Pane</span>
        <span className="shortcut">✕</span>
      </button>
    </div>
  );
}

// ── EditorTile: tabbed file container ─────────────────────────────────────────
interface EditorTileProps {
  tileId: ViewId;
  workspaceRoot: string | null;
  onFileClick?: (path: string) => void;
  onRemove?: () => void;
  wordWrap?: boolean;
  /** Called when this tile gains focus (for tracking last-active) */
  onFocus?: () => void;
  /** Register a drop handler for this tile */
  onRegisterDrop?: (
    tileId: ViewId,
    type: TileType,
    handler: (path: string) => void,
  ) => void;
  onUnregisterDrop?: (tileId: ViewId) => void;
}

function EditorTile({
  tileId,
  workspaceRoot: _wr,
  onFileClick,
  onRemove,
  wordWrap,
  onFocus,
  onRegisterDrop,
  onUnregisterDrop,
}: EditorTileProps) {
  const registryEntry = tileRegistry.get(tileId);
  const savedState = registryEntry?.editorState;
  const [files, setFiles] = useState<{ path: string; language: string }[]>(
    savedState?.files ?? [],
  );
  const [activeIndex, setActiveIndex] = useState(savedState?.activeIndex ?? -1);
  const openFileRef = useRef<((path: string) => Promise<void>) | null>(null);
  const onRemoveRef = useRef(onRemove);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    onRemoveRef.current = onRemove;
  }, [onRemove]);

  useEffect(() => {
    registerTile(tileId, "editor");
    lastActiveTile.set("editor", tileId);
    onFocus?.();
    return () => unregisterTile(tileId);
  }, [tileId]);

  useEffect(() => {
    const entry = tileRegistry.get(tileId);
    if (entry?.editorState) {
      entry.editorState.files = files;
      entry.editorState.activeIndex = activeIndex;
      const ws = getCurrentWorkspace();
      if (ws && files.length > 0) {
        debounceSaveTileState(
          ws,
          tileId,
          "editor",
          JSON.stringify({ files, activeIndex }),
          false,
        );
      }
    }
  }, [files, activeIndex, tileId]);

  const openFile = useCallback(
    async (path: string) => {
      const language = getLanguage(path);
      const existingIdx = files.findIndex((f) => f.path === path);
      if (existingIdx >= 0) {
        setActiveIndex(existingIdx);
        return;
      }
      try {
        const result = await ws.invoke<{ content: string }>("read_file", {
          path,
        });
        setModelContent(path, result.content, language);
      } catch {
        setModelContent(path, "", language);
      }
      setFiles((prev) => [...prev, { path, language }]);
      setActiveIndex(files.length);
      onFileClick?.(path);
    },
    [files, onFileClick],
  );

  useEffect(() => {
    openFileRef.current = openFile;
  }, [openFile]);

  useEffect(() => {
    const entry = tileRegistry.get(tileId);
    if (entry?.pendingFiles && entry.pendingFiles.length > 0) {
      const pending = [...entry.pendingFiles];
      entry.pendingFiles = [];
      for (const path of pending) openFileRef.current?.(path);
    }
  }, [tileId]);

  const closeFile = useCallback((path: string) => {
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.path === path);
      const next = prev.filter((f) => f.path !== path);
      if (next.length === 0) {
        onRemoveRef.current?.();
      }
      setActiveIndex((ai) => {
        if (next.length === 0) return -1;
        if (ai === idx) return Math.max(0, next.length - 1);
        if (ai > idx) return ai - 1;
        return ai;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        tileId: string;
        path: string;
      };
      if (detail.tileId === tileId) openFile(detail.path);
    };
    window.addEventListener("tile-open-file", handler);
    return () => window.removeEventListener("tile-open-file", handler);
  }, [tileId, openFile]);

  // Register drop handler for drag-and-drop from other panes
  useEffect(() => {
    onRegisterDrop?.(tileId, "editor", openFile);
    return () => onUnregisterDrop?.(tileId);
  }, [tileId, openFile, onRegisterDrop, onUnregisterDrop]);

  // ─ Tab drag source ───────────────────────────────────────────
  function DraggableTab({
    file,
    idx,
    isActive,
  }: {
    file: { path: string; language: string };
    idx: number;
    isActive: boolean;
  }) {
    const [{ isDragging }, drag] = useDrag({
      type: "FILE_TAB",
      item: { path: file.path, language: file.language, sourceTileId: tileId },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    });

    return (
      <div
        ref={drag}
        className="flex items-center gap-1.5 px-3 text-[13px] cursor-pointer select-none border-r border-[var(--color-border)] min-w-0 relative transition-colors"
        style={{
          backgroundColor: isActive ? "var(--color-card)" : "transparent",
          color: isActive
            ? "var(--color-foreground)"
            : "var(--color-foreground-dim)",
          opacity: isDragging ? 0.4 : 1,
        }}
        onClick={() => setActiveIndex(idx)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            tileId,
            tileType: "editor",
            tabPath: file.path,
            onClose: () => setContextMenu(null),
          });
        }}
      >
        {isActive && (
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-[var(--color-primary)]" />
        )}
        <FileIcon name={file.path} size={12} />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px]">
          {file.path.split("/").pop()}
        </span>
        <button
          className="ml-auto h-5 w-5 p-0 rounded-sm text-[var(--color-active)] hover:text-[var(--color-destructive)] hover:bg-[var(--color-border)] flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            closeFile(file.path);
          }}
        >
          ×
        </button>
      </div>
    );
  }

  const activeFile = activeIndex >= 0 ? files[activeIndex] : null;

  return (
    <div
      className="flex flex-col h-full bg-[var(--color-background-dark)]"
      onClick={() => {
        onFocus?.();
        lastActiveTile.set("editor", tileId);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          tileId,
          tileType: "editor",
          onClose: () => setContextMenu(null),
        });
      }}
    >
      {files.length > 0 && (
        <div className="flex bg-[var(--color-background)] border-b border-[var(--color-border)] overflow-x-auto shrink-0 h-[35px]">
          {files.map((file, idx) => (
            <DraggableTab
              key={file.path}
              file={file}
              idx={idx}
              isActive={idx === activeIndex}
            />
          ))}
        </div>
      )}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {files.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-40">
            <div className="text-3xl">◆</div>
            <div className="text-sm">No files open</div>
          </div>
        )}
        {activeFile && (
          <EditorPane
            path={activeFile.path}
            language={activeFile.language}
            isActive
            wordWrap={wordWrap}
          />
        )}
      </div>
      {contextMenu && <ContextMenu {...contextMenu} />}
    </div>
  );
}

// ── TerminalTile: tabbed terminal container ───────────────────────────────────
interface TerminalTileProps {
  tileId: ViewId;
  workspaceRoot: string | null;
  onRemove?: () => void;
  onFocus?: () => void;
  onRegisterDrop?: (
    tileId: ViewId,
    type: TileType,
    handler: (path: string) => void,
  ) => void;
  onUnregisterDrop?: (tileId: ViewId) => void;
}

function TerminalTile({
  tileId,
  workspaceRoot,
  onRemove,
  onFocus,
}: TerminalTileProps) {
  const registryEntry = tileRegistry.get(tileId);
  const savedState = registryEntry?.terminalState;
  const [terminals, setTerminals] = useState<string[]>(
    savedState?.terminals ?? [],
  );
  const [activeIndex, setActiveIndex] = useState(savedState?.activeIndex ?? -1);
  const termCounterRef = useRef(0);
  const onRemoveRef = useRef(onRemove);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    onRemoveRef.current = onRemove;
  }, [onRemove]);

  useEffect(() => {
    registerTile(tileId, "terminal");
    lastActiveTile.set("terminal", tileId);
    onFocus?.();
    return () => unregisterTile(tileId);
  }, [tileId]);

  useEffect(() => {
    const entry = tileRegistry.get(tileId);
    if (entry?.terminalState) {
      entry.terminalState.terminals = terminals;
      entry.terminalState.activeIndex = activeIndex;
      const ws = getCurrentWorkspace();
      if (ws && terminals.length > 0) {
        debounceSaveTileState(
          ws,
          tileId,
          "terminal",
          JSON.stringify({ terminals, activeIndex }),
          false,
        );
      }
    }
  }, [terminals, activeIndex, tileId]);

  const addTerminal = useCallback(() => {
    termCounterRef.current++;
    const id = `term-${Date.now()}-${termCounterRef.current}`;
    setTerminals((prev) => [...prev, id]);
    setActiveIndex(terminals.length);
  }, [terminals]);

  const closeTerminal = useCallback((id: string) => {
    setTerminals((prev) => {
      const idx = prev.indexOf(id);
      const next = prev.filter((t) => t !== id);
      if (next.length === 0) {
        onRemoveRef.current?.();
      }
      setActiveIndex((ai) => {
        if (next.length === 0) return -1;
        if (ai === idx) return Math.max(0, next.length - 1);
        if (ai > idx) return ai - 1;
        return ai;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tileId: string };
      if (detail.tileId === tileId) addTerminal();
    };
    window.addEventListener("tile-add-terminal", handler);
    return () => window.removeEventListener("tile-add-terminal", handler);
  }, [tileId, addTerminal]);

  // Auto-create first terminal on mount (only if no terminals restored from state)
  useEffect(() => {
    if (terminals.length === 0) addTerminal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTerm = activeIndex >= 0 ? terminals[activeIndex] : null;

  return (
    <div
      className="flex flex-col h-full bg-[var(--color-background-dark)]"
      onClick={() => {
        onFocus?.();
        lastActiveTile.set("terminal", tileId);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          tileId,
          tileType: "terminal",
          onClose: () => setContextMenu(null),
        });
      }}
    >
      {terminals.length > 0 && (
        <div className="flex bg-[var(--color-background)] border-b border-[var(--color-border)] overflow-x-auto shrink-0 h-[35px]">
          {terminals.map((termId, idx) => {
            const isActive = idx === activeIndex;
            return (
              <div
                key={termId}
                className="flex items-center gap-1.5 px-3 text-[13px] cursor-pointer select-none border-r border-[var(--color-border)] min-w-0 relative transition-colors"
                style={{
                  backgroundColor: isActive
                    ? "var(--color-card)"
                    : "transparent",
                  color: isActive
                    ? "var(--color-foreground)"
                    : "var(--color-foreground-dim)",
                }}
                onClick={() => setActiveIndex(idx)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    tileId,
                    tileType: "terminal",
                    onClose: () => setContextMenu(null),
                  });
                }}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-[var(--color-primary)]" />
                )}
                <span className="text-xs">⌨</span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]">
                  Terminal {idx + 1}
                </span>
                <button
                  className="ml-auto h-5 w-5 p-0 rounded-sm text-[var(--color-active)] hover:text-[var(--color-destructive)] hover:bg-[var(--color-border)] flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(termId);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            className="flex items-center px-2 text-[var(--color-foreground-dim)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-border)] transition-colors"
            onClick={addTerminal}
            title="New Terminal"
          >
            +
          </button>
        </div>
      )}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Render ALL terminals, hide inactive ones — each gets its own PTY */}
        {terminals.map((termId, idx) => (
          <div
            key={termId}
            className="absolute inset-0"
            style={{ display: idx === activeIndex ? "block" : "none" }}
          >
            {workspaceRoot && (
              <TerminalPane
                key={termId}
                workspaceRoot={workspaceRoot}
                terminalId={termId}
              />
            )}
          </div>
        ))}
        {terminals.length === 0 && workspaceRoot && (
          <div className="flex items-center justify-center h-full text-[var(--color-foreground-dim)] text-sm">
            No terminal
          </div>
        )}
        {terminals.length === 0 && !workspaceRoot && (
          <div className="flex items-center justify-center h-full text-[var(--color-foreground-dim)] text-sm">
            Open a folder to use the terminal
          </div>
        )}
      </div>
      {contextMenu && <ContextMenu {...contextMenu} />}
    </div>
  );
}

// ─ MosaicLayout ──────────────────────────────────────────────────────────────
interface MosaicLayoutProps {
  workspaceRoot: string | null;
  agentConfig: AgentConfig;
}

export default function MosaicLayout({ workspaceRoot, agentConfig }: MosaicLayoutProps) {
  const [layout, setLayout] = useState<MosaicNode<ViewId> | null>(null);
  const [minimizedState, setMinimizedState] = useState<Set<ViewId>>(new Set());
  const [wordWrap, setWordWrap] = useState(
    settings.getSettings().editor.wordWrap === "on",
  );
  const workspaceRef = useRef(workspaceRoot);
  const dropHandlersRef = useRef(new Map<ViewId, (path: string) => void>());
  const dropTileTypesRef = useRef(new Map<ViewId, TileType>());

  // Subscribe to settings changes for word wrap
  useEffect(() => {
    return settings.subscribe(() => {
      setWordWrap(settings.getSettings().editor.wordWrap === "on");
    });
  }, []);

  useEffect(() => {
    workspaceRef.current = workspaceRoot;
    setCurrentWorkspace(workspaceRoot);
  }, [workspaceRoot]);

  useEffect(() => {
    setGetLayout(() => layout);
  }, [layout]);

  // ── Drop handler registration ─────────────────────────────────────────────
  const registerDrop = useCallback(
    (tileId: ViewId, type: TileType, handler: (path: string) => void) => {
      dropHandlersRef.current.set(tileId, handler);
      dropTileTypesRef.current.set(tileId, type);
    },
    [],
  );

  const unregisterDrop = useCallback((tileId: ViewId) => {
    dropHandlersRef.current.delete(tileId);
    dropTileTypesRef.current.delete(tileId);
  }, []);

  // ── Remove tile from mosaic tree ──────────────────────────────────────────
  const removeFromTree = useCallback(
    (
      node: MosaicNode<ViewId> | null,
      target: ViewId,
    ): MosaicNode<ViewId> | null => {
      if (!node) return null;
      if (typeof node === "string") return node === target ? null : node;
      const { first, second, direction } = node;
      const newFirst = removeFromTree(first, target);
      const newSecond = removeFromTree(second, target);
      if (newFirst === null && newSecond === null) return null;
      if (newFirst === null) return newSecond;
      if (newSecond === null) return newFirst;
      return { first: newFirst, second: newSecond, direction };
    },
    [],
  );

  const removeTile = useCallback(
    (viewId: ViewId) => {
      const currentWs = workspaceRef.current;
      dropHandlersRef.current.delete(viewId);
      dropTileTypesRef.current.delete(viewId);
      setLayout((prev) => {
        const next = removeFromTree(prev, viewId);
        unregisterTile(viewId);
        if (currentWs) {
          ws.invoke("delete_tile_state", {
            workspace: currentWs,
            tileId: viewId,
          }).catch(console.error);
          if (next) {
            debounceSaveLayout(currentWs, JSON.stringify(next));
          } else {
            debounceSaveLayout(currentWs, "null");
          }
        }
        return next;
      });
    },
    [removeFromTree],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tileId: ViewId };
      removeTile(detail.tileId);
    };
    window.addEventListener("remove-tile", handler);
    return () => window.removeEventListener("remove-tile", handler);
  }, [removeTile]);

  // ── Split tile on right-click ─────────────────────────────────────────────
  const splitTile = useCallback(
    (sourceTileId: ViewId, direction: "left" | "right" | "up" | "down") => {
      const entry = tileRegistry.get(sourceTileId);
      const type = entry?.meta.type ?? "editor";
      const newId = uid(type);
      registerTile(newId, type);
      lastActiveTile.set(type, newId);

      const currentWs = workspaceRef.current;
      setLayout((prev) => {
        if (!prev) return newId;

        // Find the source tile and split it
        const splitNode = (node: MosaicNode<ViewId>): MosaicNode<ViewId> => {
          if (typeof node === "string") {
            return node === sourceTileId
              ? {
                  first: node,
                  second: newId,
                  direction:
                    direction === "left" || direction === "right"
                      ? "row"
                      : "column",
                }
              : node;
          }
          const { first, second, direction: dir } = node;
          if (
            dir ===
            (direction === "left" || direction === "right" ? "row" : "column")
          ) {
            // Same direction — add to the end
            if (typeof second === "string") {
              if (second === sourceTileId) {
                return {
                  first,
                  second: { first: second, second: newId, direction: dir },
                  direction: dir,
                };
              }
            }
          }
          const newFirst = splitNode(first);
          const newSecond = splitNode(second);
          return { first: newFirst, second: newSecond, direction: dir };
        };

        const next = splitNode(prev);
        if (currentWs) {
          debounceSaveTileState(currentWs, newId, type, "{}", false);
          debounceSaveLayout(currentWs, JSON.stringify(next));
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        tileId: ViewId;
        direction: string;
      };
      splitTile(
        detail.tileId,
        detail.direction as "left" | "right" | "up" | "down",
      );
    };
    window.addEventListener("split-tile", handler);
    return () => window.removeEventListener("split-tile", handler);
  }, [splitTile]);

  // ─ Minimize / Restore ────────────────────────────────────────────────────
  const minimizeTiles = useCallback(
    (type: TileType) => {
      const toMinimize = new Set<ViewId>();
      for (const [id, entry] of tileRegistry) {
        if (entry.meta.type === type && !minimizedTiles.has(id)) {
          toMinimize.add(id);
          minimizedTiles.add(id);
        }
      }
      if (toMinimize.size === 0) return;

      const currentWs = workspaceRef.current;
      setLayout((prev) => {
        let result = prev;
        for (const id of toMinimize) {
          result = removeFromTree(result, id);
        }
        if (currentWs) {
          for (const id of toMinimize) {
            const entry = tileRegistry.get(id);
            if (entry) {
              const stateJson = JSON.stringify(
                entry.editorState ?? entry.terminalState ?? entry.chatState ?? {},
              );
              debounceSaveTileState(
                currentWs,
                id,
                entry.meta.type,
                stateJson,
                true,
              );
            }
          }
          if (result) debounceSaveLayout(currentWs, JSON.stringify(result));
          else debounceSaveLayout(currentWs, "null");
        }
        return result;
      });
      setMinimizedState((prev) => {
        const next = new Set(prev);
        for (const id of toMinimize) next.add(id);
        return next;
      });
    },
    [removeFromTree],
  );

  const restoreTiles = useCallback((type: TileType) => {
    const toRestore: ViewId[] = [];
    for (const id of minimizedTiles) {
      const entry = tileRegistry.get(id);
      if (entry?.meta.type === type) toRestore.push(id);
    }
    if (toRestore.length === 0) return;

    const currentWs = workspaceRef.current;
    for (const id of toRestore) minimizedTiles.delete(id);
    setMinimizedState((prev) => {
      const next = new Set(prev);
      for (const id of toRestore) next.delete(id);
      return next;
    });

    setLayout((prev) => {
      let result = prev;
      for (const id of toRestore) {
        if (!result) result = id;
        else result = addToLastLeaf(result, id);
      }
      if (currentWs) {
        for (const id of toRestore) {
          const entry = tileRegistry.get(id);
          if (entry) {
            const stateJson = JSON.stringify(
              entry.editorState ?? entry.terminalState ?? {},
            );
            debounceSaveTileState(
              currentWs,
              id,
              entry.meta.type,
              stateJson,
              false,
            );
          }
        }
        if (result) debounceSaveLayout(currentWs, JSON.stringify(result));
        else debounceSaveLayout(currentWs, "null");
      }
      return result;
    });
  }, []);

  const toggleTiles = useCallback(
    (type: TileType) => {
      const anyMinimized = [...tileRegistry].some(
        ([id, entry]) => entry.meta.type === type && minimizedTiles.has(id),
      );
      if (anyMinimized) restoreTiles(type);
      else minimizeTiles(type);
    },
    [minimizeTiles, restoreTiles],
  );

  useEffect(() => {
    const handlers = {
      "toggle-minimize-editors": () => toggleTiles("editor"),
      "toggle-minimize-terminals": () => toggleTiles("terminal"),
      "toggle-minimize-chats": () => toggleTiles("chat"),
    };
    for (const [event, handler] of Object.entries(handlers)) {
      window.addEventListener(event, handler);
    }
    return () => {
      for (const event of Object.keys(handlers)) {
        window.removeEventListener(
          event,
          handlers[event as keyof typeof handlers],
        );
      }
    };
  }, [toggleTiles]);

  useEffect(() => {
    (window as any).__toggleEditors = () => toggleTiles("editor");
    (window as any).__toggleTerminals = () => toggleTiles("terminal");
    (window as any).__toggleChats = () => toggleTiles("chat");
    return () => {
      delete (window as any).__toggleEditors;
      delete (window as any).__toggleTerminals;
      delete (window as any).__toggleChats;
    };
  }, [toggleTiles]);

  // ── Load state from backend on workspace change ───────────────────────────
  useEffect(() => {
    if (!workspaceRoot) return;
    tileRegistry.clear();
    minimizedTiles.clear();
    lastActiveTile.clear();
    setLayout(null);
    setMinimizedState(new Set());

    Promise.all([
      ws.invoke<{ layout: string | null }>("get_mosaic_layout", {
        workspace: workspaceRoot,
      }),
      ws.invoke<{
        tiles: Array<{
          tileId: string;
          tileType: string;
          state: string;
          isMinimized: boolean;
        }>;
      }>("get_tile_states", { workspace: workspaceRoot }),
    ])
      .then(([layoutResult, tileResult]) => {
        for (const tile of tileResult.tiles) {
          registerTile(tile.tileId, tile.tileType as TileType);
          const entry = tileRegistry.get(tile.tileId);
          if (entry) {
            try {
              const parsed = JSON.parse(tile.state);
              if (tile.tileType === "editor" && parsed.files) {
                entry.editorState = {
                  files: parsed.files,
                  activeIndex: parsed.activeIndex ?? -1,
                };
                for (const f of parsed.files) {
                  setModelContent(f.path, "", f.language);
                }
                lastActiveTile.set("editor", tile.tileId);
              } else if (tile.tileType === "terminal" && parsed.terminals) {
                entry.terminalState = {
                  terminals: parsed.terminals,
                  activeIndex: parsed.activeIndex ?? -1,
                };
                lastActiveTile.set("terminal", tile.tileId);
              } else if (tile.tileType === "chat" && parsed.sessions) {
                entry.chatState = {
                  sessions: parsed.sessions,
                  activeIndex: parsed.activeIndex ?? -1,
                };
                lastActiveTile.set("chat", tile.tileId);
              }
            } catch {
              // Invalid state JSON — use defaults
            }
          }
          if (tile.isMinimized) minimizedTiles.add(tile.tileId);
        }

        if (layoutResult.layout) {
          try {
            const parsed = JSON.parse(layoutResult.layout);
            if (parsed) setLayout(parsed);
          } catch {
            // Invalid layout JSON — start fresh
          }
        }
      })
      .catch(console.error);
  }, [workspaceRoot]);

  // ── Global handlers ───────────────────────────────────────────────────────
  const openFileInTile = useCallback(async (path: string) => {
    const language = getLanguage(path);
    const content = await ws
      .invoke<{ content: string }>("read_file", { path })
      .catch(() => ({ content: "" }));
    setModelContent(path, content.content, language);

    // Open in LAST ACTIVE tile, not first
    const lastId = lastActiveTile.get("editor");
    if (lastId && !minimizedTiles.has(lastId)) {
      const entry = tileRegistry.get(lastId);
      const state = entry?.editorState;
      if (state && state.files.some((f) => f.path === path)) {
        state.activeIndex = state.files.findIndex((f) => f.path === path);
        return;
      }
      window.dispatchEvent(
        new CustomEvent("tile-open-file", { detail: { tileId: lastId, path } }),
      );
      return;
    }

    // Fallback: find any visible editor tile
    for (const [id, entry] of tileRegistry) {
      if (entry.meta.type === "editor" && !minimizedTiles.has(id)) {
        const state = entry.editorState;
        if (state && state.files.some((f) => f.path === path)) {
          state.activeIndex = state.files.findIndex((f) => f.path === path);
          return;
        }
        window.dispatchEvent(
          new CustomEvent("tile-open-file", { detail: { tileId: id, path } }),
        );
        return;
      }
    }

    // No visible editor tile — create one
    const id = uid("editor");
    registerTile(id, "editor");
    lastActiveTile.set("editor", id);
    const entry = tileRegistry.get(id);
    if (entry?.pendingFiles) entry.pendingFiles.push(path);
    const currentWs = workspaceRef.current;
    setLayout((prev) => {
      let next: MosaicNode<ViewId>;
      if (!prev) next = id;
      else next = addToLastLeaf(prev, id);
      if (currentWs) debounceSaveLayout(currentWs, JSON.stringify(next));
      return next;
    });
  }, []);

  const openTerminalInTile = useCallback(() => {
    // Check if there's a minimized terminal tile — restore it
    for (const [id, entry] of tileRegistry) {
      if (entry.meta.type === "terminal" && minimizedTiles.has(id)) {
        minimizedTiles.delete(id);
        setMinimizedState((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setLayout((prev) => {
          let result = prev;
          if (!result) result = id;
          else result = addToLastLeaf(result, id);
          const ws = getCurrentWorkspace();
          if (ws) debounceSaveLayout(ws, JSON.stringify(result));
          return result;
        });
        return;
      }
    }

    // Open in LAST ACTIVE terminal tile
    const lastId = lastActiveTile.get("terminal");
    if (lastId && !minimizedTiles.has(lastId)) {
      window.dispatchEvent(
        new CustomEvent("tile-add-terminal", { detail: { tileId: lastId } }),
      );
      return;
    }

    for (const [id, entry] of tileRegistry) {
      if (entry.meta.type === "terminal" && !minimizedTiles.has(id)) {
        window.dispatchEvent(
          new CustomEvent("tile-add-terminal", { detail: { tileId: id } }),
        );
        return;
      }
    }
    const id = uid("terminal");
    registerTile(id, "terminal");
    lastActiveTile.set("terminal", id);
    const currentWs = workspaceRef.current;
    setLayout((prev) => {
      let next: MosaicNode<ViewId>;
      if (!prev) next = id;
      else next = addToLastLeaf(prev, id);
      if (currentWs) debounceSaveLayout(currentWs, JSON.stringify(next));
      return next;
    });
  }, []);

  const openChatInTile = useCallback(() => {
    // Check if there's a minimized chat tile — restore it
    for (const [id, entry] of tileRegistry) {
      if (entry.meta.type === "chat" && minimizedTiles.has(id)) {
        minimizedTiles.delete(id);
        setMinimizedState((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setLayout((prev) => {
          let result = prev;
          if (!result) result = id;
          else result = addToLastLeaf(result, id);
          const ws = getCurrentWorkspace();
          if (ws) debounceSaveLayout(ws, JSON.stringify(result));
          return result;
        });
        return;
      }
    }

    // Open in LAST ACTIVE chat tile
    const lastId = lastActiveTile.get("chat");
    if (lastId && !minimizedTiles.has(lastId)) {
      window.dispatchEvent(new CustomEvent("tile-focus-chat", { detail: { tileId: lastId } }));
      return;
    }

    for (const [id, entry] of tileRegistry) {
      if (entry.meta.type === "chat" && !minimizedTiles.has(id)) {
        window.dispatchEvent(new CustomEvent("tile-focus-chat", { detail: { tileId: id } }));
        return;
      }
    }
    // No visible chat tile — create one
    const id = uid("chat");
    registerTile(id, "chat");
    lastActiveTile.set("chat", id);
    const currentWs = workspaceRef.current;
    setLayout((prev) => {
      let next: MosaicNode<ViewId>;
      if (!prev) next = id;
      else next = addToLastLeaf(prev, id);
      if (currentWs) debounceSaveLayout(currentWs, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    setGlobalOpenFile(openFileInTile);
    setGlobalOpenTerminal(openTerminalInTile);
    setGlobalOpenChat(openChatInTile);
  }, [openFileInTile, openTerminalInTile, openChatInTile]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        path: string;
        language: string;
      };
      const id = uid("editor");
      registerTile(id, "editor");
      lastActiveTile.set("editor", id);
      const currentWs = workspaceRef.current;
      setLayout((prev) => {
        let next: MosaicNode<ViewId>;
        if (!prev) next = id;
        else next = addToLastLeaf(prev, id);
        if (currentWs) debounceSaveLayout(currentWs, JSON.stringify(next));
        return next;
      });
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("tile-open-file", {
            detail: { tileId: id, path: detail.path },
          }),
        );
      }, 100);
    };
    window.addEventListener("create-editor-tile", handler);
    return () => window.removeEventListener("create-editor-tile", handler);
  }, []);

  // ── Render tile ───────────────────────────────────────────────────────────
  const renderTile = useCallback(
    (viewId: ViewId, path: MosaicBranch[]) => {
      const entry = tileRegistry.get(viewId);
      const tileType: TileType =
        entry?.meta.type ??
        (viewId.startsWith("terminal") ? "terminal" : "editor");

      if (!entry) registerTile(viewId, tileType);

      // Drop target for this tile
      const DropTarget = ({ children }: { children: React.ReactNode }) => {
        const [{ isOver }, drop] = useDrop({
          accept: "FILE_TAB",
          drop: (item: {
            path: string;
            language: string;
            sourceTileId: string;
          }) => {
            if (item.sourceTileId === viewId) return; // same tile, ignore
            const handler = dropHandlersRef.current.get(viewId);
            if (handler) handler(item.path);
            // Close the tab in the source tile
            window.dispatchEvent(
              new CustomEvent("editor-close-tab", {
                detail: { path: item.path },
              }),
            );
          },
          collect: (monitor) => ({ isOver: monitor.isOver() }),
        });
        return (
          <div
            ref={drop}
            className="h-full"
            style={
              isOver
                ? {
                    outline: "2px dashed var(--color-primary)",
                    outlineOffset: "-2px",
                  }
                : undefined
            }
          >
            {children}
          </div>
        );
      };

      const tileContent =
        tileType === "editor" ? (
          <EditorTile
            tileId={viewId}
            workspaceRoot={workspaceRoot}
            onRemove={() => removeTile(viewId)}
            wordWrap={wordWrap}
            onFocus={() => lastActiveTile.set("editor", viewId)}
            onRegisterDrop={registerDrop}
            onUnregisterDrop={unregisterDrop}
          />
        ) : tileType === "terminal" ? (
          <TerminalTile
            tileId={viewId}
            workspaceRoot={workspaceRoot}
            onRemove={() => removeTile(viewId)}
            onFocus={() => lastActiveTile.set("terminal", viewId)}
            onRegisterDrop={registerDrop}
            onUnregisterDrop={unregisterDrop}
          />
        ) : (
          <ChatTile
            tileId={viewId}
            workspaceRoot={workspaceRoot}
            agentConfig={agentConfig}
            onRemove={() => removeTile(viewId)}
            onFocus={() => lastActiveTile.set("chat", viewId)}
          />
        );

      // Wrap in MosaicWindow for drag-and-drop tile rearrangement.
      // renderToolbar returns a thin invisible strip — the drag handle.
      // path.length > 0 check prevents dragging the root tile.
      const isDraggable = path.length > 0;

      return (
        <MosaicWindow<ViewId>
          title={viewId}
          path={path}
          draggable={isDraggable}
          renderToolbar={(_props, _draggable) => (
            <div className="mosaic-drag-strip" />
          )}
          className="murder-mosaic-window"
        >
          <DropTarget>{tileContent}</DropTarget>
        </MosaicWindow>
      );
    },
    [workspaceRoot, agentConfig, removeTile, wordWrap, registerDrop, unregisterDrop],
  );

  // ── Persist layout changes ────────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceRoot || !layout) return;
    debounceSaveLayout(workspaceRoot, JSON.stringify(layout));
  }, [layout, workspaceRoot]);

  return (
    <div className="w-full h-full">
      {layout ? (
        <Mosaic<ViewId>
          value={layout}
          onChange={(newLayout) => {
            if (newLayout !== null) setLayout(newLayout);
          }}
          renderTile={renderTile}
          className="murder-mosaic-theme"
          resize={{ minimumPaneSizePercentage: 10 }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
          <div className="text-5xl">◆</div>
          <div className="text-lg font-light">Murder IDE</div>
          <div className="text-xs">
            Open a file from the explorer or press Ctrl+P
          </div>
        </div>
      )}
    </div>
  );
}

// ── Utility: add a new tile by splitting the last leaf ─────────────────────────
function addToLastLeaf(
  node: MosaicNode<ViewId>,
  newTile: ViewId,
): MosaicNode<ViewId> {
  if (typeof node === "string" || !node) {
    return { first: node, second: newTile, direction: "row" };
  }
  const { first, second, direction } = node;
  if (typeof second !== "string" && second) {
    return { first, second: addToLastLeaf(second, newTile), direction };
  }
  return {
    first,
    second: {
      first: second,
      second: newTile,
      direction: direction === "row" ? "column" : "row",
    },
    direction,
  };
}
