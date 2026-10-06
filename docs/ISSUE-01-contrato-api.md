### Atualização Aula 10 — Contrato da API RESTful e persistência em nuvem

- [x] API REST em **Node.js + Express** na pasta `backend/`, em camadas: `config → repositories → controllers → routes → server`;
- [x] Persistência no **Supabase** (PostgreSQL) via SDK oficial, só com a chave pública (anon/publishable) e RLS ativo;
- [x] `.env.local` fora do Git (`.gitignore`) e `.env.example` versionado só com placeholders;
- [x] Regras de REST no `AGENTS.md` (Regra 7): URIs no plural, 201 + `Location`, 204 no DELETE, 400 com `{ "erro" }`, nunca GET para mutação;
- [x] **RF-01** (produtos), **RF-02** (vendas) e **RF-03** (alerta de validade) implementados e testados: 30 testes de contrato (Vitest) + 20 cenários reais contra o Supabase;
- [x] Contrato completo do MVP definido: RF-01 a RF-03 entregues nesta aula; RF-04 e RF-05 com rotas já desenhadas, seguindo a ordem do `AGENTS.md` (um RF por vez).

**Banco em nuvem (Supabase):** https://sxfafipniczshptyhjro.supabase.co · **Código:** https://github.com/renPaiva-dev/elo-alimentar/pull/1

**Base da API:** `http://localhost:3000/api/v1` (a API Express roda local e persiste no Supabase acima) · **Formato:** JSON (`Content-Type: application/json`) · **Erros:** `{ "erro": "mensagem" }`

#### Contrato

| RF | Método e URI | Sucesso | Erros | Entrega |
|---|---|---|---|---|
| 01 | `POST /produtos` | **201** + `Location: /api/v1/produtos/{id}` | 400 | ✅ Aula 10 |
| 01 | `GET /produtos` (ordem: validade, nome) | **200** | — | ✅ Aula 10 |
| 01 | `GET /produtos/{id}` | **200** | 404 | ✅ Aula 10 |
| 01 | `PATCH /produtos/{id}` (só `preco_centavos`, `quantidade`, `data_validade`) | **200** | 400, 404 | ✅ Aula 10 |
| 01 | `DELETE /produtos/{id}` | **204** sem corpo | 404, 409 (produto com vendas) | ✅ Aula 10 |
| 02 | `POST /vendas` | **201** + `Location: /api/v1/vendas/{id}` | 400 | ✅ Aula 10 |
| 02 | `GET /vendas/{id}` | **200** | 404 | ✅ Aula 10 |
| 03 | `GET /produtos?vence_em_ate=3` (lista "Vencem em até 3 dias", com `rotulo_validade`) | 200 | 400 | ✅ Aula 10 (só leitura) |
| 03 | `GET /produtos?vencidos=true` ("Vencidos — retirar da venda") | 200 | 400 | ✅ Aula 10 (só leitura) |
| 04 | `POST /doacoes` | 201 + `Location` | 400, 409 (limite de 20 ativos) | 📅 planejado |
| 04 | `GET /doacoes` ("Minhas doações") | 200 | — | 📅 planejado |
| 04 | `PATCH /doacoes/{id}` `{ "status": "retirado" \| "cancelado" }` | 200 | 400, 404, 409 | 📅 planejado |
| 05 | `GET /doacoes?status=ativo&bairro={bairro}` (mural) | 200 | 400 | 📅 planejado |
| 05 | `POST /contatos` `{ "doacao_id" }` | 201 + `Location` | 400, 404 | 📅 planejado |

**Roadmap:** RF-04 (doações, RF-CORE) → RF-05 (mural e contatos). O RF-04 e o RF-05 entram junto com as tabelas `estabelecimentos`, `doacoes`, `entidades` e `contatos` e com a autenticação da Aula 11.

**RF-05 e LGPD:** a localização da entidade **nunca** vai para a API. O mural recebe os anúncios com as coordenadas dos estabelecimentos e o navegador calcula a distância (Haversine) e o filtro de 5 km.

**Estoque atômico:** `POST /vendas` (e, no futuro, `POST /doacoes`) chama **uma** função transacional no PostgreSQL (`registrar_venda`). Ou todos os itens dão baixa, ou nenhum. A API nunca faz duas chamadas separadas para isso.

