import { useState, useEffect, useRef, useCallback } from "react";
import { ws } from "../lib/ws-client";
import { FileIcon } from "../lib/file-icons";
import ContextMenu from "./ContextMenu";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface ExplorerPaneProps {
  root: string;
  onFileClick: (path: string, isDir: boolean) => void;
}

const COLORS = {
  bg: "#14101f",
  hover: "#2d2350",
  active: "#3a2d60",
  text: "#d4c4ff",
  textMuted: "#8b7bb5",
  textDim: "#5a4d80",
  border: "#2d2350",
};

export default function ExplorerPane({ root, onFileClick }: ExplorerPaneProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [childCache, setChildCache] = useState<Map<string, FileEntry[]>>(
    new Map(),
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetPath: string;
    targetIsDir: boolean;
  } | null>(null);

  // Inline rename state
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Inline create (new file/folder) state
  const [creatingParentPath, setCreatingParentPath] = useState<string | null>(null);
  const [creatingName, setCreatingName] = useState("");
  const [creatingIsDir, setCreatingIsDir] = useState(false);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState("");

  // Listen for worktree file change events to refresh explorer
  useEffect(() => {
    const handleWorktreeEvent = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (
          msg.method === "worktree-file-changed" ||
          msg.method === "worktree-file-deleted" ||
          msg.method === "worktree-file-created"
        ) {
          // Invalidate child cache for parent dirs and reload root
          setChildCache(new Map());
          loadDir(root);
        }
      } catch {
        // Not JSON, ignore
      }
    };
    ws.onMessage(handleWorktreeEvent);
    return () => ws.offMessage(handleWorktreeEvent);
  }, [root]);

  useEffect(() => {
    loadDir(root);
  }, [root]);

  const sortEntries = (items: FileEntry[]): FileEntry[] => {
    return [...items].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  };

  const loadDir = async (path: string) => {
    try {
      const result = await ws.invoke<{ entries: FileEntry[] }>("read_dir", {
        path,
      });
      setEntries(sortEntries(result.entries));
    } catch (e) {
      console.error("Failed to read dir:", e);
    }
  };

  const loadChildren = async (path: string): Promise<FileEntry[]> => {
    if (childCache.has(path)) {
      return childCache.get(path)!;
    }
    try {
      const result = await ws.invoke<{ entries: FileEntry[] }>("read_dir", {
        path,
      });
      const sorted = sortEntries(result.entries);
      setChildCache((prev) => new Map(prev).set(path, sorted));
      return sorted;
    } catch (e) {
      console.error("Failed to expand:", e);
      return [];
    }
  };

  const toggleDir = async (path: string) => {
    const isExpanded = expandedDirs.has(path);
    if (isExpanded) {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    } else {
      setExpandedDirs((prev) => new Set(prev).add(path));
      loadChildren(path);
    }
  };

  // ── Context menu handlers ──────────────────────────────────────────────

  const handleContextMenu = (
    e: React.MouseEvent,
    path: string,
    isDir: boolean,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, targetPath: path, targetIsDir: isDir });
  };

  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetPath: root,
      targetIsDir: true,
    });
  };

  const handleNewFile = () => {
    if (!contextMenu) return;
    const parentPath = contextMenu.targetIsDir
      ? contextMenu.targetPath
      : contextMenu.targetPath.replace(/\/[^/]+$/, "");
    setCreatingParentPath(parentPath);
    setCreatingName("");
    setCreatingIsDir(false);
    setContextMenu(null);
  };

  const handleNewFolder = () => {
    if (!contextMenu) return;
    const parentPath = contextMenu.targetIsDir
      ? contextMenu.targetPath
      : contextMenu.targetPath.replace(/\/[^/]+$/, "");
    setCreatingParentPath(parentPath);
    setCreatingName("");
    setCreatingIsDir(true);
    setContextMenu(null);
  };

  const handleCreateSubmit = async () => {
    if (!creatingParentPath || !creatingName.trim()) {
      setCreatingParentPath(null);
      return;
    }
    const name = creatingName.trim();
    const parentPath = creatingParentPath;
    const isDir = creatingIsDir;
    const newPath = `${parentPath}/${name}`;

    setCreatingParentPath(null);
    setCreatingName("");

    try {
      if (isDir) {
        await ws.invoke("create_dir", { path: newPath });
      } else {
        await ws.invoke("create_file", { path: newPath, content: "" });
      }
      // Expand the parent dir so we can see the new entry
      setExpandedDirs((prev) => new Set(prev).add(parentPath));
      setChildCache((prev) => {
        const next = new Map(prev);
        next.delete(parentPath);
        return next;
      });
      loadChildren(parentPath);
      setChildCache(new Map());
      loadDir(root);
    } catch (e: any) {
      alert(`Failed to create ${isDir ? "folder" : "file"}: ${e.message || e}`);
    }
  };

  const handleCreateCancel = () => {
    setCreatingParentPath(null);
    setCreatingName("");
  };

  const handleRename = () => {
    if (!contextMenu) return;
    const name = contextMenu.targetPath.split("/").pop() || "";
    setEditingPath(contextMenu.targetPath);
    setEditingName(name);
    setContextMenu(null);
  };

  const handleRenameSubmit = async () => {
    if (!editingPath || !editingName.trim()) {
      setEditingPath(null);
      return;
    }
    const parent = editingPath.replace(/\/[^/]+$/, "");
    const newPath = `${parent}/${editingName.trim()}`;
    if (newPath === editingPath) {
      setEditingPath(null);
      return;
    }
    try {
      await ws.invoke("rename", { from: editingPath, to: newPath });
      setChildCache(new Map());
      loadDir(root);
    } catch (e: any) {
      alert(`Failed to rename: ${e.message || e}`);
    } finally {
      setEditingPath(null);
    }
  };

  const handleRenameCancel = () => {
    setEditingPath(null);
  };

  const handleDelete = () => {
    if (!contextMenu) return;
    const name = contextMenu.targetPath.split("/").pop() || "";
    setDeletingPath(contextMenu.targetPath);
    setDeletingName(name);
    setContextMenu(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPath) return;
    const path = deletingPath;
    const isDir = deletingName.includes(".") ? false : true; // rough heuristic
    setDeletingPath(null);
    setDeletingName("");
    try {
      await ws.invoke("remove", { path });
      if (isDir && expandedDirs.has(path)) {
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
      setChildCache(new Map());
      loadDir(root);
    } catch (e: any) {
      alert(`Failed to delete: ${e.message || e}`);
    }
  };

  const handleDeleteCancel = () => {
    setDeletingPath(null);
    setDeletingName("");
  };

  const handleCopyPath = async () => {
    if (!contextMenu) return;
    try {
      await navigator.clipboard.writeText(contextMenu.targetPath);
    } catch {
      // Fallback
    }
  };

  const handleCopyRelativePath = async () => {
    if (!contextMenu) return;
    const rel = contextMenu.targetPath.replace(root + "/", "");
    try {
      await navigator.clipboard.writeText(rel);
    } catch {
      // Fallback
    }
  };

  const handleRevealInSidebar = () => {
    if (!contextMenu) return;
    // Ensure all parent dirs are expanded
    const parts = contextMenu.targetPath.replace(root + "/", "").split("/");
    let current = root;
    const toExpand: string[] = [];
    for (const part of parts) {
      current = `${current}/${part}`;
      toExpand.push(current);
    }
    // Remove the last one (the target itself)
    toExpand.pop();
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      for (const p of toExpand) next.add(p);
      return next;
    });
    // Load children for all expanded dirs
    for (const p of toExpand) {
      loadChildren(p);
    }
  };

  // Focus rename input when editing starts
  useEffect(() => {
    if (editingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingPath]);

  // Focus create input when creating starts
  useEffect(() => {
    if (creatingParentPath && createInputRef.current) {
      createInputRef.current.focus();
      createInputRef.current.select();
    }
  }, [creatingParentPath]);

  // ── Rendering ──────────────────────────────────────────────────────────

  /** Render the inline create input as a tree item */
  const renderCreateInput = (depth: number, key: string): JSX.Element => (
    <div
      key={key}
      style={{
        paddingLeft: 8 + depth * 16,
        paddingRight: 8,
        paddingTop: 1,
        paddingBottom: 1,
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 13,
        borderRadius: 3,
        color: COLORS.text,
        height: 22,
        background: COLORS.hover,
      }}
    >
      <span style={{ width: 16, textAlign: "center", fontSize: 10, color: COLORS.textDim, flexShrink: 0 }}>
        {creatingIsDir ? "" : "📄"}
      </span>
      <input
        ref={createInputRef}
        value={creatingName}
        onChange={(e) => setCreatingName(e.target.value)}
        onBlur={handleCreateSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreateSubmit();
          if (e.key === "Escape") handleCreateCancel();
        }}
        onClick={(e) => e.stopPropagation()}
        placeholder={creatingIsDir ? "New folder name" : "New file name"}
        style={{
          flex: 1,
          background: COLORS.bg,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 2,
          color: COLORS.text,
          fontSize: 13,
          padding: "0 4px",
          outline: "none",
          height: 18,
        }}
      />
    </div>
  );

  /** Render entries for a given parent path, with create input injected */
  const renderEntries = (parentPath: string, children: FileEntry[], depth: number): JSX.Element[] => {
    const items: JSX.Element[] = [];
    for (const child of children) {
      items.push(renderItem(child, depth));
      // If this child is the parent we're creating under, insert the create input after it
      if (creatingParentPath === child.path && child.is_dir && expandedDirs.has(child.path)) {
        items.push(renderCreateInput(depth + 1, `create-${child.path}`));
      }
    }
    // If creating at root level
    if (creatingParentPath === parentPath && depth === 0) {
      items.push(renderCreateInput(depth, `create-${parentPath}`));
    }
    return items;
  };

  const renderItem = (entry: FileEntry, depth: number): JSX.Element => {
    const isEditing = editingPath === entry.path;

    return (
      <div key={entry.path}>
        <div
          onClick={() =>
            entry.is_dir
              ? toggleDir(entry.path)
              : onFileClick(entry.path, false)
          }
          onContextMenu={(e) => handleContextMenu(e, entry.path, entry.is_dir)}
          style={{
            paddingLeft: 8 + depth * 16,
            paddingRight: 8,
            paddingTop: 1,
            paddingBottom: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            borderRadius: 3,
            color: COLORS.text,
            height: 22,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = COLORS.hover)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <span
            style={{
              width: 16,
              textAlign: "center",
              fontSize: 10,
              color: COLORS.textDim,
              flexShrink: 0,
            }}
          >
            {entry.is_dir ? (expandedDirs.has(entry.path) ? "▾" : "▸") : "  "}
          </span>
          <FileIcon name={entry.name} isDir={entry.is_dir} size={14} />
          {isEditing ? (
            <input
              ref={renameInputRef}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") handleRenameCancel();
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 2,
                color: COLORS.text,
                fontSize: 13,
                padding: "0 4px",
                outline: "none",
                height: 18,
              }}
            />
          ) : (
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {entry.name}
            </span>
          )}
        </div>
        {entry.is_dir &&
          expandedDirs.has(entry.path) &&
          childCache.has(entry.path) && (
            <div>
              {renderEntries(entry.path, childCache.get(entry.path)!, depth + 1)}
            </div>
          )}
      </div>
    );
  };

  const contextMenuItems = contextMenu
    ? (() => {
        const isRoot = contextMenu.targetPath === root;
        return [
          { label: "New File...", action: handleNewFile },
          { label: "New Folder...", action: handleNewFolder },
          { separator: true } as const,
          ...(isRoot
            ? []
            : [
                { label: "Reveal in Sidebar", action: handleRevealInSidebar },
                { label: "Rename...", action: handleRename },
                { label: "Delete", action: handleDelete, danger: true },
                { separator: true } as const,
                { label: "Copy Path", action: handleCopyPath },
                { label: "Copy Relative Path", action: handleCopyRelativePath },
              ]),
        ];
      })()
    : [];

  return (
    <div
      style={{ height: "100%", overflow: "auto", background: COLORS.bg, position: "relative" }}
      onContextMenu={handleRootContextMenu}
    >
      {renderEntries(root, entries, 0)}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
      {deletingPath && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "6px 8px",
            background: "rgba(248,113,113,0.15)",
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: COLORS.text,
            zIndex: 10,
          }}
        >
          <span style={{ color: "var(--red)", fontWeight: 600 }}>⚠ Delete</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            "{deletingName}"
          </span>
          <button
            onClick={handleDeleteCancel}
            style={{
              padding: "2px 10px",
              fontSize: 11,
              borderRadius: 3,
              border: `1px solid ${COLORS.border}`,
              background: "transparent",
              color: COLORS.textMuted,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteConfirm}
            style={{
              padding: "2px 10px",
              fontSize: 11,
              borderRadius: 3,
              border: "1px solid var(--red)",
              background: "rgba(248,113,113,0.2)",
              color: "var(--red)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
