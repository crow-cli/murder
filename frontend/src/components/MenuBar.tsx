import { useEffect, useRef, useState } from "react";

export interface MenuAction {
  label: string;
  action: string;
  shortcut?: string;
  separator?: boolean;
  enabled?: boolean;
}

export interface MenuGroup {
  label: string;
  items: (MenuAction | { separator: true; label?: string; action?: string })[];
}

interface MenuBarProps {
  items: MenuGroup[];
  onAction: (action: string) => void;
  onOpenChange: (menu: string | null) => void;
}

export function MenuBar({ items, onAction, onOpenChange }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        onOpenChange(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onOpenChange]);

  const handleMenuClick = (label: string) => {
    const isOpen = openMenu === label;
    setOpenMenu(isOpen ? null : label);
    onOpenChange(isOpen ? null : label);
  };

  const handleAction = (action: string) => {
    setOpenMenu(null);
    onOpenChange(null);
    onAction(action);
  };

  return (
    <div
      ref={menuRef}
      className="h-[30px] bg-[var(--color-background-dark)] flex items-center px-2 border-b border-[var(--color-border)] shrink-0 relative z-[100] gap-1"
    >
      {items.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            className="px-[10px] py-1 text-[13px] bg-transparent border-none cursor-pointer text-[var(--color-muted-foreground)] font-normal transition-colors"
            style={{
              borderRadius: 3,
              background: openMenu === menu.label ? "var(--color-border)" : "transparent",
            }}
            onClick={() => handleMenuClick(menu.label)}
            onMouseEnter={() => {
              if (openMenu && openMenu !== menu.label) {
                setOpenMenu(menu.label);
                onOpenChange(menu.label);
              }
            }}
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 min-w-[200px] bg-[var(--color-background)] border border-[var(--color-border)] py-1 z-[200]"
              style={{
                borderRadius: 4,
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              {menu.items.map((item, i) =>
                item.separator ? (
                  <div key={i} className="h-[1px] bg-[var(--color-border)] my-1 mx-2" />
                ) : (
                  <button
                    key={item.label}
                    className="flex items-center justify-between w-full text-left box-border text-[13px] text-[var(--color-foreground)] bg-transparent border-none cursor-pointer transition-colors"
                    style={{
                      padding: "5px 24px",
                      opacity: item.enabled === false ? 0.4 : 1,
                      cursor: item.enabled === false ? "default" : "pointer",
                    }}
                    onClick={() =>
                      item.enabled !== false && handleAction(item.action)
                    }
                    onMouseEnter={(e) => {
                      if (item.enabled !== false) {
                        e.currentTarget.style.background = "var(--color-border)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <span className="text-[11px] text-[var(--color-foreground-dim)] ml-6 font-mono">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
