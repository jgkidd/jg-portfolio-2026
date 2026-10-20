import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { loadEnv } from 'vite';
import rawPages from '../src/content/pages.json' with { type: 'json' };
import { site, type Page } from '../src/site.ts';
export const pages = rawPages as Page[];
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
export function productionOrigin(environment: NodeJS.ProcessEnv): string {
  const value = environment.SITE_URL || (environment.VERCEL_PROJECT_PRODUCTION_URL ? `https://${environment.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  if (!value) return '';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('SITE_URL must be an http(s) URL');
  return url.origin;
}
export async function generate(): Promise<void> {
  const output = path.resolve('.site');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const header = await readFile('src/content/layout/header.html', 'utf8');
  const footer = await readFile('src/content/layout/footer.html', 'utf8');
  const domain = productionOrigin({ ...loadEnv('production', process.cwd(), 'SITE_'), ...process.env });
  const rootPage = pages.find(page => page.path === '/')!;
  const projectGrid = load(await readFile(`src/content/pages/${rootPage.content}`, 'utf8'));
  const projectOrder = projectGrid('.elementor-portfolio-item > a').map((_, link) => projectGrid(link).attr('href')!).get();
  const allPages: Page[] = [...pages, { ...rootPage, id: 404, path: '/404.html', title: 'Page not found', description: 'This page could not be found.', content: '', image: '' }];
  for (const page of allPages) {
    let content = page.id === 404 ? '<section class="not-found"><p>404</p><h1>Page not found.</h1><p>The page may have moved.</p><a class="elementor-button" href="/">Explore my projects</a></section>' : await readFile(`src/content/pages/${page.content}`, 'utf8');
    const $ = load(`<div>${content}</div>`);
    const projectIndex = projectOrder.indexOf(page.path);
    if (projectIndex !== -1) {
      const previous = projectOrder[(projectIndex - 1 + projectOrder.length) % projectOrder.length];
      const next = projectOrder[(projectIndex + 1) % projectOrder.length];
      const navigation = `<nav class="elementor-post-navigation" aria-label="Project navigation">${[
        ['prev', previous, 'left', 'Previous'], ['next', next, 'right', 'Next'],
      ].map(([direction, destination, arrow, label]) => {
        const title = pages.find(candidate => candidate.path === destination)?.title || '';
        return `<div class="elementor-post-navigation__${direction} elementor-post-navigation__link"><a href="${escapeHtml(destination!)}" rel="${direction}" aria-label="${label} project: ${escapeHtml(title)}"><span class="post-navigation__arrow-wrapper post-navigation__arrow-${direction}"><i class="fa fa-chevron-${arrow}" aria-hidden="true"></i><span class="elementor-screen-only">${label} project: ${escapeHtml(title)}</span></span></a></div>`;
      }).join('')}</nav>`;
      if ($('.elementor-post-navigation').length) $('.elementor-post-navigation').replaceWith(navigation);
      else $('h1').first().after(`<div class="project-sequence-navigation">${navigation}</div>`);
      content = $('body > div').html()!;
    }
    const firstHeading = $('h1').first().text().trim();
    const pageTitle = page.path === '/' ? page.title : `${page.title} — ${site.name}`;
    const imagePath = page.image || '/assets/media/5ea28098-profile.png';
    const image = `${domain}${imagePath}`;
    const canonical = domain && page.id !== 404 ? `<link rel="canonical" href="${escapeHtml(domain + page.path)}"><meta property="og:url" content="${escapeHtml(domain + page.path)}">` : '';
    const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pageTitle)}</title><meta name="description" content="${escapeHtml(page.description)}">
<meta name="author" content="${site.author}"><meta name="theme-color" content="#ff9292">
<meta property="og:type" content="${page.type === 'post' ? 'article' : 'website'}"><meta property="og:title" content="${escapeHtml(pageTitle)}"><meta property="og:description" content="${escapeHtml(page.description)}">${domain && image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
<meta property="og:locale" content="en_GB"><meta property="og:site_name" content="Josh Griffey">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(pageTitle)}"><meta name="twitter:description" content="${escapeHtml(page.description)}">${domain ? `<meta name="twitter:image" content="${escapeHtml(image)}"><meta property="og:image:alt" content="${escapeHtml(page.title)}">` : ''}${canonical}
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
${page.id === 404 || page.path === '/home/' || page.path.startsWith('/fabric') ? '<meta name="robots" content="noindex, follow">' : ''}
${page.styles.map(style => `<link rel="stylesheet" href="${style}">`).join('\n')}
${domain && (page.path === '/' || page.path === '/about/') ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', name: site.author, url: domain, jobTitle: 'Product and interaction designer', sameAs: [site.linkedin, site.instagram], image: domain + '/assets/media/5ea28098-profile.png' }).replace(/</g, '\\u003c')}</script>` : ''}
<script type="module" src="/src/main.ts"></script>
</head><body class="${escapeHtml(page.bodyClass)} static-site">
<a class="skip-link" href="#content">Skip to content</a>
${page.standalone ? '' : header}
<main id="content" tabindex="-1">${!firstHeading ? `<h1 class="sr-only">${escapeHtml(page.path === '/' ? 'Product and interaction design' : page.title)}</h1>` : ''}${content}</main>
${page.standalone ? '' : footer}
</body></html>`;
    const filename = page.id === 404 ? path.join(output, '404.html') : path.join(output, page.path, 'index.html');
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, html);
  }
  const crawlable = pages.filter(page => page.path !== '/home/' && !page.path.startsWith('/fabric'));
  if (domain) await writeFile('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${crawlable.map(page => `<url><loc>${escapeHtml(domain + page.path)}</loc></url>`).join('')}</urlset>\n`);
  else await rm('public/sitemap.xml', { force: true });
  await writeFile('public/robots.txt', `User-agent: *\nAllow: /\n${domain ? `Sitemap: ${domain}/sitemap.xml\n` : ''}`);
  console.log(`Generated ${allPages.length} static pages.`);
}
if (process.argv[1]?.endsWith('generate.ts')) await generate();
