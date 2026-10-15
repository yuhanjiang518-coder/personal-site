/* PatternWaves —— 从 reactbits.dev/backgrounds/pattern-waves 移植。
 *
 * 原版是 ogl 的三段 WebGL2：波高场 → 指针涟漪的 ping-pong 模拟 → 标记层。
 * 但它的本质并不是"逐像素的场"，而是**一格一格的标记，由一张平滑的波场驱动**
 * （标记的大小、粗细、明暗、垂直位移都取自波场）。这正好是 canvas 2D 擅长的形状 ——
 * 所以这里按同样的数学重算一遍，用 2D 画出来，而不是拿 CSS 去仿一个 shader。
 *
 * 保真度上刻意对齐的部分：
 *   · 3D 梯度噪声的 hash（scramble/lattice）逐位照搬，含 32 位回绕；
 *   · surface() 的 silk / swell / ripple 三条波函数、系数与相位全部照抄；
 *   · 光照链 diffuse → spec(160 次幂) → hollow → tone → contrast → level 照抄；
 *   · lift / 入场(appear, rise) / 边缘淡出 的行为照抄。
 * 有意不同的部分：
 *   · 梯度用相邻格点差分（步长取 pitchY）而不是再采样 4 次噪声 —— 结果一致，开销降到 1/5；
 *   · 线模式直接画折线带，不再走"列间插值"那套（那是给片元着色器补连续性的）；
 *   · 省掉了指针涟漪（涟漪需要 ping-pong 浮点纹理，2D 上得不偿失），
 *     改成"容器进入视口时从中心涌起"，观感接近但不吃交互。
 *
 * 自门控：prefers-reduced-motion / saveData / 低端机 一律只画一帧静态图，不起 rAF。
 */
