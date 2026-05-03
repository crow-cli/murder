export type ActivityId =
  | "chat"
  | "explorer"
  | "search"
  | "git"
  | "terminal"
  | "extensions"
  | "rpc"
  | "settings";

interface ActivityBarProps {
  active: ActivityId;
  onActivate: (id: ActivityId) => void;
}

interface ActivityDef {
  id: ActivityId;
  icon: string;
  label: string;
  badge?: number;
}

const ACTIVITIES: ActivityDef[] = [
  { id: "chat", icon: "💬", label: "Agent Chat" },
  { id: "explorer", icon: "📁", label: "Explorer" },
  { id: "search", icon: "🔍", label: "Search" },
  { id: "git", icon: "⑂", label: "Source Control" },
  { id: "terminal", icon: "⌘", label: "Terminal" },
  { id: "extensions", icon: "⧉", label: "Extensions" },
  { id: "rpc", icon: "📟", label: "RPC Log" },
];

const COLORS = {
  bg: "#14101f",
  hover: "#2d2350",
  active: "#4ade80",
  inactive: "#8b7bb5",
  dim: "#5a4d80",
};

export function ActivityBar({ active, onActivate }: ActivityBarProps) {
  return (
    <div style={styles.bar}>
      <div style={styles.icons}>
        {ACTIVITIES.map((a) => (
          <button
            key={a.id}
            title={a.label}
            onClick={() => onActivate(a.id)}
            style={{
              ...styles.icon,
              background: active === a.id ? COLORS.hover : "transparent",
              borderLeft:
                active === a.id
                  ? `2px solid ${COLORS.active}`
                  : "2px solid transparent",
              opacity: active === a.id ? 1 : 0.5,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{a.icon}</span>
            {a.badge !== undefined && a.badge > 0 && (
              <span style={styles.badge}>{a.badge}</span>
            )}
          </button>
        ))}
      </div>
      <div style={styles.bottomIcons}>
        <button
          title="Settings"
          onClick={() => onActivate("settings")}
          style={{
            ...styles.icon,
            opacity: active === "settings" ? 1 : 0.5,
            borderLeft:
              active === "settings"
                ? `2px solid ${COLORS.active}`
                : "2px solid transparent",
          }}
        >
          <span style={{ fontSize: 18 }}>⚙</span>
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    width: 48,
    background: COLORS.bg,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    borderRight: "1px solid #2d2350",
    flexShrink: 0,
  },
  icons: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  icon: {
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: COLORS.inactive,
    position: "relative" as const,
    boxSizing: "border-box" as const,
  },
  badge: {
    position: "absolute" as const,
    top: 6,
    right: 6,
    background: COLORS.active,
    color: "#0d1f17",
    borderRadius: 10,
    width: 16,
    height: 16,
    fontSize: 9,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomIcons: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    paddingBottom: 8,
  },
};
