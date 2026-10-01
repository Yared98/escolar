import Dexie, { type EntityTable } from 'dexie';

export interface LocalSyncEvent {
  id?: number;
  uuid: string;
  tenant_id: string;
  entity: string; // 'attendance', 'grade', 'lesson_plan'
  action: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  created_at: string;
  status: 'pending_sync' | 'pending' | 'synced' | 'failed';
}

const db = new Dexie('EscolarOfflineDB') as Dexie & {
  sync_events: EntityTable<LocalSyncEvent, 'id'>;
};

// Schema de tabela no IndexedDB local
db.version(1).stores({
  sync_events: '++id, uuid, tenant_id, entity, status, created_at',
});

db.version(2).stores({
  sync_events: '++id, uuid, tenant_id, entity, status, created_at',
}).upgrade((tx) =>
  tx.table('sync_events').toCollection().modify((event: LocalSyncEvent) => {
    if (event.status === 'pending') {
      event.status = 'pending_sync';
    }
  })
);

export { db };
