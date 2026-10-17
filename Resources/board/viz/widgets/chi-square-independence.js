// Chi-square test of independence on a 2 x 2 table (treated or control, improved or not). The mosaic gives each
// group a band as tall as its row total, split at that group's share who improved; if improvement were independent of
// group, both splits would sit on the dashed overall share. Each cell shows its observed count and its expected count
// E = (row total)(column total)/N. chi2 = sum (O - E)^2 / E on (2 - 1)(2 - 1) = 1 df, without Yates' continuity
// correction; for 1 df the tail is P(chi2_1 >= x) = erfc(sqrt(x/2)). Every count is at least 20, so every E is too.
(function () {
  var K = ["observedTopLeft", "observedTopRight", "observedBottomLeft", "observedBottomRight"];
  var ROWS = ["treated", "control"];
  function erfc(x) { // Numerical Recipes erfcc, relative error < 1.2e-7
    var z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 +
      t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function calc(v) {
    var O = [[v[K[0]], v[K[1]]], [v[K[2]], v[K[3]]]];
    var R = [O[0][0] + O[0][1], O[1][0] + O[1][1]], C = [O[0][0] + O[1][0], O[0][1] + O[1][1]], N = R[0] + R[1];
    var E = [[R[0] * C[0] / N, R[0] * C[1] / N], [R[1] * C[0] / N, R[1] * C[1] / N]], chi = 0;
    for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) chi += Math.pow(O[i][j] - E[i][j], 2) / E[i][j];
    if (chi < 1e-12) chi = 0;
    return {O: O, R: R, C: C, N: N, E: E, chi: chi, p: chi > 0 ? erfc(Math.sqrt(chi / 2)) : 1, share: [O[0][0] / R[0], O[1][0] / R[1]], all: C[0] / N};
  }
  // four decimals near 0.05 so a borderline p never rounds onto the cutoff
  function pNum(p) {
    if (Math.abs(p - 0.05) < 0.005) { var t = p.toPrecision(3); return t === "0.0500" ? p.toPrecision(4) : t; }
    return Viz.fmt(p, p < 0.01 ? 4 : 3);
  }
  function pText(p) { return p < 0.0001 ? "p < 0.0001" : "p = " + pNum(p); }
  var pc = function (x) { return Viz.fmt(100 * x, 1) + "%"; };
  var params = {};
  K.forEach(function (k, i) { params[k] = {kind: "integer", default: [54, 26, 30, 30][i], min: 20, max: 60, label: "O_{" + ["11", "12", "21", "22"][i] + "}"}; });

  Viz.register("chi-square-independence", {
    title: "Chi-square test of independence",
    subject: "stats",
    shows: "Change the four counts: if improving does not depend on the group, both groups split at the overall share and O = E in every cell; χ² measures how far they are from that",
    params: params,
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}E_{ij}=\\dfrac{R_i C_j}{N}:\\ E_{11}=\\dfrac{" + k.R[0] + "\\cdot " + k.C[0] + "}{" + k.N + "}=" + Viz.n(k.E[0][0], 2) + "\\\\[6pt]" +
        "\\chi^2=\\sum\\dfrac{(O-E)^2}{E}=" + Viz.n(k.chi, 2) + "\\\\[4pt]df=1,\\ \\ p" + (k.p < 0.0001 ? "<0.0001" : "=" + pNum(k.p)) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.chi === 0) return "Both groups improve at exactly " + pc(k.all) + ", the overall share, so O = E in every cell: <b>χ² = 0</b>, no association at all.";
      var lead = pc(k.share[0]) + " of treated vs " + pc(k.share[1]) + " of control improved";
      if (k.p < 0.05) return lead + "; <b>χ² = " + Viz.fmt(k.chi, 2) + "</b> (" + pText(k.p) + ") says a gap this large is unlikely if improving were independent of group.";
      return lead + "; <b>χ² = " + Viz.fmt(k.chi, 2) + "</b> (" + pText(k.p) + ") is the kind of gap chance alone produces, so no evidence of an association.";
    },
    examples: [
      {name: "Minimum supported values", values: {observedTopLeft: 20, observedTopRight: 20, observedBottomLeft: 20, observedBottomRight: 20}},
      {name: "Maximum supported values", values: {observedTopLeft: 60, observedTopRight: 60, observedBottomLeft: 60, observedBottomRight: 60}},
      {name: "Unequal margins", values: {observedTopLeft: 56, observedTopRight: 24, observedBottomLeft: 31, observedBottomRight: 49}},
      {name: "strongest association", values: {observedTopLeft: 60, observedTopRight: 20, observedBottomLeft: 20, observedBottomRight: 60}},
      {name: "independent with unequal groups", values: {observedTopLeft: 60, observedTopRight: 30, observedBottomLeft: 40, observedBottomRight: 20}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), mx0 = 66, mx1 = 222, my0 = 48, my1 = 238, gap = 8, W = mx1 - mx0, Hh = my1 - my0 - gap;
      api.label([mx0, 14], "improved", {color: c.c1, size: 12.5, weight: 650});
      api.label([mx1, 14], "not improved", {color: c.muted, size: 12.5, weight: 650, anchor: "end"});
      var y = my0;
      for (var i = 0; i < 2; i++) {
        var h = Hh * k.R[i] / k.N, xs = mx0 + W * k.share[i];
        api.rect(mx0, y, xs - mx0, h, {fill: c.c1, fillOpacity: 0.45, rx: 2});
        api.rect(xs, y, mx1 - xs, h, {fill: c.muted, fillOpacity: 0.22, rx: 2});
        api.line([xs, y], [xs, y + h], {color: c.c1, width: 2.5});
        api.label([mx0 - 6, y + h / 2 - 7], ROWS[i], {color: c.ink, size: 12.5, weight: 600, anchor: "end"});
        api.label([mx0 - 6, y + h / 2 + 9], "n = " + k.R[i], {color: c.muted, size: 12, anchor: "end"});
        api.label([mx1 + 6, y + h / 2], pc(k.share[i]), {color: c.c1, size: 12.5, weight: 650});
        [[mx0, xs], [xs, mx1]].forEach(function (seg, j) {
          var cxm = (seg[0] + seg[1]) / 2;
          api.label([cxm, y + h / 2 - 8], String(k.O[i][j]), {color: c.ink, size: 13, weight: 700, anchor: "middle"});
          api.label([cxm, y + h / 2 + 9], "E " + Viz.fmt(k.E[i][j], 1), {color: c.muted, size: 12, anchor: "middle"});
        });
        y += h + gap;
      }
      // where both splits would sit if improving did not depend on the group
      var xa = mx0 + W * k.all;
      api.line([xa, my0 - 6], [xa, my1 + 6], {color: c.ink, width: 1.6, dash: "5 4"});
      api.label([xa, my1 + 18], "overall " + pc(k.all) + " improved", {color: c.ink, size: 12, anchor: "middle"});
      // right: chi-square with 1 df
      var gx0 = 276, gx1 = 390, gB = 236, gT = 72, XM = 10, top = 0.3;   // the spike at 0 runs off the top
      var GX = function (x) { return gx0 + (gx1 - gx0) * Math.min(x, XM) / XM; };
      var pdf = function (x) { return Math.exp(-x / 2) / Math.sqrt(2 * Math.PI * x); };
      var GY = function (d) { return gB - (gB - gT) * Math.min(d, top) / top; };
      api.label([gx1, 14], "χ² with 1 df", {color: c.muted, size: 12.5, weight: 600, anchor: "end"});
      api.label([gx1, 31], pText(k.p), {color: c.c5, size: 12.5, weight: 650, anchor: "end"});
      var pts = [];
      for (var q = 0.02; q <= XM + 1e-9; q += 0.05) pts.push([GX(q), GY(pdf(q))]);
      var xs2 = Math.min(k.chi, XM);
      if (k.chi < XM) {
        var tail = [[GX(xs2), gB], [GX(xs2), GY(pdf(Math.max(xs2, 0.02)))]];
        pts.forEach(function (pt) { if (pt[0] > GX(xs2)) tail.push(pt); });
        tail.push([GX(XM), gB]);
        api.polygon(tail, {fill: c.c5, fillOpacity: 0.55});
      }
      api.polyline(pts.filter(function (pt) { return pt[1] > gT + 0.5; }), {stroke: c.muted, width: 2});
      api.line([gx0, gB], [gx1, gB], {color: c.axis, width: 1.2});
      [0, 2, 4, 6, 8, 10].forEach(function (t) { api.label([GX(t), gB + 13], String(t), {color: c.muted, size: 12, anchor: "middle"}); });
      api.line([GX(3.8415), gB], [GX(3.8415), gT], {color: c.muted, width: 1.2, dash: "4 3"});
      var cl = k.chi > 3.8415 && k.chi < 6;   // keep the label off the statistic's line
      api.label([GX(3.8415) + (cl ? -4 : 4), gT + 6], "5%", {color: c.muted, size: 12, anchor: cl ? "end" : "start"});
      api.line([GX(xs2), gB], [GX(xs2), gT - 6], {color: c.c3, width: 2.2});
      var right = xs2 > 5;
      api.label([GX(xs2) + (right ? -6 : 6), gT - 15], "χ² = " + Viz.fmt(k.chi, 2) + (k.chi > XM ? " →" : ""), {color: c.c3, size: 12.5, weight: 650, anchor: right ? "end" : "start"});
    }
  });
})();
