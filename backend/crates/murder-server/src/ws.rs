//! WebSocket server — Axum + embedded static frontend.

use std::sync::Arc;

use axum::{
    body::Body,
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, Router},
};
use futures::{SinkExt, StreamExt};
use mime_guess::from_path;
use rust_embed::RustEmbed;
use serde_json::Value;
use tokio::sync::Mutex;

use crate::handlers;
use crate::router::{WsError, WsRequest, WsResponse};
use crate::state::AppState;

/// Shared state wrapped for Axum extraction.
pub type App = Arc<Mutex<AppState>>;

/// Embedded frontend assets (built by Vite into target/frontend)
#[derive(RustEmbed)]
#[folder = "../../../target/frontend"]
struct Assets;

pub async fn run_server(app: App, port: u16) {
    let router = Router::new()
        .route("/ws", get(ws_handler))
        .with_state(app)
        // Fallback: serve embedded frontend files
        .fallback(get(serve_embedded));

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Server listening on http://{addr}");
    tracing::info!("WebSocket at ws://{addr}/ws");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("failed to bind");

    axum::serve(listener, router).await.expect("server failed");
}

async fn ws_handler(ws: WebSocketUpgrade, State(app): State<App>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, app))
}

async fn handle_socket(mut socket: WebSocket, app: App) {
    tracing::info!("WebSocket client connected");

    while let Some(msg) = socket.recv().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                tracing::warn!("WebSocket error: {e}");
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                let result = handle_message(&text, &app).await;
                let response = serde_json::to_string(&result).unwrap_or_else(|_| {
                    r#"{"id":0,"error":"failed to serialize response"}"#.into()
                });
                if let Err(e) = socket.send(Message::Text(response)).await {
                    tracing::warn!("Failed to send response: {e}");
                    break;
                }
            }
            Message::Close(_) => {
                tracing::info!("WebSocket client disconnected");
                break;
            }
            _ => {}
        }
    }
}

async fn handle_message(text: &str, app: &App) -> Value {
    let request: WsRequest = match serde_json::from_str(text) {
        Ok(r) => r,
        Err(e) => {
            return serde_json::to_value(WsError {
                id: 0,
                error: format!("parse error: {e}"),
            })
            .unwrap_or_default();
        }
    };

    tracing::debug!("Received request: id={} method={}", request.id, request.method);

    let state = app.lock().await;

    let result: Result<Value, String> = match request.method.as_str() {
        // Document methods (sync, use AppState)
        "document_open" => handlers::handle_document_open(&state, &request.params),
        "document_close" => handlers::handle_document_close(&state, &request.params),
        "document_edit" => handlers::handle_document_edit(&state, &request.params),
        "document_set_content" => handlers::handle_document_set_content(&state, &request.params),
        "document_get_content" => handlers::handle_document_get_content(&state, &request.params),
        "document_get_info" => handlers::handle_document_get_info(&state, &request.params),

        // Document methods (async, use AppState + IO)
        "document_save" => handlers::handle_document_save(&state, &request.params).await,

        // Filesystem methods (async, no state needed)
        "read_dir" => handlers::handle_read_dir(&request.params).await,
        "read_file" => handlers::handle_read_file(&request.params).await,
        "write_file" => handlers::handle_write_file(&request.params).await,
        "exists" => handlers::handle_exists(&request.params).await,
        "mkdir" => handlers::handle_mkdir(&request.params).await,
        "remove" => handlers::handle_remove(&request.params).await,
        "rename" => handlers::handle_rename(&request.params).await,
        "stat" => handlers::handle_stat(&request.params).await,
        "create_file" => handlers::handle_create_file(&request.params).await,
        "create_dir" => handlers::handle_create_dir(&request.params).await,

        // Workspace methods
        "workspace_open" => handlers::handle_workspace_open(&state, &request.params),
        "workspace_expand" => handlers::handle_workspace_expand(&state, &request.params),

        unknown => Err(format!("unknown method: {unknown}")),
    };

    drop(state);

    match result {
        Ok(value) => {
            tracing::debug!("Success for id={}", request.id);
            serde_json::to_value(WsResponse { id: request.id, result: value }).unwrap_or_default()
        }
        Err(error) => {
            tracing::warn!("Error for id={}: {}", request.id, error);
            serde_json::to_value(WsError { id: request.id, error }).unwrap_or_default()
        }
    }
}

/// Serve embedded frontend assets.
async fn serve_embedded(uri: axum::http::Uri) -> Response<Body> {
    let mut path = uri.path().trim_start_matches('/').to_string();
    
    if path.is_empty() {
        path = "index.html".to_string();
    }

    // Handle SPA routes: if path has no extension and isn't a known asset, serve index.html
    let has_extension = path.contains('.');
    let is_known_asset = path.starts_with("assets/") || path == "index.html" || path == "vite.svg" || path == "tauri.svg";
    
    if !has_extension && !is_known_asset {
        path = "index.html".to_string();
    }

    match Assets::get(&path) {
        Some(file) => {
            let mime = from_path(&path).first_or_octet_stream();
            let mut headers = HeaderMap::new();
            headers.insert(
                axum::http::header::CONTENT_TYPE,
                HeaderValue::from_str(mime.as_ref()).unwrap_or(HeaderValue::from_static("application/octet-stream")),
            );
            // Cache static assets aggressively (except index.html)
            if path != "index.html" {
                headers.insert(
                    axum::http::header::CACHE_CONTROL,
                    HeaderValue::from_static("public, max-age=31536000, immutable"),
                );
            }
            (headers, file.data).into_response()
        }
        None => {
            // SPA fallback: return index.html for unknown routes
            match Assets::get("index.html") {
                Some(file) => {
                    let mut headers = HeaderMap::new();
                    headers.insert(
                        axum::http::header::CONTENT_TYPE,
                        HeaderValue::from_static("text/html; charset=utf-8"),
                    );
                    (headers, file.data).into_response()
                }
                None => StatusCode::NOT_FOUND.into_response(),
            }
        }
    }
}
