// Same genome, different cells: a neuron and a skeletal muscle cell carry identical DNA, and differ in which genes they
// transcribe. Seven real human genes: GAPDH (glycolysis, every cell); SCN2A (the Nav1.2 sodium channel) and SYN1
// (synapsin I, which tethers synaptic vesicles), both neuronal; REST (a repressor made by non-neuronal cells and kept
// low in mature neurons); MYOD1 (MyoD, the skeletal-muscle master regulator, which keeps its own gene on); ACTA1
// (skeletal alpha-actin of the thin filaments) and CKM (muscle creatine kinase, with a classic MyoD-bound E-box
// enhancer). In the muscle cell REST sits on the RE1 elements of SCN2A and SYN1 and silences them; MyoD binds E-boxes
// (CANNTG) at the muscle genes. Neurons make neither REST nor MyoD, so their neuronal activators turn SCN2A and SYN1 on
// and the muscle genes stay off. Muscle fires its own action potentials with a different channel gene, SCN4A (Nav1.4).
// Colors: red = REST, amber = MyoD, blue = neuronal activators, teal = general factors, green = mRNA, purple = the gene
// being followed.
(function () {
  var G = [
    {g: "GAPDH", n: 1, m: 1, tf: "gen", prot: "GAPDH, a glycolysis enzyme every cell needs"},
    {g: "SCN2A", n: 1, m: 0, tf: "rest", prot: "Nav1.2, one of the sodium channels that carry the neuron's action potentials (muscle uses another gene, SCN4A)"},
    {g: "SYN1", n: 1, m: 0, tf: "rest", prot: "synapsin I, which tethers synaptic vesicles at the axon terminal"},
    {g: "REST", n: 0, m: 1, tf: "self", prot: "REST, the repressor that keeps neuronal genes silent outside neurons"},
    {g: "MYOD1", n: 0, m: 1, tf: "myod", prot: "MyoD, the master regulator of skeletal muscle, which also keeps its own gene on"},
    {g: "ACTA1", n: 0, m: 1, tf: "myod", prot: "skeletal α-actin, the thin filaments that slide during contraction"},
    {g: "CKM", n: 0, m: 1, tf: "myod", prot: "muscle creatine kinase, which recharges ATP during contraction"}
  ];
  var IDS = G.map(function (x) { return x.g; });
  function gene(v) { return G[IDS.indexOf(v.gene)]; }
  function where(x) { return x.n && x.m ? "both cells" : x.n ? "the neuron only" : "the muscle cell only"; }
  Viz.register("neuron-versus-muscle-gene-expression", {
    title: "Neuron versus muscle: same genes, different expression",
    subject: "biology",
    shows: "Step from DNA to protein in a neuron and a muscle cell side by side: both carry the same genes, but REST silences neuronal genes in muscle and MyoD switches on muscle genes, so each cell makes its own proteins",
    params: {
      gene: {kind: "enum", values: IDS, default: "SCN2A", label: "\\text{follow}"}
    },
    steps: ["same genome", "regulators bind", "mRNA made", "proteins build the cell"],
    stepMs: 1900,
    formula: function (v) {
      var x = gene(v), on = function (k) { return G.filter(function (y) { return y[k]; }).length; };
      return "\\begin{array}{l}\\text{" + x.g + "}:\\ \\text{neuron " + (x.n ? "ON" : "OFF") + ",\\ muscle " + (x.m ? "ON" : "OFF") + "}\\\\ " +
        G.length + "\\ \\text{genes in both};\\ \\text{on: }" + on("n") + "\\ \\text{vs}\\ " + on("m") + "\\end{array}";
    },
    status: function (v) {
      var s = v.step || 1, x = gene(v), g = "<b>" + x.g + "</b>";
      if (s === 1) return "Neuron and muscle cell carry the same DNA: " + g + " sits in both nuclei, like every other gene.";
      if (s === 2) {
        if (x.tf === "gen") return "General transcription factors open " + g + " in both cells, since every cell runs glycolysis.";
        if (x.tf === "rest") return "In the muscle cell <b>REST</b> sits on the RE1 element of " + g + " and silences it; neurons make no REST, so their activators switch it on.";
        if (x.tf === "self") return g + " is transcribed in the muscle cell, as in most non-neuronal cells, and kept switched off in mature neurons.";
        if (x.g === "MYOD1") return "<b>MyoD</b> binds its own gene's control region and keeps " + g + " on in the muscle cell; neurons never start it.";
        return "<b>MyoD</b> binds E-box sites (CANNTG) at " + g + " in the muscle cell and turns it on; neurons have no MyoD, so it stays off.";
      }
      if (s === 3) return x.n && x.m ? "Both cells make " + g + " mRNA." : (x.n ? "Only the neuron" : "Only the muscle cell") + " makes " + g + " mRNA; in the other cell the gene is present but silent.";
      return g + " is expressed in " + where(x) + ": it encodes " + x.prot + ".";
    },
    examples: [
      {name: "a neuronal gene silenced by REST in muscle", values: {gene: "SCN2A", step: 2}},
      {name: "a MyoD target in muscle", values: {gene: "CKM", step: 2}},
      {name: "housekeeping: mRNA in both", values: {gene: "GAPDH", step: 3}},
      {name: "the proteins: skeletal actin", values: {gene: "ACTA1", step: 4}},
      {name: "same genome", values: {gene: "SYN1", step: 1}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, sel = IDS.indexOf(v.gene);
      var TF = {gen: [c.c1, "G"], rest: [c.c5, "R"], myod: [c.c3, "M"], act: [c.c2, "A"]};
      api.label([96, 14], "neuron", {color: c.ink, size: 13, weight: 700, anchor: "middle"});
      api.label([304, 14], "muscle cell", {color: c.ink, size: 13, weight: 700, anchor: "middle"});
      api.label([200, 14], s === 1 ? "same DNA" : "gene", {color: c.muted, size: 12, anchor: "middle"});
      var tfFor = function (x, cell) {      // which factor sits on this gene in this cell, if any
        if (x.tf === "gen") return "gen";
        if (cell === "n") return x.n ? "act" : null;
        if (x.tf === "rest") return "rest";
        return x.m ? (x.tf === "self" ? "gen" : "myod") : null;
      };
      G.forEach(function (x, i) {
        var y = 40 + i * 24, isSel = i === sel;
        if (isSel) api.rect(6, y - 11, 388, 22, {fill: c.c6, fillOpacity: 0.12, stroke: c.c6, width: 1.2, rx: 6});
        api.label([200, y], x.g, {color: isSel ? c.c6 : c.ink, size: 12.5, weight: isSel ? 750 : 600, anchor: "middle"});
        [["n", 1], ["m", -1]].forEach(function (side) {
          var cell = side[0], d = side[1], on = x[cell] === 1;
          // the gene on its stretch of DNA, near the centre; its control region just outside it
          var g0 = d > 0 ? 126 : 232, ctrl = d > 0 ? 112 : 288;
          api.line([d > 0 ? 96 : 230, y], [d > 0 ? 170 : 304, y], {color: c.muted, width: 1.5});
          var lit = s >= 3 ? on : true;
          api.rect(g0, y - 6, 42, 12, {fill: lit ? c.ink : c.muted, fillOpacity: s >= 3 ? (on ? 0.55 : 0.12) : 0.35, rx: 3});
          if (s >= 2) {
            var t = tfFor(x, cell);
            if (t) {
              api.circle([ctrl, y], 8.5, {fill: TF[t][0], fillOpacity: 0.9});
              api.label([ctrl, y + 0.5], TF[t][1], {color: c.card, size: 12, weight: 800, anchor: "middle"});
            }
          }
          if (s >= 3) {
            var x0 = d > 0 ? 92 : 308;
            if (on) for (var k = 0; k < 3; k++) {
              var xs = x0 - d * (k * 24 + 4), pts = [];
              for (var q = 0; q <= 8; q++) pts.push([xs - d * q * 2.4, y + Math.sin(q * 1.3) * 3.5]);
              api.polyline(pts, {stroke: c.c4, width: 2});
            }
            else api.label([d > 0 ? 58 : 342, y], t === "rest" ? "silenced" : "off", {color: t === "rest" ? c.c5 : c.faint, size: 12, anchor: "middle"});
          }
        });
      });
      // key for the step's symbols
      var ky = 214;
      if (s === 1) api.label([200, ky], "identical gene sets: nothing yet tells the cells apart", {color: c.muted, size: 12, anchor: "middle"});
      else if (s === 2) [["R", "REST", c.c5, 16], ["M", "MyoD", c.c3, 82], ["A", "neuronal activator", c.c2, 148], ["G", "general", c.c1, 300]].forEach(function (k) {
        api.circle([k[3], ky], 7.5, {fill: k[2], fillOpacity: 0.9}); api.label([k[3], ky + 0.5], k[0], {color: c.card, size: 12, weight: 800, anchor: "middle"});
        api.label([k[3] + 11, ky], k[1], {color: k[2], size: 12, weight: 600});
      });
      else api.label([200, ky], s === 3 ? "green = mRNA copies leaving the gene" : "each cell's mRNAs become its own proteins", {color: s === 3 ? c.c4 : c.muted, size: 12, anchor: "middle"});
      // the two cells; in step 4 their proteins appear
      var p4 = s === 4, hl = function (name) { return v.gene === name ? c.c6 : null; };
      var ny = 270;
      api.circle([34, ny], 16, {fill: c.c2, fillOpacity: p4 ? 0.18 : 0.06, stroke: c.c2, width: 1.6});
      [[-1, -1], [-1, 1], [0, -1]].forEach(function (d) { api.line([34 + d[0] * 12, ny + d[1] * 12], [34 + d[0] * 26 + (d[0] ? 0 : 8), ny + d[1] * 30], {color: c.c2, width: 1.6}); });
      api.line([50, ny], [168, ny], {color: c.c2, width: 3});
      [176, 184].forEach(function (x, j) { api.circle([x, ny + (j ? 8 : -8)], 6, {fill: c.c2, fillOpacity: 0.2, stroke: c.c2, width: 1.4}); });
      api.line([168, ny], [174, ny - 6], {color: c.c2, width: 2}); api.line([168, ny], [176, ny + 6], {color: c.c2, width: 2});
      var mx0 = 216, mx1 = 388, my0 = 252, my1 = 290;
      api.rect(mx0, my0, mx1 - mx0, my1 - my0, {fill: c.c5, fillOpacity: p4 ? 0.12 : 0.05, stroke: c.c5, width: 1.6, rx: 14});
      [244, 300, 356].forEach(function (x) { api.rect(x - 9, my1 - 7, 18, 6, {fill: c.muted, fillOpacity: 0.5, rx: 3}); });
      if (p4) {
        for (var k = 0; k < 9; k++) api.circle([66 + k * 11, ny], 2.6, {fill: hl("SCN2A") || c.c4});
        [[176, ny - 8], [184, ny + 8]].forEach(function (p) { [[-2, -2], [2, 1], [-1, 3]].forEach(function (o) { api.circle([p[0] + o[0], p[1] + o[1]], 1.8, {fill: hl("SYN1") || c.c4}); }); });
        for (var xx = mx0 + 14; xx < mx1 - 8; xx += 9) api.line([xx, my0 + 6], [xx, my1 - 12], {color: hl("ACTA1") || c.c4, width: xx % 18 < 9 ? 2.2 : 1, opacity: 0.8});
        api.label([92, 304], "Na⁺ channels, vesicles", {color: hl("SCN2A") || hl("SYN1") || c.c4, size: 12, anchor: "middle"});
        api.label([302, 306], "actin, creatine kinase", {color: hl("ACTA1") || hl("CKM") || c.c4, size: 12, anchor: "middle"});
        if (v.gene === "GAPDH") { api.label([96, 242], "GAPDH in both", {color: c.c6, size: 12, weight: 700, anchor: "middle"}); api.label([302, 242], "GAPDH in both", {color: c.c6, size: 12, weight: 700, anchor: "middle"}); }
        if (v.gene === "REST" || v.gene === "MYOD1") api.label([302, 242], (v.gene === "REST" ? "REST" : "MyoD") + " stays in the nuclei", {color: c.c6, size: 12, weight: 700, anchor: "middle"});
      } else {
        api.label([96, 300], "axon, dendrites", {color: c.faint, size: 12, anchor: "middle"});
        api.label([302, 304], "muscle fiber, many nuclei", {color: c.faint, size: 12, anchor: "middle"});
      }
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
