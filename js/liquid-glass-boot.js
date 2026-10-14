/* ============================================================================
   液态玻璃顶栏 · 引导脚本
   ----------------------------------------------------------------------------
   组件来自 https://elaina1017.com/ 的 web-liquid-glass
   （js/liquid-glass/*.js 原样搬入，未改内部实现；Copyright 归原作者）。
   它把「玻璃背后」的 DOM 手绘到 2D 画布，再用 WebGL2 做折射/色散/磨砂 ——
   所以玻璃里看到的是真实页面内容，而不是一张假的模糊底图。

   这里只做三件事：
     1. 只在支持 WebGL2 且用户没要求减弱动效时才启动；否则一个像素都不改，
        顶栏保持原来的 backdrop-filter 外观（降级由 .liquid-glass--unsupported 兜底）。
     2. 给组件一个自己的数据（背景色取主题变量、捕获节流 80ms）——
        参考站是单页小站，我们页面元素多得多，必须限流。
     3. 埋一个极轻的计时点，方便用无头浏览器验"每次捕获到底花多少毫秒"。
   ========================================================================== */

import { LiquidGlassNavigation } from './liquid-glass/liquid-glass-navigation.js';

const topbar = document.querySelector('.topbar');
const reduceMotion = window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function boot() {
  if (!topbar) return;

  window.__lgStats = {
    started: false,
    reason: reduceMotion ? 'reduced-motion' : null,
    captures: 0,
    lastMs: 0,
    maxMs: 0,
    avgMs: 0
  };

  if (reduceMotion) return;   /* 屏幕阅读/晕动敏感用户：不动，保留原来的毛玻璃 */

  let canvas = topbar.querySelector('.liquid-glass-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'liquid-glass-canvas';
    canvas.setAttribute('data-liquid-glass-canvas', '');
    canvas.setAttribute('aria-hidden', 'true');
    topbar.insertBefore(canvas, topbar.firstChild);
  }

  let glass;
  try {
    glass = new LiquidGlassNavigation({
      navElement: topbar,
      canvas,
      sceneRoot: document.body,
      /* 顶栏自己要被排除在捕获之外，否则玻璃会把自身也画进去 */
      captureNavigationContent: false,
      labelSelector: '.nav-link, .brand, .icon-btn',
      captureBackground: cssVar('--page-bg', '#fdfaf4'),
      captureMinIntervalMs: 80,
      maxDpr: 1.5,
      allowCrossOriginImages: false
    });
  } catch (err) {
    canvas.remove();
    window.__lgStats.reason = 'construct-failed';
    return;
  }

  /* 计时埋点：把 refreshScene 换成带计时的包装（组件 start() 里注册的就是它） */
  const original = glass.refreshScene.bind(glass);
  let total = 0;
  glass.refreshScene = function wrapped() {
    const t0 = performance.now();
    const out = original();
    const dt = performance.now() - t0;
    total += dt;
    window.__lgStats.captures += 1;
    window.__lgStats.lastMs = Math.round(dt * 10) / 10;
    window.__lgStats.maxMs = Math.max(window.__lgStats.maxMs, window.__lgStats.lastMs);
    window.__lgStats.avgMs = Math.round((total / window.__lgStats.captures) * 10) / 10;
    return out;
  };

  let started = false;
  try {
    started = glass.start();
  } catch (err) {
    started = false;
  }

  if (!started) {
    canvas.remove();
    topbar.classList.add('liquid-glass--unsupported');
    window.__lgStats.reason = 'unsupported';
    return;
  }

  window.__lgStats.started = true;
  document.documentElement.classList.add('lg-on');
  window.__liquidGlass = glass;

  /* 主题 / 皮肤 / 壁纸变了，捕获底图与标签对比度都要跟着重算 */
  const refresh = () => {
    try {
      glass.setMaterial && glass.setMaterial({});
      glass.refreshScene();
    } catch (e) { /* 组件内部会自己兜 */ }
  };
  const mo = new MutationObserver(refresh);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-skin', 'data-curtain'] });
  const bg = document.getElementById('bg-layer');
  if (bg) mo.observe(bg, { attributes: true, childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
