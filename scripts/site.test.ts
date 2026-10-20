import test from 'node:test';
import assert from 'node:assert/strict';
import { emailDraft, matchesCategory } from '../src/site.ts';
import { productionOrigin, escapeHtml } from './generate.ts';
import pages from '../src/content/pages.json';
import { loopPosition, nearestSlide } from '../src/carousel.ts';
test('carousel seams wrap both ways without changing the visible slide or swipe offset', () => {
  for (const step of [332, 812]) {
    const start = 4 * step;
    const cycle = 4 * step;
    assert.equal(loopPosition(start + cycle, start, cycle), start);
    assert.equal(loopPosition(start - step, start, cycle), start + 3 * step);
    assert.equal(loopPosition(start + cycle + 27, start, cycle), start + 27);
    assert.equal(loopPosition(start + step, start, cycle), start + step);
    assert.equal(nearestSlide([start, start + step, start + 2 * step], start + step + 20), 1);
  }
});
test('fractional scroll snapping stays stable at either side of a carousel seam', () => {
  const start = 1666.4;
  const cycle = 1666.4;
  for (const delta of [-0.5, 0, 0.5]) {
    assert.equal(loopPosition(start + delta, start, cycle), start);
    assert.equal(loopPosition(start + cycle + delta, start, cycle), start);
  }
});
test('filters retain all projects and correctly select overlapping categories',()=>{
  const classes=['elementor-filter-2','elementor-filter-3'];
  assert.equal(matchesCategory(classes,'__all'),true);assert.equal(matchesCategory(classes,'3'),true);assert.equal(matchesCategory(classes,'4'),false);
});
test('contact draft preserves punctuation and line breaks without sending',()=>{
  const link=emailDraft('Josh & Co','hello@example.com','A project?\nBudget: £1,000 + VAT');
  const url=new URL(link);assert.equal(url.pathname,'joshgriffey@gmail.com');assert.equal(url.searchParams.get('subject'),'Portfolio enquiry from Josh & Co');assert.match(url.searchParams.get('body')!,/£1,000 \+ VAT/);
});
test('production metadata uses the custom domain before the Vercel URL',()=>{
  assert.equal(productionOrigin({SITE_URL:'https://example.com/',VERCEL_PROJECT_PRODUCTION_URL:'site.vercel.app'}),'https://example.com');
  assert.equal(productionOrigin({VERCEL_PROJECT_PRODUCTION_URL:'site.vercel.app'}),'https://site.vercel.app');assert.equal(productionOrigin({}),'');
});
test('metadata escapes special characters and public routes are unique',()=>{
  assert.equal(escapeHtml('A & "B" <C>'),'A &amp; &quot;B&quot; &lt;C&gt;');assert.equal(new Set(pages.map(p=>p.path)).size,pages.length);assert.equal(pages.filter(p=>p.type==='projects').length,5);assert.ok(!pages.some(p=>p.path.startsWith('/login')||p.type==='private-page'));
});

test('unfinished projects are excluded and Bud remains available as a draft', async()=>{
  const {readFile}=await import('node:fs/promises');
  assert.ok(!pages.some(p=>[331,2482].includes(p.id)));
  assert.ok(pages.some(p=>p.id===1406));
  assert.ok(!pages.some(p=>p.id===84));
  const content=await readFile('src/content/pages/bud.html','utf8');
  assert.match(content,/personal design concept/);
  assert.doesNotMatch(content,/Amelia Greenberg|GrowWise|Lorem ipsum/);
  for(const page of pages){
    const html=await readFile(`src/content/pages/${page.content}`,'utf8');
    assert.doesNotMatch(html,/href="\/(?:projects\/project-3|midjourney)\//);
  }
});
