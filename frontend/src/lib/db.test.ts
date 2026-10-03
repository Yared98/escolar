import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { db, type LocalSyncEvent } from './db';

describe('Offline DB (Dexie & Outbox)', () => {
  beforeEach(async () => {
    await db.sync_events.clear();
  });

  afterEach(async () => {
    await db.sync_events.clear();
  });

  it('salva evento criado offline com status pending_sync', async () => {
    const novoEvento: LocalSyncEvent = {
      uuid: 'uuid-1234',
      tenant_id: 'tenant-demo',
      entity: 'attendance',
      action: 'create',
      payload: { turma_id: 'turma-1', presencas: [{ aluno_id: 'aluno-1', presente: true }] },
      created_at: new Date().toISOString(),
      status: 'pending_sync',
    };

    const id = await db.sync_events.add(novoEvento);
    expect(id).toBeDefined();

    const salvo = await db.sync_events.get(id);
    expect(salvo).toBeDefined();
    expect(salvo?.status).toBe('pending_sync');
    expect(salvo?.uuid).toBe('uuid-1234');
    expect(salvo?.payload).toEqual(novoEvento.payload);
  });

  it('transiciona status para synced após sincronização bem-sucedida', async () => {
    const id = await db.sync_events.add({
      uuid: 'uuid-sync-ok',
      tenant_id: 'tenant-demo',
      entity: 'grade',
      action: 'update',
      payload: { aluno_id: 'aluno-2', nota: 8.5 },
      created_at: new Date().toISOString(),
      status: 'pending_sync',
    });

    await db.sync_events.update(id, { status: 'synced' });

    const atualizado = await db.sync_events.get(id);
    expect(atualizado?.status).toBe('synced');
  });

  it('transiciona status para failed e permanece reenviável na outbox', async () => {
    const id = await db.sync_events.add({
      uuid: 'uuid-sync-fail',
      tenant_id: 'tenant-demo',
      entity: 'lesson_plan',
      action: 'create',
      payload: { plano: 'Aula de história' },
      created_at: new Date().toISOString(),
      status: 'pending_sync',
    });

    // Simula falha na sincronização
    await db.sync_events.update(id, { status: 'failed' });

    const falho = await db.sync_events.get(id);
    expect(falho?.status).toBe('failed');

    // Consulta de eventos reenviáveis (pendentes ou com falha prévia)
    const reenviaveis = await db.sync_events
      .filter((ev) => ev.status === 'pending_sync' || ev.status === 'failed')
      .toArray();

    expect(reenviaveis).toHaveLength(1);
    expect(reenviaveis[0].uuid).toBe('uuid-sync-fail');
  });

  it('migração v1 para v2 converte registros pending legados para pending_sync preservando dados', async () => {
    const dbName = 'MigrationTestDB_' + Date.now();

    // 1. Instancia v1 e insere registros
    const testDbV1 = new Dexie(dbName);
    testDbV1.version(1).stores({
      sync_events: '++id, uuid, tenant_id, entity, status, created_at',
    });
    await testDbV1.open();

    await testDbV1.table('sync_events').add({
      uuid: 'uuid-legado-pending',
      tenant_id: 'tenant-1',
      entity: 'attendance',
      action: 'create',
      payload: { test: 123 },
      created_at: '2026-09-01T00:00:00Z',
      status: 'pending',
    });

    await testDbV1.table('sync_events').add({
      uuid: 'uuid-legado-synced',
      tenant_id: 'tenant-1',
      entity: 'grade',
      action: 'update',
      payload: { nota: 10 },
      created_at: '2026-09-01T00:00:00Z',
      status: 'synced',
    });

    testDbV1.close();

    // 2. Instancia com versão 2 e roda upgrade exatamente como em db.ts
    const testDbV2 = new Dexie(dbName);
    testDbV2.version(1).stores({
      sync_events: '++id, uuid, tenant_id, entity, status, created_at',
    });
    testDbV2
      .version(2)
      .stores({
        sync_events: '++id, uuid, tenant_id, entity, status, created_at',
      })
      .upgrade((tx) =>
        tx
          .table('sync_events')
          .toCollection()
          .modify((event: LocalSyncEvent) => {
            if (event.status === 'pending') {
              event.status = 'pending_sync';
            }
          })
      );

    await testDbV2.open();

    const eventos = await testDbV2.table('sync_events').toArray();
    expect(eventos).toHaveLength(2);

    const migrado = eventos.find((e) => e.uuid === 'uuid-legado-pending');
    expect(migrado?.status).toBe('pending_sync');
    expect(migrado?.payload).toEqual({ test: 123 });

    const mantido = eventos.find((e) => e.uuid === 'uuid-legado-synced');
    expect(mantido?.status).toBe('synced');
    expect(mantido?.payload).toEqual({ nota: 10 });

    testDbV2.close();
    await Dexie.delete(dbName);
  });
});
