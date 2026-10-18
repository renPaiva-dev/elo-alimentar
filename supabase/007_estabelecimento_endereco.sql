-- =====================================================================
-- Elo Alimentar · Migração 007 · "Meu estabelecimento" e endereço de retirada
-- Spec v1.2 (aprovada pelo líder em 18/10/2026):
-- (a) estabelecimentos.endereco e a função atualizar_meu_estabelecimento: o próprio
--     comerciante corrige nome, bairro, endereço, WhatsApp e a localização da loja.
-- (b) doacoes.local_retirada: local diferente da loja, opcional, por doação.
-- (c) publicar_doacao exige um endereço de retirada (da loja ou da doação).
-- (d) listar_mural devolve o endereço de retirada para o card da entidade.
-- Requer as migrações 004 a 006. Script idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (a) Endereço da loja e edição pelo próprio comerciante
-- ---------------------------------------------------------------------
ALTER TABLE public.estabelecimentos ADD COLUMN IF NOT EXISTS endereco VARCHAR(150) NULL;
ALTER TABLE public.estabelecimentos DROP CONSTRAINT IF EXISTS estabelecimentos_endereco_tamanho;
ALTER TABLE public.estabelecimentos ADD CONSTRAINT estabelecimentos_endereco_tamanho
    CHECK (endereco IS NULL OR char_length(btrim(endereco)) BETWEEN 5 AND 150);

