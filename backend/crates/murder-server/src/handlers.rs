//! WebSocket request handlers — mirrors Tauri `#[tauri::command]` functions.

use std::path::Path;

use serde_json::{json, Value};

use crate::state::AppState;
use murder_text::{EditOperation, Position, Range, TextModel};

// ---------------------------------------------------------------------------
// Document handlers
// ---------------------------------------------------------------------------

pub fn handle_document_open(state: &AppState, params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    let content = params["content"].as_str().ok_or("missing 'content'")?.to_string();

    let language_id = detect_language(path);
    let uri = format!("file://{path}");

    let model = TextModel::new(&content, &language_id, &uri);

    let response = json!({
        "content": model.get_full_content(),
        "encoding": model.encoding.label().to_string(),
        "line_ending": model.line_ending.to_string(),
        "language_id": model.language_id,
        "version": model.version,
        "is_dirty": model.is_dirty,
        "is_readonly": model.is_readonly,
        "is_large_file": model.is_large_file,
        "line_count": model.line_count(),
    });

    state.documents.insert(path.to_string(), model);
    Ok(response)
}

pub fn handle_document_close(state: &AppState, params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    Ok(json!(state.documents.remove(path).is_some()))
}

pub fn handle_document_edit(state: &AppState, params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    let start_line = params["start_line"].as_u64().ok_or("missing 'start_line'")? as u32;
    let start_column = params["start_column"].as_u64().ok_or("missing 'start_column'")? as u32;
    let end_line = params["end_line"].as_u64().ok_or("missing 'end_line'")? as u32;
    let end_column = params["end_column"].as_u64().ok_or("missing 'end_column'")? as u32;
    let text = params["text"].as_str().ok_or("missing 'text'")?.to_string();

    let mut entry = state.documents.get_mut(path).ok_or_else(|| format!("Document not found: {path}"))?;
    let model = entry.value_mut();

    // Clamp ranges to document bounds to prevent ropey panics
    let line_count = model.line_count();
    if line_count == 0 {
        return Err("Document is empty".to_string());
    }

    let start_line = start_line.min(line_count - 1);
    let end_line = end_line.min(line_count - 1);
    let start_col_max = model.buffer.get_line_length(start_line);
    let end_col_max = model.buffer.get_line_length(end_line);
    let start_column = start_column.min(start_col_max);
    let end_column = end_column.min(end_col_max);

    let edit = EditOperation::replace(
        Range::new(Position::new(start_line, start_column), Position::new(end_line, end_column)),
        text,
    );
    model.apply_edit(&edit);

    Ok(json!({
        "version": model.version,
        "is_dirty": model.is_dirty,
    }))
}

pub fn handle_document_set_content(state: &AppState, params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    let content = params["content"].as_str().ok_or("missing 'content'")?.to_string();

    let mut entry = state.documents.get_mut(path).ok_or_else(|| format!("Document not found: {path}"))?;
    let model = entry.value_mut();

    // Replace entire content: delete all + insert new
    let line_count = model.line_count();
    if line_count == 0 {
        // Empty doc, just insert
        let edit = EditOperation::insert(Position::new(0, 0), content);
        model.apply_edit(&edit);
    } else {
        let last_line = line_count - 1;
        let last_col = model.buffer.get_line_length(last_line);
        let edit = EditOperation::replace(
            Range::new(Position::new(0, 0), Position::new(last_line, last_col)),
            content,
        );
        model.apply_edit(&edit);
    }

    Ok(json!({
        "version": model.version,
        "is_dirty": model.is_dirty,
    }))
}

pub async fn handle_document_save(state: &AppState, params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;

    let mut entry = state.documents.get_mut(path).ok_or_else(|| format!("Document not found: {path}"))?;
    let model = entry.value_mut();

    if model.is_readonly {
        return Err("Document is read-only".to_string());
    }

    // Get the save-transformed content (trims whitespace, ensures newline)
    let save_content = model.get_save_content();

    // Write to disk
    tokio::fs::write(path, &save_content)
        .await
        .map_err(|e| format!("Failed to write file: {e}"))?;

    // Mark saved
    model.mark_saved();

    Ok(json!({ "success": true, "version": model.version }))
}

pub fn handle_document_get_content(state: &AppState, params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    let entry = state.documents.get(path).ok_or_else(|| format!("Document not found: {path}"))?;
    Ok(json!({ "content": entry.value().get_full_content() }))
}

pub fn handle_document_get_info(state: &AppState, params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    let entry = state.documents.get(path).ok_or_else(|| format!("Document not found: {path}"))?;
    let model = entry.value();
    Ok(json!({
        "is_dirty": model.is_dirty,
        "version": model.version,
        "line_count": model.line_count(),
        "encoding": model.encoding.label().to_string(),
        "line_ending": model.line_ending.to_string(),
    }))
}

// ---------------------------------------------------------------------------
// Filesystem handlers
// ---------------------------------------------------------------------------

