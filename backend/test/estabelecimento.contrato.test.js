// Testes de contrato de "Meu estabelecimento" (PATCH /perfil, spec v1.2) e do
// local de retirada por doação (POST /doacoes com local_retirada).
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

vi.mock('../src/repositories/estabelecimentos.repository.js', () => ({
  estabelecimentosRepository: { atualizarMeu: vi.fn() },
}));
vi.mock('../src/repositories/doacoes.repository.js', () => ({
  doacoesRepository: { publicar: vi.fn() },
}));

const { app } = await import('../src/app.js');
const { estabelecimentosRepository: repo } = await import('../src/repositories/estabelecimentos.repository.js');
const { doacoesRepository: doacoes } = await import('../src/repositories/doacoes.repository.js');

let servidor;
let base;

async function chamar(metodo, caminho, corpo, token = 'token-comerciante') {
  const resp = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resp.text();
  return { status: resp.status, json: texto ? JSON.parse(texto) : null };
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

describe('PATCH /perfil ("Meu estabelecimento")', () => {
  it('atualiza endereço, WhatsApp e localização e responde 200', async () => {
    repo.atualizarMeu.mockResolvedValue({
      tipo: 'comerciante', id: 'x', nome: 'Mercadinho Teste', bairro: 'Centro',
      endereco: 'Rua Areolino de Abreu, 100', whatsapp_comercial: '5586994975451',
      latitude: '-5.089200', longitude: '-42.801900',
    });

    const r = await chamar('PATCH', '/perfil', {
      endereco: '  Rua Areolino de Abreu, 100 ', whatsapp_comercial: '5586994975451', latitude: -5.0892, longitude: -42.8019,
    });

    expect(r.status).toBe(200);
    expect(r.json.latitude).toBe(-5.0892);
    expect(repo.atualizarMeu).toHaveBeenCalledWith({
      endereco: 'Rua Areolino de Abreu, 100', whatsapp_comercial: '5586994975451', latitude: -5.0892, longitude: -42.8019,
    });
  });

  it('latitude e longitude null apagam a localização', async () => {
    repo.atualizarMeu.mockResolvedValue({ latitude: null, longitude: null });
    const r = await chamar('PATCH', '/perfil', { latitude: null, longitude: null });
    expect(r.status).toBe(200);
    expect(repo.atualizarMeu).toHaveBeenCalledWith({ limpar_localizacao: true });
  });

  it('WhatsApp sem o 55 responde 400 sem ir ao banco', async () => {
    const r = await chamar('PATCH', '/perfil', { whatsapp_comercial: '86994975451' });
    expect(r.status).toBe(400);
    expect(r.json.erro).toMatch(/WhatsApp inválido/);
    expect(repo.atualizarMeu).not.toHaveBeenCalled();
  });

  it('latitude sem longitude responde 400', async () => {
    const r = await chamar('PATCH', '/perfil', { latitude: -5.08 });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'Informe latitude e longitude juntas.' });
  });

  it('campo fora da lista (ex.: user_id) responde 400', async () => {
    const r = await chamar('PATCH', '/perfil', { user_id: 'outro' });
    expect(r.status).toBe(400);
  });

  it('endereço curto responde 400', async () => {
    const r = await chamar('PATCH', '/perfil', { endereco: 'Rua' });
    expect(r.status).toBe(400);
  });

  it('corpo vazio responde 400', async () => {
    const r = await chamar('PATCH', '/perfil', {});
    expect(r.status).toBe(400);
  });

  it('entidade não edita estabelecimento (403)', async () => {
    const r = await chamar('PATCH', '/perfil', { endereco: 'Rua da Entidade, 1' }, 'token-entidade');
    expect(r.status).toBe(403);
    expect(repo.atualizarMeu).not.toHaveBeenCalled();
  });
});

describe('POST /doacoes com local de retirada', () => {
  const base = { produto_id: '874f8ad0-6d4c-4510-ac30-3deb5f797c2f', quantidade: 1, prazo_retirada: '2026-10-01T18:00:00-03:00' };

  it('repassa o local de retirada sem espaços nas pontas', async () => {
    doacoes.publicar.mockResolvedValue({ id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' });
    const r = await chamar('POST', '/doacoes', { ...base, local_retirada: '  Feira do Dirceu, banca 12 ' });
    expect(r.status).toBe(201);
    expect(doacoes.publicar).toHaveBeenCalledWith(expect.objectContaining({ local_retirada: 'Feira do Dirceu, banca 12' }));
  });

  it('local de retirada curto responde 400', async () => {
    const r = await chamar('POST', '/doacoes', { ...base, local_retirada: 'abc' });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ erro: 'O local de retirada deve ter de 5 a 150 caracteres.' });
  });

  it('sem endereço da loja e sem local: 400 com a mensagem do banco', async () => {
    doacoes.publicar.mockRejectedValue({
      code: '23514', message: 'Informe o local de retirada ou cadastre o endereço em "Meu estabelecimento".',
    });
    const r = await chamar('POST', '/doacoes', base);
    expect(r.status).toBe(400);
    expect(r.json.erro).toMatch(/Meu estabelecimento/);
  });
});
