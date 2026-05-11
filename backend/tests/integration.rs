use axum::body::Body;
use axum::http::{Request, StatusCode};
use testcontainers::{clients, images::postgres::Postgres};
use tokio::sync::OnceCell;
use tower::ServiceExt; // for `oneshot`
use vaultlock_backend::app; // we'll expose the router from main later

static DB: OnceCell<String> = OnceCell::const_new();

#[tokio::test]
async fn health_check_works() {
    let docker = clients::Cli::default();
    let postgres = docker.run(Postgres::default());

    let database_url = format!(
        "postgres://postgres:postgres@127.0.0.1:{}/postgres",
        postgres.get_host_port_ipv4(5432)
    );

    // In real code we would run migrations here
    // For now just test that the app starts

    let app = app(); // placeholder - we'll wire this properly

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
