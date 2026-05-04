/** ChatSessionBody — messages + input for a single ACP session. No header, no chrome. */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { math } from "@streamdown/math";
import "katex/dist/katex.min.css";

import {
  type AcpNotification,
  type ConnectionStatus,
  type SessionInfo,
} from "../lib/acp-client";
import { groupNotifications, mergeToolCalls } from "../lib/acp-utils";
import * as acpStore from "../lib/acp-store";
import { getCachedFile, cacheFile } from "../lib/file-cache";
import InlineTerminal from "./InlineTerminal";
import { FileReadView, FileWriteView, FileEditView } from "./FileViews";
import { WebFetchView, WebSearchView } from "./WebViews";

// ─── Types ──────────────────────────────────────────────────────────────────

type GroupedNotifications = ReturnType<typeof groupNotifications>;
type GroupItem = GroupedNotifications[number][number];

interface ChatSessionBodyProps {
  sessionId: string;
  onFileChanged?: (path: string, content: string) => void;
}

// ─── ChatSessionBody ─────────────────────────────────────────────────────────

export default function ChatSessionBody({
  sessionId,
  onFileChanged,
}: ChatSessionBodyProps) {
  const [input, setInput] = useState("");
  const [notifications, setNotifications] = useState<AcpNotification[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [pendingPermission, setPendingPermission] = useState<{
    request: any;
    resolve: (r: any) => void;
    reject: (e: Error) => void;
  } | null>(null);
  const [fetchedFiles, setFetchedFiles] = useState<
    Map<string, { path: string; content: string; beforeContent?: string }>
  >(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevNotifLen = useRef(0);

  // Subscribe to THIS specific session
  useEffect(() => {
    const s = acpStore.getSession(sessionId);
    setNotifications(s.notifications);
    setConnectionStatus(s.status);
    setSessionInfo(s.sessionInfo);
    setPendingPermission(s.pendingPermission);

    const unsub = acpStore.subscribeToSession(sessionId, () => {
      const s2 = acpStore.getSession(sessionId);
      setNotifications(s2.notifications);
      setConnectionStatus(s2.status);
      setSessionInfo(s2.sessionInfo);
      setPendingPermission(s2.pendingPermission);
    });
    return unsub;
  }, [sessionId]);

  // Auto-scroll on new notifications
  useEffect(() => {
    if (notifications.length > prevNotifLen.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevNotifLen.current = notifications.length;
  }, [notifications.length]);

  useEffect(() => {
    if (connectionStatus === "ready")
      setTimeout(() => inputRef.current?.focus(), 50);
  }, [connectionStatus]);

  // Extract content from a tool call
  function extractContentFromTool(tool: any): string | null {
    if (tool.rawOutput) {
      if (typeof tool.rawOutput === "string") return tool.rawOutput;
      if (tool.rawOutput.content) return tool.rawOutput.content;
      if (tool.rawOutput.output) return tool.rawOutput.output;
    }
    if (tool.content) {
      const textBlocks = tool.content
        .filter((c: any) => c.type === "content")
        .map((c: any) => c.content?.text || "")
        .join("\n");
      if (textBlocks) return textBlocks;
    }
    return null;
  }

  // Fetch file contents for tool calls
  useEffect(() => {
    const sessionNotes = notifications.filter(
      (n) => n.type === "session_notification",
    ) as GroupItem[];
    const groups = groupNotifications(sessionNotes);

    const client = acpStore.getClient(sessionId);
    if (!client) return;

    for (const group of groups) {
      const updates = group
        .map((g: any) => g.data?.update)
        .filter(Boolean)
        .filter((u: any) => u.toolCallId);
      if (updates.length === 0) continue;

      try {
        const merged = mergeToolCalls(updates);
        for (const tool of merged) {
          const kind = tool.kind || "";
          const title = tool.title || "";
          const titleLower = title.toLowerCase();
          const effectiveKind =
            kind ||
            (titleLower.startsWith("read:")
              ? "read"
              : titleLower.startsWith("write:") ||
                  titleLower.startsWith("create:")
                ? "write"
                : titleLower.startsWith("edit:")
                  ? "edit"
                  : "");
          const status = tool.status || "";
          if (status !== "completed") continue;
          if (!["read", "write", "edit"].includes(effectiveKind)) continue;

          const toolCallId = tool.toolCallId;
          if (fetchedFiles.has(toolCallId)) continue;

          const filePath = extractFilePath(tool);
          if (!filePath) continue;

          if (effectiveKind === "edit") {
            const beforeContent = getCachedFile(filePath);
            if (!beforeContent) {
              fetchFile(client, filePath, toolCallId, "read");
              continue;
            }
            client
              .wsInvoke("read_file", { path: filePath })
              .then((result: any) => {
                const afterContent = result.content as string;
                cacheFile(filePath, afterContent);
                setFetchedFiles((prev) => {
                  const next = new Map(prev);
                  next.set(toolCallId, {
                    path: filePath,
                    content: afterContent,
                    beforeContent,
                  });
                  return next;
                });
                if (onFileChanged) onFileChanged(filePath, afterContent);
              })
              .catch(() => {});
          } else if (effectiveKind === "read") {
            const embeddedContent = extractContentFromTool(tool);
            if (embeddedContent) {
              cacheFile(filePath, embeddedContent);
              setFetchedFiles((prev) => {
                const next = new Map(prev);
                next.set(toolCallId, {
                  path: filePath,
                  content: embeddedContent,
                });
                return next;
              });
              if (onFileChanged) onFileChanged(filePath, embeddedContent);
            } else {
              fetchFile(client, filePath, toolCallId, kind);
            }
          } else {
            fetchFile(client, filePath, toolCallId, kind);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [notifications, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  function extractFilePath(tool: any): string | null {
    if (tool.content) {
      const diffContent = tool.content.find((c: any) => c.type === "diff");
      if (diffContent?.path) return diffContent.path;
    }

    const title = tool.title || "";
    const pathMatch = title.match(/[:\/]([\/\w.~-]+)/);
    if (pathMatch) return pathMatch[1];

    if (tool.content) {
      const text = tool.content
        .filter((c: any) => c.type === "content")
        .map((c: any) => c.content?.text || "")
        .join("");
      const fileMatch = text.match(/\/[\w./~-]+\.\w+/);
      if (fileMatch) return fileMatch[0];
    }
    return null;
  }

  const fetchFile = useCallback(
    (
      client: any,
      filePath: string,
      toolCallId: string,
      kind: string,
      beforeContent?: string,
    ) => {
      client
        .wsInvoke("read_file", { path: filePath })
        .then((result: any) => {
          const content = result.content as string;
          cacheFile(filePath, content);
          setFetchedFiles((prev) => {
            const next = new Map(prev);
            next.set(toolCallId, { path: filePath, content, beforeContent });
            return next;
          });
          if (onFileChanged) onFileChanged(filePath, content);
        })
        .catch(() => {});
    },
    [onFileChanged],
  );

  const handleSend = useCallback(async () => {
    if (!input.trim() || connectionStatus !== "ready") return;
    try {
      await acpStore.prompt(sessionId, input.trim());
      setInput("");
    } catch (err) {
      console.error("Prompt failed:", err);
    }
  }, [input, connectionStatus, sessionId]);

  const handleCancel = useCallback(async () => {
    try {
      await acpStore.cancel(sessionId);
    } catch (err) {
      console.error("Cancel failed:", err);
    }
  }, [sessionId]);

  const handleResolvePermission = useCallback(
    (response: any) => {
      if (pendingPermission) {
        pendingPermission.resolve(response);
        acpStore.getSession(sessionId).pendingPermission = null;
        setPendingPermission(null);
      }
    },
    [pendingPermission, sessionId],
  );

  const handleRejectPermission = useCallback(() => {
    if (pendingPermission) {
      pendingPermission.reject(new Error("Cancelled"));
      acpStore.getSession(sessionId).pendingPermission = null;
      setPendingPermission(null);
    }
  }, [pendingPermission, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isReady = connectionStatus === "ready";
  const isStreaming =
    isReady &&
    notifications.some(
      (n) =>
        n.type === "session_notification" &&
        (n.data as any)?.update?.sessionUpdate === "agent_message_chunk",
    );

  const statusLabel =
    connectionStatus === "disconnected"
      ? "Disconnected"
      : connectionStatus === "connecting"
        ? "Connecting..."
        : connectionStatus === "initializing"
          ? "Initializing..."
          : connectionStatus === "creating_session"
            ? "Creating session..."
            : "Ready";

  const messageGroups: GroupedNotifications = useMemo(() => {
    const sessionNotes = notifications.filter(
      (n) => n.type === "session_notification",
    ) as GroupItem[];
    return groupNotifications(sessionNotes).filter((group) => {
      const update = (group[0].data as any)?.update;
      const stype = update?.sessionUpdate || update?.type;
      return (
        stype !== "available_commands_update" && stype !== "current_mode_update"
      );
    });
  }, [notifications]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-background-dark)]">
      {/* Connection bar */}
      {connectionStatus === "disconnected" && (
        <div className="px-3 py-1 bg-[var(--color-destructive)]/10 border-b border-[var(--color-border)] text-[var(--color-destructive)] text-[12px] flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-[var(--color-destructive)]" />
          Disconnected
        </div>
      )}

      {/* Permission bar */}
      {pendingPermission && (
        <div className="px-3 py-2 bg-[var(--color-primary)]/10 border-b border-[var(--color-border)] shrink-0">
          <div className="text-[12px] font-semibold text-[var(--color-primary)] mb-1">
            Permission Request
          </div>
          {pendingPermission.request.toolCall?.title && (
            <div className="text-[11px] text-[var(--color-foreground-muted)] mb-2">
              {pendingPermission.request.toolCall.title}
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {pendingPermission.request.options?.map((opt: any) => (
              <button
                key={opt.optionId}
                onClick={() =>
                  handleResolvePermission({
                    outcome: { outcome: "selected", optionId: opt.optionId },
                  })
                }
                className="px-2.5 py-0.5 text-[11px] rounded border border-[var(--color-border)] font-medium transition-colors"
                style={{
                  background: opt.kind?.startsWith("allow")
                    ? "rgba(166,227,161,0.15)"
                    : "rgba(243,139,168,0.15)",
                  color: opt.kind?.startsWith("allow")
                    ? "var(--color-primary)"
                    : "var(--color-destructive)",
                }}
              >
                {opt.name}
              </button>
            ))}
            <button
              onClick={handleRejectPermission}
              className="px-2.5 py-0.5 text-[11px] rounded border border-[var(--color-border)] text-[var(--color-foreground-dim)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
        {messageGroups.length === 0 && (
          <div className="text-center text-[var(--color-foreground-muted)] text-[13px] mt-10">
            {statusLabel}
          </div>
        )}
        {messageGroups.map((group, idx) => (
          <MessageGroup
            key={group[0].id}
            group={group}
            isStreaming={isStreaming}
            isLast={idx === messageGroups.length - 1}
            fetchedFiles={fetchedFiles}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-3 py-2 border-t border-[var(--color-border)] flex gap-2 shrink-0">
        {isStreaming && (
          <button
            onClick={handleCancel}
            className="px-2 py-1 text-[11px] font-semibold rounded border border-[var(--color-destructive)]/50 text-[var(--color-destructive)] bg-[var(--color-destructive)]/10 hover:bg-[var(--color-destructive)]/20 transition-colors"
          >
            ⏹ Stop
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isReady
              ? `Ask ${sessionInfo?.agentDisplayName || "agent"}...`
              : statusLabel
          }
          disabled={!isReady}
          className="flex-1 px-2.5 py-1.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-[var(--color-foreground)] text-[13px] outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-foreground-dim)] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!isReady || !input.trim()}
          className="px-4 py-1.5 text-[13px] font-semibold rounded transition-colors"
          style={{
            background:
              isReady && input.trim()
                ? "var(--color-primary)"
                : "var(--color-background)",
            color:
              isReady && input.trim()
                ? "var(--color-primary-foreground)"
                : "var(--color-foreground-dim)",
            cursor: isReady && input.trim() ? "pointer" : "default",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components (message rendering)                                  */
/* ------------------------------------------------------------------ */

function MessageGroup({
  group,
  isStreaming,
  isLast,
  fetchedFiles,
}: {
  group: GroupItem[];
  isStreaming: boolean;
  isLast: boolean;
  fetchedFiles: Map<
    string,
    { path: string; content: string; beforeContent?: string }
  >;
}) {
  const update = (group[0].data as any)?.update;
  const stype = update?.sessionUpdate || update?.type;

  if (stype === "user_message_chunk") {
    const text = extractGroupText(group);
    if (!text) return null;
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[70%] px-3 py-2 bg-[var(--color-primary-faint)] rounded-[12px] rounded-br-[2px] text-[13px] leading-[1.5] whitespace-pre-wrap break-words text-[var(--color-foreground)]"
        >
          {text}
        </div>
      </div>
    );
  }

  if (stype === "agent_message_chunk") {
    const text = extractGroupText(group);
    if (!text) return null;
    return (
      <div className="max-w-[85%] text-[13px] leading-[1.6] text-[var(--color-foreground)]">
        <Streamdown plugins={{ code, mermaid, math }} isAnimating={isStreaming}>
          {text}
        </Streamdown>
      </div>
    );
  }

  if (stype === "agent_thought_chunk") {
    const text = extractGroupText(group);
    if (!text) return null;
    return (
      <details
        open
        className="text-[12px] text-[var(--color-foreground-muted)] opacity-70"
      >
        <summary className="cursor-pointer italic select-none">
          💭 Thinking…
        </summary>
        <div className="mt-1 px-2 border-l-2 border-[var(--color-foreground-muted)] pl-2 whitespace-pre-wrap text-[12px]">
          {text}
        </div>
      </details>
    );
  }

  if (stype === "tool_call" || stype === "tool_call_update") {
    return (
      <ToolNotificationsBlock
        group={group}
        isLast={isLast}
        fetchedFiles={fetchedFiles}
      />
    );
  }

  if (stype === "plan") return <PlansBlock group={group} />;

  return null;
}

function extractGroupText(group: GroupItem[]): string {
  return group
    .map((g) => {
      const u = (g.data as any)?.update;
      const c = u?.content;
      return typeof c === "string" ? c : (c?.text ?? "");
    })
    .join("");
}

function ToolNotificationsBlock({
  group,
  isLast,
  fetchedFiles,
}: {
  group: any[];
  isLast: boolean;
  fetchedFiles: Map<
    string,
    { path: string; content: string; beforeContent?: string }
  >;
}) {
  const updates = group.map((g) => g.data?.update).filter(Boolean);
  const validUpdates = updates.filter((u: any) => u.toolCallId);
  if (validUpdates.length === 0) return null;

  try {
    const toolCalls = mergeToolCalls(validUpdates);
    return (
      <div className="flex flex-col gap-1 max-w-[85%]">
        {toolCalls.map((tc) => (
          <ToolCallAccordion
            key={tc.toolCallId}
            tool={tc}
            isLast={isLast}
            fetchedFile={fetchedFiles.get(tc.toolCallId)}
          />
        ))}
      </div>
    );
  } catch {
    return null;
  }
}

function ToolCallAccordion({
  tool,
  isLast,
  fetchedFile,
}: {
  tool: any;
  isLast: boolean;
  fetchedFile?: { path: string; content: string; beforeContent?: string };
}) {
  const [open, setOpen] = useState(true);
  const status = tool.status || "in_progress";
  const kind = tool.kind || "";
  const title = tool.title || kind || "Tool call";
  const icon =
    status === "completed" ? "✅" : status === "failed" ? "❌" : "⏳";
  const borderColor =
    status === "completed"
      ? "var(--color-primary)"
      : status === "failed"
        ? "var(--color-destructive)"
        : "var(--color-primary)";

  const terminalContent = tool.content?.find((c: any) => c.type === "terminal");
  let terminalId = terminalContent?.terminalId;
  if (!terminalId) {
    terminalId = acpStore.getTerminalId(tool.toolCallId);
  }
  const commandLabel = tool.title || kind;

  const rawOutput = tool.rawOutput;
  const isWebFetch = kind === "fetch" || tool.toolName === "web_fetch";
  const isWebSearch = kind === "search" || tool.toolName === "web_search";

  let fileContent = fetchedFile?.content;
  const beforeContent = fetchedFile?.beforeContent;
  const filePath = fetchedFile?.path || title;

  if (!fileContent && rawOutput) {
    if (typeof rawOutput === "string") fileContent = rawOutput;
    else if (rawOutput.content) fileContent = rawOutput.content;
    else if (rawOutput.output) fileContent = rawOutput.output;
  }

  const fetchUrl = rawOutput?.url || tool.title || "";
  const fetchContent = rawOutput?.content || rawOutput?.markdown || "";

  const searchQuery = rawOutput?.query || tool.title || "";
  const searchResults = rawOutput?.results || rawOutput?.items || [];

  const titleLower = title.toLowerCase();
  const inferredKind =
    kind ||
    (titleLower.startsWith("read:")
      ? "read"
      : titleLower.startsWith("write:") || titleLower.startsWith("create:")
        ? "write"
        : titleLower.startsWith("edit:")
          ? "edit"
          : titleLower.startsWith("fetch:")
            ? "fetch"
            : titleLower.startsWith("search:")
              ? "search"
              : titleLower.startsWith("run:") ||
                  titleLower.startsWith("exec:") ||
                  titleLower.startsWith("terminal:") ||
                  titleLower.startsWith("command:")
                ? "execute"
                : "");
  const isTerminal =
    (inferredKind === "execute" || kind === "execute") && terminalId;
  const isRead = inferredKind === "read";
  const isWrite = inferredKind === "write" || inferredKind === "create";
  const hasDiffContent = tool.content?.some((c: any) => c.type === "diff");
  const isEdit = inferredKind === "edit" || hasDiffContent;

  return (
    <div
      className="text-[12px] rounded overflow-hidden"
      style={{
        border: `1px solid ${borderColor}33`,
        background: "var(--color-background)",
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        className="px-2.5 py-1 flex items-center gap-1.5 cursor-pointer select-none"
      >
        <span>{icon}</span>
        <code
          className="flex-1 text-[11px] font-mono text-[var(--color-foreground)] overflow-hidden text-ellipsis"
        >
          {title}
        </code>
        <span className="text-[10px] text-[var(--color-foreground-dim)] select-none">
          {open ? "▾" : "▸"}
        </span>
      </div>
      {open && (
        <div className="px-2.5 py-2 border-t border-[var(--color-border)] text-[11px]">
          {isTerminal && terminalId ? (
            <InlineTerminal
              terminalId={terminalId}
              commandLabel={commandLabel}
              exited={status === "completed" || status === "failed"}
            />
          ) : null}

          {isRead && fileContent && (
            <div>
              <div className="text-[var(--color-foreground-muted)] mb-1 text-[10px] uppercase font-semibold flex items-center gap-1.5">
                <span>📄 Read</span>
                <code className="text-[11px] text-[var(--color-foreground)] font-mono">
                  {filePath}
                </code>
              </div>
              <FileReadView content={fileContent} path={filePath} />
            </div>
          )}

          {isWrite && fileContent && (
            <div>
              <div className="text-[var(--color-foreground-muted)] mb-1 text-[10px] uppercase font-semibold flex items-center gap-1.5">
                <span>✏️ Write</span>
                <code className="text-[11px] text-[var(--color-foreground)] font-mono">
                  {filePath}
                </code>
              </div>
              <FileWriteView content={fileContent} path={filePath} />
            </div>
          )}

          {isEdit && fileContent && beforeContent && (
            <div>
              <div className="text-[var(--color-foreground-muted)] mb-1 text-[10px] uppercase font-semibold flex items-center gap-1.5">
                <span>🔄 Diff</span>
                <code className="text-[11px] text-[var(--color-foreground)] font-mono">
                  {filePath}
                </code>
              </div>
              <FileEditView
                beforeContent={beforeContent}
                afterContent={fileContent}
                path={filePath}
              />
            </div>
          )}

          {isWebFetch && fetchUrl && fetchContent && (
            <WebFetchView url={fetchUrl} content={fetchContent} />
          )}

          {isWebSearch &&
            Array.isArray(searchResults) &&
            searchResults.length > 0 && (
              <WebSearchView query={searchQuery} results={searchResults} />
            )}

          {!isTerminal &&
            !isRead &&
            !isWrite &&
            !isEdit &&
            !isWebFetch &&
            !isWebSearch &&
            tool.rawInput &&
            Object.keys(tool.rawInput).length > 0 && (
              <div className="mb-1.5">
                <div className="text-[var(--color-foreground-muted)] mb-0.5 text-[10px] uppercase font-semibold">
                  Parameters
                </div>
                <pre className="m-0 whitespace-pre-wrap break-all text-[var(--color-foreground-muted)] bg-[var(--color-background)] px-1.5 rounded text-[11px]">
                  {JSON.stringify(tool.rawInput, null, 2)}
                </pre>
              </div>
            )}
          {!isTerminal &&
            !isRead &&
            !isWrite &&
            !isEdit &&
            !isWebFetch &&
            !isWebSearch &&
            tool.rawOutput && (
              <div>
                <div className="text-[var(--color-foreground-muted)] mb-0.5 text-[10px] uppercase font-semibold">
                  Output
                </div>
                <pre className="m-0 whitespace-pre-wrap break-all text-[var(--color-foreground-muted)] bg-[var(--color-background)] px-1.5 rounded text-[11px]">
                  {tool.rawOutput.output ??
                    JSON.stringify(tool.rawOutput, null, 2)}
                </pre>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function PlansBlock({ group }: { group: any[] }) {
  const plans = group
    .flatMap((g) => (g.data as any)?.update?.entries || [])
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped = plans.filter((p: any) => {
    const key = p.content || p.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (deduped.length === 0) return null;

  return (
    <div
      className="max-w-[85%] text-[12px] rounded px-2 py-1 border border-[var(--color-border)] bg-[var(--color-background)]"
    >
      <div className="text-[11px] font-semibold text-[var(--color-foreground-muted)] mb-1">
        Tasks ({deduped.length})
      </div>
      {deduped.map((item: any, i: number) => (
        <div
          key={i}
          className="flex items-center gap-1.5 py-0.5"
          style={{
            color:
              item.status === "completed"
                ? "var(--color-foreground-muted)"
                : "var(--color-foreground)",
          }}
        >
          <span className="text-[10px]">
            {item.status === "completed"
              ? "✅"
              : item.status === "in_progress"
                ? "🔄"
                : "⬜"}
          </span>
          <span
            style={
              item.status === "completed"
                ? { textDecoration: "line-through", opacity: 0.5 }
                : {}
            }
          >
            {item.content || item.title || item.description}
          </span>
        </div>
      ))}
    </div>
  );
}
