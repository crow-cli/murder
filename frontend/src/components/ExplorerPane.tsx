import { useState, useEffect } from "react";
import { ws } from "../lib/ws-client";
import { FileIcon } from "../lib/file-icons";

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

  useEffect(() => {
    loadDir(root);
  }, [root]);

  const sortEntries = (items: FileEntry[]): FileEntry[] => {
    return [...items].sort((a, b) => {
      // Directories first
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      // Case-insensitive alphabetical
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
      if (!childCache.has(path)) {
        try {
          const result = await ws.invoke<{ entries: FileEntry[] }>("read_dir", {
            path,
          });
          setChildCache((prev) => new Map(prev).set(path, sortEntries(result.entries)));
        } catch (e) {
          console.error("Failed to expand:", e);
        }
      }
    }
  };

  const renderEntries = (items: FileEntry[], depth = 0) => {
    return items.map((entry) => (
      <div key={entry.path}>
        <div
          onClick={() =>
            entry.is_dir
              ? toggleDir(entry.path)
              : onFileClick(entry.path, false)
          }
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
        </div>
        {entry.is_dir &&
          expandedDirs.has(entry.path) &&
          childCache.has(entry.path) && (
            <div>{renderEntries(childCache.get(entry.path)!, depth + 1)}</div>
          )}
      </div>
    ));
  };

  return (
    <div style={{ flex: 1, overflow: "auto", background: COLORS.bg }}>
      {renderEntries(entries)}
    </div>
  );
}
