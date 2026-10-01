import os

with open('frontend/src/components/AgendaDigitalSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add AlunoResumo interface
interface_proto = """interface AtendimentoProtocolo {
  id: string;
  protocolo: string;
  telefone_contato: string;
  assunto: string;
  status: string;
  setor_transbordo?: string;
  ultima_mensagem?: string;
  resposta_enviada?: string;
  created_at: string;
}"""

interface_aluno = """
interface AlunoResumo {
  id: string;
  nome: string;
  nome_responsavel: string;
}"""

content = content.replace(interface_proto, interface_proto + interface_aluno)

# 2. Add state
state_proto = "const [protocolos, setProtocolos] = useState<AtendimentoProtocolo[]>([]);"
state_aluno = """
  const [alunos, setAlunos] = useState<AlunoResumo[]>([]);
  const [destinatarioId, setDestinatarioId] = useState<string>('');"""

content = content.replace(state_proto, state_proto + state_aluno)

# 3. Add to loadAgendaData
load_proto = """      const [msgData, rotData, protoData] = await Promise.all([
        apiFetch<MensagemAgenda[]>('/agenda/mensagens').catch(() => []),
        apiFetch<RotinaDiariaInfantil[]>(`/agenda/rotina/${sampleAlunoId}`).catch(() => []),
        apiFetch<AtendimentoProtocolo[]>('/atendimento/protocolos').catch(() => [])
      ]);"""
load_aluno = """      const [msgData, rotData, protoData, alunosData] = await Promise.all([
        apiFetch<MensagemAgenda[]>('/agenda/mensagens').catch(() => []),
        apiFetch<RotinaDiariaInfantil[]>(`/agenda/rotina/${sampleAlunoId}`).catch(() => []),
        apiFetch<AtendimentoProtocolo[]>('/atendimento/protocolos').catch(() => []),
        apiFetch<AlunoResumo[]>('/secretaria/alunos').catch(() => [])
      ]);
      setAlunos(alunosData || []);"""

content = content.replace(load_proto, load_aluno)

# 4. Modify handleEnviarMensagem payload
payload_old = """          conteudo: novaMsg,
          destinatario_id: null,
          turma_id: null,"""
payload_new = """          conteudo: novaMsg,
          destinatario_id: tipoEnvio === 'aluno' && destinatarioId ? destinatarioId : null,
          turma_id: null,"""

content = content.replace(payload_old, payload_new)

# 5. Add dropdown in form
form_old = """            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={novaMsg}"""

form_new = """            </div>

            {tipoEnvio === 'aluno' && (
              <div className="flex flex-col space-y-1 mb-2">
                <span className="font-bold text-slate-900 dark:text-salvia-50 text-xs">Selecione o Pai/Responsável:</span>
                <select
                  value={destinatarioId}
                  onChange={(e) => setDestinatarioId(e.target.value)}
                  className="bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-lg px-2 py-2 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-2 focus:ring-salvia-500 text-xs w-full"
                  required={tipoEnvio === 'aluno'}
                >
                  <option value="" disabled>Escolha um responsável para receber a mensagem...</option>
                  {alunos.map(aluno => (
                    <option key={aluno.id} value={aluno.id}>
                      {aluno.nome_responsavel} (Pai/Mãe de {aluno.nome})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={novaMsg}"""

content = content.replace(form_old, form_new)

with open('frontend/src/components/AgendaDigitalSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
