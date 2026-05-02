import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import * as monaco from "monaco-editor";

interface EditorPaneProps {
  path: string;
  language: string;
  readOnly?: boolean;
  height?: number;
  wordWrap?: boolean;
  onCursorChange?: (line: number, col: number) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

/** Expose methods to parent via ref */
export interface EditorPaneHandle {
  /** Get current content directly from the Monaco model — always fresh, no React state lag */
  getContent: () => string;
  /** Get current model's saved state (version, dirty, etc.) */
  getModelInfo: () => { versionId: number };
}

const COLORS = {
  bg: "#1e1640",
  text: "#d4c4ff",
  lineHighlight: "#2d2350",
  selection: "#4ade8033",
};

/** Registry of Monaco models — one per file path. Lives outside React to survive remounts. */
const modelRegistry = new Map<string, monaco.editor.ITextModel>();

const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(
  function EditorPane({ path, language, readOnly, height, wordWrap, onCursorChange, onDirtyChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const onSaveCallbacks = useRef<(() => void)[]>([]);
    const pathRef = useRef(path);
    const wordWrapRef = useRef(wordWrap);
    const onCursorChangeRef = useRef(onCursorChange);
    const onDirtyChangeRef = useRef(onDirtyChange);

    useEffect(() => {
      pathRef.current = path;
    }, [path]);
    useEffect(() => {
      wordWrapRef.current = wordWrap;
      editorRef.current?.updateOptions({ wordWrap: wordWrap ? "on" : "off" });
    }, [wordWrap]);
    useEffect(() => {
      onCursorChangeRef.current = onCursorChange;
    }, [onCursorChange]);
    useEffect(() => {
      onDirtyChangeRef.current = onDirtyChange;
    }, [onDirtyChange]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getContent: () => {
        const model = editorRef.current?.getModel();
        return model ? model.getValue() : "";
      },
      getModelInfo: () => ({
        versionId: editorRef.current?.getModel()?.getVersionId() ?? 0,
      }),
    }));

    // Theme + editor init (once)
    useEffect(() => {
      if (!containerRef.current) return;

      monaco.editor.defineTheme("murder-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": COLORS.bg,
          "editor.foreground": COLORS.text,
          "editor.lineHighlightBackground": COLORS.lineHighlight,
          "editor.selectionBackground": COLORS.selection,
          "editorCursor.foreground": "#4ade80",
          "editorLineNumber.foreground": "#5a4d80",
          "editorLineNumber.activeForeground": "#d4c4ff",
          "editorIndentGuide.background": "#2d2350",
          "editorIndentGuide.activeBackground": "#3a2d60",
          "editorBracketMatch.background": "#4ade8022",
          "editorBracketMatch.border": "#4ade80",
          "editorWidget.background": "#1a1230",
          "editorWidget.border": "#2d2350",
          "input.background": "#2d2350",
          "input.border": "#3a2d60",
          "input.foreground": "#d4c4ff",
          "list.hoverBackground": "#2d2350",
          "list.focusBackground": "#3a2d60",
          "scrollbarSlider.background": "#5a4d8044",
          "scrollbarSlider.hoverBackground": "#5a4d8088",
        },
      });

      const editor = monaco.editor.create(containerRef.current, {
        value: "",
        language,
        theme: "murder-dark",
        automaticLayout: true,
        readOnly: readOnly || false,
        minimap: { enabled: !readOnly },
        fontSize: readOnly ? 12 : 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        lineNumbers: readOnly ? "off" : "on",
        renderWhitespace: "selection",
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        scrollBeyondLastLine: !readOnly,
        smoothScrolling: false,
        cursorBlinking: readOnly ? "solid" : "smooth",
        cursorSmoothCaretAnimation: "off",
        cursorStyle: readOnly ? "line-thin" : "line",
        cursorWidth: 2,
        links: !readOnly,
        folding: !readOnly,
        foldingStrategy: "indentation",
        stickyScroll: { enabled: false },
        padding: { top: 8, bottom: 8 },
        suggest: { showStatusBar: !readOnly },
      });

      editorRef.current = editor;

      // Cursor tracking
      editor.onDidChangeCursorPosition((e) => {
        onCursorChangeRef.current?.(e.position.lineNumber, e.position.column);
      });

      // Register Ctrl+S via Monaco command
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        for (const cb of onSaveCallbacks.current) cb();
      });

      // Also register via direct keydown listener (catches when Monaco doesn't)
      const container = containerRef.current;
      const handleEditorKeydown = (e: KeyboardEvent) => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key === 's') {
          e.preventDefault();
          e.stopPropagation();
          for (const cb of onSaveCallbacks.current) cb();
        }
        if (ctrl && e.key === 'w') {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(
            new CustomEvent("editor-close-tab", { detail: { path: pathRef.current } }),
          );
        }
      };
      container?.addEventListener('keydown', handleEditorKeydown, true);

      return () => {
        container?.removeEventListener('keydown', handleEditorKeydown, true);
        editor.dispose();
        editor.dispose();
        // Clean up all models on unmount (full component destruction)
        for (const [, model] of modelRegistry) {
          model.dispose();
        }
        modelRegistry.clear();
      };
    }, []);

    // Register onSave callback
    useEffect(() => {
      const cb = () => {
        // Trigger a custom event that App.tsx listens for
        window.dispatchEvent(
          new CustomEvent("editor-save", { detail: { path: pathRef.current } }),
        );
      };
      onSaveCallbacks.current = [cb];
      return () => {
        onSaveCallbacks.current = [];
      };
    }, []);

    // Switch model when path changes
    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;

      // Get or create model for this path
      let model = modelRegistry.get(path);
      if (!model) {
        // Model doesn't exist yet — it will be populated by the parent
        // via setModelContent after this effect runs. Create a placeholder.
        model = monaco.editor.createModel("", language, monaco.Uri.file(path));
        modelRegistry.set(path, model);
      } else {
        // Model exists — just update its language if needed
        monaco.editor.setModelLanguage(model, language);
      }

      editor.setModel(model);
      editor.focus();

      // Listen for content changes to track dirty state
      const disposable = model.onDidChangeContent(() => {
        onDirtyChangeRef.current?.(true);
      });

      return () => disposable.dispose();
    }, [path, language]);

    return <div ref={containerRef} style={{ flex: 1, overflow: "hidden", ...(height ? { height } : {}) }} />;
  },
);

export default EditorPane;

/** Utility: set content for a path's model (called by App.tsx after loading a file) */
export function setModelContent(
  path: string,
  content: string,
  language: string,
): void {
  let model = modelRegistry.get(path);
  if (!model) {
    // Model hasn't been created by the EditorPane effect yet — create it now
    model = monaco.editor.createModel(content, language, monaco.Uri.file(path));
    modelRegistry.set(path, model);
  } else {
    monaco.editor.setModelLanguage(model, language);
    model.setValue(content);
  }
}

/** Utility: mark a model as clean (saved) */
export function markModelClean(_path: string): void {
  // Monaco doesn't have a built-in "clean/dirty" flag.
  // Dirty state is tracked in React state in App.tsx.
  // This is a no-op placeholder for API compatibility.
}

/** Utility: dispose a model when closing a tab */
export function disposeModel(path: string): void {
  const model = modelRegistry.get(path);
  if (model) {
    model.dispose();
    modelRegistry.delete(path);
  }
}
