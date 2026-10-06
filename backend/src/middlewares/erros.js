// Traduz erros do PostgreSQL/Supabase em status HTTP semânticos.
// Nunca responde 200 com erro no corpo (AGENTS.md, Regra 7).

// Códigos SQLSTATE que significam "o cliente mandou dado inválido".
const ERROS_DE_DADO = new Set(['23514', '23502', '22P02', '22003', '22007', '22008']);

export function tratarErros(err, req, res, _next) {
  // JSON malformado no corpo (express.json)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON malformado no corpo da requisição.' });
  }
  if (ERROS_DE_DADO.has(err.code)) {
    // Mensagens de regra de negócio levantadas pelos gatilhos/funções do banco são repassadas;
    // mensagens técnicas de constraint viram um texto genérico.
    const tecnica = /violates|invalid input|out of range/i.test(err.message || '');
    return res.status(400).json({ erro: tecnica ? 'Dados inválidos.' : err.message });
  }
  if (err.code === '23503') {
    return res.status(409).json({ erro: 'Produto com vendas registradas não pode ser excluído.' });
  }
  if (err.code === '42501') {
    return res.status(403).json({ erro: 'Operação não permitida pela política de segurança do banco.' });
  }
  console.error('[API] erro inesperado:', err.code, err.message);
  return res.status(500).json({ erro: 'Erro interno no servidor.' });
}
