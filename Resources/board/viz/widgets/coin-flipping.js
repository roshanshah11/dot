// Flipping a coin with P(heads) = p, n times. The running share of heads swings early and then settles toward p
// (the law of large numbers); the shaded funnel is p ± 1.96·sqrt(p(1 − p)/k), where about 95% of runs sit after k flips.
// The bars on the right are the final counts on the same 0..1 height scale as the plot, so the heads bar ends level
// with the curve's last point, and the teal marks are the expected counts np and n(1 − p).
// Each run is one fixed seeded sequence of uniforms (flip i is heads when U_i < p), so sliding p or n redraws the same
// run instead of reshuffling it; the run slider deals a fresh sequence. Dot's own design: the queue names only the topic.
(function () {
  var cache = {};
  function uniforms(run) {
    if (cache[run]) return cache[run];
    var s = run * 7919 + 17, out = [];
    function rnd() { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    while (out.length < 500) out.push(rnd());
    return (cache[run] = out);
  }
  function calc(v) {
    var u = uniforms(v.run), heads = 0, path = [], seq = [];
    for (var i = 0; i < v.n; i++) { var h = u[i] < v.p; seq.push(h); if (h) heads++; path.push(heads / (i + 1)); }
    var phat = heads / v.n, se = Math.sqrt(v.p * (1 - v.p) / v.n);
    return {heads: heads, tails: v.n - heads, phat: phat, se: se, z: se > 0 ? (phat - v.p) / se : 0, path: path, seq: seq};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 3 : d); };

  Viz.register("coin-flipping", {
    title: "Coin flips and the law of large numbers",
    subject: "stats",
    shows: "Flip a coin n times: the share of heads jumps around at first, then settles toward p inside a funnel that narrows like 1/√n",
    params: {
      p: {kind: "number", default: 0.5, min: 0, max: 1, step: 0.01, label: "p"},
      n: {kind: "integer", default: 100, min: 1, max: 500, label: "n"},
      run: {kind: "integer", default: 1, min: 1, max: 10, label: "\\text{run}"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\hat p=\\dfrac{H}{n}=\\dfrac{" + k.heads + "}{" + v.n + "}=" + Viz.n(k.phat, 3) + "\\\\[4pt]" +
        "SE=\\sqrt{\\tfrac{p(1-p)}{n}}=\\sqrt{\\tfrac{" + Viz.n(v.p) + "\\cdot" + Viz.n(1 - v.p) + "}{" + v.n + "}}=" + Viz.n(k.se, 3) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (v.p === 0 || v.p === 1) return "With p = " + v.p + " every flip lands " + (v.p ? "heads" : "tails") + ": no randomness, so p̂ = <b>" + v.p + "</b> from the first flip.";
      if (v.n === 1) return "One flip came up <b>" + (k.heads ? "heads" : "tails") + "</b>, so p̂ = " + k.heads + ": a single flip says almost nothing about p.";
      var az = Math.abs(k.z), side = k.phat >= v.p ? "above" : "below";
      return "<b>" + k.heads + "</b> heads in " + v.n + " flips: p̂ = <b>" + f(k.phat) + "</b> is " + Viz.fmt(az, 1) + (Viz.fmt(az, 1) === "1" ? " standard error " : " standard errors ") + side + " p = " + Viz.fmt(v.p) +
        (az > 1.96 ? ", outside the 95% funnel, which happens in about 1 run in 20." : ", inside the 95% funnel; more flips pull it closer.");
    },
    examples: [
      {name: "ten fair flips", values: {p: 0.5, n: 10, run: 1}},
      {name: "five hundred fair flips", values: {p: 0.5, n: 500, run: 1}},
      {name: "a biased coin", values: {p: 0.7, n: 200, run: 3}},
      {name: "a run outside the funnel", values: {p: 0.5, n: 60, run: 2}},
      {name: "every input at its minimum", values: {p: 0, n: 1, run: 1}},
      {name: "every input at its maximum", values: {p: 1, n: 500, run: 10}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      // viz.css paints every svg text ink, which beats the fill attribute; an inline style restores the label colors
      var lab0 = api.label; api.label = function (at, t, o) { var e = lab0(at, t, o); if (o && o.color) e.style.fill = o.color; return e; };
      var c = api.color, k = calc(v), n = v.n;
      // the first flips as coins
      var shown = Math.min(n, 21);
      api.label([18, 13], "first " + shown + " flip" + (shown > 1 ? "s" : ""), {color: c.muted, size: 12});
      for (var i = 0; i < shown; i++) {
        var at = [24 + i * 17.6, 36], h = k.seq[i];
        api.circle(at, 7.6, {fill: h ? c.c3 : "none", fillOpacity: h ? 0.9 : null, stroke: h ? c.c3 : c.muted, width: 1.3});
        api.label(at, h ? "H" : "T", {color: h ? c.card : c.muted, size: 12, weight: 700, anchor: "middle", clamp: false});
      }
      // running share of heads, with the 95% funnel around p
      var x0 = 46, x1 = 290, yT = 74, yB = 262;
      var X = function (j) { return x0 + (x1 - x0) * j / n; }, Y = function (q) { return yB - (yB - yT) * q; };
      api.line([x0, yB], [x1, yB], {color: c.axis, width: 1.2});
      api.line([x0, yB], [x0, yT - 4], {color: c.axis, width: 1.2});
      [0, 0.5, 1].forEach(function (q) { api.label([x0 - 6, Y(q)], String(q), {color: c.muted, size: 12, anchor: "end"}); });
      api.label([x0 - 6, (Y(0.5) + Y(1)) / 2], "p̂", {color: c.c3, size: 13, anchor: "end", weight: 650, raw: true});
      api.label([x0, yB + 14], "0", {color: c.muted, size: 12, anchor: "middle"});
      api.label([x1, yB + 14], String(n), {color: c.muted, size: 12, anchor: "middle"});
      api.label([(x0 + x1) / 2, yB + 14], "flips", {color: c.muted, size: 12, anchor: "middle"});
      if (v.p > 0 && v.p < 1) {
        var up = [], lo = [];
        for (var j = 1; j <= n; j += Math.max(1, Math.floor(n / 160))) {
          var hw = 1.96 * Math.sqrt(v.p * (1 - v.p) / j);
          up.push([X(j), Y(Math.min(1, v.p + hw))]); lo.push([X(j), Y(Math.max(0, v.p - hw))]);
        }
        var hwn = 1.96 * k.se;
        up.push([X(n), Y(Math.min(1, v.p + hwn))]); lo.push([X(n), Y(Math.max(0, v.p - hwn))]);
        api.polygon(up.concat(lo.reverse()), {fill: c.c1, fillOpacity: 0.12});
      }
      api.line([x0, Y(v.p)], [x1, Y(v.p)], {color: c.c1, width: 1.6, dash: "6 4"});
      var pts = k.path.map(function (q, j) { return [X(j + 1), Y(q)]; });
      if (pts.length > 1) api.polyline(pts, {stroke: c.c3, width: 2});
      api.point(pts[pts.length - 1], {color: c.c3, r: 4.5});
      // the funnel label rides just above the funnel's upper edge
      var fun = n >= 20 && v.p > 0.06 && v.p < 0.94 ? [X(n * 0.62), Y(Math.min(0.97, v.p + 1.96 * Math.sqrt(v.p * (1 - v.p) / (n * 0.62)))) - 9] : null;
      if (fun) api.label(fun, "95% funnel", {color: c.c1, size: 12, anchor: "middle"});
      // the p label goes where the curve crosses it least: left, middle or right, above or below the line
      var best = null;
      [x0 + 8, (x0 + x1) / 2 - 22, x1 - 60].forEach(function (lx) {
        [-10, 12].forEach(function (dy) {
          var ly = Y(v.p) + dy, hits = 0;
          if (ly < yT - 6 || ly > yB - 6) hits += 1000;
          if (fun && lx < fun[0] + 34 && lx + 55 > fun[0] - 34 && Math.abs(ly - fun[1]) < 13) hits += 100;
          pts.forEach(function (q, j) { // a segment of the curve that passes through the label's box
            var a = pts[Math.max(0, j - 1)];
            if (Math.max(a[0], q[0]) > lx - 3 && Math.min(a[0], q[0]) < lx + 55 && Math.max(a[1], q[1]) > ly - 9 && Math.min(a[1], q[1]) < ly + 9) hits++;
          });
          if (!best || hits < best[2]) best = [lx, ly, hits];
        });
      });
      api.label([best[0], best[1]], "p = " + api.fmt(v.p), {color: c.c1, size: 12.5, weight: 650});
      // final counts on the same 0..1 scale
      var bw = 24, bars = [[334, k.heads, v.p, "H", c.c3], [372, k.tails, 1 - v.p, "T", c.muted]];
      bars.forEach(function (b) {
        var hgt = (yB - yT) * b[1] / n;
        api.rect(b[0] - bw / 2, yB - hgt, bw, hgt, {fill: b[4], fillOpacity: b[3] === "H" ? 0.85 : 0.45, rx: 3});
        api.line([b[0] - bw / 2 - 4, Y(b[2])], [b[0] + bw / 2 + 4, Y(b[2])], {color: c.c1, width: 2});
        var ly = yB - hgt - 10, clash = Math.abs(ly - Y(b[2])) < 9;
        api.label([b[0], clash ? Math.min(ly, Y(b[2])) - 10 : ly], String(b[1]), {color: b[3] === "H" ? c.c3 : c.ink, size: 12.5, weight: 650, anchor: "middle"});
        api.label([b[0], yB + 14], b[3] === "H" ? "heads" : "tails", {color: c.muted, size: 12, anchor: "middle"});
      });
      api.line([314, yB], [392, yB], {color: c.axis, width: 1.2});
    }
  });
})();
