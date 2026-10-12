/* ============================================================
   姜雨涵 · 个人主页  |  script.js
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. 打字机效果 ---------- */
  var phrases = [
    '网络工程 · 本科生',
    'C / C++ / Python 开发者',
    '动漫爱好者',
    '游戏玩家',
    'AI 探索者'
  ];
  var typedEl = document.getElementById('typed');
  var pi = 0, ci = 0, deleting = false;

  function type() {
    if (!typedEl) return;
    var word = phrases[pi];
    typedEl.textContent = deleting
      ? word.slice(0, --ci)
      : word.slice(0, ++ci);

    var delay = deleting ? 55 : 105;

    if (!deleting && ci === word.length) {
      deleting = true;
      delay = 1500;
    } else if (deleting && ci === 0) {
      deleting = false;
      pi = (pi + 1) % phrases.length;
      delay = 380;
    }
    setTimeout(type, delay);
  }
  if (typedEl) setTimeout(type, 700);

  /* ---------- 2. 滚动显现 ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en, i) {
        if (en.isIntersecting) {
          setTimeout(function () { en.target.classList.add('show'); }, i * 70);
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('show'); });
  }

  /* ---------- 3. 技能条填充 ---------- */
  var bars = document.querySelectorAll('.bar i');
  if ('IntersectionObserver' in window) {
    var bo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          setTimeout(function () { en.target.classList.add('fill'); }, 180);
          bo.unobserve(en.target);
        }
      });
    }, { threshold: 0.4 });
    bars.forEach(function (b) { bo.observe(b); });
  } else {
    bars.forEach(function (b) { b.classList.add('fill'); });
  }

  /* ---------- 4. 数字滚动 ---------- */
  var nums = document.querySelectorAll('.stat-num');
  if ('IntersectionObserver' in window) {
    var no = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var target = parseInt(el.getAttribute('data-count'), 10) || 0;
        var cur = 0, step = Math.max(1, Math.ceil(target / 18));
        var t = setInterval(function () {
          cur += step;
          if (cur >= target) { cur = target; clearInterval(t); }
          el.textContent = cur;
        }, 55);
        no.unobserve(el);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { no.observe(n); });
  } else {
    nums.forEach(function (n) { n.textContent = n.getAttribute('data-count'); });
  }

  /* ---------- 5. 导航滚动态 ---------- */
  var nav = document.querySelector('.nav');
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 6. 复制邮箱 ---------- */
  var copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var mail = copyBtn.getAttribute('data-mail');
      var done = function () { toast('邮箱已复制：' + mail); };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(mail).then(done, function () { legacy(mail, done); });
      } else {
        legacy(mail, done);
      }
    });
  }
  function legacy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); }
    catch (e) { toast('复制失败，请手动复制'); }
    document.body.removeChild(ta);
  }

  /* ---------- 7. Toast ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ---------- 8. 邮件按钮 ---------- */
  var mailBtn = document.getElementById('mailBtn');
  if (mailBtn) {
    var addr = '3356559040@qq.com';
    mailBtn.setAttribute('href', 'mailto:' + addr + '?subject=' +
      encodeURIComponent('你好，姜雨涵！'));
  }

  /* ---------- 9. 主题切换（记住选择） ---------- */
  var root = document.documentElement;
  var toggle = document.getElementById('themeToggle');
  var icon = toggle ? toggle.querySelector('.theme-icon') : null;

  var saved = null;
  try { saved = localStorage.getItem('jyh-theme'); } catch (e) {}
  var prefersLight = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches;
  setTheme(saved || (prefersLight ? 'light' : 'dark'));

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      setTheme(next);
      try { localStorage.setItem('jyh-theme', next); } catch (e) {}
    });
  }
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    if (icon) icon.textContent = t === 'light' ? '☀️' : '🌙';
  }

  /* ---------- 10. 页脚年份 ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- 11. 导航平滑滚动偏移 ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 62;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });
})();
