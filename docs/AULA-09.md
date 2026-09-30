# Aula 09 — Backend e persistência com Supabase · Elo Alimentar

Roteiro da equipe para o laboratório de 29/09/2026 (TEC-1053). Segue a mesma ordem do guia do professor. Os arquivos citados estão prontos nesta pasta; as etapas marcadas como *ação da equipe* dependem do Supabase, do GitHub ou do professor.

| Passo do guia | O que está pronto | Ação da equipe |
|---|---|---|
| 1 · Projeto no Supabase | Nome e configurações definidos | Um integrante cria o projeto `elo-alimentar-db`. |
| 2 · DDL via agente de IA | Prompt 1 preenchido e SQL gerado e testado | Revisar o SQL antes de rodar. |
| 3 · SQL Editor + **Checkpoint #1** | `supabase/001_produtos_vendas.sql` | Rodar, conferir no Table Editor e explicar ao professor. |
| 4 · `.env` e SDK | `.env.example`, trecho do `.gitignore`, `package.json` | Criar o `.env.local` com as chaves reais e instalar o SDK. |
| 5 · Função de persistência | `src/services/` com cliente, validação, cadastro e smoke test | Copiar para o repositório. |
| 6 · Teste real + **Checkpoint #2** | `npm run smoke` | Rodar, mostrar a linha no Table Editor e o `git status` limpo. |
| 7 · Commit, Issue e Classroom | Comentário da Issue pronto | Fazer o commit, comentar a Issue e enviar o link. |

## Passo 1 — Criar o projeto no Supabase

Em supabase.com, *New project*:

- **Name:** `elo-alimentar-db`
- **Database Password:** senha forte, guardada com a equipe (não vai para o repositório)
- **Region:** South America (São Paulo) — `sa-east-1`
- **Plan:** Free

## Passo 2 — Prompt 1 preenchido com o nosso RF-01 e RF-02

> Você é um Engenheiro de Banco de Dados PostgreSQL sênior especializado em arquiteturas Supabase e produtos MVP. Abaixo está o trecho de requisitos funcionais da nossa ESPECIFICACAO-MVP.md:
>
> **RF-01 — Cadastrar produto com validade.** Ator: comerciante. Entradas: nome (2 a 60 caracteres), unidade (`un`, `kg` ou `L`), quantidade (`un`: inteiro de 1 a 9.999; `kg`/`L`: de 0,1 a 999,9 com 1 casa decimal), preço (R$ 0,01 a R$ 9.999,99, guardado em centavos), data de validade (de hoje até hoje + 730 dias, fuso America/Fortaleza). Regra: produto vencido não pode ser cadastrado. Saída: 1 linha em `produtos`.
>
> **RF-02 — Registrar venda (caixa mínimo).** Ator: comerciante. Entradas: de 1 a 30 itens (produto e quantidade menor ou igual ao estoque). Regras: total em centavos; venda atômica; nenhum dado do comprador é armazenado. Saída: 1 linha em `vendas`, 1 linha em `itens_venda` por item e estoque reduzido.
>
> Com base exclusivamente nessa especificação, gere um script SQL DDL idempotente e pronto para execução no SQL Editor do Supabase, com: tabela principal no esquema `public` com `id` UUID `gen_random_uuid()`, `created_at` TIMESTAMPTZ NOT NULL `now()`, tipos adequados, NOT NULL e CHECK constraints (Princípio do Oráculo para valores enumerados); RLS ativado com as políticas públicas de INSERT e SELECT desta fase sem autenticação; e 2 INSERTs de demonstração verossímeis. Retorne APENAS o bloco SQL puro, limpo e comentado.

O resultado é o arquivo `supabase/001_produtos_vendas.sql`, com as tabelas `produtos` (principal), `vendas` e `itens_venda`.

## Passo 3 — Rodar no SQL Editor e Checkpoint #1

1. Supabase → **SQL Editor** → *+ New query* → colar o conteúdo de `supabase/001_produtos_vendas.sql` → **Run**.
2. Deve aparecer `Success. No rows returned`. O script pode ser rodado de novo sem erro.
3. **Table Editor** → `produtos`: conferir as colunas, as 2 linhas de seed (`Iogurte natural (seed)` e `Banana prata (seed)`) e o cadeado de **RLS Enabled**.

**Fala de 30 segundos para o professor:**

