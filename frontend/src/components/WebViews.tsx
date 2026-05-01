/**
 * WebFetchView — rendered markdown preview for web_fetch tool results.
 * WebSearchView — search results list for web_search tool results.
 */

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { math } from "@streamdown/math";
import "katex/dist/katex.min.css";

// ─── WebFetchView ────────────────────────────────────────────────────────────

interface WebFetchViewProps {
  url: string;
  content: string;
}

const COLORS = {
  border: "#2d2350",
  bgDark: "#14101f",
  textPrimary: "#d4c4ff",
  textMuted: "#8b7bb5",
  green: "#4ade80",
};

export function WebFetchView({ url, content }: WebFetchViewProps) {
  return (
    <div
      style={{
        borderRadius: 6,
        border: `1px solid ${COLORS.border}`,
        overflow: "hidden",
        background: COLORS.bgDark,
        fontSize: 12,
      }}
    >
      <div
        style={{
          padding: "4px 10px",
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bgDark,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ color: COLORS.green, fontSize: 12 }}>🌐</span>
        <span
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: COLORS.textPrimary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {url}
        </span>
      </div>
      <div
        style={{
          padding: 8,
          maxHeight: 300,
          overflowY: "auto",
          fontSize: 12,
          lineHeight: 1.6,
          color: COLORS.textPrimary,
        }}
      >
        <Streamdown plugins={{ code, mermaid, math }}>
          {content}
        </Streamdown>
      </div>
    </div>
  );
}

// ─── WebSearchView ───────────────────────────────────────────────────────────

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface WebSearchViewProps {
  query: string;
  results: SearchResult[];
}

export function WebSearchView({ query, results }: WebSearchViewProps) {
  return (
    <div
      style={{
        borderRadius: 6,
        border: `1px solid ${COLORS.border}`,
        overflow: "hidden",
        background: COLORS.bgDark,
        fontSize: 12,
      }}
    >
      <div
        style={{
          padding: "4px 10px",
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bgDark,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ color: COLORS.green, fontSize: 12 }}>🔍</span>
        <span style={{ fontSize: 11, color: COLORS.textMuted }}>
          Search:
        </span>
        <span
          style={{
            fontSize: 11,
            color: COLORS.textPrimary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 600,
          }}
        >
          {query}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: COLORS.textMuted,
          }}
        >
          {results.length} results
        </span>
      </div>
      <div
        style={{
          maxHeight: 300,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {results.map((result, i) => (
          <div
            key={i}
            style={{
              padding: "6px 10px",
              borderBottom:
                i < results.length - 1 ? `1px solid ${COLORS.border}33` : "none",
              cursor: "pointer",
            }}
            onClick={() => window.open(result.url, "_blank")}
          >
            <div
              style={{
                fontSize: 12,
                color: "#60a5fa",
                fontWeight: 500,
                marginBottom: 2,
              }}
            >
              {result.title}
            </div>
            <div
              style={{
                fontSize: 10,
                color: COLORS.textMuted,
                fontFamily: "monospace",
                marginBottom: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {result.url}
            </div>
            <div
              style={{
                fontSize: 11,
                color: COLORS.textPrimary,
                lineHeight: 1.4,
                opacity: 0.8,
              }}
            >
              {result.snippet}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
