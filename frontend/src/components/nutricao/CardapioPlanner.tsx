'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';

interface Cardapio {
  id: string;
  turma_id?: string | null;
  semana_ano: string;
  data_dia: string;
  tipo_refeicao: string;
  titulo_menu: string;
  descricao_ingredientes: string;
  alergicos_atencao?: string | null;
  nutricionista_id?: string | null;
  nutricionista_responsavel: string;
  origem?: string;
  recorrencia_id?: string | null;
  editado_manualmente?: boolean;
}

interface Recorrencia {
  id: string;
  prato_id: string;
  titulo: string;
  descricao_ingredientes: string;
  alergicos_atencao?: string | null;
  tipo_refeicao: string;
  turma_id?: string | null;
  dias_semana: number[];
  data_inicio: string;
  data_fim: string;
  nutricionista_id?: string | null;
  nutricionista_responsavel: string;
  dias_publicados: number;
  excecoes: number;
  status: 'ativa' | 'encerrada' | 'futura' | string;
}

interface Prato {
  id: string;
  titulo: string;
  descricao_ingredientes: string;
  alergicos_atencao?: string | null;
  tipo_refeicao?: string | null;
}

interface TurmaOpcao {
  id: string;
  nome: string;
}

interface FuncionarioRh {
  id: string;
  nome: string;
  cargo: string;
  status: string;
}

interface PreviaDia {
  data: string;
  conflito: boolean;
  feriado: string | null;
  motivo: string | null;
}

type Visao = 'vigencias' | 'semana' | 'avulsos' | 'pratos';

type Confirmacao =
  | { tipo: 'dia'; cardapio: Cardapio }
  | { tipo: 'serie'; serie: Recorrencia };

const REFEICOES = ['Café da Manhã', 'Colação', 'Almoço', 'Lanche Tarde', 'Jantar'];
const DIAS = [
  { id: 1, rotulo: 'Seg' },
  { id: 2, rotulo: 'Ter' },
  { id: 3, rotulo: 'Qua' },
  { id: 4, rotulo: 'Qui' },
  { id: 5, rotulo: 'Sex' },
  { id: 6, rotulo: 'Sáb' },
  { id: 7, rotulo: 'Dom' },
];

const campo =
  'w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100';

const hojeLocal = () => {
  const agora = new Date();
  const offset = agora.getTimezoneOffset() * 60000;
  return new Date(agora.getTime() - offset).toISOString().split('T')[0];
};

const somarDias = (iso: string, dias: number) => {
  const data = new Date(`${iso}T12:00:00`);
  data.setDate(data.getDate() + dias);
  const offset = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - offset).toISOString().split('T')[0];
};

const inicioSemana = (iso: string) => {
  const data = new Date(`${iso}T12:00:00`);
  const dia = data.getDay(); // 0=Dom
  const delta = dia === 0 ? -6 : 1 - dia;
  data.setDate(data.getDate() + delta);
  const offset = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - offset).toISOString().split('T')[0];
};

const formatarData = (iso: string) => {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
};

const rotuloDias = (ids: number[]) =>
  ids
    .slice()
    .sort((a, b) => a - b)
    .map((id) => DIAS.find((d) => d.id === id)?.rotulo || String(id))
    .join(', ');

const statusLabel: Record<string, string> = {
  ativa: 'Ativa',
  futura: 'Futura',
  encerrada: 'Encerrada',
};

