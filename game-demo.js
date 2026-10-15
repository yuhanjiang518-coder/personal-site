/* 终端回放 + 关键代码查看器（按需加载，见 script.js 里的 loadGameDemo）。
 *
 * 为什么不做 GIF：一段 480×270 的 GIF 动辄几百 KB，字还是糊的。
 * 这里放的是程序自己 printf 出来的字符，三个游戏加起来 30KB，
 * 清晰、可选中、可缩放，而且它是逐帧的真实 stdout —— 不是"看起来像"的动画。
 *
 * 这个文件在用户第一次点「运行演示」之前根本不会被下载。
 */
(function () {
  'use strict';

  var D = null;                 // window.GAME_DEMOS
  var root = null, screenEl = null, countEl = null, barEl = null, noteEl = null;
  var playBtn = null, codeBtn = null;
  var key = null, idx = 0, timer = 0, playing = false, mode = 'frames';
  var lastFocus = null;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CJK = /[\u3000-\u9fff\uff00-\uffef]/;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* 每个字符该是什么颜色。和卡片封面用的是同一套规则，
     所以"封面那张图"和"这里回放的字"看起来是同一个终端。 */
  function tint(ch, game) {
    if (ch === '#') return game === 'snake' ? 'a-body' : 'a-dim';
    if (ch === '@') return 'a-head';
    if (ch === '*') return 'a-mine';
    if (ch === 'F') return 'a-flag';
    if (ch === '.') return 'a-dim';
    if (ch === '[' || ch === ']') return 'a-block';
    if (ch === '+' || ch === '-' || ch === '|') return 'a-line';
    if (ch >= '0' && ch <= '9' && game === 'minesweeper') return 'a-num';
    return 'a-plain';
  }

  function paint(text) {
    var out = '', run = '', cls = null;
    function flush() { if (run) { out += cls ? '<i class="' + cls + '">' + esc(run) + '</i>' : esc(run); run = ''; } }
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var c = (ch === ' ' || ch === '\n') ? null : tint(ch, key);
      if (c !== cls) { flush(); cls = c; }
      run += ch;
    }
    flush();
    return out;
  }

  function frameText() {
    if (mode === 'code') {
      var sn = D[key].snips[0];
      return sn.lines.join('\n');
    }
    return D[key].frames[idx].join('\n');
  }

  function codeText() {
    var out = [];
    D[key].snips.forEach(function (sn, i) {
      out.push('/* ' + D[key].file + ' : 第 ' + sn.from + ' 行起 */');
      sn.lines.forEach(function (l) { out.push(l); });
      out.push('');
    });
    return out.join('\n');
  }

  function render() {
    if (!root) return;
    if (mode === 'code') {
      screenEl.innerHTML = esc(codeText());
      countEl.textContent = D[key].snips.length + ' 段';
      barEl.style.width = '100%';
    } else {
      screenEl.innerHTML = paint(frameText());
      countEl.textContent = (idx + 1) + ' / ' + D[key].frames.length;
      barEl.style.width = ((idx + 1) / D[key].frames.length * 100) + '%';
    }
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = 0;
    playing = false;
    if (playBtn) playBtn.textContent = '播放';
  }

  function tick() {
    if (mode !== 'frames') return;
    if (idx >= D[key].frames.length - 1) { stop(); return; }
    idx++;
    render();
  }

  function play() {
    if (mode !== 'frames' || timer) return;
    if (idx >= D[key].frames.length - 1) idx = 0;
    playing = true;
    if (playBtn) playBtn.textContent = '暂停';
    timer = window.setInterval(tick, D[key].fps || 180);
    render();
  }

  function close() {
    stop();
    if (!root) return;
    root.parentNode.removeChild(root);
    root = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function build() {
    var g = D[key];
    root = document.createElement('div');
    root.className = 'gdm';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', g.title + ' 运行演示');
    root.innerHTML =
      '<div class="gdm__win">' +
        '<div class="gdm__bar">' +
          '<span class="gdm__dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '<p class="gdm__title">' + esc(g.cmd) + '</p>' +
          '<button class="gdm__x" type="button" data-gdm="close" aria-label="关闭">×</button>' +
        '</div>' +
        '<pre class="gdm__screen" aria-live="polite"></pre>' +
        '<p class="gdm__note">' + esc(g.note) + '</p>' +
        '<p class="gdm__plat">平台：' + esc(g.plat) + '</p>' +
        '<div class="gdm__foot">' +
          '<button class="gdm__btn" type="button" data-gdm="play">播放</button>' +
          '<button class="gdm__btn" type="button" data-gdm="prev" aria-label="上一帧">‹</button>' +
          '<button class="gdm__btn" type="button" data-gdm="next" aria-label="下一帧">›</button>' +
          '<button class="gdm__btn" type="button" data-gdm="code">关键代码</button>' +
          '<span class="gdm__count"></span>' +
          '<i class="gdm__prog" aria-hidden="true"><b></b></i>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    screenEl = root.querySelector('.gdm__screen');
    countEl = root.querySelector('.gdm__count');
    barEl = root.querySelector('.gdm__prog > b');
    noteEl = root.querySelector('.gdm__note');
    playBtn = root.querySelector('[data-gdm="play"]');
    codeBtn = root.querySelector('[data-gdm="code"]');

    root.addEventListener('click', function (e) {
      if (e.target === root) { close(); return; }
      var b = e.target.closest ? e.target.closest('[data-gdm]') : null;
      if (!b) return;
      var a = b.getAttribute('data-gdm');
      if (a === 'close') close();
      else if (a === 'play') { stop(); play(); }
      else if (a === 'prev') { stop(); idx = Math.max(0, idx - 1); render(); }
      else if (a === 'next') { stop(); idx = Math.min(D[key].frames.length - 1, idx + 1); render(); }
      else if (a === 'code') {
        stop();
        mode = (mode === 'code') ? 'frames' : 'code';
        codeBtn.textContent = (mode === 'code') ? '回到回放' : '关键代码';
        noteEl.textContent = (mode === 'code')
          ? '从 ' + D[key].file + ' 里按函数名抽出来的原文，没有删改。'
          : D[key].note;
        render();
      }
    });
    root.querySelector('[data-gdm="close"]').focus();
  }

  function open(k, startMode) {
    D = window.GAME_DEMOS;
    if (!D || !D[k]) return;
    if (root) close();
    key = k;
    idx = 0;
    mode = startMode === 'code' ? 'code' : 'frames';
    lastFocus = document.activeElement;
    build();
    if (mode === 'code') {
      codeBtn.textContent = '回到回放';
      noteEl.textContent = '从 ' + D[key].file + ' 里按函数名抽出来的原文，没有删改。';
    }
    render();
    /* 静止用户不自动播：直接把最后一帧（也就是结果）摆出来 */
    if (mode === 'frames') {
      if (reduced) { idx = D[key].frames.length - 1; render(); }
      else play();
    }
  }

  document.addEventListener('keydown', function (e) {
    if (!root) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') { stop(); idx = Math.min(D[key].frames.length - 1, idx + 1); render(); }
    else if (e.key === 'ArrowLeft') { stop(); idx = Math.max(0, idx - 1); render(); }
    else if (e.key === ' ') { e.preventDefault(); stop(); play(); }
  });

  window.GameDemo = { open: open, close: close };
  if (window.__GAME_DEMO_QUEUE) {
    var q = window.__GAME_DEMO_QUEUE;
    window.__GAME_DEMO_QUEUE = null;
    q.forEach(function (a) { open(a[0], a[1]); });
  }
})();
