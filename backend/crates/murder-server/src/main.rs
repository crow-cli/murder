use std::sync::Arc;
use tokio::sync::Mutex;

use murder_server::{AppState, run_server};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let app = Arc::new(Mutex::new(AppState::new()));
    run_server(app, 3928).await;
}
