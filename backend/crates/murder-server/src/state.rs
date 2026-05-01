use std::path::Path;
use std::sync::Arc;

use murder_text::TextModel;
use murder_workspace::Workspace;
use dashmap::DashMap;
use parking_lot::Mutex;

/// Shared application state accessible from WebSocket handlers.
pub struct AppState {
    /// Open documents keyed by file path.
    pub documents: DashMap<String, TextModel>,
    /// Current workspace (root directory).
    pub workspace: Mutex<Option<Workspace>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            documents: DashMap::new(),
            workspace: Mutex::new(None),
        }
    }

    pub fn set_workspace(&self, root: &str) {
        let mut ws = self.workspace.lock();
        *ws = Some(Workspace::open(Path::new(root)));
    }

    pub fn workspace_root(&self) -> Option<String> {
        self.workspace.lock().as_ref().map(|w| w.root().to_string_lossy().into_owned())
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
