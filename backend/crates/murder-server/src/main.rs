use std::sync::Arc;
use tokio::sync::Mutex;

use murder_server::{AppState, run_server, terminal_event_bridge};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Set up terminal event broadcasting:
    // crossbeam channel (from TerminalManager) → bridge task → tokio broadcast → all clients
    let mut tm = murder_terminal::TerminalManager::new();
    let event_rx = tm.set_event_channel();
    let event_tx = tokio::sync::broadcast::Sender::new(1024);

    // Spawn the bridge task: reads from crossbeam channel, broadcasts JSON to all WebSocket clients
    let bridge_tx = event_tx.clone();
    tokio::spawn(terminal_event_bridge(event_rx, bridge_tx));

    let app = Arc::new(Mutex::new(AppState::with_terminals(tm, event_tx)));
    run_server(app, 3928).await;
}
