import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSpecSync,
  checkModuleLimitations,
  checkOverclaimsInFile,
  runGates,
  getCommitMessages,
  VALID_MODULE_KEYS,
  DEFAULT_CODE_TO_SPEC_RULES,
} from './check-agent-gates.mjs';

const SAMPLE_OVERCLAIM_RULES = [
  {
    glob: 'frontend/src/**/*.tsx',
    pattern: 'enviad[ao] (?:para a|à) prefeitura|assinada e enviada para a prefeitura',
    label: 'NFS-e alegando envio real à prefeitura',
  },
  {
    glob: 'frontend/src/**/*.tsx',
    pattern: 'WhatsApp enviado|enviadas? via WhatsApp|WhatsApp oficial conectado',
    label: 'WhatsApp alegando envio real ou conexão oficial',
  },
  {
    glob: 'frontend/src/**/*.tsx',
    pattern: 'mensagem enviada via',
    label: 'Mensagem alegando envio externo real',
  },
  {
    glob: 'frontend/src/**/*.tsx',
    pattern: 'boleto registrado',
    label: 'Boleto bancário alegando registro em produção',
  },
  {
    glob: 'frontend/src/**/*.tsx',
    pattern: 'produção PSP',
    label: 'PSP bancário alegando produção ativa',
  },
  {
    glob: 'frontend/src/**/*.tsx',
    pattern: 'push entregue',
    label: 'Push notification alegando entrega externa confirmada',
  },
];

// -----------------------------------------------------------------------------
// Regra 1: Sincronização Código ↔ Spec no modo diff
// -----------------------------------------------------------------------------
test('Regra 1 (Vermelho): alterar backend/src/handlers/financeiro.rs sem tocar openspec/modules/financeiro.md faz o gate falhar em modo diff', () => {
  const result = checkSpecSync({
    changedFiles: ['backend/src/handlers/financeiro.rs'],
    commitMessages: ['fix(financeiro): refatora calculo de juros'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });

  assert.equal(result.passed, false, 'Deveria falhar pois a spec não foi alterada');
  assert.equal(result.escaped, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].codeFile, 'backend/src/handlers/financeiro.rs');
  assert.equal(result.violations[0].expectedSpec, 'openspec/modules/financeiro.md');
});

