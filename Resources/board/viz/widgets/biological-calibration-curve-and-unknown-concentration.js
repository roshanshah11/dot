// A protein standard curve (BCA-style assay read at 562 nm). Seven BSA standards of known concentration give a
// least-squares line A = m c + b, fitted here in code. An unknown's absorbance is read across to the line and down
// to a concentration, c = (A − b) / m, which is the concentration in the cuvette; multiplying by the dilution factor
// gives the original sample. Readings above the top standard are extrapolation (dashed: the line was never tested
// there and real assays curve off), and readings below the blank mean nothing is detectable at that dilution.
// Dot's design: the queue gives no parameters; the unknown's absorbance and the dilution factor drive the idea.
(function () {
  var STD_C = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0];                  // mg/mL
  var STD_A = [0.095, 0.205, 0.318, 0.420, 0.540, 0.752, 0.975];    // absorbance, with a little real-looking scatter
  var FIT = (function () {
    var n = STD_C.length, mx = 0, my = 0, sxy = 0, sxx = 0, ss = 0, sr = 0;
    STD_C.forEach(function (x, i) { mx += x / n; my += STD_A[i] / n; });
    STD_C.forEach(function (x, i) { sxy += (x - mx) * (STD_A[i] - my); sxx += (x - mx) * (x - mx); });
    var m = sxy / sxx, b = my - m * mx;
    STD_C.forEach(function (x, i) { sr += Math.pow(STD_A[i] - (m * x + b), 2); ss += Math.pow(STD_A[i] - my, 2); });
    return {m: m, b: b, r2: 1 - sr / ss, top: STD_C[n - 1]};
  })();
  function calc(v) {
    var c = (v.absU - FIT.b) / FIT.m;
    return {c: c, sample: c * v.dil, below: c < 0, above: c > FIT.top + 1e-9};
  }

  Viz.register("biological-calibration-curve-and-unknown-concentration", {
    title: "Standard curve: reading an unknown",
    subject: "stats",
    shows: "Slide the unknown's absorbance: read across to the standard line and down to its concentration, then multiply back by the dilution",
    params: {
      absU: {kind: "number", default: 0.62, min: 0.05, max: 1.3, step: 0.01, label: "A_{\\text{unknown}}"},
      dil: {kind: "integer", default: 2, min: 1, max: 10, label: "\\text{dilution}\\ d"}
    },
    formula: function (v) {
      var k = calc(v), m = Viz.n(FIT.m, 3), b = Viz.n(FIT.b, 3);
      var last = k.below ? "c<0:\\ \\text{not detectable}" : k.above ? "c>" + FIT.top + ":\\ \\text{dilute and re-run}" : "c_{\\text{sample}}=d\\,c=" + v.dil + "\\times" + Viz.n(k.c, 3) + "=" + Viz.n(k.sample, v.dil > 1 ? 2 : 3);
      return "\\begin{array}{l}\\text{fit: }A=" + m + "\\,c+" + b + "\\\\[4pt]c=\\tfrac{A-b}{m}=\\tfrac{" + Viz.n(v.absU, 2) + "-" + b + "}{" + m + "}=" + Viz.n(k.c, 3) +
        "\\\\[4pt]" + last + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.below) return "That absorbance is below the blank's, so no protein is detectable at this dilution: " +
        (v.dil > 1 ? "<b>measure it less diluted</b>." : "<b>use a more sensitive assay</b>.");
      if (k.above) return "<b>Outside the standards</b> (above " + FIT.top + " mg/mL): the line was never tested there and real assays bend, so dilute further and measure again.";
      return "The unknown reads <b>" + Viz.fmt(k.c, 3) + " mg/mL</b> in the cuvette, inside the standards, so " +
        (v.dil > 1 ? "the sample, diluted " + v.dil + "-fold, held <b>" + Viz.fmt(k.sample, 2) + " mg/mL</b>." : "the undiluted sample is <b>" + Viz.fmt(k.sample, 3) + " mg/mL</b>.");
    },
    examples: [
      {name: "undiluted, low reading", values: {absU: 0.25, dil: 1}},
      {name: "above the top standard", values: {absU: 1.2, dil: 2}},
      {name: "below the blank", values: {absU: 0.05, dil: 10}},
      {name: "ten-fold dilution", values: {absU: 0.48, dil: 10}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), xr = [0, 3], yr = [0, 1.4];
      var pl = api.plane({x: xr, y: yr, box: [50, 34, 330, 186], equal: false, grid: false, axes: false});
      var bad = k.above || k.below, uc = bad ? c.c5 : c.c3;
      // the range the standards cover
      api.rect(pl.x(0), pl.y(yr[1]), pl.x(FIT.top) - pl.x(0), pl.y(0) - pl.y(yr[1]), {fill: c.c2, fillOpacity: 0.05, rx: 0});
      for (var y = 0.2; y <= 1.4 + 1e-9; y += 0.2) {
        api.line([pl.x(0), pl.y(y)], [pl.x(3), pl.y(y)], {color: c.grid, width: 1});
        api.label([pl.x(0) - 7, pl.y(y)], api.fmt(y, 1), {color: c.muted, size: 12, anchor: "end"});
      }
      for (var x = 0; x <= 3 + 1e-9; x += 0.5) {
        api.line([pl.x(x), pl.y(0)], [pl.x(x), pl.y(0) + 4], {color: c.axis, width: 1});
        api.label([pl.x(x), pl.y(0) + 15], api.fmt(x, 1), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.line([pl.x(0), pl.y(0)], [pl.x(3) + 5, pl.y(0)], {color: c.axis, width: 1.3});
      api.line([pl.x(0), pl.y(0)], [pl.x(0), pl.y(yr[1]) - 4], {color: c.axis, width: 1.3});
      api.label([pl.x(3), pl.y(0) + 32], "protein in the cuvette (mg/mL)", {color: c.muted, size: 12, anchor: "end"});
      api.label([10, 14], "A at 562 nm", {color: c.muted, size: 12});
      // fitted line: solid over the standards, dashed beyond
      var f = function (cc) { return FIT.m * cc + FIT.b; }, xEnd = Math.min(3, (yr[1] - FIT.b) / FIT.m);
      api.line(pl.px([0, f(0)]), pl.px([FIT.top, f(FIT.top)]), {color: c.c2, width: 2.5});
      api.line(pl.px([FIT.top, f(FIT.top)]), pl.px([xEnd, f(xEnd)]), {color: c.c2, width: 2, dash: "6 5", opacity: 0.8});
      // "untested" always sits under the dashed part (the A label goes above the line), on whichever side of a red
      // drop line out there has room for it
      var ux = !k.above ? 2.45 : k.c > 2.6 ? 2.03 : k.c + 0.07;
      api.label(pl.px([ux, f(ux) - 0.13]), "untested", {color: c.c2, size: 12, anchor: "start"});
      STD_C.forEach(function (x, i) { api.circle(pl.px([x, STD_A[i]]), 4.5, {fill: c.c2, stroke: c.card, width: 1.5}); });
      api.circle([142, 14], 4.5, {fill: c.c2});
      api.label([151, 14], "standards and their fit, R² = " + api.fmt(FIT.r2, 4), {color: c.c2, size: 12, weight: 600});
      // the unknown: across to the line, then down
      var yA = pl.y(v.absU);
      if (k.below) {
        api.line([pl.x(0), yA], [pl.x(0.25), yA], {color: uc, width: 2, dash: "5 4"});
        api.point([pl.x(0), yA], {color: uc, r: 5});
        api.label([pl.x(0.3), yA], "below the blank (" + api.fmt(FIT.b, 3) + ")", {color: uc, size: 12, weight: 650});
      } else {
        var P = pl.px([k.c, v.absU]);
        api.line([pl.x(0), yA], P, {color: uc, width: 2, dash: "5 4"});
        api.line(P, [P[0], pl.y(0)], {color: uc, width: 2, dash: "5 4", arrow: true});
        api.point(P, {color: uc, r: 5.5});
        // labels sit where the plot is empty: above-left of P is above the line; right of P they go well under the
        // leader, because the line rises about 0.5 px per px to the right of P
        var aTxt = "A = " + api.fmt(v.absU, 2), cTxt = "c = " + api.fmt(k.c, 3), lab = {color: uc, size: 12.5, weight: 700};
        if (P[0] - pl.x(0) > 80) api.label([P[0] - 10, yA - 11], aTxt, Object.assign({anchor: "end"}, lab));
        else if (pl.y(0) - yA >= 46) api.label([P[0] + 10, yA + 15], aTxt, lab);
        else { api.label([P[0] + 12, pl.y(0) - 10], aTxt + ",  " + cTxt, lab); cTxt = null; }
        // near the right edge the c label would be pushed back onto the drop line, so it flips to the left of it
        if (cTxt) api.label([P[0] + (P[0] > api.w - 76 ? -6 : 6), pl.y(0) - 12], cTxt, Object.assign({anchor: P[0] > api.w - 76 ? "end" : "start"}, lab));
      }
      var line = k.below ? "not detectable at " + v.dil + "-fold dilution" : k.above ? "extrapolated: dilute and re-run" :
        api.fmt(k.c, 3) + " mg/mL × " + v.dil + " (dilution) = " + api.fmt(k.sample, v.dil > 1 ? 2 : 3) + " mg/mL in the sample";
      api.label([api.w / 2, 284], line, {color: uc, size: 13, weight: 700, anchor: "middle"});
    }
  });
})();
