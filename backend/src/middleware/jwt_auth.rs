use axum::{
    body::Body,
    extract::State,
    http::{header, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use uuid::Uuid;

use crate::{
    auth::jwt::{validate_token, Claims},
    AppState,
};

/// Authenticated user id injected by `jwt_auth_middleware` and read via `Extension`.
#[derive(Clone, Copy, Debug)]
pub struct AuthenticatedUser(pub Uuid);

pub async fn jwt_auth_middleware(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    let Some(token) = bearer_token(request.headers()) else {
        return unauthorized();
    };

    match validate_token(token, &state.jwt.secret) {
        Ok(Claims { sub, .. }) => {
            request.extensions_mut().insert(AuthenticatedUser(sub));
            next.run(request).await
        }
        Err(_) => unauthorized(),
    }
}

fn bearer_token(headers: &axum::http::HeaderMap) -> Option<&str> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    value.strip_prefix("Bearer ")
}

fn unauthorized() -> Response {
    StatusCode::UNAUTHORIZED.into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn extracts_bearer_token() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Bearer abc.def.ghi"),
        );
        assert_eq!(bearer_token(&headers), Some("abc.def.ghi"));
    }

    #[test]
    fn rejects_missing_authorization_header() {
        let headers = axum::http::HeaderMap::new();
        assert_eq!(bearer_token(&headers), None);
    }

    #[test]
    fn rejects_non_bearer_scheme() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Basic dXNlcjpwYXNz"),
        );
        assert_eq!(bearer_token(&headers), None);
    }
}
