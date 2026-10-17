// A matrix already in reduced row echelon form, with the shape and rank you pick. Every column is either a
// pivot column (it counts toward the rank) or a free column (its variable is free, and it hands the null
// space one basis vector). The bar underneath is the n columns split into rank + nullity.
(function () {
  var VALS = [2, -1, 3, 1, -2, 4, -3];
  function build(v) {
    var r = Math.min(v.r, v.m, v.n), piv = [], A = [], i, j;
    for (i = 0; i < r; i++) piv.push(Math.floor(i * v.n / r));
    for (i = 0; i < v.m; i++) {
      A.push([]);
      for (j = 0; j < v.n; j++) {
        var x = 0;
        if (i < r) x = piv[i] === j ? 1 : piv.indexOf(j) >= 0 ? 0 : j > piv[i] ? VALS[(i * 3 + j * 2) % VALS.length] : 0;
        A[i].push(x);
      }
    }
    var free = []; for (j = 0; j < v.n; j++) if (piv.indexOf(j) < 0) free.push(j);
    // one null-space vector per free column: x_f = 1, each pivot variable = -(its row's entry in column f)
    var basis = free.map(function (f) {
      var x = []; for (var k = 0; k < v.n; k++) x.push(k === f ? 1 : 0);
      piv.forEach(function (p, row) { x[p] = -A[row][f] || 0; });
      return x;
    });
    return {r: r, piv: piv, A: A, free: free, basis: basis};
  }

  Viz.register("rank-nullity", {
    title: "Rank plus nullity",
    subject: "linear-algebra",
    shows: "Rank plus nullity equals the number of columns, shown as dimensions that trade off",
    params: {
      m: {kind: "integer", default: 3, min: 1, max: 4, label: "m \\text{ rows}"},
      n: {kind: "integer", default: 4, min: 1, max: 6, label: "n \\text{ cols}"},
      r: {kind: "integer", default: 2, min: 0, max: 4, label: "\\text{rank}"}
    },
    formula: function (v) {
      var b = build(v);
      return "\\operatorname{rank}A+\\dim\\operatorname{Nul}A=n:\\quad " + b.r + "+" + (v.n - b.r) + "=" + v.n;
    },
    status: function (v) {
      var b = build(v), k = v.n - b.r, cap = v.r > b.r ? "A " + v.m + " × " + v.n + " matrix has rank at most " + b.r + ", so " : "";
      if (b.r === 0) return cap + "Rank <b>0</b> means A is the zero matrix: all " + v.n + " columns are free and every x is in the null space.";
      if (k === 0) return cap + "every column has a pivot: rank <b>" + b.r + "</b>, nullity <b>0</b>, so Ax = 0 only when x = 0.";
      return cap + b.r + " pivot column" + (b.r > 1 ? "s give" : " gives") + " rank <b>" + b.r + "</b>; the other " + k + " column" + (k > 1 ? "s are free variables" : " is a free variable") +
        ", each adding one null-space direction, so nullity is <b>" + k + "</b>.";
    },
    examples: [
      {name: "full column rank", values: {m: 4, n: 3, r: 3}},
      {name: "zero matrix", values: {m: 3, n: 4, r: 0}},
      {name: "wide matrix", values: {m: 2, n: 6, r: 2}},
      {name: "rank capped by the rows", values: {m: 2, n: 5, r: 4}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, b = build(v), cw = 26, rh = 24, x0 = 24, y0 = 46, n = v.n, m = v.m;
      var bracket = function (x, y, h, dir) { api.path("M " + (x + 5 * dir) + " " + y + " h " + (-5 * dir) + " v " + h + " h " + (5 * dir), {stroke: c.ink, width: 1.5}); };
      // the reduced matrix: pivot columns tinted blue, free columns tinted red
      api.label([x0, 22], "A, reduced", {color: c.muted, size: 12.5});
      for (var j = 0; j < n; j++) {
        var isP = b.piv.indexOf(j) >= 0, col = isP ? c.c2 : c.c5;
        api.rect(x0 + j * cw + 2, y0 - 2, cw - 4, m * rh + 4, {fill: col, fillOpacity: 0.12, rx: 5});
        api.label([x0 + j * cw + cw / 2, y0 + m * rh + 14], "x_" + (j + 1), {color: col, size: 12.5, weight: 650, anchor: "middle"});
        for (var i = 0; i < m; i++) {
          var val = b.A[i][j], pivot = isP && b.piv[i] === j;
          if (pivot) api.circle([x0 + j * cw + cw / 2, y0 + i * rh + rh / 2], 9.5, {fill: c.c2, fillOpacity: 0.35});
          api.label([x0 + j * cw + cw / 2, y0 + i * rh + rh / 2], api.fmt(val), {color: pivot ? c.ink : i >= b.r ? c.faint : c.ink, size: 13, weight: pivot ? 700 : 500, anchor: "middle"});
        }
      }
      bracket(x0 - 2, y0 - 4, m * rh + 8, 1);
      bracket(x0 + n * cw + 2, y0 - 4, m * rh + 8, -1);
      // null-space basis read off the free columns
      var nx = x0 + n * cw + 34, vh = Math.min(20, 128 / n);
      api.label([nx, 22], b.basis.length ? "basis of Nul A" : "Nul A = {0}", {color: c.c5, size: 12.5, weight: 600});
      if (!b.basis.length) api.label([nx, y0 + 16], "only x = 0 solves Ax = 0", {color: c.muted, size: 12.5});
      b.basis.forEach(function (x, k) {
        var bx = nx + k * 30;
        bracket(bx, y0 - 4, n * vh + 8, 1);
        bracket(bx + 22, y0 - 4, n * vh + 8, -1);
        x.forEach(function (val, row) {
          var one = row === b.free[k];
          api.label([bx + 11, y0 + row * vh + vh / 2], api.fmt(val), {color: one ? c.c5 : val ? c.ink : c.faint, size: 12.5, weight: one ? 700 : 500, anchor: "middle"});
        });
      });
      // the n columns, sorted into rank (blue) and nullity (red)
      var bx0 = 20, bw = 360, by = 222, bh = 22, unit = bw / n;
      for (var q = 0; q < n; q++) api.rect(bx0 + q * unit + 1.5, by, unit - 3, bh, {fill: q < b.r ? c.c2 : c.c5, fillOpacity: q < b.r ? 0.75 : 0.6, rx: 4});
      api.label([bx0, by - 12], "rank " + b.r + " = dim Col A", {color: c.c2, size: 12.5, weight: 650});
      api.label([bx0 + bw, by - 12], "nullity " + (n - b.r) + " = dim Nul A", {color: c.c5, size: 12.5, weight: 650, anchor: "end"});
      api.label([bx0 + bw / 2, by + bh + 16], b.r + " + " + (n - b.r) + " = " + n + " columns", {color: c.ink, size: 13, weight: 600, anchor: "middle"});
    }
  });
})();
