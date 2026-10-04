use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("User already exists for this tenant")]
    UserAlreadyExists,

    #[error("Tenant not found")]
    TenantNotFound,

    #[error("Missing or invalid X-Tenant-ID header")]
    MissingTenantHeader,

    #[error("Invalid token: {0}")]
    InvalidToken(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Resource not found")]
    NotFound,

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Too many requests: {0}")]
    TooManyRequests(String),

    #[error("Internal server error: {0}")]
    InternalServerError(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::DatabaseError(err) => {
                tracing::error!(database_error = %err, "Database query execution failure");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Erro interno de processamento no servidor.".to_string(),
                )
            }
            AppError::InvalidCredentials => (
                StatusCode::UNAUTHORIZED,
                "Invalid email or password".to_string(),
            ),
            AppError::UserAlreadyExists => (
                StatusCode::CONFLICT,
                "A user or school slug with this identifier already exists".to_string(),
            ),
            AppError::TenantNotFound => (
                StatusCode::NOT_FOUND,
                "Target school tenant not found".to_string(),
            ),
            AppError::MissingTenantHeader => (
                StatusCode::BAD_REQUEST,
                "Missing or invalid X-Tenant-ID header".to_string(),
            ),
            AppError::InvalidToken(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::NotFound => (
                StatusCode::NOT_FOUND,
                "The requested resource was not found".to_string(),
            ),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
            AppError::TooManyRequests(msg) => (StatusCode::TOO_MANY_REQUESTS, msg),
            AppError::ServiceUnavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg),
            AppError::InternalServerError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };

        let body = Json(json!({
            "error": error_message,
            "status": status.as_u16(),
        }));

        let mut res = (status, body).into_response();
        if status == StatusCode::TOO_MANY_REQUESTS {
            res.headers_mut().insert(
                axum::http::header::RETRY_AFTER,
                axum::http::HeaderValue::from_static("900"),
            );
        }
        res
    }
}
