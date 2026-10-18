-- =====================================================================
-- Elo Alimentar · Migração 004 · Autenticação e perfis (Aula 11)
-- Perfis `comerciante` (tabela estabelecimentos) e `entidade` (tabela entidades),
-- ligados a uma conta do Supabase Auth. As contas são criadas pela equipe na v1
-- (ESPECIFICACAO-MVP.md, seção 0) — ver supabase/cadastro-contas.sql.
-- Troca as políticas públicas transitórias por políticas de dono (auth.uid()):
-- um estabelecimento nunca lê produtos ou vendas de outro (AGENTS.md, Regra 6).
-- Script idempotente: pode ser executado mais de uma vez no SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PERFIS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estabelecimentos (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    user_id             UUID          NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
    nome_fantasia       VARCHAR(80)   NOT NULL
        CONSTRAINT estabelecimentos_nome_tamanho CHECK (char_length(btrim(nome_fantasia)) BETWEEN 2 AND 80),
    bairro              VARCHAR(60)   NOT NULL
        CONSTRAINT estabelecimentos_bairro_tamanho CHECK (char_length(btrim(bairro)) BETWEEN 2 AND 60),
    -- Coordenadas do estabelecimento (não de pessoas): usadas no mural (RF-05) para a distância.
    latitude            NUMERIC(9,6)  NULL CONSTRAINT estabelecimentos_latitude CHECK (latitude BETWEEN -90 AND 90),
    longitude           NUMERIC(9,6)  NULL CONSTRAINT estabelecimentos_longitude CHECK (longitude BETWEEN -180 AND 180),
    -- RF-04, regra 2: 55 + DDD (2 dígitos) + número (9 dígitos) = 13 dígitos.
    -- É o único telefone armazenado (AGENTS.md, Regra 6). Sem ele, a publicação de doação é bloqueada.
    whatsapp_comercial  VARCHAR(13)   NULL
        CONSTRAINT estabelecimentos_whatsapp_formato CHECK (whatsapp_comercial ~ '^55[0-9]{11}$')
);

COMMENT ON TABLE public.estabelecimentos IS 'Perfil comerciante: 1 conta por estabelecimento, criada pela equipe.';

CREATE TABLE IF NOT EXISTS public.entidades (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    user_id     UUID          NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
    nome        VARCHAR(80)   NOT NULL
        CONSTRAINT entidades_nome_tamanho CHECK (char_length(btrim(nome)) BETWEEN 2 AND 80),
    bairro      VARCHAR(60)   NOT NULL
        CONSTRAINT entidades_bairro_tamanho CHECK (char_length(btrim(bairro)) BETWEEN 2 AND 60)
);

COMMENT ON TABLE public.entidades IS 'Perfil entidade receptora: 1 conta por entidade, criada pela equipe. Sem dados de pessoas atendidas.';

-- Uma conta tem um único perfil: não pode ser comerciante e entidade ao mesmo tempo.
CREATE OR REPLACE FUNCTION public.garantir_perfil_unico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_TABLE_NAME = 'estabelecimentos'
       AND EXISTS (SELECT 1 FROM public.entidades WHERE user_id = NEW.user_id) THEN
        RAISE EXCEPTION 'Esta conta já é de uma entidade.' USING ERRCODE = 'check_violation';
    END IF;
    IF TG_TABLE_NAME = 'entidades'
       AND EXISTS (SELECT 1 FROM public.estabelecimentos WHERE user_id = NEW.user_id) THEN
        RAISE EXCEPTION 'Esta conta já é de um estabelecimento.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_perfil_unico ON public.estabelecimentos;
CREATE TRIGGER trg_perfil_unico BEFORE INSERT OR UPDATE OF user_id ON public.estabelecimentos
    FOR EACH ROW EXECUTE FUNCTION public.garantir_perfil_unico();
DROP TRIGGER IF EXISTS trg_perfil_unico ON public.entidades;
CREATE TRIGGER trg_perfil_unico BEFORE INSERT OR UPDATE OF user_id ON public.entidades
    FOR EACH ROW EXECUTE FUNCTION public.garantir_perfil_unico();

-- Perfil do usuário logado. SECURITY DEFINER para as políticas poderem consultar
-- os perfis sem recursão de RLS; devolvem NULL para quem não tem o perfil.
CREATE OR REPLACE FUNCTION public.meu_estabelecimento_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT id FROM public.estabelecimentos WHERE user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.minha_entidade_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT id FROM public.entidades WHERE user_id = auth.uid() $$;

