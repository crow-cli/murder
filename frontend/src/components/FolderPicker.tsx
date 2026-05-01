import { useState, useEffect, useCallback, useRef } from "react";
import { ws } from "../lib/ws-client";
import { FileIcon } from "../lib/file-icons";

interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface FolderPickerProps {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

const HOME_PATH = "/home";

const QUICK_PICKS = [
  { label: "~", path: HOME_PATH },
  { label: "/", path: "/" },
  { label: "/tmp", path: "/tmp" },
];

const COLORS = {
  overlay: "rgba(0,0,0,0.7)",
  bg: "#1a1230",
  bgDark: "#14101f",
  border: "#2d2350",
  borderLight: "#3a2d60",
  text: "#d4c4ff",
  textMuted: "#8b7bb5",
  textDim: "#5a4d80",
  hover: "#2d2350",
  accent: "#4ade80",
  accentBg: "#4ade8022",
  inputBg: "#2d2350",
  danger: "#f87171",
};

export function FolderPicker({
  initialPath,
  onSelect,
  onClose,
}: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || HOME_PATH);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await ws.invoke<{ entries: DirEntry[] }>("read_dir", {
        path,
      });
      const sorted = [...result.entries].sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
      setCurrentPath(path);
    } catch (e: any) {
      setError(`Cannot read directory: ${e.message || e}`);
      setEntries([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDir(initialPath || HOME_PATH);
  }, [initialPath, loadDir]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const navigateTo = (path: string) => {
    loadDir(path);
  };

  const navigateUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const parent = "/" + parts.join("/");
    loadDir(parent === "/" ? "/" : parent);
  };

  const handlePathInput = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLInputElement;
      loadDir(target.value);
    }
  };

  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: COLORS.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.bg,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          width: 520,
          maxHeight: 480,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          color: COLORS.text,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>Open Folder</span>
          <button
            onClick={onClose}
            style={{
              fontSize: 18,
              color: COLORS.textMuted,
              background: "none",
              border: "none",
              cursor: "pointer",
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {/* Quick picks */}
        <div
          style={{
            padding: "8px 16px",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          {QUICK_PICKS.map((qp) => (
            <button
              key={qp.path}
              onClick={() => navigateTo(qp.path)}
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 3,
                border: `1px solid ${COLORS.border}`,
                background:
                  currentPath === qp.path ? COLORS.accentBg : COLORS.hover,
                color:
                  currentPath === qp.path ? COLORS.accent : COLORS.textMuted,
                cursor: "pointer",
              }}
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Path input */}
        <div
          style={{
            padding: "8px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            onClick={navigateUp}
            disabled={currentPath === "/"}
            style={{
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 3,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.hover,
              color: currentPath === "/" ? COLORS.textDim : COLORS.text,
              cursor: currentPath === "/" ? "default" : "pointer",
              opacity: currentPath === "/" ? 0.5 : 1,
            }}
          >
            ↑
          </button>
          <input
            ref={inputRef}
            value={currentPath}
            onChange={(e) => setCurrentPath(e.target.value)}
            onKeyDown={handlePathInput}
            style={{
              flex: 1,
              padding: "4px 8px",
              fontSize: 12,
              background: COLORS.inputBg,
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: 3,
              color: COLORS.text,
              outline: "none",
            }}
          />
        </div>

        {/* Breadcrumb */}
        <div
          style={{
            padding: "6px 16px",
            fontSize: 11,
            color: COLORS.textDim,
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span
            style={{ cursor: "pointer" }}
            onClick={() => navigateTo("/")}
            onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.textDim)}
          >
            /
          </span>
          {pathParts.map((part, i) => (
            <span key={i}>
              <span style={{ color: COLORS.border }}>/</span>
              <span
                style={{ cursor: "pointer" }}
                onClick={() =>
                  navigateTo("/" + pathParts.slice(0, i + 1).join("/"))
                }
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = COLORS.accent)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = COLORS.textDim)
                }
              >
                {part}
              </span>
            </span>
          ))}
        </div>

        {/* File list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 0",
            minHeight: 200,
            maxHeight: 260,
          }}
        >
          {loading && (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                color: COLORS.textMuted,
              }}
            >
              Loading...
            </div>
          )}
          {error && (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                color: COLORS.danger,
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                color: COLORS.textMuted,
                fontSize: 12,
              }}
            >
              Empty directory
            </div>
          )}
          {entries.map((entry) => (
            <div
              key={entry.path}
              onClick={() => {
                if (entry.is_dir) {
                  navigateTo(entry.path);
                }
              }}
              style={{
                padding: "4px 16px",
                fontSize: 13,
                cursor: entry.is_dir ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: entry.is_dir ? COLORS.text : COLORS.textMuted,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = COLORS.hover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <FileIcon name={entry.name} isDir={entry.is_dir} size={14} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.name}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "6px 16px",
              fontSize: 12,
              borderRadius: 4,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.hover,
              color: COLORS.textMuted,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(currentPath)}
            style={{
              padding: "6px 16px",
              fontSize: 12,
              borderRadius: 4,
              border: "none",
              background: COLORS.accent,
              color: "#0d1f17",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Select This Folder
          </button>
        </div>
      </div>
    </div>
  );
}
