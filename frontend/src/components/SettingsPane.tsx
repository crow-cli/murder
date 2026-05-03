/** Settings UI Panel — JSONC editor + visual controls */
import { useEffect, useState, useCallback, useRef } from "react";
import * as monaco from "monaco-editor";
import * as settings from "../lib/settings";
import { ws } from "../lib/ws-client";

const COLORS = {
  bg: "#14101f",
  bgSecondary: "#1a1230",
  border: "#2d2350",
  text: "#d4c4ff",
  textMuted: "#8b7bb5",
  textDim: "#5a4d80",
  hover: "#2d2350",
  active: "#3a2d60",
  accent: "#4ade80",
  accentBg: "#4ade8022",
};

function getDefaultJson(): string {
  const s = settings.getSettings();
  const defaultJson = JSON.stringify(
    {
      editor: s.editor,
      languages: s.languages,
      intellisense: s.intellisense,
      terminal: s.terminal,
    },
    null,
    2,
  );
  return `// Murder IDE Settings\n// JSONC format — comments and trailing commas supported\n\n${defaultJson}\n`;
}

export default function SettingsPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [configPath, setConfigPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load settings file content
  const loadSettingsFile = useCallback(async () => {
    setLoading(true);

    // Resolve config path ourselves (don't depend on module state)
    let path = settings.getConfigPath();
    if (!path) {
      try {
        const pathResult = await ws.invoke<{ path: string }>(
          "get_config_path",
          {},
        );
        path = pathResult.path;
      } catch {
        setLoading(false);
        setJsonText(getDefaultJson());
        setConfigPath("unknown");
        return;
      }
    }
    setConfigPath(path);

    try {
      const result = await ws.invoke<{ content?: string }>("read_file", {
        path,
      });
      if (result.content && result.content.trim()) {
        setJsonText(result.content);
      } else {
        // File doesn't exist or is empty — show defaults
        setJsonText(getDefaultJson());
      }
      setError(null);
    } catch {
      // File doesn't exist — show defaults
      setJsonText(getDefaultJson());
      setError(null);
    }
    setLoading(false);
  }, []);

  // Init Monaco for settings editor
  useEffect(() => {
    if (!containerRef.current || !jsonText) return;

    if (editorRef.current) {
      editorRef.current.dispose();
      editorRef.current = null;
    }

    monaco.editor.defineTheme("settings-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": COLORS.bgSecondary,
        "editor.foreground": COLORS.text,
        "editor.lineHighlightBackground": COLORS.hover,
        "editor.selectionBackground": COLORS.accentBg,
        "editorCursor.foreground": COLORS.accent,
        "editorLineNumber.foreground": COLORS.textDim,
        "editorLineNumber.activeForeground": COLORS.text,
      },
    });

    const editor = monaco.editor.create(containerRef.current, {
      value: jsonText,
      language: "jsonc",
      theme: "settings-dark",
      automaticLayout: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      lineNumbers: "on",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      suggest: { showStatusBar: false },
      quickSuggestions: false,
      parameterHints: { enabled: false },
      wordWrap: "on",
      padding: { top: 8, bottom: 8 },
      renderWhitespace: "selection",
    });

    editorRef.current = editor;

    editor.onDidChangeModelContent(() => {
      setHasUnsaved(true);
      setSaved(false);
    });

    return () => {
      editor.dispose();
      editorRef.current = null;
    };
  }, [jsonText]);

  // Load on mount
  useEffect(() => {
    loadSettingsFile();
  }, [loadSettingsFile]);

  const handleSave = async () => {
    if (!editorRef.current) return;
    const content = editorRef.current.getValue();
    const path = configPath ?? settings.getConfigPath();
    if (!path) return;

    // Validate JSON (strip comments first)
    try {
      const stripped = content
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/,\s*([}\]])/g, "$1");
      JSON.parse(stripped);
    } catch (e: any) {
      setError(`Invalid JSON: ${e.message}`);
      return;
    }

    try {
      await ws.invoke("write_file", { path, content });
      await settings.loadSettings();
      setHasUnsaved(false);
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(`Failed to save: ${e.message || e}`);
    }
  };

  const handleReset = async () => {
    await settings.resetSettings();
    loadSettingsFile();
    setError(null);
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: COLORS.bg,
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
            Settings
          </span>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>
            {loading ? "loading..." : (configPath ?? "no config path")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {saved && (
            <span style={{ fontSize: 11, color: COLORS.accent }}>✓ Saved</span>
          )}
          {hasUnsaved && (
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>
              ● Unsaved
            </span>
          )}
          <button
            onClick={handleReset}
            style={{
              padding: "2px 10px",
              fontSize: 11,
              borderRadius: 3,
              border: `1px solid ${COLORS.border}`,
              background: "transparent",
              color: COLORS.textMuted,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasUnsaved}
            style={{
              padding: "2px 10px",
              fontSize: 11,
              borderRadius: 3,
              border: "none",
              background: hasUnsaved ? COLORS.accent : COLORS.bgSecondary,
              color: hasUnsaved ? COLORS.bg : COLORS.textMuted,
              cursor: hasUnsaved ? "pointer" : "default",
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div
          style={{
            padding: "4px 12px",
            background: "rgba(248,113,113,0.1)",
            borderBottom: `1px solid ${COLORS.border}`,
            fontSize: 12,
            color: "#f87171",
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {/* Editor or loading state */}
      {loading ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: COLORS.textMuted,
          }}
        >
          Loading settings...
        </div>
      ) : (
        <div ref={containerRef} style={{ flex: 1, overflow: "hidden" }} />
      )}

      {/* Footer hint */}
      <div
        style={{
          padding: "4px 12px",
          borderTop: `1px solid ${COLORS.border}`,
          fontSize: 11,
          color: COLORS.textDim,
          flexShrink: 0,
        }}
      >
        JSONC format supported • Comments and trailing commas • Ctrl+S to save
      </div>
    </div>
  );
}
