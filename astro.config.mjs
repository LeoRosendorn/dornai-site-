// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://dornai.lat',
  trailingSlash: 'ignore',
  vite: {
    plugins: [tailwindcss()]
  },

  // /gracias es solo el destino del formulario: no va al sitemap.
  integrations: [sitemap({ filter: (page) => !page.includes('/gracias') })]
});