export function CardapioPlanner() {
  const hoje = hojeLocal();
  const [visao, setVisao] = useState<Visao>('vigencias');
  const [cardapios, setCardapios] = useState<Cardapio[]>([]);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [pratos, setPratos] = useState<Prato[]>([]);
  const [turmas, setTurmas] = useState<TurmaOpcao[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioRh[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<'dia' | 'vigencia'>('vigencia');
  const [pratoId, setPratoId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [ingredientes, setIngredientes] = useState('');
  const [alergicos, setAlergicos] = useState('');
  const [tipo, setTipo] = useState('Almoço');
  const [turmaId, setTurmaId] = useState('');
  const [dataDia, setDataDia] = useState(hoje);
  const [inicio, setInicio] = useState(hoje);
  const [fim, setFim] = useState(somarDias(hoje, 27));
  const [dias, setDias] = useState<number[]>([1]);
  const [nutricionistaId, setNutricionistaId] = useState('');
  const [novoNutri, setNovoNutri] = useState({ nome: '', cpf: '' });
  const [pularFeriados, setPularFeriados] = useState(false);
  const [previa, setPrevia] = useState<PreviaDia[] | null>(null);
  const [editando, setEditando] = useState<Cardapio | null>(null);
  const [escopo, setEscopo] = useState<'dia' | 'seguintes'>('dia');
  const [semanaRef, setSemanaRef] = useState(() => inicioSemana(hoje));
  const [serieExpandida, setSerieExpandida] = useState<string | null>(null);
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroRefeicao, setFiltroRefeicao] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [modalPratoAberto, setModalPratoAberto] = useState(false);
  const [editandoPrato, setEditandoPrato] = useState<Prato | null>(null);
  const [pratoTitulo, setPratoTitulo] = useState('');
  const [pratoIngredientes, setPratoIngredientes] = useState('');
  const [pratoAlergicos, setPratoAlergicos] = useState('');
  const [pratoTipo, setPratoTipo] = useState('');
  const [salvandoPrato, setSalvandoPrato] = useState(false);
  const [confirmacaoPrato, setConfirmacaoPrato] = useState<Prato | null>(null);
  const [excluindoPrato, setExcluindoPrato] = useState(false);
  const [filtroPratoBusca, setFiltroPratoBusca] = useState('');
  const [filtroPratoTipo, setFiltroPratoTipo] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [cardapiosData, recorrenciasData, pratosData, turmasData, funcionariosData] = await Promise.all([
        apiFetch<Cardapio[]>('/nutricao/cardapios'),
        apiFetch<Recorrencia[]>('/nutricao/cardapios/recorrencias').catch(() => []),
        apiFetch<Prato[]>('/nutricao/pratos').catch(() => []),
        apiFetch<TurmaOpcao[]>('/secretaria/turmas').catch(() => []),
        apiFetch<FuncionarioRh[]>('/administrativo/funcionarios').catch(() => []),
      ]);
      setCardapios(cardapiosData || []);
      setRecorrencias(recorrenciasData || []);
      setPratos(pratosData || []);
      setTurmas(turmasData || []);
      setFuncionarios(funcionariosData || []);
      setErro(null);
    } catch (err: unknown) {
      setCardapios([]);
      setRecorrencias([]);
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar os cardápios.');
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const nomeTurma = useCallback(
    (id?: string | null) => {
      if (!id) return 'Geral';
      return turmas.find((t) => t.id === id)?.nome || 'Turma';
    },
    [turmas],
  );

  const bateTurma = useCallback(
    (turmaIdItem?: string | null) => {
      if (!filtroTurma) return true;
      if (filtroTurma === '__geral__') return !turmaIdItem;
      return turmaIdItem === filtroTurma;
    },
    [filtroTurma],
  );

  const bateRefeicao = useCallback(
    (tipoItem: string) => !filtroRefeicao || tipoItem === filtroRefeicao,
    [filtroRefeicao],
  );

  const filtrosAtivos = Boolean(
    visao === 'pratos'
      ? filtroPratoBusca || filtroPratoTipo
      : filtroTurma || filtroRefeicao || (visao === 'vigencias' && filtroStatus)
  );

  const limparFiltros = () => {
    setFiltroTurma('');
    setFiltroRefeicao('');
    setFiltroStatus('');
    setFiltroPratoBusca('');
    setFiltroPratoTipo('');
  };

  const pratosFiltrados = useMemo(() => {
    return pratos.filter((p) => {
      const termo = filtroPratoBusca.trim().toLowerCase();
      const matchBusca =
        !termo ||
        p.titulo.toLowerCase().includes(termo) ||
        p.descricao_ingredientes.toLowerCase().includes(termo) ||
        (p.alergicos_atencao && p.alergicos_atencao.toLowerCase().includes(termo));

      const matchTipo = !filtroPratoTipo || p.tipo_refeicao === filtroPratoTipo;

      return matchBusca && matchTipo;
    });
  }, [pratos, filtroPratoBusca, filtroPratoTipo]);

  const recorrenciasFiltradas = useMemo(
    () =>
      recorrencias.filter(
        (serie) =>
          bateTurma(serie.turma_id) &&
          bateRefeicao(serie.tipo_refeicao) &&
          (!filtroStatus || serie.status === filtroStatus),
      ),
    [recorrencias, bateTurma, bateRefeicao, filtroStatus],
  );

  const avulsos = useMemo(
    () =>
      cardapios
        .filter((c) => !c.recorrencia_id && (c.origem === 'avulso' || !c.origem))
        .filter((c) => bateTurma(c.turma_id) && bateRefeicao(c.tipo_refeicao))
        .sort((a, b) => b.data_dia.localeCompare(a.data_dia) || a.tipo_refeicao.localeCompare(b.tipo_refeicao)),
    [cardapios, bateTurma, bateRefeicao],
  );

  const excecoesDaSerie = useCallback(
    (recorrenciaId: string) =>
      cardapios
        .filter((c) => c.recorrencia_id === recorrenciaId && c.origem === 'excecao')
        .sort((a, b) => a.data_dia.localeCompare(b.data_dia)),
    [cardapios],
  );

  const diasSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => somarDias(semanaRef, i)),
    [semanaRef],
  );

  const cardapiosNaData = useCallback(
    (iso: string) =>
      cardapios
        .filter((c) => c.data_dia.slice(0, 10) === iso)
        .filter((c) => bateTurma(c.turma_id) && bateRefeicao(c.tipo_refeicao))
        .sort((a, b) => a.tipo_refeicao.localeCompare(b.tipo_refeicao)),
    [cardapios, bateTurma, bateRefeicao],
  );

  const badgeTurma = (turmaIdItem?: string | null) => (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
        turmaIdItem
          ? 'bg-salvia-100 text-salvia-800 dark:bg-salvia-900/60 dark:text-salvia-200'
          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
      }`}
    >
      {nomeTurma(turmaIdItem)}
    </span>
  );

  const aplicarPrato = (id: string) => {
    setPratoId(id);
    const prato = pratos.find((item) => item.id === id);
    if (!prato) return;
    setTitulo(prato.titulo);
    setIngredientes(prato.descricao_ingredientes);
    setAlergicos(prato.alergicos_atencao || '');
    if (prato.tipo_refeicao) setTipo(prato.tipo_refeicao);
  };

  const garantirNutricionista = async () => {
    if (nutricionistaId !== '__novo__') return nutricionistaId;
    if (!novoNutri.nome.trim() || !novoNutri.cpf.trim()) {
      throw new Error('Informe nome e CPF do nutricionista.');
    }
    const criado = await apiFetch<FuncionarioRh>('/administrativo/funcionarios', {
      method: 'POST',
      body: JSON.stringify({
        nome: novoNutri.nome,
        cpf: novoNutri.cpf,
        cargo: 'Nutricionista',
        departamento: 'Nutrição',
        data_admissao: hoje,
        salario: 0,
      }),
    });
    setFuncionarios((prev) => [...prev, { ...criado, status: criado.status || 'ativo' }]);
    setNutricionistaId(criado.id);
    return criado.id;
  };

  const payloadBase = (funcionarioId: string) => {
    const dataInicio = modo === 'dia' ? dataDia : inicio;
    const dataFim = modo === 'dia' ? dataDia : fim;
    const diasSemanaPayload = modo === 'dia'
      ? [new Date(`${dataDia}T12:00:00`).getDay() === 0 ? 7 : new Date(`${dataDia}T12:00:00`).getDay()]
      : dias;
    return {
      titulo_menu: titulo,
      descricao_ingredientes: ingredientes,
      alergicos_atencao: alergicos || null,
      turma_id: turmaId || null,
      tipo_refeicao: tipo,
      dias_semana: diasSemanaPayload,
      data_inicio: dataInicio,
      data_fim: dataFim,
      nutricionista_id: funcionarioId,
      pular_feriados: pularFeriados,
    };
  };

  const verPrevia = async () => {
    try {
      const funcionarioId = await garantirNutricionista();
      if (!funcionarioId) return;
      const resposta = await apiFetch<{ dias: PreviaDia[] }>('/nutricao/cardapios/recorrencias/previa', {
        method: 'POST',
        body: JSON.stringify(payloadBase(funcionarioId)),
      });
      setPrevia(resposta.dias);
      setErro(null);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível montar a prévia.');
    }
  };

  const gerar = async () => {
    try {
      const funcionarioId = await garantirNutricionista();
      if (!funcionarioId) return;
      const resposta = await apiFetch<{ geradas: number; ignoradas: { data: string }[] }>(
        '/nutricao/cardapios/recorrencias',
        { method: 'POST', body: JSON.stringify(payloadBase(funcionarioId)) },
      );
      setAviso(
        resposta.ignoradas.length
          ? `${resposta.geradas} dia(s) gerado(s). ${resposta.ignoradas.length} ignorado(s) por conflito ou feriado.`
          : `${resposta.geradas} dia(s) publicado(s) na vigência.`,
      );
      setAberto(false);
      setPrevia(null);
      setTitulo('');
      setIngredientes('');
      setAlergicos('');
      setVisao(modo === 'dia' ? 'avulsos' : 'vigencias');
      await carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gerar o cardápio.');
    }
  };

  const salvarEdicao = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editando) return;
    try {
      let funcionarioId = nutricionistaId;
      if (escopo === 'dia' && nutricionistaId === '__novo__') {
        funcionarioId = await garantirNutricionista();
      }
      const resposta = await apiFetch<{ atualizados: number; corte?: string }>('/nutricao/cardapios/' + editando.id, {
        method: 'PUT',
        body: JSON.stringify({
          escopo,
          titulo_menu: titulo,
          descricao_ingredientes: ingredientes,
          alergicos_atencao: alergicos || null,
          tipo_refeicao: tipo,
          data_dia: escopo === 'dia' ? dataDia : undefined,
          turma_id: turmaId || null,
          limpar_turma: !turmaId,
          nutricionista_id: escopo === 'dia' && funcionarioId ? funcionarioId : undefined,
        }),
      });
      setAviso(
        escopo === 'dia'
          ? 'Cardápio atualizado.'
          : `${resposta.atualizados} dia(s) a partir de ${formatarData(resposta.corte || editando.data_dia)} atualizado(s). O que já passou permanece.`,
      );
      setEditando(null);
      setErro(null);
      await carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível editar o cardápio.');
    }
  };

  const abrirEdicao = (cardapio: Cardapio, proximoEscopo: 'dia' | 'seguintes' = 'dia') => {
    setAberto(false);
    setEditando(cardapio);
    setEscopo(proximoEscopo);
    setTitulo(cardapio.titulo_menu);
    setIngredientes(cardapio.descricao_ingredientes);
    setAlergicos(cardapio.alergicos_atencao || '');
    setTipo(cardapio.tipo_refeicao);
    setDataDia(cardapio.data_dia.slice(0, 10));
    setTurmaId(cardapio.turma_id || '');
    setNutricionistaId(cardapio.nutricionista_id || '');
    setNovoNutri({ nome: '', cpf: '' });
  };

  const abrirEdicaoSerie = (serie: Recorrencia) => {
    const daSerie = cardapios
      .filter((c) => c.recorrencia_id === serie.id)
      .sort((a, b) => a.data_dia.localeCompare(b.data_dia));
    const futuro = daSerie.find((c) => c.data_dia >= hoje && c.origem !== 'excecao')
      || daSerie.find((c) => c.data_dia >= hoje)
      || daSerie[daSerie.length - 1];
    if (!futuro) {
      setErro('Esta vigência ainda não tem dias publicados para editar.');
      return;
    }
    abrirEdicao(futuro, futuro.data_dia >= hoje ? 'seguintes' : 'dia');
  };

  const confirmarExclusao = async () => {
    if (!confirmacao) return;
    setExcluindo(true);
    try {
      if (confirmacao.tipo === 'dia') {
        await apiFetch('/nutricao/cardapios/' + confirmacao.cardapio.id, { method: 'DELETE' });
        setAviso(`Cardápio de ${formatarData(confirmacao.cardapio.data_dia)} excluído.`);
      } else {
        const resposta = await apiFetch<{ removidos: number; serie_removida: boolean; data_fim?: string }>(
          '/nutricao/cardapios/recorrencias/' + confirmacao.serie.id + '/encerrar',
          { method: 'POST', body: '{}' },
        );
        setAviso(
          resposta.serie_removida
            ? `Vigência removida. ${resposta.removidos} dia(s) futuro(s) excluído(s).`
            : `Vigência encerrada. ${resposta.removidos} dia(s) a partir de hoje removido(s). O histórico permanece.`,
        );
      }
      setConfirmacao(null);
      setEditando(null);
      setErro(null);
      await carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível excluir.');
    } finally {
      setExcluindo(false);
    }
  };

  const alternarDia = (id: number) => {
    setDias((atual) => atual.includes(id) ? atual.filter((dia) => dia !== id) : [...atual, id].sort());
    setPrevia(null);
  };

  const abrirNovoPrato = () => {
    setEditandoPrato(null);
    setPratoTitulo('');
    setPratoIngredientes('');
    setPratoAlergicos('');
    setPratoTipo('');
    setErro(null);
    setModalPratoAberto(true);
  };

  const abrirEditarPrato = (p: Prato) => {
    setEditandoPrato(p);
    setPratoTitulo(p.titulo);
    setPratoIngredientes(p.descricao_ingredientes);
    setPratoAlergicos(p.alergicos_atencao || '');
    setPratoTipo(p.tipo_refeicao || '');
    setErro(null);
    setModalPratoAberto(true);
  };

  const salvarPrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pratoTitulo.trim() || !pratoIngredientes.trim()) {
      setErro('Informe o nome e os ingredientes do prato.');
      return;
    }
    setSalvandoPrato(true);
    setErro(null);
    try {
      const payload = {
        titulo: pratoTitulo.trim(),
        descricao_ingredientes: pratoIngredientes.trim(),
        tipo_refeicao: pratoTipo.trim() || null,
        alergicos_atencao: pratoAlergicos.trim() || null,
      };

      if (editandoPrato) {
        await apiFetch<Prato>(`/nutricao/pratos/${editandoPrato.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setAviso(`Prato "${pratoTitulo}" atualizado com sucesso.`);
      } else {
        await apiFetch<Prato>('/nutricao/pratos', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setAviso(`Prato "${pratoTitulo}" cadastrado com sucesso.`);
      }
      setModalPratoAberto(false);
      await carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar prato.');
    } finally {
      setSalvandoPrato(false);
    }
  };

  const confirmarExclusaoPrato = async () => {
    if (!confirmacaoPrato) return;
    setExcluindoPrato(true);
    setErro(null);
    try {
      const res = await apiFetch<{
        excluido: boolean;
        id: string;
        soft_delete: boolean;
        cardapios_vinculados?: number;
        recorrencias_vinculadas?: number;
        mensagem: string;
      }>(`/nutricao/pratos/${confirmacaoPrato.id}`, {
        method: 'DELETE',
      });
      setAviso(res.mensagem || 'Prato removido com sucesso.');
      setConfirmacaoPrato(null);
      await carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao excluir prato.');
    } finally {
      setExcluindoPrato(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {visao === 'pratos' ? 'Catálogo de pratos' : 'Gestão de cardápios'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xl">
            {visao === 'pratos'
              ? 'Gerencie pratos reutilizáveis com ingredientes, tipo de refeição e alertas de alérgenos.'
              : 'Cadastre a vigência uma vez. Use a semana para conferir o que o Diário publica e marque só as exceções.'}
          </p>
        </div>
        {visao === 'pratos' ? (
          <button
            onClick={abrirNovoPrato}
            className="bg-salvia-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-salvia-800 flex items-center space-x-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo prato</span>
          </button>
        ) : (
          <button
            onClick={() => { setAberto(true); setPrevia(null); setEditando(null); setModo(visao === 'avulsos' ? 'dia' : 'vigencia'); }}
            className="bg-salvia-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-salvia-800 flex items-center space-x-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo cardápio</span>
          </button>
        )}
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full max-w-lg">
        {([
          ['vigencias', 'Vigências'],
          ['semana', 'Semana'],
          ['avulsos', 'Avulsos'],
          ['pratos', 'Pratos'],
        ] as const).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setVisao(id)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${visao === id ? 'bg-salvia-700 text-white' : 'text-slate-600 dark:text-slate-300'}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {visao === 'pratos' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 items-end">
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
            Buscar prato ou ingrediente
            <input
              type="text"
              value={filtroPratoBusca}
              onChange={(e) => setFiltroPratoBusca(e.target.value)}
              placeholder="Ex.: Frango, arroz integral, glúten..."
              className={`${campo} mt-1`}
            />
          </label>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
            Tipo de refeição
            <select
              value={filtroPratoTipo}
              onChange={(e) => setFiltroPratoTipo(e.target.value)}
              className={`${campo} mt-1`}
            >
              <option value="">Todas as refeições</option>
              {REFEICOES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2 pb-0.5">
            {filtrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">Turma
            <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} className={`${campo} mt-1`}>
              <option value="">Todas</option>
              <option value="__geral__">Geral (toda a escola)</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>{turma.nome}</option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">Refeição
            <select value={filtroRefeicao} onChange={(e) => setFiltroRefeicao(e.target.value)} className={`${campo} mt-1`}>
              <option value="">Todas</option>
              {REFEICOES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {visao === 'vigencias' ? (
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">Status
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={`${campo} mt-1`}>
                <option value="">Todos</option>
                <option value="ativa">Ativa</option>
                <option value="futura">Futura</option>
                <option value="encerrada">Encerrada</option>
              </select>
            </label>
          ) : (
            <div className="hidden lg:block" />
          )}
          <div className="flex items-center gap-2 pb-0.5">
            {filtrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {erro && <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{erro}</p>}
      {aviso && <p className="text-xs font-semibold text-salvia-800 dark:text-salvia-200">{aviso}</p>}

      {visao === 'vigencias' && (
        <div className="space-y-3">
          {recorrencias.length === 0 && (
            <p className="text-xs text-slate-500">Nenhuma vigência cadastrada. Publique um cardápio com repetição semanal.</p>
          )}
          {recorrencias.length > 0 && recorrenciasFiltradas.length === 0 && (
            <p className="text-xs text-slate-500">Nenhuma vigência com esses filtros.</p>
          )}
          {recorrenciasFiltradas.map((serie) => {
            const excecoes = excecoesDaSerie(serie.id);
            const aberta = serieExpandida === serie.id;
            return (
              <article
                key={serie.id}
                className="bg-white dark:bg-salvia-900 border border-slate-200 dark:border-salvia-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{serie.titulo}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-salvia-100 text-salvia-800 dark:bg-salvia-900/60 dark:text-salvia-200">
                        {serie.tipo_refeicao}
                      </span>
                      {badgeTurma(serie.turma_id)}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        serie.status === 'ativa'
                          ? 'bg-emerald-100 text-emerald-900'
                          : serie.status === 'futura'
                            ? 'bg-sky-100 text-sky-900'
                            : 'bg-slate-200 text-slate-700'
                      }`}>
                        {statusLabel[serie.status] || serie.status}
                      </span>
                      {serie.excecoes > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                          {serie.excecoes} exceção(ões)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{serie.descricao_ingredientes}</p>
                    <p className="text-[11px] text-slate-500">
                      {rotuloDias(serie.dias_semana)} · {formatarData(serie.data_inicio)} a {formatarData(serie.data_fim)} · {serie.dias_publicados} dia(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-start">
                    <button
                      type="button"
                      onClick={() => {
                        setSemanaRef(inicioSemana(serie.data_inicio > hoje ? serie.data_inicio : hoje));
                        setVisao('semana');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      Ver na semana
                    </button>
                    {serie.status !== 'encerrada' && (
                      <button
                        type="button"
                        onClick={() => abrirEdicaoSerie(serie)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-salvia-700 text-white hover:bg-salvia-800"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar série
                      </button>
                    )}
                    {serie.status !== 'encerrada' && serie.data_fim >= hoje && (
                      <button
                        type="button"
                        onClick={() => setConfirmacao({ tipo: 'serie', serie })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Encerrar
                      </button>
                    )}
                  </div>
                </div>
                {(serie.excecoes > 0 || aberta) && (
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => setSerieExpandida(aberta ? null : serie.id)}
                      className="text-[11px] font-bold text-amber-800 dark:text-amber-200"
                    >
                      {aberta ? 'Ocultar exceções' : `Mostrar ${serie.excecoes} exceção(ões)`}
                    </button>
                    {aberta && (
                      <ul className="space-y-2">
                        {excecoes.map((ex) => (
                          <li key={ex.id} className="flex flex-wrap justify-between gap-2 items-center text-xs bg-amber-50/80 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                            <div>
                              <span className="font-bold">{formatarData(ex.data_dia)}</span>
                              {' · '}
                              <span>{ex.titulo_menu}</span>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400">{ex.descricao_ingredientes}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => abrirEdicao(ex, 'dia')}
                                className="text-[11px] font-bold text-salvia-800 dark:text-salvia-200"
                              >
                                Editar dia
                              </button>
                              {ex.data_dia >= hoje && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmacao({ tipo: 'dia', cardapio: ex })}
                                  className="text-[11px] font-bold text-rose-700 dark:text-rose-300"
                                >
                                  Excluir
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                        {excecoes.length === 0 && (
                          <li className="text-[11px] text-slate-500">Nenhuma exceção neste momento.</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {visao === 'semana' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSemanaRef(somarDias(semanaRef, -7))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {formatarData(diasSemana[0])} — {formatarData(diasSemana[6])}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSemanaRef(inicioSemana(hoje))}
                className="px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setSemanaRef(somarDias(semanaRef, 7))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                aria-label="Próxima semana"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
            {diasSemana.map((iso, idx) => {
              const itens = cardapiosNaData(iso);
              const ehHoje = iso === hoje;
              return (
                <div
                  key={iso}
                  className={`min-h-[140px] rounded-xl border p-2 space-y-2 ${
                    ehHoje
                      ? 'border-salvia-500 bg-salvia-50/60 dark:bg-salvia-950/40'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c120e]'
                  }`}
                >
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold uppercase text-slate-500">{DIAS[idx]?.rotulo}</span>
                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300">{formatarData(iso)}</span>
                  </div>
                  {itens.length === 0 && (
                    <p className="text-[10px] text-slate-400">Sem refeição</p>
                  )}
                  {itens.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => abrirEdicao(item, 'dia')}
                      className={`w-full text-left rounded-lg px-2 py-1.5 space-y-0.5 border ${
                        item.origem === 'excecao'
                          ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40'
                          : 'border-transparent bg-white/80 dark:bg-salvia-900/50'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1">
                        <p className="text-[10px] font-bold text-salvia-800 dark:text-salvia-200">{item.tipo_refeicao}</p>
                        {badgeTurma(item.turma_id)}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 leading-tight">{item.titulo_menu}</p>
                      {item.origem === 'excecao' && (
                        <p className="text-[9px] font-bold text-amber-800">Exceção</p>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {visao === 'avulsos' && (
        <div className="space-y-3">
          {avulsos.length === 0 && (
            <p className="text-xs text-slate-500">
              {filtrosAtivos
                ? 'Nenhum cardápio pontual com esses filtros.'
                : 'Nenhum cardápio pontual. Use “Novo cardápio” no modo Um dia.'}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {avulsos.map((cardapio) => (
              <article key={cardapio.id} className="bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10px] font-bold text-salvia-700 font-mono bg-salvia-100 dark:bg-salvia-900/60 px-2 py-0.5 rounded-full">
                    {cardapio.tipo_refeicao}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{formatarData(cardapio.data_dia)}</span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">{cardapio.titulo_menu}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">{cardapio.descricao_ingredientes}</p>
                {badgeTurma(cardapio.turma_id)}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => abrirEdicao(cardapio, 'dia')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-salvia-700 text-white hover:bg-salvia-800"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  {cardapio.data_dia >= hoje && (
                    <button
                      type="button"
                      onClick={() => setConfirmacao({ tipo: 'dia', cardapio })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {visao === 'pratos' && (
        <div className="space-y-3">
          {pratos.length === 0 && (
            <p className="text-xs text-slate-500">
              Nenhum prato cadastrado ainda. Clique em &quot;Novo prato&quot; para cadastrar itens no catálogo reutilizável.
            </p>
          )}
          {pratos.length > 0 && pratosFiltrados.length === 0 && (
            <p className="text-xs text-slate-500">
              Nenhum prato encontrado com os filtros selecionados.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pratosFiltrados.map((prato) => (
              <article
                key={prato.id}
                className="bg-white dark:bg-salvia-900 border border-slate-200 dark:border-salvia-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                      {prato.titulo}
                    </h4>
                    {prato.tipo_refeicao && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-salvia-100 text-salvia-800 dark:bg-salvia-900/60 dark:text-salvia-200 font-mono">
                        {prato.tipo_refeicao}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 whitespace-pre-line">
                    {prato.descricao_ingredientes}
                  </p>
                  {prato.alergicos_atencao && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-900 dark:text-amber-200">
                      <span className="font-bold">Alérgenos / Atenção: </span>
                      {prato.alergicos_atencao}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => abrirEditarPrato(prato)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmacaoPrato(prato)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {aberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Publicar cardápio</h3>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button type="button" onClick={() => { setModo('vigencia'); setPrevia(null); }} className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${modo === 'vigencia' ? 'bg-salvia-700 text-white' : ''}`}>Repetir na vigência</button>
              <button type="button" onClick={() => { setModo('dia'); setPrevia(null); }} className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${modo === 'dia' ? 'bg-salvia-700 text-white' : ''}`}>Um dia</button>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold">Prato já cadastrado</label>
                {pratoId && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = pratos.find((item) => item.id === pratoId);
                      if (p) abrirEditarPrato(p);
                    }}
                    className="text-[10px] font-bold text-salvia-700 dark:text-salvia-300 hover:underline flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar prato
                  </button>
                )}
              </div>
              <select value={pratoId} onChange={(e) => aplicarPrato(e.target.value)} className={`${campo} mt-1`}>
                <option value="">Novo prato</option>
                {pratos.map((prato) => <option key={prato.id} value={prato.id}>{prato.titulo}</option>)}
              </select>
            </div>
            <label className="block text-[11px] font-bold">Título
              <input required value={titulo} onChange={(e) => { setTitulo(e.target.value); setPratoId(''); }} className={`${campo} mt-1`} />
            </label>
            <label className="block text-[11px] font-bold">Ingredientes
              <textarea required rows={2} value={ingredientes} onChange={(e) => setIngredientes(e.target.value)} className={`${campo} mt-1`} />
            </label>
            <label className="block text-[11px] font-bold">Alergênicos
              <input value={alergicos} onChange={(e) => setAlergicos(e.target.value)} className={`${campo} mt-1`} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-bold">Refeição
                <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPrevia(null); }} className={`${campo} mt-1`}>
                  {REFEICOES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="block text-[11px] font-bold">Turma
                <select value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setPrevia(null); }} className={`${campo} mt-1`}>
                  <option value="">Toda a escola</option>
                  {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
                </select>
              </label>
            </div>
            {modo === 'dia' ? (
              <label className="block text-[11px] font-bold">Data
                <input type="date" value={dataDia} onChange={(e) => { setDataDia(e.target.value); setPrevia(null); }} className={`${campo} mt-1`} />
              </label>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[11px] font-bold">Início
                    <input type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setPrevia(null); }} className={`${campo} mt-1`} />
                  </label>
                  <label className="block text-[11px] font-bold">Fim
                    <input type="date" value={fim} onChange={(e) => { setFim(e.target.value); setPrevia(null); }} className={`${campo} mt-1`} />
                  </label>
                </div>
                <div className="flex flex-wrap gap-1">
                  {DIAS.map((dia) => (
                    <button
                      key={dia.id}
                      type="button"
                      onClick={() => alternarDia(dia.id)}
                      className={`px-2 py-1 rounded-full text-[11px] font-bold border ${dias.includes(dia.id) ? 'bg-salvia-700 text-white border-salvia-700' : 'border-slate-300 text-slate-600'}`}
                    >
                      {dia.rotulo}
                    </button>
                  ))}
                </div>
              </>
            )}
            <label className="block text-[11px] font-bold">Nutricionista
              <select required value={nutricionistaId} onChange={(e) => setNutricionistaId(e.target.value)} className={`${campo} mt-1`}>
                <option value="">Selecione</option>
                {funcionarios.filter((f) => f.status === 'ativo').map((f) => (
                  <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>
                ))}
                <option value="__novo__">+ Cadastrar nutricionista</option>
              </select>
            </label>
            {nutricionistaId === '__novo__' && (
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Nome" value={novoNutri.nome} onChange={(e) => setNovoNutri({ ...novoNutri, nome: e.target.value })} className={campo} />
                <input placeholder="CPF" value={novoNutri.cpf} onChange={(e) => setNovoNutri({ ...novoNutri, cpf: e.target.value })} className={campo} />
              </div>
            )}
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={pularFeriados} onChange={(e) => setPularFeriados(e.target.checked)} />
              Não gerar em feriados e férias
            </label>
            {previa && (
              <ul className="max-h-40 overflow-y-auto space-y-1 text-[11px]">
                {previa.map((dia) => (
                  <li key={dia.data} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                    <span>{formatarData(dia.data)}</span>
                    <span className={dia.conflito ? 'text-rose-700 font-bold' : dia.feriado ? 'text-amber-800 font-bold' : 'text-salvia-800'}>
                      {dia.conflito ? dia.motivo : dia.feriado ? `Feriado: ${dia.feriado}` : 'Livre'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={verPrevia} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800">Ver prévia</button>
              <button type="button" onClick={gerar} disabled={!previa} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-salvia-700 text-white disabled:opacity-50">Gerar</button>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <form onSubmit={salvarEdicao} className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {escopo === 'seguintes' ? 'Editar série a partir deste dia' : 'Editar cardápio'}
              </h3>
              <button type="button" onClick={() => setEditando(null)} aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>
            {editando.recorrencia_id && (
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setEscopo('dia')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${escopo === 'dia' ? 'bg-salvia-700 text-white' : ''}`}
                >
                  Somente este dia
                </button>
                <button
                  type="button"
                  onClick={() => setEscopo('seguintes')}
                  disabled={editando.data_dia < hoje}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 ${escopo === 'seguintes' ? 'bg-salvia-700 text-white' : ''}`}
                >
                  Este e os próximos
                </button>
              </div>
            )}
            <label className="block text-[11px] font-bold">Título
              <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} className={`${campo} mt-1`} />
            </label>
            <label className="block text-[11px] font-bold">Ingredientes
              <textarea required rows={3} value={ingredientes} onChange={(e) => setIngredientes(e.target.value)} className={`${campo} mt-1`} />
            </label>
            <label className="block text-[11px] font-bold">Alergênicos
              <input value={alergicos} onChange={(e) => setAlergicos(e.target.value)} className={`${campo} mt-1`} />
            </label>
            {escopo === 'dia' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[11px] font-bold">Refeição
                    <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${campo} mt-1`}>
                      {!REFEICOES.includes(tipo) && <option value={tipo}>{tipo}</option>}
                      {REFEICOES.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="block text-[11px] font-bold">Data
                    <input type="date" required value={dataDia} onChange={(e) => setDataDia(e.target.value)} className={`${campo} mt-1`} />
                  </label>
                </div>
                <label className="block text-[11px] font-bold">Turma
                  <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={`${campo} mt-1`}>
                    <option value="">Toda a escola</option>
                    {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
                  </select>
                </label>
                <label className="block text-[11px] font-bold">Nutricionista
                  <select value={nutricionistaId} onChange={(e) => setNutricionistaId(e.target.value)} className={`${campo} mt-1`}>
                    <option value="">Manter atual ({editando.nutricionista_responsavel})</option>
                    {funcionarios.filter((f) => f.status === 'ativo').map((f) => (
                      <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>
                    ))}
                    <option value="__novo__">+ Cadastrar nutricionista</option>
                  </select>
                </label>
                {nutricionistaId === '__novo__' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Nome" value={novoNutri.nome} onChange={(e) => setNovoNutri({ ...novoNutri, nome: e.target.value })} className={campo} />
                    <input placeholder="CPF" value={novoNutri.cpf} onChange={(e) => setNovoNutri({ ...novoNutri, cpf: e.target.value })} className={campo} />
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between gap-2">
              {editando.data_dia >= hoje && (
                <button
                  type="button"
                  onClick={() => setConfirmacao({ tipo: 'dia', cardapio: editando })}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-200 text-rose-700"
                >
                  Excluir dia
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button type="button" onClick={() => setEditando(null)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800">Cancelar</button>
                <button type="submit" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-salvia-700 text-white">Salvar alterações</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {confirmacao && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-3">
          <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {confirmacao.tipo === 'serie' ? 'Encerrar vigência' : 'Excluir cardápio'}
              </h3>
              <button type="button" onClick={() => setConfirmacao(null)} aria-label="Fechar" disabled={excluindo}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {confirmacao.tipo === 'serie' ? (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Remover <strong>{confirmacao.serie.titulo}</strong> ({confirmacao.serie.tipo_refeicao}) a partir de hoje.
                Dias já publicados no passado permanecem no Diário.
                {confirmacao.serie.data_inicio >= hoje
                  ? ' Como a vigência ainda não começou, ela será removida por completo.'
                  : ''}
              </p>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Excluir <strong>{confirmacao.cardapio.titulo_menu}</strong> de {formatarData(confirmacao.cardapio.data_dia)}
                {confirmacao.cardapio.origem === 'excecao' ? ' (exceção deste dia)' : ''}?
                Só é permitido para datas a partir de hoje.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={excluindo}
                onClick={() => setConfirmacao(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={excluindo}
                onClick={confirmarExclusao}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-700 text-white disabled:opacity-50"
              >
                {excluindo ? 'Excluindo…' : confirmacao.tipo === 'serie' ? 'Encerrar e remover futuros' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalPratoAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-3">
          <form
            onSubmit={salvarPrato}
            className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editandoPrato ? 'Editar prato do catálogo' : 'Novo prato do catálogo'}
              </h3>
              <button
                type="button"
                onClick={() => setModalPratoAberto(false)}
                disabled={salvandoPrato}
                aria-label="Fechar"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Nome do prato *
                  <input
                    type="text"
                    required
                    value={pratoTitulo}
                    onChange={(e) => setPratoTitulo(e.target.value)}
                    placeholder="Ex.: Risoto de frango com legumes"
                    className={`${campo} mt-1`}
                  />
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Tipo de refeição sugerido
                  <select
                    value={pratoTipo}
                    onChange={(e) => setPratoTipo(e.target.value)}
                    className={`${campo} mt-1`}
                  >
                    <option value="">Geral / Qualquer refeição</option>
                    {REFEICOES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Ingredientes e descrição *
                  <textarea
                    required
                    rows={3}
                    value={pratoIngredientes}
                    onChange={(e) => setPratoIngredientes(e.target.value)}
                    placeholder="Ex.: Peito de frango desfiado, arroz integral, cenoura ralada, abobrinha, azeite de oliva e cheiro verde."
                    className={`${campo} mt-1`}
                  />
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Alérgenos e atenção (opcional)
                  <input
                    type="text"
                    value={pratoAlergicos}
                    onChange={(e) => setPratoAlergicos(e.target.value)}
                    placeholder="Ex.: Glúten, lactose, traços de nozes"
                    className={`${campo} mt-1`}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={salvandoPrato}
                onClick={() => setModalPratoAberto(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvandoPrato}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-salvia-700 text-white hover:bg-salvia-800 disabled:opacity-50"
              >
                {salvandoPrato ? 'Salvando...' : editandoPrato ? 'Salvar alterações' : 'Cadastrar prato'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmacaoPrato && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-3">
          <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Excluir prato do catálogo
              </h3>
              <button
                type="button"
                onClick={() => setConfirmacaoPrato(null)}
                aria-label="Fechar"
                disabled={excluindoPrato}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Deseja remover <strong>{confirmacaoPrato.titulo}</strong> do catálogo de pratos?
            </p>
            <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-300">Política de exclusão segura:</p>
              <p>
                Se o prato estiver em uso por cardápios ou séries de vigência, ele será desativado (soft-delete) para preservar o histórico alimentar das turmas. Caso não esteja em uso, será excluído permanentemente.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={excluindoPrato}
                onClick={() => setConfirmacaoPrato(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={excluindoPrato}
                onClick={confirmarExclusaoPrato}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-700 text-white disabled:opacity-50"
              >
                {excluindoPrato ? 'Excluindo…' : 'Excluir prato'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
