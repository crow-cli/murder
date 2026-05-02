import { useState, useEffect } from "react";
import * as acpStore from "../lib/acp-store";

interface ChatTab {
  id: string;
  label: string;
  agentName: string;
}

interface ChatTabsProps {
  onTabClick: (id: string) => void;
  activeTabId: string | null;
  onNewTab: () => void;
  onCloseTab: (id: string) => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
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

export function ChatTabs({
  onTabClick,
  activeTabId,
  onNewTab,
  onCloseTab,
  minimized = false,
  onToggleMinimize,
}: ChatTabsProps) {
  const [tabs, setTabs] = useState<ChatTab[]>([]);

  useEffect(() => {
    const update = () => {
      const ids = acpStore.getSessionIds();
      const newTabs: ChatTab[] = ids.map((id) => {
        const state = acpStore.getSession(id);
        const label =
          state.sessionInfo?.initResponse?.agentInfo?.title ||
          state.agentConfig?.name ||
          "Agent";
        return { id, label, agentName: label };
      });
      setTabs(newTabs);
    };

    update();
    const unsub = acpStore.subscribeToMeta(() => update());
    return unsub;
  }, []);

  if (tabs.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        background: COLORS.bg,
        borderBottom: `1px solid ${COLORS.border}`,
        overflowX: "auto",
        flexShrink: 0,
        height: 35,
        alignItems: "center",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
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
              flexShrink: 0,
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
            <span style={{ fontSize: 12 }}>🤖</span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 120,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {tab.agentName}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              style={{
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

      {onToggleMinimize && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMinimize();
          }}
          style={{
            padding: "0 8px",
            fontSize: 12,
            lineHeight: 1,
            color: COLORS.textInactive,
            background: "none",
            border: "none",
            borderLeft: `1px solid ${COLORS.border}`,
            cursor: "pointer",
            flexShrink: 0,
          }}
          title={minimized ? "Expand chat panel" : "Minimize chat panel"}
        >
          {minimized ? "▴" : "▾"}
        </button>
      )}

      <button
        onClick={onNewTab}
        style={{
          padding: "0 12px",
          fontSize: 16,
          lineHeight: 1,
          color: COLORS.textInactive,
          background: "none",
          border: "none",
          borderLeft: `1px solid ${COLORS.border}`,
          cursor: "pointer",
          flexShrink: 0,
        }}
        title="New Agent Session"
      >
        +
      </button>
    </div>
  );
}
