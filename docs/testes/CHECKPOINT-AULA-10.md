# Roteiro e evidência — Checkpoint #2 da Aula 10 (RF-01 e RF-02)

Formato do AGENTS.md, Regra 3.

- **Pré-condição:** migrações 001 a 003 aplicadas no Supabase; `.env.local` com a URL e a chave publishable; API no ar com `npm run api`.
- **Passos:** em outro terminal, `npm run checkpoint` (roteiro em [`backend/scripts/checkpoint.sh`](../../backend/scripts/checkpoint.sh)). O roteiro usa os valores do BDD da spec ("Pão francês", 10 un, R$ 0,80; venda de 4 un e de 12 un).
- **Resultado esperado:** coluna "Esperado" abaixo.
- **Resultado obtido:** coluna "Obtido" abaixo. 17 de 17 cenários conferem.
- **Data:** 06/10/2026 (data de referência America/Fortaleza: 2026-10-06).
- **Responsável:** Renato de Paiva Belarmino.

| Cenário | Esperado | Obtido | Detalhe |
|---|---|---|---|
| RF-01 POST /produtos (Pão francês, 10 un, R$ 0,80) | 201 | 201 | `Location: /api/v1/produtos/7880aa9e-…` |
| RF-01 POST /produtos vencido (ontem) | 400 | 400 | Produto vencido não pode ser cadastrado para venda nem para doação. |
| RF-01 POST /produtos corpo vazio | 400 | 400 | mensagem de validação* |
| RF-01 POST /produtos JSON malformado | 400 | 400 | JSON malformado no corpo da requisição. |
| RF-01 GET /produtos/:id | 200 | 200 | quantidade 10 |
| RF-01 PATCH /produtos/:id (preço 70) | 200 | 200 | preco_centavos 70 |
| RF-01 PATCH id inexistente | 404 | 404 | Produto não encontrado. |
| RF-02 POST /vendas (4 un do pão) | 201 | 201 | total_centavos 320 · `Location: /api/v1/vendas/88210eda-…` |
| RF-02 estoque após a venda | 200 | 200 | quantidade 6 |
| RF-02 GET /vendas/:id | 200 | 200 | total_centavos 320, 1 item |
| RF-02 POST /vendas 12 un com estoque 10 | 400 | 400 | Quantidade maior que o estoque disponível (10 un). |
| RF-02 estoque após a falha | 200 | 200 | quantidade 10 (nada foi gravado) |
| RF-02 POST /vendas sem itens | 400 | 400 | Informe de 1 a 30 itens na venda. |
| RF-01 GET /produtos | 200 | 200 | 7 produtos |
| RF-01 DELETE /produtos/:id | 204 | 204 | sem corpo |
| RF-01 DELETE de novo (idempotente) | 404 | 404 | Produto não encontrado. |
| RF-01 DELETE produto com venda | 409 | 409 | Produto com vendas registradas não pode ser excluído. |

\* Na rodada de 06/10 a mensagem foi a de preço; depois disso a validação passou a seguir a ordem dos campos e o corpo vazio responde "O nome deve ter de 2 a 60 caracteres." (coberto pelo Vitest).

**Testes automatizados:** `npm test` (Vitest, 22 testes de contrato em `backend/test/`, relógio fixo em 01/10/2026 no fuso America/Fortaleza).
