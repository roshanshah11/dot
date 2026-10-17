// Same genome, different cells. Four human cell types each carry the same six genes in their nucleus: two housekeeping
// genes every cell transcribes (GAPDH for glycolysis, ACTB for beta-actin) and four tissue-specific ones (ALB albumin
// in liver, INS insulin in pancreatic beta cells, HBB beta-globin in adult erythroblasts, DES desmin in skeletal
// muscle). The DNA view shows the genes present (all of them, in every cell); the mRNA view shows what each cell
// transcribes. Mature mammalian red cells lose the nucleus, so the red-cell row is the erythroblast that precedes them.
(function () {
  var GENES = [["GAPDH", "GAPDH"], ["ACTB", "β-actin"], ["ALB", "albumin"], ["INS", "insulin"], ["HBB", "β-globin"], ["DES", "desmin"]];
  var CELLS = {"liver cell": 2, "beta cell": 3, "erythroblast": 4, "muscle fiber": 5};   // index of its tissue-specific gene
  var NAME = {"liver cell": "liver cell", "beta cell": "β cell", "erythroblast": "erythroblast", "muscle fiber": "muscle fiber"};
  var on = function (cell, j) { return j < 2 || CELLS[cell] === j; };
  Viz.register("cell-type-specific-gene-expression", {
    title: "Cell-type-specific gene expression",
    subject: "biology",
    shows: "Pick a cell and switch between DNA and mRNA: every cell carries the same genes, but each transcribes the housekeeping genes plus its own tissue-specific ones",
    params: {
      cell: {kind: "enum", values: Object.keys(CELLS), default: "liver cell", label: "\\text{cell}", names: NAME},
      view: {kind: "enum", values: ["DNA", "mRNA"], default: "mRNA", label: "\\text{look at}", names: {DNA: "genes in DNA", mRNA: "mRNA made"}}
    },
    formula: function (v) {
      if (v.view === "DNA") return "\\text{DNA}_{\\text{liver}}=\\text{DNA}_{\\beta}=\\text{DNA}_{\\text{ery}}=\\text{DNA}_{\\text{muscle}}";
      var g = GENES[CELLS[v.cell]][0];
      return "\\text{mRNA}_{\\text{" + NAME[v.cell].replace("β", "\\beta") + "}}=\\{\\text{GAPDH},\\text{ACTB},\\textbf{" + g + "}\\}\\subset\\text{genome}";
    },
    status: function (v) {
      var j = CELLS[v.cell], others = [2, 3, 4, 5].filter(function (k) { return k !== j; }).map(function (k) { return GENES[k][1]; }), list = others.slice(0, -1).join(", ") + " and " + others[others.length - 1];
      if (v.view === "DNA") return "The " + NAME[v.cell] + " carries the <b>same genome</b> as the others: its " + list + " genes are all there, it just never uses them.";
      return "The " + NAME[v.cell] + " transcribes the housekeeping genes GAPDH and ACTB plus <b>" + GENES[j][0] + "</b> (" + GENES[j][1] + "); the " + list + " genes sit <b>silent</b> in the same DNA.";
    },
    examples: [
      {name: "liver cell", values: {cell: "liver cell", view: "mRNA"}},
      {name: "beta cell", values: {cell: "beta cell", view: "mRNA"}},
      {name: "erythroblast", values: {cell: "erythroblast", view: "mRNA"}},
      {name: "muscle fiber", values: {cell: "muscle fiber", view: "mRNA"}},
      {name: "same DNA everywhere", values: {cell: "beta cell", view: "DNA"}}
    ],
    size: [400, 310],
    draw: function (api, v) {
      var c = api.color, x0 = 104, cw = 48, mr = v.view === "mRNA";
      var cx = function (j) { return x0 + cw * (j + 0.5); };
      // ---- the chosen cell's nucleus: one stretch of DNA holding all six genes ----
      api.label([14, 14], NAME[v.cell] + " nucleus", {color: c.ink, size: 12.5, weight: 650});
      api.label([14, 46], "DNA", {color: c.c2, size: 12.5, weight: 600});
      api.line([x0 - 4, 46], [392, 46], {color: c.c2, width: 2.5, opacity: 0.7});
      GENES.forEach(function (g, j) {
        var lit = mr && on(v.cell, j);
        api.rect(cx(j) - 23, 36, 46, 20, {rx: 4, fill: c.card});
        api.rect(cx(j) - 23, 36, 46, 20, {rx: 4, fill: lit ? c.c4 : c.c2, fillOpacity: lit ? 0.3 : 0.1, stroke: lit ? c.c4 : c.c2, width: lit ? 1.8 : 1.2});
        api.label([cx(j), 46.5], g[0], {color: c.ink, size: 12, weight: 650, anchor: "middle"});
        if (lit) {
          var d = "M " + (cx(j) - 16) + " 70"; for (var k = 1; k <= 8; k++) d += " Q " + (cx(j) - 16 + k * 4 - 2) + " " + (70 + (k % 2 ? -4 : 4)) + " " + (cx(j) - 16 + k * 4) + " 70";
          api.path(d, {stroke: c.c4, width: 2.2});
          api.line([cx(j), 58], [cx(j), 64], {color: c.c4, width: 1.5});
        }
        api.label([cx(j), 90], g[1], {color: lit ? c.c4 : c.muted, size: 12, weight: lit ? 650 : 500, anchor: "middle"});
      });
      if (mr) api.label([14, 70], "mRNA", {color: c.c4, size: 12.5, weight: 600});
      api.label([14, 90], mr ? "protein" : "encodes", {color: c.muted, size: 12});
      // ---- housekeeping versus tissue-specific ----
      var br = function (a, b, text) {
        api.line([cx(a) - 20, 112], [cx(b) + 20, 112], {color: c.faint, width: 1.2});
        api.line([cx(a) - 20, 112], [cx(a) - 20, 117], {color: c.faint, width: 1.2}); api.line([cx(b) + 20, 112], [cx(b) + 20, 117], {color: c.faint, width: 1.2});
        api.label([(cx(a) + cx(b)) / 2, 124], text, {color: c.muted, size: 12, anchor: "middle"});
      };
      br(0, 1, "housekeeping"); br(2, 5, "tissue-specific");
      // ---- every cell type, side by side ----
      Object.keys(CELLS).forEach(function (cell, i) {
        var y = 152 + i * 34, sel = cell === v.cell;
        if (sel) api.rect(8, y - 15, 386, 30, {fill: c.ink, fillOpacity: 0.06, stroke: c.faint, width: 1, rx: 8});
        api.label([16, y], NAME[cell], {color: sel ? c.ink : c.muted, size: 12.5, weight: sel ? 650 : 500});
        GENES.forEach(function (g, j) {
          if (!mr) { api.rect(cx(j) - 6, y - 6, 12, 12, {rx: 2, fill: c.c2, fillOpacity: sel ? 0.9 : 0.5}); return; }
          if (on(cell, j)) api.circle([cx(j), y], 7, {fill: c.c4, fillOpacity: sel ? 0.95 : 0.55});
          else api.circle([cx(j), y], 6, {stroke: c.faint, width: 1.2});
        });
      });
      api.label([200, 296], mr ? "filled: transcribed  ·  hollow: gene present but silent" : "square: gene present in the DNA (every cell has all six)",
        {color: c.muted, size: 12, anchor: "middle"});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
