/** Bottom bar — activity icons + status info + minimize toggles (Zed-style) */
import {
  IconChat,
  IconExplorer,
  IconSearch,
  IconGit,
  IconExtensions,
  IconRpc,
  IconTerminal,
  IconEditor,
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

interface BottomBarProps {
  active: ActivityId;
  onActivate: (id: ActivityId) => void;
  connected: boolean;
  saving: boolean;
  dirty: boolean;
  language: string;
  line: number;
  col: number;
  encoding: string;
  lineEnding: string;
  wordWrap: boolean;
  workspaceName: string;
  /** Toggle minimization of all editor tiles */
  onToggleEditors: () => void;
  /** Toggle minimization of all terminal tiles */
  onToggleTerminals: () => void;
  /** Whether editor tiles are currently minimized */
  editorsMinimized: boolean;
  /** Whether terminal tiles are currently minimized */
  terminalsMinimized: boolean;
  /** Count of visible editor tiles */
  editorTileCount: number;
  /** Count of visible terminal tiles */
  terminalTileCount: number;
}

interface ActivityDef {
  id: ActivityId;
  Icon: React.FC<{ size?: number; color?: string }>;
  label: string;
  badge?: number;
}

// Left-side activities (mostly placeholders for now)
const LEFT_ACTIVITIES: ActivityDef[] = [
  { id: "chat", Icon: IconChat, label: "Agent Chat" },
  { id: "search", Icon: IconSearch, label: "Search" },
  { id: "git", Icon: IconGit, label: "Source Control" },
  { id: "extensions", Icon: IconExtensions, label: "Extensions" },
  { id: "rpc", Icon: IconRpc, label: "ACP Log" },
];

export default function BottomBar({
  active,
  onActivate,
  connected,
  saving,
  dirty,
  language,
  line,
  col,
  encoding,
  lineEnding,
  wordWrap,
  workspaceName,
  onToggleEditors,
  onToggleTerminals,
  editorsMinimized,
  terminalsMinimized,
  editorTileCount,
  terminalTileCount,
}: BottomBarProps) {
  const isActive = (id: ActivityId) => active === id;
  const iconColor = (id: ActivityId) =>
    isActive(id) ? "var(--color-primary)" : "var(--color-foreground)";

  return (
    <div
      className="h-[28px] flex items-center px-2 text-[12px] shrink-0 font-medium flex-nowrap select-none"
      style={{
        backgroundColor: "var(--color-background-dark)",
        color: "var(--color-foreground)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      {/* Left: activity icons */}
      <div className="flex items-center gap-1">
        {LEFT_ACTIVITIES.map(({ id, Icon, label, badge }) => (
          <button
            key={id}
            title={label}
            onClick={() => onActivate(id)}
            className="w-[28px] h-[28px] flex items-center justify-center bg-transparent border-none cursor-pointer rounded-sm hover:bg-[var(--color-hover)] transition-colors"
            style={{ color: iconColor(id) }}
          >
            <Icon size={16} />
            {badge !== undefined && badge > 0 && (
              <span
                className="absolute bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-full w-3 h-3 text-[8px] font-bold flex items-center justify-center"
                style={{ top: 1, right: 1 }}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Left-center: workspace + status */}
      <div className="flex items-center gap-2 ml-3">
        <span className="px-1.5 h-[28px] flex items-center cursor-default text-[12px] whitespace-nowrap">
          {connected ? "✓" : "○"}{" "}
          {saving ? "Saving…" : workspaceName || "No Folder"}
        </span>
        {dirty && (
          <span className="text-[var(--color-primary)] text-sm leading-none">
            ●
          </span>
        )}
      </div>

      {/* Right: status info + minimize toggles + explorer */}
      <div className="flex items-center gap-2 ml-auto mr-1">
        <span className="px-1.5 h-[28px] flex items-center cursor-default text-[11px] whitespace-nowrap opacity-80">
          Ln {line}, Col {col}
        </span>
        <span className="px-1.5 h-[28px] flex items-center cursor-default text-[11px] whitespace-nowrap opacity-80">
          {encoding}
        </span>
        {wordWrap && (
          <span className="px-1.5 h-[28px] flex items-center cursor-default text-[11px] whitespace-nowrap opacity-80">
            Wrap
          </span>
        )}
        <span className="px-1.5 h-[28px] flex items-center cursor-default text-[11px] whitespace-nowrap opacity-80">
          {language}
        </span>

        {/* Divider */}
        <div className="w-[1px] h-[16px] bg-[var(--color-border)] mx-1" />

        {/* Editor toggle — minimize/restore all editor tiles */}
        <button
          title={
            editorsMinimized
              ? `Restore editors (${editorTileCount} hidden)`
              : "Minimize all editors"
          }
          onClick={onToggleEditors}
          className="w-[28px] h-[28px] flex items-center justify-center bg-transparent border-none cursor-pointer rounded-sm hover:bg-[var(--color-hover)] transition-colors relative"
          style={{
            color: editorsMinimized
              ? "var(--color-primary)"
              : iconColor("explorer"),
          }}
        >
          <IconEditor size={16} />
          {editorTileCount > 0 && (
            <span className="absolute bottom-0 right-0 bg-[var(--color-muted)] text-[var(--color-foreground-dim)] rounded-full w-[14px] h-[14px] text-[8px] font-bold flex items-center justify-center">
              {editorTileCount}
            </span>
          )}
        </button>

        {/* Terminal toggle — minimize/restore all terminal tiles */}
        <button
          title={
            terminalsMinimized
              ? `Restore terminals (${terminalTileCount} hidden)`
              : "Minimize all terminals"
          }
          onClick={onToggleTerminals}
          className="w-[28px] h-[28px] flex items-center justify-center bg-transparent border-none cursor-pointer rounded-sm hover:bg-[var(--color-hover)] transition-colors relative"
          style={{
            color: terminalsMinimized
              ? "var(--color-primary)"
              : iconColor("explorer"),
          }}
        >
          <IconTerminal size={16} />
          {terminalTileCount > 0 && (
            <span className="absolute bottom-0 right-0 bg-[var(--color-muted)] text-[var(--color-foreground-dim)] rounded-full w-[14px] h-[14px] text-[8px] font-bold flex items-center justify-center">
              {terminalTileCount}
            </span>
          )}
        </button>

        {/* Explorer icon — far right, opens right sidebar */}
        <button
          title="Explorer"
          onClick={() => onActivate("explorer")}
          className="w-[28px] h-[28px] flex items-center justify-center bg-transparent border-none cursor-pointer rounded-sm hover:bg-[var(--color-hover)] transition-colors ml-1"
          style={{ color: iconColor("explorer") }}
        >
          <IconExplorer size={16} />
        </button>
      </div>
    </div>
  );
}