#### Exemplos (valores dos cenários BDD da especificação)

**RF-01 — sucesso** (hoje = 01/10/2026)

```http
POST /api/v1/produtos
{ "nome": "Iogurte natural", "unidade": "un", "quantidade": 6, "preco_centavos": 350, "data_validade": "2026-10-03" }
```
```http
HTTP/1.1 201 Created
Location: /api/v1/produtos/874f8ad0-6d4c-4510-ac30-3deb5f797c2f

{ "id": "874f8ad0-…", "created_at": "2026-10-01T13:00:00+00:00", "nome": "Iogurte natural", "unidade": "un",
  "quantidade": 6, "preco_centavos": 350, "data_validade": "2026-10-03" }
```

**RF-01 — falha** (validade 30/09/2026)

```http
HTTP/1.1 400 Bad Request
{ "erro": "Produto vencido não pode ser cadastrado para venda nem para doação." }
```

**RF-02 — sucesso** ("Pão francês", 10 un a R$ 0,80, venda de 4 un)

```http
POST /api/v1/vendas
{ "itens": [ { "produto_id": "7880aa9e-06f9-48f8-aaa2-8101e5d83fb7", "quantidade": 4 } ] }
```
```http
HTTP/1.1 201 Created
Location: /api/v1/vendas/88210eda-96cb-45c1-b28d-5c4e19780dc6

{ "venda_id": "88210eda-…", "total_centavos": 320,
  "itens": [ { "produto_id": "7880aa9e-…", "nome": "Pão francês", "quantidade": 4, "preco_centavos": 80, "subtotal_centavos": 320 } ] }
```

**RF-02 — falha** (12 un com estoque 10; o estoque continua 10 e nenhuma venda é criada)

```http
HTTP/1.1 400 Bad Request
{ "erro": "Quantidade maior que o estoque disponível (10 un)." }
```

**DELETE**

```http
DELETE /api/v1/produtos/{id}   →  HTTP/1.1 204 No Content   (sem corpo)
DELETE /api/v1/produtos/{id}   →  HTTP/1.1 409 Conflict     { "erro": "Produto com vendas registradas não pode ser excluído." }
```

#### Evidência (06/10/2026, API local → Supabase)

| Cenário | Esperado | Obtido |
|---|---|---|
| POST /produtos válido | 201 | 201 |
| POST /produtos vencido | 400 | 400 |
| POST /produtos corpo vazio / JSON malformado | 400 | 400 |
| PATCH /produtos/{id} · id inexistente | 200 · 404 | 200 · 404 |
| POST /vendas 4 un → total 320, estoque 6 | 201 | 201 |
| POST /vendas 12 un → estoque continua 10 | 400 | 400 |
| DELETE /produtos/{id} · de novo · com venda | 204 · 404 · 409 | 204 · 404 · 409 |
| GET /produtos?vence_em_ate=3 → só A ("vence amanhã") e B ("vence em 3 dias") | 200 | 200 |
| GET /produtos?vence_em_ate=7 · ?vencidos=true | 400 · 200 | 400 · 200 |

Tabela completa em `docs/testes/CHECKPOINT-AULA-10.md`.

#### Próximos passos e limitações declaradas

1. **Sem autenticação ainda (Aula 11):** hoje o RLS tem políticas públicas transitórias. Com o JWT (`Authorization: Bearer <token>`, stateless), entram os erros 401/403 e o isolamento por estabelecimento que a spec exige.
2. **Arredondamento no RF-02:** hoje o arredondamento é feito por item (meio para cima). A spec não diz se deve ser por item ou na soma, e a equipe ainda vai decidir.
3. **DELETE de produto:** incluído na spec v1.1 (RF-01, regra 5) para atender ao contrato REST; só vale para produto sem vendas.
4. **Deploy da API:** o banco já está na nuvem (Supabase); a API Express ainda roda localmente, e a publicação (Render/Vercel) é o próximo passo.

**Commits:** `1850228` (API, RF-01 e RF-02) · `f9d95b4` (RF-03) · **PRs:** #1 e #3
