# ESPECIFICAÇÃO DO MVP 1 — Elo Alimentar

Versão 1.1 · 06/10/2026 · Equipe Elo Alimentar (IFPI Campus Teresina Central, ADS IV)

Este documento é o **contrato funcional** do MVP 1. Nenhuma regra aqui pode ser alterada por agente de código sem aprovação da equipe (ver [`AGENTS.md`](AGENTS.md)).

## 0. Convenções usadas em todos os RFs

- **Fuso horário:** `America/Fortaleza` (UTC−3). "Hoje" é a data atual nesse fuso.
- **Dias para vencer:** `dias = data_validade − hoje`, em dias corridos. `dias = 0` significa "vence hoje"; `dias < 0` significa **vencido**.
- **Dinheiro:** valores são guardados como número inteiro em centavos (`preco_centavos`) e exibidos como `R$ 0,00`.
- **Tempo de resposta:** toda ação de salvar deve exibir o resultado na tela em até **2 segundos** em conexão 4G.
- **Perfis:** `comerciante` (1 conta por estabelecimento) e `entidade` (1 conta por entidade receptora). Contas são criadas pela equipe na v1.
- **Mensagens de erro:** toda falha bloqueia a ação, **não grava nada no banco** e mostra a mensagem indicada no cenário.

## 1. Rastreabilidade com a escuta de campo

| RF | Achado de Extensão Curricular I que o justifica |
|---|---|
| RF-01, RF-02 | Mercadinho 1: só doaria com retorno financeiro → o caixa gratuito é o retorno. |
| RF-03 | Mercadinho 2: já faz promoção de produtos perto da validade, mas sem controle. |
| RF-04, RF-05 | Mercadinho 2 doa na rua e mercadinho 1 nunca doou → falta um destino organizado. |

---

## RF-01 — Cadastrar produto com validade

**Ator:** comerciante autenticado.

**Entradas**

| Campo | Tipo e formato | Limites |
|---|---|---|
| `nome` | texto | 2 a 60 caracteres, obrigatório |
| `unidade` | lista | `un`, `kg` ou `L` |
| `quantidade` | número | `un`: inteiro de 1 a 9.999 · `kg`/`L`: de 0,1 a 999,9 com 1 casa decimal |
| `preco` | moeda (R$) | de R$ 0,01 a R$ 9.999,99 por unidade de medida |
| `data_validade` | data `dd/mm/aaaa` | de hoje até hoje + 730 dias |

**Regras de negócio**

1. Produto com `data_validade` anterior a hoje **não pode ser cadastrado** (produto vencido é impróprio para consumo — CDC, art. 18, § 6º, I).
2. Cada lote com validade diferente é um produto distinto, mesmo com o mesmo nome.
3. O comerciante pode editar `preco` e `quantidade` depois do cadastro; `data_validade` só pode ser corrigida para uma data válida pela regra 1.
4. Um produto só é visível para o estabelecimento que o cadastrou.
5. O comerciante pode excluir um produto cadastrado por engano, desde que ele não tenha vendas registradas. Com vendas, a exclusão é bloqueada e aparece o aviso: "Produto com vendas registradas não pode ser excluído." *(incluída na v1.1, aprovada pela equipe em 06/10/2026)*

**Saída observável**

- **Tela:** o produto aparece na lista de estoque com nome, quantidade, preço e o rótulo de validade (ex.: "vence em 2 dias").
- **Banco:** 1 linha em `produtos` com `estabelecimento_id`, `nome`, `unidade`, `quantidade`, `preco_centavos`, `data_validade`, `criado_em`.

**Cenário de sucesso (BDD)**

> **Dado que** o comerciante está autenticado e hoje é 01/10/2026,
> **Quando** cadastra "Iogurte natural", unidade `un`, quantidade 6, preço R$ 3,50 e validade 03/10/2026,
> **Então** o produto aparece na lista com o rótulo "vence em 2 dias" em até 2 s e é salvo com `preco_centavos = 350` e `quantidade = 6`.

**Cenário de falha (BDD)**

> **Dado que** hoje é 01/10/2026,
> **Quando** o comerciante tenta cadastrar um produto com validade 30/09/2026,
> **Então** o cadastro é bloqueado, nenhuma linha é criada em `produtos` e aparece o aviso: "Produto vencido não pode ser cadastrado para venda nem para doação."

---

## RF-02 — Registrar venda (caixa mínimo)

**Ator:** comerciante autenticado.

**Entradas**

