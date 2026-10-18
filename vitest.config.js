// Testes sem rede: chaves fictícias (o cliente é criado, mas os repositories são simulados).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['backend/test/**/*.test.js', 'shared/**/*.test.js'],
    setupFiles: ['backend/test/setup.js'],
    env: {
      VITE_SUPABASE_URL: 'https://teste-elo-alimentar.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'chave-anon-de-teste',
    },
  },
});
