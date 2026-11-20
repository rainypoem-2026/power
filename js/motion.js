/*
  GYEOL motion — GSAP + ScrollTrigger + ScrollSmoother

  Markup hooks (see index.html):
    data-intro                 hero elements animated once on load
    data-reveal                fades/slides up when scrolled into view ("card" = with a slight rotation)
    data-reveal-group          its children reveal one after another
    data-parallax[="strong"]   frame whose <img> drifts inside it while scrolling (and zooms on hover)
    data-depth="0.2"           block that moves at a different speed from the page (desktop only)

  Interaction patterns (Woodwrights-style):
    #site-top                  fixed bar: transparent over the hero, solid after it, hides while scrolling down
    .collection__hero,
    .contact__aside            stay pinned beside their taller neighbour column (desktop only)
    .promise-item              steps highlight one by one every 3s while the section is on screen

  With prefers-reduced-motion: reduce, the scroll/parallax effects don't run and the page scrolls natively.
*/
(function () {
  var root = document.documentElement;
  function showAll() { root.classList.remove('js-motion'); }

  // Runs with or without GSAP so the fixed header always stays readable.
  setupTopBar();

  if (!window.gsap || !window.ScrollTrigger || !window.ScrollSmoother) {
    showAll();
    return;
  }
  window.__gyeolMotionReady = true;

  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

  var smoother = null;
  var canHover = window.matchMedia('(hover: hover)').matches;
  var mm = gsap.matchMedia();

  // ---------------------------------------------------------------- all sizes
  mm.add('(prefers-reduced-motion: no-preference)', function () {
    smoother = ScrollSmoother.create({
      wrapper: '#smooth-wrapper',
      content: '#smooth-content',
      smooth: 1.2,        // seconds the content takes to catch up with the scrollbar
      smoothTouch: 0.1,   // light smoothing on touch devices
      effects: true
    });

    var cleanups = [];
    introTimeline();
    heroParallax();
    cleanups.push(imageParallax());
    reveals();
    promiseWordmark();
    cleanups.push(promiseCycle());

    // Tweens above have set their own start values, so the CSS pre-hide can go.
    showAll();

    return function () {
      cleanups.forEach(function (fn) { if (fn) fn(); });
      smoother = null;
      showAll();
    };
  });

  // ------------------------------------------------- desktop-only layers & pins
  mm.add('(prefers-reduced-motion: no-preference) and (min-width: 992px)', function () {
    pinBeside('.collection__hero', '.collection__side');
    pinBeside('.contact__aside', '.contact__info');

    gsap.utils.toArray('[data-depth]').forEach(function (el) {
      var depth = parseFloat(el.getAttribute('data-depth')) || 0.2;
      var travel = function () { return window.innerHeight * depth * 0.5; };
      gsap.fromTo(el,
        { y: function () { return travel(); } },
        {
          y: function () { return -travel(); },
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
        });
    });
  });

  mm.add('(prefers-reduced-motion: reduce)', showAll);

  // ------------------------------------------------------------------ pieces
  function setupTopBar() {
    var bar = document.getElementById('site-top');
    var hero = document.querySelector('.hero');
    if (!bar || !hero) return;

    var lastY = window.scrollY;
    var ticking = false;

    function update() {
      ticking = false;
      var y = window.scrollY;
      var pastHero = y > hero.offsetHeight - bar.offsetHeight;
      var goingDown = y > lastY + 2;
      var goingUp = y < lastY - 2;
      bar.classList.toggle('is-solid', pastHero);
      if (!pastHero || goingUp) bar.classList.remove('is-hidden');
      else if (goingDown && !bar.contains(document.activeElement)) bar.classList.add('is-hidden');
      lastY = y;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    // Keyboard users tabbing into the nav always get it back.
    bar.addEventListener('focusin', function () { bar.classList.remove('is-hidden'); });
    update();
  }

  function introTimeline() {
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo('.hero__img', { scale: 1.12 }, { scale: 1, duration: 2.4, ease: 'power2.out' }, 0)
      .fromTo('.site-header', { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 1 }, 0.3)
      .fromTo('.hero__kicker', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1 }, 0.45)
      .fromTo('.hero__title .line > span', { opacity: 0, yPercent: 110 }, { opacity: 1, yPercent: 0, duration: 1.3, stagger: 0.14 }, 0.55)
      .fromTo('.hero__cta', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1 }, 1.0);
  }

  function heroParallax() {
    var trigger = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    // Photo sinks slower than the page, copy rises faster and fades out.
    gsap.to('.hero__img', { yPercent: 18, ease: 'none', scrollTrigger: trigger });
    gsap.to('.hero__content', { y: -140, opacity: 0, ease: 'none', scrollTrigger: trigger });
  }

  function imageParallax() {
    var listeners = [];
    gsap.utils.toArray('[data-parallax]').forEach(function (frame) {
      var img = frame.querySelector('img');
      if (!img) return;
      var amount = frame.getAttribute('data-parallax') === 'strong' ? 14 : 8; // % of image height
      // Scale up just enough that the moving image never shows the frame's edge.
      var baseScale = 1 + (amount * 2.4) / 100;
      gsap.set(img, { scale: baseScale, transformOrigin: '50% 50%' });
      gsap.fromTo(img,
        { yPercent: -amount },
        {
          yPercent: amount,
          ease: 'none',
          scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true }
        });

      // Slow hover zoom, layered on top of the parallax (scale vs. yPercent don't collide).
      if (canHover) {
        var enter = function () { gsap.to(img, { scale: baseScale * 1.06, duration: 0.9, ease: 'power2.out', overwrite: 'auto' }); };
        var leave = function () { gsap.to(img, { scale: baseScale, duration: 0.9, ease: 'power2.out', overwrite: 'auto' }); };
        frame.addEventListener('mouseenter', enter);
        frame.addEventListener('mouseleave', leave);
        listeners.push([frame, enter, leave]);
      }
    });
    return function () {
      listeners.forEach(function (l) {
        l[0].removeEventListener('mouseenter', l[1]);
        l[0].removeEventListener('mouseleave', l[2]);
      });
    };
  }

  function reveals() {
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      var isCard = el.getAttribute('data-reveal') === 'card';
      gsap.fromTo(el,
        { opacity: 0, y: isCard ? 80 : 40, rotate: isCard ? -3 : 0 },
        {
          opacity: 1, y: 0, rotate: 0, duration: isCard ? 1.4 : 1.1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
    });

    gsap.utils.toArray('[data-reveal-group]').forEach(function (group) {
      gsap.fromTo(group.children,
        { opacity: 0, y: 40 },
        {
          opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.12,
          scrollTrigger: { trigger: group, start: 'top 85%', once: true }
        });
    });
  }

  function promiseWordmark() {
    gsap.fromTo('.promise__bg-word',
      { xPercent: 5 },
      {
        xPercent: -35,
        ease: 'none',
        scrollTrigger: { trigger: '.promise', start: 'top bottom', end: 'bottom top', scrub: true }
      });
  }

  // Steps light up in turn (3s each) like an auto-playing process list.
  // Pauses off-screen and while hovered; hovering a step selects it.
  function promiseCycle() {
    var section = document.querySelector('.promise');
    var grid = document.querySelector('.promise__grid');
    var items = gsap.utils.toArray('.promise-item');
    if (!section || !grid || !items.length) return null;
    var bars = items.map(function (el) { return el.querySelector('.promise-item__bar'); });

    var index = 0;
    var tween = null;
    var hovering = false;
    var inView = false;

    function activate(i, holdFull) {
      index = i;
      items.forEach(function (el, n) { el.classList.toggle('is-active', n === i); });
      bars.forEach(function (bar, n) { if (n !== i) gsap.to(bar, { scaleX: 0, duration: 0.4, overwrite: true }); });
      if (tween) tween.kill();
      if (holdFull) {
        tween = null;
        gsap.to(bars[i], { scaleX: 1, duration: 0.4, overwrite: true });
        return;
      }
      tween = gsap.fromTo(bars[i], { scaleX: 0 }, {
        scaleX: 1, duration: 3, ease: 'none', overwrite: true, paused: !inView,
        onComplete: function () { activate((index + 1) % items.length); }
      });
    }

    function onGridEnter() { hovering = true; activate(index, true); }
    function onGridLeave() { hovering = false; activate(index); }
    var itemHandlers = items.map(function (el, n) {
      var fn = function () { if (hovering && n !== index) activate(n, true); };
      el.addEventListener('mouseenter', fn);
      return fn;
    });

    section.classList.add('is-cycling');
    activate(0);
    grid.addEventListener('mouseenter', onGridEnter);
    grid.addEventListener('mouseleave', onGridLeave);

    ScrollTrigger.create({
      trigger: grid, start: 'top 85%', end: 'bottom 15%',
      onToggle: function (self) {
        inView = self.isActive;
        if (tween) { if (inView) tween.resume(); else tween.pause(); }
      }
    });

    return function () {
      if (tween) tween.kill();
      section.classList.remove('is-cycling');
      items.forEach(function (el, n) {
        el.classList.remove('is-active');
        el.removeEventListener('mouseenter', itemHandlers[n]);
      });
      gsap.set(bars, { scaleX: 0 });
      grid.removeEventListener('mouseenter', onGridEnter);
      grid.removeEventListener('mouseleave', onGridLeave);
    };
  }

  // Keep one column in place while the taller column beside it scrolls past.
  function pinBeside(pinSelector, besideSelector) {
    var pinEl = document.querySelector(pinSelector);
    var beside = document.querySelector(besideSelector);
    if (!pinEl || !beside) return;
    ScrollTrigger.create({
      trigger: pinEl,
      pin: true,
      pinSpacing: false,
      start: 'top 120px',
      end: function () { return '+=' + Math.max(0, beside.offsetHeight - pinEl.offsetHeight); },
      invalidateOnRefresh: true
    });
  }

  // ------------------------------------------------- in-page anchor links
  // ScrollSmoother moves the content with transforms, so native #hash jumps
  // must be routed through smoother.scrollTo.
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href^="#"]');
    if (!link || !smoother) return;
    var hash = link.getAttribute('href');
    if (hash.length < 2) return;
    var target = document.querySelector(hash);
    if (!target) return;
    event.preventDefault();
    if (target.id === 'top') {
      smoother.scrollTo(0, true);
    } else {
      var bar = document.getElementById('site-top');
      var offset = bar ? bar.offsetHeight : 0;
      smoother.scrollTo(target, true, 'top ' + offset + 'px');
    }
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    history.replaceState(null, '', hash);
  });

  // Webfonts change text heights; recalculate trigger positions once they're in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