| Campo | Tipo e formato | Limites |
|---|---|---|
| `itens` | lista de pares (produto, quantidade) | de 1 a 30 itens por venda |
| `produto` | produto do próprio estabelecimento | somente produtos com `dias ≥ 0` e `quantidade > 0` |
| `quantidade` | número | maior que 0 e menor ou igual ao estoque disponível; `un` só aceita inteiros |

**Regras de negócio**

1. Produtos vencidos (`dias < 0`) **não aparecem** na busca do caixa.
2. `total_centavos = Σ (quantidade × preco_centavos)`, arredondado ao centavo (meio para cima) quando a unidade é `kg` ou `L`.
3. A venda é **atômica**: ou todos os itens dão baixa no estoque, ou nenhum.
4. **Nenhum dado do comprador** é solicitado ou armazenado (sem nome, CPF ou telefone).
5. A tela do caixa exibe sempre o aviso fixo: "Controle interno de vendas — não é documento fiscal."

**Saída observável**

- **Tela:** lista de itens com subtotais, total em R$ e confirmação "Venda registrada".
- **Banco:** 1 linha em `vendas` (`estabelecimento_id`, `total_centavos`, `criado_em`), 1 linha em `itens_venda` por item e `produtos.quantidade` reduzida.

**Cenário de sucesso (BDD)**

> **Dado que** o estoque tem "Pão francês" com 10 un a R$ 0,80,
> **Quando** o comerciante registra a venda de 4 un e toca em "Finalizar venda",
> **Então** a tela mostra total de R$ 3,20 e "Venda registrada", o estoque do pão passa a 6 un e é criada 1 venda com `total_centavos = 320`.

**Cenário de falha (BDD)**

> **Dado que** o estoque tem "Pão francês" com 10 un,
> **Quando** o comerciante tenta finalizar a venda de 12 un,
> **Então** a venda é bloqueada, o estoque continua com 10 un, nenhuma venda é criada e aparece o aviso: "Quantidade maior que o estoque disponível (10 un)."

---

## RF-03 — Listar produtos perto do vencimento

**Ator:** comerciante autenticado.

**Entradas:** nenhuma digitada. A janela de alerta é fixa em **3 dias** no MVP 1.

**Regras de negócio**

1. A lista "Vencem em até 3 dias" mostra os produtos do estabelecimento com `quantidade > 0` e `0 ≤ dias ≤ 3`, em ordem crescente de validade e, no empate, de nome.
2. Rótulos: `dias = 0` → "vence hoje"; `dias = 1` → "vence amanhã"; `dias = 2` ou `3` → "vence em N dias".
3. Produtos com `dias < 0` e `quantidade > 0` aparecem numa seção separada, "Vencidos — retirar da venda", **sem** os botões "Promoção" e "Doar".
4. Cada item da lista principal tem dois botões: "Promoção" abre a edição de preço do produto (RF-01, regra 3); "Doar" abre o RF-04 com o produto já selecionado.
5. A tela inicial mostra um contador com o número de itens da lista principal.
6. Esta tela é só de leitura: nada é gravado no banco.

**Saída observável**

- **Tela:** lista ordenada com nome, quantidade, rótulo de validade e os dois botões; contador na tela inicial.
- **Banco:** nenhuma alteração.

**Cenário de sucesso (BDD)**

> **Dado que** hoje é 01/10/2026 e o estoque tem o produto A (validade 02/10), o produto B (validade 04/10) e o produto C (validade 06/10), todos com quantidade maior que 0,
> **Quando** o comerciante abre a tela "Validade",
> **Então** aparecem apenas A ("vence amanhã") e B ("vence em 3 dias"), nessa ordem, e o contador da tela inicial mostra 2.

**Cenário de falha (BDD)**

> **Dado que** hoje é 01/10/2026 e o produto D tem validade 30/09/2026 e 2 un em estoque,
> **Quando** o comerciante abre a tela "Validade",
> **Então** D aparece somente em "Vencidos — retirar da venda", sem os botões "Promoção" e "Doar", e não entra no contador.

---

## RF-04 — Publicar doação no mural (RF-CORE)

**Ator:** comerciante autenticado.

**Entradas**

| Campo | Tipo e formato | Limites |
|---|---|---|
| `produto` | produto do próprio estabelecimento | somente com `dias ≥ 0` e `quantidade > 0` |
| `quantidade_doada` | número | maior que 0 e menor ou igual ao estoque disponível; `un` só aceita inteiros |
| `prazo_retirada` | data e hora `dd/mm/aaaa hh:mm` | no mínimo agora + 30 min; no máximo agora + 72 h; nunca depois de 23:59 do dia da validade |
| `observacao` | texto | opcional, de 0 a 200 caracteres |

