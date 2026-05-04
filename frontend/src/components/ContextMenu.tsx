import { useEffect, useRef, useState } from "react";
import { Separator } from "./ui/separator";

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

export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
      className="fixed min-w-[180px] bg-[var(--color-card)] border border-[var(--color-border)] z-[10000] text-[13px]"
      style={{
        left: position.x,
        top: position.y,
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <div className="py-1">
        {items.map((item, i) =>
          item.separator ? (
            <Separator key={i} className="my-1 mx-2" />
          ) : (
            <div
              key={i}
              className="select-none flex items-center justify-between transition-colors"
              style={{
                padding: "5px 16px",
                cursor: item.disabled || !item.action ? "default" : "pointer",
                color: item.danger
                  ? "var(--color-destructive)"
                  : item.disabled
                    ? "var(--color-muted-foreground)"
                    : "var(--color-foreground)",
                opacity: item.disabled ? 0.5 : 1,
              }}
              onClick={() => {
                if (!item.disabled && item.action) {
                  item.action();
                  onClose();
                }
              }}
              onMouseEnter={(e) => {
                if (!item.disabled && item.action) {
                  e.currentTarget.style.background = "var(--color-border)";
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
    </div>
  );
}
