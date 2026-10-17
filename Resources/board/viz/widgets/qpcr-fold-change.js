// Relative qPCR by the delta-delta Ct method: four amplification curves (target and reference gene, in control and
// treated samples), the threshold where each Ct is read, and the fold change 2^(-ddCt) on a log2 bar.
// Curves are logistic with a doubling every cycle in the early phase: F = 1 / (1 + 2^-(cycle - Ct - 2)), so every
// curve crosses the threshold (20% of the plateau) exactly at its Ct and one cycle earlier means twice the template.
(function () {
  function F(cyc, ct) { return 1 / (1 + Math.pow(2, -(cyc - ct - 2))); }
  var SUP = {"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻"};
  function sup(k) { return String(k).split("").map(function (ch) { return SUP[ch] || ch; }).join(""); }
  function dd(v) { return (v.tt - v.rt) - (v.tc - v.rc); }
  function foldParts(x) { // [mantissa, exponent or null]
    if (x >= 1e4 || x < 1e-3) { var e = Math.floor(Math.log10(x)); return [Viz.n(x / Math.pow(10, e), 1), e]; }
    return [x >= 100 ? String(Math.round(x)) : x >= 10 ? Viz.n(x, 1) : Viz.n(x, x >= 1 ? 2 : 3), null];
  }
  function foldText(x) { var p = foldParts(x); return p[1] === null ? p[0] : p[0] + " × 10" + sup(p[1]); }
  function foldTex(x) { var p = foldParts(x); return p[1] === null ? p[0] : p[0] + "\\times10^{" + p[1] + "}"; }

  Viz.register("qpcr-fold-change", {
    title: "qPCR: ΔΔCt to fold change",
    subject: "biology",
    shows: "Slide the four Ct values: normalize the target to the reference gene, compare treated with control, and every cycle of difference is a factor of two",
    params: {
      tc: {kind: "number", default: 26, min: 12, max: 36, step: 0.1, label: "\\text{tgt}_{\\text{ctl}}"},
      tt: {kind: "number", default: 24, min: 12, max: 36, step: 0.1, label: "\\text{tgt}_{\\text{trt}}"},
      rc: {kind: "number", default: 18, min: 12, max: 36, step: 0.1, label: "\\text{ref}_{\\text{ctl}}"},
      rt: {kind: "number", default: 18, min: 12, max: 36, step: 0.1, label: "\\text{ref}_{\\text{trt}}"}
    },
    formula: function (v) {
      var d = dd(v);
      // two lines, and no break between an equals sign and its result
      return "\\Delta\\Delta C_t={(" + Viz.n(v.tt, 1) + "-" + Viz.n(v.rt, 1) + ")}-{(" + Viz.n(v.tc, 1) + "-" + Viz.n(v.rc, 1) + ")}=\\nobreak " + Viz.n(d, 1) +
        "\\newline 2^{-\\Delta\\Delta C_t}=\\nobreak " + foldTex(Math.pow(2, -d));
    },
    status: function (v) {
      var d = dd(v), fold = Math.pow(2, -d);
      if (Math.abs(d) < 0.05) return "ΔΔCt ≈ 0: once both samples are normalized to the reference gene, treatment leaves the target unchanged (<b>1×</b>).";
      if (d < 0) return "Normalized to the reference, the target crosses the threshold <b>" + Viz.fmt(-d, 1) + "</b> cycles earlier after treatment, so it started with <b>" + foldText(fold) + "×</b> as much cDNA: up-regulated.";
      return "Normalized to the reference, the target crosses <b>" + Viz.fmt(d, 1) + "</b> cycles later after treatment, so it is at <b>" + foldText(fold) + "×</b> the control level: down-regulated " + foldText(1 / fold) + "-fold.";
    },
    examples: [
      {name: "four-fold up", values: {tc: 26, tt: 24, rc: 18, rt: 18}},
      {name: "down, with uneven loading", values: {tc: 22, tt: 25.5, rc: 17, rt: 17.5}},
      {name: "no change after normalizing", values: {tc: 25, tt: 26, rc: 18, rt: 19}},
      {name: "extremes", values: {tc: 12, tt: 36, rc: 36, rt: 12}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, x0 = 40, x1 = 288, yT = 30, yB = 236;
      var X = function (cy) { return x0 + cy / 40 * (x1 - x0); }, Y = function (f) { return yB - f / 1.05 * (yB - yT); };
      api.line([x0, yB], [x1 + 4, yB], {color: c.axis, width: 1.2});
      api.line([x0, yB], [x0, yT - 6], {color: c.axis, width: 1.2});
      [0, 10, 20, 30, 40].forEach(function (t) { api.line([X(t), yB], [X(t), yB + 3], {color: c.axis, width: 1.2}); api.label([X(t), yB + 13], String(t), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([(x0 + x1) / 2, yB + 28], "cycle", {color: c.muted, size: 12, anchor: "middle"});
      api.label([x0 + 6, yT - 14], "fluorescence", {color: c.muted, size: 12});
      var yt = Y(0.2);
      api.line([x0, yt], [x1, yt], {color: c.c3, width: 1.5, dash: "5 4"});

      var curves = [{ct: v.rc, col: c.c6}, {ct: v.rt, col: c.c6, dash: "6 4"}, {ct: v.tc, col: c.c1}, {ct: v.tt, col: c.c1, dash: "6 4"}];
      curves.forEach(function (k) {
        var pts = []; for (var cy = 0; cy <= 40.001; cy += 0.25) pts.push([X(cy), Y(F(cy, k.ct))]);
        api.polyline(pts, {stroke: k.col, width: 2.2, dash: k.dash || null});
      });
      curves.forEach(function (k) { api.point([X(k.ct), yt], {color: k.col, r: 3.6}); });
      // a label on a card-colored backing so curves behind it do not cut through the text
      function tag(at, txt, col, anchor) {
        var w = txt.length * 6.9 + 6, x = Math.max(x0 + 2, Math.min(x1 - w, anchor === "end" ? at[0] - w + 3 : anchor === "start" ? at[0] : at[0] - w / 2));
        api.rect(x, at[1] - 8, w, 16, {fill: c.card, fillOpacity: 0.88, rx: 4});
        api.label([x + w / 2, at[1]], txt, {color: col, size: 12, anchor: "middle"});
      }
      // delta Ct in each sample: reference to target along the threshold
      function bracket(a, b, y, dash, txt, below) {
        if (Math.abs(X(b) - X(a)) > 8) api.line([X(a), y], [X(b), y], {color: c.ink, width: 1.4, dash: dash, arrow: true, arrowStart: true});
        tag([(X(a) + X(b)) / 2, y + (below ? 12 : -11)], txt, c.ink);
      }
      bracket(v.rc, v.tc, yt - 17, null, "ΔCt ctl " + api.fmt(v.tc - v.rc, 1), false);
      bracket(v.rt, v.tt, yt + 16, "4 3", "ΔCt trt " + api.fmt(v.tt - v.rt, 1), true);
      // at the left end: no bracket reaches there (Ct >= 12 puts every arrowhead right of x = 114)
      tag([x0 + 4, yt - 10], "threshold", c.c3, "start");
      // legend row: color = gene, line style = sample
      var ly = 280;
      api.label([x0, ly], "target", {color: c.c1, size: 12, weight: 650});
      api.label([x0 + 48, ly], "reference", {color: c.c6, size: 12, weight: 650});
      api.line([x0 + 124, ly], [x0 + 142, ly], {color: c.muted, width: 2});
      api.label([x0 + 147, ly], "control", {color: c.muted, size: 12});
      api.line([x0 + 200, ly], [x0 + 218, ly], {color: c.muted, width: 2, dash: "5 3"});
      api.label([x0 + 223, ly], "treated", {color: c.muted, size: 12});
      // fold change on a log2 axis
      var d = dd(v), L = Math.max(3, Math.ceil(Math.abs(d))), top = 50, bot = 236, mid = (top + bot) / 2, ax = 338;   // top leaves room for the value label under the title
      var FY = function (k) { return mid - k / L * (bot - top) / 2; };
      api.label([362, 18], "fold change", {color: c.muted, size: 12, anchor: "middle"});
      api.line([ax, top - 4], [ax, bot + 4], {color: c.axis, width: 1.2});
      var ts = L <= 4 ? 1 : L <= 8 ? 2 : Math.ceil(L / 4);
      for (var k = -Math.floor(L / ts) * ts; k <= L + 1e-9; k += ts) {
        var txt = k === 0 ? "1×" : k > 0 && k <= 10 ? Math.pow(2, k) + "×" : k < 0 && k >= -10 ? "1/" + Math.pow(2, -k) : "2" + sup(k);
        api.line([ax - 3, FY(k)], [ax, FY(k)], {color: c.axis, width: 1.2});
        api.label([ax - 6, FY(k)], txt, {color: c.muted, size: 12, anchor: "end"});
      }
      api.line([ax, FY(0)], [392, FY(0)], {color: c.faint, width: 1});
      var yEnd = FY(-d), up = d < 0;
      if (Math.abs(yEnd - FY(0)) > 1) api.rect(350, Math.min(yEnd, FY(0)), 26, Math.abs(yEnd - FY(0)), {fill: c.c1, fillOpacity: 0.85, rx: 3});
      else api.line([350, FY(0)], [376, FY(0)], {color: c.c1, width: 3});
      api.label([363, yEnd + (up ? -11 : 12)], foldText(Math.pow(2, -d)) + "×", {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      // viz.css paints every svg label ink (it overrides the fill attribute); keep each label's own color
      api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
