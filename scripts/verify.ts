/** Verify the deployable build, including CSS, media, direct routes and stale backend URLs. */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import pages from '../src/content/pages.json';
const root = path.resolve('dist');
const failures = new Set<string>();
const routes = new Set(pages.map(page => page.path));
const aliases: Record<string,string> = { '/projects/':'/', '/login/':'/contact/' };
const checked = new Set<string>();
async function checkUrl(value: string, from: string): Promise<void> {
  if (!value || /^(data:|mailto:|tel:|#|blob:)/.test(value)) return;
  if (/127\.0\.0\.1|localhost|jg-portfolio-2023(?:-bkup)?\.local|\/wp-(?:content|includes|admin|json)\/|admin-ajax\.php/.test(value)) failures.add(`Old runtime URL in ${from}: ${value}`);
  const url = new URL(value, `https://portfolio.example${from}`);
  if(url.hostname !== 'portfolio.example') return;
  let target = decodeURIComponent(url.pathname);
  if (!path.extname(target)) { if(!target.endsWith('/'))target+='/'; if(aliases[target])target=aliases[target]!; }
  if (routes.has(target) || target === '/404.html') return;
  if(checked.has(target))return;checked.add(target);
  try { const file = await stat(path.join(root,target)); if(!file.isFile())failures.add(`Not a file: ${target}`); }
  catch { failures.add(`Missing local URL in ${from}: ${target}`); }
}
async function walk(directory:string):Promise<string[]> {
  const results:string[]=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);if(entry.isDirectory())results.push(...await walk(full));else results.push(full);
  }return results;
}
const files=await walk(root);
for(const file of files) {
  const rel='/'+path.relative(root,file).replaceAll(path.sep,'/');
  if(file.endsWith('.html')){
    const html=await readFile(file,'utf8');const $=load(html);
    if ($('[data-lazyload],[data-background],rs-module-wrap').length) failures.add(`Unconverted plugin image loader or slider: ${rel}`);
    if (/127\.0\.0\.1|localhost|jg-portfolio-2023(?:-bkup)?\.local/.test(html)) failures.add(`Local preview address in HTML: ${rel}`);
    if(!$('title').text()||!$('meta[name=description]').attr('content')||!$('main').length)failures.add(`Missing page semantics: ${rel}`);
    if($('script:not([type=module])').length)failures.add(`Unexpected legacy script: ${rel}`);
    for(const el of $('[src],[href],[poster]').toArray())for(const attr of ['src','href','poster']){const value=$(el).attr(attr);if(value)await checkUrl(value,rel);}
    for(const el of $('[srcset]').toArray())for(const part of $(el).attr('srcset')!.split(','))await checkUrl(part.trim().split(/\s+/)[0]!,rel);
    for(const el of $('[style]').toArray())for(const match of $(el).attr('style')!.matchAll(/url\(['"]?(.*?)['"]?\)/g))await checkUrl(match[1]!,rel);
  }
  if(file.endsWith('.css'))for(const match of (await readFile(file,'utf8')).matchAll(/url\(\s*['"]?(.*?)['"]?\s*\)/g))await checkUrl(match[1]!,rel);
  if(/\.(php|sql|log)$/i.test(file))failures.add(`Server or backup file in dist: ${rel}`);
}
for(const page of pages){try{await stat(path.join(root,page.path,'index.html'));}catch{failures.add(`No direct-entry HTML for ${page.path}`);}}
if(failures.size){console.error([...failures].join('\n'));process.exitCode=1;}else console.log(`Verified ${pages.length} page routes, 404 page and ${checked.size} asset URLs. No WordPress runtime or broken local links.`);
