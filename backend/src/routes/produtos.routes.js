import { Router } from 'express';
import { produtosController } from '../controllers/produtos.controller.js';

export const produtosRoutes = Router();

produtosRoutes.post('/', produtosController.criar);
produtosRoutes.get('/', produtosController.listar);
produtosRoutes.get('/:id', produtosController.obterPorId);
produtosRoutes.patch('/:id', produtosController.atualizar);
produtosRoutes.delete('/:id', produtosController.remover);
