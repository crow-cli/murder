/**
 * IDE Settings — loaded from global `~/.crow/murder.json`
 * Supports JSONC (JSON with comments, trailing commas).
 * Falls back to defaults if file doesn't exist.
 */

import { ws } from "./ws-client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EditorSettings {
  /** Font size in pixels */
  fontSize: number;
  /** Word wrap mode */
  wordWrap: "on" | "off" | "wordWrapColumn" | "bounded";
  /** Show minimap */
  minimap: boolean;
  /** Render whitespace */
  renderWhitespace: "none" | "selection" | "boundary" | "trailing" | "all";
  /** Tab size */
  tabSize: number;
  /** Insert spaces for tabs */
  insertSpaces: boolean;
  /** Font family */
  fontFamily: string;
}

export interface LanguageSettings {
  /** Per-language editor overrides */
  [languageId: string]: Partial<EditorSettings>;
}

export interface IntellisenseSettings {
  /** Enable suggestions globally */
  enabled: boolean;
  /** Show suggestions on trigger characters (Ctrl+Space, typing . etc.) */
  suggestOnTriggerCharacters: boolean;
  /** Enable word-based suggestions */
  wordBasedSuggestions: boolean;
  /** Show parameter hints (function signatures) */
  parameterHints: boolean;
  /** Show snippets in suggestions */
  showSnippets: boolean;
  /** Languages to disable intellisense for entirely */
  disabledLanguages: string[];
  /** Languages to disable quick-suggestions for (prose: no popup while typing) */
  noQuickSuggestionsLanguages: string[];
}

export interface TerminalSettings {
  /** Default shell */
  shell: string;
  /** Font size */
  fontSize: number;
}

export interface IdeSettings {
  editor: EditorSettings;
  languages: LanguageSettings;
  intellisense: IntellisenseSettings;
  terminal: TerminalSettings;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: IdeSettings = {
  editor: {
    fontSize: 14,
    wordWrap: "on",
    minimap: true,
    renderWhitespace: "selection",
    tabSize: 4,
    insertSpaces: true,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  languages: {
    markdown: {
      wordWrap: "on",
      renderWhitespace: "all",
    },
  },
  intellisense: {
    enabled: true,
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions: true,
    parameterHints: true,
    showSnippets: true,
    disabledLanguages: ["plaintext"],
    noQuickSuggestionsLanguages: [
      "markdown",
      "plaintext",
      "log",
      "shellscript",
      "powershell",
    ],
  },
  terminal: {
    shell: "",
    fontSize: 13,
  },
};

// ─── State ──────────────────────────────────────────────────────────────────

let current: IdeSettings = { ...DEFAULT_SETTINGS };
let configPath: string | null = null;
const listeners = new Set<() => void>();

export function getSettings(): IdeSettings {
  return current;
}

/** Deep-merge partial into defaults */
function deepMerge(
  base: IdeSettings,
  partial: Partial<IdeSettings>,
): IdeSettings {
  const merged = { ...base };
  for (const key of Object.keys(partial) as (keyof IdeSettings)[]) {
    const val = partial[key];
    if (
      val &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      typeof base[key] === "object"
    ) {
      merged[key] = { ...(base[key] as object), ...val } as any;
    } else if (val !== undefined) {
      merged[key] = val as any;
    }
  }
  return merged;
}

/** Strip JSONC comments and trailing commas for JSON.parse */
function stripJsonc(text: string): string {
  return text
    .replace(/\/\/.*$/gm, "") // strip line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // strip block comments
    .replace(/,\s*([}\]])/g, "$1"); // strip trailing commas
}

/** Load settings from global config file */
export async function loadSettings(): Promise<void> {
  // Get the platform-specific config path
  try {
    const pathResult = await ws.invoke<{ path: string }>("get_config_path", {});
    configPath = pathResult.path;
  } catch {
    configPath = null;
  }

  if (!configPath) {
    current = { ...DEFAULT_SETTINGS };
    for (const fn of listeners) fn();
    return;
  }

  try {
    const result = await ws.invoke<{ content?: string }>("read_file", {
      path: configPath,
    });
    if (result.content) {
      const parsed = JSON.parse(
        stripJsonc(result.content),
      ) as Partial<IdeSettings>;
      current = deepMerge({ ...DEFAULT_SETTINGS }, parsed);
    } else {
      current = { ...DEFAULT_SETTINGS };
    }
  } catch {
    current = { ...DEFAULT_SETTINGS };
  }
  for (const fn of listeners) fn();
}

/** Save current settings to global config file */
export async function saveSettings(): Promise<void> {
  if (!configPath) return;

  const { editor, languages, intellisense, terminal } = current;
  const toSave = { editor, languages, intellisense, terminal };
  const jsonc = `// Murder IDE Settings — global config (~/.crow/murder.json)\n// JSONC format — comments and trailing commas supported\n\n${JSON.stringify(toSave, null, 2)}\n`;
  try {
    await ws.invoke("write_file", { path: configPath, content: jsonc });
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

/** Update a nested setting and persist */
export async function updateSetting(
  section: keyof IdeSettings,
  key: string,
  value: unknown,
): Promise<void> {
  const sec = current[section] as Record<string, unknown>;
  if (sec) sec[key] = value;
  await saveSettings();
  for (const fn of listeners) fn();
}

/** Subscribe to settings changes */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Check if intellisense should be disabled for a language */
export function isIntellisenseDisabled(languageId: string): boolean {
  if (!current.intellisense.enabled) return true;
  return current.intellisense.disabledLanguages.includes(languageId);
}

/** Get intellisense options for a language */
export function getIntellisenseOptions(languageId: string) {
  const s = current.intellisense;
  const disabled = isIntellisenseDisabled(languageId);
  const noQuickSuggestions = s.noQuickSuggestionsLanguages.includes(languageId);
  return {
    enabled: !disabled,
    suggestOnTriggerCharacters: s.suggestOnTriggerCharacters && !disabled,
    wordBasedSuggestions: disabled
      ? "off"
      : s.wordBasedSuggestions
        ? "currentDocument"
        : "off",
    parameterHintsEnabled: s.parameterHints && !disabled,
    snippetsPreventQuickSuggestions: !s.showSnippets,
    /** Disables quick-suggestions popup while typing (for prose languages like markdown) */
    noQuickSuggestions,
  };
}

/** Get the current global config file path (may be null if not yet resolved) */
export function getConfigPath(): string | null {
  return configPath;
}

/** Get language-specific editor overrides */
export function getLanguageOverrides(languageId: string): Partial<EditorSettings> {
  return current.languages[languageId] || {};
}

/** Reset settings to defaults */
export async function resetSettings(): Promise<void> {
  current = { ...DEFAULT_SETTINGS };
  await saveSettings();
  for (const fn of listeners) fn();
}
