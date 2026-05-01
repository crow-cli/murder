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

const COLORS = {
  bg: "#14101f",
  hover: "#2d2350",
  text: "#d4c4ff",
  textMuted: "#8b7bb5",
  border: "#2d2350",
  dropdownBg: "#1a1230",
  dropdownItemHover: "#2d2350",
  shortcut: "#5a4d80",
  separator: "#2d2350",
  disabled: "#3a2d60",
};

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
    <div ref={menuRef} style={styles.bar}>
      {items.map((menu) => (
        <div key={menu.label} style={styles.menuItem}>
          <button
            style={{
              ...styles.menuButton,
              background: openMenu === menu.label ? COLORS.hover : "transparent",
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
            <div ref={dropdownRef} style={styles.dropdown}>
              {menu.items.map((item, i) =>
                item.separator ? (
                  <div key={i} style={styles.separator} />
                ) : (
                  <button
                    key={item.label}
                    style={{
                      ...styles.dropdownItem,
                      opacity: item.enabled === false ? 0.4 : 1,
                      cursor: item.enabled === false ? "default" : "pointer",
                    }}
                    onClick={() => item.enabled !== false && handleAction(item.action)}
                    onMouseEnter={(e) => {
                      if (item.enabled !== false) {
                        e.currentTarget.style.background = COLORS.dropdownItemHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={styles.dropdownItemLabel}>{item.label}</span>
                    {item.shortcut && (
                      <span style={styles.dropdownShortcut}>{item.shortcut}</span>
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

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 30,
    background: COLORS.bg,
    display: "flex",
    alignItems: "center",
    padding: "0 4px",
    borderBottom: `1px solid ${COLORS.border}`,
    flexShrink: 0,
    position: "relative" as const,
    zIndex: 100,
  },
  menuItem: {
    position: "relative" as const,
  },
  menuButton: {
    padding: "4px 10px",
    fontSize: 13,
    background: "none",
    border: "none",
    color: COLORS.textMuted,
    cursor: "pointer",
    borderRadius: 3,
    fontWeight: 400,
  },
  dropdown: {
    position: "absolute" as const,
    top: "100%",
    left: 0,
    minWidth: 200,
    background: COLORS.dropdownBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: "4px 0",
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    zIndex: 200,
  },
  dropdownItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 24px",
    fontSize: 13,
    background: "none",
    border: "none",
    color: COLORS.text,
    width: "100%",
    textAlign: "left" as const,
    cursor: "pointer",
    boxSizing: "border-box" as const,
  },
  dropdownItemLabel: {
    flex: 1,
  },
  dropdownShortcut: {
    fontSize: 11,
    color: COLORS.shortcut,
    marginLeft: 24,
    fontFamily: "monospace",
  },
  separator: {
    height: 1,
    background: COLORS.separator,
    margin: "4px 8px",
  },
};
