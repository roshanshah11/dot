/* Dot bench fixture: report what happens on the page to the bench server (POST /event, same origin).
 *
 * Every page includes this file. It is the ground truth for scripts/dot-bench.py: what was clicked,
 * typed, toggled, scrolled and navigated, independent of what Dot says it did. Event types:
 *   load, pageshow (bfcache restore only), pagehide, popstate, hashchange, visibility,
 *   click, input, change, focus, key, search, selection, scroll (throttled to 250 ms), layout, filter.
 * Setup query parameters (stripped from the URL before anything else happens):
 *   ?go=<relative page>   after this page loads, navigate to that page in the same tab (builds history
 *                         for "go back" rows: page1.html?go=page2.html leaves page1 -> page2)
 *   ?scroll=<px>          start scrolled to that position
 * No external requests, no storage: every load starts from the same state.
 */
(function () {
  'use strict';
  var seq = 0;
  var ENDPOINT = '/event';

  function post(payload, beacon) {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    var body = JSON.stringify(payload);
    try {
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch(ENDPOINT, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: body })
        .catch(function () {});
    } catch (e) { /* never break the page */ }
  }

  function send(type, data, beacon) {
    var payload = { type: type, page: location.pathname, url: location.href, title: document.title, seq: ++seq, t: Date.now() / 1000 };
    if (data) for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) payload[k] = data[k];
    post(payload, beacon);
  }

  function clean(s, n) {
    s = (s || '').replace(/\s+/g, ' ').trim();
    return s.length > (n || 120) ? s.slice(0, (n || 120) - 1) + '…' : s;
  }

  function roleOf(el) {
    if (!el || !el.getAttribute) return '';
    var r = el.getAttribute('role');
    if (r) return r;
    var tag = el.tagName;
    if (tag === 'A') return 'link';
    if (tag === 'BUTTON') return 'button';
    if (tag === 'TEXTAREA') return 'textbox';
    if (tag === 'SELECT') return 'combobox';
    if (tag === 'INPUT') {
      var t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t === 'search') return 'searchbox';
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'button' || t === 'submit' || t === 'reset') return 'button';
      return 'textbox';
    }
    return tag ? tag.toLowerCase() : '';
  }

  function labelOf(el) {
    if (!el || !el.getAttribute) return '';
    var a = el.getAttribute('aria-label');
    if (a) return clean(a);
    var by = el.getAttribute('aria-labelledby');
    if (by) {
      var ref = document.getElementById(by);
      if (ref) return clean(ref.textContent);
    }
    if (el.id) {
      var lab = document.querySelector('label[for="' + el.id + '"]');
      if (lab) return clean(lab.textContent);
    }
    var wrap = el.closest && el.closest('label');
    if (wrap) return clean(wrap.textContent);
    return clean(el.getAttribute('placeholder') || el.getAttribute('name') || '');
  }

  function textOf(el) {
    if (!el) return '';
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return labelOf(el);
    return clean(el.getAttribute && el.getAttribute('aria-label') || el.innerText || el.textContent);
  }

  function isField(el) {
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  function windowBox() {
    return { screenX: window.screenX, screenY: window.screenY, outerW: window.outerWidth, outerH: window.outerHeight,
      innerW: window.innerWidth, innerH: window.innerHeight, dpr: window.devicePixelRatio || 1 };
  }

  // Elements marked data-bench-rect report their rectangles: viewport CSS px plus an estimate in screen
  // points (window origin + browser chrome on top; assumes no bottom bar and 100% zoom).
  function rects() {
    var out = {};
    var chromeTop = Math.max(0, window.outerHeight - window.innerHeight);
    var chromeLeft = Math.max(0, Math.round((window.outerWidth - window.innerWidth) / 2));
    var els = document.querySelectorAll('[data-bench-rect]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], r = el.getBoundingClientRect();
      out[el.getAttribute('data-bench-rect')] = {
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        screen: { x: Math.round(window.screenX + chromeLeft + r.left), y: Math.round(window.screenY + chromeTop + r.top),
          w: Math.round(r.width), h: Math.round(r.height) }
      };
    }
    return out;
  }

  function inView() {
    var marks = document.querySelectorAll('[data-bench-mark]');
    var nav = document.querySelector('header.bench-nav');
    var top = nav ? nav.getBoundingClientRect().bottom : 0;
    var out = [];
    for (var i = 0; i < marks.length; i++) {
      var r = marks[i].getBoundingClientRect();
      if (r.bottom > top && r.top < window.innerHeight) out.push(marks[i].getAttribute('data-bench-mark'));
    }
    return out;
  }

  function scrollState() {
    var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return { scrollY: Math.round(window.scrollY), maxScrollY: max, fraction: max ? Math.round(window.scrollY / max * 1000) / 1000 : 0, in_view: inView() };
  }

  // Setup parameters: strip them first so history and reported URLs stay clean.
  var params = new URLSearchParams(location.search);
  var go = params.get('go'), startScroll = params.get('scroll');
  var setup = {};
  if (go !== null || startScroll !== null) {
    params.delete('go'); params.delete('scroll');
    var q = params.toString();
    try { history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
    if (go !== null) setup.go = go;
    if (startScroll !== null) setup.scroll = startScroll;
  }
  // Only same-site relative pages: no scheme, no protocol-relative URL.
  function safeRelative(p) { return !!p && !/^[a-z][a-z0-9+.-]*:/i.test(p) && p.indexOf('//') !== 0 && p.indexOf('\\') < 0; }

  window.addEventListener('load', function () {
    if (startScroll !== null) window.scrollTo(0, parseInt(startScroll, 10) || 0);
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
    var data = scrollState();
    data.nav_type = nav.type || '';
    data.referrer = document.referrer;
    data.history_length = history.length;
    data.window = windowBox();
    data.rects = rects();
    if (setup.go !== undefined || setup.scroll !== undefined) data.setup = setup;
    send('load', data);
    if (go !== null && safeRelative(go)) setTimeout(function () { location.assign(go); }, 50);
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      var d = scrollState(); d.persisted = true; d.history_length = history.length;
      send('pageshow', d);
    }
  });
  window.addEventListener('pagehide', function (e) { send('pagehide', { persisted: !!e.persisted }, true); });
  window.addEventListener('popstate', function (e) { send('popstate', { state: e.state === undefined ? null : e.state }); });
  window.addEventListener('hashchange', function (e) { send('hashchange', { old_url: e.oldURL }); });
  document.addEventListener('visibilitychange', function () { send('visibility', { state: document.visibilityState }); });

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a,button,input,select,textarea,summary,[role],[data-bench-click]') : null;
    el = el || e.target;
    if (el && el.tagName === 'LABEL') return; // the control it labels gets its own click
    send('click', {
      text: textOf(el), role: roleOf(el), id: el && el.id || '', tag: el && el.tagName ? el.tagName.toLowerCase() : '',
      href: el && el.getAttribute ? el.getAttribute('href') || '' : '', label: labelOf(el),
      trusted: e.isTrusted, x: Math.round(e.clientX), y: Math.round(e.clientY), screen_x: Math.round(e.screenX), screen_y: Math.round(e.screenY)
    });
  }, true);

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!isField(el)) return;
    if (el.type === 'checkbox' || el.type === 'radio') return; // reported by change
    send('input', { label: labelOf(el), value: el.isContentEditable ? clean(el.textContent, 500) : el.value, id: el.id || '',
      role: roleOf(el), input_type: e.inputType || '', trusted: e.isTrusted });
  }, true);

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!isField(el)) return;
    var d = { label: labelOf(el), id: el.id || '', role: roleOf(el), trusted: e.isTrusted };
    if (el.type === 'checkbox' || el.type === 'radio') d.checked = el.checked; else d.value = el.value;
    send('change', d);
  }, true);

  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (isField(el)) send('focus', { label: labelOf(el), id: el.id || '', role: roleOf(el) });
  }, true);

  document.addEventListener('keydown', function (e) {
    var named = e.key && e.key.length > 1 && ['Shift', 'Meta', 'Control', 'Alt', 'CapsLock'].indexOf(e.key) < 0;
    var chord = e.metaKey || e.ctrlKey;
    if (!named && !chord) return;
    var el = e.target, field = isField(el);
    send('key', { key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey,
      label: field ? labelOf(el) : '', role: field ? roleOf(el) : '', id: el && el.id || '', trusted: e.isTrusted });
    if (e.key === 'Enter' && field && roleOf(el) === 'searchbox') send('search', { label: labelOf(el), value: el.value, id: el.id || '' });
  }, true);

  var selTimer = null, lastSel = '';
  document.addEventListener('selectionchange', function () {
    clearTimeout(selTimer);
    selTimer = setTimeout(function () {
      var s = clean(String(window.getSelection ? window.getSelection() : ''), 200);
      if (s && s !== lastSel) { lastSel = s; send('selection', { text: s }); }
      if (!s) lastSel = '';
    }, 300);
  });

  // Scroll: leading and trailing edge, at most one event per 250 ms; a layout event once it settles.
  var lastScroll = 0, scrollTimer = null, layoutTimer = null;
  function scrolled() { lastScroll = Date.now(); scrollTimer = null; send('scroll', scrollState()); }
  window.addEventListener('scroll', function () {
    var wait = 250 - (Date.now() - lastScroll);
    if (wait <= 0 && !scrollTimer) scrolled();
    else if (!scrollTimer) scrollTimer = setTimeout(scrolled, Math.max(0, wait));
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(function () {
      if (document.querySelector('[data-bench-rect]')) send('layout', { rects: rects(), window: windowBox(), scrollY: Math.round(window.scrollY) });
    }, 400);
  }, { passive: true });
  window.addEventListener('resize', function () {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(function () { send('layout', { rects: rects(), window: windowBox(), scrollY: Math.round(window.scrollY) }); }, 400);
  });

  window.DotBench = { send: send, labelOf: labelOf };
})();