> "A tabela `produtos` é o RF-01. O cenário de sucesso é o cadastro do iogurte a R$ 3,50, que fica salvo como `preco_centavos = 350`. O cenário de falha é o produto vencido: o banco bloqueia com um gatilho que compara a validade com a data de hoje em Teresina e devolve a mensagem da especificação. As CHECK constraints garantem nome de 2 a 60 caracteres, unidade `un`, `kg` ou `L`, quantidade inteira para `un` e preço entre R$ 0,01 e R$ 9.999,99. A validade não virou CHECK porque depende da data de hoje, que muda todo dia."

## Passo 4 — Segredos e SDK

1. Acrescentar ao `.gitignore` o conteúdo de `gitignore-adicionar.txt`.
2. Colocar na raiz o `.env.example` desta pasta (substitui o anterior).
3. Criar o `.env.local` (não versionado) com os valores de *Project Settings > API*:

```bash
VITE_SUPABASE_URL="https://SEU-ID.supabase.co"
VITE_SUPABASE_ANON_KEY="chave-anon-public"
```

A URL vai **sem barra no final**. A chave é a **anon public**; a `service_role` nunca entra no projeto.

4. Instalar o SDK:

```bash
npm install @supabase/supabase-js
```

## Passo 5 — Função de persistência

Copiar a pasta `src/services/` para o repositório:

| Arquivo | Função |
|---|---|
| `supabaseClient.js` | Cliente único, com leitura segura das variáveis no navegador e no Node |
| `validarProduto.js` | Regras do RF-01 no cliente (fail fast), iguais às do banco |
| `cadastrarProduto.js` | Insere em `produtos` com `try/catch` e mensagens claras de erro |
| `test-insert.js` | Smoke test com o cenário de sucesso **e** o de falha do RF-01 |

Como manda o `AGENTS.md` (Regra 2), só o **RF-01** é implementado nesta aula. As tabelas do RF-02 já existem, mas a venda com baixa atômica de estoque fica para a etapa do RF-02.

## Passo 6 — Teste real e Checkpoint #2

```bash
npm run smoke
```

O script usa `node --env-file=.env.local` (Node 20.6 ou mais novo). Resultado esperado:

```text
[OK] Sucesso: produto salvo com id <uuid> em <data e hora>
[OK] Falha bloqueada corretamente: Produto vencido não pode ser cadastrado para venda nem para doação.
```

Depois, abrir o **Table Editor → produtos** e mostrar a linha `Iogurte natural (teste de bancada)` com UUID e `created_at`.

**Checkpoint #2:** mostrar (1) a linha no Table Editor; (2) `git status` sem o `.env.local`; (3) o `.env.example` só com placeholders.

## Passo 7 — Commit, Issue #01 e Classroom

```bash
git status   # o .env.local NÃO pode aparecer aqui
git add .env.example .gitignore package.json package-lock.json src/ supabase/ docs/
git commit -m "feat(backend): conectar persistencia relacional ao supabase com rls e validacao"
git push origin main
```

Comentário para a Issue #01:

```markdown
### Atualização Aula 09 - Conexão de Backend e Persistência em Nuvem

- [x] Projeto Supabase `elo-alimentar-db` provisionado na região South America (São Paulo);
- [x] Tabelas `produtos` (RF-01), `vendas` e `itens_venda` (RF-02) criadas via DDL com chaves UUID, colunas TIMESTAMPTZ e CHECK constraints;
- [x] Gatilho que bloqueia o cadastro de produto vencido (cenário de falha do RF-01);
- [x] Políticas de Row Level Security (RLS) ativadas e validadas;
- [x] Cliente SDK configurado com isolamento de credenciais (.env.example versionado e .env.local ignorado);
- [x] Smoke test do RF-01 executado: cenário de sucesso persistido e cenário de falha bloqueado;
- [x] Visto do Checkpoint #1 e Checkpoint #2 validados em bancada pelo Prof. Aislan Rafael.

**Commit:** <cole aqui o hash>
**Evidência:** <cole aqui o print do Table Editor com a tabela produtos>
```

Por fim, colar o link da Issue #01 na atividade da Aula 09 no Classroom.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `42501 new row violates row-level security policy` | Faltou a política de INSERT ou de SELECT | Rodar o SQL de novo (ele recria as políticas). |
| `Configure VITE_SUPABASE_URL...` | `.env.local` ausente ou fora da raiz | Criar o arquivo na raiz com os nomes exatos. |
| `Não foi possível conectar ao servidor` | URL errada, barra no final ou bloqueio de rede | Conferir a URL e desativar bloqueadores. |
| `node: bad option: --env-file` | Node antigo | Atualizar o Node ou usar `npx dotenv-cli -e .env.local -- node src/services/test-insert.js`. |
