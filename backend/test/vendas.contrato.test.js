// Testes de contrato REST do RF-02 (AGENTS.md, Regras 3 e 7), com os valores do BDD:
// "Pão francês" com 10 un a R$ 0,80. O repositório é simulado (sem rede).
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

vi.mock('../src/repositories/vendas.repository.js', () => ({
  vendasRepository: { registrar: vi.fn(), findById: vi.fn() },
}));

const { app } = await import('../src/app.js');
const { vendasRepository: repo } = await import('../src/repositories/vendas.repository.js');

const PAO = '874f8ad0-6d4c-4510-ac30-3deb5f797c2f';
const VENDA = '5b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';

let servidor;
let base;

async function chamar(metodo, caminho, corpo) {
  const resp = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resp.text();
  return { status: resp.status, headers: resp.headers, json: texto ? JSON.parse(texto) : null };
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T13:00:00Z'));
  servidor = app.listen(0);
  await new Promise((ok) => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}/api/v1`;
});

afterAll(() => {
  servidor.close();
  vi.useRealTimers();
});

beforeEach(() => vi.clearAllMocks());

describe('POST /vendas (RF-02)', () => {
  it('sucesso BDD: venda de 4 un do pão responde 201, Location e total 320', async () => {
    repo.registrar.mockResolvedValue({
      venda_id: VENDA,
      total_centavos: 320,
      itens: [{ produto_id: PAO, nome: 'Pão francês', quantidade: 4, preco_centavos: 80, subtotal_centavos: 320 }],
    });

    const r = await chamar('POST', '/vendas', { itens: [{ produto_id: PAO, quantidade: 4 }] });

    expect(r.status).toBe(201);
    expect(r.headers.get('location')).toBe(`/api/v1/vendas/${VENDA}`);
    expect(r.json.total_centavos).toBe(320);
    expect(repo.registrar).toHaveBeenCalledWith([{ produto_id: PAO, quantidade: 4 }]);
  });

  it('falha BDD: 12 un com estoque 10 responde 400 com a mensagem da spec', async () => {
    repo.registrar.mockRejectedValue({ code: '23514', message: 'Quantidade maior que o estoque disponível (10 un).' });

    const r = await chamar('POST', '/vendas', { itens: [{ produto_id: PAO, quantidade: 12 }] });

    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'Quantidade maior que o estoque disponível (10 un).' });
  });

  it('sem itens responde 400 e não chama o banco', async () => {
    const r = await chamar('POST', '/vendas', { itens: [] });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'Informe de 1 a 30 itens na venda.' });
    expect(repo.registrar).not.toHaveBeenCalled();
  });

  it('mais de 30 itens responde 400', async () => {
    const itens = Array.from({ length: 31 }, () => ({ produto_id: PAO, quantidade: 1 }));
    const r = await chamar('POST', '/vendas', { itens });
    expect(r.status).toBe(400);
  });

  it('quantidade zero responde 400', async () => {
    const r = await chamar('POST', '/vendas', { itens: [{ produto_id: PAO, quantidade: 0 }] });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'A quantidade deve ser maior que zero.' });
  });

  it('dados do comprador não são repassados ao banco', async () => {
    repo.registrar.mockResolvedValue({ venda_id: VENDA, total_centavos: 80, itens: [] });
    await chamar('POST', '/vendas', { itens: [{ produto_id: PAO, quantidade: 1, cpf: '000' }], nome: 'Fulano' });
    expect(repo.registrar).toHaveBeenCalledWith([{ produto_id: PAO, quantidade: 1 }]);
  });
});

describe('GET /vendas/:id (RF-02)', () => {
  it('venda existente responde 200', async () => {
    repo.findById.mockResolvedValue({ id: VENDA, total_centavos: 320, itens_venda: [] });
    const r = await chamar('GET', `/vendas/${VENDA}`);
    expect(r.status).toBe(200);
  });

  it('venda inexistente responde 404', async () => {
    repo.findById.mockResolvedValue(null);
    const r = await chamar('GET', `/vendas/${VENDA}`);
    expect(r.status).toBe(404);
  });
});
