import './styles/site.css';
import { emailDraft, matchesCategory } from './site';
import { initialiseCarousels } from './carousel';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const onActivate = (element: HTMLElement, callback: () => void) => {
  element.addEventListener('click', callback);
  if (element.tagName !== 'BUTTON') element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); callback(); }
  });
};

// Shareable filters keep project category links and browser history in sync.
const categorySlugs: Record<string, string> = { '__all': '', '2': 'branding', '3': 'product-design', '4': 'creative-strategy', connected: 'physical-digital', founder: 'founder-led' };
document.querySelectorAll<HTMLElement>('.elementor-widget-portfolio').forEach(widget => {
  const filters = [...widget.querySelectorAll<HTMLElement>('[data-filter]')];
  const projects = [...widget.querySelectorAll<HTMLElement>('.elementor-portfolio-item')];
  const status = document.createElement('p'); status.className = 'sr-only'; status.setAttribute('role', 'status');
  widget.querySelector('.elementor-portfolio__filters')?.after(status);
  const apply = (category: string, updateUrl: boolean) => {
    if (!filters.some(filter => filter.dataset.filter === category)) category = '__all';
    filters.forEach(filter => {
      const key = filter.dataset.filter || '__all';
      const active = key === category;
      filter.classList.toggle('elementor-active', active); filter.setAttribute('aria-pressed', String(active));
    });
    let count = 0;
    projects.forEach(project => { project.hidden = !matchesCategory(project.classList, category); if (!project.hidden) count++; });
    status.textContent = `${count} ${count === 1 ? 'project' : 'projects'}`;
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (category === '__all') url.searchParams.delete('category'); else url.searchParams.set('category', categorySlugs[category]!);
      window.history.pushState(null, '', url);
    }
  };
  const fromUrl = () => apply(Object.keys(categorySlugs).find(key => categorySlugs[key] === new URL(window.location.href).searchParams.get('category')) || '__all', false);
  filters.forEach(filter => {
    const key = filter.dataset.filter || '__all';
    const count = projects.filter(project => matchesCategory(project.classList, key)).length;
    const badge = document.createElement('span'); badge.className = 'filter-count'; badge.textContent = String(count); badge.setAttribute('aria-hidden', 'true'); filter.append(badge);
    filter.setAttribute('aria-label', `${filter.textContent?.replace(/\d+$/, '').trim()}, ${count} ${count === 1 ? 'project' : 'projects'}`);
    onActivate(filter, () => apply(key, true));
  });
  window.addEventListener('popstate', fromUrl);
  fromUrl();
});

initialiseCarousels(reducedMotion);

