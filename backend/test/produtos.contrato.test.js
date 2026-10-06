// Testes de contrato REST do RF-01 (AGENTS.md, Regras 3 e 7).
// Valores exatos dos cenários BDD da ESPECIFICACAO-MVP.md; relógio fixo em 01/10/2026 10:00 (America/Fortaleza).
// O repositório é simulado: o teste verifica status, headers e corpo, sem depender da rede.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

vi.mock('../src/repositories/produtos.repository.js', () => ({
  produtosRepository: {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const { app } = await import('../src/app.js');
const { produtosRepository: repo } = await import('../src/repositories/produtos.repository.js');

const ID = '874f8ad0-6d4c-4510-ac30-3deb5f797c2f';
const IOGURTE = {
  nome: 'Iogurte natural',
  unidade: 'un',
  quantidade: 6,
  preco_centavos: 350,
  data_validade: '2026-10-03',
};

let servidor;
let base;

async function chamar(metodo, caminho, corpo) {
  const resp = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: typeof corpo === 'string' ? corpo : corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resp.text();
  return { status: resp.status, headers: resp.headers, texto, json: texto ? JSON.parse(texto) : null };
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

describe('POST /produtos (RF-01)', () => {
  it('sucesso BDD: cadastra o iogurte e responde 201 com Location', async () => {
    repo.create.mockImplementation(async (registro) => ({ id: ID, created_at: '2026-10-01T13:00:00Z', ...registro }));

    const r = await chamar('POST', '/produtos', IOGURTE);

    expect(r.status).toBe(201);
    expect(r.headers.get('location')).toBe(`/api/v1/produtos/${ID}`);
    expect(r.json).toMatchObject({ id: ID, preco_centavos: 350, quantidade: 6 });
    expect(repo.create).toHaveBeenCalledWith(IOGURTE);
  });

  it('falha BDD: validade 30/09/2026 responde 400 com a mensagem da spec e não grava', async () => {
    const r = await chamar('POST', '/produtos', { ...IOGURTE, data_validade: '2026-09-30' });

    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'Produto vencido não pode ser cadastrado para venda nem para doação.' });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('corpo vazio responde 400, não 500', async () => {
    const r = await chamar('POST', '/produtos', {});
    expect(r.status).toBe(400);
    expect(r.json.erro).toBeTruthy();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('JSON malformado responde 400', async () => {
    const r = await chamar('POST', '/produtos', '{"nome": ');
    expect(r.status).toBe(400);
  });

  it('erro de regra vindo do banco vira 400 com a mensagem do banco', async () => {
    repo.create.mockRejectedValue({ code: '23514', message: 'A validade não pode passar de 2 anos a partir de hoje.' });
    const r = await chamar('POST', '/produtos', IOGURTE);
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'A validade não pode passar de 2 anos a partir de hoje.' });
  });
});

describe('GET /produtos (RF-01)', () => {
  it('lista responde 200 com array', async () => {
    repo.findAll.mockResolvedValue([{ id: ID, ...IOGURTE }]);
    const r = await chamar('GET', '/produtos');
    expect(r.status).toBe(200);
    expect(r.json).toHaveLength(1);
  });

  it('id inexistente responde 404', async () => {
    repo.findById.mockResolvedValue(null);
    const r = await chamar('GET', `/produtos/${ID}`);
    expect(r.status).toBe(404);
  });
});

describe('PATCH /produtos/:id (RF-01, regra 3)', () => {
  it('altera o preço e responde 200', async () => {
    repo.findById.mockResolvedValue({ id: ID, ...IOGURTE });
    repo.update.mockResolvedValue({ id: ID, ...IOGURTE, preco_centavos: 300 });

    const r = await chamar('PATCH', `/produtos/${ID}`, { preco_centavos: 300 });

    expect(r.status).toBe(200);
    expect(r.json.preco_centavos).toBe(300);
    expect(repo.update).toHaveBeenCalledWith(ID, { preco_centavos: 300 });
  });

  it('validade corrigida para data vencida responde 400 com a mensagem da spec', async () => {
    repo.findById.mockResolvedValue({ id: ID, ...IOGURTE });
    const r = await chamar('PATCH', `/produtos/${ID}`, { data_validade: '2026-09-30' });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'Produto vencido não pode ser cadastrado para venda nem para doação.' });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('tentar mudar o nome responde 400', async () => {
    repo.findById.mockResolvedValue({ id: ID, ...IOGURTE });
    const r = await chamar('PATCH', `/produtos/${ID}`, { nome: 'Outro' });
    expect(r.status).toBe(400);
  });

  it('id inexistente responde 404', async () => {
    repo.findById.mockResolvedValue(null);
    const r = await chamar('PATCH', `/produtos/${ID}`, { preco_centavos: 300 });
    expect(r.status).toBe(404);
  });
});

describe('DELETE /produtos/:id', () => {
  it('exclui e responde 204 sem corpo', async () => {
    repo.findById.mockResolvedValue({ id: ID, ...IOGURTE });
    repo.remove.mockResolvedValue(true);

    const r = await chamar('DELETE', `/produtos/${ID}`);

    expect(r.status).toBe(204);
    expect(r.texto).toBe('');
  });

  it('id inexistente responde 404', async () => {
    repo.findById.mockResolvedValue(null);
    const r = await chamar('DELETE', `/produtos/${ID}`);
    expect(r.status).toBe(404);
  });

  it('produto com vendas responde 409', async () => {
    repo.findById.mockResolvedValue({ id: ID, ...IOGURTE });
    repo.remove.mockRejectedValue({ code: '23503', message: 'violates foreign key constraint' });
    const r = await chamar('DELETE', `/produtos/${ID}`);
    expect(r.status).toBe(409);
    expect(r.json).toEqual({ erro: 'Produto com vendas registradas não pode ser excluído.' });
  });
});
