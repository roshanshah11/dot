// Mediation in a linear path model: X moves the mediator M by a, M moves Y by b (holding X), and X also moves Y
// directly by c′. The total effect of X on Y is c = c′ + a·b (exact for linear regressions fit by least squares).
// Top: the path diagram, arrow width ∝ |coefficient|, dashed when negative; the two amber arrows are the indirect
// route, the blue one the direct route. Bottom: c built tip to tail on a number line: the direct arrow 0 → c′, the
// indirect arrow c′ → c′ + ab, and the total arrow 0 → c, each with its signed value at its tip. Opposite signs show
// inconsistent mediation: the amber arrow turns back against the blue one (when they are equal the routes cancel).
Viz.register("mediation-indirect-effect", {
  title: "Mediation: direct and indirect effects",
  subject: "stats",
  shows: "Set the paths a, b and c′: the indirect effect is a × b, and the total effect of X on Y is c = c′ + ab",
  params: {
    a: {kind: "number", default: 0.6, min: -1, max: 1, step: 0.05, label: "a"},
    b: {kind: "number", default: 0.5, min: -1, max: 1, step: 0.05, label: "b"},
    directEffect: {kind: "number", default: 0.2, min: -1, max: 1, step: 0.05, label: "c'"}
  },
  formula: function (v) {
    var ab = v.a * v.b;
    return "\\begin{array}{l}c=c^{\\prime}+a\\times b\\\\\\quad=" + Viz.n(v.directEffect, 2) + "+" + Viz.p(v.a, 2) + "\\times" + Viz.p(v.b, 2) + "=" + Viz.n(v.directEffect + ab, 4) + "\\end{array}";
  },
  status: function (v) {
    var ab = v.a * v.b, cp = v.directEffect, c = cp + ab, z = function (x) { return Math.abs(x) < 1e-6; }, f = function (x) { return Viz.fmt(x, 4); };
    if (z(ab) && z(cp)) return "No route carries anything: with a × b = 0 and c′ = 0, the total effect is <b>0</b>.";
    if (z(ab)) return "No indirect effect (" + (z(v.a) ? "a = 0: X does not move M" : "b = 0: M does not move Y") + "), so the whole total effect c = <b>" + f(c) + "</b> is direct.";
    if (z(cp)) return "<b>Full mediation</b>: X reaches Y only through M, so c = a × b = <b>" + f(ab) + "</b>.";
    if (ab * cp > 0) return "<b>Partial mediation</b>: the indirect path a × b = " + f(ab) + " carries <b>" + Viz.fmt(100 * ab / c, 0) + "%</b> of the total effect c = " + f(c) + ".";
    if (z(c)) return "The routes <b>cancel</b>: indirect " + f(ab) + " and direct " + f(cp) + " add to a total effect of 0, though X does act on Y.";
    return "<b>Inconsistent mediation</b>: the indirect path (" + f(ab) + ") pushes against the direct one (" + f(cp) + "), so the total c = <b>" + f(c) + "</b> is smaller than the larger route.";
  },
  examples: [
    {name: "Minimum supported values", values: {a: -1, b: -1, directEffect: -1}},
    {name: "Maximum supported values", values: {a: 1, b: 1, directEffect: 1}},
    {name: "full mediation", values: {a: 0.7, b: 0.6, directEffect: 0}},
    {name: "no indirect path", values: {a: 0, b: 0.5, directEffect: 0.4}},
    {name: "inconsistent mediation", values: {a: 0.8, b: -0.5, directEffect: 0.3}}
  ],
  size: [400, 294],
  draw: function (api, v) {
    var c = api.color, ab = v.a * v.b, cp = v.directEffect, tot = cp + ab;
    var X = [62, 130], M = [200, 48], Y = [338, 130], bw = 64, bh = 34;
    var box = function (p, name, sub, above) {
      api.rect(p[0] - bw / 2, p[1] - bh / 2, bw, bh, {fill: c.ink, fillOpacity: 0.07, stroke: c.faint, width: 1.2, rx: 8});
      api.label(p, name, {color: c.ink, size: 16, weight: 700, anchor: "middle"});
      api.label([p[0], p[1] + (above ? -1 : 1) * (bh / 2 + 12)], sub, {color: c.muted, size: 12, anchor: "middle"});
    };
    // an arrow between box edges; width by size, dashed when negative, faint dotted when zero
    var path = function (p, q, val, col, name, off) {
      var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      var tEdge = function (u) { return Math.min(Math.abs(bw / 2 / (u[0] || 1e-9)), Math.abs(bh / 2 / (u[1] || 1e-9))) + 6; };
      var s0 = tEdge([ux, uy]), a0 = [p[0] + ux * s0, p[1] + uy * s0], a1 = [q[0] - ux * s0, q[1] - uy * s0];
      if (Math.abs(val) < 1e-6) api.line(a0, a1, {color: c.faint, width: 1.5, dash: "2 5"});
      else api.arrow(a0, a1, {color: col, width: 1.5 + 4 * Math.abs(val), dash: val < 0 ? "8 5" : null, halo: false, head: 10 + 3 * Math.abs(val)});
      var mid = [(a0[0] + a1[0]) / 2 + off[0], (a0[1] + a1[1]) / 2 + off[1]];
      api.label(mid, name + " = " + api.fmt(val, 2), {color: Math.abs(val) < 1e-6 ? c.muted : col, size: 13, weight: 650, anchor: "middle"});
    };
    path(X, M, v.a, c.c3, "a", [-24, -12]);
    path(M, Y, v.b, c.c3, "b", [24, -12]);
    path(X, Y, cp, c.c2, "c′", [0, 18]);
    box(X, "X", "cause"); box(M, "M", "mediator", true); box(Y, "Y", "outcome");
    api.label([M[0], 100], "indirect a × b = " + api.fmt(ab, 4), {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
    // total effect built tip to tail from its two parts; zoom to ±1 unless c′ or the total needs ±2
    var R = Math.max(Math.abs(cp), Math.abs(tot)) > 1 + 1e-9 ? 2 : 1;
    var x0 = 60, x1 = 340, ya = 270, T = function (q) { return x0 + (x1 - x0) * (q + R) / (2 * R); };
    var sgn = function (x, k) { return Math.abs(x) < 1e-9 ? "0" : (x > 0 ? "+" : "−") + api.fmt(Math.abs(x), k); };
    api.line([x0, ya], [x1, ya], {color: c.axis, width: 1.2});
    (R === 2 ? [-2, -1, 0, 1, 2] : [-1, -0.5, 0, 0.5, 1]).forEach(function (t) {
      api.line([T(t), ya], [T(t), ya + 4], {color: c.axis, width: 1});
      api.label([T(t), ya + 15], api.fmt(t), {color: c.muted, size: 12, anchor: "middle"});
    });
    // an arrow from p to q on row y with its label just past the head; if that runs off the side, past the tail
    var part = function (p, q, y, col, text, w) {
      var a = T(p), b = T(q), dir = b >= a ? 1 : -1, est = text.length * 12 * 0.56;
      if (Math.abs(b - a) < 2) api.circle([b, y], 4, {fill: col});
      else api.arrow([a, y], [b, y], {color: col, width: w, head: 10, halo: false});
      var fits = dir > 0 ? b + 8 + est <= 396 : b - 8 - est >= 4;
      var at = fits ? b + dir * 8 : a - dir * 8, right = fits ? dir > 0 : dir < 0;
      api.label([at, y], text, {color: col, size: 12.5, weight: 650, anchor: right ? "start" : "end"});
    };
    var y1 = 198, y2 = 222, y3 = 246;
    api.line([T(cp), y1 + 6], [T(cp), y2 - 6], {color: c.faint, width: 1, dash: "2 3"});
    api.line([T(tot), y2 + 6], [T(tot), y3 - 6], {color: c.faint, width: 1, dash: "2 3"});
    api.line([T(0), y3 + 6], [T(0), ya], {color: c.faint, width: 1, dash: "3 4"});
    if (Math.abs(T(tot) - T(0)) > 2) api.line([T(tot), y3 + 6], [T(tot), ya], {color: c.c1, width: 1.2, dash: "3 3", opacity: 0.7});
    part(0, cp, y1, c.c2, "c′ = " + sgn(cp, 2), 3);
    part(cp, tot, y2, c.c3, "ab = " + sgn(ab, 4), 3);
    part(0, tot, y3, c.c1, "total c = " + api.fmt(tot, 4), 4);
  }
});
