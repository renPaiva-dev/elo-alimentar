// Testes de contrato REST do RF-05 (AGENTS.md, Regras 3 e 7): mural da entidade e contatos.
// A API não recebe localização: o filtro de 5 km é testado em shared/test/mural.test.js.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

vi.mock('../src/repositories/doacoes.repository.js', () => ({
  doacoesRepository: { findMural: vi.fn(), findMinhas: vi.fn() },
}));
vi.mock('../src/repositories/contatos.repository.js', () => ({
  contatosRepository: { registrar: vi.fn() },
}));

const { app } = await import('../src/app.js');
const { doacoesRepository: doacoes } = await import('../src/repositories/doacoes.repository.js');
const { contatosRepository: contatos } = await import('../src/repositories/contatos.repository.js');

const DOACAO = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CONTATO = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const LINHA_DO_BANCO = {
  doacao_id: DOACAO,
  quantidade: 6,
  prazo_retirada: '2026-10-01T21:00:00+00:00',
  observacao: null,
  produto_nome: 'Iogurte natural',
  unidade: 'un',
  estabelecimento_nome: 'Mercadinho Exemplo',
  bairro: 'Centro',
  endereco_retirada: 'Rua Areolino de Abreu, 100',
  retirada_na_loja: true,
  latitude: -5.0892,
  longitude: -42.8019,
  whatsapp_comercial: '5586999990001',
};

let servidor;
let base;

async function chamar(metodo, caminho, corpo, token = 'token-entidade') {
  const resp = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resp.text();
  return { status: resp.status, headers: resp.headers, json: texto ? JSON.parse(texto) : null };
}

beforeAll(async () => {
  servidor = app.listen(0);
  await new Promise((ok) => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}/api/v1`;
});

afterAll(() => servidor.close());
beforeEach(() => vi.clearAllMocks());

describe('GET /doacoes?status=ativo (mural, RF-05)', () => {
  it('entidade recebe os cards com produto, quantidade, estabelecimento, bairro, prazo, coordenadas e WhatsApp', async () => {
    doacoes.findMural.mockResolvedValue([LINHA_DO_BANCO]);

    const r = await chamar('GET', '/doacoes?status=ativo');

    expect(r.status).toBe(200);
    expect(r.json).toEqual([{
      doacao_id: DOACAO,
      produto: 'Iogurte natural',
      unidade: 'un',
      quantidade: 6,
      prazo_retirada: '2026-10-01T21:00:00+00:00',
      observacao: null,
      estabelecimento: 'Mercadinho Exemplo',
      bairro: 'Centro',
      endereco_retirada: 'Rua Areolino de Abreu, 100',
      retirada_na_loja: true,
      latitude: -5.0892,
      longitude: -42.8019,
      whatsapp_comercial: '5586999990001',
    }]);
    expect(doacoes.findMural).toHaveBeenCalledWith(undefined);
    expect(doacoes.findMinhas).not.toHaveBeenCalled();
  });

  it('filtro por bairro é repassado ao banco', async () => {
    doacoes.findMural.mockResolvedValue([]);
    const r = await chamar('GET', `/doacoes?status=ativo&bairro=${encodeURIComponent('Fátima')}`);
    expect(r.status).toBe(200);
    expect(doacoes.findMural).toHaveBeenCalledWith('Fátima');
  });

  it('entidade sem status=ativo responde 400', async () => {
    const r = await chamar('GET', '/doacoes');
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'Use status=ativo para ver o mural.' });
  });

  it('bairro inválido responde 400', async () => {
    const r = await chamar('GET', '/doacoes?status=ativo&bairro=x');
    expect(r.status).toBe(400);
  });

  it('sem login responde 401 (o mural não é público, regra 7)', async () => {
    const resp = await fetch(`${base}/doacoes?status=ativo`);
    expect(resp.status).toBe(401);
  });

  it('comerciante em GET /doacoes recebe "Minhas doações" com o total de contatos', async () => {
    doacoes.findMinhas.mockResolvedValue([{
      id: DOACAO, status: 'ativo', prazo_retirada: '2999-01-01T00:00:00Z', contatos: [{ count: 2 }],
    }]);
    const r = await chamar('GET', '/doacoes', undefined, 'token-comerciante');
    expect(r.status).toBe(200);
    expect(r.json[0].contatos).toBe(2);
    expect(doacoes.findMural).not.toHaveBeenCalled();
  });
});

describe('POST /contatos (RF-05, regra 6)', () => {
  it('sucesso BDD: toque em "Conversar no WhatsApp" cria 1 contato (201 + Location)', async () => {
    contatos.registrar.mockResolvedValue({ id: CONTATO, created_at: '2026-10-01T13:00:00Z', doacao_id: DOACAO });

    const r = await chamar('POST', '/contatos', { doacao_id: DOACAO });

    expect(r.status).toBe(201);
    expect(r.headers.get('location')).toBe(`/api/v1/contatos/${CONTATO}`);
    expect(contatos.registrar).toHaveBeenCalledWith(DOACAO);
  });

  it('localização enviada por engano não é repassada ao banco', async () => {
    contatos.registrar.mockResolvedValue({ id: CONTATO, doacao_id: DOACAO });
    await chamar('POST', '/contatos', { doacao_id: DOACAO, latitude: -5.08, longitude: -42.8 });
    expect(contatos.registrar).toHaveBeenCalledWith(DOACAO);
  });

  it('doação que não está mais ativa responde 404', async () => {
    contatos.registrar.mockResolvedValue(null);
    const r = await chamar('POST', '/contatos', { doacao_id: DOACAO });
    expect(r.status).toBe(404);
    expect(r.json).toEqual({ erro: 'Doação não encontrada ou não está mais ativa.' });
  });

  it('sem doacao_id responde 400', async () => {
    const r = await chamar('POST', '/contatos', {});
    expect(r.status).toBe(400);
    expect(contatos.registrar).not.toHaveBeenCalled();
  });

  it('comerciante não registra contato (403)', async () => {
    const r = await chamar('POST', '/contatos', { doacao_id: DOACAO }, 'token-comerciante');
    expect(r.status).toBe(403);
    expect(r.json).toEqual({ erro: 'Esta ação é só para entidades.' });
  });
});
