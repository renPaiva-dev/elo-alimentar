// Ponte: o Nuxt (Nitro) entrega /api/v1/** para a mesma API Express de backend/.
// Rotas, validações, autenticação e testes continuam todos em backend/.
import { fromNodeMiddleware } from 'h3';
import { app } from '../../../../backend/src/app.js';

export default fromNodeMiddleware(app);
