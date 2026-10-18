import { Router } from 'express';
import { contatosController } from '../controllers/contatos.controller.js';

export const contatosRoutes = Router();

contatosRoutes.post('/', contatosController.criar);
