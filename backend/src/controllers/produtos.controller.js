// Controller do RF-01: valida o payload, chama o repositório e escolhe o status HTTP.
// Erros do banco seguem para o middleware tratarErros (Express 5 repassa rejeições de async).
import { produtosRepository } from '../repositories/produtos.repository.js';
import { validarCadastro, validarEdicao } from '../validators/produto.validator.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAO_ENCONTRADO = { erro: 'Produto não encontrado.' };

export const produtosController = {
  async criar(req, res) {
    const validacao = validarCadastro(req.body);
    if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

    const novo = await produtosRepository.create(validacao.registro);
    res.location(`/api/v1/produtos/${novo.id}`);
    return res.status(201).json(novo);
  },

  async listar(req, res) {
    return res.status(200).json(await produtosRepository.findAll());
  },

  async obterPorId(req, res) {
    if (!UUID.test(req.params.id)) return res.status(404).json(NAO_ENCONTRADO);
    const produto = await produtosRepository.findById(req.params.id);
    if (!produto) return res.status(404).json(NAO_ENCONTRADO);
    return res.status(200).json(produto);
  },

  async atualizar(req, res) {
    if (!UUID.test(req.params.id)) return res.status(404).json(NAO_ENCONTRADO);
    const produto = await produtosRepository.findById(req.params.id);
    if (!produto) return res.status(404).json(NAO_ENCONTRADO);

    const validacao = validarEdicao(req.body, produto);
    if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

    const atualizado = await produtosRepository.update(req.params.id, validacao.mudancas);
    if (!atualizado) return res.status(404).json(NAO_ENCONTRADO);
    return res.status(200).json(atualizado);
  },

  async remover(req, res) {
    if (!UUID.test(req.params.id)) return res.status(404).json(NAO_ENCONTRADO);
    const produto = await produtosRepository.findById(req.params.id);
    if (!produto) return res.status(404).json(NAO_ENCONTRADO);

    // O produto existe; se nada foi apagado, quem barrou foi o RLS.
    const removido = await produtosRepository.remove(req.params.id);
    if (!removido) return res.status(403).json({ erro: 'Operação não permitida pela política de segurança do banco.' });
    return res.status(204).send();
  },
};
