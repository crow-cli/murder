import { FileIcon } from "../lib/file-icons";

export interface OpenFile {
  path: string;
  language: string;
}

interface TabBarProps {
  openFiles: OpenFile[];
  activePath: string | null;
  dirtyFiles: Set<string>;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
}

const COLORS = {
  bg: "#14101f",
  bgActive: "#1e1640",
  border: "#2d2350",
  text: "#d4c4ff",
  textInactive: "#5a4d80",
  textDim: "#3a2d60",
  accent: "#4ade80",
  danger: "#f87171",
  hover: "#2d2350",
};

export function TabBar({
  openFiles,
  activePath,
  dirtyFiles,
  onTabClick,
  onTabClose,
}: TabBarProps) {
  if (openFiles.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        background: COLORS.bg,
        borderBottom: `1px solid ${COLORS.border}`,
        overflowX: "auto",
        flexShrink: 0,
        height: 35,
      }}
    >
      {openFiles.map((file) => {
        const isActive = file.path === activePath;
        const isDirty = dirtyFiles.has(file.path);
        const fileName = file.path.split("/").pop() || file.path;

        return (
          <div
            key={file.path}
            onClick={() => onTabClick(file.path)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 12px",
              fontSize: 13,
              cursor: "pointer",
              userSelect: "none",
              background: isActive ? COLORS.bgActive : "transparent",
              color: isActive ? COLORS.text : COLORS.textInactive,
              borderRight: `1px solid ${COLORS.border}`,
              minWidth: 0,
              position: "relative",
            }}
          >
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: COLORS.accent,
                }}
              />
            )}
            <FileIcon name={fileName} size={12} />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 150,
              }}
            >
              {fileName}
            </span>
            {isDirty && (
              <span style={{ fontSize: 10, color: COLORS.accent }}>●</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(file.path);
              }}
              style={{
                marginLeft: "auto",
                padding: "0 4px",
                fontSize: 16,
                lineHeight: 1,
                color: isActive ? COLORS.textDim : "transparent",
                background: "none",
                border: "none",
                cursor: "pointer",
                borderRadius: 3,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLORS.danger;
                e.currentTarget.style.background = COLORS.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isActive
                  ? COLORS.textDim
                  : "transparent";
                e.currentTarget.style.background = "none";
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
