#!/usr/bin/env node
/**
 * Script para execução manual das migrations de seed demo no banco de dados.
 * Em produção (APP_ENV=production), estas migrations são filtradas no boot do backend.
 * Este script permite rodar o seed demo explicitamente via CLI quando necessário.
 *
 * Uso:
 *   node scripts/seed-demo.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Carrega variáveis do .env se presente
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/escolar_db';

const SEED_FILES = [
  '20260929180000_seed_demo_escola_modelo.sql',
  '20260929234000_seed_responsavel_demo.sql',
  '20260930120000_fix_responsavel_vinculo_comunicacao.sql',
  '20260930160000_seed_financeiro_e_contatos_familia.sql',
  '20261009000000_seed_demo_enriquecimento_D4.sql',
];

async function main() {
  console.log('🌱 Executando seeds demo no banco de dados...');
  console.log(`📡 Conexão: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  let Client;
  try {
    const pgModule = await import('pg');
    Client = pgModule.default?.Client || pgModule.Client;
  } catch {
    try {
      const pgModule = await import('../worker/node_modules/pg/lib/index.js');
      Client = pgModule.default?.Client || pgModule.Client;
    } catch (err) {
      console.error('❌ Módulo "pg" não encontrado. Instale as dependências ou execute em um ambiente Node com pg instalado.');
      process.exit(1);
    }
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    for (const filename of SEED_FILES) {
      const filePath = path.join(rootDir, 'backend', 'migrations', filename);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Arquivo de seed não encontrado: ${filename}`);
        continue;
      }

      console.log(`⏳ Aplicando ${filename}...`);
      const sql = fs.readFileSync(filePath, 'utf-8');
      await client.query(sql);
      console.log(`✅ ${filename} aplicado com sucesso.`);
    }

    console.log('🎉 Todos os seeds demo foram executados!');
  } catch (error) {
    console.error('❌ Erro ao executar seeds demo:', error.message || error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
