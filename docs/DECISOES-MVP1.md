# Decisões de implementação do MVP 1 — para aprovação da equipe

A `ESPECIFICACAO-MVP.md` **não foi alterada** (AGENTS.md, Regra 1). Abaixo estão os pontos que a spec não define ou deixa ambíguos e como foram implementados. Cada um precisa de ✅ ou de ajuste de um integrante antes do merge.

| # | Ponto | Como ficou | Onde |
|---|---|---|---|
| 1 | Mensagens de erro que a spec não traz | "Produto vencido não pode ser doado.", "Cadastre o WhatsApp comercial…", "O prazo de retirada deve ser de pelo menos 30 minutos / no máximo 72 horas…", "Limite de 20 doações ativas…", "Só é possível alterar uma doação ativa…", "Produto com doações registradas não pode ser excluído." | `005`, validators |
| 2 | Texto do WhatsApp (RF-05, regra 5) | `[quantidade] [unidade] de [produto]` e prazo como `01/10 às 18:00`: "…a doação de 6 un de Iogurte natural. Podemos retirar até 01/10 às 18:00?" | `shared/utils/mural.js` |
| 3 | Marcar como retirado depois do prazo | **Bloqueado** (o anúncio já é `expirado`, regra 4). Risco: se a entidade buscar atrasada, a retirada não conta na métrica. Alternativa: permitir `expirado → retirado` por até 24 h. | `alterar_status_doacao` |
| 4 | Lista de bairros do modo alternativo | Bairros **com doação ativa** (a spec diz "com estabelecimentos cadastrados"). Evita escolher bairro vazio. | `mural.vue` |
| 5 | Estabelecimento sem latitude/longitude | Não aparece no modo GPS, só no modo por bairro. | `muralPorGps` |
| 6 | Endpoints além da Issue #01 | `GET /api/v1/perfil` (as telas precisam saber se a conta é comerciante ou entidade) e `GET /api/v1/doacoes/:id` (destino do header `Location`). | `app.js`, `doacoes.routes.js` |
| 7 | Produto com doação registrada | Não pode ser excluído (409), para não perder o histórico da métrica. | FK em `doacoes` |
| 8 | Dados antigos da Aula 10 | Ficam sem dono e somem das telas após a `004` (ver `COLOCAR-NO-AR.md`). | `004` |
| 9 | Front-end e API no mesmo deploy | O Nuxt serve a API Express em `/api/v1` (ponte em `server/routes/api/v1/[...].js`). `npm run api` continua funcionando sozinho. | `nuxt.config.js` |
| 10 | Quem vê os contatos | O estabelecimento vê **quantos** contatos cada doação recebeu, não o nome da entidade. | `006`, "Minhas doações" |

## Como foi verificado

- **Vitest:** 81 testes (contrato REST de RF-01 a RF-05, autenticação 401/403 e regras do navegador), com os valores exatos dos cenários BDD.
- **SQL real:** as migrações 001 → 006 rodaram duas vezes (idempotência) num PostgreSQL 17 em memória (PGlite) com um esqueleto do Supabase Auth: 63 cenários de RLS e de regras de negócio passaram.
- **Ponta a ponta no navegador:** o app compilado (`nuxt build`) rodou contra um Supabase simulado com as migrações reais. O Edge automatizado, em tela de celular, fez: login, cadastro de 3 produtos, venda (R$ 7,69), validade, promoção, doação, mural por GPS (2,1 km), WhatsApp + contato, modo por bairro, retirada e bloqueios de perfil. 19 de 19 passos OK.
- **Falta:** rodar os roteiros manuais de `docs/testes/RF-04.md` e `RF-05.md` no Supabase real e preencher "Resultado obtido".
