// GET /perfil (ambos os perfis) e PATCH /perfil ("Meu estabelecimento", só comerciante).
import { estabelecimentosRepository } from '../repositories/estabelecimentos.repository.js';
import { validarEstabelecimento } from '../validators/estabelecimento.validator.js';

const numeroOuNulo = (v) => (v === null || v === undefined ? null : Number(v));

export const perfilController = {
  obter(req, res) {
    return res.status(200).json(req.perfil);
  },

  async atualizar(req, res) {
    const validacao = validarEstabelecimento(req.body);
    if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

    const perfil = await estabelecimentosRepository.atualizarMeu(validacao.mudancas);
    return res.status(200).json({
      ...perfil,
      latitude: numeroOuNulo(perfil.latitude),
      longitude: numeroOuNulo(perfil.longitude),
    });
  },
};
