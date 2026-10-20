/** One-time migration of rendered public pages. Never reads a WordPress database. */
import { load } from 'cheerio';
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const [htmlDirectory, wordpressDirectory] = process.argv.slice(2);
if (!htmlDirectory || !wordpressDirectory) throw new Error('Usage: tsx scripts/import-wordpress.ts <rendered-html-directory> <wordpress-public-directory>');
const project = process.cwd();
const origin = 'http://127.0.0.1:9402';
interface SourcePage { id: number; title: string; slug: string; type: string; path: string; date: string }
const index: SourcePage[] = JSON.parse(await readFile(path.join(htmlDirectory, 'index.json'), 'utf8'));
const knownRoutes = new Set(index.map(p => p.path));
const assetMap = new Map<string, string>();
const missing = new Set<string>();
const sharedCss: string[] = [];
const baseUrl = (value: string, base = origin): URL => new URL(value.replaceAll('&amp;', '&').replace('9402./hello-elementor', '9402/wp-content/themes/hello-elementor'), base);
const isLocal = (url: URL) => ['127.0.0.1', 'localhost', 'jg-portfolio-2023-bkup.local', 'jg-portfolio-2023.local'].includes(url.hostname);
async function replaceAsync(value: string, pattern: RegExp, fn: (...args: string[]) => Promise<string>): Promise<string> {
  const matches = [...value.matchAll(pattern)];
  const replacements = await Promise.all(matches.map(m => fn(...m)));
  let i = 0; return value.replace(pattern, () => replacements[i++]!);
}
async function cssUrls(css: string, base: string): Promise<string> {
  return replaceAsync(css, /url\(\s*(['"]?)(.*?)\1\s*\)/g, async (_all, _quote, url) => `url("${await asset(url, base)}")`);
}
async function asset(value: string, base = origin): Promise<string> {
  if (!value || /^(data:|#|blob:|\/assets\/)/.test(value)) return value;
  const url = baseUrl(value, base);
  if (!isLocal(url)) return url.href;
  const original = decodeURIComponent(url.pathname);
  if (assetMap.has(original)) return assetMap.get(original)! + url.hash;
  const filename = path.join(wordpressDirectory, original);
  if (!filename.startsWith(path.resolve(wordpressDirectory) + path.sep)) throw new Error('Asset outside source directory');
  try { if (!(await stat(filename)).isFile()) throw new Error('Not a file'); }
  catch { missing.add(original); return value; }
  const extension = path.extname(original).toLowerCase();
  if (!['.css','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.avif','.woff','.woff2','.ttf','.otf','.eot','.mp4','.webm','.pdf','.mp3'].includes(extension)) return '';
  const category = extension === '.css' ? 'styles' : /\.(woff2?|ttf|otf|eot)$/.test(extension) ? 'fonts' : 'media';
  const name = path.basename(original).replace(/[^a-zA-Z0-9._-]/g, '-');
  const target = `/assets/${category}/${createHash('sha1').update(original).digest('hex').slice(0,8)}-${name}`;
  assetMap.set(original, target);
  const destination = path.join(project, 'public', target);
  await mkdir(path.dirname(destination), { recursive: true });
  if (extension === '.css') {
    const text = await cssUrls(await readFile(filename, 'utf8'), url.href);
    await writeFile(destination, text.replace(/\/\*# sourceMappingURL=.*?\*\//g, ''));
  } else await copyFile(filename, destination);
  return target + url.hash;
}
function route(value: string): string {
  if (!value || /^(#|mailto:|tel:)/.test(value)) return value;
  if (/^javascript:/i.test(value)) return '#';
  const url = baseUrl(value);
  if (!isLocal(url)) return url.href;
  let pathname = url.pathname;
  if (pathname === '/projects' || pathname === '/projects/') pathname = '/';
  if (/^\/login\/?$/.test(pathname)) pathname = '/contact/';
  if (pathname !== '/' && !path.extname(pathname) && !pathname.endsWith('/')) pathname += '/';
  if (pathname.startsWith('/category/') || /^\/\d{4}\/\d{2}\/\d{2}\/?$/.test(pathname)) return '/thoughts/';
  return pathname + url.search.replace(/\??(?:static-migration|local-preview)=[^&]*&?/g, '') + url.hash;
}
await mkdir('src/content/layout', { recursive: true });
const pages: Record<string, unknown>[] = [];
for (const page of index) {
  const $ = load(await readFile(path.join(htmlDirectory, `${page.id}.html`), 'utf8'));
  const title = load(page.title).text().replace(/\s+/g, ' ').trim();
  const stylePaths: string[] = [];
  // Keep presentation CSS, but none of the WordPress/plugin JavaScript.
  for (const element of $('link[rel="stylesheet"]').toArray()) {
    const href = $(element).attr('href');
    if (href) { const url = await asset(href); if (url.startsWith('/assets/')) stylePaths.push(url); }
  }
  if (page.id === 1078) sharedCss.push(...stylePaths);
  $('script, noscript, link[rel=stylesheet], .wpr-template-popup, .swiper-lazy-preloader, #wpadminbar, .screen-reader-text.skip-link').remove();
  // Resolve plugin-only lazy images before removing the old runtime.
  for (const element of $('[data-lazyload], [data-background]').toArray()) {
    const node = $(element);
    const lazyImage = node.attr('data-lazyload');
    const background = node.attr('data-background');
    if (lazyImage) node.attr('src', await asset(lazyImage)).removeAttr('data-lazyload');
    if (background) node.attr('style', `${node.attr('style') || ''};background-image:url("${await asset(background)}")`).removeAttr('data-background');
    node.removeClass('swiper-lazy rs-lazyload');
  }
  // Retain the earlier Home page artwork in the same native gallery as other pages.
  $('rs-module-wrap').each((_i, element) => {
    const gallery = $('<div class="home-gallery" data-carousel=\'{"slides":1,"autoplay":true,"delay":5000}\'><div><div class="swiper-wrapper"></div></div></div>');
    $(element).find('rs-slide').each((_j, slide) => {
      const source = $(slide);
      const background = source.children('.rev-slidebg').attr('data-bg')?.match(/c:(#[a-fA-F0-9]{3,8});/)?.[1] || '#ffffff';
      const card = $('<article class="swiper-slide home-gallery-slide"></article>').css('background-color', background);
      card.css('color', background === '#ffffff' ? '#000000' : '#ffffff');
      const heading = source.find('rs-layer[data-type=text]').filter((_k, layer) => ($(layer).attr('data-text') || '').includes('s:266')).first();
      card.append($('<h2></h2>').text(heading.text().trim() || 'Project'));
      const artwork = source.find('rs-layer[data-type=image] img').first().clone().removeClass('tp-rs-img');
      artwork.attr('alt', 'Project artwork').addClass('home-gallery-artwork');
      card.append(artwork);
      const tags = $('<div class="home-gallery-tags"></div>');
      source.find('rs-layer[data-type=text]').not(heading).each((_k, layer) => { tags.append($('<span></span>').text($(layer).text().trim())); });
      card.append(tags);
      gallery.find('.swiper-wrapper').append(card);
    });
    $(element).replaceWith(gallery);
  });
  $('*').each((_i,el)=>{if(!('attribs' in el))return;for(const name of Object.keys(el.attribs || {})){if(!/^[a-zA-Z_:][a-zA-Z0-9_:.-]*$/.test(name))delete el.attribs[name];}});
  const headStyles = $('head style').map((_i, el) => $(el).html() || '').get().join('\n');
  const mainStyles = $('body style').map((_i, el) => $(el).html() || '').get().join('\n');
  $('style').remove();
  // Replace animations that depended on Elementor's client-side bootstrap.
  $('.elementor-invisible').removeClass('elementor-invisible');
  $('.elementor-progress-bar').each((_i, el) => { $(el).attr('style', `width:${$(el).attr('data-max') || '100'}%`); });
  $('[data-settings]').each((_i, el) => {
    const node = $(el); const settings = JSON.parse(node.attr('data-settings') || '{}');
    if (node.hasClass('elementor-widget') && node.find('.swiper-wrapper').length) node.attr('data-carousel', JSON.stringify({slides: Number(settings.slides_to_show) || 1, autoplay: true, delay: settings.autoplay_speed || 5000}));
    const video = settings.youtube_url || settings.vimeo_url || settings.hosted_url?.url;
    if (video && node.hasClass('elementor-widget-video')) node.attr('data-video', video);
    node.removeAttr('data-settings');
  });
  $('[onclick],[onmouseover],[onload]').removeAttr('onclick onmouseover onload');
  if (page.id === 737) {
    $('[data-carousel]').not('[data-id="dea3d5a"]').attr('data-carousel-pagination', 'bars');
    const experience = $('[data-id="bdf5eaa"][data-carousel]');
    if (experience.length) {
      const settings = JSON.parse(experience.attr('data-carousel')!);
      experience.attr('data-carousel', JSON.stringify({ ...settings, delay: 3000 }));
    }
  }
  $('a[href]').each((_i, el) => {
    const node = $(el); const old = node.attr('href')!;
    const isContactButton = /^\/login\/?$/.test(old);
    if (isContactButton) { node.find('.elementor-button-text').text('contact'); node.attr('aria-label', 'Contact'); }
    node.attr('href', isContactButton ? '/contact/' : route(old));
    if (node.attr('target') === '_blank') node.attr('rel', 'noopener noreferrer');
    if (!node.text().trim() && !node.attr('aria-label')) node.attr('aria-label', node.find('svg').length ? 'JGKIDD home' : node.find('img').attr('alt') || 'Open link');
  });
  $('.elementor-portfolio__filter').each((_i, el) => { const node=$(el); node.attr({tabindex:'0',role:'button','aria-pressed':String(node.hasClass('elementor-active'))}); });
  $('form').each((_i, el) => {
    const form = $(el); form.attr({'data-contact-form':'','action':'mailto:joshgriffey@gmail.com','method':'get'});
    form.find('input[type=hidden]').remove();
    form.find('input,textarea').each((_i, field) => {
      const node=$(field); const label=node.attr('placeholder') || 'Message';
      node.attr('name',label.toLowerCase()).attr('aria-label',label);
      if(label==='Name')node.attr('autocomplete','name'); if(label==='Email')node.attr('autocomplete','email');
      if(label==='Message')node.attr('required','required');
    });
    form.find('[type=submit] .elementor-button-text').text('Open email draft');
    form.append('<p class="contact-note">Opens a draft in your email app. You can also write directly to <a href="mailto:joshgriffey@gmail.com">joshgriffey@gmail.com</a>.</p><p class="contact-status" role="status"></p>');
  });
  for (const element of $('[src], [poster], [href], [srcset], [style]').toArray()) {
    const node=$(element);
    for (const attr of ['src','poster','href']) {
      const value=node.attr(attr); if(!value)continue;
      const url=baseUrl(value);
      if(isLocal(url) && /\.(png|jpe?g|webp|gif|svg|ico|avif|woff2?|ttf|otf|mp4|webm|pdf)(?:$|[?#])/i.test(value)) node.attr(attr, await asset(value));
    }
    if(node.attr('srcset')) node.attr('srcset', (await Promise.all(node.attr('srcset')!.split(',').map(async part=>{const [url,...size]=part.trim().split(/\s+/);return [await asset(url!),...size].join(' ');}))).join(', '));
    if(node.attr('style')) node.attr('style',await cssUrls(node.attr('style')!,origin));
  }
  $('img').each((_i,el)=>{const node=$(el);node.attr('decoding','async'); if(!node.attr('alt'))node.attr('alt',node.closest('article').find('h2,h3').text().trim() || '');});
  $('iframe').each((_i,el)=>{ $(el).attr({loading:'lazy',title:$(el).attr('title') || 'Interactive project prototype'}); });
  $('.elementor-portfolio-item img').attr('sizes','(max-width: 767px) 100vw, (max-width: 1024px) 50vw, 33vw');
  const firstImage = $('body > [data-elementor-type]:not([data-elementor-type=header]) img').first();
  firstImage.attr({loading:'eager',fetchpriority:'high'});
  const header=$('[data-elementor-type="header"]').first();
  const footer=$('[data-elementor-type="footer"]').first();
  if(page.id===1078){await writeFile('src/content/layout/header.html', $.html(header));await writeFile('src/content/layout/footer.html',$.html(footer));}
  header.remove();footer.remove();
  const main=$('body').children().filter((_i,el)=>!['script','style','link','svg'].includes(el.tagName)&&!$(el).hasClass('wpr-template-popup'));
  const description = main.find('p').map((_i,el)=>$(el).text().trim()).get().find(text=>text.length>60)?.slice(0,170) || `${title} — Josh Griffey. Creative strategy, branding and product design.`;
  const content = main.toArray().map(el=>$.html(el)).join('\n');
  const filename = `${page.id===1078?'index':page.slug}.html`;
  await writeFile(`src/content/pages/${filename}`, content);
  const cssPath=`/assets/styles/page-${page.id}.css`;
  await writeFile(`public${cssPath}`,await cssUrls(headStyles+'\n'+mainStyles,origin));
  pages.push({id:page.id,path:page.path,title:page.id===1078?'JGKIDD — Creative strategy & product design':title,description,bodyClass:$('body').attr('class')||'',content:filename,styles:[...new Set([...stylePaths,cssPath])],standalone:page.id===3141,type:page.type,date:page.date.slice(0,10),image:firstImage.attr('src')||''});
  console.log('Imported',page.path);
}
await writeFile('src/content/pages.json',JSON.stringify(pages,null,2)+'\n');
await writeFile('src/content/asset-manifest.json',JSON.stringify(Object.fromEntries(assetMap),null,2)+'\n');
await writeFile('/private/tmp/jg-migration-missing.json',JSON.stringify([...missing],null,2));
console.log('Pages:',pages.length,'assets:',assetMap.size,'missing:',missing.size);
