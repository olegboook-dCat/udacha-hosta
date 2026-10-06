(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#F4C553', '#FFE9A8', '#D6336C', '#F4C553', '#7BD36A', '#FFF6E5'];

  /* Гирлянда между секциями */
  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function q(p0, c, p1, t) { var u = 1 - t; return u * u * p0 + 2 * u * t * c + t * t * p1; }
  function drawGarland(box, idx) {
    var w = box.clientWidth, h = box.clientHeight;
    if (!w) return;
    var segs = Math.max(3, Math.round(w / 200)), sw = w / segs, top = 8, sag = h - 22;
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h });
    var d = 'M0 ' + top, bulbs = [];
    for (var i = 0; i < segs; i++) {
      var x0 = i * sw, x1 = x0 + sw, cx = x0 + sw / 2, cy = top + sag * 2 * ((i + idx) % 2 ? 0.8 : 1);
      d += ' Q' + cx + ' ' + cy + ' ' + x1 + ' ' + top;
      [0.2, 0.5, 0.8].forEach(function (t) { bulbs.push([q(x0, cx, x1, t), q(top, cy, top, t)]); });
    }
    svg.appendChild(el('path', { d: d, 'class': 'cord' }));
    var glows = el('g', {}), lamps = el('g', {});
    bulbs.forEach(function (b, j) {
      var col = COLORS[(j + idx * 2) % COLORS.length];
      var delay = (-Math.random() * 3.2).toFixed(2) + 's', dur = (2.4 + Math.random() * 2.2).toFixed(2) + 's';
      var g = el('circle', { cx: b[0], cy: b[1] + 9, r: 9, fill: col, 'class': 'glow' });
      g.style.animationDelay = delay; g.style.animationDuration = dur;
      glows.appendChild(g);
      lamps.appendChild(el('rect', { x: b[0] - 2.5, y: b[1] - 1, width: 5, height: 5, rx: 1, fill: '#0a2219' }));
      var e = el('ellipse', { cx: b[0], cy: b[1] + 9, rx: 4.2, ry: 6, fill: col, 'class': 'bulb' });
      e.style.animationDelay = delay; e.style.animationDuration = dur;
      lamps.appendChild(e);
    });
    svg.appendChild(glows); svg.appendChild(lamps);
    box.innerHTML = ''; box.appendChild(svg);
  }
  var garlands = Array.prototype.slice.call(document.querySelectorAll('.garland'));
  function drawAll() { garlands.forEach(drawGarland); }
  drawAll();
  var rt, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth; clearTimeout(rt); rt = setTimeout(drawAll, 150);
  });

  /* Шапка становится плотной при прокрутке */
  var bar = document.getElementById('bar');
  function onScroll() { bar.classList.toggle('is-solid', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* Открыто ли сейчас (часы кафе 10:00–24:00 по Москве) */
  var open = document.getElementById('open');
  try {
    var parts = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    var hh = +parts.filter(function (p) { return p.type === 'hour'; })[0].value;
    var isOpen = hh >= 10 && hh < 24;
    open.classList.add(isOpen ? 'is-open' : 'is-closed');
    open.querySelector('.open__txt').textContent = isOpen ? 'Сейчас открыто · до 24:00' : 'Сейчас закрыто · откроемся в 10:00';
  } catch (e) { /* оставляем текст по умолчанию */ }

  /* Окно «Забронировать стол» */
  var bron = document.getElementById('bron');
  if (bron && typeof bron.showModal === 'function') {
    document.querySelectorAll('[data-bron]').forEach(function (a) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); bron.showModal(); });
    });
    bron.addEventListener('click', function (ev) { if (ev.target === bron) bron.close(); });
  }

  /* Просмотр фото */
  var lb = document.getElementById('lb'), gal = document.getElementById('gal');
  if (lb && gal && typeof lb.showModal === 'function') {
    var img = lb.querySelector('img');
    gal.addEventListener('click', function (ev) {
      var a = ev.target.closest('a'); if (!a) return;
      ev.preventDefault();
      img.src = a.getAttribute('href'); img.alt = (a.querySelector('img') || {}).alt || '';
      lb.showModal();
    });
    lb.addEventListener('click', function (ev) { if (ev.target === lb || ev.target === img) lb.close(); });
  }
})();
