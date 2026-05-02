import { useEffect, useRef, useState, useCallback } from "react";

interface MenuItem {
  label?: string;
  action?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

const COLORS = {
  bg: "#1e1640",
  hover: "#2d2350",
  text: "#d4c4ff",
  textMuted: "#8b7bb5",
  danger: "#f87171",
  border: "#2d2350",
};

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  // Adjust position if menu would overflow viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const overflowX = x + rect.width - window.innerWidth;
    const overflowY = y + rect.height - window.innerHeight;
    setPosition({
      x: overflowX > 0 ? x - overflowX : x,
      y: overflowY > 0 ? y - overflowY : y,
    });
  }, [x, y]);

  // Close on outside click or escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Use capture phase so we catch events before Monaco/editor handlers
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        minWidth: 180,
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6,
        padding: "4px 0",
        zIndex: 10000,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        fontSize: 13,
      }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div
            key={i}
            style={{
              height: 1,
              background: COLORS.border,
              margin: "4px 8px",
            }}
          />
        ) : (
          <div
            key={i}
            onClick={() => {
              if (!item.disabled && item.action) {
                item.action();
                onClose();
              }
            }}
            style={{
              padding: "4px 12px",
              cursor: item.disabled || !item.action ? "default" : "pointer",
              color: item.danger
                ? COLORS.danger
                : item.disabled
                  ? COLORS.textMuted
                  : COLORS.text,
              opacity: item.disabled ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              if (!item.disabled && item.action) {
                e.currentTarget.style.background = COLORS.hover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span>{item.label ?? ""}</span>
          </div>
        ),
      )}
    </div>
  );
}
