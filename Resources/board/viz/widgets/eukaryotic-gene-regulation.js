// Eukaryotic genes are controlled at several levels, and the levels multiply. A steady-state model of one gene:
//   mRNA per cell     m* = k_m * t_m / ln 2      (made at k_m per hour, half-life t_m)
//   protein per cell  p* = k_p * m* * t_p / ln 2  (k_p proteins per mRNA per hour, half-life t_p)
// Half-lives use the medians measured across mouse fibroblast genes (mRNA 9 h, protein 46 h; Schwanhausser et al. 2011,
// Nature 473:337). The other values are illustrative round numbers, stated as such: k_m is 0.05/h from closed, condensed
// chromatin, 0.5/h basal from open chromatin, 10/h with an activator bound (a 20-fold boost); k_p = 100/h; a bound miRNA
// halves the mRNA half-life (most targets drop less than 2-fold); a ubiquitin degron cuts the protein half-life to 1 h.
(function () {
  var LN2 = Math.LN2, KP = 100;
  function model(v) {
    var open = v.chrom === "open", km = !open ? 0.05 : v.act ? 10 : 0.5;
    var tm = v.mirna ? 4.5 : 9, tp = v.degron ? 1 : 46;
    var m = km * tm / LN2, p = KP * m * tp / LN2;
    return {open: open, km: km, tm: tm, tp: tp, m: m, p: p};
  }
  function sig(x) {                                  // 2 significant figures, as text with thousands commas
    if (x >= 100) return Math.round(Number(x.toPrecision(2))).toLocaleString("en-US");
    return String(Number(x.toPrecision(2)));
  }
  function tex(x) {
    if (x >= 1e5) { var e = Math.floor(Math.log10(x)); return Number((x / Math.pow(10, e)).toFixed(1)) + "\\times10^{" + e + "}"; }
    return sig(x).replace(/,/g, "{,}");
  }

  Viz.register("eukaryotic-gene-regulation", {
    title: "Eukaryotic gene regulation: control at every level",
    subject: "biology",
    shows: "Open or close the chromatin, bind an activator, add a microRNA or a degradation tag: each control point multiplies into how much mRNA and protein the cell ends up with",
    params: {
      chrom: {kind: "enum", values: ["open", "closed"], default: "open", label: "\\text{DNA}", names: {open: "open chromatin", closed: "condensed"}},
      act: {kind: "boolean", default: true, label: "\\text{activator}", on: "bound", off: "absent"},
      mirna: {kind: "boolean", default: false, label: "\\text{miRNA}", on: "present", off: "absent"},
      degron: {kind: "boolean", default: false, label: "\\text{protein}", on: "ubiquitin-tagged", off: "stable"}
    },
    formula: function (v) {
      var m = model(v);
      return "\\begin{array}{rl}m^*\\!\\!&=\\dfrac{k_m t_m}{\\ln 2}=\\dfrac{" + Viz.n(m.km, 2) + "\\cdot " + m.tm + "}{0.693}=" + tex(m.m) +
        "\\\\[8pt] p^*\\!\\!&=\\dfrac{k_p m^* t_p}{\\ln 2}\\\\[8pt] &=\\dfrac{100\\cdot " + tex(m.m) + "\\cdot " + m.tp + "}{0.693}=" + tex(m.p) + "\\end{array}";
    },
    status: function (v) {
      var m = model(v);
      var why = !m.open ? "Condensed chromatin hides the gene, so even " + (v.act ? "a bound activator" : "basal machinery") + " manages only 0.05 mRNA an hour"
        : v.act ? "Open chromatin with the activator bound makes 10 mRNAs an hour" : "Open chromatin without its activator makes a basal 0.5 mRNA an hour";
      return why + ", which with a " + m.tm + " h mRNA and a " + m.tp + " h protein half-life settles at about <b>" + sig(m.m) + "</b> mRNA" + (m.m === 1 ? "" : "s") + " and <b>" + sig(m.p) + "</b> proteins per cell.";
    },
    examples: [
      {name: "fully on", values: {chrom: "open", act: true, mirna: false, degron: false}},
      {name: "silenced chromatin", values: {chrom: "closed", act: true}},
      {name: "every brake on", values: {chrom: "closed", act: false, mirna: true, degron: true}},
      {name: "post-transcriptional brakes only", values: {mirna: true, degron: true}}
    ],
    size: [400, 330],
    draw: function (api, v) {
      var c = api.color, m = model(v);
      // ---- nucleus: chromatin, activator, Pol II ----
      api.rect(6, 22, 180, 176, {rx: 34, fill: c.ink, fillOpacity: 0.035, stroke: c.faint, width: 1.3});
      api.label([24, 38], "nucleus", {color: c.muted, size: 12});
      api.label([96, 62], m.open ? "open: acetylated" : "closed: condensed", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      var yD = 134;
      if (m.open) {
        api.line([16, yD], [176, yD], {color: c.muted, width: 2.5});
        [30, 56].forEach(function (x) { api.circle([x, yD], 10, {fill: c.muted, fillOpacity: 0.35, stroke: c.muted, width: 1.2}); api.label([x, yD - 20], "Ac", {color: c.ink, size: 12, weight: 650, anchor: "middle"}); });
        api.rect(108, yD - 4, 64, 8, {rx: 3, fill: c.c5, fillOpacity: 0.55});                       // the exposed gene
        api.label([140, yD + 18], "gene", {color: c.c5, size: 12, anchor: "middle"});
        api.rect(80, yD + 6, 26, 18, {rx: 9, fill: c.c2, fillOpacity: 0.35, stroke: c.c2, width: 1.3});
        api.label([93, yD + 15], "II", {color: c.c2, size: 12, weight: 700, anchor: "middle"});
        if (v.act) { api.rect(78, yD - 22, 24, 16, {rx: 8, fill: c.c3, fillOpacity: 0.55, stroke: c.c3, width: 1.3}); api.label([90, yD - 36], "activator", {color: c.c3, size: 12, weight: 650, anchor: "middle"}); }
      } else {
        for (var x = 24; x <= 166; x += 23.6) api.circle([x, yD], 11, {fill: c.muted, fillOpacity: 0.4, stroke: c.muted, width: 1.2});
        [24, 71, 118, 166].forEach(function (x) { api.label([x, yD - 20], "Me", {color: c.muted, size: 12, weight: 650, anchor: "middle"}); });
        if (v.act) { api.rect(126, 86, 24, 16, {rx: 8, fill: c.c3, fillOpacity: 0.25, stroke: c.c3, width: 1.3, dash: "3 3"}); api.label([118, 94], "activator can't bind", {color: c.c3, size: 12, anchor: "end"}); }
      }
      api.label([96, 182], "k_m = " + api.fmt(m.km, 2) + " mRNA/h", {color: c.c5, size: 12, weight: 700, anchor: "middle"});
      api.arrow([178, 104], [204, 78], {color: c.c5, width: 2, halo: false, head: 7});
      // ---- cytoplasm: mRNA (+ miRNA), ribosome, protein (+ degradation) ----
      api.label([392, 24], "cytoplasm", {color: c.muted, size: 12, anchor: "end"});
      var yM = 72, x0 = 210, x1 = 352;
      api.circle([x0, yM], 4.5, {fill: c.c5});
      api.line([x0, yM], [x1, yM], {color: c.c5, width: 3});
      api.line([x1 + 2, yM], [384, yM], {color: c.c5, width: 3, dash: "2 3"});
      api.label([368, yM - 13], "AAA", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      api.label([x0 - 4, 42], "mRNA, t½ = " + m.tm + " h", {color: c.c5, size: 12, weight: 650});
      if (v.mirna) {
        api.line([316, yM + 6], [346, yM + 6], {color: c.c6, width: 3});
        api.rect(312, yM + 9, 38, 15, {rx: 7, fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 1.2});
        api.label([392, yM + 40], "miRNA: faster decay", {color: c.c6, size: 12, weight: 650, anchor: "end"});
      }
      var rx = 244;
      api.circle([rx, yM - 3], 12, {fill: c.c1, fillOpacity: 0.3, stroke: c.c1, width: 1.4});
      api.circle([rx, yM + 12], 9, {fill: c.c1, fillOpacity: 0.3, stroke: c.c1, width: 1.4});
      api.label([rx + 18, yM + 18], "ribosome", {color: c.c1, size: 12});
      api.path("M " + rx + " " + (yM + 21) + " q 8 10 0 18 q -8 9 0 18 q 8 9 0 16", {stroke: c.c4, width: 2.5});
      var py = 152;
      api.circle([rx, py], 11, {fill: c.c4, fillOpacity: 0.45, stroke: c.c4, width: 1.4});
      api.label([rx, py + 22], "protein", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
      api.label([rx, py + 38], "t½ = " + m.tp + " h", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
      if (v.degron) {
        [0, 1, 2].forEach(function (k) { api.circle([rx + 16 + k * 10, py - 9 - k * 4], 4.5, {fill: c.ink, fillOpacity: 0.7}); });
        api.label([rx + 44, py - 26], "ubiquitin", {color: c.ink, size: 12});
        api.rect(334, py - 16, 34, 32, {rx: 7, fill: c.muted, fillOpacity: 0.25, stroke: c.muted, width: 1.4});
        api.line([334, py - 5], [368, py - 5], {color: c.muted, width: 1}); api.line([334, py + 5], [368, py + 5], {color: c.muted, width: 1});
        api.arrow([rx + 16, py + 4], [330, py + 4], {color: c.muted, width: 1.8, halo: false, head: 7});
        api.label([351, py + 30], "proteasome", {color: c.muted, size: 12, anchor: "middle"});
      }
      // ---- steady state: mRNA and protein per cell, log scales ----
      var bar = function (y, val, lo, hi, col, name) {
        var a0 = 108, a1 = 384, X = function (q) { return a0 + (a1 - a0) * (Math.log10(q) - lo) / (hi - lo); };
        api.label([10, y], name, {color: col, size: 12, weight: 650});
        api.rect(a0, y - 7, a1 - a0, 14, {rx: 4, fill: c.ink, fillOpacity: 0.05});
        api.rect(a0, y - 7, Math.max(2, X(Math.max(val, Math.pow(10, lo))) - a0), 14, {rx: 4, fill: col, fillOpacity: 0.75});
        for (var e = lo; e <= hi; e++) api.label([X(Math.pow(10, e)), y + 18], "10" + String(e).replace(/-/g, "⁻").replace(/\d/g, function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]; }), {color: c.muted, size: 12, anchor: "middle", raw: true});
        api.label([Math.min(X(Math.max(val, Math.pow(10, lo))) + 6, a1 - 4), y - 15], "≈ " + sig(val), {color: col, size: 12.5, weight: 700, anchor: X(val) > a1 - 60 ? "end" : "start", raw: true});
      };
      api.label([10, 218], "steady state per cell (log scale)", {color: c.muted, size: 12});
      bar(254, m.m, -1, 3, c.c5, "mRNA");
      bar(302, m.p, 1, 6, c.c4, "protein");
      api.root.querySelectorAll("text").forEach(function (el) { var col = el.getAttribute("fill"); if (col) el.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
