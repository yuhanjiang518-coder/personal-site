/* TechText —— 从 reactbits.dev/text-animations/tech-text 移植。
 *
 * 原版是 canvas 2D（无依赖）：把文字按字切成精灵，每个字两套 ——
 * 实心填充 + 虚线描边（描边后再用 destination-out 把填充抠掉，于是只剩虚线轮廓）。
 * 指针扫过时，镜片下的那个字从实心淡入成虚线轮廓，同时弹出测量框、四角柄、
 * 沿框游走的小方块，以及一枚写着「字 + 尺寸」的标注。
 *
 * 移植时有意改掉的三处（都跟"标题"这个用法有关）：
 *   · **文字仍然留在 DOM 里**：原来的文字包进 .tt-sr，用 color: transparent 隐身，
 *     但它还是在无障碍树和 SEO 里。canvas 只是叠在上面的视觉层。
 *     效果没跑起来 / 被门控掉 / forced-colors 模式下，标题就是普通的标题。
 *   · **去掉自动缩放**：原版会把字号 fit 进容器（width*0.9 / height*0.66 两个约束）。
 *     标题的字号由站点排版决定，不该被 canvas 再调一次，所以直接用计算字号。
 *   · **默认不可拖拽**：拽字母要 setPointerCapture，在标题上会和滚动抢事件。
 */
