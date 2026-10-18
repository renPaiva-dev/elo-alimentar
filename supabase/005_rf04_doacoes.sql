-- =====================================================================
-- Elo Alimentar · Migração 005 · RF-04 — Publicar doação no mural (RF-CORE)
-- Tabela doacoes, funções transacionais publicar_doacao e alterar_status_doacao
-- (baixa/devolução de estoque atômica — AGENTS.md, Regra 7) e a rotina que grava
-- o status `expirado` a cada 15 minutos (RF-04, regra 4).
-- Requer a migração 004. Script idempotente.
-- Códigos de erro próprios, traduzidos pela API: EL404 → HTTP 404, EL409 → HTTP 409.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.doacoes (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- Produto com doação registrada não pode ser excluído (histórico da métrica).
    produto_id          UUID          NOT NULL REFERENCES public.produtos (id),
    estabelecimento_id  UUID          NOT NULL DEFAULT public.meu_estabelecimento_id()
                                      REFERENCES public.estabelecimentos (id) ON DELETE CASCADE,
    quantidade          NUMERIC(5,1)  NOT NULL CONSTRAINT doacoes_quantidade_positiva CHECK (quantidade > 0),
    prazo_retirada      TIMESTAMPTZ   NOT NULL,
    observacao          VARCHAR(200)  NULL,
    -- RF-04, regra 4: ativo → retirado | cancelado | expirado.
    status              VARCHAR(9)    NOT NULL DEFAULT 'ativo'
        CONSTRAINT doacoes_status_valido CHECK (status IN ('ativo', 'retirado', 'cancelado', 'expirado')),
    retirado_em         TIMESTAMPTZ   NULL,
    CONSTRAINT doacoes_retirado_em CHECK ((status = 'retirado') = (retirado_em IS NOT NULL))
);

COMMENT ON TABLE public.doacoes IS 'RF-04: anúncios de doação. Métrica do pitch: status retirado nos primeiros 30 dias.';

