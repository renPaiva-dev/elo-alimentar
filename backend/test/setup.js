// Sessão simulada para todos os testes de contrato (sem Supabase Auth real).
// Tokens válidos: "token-comerciante" e "token-entidade". "token-sem-perfil" é uma
// conta sem perfil vinculado; qualquer outro token é tratado como inválido/expirado.
import { vi } from 'vitest';

export const PERFIS = {
  comerciante: {
    tipo: 'comerciante',
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    nome: 'Mercadinho Exemplo',
    bairro: 'Centro',
    whatsapp_comercial: '5586999990001',
  },
  entidade: {
    tipo: 'entidade',
    id: 'bbbbbbbb-0000-4000-8000-000000000001',
    nome: 'Banco de Alimentos Esperança',
    bairro: 'Centro',
  },
};

vi.mock('../src/repositories/sessao.repository.js', () => ({
  sessaoRepository: {
    obterUsuario: vi.fn(async (token) => (String(token).startsWith('token-') ? { id: token } : null)),
    obterPerfil: vi.fn(async (userId) => {
      if (userId === 'token-comerciante') return PERFIS.comerciante;
      if (userId === 'token-entidade') return PERFIS.entidade;
      return null;
    }),
  },
}));
