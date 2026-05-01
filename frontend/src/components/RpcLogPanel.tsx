/**
 * RPC Log panel — displays raw ACP notifications in a searchable, copyable format.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as acpStore from "../lib/acp-store";

const COLORS = {
  bg: "#1a1230",
  bgDark: "#14101f",
  bgLighter: "#251d4a",
  border: "#2d2350",
  text: "#d4c4ff",
  textMuted: "#8b7bb5",
  accent: "#4ade80",
};

export default function RpcLogPanel() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);

  useEffect(() => {
    const s = acpStore.getState();
    setNotifications(s.notifications);
    const unsub = acpStore.subscribe(() => {
      setNotifications(acpStore.getState().notifications);
    });
    return unsub;
  }, []);

  // Auto-expand all by default, auto-scroll on new entries
  useEffect(() => {
    if (notifications.length > prevLen.current) {
      // Expand new entries
      const newIds = notifications.slice(prevLen.current).map((n: any) => n.id);
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.add(id);
        return next;
      });
      // Scroll to bottom
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    prevLen.current = notifications.length;
  }, [notifications.length]);

  const filtered = useMemo(() => {
    if (!filter) return notifications;
    const lower = filter.toLowerCase();
    return notifications.filter((n) =>
      JSON.stringify(n).toLowerCase().includes(lower)
    );
  }, [notifications, filter]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(filtered.map((n: any) => n.id)));
  }, [filtered]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const copyEntry = useCallback((entry: any) => {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2)).catch(() => {});
  }, []);

  const copyAll = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(filtered, null, 2)).catch(() => {});
  }, [filtered]);

  const clearLog = useCallback(() => {
    acpStore.clearNotifications();
  }, []);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.title}>RPC Log ({notifications.length})</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button onClick={expandAll} style={styles.smBtn}>
            Expand All
          </button>
          <button onClick={collapseAll} style={styles.smBtn}>
            Collapse
          </button>
          <button onClick={copyAll} style={styles.smBtn}>
            Copy All
          </button>
          <button onClick={clearLog} style={{ ...styles.smBtn, color: "#f87171" }}>
            Clear
          </button>
        </div>
      </div>

      <div style={styles.filterBar}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by type, content, or method…"
          style={styles.filterInput}
        />
        <span style={styles.filterCount}>
          {filter ? `${filtered.length} of ${notifications.length}` : `${notifications.length} entries`}
        </span>
      </div>

      <div ref={listRef} style={styles.list}>
        {filtered.length === 0 && (
          <div style={styles.empty}>No notifications{filter ? " matching filter" : ""}</div>
        )}
        {filtered.map((n: any) => {
          const isExpanded = expanded.has(n.id);
          const update = n.data?.update;
          const stype = update?.sessionUpdate || update?.type || n.type || "unknown";
          const ts = new Date(parseInt(n.id.split("-")[0])).toLocaleTimeString();

          return (
            <div key={n.id} style={styles.entry}>
              <div
                onClick={() => toggle(n.id)}
                style={{
                  ...styles.entryHeader,
                  background: isExpanded ? COLORS.bgLighter : "transparent",
                }}
              >
                <span style={styles.arrow}>{isExpanded ? "▼" : "▶"}</span>
                <span style={styles.entryType}>{stype}</span>
                <span style={styles.entryTime}>{ts}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); copyEntry(n); }}
                  style={styles.copyBtn}
                  title="Copy this entry"
                >
                  📋
                </button>
              </div>
              {isExpanded && (
                <pre style={styles.entryBody}>
                  {JSON.stringify(n, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 12px",
    borderBottom: `1px solid ${COLORS.border}`,
    background: COLORS.bgDark,
    flexShrink: 0,
    gap: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    color: COLORS.textMuted,
    whiteSpace: "nowrap" as const,
  },
  smBtn: {
    padding: "2px 8px",
    fontSize: 10,
    borderRadius: 3,
    border: `1px solid ${COLORS.border}`,
    background: "transparent",
    color: COLORS.textMuted,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 12px",
    borderBottom: `1px solid ${COLORS.border}`,
    flexShrink: 0,
  },
  filterInput: {
    flex: 1,
    padding: "4px 8px",
    fontSize: 12,
    background: COLORS.bgLighter,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 3,
    color: COLORS.text,
    outline: "none",
    fontFamily: "monospace",
  },
  filterCount: {
    fontSize: 10,
    color: COLORS.textMuted,
    whiteSpace: "nowrap" as const,
  },
  list: {
    flex: 1,
    overflowY: "auto" as const,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  empty: {
    padding: 24,
    textAlign: "center" as const,
    color: COLORS.textMuted,
    fontSize: 12,
  },
  entry: {
    borderBottom: `1px solid ${COLORS.border}`,
  },
  entryHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 8px",
    cursor: "pointer",
    userSelect: "none" as const,
  },
  arrow: {
    color: COLORS.textMuted,
    fontSize: 9,
    width: 12,
    textAlign: "center" as const,
  },
  entryType: {
    color: COLORS.text,
    fontSize: 11,
    fontFamily: "monospace",
  },
  entryTime: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginLeft: "auto",
  },
  copyBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    padding: "0 4px",
    opacity: 0.6,
  },
  entryBody: {
    margin: 0,
    padding: "6px 8px 6px 28px",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    color: COLORS.textMuted,
    fontSize: 10,
    lineHeight: 1.4,
    background: "rgba(0,0,0,0.2)",
  },
};
