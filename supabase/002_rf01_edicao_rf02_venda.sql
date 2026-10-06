-- =====================================================================
-- Elo Alimentar · Migração 002
-- (a) RF-01, regra 3: edição de produto com a mesma validação do cadastro
-- (b) RF-02: função registrar_venda (venda atômica com baixa de estoque)
-- Script idempotente: pode ser executado mais de uma vez no SQL Editor.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.validar_edicao_produto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    hoje DATE := (now() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
    IF NEW.data_validade IS DISTINCT FROM OLD.data_validade THEN
        IF NEW.data_validade < hoje THEN
            RAISE EXCEPTION 'Produto vencido não pode ser cadastrado para venda nem para doação.'
                USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.data_validade > hoje + 730 THEN
            RAISE EXCEPTION 'A validade não pode passar de 2 anos a partir de hoje.'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    NEW.nome := btrim(NEW.nome);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_edicao_produto ON public.produtos;
CREATE TRIGGER trg_validar_edicao_produto
    BEFORE UPDATE ON public.produtos
    FOR EACH ROW EXECUTE FUNCTION public.validar_edicao_produto();

-- Política de UPDATE TRANSITÓRIA (pública até a autenticação; depois auth.uid()).
-- Sem ela, PATCH e a baixa de estoque afetam 0 linhas e a API responde "sucesso".
DROP POLICY IF EXISTS "Permitir atualizacao publica" ON public.produtos;
CREATE POLICY "Permitir atualizacao publica" ON public.produtos
    FOR UPDATE USING (true) WITH CHECK (true);

-- RF-02 · registrar_venda(itens jsonb). SECURITY INVOKER: o RLS continua valendo.
-- DECISÃO PENDENTE: arredondamento por item (meio para cima); a spec não diz se é por item ou na soma.
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

    INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_centavos)
    SELECT v_venda, l.produto_id, l.quantidade, l.preco_centavos
      FROM jsonb_to_recordset(linhas)
           AS l(produto_id uuid, quantidade numeric, preco_centavos integer);

    PERFORM set_config('response.status', '201', true);
    PERFORM set_config('response.headers',
        json_build_array(json_build_object('Location', '/vendas?id=eq.' || v_venda))::text, true);

    RETURN jsonb_build_object('venda_id', v_venda, 'total_centavos', v_total, 'itens', linhas);
END;
$$;

COMMENT ON FUNCTION public.registrar_venda(jsonb)
    IS 'RF-02: venda atômica. Falha de regra = exceção check_violation (HTTP 400) e nada é gravado.';