**Regras de negócio**

1. Produto vencido **não pode ser doado** pelo sistema.
2. O estabelecimento precisa ter WhatsApp comercial cadastrado no formato `55` + DDD (2 dígitos) + número (9 dígitos), total de 13 dígitos. Sem ele, a publicação é bloqueada.
3. Ao publicar, `quantidade_doada` sai do estoque vendável na mesma transação e o anúncio nasce com status `ativo`.
4. Ciclo de status: `ativo` → `retirado` (o comerciante toca em "Marcar como retirado"); `ativo` → `cancelado` (o comerciante cancela, e a quantidade volta ao estoque se o produto ainda não venceu); `ativo` → `expirado` (quando `prazo_retirada` passa; a quantidade **não** volta ao estoque). Todas as telas tratam como expirado qualquer anúncio com `prazo_retirada ≤ agora`, e uma rotina agendada no banco grava o status `expirado` a cada 15 minutos.
5. Cada estabelecimento pode ter no máximo **20 anúncios ativos** ao mesmo tempo.
6. **Métrica do pitch:** número de anúncios com status `retirado` nos primeiros 30 dias de uso. Meta: 5.

**Saída observável**

- **Tela:** confirmação "Doação publicada" e o anúncio na aba "Minhas doações" com o status `ativo`; o anúncio fica visível para as entidades (RF-05) em até 5 s.
- **Banco:** 1 linha em `doacoes` (`produto_id`, `estabelecimento_id`, `quantidade`, `prazo_retirada`, `observacao`, `status`, `criado_em`, `retirado_em`) e `produtos.quantidade` reduzida.

**Cenário de sucesso (BDD)**

> **Dado que** são 10:00 de 01/10/2026, o estabelecimento tem WhatsApp comercial válido e o estoque tem "Iogurte natural" com 6 un e validade 02/10/2026,
> **Quando** o comerciante publica a doação de 6 un com prazo de retirada 01/10/2026 18:00,
> **Então** aparece "Doação publicada", o anúncio fica com status `ativo`, o estoque vendável do iogurte passa a 0 e o anúncio aparece no mural das entidades em até 5 s.

**Cenário de falha (BDD)**

> **Dado que** são 10:00 de 01/10/2026 e o "Iogurte natural" tem validade 02/10/2026,
> **Quando** o comerciante tenta publicar a doação com prazo de retirada 03/10/2026 10:00,
> **Então** a publicação é bloqueada, nenhuma linha é criada em `doacoes`, o estoque não muda e aparece o aviso: "O prazo de retirada não pode passar da validade do produto (02/10/2026)."

---

## RF-05 — Ver doações próximas e contatar pelo WhatsApp

**Ator:** entidade autenticada.

**Entradas**

| Campo | Tipo e formato | Limites |
|---|---|---|
| `localizacao` | latitude e longitude do GPS do celular (Geolocation API, com permissão) | aceita só leituras com precisão de até 1.000 m |
| `bairro` (alternativa) | lista de bairros com estabelecimentos cadastrados | usado quando a entidade nega o GPS ou a precisão passa de 1.000 m |

**Regras de negócio**

1. O mural mostra apenas anúncios com status `ativo` e `prazo_retirada` no futuro.
2. Com GPS: distância calculada pela fórmula de Haversine entre a entidade e o estabelecimento, exibida em km com 1 casa decimal; só aparecem anúncios a até **5,0 km**; ordem por distância e, no empate, pelo prazo mais próximo.
3. Com bairro: aparecem os anúncios dos estabelecimentos daquele bairro, sem distância, ordenados pelo prazo mais próximo.
4. **A localização da entidade é usada só no navegador e nunca é enviada nem salva no servidor.**
5. O botão "Conversar no WhatsApp" abre `https://wa.me/<13 dígitos>?text=<mensagem>` com o texto pré-preenchido: "Olá! Somos da entidade [nome] e vimos no Elo Alimentar a doação de [quantidade] [produto]. Podemos retirar até [prazo]?"
6. Cada toque nesse botão registra 1 contato para acompanhar a métrica.
7. O mural não é público: só entidades autenticadas o acessam.

**Saída observável**

