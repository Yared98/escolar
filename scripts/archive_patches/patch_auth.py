import os

with open('backend/src/handlers/auth.rs', 'r', encoding='utf-8') as f:
    content = f.read()

features_fetch = """
    let flags = sqlx::query_scalar::<_, String>(
        "SELECT feature_name FROM tenant_feature_flags WHERE tenant_id = $1 AND is_enabled = true"
    )
    .bind(auth_user.tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let mut response: crate::models::user::UserResponseDto = user.into();
    response.features = flags;

    Ok(Json(response))
"""

content = content.replace(
    "Ok(Json(user.into()))\n}",
    features_fetch + "\n}"
)

# And for login endpoint
login_fetch = """
    let flags = sqlx::query_scalar::<_, String>(
        "SELECT feature_name FROM tenant_feature_flags WHERE tenant_id = $1 AND is_enabled = true"
    )
    .bind(user.tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let mut user_dto: crate::models::user::UserResponseDto = user.into();
    user_dto.features = flags;

    Ok(Json(LoginResponseDto {
        token,
        tenant: tenant.into(),
        user: user_dto,
    }))
"""

content = content.replace(
    "Ok(Json(LoginResponseDto {\n        token,\n        tenant: tenant.into(),\n        user: user.into(),\n    }))",
    login_fetch
)

with open('backend/src/handlers/auth.rs', 'w', encoding='utf-8') as f:
    f.write(content)