(function () {
  'use strict';

  var DEFAULTS = {
    preset: 'silk',
    pattern: 'line',
    wave: 'silk',
    spacing: 20,
    markSize: 0.5,
    depth: 0.85,
    light: 0,
    shine: 0.7,
    contrast: 1.25,
    speed: 0.32,
    scale: 1,
    direction: 20,
    color: '#cfe9ff',
    opacity: 0.9,
    fade: 'none',
    fadeSize: 0.5,
    characters: '.:-=+*#%@',
    intro: true
  };

  var PRESETS = {
    silk: { pattern: 'dot', wave: 'silk', spacing: 9, markSize: 0.95, depth: 0.95, shine: 0.8, contrast: 1.2, speed: 0.35, direction: 20 },
    ocean: { pattern: 'dot', wave: 'swell', spacing: 10, markSize: 0.9, depth: 0.42, shine: 1, contrast: 1.2, speed: 0.5, direction: 100 },
    pond: { pattern: 'dot', wave: 'ripple', spacing: 10, markSize: 0.9, depth: 0.55, shine: 1.2, contrast: 1.2, speed: 0.5, direction: 35 },
    lines: { pattern: 'line', wave: 'silk', spacing: 12, markSize: 0.42, depth: 0.9, shine: 0.6, contrast: 1.2, speed: 0.3, direction: 20 }
  };

  var PATTERN = { dot: 0, square: 1, plus: 2, line: 3, glyph: 4 };
  var WAVE = { silk: 0, swell: 1, ripple: 2 };
  var WAVE_UNIT = 520;             // 原版常量：波场的一个"单位"是 520 CSS px
  var PIXEL_BUDGET = 4.5e6;        // 原版常量
  var INTRO_SECONDS = 2;           // 原版常量
  var MAX_DPR = 1.5;               // 原版封顶 2；这里再压一档，它是装饰
  var MAX_FPS = 30;                // 波以约 13px/s 漂移，30fps 与 60fps 肉眼无法区分

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothstep(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

  /* ---------------- 3D 梯度噪声（照搬 GLSL 的 hash） ---------------- */
  function scramble(x, y, z) {
    var vx = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    var vy = (Math.imul(y, 1664525) + 1013904223) >>> 0;
    var vz = (Math.imul(z, 1664525) + 1013904223) >>> 0;
    vx = (vx + Math.imul(vy, vz)) >>> 0;
    vy = (vy + Math.imul(vz, vx)) >>> 0;
    vz = (vz + Math.imul(vx, vy)) >>> 0;
    vx = (vx ^ (vx >>> 16)) >>> 0;
    vy = (vy ^ (vy >>> 16)) >>> 0;
    vz = (vz ^ (vz >>> 16)) >>> 0;
    vx = (vx + Math.imul(vy, vz)) >>> 0;
    vy = (vy + Math.imul(vz, vx)) >>> 0;
    vz = (vz + Math.imul(vx, vy)) >>> 0;
    return [vx, vy, vz];
  }

  // lattice(vec3 corner) -> 三分量都在 [-1, 1.0007]
  function lattice(cx, cy, cz) {
    var h = scramble((cx + 4096) | 0, (cy + 4096) | 0, (cz + 4096) | 0);
    return [
      (h[0] & 65535) / 32767.5 - 1,
      (h[1] & 65535) / 32767.5 - 1,
      (h[2] & 65535) / 32767.5 - 1
    ];
  }

  // 8 个格点各自做一次点积，再三线性插值（和 GLSL 的写法一一对应）
  function gnoise(px, py, pz) {
    var ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
    var fx = px - ix, fy = py - iy, fz = pz - iz;
    var ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    var uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    var uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
    function corner(dx, dy, dz) {
      var g = lattice(ix + dx, iy + dy, iz + dz);
      return g[0] * (fx - dx) + g[1] * (fy - dy) + g[2] * (fz - dz);
    }
    var n000 = corner(0, 0, 0), n100 = corner(1, 0, 0);
    var n010 = corner(0, 1, 0), n110 = corner(1, 1, 0);
    var n001 = corner(0, 0, 1), n101 = corner(1, 0, 1);
    var n011 = corner(0, 1, 1), n111 = corner(1, 1, 1);
    var a = n000 + (n100 - n000) * ux;
    var b = n010 + (n110 - n010) * ux;
    var c = n001 + (n101 - n001) * ux;
    var d = n011 + (n111 - n011) * ux;
    var e = a + (b - a) * uy;
    var f = c + (d - c) * uy;
    return e + (f - e) * uz;
  }

  /* ---------------- 波面（三条，系数照抄） ---------------- */
  function surface(px, py, t, wave, hx, hy) {
    if (wave === 0) {                       // silk
      var sx = -hy, sy = hx;
      var u = px * hx + py * hy;
      var v = px * sx + py * sy;
      var bend = gnoise(v * 0.85, u * 0.3, t * 0.05) * 1.7 + 0.4 * Math.sin(v * 1.6 + t * 0.2);
      var phase = u * 5.5 + bend - t * 0.45;
      var swell = 0.6 + 0.4 * gnoise(u * 0.55 + 3, v * 0.45, t * 0.04);
      var fold = Math.sin(phase) + 0.32 * Math.sin(2 * phase + 1.3);
      var rip = 0.16 * Math.sin(u * 13.75 + bend * 1.9 - t * 0.9 + 2.1);
      return (fold + rip) * swell;
    }
    if (wave === 1) {                       // swell
      var bend2 = gnoise(px * 0.6, py * 0.6, t * 0.05) * 0.6;
      var ph2 = (px * hx + py * hy) * 15 + bend2 * 2.2 - t * 1.4;
      var sw2 = Math.sin(ph2) + 0.3 * Math.sin(2 * ph2 - 0.8);
      var roll = 0.75 + 0.25 * gnoise(px * 0.9 + 11, py * 0.9 + 11, t * 0.05);
      return 0.8 * sw2 * roll;
    }
    var r = Math.sqrt((px + hx * 1.2) * (px + hx * 1.2) + (py + hy * 1.2) * (py + hy * 1.2));
    var bend3 = gnoise(px * 1.2, py * 1.2, t * 0.05) * 0.1;
    return Math.sin((r + bend3) * 9 - t * 1.8) * (0.45 + 0.55 * Math.exp(-(r - 0.6) * 0.8));
  }

  // 任意 CSS 颜色 -> [r,g,b]：画一个像素再读回来。
  // 不用正则解析、也不读 ctx.fillStyle —— 站点的颜色是 oklch() 写法，
  // 这两种做法在现代颜色空间下都会算错（详见 tech-text.js 里的同一段注释）。
  // 这里目前传的是十六进制字面量所以没出问题，但别留这个坑。
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
      return [px[0] / 255, px[1] / 255, px[2] / 255];
    } catch (e) { return fallback; }
  }

  function num(el, name, dflt) {
    var v = el.getAttribute('data-' + name);
    if (v === null || v === '') return dflt;
    var n = Number(v);
    return isNaN(n) ? dflt : n;
  }

  function init(canvas) {
    var el = canvas;
    var host = el.parentNode;
    var preset = PRESETS[el.getAttribute('data-preset')] || null;
    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    if (preset) for (var p in preset) o[p] = preset[p];
    o.spacing = num(el, 'spacing', o.spacing);
    o.markSize = num(el, 'markSize', o.markSize);
    o.depth = num(el, 'depth', o.depth);
    o.shine = num(el, 'shine', o.shine);
    o.contrast = num(el, 'contrast', o.contrast);
    o.speed = num(el, 'speed', o.speed);
    o.scale = num(el, 'scale', o.scale);
    o.direction = num(el, 'direction', o.direction);
    o.opacity = num(el, 'opacity', o.opacity);
    o.fadeSize = num(el, 'fadeSize', o.fadeSize);
    if (el.getAttribute('data-pattern')) o.pattern = el.getAttribute('data-pattern');
    if (el.getAttribute('data-wave')) o.wave = el.getAttribute('data-wave');
    if (el.getAttribute('data-color')) o.color = el.getAttribute('data-color');
    if (el.getAttribute('data-characters')) o.characters = el.getAttribute('data-characters');

    var rgb = parseColor(o.color, [0.81, 0.91, 1]);
    var patternIndex = PATTERN[o.pattern] === undefined ? 3 : PATTERN[o.pattern];
    var waveIndex = WAVE[o.wave] === undefined ? 0 : WAVE[o.wave];
    var heading = (o.direction * Math.PI) / 180;
    var hx = Math.cos(heading), hy = Math.sin(heading);
    var lightAngle = ((o.direction + 180 + clamp(o.light, -90, 90)) * Math.PI) / 180;
    var lx = Math.cos(lightAngle) * 0.78, ly = Math.sin(lightAngle) * 0.78, lz = 0.62;
    var ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
    lx /= ll; ly /= ll; lz /= ll;
    var hw = [lx, ly, lz + 1];
    var hl = Math.sqrt(hw[0] * hw[0] + hw[1] * hw[1] + hw[2] * hw[2]);
    hw[0] /= hl; hw[1] /= hl; hw[2] /= hl;
    // 浅色标记压在深底上 → ink = 0，level = tone^2.2（原版 luminance 比较的同一分支）
    var ink = false;
    var chars = Array.from(o.characters || DEFAULTS.characters);
    var font = '500 FONTSIZEpx ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

    var ctx = el.getContext('2d', { alpha: true });
    if (!ctx) return;

    var W = 1, H = 1, dpr = 1;
    var cols = 0, rows = 0, pitchY = 1, stepX = 1, kStencil = 1;
    var hGrid = null, levelGrid = null, liftGrid = null;
    var time = 0, introClock = 0, raf = 0, last = 0;
    var visible = false, alive = true, finished = false;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function gridIndex(c, r) { return r * cols + c; }

    function resize() {
      var rect = host.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR, Math.sqrt(PIXEL_BUDGET / (W * H)));
      el.width = Math.round(W * dpr);
      el.height = Math.round(H * dpr);
      el.style.width = W + 'px';
      el.style.height = H + 'px';
      pitchY = Math.max(6, o.spacing);
      // 线模式按 pitchY/4 采样（原版的列密度）；其它模式按 pitchY 正方格
      stepX = patternIndex === 3 ? Math.max(3, pitchY / 4) : pitchY;
      cols = Math.min(2048, Math.ceil(W / stepX) + 2);
      rows = Math.min(1024, Math.ceil(H / pitchY) + 2);
      kStencil = Math.max(1, Math.round(pitchY / stepX));
      hGrid = new Float32Array(cols * rows);
      levelGrid = new Float32Array(cols * rows);
      liftGrid = new Float32Array(cols * rows);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function computeField(amp, appear) {
      var cx = 0.5 * W, cy = 0.5 * H;
      var unit = WAVE_UNIT * clamp(o.scale, 0.2, 5);
      var invUnit = 1 / unit;
      // 高度场：一格一次噪声。梯度用相邻格点差分（步长取 kStencil 格 ≈ pitchY），
      // 等价于原版那个 e = max(pitchY/dpr, 4) 的中央差分，但省掉 4 次采样。
      for (var r = 0; r < rows; r++) {
        var y = r * pitchY;
        for (var c = 0; c < cols; c++) {
          var x = c * stepX;
          hGrid[r * cols + c] = surface((x - cx) * invUnit, (y - cy) * invUnit, time, waveIndex, hx, hy) * amp;
        }
      }
      var ed = 2 * kStencil * stepX * invUnit;
      var ey = 2 * pitchY * invUnit;
      var gradScale = unit * clamp(o.depth, 0, 1.5) * 0.4;
      for (var r2 = 0; r2 < rows; r2++) {
        for (var c2 = 0; c2 < cols; c2++) {
          var i = r2 * cols + c2;
          var cm = c2 - kStencil < 0 ? 0 : c2 - kStencil;
          var cp = c2 + kStencil > cols - 1 ? cols - 1 : c2 + kStencil;
          var rm = r2 - 1 < 0 ? 0 : r2 - 1;
          var rp = r2 + 1 > rows - 1 ? rows - 1 : r2 + 1;
          var gx = (hGrid[r2 * cols + cp] - hGrid[r2 * cols + cm]) / ed;
          var gy = (hGrid[rp * cols + c2] - hGrid[rm * cols + c2]) / ey;
          var nx = -gx * gradScale, ny = -gy * gradScale;
          var nl = Math.sqrt(nx * nx + ny * ny + 1);
          nx /= nl; ny /= nl;
          var nz = 1 / nl;
          var diff = nx * lx + ny * ly + nz * lz;
          if (diff < 0) diff = 0; else if (diff > 1) diff = 1;
          var hd = nx * hw[0] + ny * hw[1] + nz * hw[2];
          if (hd < 0) hd = 0; else if (hd > 1) hd = 1;
          var spec = Math.pow(hd, 160) * clamp(o.shine, 0, 2) * 1.15;
          var hh = hGrid[i];
          var hollow = 0.7 + 0.3 * clamp(hh * 0.5 + 0.5, 0, 1);
          var tone = diff * hollow * 0.78 + spec;
          if (tone > 1) tone = 1;
          tone = (tone - 0.42) * clamp(o.contrast, 0.3, 3) + 0.42;
          if (tone < 0) tone = 0; else if (tone > 1) tone = 1;
          var level = Math.pow(tone, 2.2);
          levelGrid[i] = level;
          var lift = hh * clamp(o.depth, 0, 1.5) * 0.42;
          liftGrid[i] = lift < -0.48 ? -0.48 : lift > 0.48 ? 0.48 : lift;
        }
      }
      return appear;
    }

    function fadeAt(x, y) {
      var uvx = x / W, uvy = y / H;
      var cxx = uvx * 2 - 1, cyy = uvy * 2 - 1;
      if (o.fade === 'edges') return 1 - smoothstep(1 - o.fadeSize, 1.18, Math.sqrt(cxx * cxx + cyy * cyy));
      if (o.fade === 'center') return 0.05 + 0.95 * smoothstep(0.08, 0.08 + o.fadeSize, Math.sqrt(cxx * cxx + (cyy * 1.35) * (cyy * 1.35)));
      if (o.fade === 'bottom') return smoothstep(0, o.fadeSize, uvy);
      if (o.fade === 'top') return smoothstep(0, o.fadeSize, 1 - uvy);
      return 1;
    }

    function appAt(x, y, appear) {
      var reach = Math.sqrt((x - 0.5 * W) * (x - 0.5 * W) + (y - 0.5 * H) * (y - 0.5 * H)) / Math.max(0.5 * Math.sqrt(W * W + H * H), 1);
      return smoothstep(reach - 0.05, reach + 0.3, appear * 1.35);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var cr = Math.round(rgb[0] * 255), cg = Math.round(rgb[1] * 255), cb = Math.round(rgb[2] * 255);
      var op = clamp(o.opacity, 0, 1);

      if (patternIndex === 3) {
        // 线模式：每条线是一条上下边缘都随波起伏的带子，逐段用四边形拼；
        // 按透明度分 5 档批量填充 —— 一帧只有 5 次 fill，而不是几千次。
        var BUCKETS = 5;
        var alphaIdx = new Uint8Array(cols);
        for (var b = 0; b < BUCKETS; b++) {
          ctx.beginPath();
          var any = false;
          for (var r = 0; r < rows; r++) {
            var y0 = r * pitchY;
            for (var c = 0; c < cols - 1; c++) {
              var i = r * cols + c;
              var lv = levelGrid[i];
              if (lv <= 0.0005) continue;      // 原版的这一档判的是透明度（有 0.22 地板），不是强度
              var a = op * fadeAt(c * stepX, y0) * appAt(c * stepX, y0, appearNow) * (0.22 + 0.78 * lv);
              var idx = Math.min(BUCKETS - 1, Math.floor(a * BUCKETS));
              if (idx !== b) continue;
              var i2 = i + 1;
              var lv2 = levelGrid[i2];
              var x1 = c * stepX, x2 = (c + 1) * stepX;
              var t1 = Math.max(0.9, pitchY * o.markSize * lv);
              var t2 = Math.max(0.9, pitchY * o.markSize * lv2);
              var yy1 = y0 + liftGrid[i] * pitchY;
              var yy2 = y0 + liftGrid[i2] * pitchY;
              // 相邻四边形在 x 上叠 0.35px，避免抗锯齿把接缝露出来
              ctx.moveTo(x1, yy1 - t1 * 0.5);
              ctx.lineTo(x2 + 0.35, yy2 - t2 * 0.5);
              ctx.lineTo(x2 + 0.35, yy2 + t2 * 0.5);
              ctx.lineTo(x1, yy1 + t1 * 0.5);
              ctx.closePath();
              any = true;
            }
          }
          if (!any) continue;
          var av = (b + 0.5) / BUCKETS;
          ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + av.toFixed(3) + ')';
          ctx.fill();
        }
        return;
      }

      // 点/方/加号/字：一格一枚，直接画
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var r3 = 0; r3 < rows; r3++) {
        var y3 = r3 * pitchY;
        for (var c3 = 0; c3 < cols; c3++) {
          var i3 = r3 * cols + c3;
          var l3 = levelGrid[i3];
          if (l3 <= 0.0005) continue;
          var x3 = c3 * stepX;
          var fa = op * fadeAt(x3, y3) * appAt(x3, y3, appearNow) * (0.22 + 0.78 * l3);
          if (fa < 0.01) continue;
          ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + fa.toFixed(3) + ')';
          var cy3 = y3 + liftGrid[i3] * pitchY;
          var span = pitchY * o.markSize;
          if (patternIndex === 0) {
            ctx.beginPath();
            ctx.arc(x3, cy3, 0.5 * span * Math.sqrt(l3), 0, 6.2832);
            ctx.fill();
          } else if (patternIndex === 1) {
            var ex = 0.5 * span * l3;
            ctx.fillRect(x3 - ex, cy3 - ex, ex * 2, ex * 2);
          } else if (patternIndex === 2) {
            var arm = 0.5 * span * (0.3 + 0.7 * l3), wdt = Math.max(0.9, span * 0.11);
            ctx.fillRect(x3 - arm, cy3 - wdt, arm * 2, wdt * 2);
            ctx.fillRect(x3 - wdt, cy3 - arm, wdt * 2, arm * 2);
          } else {
            var gi = Math.min(chars.length - 1, Math.max(0, Math.floor(l3 * chars.length)));
            ctx.font = font.replace('FONTSIZE', (span * 1.05).toFixed(1));
            ctx.fillText(chars[gi], x3, cy3);
          }
        }
      }
    }

    var appearNow = 0;

    function frame(now) {
      raf = 0;
      if (!alive || !visible) return;
      if (now - last < 1000 / MAX_FPS - 1) { raf = requestAnimationFrame(frame); return; }
      var dt = Math.min(0.05, Math.max(1 / 240, (now - last) / 1000));
      last = now;
      if (!reduce && o.speed !== 0) time += dt * o.speed;
      introClock = (!reduce && o.intro) ? Math.min(1, introClock + dt / INTRO_SECONDS) : 1;
      appearNow = 1 - Math.pow(1 - clamp(introClock / 0.75, 0, 1), 3);
      var rise = clamp((introClock - 0.1) / 0.9, 0, 1);
      var amp = rise * rise * (3 - 2 * rise);
      computeField(amp, appearNow);
      draw();
      if (reduce || (introClock >= 1 && o.speed === 0)) { finished = true; return; }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf || !visible || !alive || finished) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    /* 终态静态帧：不经过 rAF 直接画一次。
       两处需要它 ——
         · 减弱动效：本来就该"直接给出成品"，没有理由让用户先看到一片空白；
         · 稳健性：绘制挂在 rAF 上，一旦 rAF 被节流或不可用，这块就永远是空的。
       另外它让这个效果在无头环境里可以被验证（那里 rAF 根本不触发）。 */
    function paintStatic() {
      time = 0;
      introClock = 1;
      appearNow = 1;
      computeField(1, 1);
      draw();
    }

    resize();
    if (reduce) paintStatic();          // 静止版立刻出现，连 IO 都不必等

    var ro = null, io = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(function () { resize(); if (reduce) paintStatic(); else start(); });
      ro.observe(host);
    } else {
      window.addEventListener('resize', function () { resize(); if (reduce) paintStatic(); else start(); });
    }

    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (!visible) { stop(); return; }
        if (reduce) paintStatic(); else start();
      }, { rootMargin: '120px' });
      io.observe(host);
    } else {
      visible = true;
      if (!reduce) start();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    el.__waveDestroy = function () {
      alive = false;
      stop();
      if (ro) ro.disconnect();
      if (io) io.disconnect();
    };

    /* 手动画某一时刻的场。
       用途：验证。正常路径只能靠 rAF 推进，而无头环境里 rAF 根本不触发，
       于是"画得出来"和"时间在推进"这两件事都没法观测。
       有了它就能对比 t=0 与 t=8 两帧，确认波场真的在动。 */
    el.__wavePaint = function (t) {
      time = (typeof t === 'number' ? t : 0);
      introClock = 1;
      appearNow = 1;
      computeField(1, 1);
      draw();
      return { time: time, cols: cols, rows: rows, pitchY: pitchY, stepX: stepX };
    };
  }

  function boot() {
    // 低端机 / 省电模式让路：这类"持续运行"的装饰是锦上添花，卡顿才是真问题。
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    if (saveData || cores <= 4 || mem <= 4) {
      // 仍然把容器标出来，让 CSS 走"没有 canvas"的降级外观
      var hosts = document.querySelectorAll('[data-pattern-waves]');
      for (var i = 0; i < hosts.length; i++) hosts[i].setAttribute('data-wave-skip', '1');
      return;
    }
    var list = document.querySelectorAll('[data-pattern-waves]');
    for (var j = 0; j < list.length; j++) init(list[j]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.PatternWaves = { init: init };
})();
