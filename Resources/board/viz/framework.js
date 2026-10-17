// Dot's explainer framework. Every widget in the catalog is a small spec registered here:
//
//   Viz.register("lin-span-independence", {
//     title, subject, shows,                 // what it is, in Dot's words
//     params: { uX: {kind: "number", default: 4, min: -6, max: 6, step: 0.5, label: "u_x"}, ... },
//     formula: function (v) { return "A = |\\det(u,v)| = " + Viz.n(det) },   // LaTeX, his numbers in it
//     status:  function (v) { return "Independent: the area is <b>11</b>" }, // one sentence, may use <b>
//     draw:    function (api, v) { ... },     // the diagram, drawn with api helpers into an SVG
//     steps:   ["denature", "anneal", "extend"],   // optional: a process with back / play / next
//     examples: [{name: "dependent", values: {...}}],
//     size: [360, 260]                        // optional viewBox
//   });
//
// The framework builds the controls from params, typesets the formula, redraws on every change,
// keeps the house style (palette, grid, arrowheads, label sizes) and reports changes to Dot.
// Classic script on purpose: WKWebView cannot import ES modules from file:// URLs.
(function () {
  "use strict";
  var registry = {}, instances = [];
  var SVGNS = "http://www.w3.org/2000/svg";

  // ---- numbers ------------------------------------------------------------------------------
  function trim(x, digits) {
    if (!isFinite(x)) return x > 0 ? "∞" : x < 0 ? "−∞" : "undefined";
    var d = digits == null ? 2 : digits;
    var s = (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    if (s === "-0") s = "0";
    return s;
  }
  // For text: a real minus sign. For LaTeX: n() plain, p() in parentheses when negative.
  function fmt(x, digits) { return String(trim(x, digits)).replace(/^-/, "−"); }
  function n(x, digits) { return String(trim(x, digits)); }
  function p(x, digits) { var s = n(x, digits); return s.charAt(0) === "-" ? "(" + s + ")" : s; }
  function money(x, digits) {
    var neg = x < 0, a = Math.abs(x), s;
    s = a >= 1e9 ? trim(a / 1e9, 2) + "bn" : a >= 1e6 ? trim(a / 1e6, 2) + "m" : a.toLocaleString("en-US", {maximumFractionDigits: digits == null ? 2 : digits});
    return (neg ? "(" : "") + "$" + s + (neg ? ")" : "");
  }
  function pct(x, digits) { return trim(x * 100, digits == null ? 1 : digits) + "%"; }
  function sub(text) { // u_1 -> u₁, x^2 -> x², for SVG labels
    var subs = {"0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋",
                "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ", "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ", "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ", "v": "ᵥ", "x": "ₓ"};
    var sups = {"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "n": "ⁿ", "-": "⁻", "T": "ᵀ"};
    return String(text).replace(/_\{([^}]*)\}/g, function (_, grp) { return grp.split("").map(function (c) { return subs[c] || c; }).join(""); })
                       .replace(/_(\w)/g, function (_, c) { return subs[c] || "_" + c; })
                       .replace(/\^([\w-])/g, function (_, c) { return sups[c] || "^" + c; });
  }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"}[c]; }); }

  // ---- params -------------------------------------------------------------------------------
  function normalizeParams(params) {
    var out = {};
    Object.keys(params || {}).forEach(function (k) {
      var q = Object.assign({}, params[k]);
      q.kind = q.kind || (typeof q.default === "boolean" ? "boolean" : Array.isArray(q.values) ? "enum" : "number");
      if (q.kind === "integer") { q.step = q.step || 1; }
      if (q.kind === "number" && q.step == null) q.step = niceStep((q.max - q.min) / 100);
      if (q.kind === "enum") q.values = q.values || q.allowedValues || [];
      if (q.default == null) q.default = q.kind === "boolean" ? false : q.kind === "enum" ? q.values[0] : (q.min + q.max) / 2;
      out[k] = q;
    });
    return out;
  }
  function niceStep(raw) {
    var e = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / e;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
  }
  function coerce(q, value) {
    if (q.kind === "boolean") return value === true || value === "true" || value === 1;
    if (q.kind === "enum") return q.values.indexOf(value) >= 0 ? value : q.default;
    var x = Number(value);
    if (!isFinite(x)) return q.default;
    if (q.min != null && q.max != null) x = clamp(x, q.min, q.max);
    if (q.kind === "integer") x = Math.round(x);
    return x;
  }

  // ---- registration -------------------------------------------------------------------------
  function register(id, spec) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new Error("viz id must be kebab-case: " + id);
    if (!spec || typeof spec.draw !== "function") throw new Error("viz " + id + " needs a draw function");
    spec.id = id;
    spec.params = normalizeParams(spec.params);
    registry[id] = spec;
    document.dispatchEvent(new CustomEvent("viz:registered", {detail: {id: id}}));
    return spec;
  }

  // ---- drawing helpers (the house style) ---------------------------------------------------
  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function palette(root) {
    var cs = getComputedStyle(root), get = function (name, fallback) { return (cs.getPropertyValue(name) || "").trim() || fallback; };
    return {c1: get("--viz-c1", "#2dd4bf"), c2: get("--viz-c2", "#60a5fa"), c3: get("--viz-c3", "#fbbf24"),
            c4: get("--viz-c4", "#4ade80"), c5: get("--viz-c5", "#f87171"), c6: get("--viz-c6", "#c084fc"),
            ink: get("--viz-ink", "#f0ebe3"), muted: get("--viz-muted", "#a39b90"), faint: get("--viz-faint", "rgba(240,235,227,0.38)"),
            accent: get("--viz-accent", "#ff6b2c"), grid: get("--viz-grid", "rgba(255,255,255,0.07)"), axis: get("--viz-axis", "rgba(255,255,255,0.36)"),
            card: get("--viz-card", "#151311")};
  }

  function makeApi(inst) {
    var svg = inst.svg, defs = el("defs", {}, svg), root = el("g", {}, svg), colors = inst.colors;
    var markers = {};
    var W = inst.size[0], H = inst.size[1];
    function marker(color) {
      if (markers[color]) return markers[color];
      var id = "vz-arrow-" + inst.uid + "-" + Object.keys(markers).length;
      var m = el("marker", {id: id, viewBox: "0 0 10 10", refX: 8.2, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse", markerUnits: "userSpaceOnUse"}, defs);
      m.setAttribute("markerWidth", 11); m.setAttribute("markerHeight", 11);
      el("path", {d: "M 0 0.8 L 10 5 L 0 9.2 Z", fill: color}, m);
      markers[color] = "url(#" + id + ")";
      return markers[color];
    }
    function style(e, o) {
      o = o || {};
      if (o.opacity != null) e.setAttribute("opacity", o.opacity);
      if (o.className) e.setAttribute("class", o.className);
      return e;
    }
    var api = {
      svg: svg, root: root, defs: defs, w: W, h: H, color: colors, state: inst.state,
      fmt: fmt, n: n, p: p, money: money, pct: pct, sub: sub, clamp: clamp,
      group: function (attrs) { return el("g", attrs || {}, root); },
      line: function (a, b, o) {
        o = o || {};
        return style(el("line", {x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: o.color || colors.ink, "stroke-width": o.width || 2,
          "stroke-dasharray": o.dash || null, "stroke-linecap": "round", "marker-end": o.arrow ? marker(o.color || colors.ink) : null,
          "marker-start": o.arrowStart ? marker(o.color || colors.ink) : null}, o.parent || root), o);
      },
      // An arrow with a soft halo under it and its label in the same color.
      arrow: function (a, b, o) {
        o = o || {};
        var c = o.color || colors.c1, len = Math.hypot(b[0] - a[0], b[1] - a[1]), g = el("g", {}, o.parent || root);
        if (len < 1) return g;
        if (o.halo !== false) el("line", {x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: c, "stroke-width": (o.width || 3) + 6, opacity: 0.16, "stroke-linecap": "round"}, g);
        var shorten = Math.min(9, len * 0.4), ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
        el("line", {x1: a[0], y1: a[1], x2: b[0] - ux * shorten, y2: b[1] - uy * shorten, stroke: c, "stroke-width": o.width || 3,
          "stroke-linecap": "round", "stroke-dasharray": o.dash || null}, g);
        var hx = b[0], hy = b[1], s = o.head || 11, px = -uy, py = ux;
        el("path", {d: "M " + hx + " " + hy + " L " + (hx - ux * s + px * s * 0.45) + " " + (hy - uy * s + py * s * 0.45) +
          " L " + (hx - ux * s - px * s * 0.45) + " " + (hy - uy * s - py * s * 0.45) + " Z", fill: c}, g);
        if (o.label) {
          var at = o.labelAt === "mid" ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : b;
          var off = o.labelOffset || [ux * 10 + px * 10, uy * 10 + py * 10];
          api.label([at[0] + off[0], at[1] + off[1]], o.label, {color: c, weight: 650, size: o.labelSize || 14, anchor: "middle", parent: g});
        }
        return style(g, o);
      },
      point: function (at, o) {
        o = o || {};
        var g = el("g", {}, o.parent || root);
        el("circle", {cx: at[0], cy: at[1], r: o.r || 4.5, fill: o.fill || o.color || colors.ink, stroke: o.stroke || null, "stroke-width": o.stroke ? 2 : null}, g);
        if (o.label) api.label([at[0] + (o.dx == null ? 8 : o.dx), at[1] + (o.dy == null ? -8 : o.dy)], o.label, {color: o.labelColor || o.color || colors.ink, size: o.size || 13, anchor: o.anchor || "start", parent: g});
        return style(g, o);
      },
      label: function (at, text, o) {
        o = o || {};
        if (o.clamp !== false) {
          var est = String(text).length * (o.size || 13) * 0.56, a = o.anchor || "start";
          var lo = a === "end" ? est + 3 : a === "middle" ? est / 2 + 3 : 3, hi = a === "start" ? est + 3 : a === "middle" ? est / 2 + 3 : 3;
          at = [clamp(at[0], lo, W - hi), clamp(at[1], (o.size || 13) * 0.6 + 2, H - (o.size || 13) * 0.6 - 2)];
        }
        var t = el("text", {x: at[0], y: at[1], fill: o.color || colors.ink, "font-size": o.size || 13, "font-weight": o.weight || 500,
          "text-anchor": o.anchor || "start", "dominant-baseline": o.baseline || "middle", "font-style": o.italic ? "italic" : null}, o.parent || root);
        t.textContent = o.raw ? text : sub(text);
        return style(t, o);
      },
      rect: function (x, y, w, h, o) {
        o = o || {};
        return style(el("rect", {x: x, y: y, width: Math.max(0, w), height: Math.max(0, h), rx: o.rx == null ? 6 : o.rx, fill: o.fill || "none",
          "fill-opacity": o.fillOpacity, stroke: o.stroke || null, "stroke-width": o.stroke ? (o.width || 1.5) : null, "stroke-dasharray": o.dash || null}, o.parent || root), o);
      },
      circle: function (c, r, o) {
        o = o || {};
        return style(el("circle", {cx: c[0], cy: c[1], r: Math.max(0, r), fill: o.fill || "none", "fill-opacity": o.fillOpacity,
          stroke: o.stroke || null, "stroke-width": o.stroke ? (o.width || 2) : null, "stroke-dasharray": o.dash || null}, o.parent || root), o);
      },
      polygon: function (pts, o) {
        o = o || {};
        return style(el("polygon", {points: pts.map(function (q) { return q[0] + "," + q[1]; }).join(" "), fill: o.fill || "none", "fill-opacity": o.fillOpacity == null ? 0.2 : o.fillOpacity,
          stroke: o.stroke || null, "stroke-width": o.stroke ? (o.width || 1.5) : null, "stroke-dasharray": o.dash || null, "stroke-linejoin": "round"}, o.parent || root), o);
      },
      path: function (d, o) {
        o = o || {};
        return style(el("path", {d: d, fill: o.fill || "none", "fill-opacity": o.fillOpacity, stroke: o.stroke || null, "stroke-width": o.stroke ? (o.width || 2) : null,
          "stroke-dasharray": o.dash || null, "stroke-linecap": "round", "stroke-linejoin": "round", "marker-end": o.arrow ? marker(o.stroke || colors.ink) : null}, o.parent || root), o);
      },
      polyline: function (pts, o) {
        if (!pts.length) return null;
        return api.path("M " + pts.map(function (q) { return q[0].toFixed(2) + " " + q[1].toFixed(2); }).join(" L "), Object.assign({stroke: colors.c2}, o || {}));
      },
      // A coordinate plane with grid, axes, arrowheads and end ticks. Returns scales and px().
      plane: function (o) {
        o = o || {};
        var xr = o.x || [-5, 5], yr = o.y || [-4, 4], pad = o.pad == null ? 22 : o.pad;
        var box = o.box || [pad, pad, W - 2 * pad, H - 2 * pad];
        var sx = box[2] / (xr[1] - xr[0]), sy = box[3] / (yr[1] - yr[0]);
        if (o.equal !== false) { var s = Math.min(sx, sy); sx = s; sy = s; }
        var cx = box[0] + (box[2] - sx * (xr[1] - xr[0])) / 2, cy = box[1] + (box[3] - sy * (yr[1] - yr[0])) / 2;
        var X = function (x) { return cx + (x - xr[0]) * sx; }, Y = function (y) { return cy + (yr[1] - y) * sy; };
        var g = el("g", {}, root), step = o.step || 1;
        if (o.grid !== false) {
          for (var gx = Math.ceil(xr[0] / step) * step; gx <= xr[1] + 1e-9; gx += step) el("line", {x1: X(gx), y1: Y(yr[0]), x2: X(gx), y2: Y(yr[1]), stroke: colors.grid, "stroke-width": 1}, g);
          for (var gy = Math.ceil(yr[0] / step) * step; gy <= yr[1] + 1e-9; gy += step) el("line", {x1: X(xr[0]), y1: Y(gy), x2: X(xr[1]), y2: Y(gy), stroke: colors.grid, "stroke-width": 1}, g);
        }
        if (o.axes !== false) {
          var ax = colors.axis, m = marker(ax);
          if (yr[0] <= 0 && yr[1] >= 0) el("line", {x1: X(xr[0]), y1: Y(0), x2: X(xr[1]) + 6, y2: Y(0), stroke: ax, "stroke-width": 1.4, "marker-end": m}, g);
          if (xr[0] <= 0 && xr[1] >= 0) el("line", {x1: X(0), y1: Y(yr[0]), x2: X(0), y2: Y(yr[1]) - 6, stroke: ax, "stroke-width": 1.4, "marker-end": m}, g);
          if (o.labels !== false) {
            api.label([X(xr[1]) - 2, Y(0) - 11], o.xLabel || "x", {color: colors.muted, size: 12.5, anchor: "end", parent: g});
            api.label([X(0) + 9, Y(yr[1]) + 6], o.yLabel || "y", {color: colors.muted, size: 12.5, parent: g});
          }
          if (o.ticks !== false) {
            var tk = o.tickEvery || Math.max(step, Math.ceil((xr[1] - xr[0]) / 8));
            for (var tx = Math.ceil(xr[0] / tk) * tk; tx <= xr[1] + 1e-9; tx += tk) if (Math.abs(tx) > 1e-9) api.label([X(tx), Y(0) + 14], fmt(tx), {color: colors.muted, size: 12, anchor: "middle", parent: g, className: "tick"});
            for (var ty = Math.ceil(yr[0] / tk) * tk; ty <= yr[1] + 1e-9; ty += tk) if (Math.abs(ty) > 1e-9) api.label([X(0) - 6, Y(ty)], fmt(ty), {color: colors.muted, size: 12, anchor: "end", parent: g, className: "tick"});
          }
        }
        var through = function (q, d) { // the infinite line q + t d, clipped to the plane's range; null if it misses
          var t0 = -Infinity, t1 = Infinity, lim = [[d[0], q[0], xr[0], xr[1]], [d[1], q[1], yr[0], yr[1]]];
          for (var i = 0; i < 2; i++) {
            var dd = lim[i][0], qq = lim[i][1], lo = lim[i][2], hi = lim[i][3];
            if (Math.abs(dd) < 1e-12) { if (qq < lo || qq > hi) return null; continue; }
            var ta = (lo - qq) / dd, tb = (hi - qq) / dd; if (ta > tb) { var tmp = ta; ta = tb; tb = tmp; }
            t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          }
          return t0 > t1 ? null : [[q[0] + t0 * d[0], q[1] + t0 * d[1]], [q[0] + t1 * d[0], q[1] + t1 * d[1]]];
        };
        return {x: X, y: Y, px: function (q) { return [X(q[0]), Y(q[1])]; }, sx: sx, sy: sy, xr: xr, yr: yr, through: through,
                lineThrough: function (q, d, lo) { var seg = through(q, d); return seg ? api.line([X(seg[0][0]), Y(seg[0][1])], [X(seg[1][0]), Y(seg[1][1])], lo) : null; },
                invert: function (q) { return [xr[0] + (q[0] - cx) / sx, yr[1] - (q[1] - cy) / sy]; }};
      },
      // A draggable dot. onDrag gets the new position in data coords (with plane) or px.
      handle: function (at, o) {
        o = o || {};
        var g = el("g", {class: "handle"}, root), c = o.color || colors.ink;
        el("circle", {cx: at[0], cy: at[1], r: (o.r || 7) + 9, fill: c, opacity: 0.0001}, g);
        el("circle", {cx: at[0], cy: at[1], r: o.r || 7, fill: c, stroke: colors.card, "stroke-width": 2.5}, g);
        if (o.label) api.label([at[0] + 12, at[1] - 12], o.label, {color: c, size: 13, weight: 650, parent: g});
        g.addEventListener("pointerdown", function (ev) {
          ev.preventDefault();
          inst.dragging = true;
          var move = function (e) {
            var m = svg.getScreenCTM(); if (!m) return;
            var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
            var q = pt.matrixTransform(m.inverse()), v = [q.x, q.y];
            if (o.plane) { v = o.plane.invert(v); if (o.snap) v = [Math.round(v[0] / o.snap) * o.snap, Math.round(v[1] / o.snap) * o.snap]; }
            if (o.onDrag) o.onDrag(v);
          };
          var up = function () { inst.dragging = false; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); inst.report(true); };
          window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
        });
        return g;
      },
      set: function (patch) { inst.set(patch, true); },
      step: inst.state.step
    };
    return api;
  }

  // ---- mounting -----------------------------------------------------------------------------
  var uidCounter = 0;
  function mount(host, id, values, opts) {
    opts = opts || {};
    var spec = registry[id];
    var rootEl = document.createElement("div");
    rootEl.className = "viz";
    rootEl.dataset.viz = id;
    host.appendChild(rootEl);
    if (!spec) {
      rootEl.innerHTML = '<div class="viz-error">No explainer called “' + esc(id) + '” yet.</div>';
      return null;
    }
    var inst = {id: id, spec: spec, uid: ++uidCounter, root: rootEl, size: spec.size || [360, 260], state: {}, dragging: false, lastReport: 0, reportTimer: null};
    // A value the caller passes outside a slider's range widens that range for this instance (up to twice its span
    // past either end), so a panel's own example shows as written instead of being clamped into a different case.
    inst.params = {};
    Object.keys(spec.params).forEach(function (k) {
      var q = spec.params[k], v = values && k in values ? Number(values[k]) : NaN;
      if ((q.kind === "number" || q.kind === "integer") && isFinite(v) && q.min != null && q.max != null && (v < q.min || v > q.max)) {
        var span = q.max - q.min;
        if (v >= q.min - 2 * span && v <= q.max + 2 * span) {
          q = Object.assign({}, q, {min: Math.min(q.min, v), max: Math.max(q.max, v)});
        } else if (window.console) console.warn("viz " + id + ": " + k + "=" + v + " is far outside " + q.min + ".." + q.max);
      }
      inst.params[k] = q;
      inst.state[k] = coerce(q, values && k in values ? values[k] : q.default);
    });
    var stepLabels = Array.isArray(spec.steps) ? spec.steps : spec.steps ? Array.from({length: spec.steps}, function (_, i) { return "step " + (i + 1); }) : null;
    if (stepLabels) inst.state.step = clamp(Number(values && values.step) || 1, 1, stepLabels.length);

    rootEl.innerHTML = '<div class="viz-body"><div class="viz-side"><div class="viz-title"></div><div class="viz-formula"></div>' +
      '<div class="viz-status"></div><div class="viz-controls"></div></div><div class="viz-figure"></div></div>';
    var side = rootEl.querySelector(".viz-side"), figure = rootEl.querySelector(".viz-figure");
    rootEl.querySelector(".viz-title").textContent = opts.title || spec.title || id;
    inst.formulaEl = rootEl.querySelector(".viz-formula");
    inst.statusEl = rootEl.querySelector(".viz-status");
    inst.svg = document.createElementNS(SVGNS, "svg");
    inst.svg.setAttribute("viewBox", "0 0 " + inst.size[0] + " " + inst.size[1]);
    inst.svg.setAttribute("role", "img");
    inst.svg.setAttribute("aria-label", spec.shows || spec.title || id);
    figure.appendChild(inst.svg);
    inst.colors = palette(rootEl);

    // controls from params (a param with control: false is driven by a handle only)
    var controls = rootEl.querySelector(".viz-controls");
    inst.controls = {};
    Object.keys(inst.params).forEach(function (k) {
      var q = inst.params[k];
      if (q.control === false) return;
      var row = document.createElement("div");
      row.className = "viz-control";
      row.dataset.param = k;
      var lab = document.createElement("label");
      renderMath(lab, q.label || k, true);
      row.appendChild(lab);
      if (q.kind === "enum") {
        var seg = document.createElement("div"); seg.className = "viz-seg";
        q.values.forEach(function (val) {
          var b = document.createElement("button"); b.type = "button"; b.textContent = (q.names && q.names[val]) || val; b.dataset.value = val;
          b.addEventListener("click", function () { var patch = {}; patch[k] = val; inst.set(patch, true); });
          seg.appendChild(b);
        });
        row.appendChild(seg);
        inst.controls[k] = {kind: "enum", el: seg};
      } else if (q.kind === "boolean") {
        var t = document.createElement("button"); t.type = "button"; t.className = "viz-toggle";
        t.addEventListener("click", function () { var patch = {}; patch[k] = !inst.state[k]; inst.set(patch, true); });
        row.appendChild(t);
        inst.controls[k] = {kind: "boolean", el: t, on: q.on || "on", off: q.off || "off"};
      } else {
        var num = document.createElement("input"); num.className = "num"; num.type = "text"; num.inputMode = "decimal";
        var range = document.createElement("input"); range.type = "range"; range.min = q.min; range.max = q.max; range.step = q.step;
        range.addEventListener("input", function () { var patch = {}; patch[k] = Number(range.value); inst.set(patch, true); });
        num.addEventListener("change", function () { var patch = {}; patch[k] = Number(num.value.replace("−", "-")); inst.set(patch, true); });
        row.appendChild(num); row.appendChild(range);
        inst.controls[k] = {kind: "number", el: range, num: num};
      }
      controls.appendChild(row);
    });

    if (stepLabels) {
      var bar = document.createElement("div"); bar.className = "viz-steps";
      bar.innerHTML = '<button type="button" class="back">back</button><span class="label"></span><button type="button" class="play">play</button><button type="button" class="next">next</button>';
      figure.appendChild(bar);
      inst.stepLabels = stepLabels;
      inst.stepBar = bar;
      bar.querySelector(".back").addEventListener("click", function () { inst.stop(); inst.set({step: inst.state.step - 1}, true); });
      bar.querySelector(".next").addEventListener("click", function () { inst.stop(); inst.set({step: inst.state.step + 1}, true); });
      bar.querySelector(".play").addEventListener("click", function () { inst.playing ? inst.stop() : inst.play(); });
    }

    inst.play = function () {
      if (!stepLabels) return;
      if (inst.state.step >= stepLabels.length) inst.state.step = 0;
      inst.playing = true;
      var tick = function () {
        if (!inst.playing) return;
        if (inst.state.step >= stepLabels.length) { inst.stop(); return; }
        inst.set({step: inst.state.step + 1}, true);
        inst.timer = setTimeout(tick, spec.stepMs || 1400);
      };
      tick();
    };
    inst.stop = function () { inst.playing = false; clearTimeout(inst.timer); inst.syncControls(); };

    inst.set = function (patch, fromUser) {
      Object.keys(patch || {}).forEach(function (k) {
        if (k === "step" && stepLabels) inst.state.step = clamp(Math.round(patch.step), 1, stepLabels.length);
        else if (inst.params[k]) inst.state[k] = coerce(inst.params[k], patch[k]);
      });
      if (inst.raf) return;
      inst.raf = requestAnimationFrame(function () { inst.raf = 0; inst.render(); if (fromUser) inst.report(false); });
    };
    inst.syncControls = function () {
      Object.keys(inst.controls).forEach(function (k) {
        var c = inst.controls[k], v = inst.state[k];
        if (c.kind === "number") {
          var q = inst.params[k], digits = Math.max(0, Math.min(6, Math.ceil(-Math.log10(q.step || 1) - 1e-9)));
          // a value set off the slider's grid (Dot passes its own example's numbers) shows its real digits
          while (digits < 4 && Math.abs(Number(v.toFixed(digits)) - v) > 1e-9) digits++;
          if (document.activeElement !== c.num) c.num.value = fmt(v, digits).replace("−", "-");
          if (Number(c.el.value) !== v) c.el.value = v;
        }
        else if (c.kind === "enum") Array.from(c.el.children).forEach(function (b) { b.classList.toggle("on", b.dataset.value === String(v)); });
        else { c.el.classList.toggle("on", !!v); c.el.textContent = v ? c.on : c.off; }
      });
      if (inst.stepBar) {
        inst.stepBar.querySelector(".label").textContent = inst.state.step + " of " + stepLabels.length + ": " + stepLabels[inst.state.step - 1];
        inst.stepBar.querySelector(".back").disabled = inst.state.step <= 1;
        inst.stepBar.querySelector(".next").disabled = inst.state.step >= stepLabels.length;
        inst.stepBar.querySelector(".play").textContent = inst.playing ? "pause" : "play";
      }
    };
    inst.render = function () {
      try {
        while (inst.svg.firstChild) inst.svg.removeChild(inst.svg.firstChild);
        var api = makeApi(inst);
        spec.draw(api, inst.state);
        renderMath(inst.formulaEl, spec.formula ? spec.formula(inst.state) : "", false);
        inst.statusEl.innerHTML = spec.status ? sanitizeInline(spec.status(inst.state)) : "";
        inst.syncControls();
        delete rootEl.dataset.vizError;
      } catch (e) {
        rootEl.dataset.vizError = String(e && e.message || e);
        console.error("viz[" + id + "] " + (e && e.stack || e));
        inst.statusEl.textContent = "This explainer hit an error: " + (e && e.message || e);
      }
    };
    // Report a change to Dot in the board's event shape, at most once per 1.5 s, only from him.
    inst.report = function (final) {
      var now = Date.now(), send = function () {
        inst.lastReport = Date.now();
        var data = {id: id, values: Object.assign({}, inst.state)};
        try { window.webkit.messageHandlers.dot.postMessage({type: "event", kind: "viz", data: data, card: document.body.dataset.card || ""}); } catch (e) {}
        document.dispatchEvent(new CustomEvent("viz:change", {detail: data}));
      };
      clearTimeout(inst.reportTimer);
      if (final || now - inst.lastReport > 1500) send(); else inst.reportTimer = setTimeout(send, 1500 - (now - inst.lastReport));
    };

    if (window.ResizeObserver) new ResizeObserver(function () { requestAnimationFrame(function () { rootEl.classList.toggle("narrow", rootEl.clientWidth < 560); }); }).observe(rootEl);
    rootEl.classList.toggle("narrow", (host.clientWidth || 720) < 560);
    instances.push(inst);
    inst.render();
    return inst;
  }

  function renderMath(target, tex, inline) {
    if (!tex) { target.textContent = ""; return; }
    if (window.katex) {
      try { window.katex.render(String(tex), target, {throwOnError: false, displayMode: false, strict: "ignore"}); return; } catch (e) {}
    }
    target.textContent = inline ? sub(tex) : tex;
  }
  // Status lines may bold a number; nothing else survives.
  function sanitizeInline(html) {
    return esc(html).replace(/&lt;(\/?)b&gt;/g, "<$1b>");
  }

  // Mount every <div data-viz-id="..." data-values='{...}'> on the page (the panel uses this).
  function mountAll(scope) {
    Array.from((scope || document).querySelectorAll("[data-viz-id]:not([data-viz-mounted])")).forEach(function (host) {
      host.dataset.vizMounted = "1";
      var values = {};
      try { values = host.dataset.values ? JSON.parse(host.dataset.values) : {}; } catch (e) { console.error("viz values not JSON: " + host.dataset.values); }
      mount(host, host.dataset.vizId, values, {title: host.dataset.title});
    });
  }

  window.Viz = {
    register: register, mount: mount, mountAll: mountAll,
    get: function (id) { return registry[id]; },
    list: function () { return Object.keys(registry).sort(); },
    instances: instances,
    fmt: fmt, n: n, p: p, money: money, pct: pct, sub: sub, clamp: clamp
  };
  // Test hooks for scripts/viz-check.py.
  window.__viz = {
    set: function (i, patch) { instances[i].set(patch, false); },
    state: function (i) { return Object.assign({}, instances[i].state); },
    markup: function (i) { return instances[i].svg.outerHTML; },
    error: function (i) { return instances[i] ? instances[i].root.dataset.vizError || null : "no instance"; }
  };
})();
