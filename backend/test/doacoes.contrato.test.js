// Testes de contrato REST do RF-04 (AGENTS.md, Regras 3 e 7), com os valores do BDD:
// são 10:00 de 01/10/2026 (America/Fortaleza); "Iogurte natural" com 6 un e validade 02/10/2026.
// O repositório é simulado; as regras do banco estão em supabase/005_rf04_doacoes.sql.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

vi.mock('../src/repositories/doacoes.repository.js', () => ({
  doacoesRepository: { publicar: vi.fn(), findMinhas: vi.fn(), findById: vi.fn(), alterarStatus: vi.fn() },
}));

const { app } = await import('../src/app.js');
const { doacoesRepository: repo } = await import('../src/repositories/doacoes.repository.js');

const IOGURTE = '874f8ad0-6d4c-4510-ac30-3deb5f797c2f';
const DOACAO = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const PRAZO_BDD = '2026-10-01T18:00:00-03:00';
const ATIVA = {
  id: DOACAO,
  produto_id: IOGURTE,
  quantidade: 6,
  prazo_retirada: '2026-10-01T21:00:00+00:00',
  observacao: null,
  status: 'ativo',
  retirado_em: null,
  produto: { nome: 'Iogurte natural', unidade: 'un', data_validade: '2026-10-02' },
};

let servidor;
let base;

async function chamar(metodo, caminho, corpo, token = 'token-comerciante') {
  const resp = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resp.text();
  return { status: resp.status, headers: resp.headers, json: texto ? JSON.parse(texto) : null };
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

describe('POST /doacoes (RF-04)', () => {
  it('sucesso BDD: 6 un do iogurte com prazo 01/10 18:00 responde 201, Location e status ativo', async () => {
    repo.publicar.mockResolvedValue(ATIVA);

    const r = await chamar('POST', '/doacoes', { produto_id: IOGURTE, quantidade: 6, prazo_retirada: PRAZO_BDD });

    expect(r.status).toBe(201);
    expect(r.headers.get('location')).toBe(`/api/v1/doacoes/${DOACAO}`);
    expect(r.json.status).toBe('ativo');
    expect(repo.publicar).toHaveBeenCalledWith({
      produto_id: IOGURTE, quantidade: 6, prazo_retirada: PRAZO_BDD, observacao: null,
    });
  });

  it('falha BDD: prazo 03/10 10:00 passa da validade e responde 400 com a mensagem da spec', async () => {
    repo.publicar.mockRejectedValue({
      code: '23514',
      message: 'O prazo de retirada não pode passar da validade do produto (02/10/2026).',
    });

    const r = await chamar('POST', '/doacoes', {
      produto_id: IOGURTE, quantidade: 6, prazo_retirada: '2026-10-03T10:00:00-03:00',
    });

    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'O prazo de retirada não pode passar da validade do produto (02/10/2026).' });
  });

  it('prazo com menos de 30 min responde 400 sem ir ao banco', async () => {
    const r = await chamar('POST', '/doacoes', {
      produto_id: IOGURTE, quantidade: 1, prazo_retirada: '2026-10-01T10:20:00-03:00',
    });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'O prazo de retirada deve ser de pelo menos 30 minutos a partir de agora.' });
    expect(repo.publicar).not.toHaveBeenCalled();
  });

  it('prazo com mais de 72 h responde 400', async () => {
    const r = await chamar('POST', '/doacoes', {
      produto_id: IOGURTE, quantidade: 1, prazo_retirada: '2026-10-04T10:01:00-03:00',
    });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'O prazo de retirada deve ser de no máximo 72 horas a partir de agora.' });
  });

  it('prazo sem fuso ou inválido responde 400', async () => {
    const r = await chamar('POST', '/doacoes', { produto_id: IOGURTE, quantidade: 1, prazo_retirada: '01/10/2026 18:00' });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'Informe o prazo de retirada (data e hora).' });
  });

  it('quantidade zero responde 400', async () => {
    const r = await chamar('POST', '/doacoes', { produto_id: IOGURTE, quantidade: 0, prazo_retirada: PRAZO_BDD });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'A quantidade doada deve ser maior que zero.' });
  });

  it('observação com mais de 200 caracteres responde 400', async () => {
    const r = await chamar('POST', '/doacoes', {
      produto_id: IOGURTE, quantidade: 1, prazo_retirada: PRAZO_BDD, observacao: 'x'.repeat(201),
    });
    expect(r.status).toBe(400);
  });

  it('limite de 20 doações ativas responde 409', async () => {
    repo.publicar.mockRejectedValue({ code: 'EL409', message: 'Limite de 20 doações ativas atingido.' });
    const r = await chamar('POST', '/doacoes', { produto_id: IOGURTE, quantidade: 1, prazo_retirada: PRAZO_BDD });
    expect(r.status).toBe(409);
    expect(r.json).toEqual({ erro: 'Limite de 20 doações ativas atingido.' });
  });

  it('entidade não publica doação (403)', async () => {
    const r = await chamar('POST', '/doacoes', { produto_id: IOGURTE, quantidade: 1, prazo_retirada: PRAZO_BDD }, 'token-entidade');
    expect(r.status).toBe(403);
    expect(repo.publicar).not.toHaveBeenCalled();
  });
});

