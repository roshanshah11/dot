// The row-column rule for AB, laid out with B above the product and A to its left, so row i of A and column j
// of B meet exactly at the entry c_ij they produce. Step through the four entries of a 2x2 product.
(function () {
  var A0 = [[2, 1, -1, 3], [0, 3, 2, -1]], B0 = [[1, 4], [-2, 1], [3, 0], [1, -2]];
  function product(n) {
    return [0, 1].map(function (i) { return [0, 1].map(function (j) { var s = 0; for (var k = 0; k < n; k++) s += A0[i][k] * B0[k][j]; return s; }); });
  }
  var ij = function (step) { var s = (step || 1) - 1; return [Math.floor(s / 2), s % 2]; };
  Viz.register("matrix-multiplication-row-column-rule", {
    title: "Matrix multiplication: the row-column rule",
    subject: "linear-algebra",
    shows: "Step through AB: each entry c_ij is row i of A dotted with column j of B, so the inner sizes must match",
    params: {
      n: {kind: "integer", default: 3, min: 2, max: 4, label: "n"}
    },
    steps: ["c₁₁: row 1 · col 1", "c₁₂: row 1 · col 2", "c₂₁: row 2 · col 1", "c₂₂: row 2 · col 2"],
    stepMs: 1700,
    formula: function (v) {
      var p = ij(v.step), i = p[0], j = p[1], terms = [];
      for (var k = 0; k < v.n; k++) terms.push(Viz.p(A0[i][k]) + "\\cdot" + Viz.p(B0[k][j]));
      return "c_{" + (i + 1) + (j + 1) + "}=\\sum_{k=1}^{" + v.n + "}a_{" + (i + 1) + "k}b_{k" + (j + 1) + "}=" + terms.join("+") + "=" + product(v.n)[i][j];
    },
    status: function (v) {
      var p = ij(v.step), i = p[0], j = p[1];
      return "A is 2×" + v.n + " and B is " + v.n + "×2, so AB is 2×2; entry c" + "₁₂"[i] + "₁₂"[j] + " = row " + (i + 1) + " of A · column " + (j + 1) + " of B = <b>" + Viz.fmt(product(v.n)[i][j]) + "</b>.";
    },
    examples: [
      {name: "first entry, n = 2", values: {n: 2, step: 1}},
      {name: "last entry, n = 4", values: {n: 4, step: 4}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, n = v.n, p = ij(v.step), I = p[0], J = p[1], C = product(n), s = (v.step || 1) - 1;
      var cw = 38, ch = 30, gap = 34;
      var wTot = n * cw + gap + 2 * cw, x0 = Math.round((api.w - wTot) / 2) + 6;
      var ax = x0, cx = x0 + n * cw + gap, by = 24 + (4 - n) * ch / 2, cy = by + n * ch + 26, ay = cy;
      var cell = function (x, y, r, k) { return [x + k * cw + cw / 2, y + r * ch + ch / 2]; };
      var bracket = function (x, y, w, h) {
        api.path("M " + (x + 6) + " " + (y - 2) + " L " + (x - 2) + " " + (y - 2) + " L " + (x - 2) + " " + (y + h + 2) + " L " + (x + 6) + " " + (y + h + 2), {stroke: c.muted, width: 1.5});
        api.path("M " + (x + w - 6) + " " + (y - 2) + " L " + (x + w + 2) + " " + (y - 2) + " L " + (x + w + 2) + " " + (y + h + 2) + " L " + (x + w - 6) + " " + (y + h + 2), {stroke: c.muted, width: 1.5});
      };
      // faint bands: the row runs right into c_IJ, the column runs down into it
      api.rect(ax, ay + I * ch + 1, cx + 2 * cw - ax, ch - 2, {fill: c.c1, fillOpacity: 0.07, rx: 8});
      api.rect(cx + J * cw + 1, by, cw - 2, cy + 2 * ch - by, {fill: c.c3, fillOpacity: 0.07, rx: 8});
      api.rect(ax + 2, ay + I * ch + 2, n * cw - 4, ch - 4, {fill: c.c1, fillOpacity: 0.16, stroke: c.c1, width: 1.2, rx: 7});
      api.rect(cx + J * cw + 2, by + 2, cw - 4, n * ch - 4, {fill: c.c3, fillOpacity: 0.16, stroke: c.c3, width: 1.2, rx: 7});
      api.rect(cx + J * cw + 2, cy + I * ch + 2, cw - 4, ch - 4, {fill: c.c4, fillOpacity: 0.2, stroke: c.c4, width: 1.5, rx: 7});
      bracket(ax, ay, n * cw, 2 * ch); bracket(cx, by, 2 * cw, n * ch); bracket(cx, cy, 2 * cw, 2 * ch);
      for (var r = 0; r < 2; r++) for (var k = 0; k < n; k++)
        api.label(cell(ax, ay, r, k), api.fmt(A0[r][k]), {color: r === I ? c.c1 : c.muted, size: 14, weight: r === I ? 700 : 500, anchor: "middle"});
      for (var k2 = 0; k2 < n; k2++) for (var q = 0; q < 2; q++)
        api.label(cell(cx, by, k2, q), api.fmt(B0[k2][q]), {color: q === J ? c.c3 : c.muted, size: 14, weight: q === J ? 700 : 500, anchor: "middle"});
      // the product so far: entries are filled in reading order, the current one in green
      for (var e = 0; e < 4; e++) {
        var ri = Math.floor(e / 2), cj = e % 2;
        api.label(cell(cx, cy, ri, cj), e <= s ? api.fmt(C[ri][cj]) : "·", {color: e === s ? c.c4 : e < s ? c.ink : c.faint, size: e === s ? 15 : 14, weight: e === s ? 750 : 500, anchor: "middle"});
      }
      api.label([ax + n * cw / 2, ay - 12], "A  (2×" + n + ")", {color: c.c1, size: 12.5, weight: 600, anchor: "middle"});
      api.label([cx + 2 * cw + 10, by + n * ch / 2], "B", {color: c.c3, size: 12.5, weight: 600});
      api.label([cx + 2 * cw + 10, by + n * ch / 2 + 16], "(" + n + "×2)", {color: c.c3, size: 12, weight: 500});
      api.label([cx + 2 * cw + 10, cy + ch], "AB", {color: c.c4, size: 12.5, weight: 600});
      // the dot product written out, one product per term
      var terms = [];
      for (var t = 0; t < n; t++) terms.push((A0[I][t] < 0 ? "(" + api.fmt(A0[I][t]) + ")" : api.fmt(A0[I][t])) + "·" + (B0[t][J] < 0 ? "(" + api.fmt(B0[t][J]) + ")" : api.fmt(B0[t][J])));
      api.label([api.w / 2, cy + 2 * ch + 30], "c_" + (I + 1) + "_" + (J + 1) + " = " + terms.join(" + ") + " = " + api.fmt(C[I][J]), {color: c.c4, size: 13.5, weight: 650, anchor: "middle"});
    }
  });
})();
