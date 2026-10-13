use super::{
    check_roles, json, ActiveTenant, AppError, AppState, AuthUser, BroadcastStream, Duration,
    Event, Extension, Infallible, KeepAlive, Sse, State, Stream, StreamExt,
};

/// SSE: atualização em tempo real das mensagens do tenant.
pub async fn stream_mensagens_agenda(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "secretaria",
            "professor",
            "nutricionista",
            "responsavel",
        ],
    )?;
    let tenant_id = active_tenant.0;
    let user_id = auth_user.id;
    let role = auth_user.role.to_lowercase();
    let rx = state.message_hub.subscribe(tenant_id);

    let intro = futures_util::stream::once(async move {
        Ok::<Event, Infallible>(
            Event::default().event("conectado").data(
                json!({
                    "tenant_id": tenant_id,
                    "user_id": user_id
                })
                .to_string(),
            ),
        )
    });

    let live = BroadcastStream::new(rx).filter_map(move |result| {
        let role = role.clone();
        async move {
            match result {
                Ok(evt) => {
                    let relevante = evt.remetente_id == user_id
                        || evt.destinatario_id == Some(user_id)
                        || matches!(
                            role.as_str(),
                            "admin" | "gestor" | "secretaria" | "professor" | "nutricionista"
                        )
                        || evt.canal == "mural_turma"
                        || evt.canal == "responsavel";
                    if !relevante {
                        return None;
                    }
                    let payload = serde_json::to_string(&evt).ok()?;
                    Some(Ok(Event::default().event("mensagem_nova").data(payload)))
                }
                Err(tokio_stream::wrappers::errors::BroadcastStreamRecvError::Lagged(_)) => {
                    Some(Ok(Event::default().event("resync").data("{}")))
                }
            }
        }
    });

    let stream = intro.chain(live);
    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(20))
            .text("ping"),
    ))
}
