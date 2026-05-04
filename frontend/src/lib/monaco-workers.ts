/**
 * Monaco Editor Web Worker configuration for Vite.
 *
 * Vite has built-in web worker support using the `?worker` suffix.
 * We use `getWorker` (NOT `getWorkerUrl`) to create workers with
 * `type: 'module'` so Vite's ESM worker bundling works correctly.
 *
 * This eliminates the "Could not create web worker(s)" warning
 * and prevents UI freezes from main-thread fallback.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const self: any;

self.MonacoEnvironment = {
  getWorker: function (_workerId: string, label: string) {
    const getWorkerModule = (moduleUrl: string, label: string) => {
      return new Worker(
        new URL(moduleUrl, import.meta.url),
        { name: label, type: "module" }
      );
    };

    switch (label) {
      case "json":
        return getWorkerModule(
          "node_modules/monaco-editor/esm/vs/language/json/json.worker.js",
          label
        );
      case "css":
      case "scss":
      case "less":
        return getWorkerModule(
          "node_modules/monaco-editor/esm/vs/language/css/css.worker.js",
          label
        );
      case "html":
      case "handlebars":
      case "razor":
        return getWorkerModule(
          "node_modules/monaco-editor/esm/vs/language/html/html.worker.js",
          label
        );
      case "typescript":
      case "javascript":
        return getWorkerModule(
          "node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js",
          label
        );
      default:
        return getWorkerModule(
          "node_modules/monaco-editor/esm/vs/editor/editor.worker.js",
          label
        );
    }
  },
};
