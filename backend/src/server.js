// Ponto de entrada da API. Execute na raiz do projeto:  npm run api
import { app } from './app.js';

const porta = Number(process.env.PORT) || 3000;

app.listen(porta, () => {
  console.log(`API Elo Alimentar ouvindo em http://localhost:${porta}/api/v1`);
});
