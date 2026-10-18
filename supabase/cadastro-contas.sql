-- =====================================================================
-- Elo Alimentar · Cadastro manual de contas (v1: não há autocadastro)
-- NÃO é migração: é um modelo para a equipe preencher e rodar no SQL Editor
-- a cada estabelecimento ou entidade que aceitar participar.
--
-- PASSO 1 — Supabase > Authentication > Users > "Add user" > "Create new user"
--           e-mail + senha provisória, marcando "Auto Confirm User".
--           Entregue a senha pessoalmente ao responsável e peça para trocá-la.
-- PASSO 2 — Troque os valores entre <> abaixo e rode SÓ o bloco do perfil certo.
--           Nunca coloque e-mails ou senhas reais neste arquivo versionado:
--           preencha direto no SQL Editor.
-- =====================================================================

-- ---------- COMERCIANTE (estabelecimento) ----------
-- latitude/longitude: no Google Maps, clique com o botão direito no estabelecimento
-- e copie os números (ex.: -5.0892, -42.8019). São do comércio, não de pessoas.
-- whatsapp_comercial: 55 + DDD + número, só dígitos (13), autorizado pelo responsável.
-- endereco, latitude/longitude e WhatsApp podem ficar NULL aqui: depois da migração 007
-- o próprio comerciante preenche em "Meu estabelecimento" (de preferência, na loja, com o GPS).
INSERT INTO public.estabelecimentos (user_id, nome_fantasia, bairro, endereco, latitude, longitude, whatsapp_comercial)
SELECT id, '<Nome do estabelecimento>', '<Bairro>', '<Rua, número — referência>', <latitude>, <longitude>, '<55DDDNUMERO>'
  FROM auth.users
 WHERE email = '<email-do-comerciante>'
ON CONFLICT (user_id) DO NOTHING;

-- ---------- ENTIDADE (quem recebe doações) ----------
-- Só o nome da entidade e o bairro. Nenhum dado de pessoas atendidas.
INSERT INTO public.entidades (user_id, nome, bairro)
SELECT id, '<Nome da entidade>', '<Bairro>'
  FROM auth.users
 WHERE email = '<email-da-entidade>'
ON CONFLICT (user_id) DO NOTHING;

-- ---------- CONFERÊNCIA ----------
SELECT 'comerciante' AS perfil, e.nome_fantasia AS nome, e.bairro, u.email
  FROM public.estabelecimentos e JOIN auth.users u ON u.id = e.user_id
UNION ALL
SELECT 'entidade', n.nome, n.bairro, u.email
  FROM public.entidades n JOIN auth.users u ON u.id = n.user_id
ORDER BY 1, 2;
