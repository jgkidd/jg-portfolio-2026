/** Keep native scrolling in the middle copy of an infinitely repeating gallery. */
export function loopPosition(position: number, start: number, cycle: number): number {
  if (cycle <= 0) return start;
  // Native snapping can settle a fraction of a pixel either side of a seam.
  const seam = start + Math.round((position - start) / cycle) * cycle;
  if (Math.abs(position - seam) <= 1) return start;
  return start + ((position - start) % cycle + cycle) % cycle;
}

export function nearestSlide(offsets: number[], position: number): number {
  return offsets.reduce((best, offset, index) =>
    Math.abs(offset - position) < Math.abs(offsets[best]! - position) ? index : best, 0);
}

export function initialiseCarousels(reducedMotion: MediaQueryList): void {
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach(widget => {
    widget.querySelectorAll('.carousel-controls,.elementor-swiper-button,.swiper-pagination').forEach(element => element.remove());
    const wrapper = widget.querySelector<HTMLElement>('.swiper-wrapper');
    if (!wrapper) return;
    const slides = [...wrapper.children] as HTMLElement[];
    if (slides.length < 2) return;
    const settings = JSON.parse(widget.dataset.carousel || '{}') as { slides?: number; delay?: number };
    const viewport = wrapper.parentElement!;
    const media = widget.dataset.carouselMedia ? window.matchMedia(widget.dataset.carouselMedia) : undefined;
    const active = () => !media || media.matches;
    const syncMode = () => { wrapper.tabIndex = active() ? 0 : -1; }; 
    viewport.classList.add('static-carousel');
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-roledescription', 'carousel');
    viewport.setAttribute('aria-label', 'Project gallery');
    viewport.style.setProperty('--visible-slides', String(Math.min(settings.slides || 1, 3, slides.length)));
    syncMode();
    wrapper.setAttribute('aria-label', 'Swipe or use arrow keys to browse. Press Space to pause or play.');
    wrapper.setAttribute('aria-live', 'off');

    // Matching copies on both sides allow forward and backward swipes over the seam.
    const copy = (slide: HTMLElement) => {
      const clone = slide.cloneNode(true) as HTMLElement;
      clone.dataset.carouselClone = '';
      clone.setAttribute('aria-hidden', 'true');
      clone.inert = true;
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      return clone;
    };
    wrapper.prepend(...slides.map(copy));
    wrapper.append(...slides.map(copy));
    const allSlides = [...wrapper.children] as HTMLElement[];
    const coverflow = widget.dataset.carouselEffect === 'coverflow';
    const sizeCoverflow = () => {
      if (coverflow) viewport.style.setProperty('--coverflow-slide-width', `${viewport.clientWidth * (window.matchMedia('(max-width: 767px)').matches ? 1 : 0.4)}px`);
    };
    sizeCoverflow();
    const offsets = () => {
      const origin = allSlides[0]!.getBoundingClientRect().left;
      return allSlides.map(slide => slide.getBoundingClientRect().left - origin);
    };
    const updateCoverflow = () => {
      if (!coverflow) return;
      const positions = offsets();
      const step = positions[1]! - positions[0]!;
      allSlides.forEach((slide, slideIndex) => {
        const progress = Math.max(-1, Math.min(1, (positions[slideIndex]! - wrapper.scrollLeft) / step));
        const image = slide.querySelector<HTMLElement>('.coverflow-image');
        if (image) image.style.transform = window.matchMedia('(max-width: 767px)').matches
          ? 'none'
          : `perspective(1200px) rotateY(${-progress * 30}deg) scale(${1 - Math.abs(progress) * 0.15})`;
      });
    };
    const start = () => offsets()[slides.length]!;
    const cycle = () => offsets()[slides.length * 2]! - start();
    const delay = Math.max(settings.delay || 5000, 2500);
    let index = 0;
    let interacting = false;
    let paused = false;
    let hovered = false;
    let focused = false;
    let autoTimer: ReturnType<typeof setTimeout>;
    let scrollTimer: ReturnType<typeof setTimeout>;
    let mouse: { id: number; x: number; left: number; dragging: boolean } | undefined;
    let suppressClickUntil = 0;
    const indicators: HTMLButtonElement[] = [];
    const updateIndicators = () => indicators.forEach((button, slideIndex) => {
      button.setAttribute('aria-current', String(slideIndex === index));
    });
    if (widget.dataset.carouselPagination === 'bars') {
      const pagination = document.createElement('div');
      pagination.className = 'carousel-pagination';
      pagination.setAttribute('role', 'group');
      pagination.setAttribute('aria-label', 'Choose a slide');
      if (slides.length > 6) pagination.style.setProperty('--indicator-gap', '6px');
      slides.forEach((_slide, slideIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', `Go to slide ${slideIndex + 1} of ${slides.length}`);
        button.addEventListener('click', () => {
          index = slideIndex;
          updateIndicators();
          wrapper.scrollTo({ left: offsets()[slides.length + index]!, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
          restartAutoplay();
        });
        indicators.push(button);
        pagination.append(button);
      });
      viewport.after(pagination);
      updateIndicators();
    }

    const restartAutoplay = () => {
      clearTimeout(autoTimer);
      if (!active() || paused || hovered || focused || reducedMotion.matches || document.hidden || interacting) return;
      autoTimer = setTimeout(() => move(1), delay);
    };
    const normalise = () => {
      if (!active()) return 0;
      const left = loopPosition(wrapper.scrollLeft, start(), cycle());
      if (Math.abs(left - wrapper.scrollLeft) > 1) wrapper.scrollTo({ left, behavior: 'instant' });
      index = nearestSlide(offsets().slice(slides.length, slides.length * 2), left);
      updateIndicators();
      return left;
    };
    const settle = () => {
      if (interacting || !active()) return;
      normalise();
      restartAutoplay();
    };
    const move = (step: number) => {
      if (!active()) return;
      const left = normalise();
      const positions = offsets();
      const next = nearestSlide(positions, left) + step;
      index = next % slides.length;
      updateIndicators();
      wrapper.scrollTo({ left: positions[next]!, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      restartAutoplay();
    };
    wrapper.scrollTo({ left: active() ? start() : 0, behavior: 'instant' });
    updateCoverflow();
    wrapper.addEventListener('scroll', () => {
      updateCoverflow();
      clearTimeout(autoTimer);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(settle, 180);
    }, { passive: true });
    wrapper.addEventListener('wheel', () => {
      clearTimeout(autoTimer);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(settle, 180);
    }, { passive: true });
    wrapper.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        move(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === ' ' && event.target === wrapper) {
        event.preventDefault();
        paused = !paused;
        restartAutoplay();
      }
    });

    // Touch and trackpads scroll natively; mouse dragging uses the same scroll track.
    wrapper.addEventListener('pointerdown', event => {
      if (!active() || !event.isPrimary || event.button !== 0) return;
      interacting = true;
      clearTimeout(autoTimer);
      if (event.pointerType === 'mouse') mouse = { id: event.pointerId, x: event.clientX, left: wrapper.scrollLeft, dragging: false };
    });
    wrapper.addEventListener('pointermove', event => {
      if (!mouse || mouse.id !== event.pointerId) return;
      const distance = event.clientX - mouse.x;
      if (!mouse.dragging && Math.abs(distance) < 6) return;
      mouse.dragging = true;
      wrapper.setPointerCapture(event.pointerId);
      wrapper.classList.add('is-dragging');
      wrapper.scrollLeft = mouse.left - distance;
      event.preventDefault();
    });
    const endGesture = (event: PointerEvent) => {
      if (!event.isPrimary || !interacting) return;
      interacting = false;
      if (mouse?.dragging) {
        suppressClickUntil = Date.now() + 400;
        wrapper.classList.remove('is-dragging');
        if (wrapper.hasPointerCapture(mouse.id)) wrapper.releasePointerCapture(mouse.id);
        const positions = offsets();
        wrapper.scrollTo({ left: positions[nearestSlide(positions, wrapper.scrollLeft)]!, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      }
      mouse = undefined;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(settle, 180);
      restartAutoplay();
    };
    window.addEventListener('pointerup', endGesture);
    window.addEventListener('pointercancel', endGesture);
    wrapper.addEventListener('dragstart', event => event.preventDefault());
    wrapper.addEventListener('click', event => {
      if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    widget.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovered = true; restartAutoplay(); } });
    widget.addEventListener('pointerleave', () => { hovered = false; restartAutoplay(); });
    widget.addEventListener('focusin', () => { focused = true; restartAutoplay(); });
    widget.addEventListener('focusout', event => {
      focused = event.relatedTarget instanceof Node && widget.contains(event.relatedTarget);
      restartAutoplay();
    });
    media?.addEventListener('change', () => {
      syncMode();
      requestAnimationFrame(() => {
        wrapper.scrollTo({ left: active() ? offsets()[slides.length + index]! : 0, behavior: 'instant' });
        restartAutoplay();
      });
    });
    document.addEventListener('visibilitychange', restartAutoplay);
    reducedMotion.addEventListener('change', restartAutoplay);
    let previousWidth = viewport.clientWidth;
    new ResizeObserver(() => {
      const width = viewport.clientWidth;
      if (coverflow && width === previousWidth) return;
      previousWidth = width;
      sizeCoverflow();
      wrapper.scrollTo({ left: active() ? offsets()[slides.length + index]! : 0, behavior: 'instant' });
      updateCoverflow();
    }).observe(viewport);
    restartAutoplay();
  });
}
