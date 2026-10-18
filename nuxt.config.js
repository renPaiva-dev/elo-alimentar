// Front-end do MVP 1 (Nuxt 4, mobile-first). O app roda só no navegador (SPA) e a API
// Express de backend/ é servida pelo próprio Nuxt em /api/v1 (server/routes/api/v1),
// então front e API ficam no mesmo endereço, sem CORS, num único deploy no Vercel.
//
// Variáveis (as mesmas da API): VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local;
// no Vercel, NUXT_PUBLIC_SUPABASE_URL e NUXT_PUBLIC_SUPABASE_ANON_KEY. Só a chave anon/publishable.
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'Elo Alimentar',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Caixa simples, alerta de validade e mural de doação para pequenos estabelecimentos de Teresina.' },
        { name: 'theme-color', content: '#21481f' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icone.svg' },
        { rel: 'apple-touch-icon', href: '/icone-192.png' },
      ],
    },
  },
});
