// Gauss-Jordan on a 2x2 system, one elementary row operation per step (swap, replace, scale, replace).
// Each row is a line in the plane; every operation moves a line but never the point where the lines cross.
(function () {
  var OPS = [
    {text: "start: [A | b]", kind: "the system as given", changed: []},
    {text: "R_1 ↔ R_2", kind: "swap two rows", changed: [0, 1]},
    {text: "R_2 ← R_2 − 2R_1", kind: "replace: add a multiple of a row", changed: [1]},
    {text: "R_2 ← −⅓ R_2", kind: "scale a row by a nonzero number", changed: [1]},
    {text: "R_1 ← R_1 − R_2", kind: "replace: add a multiple of a row", changed: [0]}
  ];
  // rows [p, q | r] after each step, computed by applying the operations to [A | b] with b = A x
  function stages(v) {
    var x = v.solutionX, y = v.solutionY, M = [[2, -1, 2 * x - y], [1, 1, x + y]], out = [M];
    var cp = function (m) { return m.map(function (r) { return r.slice(); }); };
    M = cp(M); M = [M[1], M[0]]; out.push(M);
    M = cp(M); M[1] = M[1].map(function (e, k) { return e - 2 * M[0][k]; }); out.push(M);
    M = cp(M); M[1] = M[1].map(function (e) { return e * (-1 / 3); }); out.push(M);
    M = cp(M); M[0] = M[0].map(function (e, k) { return e - M[1][k]; }); out.push(M);
    return out;
  }
  var clean = function (e) { return Math.abs(e) < 1e-9 ? 0 : Math.round(e * 1e6) / 1e6; };
  function eq(r) { // the row as an equation, e.g. "2x − y = 0"
    var s = "", t = [[r[0], "x"], [r[1], "y"]];
    t.forEach(function (pq) {
      var k = clean(pq[0]); if (!k) return;
      var m = Math.abs(k), coef = Math.abs(m - 1) < 1e-9 ? "" : Viz.fmt(m);
      s += (s ? (k < 0 ? " − " : " + ") : (k < 0 ? "−" : "")) + coef + pq[1];
    });
    return (s || "0") + " = " + Viz.fmt(clean(r[2]));
  }
  Viz.register("elementary-row-operations", {
    title: "Elementary row operations",
    subject: "linear-algebra",
    shows: "Step through swap, replace and scale: each row is a line, each operation moves a line, and the crossing point (the solution) never moves",
    params: {
      solutionX: {kind: "number", default: 1, min: -2, max: 2, step: 0.25, label: "x"},
      solutionY: {kind: "number", default: 2, min: -2, max: 2, step: 0.25, label: "y"}
    },
    steps: ["the system [A | b]", "swap R₁ and R₂", "R₂ − 2R₁ clears x", "scale R₂ by −1/3", "R₁ − R₂ clears y"],
    stepMs: 1800,
    formula: function (v) {
      var s = (v.step || 1) - 1, M = stages(v)[s], f = function (e) { return Viz.n(clean(e)); };
      var mat = "\\left[\\begin{array}{rr|r}" + f(M[0][0]) + "&" + f(M[0][1]) + "&" + f(M[0][2]) + "\\\\" + f(M[1][0]) + "&" + f(M[1][1]) + "&" + f(M[1][2]) + "\\end{array}\\right]";
      return (s === 0 ? "\\left[A\\mid\\mathbf{b}\\right]=" + mat + "\\sim\\cdots\\sim\\left[I\\mid\\mathbf{x}\\right]" :
        s < 4 ? "\\left[A\\mid\\mathbf{b}\\right]\\sim" + mat + "\\sim\\cdots" : "\\left[A\\mid\\mathbf{b}\\right]\\sim" + mat + "=\\left[I\\mid\\mathbf{x}\\right]");
    },
    status: function (v) {
      var s = (v.step || 1) - 1, M = stages(v)[s], pt = "(" + Viz.fmt(v.solutionX) + ", " + Viz.fmt(v.solutionY) + ")";
      return [
        "Row 1 says <b>" + eq(M[0]) + "</b>, row 2 says <b>" + eq(M[1]) + "</b>; the two lines cross at " + pt + ".",
        "Swapping puts a 1 in the top-left pivot; the lines are the same two, so they still cross at " + pt + ".",
        "Subtracting 2 × row 1 clears x from row 2: its line turns flat, <b>" + eq(M[1]) + "</b>, and still passes through " + pt + ".",
        "Scaling row 2 by −1/3 does not move its line at all; the row now reads <b>" + eq(M[1]) + "</b>.",
        "Subtracting row 2 clears y from row 1: its line turns upright, so [I | x] reads off <b>x = " + Viz.fmt(v.solutionX) + "</b>, <b>y = " + Viz.fmt(v.solutionY) + "</b>."
      ][s];
    },
    examples: [
      {name: "minimum supported values", values: {solutionX: -2, solutionY: -2, step: 3}},
      {name: "maximum supported values", values: {solutionX: 2, solutionY: 2, step: 5}},
      {name: "fractional solution", values: {solutionX: 0.5, solutionY: -1.25, step: 2}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, s = (v.step || 1) - 1, all = stages(v), M = all[s], prev = s ? all[s - 1] : null, op = OPS[s];
      var rowCol = [c.c1, c.c3];
      // the augmented matrix, left
      var cx = [44, 90, 140], ry = [118, 158], bx0 = 18, bx1 = 166, f = function (e) { return api.fmt(clean(e)); };
      api.label([bx0, 26], op.text, {color: c.ink, size: 15, weight: 700});
      api.label([bx0, 50], op.kind, {color: c.muted, size: 12});
      [0, 1].forEach(function (i) {
        if (op.changed.indexOf(i) >= 0) api.rect(bx0 + 6, ry[i] - 16, bx1 - bx0 - 12, 32, {fill: rowCol[i], fillOpacity: 0.14, rx: 7});
        for (var k = 0; k < 3; k++) api.label([cx[k], ry[i]], f(M[i][k]), {color: rowCol[i], size: 15, weight: 650, anchor: "middle"});
        api.label([bx1 + 6, ry[i]], "R_" + (i + 1), {color: c.muted, size: 12});
      });
      api.path("M " + (bx0 + 8) + " 92 L " + bx0 + " 92 L " + bx0 + " 184 L " + (bx0 + 8) + " 184", {stroke: c.ink, width: 1.6});
      api.path("M " + (bx1 - 8) + " 92 L " + bx1 + " 92 L " + bx1 + " 184 L " + (bx1 - 8) + " 184", {stroke: c.ink, width: 1.6});
      api.line([115, 96], [115, 180], {color: c.muted, width: 1.2});
      api.label([bx0, 212], "row 1: " + eq(M[0]), {color: c.c1, size: 12.5});
      api.label([bx0, 232], "row 2: " + eq(M[1]), {color: c.c3, size: 12.5});
      if (s === 4) api.label([bx0, 258], "solution (" + api.fmt(v.solutionX) + ", " + api.fmt(v.solutionY) + ")", {color: c.c4, size: 13, weight: 650});
      // the plane, right: each row p x + q y = r is a line
      var pl = api.plane({x: [-3.5, 3.5], y: [-3.5, 3.5], box: [196, 14, 196, 252], ticks: false, step: 1});
      var line = function (r, o) {
        var nn = r[0] * r[0] + r[1] * r[1]; if (nn < 1e-12) return;
        pl.lineThrough([r[2] * r[0] / nn, r[2] * r[1] / nn], [-r[1], r[0]], o);
      };
      [0, 1].forEach(function (i) {
        var moved = prev && op.changed.length === 1 && op.changed[0] === i;
        if (moved) line(prev[i], {color: rowCol[i], width: 1.5, dash: "4 5", opacity: 0.55});
        line(M[i], {color: rowCol[i], width: op.changed.indexOf(i) >= 0 ? 3.5 : 2.2});
      });
      var P = pl.px([v.solutionX, v.solutionY]);
      api.point(P, {color: c.c4, r: 5.5, stroke: c.card});
      api.label([P[0] + 10, P[1] - 12], "(" + api.fmt(v.solutionX) + ", " + api.fmt(v.solutionY) + ")", {color: c.c4, size: 12.5, weight: 650});
      if (prev && op.changed.length === 1) api.label([392, 262], "dashed: the line before this step", {color: c.muted, size: 12, anchor: "end"});
    }
  });
})();