describe('GET /doacoes ("Minhas doações")', () => {
  it('lista as doações e trata como expirado o anúncio ativo com prazo vencido (regra 4)', async () => {
    const vencida = { ...ATIVA, id: '00000000-0000-4000-8000-000000000002', prazo_retirada: '2026-10-01T12:59:00+00:00' };
    repo.findMinhas.mockResolvedValue([ATIVA, vencida]);

    const r = await chamar('GET', '/doacoes');

    expect(r.status).toBe(200);
    expect(r.json.map((d) => d.status)).toEqual(['ativo', 'expirado']);
  });

  it('GET /doacoes/:id inexistente responde 404', async () => {
    repo.findById.mockResolvedValue(null);
    const r = await chamar('GET', `/doacoes/${DOACAO}`);
    expect(r.status).toBe(404);
  });
});

describe('PATCH /doacoes/:id (RF-04, regra 4)', () => {
  it('marca como retirado e responde 200', async () => {
    repo.alterarStatus.mockResolvedValue({ ...ATIVA, status: 'retirado', retirado_em: '2026-10-01T13:30:00+00:00' });

    const r = await chamar('PATCH', `/doacoes/${DOACAO}`, { status: 'retirado' });

    expect(r.status).toBe(200);
    expect(r.json.status).toBe('retirado');
    expect(repo.alterarStatus).toHaveBeenCalledWith(DOACAO, 'retirado');
  });

  it('status fora do ciclo responde 400', async () => {
    const r = await chamar('PATCH', `/doacoes/${DOACAO}`, { status: 'expirado' });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'Use status "retirado" ou "cancelado".' });
    expect(repo.alterarStatus).not.toHaveBeenCalled();
  });

  it('doação que não está mais ativa responde 409', async () => {
    repo.alterarStatus.mockRejectedValue({ code: 'EL409', message: 'Só é possível alterar uma doação ativa. Esta doação está com status "expirado".' });
    const r = await chamar('PATCH', `/doacoes/${DOACAO}`, { status: 'cancelado' });
    expect(r.status).toBe(409);
  });

  it('doação de outro estabelecimento ou inexistente responde 404', async () => {
    repo.alterarStatus.mockRejectedValue({ code: 'EL404', message: 'Doação não encontrada.' });
    const r = await chamar('PATCH', `/doacoes/${DOACAO}`, { status: 'cancelado' });
    expect(r.status).toBe(404);
    expect(r.json).toEqual({ erro: 'Doação não encontrada.' });
  });
});

describe('DELETE /produtos/:id com doação', () => {
  it('produto com doação registrada responde 409 com mensagem própria', async () => {
    const { produtosRepository } = await import('../src/repositories/produtos.repository.js');
    vi.spyOn(produtosRepository, 'findById').mockResolvedValue({ id: IOGURTE, unidade: 'un' });
    vi.spyOn(produtosRepository, 'remove').mockRejectedValue({
      code: '23503', message: 'update or delete on table "produtos" violates foreign key constraint "doacoes_produto_id_fkey" on table "doacoes"',
    });

    const r = await chamar('DELETE', `/produtos/${IOGURTE}`);

    expect(r.status).toBe(409);
    expect(r.json).toEqual({ erro: 'Produto com doações registradas não pode ser excluído.' });
  });
});
