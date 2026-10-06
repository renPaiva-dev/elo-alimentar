import { Router } from 'express';
import { vendasController } from '../controllers/vendas.controller.js';

export const vendasRoutes = Router();

vendasRoutes.post('/', vendasController.criar);
vendasRoutes.get('/:id', vendasController.obterPorId);
