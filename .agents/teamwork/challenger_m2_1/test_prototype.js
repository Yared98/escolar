// Prototype to verify Node module resolution and compilation
const fs = require('fs');
const path = require('path');
const sucrase = require('../../frontend/node_modules/sucrase');

console.log('Testing Sucrase loader...');
const agendaPath = path.resolve(__dirname, '../../frontend/src/components/AgendaDigitalSection.tsx');
const agendaContent = fs.readFileSync(agendaPath, 'utf8');
const transformed = sucrase.transform(agendaContent, {
  transforms: ['typescript', 'jsx', 'imports']
});
console.log('Transformed AgendaDigitalSection successfully, length:', transformed.code.length);
