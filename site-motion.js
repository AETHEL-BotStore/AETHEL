(function () {
  'use strict';

  if (document.body && document.body.classList.contains('direct-page')) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealSelectors = [
    '.hero-grid > *',
    '.seo-hero-grid > *',
    '.seo-hero .seo-article > *',
    '.head-block',
    '.seo-section > .wrap > *',
    '.seo-visual-layout > *',
    '.grid > *',
    '.compare-grid',
    '.trust-strip .wrap',
    '.timeline > *',
    '.pricing-grid > *',
    '.tariff-grid > *',
    '.seo-links > *',
    '.seo-demo-step',
    '.seo-proof > *',
    '.seo-media-frame',
    '.seo-article-visual',
    '.proof-review-card',
    '.seo-proof-spotlight > *',
    '.bot-demo-heading',
    '.tg-demo-column',
    '.acc-item',
    '.faq-item',
    '.case-card',
    '.step-card',
    '.feature-card',
    '.plan-card',
    '.cta-wrapper',
    '.final-cta .container',
    '.legal-card',
    'main > .container > *',
    'body > .container > .header',
    'body > .container > .content',
    'body > .container > .footer',
    '.content > .section'
  ];
  var attentionSelectors = [
    'main h1',
    '.head-block h2',
    '.seo-title',
    '.seo-cta h2',
    '.final-cta h2',
    '.btn-primary',
    '.nav-cta',
    '.btn-cta',
    '.seo-media-frame img',
    '.seo-article-visual img',
    '.proof-review-card img',
    '.proof-feature-card img'
  ];

  function uniqueElements(selectors) {
    var seen = new Set();
    var result = [];
    document.querySelectorAll(selectors.join(',')).forEach(function (element) {
      if (seen.has(element) || element.closest('[data-aethel-no-motion]')) return;
      seen.add(element);
      result.push(element);
    });
    return result;
  }

  var revealTargets = uniqueElements(revealSelectors);
  var attentionTargets = uniqueElements(attentionSelectors);

  revealTargets.forEach(function (element, index) {
    element.classList.add('aethel-reveal');
    element.style.setProperty('--aethel-reveal-delay', String((index % 4) * 65) + 'ms');
    if (element.matches('.seo-visual-copy,.hero-grid > :first-child')) element.classList.add('aethel-from-left');
    if (element.matches('.seo-media-frame,.seo-article-visual,.hero-grid > :last-child')) element.classList.add('aethel-from-right');
  });

  attentionTargets.forEach(function (element) {
    if (element.matches('a,button')) element.classList.add('aethel-cta-attention');
    else if (element.matches('img')) element.classList.add('aethel-icon-attention');
    else element.classList.add('aethel-attention');
  });

  document.body.classList.add('aethel-motion-ready');

  var targets = Array.from(new Set(revealTargets.concat(attentionTargets)));
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach(function (element) { element.classList.add('aethel-visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('aethel-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -7% 0px' });

  targets.forEach(function (element) { observer.observe(element); });
}());