// An accessible native dialog for full-size project images.
const imageLinks = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(link => !link.closest('[data-carousel-clone]') && /\.(png|jpe?g|webp|gif|avif)(?:[?#]|$)/i.test(link.href) && !!link.querySelector('img'));
if (imageLinks.length) {
  const dialog = document.createElement('dialog'); dialog.className = 'image-viewer'; dialog.setAttribute('aria-label', 'Image gallery');
  dialog.innerHTML = '<button class="image-viewer-close" type="button" aria-label="Close gallery">×</button><button class="image-viewer-prev" type="button" aria-label="Previous image">←</button><figure><img alt=""><figcaption></figcaption></figure><button class="image-viewer-next" type="button" aria-label="Next image">→</button>';
  document.body.append(dialog); let selected = 0;
  const show = (step: number) => { selected = (selected + step + imageLinks.length) % imageLinks.length; const link = imageLinks[selected]!; const img = dialog.querySelector('img')!; img.src = link.href; img.alt = link.querySelector('img')?.alt || 'Project image'; dialog.querySelector('figcaption')!.textContent = `${selected + 1} / ${imageLinks.length}`; };
  imageLinks.forEach((link, index) => link.addEventListener('click', event => { if(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); selected = index; show(0); dialog.showModal(); dialog.querySelector<HTMLButtonElement>('button')!.focus(); }));
  dialog.querySelector('.image-viewer-close')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('.image-viewer-prev')!.addEventListener('click', () => show(-1));
  dialog.querySelector('.image-viewer-next')!.addEventListener('click', () => show(1));
  dialog.addEventListener('keydown', event => { if(event.key==='ArrowRight')show(1);if(event.key==='ArrowLeft')show(-1); });
  dialog.addEventListener('click', event => { if(event.target === dialog)dialog.close(); });
  dialog.addEventListener('close', () => imageLinks[selected]?.focus());
}

// Clear, local email composition. Nothing is submitted to WordPress or a third party.
document.querySelectorAll<HTMLFormElement>('[data-contact-form]').forEach(form => form.addEventListener('submit', event => {
  event.preventDefault(); if (!form.reportValidity()) return;
  const data = new FormData(form);
  window.location.href = emailDraft(String(data.get('name') || ''), String(data.get('email') || ''), String(data.get('message') || ''));
  form.querySelector<HTMLElement>('.contact-status')!.textContent = 'Your email app should open with a draft. Send it there when you’re ready.';
}));

document.querySelectorAll<HTMLElement>('.elementor-tabs').forEach(tabs => {
  const titles = tabs.querySelectorAll<HTMLElement>('.elementor-tab-title');
  const panels = tabs.querySelectorAll<HTMLElement>('.elementor-tab-content');
  titles.forEach(title => onActivate(title, () => {
    titles.forEach(item => { const active = item.dataset.tab === title.dataset.tab; item.classList.toggle('elementor-active', active); item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; });
    panels.forEach(panel => { const active=panel.dataset.tab===title.dataset.tab; panel.classList.toggle('elementor-active',active); panel.hidden=!active; });
  }));
});
document.querySelectorAll<HTMLElement>('.elementor-accordion .elementor-tab-title,.elementor-toggle .elementor-tab-title').forEach(title => {
  title.tabIndex = 0; title.setAttribute('role', 'button');
  onActivate(title, () => { const panel=title.nextElementSibling as HTMLElement|null; const open=!title.classList.contains('elementor-active'); title.classList.toggle('elementor-active',open);title.setAttribute('aria-expanded',String(open));if(panel){panel.classList.toggle('elementor-active',open);panel.hidden=!open;} });
});
document.querySelectorAll<HTMLElement>('.elementor-toc__body').forEach(container => {
  const list=document.createElement('ol');
  document.querySelectorAll<HTMLElement>('main h2,main h3').forEach((heading,index)=>{ if(heading.closest('.elementor-toc'))return; heading.id ||= `section-${index+1}`; const item=document.createElement('li');const link=document.createElement('a');link.href=`#${heading.id}`;link.textContent=heading.textContent;item.append(link);list.append(item); });
  container.replaceChildren(list);
});
document.querySelectorAll<HTMLElement>('.elementor-headline-dynamic-wrapper').forEach(wrapper=>{
  const words=[...wrapper.querySelectorAll<HTMLElement>('.elementor-headline-dynamic-text')];if(!words.length)return;let index=0;
  const show=()=>words.forEach((word,i)=>{word.hidden=i!==index;word.classList.toggle('elementor-headline-text-active',i===index);});show();
  if(!reducedMotion.matches)setInterval(()=>{index=(index+1)%words.length;show();},3000);
});

// Preserve the article's embedded videos without the Elementor player loader.
document.querySelectorAll<HTMLElement>('[data-video]').forEach(widget=>{
  const source=new URL(widget.dataset.video!);
  const videoId=source.hostname.includes('youtu.be')?source.pathname.slice(1):source.searchParams.get('v');
  let embed=source.href;
  if(videoId && /^[\w-]+$/.test(videoId)) {
    embed=`https://www.youtube-nocookie.com/embed/${videoId}`;
    const start=parseInt(source.searchParams.get('t') || '0',10);if(start>0)embed+=`?start=${start}`;
  }
  const iframe=document.createElement('iframe');iframe.src=embed;iframe.title=widget.closest('section')?.querySelector('h2,h3')?.textContent || 'Article video';iframe.loading='lazy';iframe.allow='fullscreen; picture-in-picture';iframe.allowFullscreen=true;iframe.className='static-video';
  widget.querySelector('.elementor-widget-container')?.replaceChildren(iframe);
});
