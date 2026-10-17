// A 2x2 matrix acting on the plane: the grid bends, the unit square becomes a parallelogram,
// e1 and e2 land on the matrix's columns, and the determinant is the area factor (negative = flipped).
Viz.register("matrix-transformation-2d", {
  title: "A matrix as a map of the plane",
  subject: "linear-algebra",
  shows: "Change the entries of A: the columns are where e1 and e2 land, the grid moves with them, and det A scales areas",
  params: {
    a: {kind: "number", default: 2, min: -3, max: 3, step: 0.25, label: "a"},
    b: {kind: "number", default: 1, min: -3, max: 3, step: 0.25, label: "b"},
    c: {kind: "number", default: 0.5, min: -3, max: 3, step: 0.25, label: "c"},
    d: {kind: "number", default: 1.5, min: -3, max: 3, step: 0.25, label: "d"}
  },
  formula: function (v) {
    return "A=\\begin{pmatrix}" + Viz.n(v.a) + "&" + Viz.n(v.b) + "\\\\" + Viz.n(v.c) + "&" + Viz.n(v.d) + "\\end{pmatrix},\\ \\det A = " +
      Viz.p(v.a) + "\\cdot" + Viz.p(v.d) + "-" + Viz.p(v.b) + "\\cdot" + Viz.p(v.c) + " = " + Viz.n(v.a * v.d - v.b * v.c);
  },
  status: function (v) {
    var det = v.a * v.d - v.b * v.c;
    if (Math.abs(det) < 1e-9) return "<b>Singular</b>: the plane is crushed onto a line (or a point), so A has no inverse.";
    return "Areas scale by <b>" + Viz.fmt(Math.abs(det)) + "</b>" + (det < 0 ? ", and the orientation <b>flips</b> (e1 and e2 swap sides)." : ", orientation kept.");
  },
  examples: [
    {name: "rotation by 90 degrees", values: {a: 0, b: -1, c: 1, d: 0}},
    {name: "shear", values: {a: 1, b: 1, c: 0, d: 1}},
    {name: "singular", values: {a: 1, b: 2, c: 0.5, d: 1}},
    {name: "reflection", values: {a: -1, b: 0, c: 0, d: 1}}
  ],
  size: [380, 300],
  draw: function (api, v) {
    var T = function (q) { return [v.a * q[0] + v.b * q[1], v.c * q[0] + v.d * q[1]]; };
    // zoom out so the image of the unit square always fits
    var ext = [[1, 0], [0, 1], [1, 1]].reduce(function (m, q) { var t = T(q); return Math.max(m, Math.abs(t[0]) / 1.25, Math.abs(t[1])); }, 1);
    var e = Math.max(4, Math.ceil(ext) + 1);
    var c = api.color, pl = api.plane({x: [-e * 1.25, e * 1.25], y: [-e, e], grid: true, ticks: false, labels: false, step: e > 6 ? 2 : 1});
    var clip = function (q) { return q; };
    // the image of the integer grid, faint, clipped to the plane
    for (var k = -4; k <= 4; k++) {
      var h = pl.through(T([0, k]), T([1, 0])), w = pl.through(T([k, 0]), T([0, 1]));
      if (h && Math.hypot(v.a, v.c) > 1e-9) api.line(pl.px(h[0]), pl.px(h[1]), {color: c.c2, width: 1, opacity: 0.35});
      if (w && Math.hypot(v.b, v.d) > 1e-9) api.line(pl.px(w[0]), pl.px(w[1]), {color: c.c2, width: 1, opacity: 0.35});
    }
    // unit square, before (dashed) and after (filled)
    var sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
    api.polygon(sq.map(pl.px), {fill: "none", stroke: c.muted, dash: "4 4", width: 1.2});
    api.polygon(sq.map(function (q) { return pl.px(clip(T(q))); }), {fill: c.c2, fillOpacity: 0.22, stroke: c.c2, width: 1.5});
    var O = pl.px([0, 0]);
    api.arrow(O, pl.px([1, 0]), {color: c.muted, width: 2, halo: false, label: "e_1", labelSize: 12});
    api.arrow(O, pl.px([0, 1]), {color: c.muted, width: 2, halo: false, label: "e_2", labelSize: 12});
    api.arrow(O, pl.px(clip(T([1, 0]))), {color: c.c1, label: "Ae_1"});
    api.arrow(O, pl.px(clip(T([0, 1]))), {color: c.c3, label: "Ae_2"});
    api.point(O, {r: 3.5});
    api.label([12, api.h - 14], "dashed: before   blue: after", {color: c.muted, size: 12});
  }
});
