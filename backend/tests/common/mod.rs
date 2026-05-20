#![allow(clippy::expect_used)]

use axum::{
    body::{Body, Bytes},
    extract::ConnectInfo,
    http::{Request, StatusCode},
    response::Response,
    Router,
};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::mem;
use std::net::SocketAddr;
use testcontainers::{clients::Cli, core::WaitFor, GenericImage};
use tower::ServiceExt;
use vaultlock_backend::{app, auth::jwt::JwtConfig};

const TEST_JWT_SECRET: &str = "integration-test-jwt-secret";

pub fn test_jwt_config() -> JwtConfig {
    JwtConfig {
        secret: TEST_JWT_SECRET.to_string(),
        access_token_expiry_minutes: 15,
        refresh_token_expiry_days: 7,
    }
}
const TEST_CLIENT_ADDR: SocketAddr =
    SocketAddr::new(std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST), 3000);

pub struct TestApp {
    pub pool: PgPool,
    router: Router,
}

#[allow(dead_code)]
impl TestApp {
    pub async fn spawn() -> Self {
        std::env::set_var("JWT_SECRET", TEST_JWT_SECRET);

        let docker = Cli::default();
        let postgres = GenericImage::new("postgres", "16-alpine")
            .with_env_var("POSTGRES_USER", "postgres")
            .with_env_var("POSTGRES_PASSWORD", "postgres")
            .with_env_var("POSTGRES_DB", "vaultlock")
            .with_exposed_port(5432)
            .with_wait_for(WaitFor::message_on_stderr(
                "database system is ready to accept connections",
            ));
        let container = docker.run(postgres);
        let port = container.get_host_port_ipv4(5432);
        mem::forget(container);
        mem::forget(docker);

        let database_url = format!("postgres://postgres:postgres@127.0.0.1:{port}/vaultlock");

        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("postgres connection");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("migrations");

        let router = app(pool.clone(), test_jwt_config());

        Self { pool, router }
    }

    pub async fn post_json(&self, uri: &str, body: &str) -> Response {
        self.request_json("POST", uri, body, None).await
    }

    pub async fn get(&self, uri: &str) -> Response {
        self.request_json("GET", uri, "", None).await
    }

    pub async fn post_json_bearer(&self, uri: &str, body: &str, token: &str) -> Response {
        self.request_json("POST", uri, body, Some(token)).await
    }

    pub async fn get_bearer(&self, uri: &str, token: &str) -> Response {
        self.request_json("GET", uri, "", Some(token)).await
    }

    async fn request_json(
        &self,
        method: &str,
        uri: &str,
        body: &str,
        bearer_token: Option<&str>,
    ) -> Response {
        let mut builder = Request::builder()
            .method(method)
            .uri(uri)
            .header("content-type", "application/json")
            .extension(ConnectInfo(TEST_CLIENT_ADDR));

        if let Some(token) = bearer_token {
            builder = builder.header("authorization", format!("Bearer {token}"));
        }

        let request = builder.body(Body::from(body.to_string())).expect("request");

        self.router
            .clone()
            .oneshot(request)
            .await
            .expect("response")
    }

    pub async fn response_body(response: Response) -> Bytes {
        axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body")
    }
}

pub fn assert_status(response: Response, expected: StatusCode) -> Response {
    assert_eq!(response.status(), expected);
    response
}
