-- =====================================================================
-- Elo Alimentar · Aula 09 (TEC-1053) · Migração 001
-- Tabelas do RF-01 (Cadastrar produto com validade) e do RF-02
-- (Registrar venda) conforme ESPECIFICACAO-MVP.md.
-- Script idempotente: pode ser executado mais de uma vez no SQL Editor.
-- =====================================================================
-- ATENÇÃO (06/10/2026): o banco em nuvem NÃO foi criado com este script, e sim
-- com uma versão gerada à parte (constraints chk_*, itens_venda.subtotal_centavos).
-- A migração 003_alinhar_banco_a_spec.sql corrige as divergências. Este arquivo
-- fica como registro da Aula 09; para um banco novo, rode 001, 002 e 003 em ordem.

-- ---------------------------------------------------------------------
-- 1. TABELA PRINCIPAL: produtos (RF-01)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produtos (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- Dono do produto. Fica opcional até a Aula 10 (autenticação);
    -- depois vira NOT NULL e é preenchido com o estabelecimento do usuário logado.
    estabelecimento_id UUID          NULL,
    -- RF-01: nome de 2 a 60 caracteres, sem contar espaços nas pontas.
    nome               VARCHAR(60)   NOT NULL
        CONSTRAINT produtos_nome_tamanho CHECK (char_length(btrim(nome)) BETWEEN 2 AND 60),
    -- PRINCÍPIO DO ORÁCULO: valor enumerado é validado pelo banco, não pela interface.
    unidade            VARCHAR(2)    NOT NULL
        CONSTRAINT produtos_unidade_valida CHECK (unidade IN ('un', 'kg', 'L')),
    -- Estoque atual. Pode chegar a 0 depois de vendas e doações (RF-02 e RF-04).
    -- 'un' só aceita inteiros; 'kg' e 'L' aceitam 1 casa decimal.
    quantidade         NUMERIC(5,1)  NOT NULL
        CONSTRAINT produtos_quantidade_faixa CHECK (quantidade BETWEEN 0 AND 9999),
    CONSTRAINT produtos_quantidade_por_unidade CHECK (
        (unidade = 'un' AND quantidade = trunc(quantidade))
        OR (unidade IN ('kg', 'L') AND quantidade <= 999.9)
    ),
    -- RF-01: preço de R$ 0,01 a R$ 9.999,99, guardado em centavos inteiros.
    preco_centavos     INTEGER       NOT NULL
        CONSTRAINT produtos_preco_faixa CHECK (preco_centavos BETWEEN 1 AND 999999),
    data_validade      DATE          NOT NULL
);

COMMENT ON TABLE public.produtos IS 'RF-01: produtos com validade cadastrados pelo comerciante.';