(function () {
  'use strict';

  var LABEL_FONT = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var FALLOFF_STEPS = 8;
  var SPRING = 320;
  var DAMPING = 22;
  var PAD = 22;            // canvas 比文字框每边外扩的像素：给测量框、角柄、游走方块留地方

  function approach(current, target, dt, seconds) {
    return current + (target - current) * (1 - Math.exp(-dt / seconds));
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // 把任意 CSS 颜色换算成 [r,g,b]。
  // 两个坑，都踩过：
  //   · 正则解析不行 —— 站点的颜色是 oklch() 写法（标题 oklch(.28 .02 340)，
  //     主色 oklch(.55 .16 340)）。正则从 "oklch(.55 .16 340)" 里抓出
  //     [0.55, 0.16, 340] 当 rgb 用，被钳成 rgb(1,0,255)，HUD 变成一团亮蓝。
  //   · 读回 ctx.fillStyle 也归一不了 —— 现代颜色空间下 Chrome 会把 oklch()
  //     原样存回来，不会转成 #rrggbb。
  // 所以老老实实画一个像素再读回来：任何颜色空间都会被转成 sRGB 字节。
  function parseColor(value, fallback) {
    try {
      var c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      var g = c.getContext('2d', { willReadFrequently: true });
      if (!g) return fallback;
      g.fillStyle = '#000000';
      g.fillStyle = String(value || '');
      g.fillRect(0, 0, 1, 1);
      var px = g.getImageData(0, 0, 1, 1).data;
      return [px[0], px[1], px[2]];
    } catch (e) { return fallback; }
  }

  function rgba(rgb, alpha) {
    return 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', ' + alpha + ')';
  }

  function noise() {
    var h = 2166136261;
    for (var i = 0; i < arguments.length; i++) {
      h = Math.imul(h ^ (arguments[i] | 0), 16777619);
      h ^= h >>> 13;
      h = Math.imul(h, 0x5bd1e995);
      h ^= h >>> 15;
    }
    return (h >>> 0) / 4294967296;
  }

  function signed(v) { return v > 0 ? '+' + v : v < 0 ? '\u2212' + -v : '0'; }

  function num(el, name, dflt) {
    var v = el.getAttribute('data-tt-' + name);
    if (v === null || v === '') return dflt;
    var n = Number(v);
    return isNaN(n) ? dflt : n;
  }

  function flag(el, name, dflt) {
    var v = el.getAttribute('data-tt-' + name);
    if (v === null) return dflt;
    return v !== '0' && v !== 'false';
  }

  function init(host) {
    var text = (host.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;

    // 1) 文字搬进 .tt-sr（隐身但保留语义与占位），canvas 叠在它上面
    var sr = document.createElement('span');
    sr.className = 'tt-sr';
    sr.textContent = text;
    host.textContent = '';
    host.appendChild(sr);
    var canvas = document.createElement('canvas');
    canvas.className = 'tt-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    sr.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var scratch = document.createElement('canvas');
    var scratchCtx = scratch.getContext('2d');
    if (!ctx || !scratchCtx) { host.textContent = text; return null; }

    // 注意：计算样式要从 host（h2）读，不能从 .tt-sr 读 ——
    // .tt-sr 在 CSS 里被设成 color:transparent 用来隐身，
    // 从它身上读颜色会拿到 rgba(0,0,0,0)，于是所有精灵都画成透明的（白忙一场）。
    // host 上的字体、字重、字号、字距、颜色都会被 .tt-sr 继承，所以从 host 读是对的。
    var cs = getComputedStyle(host);
    var S = {
      fontFamily: cs.fontFamily || 'sans-serif',
      fontWeight: parseInt(cs.fontWeight, 10) || 700,
      fontSize: parseFloat(cs.fontSize) || 48,
      letterSpacingPx: parseFloat(cs.letterSpacing) || 0,
      color: cs.color,
      accent: cs.getPropertyValue('--tt-accent').trim() || cs.color,
      strokeWidth: num(host, 'stroke', 1.4),
      dashLength: num(host, 'dash', 4),
      dashGap: num(host, 'gap', 2.5),
      lineStyle: host.getAttribute('data-tt-line') || 'dashed',
      reveal: host.getAttribute('data-tt-reveal') || 'letter',
      specks: num(host, 'specks', 8),
      selection: flag(host, 'selection', true),
      labels: flag(host, 'labels', true),
      draggable: flag(host, 'draggable', false),
      sweep: flag(host, 'sweep', true),
      speed: num(host, 'speed', 0.6),
      reach: num(host, 'reach', 160),
      softness: num(host, 'softness', 0.7)
    };
    S.colorRgb = parseColor(S.color, [0, 0, 0]);
    S.accentRgb = parseColor(S.accent, S.colorRgb);

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var width = 1, height = 1, dpr = 1;
    var raf = 0, last = 0, visible = false, alive = true;
    var layoutKey = '', requestedFont = '';
    var view = null, glyphs = [], presence = 0, clock = 0, pulse = 0;
    var placed = false, dragging = -1;
    var pointer = { x: 0, y: 0, inside: false };
    var grab = { x: 0, y: 0 };
    var lens = { x: 0, y: 0 };
    var frame = { x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, index: -1 };

    function fontFor(size) {
      return S.fontWeight + ' ' + size + 'px ' + S.fontFamily;
    }

    function setFont(target, size) {
      target.font = fontFor(size);
      if ('letterSpacing' in target) target.letterSpacing = S.letterSpacingPx + 'px';
      target.textAlign = 'left';
      target.textBaseline = 'alphabetic';
    }

    function sprite(glyph, stroke) {
      var pad = Math.ceil(S.strokeWidth * 2 + 4);
      var left = glyph.box.x1 - pad;
      var top = glyph.box.y1 - pad;
      var w = Math.max(2, Math.ceil(glyph.box.x2 - glyph.box.x1 + pad * 2));
      var h = Math.max(2, Math.ceil(glyph.box.y2 - glyph.box.y1 + pad * 2));
      var image = document.createElement('canvas');
      image.width = Math.max(1, Math.ceil(w * dpr));
      image.height = Math.max(1, Math.ceil(h * dpr));
      var c = image.getContext('2d');
      if (!c) return { image: image, left: left, top: top };
      c.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
      setFont(c, view.size);
      if (stroke) {
        c.lineJoin = 'round';
        c.lineWidth = S.strokeWidth * 2;
        c.lineCap = 'butt';
        c.strokeStyle = S.color;
        if (S.lineStyle !== 'solid') c.setLineDash([Math.max(1, S.dashLength), Math.max(1, S.dashGap)]);
        c.strokeText(glyph.char, glyph.x, view.baseline);
        c.setLineDash([]);
        // 描边后把填充抠掉 —— 于是精灵上只剩虚线轮廓
        c.globalCompositeOperation = 'destination-out';
        c.fillStyle = '#000000';
        c.fillText(glyph.char, glyph.x, view.baseline);
        c.globalCompositeOperation = 'source-over';
      } else {
        c.fillStyle = S.color;
        c.fillText(glyph.char, glyph.x, view.baseline);
      }
      return { image: image, left: left, top: top };
    }

    function ensureLayout() {
      var key = [text, S.fontFamily, S.fontWeight, S.fontSize, S.letterSpacingPx,
        S.color, S.dashLength, S.dashGap, S.strokeWidth, S.lineStyle, dpr].join('|');
      if (key === layoutKey && view) return view;
      layoutKey = key;

      var wanted = fontFor(64);
      if (document.fonts && wanted !== requestedFont) {
        requestedFont = wanted;
        document.fonts.load(wanted, text).then(function () { layoutKey = ''; wake(); },
          function () { layoutKey = ''; wake(); });
      }

      var probe = scratchCtx;
      var size = S.fontSize;
      setFont(probe, size);
      var m = probe.measureText(text);
      var inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      var inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      if (!isFinite(inkW) || inkW <= 0) inkW = m.width;
      if (!isFinite(inkH) || inkH <= 0) inkH = size;

      // 文字居中画在 span 的框里；canvas 四周各留 PAD 给 HUD
      width = Math.max(1, Math.ceil(inkW) + PAD * 2);
      height = Math.max(1, Math.ceil(inkH) + PAD * 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      var x = PAD + (width - PAD * 2 - inkW) / 2 + m.actualBoundingBoxLeft;
      var baseline = PAD + (height - PAD * 2 - inkH) / 2 + m.actualBoundingBoxAscent;
      view = {
        size: size,
        baseline: baseline,
        left: x - m.actualBoundingBoxLeft,
        right: x + m.actualBoundingBoxRight,
        top: baseline - m.actualBoundingBoxAscent,
        bottom: baseline + m.actualBoundingBoxDescent
      };

      var chars = Array.from(text);
      var previous = glyphs;
      glyphs = [];
      var prefix = '';
      chars.forEach(function (char, i) {
        prefix += char;
        var own = probe.measureText(char);
        var gx = x + probe.measureText(prefix).width - own.width;
        if (!char.trim()) return;
        var base = {
          char: char,
          x: gx,
          box: {
            x1: gx - own.actualBoundingBoxLeft,
            y1: baseline - own.actualBoundingBoxAscent,
            x2: gx + own.actualBoundingBoxRight,
            y2: baseline + own.actualBoundingBoxDescent
          }
        };
        var kept = previous[glyphs.length];
        var g = {
          char: char, x: base.x, box: base.box,
          offset: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          outline: 0,
          index: i
        };
        g.fill = sprite(g, false);
        g.dashes = sprite(g, true);
        glyphs.push(g);
      });
      dragging = -1;
      frame.index = -1;
      return view;
    }

    function glyphAt(px, py) {
      if (!view || py < view.top - 24 || py > view.bottom + 24) return -1;
      var best = -1, bestD = Infinity;
      glyphs.forEach(function (g, i) {
        var x1 = g.box.x1 + g.offset.x, x2 = g.box.x2 + g.offset.x;
        var d = px < x1 ? x1 - px : px > x2 ? px - x2 : 0;
        if (d < bestD) { bestD = d; best = i; }
      });
      return bestD < 28 ? best : -1;
    }

    function falloff(target, cx, cy, radius, strength, softness) {
      var inner = clamp(1 - softness, 0, 1);
      var gradient = target.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,' + strength + ')');
      if (inner > 0.995) {
        gradient.addColorStop(0.995, 'rgba(0,0,0,' + strength + ')');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        return gradient;
      }
      for (var i = 0; i <= FALLOFF_STEPS; i++) {
        var t = i / FALLOFF_STEPS;
        var eased = t * t * (3 - 2 * t);
        gradient.addColorStop(inner + (1 - inner) * t, 'rgba(0,0,0,' + strength * (1 - eased) + ')');
      }
      return gradient;
    }

    function blit(target, art, dx, dy, ox, oy) {
      target.drawImage(art.image, Math.round((art.left + dx) * dpr - ox), Math.round((art.top + dy) * dpr - oy));
    }

    function drawReveal() {
      var radius = S.reach * dpr;
      var cx = lens.x * dpr, cy = lens.y * dpr;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = falloff(ctx, cx, cy, radius, presence, S.softness);
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.globalCompositeOperation = 'source-over';

      var x0 = Math.max(0, Math.floor(cx - radius)), y0 = Math.max(0, Math.floor(cy - radius));
      var x1 = Math.min(canvas.width, Math.ceil(cx + radius)), y1 = Math.min(canvas.height, Math.ceil(cy + radius));
      if (x1 <= x0 || y1 <= y0) return;
      var w = x1 - x0, h = y1 - y0;
      if (scratch.width < w || scratch.height < h) {
        scratch.width = Math.max(scratch.width, w);
        scratch.height = Math.max(scratch.height, h);
      }
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.globalCompositeOperation = 'source-over';
      scratchCtx.clearRect(0, 0, w, h);
      glyphs.forEach(function (g) { blit(scratchCtx, g.dashes, g.offset.x, g.offset.y, x0, y0); });
      scratchCtx.globalCompositeOperation = 'destination-in';
      scratchCtx.fillStyle = falloff(scratchCtx, cx - x0, cy - y0, radius, 1, S.softness);
      scratchCtx.fillRect(0, 0, w, h);
      scratchCtx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = presence;
      ctx.drawImage(scratch, 0, 0, w, h, x0, y0, w, h);
      ctx.globalAlpha = 1;
    }

    function crisp(v) { return (Math.round(v * dpr) + 0.5) / dpr; }

    function perimeterPoint(distance, w, h) {
      var total = 2 * (w + h);
      var d = ((distance % total) + total) % total;
      if (d < w) return [frame.x1 + d, frame.y1, 0, -1];
      d -= w;
      if (d < h) return [frame.x2, frame.y1 + d, 1, 0];
      d -= h;
      if (d < w) return [frame.x2 - d, frame.y2, 0, 1];
      d -= w;
      return [frame.x1, frame.y2 - d, -1, 0];
    }

    function drawSpecks(a) {
      var w = frame.x2 - frame.x1, h = frame.y2 - frame.y1;
      if (w < 2 || h < 2) return;
      var perimeter = 2 * (w + h);
      var seed = frame.index + 1;
      var grid = 3;
      for (var k = 0; k < S.specks; k++) {
        var period = 0.5 + noise(seed, k, 11) * 1.2;
        var t = pulse / period + noise(seed, k, 17);
        var cycle = Math.floor(t);
        var life = t - cycle;
        if (life > 0.7) continue;
        var pp = perimeterPoint(noise(seed, k, cycle) * perimeter, w, h);
        var pick = noise(seed, k, cycle, 2);
        var size = pick < 0.46 ? 2 : pick < 0.7 ? 3 : pick < 0.84 ? 5 : pick < 0.94 ? 8 : 11;
        var large = size >= 8;
        var out = (large ? 9 : 4) + Math.floor(noise(seed, k, cycle, 1) * 5) * grid;
        var sx = frame.x1 + Math.round((pp[0] + pp[2] * out - frame.x1) / grid) * grid;
        var sy = frame.y1 + Math.round((pp[1] + pp[3] * out - frame.y1) / grid) * grid;
        var tone = noise(seed, k, cycle, 3);
        var blink = life < 0.06 || (life > 0.32 && life < 0.36) ? 0.35 : 1;
        var alpha = a * (large ? 0.3 + 0.4 * tone : 0.3 + 0.6 * tone) * blink;
        var left = Math.round(sx - size / 2), top = Math.round(sy - size / 2);
        if (tone < 0.26 || (large && tone < 0.78)) {
          ctx.strokeStyle = rgba(S.accentRgb, alpha);
          ctx.strokeRect(left + 0.5, top + 0.5, size, size);
          if (large && tone > 0.5) {
            ctx.fillStyle = rgba(S.accentRgb, alpha);
            ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 2, 2);
          }
        } else {
          ctx.fillStyle = rgba(S.accentRgb, alpha);
          ctx.fillRect(left, top, size, size);
        }
      }
      for (var j = 0; j < 2; j++) {
        var head = (pulse * 0.42 * S.speed + j * 0.5) * perimeter;
        for (var i = 0; i < 4; i++) {
          var p2 = perimeterPoint(head - i * 6, w, h);
          var sz = i === 0 ? 3 : 2;
          ctx.fillStyle = rgba(S.accentRgb, a * [0.95, 0.55, 0.32, 0.16][i]);
          ctx.fillRect(Math.round(p2[0] - sz / 2), Math.round(p2[1] - sz / 2), sz, sz);
        }
      }
    }

    function drawFrame() {
      var glyph = glyphs[frame.index];
      if (!glyph || frame.alpha < 0.01) return;
      var a = frame.alpha;
      var x1 = crisp(frame.x1), y1 = crisp(frame.y1), x2 = crisp(frame.x2), y2 = crisp(frame.y2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var moved = Math.sqrt(glyph.offset.x * glyph.offset.x + glyph.offset.y * glyph.offset.y);
      if (moved > 1) {
        var hx = (glyph.box.x1 + glyph.box.x2) / 2, hy = (glyph.box.y1 + glyph.box.y2) / 2;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + glyph.offset.x, hy + glyph.offset.y);
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(S.accentRgb, 0.45 * a);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.rect(Math.round(hx) - 2, Math.round(hy) - 2, 4, 4);
        ctx.fillStyle = rgba(S.accentRgb, 0.7 * a);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(S.accentRgb, 0.5 * a);
      ctx.stroke();

      ctx.beginPath();
      [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].forEach(function (c) {
        ctx.rect(Math.round(c[0]) - 2, Math.round(c[1]) - 2, 5, 5);
      });
      ctx.fillStyle = rgba(S.accentRgb, 0.95 * a);
      ctx.fill();

      if (S.specks > 0) {
        ctx.lineWidth = 1;
        drawSpecks(a);
      }

      if (!S.labels) return;
      ctx.font = LABEL_FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = rgba(S.accentRgb, 0.62 * a);
      var label = moved > 1
        ? signed(Math.round(glyph.offset.x)) + ', ' + signed(Math.round(-glyph.offset.y))
        : glyph.char + '  ' + Math.round(glyph.box.x2 - glyph.box.x1) + ' \u00d7 ' + Math.round(glyph.box.y2 - glyph.box.y1);
      ctx.fillText(label, Math.round(frame.x1), Math.round(frame.y1) - 7);
    }

    // 减弱动效下所有过渡都"瞬到"，而不是干脆没有反应：
    // 悬停仍然能立刻看到虚线轮廓和测量框（信息一样），但过程没有动画。
    // 副作用是 tick 在这种情况下只跑一帧就停 —— 静止用户不会有持续的 rAF 开销。
    function ease(current, target, dt, seconds) {
      return reduced ? target : approach(current, target, dt, seconds);
    }

    function tick(now) {
      raf = 0;
      if (!alive) return;
      var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      var v = ensureLayout();

      var sweeping = S.sweep && !reduced && !pointer.inside && dragging < 0;
      if (sweeping) clock += dt * S.speed;
      pulse += dt;
      var tx = pointer.x, ty = pointer.y;
      if (sweeping) {
        tx = v.left + (v.right - v.left) * (0.5 - 0.5 * Math.cos(clock * 0.45));
        ty = v.top + (v.bottom - v.top) * (0.45 + 0.1 * Math.sin(clock * 0.8));
      }
      var active = pointer.inside || sweeping || dragging >= 0;
      if (active && !placed) { lens.x = tx; lens.y = ty; }
      if (active) {
        var lag = pointer.inside ? 0.05 : 0.22;
        lens.x = ease(lens.x, tx, dt, lag);
        lens.y = ease(lens.y, ty, dt, lag);
      }
      placed = active;
      var wantPresence = (S.reveal === 'area' && active && dragging < 0) ? 1 : 0;
      presence = ease(presence, wantPresence, dt, 0.16);

      var moving = false;
      glyphs.forEach(function (g, i) {
        if (i === dragging) {
          g.offset.x = ease(g.offset.x, pointer.x - grab.x, dt, 0.03);
          g.offset.y = ease(g.offset.y, pointer.y - grab.y, dt, 0.03);
          g.velocity.x = 0; g.velocity.y = 0;
          moving = true;
          return;
        }
        if (Math.abs(g.offset.x) < 0.05 && Math.abs(g.offset.y) < 0.05 &&
            Math.sqrt(g.velocity.x * g.velocity.x + g.velocity.y * g.velocity.y) < 0.5) {
          g.offset.x = 0; g.offset.y = 0; g.velocity.x = 0; g.velocity.y = 0;
          return;
        }
        g.velocity.x += (-SPRING * g.offset.x - DAMPING * g.velocity.x) * dt;
        g.velocity.y += (-SPRING * g.offset.y - DAMPING * g.velocity.y) * dt;
        g.offset.x += g.velocity.x * dt;
        g.offset.y += g.velocity.y * dt;
        moving = true;
      });

      var focus = active ? glyphAt(lens.x, lens.y) : -1;
      if (focus >= 0 && S.selection) {
        var g2 = glyphs[focus];
        var bx1 = g2.box.x1 + g2.offset.x - 6, by1 = g2.box.y1 + g2.offset.y - 6;
        var bx2 = g2.box.x2 + g2.offset.x + 6, by2 = g2.box.y2 + g2.offset.y + 6;
        if (frame.index < 0 || frame.alpha < 0.02) {
          frame.x1 = bx1; frame.y1 = by1; frame.x2 = bx2; frame.y2 = by2;
        }
        var glide = focus === dragging ? 0.02 : 0.08;
        frame.x1 = ease(frame.x1, bx1, dt, glide);
        frame.y1 = ease(frame.y1, by1, dt, glide);
        frame.x2 = ease(frame.x2, bx2, dt, glide);
        frame.y2 = ease(frame.y2, by2, dt, glide);
        frame.index = focus;
      }
      frame.alpha = ease(frame.alpha, (focus >= 0 && S.selection) ? 1 : 0, dt, 0.1);

      glyphs.forEach(function (g, i) {
        var target = (S.reveal === 'letter' && i === focus && i !== dragging) ? 1 : 0;
        g.outline = ease(g.outline, target, dt, 0.09);
        if (Math.abs(g.outline - target) > 0.002) moving = true; else g.outline = target;
      });

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      glyphs.forEach(function (g) {
        var moved = Math.sqrt(g.offset.x * g.offset.x + g.offset.y * g.offset.y);
        if (moved > 1) {
          ctx.globalAlpha = Math.min(1, moved / 24) * 0.55;
          blit(ctx, g.dashes, 0, 0, 0, 0);
          ctx.globalAlpha = 1;
        }
      });
      glyphs.forEach(function (g) {
        if (g.outline < 0.999) {
          ctx.globalAlpha = 1 - g.outline;
          blit(ctx, g.fill, g.offset.x, g.offset.y, 0, 0);
        }
        if (g.outline > 0.001) {
          ctx.globalAlpha = g.outline;
          blit(ctx, g.dashes, g.offset.x, g.offset.y, 0, 0);
        }
        ctx.globalAlpha = 1;
      });
      if (presence > 0.001) drawReveal();
      drawFrame();

      var settling = moving || Math.abs(presence - wantPresence) > 0.002 ||
        (frame.alpha > 0.01 && frame.alpha < 0.99);
      if ((active || settling) && visible && alive) raf = requestAnimationFrame(tick);
    }

    function wake() {
      if (raf || !visible || !alive) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    /* 终态静态帧：不走 rAF 直接画一次。
       减弱动效、以及 rAF 被节流/不可用的环境都得靠它 —— 否则标题会是一片空白
       （文字已经用 color:transparent 隐身了，画不出来就等于标题消失）。 */
    function paintStatic() {
      ensureLayout();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      glyphs.forEach(function (g) {
        ctx.globalAlpha = 1;
        blit(ctx, g.fill, 0, 0, 0, 0);
      });
      ctx.globalAlpha = 1;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      layoutKey = '';
      if (reduced) paintStatic(); else { ensureLayout(); wake(); }
    }

    // 指针坐标要换算到 canvas 自己的坐标系：canvas 比文字框四周各外扩了 PAD，
    // 所以不能拿 host 的矩形来算，得拿 canvas 的。
    function locate(e) {
      var cRect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - cRect.left;
      pointer.y = e.clientY - cRect.top;
    }

    function onMove(e) { locate(e); pointer.inside = true; wake(); }
    function onLeave() { if (dragging >= 0) return; pointer.inside = false; wake(); }
    function onDown(e) {
      locate(e);
      pointer.inside = true;
      if (S.draggable && (e.pointerType !== 'mouse' || e.button === 0)) {
        var index = glyphAt(pointer.x, pointer.y);
        if (index >= 0) {
          dragging = index;
          grab.x = pointer.x - glyphs[index].offset.x;
          grab.y = pointer.y - glyphs[index].offset.y;
          if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        }
      }
      wake();
    }
    function onUp(e) {
      if (dragging >= 0) {
        dragging = -1;
        if (canvas.releasePointerCapture) canvas.releasePointerCapture(e.pointerId);
      }
      wake();
    }

    // 只在能悬停的精确指针上挂交互；触摸设备不挂，避免和滚动抢事件
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine) {
      host.addEventListener('pointermove', onMove, { passive: true });
      host.addEventListener('pointerenter', onMove, { passive: true });
      host.addEventListener('pointerdown', onDown, { passive: true });
      host.addEventListener('pointerup', onUp, { passive: true });
      host.addEventListener('pointercancel', onUp, { passive: true });
      host.addEventListener('pointerleave', onLeave, { passive: true });
    }

    var ro = null, io = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(resize); ro.observe(sr); }
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) { if (reduced) paintStatic(); else wake(); }
        else if (raf) { cancelAnimationFrame(raf); raf = 0; }
      }, { rootMargin: '0px' });
      io.observe(host);
    } else {
      visible = true;
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { layoutKey = ''; if (reduced) paintStatic(); else wake(); });
    }

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (reduced) paintStatic();

    var api = {
      destroy: function () {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        host.textContent = text;
      },
      paintStatic: paintStatic,
      /* 直接画一帧"镜片停在某点"的定态。
         正常路径只有指针悬停或自动扫光才会聚焦某个字，而无头环境里 rAF 不触发、
         也没有指针，测量框/角柄/标注这些最该看的东西根本截不到。
         有了它就能把定态渲染出来做视觉验证。 */
      paintFocus: function (px, py) {
        ensureLayout();
        pointer.inside = true;
        lens.x = px;
        lens.y = py;
        pulse = 2.3;
        var focus = glyphAt(px, py);
        glyphs.forEach(function (g, i) {
          g.outline = (i === focus && S.reveal === 'letter') ? 1 : 0;
        });
        if (focus >= 0) {
          var g2 = glyphs[focus];
          frame.x1 = g2.box.x1 - 6;
          frame.y1 = g2.box.y1 - 6;
          frame.x2 = g2.box.x2 + 6;
          frame.y2 = g2.box.y2 + 6;
          frame.index = focus;
          frame.alpha = 1;
        } else {
          frame.alpha = 0;
          frame.index = -1;
        }
        presence = (S.reveal === 'area' && focus >= 0) ? 1 : 0;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        glyphs.forEach(function (g) {
          if (g.outline < 0.999) { ctx.globalAlpha = 1 - g.outline; blit(ctx, g.fill, 0, 0, 0, 0); }
          if (g.outline > 0.001) { ctx.globalAlpha = g.outline; blit(ctx, g.dashes, 0, 0, 0, 0); }
          ctx.globalAlpha = 1;
        });
        if (presence > 0.001) drawReveal();
        drawFrame();
        return { focus: focus, chars: glyphs.length, frame: [frame.x1, frame.y1, frame.x2, frame.y2] };
      },
      internals: function () {
        return {
          reduced: reduced,
          dpr: dpr,
          canvas: canvas.width + 'x' + canvas.height,
          glyphs: glyphs.length,
          view: view ? {
            size: Math.round(view.size), baseline: Math.round(view.baseline),
            left: Math.round(view.left), right: Math.round(view.right),
            top: Math.round(view.top), bottom: Math.round(view.bottom)
          } : null,
          firstSprite: glyphs[0] && glyphs[0].fill ? {
            w: glyphs[0].fill.image.width, h: glyphs[0].fill.image.height,
            left: Math.round(glyphs[0].fill.left), top: Math.round(glyphs[0].fill.top)
          } : null,
          font: fontFor(S.fontSize),
          color: S.color
        };
      }
    };
    host.__tt = api;
    return api;
  }

  function boot() {
    // 窄屏不做：标题只有 ~37px，测量框/角柄/10px 标注会挤成一团，
    // 而且没有悬停，只剩扫光在动。
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var wide = window.matchMedia('(min-width: 720px)').matches;
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var list = document.querySelectorAll('[data-tech-text]');
    if (!fine || !wide || saveData || cores <= 4 || mem <= 4) return;
    for (var i = 0; i < list.length; i++) {
      // 每个标题一块 canvas、一个 rAF 循环；编号交给 IO，只有真正在视口里的才跑
      try { init(list[i]); } catch (e) { /* 单个失败就保持纯文字，不影响其它标题 */ }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.TechText = { init: init };
})();
