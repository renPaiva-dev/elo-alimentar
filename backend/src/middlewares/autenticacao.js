// Autenticação stateless (Aula 11): toda rota /api/v1 exige "Authorization: Bearer <JWT>".
// 401 = sem token ou token inválido; 403 = conta sem perfil ou perfil errado para a rota.
import { clienteDoUsuario, comCliente } from '../config/supabaseClient.js';
import { sessaoRepository } from '../repositories/sessao.repository.js';

const SEM_PERFIL = 'Conta sem estabelecimento ou entidade vinculada. Fale com a equipe Elo Alimentar.';
const SO_PARA = {
  comerciante: 'Esta ação é só para comerciantes.',
  entidade: 'Esta ação é só para entidades.',
};

export async function autenticar(req, res, next) {
  const token = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '')?.[1];
  if (!token) return res.status(401).json({ erro: 'Faça login para continuar.' });

  const usuario = await sessaoRepository.obterUsuario(token);
  if (!usuario) return res.status(401).json({ erro: 'Sessão expirada. Faça login de novo.' });

  // Daqui em diante, db() fala com o banco em nome deste usuário (RLS com auth.uid()).
  return comCliente(clienteDoUsuario(token), async () => {
    const perfil = await sessaoRepository.obterPerfil(usuario.id);
    if (!perfil) return res.status(403).json({ erro: SEM_PERFIL });
    req.perfil = perfil;
    return next();
  });
}

/** Restringe a rota a um perfil: exigirPerfil('comerciante') ou exigirPerfil('entidade'). */
export function exigirPerfil(tipo) {
  return (req, res, next) => {
    if (req.perfil?.tipo !== tipo) return res.status(403).json({ erro: SO_PARA[tipo] });
    return next();
  };
}
