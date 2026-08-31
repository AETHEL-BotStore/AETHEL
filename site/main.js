/* ============================================================
   AETHEL — общий скрипт сайта.
   Подключается на каждой странице: <script src="/main.js" defer></script>
   Отвечает за: мобильное меню, кнопку "наверх", аккордеоны (FAQ/гайд).
============================================================ */
(function(){
  // Индикатор прогресса прочтения страницы (тонкая полоса под шапкой)
  var fill = document.getElementById('progress-fill');
  if(fill){
    var updateProgress = function(){
      var h = document.documentElement;
      var scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
      fill.style.width = (isFinite(scrolled) ? scrolled : 0) + '%';
    };
    document.addEventListener('scroll', updateProgress, {passive:true});
    updateProgress();
  }

  // Мобильное меню
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if(toggle && links){
    toggle.addEventListener('click', function(){
      var open = links.classList.toggle('open');
      toggle.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', open);
    });
    links.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        links.classList.remove('open');
        toggle.classList.remove('active');
      });
    });
  }

  // Кнопка "наверх"
  var toTop = document.getElementById('toTop');
  if(toTop){
    document.addEventListener('scroll', function(){
      toTop.classList.toggle('show', window.scrollY > 700);
    }, {passive:true});
    toTop.addEventListener('click', function(){ window.scrollTo({top:0, behavior:'smooth'}); });
  }

  /* Аккордеон: работает с любой разметкой вида
     <div class="acc-item">
       <button class="acc-trigger">...<span class="chev">✕</span></button>
       <div class="acc-body"><div class="acc-body-inner">...</div></div>
     </div>
     Поддерживает вложенные аккордеоны (например, внутри "Настроек" в гайде)
     без обрезания контента — после открытия высота снимается ('none'),
     а перед закрытием сначала фиксируется в px, чтобы было от чего анимировать. */
  function openPanel(item, body){
    item.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    var onEnd = function(e){
      if(e.propertyName !== 'max-height') return;
      body.removeEventListener('transitionend', onEnd);
      if(item.classList.contains('open')) body.style.maxHeight = 'none';
    };
    body.addEventListener('transitionend', onEnd);
  }
  function closePanel(item, body){
    if(body.style.maxHeight === 'none' || body.style.maxHeight === ''){
      body.style.maxHeight = body.scrollHeight + 'px';
      void body.offsetHeight;
    }
    requestAnimationFrame(function(){ body.style.maxHeight = '0px'; });
    item.classList.remove('open');
  }
  function growAncestors(el){
    var ancestorBody = el.closest('.acc-body');
    if(!ancestorBody || ancestorBody.style.maxHeight === 'none') return;
    ancestorBody.style.maxHeight = ancestorBody.scrollHeight + 'px';
  }
  document.querySelectorAll('.acc-item').forEach(function(item){
    var trigger = item.querySelector(':scope > .acc-trigger');
    var body = item.querySelector(':scope > .acc-body');
    if(!trigger || !body) return;
    trigger.addEventListener('click', function(e){
      e.stopPropagation();
      if(item.classList.contains('open')){ closePanel(item, body); }
      else { openPanel(item, body); growAncestors(item); }
    });
  });

  // Открыть нужный акк.-пункт, если в ссылке есть #якорь
  window.addEventListener('load', function(){
    if(location.hash){
      var target = document.querySelector(location.hash);
      var accItem = target && target.closest ? target.closest('.acc-item') : null;
      if(accItem){
        var body = accItem.querySelector(':scope > .acc-body');
        openPanel(accItem, body);
      }
    }
  });
})();
