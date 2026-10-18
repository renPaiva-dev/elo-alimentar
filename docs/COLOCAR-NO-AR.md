# Colocar o Elo Alimentar no ar (Supabase + Vercel)

Passo a passo para a equipe sair do código e ter um link para abrir no celular do comerciante e da entidade. Tempo estimado: 30 a 40 minutos.

## 1. Banco (Supabase)

1. Supabase > **SQL Editor** > rode, nesta ordem, cada arquivo de `supabase/` (todos podem ser rodados de novo sem erro):
   1. `004_autenticacao_perfis.sql` — perfis, dono dos dados e RLS por dono (as migrações 001 a 003 já estão aplicadas no banco em nuvem).
   2. `005_rf04_doacoes.sql` — doações, publicar/retirar/cancelar e expiração.
   3. `006_rf05_mural_contatos.sql` — mural da entidade e contatos.
   4. `007_estabelecimento_endereco.sql` — "Meu estabelecimento" e endereço de retirada (spec v1.2). **Depois dela, cada comerciante precisa ter endereço** (ou digitar o local na doação) para publicar: ele mesmo preenche em "Meu estabelecimento", tocando no nome da loja no topo da tela.
2. **Database > Extensions > `pg_cron`**: ative. Depois rode de novo só o último bloco `DO $$ ... cron.schedule ... $$` da `005`. Confira com `SELECT jobname, schedule FROM cron.job;` (deve aparecer `elo-expirar-doacoes` a cada 15 min).
3. **Atenção:** depois da `004`, os produtos e vendas antigos (seed e testes da Aula 10) ficam sem dono e **somem das telas**. É o esperado. Se quiser reaproveitá-los numa conta de teste, rode: `UPDATE produtos SET estabelecimento_id = '<id do estabelecimento>' WHERE estabelecimento_id IS NULL;` (e o mesmo em `vendas`).

## 2. Contas (cadastro manual da v1)

Para **cada** estabelecimento e entidade que aceitar participar:

1. **Authentication > Users > Add user > Create new user**: e-mail, senha provisória e **Auto Confirm User** marcado.
2. **SQL Editor**: copie o bloco certo de `supabase/cadastro-contas.sql`, troque os valores entre `< >` e rode.
   - Comerciante: nome, bairro, latitude/longitude do comércio (Google Maps > botão direito no local) e WhatsApp comercial `55` + DDD + número (13 dígitos), com autorização do responsável.
   - Entidade: só nome e bairro.
3. Entregue a senha pessoalmente e peça para trocar. Nunca coloque e-mails ou senhas reais em arquivos do repositório.

Crie também uma conta comerciante e uma entidade **de teste** para a equipe ensaiar antes da visita.

## 3. Testar no computador

```bash
npm install
# .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Project Settings > API, chave anon/publishable)
npm test          # 81 testes de contrato e de regras
npm run dev       # abre o app e a API em http://localhost:3000
```

No celular (mesma rede Wi-Fi): `npm run dev -- --host` e abra o endereço mostrado no terminal. **O GPS do mural só funciona em `https` ou `localhost`**, então para testar a localização no celular use o link do Vercel (passo 4).

## 4. Publicar no Vercel (gratuito)

1. vercel.com > **Add New > Project** > importe `renPaiva-dev/elo-alimentar`. O Vercel detecta o Nuxt sozinho (não mude o comando de build).
2. **Environment Variables**:
   - `NUXT_PUBLIC_SUPABASE_URL` = URL do projeto (sem barra no final)
   - `NUXT_PUBLIC_SUPABASE_ANON_KEY` = chave **anon/publishable** (nunca a `service_role`)
3. **Deploy**. O mesmo link serve as telas e a API (`/api/v1`), sem CORS.
4. Node.js: em Settings > General, use **22.x** ou **24.x**.
5. No celular: abra o link > menu do navegador > **Adicionar à tela inicial**. O app abre como aplicativo.

## 5. Ensaio antes da visita (checklist)

- [ ] Entrar como comerciante de teste: cadastrar 3 produtos (um vencendo amanhã), registrar uma venda e conferir o estoque.
- [ ] Validade: tocar em **Doar** no produto que vence amanhã e publicar.
- [ ] Entrar como entidade de teste **no celular, pelo link https**: autorizar a localização, ver a distância e tocar em **Conversar no WhatsApp**.
- [ ] Voltar como comerciante: "1 entidade chamou no WhatsApp" > **Marcar como retirado**.
- [ ] Negar a localização e conferir o modo **Por bairro**.
- [ ] Levar os wireframes impressos (Plano B) caso falte internet no local.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Conta sem estabelecimento ou entidade vinculada" | O passo 2.2 não foi feito para aquele e-mail. |
| "Cadastre o WhatsApp comercial…" ao publicar | `whatsapp_comercial` vazio ou fora do formato `55DDDNUMERO`. |
| Mural vazio no modo GPS | Estabelecimento sem latitude/longitude, ou a mais de 5 km. Teste o modo por bairro. |
| Doação não vira `expirado` no banco | `pg_cron` não está ativo (as telas já mostram expirado mesmo assim). |
| Tela branca no Vercel | Variáveis `NUXT_PUBLIC_*` ausentes; refaça o deploy depois de criá-las. |
