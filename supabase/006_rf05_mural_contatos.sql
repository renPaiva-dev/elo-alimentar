-- =====================================================================
-- Elo Alimentar · Migração 006 · RF-05 — Ver doações próximas e contatar pelo WhatsApp
-- (a) listar_mural: o que a entidade vê de cada anúncio ativo (produto, quantidade,
--     prazo, estabelecimento, bairro, coordenadas e WhatsApp comercial), sem abrir
--     as tabelas produtos e estabelecimentos para as entidades.
-- (b) contatos: cada toque em "Conversar no WhatsApp" registra 1 linha (regra 6).
-- A localização da ENTIDADE nunca chega ao banco: a distância é calculada no
-- navegador (regra 4). Requer as migrações 004 e 005. Script idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (a) Mural (regras 1, 3 e 7): só entidades autenticadas; só anúncios ativos no prazo.
--     SECURITY DEFINER para devolver só estas colunas de produtos e estabelecimentos.
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
           e.nome_fantasia, e.bairro, e.latitude, e.longitude, e.whatsapp_comercial
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
    IS 'RF-05: anúncios ativos para entidades. Distância e filtro de 5 km são feitos no navegador.';

REVOKE ALL ON FUNCTION public.listar_mural(TEXT) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.listar_mural(TEXT) TO authenticated';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- (b) Contatos (regra 6 e métrica). Nenhum dado pessoal: só a doação, a entidade e a hora.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contatos (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    doacao_id    UUID         NOT NULL REFERENCES public.doacoes (id) ON DELETE CASCADE,
    entidade_id  UUID         NOT NULL DEFAULT public.minha_entidade_id()
                              REFERENCES public.entidades (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contatos_doacao ON public.contatos (doacao_id);

ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contatos' LOOP
        EXECUTE format('DROP POLICY %I ON public.contatos', pol.policyname);
    END LOOP;
END $$;

-- A entidade cria o próprio contato, só para doação ativa e no prazo.
CREATE POLICY contatos_entidade_cria ON public.contatos
    FOR INSERT TO authenticated
    WITH CHECK (
        entidade_id = public.minha_entidade_id()
        AND EXISTS (SELECT 1 FROM public.doacoes d
                     WHERE d.id = contatos.doacao_id AND d.status = 'ativo' AND d.prazo_retirada > now())
    );
CREATE POLICY contatos_entidade_le ON public.contatos
    FOR SELECT TO authenticated USING (entidade_id = public.minha_entidade_id());
-- O estabelecimento dono da doação lê os contatos recebidos (seção 2 da spec).
CREATE POLICY contatos_estabelecimento_le ON public.contatos
    FOR SELECT TO authenticated USING (EXISTS (
        SELECT 1 FROM public.doacoes d
         WHERE d.id = contatos.doacao_id AND d.estabelecimento_id = public.meu_estabelecimento_id()));
