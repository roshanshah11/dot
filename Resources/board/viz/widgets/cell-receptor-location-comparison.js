// Where a hormone's receptor sits depends on whether the hormone can cross the membrane. Water-soluble epinephrine
// and insulin cannot: they bind receptors on the surface (a G-protein-coupled receptor, a receptor tyrosine kinase)
// and second messengers or phosphorylation change proteins the cell already has, within seconds to minutes.
// Lipid-soluble steroids slip through the bilayer: cortisol meets its receptor (GR, held by Hsp90) in the cytoplasm,
// estradiol meets its receptor (ER) already in the nucleus, and the hormone-receptor pair switches genes on, so the
// effect needs transcription and translation and takes hours. Pick a hormone and a moment after it arrives.
(function () {
  var H = {
    epinephrine: {where: "surface", tex: "\\text{epinephrine}\\to\\text{GPCR}\\to\\text{G}_\\text{s}\\to\\text{cAMP}\\newline\\to\\text{PKA}\\to\\text{existing enzymes switched}"},
    insulin: {where: "surface", tex: "\\text{insulin}\\to\\text{receptor tyrosine kinase}\\newline\\to\\text{P-tyrosines}\\to\\text{GLUT4 to the surface}"},
    cortisol: {where: "inside", tex: "\\text{cortisol}+\\text{GR}\\cdot\\text{Hsp90}\\to\\text{GR–cortisol}\\newline\\to\\text{nucleus}\\to\\text{mRNA}\\to\\text{new protein}"},
    estradiol: {where: "inside", tex: "\\text{estradiol}+\\text{ER (in nucleus)}\\newline\\to\\text{ER on DNA}\\to\\text{mRNA}\\to\\text{new protein}"}
  };
  var SAY = {
    "epinephrine|seconds": "Epinephrine is water-soluble, so it stops at the membrane: it binds a <b>surface</b> G-protein-coupled receptor and cAMP carries the signal inside within <b>seconds</b>.",
    "epinephrine|minutes": "Within minutes cAMP has switched on PKA and the enzymes that break glycogen down, so the liver cell is releasing glucose: no new genes needed.",
    "epinephrine|hours": "Hours on, the response lasts only while epinephrine stays bound: a surface receptor changes proteins the cell <b>already has</b>, so nothing waits on genes.",
    "insulin|seconds": "Insulin is a protein and cannot cross the membrane: it binds a <b>surface</b> receptor tyrosine kinase, which phosphorylates its own tyrosines within <b>seconds</b>.",
    "insulin|minutes": "Within minutes the signal has moved GLUT4 transporters from vesicles into the membrane, so glucose pours in: existing proteins, moved and switched.",
    "insulin|hours": "Hours on, glucose uptake continues while insulin is bound; the fast part of the response never needed the nucleus.",
    "cortisol|seconds": "Cortisol is a steroid, so it slips through the lipid bilayer and binds its receptor <b>in the cytoplasm</b>, freeing it from Hsp90.",
    "cortisol|minutes": "The cortisol–receptor pair has moved into the nucleus and sits on its response element: the gene next to it is being <b>transcribed</b>.",
    "cortisol|hours": "Only after <b>hours</b> does the response arrive: the mRNA has been translated into new protein (enzymes for making glucose).",
    "estradiol|seconds": "Estradiol is a steroid: it crosses the membrane and the nuclear envelope and binds its receptor already sitting <b>in the nucleus</b>.",
    "estradiol|minutes": "The estradiol-bound receptor on its response element starts <b>transcription</b> of the target gene: mRNA, but no protein yet.",
    "estradiol|hours": "After <b>hours</b> the new mRNA has been translated, so the cell finally makes new protein; slow, but it can last."
  };
  var T = ["seconds", "minutes", "hours"];
  Viz.register("cell-receptor-location-comparison", {
    title: "Surface versus intracellular receptors",
    subject: "biology",
    shows: "Pick a hormone and a time: water-soluble ones stop at surface receptors and act in seconds; steroids cross the membrane, meet receptors inside and change genes over hours",
    params: {
      hormone: {kind: "enum", values: ["epinephrine", "insulin", "cortisol", "estradiol"], default: "cortisol", label: "\\text{hormone}"},
      time: {kind: "enum", values: T, default: "minutes", label: "\\text{after}"}
    },
    formula: function (v) { return H[v.hormone].tex; },
    status: function (v) { return SAY[v.hormone + "|" + v.time]; },
    examples: [
      {name: "epinephrine, seconds", values: {hormone: "epinephrine", time: "seconds"}},
      {name: "insulin, minutes", values: {hormone: "insulin", time: "minutes"}},
      {name: "cortisol, hours", values: {hormone: "cortisol", time: "hours"}},
      {name: "estradiol, seconds", values: {hormone: "estradiol", time: "seconds"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, h = v.hormone, t = T.indexOf(v.time), my = 62;
      var sel = function (k) { return k === h; }, rc = function (k) { return sel(k) ? c.c1 : c.faint; };
      var steroid = function (x, y) {   // four fused rings
        var hex = function (cx, cy) { var p = []; for (var i = 0; i < 6; i++) { var a = Math.PI / 6 + i * Math.PI / 3; p.push([cx + 4.6 * Math.cos(a), cy + 4.6 * Math.sin(a)]); } return p; };
        [[x - 8, y + 2], [x, y - 2.6], [x + 8, y + 2]].forEach(function (q) { api.polygon(hex(q[0], q[1]), {fill: c.c3, fillOpacity: 0.85, stroke: c.c3, width: 1}); });
        api.polygon([[x + 12, y - 4], [x + 18, y - 6], [x + 20, y], [x + 16, y + 4], [x + 12, y + 2]], {fill: c.c3, fillOpacity: 0.85, stroke: c.c3, width: 1});
      };
      var lig = function (at) {
        if (h === "epinephrine") api.circle(at, 5, {fill: c.c3});
        else if (h === "insulin") { api.circle([at[0] - 4, at[1]], 6, {fill: c.c3}); api.circle([at[0] + 5, at[1] + 1], 5, {fill: c.c3}); }
        else steroid(at[0], at[1]);
      };
      // cell: outside, membrane, cytoplasm, nucleus with a gene
      api.label([10, 12], "outside", {color: c.muted, size: 12});
      api.label([392, 84], "cytoplasm", {color: c.muted, size: 12, anchor: "end"});
      [my, my + 6].forEach(function (y) { api.line([6, y], [394, y], {color: c.ink, width: 1.3, opacity: 0.7}); });
      api.path("M 190 146 A 100 52 0 1 0 390 146 A 100 52 0 1 0 190 146 Z", {stroke: c.muted, width: 1.4, fill: c.ink, fillOpacity: 0.03});
      api.label([214, 120], "nucleus", {color: c.muted, size: 12});
      var dna = []; for (var x = 204; x <= 378; x += 3) dna.push([x, 162 + 3 * Math.sin(x / 5)]);
      api.polyline(dna, {stroke: c.c6, width: 2, opacity: 0.8});
      api.rect(316, 157, 46, 10, {fill: c.c6, fillOpacity: 0.35, rx: 3});
      api.label([339, 180], "gene", {color: c.c6, size: 12, anchor: "middle"});
      var blob = function (at, rx, ry, k) { api.path("M " + (at[0] - rx) + " " + at[1] + " A " + rx + " " + ry + " 0 1 0 " + (at[0] + rx) + " " + at[1] + " A " + rx + " " + ry + " 0 1 0 " + (at[0] - rx) + " " + at[1] + " Z", {fill: rc(k), fillOpacity: sel(k) ? 0.55 : 0.3, stroke: rc(k), width: 1.4}); };
      var lab = function (k, at, text, anchor) { api.label(at, text, {color: sel(k) ? c.c1 : c.muted, size: 12, weight: sel(k) ? 650 : 500, anchor: anchor || "start"}); };
      // every receptor drawn and named where it lives (the chosen hormone's in teal): GPCR and RTK in the membrane,
      // GR held by Hsp90 in the cytoplasm, ER in the nucleus. A steroid receptor with its hormone moves onto the DNA
      // right beside the gene it switches on (GENE), which is where the mRNA comes off.
      var zig = []; for (var i = 0; i < 8; i++) zig.push([30 + i * 4, i % 2 ? my + 11 : my - 5]);
      api.polyline(zig, {stroke: rc("epinephrine"), width: 2.6});
      lab("epinephrine", [62, 46], "GPCR");
      [150, 162].forEach(function (x) { api.line([x, my - 18], [x, my + 20], {color: rc("insulin"), width: 3.5}); api.rect(x - 5, my + 20, 10, 14, {fill: rc("insulin"), rx: 3}); });
      lab("insulin", [156, 108], "RTK", "middle");
      var GENE = [300, 152], grOn = h === "cortisol" && t > 0, erOn = h === "estradiol" && t > 0;
      blob(grOn ? GENE : [60, 124], 14, 9, "cortisol");
      lab("cortisol", grOn ? [296, 124] : [42, 125], "GR", grOn ? "middle" : "end");
      var hsp = h === "cortisol" ? [96, 148] : [77, 132];   // cortisol frees GR from Hsp90
      api.circle(hsp, 7, {fill: c.muted, fillOpacity: 0.35, stroke: c.muted, width: 1});
      api.label([hsp[0] + 10, hsp[1] + 1], "Hsp90", {color: c.muted, size: 12});
      blob(erOn ? GENE : [236, 152], 13, 8, "estradiol");
      lab("estradiol", erOn ? [296, 124] : [252, 140], "ER", erOn ? "middle" : "start");
      // the hormone and what follows, by time
      api.label([392, 12], h, {color: c.c3, size: 12.5, weight: 700, anchor: "end"});
      if (h === "epinephrine") {
        lig([44, my - 11]); lig([96, 24]); lig([20, 32]);
        api.circle([68, my + 16], 5, {fill: c.c2, fillOpacity: 0.7}); api.label([78, my + 18], "G_s → cAMP", {color: c.c2, size: 12});
        [[80, 96], [96, 106], [112, 94], [126, 106], [88, 116], [108, 118]].forEach(function (q) { api.circle(q, 2.6, {fill: c.c2}); });
        if (t >= 1) {   // PKA has switched on glycogen breakdown: glucose made from what the cell already stores
          api.label([14, 166], "PKA → glycogen → glucose", {color: c.c4, size: 12.5, weight: 650});
          [[24, 186], [42, 191], [60, 184], [78, 190], [96, 185], [114, 191]].forEach(function (q) { api.circle(q, 3, {fill: c.c4}); });
        }
      } else if (h === "insulin") {
        lig([156, my - 24]); lig([104, 28]);
        [[139, my + 27], [173, my + 27]].forEach(function (q) { api.label(q, "P", {color: c.c2, size: 12, weight: 700, anchor: "middle"}); });
        [192, 210].forEach(function (x, i) {
          if (t >= 1) { api.rect(x - 4, my - 4, 8, 14, {fill: c.c4, rx: 2}); api.arrow([x, my - 22], [x, my + 26], {color: c.c4, width: 1.8, halo: false, head: 8}); }
          else api.circle([34 + 24 * i, 172 + 6 * i], 8, {stroke: c.c4, width: 1.4, fill: c.c4, fillOpacity: 0.12});
        });
        if (t >= 1) [[180, 100], [194, 110], [206, 98], [220, 104], [232, 94]].forEach(function (q) { api.circle(q, 2.6, {fill: c.c4}); });
        api.label(t >= 1 ? [218, 46] : [72, 178], t >= 1 ? "GLUT4: glucose in" : "GLUT4 in vesicles", {color: c.c4, size: 12});
      } else {
        lig([122, 28]);
        if (t === 0) { lig(h === "cortisol" ? [112, my + 3] : [212, my + 3]); lig(h === "cortisol" ? [52, 110] : [228, 140]); }
        else lig([292, 140]);   // bound to its receptor on the DNA beside the gene
        if (t >= 1) {   // transcription: mRNA peels off the gene
          api.path("M 340 152 q 8 -14 16 -8 q 8 6 16 -8", {stroke: c.c6, width: 2.4});
          api.label([364, 124], "mRNA", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
        }
        if (t >= 2) {   // translation in the cytoplasm: new protein
          api.path("M 196 170 q -12 9 -22 2 q -10 -7 -20 2", {stroke: c.c6, width: 2.4});
          api.circle([150, 176], 7, {fill: c.muted, fillOpacity: 0.5});
          api.circle([134, 192], 8, {fill: c.c4, fillOpacity: 0.85});
          api.label([148, 199], "new protein", {color: c.c4, size: 12.5, weight: 650});
        }
      }
      // ---- the comparison: what each receptor type has done by each time ----
      var cols = [118, 210, 302], cw = 88, rows = [["surface", ["cascade on", "full effect", "sustained"], [0.55, 1, 1]], ["intracellular", ["binding", "transcribing", "new protein"], [0.1, 0.4, 1]]];
      T.forEach(function (name, j) { api.label([cols[j] + cw / 2, 218], name, {color: j === t ? c.ink : c.muted, size: 12, weight: j === t ? 700 : 500, anchor: "middle"}); });
      rows.forEach(function (r, i) {
        var y = 230 + i * 32, mine = (r[0] === "surface") === (H[h].where === "surface");
        api.label([10, y + 12], r[0], {color: mine ? c.ink : c.muted, size: 12, weight: mine ? 700 : 500});
        r[1].forEach(function (txt, j) {
          api.rect(cols[j], y, cw, 24, {fill: c.c4, fillOpacity: 0.08 + 0.3 * r[2][j], stroke: mine && j === t ? c.ink : "none", width: 1.6, rx: 6});
          api.label([cols[j] + cw / 2, y + 12], txt, {color: mine ? c.ink : c.muted, size: 12, anchor: "middle"});
        });
      });
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
