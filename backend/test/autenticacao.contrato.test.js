// Testes de contrato da autenticação (Aula 11): 401 sem token ou com token inválido,
// 403 para conta sem perfil ou perfil errado, e GET /perfil.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { PERFIS } from './setup.js';

vi.mock('../src/repositories/produtos.repository.js', () => ({
  produtosRepository: { findAll: vi.fn(async () => []) },
}));

const { app } = await import('../src/app.js');
const { produtosRepository: repo } = await import('../src/repositories/produtos.repository.js');

let servidor;
let base;

async function chamar(caminho, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const resp = await fetch(`${base}${caminho}`, { headers });
  return { status: resp.status, json: await resp.json() };
}

beforeAll(async () => {
  servidor = app.listen(0);
  await new Promise((ok) => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}/api/v1`;
});

afterAll(() => servidor.close());

describe('autenticação', () => {
  it('sem token responde 401 e não chega ao banco', async () => {
    const r = await chamar('/produtos');
    expect(r.status).toBe(401);
    expect(r.json).toEqual({ erro: 'Faça login para continuar.' });
    expect(repo.findAll).not.toHaveBeenCalled();
  });

  it('token inválido ou expirado responde 401', async () => {
    const r = await chamar('/produtos', 'expirado');
    expect(r.status).toBe(401);
    expect(r.json).toEqual({ erro: 'Sessão expirada. Faça login de novo.' });
  });

  it('conta sem perfil vinculado responde 403', async () => {
    const r = await chamar('/produtos', 'token-sem-perfil');
    expect(r.status).toBe(403);
  });

  it('entidade não acessa o estoque do comerciante (403)', async () => {
    const r = await chamar('/produtos', 'token-entidade');
    expect(r.status).toBe(403);
    expect(r.json).toEqual({ erro: 'Esta ação é só para comerciantes.' });
  });

  it('entidade não registra venda (403)', async () => {
    const r = await chamar('/vendas/874f8ad0-6d4c-4510-ac30-3deb5f797c2f', 'token-entidade');
    expect(r.status).toBe(403);
  });

  it('comerciante acessa o estoque (200)', async () => {
    const r = await chamar('/produtos', 'token-comerciante');
    expect(r.status).toBe(200);
  });
});

describe('GET /perfil', () => {
  it('devolve o perfil do comerciante', async () => {
    const r = await chamar('/perfil', 'token-comerciante');
    expect(r.status).toBe(200);
    expect(r.json).toEqual(PERFIS.comerciante);
  });

  it('devolve o perfil da entidade, sem telefone', async () => {
    const r = await chamar('/perfil', 'token-entidade');
    expect(r.status).toBe(200);
    expect(r.json).toEqual(PERFIS.entidade);
    expect(r.json.whatsapp_comercial).toBeUndefined();
  });
});
