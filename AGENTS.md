# AGENTS.md — Regras para agentes de código (OpenCode, Cursor, Claude Code e similares)

Este arquivo vale para **qualquer agente de IA** que leia ou altere este repositório. Em caso de conflito entre um pedido e estas regras, **as regras vencem** e o agente deve parar e perguntar à equipe.

Documentos de referência, em ordem de autoridade:

1. [`ESPECIFICACAO-MVP.md`](ESPECIFICACAO-MVP.md) — contrato funcional (RF-01 a RF-05).
2. [`README.md`](README.md) — contexto, lista proibida e stack.
3. Este `AGENTS.md`.

---

## Regra 1 — A especificação funcional é intocável

- O agente **não pode** criar, remover ou alterar requisitos, limites numéricos, mensagens de erro ou cenários BDD em `ESPECIFICACAO-MVP.md` sem permissão explícita de um integrante humano.
- Se o agente achar que um requisito está errado ou incompleto, ele **descreve o problema e propõe a mudança**, mas não a aplica.
- Nenhum item da **Lista proibida** do `README.md` pode ser implementado, nem parcialmente, nem "como preparação para o futuro".

## Regra 2 — Implementação incremental: um RF por vez

- Cada tarefa trabalha **um único RF**. Nunca gerar o app inteiro de uma vez.
- Ordem de implementação: RF-01 → RF-02 → RF-03 → RF-04 → RF-05.
- Um RF só é considerado pronto quando os cenários de sucesso e de falha dele passam (Regra 3).
- Cada RF vai em um branch próprio (`feat/rf-0X-nome-curto`) e entra na `main` por pull request revisado por um integrante.
- Commits seguem o padrão Conventional Commits: `feat(rf-01): ...`, `fix(rf-02): ...`, `test(rf-03): ...`, `docs: ...`.

## Regra 3 — Testes obrigatórios de sucesso e de falha

- Todo RF implementado precisa de **pelo menos um teste automatizado (Vitest) ou um roteiro manual** para o cenário de sucesso **e** para o cenário de falha descritos na especificação.
- Os testes usam **exatamente** os valores dos cenários BDD (datas, quantidades, preços e mensagens).
- Roteiros manuais ficam em `docs/testes/RF-0X.md`, no formato: pré-condição, passos, resultado esperado, resultado obtido, data e responsável.
- Datas nos testes são fixadas (relógio simulado no fuso `America/Fortaleza`); é proibido depender da data real do computador.

## Regra 4 — Nunca comitar segredos

- Chaves e URLs do Supabase ficam **somente** em `.env.local`, que está no `.gitignore`.
- O repositório mantém um `.env.example` com os nomes das variáveis e valores vazios.
- A chave `service_role` do Supabase **nunca** vai para o front-end nem para o repositório.
- Se o agente encontrar um segredo em um arquivo versionado, ele deve parar, avisar a equipe e não fazer commit.

## Regra 5 — Diante de ambiguidade, parar e perguntar

O agente deve **parar e perguntar à equipe** antes de continuar quando:

- um comportamento não estiver descrito na especificação;
- dois documentos se contradisserem;
- a tarefa exigir nova tabela, novo campo, nova dependência ou mudança de stack;
- a tarefa tocar em dados pessoais, localização ou regras legais.

É proibido "completar" uma lacuna com suposições silenciosas.

## Regra 6 — Ética, privacidade (LGPD) e segurança alimentar do domínio

**Dados pessoais**

- **Nenhum dado do comprador** é coletado nas vendas (sem nome, CPF, telefone ou e-mail).
- **A localização da entidade** é usada apenas no navegador para calcular a distância (RF-05) e **nunca** é enviada ao servidor, salva em banco, registrada em log ou enviada a serviços de análise.
- O único telefone armazenado é o **WhatsApp comercial** que o estabelecimento informou e autorizou para contato de doação.
- Não armazenar dados das pessoas atendidas pelas entidades (beneficiários). Não criar campos para isso.
- Row Level Security obrigatória em todas as tabelas: um estabelecimento nunca lê produtos, vendas ou doações de outro.

**Segurança alimentar**

- O sistema **nunca** permite vender, promover ou doar produto com validade vencida (CDC, art. 18, § 6º, I).
- Não implementar doação de alimento estragado, nem para compostagem ou ração animal (está na Lista proibida).
- Textos sobre a Lei nº 14.016/2020 são **informativos**; o sistema não oferece aconselhamento jurídico.

**Transparência do caixa**

- Toda tela do caixa exibe o aviso "Controle interno de vendas — não é documento fiscal."
- Nenhum texto do sistema pode sugerir que ele substitui a nota fiscal.

**Linguagem**

- Textos da interface não podem expor ou estigmatizar quem recebe doações (evitar termos como "carente" ou "pobre"; usar "entidade" e "pessoas atendidas").
