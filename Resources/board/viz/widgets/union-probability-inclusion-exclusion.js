// Inclusion-exclusion for two events, drawn to scale. Left: the sample space S as a unit square, so every area is a
// probability. A is a full-height strip of width P(A); B is a rectangle straddling A's right edge, with P(A and B) of
// its area inside A and the rest outside. Its height h is chosen so both pieces fit: h >= P(A and B)/P(A) and
// h >= (P(B) - P(A and B))/(1 - P(A)), which is possible exactly when max(0, P(A) + P(B) - 1) <= P(A and B) <= min(P(A), P(B)).
// An overlap outside that range is impossible, so it is held at the nearest possible value and the status says so.
// Right: P(A) + P(B) stacked, with the overlap counted twice (purple), against P(A or B), which counts it once.
(function () {
  function calc(v) {
    var a = v.pA, b = v.pB, lo = a + b - 1 > 1e-9 ? a + b - 1 : 0, hi = Math.min(a, b), i = Math.min(hi, Math.max(lo, v.pIntersection));
    return {a: a, b: b, i: i, u: a + b - i, lo: lo, hi: hi, capped: Math.abs(i - v.pIntersection) > 1e-9 ? (v.pIntersection > hi ? "hi" : "lo") : ""};
  }
  function n2(x) { return Viz.fmt(x, 2); }

  Viz.register("union-probability-inclusion-exclusion", {
    title: "P(A or B): inclusion-exclusion",
    subject: "stats",
    shows: "Set P(A), P(B) and their overlap: adding P(A) and P(B) counts the overlap twice, so P(A ∪ B) subtracts it once",
    params: {
      pA: {kind: "number", default: 0.55, min: 0, max: 1, step: 0.01, label: "P(A)"},
      pB: {kind: "number", default: 0.45, min: 0, max: 1, step: 0.01, label: "P(B)"},
      pIntersection: {kind: "number", default: 0.2, min: 0, max: 1, step: 0.01, label: "P(A{\\cap}B)"}
    },
    formula: function (v) {
      var r = calc(v);
      return "\\begin{array}{l}P(A{\\cup}B)=P(A)+P(B)-P(A{\\cap}B)\\\\[4pt]\\phantom{P(A{\\cup}B)}=" + Viz.n(r.a) + "+" + Viz.n(r.b) + "-" + Viz.n(r.i) + "=" + Viz.n(r.u) + "\\end{array}";
    },
    status: function (v) {
      var r = calc(v);
      if (r.capped === "hi") return "An overlap of " + n2(v.pIntersection) + " is impossible: A ∩ B is part of both events, so it is at most <b>" + n2(r.hi) + "</b>, the value used here.";
      if (r.capped === "lo") return "An overlap of " + n2(v.pIntersection) + " is impossible: P(A) + P(B) = " + n2(r.a + r.b) + " exceeds 1, so they must share at least <b>" + n2(r.lo) + "</b>, the value used here.";
      if (r.a === 0 && r.b === 0) return "Both events are impossible, so <b>P(A ∪ B) = 0</b>.";
      if (r.i < 1e-9) return "A and B are mutually exclusive: nothing is counted twice, so <b>P(A ∪ B) = " + n2(r.u) + "</b> is just P(A) + P(B).";
      if (r.i === r.hi) return (r.a === r.b ? "A and B are the same event" : (r.b < r.a ? "B" : "A") + " lies entirely inside " + (r.b < r.a ? "A" : "B")) + ", so <b>P(A ∪ B) = " + n2(r.u) + "</b>, the larger of the two.";
      var ind = Math.abs(r.i - r.a * r.b) < 0.005 ? " (A and B are independent: the overlap equals P(A)·P(B))" : "";
      return "P(A) + P(B) = " + n2(r.a + r.b) + " counts the overlap " + n2(r.i) + " twice; subtract it once: <b>P(A ∪ B) = " + n2(r.u) + "</b>" + ind + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {pA: 0, pB: 0, pIntersection: 0}},
      {name: "Maximum supported values", values: {pA: 1, pB: 1, pIntersection: 1}},
      {name: "mutually exclusive", values: {pA: 0.3, pB: 0.35, pIntersection: 0}},
      {name: "B inside A", values: {pA: 0.6, pB: 0.25, pIntersection: 0.25}},
      {name: "independent", values: {pA: 0.5, pB: 0.4, pIntersection: 0.2}},
      {name: "impossible overlap, capped", values: {pA: 0.3, pB: 0.4, pIntersection: 0.5}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, r = calc(v), S = 206, sx = 14, sy = 44;
      var P = function (x, y) { return [sx + x * S, sy + (1 - y) * S]; };
      // the sample space
      api.rect(sx, sy, S, S, {fill: c.muted, fillOpacity: 0.06, stroke: c.muted, width: 1.2, rx: 2});
      api.label([sx, 26], "S: every outcome, total area 1", {color: c.muted, size: 12.5});
      // A: a full-height strip
      if (r.a > 0) api.rect(sx, sy, r.a * S, S, {fill: c.c1, fillOpacity: 0.3, stroke: c.c1, width: 1.6, rx: 0});
      // B: straddles A's right edge, P(A and B) inside A, the rest outside
      var h = 0, w1 = 0, w2 = 0;
      if (r.b > 1e-9) {
        h = Math.min(1, Math.max(r.a > 0 ? r.i / r.a : 0, r.a < 1 ? (r.b - r.i) / (1 - r.a) : 0, Math.sqrt(r.b)));
        w1 = r.i / h; w2 = (r.b - r.i) / h;
        var y0 = (1 + h) / 2, B0 = P(r.a - w1, y0);
        api.rect(B0[0], B0[1], (w1 + w2) * S, h * S, {fill: c.c3, fillOpacity: 0.3, stroke: c.c3, width: 1.6, rx: 0});
        if (w1 > 0) api.rect(B0[0], B0[1], w1 * S, h * S, {fill: c.c6, fillOpacity: 0.55, rx: 0});
        var mid = P(r.a - w1 / 2, 0.5);
        if (w1 * S > 26 && h * S > 18) api.label(mid, n2(r.i), {color: c.ink, size: 12.5, weight: 700, anchor: "middle"});
        var bxc = w2 * S > 40 ? r.a + w2 / 2 : r.a - w1 + (w1 + w2) / 2;   // under B's own part when it is wide enough, clear of A's edge
        api.label([sx + bxc * S, sy + (1 + h) / 2 * S + 13], "B " + n2(r.b), {color: c.c3, size: 13, weight: 700, anchor: "middle"});
      }
      // A's name inside its strip when the strip is wide enough, else under the square's left edge
      if (r.a > 0) api.label(r.a * S >= 50 ? [sx + 6, sy + 14] : [sx, sy + S + 13], "A " + n2(r.a), {color: c.c1, size: 13, weight: 700});
      // "neither" goes in the top strip above B, else the strip right of B, else under the square's right edge
      if (1 - r.u > 0.005) {
        var topH = (1 - h) / 2 * S, room = (1 - r.a) * S, rightW = (1 - r.a - w2) * S, nt = "neither " + n2(1 - r.u);
        var at = topH >= 18 && room >= 76 ? [sx + S - 6, sy + 12] : rightW >= 76 ? [sx + S - 6, sy + S / 2] : [sx + S, sy + S + 13];
        api.label(at, nt, {color: c.muted, size: 12, anchor: "end"});
      }
      // the bars: P(A) + P(B) counts the overlap twice; the union counts it once
      var base = 244, k = 92, b1 = 250, b2 = 334, bw = 42;
      var seg = function (x, y, val, col, op) { if (val > 1e-9) api.rect(x, y - val * k, bw, val * k, {fill: col, fillOpacity: op, rx: 0}); return y - val * k; };
      var y = seg(b1, base, r.a - r.i, c.c1, 0.55); y = seg(b1, y, r.i, c.c6, 0.8); y = seg(b1, y, r.i, c.c6, 0.8); var t1 = seg(b1, y, r.b - r.i, c.c3, 0.55);
      if (r.i > 1e-9) api.line([b1, base - r.a * k], [b1 + bw, base - r.a * k], {color: c.card, width: 1.5});
      y = seg(b2, base, r.a - r.i, c.c1, 0.55); y = seg(b2, y, r.i, c.c6, 0.8); var t2 = seg(b2, y, r.b - r.i, c.c3, 0.55);
      api.line([b1 - 8, base], [b2 + bw + 8, base], {color: c.axis, width: 1.2});
      api.line([b1 - 6, base - k], [b2 + bw + 8, base - k], {color: c.muted, width: 1, dash: "3 4"});
      api.label([b1 - 12, base - k], "1", {color: c.muted, size: 12, anchor: "end"});
      api.label([b1 + bw / 2, t1 - 10], n2(r.a + r.b), {color: c.ink, size: 13, weight: 700, anchor: "middle"});
      api.label([b2 + bw / 2, t2 - 10], n2(r.u), {color: c.ink, size: 13, weight: 700, anchor: "middle"});
      var my = base - (r.a + 0.5 * r.i) * k; if (my < t1 + 6) my = t1 + 8;   // keep clear of the total above the bar
      if (r.i > 1e-9) api.label([(b1 + bw + b2) / 2, my], "−" + n2(r.i), {color: c.c6, size: 12.5, weight: 700, anchor: "middle"});
      api.label([b1 + bw / 2, base + 14], "P(A)+P(B)", {color: c.muted, size: 12, anchor: "middle"});
      api.label([b2 + bw / 2, base + 14], "P(A ∪ B)", {color: c.muted, size: 12, anchor: "middle"});
      if (r.i > 1e-9) api.label([b1 + bw / 2, base + 30], "∩ counted twice", {color: c.c6, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