test('Regra 1 (Verde): alterar backend/src/handlers/financeiro.rs tocando openspec/modules/financeiro.md passa', () => {
  const result = checkSpecSync({
    changedFiles: [
      'backend/src/handlers/financeiro.rs',
      'openspec/modules/financeiro.md',
    ],
    commitMessages: ['feat(financeiro): novas regras de juros e multa'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });

  assert.equal(result.passed, true, 'Deveria passar com código e spec no diff');
  assert.equal(result.violations.length, 0);
});

test('Regra 1 (Extensões canônicas): worker/** exige agenda_calendario.md e migrations/** exige CORE_SPEC.md', () => {
  // Vermelho para worker
  const resWorkerFail = checkSpecSync({
    changedFiles: ['worker/src/index.js'],
    commitMessages: ['fix(worker): ajuste no loop de push'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });
  assert.equal(resWorkerFail.passed, false);
  assert.equal(resWorkerFail.violations[0].expectedSpec, 'openspec/modules/agenda_calendario.md');

  // Verde para worker
  const resWorkerPass = checkSpecSync({
    changedFiles: ['worker/src/index.js', 'openspec/modules/agenda_calendario.md'],
    commitMessages: ['fix(worker): ajuste no loop de push documentado'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });
  assert.equal(resWorkerPass.passed, true);

  // Vermelho para migrations
  const resMigFail = checkSpecSync({
    changedFiles: ['backend/migrations/20261003000000_nova_tabela.sql'],
    commitMessages: ['feat: nova tabela'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });
  assert.equal(resMigFail.passed, false);
  assert.equal(resMigFail.violations[0].expectedSpec, 'openspec/CORE_SPEC.md');

  // Verde para migrations
  const resMigPass = checkSpecSync({
    changedFiles: [
      'backend/migrations/20261003000000_nova_tabela.sql',
      'openspec/CORE_SPEC.md',
    ],
    commitMessages: ['feat: nova tabela e core spec atualizado'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });
  assert.equal(resMigPass.passed, true);
});

test('Regra 1 (Pastas do B12): agenda/, pedagogico/ e portal_aluno/ exigem o spec do módulo', () => {
  const casos = [
    ['frontend/src/components/agenda/ComposerModal.tsx', 'openspec/modules/agenda_calendario.md'],
    ['frontend/src/components/pedagogico/MatrizPanel.tsx', 'openspec/modules/academico.md'],
    ['frontend/src/components/portal_aluno/BoletimTab.tsx', 'openspec/modules/academico.md'],
    ['frontend/src/components/financeiro/ReceberPanel.tsx', 'openspec/modules/financeiro.md'],
    ['frontend/src/components/secretaria/matricula/DadosAlunoTab.tsx', 'openspec/modules/secretaria.md'],
  ];
  for (const [arquivo, spec] of casos) {
    const falha = checkSpecSync({
      changedFiles: [arquivo],
      commitMessages: ['refactor: mover painel'],
      codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
    });
    assert.equal(falha.passed, false, arquivo);
    assert.equal(falha.violations[0].expectedSpec, spec, arquivo);

    const ok = checkSpecSync({
      changedFiles: [arquivo, spec],
      commitMessages: ['refactor: mover painel documentado'],
      codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
    });
    assert.equal(ok.passed, true, arquivo);
  }
});

// -----------------------------------------------------------------------------
// Regra 2: Escape Spec-Sync: n/a <módulo>: <motivo>
// -----------------------------------------------------------------------------
test('Regra 2 (Verde): Spec-Sync: n/a <módulo>: <motivo> no commit libera o par e imprime aviso', () => {
  const result = checkSpecSync({
    changedFiles: ['backend/src/handlers/financeiro.rs'],
    commitMessages: [
      'refactor(financeiro): formatacao e tipos\n\nSpec-Sync: n/a financeiro: refatoracao sem mudanca de regra',
    ],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });

  assert.equal(result.passed, true, 'Deveria passar pois o escape está ativo');
  assert.equal(result.escaped, true);
  assert.equal(result.validEscapes[0].module, 'financeiro');
  assert.equal(result.validEscapes[0].reason, 'refatoracao sem mudanca de regra');
  assert.equal(result.violations.length, 0);
});

test('Regra 2 (Vermelho): commit sem Spec-Sync não libera a pendência', () => {
  const result = checkSpecSync({
    changedFiles: ['backend/src/handlers/financeiro.rs'],
    commitMessages: ['refactor(financeiro): formatacao e tipos'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });

  assert.equal(result.passed, false);
  assert.equal(result.escaped, false);
  assert.equal(result.violations.length, 1);
});

test('Regra 2 (Vermelho): escape sem motivo, ou sem módulo, falha com mensagem explicando o formato', () => {
  // Sem módulo e sem motivo
  const resNoModNoReason = checkSpecSync({
    changedFiles: ['backend/src/handlers/financeiro.rs'],
    commitMessages: ['Spec-Sync: n/a'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });
  assert.equal(resNoModNoReason.passed, false);
  assert.equal(resNoModNoReason.invalidEscapes.length, 1);
  assert.match(resNoModNoReason.invalidEscapes[0].error, /Formato esperado/i);

  // Sem motivo (só módulo)
  const resNoReason = checkSpecSync({
    changedFiles: ['backend/src/handlers/financeiro.rs'],
    commitMessages: ['Spec-Sync: n/a financeiro'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });
  assert.equal(resNoReason.passed, false);
  assert.equal(resNoReason.invalidEscapes.length, 1);
  assert.match(resNoReason.invalidEscapes[0].error, /Formato esperado/i);

  // Motivo com menos de 10 caracteres
  const resShortReason = checkSpecSync({
    changedFiles: ['backend/src/handlers/financeiro.rs'],
    commitMessages: ['Spec-Sync: n/a financeiro: curto'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });
  assert.equal(resShortReason.passed, false);
  assert.equal(resShortReason.invalidEscapes.length, 1);
  assert.match(resShortReason.invalidEscapes[0].error, /pelo menos 10 caracteres/i);

  // Módulo inválido/desconhecido
  const resUnknownMod = checkSpecSync({
    changedFiles: ['backend/src/handlers/financeiro.rs'],
    commitMessages: ['Spec-Sync: n/a modulo_invalido: motivo com mais de dez caracteres'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });
  assert.equal(resUnknownMod.passed, false);
  assert.equal(resUnknownMod.invalidEscapes.length, 1);
  assert.match(resUnknownMod.invalidEscapes[0].error, /desconhecido/i);
});

test('Regra 2 (Módulo isolado): escape do módulo X NÃO libera mudança no módulo Y', () => {
  const result = checkSpecSync({
    changedFiles: [
      'backend/src/handlers/financeiro.rs',
      'backend/src/handlers/secretaria.rs',
    ],
    commitMessages: [
      'Spec-Sync: n/a financeiro: refatoracao de tipos e formatacao no handler',
    ],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });

  assert.equal(result.passed, false, 'Deveria falhar pois secretaria não foi liberado');
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].codeFile, 'backend/src/handlers/secretaria.rs');
  assert.equal(result.validEscapes.length, 1);
  assert.equal(result.validEscapes[0].module, 'financeiro');
});

test('Regra 2 (Modo local sem herança): escape em commit anterior NÃO libera mudança nova não commitada (modo local)', () => {
  const messages = getCommitMessages({ base: null });
  assert.deepEqual(messages, []);

  const result = checkSpecSync({
    changedFiles: ['backend/src/handlers/financeiro.rs'],
    commitMessages: messages,
    specSyncSkip: undefined,
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });

  assert.equal(result.passed, false, 'Modo local sem SPEC_SYNC_SKIP deve falhar mesmo se commit anterior tinha escape');
});

test('Regra 2 (SPEC_SYNC_SKIP): SPEC_SYNC_SKIP válido libera só o módulo citado, com aviso', () => {
  const passRes = checkSpecSync({
    changedFiles: ['backend/src/handlers/financeiro.rs'],
    commitMessages: [],
    specSyncSkip: 'financeiro: refatoracao de tipos no handler local',
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });

  assert.equal(passRes.passed, true);
  assert.equal(passRes.escaped, true);
  assert.equal(passRes.validEscapes[0].module, 'financeiro');

  const failRes = checkSpecSync({
    changedFiles: [
      'backend/src/handlers/financeiro.rs',
      'backend/src/handlers/secretaria.rs',
    ],
    commitMessages: [],
    specSyncSkip: 'financeiro: refatoracao de tipos no handler local',
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });

  assert.equal(failRes.passed, false, 'SPEC_SYNC_SKIP de financeiro não libera secretaria');
  assert.equal(failRes.violations.length, 1);
  assert.equal(failRes.violations[0].codeFile, 'backend/src/handlers/secretaria.rs');
});

test('Regra 2 (Múltiplos escapes): aceita múltiplas linhas Spec-Sync no mesmo commit', () => {
  const result = checkSpecSync({
    changedFiles: [
      'backend/src/handlers/financeiro.rs',
      'backend/migrations/20261003000000_teste.sql',
    ],
    commitMessages: [
      'feat: ajuste em financeiro e migration\n\nSpec-Sync: n/a financeiro: refatoracao sem regra nova\nSpec-Sync: n/a core: migration sem alteracao de schema',
    ],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });

  assert.equal(result.passed, true);
  assert.equal(result.escaped, true);
  assert.equal(result.validEscapes.length, 2);
  assert.equal(result.violations.length, 0);
});

// -----------------------------------------------------------------------------
// Regra 3: Seção "Estado real / Limitações MVP" com conteúdo
// -----------------------------------------------------------------------------
test('Regra 3 (Vermelho): Seção "Limitações MVP" vazia faz o gate falhar', () => {
  const emptySection = `
# Módulo Financeiro

## 0. Limitações MVP

## 1. Regras de Cobrança
Texto seguinte...
`;
  const result = checkModuleLimitations(emptySection, 'openspec/modules/financeiro.md');
  assert.equal(result.passed, false, 'Seção vazia deve falhar');
  assert.match(result.error, /vazia ou insuficiente/i);
});

test('Regra 3 (Vermelho): Seção sem cabeçalho nível 2 correspondente falha', () => {
  const noHeader = `
# Módulo Financeiro
Apenas texto geral sem cabecalho de limitacoes.
`;
  const result = checkModuleLimitations(noHeader, 'openspec/modules/financeiro.md');
  assert.equal(result.passed, false);
  assert.match(result.error, /deve conter título nível 2/i);
});

test('Regra 3 (Verde): Seção com tabela de status passa', () => {
  const withTable = `
# Módulo Financeiro

## 0. Estado real do produto (leitura obrigatória)

| Capacidade | Status |
|---|---|
| Faturamento e Carnês | Implementado |
| Gateway Cora (webhook) | Implementado |
| NFS-e ABRASF | Fora de escopo MVP |

## 1. Detalhes
`;
  const result = checkModuleLimitations(withTable, 'openspec/modules/financeiro.md');
  assert.equal(result.passed, true, 'Seção com tabela de status deve passar');
});

test('Regra 3 (Verde): Seção com pelo menos 3 linhas de texto passa', () => {
  const withThreeLines = `
# Módulo Exemplo

## Limitações MVP
Primeira linha explicando o estado atual da funcionalidade.
Segunda linha detalhando que a integração externa opera em modo stub.
Terceira linha esclarecendo os limites arquiteturais do produto.

## 1. Próxima seção
`;
  const result = checkModuleLimitations(withThreeLines, 'openspec/modules/exemplo.md');
  assert.equal(result.passed, true, 'Seção com 3 linhas de texto deve passar');
});

// -----------------------------------------------------------------------------
// Regra 4: Overclaims na UI sem disclaimer
// -----------------------------------------------------------------------------
test('Regra 4 (Vermelho): Overclaim em .tsx sem disclaimer estrito falha', () => {
  const fileContent = `
export function BoletoCard() {
  return <div>Status: boleto registrado no banco parceiro</div>;
}
`;
  const violations = checkOverclaimsInFile(
    'frontend/src/components/BoletoCard.tsx',
    fileContent,
    SAMPLE_OVERCLAIM_RULES
  );

  assert.equal(violations.length, 1, 'Deve detectar 1 violação de overclaim');
  assert.equal(violations[0].label, 'Boleto bancário alegando registro em produção');
});

test('Regra 4 (Verde): Overclaim acompanhado de disclaimer estrito passa', () => {
  const fileContent = `
export function BoletoCard() {
  // Simulado neste MVP: boleto registrado internamente sem transmissão bancária real
  return (
    <div>
      <span className="badge">boleto registrado</span>
      <small>Ambiente simulado (MVP)</small>
    </div>
  );
}
`;
  const violations = checkOverclaimsInFile(
    'frontend/src/components/BoletoCard.tsx',
    fileContent,
    SAMPLE_OVERCLAIM_RULES
  );

  assert.equal(violations.length, 0, 'Não deve apontar violação quando há disclaimer estrito');
});

// -----------------------------------------------------------------------------
// Regra 5: localStorage próximo NÃO neutraliza overclaim
// -----------------------------------------------------------------------------
test('Regra 5 (Vermelho): localStorage próximo NÃO neutraliza overclaim', () => {
  const fileContent = `
export function MensagemWhatsApp() {
  const handleSend = () => {
    localStorage.setItem('last_action', 'envio');
    showNotification('WhatsApp enviado com sucesso para o responsável');
    const cache = localStorage.getItem('historico');
  };
  return <button onClick={handleSend}>Enviar</button>;
}
`;
  const violations = checkOverclaimsInFile(
    'frontend/src/components/MensagemWhatsApp.tsx',
    fileContent,
    SAMPLE_OVERCLAIM_RULES
  );

  assert.equal(
    violations.length,
    1,
    'localStorage próximo não pode neutralizar o overclaim de WhatsApp enviado'
  );
  assert.equal(violations[0].label, 'WhatsApp alegando envio real ou conexão oficial');
});

// -----------------------------------------------------------------------------
// Teste de Integração com runGates
// -----------------------------------------------------------------------------
test('Integração runGates: executa com parâmetros customizados e reflete falhas / sucessos', () => {
  // Caso de falha de diff
  const failRun = runGates({
    root: process.cwd(),
    changedFiles: ['backend/src/handlers/financeiro.rs'],
    commitMessages: ['feat: juros'],
    silent: true,
  });
  assert.equal(failRun.success, false, 'runGates deve falhar quando há pendência no diff');

  // Caso de sucesso com escape
  const passRun = runGates({
    root: process.cwd(),
    changedFiles: ['backend/src/handlers/financeiro.rs'],
    commitMessages: ['feat: juros\n\nSpec-Sync: n/a financeiro: refatoracao sem regra nova'],
    silent: true,
  });
  assert.equal(passRun.success, true, 'runGates deve passar quando há escape');
});

// -----------------------------------------------------------------------------
// Caminhos depois do B13 (handlers em diretório) e handlers novos da Onda C
// -----------------------------------------------------------------------------
test('Regra 1 (pós-B13): arquivos de handlers em diretório e handlers novos continuam exigindo a spec do módulo', () => {
  const casos = [
    ['backend/src/handlers/financeiro/dre.rs', 'openspec/modules/financeiro.md'],
    ['backend/src/handlers/nutricao/pratos.rs', 'openspec/modules/nutricao.md'],
    ['backend/src/handlers/crm_lms/whatsapp.rs', 'openspec/modules/crm_atendimento.md'],
    ['backend/src/handlers/crm_lms/lms.rs', 'openspec/modules/lms_integracao.md'],
    ['backend/src/handlers/professor.rs', 'openspec/modules/academico.md'],
    ['backend/src/handlers/documentos.rs', 'openspec/modules/secretaria.md'],
    ['backend/src/handlers/avaliacoes.rs', 'openspec/modules/agenda_calendario.md'],
    ['backend/src/handlers/usuarios.rs', 'openspec/CORE_SPEC.md'],
    ['frontend/src/components/ProfessorSection.tsx', 'openspec/modules/academico.md'],
  ];
  for (const [arquivo, spec] of casos) {
    const result = checkSpecSync({
      changedFiles: [arquivo],
      commitMessages: ['feat: mudanca sem spec'],
      codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
    });
    assert.equal(result.passed, false, `${arquivo} deveria exigir ${spec}`);
    assert.equal(result.violations[0].expectedSpec, spec, arquivo);
  }

  const regulatorio = checkSpecSync({
    changedFiles: ['backend/src/handlers/regulatorio_ia/evasao/mod.rs', 'openspec/modules/ia_preditiva.md'],
    commitMessages: ['feat(ia): ajuste'],
    codeToSpecRules: DEFAULT_CODE_TO_SPEC_RULES,
  });
  assert.equal(regulatorio.passed, true, 'regulatorio_ia/** aceita a spec de IA ou de Regulatório');
});