-- ---------------------------------------------------------------------
-- 2. DONO DOS DADOS: produtos e vendas passam a pertencer a um estabelecimento.
--    O DEFAULT preenche o dono com o usuário logado; a API nunca envia esse campo.
--    Linhas antigas (seed e testes da Aula 10) ficam com NULL e deixam de aparecer.
-- ---------------------------------------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS estabelecimento_id UUID;
ALTER TABLE public.vendas   ADD COLUMN IF NOT EXISTS estabelecimento_id UUID;
ALTER TABLE public.produtos ALTER COLUMN estabelecimento_id SET DEFAULT public.meu_estabelecimento_id();
ALTER TABLE public.vendas   ALTER COLUMN estabelecimento_id SET DEFAULT public.meu_estabelecimento_id();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_estabelecimento_fk') THEN
        ALTER TABLE public.produtos ADD CONSTRAINT produtos_estabelecimento_fk
            FOREIGN KEY (estabelecimento_id) REFERENCES public.estabelecimentos (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_estabelecimento_fk') THEN
        ALTER TABLE public.vendas ADD CONSTRAINT vendas_estabelecimento_fk
            FOREIGN KEY (estabelecimento_id) REFERENCES public.estabelecimentos (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_produtos_estabelecimento ON public.produtos (estabelecimento_id, data_validade);
CREATE INDEX IF NOT EXISTS idx_vendas_estabelecimento   ON public.vendas (estabelecimento_id);

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
--    Remove TODAS as políticas existentes (o banco em nuvem foi criado com nomes
--    diferentes dos da 001) e cria as políticas de dono. Políticas se somam com OR:
--    sobrar uma pública abriria os dados de todos os estabelecimentos.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename IN ('produtos', 'vendas', 'itens_venda', 'estabelecimentos', 'entidades')
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

ALTER TABLE public.produtos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_venda      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estabelecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidades        ENABLE ROW LEVEL SECURITY;

-- Perfis: cada conta lê só o próprio. Alterações são feitas pela equipe no painel.
CREATE POLICY estabelecimentos_dono_le ON public.estabelecimentos
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY entidades_dona_le ON public.entidades
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Produtos (RF-01, regra 4): só o estabelecimento dono vê e altera.
CREATE POLICY produtos_dono_le ON public.produtos
    FOR SELECT TO authenticated USING (estabelecimento_id = public.meu_estabelecimento_id());
CREATE POLICY produtos_dono_cria ON public.produtos
    FOR INSERT TO authenticated WITH CHECK (estabelecimento_id = public.meu_estabelecimento_id());
CREATE POLICY produtos_dono_altera ON public.produtos
    FOR UPDATE TO authenticated
    USING (estabelecimento_id = public.meu_estabelecimento_id())
    WITH CHECK (estabelecimento_id = public.meu_estabelecimento_id());
CREATE POLICY produtos_dono_exclui ON public.produtos
    FOR DELETE TO authenticated USING (estabelecimento_id = public.meu_estabelecimento_id());

-- Vendas e itens (RF-02): só o estabelecimento dono.
CREATE POLICY vendas_dono_le ON public.vendas
    FOR SELECT TO authenticated USING (estabelecimento_id = public.meu_estabelecimento_id());
CREATE POLICY vendas_dono_cria ON public.vendas
    FOR INSERT TO authenticated WITH CHECK (estabelecimento_id = public.meu_estabelecimento_id());

CREATE POLICY itens_venda_dono_le ON public.itens_venda
    FOR SELECT TO authenticated USING (EXISTS (
        SELECT 1 FROM public.vendas v
         WHERE v.id = itens_venda.venda_id AND v.estabelecimento_id = public.meu_estabelecimento_id()));
CREATE POLICY itens_venda_dono_cria ON public.itens_venda
    FOR INSERT TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM public.vendas v
         WHERE v.id = itens_venda.venda_id AND v.estabelecimento_id = public.meu_estabelecimento_id()));

-- registrar_venda (RF-02) é SECURITY INVOKER: com as políticas acima, só enxerga e
-- baixa o estoque do próprio estabelecimento, e a venda nasce com o dono pelo DEFAULT.
