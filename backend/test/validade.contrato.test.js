// Testes do RF-03 (AGENTS.md, Regra 3), com os cenários BDD da spec:
// hoje = 01/10/2026; A vence 02/10, B 04/10, C 06/10; D venceu 30/09 com 2 un.
// O repositório é simulado: a filtragem real é feita pela consulta ao banco (ver docs/testes/RF-03.md).
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { diasParaVencer, rotuloValidade } from '../src/utils/validade.js';

vi.mock('../src/repositories/produtos.repository.js', () => ({
  produtosRepository: {
    create: vi.fn(),
    findAll: vi.fn(),
    findVencendo: vi.fn(),
    findVencidos: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const { app } = await import('../src/app.js');
const { produtosRepository: repo } = await import('../src/repositories/produtos.repository.js');

const produto = (nome, data_validade, quantidade = 5) => ({
  id: `00000000-0000-4000-8000-00000000000${nome.at(-1).charCodeAt(0) % 10}`,
  nome, unidade: 'un', quantidade, preco_centavos: 100, data_validade,
});
const A = produto('Produto A', '2026-10-02');
const B = produto('Produto B', '2026-10-04');
const D = produto('Produto D', '2026-09-30', 2);

let servidor;
let base;

async function chamar(caminho) {
  const resp = await fetch(`${base}${caminho}`);
  return { status: resp.status, json: await resp.json() };
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T13:00:00Z')); // 10:00 em America/Fortaleza
  servidor = app.listen(0);
  await new Promise((ok) => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}/api/v1`;
});

afterAll(() => {
  servidor.close();
  vi.useRealTimers();
});

beforeEach(() => vi.clearAllMocks());

describe('rótulos de validade (RF-03, regra 2)', () => {
  it('converte dias em rótulo', () => {
    expect(rotuloValidade(0)).toBe('vence hoje');
    expect(rotuloValidade(1)).toBe('vence amanhã');
    expect(rotuloValidade(2)).toBe('vence em 2 dias');
    expect(rotuloValidade(3)).toBe('vence em 3 dias');
    expect(rotuloValidade(-1)).toBeNull();
  });

  it('calcula dias corridos', () => {
    expect(diasParaVencer('2026-10-03', '2026-10-01')).toBe(2);
    expect(diasParaVencer('2026-09-30', '2026-10-01')).toBe(-1);
  });
});

describe('GET /produtos?vence_em_ate=3 (RF-03)', () => {
  it('sucesso BDD: consulta de 01/10 a 04/10 e devolve A ("vence amanhã") e B ("vence em 3 dias"), nessa ordem', async () => {
    repo.findVencendo.mockResolvedValue([A, B]);

    const r = await chamar('/produtos?vence_em_ate=3');

    expect(r.status).toBe(200);
    expect(repo.findVencendo).toHaveBeenCalledWith('2026-10-01', '2026-10-04');
    expect(r.json.map((p) => [p.nome, p.rotulo_validade])).toEqual([
      ['Produto A', 'vence amanhã'],
      ['Produto B', 'vence em 3 dias'],
    ]);
    expect(r.json).toHaveLength(2); // contador da tela inicial
  });

  it('janela diferente de 3 responde 400', async () => {
    const r = await chamar('/produtos?vence_em_ate=7');
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'A janela de alerta é fixa em 3 dias no MVP 1.' });
    expect(repo.findVencendo).not.toHaveBeenCalled();
  });

  it('os dois filtros juntos respondem 400', async () => {
    const r = await chamar('/produtos?vence_em_ate=3&vencidos=true');
    expect(r.status).toBe(400);
  });
});

describe('GET /produtos?vencidos=true (RF-03, regra 3)', () => {
  it('falha BDD: D (validade 30/09, 2 un) aparece só em vencidos, sem rótulo de prazo', async () => {
    repo.findVencidos.mockResolvedValue([D]);

    const r = await chamar('/produtos?vencidos=true');

    expect(r.status).toBe(200);
    expect(repo.findVencidos).toHaveBeenCalledWith('2026-10-01');
    expect(r.json).toEqual([{ ...D, dias_para_vencer: -1, rotulo_validade: null }]);
  });

  it('vencidos com valor diferente de true responde 400', async () => {
    const r = await chamar('/produtos?vencidos=sim');
    expect(r.status).toBe(400);
  });
});

describe('GET /produtos sem filtro', () => {
  it('continua devolvendo o estoque completo (RF-01)', async () => {
    repo.findAll.mockResolvedValue([A, B, D]);
    const r = await chamar('/produtos');
    expect(r.status).toBe(200);
    expect(r.json).toHaveLength(3);
    expect(repo.findVencendo).not.toHaveBeenCalled();
  });
});
