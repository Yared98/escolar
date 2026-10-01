# Original User Request

## Initial Request — 2026-09-28T12:54:10Z

# Teamwork Project Prompt - Final

> Status: Launched
> Goal: Execute the refactoring task below.
> Requested team: Full team

Refactor the React application's navigation by migrating in-page submenus (tabs) from individual section components into collapsible sublists within the main Sidebar component. Expecting this to run with a full team to ensure a deep architectural review of the routing and component hierarchy.

Working directory: d:/Projetos/escolar
Integrity mode: development

## Requirements

### R1. Migrate local tabs to Sidebar submenus
Extract the internal tab navigations (e.g., 'Mensagens & Mural', 'Resumo de Rotina', 'WhatsApp' in Agenda, and similar in other sections) and move them into the main `Sidebar.tsx` as collapsible nested sublists. 

### R2. URL-based state management
Implement URL search parameters (e.g., `?tab=comunicacao`) to manage the active state of these sublists, allowing the UI state to be shareable via URL. Remove the `useState` local state management for tabs from the individual section components.

### R3. Remove redundant UI
Remove the original horizontal tab bar elements from the top of the individual `*Section.tsx` components so that the Sidebar is the sole source of navigation.

## Acceptance Criteria

### Verification Rubric (Agent-as-judge)
- [ ] `Sidebar.tsx` contains nested navigation items that append `?tab=` (or similar) query parameters to the URL.
- [ ] At least 3 section components (e.g., `AgendaDigitalSection.tsx`, `SecretariaSection.tsx`) no longer contain local `useState` for tab switching.
- [ ] The `*Section.tsx` components read the active tab from the URL (via `useSearchParams` or equivalent) to determine what content to render.
- [ ] The old horizontal tab UI elements (buttons changing local tabs) are completely removed from the section components.

## 2026-09-29T05:25:37Z

Revisão por módulos de funcionalidade do ERP Escolar (Secretaria, Financeiro, Acadêmico, CRM/LMS, Regulatório/IA, Administrativo), garantindo o fluxo de execução de ponta a ponta de cada rotina e a funcionalidade dinâmica das telas apresentando dados com ciclo de vida completo.

Working directory: d:/Projetos/escolar
Integrity mode: development

## Requirements

### R1. Auditoria e Validação de Fluxos E2E por Módulo
Auditar e validar a execução de ponta a ponta de todas as rotinas dos módulos no backend Rust e frontend Next.js PWA:
- **Secretaria & Prontuário**: Matrículas, turmas, ensalamento e contratos digitais.
- **Financeiro & Cobrança**: Faturas, despesas, conciliação e réguas de cobrança.
- **Gestão Acadêmica & Nutrição**: Diário de classe, boletim, simulados TRI e cardápios.
- **CRM, LMS & Regulatório**: Leads, integração LTI/SCORM, Educacenso e Diploma Digital MEC.

### R2. Integridade do Ciclo de Vida dos Dados na UI
Garantir que as telas do frontend Next.js PWA estejam 100% funcionais, consumindo os dados dos módulos backend ou stores locais, refletindo as alterações de estado (criação, leitura, atualização e deleção) em tempo real e sem componentes quebrados ou dados estáticos legados.

### R3. Resolução Ativa de Incêndios e Refatoração
Refatorar e corrigir ativamente quaisquer discrepâncias de contrato de API, tipos TypeScript ou bugs de renderização encontrados durante a revisão dos módulos.

## Acceptance Criteria

### Compilação e Testes
- [ ] Backend Rust passa em `cargo check` e `cargo test` sem falhas.
- [ ] Frontend Next.js compila com sucesso sem erros sintáticos ou de tipagem.

### Funcionalidade por Módulo
- [ ] Módulo Secretaria: fluxo completo de criação de aluno -> turma -> matrícula -> contrato verificado.
- [ ] Módulo Financeiro: fluxo de geração de fatura -> alteração de status/baixa -> conciliação verificado.
- [ ] Módulo Acadêmico: lançamento e consulta de notas/boletim e simulados TRI verificados.
- [ ] Módulo Regulatório & CRM: geração/exportação de relatórios Educacenso e captação de leads operacionais.
