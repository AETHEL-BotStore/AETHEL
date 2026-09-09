(function () {
  'use strict';

  var COUNTER_ID = 112127265;
  var state = {
    time30: false,
    scroll50: false,
    demo: false,
    pricing: false
  };
  var sent = {};
  var primarySessionKey = 'aethel_direct_qualified_lead_sent';
  var query = new URLSearchParams(window.location.search);

  function sendGoal(name, params) {
    if (typeof window.ym !== 'function') return;
    window.ym(COUNTER_ID, 'reachGoal', name, params || {});
  }

  function goalOnce(name, params) {
    if (sent[name]) return;
    sent[name] = true;
    sendGoal(name, params);
  }

  function engagementScore() {
    return (state.time30 ? 1 : 0) +
      (state.scroll50 ? 1 : 0) +
      (state.demo ? 2 : 0) +
      (state.pricing ? 1 : 0);
  }

  function campaignParams() {
    return {
      landing: 'direct',
      utm_source: query.get('utm_source') || '',
      utm_medium: query.get('utm_medium') || '',
      utm_campaign: query.get('utm_campaign') || '',
      utm_content: query.get('utm_content') || '',
      utm_term: query.get('utm_term') || '',
      yclid_present: query.has('yclid') ? 'yes' : 'no'
    };
  }

  var attribution = campaignParams();
  if (typeof window.ym === 'function') {
    window.ym(COUNTER_ID, 'params', {direct_landing: attribution});
  }

  function setupAttributedTelegramLinks() {
    var BOT_START_URL = 'https://t.me/AETHEL_Store_bot?start=';
    var links = document.querySelectorAll('a[data-direct-cta="bot"]');
    if (!links.length) return;

    var positionCodes = {
      header: 'h',
      hero: 'r',
      'after-demo': 'd',
      personal: 'p',
      studio: 's',
      results: 'o',
      final: 'f',
      'mobile-sticky': 'm'
    };

    function cleanDigits(value, maxLength) {
      var cleaned = String(value || '').replace(/\D/g, '').slice(0, maxLength);
      return cleaned || '0';
    }

    function cleanClientId(value) {
      var cleaned = String(value || '').replace(/\D/g, '').slice(0, 32);
      return /^[0-9]{5,32}$/.test(cleaned) ? cleaned : '';
    }

    function setStartParameter(parameter, method) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(parameter)) return;
      links.forEach(function (link) {
        link.href = BOT_START_URL + parameter;
        link.dataset.metrikaAttribution = method;
      });
    }

    function applyClientId(clientId) {
      clientId = cleanClientId(clientId);
      if (!clientId) return;

      var campaignId = cleanDigits(query.get('utm_campaign'), 14);
      var adId = cleanDigits((query.get('utm_content') || '').split('_')[0], 22);

      links.forEach(function (link) {
        var position = link.getAttribute('data-cta-position') || 'unknown';
        var positionCode = positionCodes[position] || 'u';
        var payload = ['ymc', clientId, campaignId, adId, positionCode].join('_');

        // Telegram допускает не более 64 символов в start-параметре.
        if (payload.length > 64) {
          payload = ['ymc', clientId, campaignId, '0', positionCode].join('_');
        }
        if (payload.length <= 64) {
          link.href = BOT_START_URL + payload;
          link.dataset.metrikaAttribution = 'client_id';
        }
      });
    }

    // Без JavaScript или при блокировке Метрики бот всё равно увидит источник.
    setStartParameter('ref_landing', 'landing');

    // Резервная точная привязка к клику Директа, пока ClientID ещё не получен.
    var yclid = query.get('yclid') || '';
    if (/^[A-Za-z0-9_-]{5,60}$/.test(yclid)) {
      setStartParameter('ymy_' + yclid, 'yclid');
    }

    // Основной формат одновременно связывает событие с визитом Метрики и
    // сохраняет в базе бота кампанию, объявление и позицию CTA.
    if (typeof window.ym === 'function') {
      window.ym(COUNTER_ID, 'getClientID', function (clientId) {
        applyClientId(clientId);
      });
    }
  }

  setupAttributedTelegramLinks();

  function setupMotion() {
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var revealTargets = document.querySelectorAll([
      '.direct-hero-copy',
      '.direct-hero-visual',
      '.direct-section-heading',
      '.direct-pain-grid article',
      '.direct-inline-cta',
      '.bot-demo-heading',
      '.tg-demo-column',
      '.direct-callout',
      '.direct-step-list li',
      '.direct-format-grid article',
      '.direct-result-list > div',
      '.proof-review-card',
      '.direct-accordion details',
      '.direct-final-card'
    ].join(','));
    var accentTargets = document.querySelectorAll([
      '.direct-hero h1',
      '.direct-button',
      '.direct-arrow-link',
      '.direct-section-heading h2',
      '.direct-callout h2',
      '.direct-final h2'
    ].join(','));

    revealTargets.forEach(function (element, index) {
      element.classList.add('direct-reveal');
      element.style.setProperty('--reveal-delay', String((index % 3) * 70) + 'ms');
    });
    accentTargets.forEach(function (element) {
      element.classList.add('direct-accent');
    });
    document.body.classList.add('motion-ready');

    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealTargets.forEach(function (element) { element.classList.add('is-visible'); });
      accentTargets.forEach(function (element) { element.classList.add('is-visible'); });
      return;
    }

    var motionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        motionObserver.unobserve(entry.target);
      });
    }, {threshold: 0.13, rootMargin: '0px 0px -7% 0px'});

    revealTargets.forEach(function (element) { motionObserver.observe(element); });
    accentTargets.forEach(function (element) { motionObserver.observe(element); });
  }

  setupMotion();

  var progressFill = document.getElementById('progress-fill');
  var progressQueued = false;
  function updateProgress() {
    progressQueued = false;
    if (!progressFill) return;
    var root = document.documentElement;
    var available = root.scrollHeight - root.clientHeight;
    var value = available > 0 ? Math.min(100, Math.max(0, (root.scrollTop / available) * 100)) : 0;
    progressFill.style.width = value + '%';
  }
  window.addEventListener('scroll', function () {
    if (progressQueued) return;
    progressQueued = true;
    window.requestAnimationFrame(updateProgress);
  }, {passive: true});
  updateProgress();

  var visibleSeconds = 0;
  var engagementTimer = window.setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    visibleSeconds += 1;
    if (visibleSeconds < 30) return;
    state.time30 = true;
    goalOnce('direct_engaged_30s', attribution);
    window.clearInterval(engagementTimer);
  }, 1000);

  function checkScroll() {
    var root = document.documentElement;
    var available = root.scrollHeight - root.clientHeight;
    if (available <= 0) return;
    var depth = Math.round((root.scrollTop / available) * 100);
    if (depth >= 50) {
      state.scroll50 = true;
      goalOnce('direct_scroll_50', Object.assign({depth: depth}, attribution));
      document.removeEventListener('scroll', checkScroll);
    }
  }
  document.addEventListener('scroll', checkScroll, {passive: true});

  var formats = document.getElementById('formats');
  if (formats && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      state.pricing = true;
      goalOnce('direct_pricing_view', attribution);
      observer.disconnect();
    }, {threshold: 0.3});
    observer.observe(formats);
  }

  document.addEventListener('click', function (event) {
    var demoControl = event.target.closest && event.target.closest('[data-client],[data-admin]');
    if (demoControl) {
      state.demo = true;
      goalOnce('direct_demo_start', Object.assign({panel: demoControl.hasAttribute('data-admin') ? 'admin' : 'client'}, attribution));
      if (demoControl.getAttribute('data-client') === 'finish') {
        goalOnce('direct_demo_booking', attribution);
      }
      if (demoControl.getAttribute('data-admin') === 'confirm') {
        goalOnce('direct_demo_complete', attribution);
      }
    }

    var anchor = event.target.closest && event.target.closest('[data-direct-action="demo-anchor"], [data-direct-action="connect-guide"]');
    if (anchor) {
      goalOnce('direct_demo_interest', Object.assign({position: anchor.getAttribute('data-cta-position') || 'page'}, attribution));
    }

    var cta = event.target.closest && event.target.closest('[data-direct-cta]');
    if (!cta) return;

    var destination = cta.getAttribute('data-direct-cta');
    var position = cta.getAttribute('data-cta-position') || 'unknown';
    var goalMap = {
      bot: 'direct_bot_click',
      support: 'direct_support_click',
      channel: 'direct_channel_click'
    };
    var goal = goalMap[destination];
    var params = Object.assign({
      destination: destination,
      cta_position: position,
      engagement_score: engagementScore(),
      attribution_method: cta.dataset.metrikaAttribution || 'not_applicable'
    }, attribution);
    if (goal) sendGoal(goal, params);

    if ((destination === 'bot' || destination === 'support') && engagementScore() >= 2) {
      var primaryAlreadySent = false;
      try {
        primaryAlreadySent = window.sessionStorage.getItem(primarySessionKey) === '1';
      } catch (error) {}
      if (!primaryAlreadySent) {
        goalOnce('direct_qualified_lead', params);
        try {
          window.sessionStorage.setItem(primarySessionKey, '1');
        } catch (error) {}
      }
    }
  });
})();
