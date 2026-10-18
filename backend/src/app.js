// Monta a aplicação Express sem abrir porta (os testes sobem a app numa porta livre).
import express from 'express';
import { produtosRoutes } from './routes/produtos.routes.js';
import { vendasRoutes } from './routes/vendas.routes.js';
import { doacoesRoutes } from './routes/doacoes.routes.js';
import { contatosRoutes } from './routes/contatos.routes.js';
import { autenticar, exigirPerfil } from './middlewares/autenticacao.js';
import { tratarErros } from './middlewares/erros.js';

export const app = express();

app.use(express.json());
app.use('/api/v1', autenticar);
app.get('/api/v1/perfil', (req, res) => res.status(200).json(req.perfil));
app.use('/api/v1/produtos', exigirPerfil('comerciante'), produtosRoutes);
app.use('/api/v1/vendas', exigirPerfil('comerciante'), vendasRoutes);
app.use('/api/v1/doacoes', doacoesRoutes);
app.use('/api/v1/contatos', exigirPerfil('entidade'), contatosRoutes);
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use(tratarErros);