CREATE INDEX IF NOT EXISTS idx_doacoes_estabelecimento ON public.doacoes (estabelecimento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doacoes_ativas ON public.doacoes (prazo_retirada) WHERE status = 'ativo';

-- ---------------------------------------------------------------------
-- RLS: o dono lê e altera as próprias doações; entidades leem só as ativas no prazo.
-- ---------------------------------------------------------------------
ALTER TABLE public.doacoes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'doacoes' LOOP
        EXECUTE format('DROP POLICY %I ON public.doacoes', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY doacoes_dono_le ON public.doacoes
    FOR SELECT TO authenticated USING (estabelecimento_id = public.meu_estabelecimento_id());
CREATE POLICY doacoes_dono_cria ON public.doacoes
    FOR INSERT TO authenticated WITH CHECK (estabelecimento_id = public.meu_estabelecimento_id());
CREATE POLICY doacoes_dono_altera ON public.doacoes
    FOR UPDATE TO authenticated
    USING (estabelecimento_id = public.meu_estabelecimento_id())
    WITH CHECK (estabelecimento_id = public.meu_estabelecimento_id());
CREATE POLICY doacoes_entidade_le_ativas ON public.doacoes
    FOR SELECT TO authenticated
    USING (public.minha_entidade_id() IS NOT NULL AND status = 'ativo' AND prazo_retirada > now());

-- ---------------------------------------------------------------------
-- RF-04 · publicar_doacao. SECURITY INVOKER: o RLS garante que só o dono doa o próprio produto.
-- Tudo ou nada: a quantidade sai do estoque vendável na mesma transação (regra 3).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publicar_doacao(
    p_produto_id      UUID,
    p_quantidade      NUMERIC,
    p_prazo_retirada  TIMESTAMPTZ,
    p_observacao      TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    hoje      DATE := (now() AT TIME ZONE 'America/Fortaleza')::date;
    v_estab   public.estabelecimentos%ROWTYPE;
    prod      public.produtos%ROWTYPE;
    v_obs     TEXT := nullif(btrim(coalesce(p_observacao, '')), '');
    v_ativos  INTEGER;
    v_doacao  public.doacoes%ROWTYPE;
BEGIN
    SELECT * INTO v_estab FROM public.estabelecimentos WHERE id = public.meu_estabelecimento_id();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Esta ação é só para comerciantes.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Regra 2: WhatsApp comercial válido (55 + DDD + 9 dígitos).
    IF v_estab.whatsapp_comercial IS NULL OR v_estab.whatsapp_comercial !~ '^55[0-9]{11}$' THEN
        RAISE EXCEPTION 'Cadastre o WhatsApp comercial do estabelecimento para publicar doações. Fale com a equipe Elo Alimentar.'
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO prod FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto não encontrado.' USING ERRCODE = 'check_violation';
    END IF;

    -- Regra 1: produto vencido não pode ser doado (CDC, art. 18, § 6º, I).
    IF prod.data_validade < hoje THEN
        RAISE EXCEPTION 'Produto vencido não pode ser doado.' USING ERRCODE = 'check_violation';
    END IF;

    IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
        RAISE EXCEPTION 'A quantidade doada deve ser maior que zero.' USING ERRCODE = 'check_violation';
    END IF;
    IF prod.unidade = 'un' AND p_quantidade <> trunc(p_quantidade) THEN
        RAISE EXCEPTION 'Para "un", informe um número inteiro.' USING ERRCODE = 'check_violation';
    END IF;
    IF prod.unidade <> 'un' AND p_quantidade <> round(p_quantidade, 1) THEN
        RAISE EXCEPTION 'Para kg ou L, use no máximo 1 casa decimal.' USING ERRCODE = 'check_violation';
    END IF;
    IF p_quantidade > prod.quantidade THEN
        RAISE EXCEPTION 'Quantidade maior que o estoque disponível (% %).',
            trim_scale(prod.quantidade), prod.unidade USING ERRCODE = 'check_violation';
    END IF;

    -- Prazo de retirada: de agora + 30 min a agora + 72 h, nunca depois de 23:59 do dia da validade.
    IF p_prazo_retirada IS NULL THEN
        RAISE EXCEPTION 'Informe o prazo de retirada.' USING ERRCODE = 'check_violation';
    END IF;
    IF p_prazo_retirada > ((prod.data_validade + TIME '23:59') AT TIME ZONE 'America/Fortaleza') THEN
        RAISE EXCEPTION 'O prazo de retirada não pode passar da validade do produto (%).',
            to_char(prod.data_validade, 'DD/MM/YYYY') USING ERRCODE = 'check_violation';
    END IF;
    IF p_prazo_retirada < now() + INTERVAL '30 minutes' THEN
        RAISE EXCEPTION 'O prazo de retirada deve ser de pelo menos 30 minutos a partir de agora.'
            USING ERRCODE = 'check_violation';
    END IF;
    IF p_prazo_retirada > now() + INTERVAL '72 hours' THEN
        RAISE EXCEPTION 'O prazo de retirada deve ser de no máximo 72 horas a partir de agora.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF char_length(coalesce(v_obs, '')) > 200 THEN
        RAISE EXCEPTION 'A observação pode ter no máximo 200 caracteres.' USING ERRCODE = 'check_violation';
    END IF;

    -- Regra 5: no máximo 20 anúncios ativos. O lock serializa publicações do mesmo estabelecimento.
    PERFORM pg_advisory_xact_lock(hashtext('elo-doacoes-' || v_estab.id::text));
    SELECT count(*) INTO v_ativos FROM public.doacoes
     WHERE estabelecimento_id = v_estab.id AND status = 'ativo' AND prazo_retirada > now();
    IF v_ativos >= 20 THEN
        RAISE EXCEPTION 'Limite de 20 doações ativas atingido. Marque uma como retirada ou cancele antes de publicar outra.'
            USING ERRCODE = 'EL409';
    END IF;

    UPDATE public.produtos SET quantidade = quantidade - p_quantidade WHERE id = prod.id;

    INSERT INTO public.doacoes (produto_id, estabelecimento_id, quantidade, prazo_retirada, observacao)
    VALUES (prod.id, v_estab.id, p_quantidade, p_prazo_retirada, v_obs)
    RETURNING * INTO v_doacao;

    RETURN to_jsonb(v_doacao) || jsonb_build_object('produto', jsonb_build_object(
        'nome', prod.nome, 'unidade', prod.unidade, 'data_validade', prod.data_validade));
END;
$$;

COMMENT ON FUNCTION public.publicar_doacao(UUID, NUMERIC, TIMESTAMPTZ, TEXT)
    IS 'RF-04: publica a doação e baixa o estoque vendável na mesma transação.';

-- ---------------------------------------------------------------------
-- RF-04, regra 4 · ativo → retirado | cancelado.
-- Cancelar devolve a quantidade ao estoque se o produto ainda não venceu.
-- Doação com prazo vencido já é tratada como expirada e não pode mudar.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alterar_status_doacao(p_doacao_id UUID, p_status TEXT)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    hoje     DATE := (now() AT TIME ZONE 'America/Fortaleza')::date;
    v        public.doacoes%ROWTYPE;
    prod     public.produtos%ROWTYPE;
    v_atual  TEXT;
BEGIN
    IF p_status IS NULL OR p_status NOT IN ('retirado', 'cancelado') THEN
        RAISE EXCEPTION 'Use status "retirado" ou "cancelado".' USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v FROM public.doacoes
     WHERE id = p_doacao_id AND estabelecimento_id = public.meu_estabelecimento_id()
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Doação não encontrada.' USING ERRCODE = 'EL404';
    END IF;

    v_atual := CASE WHEN v.status = 'ativo' AND v.prazo_retirada <= now() THEN 'expirado' ELSE v.status END;
    IF v_atual <> 'ativo' THEN
        RAISE EXCEPTION 'Só é possível alterar uma doação ativa. Esta doação está com status "%".', v_atual
            USING ERRCODE = 'EL409';
    END IF;

    IF p_status = 'retirado' THEN
        UPDATE public.doacoes SET status = 'retirado', retirado_em = now()
         WHERE id = v.id RETURNING * INTO v;
    ELSE
        UPDATE public.doacoes SET status = 'cancelado' WHERE id = v.id RETURNING * INTO v;
        SELECT * INTO prod FROM public.produtos WHERE id = v.produto_id FOR UPDATE;
        IF FOUND AND prod.data_validade >= hoje THEN
            UPDATE public.produtos SET quantidade = quantidade + v.quantidade WHERE id = prod.id;
        END IF;
    END IF;

    RETURN to_jsonb(v);
END;
$$;

COMMENT ON FUNCTION public.alterar_status_doacao(UUID, TEXT)
    IS 'RF-04: marca como retirado ou cancela (devolvendo ao estoque se não venceu).';

-- ---------------------------------------------------------------------
-- RF-04, regra 4 · grava `expirado` quando o prazo passa (a quantidade NÃO volta ao estoque).
-- Roda como dono da função (sem RLS); ninguém além do agendador pode chamá-la.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expirar_doacoes()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH alteradas AS (
        UPDATE public.doacoes SET status = 'expirado'
         WHERE status = 'ativo' AND prazo_retirada <= now()
        RETURNING 1
    )
    SELECT count(*)::integer FROM alteradas;
$$;

REVOKE ALL ON FUNCTION public.expirar_doacoes() FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.expirar_doacoes() FROM anon, authenticated';
    END IF;
END $$;

-- Agendamento a cada 15 minutos com pg_cron. Se a extensão não estiver disponível,
-- ative em Database > Extensions > pg_cron e rode este bloco de novo. Enquanto isso,
-- a API e as telas já tratam como expirado todo anúncio com prazo_retirada <= agora.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'elo-expirar-doacoes';
    PERFORM cron.schedule('elo-expirar-doacoes', '*/15 * * * *', 'SELECT public.expirar_doacoes()');
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron indisponível (%). Ative a extensão e rode este bloco de novo.', SQLERRM;
END $$;
