// Monta a aplicação Express sem abrir porta (os testes sobem a app numa porta livre).
import express from 'express';
import { produtosRoutes } from './routes/produtos.routes.js';
import { vendasRoutes } from './routes/vendas.routes.js';
import { tratarErros } from './middlewares/erros.js';

export const app = express();

app.use(express.json());
app.use('/api/v1/produtos', produtosRoutes);
app.use('/api/v1/vendas', vendasRoutes);
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use(tratarErros);
