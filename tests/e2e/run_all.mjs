#!/usr/bin/env node
/**
 * Node.js CLI Runner Proxy for Escolar Navigation E2E Test Suite
 * Spawns python to execute tests/e2e/run_all.py on Windows / cross-platform.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pythonScript = join(__dirname, 'run_all.py');

const args = [pythonScript, ...process.argv.slice(2)];
const pyProcess = spawn('python', args, { stdio: 'inherit', shell: true });

pyProcess.on('close', (code) => {
  process.exit(code ?? 0);
});
