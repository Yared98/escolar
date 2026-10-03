# Especificação de Negócio: CRM & Atendimento (`openspec/modules/crm_atendimento.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo cobre o **Funil Comercial de Captação de Alunos (CRM)** e o **Gerenciador Interno de Protocolos de Atendimento**.
Não há integração oficial ativa com a Meta Cloud API para envio de mensagens ativas a números externos neste momento.

| Capacidade | Status |
|---|---|
| Pipeline e Estágios de Leads (`novo_lead` a `matriculado`) | Implementado |
| Ação CRM → Matrícula (pré-preenchimento na Secretaria) | Implementado |
| Rastreabilidade e Timeline de Interações | Implementado |
| Métricas Analíticas de Conversão e CAC | Implementado |
| Gestão de Protocolos e Filas de Transbordo Humanizado | Implementado |
| Resposta a Protocolos com Auditoria | Implementado |
| Receptor de Webhook & Classificador de Palavras-chave | Implementado (Simulação in-process local) |
| WhatsApp Cloud API Oficial / Meta Graph API Ativa | **Fora de escopo MVP** (mensagens simuladas/armazenadas em banco; sem disparo externo) |
| IA Generativa / LLM conversacional no Chatbot | **Fora de escopo MVP** (substituído por menu de palavras-chave locais) |

---

## 1. CRM Educacional & Funil de Captação
- **Jornada do Lead**: Injeção e rastreamento de interessados no pipeline comercial nos estágios:
  - `novo_lead`: Lead capturado aguardando primeiro contato.
  - `visita_agendada`: Família convidada para conhecer as instalações escolares.
  - `proposta_enviada`: Apresentação da grade curricular e valores de anuidade/mensalidade.
  - `matriculado`: Aluno convertido e integrado à Secretaria Escolar.
  - `perdido`: Lead que optou por outra instituição ou descontinuou a negociação.
- **Ação Rápida CRM → Matrícula Online**:
  - No card do lead em estágio `matriculado`, é exibido o CTA **Abrir matrícula**.
  - O clique navega para `/?route=secretaria&tab=alunos&nova_matricula=1` com parâmetros `lead_nome`, `lead_telefone`, `lead_email` e `lead_aluno` (extraído de observações `Aluno: ...`), acionando a abertura do modal de Nova Matrícula pré-preenchido.
- **Rastreabilidade e Timeline de Interações**:
  - Tabela `lead_interacoes` registrando registros de contato, visitas presenciais e histórico de mudanças de estágio com identificador do consultor (`usuario_id`).
- **Endpoints do Funil Comercial**:
  - `POST /api/v1/crm/leads`: Captura de lead com tenant, custos de mídia e canal.
    - Request Body: `{ "nome": "String", "telefone": "String", "email": "String?", "canal": "String?", "estagio": "String?", "custo_aquisicao": "f64?" }`
    - Response 201: `{ "id": "UUID", "nome": "String", "estagio": "novo_lead", ... }`
  - `GET /api/v1/crm/leads`: Listagem com filtros reativos por estágio (`?estagio=...`) e canal (`?canal=...`).
  - `GET /api/v1/crm/leads/:lead_id`: Detalhes do lead acompanhado do histórico cronológico de interações.
  - `PUT /api/v1/crm/leads/:lead_id`: Atualização cadastral com gravação automática de evento `mudanca_estagio`.
  - `POST /api/v1/crm/leads/:lead_id/interacoes`: Registro de nova interação comercial.
  - `GET /api/v1/crm/relatorios/funil`: Relatório consolidado com distribuição volumétrica por estágio.
- **Métricas Analíticas & Cálculo de CAC (Custo de Aquisição por Aluno)**:
  - $\text{CAC} = \frac{\sum \text{custo\_aquisicao}}{\text{Total de Alunos Matriculados}}$
  - $\text{Taxa de Conversão (\%)} = \frac{\text{Total de Matriculados}}{\text{Total de Leads}} \times 100$

---

## 2. Central de Atendimento & Protocolos

- **Receptor Local de Mensagens**:
  - `GET /api/v1/atendimento/whatsapp/webhook`: Validação simples de handshake via `hub.challenge` e `hub.verify_token`.
  - `POST /api/v1/atendimento/whatsapp/webhook`: Receptor que processa mensagens e aciona o classificador local por palavras-chave.
- **Classificador Local de Autosserviço por Palavras-Chave**:
  - Sanitização de números telefônicos (`limpar_telefone`).
  - Reconhecimento automático de intenções:
    1. **2ª Via Pix (`pix_2a_via`)**: Localiza o estudante pelo telefone do responsável cadastrado em `alunos` e consulta faturas em aberto.
    2. **Cardápio Escolar (`cardapio`)**: Informações sobre alimentação escolar e link para o mural nutricional.
    3. **Horários & Portaria (`horarios`)**: Horários de entrada/saída por turno.
    4. **Transbordo Humanizado (`transbordo_humano`)**: Gera protocolo único (`ATD-2026-XXXXXXXX`), grava registro em `atendimento_protocolos` e direciona a fila para secretários ou tesoureiros.
    5. **Menu Interativo de Saudação (`saudacao`)**: Menu de opções guiadas.
- **Gestão de Transbordo Humanizado**:
  - `GET /api/v1/atendimento/protocolos`: Painel operacional para secretários e tesouraria listarem atendimentos em espera (`status = 'aberto' | 'em_atendimento' | 'resolvido'`).
  - `POST /api/v1/atendimento/protocolos/:id/responder`: Envio de resposta registrada internamente e encerramento do protocolo com log de auditoria.
    - Request Body: `{ "resposta": "String", "novo_status": "resolvido" }`
