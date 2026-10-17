// Promoter methylation silences a gene. DNMTs add a methyl group to the cytosine of CpG pairs (5-methylcytosine).
// Two things follow: a methyl group inside a transcription factor's site blocks the factor directly, and methyl-CpG
// binding (MBD) proteins such as MeCP2 sit on methylated sites and recruit histone deacetylases (HDACs); the histones
// lose their acetyl groups, the nucleosomes pack tight and RNA polymerase II cannot reach the start site.
// Schematic rules: CpGs 4 and 5 lie in the factor's site; methylation fills the island in a fixed order; chromatin
// packs as methyl-CpGs pass 2 and is closed by 5. Colors: amber = methyl groups, purple = MBD proteins, blue = HDACs,
// green = the transcription factor and acetyl marks, teal = RNA polymerase II and its transcripts.
(function () {
  var ORDER = [0, 7, 3, 1, 4, 6, 2, 5];   // the k-th site methylated; sites 3 and 4 form the factor's binding site
  function meth(v) { var on = []; for (var i = 0; i < 8; i++) on.push(ORDER.indexOf(i) < v.m); return on; }
  function state(v) { var on = meth(v); return v.m >= 5 ? 2 : (on[3] || on[4]) ? 1 : 0; }   // 0 on, 1 trickle, 2 silenced
  var WORD = ["on", "a trickle", "silenced"];
  Viz.register("dna-methylation-transcriptional-silencing", {
    title: "DNA methylation silences a gene",
    subject: "biology",
    shows: "Methylate more of the promoter's CpGs: methyl groups block the transcription factor, MBD proteins bring in histone deacetylases, the chromatin closes and transcription stops",
    params: {
      m: {kind: "integer", default: 5, min: 0, max: 8, label: "m"}
    },
    formula: function (v) {
      return "\\tfrac{m}{8} = \\tfrac{" + v.m + "}{8} = " + Viz.n(100 * v.m / 8, 0) + "\\%\\ \\Rightarrow\\ \\text{" + WORD[state(v)] + "}";
    },
    status: function (v) {
      var st = state(v);
      if (v.m === 0) return "Unmethylated CpG island: the transcription factor and RNA polymerase II bind the open promoter and the gene is <b>on</b>.";
      if (st === 0) return "<b>" + v.m + " of 8</b> CpGs methylated, all outside the factor's site: the promoter stays open and the gene stays <b>on</b>.";
      if (st === 1) return "A methyl group now sits in the factor's site and blocks it, and MBD proteins gather: transcription falls to <b>a trickle</b>.";
      return "<b>" + v.m + " of 8</b> methylated: MBD proteins recruit histone deacetylases, the nucleosomes pack tight and the gene is <b>silenced</b>.";
    },
    examples: [
      {name: "unmethylated: on", values: {m: 0}},
      {name: "factor's site blocked", values: {m: 3}},
      {name: "fully methylated", values: {m: 8}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, on = meth(v), st = state(v), yD = 112;
      var X = function (i) { return 34 + i * 24; };
      api.label([16, 14], "promoter CpG island", {color: c.muted, size: 12});
      // DNA
      api.line([16, yD - 3], [384, yD - 3], {color: c.ink, width: 2, opacity: 0.8});
      api.line([16, yD + 3], [384, yD + 3], {color: c.ink, width: 2, opacity: 0.8});
      // factor's site and the factor under the DNA
      api.rect(X(3) - 10, yD - 7, X(4) - X(3) + 20, 14, {stroke: c.c4, width: 1.4, dash: "3 2", rx: 4});
      if (st === 0) {
        api.rect(X(3) - 12, yD + 7, X(4) - X(3) + 24, 18, {fill: c.c4, fillOpacity: 0.85, rx: 9});
        api.label([(X(3) + X(4)) / 2, yD + 16], "TF", {color: c.card, size: 12, weight: 700, anchor: "middle"});
      } else api.label([(X(3) + X(4)) / 2, yD + 17], "TF blocked", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
      // CpG lollipops, methyl groups, MBD proteins, HDACs
      var hd = 0;
      for (var i = 0; i < 8; i++) {
        api.line([X(i), yD - 3], [X(i), yD - 22], {color: c.ink, width: 1.6, opacity: 0.7});
        api.circle([X(i), yD - 28], 6, on[i] ? {fill: c.c3} : {fill: c.card, stroke: c.muted, width: 1.5});
        if (on[i]) {
          api.rect(X(i) - 10, yD - 52, 20, 14, {fill: c.c6, fillOpacity: 0.85, rx: 5});
          if (v.m >= 3 && hd++ % 2 === 0) api.circle([X(i) + 6, yD - 70], 10, {fill: c.c2, fillOpacity: 0.85});
        }
      }
      if (v.m) api.label([X(7) + 14, yD - 45], "MBD", {color: c.c6, size: 12, weight: 650});
      if (v.m >= 3) api.label([X(7) + 18, yD - 70], "HDAC", {color: c.c2, size: 12, weight: 650});
      api.label([152, 14], v.m ? "filled = CH₃ on the C" : "open = unmethylated CpG", {color: v.m ? c.c3 : c.muted, size: 12});
      // start site, gene, polymerase and transcripts
      var tss = 262;
      api.path("M " + tss + " " + (yD - 4) + " L " + tss + " " + (yD - 22) + " L " + (tss + 16) + " " + (yD - 22), {stroke: c.ink, width: 2, arrow: true});
      api.line([tss, yD], [384, yD], {color: c.ink, width: 7, opacity: 0.25});
      api.label([tss + 70, yD + 18], "gene", {color: c.muted, size: 12, anchor: "middle"});
      var nT = [5, 1, 0][st];
      if (st < 2) {
        api.rect(tss - 22, yD - 10, 34, 20, {fill: c.c1, fillOpacity: 0.85, rx: 10});
        api.label([tss - 5, yD], "Pol II", {color: c.card, size: 12, weight: 700, anchor: "middle"});
      }
      for (var t = 0; t < nT; t++) {
        var x0 = tss + 30 + t * 18, pts = [];
        for (var q = 0; q <= 10; q++) pts.push([x0 + q * 2.4 + Math.sin(q) * 2, yD - 30 - q * 4.5]);
        api.polyline(pts, {stroke: c.c1, width: 2});
      }
      api.label([384, 24], nT ? "mRNA" : "no mRNA", {color: nT ? c.c1 : c.muted, size: 12, weight: 650, anchor: "end"});
      // chromatin: beads on a string, spread and acetylated, or packed and bare
      var k = Math.max(0, Math.min(1, (v.m - 2) / 3)), yC = 196;
      api.label([16, 148], "chromatin", {color: c.muted, size: 12});
      var beads = [];
      for (var b = 0; b < 8; b++) {
        var open = [36 + b * 47, yC], closed = [126 + b * 21, yC + (b % 2 ? 11 : -11)];
        beads.push([open[0] + (closed[0] - open[0]) * k, open[1] + (closed[1] - open[1]) * k]);
      }
      api.polyline([[16, yC]].concat(beads).concat([[384, yC]]), {stroke: c.ink, width: 1.4, opacity: 0.5});
      var nAc = Math.round((1 - k) * 8);
      beads.forEach(function (p, b) {
        api.circle(p, 12, {fill: c.muted, fillOpacity: 0.45, stroke: c.muted, width: 1.2});
        if (b < nAc) {
          api.line([p[0], p[1] - 12], [p[0] + 4, p[1] - 22], {color: c.c4, width: 1.6});
          api.label([p[0] + 5, p[1] - 28], "Ac", {color: c.c4, size: 12, weight: 650});
        }
      });
      api.label([200, 236], k === 0 ? "open: acetylated nucleosomes, spaced apart" : k < 1 ? "closing: HDACs strip acetyl groups" : "closed: deacetylated nucleosomes packed tight",
        {color: k === 1 ? c.c2 : k > 0 ? c.c2 : c.c4, size: 12, anchor: "middle"});
      // the verdict
      api.label([200, 270], "transcription: " + WORD[st], {color: [c.c1, c.c3, c.c5][st], size: 14, weight: 700, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
