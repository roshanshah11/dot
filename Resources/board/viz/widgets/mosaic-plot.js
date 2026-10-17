// A mosaic plot of a 2×2 table: a trial's treatment and placebo groups, improved or not. Each column's width is
// that group's share of everyone, and within a column the split is the share who improved, so every tile's
// area is its count. The dashed line is the overall share who improved: if the outcome did not depend on the
// group, both splits would sit on it. The chi-square test measures how far the counts sit from that picture,
// with expected counts E = row total × column total / N (df = 1; p from the chi-square tail, erfc(√(χ²/2))).
// Dot's design: the queue gives no parameters; the four cell counts are the table itself.
(function () {
  function erfc(x) { // Abramowitz and Stegun 7.1.26, |error| < 1.5e-7
    var t = 1 / (1 + 0.3275911 * x);
    return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  }
  function calc(v) {
    var O = [[v.tYes, v.pYes], [v.tNo, v.pNo]], col = [v.tYes + v.tNo, v.pYes + v.pNo], row = [v.tYes + v.pYes, v.tNo + v.pNo], N = col[0] + col[1];
    var ok = N > 0 && col[0] > 0 && col[1] > 0 && row[0] > 0 && row[1] > 0, chi = NaN, minE = Infinity;
    if (ok) {
      chi = 0;
      for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) { var E = row[i] * col[j] / N; minE = Math.min(minE, E); chi += Math.pow(O[i][j] - E, 2) / E; }
    }
    return {O: O, col: col, row: row, N: N, ok: ok, chi: chi, p: ok ? erfc(Math.sqrt(chi / 2)) : NaN, minE: minE,
            rT: col[0] ? v.tYes / col[0] : NaN, rP: col[1] ? v.pYes / col[1] : NaN, rAll: N ? row[0] / N : NaN};
  }
  function pct(x) { return Viz.fmt(100 * x, 0) + "%"; }
  function pv(p) { return p < 0.001 ? "p < 0.001" : "p = " + Viz.fmt(p, 3); }

  Viz.register("mosaic-plot", {
    title: "Mosaic plot of a two-way table",
    subject: "stats",
    shows: "Change the four counts: tile areas are the counts, and when the splits line up across columns the two variables are independent",
    params: {
      tYes: {kind: "integer", default: 45, min: 0, max: 100, label: "\\text{T, yes}"},
      tNo: {kind: "integer", default: 15, min: 0, max: 100, label: "\\text{T, no}"},
      pYes: {kind: "integer", default: 25, min: 0, max: 100, label: "\\text{P, yes}"},
      pNo: {kind: "integer", default: 35, min: 0, max: 100, label: "\\text{P, no}"}
    },
    formula: function (v) {
      var k = calc(v), cond = function (y, n) { return n ? "\\tfrac{" + y + "}{" + n + "}=" + Viz.n(y / n, 2) : "\\text{undefined}"; };
      return "\\begin{array}{l}P(\\text{yes}\\mid T)=" + cond(v.tYes, k.col[0]) + "\\\\[4pt]P(\\text{yes}\\mid P)=" + cond(v.pYes, k.col[1]) +
        "\\\\[6pt]\\chi^2=\\sum\\dfrac{(O-E)^2}{E}=" + (k.ok ? Viz.n(k.chi, 2) : "\\text{undefined}") + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (!k.N) return "The table is empty: there is nothing to draw or test.";
      if (!k.col[0] || !k.col[1]) return "Only one group has anyone in it, so there is nothing to compare.";
      if (!k.row[0] || !k.row[1]) return "Everyone had the same outcome (" + (k.row[0] ? "improved" : "not improved") + "), so the groups cannot differ.";
      var small = k.minE < 5 ? " An expected count is under 5, so the chi-square p-value is rough; use Fisher's exact test." : "";
      if (k.chi < 1e-9) return "Both groups improve at exactly <b>" + pct(k.rT) + "</b>: the splits line up, χ² = 0, the outcome is independent of the group." + small;
      return "Treatment " + pct(k.rT) + " vs placebo " + pct(k.rP) + " improved: χ² = <b>" + Viz.fmt(k.chi, 2) + "</b>, " + pv(k.p) +
        (k.p < 0.05 ? ", so the outcome <b>depends</b> on the group." : ", which chance alone could easily produce.") + small;
    },
    examples: [
      {name: "Minimum supported values", values: {tYes: 0, tNo: 0, pYes: 0, pNo: 0}},
      {name: "Maximum supported values", values: {tYes: 100, tNo: 100, pYes: 100, pNo: 100}},
      {name: "independent, unequal groups", values: {tYes: 30, tNo: 20, pYes: 60, pNo: 40}},
      {name: "strong association", values: {tYes: 50, tNo: 5, pYes: 10, pNo: 45}},
      {name: "small counts", values: {tYes: 3, tNo: 1, pYes: 1, pNo: 3}},
      {name: "one group empty", values: {pYes: 0, pNo: 0}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 36, y0 = 34, W = 252, H = 200, gap = 8, vg = 5;
      api.label([x0, 14], "width: group size · height: share improved", {color: c.muted, size: 12});
      if (!k.N) { // empty table: the frame of the mosaic, nothing in it
        [0, 1].forEach(function (j) {
          var xe = x0 + j * (W + gap) / 2, we = (W - gap) / 2;
          api.rect(xe, y0, we, H, {stroke: c.faint, dash: "5 4", rx: 3});
          api.label([xe + we / 2, y0 + H + 14], ["treatment", "placebo"][j], {color: c.muted, size: 12.5, anchor: "middle"});
          api.label([xe + we / 2, y0 + H + 29], "n = 0", {color: c.muted, size: 12, anchor: "middle"});
        });
        api.label([x0 + W / 2, y0 + H / 2], "no observations", {color: c.muted, size: 13, anchor: "middle"});
        api.label([x0 + W + 12, y0 + 10], "improved", {color: c.c1, size: 12.5, weight: 650});
        api.label([x0 + W + 12, y0 + H - 10], "not improved", {color: c.c2, size: 12.5, weight: 650});
        return;
      }
      var names = ["treatment", "placebo"], yes = [v.tYes, v.pYes], no = [v.tNo, v.pNo];
      var usable = W - (k.col[0] && k.col[1] ? gap : 0), x = x0;
      for (var j = 0; j < 2; j++) {
        if (!k.col[j]) continue;
        var w = usable * k.col[j] / k.N, r = yes[j] / k.col[j], hasBoth = yes[j] && no[j];
        var hy = (H - (hasBoth ? vg : 0)) * r, hn = H - (hasBoth ? vg : 0) - hy;
        if (yes[j]) api.rect(x, y0, w, hy, {fill: c.c1, fillOpacity: 0.8, rx: 2});
        if (no[j]) api.rect(x, y0 + H - hn, w, hn, {fill: c.c2, fillOpacity: 0.55, rx: 2});
        if (w > 44) {
          if (hy > 30) api.label([x + w / 2, y0 + hy / 2], yes[j] + " · " + pct(r), {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
          if (hn > 30) api.label([x + w / 2, y0 + H - hn / 2], no[j] + " · " + pct(1 - r), {color: c.ink, size: 12.5, weight: 600, anchor: "middle"});
        }
        api.label([x + w / 2, y0 + H + 14], names[j], {color: c.ink, size: 12.5, weight: 600, anchor: "middle"});
        api.label([x + w / 2, y0 + H + 29], "n = " + k.col[j], {color: c.muted, size: 12, anchor: "middle"});
        x += w + gap;
      }
      // where the splits would sit if the outcome did not depend on the group
      if (k.row[0] && k.row[1]) {
        var yI = y0 + (H - vg) * k.rAll + vg / 2;
        api.line([x0 - 6, yI], [x0 + W + 6, yI], {color: c.ink, width: 1.8, dash: "6 4"});
        var yL = Math.max(y0 + 36, Math.min(y0 + H - 36, yI));
        api.label([x0 + W + 12, yL - 9], "overall", {color: c.muted, size: 12});
        api.label([x0 + W + 12, yL + 8], pct(k.rAll) + " improved", {color: c.ink, size: 12, weight: 600});
      }
      api.label([x0 + W + 12, y0 + 10], "improved", {color: c.c1, size: 12.5, weight: 650});
      api.label([x0 + W + 12, y0 + H - 10], "not improved", {color: c.c2, size: 12.5, weight: 650});
      api.label([x0 + W + 12, y0 + H + 22], "N = " + k.N, {color: c.muted, size: 12});
    }
  });
})();
