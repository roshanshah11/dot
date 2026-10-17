// Low-rank approximation by the SVD. A is a 6 × 19 bitmap of the word DOT (rank exactly 4). Keeping the k largest
// singular values gives A_k = σ1u1v1ᵀ + … + σkukvkᵀ, the best rank-k approximation (Eckart–Young), with error
// ‖A − A_k‖_F = sqrt(σ_{k+1}² + …). The SVD is computed here: Jacobi on AAᵀ gives U and σ², and A_k = U_k U_kᵀ A.
(function () {
  var ROWS = ["XXXX....XXX...XXXXX", "XX.XX..XX.XX....X..", "XX..XX.XX.XX....X..", "XX..XX.XX.XX....X..", "XX.XX..XX.XX....X..", "XXXX....XXX.....X.."];
  var A = ROWS.map(function (r) { return r.split("").map(function (ch) { return ch === "X" ? 1 : 0; }); });
  var m = A.length, n = A[0].length, svd = null;
  function decompose() { // symmetric Jacobi on S = A Aᵀ: S = U diag(σ²) Uᵀ
    var S = A.map(function (ri) { return A.map(function (rj) { return ri.reduce(function (s, x, k) { return s + x * rj[k]; }, 0); }); });
    var V = S.map(function (_, i) { return S.map(function (_, j) { return i === j ? 1 : 0; }); });
    for (var sweep = 0; sweep < 60; sweep++) {
      var off = 0;
      for (var p = 0; p < m; p++) for (var q = p + 1; q < m; q++) off += S[p][q] * S[p][q];
      if (off < 1e-22) break;
      for (p = 0; p < m; p++) for (q = p + 1; q < m; q++) {
        if (Math.abs(S[p][q]) < 1e-15) continue;
        var phi = 0.5 * Math.atan2(2 * S[p][q], S[q][q] - S[p][p]), c = Math.cos(phi), s = Math.sin(phi), k, a, b;
        for (k = 0; k < m; k++) { a = S[k][p]; b = S[k][q]; S[k][p] = c * a - s * b; S[k][q] = s * a + c * b; }
        for (k = 0; k < m; k++) { a = S[p][k]; b = S[q][k]; S[p][k] = c * a - s * b; S[q][k] = s * a + c * b; }
        for (k = 0; k < m; k++) { a = V[k][p]; b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
      }
    }
    var idx = S.map(function (_, i) { return i; }).sort(function (i, j) { return S[j][j] - S[i][i]; });
    return {sigma: idx.map(function (i) { return Math.sqrt(Math.max(0, S[i][i])); }), U: idx.map(function (i) { return V.map(function (row) { return row[i]; }); })};
  }
  function approx(k) { // A_k = (Σ_{i≤k} u_i u_iᵀ) A
    svd = svd || decompose();
    var P = A.map(function (_, i) { return A.map(function (_, j) { var s = 0; for (var t = 0; t < k; t++) s += svd.U[t][i] * svd.U[t][j]; return s; }); });
    return P.map(function (row) { return A[0].map(function (_, col) { return row.reduce(function (s, x, r) { return s + x * A[r][col]; }, 0); }); });
  }
  function stats(k) {
    svd = svd || decompose();
    var sq = svd.sigma.map(function (x) { return x * x; }), tot = sq.reduce(function (a, b) { return a + b; }, 0);
    var rest = sq.slice(k).reduce(function (a, b) { return a + b; }, 0);
    return {sigma: svd.sigma, kept: 1 - rest / tot, err: Math.sqrt(rest / tot), norm: Math.sqrt(tot), rest: svd.sigma.slice(k, 4)};
  }
  var SUB = ["₁", "₂", "₃", "₄"];
  Viz.register("singular-value-decomposition", {
    title: "SVD: rebuilding a matrix from its biggest pieces",
    subject: "linear-algebra",
    shows: "Slide the rank k: the SVD writes A as a sum of rank-one layers σᵢuᵢvᵢᵀ, largest first, and keeping the first k gives the best rank-k copy of A",
    params: {rank: {kind: "integer", default: 2, min: 1, max: 4, label: "k"}},
    formula: function (v) {
      var st = stats(v.rank), k = v.rank;
      var num = k >= 4 ? "0" : "\\sqrt{" + st.rest.map(function (x) { return Viz.n(x) + "^2"; }).join("+") + "}";
      return "A=U\\Sigma V^{\\mathsf T}\\approx A_" + k + "=\\sum_{i=1}^{" + k + "}\\sigma_i\\mathbf u_i\\mathbf v_i^{\\mathsf T}\\newline\\frac{\\lVert A-A_" + k + "\\rVert_F}{\\lVert A\\rVert_F}=\\frac{" + num + "}{" + Viz.n(st.norm) + "}=" + Viz.n(st.err);
    },
    status: function (v) {
      var st = stats(v.rank), k = v.rank;
      if (k >= 4) return "Rank 4 rebuilds A <b>exactly</b>, because A has rank 4; it takes 104 numbers instead of 114, so the saving only pays when k is small.";
      return "Rank " + k + " keeps <b>" + Viz.fmt(st.kept * 100, 0) + "%</b> of ‖A‖² from " + 26 * k + " numbers instead of 114; what is left over is <b>" + Viz.fmt(st.err * 100, 0) + "%</b> of ‖A‖.";
    },
    examples: [
      {name: "Minimum supported values", values: {rank: 1}},
      {name: "Maximum supported values", values: {rank: 4}},
      {name: "Three retained singular components", values: {rank: 3}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = v.rank, st = stats(k), Ak = approx(k), cell = 11, gx = 12;
      var heat = function (M, y0, title, titleColor) {
        api.label([gx, y0 - 10], title, {color: titleColor || c.muted, size: 12.5, weight: 600});
        api.rect(gx - 2, y0 - 2, n * cell + 4, m * cell + 4, {stroke: c.grid, width: 1, rx: 3});
        for (var i = 0; i < m; i++) for (var j = 0; j < n; j++) {
          var x = M[i][j];
          if (Math.abs(x) < 0.02) continue;   // teal = positive entry, red = negative; strength = size (clamped at 1)
          api.rect(gx + j * cell + 0.5, y0 + i * cell + 0.5, cell - 1, cell - 1, {fill: x > 0 ? c.c1 : c.c5, fillOpacity: Math.min(1, Math.abs(x)), rx: 1.5});
        }
      };
      var R = A.map(function (row, i) { return row.map(function (x, j) { return x - Ak[i][j]; }); });
      heat(A, 24, "A  (6 × 19, rank 4)");
      heat(Ak, 118, "A" + SUB[k - 1] + " = " + (k === 1 ? "σ₁u₁v₁ᵀ" : k === 2 ? "σ₁u₁v₁ᵀ + σ₂u₂v₂ᵀ" : "σ₁u₁v₁ᵀ + … + σ" + SUB[k - 1] + "u" + SUB[k - 1] + "v" + SUB[k - 1] + "ᵀ"), c.ink);
      heat(R, 212, "A − A" + SUB[k - 1] + "  (left over: " + Viz.fmt(st.err * 100, 0) + "%)");
      if (st.err < 1e-6) api.label([gx + n * cell / 2, 212 + m * cell / 2], "nothing left: exact", {color: c.c4, size: 12.5, weight: 650, anchor: "middle"});
      // singular values: the ones kept are lit
      var bx = 262, base = 246, hmax = 170, bw = 22, step = 33, smax = st.sigma[0];
      api.label([bx - 6, 14], "singular values", {color: c.muted, size: 12.5, weight: 600});
      api.line([bx - 8, base], [bx + 4 * step - 4, base], {color: c.axis, width: 1.2});
      for (var i = 0; i < 4; i++) {
        var h = hmax * st.sigma[i] / smax, keep = i < k, x = bx + i * step;
        api.rect(x, base - h, bw, h, {fill: keep ? c.c3 : "none", fillOpacity: keep ? 0.9 : 0, stroke: keep ? null : c.faint, dash: keep ? null : "3 3", width: 1.2, rx: 3});
        api.label([x + bw / 2, base - h - 10], api.fmt(st.sigma[i]), {color: keep ? c.c3 : c.muted, size: 12, weight: 650, anchor: "middle"});
        api.label([x + bw / 2, base + 13], "σ" + SUB[i], {color: keep ? c.c3 : c.muted, size: 12.5, anchor: "middle"});
      }
      api.label([bx - 6, base + 32], "σ₅ = σ₆ = 0", {color: c.muted, size: 12});
      api.label([bx + 4 * step - 4, 34], "kept " + Viz.fmt(st.kept * 100, 0) + "%", {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
    }
  });
})();