- **Tela:** cards com produto, quantidade, estabelecimento, bairro, prazo de retirada, distância (modo GPS) e o botão "Conversar no WhatsApp".
- **Banco:** nada é gravado ao abrir o mural; ao tocar no botão, 1 linha em `contatos` (`doacao_id`, `entidade_id`, `criado_em`).

**Cenário de sucesso (BDD)**

> **Dado que** a entidade autorizou o GPS com precisão de 50 m e existe um anúncio `ativo` a 2,3 km,
> **Quando** abre o mural e toca em "Conversar no WhatsApp",
> **Então** o card mostra "2,3 km", o WhatsApp abre com a mensagem pré-preenchida e 1 linha é criada em `contatos`.

**Cenário de falha (BDD)**

> **Dado que** a entidade autorizou o GPS e o único anúncio `ativo` está a 7,8 km,
> **Quando** abre o mural,
> **Então** nenhum card é exibido e aparece o aviso: "Nenhuma doação ativa a até 5 km. Tente buscar por bairro."

**Cenário alternativo (BDD)**

> **Dado que** a entidade negou a permissão de localização,
> **Quando** abre o mural,
> **Então** o sistema mostra a lista de bairros e nenhum dado de localização é enviado ao servidor.

---

## 2. Modelo de dados inicial

| Tabela | Campos principais | Acesso (Row Level Security) |
|---|---|---|
| `estabelecimentos` | `id`, `user_id`, `nome_fantasia`, `bairro`, `latitude`, `longitude`, `whatsapp_comercial` | o próprio comerciante; entidades leem nome, bairro, coordenadas e WhatsApp |
| `produtos` | `id`, `estabelecimento_id`, `nome`, `unidade`, `quantidade`, `preco_centavos`, `data_validade`, `criado_em` | só o estabelecimento dono |
| `vendas` / `itens_venda` | `id`, `estabelecimento_id`, `total_centavos`, `criado_em` / `venda_id`, `produto_id`, `quantidade`, `preco_centavos` | só o estabelecimento dono |
| `doacoes` | `id`, `produto_id`, `estabelecimento_id`, `quantidade`, `prazo_retirada`, `observacao`, `status`, `criado_em`, `retirado_em` | dono escreve; entidades leem só as `ativo` |
| `entidades` | `id`, `user_id`, `nome`, `bairro` | a própria entidade |
| `contatos` | `id`, `doacao_id`, `entidade_id`, `criado_em` | a entidade cria; o estabelecimento dono lê |

## 3. Limitações declaradas do MVP 1

1. **Evidência pequena:** a dor foi observada em apenas 2 estabelecimentos e nenhuma entidade receptora foi ouvida; uma nova rodada de escuta está planejada para outubro de 2026.
2. **Caixa não fiscal:** o RF-02 é controle interno e não substitui a emissão de nota fiscal. O levantamento das obrigações fiscais (SEFAZ-PI) está em andamento.
3. **Levantamento legal pendente:** Lei nº 14.016/2020 (doação de excedentes), CDC e LGPD serão revisados pela equipe até 02/10/2026; as regras podem mudar depois disso.
4. **Sem modo offline:** o sistema exige internet no momento de registrar vendas e doações.
5. **Cadastro manual:** estabelecimentos e entidades são cadastrados pela equipe; não há autocadastro.
6. **Métrica autodeclarada:** a retirada é marcada pelo próprio comerciante, sem confirmação da entidade.
7. **Precisão do GPS:** leituras com precisão pior que 1.000 m são descartadas e o mural passa ao modo por bairro.
8. **Escala:** o MVP 1 foi dimensionado para até 20 estabelecimentos e 20 entidades.

## 4. Stack tecnológica inicial

| Camada | Tecnologia | Motivo |
|---|---|---|
| Front-end | Nuxt 4 (Vue 3) + PWA | mobile-first, instalável no celular do caixa |
| Banco e autenticação | Supabase (PostgreSQL, Auth, Row Level Security) | persistência real e isolamento dos dados de cada estabelecimento |
| API REST | Node.js + Express (pasta `backend/`) | camada entre o front-end e o Supabase, com URIs, verbos e status codes REST (Aula 10) |
| Regras transacionais | funções SQL no PostgreSQL (RPC) | baixa de estoque atômica nos RF-02 e RF-04 |
| Hospedagem | Vercel + Supabase Cloud (planos gratuitos) | custo zero no semestre |
| Testes | Vitest (regras de negócio) + roteiros manuais BDD (telas) | cobrir sucesso e falha de cada RF |
