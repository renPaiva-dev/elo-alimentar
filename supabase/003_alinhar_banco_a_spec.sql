-- =====================================================================
-- Elo Alimentar · Migração 003 · Alinha o banco aplicado no Supabase à spec
-- O banco em nuvem foi criado com um DDL diferente de 001_produtos_vendas.sql
-- (constraints chk_*, itens_venda.subtotal_centavos, sem gatilho de cadastro).
-- Esta migração corrige as divergências sem apagar dados.
-- Script idempotente: pode ser executado mais de uma vez no SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Validade: sai a CHECK com now(), entra o gatilho de cadastro (RF-01, regra 1).
--    A CHECK era reavaliada em todo UPDATE (um produto que vence passava a
--    recusar qualquer edição) e devolvia mensagem técnica em vez da mensagem da spec.
-- ---------------------------------------------------------------------
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS chk_produtos_validade;

CREATE OR REPLACE FUNCTION public.validar_cadastro_produto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    hoje DATE := (now() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
    IF NEW.data_validade < hoje THEN
        RAISE EXCEPTION 'Produto vencido não pode ser cadastrado para venda nem para doação.'
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.data_validade > hoje + 730 THEN
        RAISE EXCEPTION 'A validade não pode passar de 2 anos a partir de hoje.'
            USING ERRCODE = 'check_violation';
    END IF;
    -- No cadastro a quantidade mínima é 1 (un) ou 0,1 (kg/L); depois o estoque pode chegar a 0.
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

-- ---------------------------------------------------------------------
-- 2. Quantidade: o estoque precisa poder chegar a 0 depois de vendas e doações
--    (RF-02 e RF-04). O mínimo do cadastro fica no gatilho acima.
-- ---------------------------------------------------------------------
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS chk_produtos_quantidade_regras;
ALTER TABLE public.produtos ADD CONSTRAINT chk_produtos_quantidade_regras CHECK (
    (unidade = 'un' AND quantidade BETWEEN 0 AND 9999 AND quantidade = trunc(quantidade))
    OR (unidade IN ('kg', 'L') AND quantidade BETWEEN 0 AND 999.9 AND quantidade = round(quantidade, 1))
);

-- ---------------------------------------------------------------------
-- 3. itens_venda.preco_centavos (spec, seção 2): preço no momento da venda.
--    subtotal_centavos é mantida e continua preenchida. Funciona tanto no banco
--    em nuvem (só tinha subtotal) quanto num banco novo criado pela 001 (só tem preço).
-- ---------------------------------------------------------------------
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS preco_centavos INTEGER;
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS subtotal_centavos INTEGER;
UPDATE public.itens_venda
   SET preco_centavos = round(subtotal_centavos / quantidade)::integer
 WHERE preco_centavos IS NULL;
UPDATE public.itens_venda
   SET subtotal_centavos = round(quantidade * preco_centavos)::integer
 WHERE subtotal_centavos IS NULL;
ALTER TABLE public.itens_venda ALTER COLUMN preco_centavos SET NOT NULL;
ALTER TABLE public.itens_venda ALTER COLUMN subtotal_centavos SET NOT NULL;
ALTER TABLE public.itens_venda DROP CONSTRAINT IF EXISTS chk_itens_venda_preco;
ALTER TABLE public.itens_venda ADD CONSTRAINT chk_itens_venda_preco CHECK (preco_centavos > 0);

-- ---------------------------------------------------------------------
-- 4. Política de DELETE TRANSITÓRIA (RF-01, regra 5 da spec v1.1).
--    Pública até a autenticação (Aula 11); depois passa a usar auth.uid().
--    Produto com vendas continua protegido pela FK de itens_venda (erro 23503 → HTTP 409).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Permitir exclusao publica" ON public.produtos;
CREATE POLICY "Permitir exclusao publica" ON public.produtos
    FOR DELETE USING (true);

-- ---------------------------------------------------------------------
-- 5. RF-02 · registrar_venda: grava preco_centavos e subtotal_centavos.
--    O status 201 e o header Location agora são responsabilidade da API Express
--    (POST /api/v1/vendas), por isso a função não mexe mais em response.*.
--    DECISÃO PENDENTE: arredondamento por item (meio para cima) ou na soma.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_venda(itens jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    hoje      DATE := (now() AT TIME ZONE 'America/Fortaleza')::date;
    item      jsonb;
    prod      public.produtos%ROWTYPE;
    qtd       NUMERIC;
    subtotal  INTEGER;
    v_total   INTEGER := 0;
    v_venda   UUID;
    linhas    jsonb := '[]'::jsonb;
BEGIN
    IF jsonb_typeof(itens) IS DISTINCT FROM 'array'
       OR jsonb_array_length(itens) NOT BETWEEN 1 AND 30 THEN
        RAISE EXCEPTION 'Informe de 1 a 30 itens na venda.' USING ERRCODE = 'check_violation';
    END IF;

    FOR item IN SELECT * FROM jsonb_array_elements(itens) LOOP
        qtd := (item->>'quantidade')::numeric;
        IF qtd IS NULL OR qtd <= 0 THEN
            RAISE EXCEPTION 'A quantidade deve ser maior que zero.' USING ERRCODE = 'check_violation';
        END IF;

        SELECT * INTO prod FROM public.produtos
         WHERE id = (item->>'produto_id')::uuid FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produto não encontrado.' USING ERRCODE = 'check_violation';
        END IF;

        IF prod.data_validade < hoje THEN
            RAISE EXCEPTION 'Produto vencido não pode ser vendido: %.', prod.nome
                USING ERRCODE = 'check_violation';
        END IF;
        IF prod.unidade = 'un' AND qtd <> trunc(qtd) THEN
            RAISE EXCEPTION 'Para "un", informe um número inteiro.' USING ERRCODE = 'check_violation';
        END IF;
        IF prod.unidade <> 'un' AND qtd <> round(qtd, 1) THEN
            RAISE EXCEPTION 'Para kg ou L, use no máximo 1 casa decimal.' USING ERRCODE = 'check_violation';
        END IF;
        IF qtd > prod.quantidade THEN
            RAISE EXCEPTION 'Quantidade maior que o estoque disponível (% %).',
                trim_scale(prod.quantidade), prod.unidade USING ERRCODE = 'check_violation';
        END IF;

        subtotal := round(qtd * prod.preco_centavos)::integer;
        v_total  := v_total + subtotal;

        UPDATE public.produtos SET quantidade = quantidade - qtd WHERE id = prod.id;

        linhas := linhas || jsonb_build_object(
            'produto_id', prod.id, 'nome', prod.nome, 'quantidade', qtd,
            'preco_centavos', prod.preco_centavos, 'subtotal_centavos', subtotal);
    END LOOP;

    IF v_total <= 0 THEN
        RAISE EXCEPTION 'O total da venda deve ser maior que zero.' USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO public.vendas (total_centavos) VALUES (v_total) RETURNING id INTO v_venda;

    INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_centavos, subtotal_centavos)
    SELECT v_venda, l.produto_id, l.quantidade, l.preco_centavos, l.subtotal_centavos
      FROM jsonb_to_recordset(linhas)
           AS l(produto_id uuid, quantidade numeric, preco_centavos integer, subtotal_centavos integer);

    RETURN jsonb_build_object('venda_id', v_venda, 'total_centavos', v_total, 'itens', linhas);
END;
$$;

COMMENT ON FUNCTION public.registrar_venda(jsonb)
    IS 'RF-02: venda atômica. Falha de regra = exceção check_violation e nada é gravado.';
