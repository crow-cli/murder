/** Chat tile — tabbed container for ACP chat sessions, lives inside mosaic tiles */
import { useState, useCallback, useEffect, useRef } from "react";
import * as acpStore from "../lib/acp-store";
import type { AgentConfig } from "../lib/acp-client";
import ChatSessionBody from "./ChatSessionBody";

export interface ChatTab {
  sessionId: string;
}

interface ChatTileProps {
  tileId: string;
  workspaceRoot: string | null;
  agentConfig: AgentConfig;
  onRemove?: () => void;
  onFocus?: () => void;
}

let chatTabCounter = 0;

export default function ChatTile({
  tileId,
  workspaceRoot,
  agentConfig,
  onRemove,
  onFocus,
}: ChatTileProps) {
  const [tabs, setTabs] = useState<ChatTab[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const onRemoveRef = useRef(onRemove);

  useEffect(() => {
    onRemoveRef.current = onRemove;
  }, [onRemove]);

  // Sync with acpStore — track sessions that belong to this tile
  // We use tileId as a namespace prefix for sessions
  const sessionPrefix = `chat-${tileId}`;

  const addSession = useCallback(() => {
    if (!workspaceRoot) return;
    chatTabCounter++;
    const sessionId = `${sessionPrefix}-${Date.now()}-${chatTabCounter}`;
    acpStore.createSession(sessionId, agentConfig, workspaceRoot);
    setTabs((prev) => [...prev, { sessionId }]);
    setActiveIndex(prev => tabs.length);
  }, [workspaceRoot, agentConfig, sessionPrefix, tabs.length]);

  const closeSession = useCallback((sessionId: string) => {
    acpStore.closeSession(sessionId);
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.sessionId === sessionId);
      const next = prev.filter((t) => t.sessionId !== sessionId);
      if (next.length === 0) {
        onRemoveRef.current?.();
      }
      setActiveIndex((ai) => {
        if (next.length === 0) return -1;
        if (ai === idx) return Math.max(0, next.length - 1);
        if (ai > idx) return ai - 1;
        return ai;
      });
      return next;
    });
  }, []);

  // Auto-create first session on mount
  useEffect(() => {
    if (tabs.length === 0) addSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onFocus?.();
  }, [activeIndex]);

  const activeSession = activeIndex >= 0 ? tabs[activeIndex]?.sessionId : null;

  return (
    <div className="flex flex-col h-full bg-[var(--color-background-dark)]">
      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="flex bg-[var(--color-background)] border-b border-[var(--color-border)] overflow-x-auto shrink-0 h-[35px]">
          {tabs.map((tab, idx) => {
            const isActive = idx === activeIndex;
            const session = acpStore.getSession(tab.sessionId);
            const label =
              session.sessionInfo?.initResponse?.agentInfo?.title ||
              session.agentConfig?.name ||
              "Agent";

            return (
              <div
                key={tab.sessionId}
                className="flex items-center gap-1.5 px-3 text-[13px] cursor-pointer select-none border-r border-[var(--color-border)] min-w-0 relative transition-colors"
                style={{
                  backgroundColor: isActive
                    ? "var(--color-card)"
                    : "transparent",
                  color: isActive
                    ? "var(--color-foreground)"
                    : "var(--color-foreground-dim)",
                }}
                onClick={() => {
                  setActiveIndex(idx);
                  onFocus?.();
                }}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-[var(--color-primary)]" />
                )}
                <span className="text-xs">🤖</span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px]">
                  {label}
                </span>
                <button
                  className="ml-auto h-5 w-5 p-0 rounded-sm text-[var(--color-active)] hover:text-[var(--color-destructive)] hover:bg-[var(--color-border)] flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeSession(tab.sessionId);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            className="flex items-center px-2 text-[var(--color-foreground-dim)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-border)] transition-colors"
            onClick={addSession}
            title="New Agent Session"
          >
            +
          </button>
        </div>
      )}

      {/* Chat body */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {activeSession ? (
          <div className="absolute inset-0">
            <ChatSessionBody sessionId={activeSession} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--color-foreground-dim)] text-sm">
            {workspaceRoot
              ? "No agent session"
              : "Open a folder to start a chat"}
          </div>
        )}
      </div>
    </div>
  );
}
