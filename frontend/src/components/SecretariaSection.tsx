'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatCpf, formatPhone, formatCep } from '@/lib/formatters';
import {
  Aluno,
  AlunosPage,
  AlunoStatusContagem,
  ProntuarioData,
  Turma,
  AlunoTurmaDetalhado,
  Sala,
  ProfessorItem,
  ProntuarioModal,
  EnsalamentoModal,
  ContratosPanel,
  labelStatusAluno,
  statusAlunoBadgeClass,
  proximasAcoesStatus,
} from './secretaria';
import {
  UserCheck,
  PlusCircle,
  Search,
  Trash2,
  X,
  Users,
  UserPlus,
  HeartPulse,
  Shield,
  ShieldAlert,
  Edit3,
  Save,
  ArrowRightLeft,
  ListOrdered,
  DoorOpen,
  GraduationCap,
  School,
  RotateCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreVertical,
  MapPin,
  Phone,
  CheckSquare,
  Square,
  FileText,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

const PAGE_SIZE = 25;

export function SecretariaSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const [activeTabLocal, setActiveTabLocal] = useState<'alunos' | 'turmas' | 'contratos'>(() => {
    if (tabParam === 'turmas' || tabParam === 'contratos') return tabParam;
    return 'alunos';
  });

  useEffect(() => {
    if (tabParam === 'turmas' || tabParam === 'contratos' || tabParam === 'alunos') {
      setActiveTabLocal(tabParam);
    }
  }, [tabParam]);

  const activeTab: 'alunos' | 'turmas' | 'contratos' = activeTabLocal;

  const handleTabChange = (tab: 'alunos' | 'turmas' | 'contratos') => {
    setActiveTabLocal(tab);
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('route', 'secretaria');
    params.set('tab', tab);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasCatalogo, setTurmasCatalogo] = useState<Turma[]>([]);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('ativo');
  const [filtroTurmaId, setFiltroTurmaId] = useState('');
  const [filtroSemTurma, setFiltroSemTurma] = useState(false);
  const [filtroAnoLetivo, setFiltroAnoLetivo] = useState<string>('');
  const [page, setPage] = useState(1);
  const [alunosReloadToken, setAlunosReloadToken] = useState(0);
  const [totalAlunos, setTotalAlunos] = useState(0);
  const [contagemStatus, setContagemStatus] = useState<AlunoStatusContagem[]>([]);
  const [alunosEnsalamento, setAlunosEnsalamento] = useState<Aluno[]>([]);
  const [menuStatusAlunoId, setMenuStatusAlunoId] = useState<string | null>(null);
  const [statusInicialMatricula, setStatusInicialMatricula] = useState<'ativo' | 'pre_matricula'>('ativo');
  const [filtroTurmaTexto, setFiltroTurmaTexto] = useState('');
  const [filtroTurmaTextoDebounced, setFiltroTurmaTextoDebounced] = useState('');
  const [filtroTurmaAno, setFiltroTurmaAno] = useState('');
  const [filtroTurmaTurno, setFiltroTurmaTurno] = useState('');
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<'dados_aluno' | 'responsaveis' | 'endereco_contato' | 'prontuario'>('dados_aluno');
  const [origemCrm, setOrigemCrm] = useState(false);
  const lastConsumedLeadRef = useRef<string | null>(null);
  const [showTurmaModal, setShowTurmaModal] = useState(false);
  const [showEnsalamentoModal, setShowEnsalamentoModal] = useState(false);
  const [selectedTurmaParaEnsalamento, setSelectedTurmaParaEnsalamento] = useState<Turma | null>(null);
  const [selectedAlunoIdParaEnsalamento, setSelectedAlunoIdParaEnsalamento] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [ensalamentoSuccess, setEnsalamentoSuccess] = useState<string | null>(null);

  // Prontuário Modal state (view / edit)
  const [selectedProntuarioModal, setSelectedProntuarioModal] = useState<{
    aluno: Aluno;
    prontuario: ProntuarioData;
  } | null>(null);
  const [isEditingProntuario, setIsEditingProntuario] = useState(false);
  const [editTipoSanguineo, setEditTipoSanguineo] = useState('O+');
  const [editAlergias, setEditAlergias] = useState('');
  const [editRestricoes, setEditRestricoes] = useState('');
  const [editMedicamentos, setEditMedicamentos] = useState('');
  const [editCuidados, setEditCuidados] = useState('');
  const [editHistorico, setEditHistorico] = useState('');
  const [prontuarioSuccess, setProntuarioSuccess] = useState<string | null>(null);

  // Form state - Aluno & Responsáveis
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('2012-05-15');

  // Responsável Legal
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [cpfResponsavelLegal, setCpfResponsavelLegal] = useState('');
  const [emailResponsavel, setEmailResponsavel] = useState('');
  const [telefoneResponsavel, setTelefoneResponsavel] = useState('');
  const [parentescoResponsavelLegal, setParentescoResponsavelLegal] = useState('Mãe');

  // Responsável Financeiro (Unificado ou Separado)
  const [responsavelFinanceiroIgualLegal, setResponsavelFinanceiroIgualLegal] = useState(true);
  const [nomeResponsavelFinanceiro, setNomeResponsavelFinanceiro] = useState('');
  const [cpfResponsavelFinanceiro, setCpfResponsavelFinanceiro] = useState('');
  const [emailResponsavelFinanceiro, setEmailResponsavelFinanceiro] = useState('');
  const [telefoneResponsavelFinanceiro, setTelefoneResponsavelFinanceiro] = useState('');
  const [parentescoResponsavelFinanceiro, setParentescoResponsavelFinanceiro] = useState('Pai');

  // Endereço Residencial
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('São Paulo');
  const [estado, setEstado] = useState('SP');

  // Contatos Secundários & Emergência
  const [telefoneSecundario, setTelefoneSecundario] = useState('');
  const [contatoEmergenciaNome, setContatoEmergenciaNome] = useState('');
  const [contatoEmergenciaTelefone, setContatoEmergenciaTelefone] = useState('');
  const [contatoEmergenciaParentesco, setContatoEmergenciaParentesco] = useState('Avó');

  // Prontuário Médico Inicial
  const [tipoSanguineo, setTipoSanguineo] = useState('O+');
  const [alergias, setAlergias] = useState('');
  const [restricoesAlimentares, setRestricoesAlimentares] = useState('');
  const [medicamentosContinuos, setMedicamentosContinuos] = useState('');
  const [cuidadosEspeciais, setCuidadosEspeciais] = useState('');
  const [historicoObservacoes, setHistoricoObservacoes] = useState('');

  // Form state Turma
  const [nomeTurma, setNomeTurma] = useState('');
  const [codigoTurma, setCodigoTurma] = useState('');
  const [etapaEnsinoTurma, setEtapaEnsinoTurma] = useState('Ensino Fundamental I');
  const [serieTurma, setSerieTurma] = useState('1º Ano');
  const [turnoTurma, setTurnoTurma] = useState('Matutino');
  const [anoLetivoTurma, setAnoLetivoTurma] = useState(2026);
  const [capacidadeTurma, setCapacidadeTurma] = useState(30);
  const [salaIdTurma, setSalaIdTurma] = useState('');
  const [professorRegenteIdTurma, setProfessorRegenteIdTurma] = useState('');

  // Auxiliares pedagógicos
  const [salas, setSalas] = useState<Sala[]>([]);
  const [professores, setProfessores] = useState<ProfessorItem[]>([]);

  // Modal Alunos & Chamada da Turma
  const [selectedTurmaAlunosModal, setSelectedTurmaAlunosModal] = useState<Turma | null>(null);
  const [turmaAlunos, setTurmaAlunos] = useState<AlunoTurmaDetalhado[]>([]);
  const [loadingTurmaAlunos, setLoadingTurmaAlunos] = useState(false);
  const [turmaAlunosMsg, setTurmaAlunosMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Transferência de Aluno
  const [alunoParaTransferir, setAlunoParaTransferir] = useState<AlunoTurmaDetalhado | null>(null);
  const [turmaDestinoTransferenciaId, setTurmaDestinoTransferenciaId] = useState('');
  const [transferindo, setTransferindo] = useState(false);

  const loadCatalogo = useCallback(async () => {
    const settled = await Promise.allSettled([
      apiFetch<Turma[]>('/secretaria/turmas'),
      apiFetch<Sala[]>('/secretaria/salas'),
      apiFetch<ProfessorItem[]>('/academico/professores/disponiveis'),
    ]);
    const [turmasRes, salasRes, profsRes] = settled;
    const erros: string[] = [];

    if (turmasRes.status === 'fulfilled') {
      const items = (turmasRes.value || []).map((t) => {
        const matriculados = t.alunos_matriculados ?? 0;
        return {
          ...t,
          alunos_matriculados: matriculados,
          vagas_restantes:
            t.vagas_restantes ?? Math.max(0, (t.capacidade_maxima || 0) - matriculados),
        };
      });
      setTurmasCatalogo(items);
      setTurmas((prev) => (prev.length === 0 ? items : prev));
    } else {
      setTurmasCatalogo([]);
      erros.push('turmas');
    }

    if (salasRes.status === 'fulfilled') {
      setSalas(salasRes.value || []);
    } else {
      setSalas([]);
      erros.push('salas');
    }

    if (profsRes.status === 'fulfilled') {
      setProfessores(profsRes.value || []);
    } else {
      setProfessores([]);
    }

    if (erros.length > 0) {
      setFetchError(
        `Não foi possível carregar: ${erros.join(', ')}. Verifique a conexão com o servidor.`
      );
    }
  }, []);

  const loadTurmas = useCallback(async () => {
    setLoadingTurmas(true);
    try {
      const params = new URLSearchParams();
      if (filtroTurmaTextoDebounced.trim()) {
        params.set('q', filtroTurmaTextoDebounced.trim());
      }
      if (filtroTurmaAno) {
        params.set('ano_letivo', filtroTurmaAno);
      }
      if (filtroTurmaTurno) {
        params.set('turno', filtroTurmaTurno);
      }
      const qs = params.toString();
      const endpoint = qs ? `/secretaria/turmas?${qs}` : '/secretaria/turmas';
      const data = await apiFetch<Turma[]>(endpoint);
      const items = (data || []).map((t) => {
        const matriculados = t.alunos_matriculados ?? 0;
        return {
          ...t,
          alunos_matriculados: matriculados,
          vagas_restantes:
            t.vagas_restantes ?? Math.max(0, (t.capacidade_maxima || 0) - matriculados),
        };
      });
      setTurmas(items);
    } catch (err: unknown) {
      setTurmas([]);
      setFetchError(err instanceof Error ? err.message : 'Não foi possível carregar as turmas.');
    } finally {
      setLoadingTurmas(false);
    }
  }, [filtroTurmaTextoDebounced, filtroTurmaAno, filtroTurmaTurno]);

  const buildAlunosQuery = useCallback(
    (opts?: { page?: number; forEnsalamento?: boolean }) => {
      const params = new URLSearchParams();
      const pageNum = opts?.page ?? page;
      params.set('page', String(pageNum));
      params.set('limit', String(opts?.forEnsalamento ? 200 : PAGE_SIZE));

      if (opts?.forEnsalamento) {
        params.set('status', 'ativo');
        params.set('sem_turma', 'true');
        return params.toString();
      }

      if (searchDebounced.trim()) params.set('q', searchDebounced.trim());
      if (filtroStatus && filtroStatus !== 'todos') params.set('status', filtroStatus);
      if (filtroStatus === 'todos') params.set('status', 'todos');
      if (filtroTurmaId) params.set('turma_id', filtroTurmaId);
      if (filtroSemTurma) params.set('sem_turma', 'true');
      if (filtroAnoLetivo) params.set('ano_letivo', filtroAnoLetivo);
      return params.toString();
    },
    [page, searchDebounced, filtroStatus, filtroTurmaId, filtroSemTurma, filtroAnoLetivo]
  );

  const loadAlunos = useCallback(async () => {
    setAlunosReloadToken((token) => token + 1);
  }, []);

  const loadAlunosEnsalamento = useCallback(async () => {
    try {
      const data = await apiFetch<AlunosPage>(
        `/secretaria/alunos?${buildAlunosQuery({ forEnsalamento: true, page: 1 })}`
      );
      setAlunosEnsalamento(data.items || []);
    } catch {
      setAlunosEnsalamento([]);
    }
  }, [buildAlunosQuery]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => setFiltroTurmaTextoDebounced(filtroTurmaTexto), 350);
    return () => clearTimeout(t);
  }, [filtroTurmaTexto]);

  useEffect(() => {
    void loadTurmas();
  }, [loadTurmas]);

  // Busca/filtros: volta à página 1 no mesmo ciclo de evento dos chips/handlers
  // (efeito só para debounce de busca, que não passa por handler síncrono).
  useEffect(() => {
    setPage(1);
  }, [searchDebounced]);

  useEffect(() => {
    void loadCatalogo();
  }, [loadCatalogo]);

  // Carrega alunos com cancelamento: evita resposta antiga zerar a lista ao trocar rota/filtro.
  useEffect(() => {
    if (activeTab !== 'alunos') return;
    let cancelled = false;
    async function carregarAlunos() {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await apiFetch<AlunosPage | Aluno[]>(
          `/secretaria/alunos?${buildAlunosQuery()}`
        );
        if (cancelled) return;

        if (Array.isArray(data)) {
          setAlunos(data);
          setTotalAlunos(data.length);
          setContagemStatus([]);
        } else {
          setAlunos(data.items ?? []);
          setTotalAlunos(data.total ?? 0);
          setContagemStatus(data.contagem_status ?? []);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        // Mantém lista anterior; só sinaliza o erro (evita flash vazio em race/401).
        setFetchError(err instanceof Error ? err.message : 'Não foi possível carregar os alunos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void carregarAlunos();
    return () => {
      cancelled = true;
    };
  }, [buildAlunosQuery, alunosReloadToken, activeTab]);

  useEffect(() => {
    if (!searchParams) return;
    const isNovaMatricula =
      searchParams.get('nova_matricula') === '1' ||
      searchParams.get('nova_matricula') === 'true' ||
      searchParams.get('modal') === 'nova_matricula';

    if (isNovaMatricula) {
      const querySignature = searchParams.toString();
      if (lastConsumedLeadRef.current === querySignature) return;
      lastConsumedLeadRef.current = querySignature;

      const leadNome = searchParams.get('lead_nome') || searchParams.get('nome_responsavel') || '';
      const leadTelefone = searchParams.get('lead_telefone') || searchParams.get('telefone') || '';
      const leadEmail = searchParams.get('lead_email') || searchParams.get('email') || '';
      const leadAluno = searchParams.get('lead_aluno') || searchParams.get('nome_aluno') || searchParams.get('aluno') || '';

      if (leadAluno) {
        setNome(leadAluno);
      } else if (leadNome) {
        setNome(leadNome);
      }
      if (leadNome) {
        setNomeResponsavel(leadNome);
      }
      if (leadTelefone) {
        setTelefoneResponsavel(formatPhone(leadTelefone));
      }
      if (leadEmail) {
        setEmailResponsavel(leadEmail);
      }

      setOrigemCrm(true);
      setFormError(null);
      setFormSuccess(null);
      setModalTab('dados_aluno');
      setShowModal(true);
    }
  }, [searchParams]);

  const handleMatricular = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const rawCpf = cpf.replace(/\D/g, '');
    if (rawCpf.length !== 11) {
      setFormError('CPF do aluno deve conter exatamente 11 dígitos.');
      return;
    }

    if (!nome.trim() || !nomeResponsavel.trim()) {
      setFormError('Nome do aluno e nome do responsável legal são obrigatórios.');
      return;
    }

    try {
      const payload = {
        nome,
        cpf,
        data_nascimento: dataNascimento,
        nome_responsavel: nomeResponsavel,
        cpf_responsavel_legal: cpfResponsavelLegal ? cpfResponsavelLegal : undefined,
        email_responsavel: emailResponsavel,
        telefone_responsavel: telefoneResponsavel,
        parentesco_responsavel_legal: parentescoResponsavelLegal,
        responsavel_financeiro_igual_legal: responsavelFinanceiroIgualLegal,
        nome_responsavel_financeiro: responsavelFinanceiroIgualLegal ? nomeResponsavel : nomeResponsavelFinanceiro,
        cpf_responsavel_financeiro: responsavelFinanceiroIgualLegal ? cpfResponsavelLegal : cpfResponsavelFinanceiro,
        email_responsavel_financeiro: responsavelFinanceiroIgualLegal ? emailResponsavel : emailResponsavelFinanceiro,
        telefone_responsavel_financeiro: responsavelFinanceiroIgualLegal ? telefoneResponsavel : telefoneResponsavelFinanceiro,
        parentesco_responsavel_financeiro: responsavelFinanceiroIgualLegal ? parentescoResponsavelLegal : parentescoResponsavelFinanceiro,
        cep: cep || undefined,
        logradouro: logradouro || undefined,
        numero: numero || undefined,
        complemento: complemento || undefined,
        bairro: bairro || undefined,
        cidade: cidade || undefined,
        estado: estado || undefined,
        telefone_secundario: telefoneSecundario || undefined,
        contato_emergencia_nome: contatoEmergenciaNome || undefined,
        contato_emergencia_telefone: contatoEmergenciaTelefone || undefined,
        contato_emergencia_parentesco: contatoEmergenciaParentesco || undefined,
        tipo_sanguineo: tipoSanguineo || 'Não informado',
        alergias: alergias || undefined,
        restricoes_alimentares: restricoesAlimentares || undefined,
        medicamentos_continuos: medicamentosContinuos || undefined,
        cuidados_especiais: cuidadosEspeciais || undefined,
        historico_observacoes: historicoObservacoes || undefined,
        status: statusInicialMatricula,
      };

      await apiFetch<Aluno>('/secretaria/matriculas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setFormSuccess(
        statusInicialMatricula === 'pre_matricula'
          ? 'Pré-matrícula cadastrada com sucesso!'
          : 'Matrícula e prontuário inicial cadastrados com sucesso!'
      );
      setTimeout(() => {
        setShowModal(false);
        resetForm();
        void loadAlunos();
        void loadCatalogo();
      }, 900);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '';
      if (errorMsg.includes('409') || errorMsg.toLowerCase().includes('conflito') || errorMsg.toLowerCase().includes('duplicate')) {
        setFormError('CPF já cadastrado para esta instituição de ensino (Conflito 409).');
      } else {
        setFormError(errorMsg || 'Não foi possível concluir a matrícula.');
      }
    }
  };

  const resetForm = () => {
    setNome('');
    setCpf('');
    setNomeResponsavel('');
    setCpfResponsavelLegal('');
    setEmailResponsavel('');
    setTelefoneResponsavel('');
    setResponsavelFinanceiroIgualLegal(true);
    setNomeResponsavelFinanceiro('');
    setCpfResponsavelFinanceiro('');
    setEmailResponsavelFinanceiro('');
    setTelefoneResponsavelFinanceiro('');
    setCep('');
    setLogradouro('');
    setNumero('');
    setComplemento('');
    setBairro('');
    setTelefoneSecundario('');
    setContatoEmergenciaNome('');
    setContatoEmergenciaTelefone('');
    setAlergias('');
    setRestricoesAlimentares('');
    setMedicamentosContinuos('');
    setCuidadosEspeciais('');
    setHistoricoObservacoes('');
    setStatusInicialMatricula('ativo');
    setOrigemCrm(false);
    setFormSuccess(null);
    setFormError(null);
    setModalTab('dados_aluno');
  };

  const resetTurmaForm = () => {
    setNomeTurma('');
    setCodigoTurma('');
    setEtapaEnsinoTurma('Ensino Fundamental I');
    setSerieTurma('1º Ano');
    setTurnoTurma('Matutino');
    setAnoLetivoTurma(2026);
    setCapacidadeTurma(30);
    setSalaIdTurma('');
    setProfessorRegenteIdTurma('');
  };

  const handleCriarTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nome: nomeTurma,
        codigo: codigoTurma || undefined,
        etapa_ensino: etapaEnsinoTurma,
        serie: serieTurma || undefined,
        turno: turnoTurma,
        ano_letivo: anoLetivoTurma,
        capacidade_maxima: capacidadeTurma,
        sala_id: salaIdTurma || undefined,
        professor_regente_id: professorRegenteIdTurma || undefined,
      };
      const novaTurma = await apiFetch<Turma>('/secretaria/turmas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const salaEscolhida = salas.find((s) => s.id === salaIdTurma);
      const profEscolhido = professores.find((p) => p.id === professorRegenteIdTurma);
      const turmaComDetalhes: Turma = {
        ...novaTurma,
        sala_nome: salaEscolhida ? salaEscolhida.nome : undefined,
        professor_regente_nome: profEscolhido ? profEscolhido.name : undefined,
        alunos_matriculados: 0,
        vagas_restantes: capacidadeTurma,
      };
      setTurmas((prev) => [turmaComDetalhes, ...prev]);
      setTurmasCatalogo((prev) => [turmaComDetalhes, ...prev]);
      setShowTurmaModal(false);
      resetTurmaForm();
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível criar a turma.');
    }
  };

  const handleVerAlunosTurma = async (turma: Turma) => {
    setSelectedTurmaAlunosModal(turma);
    setLoadingTurmaAlunos(true);
    setTurmaAlunosMsg(null);
    setAlunoParaTransferir(null);
    try {
      const data = await apiFetch<AlunoTurmaDetalhado[]>(`/secretaria/turmas/${turma.id}/alunos`);
      setTurmaAlunos(data);
    } catch (err: unknown) {
      setTurmaAlunos([]);
      setTurmaAlunosMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível carregar os alunos da turma.',
      });
    } finally {
      setLoadingTurmaAlunos(false);
    }
  };

  const handleRenumerarChamada = async () => {
    if (!selectedTurmaAlunosModal) return;
    try {
      await apiFetch(`/secretaria/turmas/${selectedTurmaAlunosModal.id}/renumerar-chamada`, {
        method: 'POST',
      });
      const data = await apiFetch<AlunoTurmaDetalhado[]>(`/secretaria/turmas/${selectedTurmaAlunosModal.id}/alunos`);
      setTurmaAlunos(data);
      setTurmaAlunosMsg({ type: 'success', text: 'Chamada renumerada em ordem alfabética (1..N) com sucesso!' });
    } catch (err: unknown) {
      setTurmaAlunosMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível renumerar a chamada.',
      });
    }
  };

  const handleDesenturmarAluno = async (alunoId: string, nomeAluno: string) => {
    if (!selectedTurmaAlunosModal) return;
    if (!confirm(`Deseja desenturmar o aluno ${nomeAluno} da turma ${selectedTurmaAlunosModal.nome}?`)) return;

    try {
      await apiFetch(`/secretaria/turmas/${selectedTurmaAlunosModal.id}/alunos/${alunoId}`, {
        method: 'DELETE',
      });
      setTurmaAlunos((prev) => prev.filter((a) => a.aluno_id !== alunoId));
      const desenturmarMap = (t: Turma) =>
        t.id === selectedTurmaAlunosModal.id
          ? {
              ...t,
              alunos_matriculados: Math.max(0, (t.alunos_matriculados || 1) - 1),
              vagas_restantes: (t.vagas_restantes || 0) + 1,
            }
          : t;
      setTurmas((prev) => prev.map(desenturmarMap));
      setTurmasCatalogo((prev) => prev.map(desenturmarMap));
      setTurmaAlunosMsg({ type: 'success', text: `Aluno ${nomeAluno} desenturmado com sucesso!` });
    } catch (err: unknown) {
      setTurmaAlunosMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível desenturmar o aluno.',
      });
    }
  };

  const handleExecutarTransferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurmaAlunosModal || !alunoParaTransferir || !turmaDestinoTransferenciaId) return;

    setTransferindo(true);
    try {
      await apiFetch('/secretaria/turmas/transferir', {
        method: 'POST',
        body: JSON.stringify({
          aluno_id: alunoParaTransferir.aluno_id,
          turma_origem_id: selectedTurmaAlunosModal.id,
          turma_destino_id: turmaDestinoTransferenciaId,
        }),
      });

      setTurmaAlunos((prev) => prev.filter((a) => a.aluno_id !== alunoParaTransferir.aluno_id));
      const transferMap = (t: Turma) => {
        if (t.id === selectedTurmaAlunosModal.id) {
          return {
            ...t,
            alunos_matriculados: Math.max(0, (t.alunos_matriculados || 1) - 1),
            vagas_restantes: (t.vagas_restantes || 0) + 1,
          };
        }
        if (t.id === turmaDestinoTransferenciaId) {
          return {
            ...t,
            alunos_matriculados: (t.alunos_matriculados || 0) + 1,
            vagas_restantes: Math.max(0, (t.vagas_restantes || 1) - 1),
          };
        }
        return t;
      };
      setTurmas((prev) => prev.map(transferMap));
      setTurmasCatalogo((prev) => prev.map(transferMap));
      setTurmaAlunosMsg({
        type: 'success',
        text: `Aluno ${alunoParaTransferir.nome} transferido de turma com sucesso!`,
      });
      setAlunoParaTransferir(null);
      setTurmaDestinoTransferenciaId('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na transferência';
      setTurmaAlunosMsg({ type: 'error', text: msg });
    } finally {
      setTransferindo(false);
    }
  };

  const handleExcluirTurma = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente excluir a turma "${nome}"?`)) return;
    try {
      await apiFetch(`/secretaria/turmas/${id}`, { method: 'DELETE' });
      setTurmas((prev) => prev.filter((t) => t.id !== id));
      setTurmasCatalogo((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível excluir a turma.');
    }
  };

  const handleEnsalamentoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurmaParaEnsalamento || !selectedAlunoIdParaEnsalamento) return;
    try {
      await apiFetch('/secretaria/turmas/matricular', {
        method: 'POST',
        body: JSON.stringify({
          turma_id: selectedTurmaParaEnsalamento.id,
          aluno_id: selectedAlunoIdParaEnsalamento,
        }),
      });
      const ensalamentoMap = (t: Turma) =>
        t.id === selectedTurmaParaEnsalamento.id
          ? {
              ...t,
              alunos_matriculados: (t.alunos_matriculados || 0) + 1,
              vagas_restantes: Math.max(0, (t.vagas_restantes || t.capacidade_maxima) - 1),
            }
          : t;
      setTurmas((prev) => prev.map(ensalamentoMap));
      setTurmasCatalogo((prev) => prev.map(ensalamentoMap));
      setEnsalamentoSuccess('Aluno enturmado com sucesso!');
      setTimeout(() => {
        setShowEnsalamentoModal(false);
        setSelectedTurmaParaEnsalamento(null);
        setSelectedAlunoIdParaEnsalamento('');
        setEnsalamentoSuccess(null);
      }, 700);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível enturmar o aluno.');
    }
  };

  const handleDeleteAluno = async (id: string) => {
    if (!confirm('Deseja inativar esta matrícula? O histórico e o prontuário serão preservados.')) return;
    try {
      await apiFetch(`/secretaria/alunos/${id}`, { method: 'DELETE' });
      setToastMsg('Aluno inativado com sucesso.');
      setMenuStatusAlunoId(null);
      void loadAlunos();
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível inativar a matrícula.');
    }
  };

  const handleAlterarStatus = async (aluno: Aluno, novoStatus: string) => {
    const label = labelStatusAluno(novoStatus);
    if (!confirm(`Alterar status de ${aluno.nome} para “${label}”?`)) return;
    try {
      await apiFetch<Aluno>(`/secretaria/alunos/${aluno.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: novoStatus }),
      });
      setToastMsg(`Status atualizado para ${label}.`);
      setMenuStatusAlunoId(null);
      void loadAlunos();
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível alterar o status.');
    }
  };

  const handleViewProntuario = async (aluno: Aluno) => {
    setIsEditingProntuario(false);
    setProntuarioSuccess(null);
    try {
      const data = await apiFetch<{
        aluno: Aluno;
        prontuario: ProntuarioData;
      }>(`/secretaria/prontuarios/${aluno.id}`);
      setSelectedProntuarioModal(data);
      initProntuarioEditFields(data.prontuario);
    } catch (err: unknown) {
      setSelectedProntuarioModal(null);
      setFetchError(err instanceof Error ? err.message : 'Não foi possível carregar o prontuário.');
    }
  };

  const initProntuarioEditFields = (p: ProntuarioData) => {
    setEditTipoSanguineo(p.tipo_sanguineo || 'Não informado');
    setEditAlergias(p.alergias || '');
    setEditRestricoes(p.restricoes_alimentares || '');
    setEditMedicamentos(p.medicamentos_continuos || '');
    setEditCuidados(p.cuidados_especiais || '');
    setEditHistorico(p.historico_observacoes || '');
  };

  const handleSalvarProntuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProntuarioModal) return;
    setProntuarioSuccess(null);

    const payload: ProntuarioData = {
      tipo_sanguineo: editTipoSanguineo,
      alergias: editAlergias,
      restricoes_alimentares: editRestricoes,
      medicamentos_continuos: editMedicamentos,
      cuidados_especiais: editCuidados,
      historico_observacoes: editHistorico,
    };

    try {
      const updated = await apiFetch<ProntuarioData>(`/secretaria/prontuarios/${selectedProntuarioModal.aluno.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSelectedProntuarioModal({
        aluno: selectedProntuarioModal.aluno,
        prontuario: updated,
      });
      setProntuarioSuccess('Prontuário clínico atualizado com sucesso!');
      setIsEditingProntuario(false);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Não foi possível salvar o prontuário.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalAlunos / PAGE_SIZE));
  const fromItem = totalAlunos === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toItem = Math.min(page * PAGE_SIZE, totalAlunos);
  const contagemMap = Object.fromEntries(contagemStatus.map((c) => [c.status, c.total]));
  const turmasReferencia = turmasCatalogo.length > 0 ? turmasCatalogo : turmas;
  const anosLetivosTurma = Array.from(new Set(turmasReferencia.map((t) => t.ano_letivo))).sort((a, b) => b - a);
  const turmasFiltradas = turmas.filter((t) => {
    const q = filtroTurmaTexto.trim().toLowerCase();
    const matchTexto =
      !q ||
      t.nome.toLowerCase().includes(q) ||
      (t.codigo || '').toLowerCase().includes(q) ||
      (t.serie || '').toLowerCase().includes(q) ||
      (t.etapa_ensino || '').toLowerCase().includes(q);
    const matchAno = !filtroTurmaAno || String(t.ano_letivo) === filtroTurmaAno;
    const matchTurno = !filtroTurmaTurno || (t.turno || '').toLowerCase() === filtroTurmaTurno.toLowerCase();
    return matchTexto && matchAno && matchTurno;
  });

  return (
    <section id="secretaria" className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      {fetchError && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-xs sm:text-sm font-medium">{fetchError}</p>
          </div>
          <button
            onClick={() => {
              void loadAlunos();
              void loadCatalogo();
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Tentar Novamente
          </button>
        </div>
      )}

      {toastMsg && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-center justify-between gap-3">
          <span>{toastMsg}</span>
          <button type="button" onClick={() => setToastMsg(null)} className="text-emerald-700 dark:text-emerald-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
            <span>Portal da Secretaria & Matrícula Online</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Gestão integral de alunos, responsáveis legal/financeiro, endereço, contatos de emergência e prontuário médico.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeTab === 'alunos' && (
            <button
              onClick={() => {
                setFormError(null);
                setFormSuccess(null);
                setOrigemCrm(false);
                setModalTab('dados_aluno');
                setShowModal(true);
              }}
              className="bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 dark:hover:bg-salvia-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Nova Matrícula Completa</span>
            </button>
          )}
          {activeTab === 'turmas' && (
            <button
              onClick={() => setShowTurmaModal(true)}
              className="bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 dark:hover:bg-salvia-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Criar Nova Turma</span>
            </button>
          )}
        </div>
      </div>

      {/* Abas Superiores de Navegação */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-2">
        <button
          type="button"
          onClick={() => handleTabChange('alunos')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all ${
            activeTab === 'alunos'
              ? 'border-salvia-600 text-salvia-700 dark:text-salvia-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Alunos & Matrículas</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('turmas')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all ${
            activeTab === 'turmas'
              ? 'border-salvia-600 text-salvia-700 dark:text-salvia-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Turmas & Ensalamento</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('contratos')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all ${
            activeTab === 'contratos'
              ? 'border-salvia-600 text-salvia-700 dark:text-salvia-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Contratos & Parcelas</span>
        </button>
      </div>

      {/* Renderização Condicional: Alunos vs Turmas vs Contratos */}
      {activeTab === 'alunos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'ativo', label: 'Ativos' },
              { key: 'pre_matricula', label: 'Pré-matrícula' },
              { key: 'trancado', label: 'Trancados' },
              { key: 'transferido', label: 'Transferidos' },
              { key: 'inativo', label: 'Inativos' },
              { key: 'todos', label: 'Todos' },
            ].map((chip) => {
              const count =
                chip.key === 'todos'
                  ? contagemStatus.reduce((acc, c) => acc + c.total, 0)
                  : contagemMap[chip.key] || 0;
              const active = filtroStatus === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    setFiltroStatus(chip.key);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                    active
                      ? 'border-salvia-600 bg-salvia-700 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-salvia-400 dark:border-slate-700 dark:bg-[#0c120e] dark:text-slate-300'
                  }`}
                >
                  {chip.label}
                  <span className={`font-mono ${active ? 'text-salvia-100' : 'text-slate-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0c120e]/80 p-3 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, CPF, responsável legal/financeiro ou cidade..."
                className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-medium placeholder-slate-400"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1"><Filter className="w-3 h-3" /> Turma</span>
                <select
                  value={filtroTurmaId}
                  onChange={(e) => {
                    setFiltroTurmaId(e.target.value);
                    if (e.target.value) setFiltroSemTurma(false);
                    setPage(1);
                  }}
                  className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">Todas as turmas</option>
                  {turmasReferencia.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.codigo ? `${t.codigo} — ` : ''}{t.nome} ({t.ano_letivo})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Ano letivo
                <select
                  value={filtroAnoLetivo}
                  onChange={(e) => {
                    setFiltroAnoLetivo(e.target.value);
                    setPage(1);
                  }}
                  className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">Qualquer ano</option>
                  {anosLetivosTurma.map((ano) => (
                    <option key={ano} value={String(ano)}>{ano}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 pb-2">
                <input
                  type="checkbox"
                  checked={filtroSemTurma}
                  onChange={(e) => {
                    setFiltroSemTurma(e.target.checked);
                    if (e.target.checked) setFiltroTurmaId('');
                    setPage(1);
                  }}
                  className="rounded border-slate-300 text-salvia-700 focus:ring-salvia-600"
                />
                Somente sem turma
              </label>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSearchDebounced('');
                    setFiltroStatus('ativo');
                    setFiltroTurmaId('');
                    setFiltroSemTurma(false);
                    setFiltroAnoLetivo('');
                    setPage(1);
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-salvia-700 dark:hover:text-salvia-400"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-200 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Aluno(a)</th>
                  <th className="p-3">Turma</th>
                  <th className="p-3">Responsáveis</th>
                  <th className="p-3">Contato</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500">
                      Carregando lista de alunos...
                    </td>
                  </tr>
                ) : alunos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500 py-6">
                      Nenhum aluno encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  alunos.map((aluno) => {
                    const isUnificado = aluno.responsavel_financeiro_igual_legal;
                    const acoes = proximasAcoesStatus(aluno.status);
                    return (
                      <tr key={aluno.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{aluno.nome}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{aluno.cpf}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Nasc: {aluno.data_nascimento}</div>
                        </td>
                        <td className="p-3">
                          {aluno.turma_atual_nome ? (
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {aluno.turma_atual_codigo ? `${aluno.turma_atual_codigo} · ` : ''}
                                {aluno.turma_atual_nome}
                              </div>
                              {aluno.numero_chamada != null && (
                                <div className="text-[10px] text-slate-500">Chamada nº {aluno.numero_chamada}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] italic text-amber-700 dark:text-amber-300">Sem turma</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center space-x-1">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{aluno.nome_responsavel}</span>
                            <span className="text-[10px] text-salvia-700 dark:text-salvia-400 font-mono">
                              ({aluno.parentesco_responsavel_legal || 'Legal'})
                            </span>
                          </div>
                          {isUnificado ? (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-salvia-100 dark:bg-salvia-900/60 text-salvia-800 dark:text-salvia-300">
                              Resp. único
                            </span>
                          ) : (
                            <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                              Fin: {aluno.nome_responsavel_financeiro || aluno.nome_responsavel}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="text-slate-900 dark:text-slate-100 font-mono">{aluno.telefone_responsavel}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {aluno.cidade ? `${aluno.cidade} - ${aluno.estado || 'UF'}` : 'Sem endereço'}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusAlunoBadgeClass(aluno.status)}`}>
                            {labelStatusAluno(aluno.status)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="relative inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleViewProntuario(aluno)}
                              className="px-2.5 py-1 bg-salvia-50 dark:bg-salvia-950/80 border border-salvia-300 dark:border-salvia-700 hover:border-salvia-600 text-salvia-800 dark:text-salvia-200 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center space-x-1"
                              title="Visualizar e Editar Prontuário Médico"
                            >
                              <HeartPulse className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              <span>Prontuário</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setMenuStatusAlunoId((prev) => (prev === aluno.id ? null : aluno.id))
                              }
                              className="p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                              title="Ciclo de vida / status"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            {menuStatusAlunoId === aluno.id && (
                              <div className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141d17] shadow-lg py-1 text-left">
                                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-bold">
                                  Ciclo de vida
                                </p>
                                {acoes.map((acao) => (
                                  <button
                                    key={acao.status}
                                    type="button"
                                    onClick={() => void handleAlterarStatus(aluno, acao.status)}
                                    className="w-full px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                                  >
                                    {acao.label}
                                  </button>
                                ))}
                                {aluno.status !== 'inativo' && (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteAluno(aluno.id)}
                                    className="w-full px-3 py-2 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left inline-flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Inativar matrícula
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-600 dark:text-slate-400">
            <span>
              Mostrando <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fromItem}–{toItem}</span> de{' '}
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{totalAlunos}</span> alunos
            </span>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-bold disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </button>
              <span className="font-mono">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-bold disabled:opacity-40"
              >
                Próxima <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'turmas' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0c120e]/80 p-3 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative sm:col-span-1">
                {loadingTurmas ? (
                  <Loader2 className="w-4 h-4 text-salvia-600 animate-spin absolute left-3 top-2.5" />
                ) : (
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                )}
                <input
                  type="text"
                  value={filtroTurmaTexto}
                  onChange={(e) => setFiltroTurmaTexto(e.target.value)}
                  placeholder="Buscar turma, código ou série..."
                  className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-salvia-500/20 focus:border-salvia-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                />
                {filtroTurmaTexto && (
                  <button
                    type="button"
                    onClick={() => setFiltroTurmaTexto('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    title="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <select
                value={filtroTurmaAno}
                onChange={(e) => setFiltroTurmaAno(e.target.value)}
                className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-salvia-500/20 focus:border-salvia-500 text-slate-900 dark:text-slate-100"
              >
                <option value="">Todos os anos letivos</option>
                {anosLetivosTurma.map((ano) => (
                  <option key={ano} value={String(ano)}>{ano}</option>
                ))}
              </select>
              <select
                value={filtroTurmaTurno}
                onChange={(e) => setFiltroTurmaTurno(e.target.value)}
                className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-salvia-500/20 focus:border-salvia-500 text-slate-900 dark:text-slate-100"
              >
                <option value="">Todos os turnos</option>
                <option value="Matutino">Matutino</option>
                <option value="Vespertino">Vespertino</option>
                <option value="Noturno">Noturno</option>
                <option value="Integral">Integral</option>
              </select>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
              <span className="flex items-center gap-1.5 font-medium">
                {loadingTurmas ? (
                  <>
                    <Loader2 className="w-3 h-3 text-salvia-600 animate-spin" />
                    <span>Buscando turmas...</span>
                  </>
                ) : (
                  <>
                    <Filter className="w-3 h-3 text-salvia-600" />
                    <span>
                      {turmasFiltradas.length}{' '}
                      {turmasFiltradas.length === 1 ? 'turma encontrada' : 'turmas encontradas'}
                      {(filtroTurmaTexto || filtroTurmaAno || filtroTurmaTurno) && ' (filtro ativo)'}
                    </span>
                  </>
                )}
              </span>
              {(filtroTurmaTexto || filtroTurmaAno || filtroTurmaTurno) && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltroTurmaTexto('');
                    setFiltroTurmaAno('');
                    setFiltroTurmaTurno('');
                  }}
                  className="text-xs font-semibold text-salvia-700 hover:text-salvia-800 dark:text-salvia-400 dark:hover:text-salvia-300 underline transition"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {turmasFiltradas.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400 space-y-3">
                {loadingTurmas ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <Loader2 className="w-6 h-6 text-salvia-600 animate-spin" />
                    <p className="text-xs">Buscando turmas no servidor...</p>
                  </div>
                ) : filtroTurmaTexto || filtroTurmaAno || filtroTurmaTurno ? (
                  <div className="space-y-2">
                    <p>Nenhuma turma corresponde aos filtros aplicados.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroTurmaTexto('');
                        setFiltroTurmaAno('');
                        setFiltroTurmaTurno('');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-salvia-700 dark:text-salvia-400 hover:underline"
                    >
                      <RotateCw className="w-3 h-3" />
                      Redefinir filtros de busca
                    </button>
                  </div>
                ) : (
                  <p>Nenhuma turma cadastrada. Use “Criar Nova Turma” para abrir a primeira.</p>
                )}
              </div>
            ) : turmasFiltradas.map((t) => {
              const matriculados = t.alunos_matriculados || 0;
              const vagasLivres = Math.max(0, t.capacidade_maxima - matriculados);
              const percentualOcupacao = Math.min(100, Math.round((matriculados / t.capacidade_maxima) * 100));

              return (
                <div key={t.id} className="p-4 bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3.5 shadow-sm hover:border-salvia-500/50 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.nome}</h3>
                        {t.codigo && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {t.codigo}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center space-x-2">
                        <span>Ano Letivo {t.ano_letivo}</span>
                        <span>•</span>
                        <span className="font-semibold text-salvia-700 dark:text-salvia-400">{t.turno || 'Matutino'}</span>
                      </p>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                        vagasLivres > 0
                          ? 'bg-salvia-100 dark:bg-salvia-900/60 border-salvia-300 dark:border-salvia-600/40 text-salvia-800 dark:text-salvia-200'
                          : 'bg-rose-100 dark:bg-rose-900/60 border-rose-300 dark:border-rose-600/40 text-rose-800 dark:text-rose-200'
                      }`}
                    >
                      {vagasLivres > 0 ? `${vagasLivres} Vagas Disponíveis` : 'Turma Lotada'}
                    </span>
                  </div>

                  {/* Metadados Pedagógicos: Etapa, Série, Sala e Regente */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-[#141d17] p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80">
                    <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400">
                      <GraduationCap className="w-3.5 h-3.5 text-salvia-600 shrink-0" />
                      <span className="truncate" title={`${t.etapa_ensino || 'Fundamental'} - ${t.serie || 'Geral'}`}>
                        {t.etapa_ensino ? `${t.etapa_ensino}${t.serie ? ` (${t.serie})` : ''}` : 'Etapa Regular'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400">
                      <DoorOpen className="w-3.5 h-3.5 text-salvia-600 shrink-0" />
                      <span className="truncate" title={t.sala_nome || 'Sala não atribuída'}>
                        {t.sala_nome ? t.sala_nome : 'Sala não atribuída'}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <School className="w-3.5 h-3.5 text-salvia-600 shrink-0" />
                      <span className="truncate" title={t.professor_regente_nome ? `Regente: ${t.professor_regente_nome}` : 'Sem professor regente definido'}>
                        {t.professor_regente_nome ? `Regente: ${t.professor_regente_nome}` : 'Sem regente definido'}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Ocupação & Vagas */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-600 dark:text-slate-400">Ocupação da Turma:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {matriculados} / {t.capacidade_maxima} alunos ({percentualOcupacao}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          percentualOcupacao >= 100
                            ? 'bg-rose-600'
                            : percentualOcupacao >= 80
                            ? 'bg-amber-500'
                            : 'bg-salvia-600'
                        }`}
                        style={{ width: `${percentualOcupacao}%` }}
                      />
                    </div>
                  </div>

                  {/* Ações da Turma */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 dark:border-slate-800/60">
                    <button
                      onClick={() => handleVerAlunosTurma(t)}
                      className="px-3 py-1.5 bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>Ver Alunos & Chamada</span>
                    </button>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          setSelectedTurmaParaEnsalamento(t);
                          if (alunos.length > 0) {
                            setSelectedAlunoIdParaEnsalamento(alunos[0].id);
                          }
                          void loadAlunosEnsalamento().then(() => setShowEnsalamentoModal(true));
                        }}
                        className="px-2.5 py-1.5 bg-white dark:bg-[#141d17] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all"
                        title="Enturmar Aluno"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-salvia-600" />
                        <span>Enturmar</span>
                      </button>

                      <button
                        onClick={() => handleExcluirTurma(t.id, t.nome)}
                        className="p-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg transition-all"
                        title="Excluir Turma"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'contratos' && (
        <ContratosPanel
          alunos={alunos}
          onNavigateToFinanceiro={() => {
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('route', 'financeiro');
              url.searchParams.set('tab', 'ar');
              window.location.href = url.toString();
            }
          }}
        />
      )}

      {/* Modal Matrícula Online Completa (Multi-Tabs) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 max-w-2xl sm:max-w-3xl w-full shadow-2xl my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
                  <span>Nova Matrícula & Cadastro Integral do Aluno</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Cadastre o aluno, responsáveis (legal/financeiro), endereço residencial e prontuário médico inicial.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs inside Modal */}
            <div className="flex overflow-x-auto space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModalTab('dados_aluno')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center space-x-1 whitespace-nowrap ${
                  modalTab === 'dados_aluno'
                    ? 'bg-salvia-700 text-white dark:bg-salvia-600 shadow-sm font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>1. Aluno</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('responsaveis')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center space-x-1 whitespace-nowrap ${
                  modalTab === 'responsaveis'
                    ? 'bg-salvia-700 text-white dark:bg-salvia-600 shadow-sm font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>2. Responsáveis</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('endereco_contato')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center space-x-1 whitespace-nowrap ${
                  modalTab === 'endereco_contato'
                    ? 'bg-salvia-700 text-white dark:bg-salvia-600 shadow-sm font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>3. Endereço & Emergência</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('prontuario')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center space-x-1 whitespace-nowrap ${
                  modalTab === 'prontuario'
                    ? 'bg-salvia-700 text-white dark:bg-salvia-600 shadow-sm font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60'
                }`}
              >
                <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                <span>4. Prontuário Médico</span>
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center space-x-2 text-rose-800 dark:text-rose-200 text-xs font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{formSuccess}</span>
              </div>
            )}

            {origemCrm && (
              <div className="mb-4 p-3 bg-salvia-50 dark:bg-salvia-950/60 border border-salvia-300 dark:border-salvia-700/80 rounded-xl flex items-center space-x-2 text-salvia-800 dark:text-salvia-200 text-xs font-medium">
                <UserCheck className="w-4 h-4 shrink-0 text-salvia-600 dark:text-salvia-400" />
                <span>Dados importados do lead do CRM. Complete as informações para finalizar a matrícula.</span>
              </div>
            )}

            <form onSubmit={handleMatricular} className="space-y-4">
              {/* TAB 1: DADOS DO ALUNO */}
              {modalTab === 'dados_aluno' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nome Completo do Aluno *
                    </label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Gabriel Souza Silva"
                      className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        CPF do Aluno (Módulo 11) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={14}
                        value={cpf}
                        onChange={(e) => setCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Data de Nascimento *
                      </label>
                      <input
                        type="date"
                        required
                        value={dataNascimento}
                        onChange={(e) => setDataNascimento(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Situação inicial da matrícula
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setStatusInicialMatricula('ativo')}
                        className={`rounded-xl border px-3 py-2 text-left text-[11px] transition ${
                          statusInicialMatricula === 'ativo'
                            ? 'border-salvia-600 bg-salvia-50 dark:bg-salvia-950/40 text-salvia-900 dark:text-salvia-200'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="font-bold block">Matrícula ativa</span>
                        Aluno já confirmado e apto a ensalar.
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusInicialMatricula('pre_matricula')}
                        className={`rounded-xl border px-3 py-2 text-left text-[11px] transition ${
                          statusInicialMatricula === 'pre_matricula'
                            ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="font-bold block">Pré-matrícula</span>
                        Aguardando documentos ou confirmação final.
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setModalTab('responsaveis')}
                      className="bg-salvia-700 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-salvia-800"
                    >
                      Avançar para Responsáveis →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: RESPONSÁVEL LEGAL & FINANCEIRO */}
              {modalTab === 'responsaveis' && (
                <div className="space-y-4">
                  {/* Responsável Legal */}
                  <div className="p-3 bg-salvia-50/60 dark:bg-salvia-950/30 border border-salvia-200 dark:border-salvia-800/80 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-salvia-900 dark:text-salvia-300 flex items-center space-x-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Responsável Legal (Pátrio Poder / Guarda)</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Nome do Responsável Legal *
                        </label>
                        <input
                          type="text"
                          required
                          value={nomeResponsavel}
                          onChange={(e) => setNomeResponsavel(e.target.value)}
                          placeholder="Ex: Mariana Souza"
                          className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Parentesco
                        </label>
                        <select
                          value={parentescoResponsavelLegal}
                          onChange={(e) => setParentescoResponsavelLegal(e.target.value)}
                          className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600"
                        >
                          <option value="Mãe">Mãe</option>
                          <option value="Pai">Pai</option>
                          <option value="Tutor Legal">Tutor Legal</option>
                          <option value="Avó/Avô">Avó/Avô</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          CPF Responsável Legal
                        </label>
                        <input
                          type="text"
                          maxLength={14}
                          value={cpfResponsavelLegal}
                          onChange={(e) => setCpfResponsavelLegal(formatCpf(e.target.value))}
                          placeholder="000.000.000-00"
                          className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Telefone / WhatsApp *
                        </label>
                        <input
                          type="text"
                          required
                          value={telefoneResponsavel}
                          onChange={(e) => setTelefoneResponsavel(formatPhone(e.target.value))}
                          placeholder="(11) 98765-4321"
                          className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          E-mail *
                        </label>
                        <input
                          type="email"
                          required
                          value={emailResponsavel}
                          onChange={(e) => setEmailResponsavel(e.target.value)}
                          placeholder="responsavel@email.com"
                          className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Flag de Unificação de Responsável */}
                  <div
                    onClick={() => setResponsavelFinanceiroIgualLegal(!responsavelFinanceiroIgualLegal)}
                    className="p-3 bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center space-x-3 cursor-pointer hover:border-salvia-500 transition-all select-none"
                  >
                    <div className="text-salvia-700 dark:text-salvia-400">
                      {responsavelFinanceiroIgualLegal ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                        Responsável financeiro é a mesma pessoa que o responsável legal
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Marque esta opção caso um único pai/mãe ou tutor assuma tanto a representação legal quanto o pagamento das mensalidades.
                      </span>
                    </div>
                  </div>

                  {/* Responsável Financeiro Distinto (se flag for falsa) */}
                  {!responsavelFinanceiroIgualLegal && (
                    <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700/60 rounded-xl space-y-3 animate-fadeIn">
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center space-x-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Responsável Financeiro (Pagador / Emissão de Boletos e NFS-e)</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Nome do Responsável Financeiro *
                          </label>
                          <input
                            type="text"
                            required={!responsavelFinanceiroIgualLegal}
                            value={nomeResponsavelFinanceiro}
                            onChange={(e) => setNomeResponsavelFinanceiro(e.target.value)}
                            placeholder="Ex: Carlos Roberto Silva"
                            className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Parentesco
                          </label>
                          <select
                            value={parentescoResponsavelFinanceiro}
                            onChange={(e) => setParentescoResponsavelFinanceiro(e.target.value)}
                            className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                          >
                            <option value="Pai">Pai</option>
                            <option value="Mãe">Mãe</option>
                            <option value="Padrasto/Madrasta">Padrasto/Madrasta</option>
                            <option value="Avó/Avô">Avó/Avô</option>
                            <option value="Outro Patrocinador">Outro Patrocinador</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            CPF Responsável Financeiro
                          </label>
                          <input
                            type="text"
                            maxLength={14}
                            value={cpfResponsavelFinanceiro}
                            onChange={(e) => setCpfResponsavelFinanceiro(formatCpf(e.target.value))}
                            placeholder="000.000.000-00"
                            className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Telefone / WhatsApp Financeiro
                          </label>
                          <input
                            type="text"
                            value={telefoneResponsavelFinanceiro}
                            onChange={(e) => setTelefoneResponsavelFinanceiro(formatPhone(e.target.value))}
                            placeholder="(11) 99999-8888"
                            className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            E-mail Financeiro (Faturas & DRE)
                          </label>
                          <input
                            type="email"
                            value={emailResponsavelFinanceiro}
                            onChange={(e) => setEmailResponsavelFinanceiro(e.target.value)}
                            placeholder="financeiro.aluno@email.com"
                            className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setModalTab('dados_aluno')}
                      className="text-xs text-slate-600 dark:text-slate-400 font-bold hover:underline"
                    >
                      ← Voltar para Aluno
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalTab('endereco_contato')}
                      className="bg-salvia-700 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-salvia-800"
                    >
                      Avançar para Endereço →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: ENDEREÇO & CONTATOS DE EMERGÊNCIA */}
              {modalTab === 'endereco_contato' && (
                <div className="space-y-4">
                  {/* Endereço Residencial */}
                  <div className="p-3 bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-salvia-700 dark:text-salvia-400" />
                      <span>Endereço Residencial</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          CEP
                        </label>
                        <input
                          type="text"
                          maxLength={9}
                          value={cep}
                          onChange={(e) => setCep(formatCep(e.target.value))}
                          placeholder="00000-000"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Logradouro (Rua, Avenida...)
                        </label>
                        <input
                          type="text"
                          value={logradouro}
                          onChange={(e) => setLogradouro(e.target.value)}
                          placeholder="Ex: Av. Paulista"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Número
                        </label>
                        <input
                          type="text"
                          value={numero}
                          onChange={(e) => setNumero(e.target.value)}
                          placeholder="Ex: 1000"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Complemento
                        </label>
                        <input
                          type="text"
                          value={complemento}
                          onChange={(e) => setComplemento(e.target.value)}
                          placeholder="Apto, Bloco..."
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Bairro
                        </label>
                        <input
                          type="text"
                          value={bairro}
                          onChange={(e) => setBairro(e.target.value)}
                          placeholder="Bairro"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Cidade
                        </label>
                        <input
                          type="text"
                          value={cidade}
                          onChange={(e) => setCidade(e.target.value)}
                          placeholder="Cidade"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Estado (UF)
                        </label>
                        <input
                          type="text"
                          maxLength={2}
                          value={estado}
                          onChange={(e) => setEstado(e.target.value.toUpperCase())}
                          placeholder="SP"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Telefones de Contato & Emergência */}
                  <div className="p-3 bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                      <Phone className="w-3.5 h-3.5 text-salvia-700 dark:text-salvia-400" />
                      <span>Telefones Adicionais & Contato de Emergência</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Telefone Secundário / Recado
                        </label>
                        <input
                          type="text"
                          value={telefoneSecundario}
                          onChange={(e) => setTelefoneSecundario(formatPhone(e.target.value))}
                          placeholder="(11) 3333-4444"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Contato de Emergência (Nome)
                        </label>
                        <input
                          type="text"
                          value={contatoEmergenciaNome}
                          onChange={(e) => setContatoEmergenciaNome(e.target.value)}
                          placeholder="Ex: Vovó Helena"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Telefone Emergência
                        </label>
                        <input
                          type="text"
                          value={contatoEmergenciaTelefone}
                          onChange={(e) => setContatoEmergenciaTelefone(formatPhone(e.target.value))}
                          placeholder="(11) 91111-2222"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Parentesco
                        </label>
                        <input
                          type="text"
                          value={contatoEmergenciaParentesco}
                          onChange={(e) => setContatoEmergenciaParentesco(e.target.value)}
                          placeholder="Ex: Avó"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setModalTab('responsaveis')}
                      className="text-xs text-slate-600 dark:text-slate-400 font-bold hover:underline"
                    >
                      ← Voltar para Responsáveis
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalTab('prontuario')}
                      className="bg-salvia-700 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-salvia-800"
                    >
                      Avançar para Prontuário Médico →
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: PRONTUÁRIO MÉDICO INICIAL */}
              {modalTab === 'prontuario' && (
                <div className="space-y-4">
                  <div className="p-3 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center space-x-1.5">
                      <HeartPulse className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span>Ficha Médica & Prontuário de Cuidado Clínico</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Tipo Sanguíneo
                        </label>
                        <select
                          value={tipoSanguineo}
                          onChange={(e) => setTipoSanguineo(e.target.value)}
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-semibold"
                        >
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="Não informado">Não informado</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Alergias Conhecidas (Medicamentosa, Insetos, etc.)
                        </label>
                        <input
                          type="text"
                          value={alergias}
                          onChange={(e) => setAlergias(e.target.value)}
                          placeholder="Ex: Dipirona, picada de abelha, pólen..."
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Restrições Alimentares (Glúten, Lactose...)
                        </label>
                        <input
                          type="text"
                          value={restricoesAlimentares}
                          onChange={(e) => setRestricoesAlimentares(e.target.value)}
                          placeholder="Ex: Intolerância à lactose severa"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Medicamentos de Uso Contínuo
                        </label>
                        <input
                          type="text"
                          value={medicamentosContinuos}
                          onChange={(e) => setMedicamentosContinuos(e.target.value)}
                          placeholder="Ex: Bombinha para asma se necessário"
                          className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Cuidados Especiais & Recomendações Clínicas
                      </label>
                      <input
                        type="text"
                        value={cuidadosEspeciais}
                        onChange={(e) => setCuidadosEspeciais(e.target.value)}
                        placeholder="Ex: Usar óculos em sala de aula, evitar sol direto..."
                        className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Histórico Pedagógico & Observações Comportamentais
                      </label>
                      <textarea
                        rows={2}
                        value={historicoObservacoes}
                        onChange={(e) => setHistoricoObservacoes(e.target.value)}
                        placeholder="Observações comportamentais, necessidades pedagógicas adaptadas ou histórico anterior."
                        className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 resize-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setModalTab('endereco_contato')}
                      className="text-xs text-slate-600 dark:text-slate-400 font-bold hover:underline"
                    >
                      ← Voltar para Endereço
                    </button>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmar Matrícula Integral</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualizador e Editor do Prontuário Médico (Modularizado) */}
      <ProntuarioModal
        data={selectedProntuarioModal}
        onClose={() => setSelectedProntuarioModal(null)}
        onSaved={(updated) => {
          setSelectedProntuarioModal((prev) => (prev ? { ...prev, prontuario: updated } : null));
          setAlunos((prev) =>
            prev.map((a) => (a.id === selectedProntuarioModal?.aluno.id ? { ...a } : a))
          );
        }}
      />

      {/* Modal Criar Nova Turma Completa */}
      {showTurmaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
                  <span>Criar Nova Turma Pedagógica</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Defina parâmetros de etapa, série, turno, sala física e professor regente.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTurmaModal(false);
                  resetTurmaForm();
                }}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCriarTurma} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nome da Turma *
                  </label>
                  <input
                    type="text"
                    required
                    value={nomeTurma}
                    onChange={(e) => setNomeTurma(e.target.value)}
                    placeholder="Ex: 1º Ano A - Matutino"
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Código / Sigla
                  </label>
                  <input
                    type="text"
                    value={codigoTurma}
                    onChange={(e) => setCodigoTurma(e.target.value)}
                    placeholder="Ex: 1EF-A"
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Etapa de Ensino
                  </label>
                  <select
                    value={etapaEnsinoTurma}
                    onChange={(e) => setEtapaEnsinoTurma(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none font-medium"
                  >
                    <option value="Educacao Infantil">Educação Infantil</option>
                    <option value="Ensino Fundamental I">Ensino Fundamental I (1º ao 5º)</option>
                    <option value="Ensino Fundamental II">Ensino Fundamental II (6º ao 9º)</option>
                    <option value="Ensino Medio">Ensino Médio</option>
                    <option value="EJA">EJA (Educação de Jovens e Adultos)</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Série / Ano
                  </label>
                  <input
                    type="text"
                    value={serieTurma}
                    onChange={(e) => setSerieTurma(e.target.value)}
                    placeholder="Ex: 1º Ano, Maternal II, 3ª Série..."
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Turno
                  </label>
                  <select
                    value={turnoTurma}
                    onChange={(e) => setTurnoTurma(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none font-medium"
                  >
                    <option value="Matutino">Matutino</option>
                    <option value="Vespertino">Vespertino</option>
                    <option value="Noturno">Noturno</option>
                    <option value="Integral">Integral</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ano Letivo
                  </label>
                  <input
                    type="number"
                    required
                    value={anoLetivoTurma}
                    onChange={(e) => setAnoLetivoTurma(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Capacidade
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={capacidadeTurma}
                    onChange={(e) => setCapacidadeTurma(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sala Física Alocada
                  </label>
                  <select
                    value={salaIdTurma}
                    onChange={(e) => setSalaIdTurma(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="">Nenhuma / A definir</option>
                    {salas.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome} (Cap: {s.capacidade})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Professor(a) Regente
                  </label>
                  <select
                    value={professorRegenteIdTurma}
                    onChange={(e) => setProfessorRegenteIdTurma(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="">Nenhum / A definir</option>
                    {professores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowTurmaModal(false);
                    resetTurmaForm();
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 text-white rounded-xl font-bold transition-all shadow-md"
                >
                  Salvar Turma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alunos da Turma & Livro de Chamada */}
      {selectedTurmaAlunosModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 max-w-4xl w-full shadow-2xl my-6">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                    <ListOrdered className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
                    <span>Livro de Chamada & Alunos Enturmados</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-salvia-100 dark:bg-salvia-900 text-salvia-800 dark:text-salvia-200">
                    {selectedTurmaAlunosModal.nome} {selectedTurmaAlunosModal.codigo ? `(${selectedTurmaAlunosModal.codigo})` : ''}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedTurmaAlunosModal.etapa_ensino || 'Fundamental'} {selectedTurmaAlunosModal.serie ? `• ${selectedTurmaAlunosModal.serie}` : ''} | Turno: {selectedTurmaAlunosModal.turno || 'Matutino'} | Sala: {selectedTurmaAlunosModal.sala_nome || 'Não definida'} | Regente: {selectedTurmaAlunosModal.professor_regente_nome || 'Não definido'}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedTurmaAlunosModal(null);
                  setAlunoParaTransferir(null);
                  setTurmaAlunosMsg(null);
                }}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toolbar com Renumeração e Vagas */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-[#0c120e] p-3 rounded-xl border border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Lotação da Turma:
                </span>
                <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 px-2 py-0.5 bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-700 rounded-md">
                  {turmaAlunos.length} / {selectedTurmaAlunosModal.capacidade_maxima} matriculados
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRenumerarChamada}
                  className="px-3 py-1.5 bg-salvia-50 dark:bg-salvia-950 border border-salvia-300 dark:border-salvia-700 hover:bg-salvia-100 text-salvia-800 dark:text-salvia-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
                  title="Ordena os alunos em ordem alfabética de A a Z e renumera a chamada de 1 até N"
                >
                  <ListOrdered className="w-3.5 h-3.5 text-salvia-700" />
                  <span>Renumerar Chamada (A-Z, 1..N)</span>
                </button>
              </div>
            </div>

            {/* Mensagem de Feedback */}
            {turmaAlunosMsg && (
              <div
                className={`mb-4 p-3 rounded-xl flex items-center space-x-2 text-xs font-medium border ${
                  turmaAlunosMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {turmaAlunosMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{turmaAlunosMsg.text}</span>
              </div>
            )}

            {/* Submodal / Painel de Transferência */}
            {alunoParaTransferir && (
              <form
                onSubmit={handleExecutarTransferencia}
                className="mb-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                    <span>Transferência Atômica: {alunoParaTransferir.nome}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setAlunoParaTransferir(null)}
                    className="text-amber-600 hover:text-amber-900 text-xs font-bold"
                  >
                    ✕ Cancelar
                  </button>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  O aluno será desvinculado da turma atual ({selectedTurmaAlunosModal.nome}) e vinculado à nova turma selecionada, recalculando as vagas de forma atômica.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    required
                    value={turmaDestinoTransferenciaId}
                    onChange={(e) => setTurmaDestinoTransferenciaId(e.target.value)}
                    className="flex-1 bg-white dark:bg-[#141d17] border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-medium"
                  >
                    <option value="">Selecione a Turma de Destino...</option>
                    {turmasReferencia
                      .filter((t) => t.id !== selectedTurmaAlunosModal.id)
                      .map((t) => {
                        const vagas = t.vagas_restantes ?? Math.max(0, t.capacidade_maxima - (t.alunos_matriculados || 0));
                        return (
                          <option key={t.id} value={t.id} disabled={vagas <= 0}>
                            {t.nome} {t.codigo ? `[${t.codigo}]` : ''} — {vagas > 0 ? `${vagas} vagas livres` : 'LOTADA'}
                          </option>
                        );
                      })}
                  </select>
                  <button
                    type="submit"
                    disabled={transferindo || !turmaDestinoTransferenciaId}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center space-x-1"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>{transferindo ? 'Transferindo...' : 'Confirmar Transferência'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Tabela de Alunos Enturmados */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-200 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-3 w-16 text-center">Nº</th>
                    <th className="p-3">Aluno(a)</th>
                    <th className="p-3">CPF</th>
                    <th className="p-3">Responsável & Contato</th>
                    <th className="p-3">Data Matrícula</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200 font-medium">
                  {loadingTurmaAlunos ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        Carregando chamada da turma...
                      </td>
                    </tr>
                  ) : turmaAlunos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        Nenhum aluno enturmado nesta turma até o momento.
                      </td>
                    </tr>
                  ) : (
                    turmaAlunos.map((a, idx) => {
                      const numChamada = a.numero_chamada ?? idx + 1;
                      return (
                        <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-center">
                            <span className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-xs">
                              #{String(numChamada).padStart(2, '0')}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{a.nome}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              Nasc: {a.data_nascimento}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{a.cpf}</td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{a.nome_responsavel}</div>
                            <div className="text-[10px] text-salvia-700 dark:text-salvia-400 font-mono">
                              {a.telefone_responsavel}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {a.data_matricula}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300">
                              {a.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => {
                                  setAlunoParaTransferir(a);
                                  setTurmaDestinoTransferenciaId('');
                                }}
                                className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-all"
                                title="Transferir de Turma"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-amber-700" />
                                <span>Transferir</span>
                              </button>

                              <button
                                onClick={() => handleDesenturmarAluno(a.aluno_id, a.nome)}
                                className="p-1 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg transition-all"
                                title="Desenturmar Aluno"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedTurmaAlunosModal(null);
                  setAlunoParaTransferir(null);
                  setTurmaAlunosMsg(null);
                }}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
              >
                Fechar Livro de Chamada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ensalamento Interativo (Modularizado) */}
      <EnsalamentoModal
        isOpen={showEnsalamentoModal}
        turma={selectedTurmaParaEnsalamento}
        alunos={alunosEnsalamento}
        onClose={() => setShowEnsalamentoModal(false)}
        onSuccess={() => {
          void loadAlunos();
          void loadCatalogo();
          void loadAlunosEnsalamento();
        }}
      />
    </section>
  );
}
