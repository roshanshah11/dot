// The Poisson distribution: counts of events that happen independently at a steady average rate, lambda per interval.
// One bar per count k with height e^(-lambda) lambda^k / k!, worked in logs so k = 40 never overflows. The amber bar is
// the count asked about (slider or drag its handle); under the axis, the mean lambda and a bracket of one standard
// deviation sqrt(lambda) either side, since a Poisson count's variance equals its mean. The k axis runs to the first of
// 10, 20, 30 or 40 that holds lambda + 4 sqrt(lambda) and the chosen k, so the bars stay wide enough to read.
(function () {
  function lfact(k) { var s = 0; for (var i = 2; i <= k; i++) s += Math.log(i); return s; }
  function pmf(lam, k) { return Math.exp(-lam + k * Math.log(lam) - lfact(k)); }
  function calc(v) {
    var lam = v.lambda, k = v.count, need = Math.max(lam + 4 * Math.sqrt(lam), k), K = [10, 20, 30, 40].filter(function (x) { return x >= need; })[0] || 40;
    var probs = [], best = 0, cdf = 0;
    for (var j = 0; j <= K; j++) { probs.push(pmf(lam, j)); best = Math.max(best, probs[j]); if (j <= k) cdf += probs[j]; }
    var modes = []; probs.forEach(function (q, j) { if (q > best * (1 - 1e-9)) modes.push(j); });
    return {lam: lam, k: k, K: K, probs: probs, p: pmf(lam, k), best: best, modes: modes, sd: Math.sqrt(lam), cdf: cdf};
  }
  function pr(x, tex) { // 4 decimals, 2 significant figures when small, powers of ten when tiny
    if (x >= 0.01) return Viz.fmt(x, 4);
    if (x >= 1e-4) return String(Number(x.toPrecision(2)));
    var e = x.toExponential(1).split("e"), sup = {"-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹"};
    return tex ? e[0] + "\\times10^{" + Number(e[1]) + "}" : e[0] + "×10" + String(Number(e[1])).split("").map(function (ch) { return sup[ch]; }).join("");
  }

  Viz.register("poisson-distribution", {
    title: "Poisson distribution",
    subject: "stats",
    shows: "Set the average rate λ and pick a count k: each bar is the chance of exactly that many events, centred on λ with spread √λ",
    params: {
      lambda: {kind: "number", default: 5, min: 0.5, max: 20, step: 0.1, label: "\\lambda"},
      count: {kind: "integer", default: 5, min: 0, max: 40, label: "k"}
    },
    formula: function (v) {
      var b = calc(v), l = Viz.n(b.lam, 1);
      return "\\begin{array}{l}P(X=" + b.k + ")=\\dfrac{e^{-" + l + "}\\cdot " + l + "^{" + b.k + "}}{" + b.k + "!}\\\\[8pt]\\qquad\\qquad\\ =" + pr(b.p, true) +
        "\\\\[8pt]\\mu=\\lambda=" + l + ",\\quad \\sigma=\\sqrt{\\lambda}=" + Viz.n(b.sd, 2) + "\\end{array}";
    },
    status: function (v) {
      var b = calc(v), mode = b.modes.length > 1 ? "<b>" + b.modes.join("</b> and <b>") + "</b> tie as the most likely counts" : "the most likely count is <b>" + b.modes[0] + "</b>";
      return "With " + Viz.fmt(b.lam, 1) + " events expected per interval, exactly " + b.k + " happen" + (b.k === 1 ? "s" : "") + " with probability <b>" + pr(b.p) + "</b>; " + mode + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {lambda: 0.5, count: 0}},
      {name: "Maximum supported values", values: {lambda: 20, count: 40}},
      {name: "rare events: λ = 1.5, k = 0", values: {lambda: 1.5, count: 0}},
      {name: "far in the tail: λ = 3, k = 12", values: {lambda: 3, count: 12}},
      {name: "big rate looks normal: λ = 15", values: {lambda: 15, count: 15}}
    ],
    size: [390, 280],
    draw: function (api, v) {
      var c = api.color, b = calc(v), K = b.K;
      // the y axis tops out where the tallest bar stays at least 34 px under the top gridline, room for the value label
      var top = [0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].filter(function (t) { return b.best <= t * (1 - 34 / 172); })[0] || 1;
      var halo = function (e) { e.setAttribute("stroke", c.card); e.setAttribute("stroke-width", 4); e.setAttribute("paint-order", "stroke"); e.setAttribute("stroke-linejoin", "round"); return e; };
      var tk = top <= 0.1 ? 0.02 : top <= 0.2 ? 0.05 : 0.1;
      var pl = api.plane({x: [-0.7, K + 0.7], y: [0, top], box: [52, 34, 322, 172], equal: false, grid: false, axes: false});
      for (var t = 0; t <= top + 1e-9; t += tk) {
        api.line([pl.x(-0.7), pl.y(t)], [pl.x(K + 0.7), pl.y(t)], {color: c.grid, width: 1});
        api.label([pl.x(-0.7) - 7, pl.y(t)], api.fmt(t, 2), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([pl.x(-0.7), 14], "P(X = k)", {color: c.muted, size: 12});
      var bw = Math.max(2.5, Math.min(26, pl.sx * 0.74)), y0 = pl.y(0), every = K <= 10 ? 1 : 5;
      b.probs.forEach(function (q, j) {
        var on = j === b.k, h = Math.max(0, y0 - pl.y(q));
        api.rect(pl.x(j) - bw / 2, y0 - h, bw, h, {fill: on ? c.c3 : c.c1, fillOpacity: on ? 0.95 : 0.6, rx: bw > 6 ? 2 : 0.5});
        var near = every > 1 && j !== b.k && Math.abs(j - b.k) <= 2;
        if ((j % every === 0 && !near) || on) api.label([pl.x(j), y0 + 14], String(j), {color: on ? c.c3 : c.muted, size: 12, anchor: "middle", weight: on ? 700 : 500});
      });
      api.line([pl.x(-0.7), y0], [pl.x(K + 0.7) + 4, y0], {color: c.axis, width: 1.3});
      api.label([pl.x(K + 0.7) + 8, y0], "k", {color: c.muted, size: 12.5, italic: true});
      // mean lambda and one standard deviation sqrt(lambda) either side
      var ym = y0 + 34, xm = pl.x(b.lam), lo = Math.max(-0.7, b.lam - b.sd);
      api.line([pl.x(lo), ym], [pl.x(b.lam + b.sd), ym], {color: c.c2, width: 2.5});
      [lo, b.lam + b.sd].forEach(function (x, i) { if (i || b.lam - b.sd >= -0.7) api.line([pl.x(x), ym - 5], [pl.x(x), ym + 5], {color: c.c2, width: 2}); });
      api.polygon([[xm, ym - 3], [xm - 6, ym - 12], [xm + 6, ym - 12]], {fill: c.c2, fillOpacity: 1});
      api.label([xm, ym + 17], "mean λ = " + api.fmt(b.lam, 1) + "; bracket: one σ = √λ = " + api.fmt(b.sd, 2) + " either side", {color: c.c2, size: 12, weight: 600, anchor: "middle"});
      // the chosen count: its probability and a handle to move it. The value goes over the handle, else beside it on
      // the side where the bars are lower, never so close to the y axis that it reads as a tick label and never on a
      // gridline; if every spot is blocked by a taller bar it rises above them with a leader back to the handle.
      var hk = pl.y(b.p), tiny = y0 - hk < 2, x = pl.x(b.k), hy = Math.min(hk, y0 - 2) - 6, txt = (tiny ? "≈ 0: " : "") + pr(b.p), w = txt.length * 7.6;
      var axL = pl.x(-0.7) + 12, snap = function (y) { for (var g = 0; g <= top + 1e-9; g += tk) if (Math.abs(y - pl.y(g)) < 8) y = pl.y(g) - 8.5; return y; };
      var blocked = function (x0, y) { return b.probs.some(function (q, j) { var bx = pl.x(j); return j !== b.k && bx + bw / 2 > x0 - 2 && bx - bw / 2 < x0 + w + 2 && pl.y(q) < y + 9; }); };
      var spots = [[x - w / 2, snap(hy - 16), "middle", x], [x + 11, snap(Math.min(hy, y0 - 12)), "start", x + 11], [x - 11 - w, snap(Math.min(hy, y0 - 12)), "end", x - 11]];
      var pick = spots.filter(function (s) { return s[0] >= axL && s[0] + w <= api.w - 4 && !blocked(s[0], s[1]); })[0];
      if (!pick) {
        pick = (x - w / 2 >= axL ? spots[0] : spots[1]).slice();
        b.probs.forEach(function (q, j) { var bx = pl.x(j); if (j !== b.k && bx + bw / 2 > pick[0] - 2 && bx - bw / 2 < pick[0] + w + 2) pick[1] = Math.min(pick[1], pl.y(q) - 11); });
        pick[1] = snap(pick[1]);
        if (pick[2] === "start") api.polyline([[x, hy - 7], [x, pick[1]], [pick[0] - 3, pick[1]]], {stroke: c.c3, width: 1.2});
        else api.line([x, hy - 7], [x, pick[1] + 8], {color: c.c3, width: 1.2});
      }
      halo(api.label([pick[3], pick[1]], txt, {color: c.c3, size: 13, weight: 700, anchor: pick[2]}));
      api.handle([x, hy], {color: c.c3, r: 6, onDrag: function (q) {
        api.set({count: Math.max(0, Math.min(40, Math.round(pl.invert(q)[0])))});
      }});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
