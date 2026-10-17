// A 2x2 matrix and its inverse: A carries the grid and the vector x into the output plane; A^-1 carries Ax back.
// When det A = 0 the output grid collapses onto a line, many inputs share one output, and nothing can undo A.
(function () {
  function info(v) {
    var a = v.matrixA, b = v.matrixB, c = v.matrixC, d = v.matrixD, det = a * d - b * c;
    var Ax = [a * v.vectorX + b * v.vectorY, c * v.vectorX + d * v.vectorY];
    return {a: a, b: b, c: c, d: d, det: det, Ax: Ax, inv: Math.abs(det) > 1e-9 ? [d / det, -b / det, -c / det, a / det] : null};
  }
  var mat = function (e) { return "\\begin{pmatrix}" + Viz.n(e[0]) + "&" + Viz.n(e[1]) + "\\\\" + Viz.n(e[2]) + "&" + Viz.n(e[3]) + "\\end{pmatrix}"; };
  Viz.register("matrix-inverse-2d", {
    title: "The inverse of a 2×2 matrix",
    subject: "linear-algebra",
    shows: "Change A and x: A moves the grid and x into the output plane, and A⁻¹ = (1/det A)·[d −b; −c a] brings Ax back to x, unless det A = 0",
    params: {
      matrixA: {kind: "number", default: 0, min: -2, max: 2, step: 0.25, label: "a"},
      matrixB: {kind: "number", default: 1, min: -2, max: 2, step: 0.25, label: "b"},
      matrixC: {kind: "number", default: -1, min: -2, max: 2, step: 0.25, label: "c"},
      matrixD: {kind: "number", default: 0, min: -2, max: 2, step: 0.25, label: "d"},
      vectorX: {kind: "number", default: 1, min: -5, max: 5, step: 0.25, label: "x_1"},
      vectorY: {kind: "number", default: 2, min: -5, max: 5, step: 0.25, label: "x_2"}
    },
    formula: function (v) {
      var m = info(v);
      if (!m.inv) return "\\det A=" + Viz.p(m.a) + "\\cdot" + Viz.p(m.d) + "-" + Viz.p(m.b) + "\\cdot" + Viz.p(m.c) + "=0\\ \\Rightarrow\\ A^{-1}\\text{ does not exist}";
      return "A^{-1}=\\frac{1}{" + Viz.n(m.det, 4) + "}" + mat([m.d, -m.b, -m.c, m.a]) + "=" + mat(m.inv);
    },
    status: function (v) {
      var m = info(v), x = "(" + Viz.fmt(v.vectorX) + ", " + Viz.fmt(v.vectorY) + ")", y = "(" + Viz.fmt(m.Ax[0]) + ", " + Viz.fmt(m.Ax[1]) + ")";
      if (!m.inv) return "<b>det A = 0</b>: A crushes the plane onto " + (m.a || m.b || m.c || m.d ? "a line" : "a point") + ", so many inputs share the output " + y + " and no matrix can undo it.";
      if (m.inv.every(function (e, i) { return Math.abs(e - [m.a, m.b, m.c, m.d][i]) < 1e-9; })) return "A is <b>its own inverse</b> (det " + Viz.fmt(m.det) + "): applying it twice sends " + x + " to " + y + " and back.";
      return "det A = <b>" + Viz.fmt(m.det, 4) + "</b> ≠ 0, so A⁻¹ exists: A sends x = " + x + " to " + y + " and A⁻¹ brings it back" + (Math.abs(m.det) < 0.35 ? ", stretching areas by 1/|det| = " + Viz.fmt(1 / Math.abs(m.det)) : "") + ".";
    },
    examples: [
      {name: "minimum supported values", values: {matrixA: -2, matrixB: -2, matrixC: -2, matrixD: -2, vectorX: -5, vectorY: -5}},
      {name: "maximum supported values", values: {matrixA: 2, matrixB: 2, matrixC: 2, matrixD: 2, vectorX: 5, vectorY: 5}},
      {name: "identity is its own inverse", values: {matrixA: 1, matrixB: 0, matrixC: 0, matrixD: 1}},
      {name: "quarter-turn and reverse rotation", values: {matrixA: 0, matrixB: 1, matrixC: -1, matrixD: 0}},
      {name: "undo a horizontal shear", values: {matrixA: 1, matrixB: 1, matrixC: 0, matrixD: 1}},
      {name: "reflection is its own inverse", values: {matrixA: -1, matrixB: 0, matrixC: 0, matrixD: 1}},
      {name: "nearly collapsed but still invertible", values: {matrixA: 1, matrixB: 1, matrixC: 1, matrixD: 1.25}},
      {name: "shear and scaling remain invertible", values: {matrixA: 1.5, matrixB: 0.5, matrixC: 0.5, matrixD: 1}},
      {name: "singular collapse has no inverse", values: {matrixA: 1, matrixB: 1, matrixC: 1, matrixD: 1}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var C = api.color, m = info(v), W = api.w, half = W / 2, T = function (q) { return [m.a * q[0] + m.b * q[1], m.c * q[0] + m.d * q[1]]; };
      // input plane fits x; output plane fits Ax and the image of the unit square
      var eL = Math.max(3, Math.ceil(Math.max(Math.abs(v.vectorX), Math.abs(v.vectorY))) + 1);
      var eR = [m.Ax, T([1, 0]), T([0, 1]), T([1, 1])].reduce(function (s, q) { return Math.max(s, Math.abs(q[0]), Math.abs(q[1])); }, 2);
      eR = Math.max(eL, Math.ceil(eR) + 1); // same scale as the input unless Ax needs more room
      var top = 40, side = 164;
      var L = api.plane({x: [-eL, eL], y: [-eL, eL], box: [14, top, side, side], ticks: false, labels: false, grid: false});
      var R = api.plane({x: [-eR, eR], y: [-eR, eR], box: [W - 14 - side, top, side, side], ticks: false, labels: false, grid: false});
      api.label([14 + side / 2, 16], "input  x", {color: C.muted, size: 12.5, anchor: "middle"});
      api.label([W - 14 - side / 2, 16], "output  Ax", {color: C.muted, size: 12.5, anchor: "middle"});
      api.arrow([half - 12, top + 34], [half + 12, top + 34], {color: C.ink, width: 2, halo: false});
      api.label([half, top + 18], "A", {color: C.ink, size: 14, weight: 700, anchor: "middle"});
      // the input grid and its image (the same lines, carried by A)
      var gs = eL > 4 ? 2 : 1;
      for (var k = -eL; k <= eL; k += gs) {
        L.lineThrough([0, k], [1, 0], {color: C.c2, width: 1, opacity: k ? 0.3 : 0});
        L.lineThrough([k, 0], [0, 1], {color: C.c2, width: 1, opacity: k ? 0.3 : 0});
        var h = R.through(T([0, k]), T([1, 0])), w = R.through(T([k, 0]), T([0, 1]));
        if (k && h && Math.hypot(m.a, m.c) > 1e-9) api.line(R.px(h[0]), R.px(h[1]), {color: C.c2, width: 1, opacity: 0.3});
        if (k && w && Math.hypot(m.b, m.d) > 1e-9) api.line(R.px(w[0]), R.px(w[1]), {color: C.c2, width: 1, opacity: 0.3});
      }
      // unit square and where it lands
      var sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
      api.polygon(sq.map(L.px), {fill: C.c2, fillOpacity: 0.3, stroke: C.c2, width: 1.2});
      api.polygon(sq.map(function (q) { return R.px(T(q)); }), {fill: C.c2, fillOpacity: 0.3, stroke: C.c2, width: 1.2});
      if (!m.inv && (m.a || m.b || m.c || m.d)) {
        // the whole output is one line; every input on the dashed line through x lands on the same Ax
        var dir = Math.hypot(m.a, m.c) > 1e-9 ? [m.a, m.c] : [m.b, m.d], ker = Math.hypot(m.a, m.b) > 1e-9 ? [-m.b, m.a] : [-m.d, m.c];
        R.lineThrough([0, 0], dir, {color: C.c5, width: 2.5, opacity: 0.85});
        L.lineThrough([v.vectorX, v.vectorY], ker, {color: C.c5, width: 2, dash: "5 4", opacity: 0.9});
      }
      var O1 = L.px([0, 0]), O2 = R.px([0, 0]), X = L.px([v.vectorX, v.vectorY]), Y = R.px(m.Ax);
      api.arrow(O1, X, {color: C.c1, label: "x"});
      if (Math.hypot(Y[0] - O2[0], Y[1] - O2[1]) > 3) api.arrow(O2, Y, {color: C.c3, label: "Ax"});
      else api.point(O2, {color: C.c3, r: 5, label: "Ax = 0", labelColor: C.c3, size: 12.5});
      api.point(O1, {r: 3}); api.point(O2, {r: 3});
      // the way back
      var by = top + side + 28;
      if (m.inv) {
        api.arrow([W - 40, by], [40, by], {color: C.c6, width: 2.5, halo: false});
        api.label([half, by + 18], "A⁻¹ carries Ax back to x", {color: C.c6, size: 12.5, weight: 650, anchor: "middle", raw: true});
      } else {
        api.line([40, by], [W - 40, by], {color: C.c5, width: 2, dash: "5 6", opacity: 0.8});
        api.label([half, by + 18], (m.a || m.b || m.c || m.d ? "no way back: the whole dashed line lands on Ax" : "no way back: A sends every x to 0"), {color: C.c5, size: 12, weight: 650, anchor: "middle"});
      }
      if (eR > eL) api.label([W - 14, top + side + 6], "zoomed out " + api.fmt(eR / eL, 1) + "×", {color: C.muted, size: 12, anchor: "end"});
      api.handle(X, {color: C.c1, plane: L, snap: 0.25, onDrag: function (q) { api.set({vectorX: q[0], vectorY: q[1]}); }});
    }
  });
})();