-- SECURITY DEFINER: o comerciante altera só a própria linha e só estes campos
-- (user_id e id ficam fora do alcance). Campo NULL no parâmetro = não mexe.
-- Para apagar a localização, envie p_limpar_localizacao = true.
DROP FUNCTION IF EXISTS public.atualizar_meu_estabelecimento(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN);
CREATE FUNCTION public.atualizar_meu_estabelecimento(
    p_nome_fantasia       TEXT    DEFAULT NULL,
    p_bairro              TEXT    DEFAULT NULL,
    p_endereco            TEXT    DEFAULT NULL,
    p_whatsapp_comercial  TEXT    DEFAULT NULL,
    p_latitude            NUMERIC DEFAULT NULL,
    p_longitude           NUMERIC DEFAULT NULL,
    p_limpar_localizacao  BOOLEAN DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id  UUID := public.meu_estabelecimento_id();
    v     public.estabelecimentos%ROWTYPE;
BEGIN
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Esta ação é só para comerciantes.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF p_nome_fantasia IS NOT NULL AND char_length(btrim(p_nome_fantasia)) NOT BETWEEN 2 AND 80 THEN
        RAISE EXCEPTION 'O nome do estabelecimento deve ter de 2 a 80 caracteres.' USING ERRCODE = 'check_violation';
    END IF;
    IF p_bairro IS NOT NULL AND char_length(btrim(p_bairro)) NOT BETWEEN 2 AND 60 THEN
        RAISE EXCEPTION 'O bairro deve ter de 2 a 60 caracteres.' USING ERRCODE = 'check_violation';
    END IF;
    IF p_endereco IS NOT NULL AND char_length(btrim(p_endereco)) NOT BETWEEN 5 AND 150 THEN
        RAISE EXCEPTION 'O endereço deve ter de 5 a 150 caracteres.' USING ERRCODE = 'check_violation';
    END IF;
    IF p_whatsapp_comercial IS NOT NULL AND p_whatsapp_comercial !~ '^55[0-9]{11}$' THEN
        RAISE EXCEPTION 'WhatsApp inválido. Use DDD + número com 9 dígitos, por exemplo (86) 99999-0001.'
            USING ERRCODE = 'check_violation';
    END IF;
    IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
        RAISE EXCEPTION 'Informe latitude e longitude juntas.' USING ERRCODE = 'check_violation';
    END IF;
    IF p_latitude IS NOT NULL AND (p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180) THEN
        RAISE EXCEPTION 'Localização inválida.' USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.estabelecimentos SET
        nome_fantasia      = coalesce(btrim(p_nome_fantasia), nome_fantasia),
        bairro             = coalesce(btrim(p_bairro), bairro),
        endereco           = coalesce(btrim(p_endereco), endereco),
        whatsapp_comercial = coalesce(p_whatsapp_comercial, whatsapp_comercial),
        latitude           = CASE WHEN p_limpar_localizacao THEN NULL ELSE coalesce(round(p_latitude, 6), latitude) END,
        longitude          = CASE WHEN p_limpar_localizacao THEN NULL ELSE coalesce(round(p_longitude, 6), longitude) END
     WHERE id = v_id
    RETURNING * INTO v;

    RETURN jsonb_build_object(
        'tipo', 'comerciante', 'id', v.id, 'nome', v.nome_fantasia, 'bairro', v.bairro,
        'endereco', v.endereco, 'whatsapp_comercial', v.whatsapp_comercial,
        'latitude', v.latitude, 'longitude', v.longitude);
END;
$$;

COMMENT ON FUNCTION public.atualizar_meu_estabelecimento(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN)
    IS 'Spec v1.2: o comerciante corrige os dados da própria loja (nome, bairro, endereço, WhatsApp, localização).';

REVOKE ALL ON FUNCTION public.atualizar_meu_estabelecimento(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.atualizar_meu_estabelecimento(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) FROM anon';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.atualizar_meu_estabelecimento(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- (b) Local de retirada por doação (opcional; vazio = endereço da loja)
-- ---------------------------------------------------------------------
ALTER TABLE public.doacoes ADD COLUMN IF NOT EXISTS local_retirada VARCHAR(150) NULL;

-- ---------------------------------------------------------------------
-- (c) publicar_doacao com p_local_retirada. A assinatura muda, então a antiga sai.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.publicar_doacao(UUID, NUMERIC, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.publicar_doacao(UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT);
CREATE FUNCTION public.publicar_doacao(
    p_produto_id      UUID,
    p_quantidade      NUMERIC,
    p_prazo_retirada  TIMESTAMPTZ,
    p_observacao      TEXT DEFAULT NULL,
    p_local_retirada  TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    hoje      DATE := (now() AT TIME ZONE 'America/Fortaleza')::date;
    v_estab   public.estabelecimentos%ROWTYPE;
    prod      public.produtos%ROWTYPE;
    v_obs     TEXT := nullif(btrim(coalesce(p_observacao, '')), '');
    v_local   TEXT := nullif(btrim(coalesce(p_local_retirada, '')), '');
    v_ativos  INTEGER;
    v_doacao  public.doacoes%ROWTYPE;
BEGIN
    SELECT * INTO v_estab FROM public.estabelecimentos WHERE id = public.meu_estabelecimento_id();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Esta ação é só para comerciantes.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Regra 2: WhatsApp comercial válido (55 + DDD + 9 dígitos).
    IF v_estab.whatsapp_comercial IS NULL OR v_estab.whatsapp_comercial !~ '^55[0-9]{11}$' THEN
        RAISE EXCEPTION 'Cadastre o WhatsApp comercial em "Meu estabelecimento" para publicar doações.'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Spec v1.2: a entidade precisa saber onde buscar.
    IF v_local IS NOT NULL AND char_length(v_local) NOT BETWEEN 5 AND 150 THEN
        RAISE EXCEPTION 'O local de retirada deve ter de 5 a 150 caracteres.' USING ERRCODE = 'check_violation';
    END IF;
    IF v_local IS NULL AND v_estab.endereco IS NULL THEN
        RAISE EXCEPTION 'Informe o local de retirada ou cadastre o endereço em "Meu estabelecimento".'
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

    INSERT INTO public.doacoes (produto_id, estabelecimento_id, quantidade, prazo_retirada, observacao, local_retirada)
    VALUES (prod.id, v_estab.id, p_quantidade, p_prazo_retirada, v_obs, v_local)
    RETURNING * INTO v_doacao;

    RETURN to_jsonb(v_doacao) || jsonb_build_object('produto', jsonb_build_object(
        'nome', prod.nome, 'unidade', prod.unidade, 'data_validade', prod.data_validade));
END;
$$;

COMMENT ON FUNCTION public.publicar_doacao(UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT)
    IS 'RF-04 (spec v1.2): publica a doação com local de retirada e baixa o estoque vendável na mesma transação.';

-- ---------------------------------------------------------------------
-- (d) Mural com o endereço de retirada (da doação ou, se vazio, da loja)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.listar_mural(TEXT);
CREATE FUNCTION public.listar_mural(p_bairro TEXT DEFAULT NULL)
RETURNS TABLE (
    doacao_id            UUID,
    quantidade           NUMERIC,
    prazo_retirada       TIMESTAMPTZ,
    observacao           VARCHAR,
    produto_nome         VARCHAR,
    unidade              VARCHAR,
    estabelecimento_nome VARCHAR,
    bairro               VARCHAR,
    endereco_retirada    VARCHAR,
    retirada_na_loja     BOOLEAN,
    latitude             NUMERIC,
    longitude            NUMERIC,
    whatsapp_comercial   VARCHAR
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.minha_entidade_id() IS NULL THEN
        RAISE EXCEPTION 'Esta ação é só para entidades.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN QUERY
    SELECT d.id, d.quantidade, d.prazo_retirada, d.observacao,
           p.nome, p.unidade,
           e.nome_fantasia, e.bairro,
           coalesce(d.local_retirada, e.endereco)::VARCHAR, d.local_retirada IS NULL,
           e.latitude, e.longitude, e.whatsapp_comercial
      FROM public.doacoes d
      JOIN public.produtos p         ON p.id = d.produto_id
      JOIN public.estabelecimentos e ON e.id = d.estabelecimento_id
     WHERE d.status = 'ativo'
       AND d.prazo_retirada > now()
       AND (p_bairro IS NULL OR e.bairro = p_bairro)
     ORDER BY d.prazo_retirada, d.created_at;
END;
$$;

COMMENT ON FUNCTION public.listar_mural(TEXT)
    IS 'RF-05 (spec v1.2): anúncios ativos com endereço de retirada. Distância e filtro de 5 km são feitos no navegador.';

REVOKE ALL ON FUNCTION public.listar_mural(TEXT) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.listar_mural(TEXT) TO authenticated';
    END IF;
END $$;
