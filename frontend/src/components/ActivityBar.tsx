import {
  IconChat,
  IconExplorer,
  IconSearch,
  IconGit,
  IconTerminal,
  IconExtensions,
  IconRpc,
  IconSettings,
} from "../lib/icons";

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
  Icon: React.FC<{ size?: number; color?: string }>;
  label: string;
  badge?: number;
}

const ACTIVITIES: ActivityDef[] = [
  { id: "chat", Icon: IconChat, label: "Agent Chat" },
  { id: "explorer", Icon: IconExplorer, label: "Explorer" },
  { id: "search", Icon: IconSearch, label: "Search" },
  { id: "git", Icon: IconGit, label: "Source Control" },
  { id: "terminal", Icon: IconTerminal, label: "Terminal" },
  { id: "extensions", Icon: IconExtensions, label: "Extensions" },
  { id: "rpc", Icon: IconRpc, label: "RPC Log" },
];

export function ActivityBar({ active, onActivate }: ActivityBarProps) {
  return (
    <div className="w-[48px] bg-[var(--color-background-dark)] flex flex-col justify-between border-r border-[var(--color-border)] shrink-0">
      <div className="flex flex-col">
        {ACTIVITIES.map(({ id, Icon, label, badge }) => (
          <button
            key={id}
            title={label}
            onClick={() => onActivate(id)}
            className="w-[48px] h-[48px] flex items-center justify-center bg-transparent border-none cursor-pointer relative box-border border-l-2 border-transparent text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)] transition-colors"
            style={{
              backgroundColor: active === id ? "var(--color-border)" : "transparent",
              borderLeftColor: active === id ? "var(--color-primary)" : "transparent",
              opacity: active === id ? 1 : 0.5,
            }}
          >
            <Icon size={20} />
            {badge !== undefined && badge > 0 && (
              <span className="absolute top-[6px] right-[6px] bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-full w-4 h-[16px] text-[9px] font-bold flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-col pb-2">
        <button
          title="Settings"
          onClick={() => onActivate("settings")}
          className="w-[48px] h-[48px] flex items-center justify-center bg-transparent border-none cursor-pointer relative box-border border-l-2 border-transparent text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)] transition-colors"
          style={{
            opacity: active === "settings" ? 1 : 0.5,
            borderLeftColor: active === "settings" ? "var(--color-primary)" : "transparent",
          }}
        >
          <IconSettings size={18} />
        </button>
      </div>
    </div>
  );
}
