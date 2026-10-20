import { defineConfig } from 'vite';
import path from 'node:path';
import { generate } from './scripts/generate.ts';
import pages from './src/content/pages.json' with { type: 'json' };
const project = process.cwd();
export default defineConfig({
  root: '.site',
  publicDir: '../public',
  appType: 'mpa',
  server: { fs: { allow: [project] } },
  resolve: { alias: { '/src': path.resolve(project, 'src') } },
  build: {
    outDir: '../dist', emptyOutDir: true,
    rolldownOptions: { input: [...pages.map(page => path.resolve(project, '.site', `.${page.path}`, 'index.html')), path.resolve(project, '.site/404.html')] },
  },
  plugins: [{
    name: 'portfolio-content',
    configureServer(server) {
      server.watcher.add(path.resolve(project, 'src/content'));
      server.watcher.on('change', async file => {
        if (file.includes('/src/content/')) { await generate(); server.ws.send({ type: 'full-reload' }); }
      });
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url || '').split('?')[0];
        const target = ['/projects', '/projects/'].includes(pathname!) ? '/' : ['/login', '/login/'].includes(pathname!) ? '/contact/' : null;
        if (target) { response.writeHead(302, { Location: target }); response.end(); return; }
        next();
      });
    },
  }],
});
