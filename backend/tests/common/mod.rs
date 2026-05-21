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
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use tower::ServiceExt;
use vaultlock_backend::{app, auth::jwt::JwtConfig};

const TEST_JWT_SECRET: &str = "integration-test-jwt-secret";
const DEFAULT_TEST_DATABASE_URL: &str = "postgres://vaultlock:vaultlock@127.0.0.1:5432/vaultlock";

pub fn test_jwt_config() -> JwtConfig {
    JwtConfig {
        secret: TEST_JWT_SECRET.to_string(),
        access_token_expiry_minutes: 15,
        refresh_token_expiry_days: 7,
    }
}
const TEST_CLIENT_ADDR: SocketAddr =
    SocketAddr::new(std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST), 3000);

static DB_COUNTER: AtomicU64 = AtomicU64::new(0);

struct PostgresServer {
    admin_database_url: String,
}

static POSTGRES_SERVER: OnceLock<PostgresServer> = OnceLock::new();

fn admin_database_url(server_url: &str) -> String {
    let (base, _) = server_url
        .rsplit_once('/')
        .unwrap_or((server_url, "vaultlock"));
    format!("{base}/postgres")
}

fn resolve_test_database_url() -> String {
    if let Ok(url) = std::env::var("TEST_DATABASE_URL") {
        return url;
    }

    if std::net::TcpStream::connect("127.0.0.1:5432").is_ok() {
        return DEFAULT_TEST_DATABASE_URL.to_string();
    }

    panic!(
        "Integration tests need Postgres. Start it with `docker compose up postgres -d` \
         or run `pnpm test` / `sh scripts/test-backend.sh`. \
         You can also set TEST_DATABASE_URL explicitly."
    );
}

fn postgres_server() -> &'static PostgresServer {
    POSTGRES_SERVER.get_or_init(|| {
        let database_url = resolve_test_database_url();
        PostgresServer {
            admin_database_url: admin_database_url(&database_url),
        }
    })
}

fn next_database_name() -> String {
    let id = DB_COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    format!("vaultlock_test_{nanos}_{id}")
}

static ORPHAN_CLEANUP: OnceLock<()> = OnceLock::new();

async fn cleanup_orphan_test_databases(admin_url: &str) {
    let Ok(admin) = PgPoolOptions::new()
        .max_connections(1)
        .connect(admin_url)
        .await
    else {
        return;
    };

    let Ok(db_names) = sqlx::query_scalar::<_, String>(
        "SELECT datname FROM pg_database WHERE datname LIKE 'vaultlock_test_%'",
    )
    .fetch_all(&admin)
    .await
    else {
        admin.close().await;
        return;
    };

    for db_name in db_names {
        let drop_sql = format!(r#"DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)"#);
        let _ = sqlx::query(&drop_sql).execute(&admin).await;
    }

    admin.close().await;
}

async fn ensure_orphan_cleanup(admin_url: &str) {
    if ORPHAN_CLEANUP.get().is_some() {
        return;
    }
    cleanup_orphan_test_databases(admin_url).await;
    let _ = ORPHAN_CLEANUP.set(());
}

async fn create_database(admin_url: &str, db_name: &str) -> PgPool {
    let admin = PgPoolOptions::new()
        .max_connections(1)
        .connect(admin_url)
        .await
        .expect("postgres admin connection");

    let create_sql = format!(r#"CREATE DATABASE "{db_name}""#);
    sqlx::query(&create_sql)
        .execute(&admin)
        .await
        .expect("create test database");
    admin.close().await;

    let (base, _) = admin_url.rsplit_once('/').expect("admin database url");
    let database_url = format!("{base}/{db_name}");

    PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("postgres connection")
}

async fn drop_database(admin_url: &str, db_name: &str) {
    let Ok(admin) = PgPoolOptions::new()
        .max_connections(1)
        .connect(admin_url)
        .await
    else {
        return;
    };

    let drop_sql = format!(r#"DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)"#);
    let _ = sqlx::query(&drop_sql).execute(&admin).await;
    admin.close().await;
}

pub struct TestApp {
    pub pool: PgPool,
    router: Router,
    db_name: String,
    admin_database_url: String,
}

#[allow(dead_code)]
impl TestApp {
    pub async fn spawn() -> Self {
        std::env::set_var("JWT_SECRET", TEST_JWT_SECRET);

        let server = postgres_server();
        ensure_orphan_cleanup(&server.admin_database_url).await;
        let db_name = next_database_name();
        let pool = create_database(&server.admin_database_url, &db_name).await;

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("migrations");

        let router = app(pool.clone(), test_jwt_config());

        Self {
            pool,
            router,
            db_name,
            admin_database_url: server.admin_database_url.clone(),
        }
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

    pub async fn put_json_bearer(&self, uri: &str, body: &str, token: &str) -> Response {
        self.request_json("PUT", uri, body, Some(token)).await
    }

    pub async fn put_json(&self, uri: &str, body: &str) -> Response {
        self.request_json("PUT", uri, body, None).await
    }

    pub async fn delete_bearer(&self, uri: &str, token: &str) -> Response {
        self.request_json("DELETE", uri, "", Some(token)).await
    }

    pub async fn delete(&self, uri: &str) -> Response {
        self.request_json("DELETE", uri, "", None).await
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

impl Drop for TestApp {
    fn drop(&mut self) {
        let db_name = std::mem::take(&mut self.db_name);
        if db_name.is_empty() {
            return;
        }

        let admin_url = self.admin_database_url.clone();
        let pool = self.pool.clone();

        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("cleanup runtime");
            rt.block_on(async move {
                pool.close().await;
                drop_database(&admin_url, &db_name).await;
            });
        });
    }
}

pub fn assert_status(response: Response, expected: StatusCode) -> Response {
    assert_eq!(response.status(), expected);
    response
}
