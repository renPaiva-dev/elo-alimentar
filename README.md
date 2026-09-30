# Elo Alimentar

> **Pitch (Checkpoint #1):** Para pequenos mercadinhos de Teresina, que perdem ou doam de forma improvisada alimentos perto do vencimento e não veem retorno em doar, faremos um caixa simples e gratuito que avisa o que está perto de vencer e publica a doação para entidades próximas, diferente de doar informalmente na rua ou fazer promoção sem controle, medindo o sucesso inicial por **5 doações publicadas e marcadas como retiradas por entidades no 1º mês de uso**.

Projeto da disciplina Tópicos Especiais em Programação (TEC-1053), ADS IV, IFPI Campus Teresina Central, 2026/2.

---

## 1. Contexto e dor real

Os dados abaixo vêm da escuta de campo que a equipe realizou com pequenos mercados de Teresina (registrada nos Artefatos 01 a 04 de Extensão Curricular I, como orienta a Aula 08). Nenhum participante é identificado (LGPD): os respondentes aparecem apenas como "mercadinho 1" e "mercadinho 2".

| Achado | Fonte | O que mostra |
|---|---|---|
| O mercadinho 1 leva o alimento que sobra para casa e nunca tentou doar, embora saiba por redes sociais que existem lugares que aceitam doações. | Escuta por WhatsApp, 28/08/2026 (escuta de campo) | A falta de doação não vem de desconhecimento. |
| O mercadinho 1 só doaria com mais frequência se tivesse alto giro de vendas e desistiria por falta de retorno financeiro. | Mesma escuta | Doar precisa trazer algum retorno ao comerciante. |
| O mercadinho 2 doa alimentos perto de estragar a pessoas que vê na rua e coloca em promoção os produtos perto da validade. | Escuta relatada pela equipe, setembro/2026 (escuta de campo) | A doação já acontece, mas de forma informal e sem ligação com entidades. |

**Dor em uma frase:** pequenos estabelecimentos lidam com alimentos perto do vencimento de forma individual e improvisada, e esses alimentos não chegam de forma regular a quem mais precisa.

**Limite da evidência:** apenas 2 estabelecimentos foram ouvidos e nenhuma entidade receptora. Uma nova rodada de escuta com estabelecimentos está planejada para outubro de 2026.

## 2. Solução (MVP 1)

Um aplicativo web responsivo, pensado para o celular do caixa, com três partes:

1. **Caixa simples e gratuito** — cadastro de produtos com validade e registro de vendas com baixa no estoque. É o retorno concreto para o comerciante.
2. **Alerta de validade** — lista o que vence em até 3 dias para o comerciante decidir entre promoção e doação.
3. **Mural de doação** — o comerciante publica o alimento e entidades próximas combinam a retirada pelo WhatsApp.

**RF-CORE:** RF-04, publicar uma doação no mural para entidades. Se isso não funcionar, o produto não existe.

| RF | Nome | Ator |
|---|---|---|
| RF-01 | Cadastrar produto com validade | Comerciante |
| RF-02 | Registrar venda (caixa mínimo) | Comerciante |
| RF-03 | Listar produtos perto do vencimento | Comerciante |
| RF-04 | Publicar doação no mural (**RF-CORE**) | Comerciante |
| RF-05 | Ver doações próximas e contatar pelo WhatsApp | Entidade |

A especificação completa, com cenários BDD, está em [`ESPECIFICACAO-MVP.md`](ESPECIFICACAO-MVP.md). As regras para agentes de código estão em [`AGENTS.md`](AGENTS.md).

## 3. Lista proibida — fora do MVP 1

Estas ideias **não** serão implementadas na versão 1, mesmo que pareçam fáceis:

- Emissão de nota fiscal (NFC-e) ou qualquer integração com a SEFAZ.
- Pagamentos integrados (Pix, cartão, maquininha) e controle de troco.
- Leitor de código de barras, balança ou impressora de cupom.
- Relatórios financeiros, gráficos de vendas e fechamento de caixa.
- Cálculo automático de desconto ou preço promocional.
- Autocadastro de estabelecimentos e entidades (a equipe cadastra manualmente na v1).
- Chat interno entre comerciante e entidade (o contato é pelo WhatsApp).
- Mapa interativo, rotas, logística ou entrega de doações.
- Notificações push, modo offline e app nativo nas lojas.
- Avaliações, ranking ou selos para estabelecimentos e entidades.
- Mais de um usuário por estabelecimento e controle de fornecedores.
- Doação de alimento vencido ou estragado, inclusive para compostagem ou ração.

## 4. Alinhamento aos editais

| Edital | Encaixe | Justificativa |
|---|---|---|
| 🏢 **IdeiaLab 2026 (IFPI Central)** — alvo principal | Alto | Impacto direto em pequenos mercados e entidades da comunidade de Teresina, nascido da escuta de extensão. |
| 🚀 **Sebrae Supernova** | Médio | O caixa gratuito pode evoluir para um modelo freemium para pequenos varejistas; a escalabilidade ainda não foi validada. |
| 📱 **15º Campus Mobile (até 18/10/2026)** | Parcial | O mural usa o GPS do celular para mostrar doações próximas (RF-05). O edital exige uso indispensável do mobile, e o modo offline e a câmera ficaram fora do MVP 1. A equipe decidirá até 10/10/2026 se submete. |

## 5. Stack tecnológica inicial

- **Front-end:** Nuxt 4 (Vue 3), mobile-first, instalável como PWA.
- **Back-end e banco:** Supabase (PostgreSQL + Auth + Row Level Security).
- **Hospedagem:** Vercel (front-end) e Supabase Cloud (plano gratuito).
- **Testes:** Vitest para regras de negócio e roteiros manuais BDD para as telas.

## 6. Como rodar localmente

```bash
git clone https://github.com/SEU-USUARIO/elo-alimentar.git
cd elo-alimentar
cp .env.example .env.local   # preencha com as chaves do seu projeto Supabase
npm install
npm run smoke   # testa o cadastro de produto (RF-01) no Supabase
```

## 7. Equipe

| Integrante | Papel principal |
|---|---|
| Renato de Paiva Belarmino (líder) | Back-end, banco de dados e integrações |
| Alisson Gabriel do Nascimento | Front-end, interface e experiência do usuário |
| Luiz Felipe de Lima | Documentação, especificação e artefatos |

## 8. Licença

MIT.
