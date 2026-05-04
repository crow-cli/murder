/** Mosaic layout with typed tiles — each tile is a tabbed container */
import { useState, useCallback, useEffect, useRef } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Mosaic,
  MosaicNode,
  MosaicWindow,
  MosaicBranch,
} from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";
import EditorPane, { setModelContent } from "./EditorPane";
import TerminalPane from "./TerminalPane";
import { ws } from "../lib/ws-client";
import {
  setGlobalOpenFile,
  setGlobalOpenTerminal,
  setGetLayout,
} from "../lib/workspace-context";
import { FileIcon } from "../lib/file-icons";

// ── Tile metadata registry ───────────────────────────────────────────────────
export type TileType = "editor" | "terminal";

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

/** Registry: viewId → tile metadata + per-tile state */
const tileRegistry = new Map<
  ViewId,
  {
    meta: TileMeta;
    editorState?: EditorTileState;
    terminalState?: TerminalTileState;
    pendingFiles?: string[]; // files to open once tile mounts
  }
>();

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
    terminalState: type === "terminal" ? { terminals: [], activeIndex: -1 } : undefined,
    pendingFiles: [],
  });
}

export function unregisterTile(id: ViewId) {
  tileRegistry.delete(id);
}

export function getEditorState(id: ViewId): EditorTileState | null {
  return tileRegistry.get(id)?.editorState ?? null;
}

export function getTerminalState(id: ViewId): TerminalTileState | null {
  return tileRegistry.get(id)?.terminalState ?? null;
}

// ── EditorTile: tabbed file container ─────────────────────────────────────────
interface EditorTileProps {
  tileId: ViewId;
  workspaceRoot: string | null;
  onFileClick?: (path: string) => void;
}

function EditorTile({
  tileId,
  workspaceRoot: _wr,
  onFileClick,
}: EditorTileProps) {
  const [files, setFiles] = useState<{ path: string; language: string }[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    registerTile(tileId, "editor");

    // Check for pending files (set by openFileInTile before tile was mounted)
    const entry = tileRegistry.get(tileId);
    if (entry?.pendingFiles && entry.pendingFiles.length > 0) {
      const pending = [...entry.pendingFiles];
      entry.pendingFiles = [];
      // Open pending files after initial render
      requestAnimationFrame(() => {
        for (const path of pending) openFile(path);
      });
    }

    return () => unregisterTile(tileId);
  }, [tileId, openFile]);

  useEffect(() => {
    const entry = tileRegistry.get(tileId);
    if (entry?.editorState) {
      entry.editorState.files = files;
      entry.editorState.activeIndex = activeIndex;
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

  const closeFile = useCallback((path: string) => {
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.path === path);
      const next = prev.filter((f) => f.path !== path);
      setActiveIndex((ai) => {
        if (next.length === 0) return -1;
        if (ai === idx) return Math.max(0, next.length - 1);
        if (ai > idx) return ai - 1;
        return ai;
      });
      return next;
    });
  }, []);

  // Listen for tile-open-file events
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

  const activeFile = activeIndex >= 0 ? files[activeIndex] : null;

  return (
    <div className="flex flex-col h-full bg-[var(--color-background-dark)]">
      {files.length > 0 && (
        <div className="flex bg-[var(--color-background)] border-b border-[var(--color-border)] overflow-x-auto shrink-0 h-[35px]">
          {files.map((file, idx) => {
            const isActive = idx === activeIndex;
            return (
              <div
                key={file.path}
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
          })}
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
          />
        )}
      </div>
    </div>
  );
}

// ── TerminalTile: tabbed terminal container ───────────────────────────────────
interface TerminalTileProps {
  tileId: ViewId;
  workspaceRoot: string | null;
}