-- Regras que dependem da data de hoje (fuso America/Fortaleza) não podem ser
-- CHECK constraints, porque a data muda todo dia. Por isso usam um gatilho,
-- que roda só no momento do cadastro (INSERT).
CREATE OR REPLACE FUNCTION public.validar_cadastro_produto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    hoje DATE := (now() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
    -- RF-01, regra 1 (cenário de falha): produto vencido não pode ser cadastrado.
    IF NEW.data_validade < hoje THEN
        RAISE EXCEPTION 'Produto vencido não pode ser cadastrado para venda nem para doação.'
            USING ERRCODE = 'check_violation';
    END IF;
    -- RF-01: validade de no máximo hoje + 730 dias.
    IF NEW.data_validade > hoje + 730 THEN
        RAISE EXCEPTION 'A validade não pode passar de 2 anos a partir de hoje.'
            USING ERRCODE = 'check_violation';
    END IF;
    -- RF-01: no cadastro, a quantidade mínima é 1 (un) ou 0,1 (kg/L).
    IF NEW.quantidade <= 0 THEN
        RAISE EXCEPTION 'Informe uma quantidade maior que zero.'
            USING ERRCODE = 'check_violation';
    END IF;
    NEW.nome := btrim(NEW.nome);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_cadastro_produto ON public.produtos;
CREATE TRIGGER trg_validar_cadastro_produto
    BEFORE INSERT ON public.produtos
    FOR EACH ROW EXECUTE FUNCTION public.validar_cadastro_produto();

-- Acelera a consulta do RF-03 (produtos que vencem em até 3 dias).
CREATE INDEX IF NOT EXISTS idx_produtos_validade ON public.produtos (data_validade);

-- ---------------------------------------------------------------------
-- 2. TABELAS DE APOIO: vendas e itens_venda (RF-02)
--    Nenhum dado do comprador é armazenado (LGPD — AGENTS.md, Regra 6).
--    A baixa atômica de estoque será feita por uma função RPC na etapa do RF-02.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendas (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    estabelecimento_id UUID         NULL,
    total_centavos     INTEGER      NOT NULL
        CONSTRAINT vendas_total_positivo CHECK (total_centavos > 0)
);

CREATE TABLE IF NOT EXISTS public.itens_venda (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    venda_id        UUID          NOT NULL REFERENCES public.vendas (id) ON DELETE CASCADE,
    produto_id      UUID          NOT NULL REFERENCES public.produtos (id) ON DELETE RESTRICT,
    quantidade      NUMERIC(5,1)  NOT NULL
        CONSTRAINT itens_venda_quantidade_positiva CHECK (quantidade > 0),
    -- Preço no momento da venda (o preço do produto pode mudar depois).
    preco_centavos  INTEGER       NOT NULL
        CONSTRAINT itens_venda_preco_positivo CHECK (preco_centavos > 0)
);

CREATE INDEX IF NOT EXISTS idx_itens_venda_venda ON public.itens_venda (venda_id);

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
--    Fase inicial do MVP 1, sem autenticação: políticas públicas de INSERT e
--    SELECT, como orienta a Aula 09. Na Aula 10 elas serão trocadas por
--    políticas com auth.uid(), para cada estabelecimento ver só os próprios dados
--    (ESPECIFICACAO-MVP.md, seção 2).
-- ---------------------------------------------------------------------
ALTER TABLE public.produtos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir insercao publica anonima" ON public.produtos;
CREATE POLICY "Permitir insercao publica anonima" ON public.produtos FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir leitura publica" ON public.produtos;
CREATE POLICY "Permitir leitura publica" ON public.produtos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao publica anonima" ON public.vendas;
CREATE POLICY "Permitir insercao publica anonima" ON public.vendas FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir leitura publica" ON public.vendas;
CREATE POLICY "Permitir leitura publica" ON public.vendas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao publica anonima" ON public.itens_venda;
CREATE POLICY "Permitir insercao publica anonima" ON public.itens_venda FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir leitura publica" ON public.itens_venda;
CREATE POLICY "Permitir leitura publica" ON public.itens_venda FOR SELECT USING (true);

-- ---------------------------------------------------------------------
-- 4. DADOS DE DEMONSTRAÇÃO (SEED)
--    Produtos fictícios de um mercadinho, com validade relativa à data de hoje
--    para o seed nunca cair no bloqueio de produto vencido.
--    Só insere se a tabela estiver vazia (mantém o script idempotente).
-- ---------------------------------------------------------------------
INSERT INTO public.produtos (nome, unidade, quantidade, preco_centavos, data_validade)
SELECT v.nome, v.unidade, v.quantidade, v.preco_centavos,
       (now() AT TIME ZONE 'America/Fortaleza')::date + v.dias
FROM (VALUES
    ('Iogurte natural (seed)', 'un', 6::numeric,   350, 2),
    ('Banana prata (seed)',    'kg', 2.5::numeric, 650, 4)
) AS v(nome, unidade, quantidade, preco_centavos, dias)
WHERE NOT EXISTS (SELECT 1 FROM public.produtos);