pub async fn handle_read_dir(params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;

    let entries = tokio::fs::read_dir(path)
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    let mut stream = entries;
    while let Ok(Some(entry)) = stream.next_entry().await {
        let file_type = entry.file_type().await.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let is_dir = file_type.is_dir();
        let full_path = entry.path().to_string_lossy().into_owned();

        result.push(json!({
            "name": name,
            "path": full_path,
            "is_dir": is_dir,
        }));
    }

    // Sort: directories first, then alphabetically
    result.sort_by(|a, b| {
        let a_dir = a["is_dir"].as_bool().unwrap_or(false);
        let b_dir = b["is_dir"].as_bool().unwrap_or(false);
        match (a_dir, b_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a["name"].as_str().unwrap_or("").cmp(b["name"].as_str().unwrap_or("")),
        }
    });

    Ok(json!({ "entries": result }))
}

pub async fn handle_read_file(params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "content": content }))
}

pub async fn handle_write_file(params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    let content = params["content"].as_str().ok_or("missing 'content'")?;
    tokio::fs::write(path, content)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "success": true }))
}

pub async fn handle_exists(params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    Ok(json!({ "exists": Path::new(path).exists() }))
}

pub async fn handle_mkdir(params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    tokio::fs::create_dir_all(path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "success": true }))
}

pub async fn handle_remove(params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    let p = Path::new(path);
    if p.is_dir() {
        tokio::fs::remove_dir_all(p).await.map_err(|e| e.to_string())?;
    } else {
        tokio::fs::remove_file(p).await.map_err(|e| e.to_string())?;
    }
    Ok(json!({ "success": true }))
}

pub async fn handle_rename(params: &Value) -> Result<Value, String> {
    let from = params["from"].as_str().ok_or("missing 'from'")?;
    let to = params["to"].as_str().ok_or("missing 'to'")?;
    tokio::fs::rename(from, to)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "success": true }))
}

pub async fn handle_stat(params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    let metadata = tokio::fs::metadata(path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({
        "size": metadata.len(),
        "is_dir": metadata.is_dir(),
        "is_file": metadata.is_file(),
        "modified": metadata.modified().ok().map(|t| {
            t.duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
        }),
    }))
}

pub async fn handle_create_file(params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    let content = params.get("content").and_then(|v| v.as_str()).unwrap_or("");
    tokio::fs::write(path, content)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "success": true }))
}

pub async fn handle_create_dir(params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    tokio::fs::create_dir(path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "success": true }))
}

// ---------------------------------------------------------------------------
// Workspace handlers
// ---------------------------------------------------------------------------

pub fn handle_workspace_open(state: &AppState, params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;
    state.set_workspace(path);

    let root = Path::new(path);
    let tree = murder_workspace::FileTree::scan(root);

    let nodes = serialize_tree_nodes(&tree);
    Ok(json!({ "root": path, "nodes": nodes }))
}

pub fn handle_workspace_expand(state: &AppState, params: &Value) -> Result<Value, String> {
    let path = params["path"].as_str().ok_or("missing 'path'")?;

    let ws = state.workspace.lock();
    let ws = ws.as_ref().ok_or("No workspace open")?;

    let node = ws.file_tree().find(Path::new(path))
        .ok_or_else(|| format!("Path not in tree: {path}"))?;

    let children: Vec<Value> = node.children.iter()
        .flatten()
        .map(|c| json!({
            "name": c.name,
            "path": c.path.to_string_lossy(),
            "is_dir": c.is_dir,
        }))
        .collect();

    Ok(json!({ "children": children }))
}

fn serialize_tree_nodes(tree: &murder_workspace::FileTree) -> Vec<Value> {
    fn serialize_node(node: &murder_workspace::FileNode) -> Value {
        json!({
            "name": node.name,
            "path": node.path.to_string_lossy(),
            "is_dir": node.is_dir,
            "children": node.children.as_ref().map(|c| {
                c.iter().map(serialize_node).collect::<Vec<_>>()
            }),
        })
    }
    vec![serialize_node(&tree.root)]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn detect_language(path: &str) -> String {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "rs" => "rust".into(),
        "ts" | "tsx" => "typescript".into(),
        "js" | "jsx" => "javascript".into(),
        "py" => "python".into(),
        "rb" => "ruby".into(),
        "go" => "go".into(),
        "java" => "java".into(),
        "c" | "h" => "c".into(),
        "cpp" | "cc" | "cxx" | "hpp" => "cpp".into(),
        "cs" => "csharp".into(),
        "css" | "scss" | "less" => "css".into(),
        "html" | "htm" => "html".into(),
        "json" => "json".into(),
        "md" | "markdown" => "markdown".into(),
        "sh" | "bash" | "zsh" => "shellscript".into(),
        "yml" | "yaml" => "yaml".into(),
        "toml" => "toml".into(),
        "xml" => "xml".into(),
        "sql" => "sql".into(),
        "php" => "php".into(),
        "swift" => "swift".into(),
        "kt" | "kts" => "kotlin".into(),
        "lua" => "lua".into(),
        "r" => "r".into(),
        "dart" => "dart".into(),
        "scala" => "scala".into(),
        "perl" | "pl" => "perl".into(),
        "hs" => "haskell".into(),
        "ex" | "exs" => "elixir".into(),
        "erl" | "hrl" => "erlang".into(),
        "clj" | "cljs" => "clojure".into(),
        _ => "plaintext".into(),
    }
}
