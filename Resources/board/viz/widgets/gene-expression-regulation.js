// Gene expression is controlled at several stages, and the stages multiply. The standard two-stage model: mRNA is made
// at k_tx and decays at δm = ln2 / t_m; protein is made at k_tl per mRNA and decays at δp = ln2 / t_p. At steady state
// m* = k_tx / δm and p* = k_tl m* / δp. Illustrative rates, stated: closed chromatin (promoter wrapped in nucleosomes)
// lets through 0.05 transcripts per hour; open chromatin gives a basal 1 per hour, and a bound activator 10 per hour;
// each mRNA is translated 20 times an hour. Half-lives span real ranges: minutes to a day for mRNA, hours to days for
// protein (a bound activator cannot help while the chromatin is closed in this model).
(function () {
  var KTL = 20;
  function model(v) {
    var ktx = v.chromatin === "closed" ? 0.05 : v.activator ? 10 : 1;
    // the decay rates are shown to 4 significant figures and each steady state is computed from the numbers as shown,
    // so the formula's arithmetic checks digit for digit (the change from the exact value is under 0.1%)
    var dm = r4(Math.LN2 / v.tm), dp = r4(Math.LN2 / v.tp), m = r4(ktx / dm), p = r4(KTL * m / dp);
    return {ktx: ktx, dm: dm, dp: dp, m: m, p: p};
  }
  function r4(x) { return Number(x.toPrecision(4)); }
  function sig(x) { return x >= 1000 ? Math.round(x).toLocaleString("en-US") : String(x); }
  function tex(x) { return sig(x).replace(/,/g, "{,}"); }

  Viz.register("gene-expression-regulation", {
    title: "Gene expression: control at every stage",
    subject: "biology",
    shows: "Open or close the chromatin, add an activator and change the mRNA and protein half-lives: each stage multiplies how much protein the cell holds",
    params: {
      chromatin: {kind: "enum", values: ["open", "closed"], names: {open: "open chromatin", closed: "closed chromatin"}, default: "open", label: "\\text{DNA}"},
      activator: {kind: "boolean", default: true, label: "\\text{activator}", on: "bound", off: "absent"},
      tm: {kind: "number", default: 2, min: 0.5, max: 12, step: 0.5, label: "t_m\\,(\\text{h})"},
      tp: {kind: "number", default: 10, min: 1, max: 48, step: 1, label: "t_p\\,(\\text{h})"}
    },
    formula: function (v) {
      var m = model(v);
      return "\\begin{array}{l}m^*=\\frac{k_{tx}}{\\ln 2/t_m}=\\frac{" + tex(m.ktx) + "}{" + m.dm + "}=" + tex(m.m) +
        "\\\\ p^*=\\frac{k_{tl}\\,m^*}{\\ln 2/t_p}=\\frac{20\\cdot " + tex(m.m) + "}{" + m.dp + "}=" + tex(m.p) + "\\end{array}";
    },
    status: function (v) {
      var m = model(v), tail = "the cell settles at <b>" + sig(m.m) + "</b> mRNA" + (m.m === 1 ? "" : "s") + " and <b>" + sig(m.p) + "</b> proteins on average.";
      if (v.chromatin === "closed") return "Closed chromatin wraps the promoter in nucleosomes, so even " + (v.activator ? "a waiting activator" : "basal machinery") + " gets only 0.05 transcripts an hour through: " + tail;
      if (!v.activator) return "Open chromatin but no activator: basal transcription of 1 mRNA an hour, so " + tail;
      return "Open chromatin and a bound activator give 10 transcripts an hour; with half-lives of " + Viz.fmt(v.tm) + " h and " + Viz.fmt(v.tp) + " h " + tail;
    },
    examples: [
      {name: "silenced: closed chromatin", values: {chromatin: "closed", activator: true}},
      {name: "basal, no activator", values: {chromatin: "open", activator: false}},
      {name: "everything at its lowest", values: {chromatin: "closed", activator: false, tm: 0.5, tp: 1}},
      {name: "everything at its highest", values: {chromatin: "open", activator: true, tm: 12, tp: 48}}
    ],
    size: [400, 312],
    draw: function (api, v) {
      var c = api.color, m = model(v), closed = v.chromatin === "closed", y = 96;
      // ---- the nucleus: chromatin, activator, RNA polymerase ----
      api.rect(4, 14, 172, 154, {fill: c.ink, fillOpacity: 0.03, stroke: c.faint, width: 1.2, rx: 18});
      api.label([16, 28], "nucleus", {color: c.muted, size: 12});
      api.line([8, y], [172, y], {color: c.muted, width: 3});
      api.rect(14, y - 7, 30, 14, {fill: c.c4, fillOpacity: 0.15, stroke: c.c4, width: 1.1, rx: 3});
      api.rect(60, y - 7, 30, 14, {fill: c.c2, fillOpacity: 0.15, stroke: c.c2, width: 1.1, rx: 3});
      api.rect(96, y - 8, 70, 16, {fill: c.ink, fillOpacity: 0.08, stroke: c.faint, width: 1.1, rx: 3});
      api.label([14, y + 17], "enhancer", {color: c.c4, size: 12, anchor: "start"});
      api.label([75, y + 34], "promoter", {color: c.c2, size: 12, anchor: "middle"});
      api.label([131, y + 17], "gene", {color: c.ink, size: 12, anchor: "middle"});
      var nucs = closed ? [20, 36, 52, 68, 84, 100, 116, 132, 148, 164] : [114, 148];
      nucs.forEach(function (x) { api.circle([x, y], 8, {fill: c.c6, fillOpacity: closed ? 0.8 : 0.45, stroke: c.c6, width: 1}); });
      api.label([90, 148], closed ? "closed: nucleosomes cover it" : "open: promoter uncovered", {color: c.c6, size: 12, anchor: "middle", clamp: false});   // fits: about 154 wide
      var pol = function (x, py, op) { api.path("M " + (x - 13) + " " + py + " a 13 10 0 1 0 26 0 a 13 10 0 1 0 -26 0", {fill: c.c2, fillOpacity: op, stroke: c.c2, width: 1}); };
      if (closed) {
        pol(120, 54, 0.3);
        if (v.activator) api.circle([86, 54], 8, {fill: c.c4, fillOpacity: 0.35, stroke: c.c4, width: 1.2});
        api.label([103, 74], "shut out", {color: c.muted, size: 12, anchor: "middle"});
      } else {
        pol(75, y, v.activator ? 0.9 : 0.55);
        if (v.activator) {                                                 // bound: sitting on the enhancer, looping to the polymerase
          api.circle([29, y - 15], 8, {fill: c.c4, fillOpacity: 0.9});
          api.path("M 37 " + (y - 18) + " Q 54 " + (y - 32) + " 68 " + (y - 10), {stroke: c.c4, width: 1.6, dash: "3 3"});
          api.label([14, y - 36], "activator", {color: c.c4, size: 12});
        }
      }
      // ---- the cytoplasm: transcription, translation, decay ----
      var on = m.m >= 0.5, my = 96;
      api.arrow([181, my], [213, my], {color: c.c2, width: 2, halo: false, head: 8});
      api.label([199, my - 14], m.ktx + "/h", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      var wav = []; for (var x = 218; x <= 270; x += 2) wav.push([x, my + 2.4 * Math.sin((x - 218) / 3)]);
      api.polyline(wav, {stroke: c.c1, width: 2.4, opacity: on ? 1 : 0.4});
      api.path("M 248 " + (my - 6) + " a 9 7 0 1 0 18 0 a 9 7 0 1 0 -18 0", {fill: c.ink, fillOpacity: 0.25, stroke: c.muted, width: 1});
      api.label([244, my - 26], "mRNA", {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      api.arrow([278, my], [314, my], {color: c.c3, width: 2, halo: false, head: 8});
      api.label([296, my - 14], "20/h", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      // a fixed cluster stands for the protein; how much there is lives on the log bars below
      [[332, 90], [348, 100], [364, 86], [380, 98], [340, 108], [372, 112]].forEach(function (p) { api.circle(p, 4.5, {fill: c.c3}); });
      api.label([356, my - 26], "protein", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.line([244, my + 10], [244, my + 32], {color: c.c1, width: 1.4, dash: "3 3", arrow: true, opacity: 0.8});
      api.label([244, my + 46], "half-life " + api.fmt(v.tm) + " h", {color: c.c1, size: 12, anchor: "middle"});
      api.line([356, my + 22], [356, my + 34], {color: c.c3, width: 1.4, dash: "3 3", arrow: true, opacity: 0.8});
      api.label([356, my + 46], "half-life " + api.fmt(v.tp) + " h", {color: c.c3, size: 12, anchor: "middle"});
      // ---- steady-state amounts on one log axis (0.01 to a million per cell) ----
      var x0 = 82, x1 = 380, lx = function (q) { return x0 + (Math.log10(Math.max(q, 0.01)) + 2) / 8 * (x1 - x0); };
      api.label([12, 186], "at steady state, per cell (log scale)", {color: c.muted, size: 12});
      [[m.m, "mRNA", c.c1, 210], [m.p, "protein", c.c3, 244]].forEach(function (b) {
        api.label([12, b[3]], b[1], {color: b[2], size: 12.5, weight: 650});
        api.rect(x0, b[3] - 8, x1 - x0, 16, {fill: c.ink, fillOpacity: 0.05, rx: 4});
        api.rect(x0, b[3] - 8, Math.max(3, lx(b[0]) - x0), 16, {fill: b[2], fillOpacity: 0.85, rx: 4});
        var inside = lx(b[0]) - x0 > 90;
        api.label([inside ? lx(b[0]) - 6 : lx(b[0]) + 6, b[3]], sig(b[0]), {color: inside ? c.card : b[2], size: 12.5, weight: 700, anchor: inside ? "end" : "start"});
      });
      [[0.01, "0.01"], [1, "1"], [100, "100"], [1e4, "10⁴"], [1e6, "10⁶"]].forEach(function (t) {
        api.line([lx(t[0]), 256], [lx(t[0]), 262], {color: c.axis, width: 1.2});
        api.label([lx(t[0]), 274], t[1], {color: c.muted, size: 12, anchor: "middle"});
      });
      api.label([200, 300], "each stage multiplies: rate × half-life at both steps", {color: c.muted, size: 12, anchor: "middle"});
      // viz.css paints svg text ink over the fill attribute; restate each label's color inline
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
