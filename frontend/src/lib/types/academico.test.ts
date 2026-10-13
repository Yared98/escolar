import { describe, expect, it } from 'vitest';
import {
  OCORRENCIA_DESCRICAO_MAX,
  TIPO_OCORRENCIA_LABEL,
  TIPOS_OCORRENCIA_FUNDAMENTAL,
  tipoOcorrenciaLabel,
} from './academico';

describe('tipoOcorrenciaLabel', () => {
  it('traduz os tipos do Fundamental para a linguagem da escola', () => {
    expect(tipoOcorrenciaLabel('comportamento')).toBe('Comportamento');
    expect(tipoOcorrenciaLabel('atraso')).toBe('Atraso');
    expect(tipoOcorrenciaLabel('falta_material')).toBe('Falta de material');
    expect(tipoOcorrenciaLabel('saude')).toBe('Saúde');
    expect(tipoOcorrenciaLabel('elogio')).toBe('Elogio');
    expect(tipoOcorrenciaLabel('outros')).toBe('Outros');
  });

  it('mantém os tipos históricos da Educação Infantil legíveis', () => {
    expect(tipoOcorrenciaLabel('febre')).toBe('Febre ou indisposição');
    expect(tipoOcorrenciaLabel('queda_arranhao')).toBe('Queda / arranhão');
    expect(tipoOcorrenciaLabel('atrito_colega')).toBe('Atrito com colega');
    // Grafia antiga gravada no banco antes da padronização.
    expect(tipoOcorrenciaLabel('outro')).toBe('Outros');
  });

  it('nunca mostra o código cru de um tipo desconhecido', () => {
    expect(tipoOcorrenciaLabel('grita')).toBe('Outros');
    expect(tipoOcorrenciaLabel('')).toBe('Outros');
  });

  it('todo tipo do formulário do professor tem nome amigável', () => {
    for (const tipo of TIPOS_OCORRENCIA_FUNDAMENTAL) {
      expect(TIPO_OCORRENCIA_LABEL[tipo.value]).toBe(tipo.label);
      expect(tipo.label.length).toBeGreaterThan(0);
    }
  });

  it('limita a descrição a 1000 caracteres', () => {
    expect(OCORRENCIA_DESCRICAO_MAX).toBe(1000);
  });
});
