// Smoke test do RF-01 — cobre o cenário de SUCESSO e o de FALHA (AGENTS.md, Regra 3).
// Execute na raiz do projeto:  npm run smoke
import { cadastrarProduto } from './cadastrarProduto.js';
import { hojeFortaleza } from './validarProduto.js';

function diasAPartirDeHoje(dias) {
  const d = new Date(`${hojeFortaleza()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function rodarSmokeTest() {
  console.log('Smoke test RF-01 — cadastro de produto no Supabase\n');

  // Cenário de sucesso (BDD): Iogurte natural, 6 un, R$ 3,50, vence em 2 dias
  const sucesso = await cadastrarProduto({
    nome: 'Iogurte natural (teste de bancada)',
    unidade: 'un',
    quantidade: 6,
    preco: 3.5,
    dataValidade: diasAPartirDeHoje(2),
  });
  if (sucesso.sucesso && sucesso.dados.preco_centavos === 350) {
    console.log('[OK] Sucesso: produto salvo com id', sucesso.dados.id, 'em', sucesso.dados.created_at);
  } else {
    console.error('[ERRO] O cenário de sucesso falhou:', sucesso.erro);
  }

  // Cenário de falha (BDD): produto que venceu ontem deve ser bloqueado
  const falha = await cadastrarProduto({
    nome: 'Leite vencido (teste de bancada)',
    unidade: 'un',
    quantidade: 1,
    preco: 5,
    dataValidade: diasAPartirDeHoje(-1),
  });
  if (!falha.sucesso && falha.erro.startsWith('Produto vencido')) {
    console.log('[OK] Falha bloqueada corretamente:', falha.erro);
  } else {
    console.error('[ERRO] O produto vencido NÃO foi bloqueado!');
  }

  console.log('\nAbra o Table Editor do Supabase > produtos para conferir a nova linha.');
}

rodarSmokeTest();
