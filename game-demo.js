/* 终端回放 + 关键代码查看器（按需加载，见 script.js 里的 loadGameDemo）。
 *
 * 为什么不做 GIF：一段 480×270 的 GIF 动辄几百 KB，字还是糊的。
 * 这里放的是程序自己 printf 出来的字符，三个游戏加起来几十 KB，
 * 清晰、可选中、可缩放，而且它是逐帧的真实 stdout —— 不是"看起来像"的动画。
 *
 * 帧 ↔ 源码行号：每一帧都带着"它是源码第几行打出来的"。那个行号不是手写的
 * 对齐表，是程序自己在 -DTRACE 编译时用 __LINE__ 吐出来的标记（见三个 .c 里的
 * TR() 宏）。所以回放到第 N 帧，下面那条源码带就停在打出这一帧的那几行上 ——
 * 改源码、标记跟着走，对不上是不可能的。
 *
 * 源码文件（assets/games/*.c）不进这个文件，是回放时按需 fetch 的：
 * "能看源码"这件事一个新字节都没多花。
 *
 * 这个文件在用户第一次点「运行演示」之前根本不会被下载。
 */
(function () {
  'use strict';

  var D = null;                 // window.GAME_DEMOS
  var root = null, screenEl = null, countEl = null, barEl = null, noteEl = null;
  var srcEl = null, srcHdEl = null, srcCodeEl = null;
  var playBtn = null, codeBtn = null;
  var key = null, idx = 0, timer = 0, playing = false, mode = 'frames';
  var lastFocus = null;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var srcCache = {};            // 文件名 → 源码行数组
  var srcWant = {};             // 正在拉的，避免同一帧里连拉好几次
  var srcLines = null;          // 当前这一局的源码
  var CTX = 3;                  // 源码带：命中行的上下各留几行

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

  function frame() { return D[key].frames[idx]; }

  function frameText() {
    if (mode === 'code') {
      var sn = D[key].snips[0];
      return sn.lines.join('\n');
    }
    return frame()[0].join('\n');
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

  /* 源码是按需拉的：不点开演示就不会下，也就不会为了"看得到源码"
     让首屏多背一个字节。拉回来缓存住，三个游戏之间来回切也只下一次。 */
  function loadSrc(file, done) {
    if (srcCache[file]) return done(srcCache[file]);
    if (srcWant[file]) { srcWant[file].push(done); return; }
    srcWant[file] = [done];
    window.fetch('assets/games/' + file).then(function (r) {
      return r.text();
    }).then(function (t) {
      srcCache[file] = t.split('\n');
      srcWant[file].forEach(function (f) { f(srcCache[file]); });
      srcWant[file] = null;
    }).catch(function () {
      srcWant[file].forEach(function (f) { f(null); });
      srcWant[file] = null;
    });
  }

  /* 下面那条源码带：只画命中行的上下文，命中行加底色。
     为什么是竖着一条而不是并排第二栏 —— 这个窗口本来就窄，
     横着切一刀两边都读不了；竖着放，像调试器停在断点上。 */
  function renderSrc() {
    if (!srcEl) return;
    if (mode !== 'frames' || !D || !D[key]) { srcEl.hidden = true; return; }
    var t = frame()[1] || [];
    if (!t.length) { srcEl.hidden = true; return; }
    if (!srcLines) {
      srcEl.hidden = true;
      loadSrc(D[key].file, function (ls) {
        if (!root) return;
        if (!ls) return;                 // 拉不到就不显示，别把回放也拖下水
        srcLines = ls;
        renderSrc();
      });
      return;
    }

    /* 最后一个是 show()/draw() 那一行（这一帧的出处），前面几个是
       这一帧之前真正跑过的分支。想让人看的是分支，所以焦点给前一个；
       而"出处"那一行通常离得很远、不在窗口里，就别写进标题里让人找。 */
    var hit = {}, i;
    for (i = 0; i < t.length; i++) hit[t[i]] = 1;
    /* 同一个标记会出现好几次（比如连着六个"这个格子已经翻开了"），
       标题里去掉重复 —— 重复了几次，画面本身已经写着了。 */
    var acts = [];
    for (i = 0; i < t.length - 1; i++) {
      if (acts.indexOf(t[i]) < 0) acts.push(t[i]);
    }
    var draw = t[t.length - 1];
    /* 窗口：几个命中行挨得近就一起框进来，离得太远就只留最后那一个
       （把两处隔着一百行的代码硬塞进七行窗口里，等于两边都看不清）。
       范围只看 acts，不能把 draw 那一行算进来 —— 它通常离得很远，
       一算进来跨度就爆掉，永远走"只留一个"的分支。 */
    var lo = Infinity, hi = -Infinity;
    for (i = 0; i < acts.length; i++) {
      if (acts[i] < lo) lo = acts[i];
      if (acts[i] > hi) hi = acts[i];
    }
    if (!acts.length) { lo = hi = draw; }
    /* 跨度太大就只框最后一个动作 —— 源码带只有 7 行高，
       硬把两处隔得远的代码一起框进来，结果是两处都在屏幕外。
       标题里仍然会把走过的行号都列出来，所以信息没丢。 */
    if (hi - lo > 4) { lo = hi = acts[acts.length - 1]; }
    var from = Math.max(1, lo - CTX);
    var to = Math.min(srcLines.length, hi + CTX);

    var out = [];
    for (i = from; i <= to; i++) {
      var ln = i, txt = srcLines[i - 1] || '';
      if (txt.length > 96) txt = txt.slice(0, 96) + '…';
      out.push('<span class="gdm__src-l' + (hit[ln] ? ' is-hit' : '') + '">' +
        '<i>' + ln + '</i>' + esc(txt) + '</span>');
    }
    srcCodeEl.innerHTML = out.join('');
    srcHdEl.innerHTML = '<b>' + esc(D[key].file) + '</b><span>' +
      (acts.length
        ? '这一帧之前走过第 ' + acts.join('、') + ' 行'
        : '这一帧是 ' + (D[key].fn || 'draw') + '() 第 ' + draw + ' 行画出来的') +
      '</span>';
    srcEl.hidden = false;
  }

  function render() {
    if (!root) return;
    if (mode === 'code') {
      screenEl.innerHTML = esc(codeText());
      countEl.textContent = D[key].snips.length + ' 段';
      barEl.style.width = '100%';
      if (srcEl) srcEl.hidden = true;
      return;
    }
    screenEl.innerHTML = paint(frameText());
    countEl.textContent = (idx + 1) + ' / ' + D[key].frames.length;
    barEl.style.width = ((idx + 1) / D[key].frames.length * 100) + '%';
    renderSrc();
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
    srcEl = srcHdEl = srcCodeEl = null;
    srcLines = null;
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
        /* 这条源码带是给键盘/读屏隐掉的：它跟屏幕上的画面说的是同一件事，
           重复播报只会更吵；想读代码的人有「关键代码」那一路。 */
        '<div class="gdm__src" aria-hidden="true" hidden>' +
          '<p class="gdm__src-hd"></p>' +
          '<pre class="gdm__src-code"></pre>' +
        '</div>' +
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
    srcEl = root.querySelector('.gdm__src');
    srcHdEl = root.querySelector('.gdm__src-hd');
    srcCodeEl = root.querySelector('.gdm__src-code');

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
    srcLines = srcCache[D[key].file] || null;
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
