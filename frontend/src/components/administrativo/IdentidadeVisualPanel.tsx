'use client';

import React from 'react';
import {
  PRESETS,
  gerarTema,
  temaParaVariaveis,
  validarTema,
  tomMaisProximo,
  normalizarHex,
  textoSobre,
} from '@/lib/tema';
import { Palette, Upload, Trash2, RotateCcw, Save, AlertTriangle } from 'lucide-react';

export interface IdentidadeVisualForm {
  corPrimaria: string;
  corDestaque: string;
  nomeExibicao: string;
}

export interface IdentidadeVisualPanelProps {
  form: IdentidadeVisualForm;
  logoSrc: string | null;
  loading?: boolean;
  salvando?: boolean;
  error?: string | null;
  onChange: (field: keyof IdentidadeVisualForm, value: string) => void;
  onAplicarPreset: (preset: { nome: string; corPrimaria: string; corDestaque: string }) => void;
  onSalvar: () => void | Promise<void>;
  onEnviarLogo: (file: File) => void | Promise<void>;
  onRemoverLogo: () => void | Promise<void>;
  onRestaurar: () => void;
}

export function IdentidadeVisualPanel({
  form,
  logoSrc,
  loading = false,
  salvando = false,
  error = null,
  onChange,
  onAplicarPreset,
  onSalvar,
  onEnviarLogo,
  onRemoverLogo,
  onRestaurar,
}: IdentidadeVisualPanelProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const corPrimariaNorm = normalizarHex(form.corPrimaria);
  const corDestaqueNorm = normalizarHex(form.corDestaque);
  const corPrimariaValida = corPrimariaNorm !== null;
  const corDestaqueValida = corDestaqueNorm !== null;
  const temaValido = corPrimariaValida && corDestaqueValida;

  // Cálculo seguro do tema para evitar quebrar a pré-visualização quando o hex for inválido
  const temaSeguro = temaValido
    ? { corPrimaria: form.corPrimaria, corDestaque: form.corDestaque }
    : PRESETS.salvia;

  const varsTema = temaParaVariaveis(temaSeguro);
  const temaGerado = gerarTema(temaSeguro);

  const tomPrimaria = temaValido ? tomMaisProximo(form.corPrimaria, temaGerado.brand) : null;
  const tomDestaque = temaValido ? tomMaisProximo(form.corDestaque, temaGerado.accent) : null;

  const validacao = temaValido
    ? validarTema(temaSeguro)
    : { aprovado: false, pares: [] };

  const corTextoDestaque = textoSobre(temaGerado.accent[500]);
  const salvarDesabilitado =
    loading || salvando || !temaValido || !validacao.aprovado;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void onEnviarLogo(file);
    }
    // Limpa o valor para permitir selecionar o mesmo arquivo novamente se necessário
    if (e.target) {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8">
      {/* Mensagem de erro geral da API ou validação de arquivo */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-900 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {/* Bloco 1: Presets rápidos e restaurar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-salvia-50/70 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl">
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200">
            Paletas predefinidas
          </h3>
          <p className="text-xs text-salvia-600 dark:text-salvia-400">
            Selecione uma paleta pronta com contraste auditado ou monte as cores da sua escola.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onAplicarPreset(PRESETS.salvia)}
            className="px-3 py-1.5 rounded-xl border border-salvia-300 dark:border-salvia-700 bg-white dark:bg-salvia-900 text-xs font-bold text-salvia-800 dark:text-salvia-200 hover:bg-salvia-100 dark:hover:bg-salvia-800 transition-colors flex items-center space-x-1.5"
          >
            <span
              className="w-3 h-3 rounded-full inline-block border border-black/10"
              style={{ backgroundColor: PRESETS.salvia.corPrimaria }}
            />
            <span>Sálvia</span>
          </button>
          <button
            type="button"
            onClick={() => onAplicarPreset(PRESETS.azulLaranja)}
            className="px-3 py-1.5 rounded-xl border border-salvia-300 dark:border-salvia-700 bg-white dark:bg-salvia-900 text-xs font-bold text-salvia-800 dark:text-salvia-200 hover:bg-salvia-100 dark:hover:bg-salvia-800 transition-colors flex items-center space-x-1.5"
          >
            <span
              className="w-3 h-3 rounded-full inline-block border border-black/10"
              style={{ backgroundColor: PRESETS.azulLaranja.corPrimaria }}
            />
            <span>Azul & Laranja</span>
          </button>
          <button
            type="button"
            onClick={onRestaurar}
            disabled={salvando || loading}
            className="px-3 py-1.5 rounded-xl border border-salvia-300 dark:border-salvia-700 bg-salvia-100 dark:bg-salvia-800 text-xs font-semibold text-salvia-700 dark:text-salvia-300 hover:bg-salvia-200 dark:hover:bg-salvia-700 transition-colors flex items-center space-x-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Sálvia</span>
          </button>
        </div>
      </div>

      {/* Bloco 2: Formulário de Cores, Nome e Logotipo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 & 2: Campos de cores e nome */}
        <div className="lg:col-span-2 space-y-5 p-5 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl shadow-sm">
          <div className="space-y-1">
            <label
              htmlFor="nome-exibicao"
              className="block text-xs font-bold uppercase tracking-wider text-salvia-700 dark:text-salvia-300"
            >
              Nome de exibição da escola
            </label>
            <input
              id="nome-exibicao"
              type="text"
              maxLength={120}
              value={form.nomeExibicao}
              onChange={(e) => onChange('nomeExibicao', e.target.value)}
              placeholder="Ex: Colégio Futuro Brasil"
              className="w-full px-3.5 py-2.5 rounded-xl border border-salvia-300 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 text-xs font-medium focus:ring-2 focus:ring-salvia-500 outline-none transition-all"
            />
            <p className="text-[11px] text-salvia-500 dark:text-salvia-400">
              Nome apresentado na barra lateral, no cabeçalho e na tela inicial (máx. 120 caracteres).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-salvia-100 dark:border-salvia-800">
            {/* Cor principal */}
            <div className="space-y-2">
              <label
                htmlFor="cor-primaria-hex"
                className="block text-xs font-bold uppercase tracking-wider text-salvia-700 dark:text-salvia-300"
              >
                Cor principal (Brand)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  aria-label="Seletor de cor principal"
                  value={corPrimariaValida ? (corPrimariaNorm as string) : '#2d5338'}
                  onChange={(e) => onChange('corPrimaria', e.target.value)}
                  className="w-10 h-10 p-0.5 rounded-xl border border-salvia-300 dark:border-salvia-700 cursor-pointer bg-transparent"
                />
                <input
                  id="cor-primaria-hex"
                  type="text"
                  aria-label="Código hexadecimal da cor principal"
                  value={form.corPrimaria}
                  onChange={(e) => onChange('corPrimaria', e.target.value)}
                  placeholder="#2d5338"
                  className="w-28 px-3 py-2 rounded-xl border border-salvia-300 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 text-xs font-mono font-bold focus:ring-2 focus:ring-salvia-500 outline-none uppercase"
                />
              </div>

              {!corPrimariaValida ? (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Código hexadecimal inválido (ex: #2d5338).</span>
                </p>
              ) : tomPrimaria !== null ? (
                <p className="text-xs font-medium text-salvia-600 dark:text-salvia-400">
                  Sua cor principal ficou como o tom {tomPrimaria}
                </p>
              ) : null}
            </div>

            {/* Cor de destaque */}
            <div className="space-y-2">
              <label
                htmlFor="cor-destaque-hex"
                className="block text-xs font-bold uppercase tracking-wider text-salvia-700 dark:text-salvia-300"
              >
                Cor de destaque (Accent)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  aria-label="Seletor de cor de destaque"
                  value={corDestaqueValida ? (corDestaqueNorm as string) : '#f59e0b'}
                  onChange={(e) => onChange('corDestaque', e.target.value)}
                  className="w-10 h-10 p-0.5 rounded-xl border border-salvia-300 dark:border-salvia-700 cursor-pointer bg-transparent"
                />
                <input
                  id="cor-destaque-hex"
                  type="text"
                  aria-label="Código hexadecimal da cor de destaque"
                  value={form.corDestaque}
                  onChange={(e) => onChange('corDestaque', e.target.value)}
                  placeholder="#f59e0b"
                  className="w-28 px-3 py-2 rounded-xl border border-salvia-300 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 text-xs font-mono font-bold focus:ring-2 focus:ring-salvia-500 outline-none uppercase"
                />
              </div>

              {!corDestaqueValida ? (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Código hexadecimal inválido (ex: #f59e0b).</span>
                </p>
              ) : tomDestaque !== null ? (
                <p className="text-xs font-medium text-salvia-600 dark:text-salvia-400">
                  Sua cor de destaque ficou como o tom {tomDestaque}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Coluna 3: Envio e Gerenciamento de Logotipo */}
        <div className="space-y-4 p-5 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-700 dark:text-salvia-300">
              Logotipo da instituição
            </h3>

            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-salvia-200 dark:border-salvia-700 bg-salvia-50/50 dark:bg-salvia-950 flex items-center justify-center p-2 overflow-hidden">
                {logoSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoSrc}
                    alt="Miniatura do logotipo da escola"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Palette className="w-8 h-8 text-salvia-400 dark:text-salvia-600" />
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-900 dark:text-salvia-100 block">
                  {logoSrc ? 'Logotipo ativo' : 'Sem logotipo'}
                </span>
                <p className="text-[11px] text-salvia-500 dark:text-salvia-400">
                  PNG, JPEG ou WEBP (máx. 256 KB).
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload de logotipo"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-salvia-100 dark:border-salvia-800">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={salvando || loading}
              className="flex-1 px-3 py-2 rounded-xl bg-salvia-100 dark:bg-salvia-800 hover:bg-salvia-200 dark:hover:bg-salvia-700 text-salvia-800 dark:text-salvia-200 text-xs font-bold transition-colors flex items-center justify-center space-x-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{logoSrc ? 'Substituir logo' : 'Enviar logo'}</span>
            </button>

            {logoSrc && (
              <button
                type="button"
                onClick={onRemoverLogo}
                disabled={salvando || loading}
                className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors flex items-center justify-center"
                title="Remover logotipo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bloco 3: Pré-visualização lado a lado (Claro e Escuro) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200">
            Pré-visualização do tema
          </h3>
          <span className="text-[11px] text-salvia-500 dark:text-salvia-400 font-medium">
            Simulação em tempo real nos modos claro e escuro
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* BLOCO CLARO: Usa apenas classes claras explicitas, sem 'dark:' */}
          <div
            data-testid="preview-bloco-claro"
            style={varsTema as React.CSSProperties}
            className="p-5 rounded-2xl bg-canvas border border-salvia-200 text-ink space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs font-bold text-salvia-800 uppercase tracking-wider pb-2 border-b border-salvia-200">
              <span>Modo Claro</span>
              <span className="text-[10px] bg-salvia-100 text-salvia-700 px-2 py-0.5 rounded-full font-medium">
                Simulação
              </span>
            </div>

            {/* Mini cabeçalho com logo e nome */}
            <div className="bg-white border border-salvia-200 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                {logoSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoSrc}
                    alt="Logo"
                    className="w-6 h-6 object-contain rounded"
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-salvia-700 text-white flex items-center justify-center text-[10px] font-bold">
                    {form.nomeExibicao ? form.nomeExibicao.charAt(0).toUpperCase() : 'E'}
                  </div>
                )}
                <span className="font-bold text-xs text-slate-900 truncate">
                  {form.nomeExibicao || 'Escola Modelo'}
                </span>
              </div>

              {/* Menu com item ativo */}
              <div className="flex items-center gap-1 text-[11px]">
                <span className="px-2.5 py-1 rounded-lg bg-salvia-700 text-white font-semibold">
                  Início
                </span>
                <span className="px-2.5 py-1 rounded-lg text-salvia-700 font-medium">
                  Turmas
                </span>
              </div>
            </div>

            {/* Card com badge */}
            <div className="p-4 bg-white border border-salvia-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">Turma 3º Ano B</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-salvia-100 text-salvia-800 border border-salvia-200">
                  Matriculado
                </span>
              </div>
              <p className="text-[11px] text-salvia-600">
                32 alunos confirmados para o ano letivo.
              </p>
            </div>

            {/* Botões lado a lado */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="px-3.5 py-2 rounded-xl bg-salvia-700 text-white text-xs font-bold shadow-sm"
              >
                Ação principal
              </button>
              <button
                type="button"
                className="px-3.5 py-2 rounded-xl bg-accent-500 text-xs font-bold shadow-sm"
                style={{ color: corTextoDestaque }}
              >
                Destaque
              </button>
            </div>

            {/* Aviso âmbar fixo (NÃO segue o tema) */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 font-medium">
              <span>Aviso: Período de rematrícula termina em 5 dias.</span>
            </div>
          </div>

          {/* BLOCO ESCURO: Usa apenas classes escuras explicitas, sem 'dark:' */}
          <div
            data-testid="preview-bloco-escuro"
            style={varsTema as React.CSSProperties}
            className="p-5 rounded-2xl bg-canvas-dark border border-salvia-800 text-salvia-50 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs font-bold text-salvia-300 uppercase tracking-wider pb-2 border-b border-salvia-800">
              <span>Modo Escuro</span>
              <span className="text-[10px] bg-salvia-900 text-salvia-300 px-2 py-0.5 rounded-full font-medium">
                Simulação
              </span>
            </div>

            {/* Mini cabeçalho com logo e nome */}
            <div className="bg-surface-dark border border-salvia-800 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                {logoSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoSrc}
                    alt="Logo"
                    className="w-6 h-6 object-contain rounded"
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-salvia-700 text-white flex items-center justify-center text-[10px] font-bold">
                    {form.nomeExibicao ? form.nomeExibicao.charAt(0).toUpperCase() : 'E'}
                  </div>
                )}
                <span className="font-bold text-xs text-salvia-50 truncate">
                  {form.nomeExibicao || 'Escola Modelo'}
                </span>
              </div>

              {/* Menu com item ativo */}
              <div className="flex items-center gap-1 text-[11px]">
                <span className="px-2.5 py-1 rounded-lg bg-salvia-700 text-white font-semibold">
                  Início
                </span>
                <span className="px-2.5 py-1 rounded-lg text-salvia-300 font-medium">
                  Turmas
                </span>
              </div>
            </div>

            {/* Card com badge */}
            <div className="p-4 bg-surface-dark border border-salvia-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-salvia-50">Turma 3º Ano B</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-salvia-900 text-salvia-200 border border-salvia-700">
                  Matriculado
                </span>
              </div>
              <p className="text-[11px] text-salvia-300">
                32 alunos confirmados para o ano letivo.
              </p>
            </div>

            {/* Botões lado a lado */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="px-3.5 py-2 rounded-xl bg-salvia-700 text-white text-xs font-bold shadow-sm"
              >
                Ação principal
              </button>
              <button
                type="button"
                className="px-3.5 py-2 rounded-xl bg-accent-500 text-xs font-bold shadow-sm"
                style={{ color: corTextoDestaque }}
              >
                Destaque
              </button>
            </div>

            {/* Aviso âmbar fixo (NÃO segue o tema) */}
            <div className="p-3 rounded-xl bg-amber-950 border border-amber-800 text-amber-300 text-xs flex items-center gap-2 font-medium">
              <span>Aviso: Período de rematrícula termina em 5 dias.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bloco 4: Relatório de Contraste e Acessibilidade (WCAG AA) */}
      <div className="p-5 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200">
              Relatório de contraste e acessibilidade (WCAG AA)
            </h4>
            <p className="text-xs text-salvia-600 dark:text-salvia-400">
              Verificação dos pares críticos de contraste com mínimo de 4,5:1.
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
              validacao.aprovado
                ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-300'
                : 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-300'
            }`}
          >
            {validacao.aprovado ? '✓ Aprovado (todos os pares ≥ 4,5:1)' : '✗ Reprovado em pares críticos'}
          </span>
        </div>

        {!validacao.aprovado && (
          <div
            role="alert"
            className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1"
          >
            <p className="font-bold">Aviso de acessibilidade:</p>
            <p>
              O tema atual não atinge o contraste mínimo de acessibilidade WCAG AA (4,5:1) em um ou mais pares críticos. O botão Salvar fica desabilitado para garantir a legibilidade a todos os usuários.
            </p>
          </div>
        )}

        {validacao.pares.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-salvia-100 dark:bg-salvia-800 text-slate-900 dark:text-salvia-100 uppercase font-bold text-[10px] tracking-wider border-b border-salvia-200 dark:border-salvia-800">
                <tr>
                  <th className="p-2.5">Par crítico</th>
                  <th className="p-2.5 text-center">Razão obtida</th>
                  <th className="p-2.5 text-center">Mínimo exigido</th>
                  <th className="p-2.5 text-center">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800/60 font-medium text-slate-800 dark:text-salvia-200">
                {validacao.pares.map((par, idx) => (
                  <tr key={idx} className="hover:bg-salvia-50/70 dark:hover:bg-salvia-800/40 transition-colors">
                    <td className="p-2.5">{par.nome}</td>
                    <td className="p-2.5 text-center font-mono font-bold">
                      {par.razao.toFixed(2)}:1
                    </td>
                    <td className="p-2.5 text-center font-mono text-salvia-500">
                      {par.minimo.toFixed(1)}:1
                    </td>
                    <td className="p-2.5 text-center">
                      <span
                        className={`inline-flex items-center justify-center font-bold text-xs ${
                          par.aprovado
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {par.aprovado ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bloco 5: Barra de Ações Final */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-salvia-200 dark:border-salvia-800">
        <p className="text-xs text-salvia-500 dark:text-salvia-400">
          As alterações passam a valer para todos os usuários autenticados da escola após salvar.
        </p>

        <button
          type="button"
          onClick={onSalvar}
          disabled={salvarDesabilitado}
          className="px-5 py-2.5 rounded-xl bg-salvia-700 hover:bg-salvia-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>{salvando ? 'Salvando...' : 'Salvar identidade visual'}</span>
        </button>
      </div>
    </div>
  );
}
