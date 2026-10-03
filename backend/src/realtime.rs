use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct MensagemRealtimeEvent {
    pub tipo: String,
    pub tenant_id: Uuid,
    pub mensagem_id: Uuid,
    pub thread_id: Option<Uuid>,
    pub remetente_id: Uuid,
    pub destinatario_id: Option<Uuid>,
    pub titulo: String,
    pub conteudo: String,
    pub canal: String,
}

#[derive(Clone, Default)]
pub struct MessageHub {
    inner: Arc<Mutex<HashMap<Uuid, broadcast::Sender<MensagemRealtimeEvent>>>>,
}

impl MessageHub {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn subscribe(&self, tenant_id: Uuid) -> broadcast::Receiver<MensagemRealtimeEvent> {
        let mut map = self.inner.lock().expect("message hub lock");
        if let Some(tx) = map.get(&tenant_id) {
            return tx.subscribe();
        }
        let (tx, rx) = broadcast::channel(256);
        map.insert(tenant_id, tx);
        rx
    }

    pub fn publish(&self, event: MensagemRealtimeEvent) {
        let mut map = self.inner.lock().expect("message hub lock");
        let tx = map.entry(event.tenant_id).or_insert_with(|| {
            let (tx, _) = broadcast::channel(256);
            tx
        });
        let _ = tx.send(event);
    }
}
