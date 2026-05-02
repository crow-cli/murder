interface StatusBarProps {
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
}

const COLORS = {
  bg: "#0d7a3e",
  bgNoFolder: "#3b2d5a",
  text: "#ffffff",
  textDim: "#c8e6c9",
  itemHover: "#1a8f4e",
};

export function StatusBar({
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
}: StatusBarProps) {
  const bg = workspaceName ? COLORS.bg : COLORS.bgNoFolder;

  return (
    <div style={{ ...styles.bar, background: bg }}>
      <div style={styles.left}>
        <StatusBarItem>
          {connected ? "✓" : "○"} {saving ? "Saving…" : workspaceName || "No Folder"}
        </StatusBarItem>
        {dirty && <StatusBarItem>●</StatusBarItem>}
      </div>
      <div style={styles.right}>
        <StatusBarItem>Ln {line}, Col {col}</StatusBarItem>
        <StatusBarItem>Spaces: 4</StatusBarItem>
        <StatusBarItem>{encoding}</StatusBarItem>
        <StatusBarItem>{lineEnding}</StatusBarItem>
        {wordWrap && <StatusBarItem>Word Wrap</StatusBarItem>}
        <StatusBarItem>{language}</StatusBarItem>
      </div>
    </div>
  );
}

function StatusBarItem({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={styles.item}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = COLORS.itemHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 22,
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
    fontSize: 12,
    color: COLORS.text,
    flexShrink: 0,
    fontWeight: 500,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    marginLeft: "auto",
  },
  item: {
    padding: "0 8px",
    height: 22,
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap" as const,
  },
};
