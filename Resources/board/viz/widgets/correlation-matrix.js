// A correlation matrix read as a picture. Five variables measured on the same 60 cases; the diagonal holds each
// variable's name (it correlates 1 with itself), the lower triangle the coefficient r_ij colored by sign and strength,
// and the upper triangle the scatter that number summarizes, mirrored, so the matrix is visibly symmetric.
// Tap any cell to select that pair. The data are an illustrative sample, not survey results: seeded normals (mulberry32
// + Box-Muller), centered and orthonormalized, then mixed by the Cholesky factor of a plausible target matrix, so the
// sample correlations equal the targets; every r shown is computed from the plotted points. Queue param: exampleContext
// (kept); row and col (the selected pair, driven by tapping) are Dot's own.
(function () {
  var N = 60;
  var CTX = {
    "body-measurements": {seed: 101, v: [["height", "height"], ["arm span", "arm span"], ["weight", "weight"], ["shoe", "shoe size"], ["pulse", "resting pulse"]],
      R: [[1, .92, .62, .78, -.08], [.92, 1, .58, .72, -.06], [.62, .58, 1, .55, .12], [.78, .72, .55, 1, -.05], [-.08, -.06, .12, -.05, 1]]},
    "vehicle-features": {seed: 202, v: [["weight", "weight"], ["power", "horsepower"], ["mpg", "fuel economy"], ["0–60 s", "0–60 time"], ["price", "price"]],
      R: [[1, .70, -.86, -.25, .62], [.70, 1, -.77, -.82, .80], [-.86, -.77, 1, .45, -.58], [-.25, -.82, .45, 1, -.62], [.62, .80, -.58, -.62, 1]]},
    "student-survey": {seed: 303, v: [["study", "hours studied"], ["sleep", "hours of sleep"], ["score", "exam score"], ["screen", "screen time"], ["absences", "absences"]],
      R: [[1, -.15, .62, -.40, -.35], [-.15, 1, .30, -.30, -.10], [.62, .30, 1, -.45, -.55], [-.40, -.30, -.45, 1, .25], [-.35, -.10, -.55, .25, 1]]}
  };
  function build(ctx) { // returns {cols: 5 arrays of N standardized values, r: 5x5 sample correlations}
    var s = ctx.seed, raw = [], i, j, k;
    function rnd() { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    while (raw.length < 5 * N) { var u = rnd() || 1e-9, w = rnd(); raw.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w)); }
    var Q = [];
    for (j = 0; j < 5; j++) { // Gram-Schmidt on centered columns, scaled to mean 0 and sd 1
      var col = raw.slice(j * N, j * N + N), m = col.reduce(function (a, b) { return a + b; }, 0) / N;
      col = col.map(function (x) { return x - m; });
      Q.forEach(function (q) { var d = 0; for (i = 0; i < N; i++) d += col[i] * q[i] / N; for (i = 0; i < N; i++) col[i] -= d * q[i]; });
      var ss = Math.sqrt(col.reduce(function (a, b) { return a + b * b; }, 0) / N);
      Q.push(col.map(function (x) { return x / ss; }));
    }
    var R = ctx.R, L = [[], [], [], [], []];
    for (i = 0; i < 5; i++) for (j = 0; j <= i; j++) { // Cholesky R = L L^T
      var sum = R[i][j]; for (k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(sum) : sum / L[j][j];
    }
    var cols = [];
    for (i = 0; i < 5; i++) { var y = []; for (var n = 0; n < N; n++) { var t = 0; for (k = 0; k <= i; k++) t += L[i][k] * Q[k][n]; y.push(t); } cols.push(y); }
    var r = [];
    for (i = 0; i < 5; i++) { r.push([]); for (j = 0; j < 5; j++) {
      var sxy = 0, sxx = 0, syy = 0; for (n = 0; n < N; n++) { sxy += cols[i][n] * cols[j][n]; sxx += cols[i][n] * cols[i][n]; syy += cols[j][n] * cols[j][n]; }
      r[i].push(sxy / Math.sqrt(sxx * syy));
    } }
    return {cols: cols, r: r};
  }
  var DATA = {};
  Object.keys(CTX).forEach(function (k) { DATA[k] = build(CTX[k]); });
  function pick(v) { var a = Math.max(v.row, v.col) - 1, b = Math.min(v.row, v.col) - 1; return {a: a, b: b, r: DATA[v.exampleContext].r[a][b]}; }
  function words(r) { var x = Math.abs(r), s = x >= 0.7 ? "strong" : x >= 0.4 ? "moderate" : x >= 0.1 ? "weak" : null; return s ? s + (r > 0 ? " positive" : " negative") : "essentially no linear"; }
  var r2 = function (x) { var t = (Math.abs(x) < 0.005 ? 0 : x).toFixed(2); return t.replace("-", "−"); };

  Viz.register("correlation-matrix", {
    title: "Correlation matrix",
    subject: "stats",
    shows: "Every pair of variables gets one r: the diagonal is 1, the matrix is symmetric, color shows sign and strength, and each number has the scatter it summarizes",
    params: {
      exampleContext: {kind: "enum", values: ["body-measurements", "vehicle-features", "student-survey"], default: "body-measurements", label: "\\text{data}",
        names: {"body-measurements": "body", "vehicle-features": "cars", "student-survey": "students"}},
      row: {kind: "integer", default: 3, min: 1, max: 5, control: false, label: "i"},
      col: {kind: "integer", default: 1, min: 1, max: 5, control: false, label: "j"}
    },
    formula: function (v) {
      var p = pick(v), V = CTX[v.exampleContext].v, A = "\\text{" + V[p.a][0] + "}", B = "\\text{" + V[p.b][0] + "}";
      return "\\begin{array}{l}R=[r_{ij}]_{5\\times 5},\\ r_{ii}=1,\\ r_{ij}=r_{ji}\\\\" +
        (p.a === p.b ? "r_{" + A + "," + A + "}=1" : "r_{" + A + ",\\," + B + "}=r_{" + B + ",\\," + A + "}=" + Viz.n(p.r, 2)) + "\\end{array}";
    },
    status: function (v) {
      var p = pick(v), V = CTX[v.exampleContext].v, R = DATA[v.exampleContext].r, best = [1, 0];
      for (var i = 1; i < 5; i++) for (var j = 0; j < i; j++) if (Math.abs(R[i][j]) > Math.abs(R[best[0]][best[1]])) best = [i, j];
      if (p.a === p.b) return "Any variable correlates perfectly with itself, so the diagonal is all <b>1</b>s; tap an off-diagonal cell to compare two variables.";
      var cap = V[p.b][1].charAt(0).toUpperCase() + V[p.b][1].slice(1);
      var tail = best[0] === p.a && best[1] === p.b ? ", the strongest pair in this table." :
        "; the strongest pair here is " + V[best[1]][1] + " and " + V[best[0]][1] + " (" + r2(R[best[0]][best[1]]) + ").";
      return cap + " and " + V[p.a][1] + ": r = <b>" + r2(p.r) + "</b>, a " + words(p.r) + " link" + tail;
    },
    examples: [
      {name: "exampleContext: vehicle-features", values: {exampleContext: "vehicle-features", row: 3, col: 1}},
      {name: "exampleContext: student-survey", values: {exampleContext: "student-survey", row: 3, col: 1}},
      {name: "a variable with itself", values: {row: 2, col: 2}},
      {name: "no linear link: height and pulse", values: {row: 5, col: 1}},
      {name: "upper cell picks the same pair", values: {exampleContext: "vehicle-features", row: 2, col: 4}}
    ],
    size: [400, 302],
    draw: function (api, v) {
      var c = api.color, ctx = CTX[v.exampleContext], D = DATA[v.exampleContext], p = pick(v);
      var x0 = 6, y0 = 6, cs = 58, pad = 6;
      var tint = function (r) { return r >= 0 ? c.c2 : c.c5; };
      var scale = D.cols.map(function (col) { return Math.max.apply(null, col.map(Math.abs)) * 1.08; });
      function cell(i, j, el) { el.style.cursor = "pointer"; el.addEventListener("click", function () { api.set({row: i + 1, col: j + 1}); }); }
      for (var i = 0; i < 5; i++) for (var j = 0; j < 5; j++) {
        var x = x0 + j * cs, y = y0 + i * cs, r = D.r[i][j];
        if (i === j) {
          cell(i, j, api.rect(x + 1, y + 1, cs - 2, cs - 2, {fill: c.ink, fillOpacity: 0.06, rx: 4}));
          api.label([x + cs / 2, y + cs / 2 - 8], ctx.v[i][0], {color: c.ink, size: 12, weight: 650, anchor: "middle"});
          api.label([x + cs / 2, y + cs / 2 + 10], "1", {color: c.muted, size: 12, anchor: "middle"});
        } else if (i > j) {
          cell(i, j, api.rect(x + 1, y + 1, cs - 2, cs - 2, {fill: tint(r), fillOpacity: 0.1 + 0.7 * Math.abs(r), rx: 4}));
          api.label([x + cs / 2, y + cs / 2], r2(r), {color: c.ink, size: 13, weight: 650, anchor: "middle"});
        } else {
          // upper triangle: the scatter of row variable (vertical) against column variable (horizontal)
          cell(i, j, api.rect(x + 1, y + 1, cs - 2, cs - 2, {fill: tint(r), fillOpacity: 0.05 + 0.12 * Math.abs(r), rx: 4}));
          for (var n = 0; n < N; n++) {
            var px = x + cs / 2 + (cs / 2 - pad) * D.cols[j][n] / scale[j], py = y + cs / 2 - (cs / 2 - pad) * D.cols[i][n] / scale[i];
            api.circle([px, py], 1.6, {fill: Math.abs(r) < 0.1 ? c.muted : tint(r), fillOpacity: 0.9});
          }
        }
      }
      // the selected pair, in both halves of the matrix
      var sel = [[p.a, p.b], [p.b, p.a]];
      sel.forEach(function (q) { api.rect(x0 + q[1] * cs + 1, y0 + q[0] * cs + 1, cs - 2, cs - 2, {stroke: c.accent, width: 2.6, rx: 4}); });
      // color key: -1 (red) through 0 to +1 (blue)
      var kx = 354, kt = 30, kb = 240, steps = 10, hh = (kb - kt) / steps;
      api.label([kx + 8, kt - 16], "r", {color: c.muted, size: 13, anchor: "middle", italic: true});
      for (var s = 0; s < steps; s++) {
        var rv = 1 - (s + 0.5) * 2 / steps;
        api.rect(kx, kt + s * hh, 16, hh + 0.5, {fill: tint(rv), fillOpacity: 0.1 + 0.7 * Math.abs(rv), rx: 0});
      }
      [[1, "+1"], [0, "0"], [-1, "−1"]].forEach(function (t) { api.label([kx + 22, kt + (1 - t[0]) / 2 * (kb - kt)], t[1], {color: c.muted, size: 12}); });
      var py0 = kt + (1 - p.r) / 2 * (kb - kt);
      api.line([kx - 5, py0], [kx + 19, py0], {color: c.accent, width: 2.5});
      api.label([kx - 8, py0], r2(p.a === p.b ? 1 : p.r), {color: c.accent, size: 12.5, weight: 650, anchor: "end"});
      api.label([396, 272], "tap a cell", {color: c.muted, size: 12, anchor: "end"});
      api.label([396, 290], "sample of 60", {color: c.muted, size: 12, anchor: "end"});
    }
  });
})();