function TerminalTile({ tileId, workspaceRoot }: TerminalTileProps) {
  const [terminals, setTerminals] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const termCounterRef = useRef(0);

  useEffect(() => {
    registerTile(tileId, "terminal");
    return () => unregisterTile(tileId);
  }, [tileId]);

  useEffect(() => {
    const entry = tileRegistry.get(tileId);
    if (entry?.terminalState) {
      entry.terminalState.terminals = terminals;
      entry.terminalState.activeIndex = activeIndex;
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
      setActiveIndex((ai) => {
        if (next.length === 0) return -1;
        if (ai === idx) return Math.max(0, next.length - 1);
        if (ai > idx) return ai - 1;
        return ai;
      });
      return next;
    });
  }, []);

  // Listen for tile-add-terminal events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tileId: string };
      if (detail.tileId === tileId) addTerminal();
    };
    window.addEventListener("tile-add-terminal", handler);
    return () => window.removeEventListener("tile-add-terminal", handler);
  }, [tileId, addTerminal]);

  // Auto-create first terminal on mount
  useEffect(() => {
    if (terminals.length === 0) addTerminal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTerm = activeIndex >= 0 ? terminals[activeIndex] : null;

  return (
    <div className="flex flex-col h-full bg-[var(--color-background-dark)]">
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
              >
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-[var(--color-primary)]" />
                )}
                <span className="text-xs">⌨</span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]">
                  Terminal {idx + 1}
                </span>
                {terminals.length > 1 && (
                  <button
                    className="ml-auto h-5 w-5 p-0 rounded-sm text-[var(--color-active)] hover:text-[var(--color-destructive)] hover:bg-[var(--color-border)] flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTerminal(termId);
                    }}
                  >
                    ×
                  </button>
                )}
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
        {activeTerm && workspaceRoot ? (
          <TerminalPane workspaceRoot={workspaceRoot} />
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--color-foreground-dim)] text-sm">
            {workspaceRoot
              ? "No terminal"
              : "Open a folder to use the terminal"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MosaicLayout ──────────────────────────────────────────────────────────────
interface MosaicLayoutProps {
  workspaceRoot: string | null;
}

export default function MosaicLayout({ workspaceRoot }: MosaicLayoutProps) {
  const [layout, setLayout] = useState<MosaicNode<ViewId> | null>(null);

  useEffect(() => {
    setGetLayout(() => layout);
  }, [layout]);

  // ── Global handlers ───────────────────────────────────────────────────────
  const openFileInTile = useCallback(async (path: string) => {
    const language = getLanguage(path);
    const content = await ws.invoke<{ content: string }>("read_file", { path }).catch(() => ({ content: "" }));
    setModelContent(path, content.content, language);

    // Find first existing editor tile
    for (const [id, entry] of tileRegistry) {
      if (entry.meta.type === "editor") {
        // Check if already open in this tile
        const state = entry.editorState;
        if (state && state.files.some((f) => f.path === path)) {
          // Already open — just switch to it
          state.activeIndex = state.files.findIndex((f) => f.path === path);
          return;
        }
        // Dispatch event to the existing tile
        window.dispatchEvent(new CustomEvent("tile-open-file", { detail: { tileId: id, path } }));
        return;
      }
    }
    // No editor tile — create one, store path in pendingFiles
    const id = uid("editor");
    registerTile(id, "editor");
    const entry = tileRegistry.get(id);
    if (entry?.pendingFiles) entry.pendingFiles.push(path);
    setLayout((prev) => {
      if (!prev) return id;
      return addToLastLeaf(prev, id);
    });
  }, []);

  const openTerminalInTile = useCallback(() => {
    // Find first terminal tile
    for (const [id, entry] of tileRegistry) {
      if (entry.meta.type === "terminal") {
        window.dispatchEvent(
          new CustomEvent("tile-add-terminal", { detail: { tileId: id } }),
        );
        return;
      }
    }
    // No terminal tile — create one
    const id = uid("terminal");
    registerTile(id, "terminal");
    setLayout((prev) => {
      if (!prev) return id;
      return addToLastLeaf(prev, id);
    });
  }, []);

  useEffect(() => {
    setGlobalOpenFile(openFileInTile);
    setGlobalOpenTerminal(openTerminalInTile);
  }, [openFileInTile, openTerminalInTile]);

  // Listen for create-editor-tile events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        path: string;
        language: string;
      };
      const id = uid("editor");
      registerTile(id, "editor");
      setLayout((prev) => {
        if (!prev) return id;
        return addToLastLeaf(prev, id);
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
      if (!entry) {
        const type: TileType = viewId.startsWith("terminal")
          ? "terminal"
          : "editor";
        registerTile(viewId, type);
        return (
          <MosaicWindow<ViewId>
            path={path}
            title=""
            toolbarControls={null}
            className="bg-[var(--color-background-dark)]"
          >
            {type === "editor" ? (
              <EditorTile tileId={viewId} workspaceRoot={workspaceRoot} />
            ) : (
              <TerminalTile tileId={viewId} workspaceRoot={workspaceRoot} />
            )}
          </MosaicWindow>
        );
      }

      return (
        <MosaicWindow<ViewId>
          path={path}
          title=""
          toolbarControls={null}
          className="bg-[var(--color-background-dark)]"
        >
          {entry.meta.type === "editor" ? (
            <EditorTile tileId={viewId} workspaceRoot={workspaceRoot} />
          ) : (
            <TerminalTile tileId={viewId} workspaceRoot={workspaceRoot} />
          )}
        </MosaicWindow>
      );
    },
    [workspaceRoot],
  );

  return (
    <DndProvider backend={HTML5Backend}>
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
    </DndProvider>
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
