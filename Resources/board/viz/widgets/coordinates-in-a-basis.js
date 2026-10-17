// One vector, two grids: the standard square grid and the slanted grid that the basis b1, b2 lays down.
// The coordinates of v in B are how many b1 steps and b2 steps reach it; drag the basis and v stays put
// while its B-coordinates change. A parallel pair is not a basis, and the widget says so.
(function () {
  Viz.register("coordinates-in-a-basis", {
    title: "Coordinates in a basis",
    subject: "linear-algebra",
    shows: "The same vector written in two bases; drag the basis and its coordinates change",
    params: {
      vx: {kind: "number", default: 3, min: -5, max: 5, step: 0.5, label: "v_x"},
      vy: {kind: "number", default: 3, min: -5, max: 5, step: 0.5, label: "v_y"},
      b1x: {kind: "number", default: 2, min: -3, max: 3, step: 0.5, label: "b_{1x}"},
      b1y: {kind: "number", default: 1, min: -3, max: 3, step: 0.5, label: "b_{1y}"},
      b2x: {kind: "number", default: -1, min: -3, max: 3, step: 0.5, label: "b_{2x}"},
      b2y: {kind: "number", default: 1, min: -3, max: 3, step: 0.5, label: "b_{2y}"}
    },
    formula: function (v) {
      var s = solve(v), col = function (x, y) { return "\\begin{pmatrix}" + Viz.n(x) + "\\\\" + Viz.n(y) + "\\end{pmatrix}"; };
      if (!s) return "\\det\\begin{pmatrix}" + Viz.n(v.b1x) + "&" + Viz.n(v.b2x) + "\\\\" + Viz.n(v.b1y) + "&" + Viz.n(v.b2y) + "\\end{pmatrix}=0:\\ \\text{not a basis}";
      var c2 = s[1] < 0 ? "-" + Viz.n(-s[1]) : "+" + Viz.n(s[1]);
      return "\\mathbf v=" + col(v.vx, v.vy) + "=" + Viz.n(s[0]) + col(v.b1x, v.b1y) + c2 + col(v.b2x, v.b2y);
    },
    status: function (v) {
      var s = solve(v), std = "(" + Viz.fmt(v.vx) + ", " + Viz.fmt(v.vy) + ")";
      if (!s) {
        var d = (v.b1x || v.b1y) ? [v.b1x, v.b1y] : [v.b2x, v.b2y], onLine = Math.abs(d[0] * v.vy - d[1] * v.vx) < 1e-9 && (d[0] || d[1] || (!v.vx && !v.vy));
        return "b₁ and b₂ are parallel, so B is <b>not a basis</b>: " + (onLine ? "v lies on their line and has endlessly many weight pairs." : "v is off their line, so no weights reach it.");
      }
      var std2 = v.b1x === 1 && !v.b1y && !v.b2x && v.b2y === 1;
      if (std2) return "B is the standard basis, so both lists agree: v = <b>" + std + "</b>.";
      return "In B, v is <b>(" + Viz.fmt(s[0]) + ", " + Viz.fmt(s[1]) + ")</b>, meaning v = " + Viz.fmt(s[0]) + "b₁ " + (s[1] < 0 ? "− " + Viz.fmt(-s[1]) : "+ " + Viz.fmt(s[1])) + "b₂; in the standard basis the same arrow is " + std + ".";
    },
    examples: [
      {name: "standard basis", values: {b1x: 1, b1y: 0, b2x: 0, b2y: 1}},
      {name: "a negative coordinate", values: {vx: -3, vy: 0}},
      {name: "parallel pair: not a basis", values: {b2x: -2, b2y: -1}},
      {name: "rotated basis", values: {vx: 2, vy: 4, b1x: 0, b1y: 1, b2x: -1, b2y: 0}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, X = [-6.6, 6.6], Y = [-5.5, 5.5];
      var pl = api.plane({x: X, y: Y, tickEvery: 2, ticks: false, labels: false});
      var b1 = [v.b1x, v.b1y], b2 = [v.b2x, v.b2y], s = solve(v), O = pl.px([0, 0]);
      if (s) {
        // the B grid: lines parallel to b1 (teal tint) and to b2 (amber tint) through every integer combination
        for (var k = -24; k <= 24; k++) {
          var p = pl.through([k * b2[0], k * b2[1]], b1), q = pl.through([k * b1[0], k * b1[1]], b2);
          if (p) api.line(pl.px(p[0]), pl.px(p[1]), {color: c.c1, width: k ? 1 : 1.6, opacity: k ? 0.28 : 0.5});
          if (q) api.line(pl.px(q[0]), pl.px(q[1]), {color: c.c3, width: k ? 1 : 1.6, opacity: k ? 0.28 : 0.5});
        }
        // the walk: c1 steps along b1, then c2 steps along b2, ends at v
        var mid = [s[0] * b1[0], s[0] * b1[1]];
        leg(api, pl, [0, 0], mid, c.c1);
        leg(api, pl, mid, [v.vx, v.vy], c.c3);
      } else {
        var d = (b1[0] || b1[1]) ? b1 : b2;
        if (d[0] || d[1]) pl.lineThrough([0, 0], d, {color: c.c5, width: 2.5, dash: "7 5", opacity: 0.85});
      }
      api.arrow(O, pl.px(b1), {color: c.c1, label: "b_1"});
      api.arrow(O, pl.px(b2), {color: c.c3, label: "b_2"});
      api.arrow(O, pl.px([v.vx, v.vy]), {color: c.c2, label: "v", width: 3.5});
      api.point(O, {r: 3.5});
      // the two coordinate lists for the same arrow
      api.rect(8, 8, 158, s ? 66 : 46, {fill: c.card, fillOpacity: 0.88, rx: 8});
      api.label([18, 22], "standard: (" + api.fmt(v.vx) + ", " + api.fmt(v.vy) + ")", {color: c.muted, size: 12.5});
      api.label([18, 42], s ? "in B: (" + api.fmt(s[0]) + ", " + api.fmt(s[1]) + ")" : "in B: none", {color: s ? c.c2 : c.c5, size: 13, weight: 650});
      if (s) { // v = c1 b1 + c2 b2, each term in its basis vector's color
        var t1 = api.fmt(s[0]) + "b_1", t2 = (s[1] < 0 ? "− " + api.fmt(-s[1]) : "+ " + api.fmt(s[1])) + "b_2", w = function (t) { return api.sub(t).length * 12.5 * 0.6; };
        api.label([18, 62], "v =", {color: c.c2, size: 12.5});
        api.label([44, 62], t1, {color: c.c1, size: 12.5, weight: 650});
        api.label([48 + w(t1), 62], t2, {color: c.c3, size: 12.5, weight: 650});
      }
      var drag = function (keys) { return function (q) { var o = {}; o[keys[0]] = q[0]; o[keys[1]] = q[1]; api.set(o); }; };
      api.handle(pl.px(b1), {color: c.c1, plane: pl, snap: 0.5, r: 6, onDrag: drag(["b1x", "b1y"])});
      api.handle(pl.px(b2), {color: c.c3, plane: pl, snap: 0.5, r: 6, onDrag: drag(["b2x", "b2y"])});
      api.handle(pl.px([v.vx, v.vy]), {color: c.c2, plane: pl, snap: 0.5, r: 6, onDrag: drag(["vx", "vy"])});
    }
  });

  // [v]_B by Cramer's rule; null when b1, b2 are parallel (det 0)
  function solve(v) {
    var det = v.b1x * v.b2y - v.b2x * v.b1y;
    if (Math.abs(det) < 1e-9) return null;
    return [(v.vx * v.b2y - v.b2x * v.vy) / det, (v.b1x * v.vy - v.vx * v.b1y) / det];
  }
  // a dashed leg of the walk, clipped to the plane
  function leg(api, pl, a, b, color) {
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9) return;
    var t0 = 0, t1 = 1, d = [b[0] - a[0], b[1] - a[1]];
    var lim = [[-d[0], a[0] - pl.xr[0]], [d[0], pl.xr[1] - a[0]], [-d[1], a[1] - pl.yr[0]], [d[1], pl.yr[1] - a[1]]];
    for (var i = 0; i < 4; i++) {
      var P = lim[i][0], Q = lim[i][1];
      if (Math.abs(P) < 1e-12) { if (Q < 0) return; } else if (P < 0) t0 = Math.max(t0, Q / P); else t1 = Math.min(t1, Q / P);
    }
    if (t0 > t1) return;
    api.line(pl.px([a[0] + t0 * d[0], a[1] + t0 * d[1]]), pl.px([a[0] + t1 * d[0], a[1] + t1 * d[1]]), {color: color, width: 2.5, dash: "6 4"});
  }
})();
