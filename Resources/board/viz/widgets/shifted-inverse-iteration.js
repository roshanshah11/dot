// Power iteration on B = A − σI, A⁻¹ or (A − σI)⁻¹ for a symmetric A with eigenvalues 1, 3 and 6 (eigenvectors
// v1, v2, v3). Writing x_k in the eigenbasis, each step multiplies the v_i part by μ_i (the eigenvalue of B), so the
// part with the largest |μ_i| takes over at rate |μ_2nd| / |μ_max|. Real codes solve (A − σI) y = x_k, never invert.
(function () {
  var LAM = [1, 3, 6];
  function gains(v) {
    var shift = v.mode === "inverse" ? 0 : v.sigma, inf = -1;
    var mu = LAM.map(function (l, i) {
      if (v.mode === "shifted") return l - v.sigma;
      if (Math.abs(l - shift) < 1e-9) { inf = i; return Infinity; }
      return 1 / (l - shift);
    });
    var abs = mu.map(Math.abs), order = [0, 1, 2].sort(function (a, b) { return abs[b] - abs[a]; });
    var top = order[0], second = order[1];
    var tie = inf < 0 && Math.abs(abs[top] - abs[second]) < 1e-9 * Math.max(1, abs[top]);
    return {mu: mu, abs: abs, inf: inf, top: top, second: second, tie: tie, ratio: inf >= 0 ? 0 : abs[second] / abs[top], shift: shift};
  }
  function shares(g, k) { // squared eigen-components of x_k (x_0 has equal parts), normalized to sum 1
    if (g.inf >= 0 && k >= 1) return LAM.map(function (_, i) { return i === g.inf ? 1 : 0; });
    var w = g.abs.map(function (a) { return Math.pow(a / g.abs[g.top], 2 * k); }), s = w[0] + w[1] + w[2];
    return w.map(function (x) { return x / s; });
  }
  Viz.register("shifted-inverse-iteration", {
    title: "Shifted and inverse iteration",
    subject: "linear-algebra",
    shows: "Pick a mode and slide the shift σ: each step multiplies x's part along eigenvector vᵢ by μᵢ, so the eigenvector with the biggest |μᵢ| takes over; (A − σI)⁻¹ picks the eigenvalue nearest σ",
    params: {
      mode: {kind: "enum", values: ["shifted", "inverse", "shifted_inverse"], default: "shifted", label: "B", names: {shifted: "A − σI", inverse: "A⁻¹", shifted_inverse: "(A − σI)⁻¹"}},
      sigma: {kind: "number", default: 2.6, min: 0, max: 7, step: 0.1, label: "\\sigma"},
      k: {kind: "integer", default: 6, min: 1, max: 12, label: "k"}
    },
    formula: function (v) {
      var g = gains(v), sg = Viz.n(g.shift), B = v.mode === "inverse" ? "A^{-1}" : v.mode === "shifted" ? "A-" + sg + "I" : "(A-" + sg + "I)^{-1}";
      var mu = v.mode === "shifted" ? "\\mu_i=\\lambda_i-\\sigma" : v.mode === "inverse" ? "\\mu_i=\\frac{1}{\\lambda_i}" : "\\mu_i=\\frac{1}{\\lambda_i-\\sigma}";
      return "\\mathbf x_{k+1}=\\frac{B\\mathbf x_k}{\\lVert B\\mathbf x_k\\rVert}\\newline B=" + B + ",\\ \\ " + mu;
    },
    status: function (v) {
      var g = gains(v), sub = ["₁", "₂", "₃"];
      if (g.inf >= 0) return "σ equals λ" + sub[g.inf] + " exactly, so A − σI is singular: one solve blows up along <b>v" + sub[g.inf] + "</b> and lands on it (solvers nudge σ off).";
      if (g.tie) return "<b>No single winner</b>: v" + sub[g.top] + " and v" + sub[g.second] + " tie at |μ| = " + Viz.fmt(g.abs[g.top]) + ", so x keeps a mix of both instead of settling.";
      var why = v.mode === "inverse" ? "the smallest |λ|" : v.mode === "shifted_inverse" ? "the eigenvalue closest to σ" : g.shift === 0 ? "the largest |λ|" : "the eigenvalue farthest from σ";
      return "Converges to <b>v" + sub[g.top] + "</b> (λ = " + LAM[g.top] + ", " + why + "): the other parts shrink by <b>" + Viz.fmt(g.ratio) + "×</b> per step.";
    },
    examples: [
      {name: "mode: inverse", values: {mode: "inverse"}},
      {name: "mode: shifted_inverse", values: {mode: "shifted_inverse"}},
      {name: "shift between two eigenvalues: a tie", values: {mode: "shifted_inverse", sigma: 2}},
      {name: "shift right on an eigenvalue", values: {mode: "shifted_inverse", sigma: 3}}
    ],
    size: [400, 296],
    draw: function (api, v) {
      var c = api.color, W = api.w, g = gains(v), COL = [c.c1, c.c3, c.c6];
      var X = function (l) { return 34 + (l + 0.5) / 8 * (W - 68); }, axisY = 104, barMax = 58, bw = 26;
      api.label([14, 13], "gain per step |μᵢ| for B = " + {shifted: "A − σI", inverse: "A⁻¹", shifted_inverse: "(A − σI)⁻¹"}[v.mode], {color: c.muted, size: 12});
      api.line([X(-0.5), axisY], [X(7.5), axisY], {color: c.axis, width: 1.4});
      for (var t = 0; t <= 7; t++) api.line([X(t), axisY - 3], [X(t), axisY + 3], {color: c.axis, width: 1});
      // the shift: a red marker on the eigenvalue axis (inverse iteration is the shift 0)
      var sx = X(g.shift);
      api.line([sx, 30], [sx, axisY], {color: c.c5, width: 1.6, dash: "4 4", opacity: 0.85});
      api.polygon([[sx, 129], [sx - 5.5, 138], [sx + 5.5, 138]], {fill: c.c5, fillOpacity: 1});
      api.label([sx, 149], v.mode === "inverse" ? "shift 0" : "σ = " + api.fmt(v.sigma), {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      LAM.forEach(function (l, i) {
        var h = g.inf >= 0 ? (i === g.inf ? barMax : 2) : Math.max(2, barMax * g.abs[i] / g.abs[g.top]), win = !g.tie && i === g.top;
        api.rect(X(l) - bw / 2, axisY - 2 - h, bw, h, {fill: COL[i], fillOpacity: win || (g.tie && (i === g.top || i === g.second)) ? 0.95 : 0.4, rx: 3});
        api.label([X(l), axisY - 12 - h], g.inf === i ? "∞" : api.fmt(g.abs[i]), {color: COL[i], size: 12.5, weight: 650, anchor: "middle"});
        if (win) api.circle([X(l), axisY], 8, {stroke: COL[i], width: 2});
        api.point([X(l), axisY], {color: COL[i], r: 4.5});
        api.label([X(l), 118], "λ" + ["₁", "₂", "₃"][i] + " = " + l, {color: COL[i], size: 12.5, weight: 600, anchor: "middle"});
      });
      // how x_k splits across v1, v2, v3 as the steps run
      var top = 184, base = 270, cols = v.k + 1, x0 = 34, x1 = W - 14, cw = (x1 - x0) / cols, gap = Math.min(6, cw * 0.22);
      var last = shares(g, v.k), rq = last[0] * LAM[0] + last[1] * LAM[1] + last[2] * LAM[2];
      api.label([14, 170], "share of xₖ along v₁, v₂, v₃", {color: c.muted, size: 12});
      api.label([W - 14, 170], "xₖᵀAxₖ = " + api.fmt(rq, 3), {color: g.tie ? c.ink : COL[g.inf >= 0 ? g.inf : g.top], size: 12.5, weight: 650, anchor: "end"});
      for (var k = 0; k <= v.k; k++) {
        var sh = shares(g, k), y = base, xk = x0 + k * cw + gap / 2;
        for (var i = 0; i < 3; i++) {
          var hh = sh[i] * (base - top);
          if (hh > 0.05) api.rect(xk, y - hh, cw - gap, hh, {fill: COL[i], fillOpacity: 0.85, rx: 1.5});
          y -= hh;
        }
        if (cols <= 9 || k % 2 === 0 || k === v.k) api.label([xk + (cw - gap) / 2, base + 13], String(k), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([14, base + 13], "k", {color: c.muted, size: 12, italic: true});
    }
  });
})();
