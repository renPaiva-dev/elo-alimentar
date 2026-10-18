import { Router } from 'express';
import { doacoesController } from '../controllers/doacoes.controller.js';
import { exigirPerfil } from '../middlewares/autenticacao.js';

export const doacoesRoutes = Router();

// RF-04: só o comerciante publica e altera as próprias doações.
doacoesRoutes.post('/', exigirPerfil('comerciante'), doacoesController.criar);
doacoesRoutes.get('/', exigirPerfil('comerciante'), doacoesController.listar);
doacoesRoutes.get('/:id', exigirPerfil('comerciante'), doacoesController.obterPorId);
doacoesRoutes.patch('/:id', exigirPerfil('comerciante'), doacoesController.atualizar);
