// The five basic patterns of alternative splicing on a model pre-mRNA, each giving two mature mRNAs: A keeps the
// alternative piece (a cassette exon, exon 2a, the longer exon from the farther 5' or 3' splice site, or a retained
// intron) and B does not. Psi ("percent spliced in") is the share of transcripts that are A: Psi = A / (A + B).
// Exon lengths are model values in nucleotides; introns are drawn shortened (real ones are often thousands of nt).
(function () {
  var M = {
    skip: {gene: [["1", 120, "c"], ["i"], ["2", 90, "a"], ["i"], ["3", 150, "c"]], A: ["1", "2", "3"], B: ["1", "3"],
      what: "exon 2 is kept (A) or skipped (B)"},
    exclusive: {gene: [["1", 120, "c"], ["i"], ["2a", 90, "a"], ["i"], ["2b", 96, "b"], ["i"], ["3", 150, "c"]], A: ["1", "2a", "3"], B: ["1", "2b", "3"],
      what: "exactly one of exons 2a and 2b is used"},
    alt5: {gene: [["1", 120, "c"], ["+45", 45, "a"], ["i"], ["2", 150, "c"]], A: ["1", "+45", "2"], B: ["1", "2"],
      what: "exon 1 has two 5′ splice sites (donors)"},
    alt3: {gene: [["1", 120, "c"], ["i"], ["+36", 36, "a"], ["2", 150, "c"]], A: ["1", "+36", "2"], B: ["1", "2"],
      what: "exon 2 has two 3′ splice sites (acceptors)"},
    retain: {gene: [["1", 120, "c"], ["intron", 80, "r"], ["2", 150, "c"]], A: ["1", "intron", "2"], B: ["1", "2"],
      what: "the intron is spliced out (B) or kept (A)"}
  };
  function len(m, ids) { return ids.reduce(function (s, id) { return s + M[m].gene.filter(function (g) { return g[0] === id; })[0][1]; }, 0); }
  function sum(m, ids) { return ids.map(function (id) { return M[m].gene.filter(function (g) { return g[0] === id; })[0][1]; }).join("+"); }

  Viz.register("alternative-rna-splicing-isoforms", {
    title: "Alternative splicing patterns",
    subject: "biology",
    shows: "Pick a splicing pattern and slide Ψ: the same pre-mRNA is spliced two ways, giving mRNA isoforms of different lengths, and Ψ is the share that keeps the alternative piece",
    params: {
      mode: {kind: "enum", values: ["skip", "exclusive", "alt5", "alt3", "retain"], default: "skip", label: "\\text{pattern}",
        names: {skip: "exon skipping", exclusive: "mutually exclusive", alt5: "alt 5′ site", alt3: "alt 3′ site", retain: "intron retention"}},
      psi: {kind: "number", default: 0.6, min: 0, max: 1, step: 0.05, label: "\\Psi"}
    },
    formula: function (v) {
      var m = M[v.mode], nA = Math.round(20 * v.psi);
      return "\\Psi = \\frac{A}{A+B} = \\frac{" + nA + "}{20} = " + Viz.n(v.psi) + "\\newline L_A = " + sum(v.mode, m.A) + " = " + len(v.mode, m.A) +
        "\\ \\text{nt}\\newline L_B = " + sum(v.mode, m.B) + " = " + len(v.mode, m.B) + "\\ \\text{nt}";
    },
    status: function (v) {
      var a = Math.round(v.psi * 100) + "%", b = Math.round((1 - v.psi) * 100) + "%", m = M[v.mode], LA = len(v.mode, m.A), LB = len(v.mode, m.B);
      return {
        skip: "Exon skipping: <b>" + a + "</b> of transcripts keep exon 2 (" + LA + " nt) and <b>" + b + "</b> skip it (" + LB + " nt).",
        exclusive: "Mutually exclusive exons: <b>" + a + "</b> use exon 2a and <b>" + b + "</b> use exon 2b, never both or neither (" + LA + " and " + LB + " nt).",
        alt5: "Alternative 5′ splice site: <b>" + a + "</b> splice from the farther donor and keep 45 more nt of exon 1 (" + LA + " nt); <b>" + b + "</b> use the nearer one (" + LB + " nt).",
        alt3: "Alternative 3′ splice site: <b>" + a + "</b> use the upstream acceptor and keep 36 more nt of exon 2 (" + LA + " nt); <b>" + b + "</b> use the downstream one (" + LB + " nt).",
        retain: "Intron retention: <b>" + a + "</b> keep the 80 nt intron (" + LA + " nt, often held in the nucleus or destroyed by nonsense-mediated decay) and <b>" + b + "</b> splice it out (" + LB + " nt)."
      }[v.mode];
    },
    examples: [
      {name: "minimum: every transcript skips exon 2", values: {mode: "skip", psi: 0}},
      {name: "maximum: every transcript keeps exon 2", values: {mode: "skip", psi: 1}},
      {name: "mutually exclusive, half and half", values: {mode: "exclusive", psi: 0.5}},
      {name: "alternative 5′ splice site", values: {mode: "alt5", psi: 0.3}},
      {name: "alternative 3′ splice site", values: {mode: "alt3", psi: 0.8}},
      {name: "intron retention", values: {mode: "retain", psi: 0.2}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = M[v.mode], k = 0.5, IW = 36, gy = 62, h = 16, colA = c.c1, colB = c.c6;
      var fill = {c: c.c2, a: c.c3, b: c.c4, r: c.c3};
      // ---- the pre-mRNA ----
      var total = m.gene.reduce(function (s, g) { return s + (g[0] === "i" ? IW : g[1] * k); }, 0), x = 30 + (340 - total) / 2, pos = {};
      api.label([14, 14], "pre-mRNA (introns shortened)", {color: c.muted, size: 12});
      m.gene.forEach(function (g) {
        if (g[0] === "i") { api.line([x, gy + h / 2], [x + IW, gy + h / 2], {color: c.muted, width: 2}); x += IW; return; }
        var w = g[1] * k;
        if (g[2] === "r") api.rect(x, gy + 4, w, h - 8, {fill: fill.r, fillOpacity: 0.55, rx: 2});
        else api.rect(x, gy, w, h, {fill: fill[g[2]], fillOpacity: 0.9, rx: 3});
        if (g[2] === "r") api.label([x + w / 2, gy - 9], "intron", {color: c.c3, size: 12, anchor: "middle"});
        else if (w >= 22) api.label([x + w / 2, gy + h / 2 + 1], g[0], {color: "#111", size: 12, weight: 700, anchor: "middle"});
        else api.label([x + w / 2, gy - 9], g[0], {color: c.c3, size: 12, anchor: "middle"});
        pos[g[0]] = [x, x + w]; x += w;
      });
      // splice junctions: A above the gene, B below
      var arcs = function (ids, up, col) {
        for (var i = 0; i + 1 < ids.length; i++) {
          var x1 = pos[ids[i]][1], x2 = pos[ids[i + 1]][0];
          if (x2 - x1 < 2) continue;
          var y = up ? gy : gy + h, dy = up ? -26 : 26;
          api.path("M " + x1 + " " + y + " Q " + (x1 + x2) / 2 + " " + (y + 2 * dy) + " " + x2 + " " + y, {stroke: col, width: 2});
        }
      };
      arcs(m.A, true, colA); arcs(m.B, false, colB);
      api.label([386, gy - 16], v.mode === "retain" ? "A keeps it" : "A splices", {color: colA, size: 12, anchor: "end"});
      api.label([386, gy + h + 18], "B splices", {color: colB, size: 12, anchor: "end"});
      // ---- the two mature mRNAs, same nucleotide scale ----
      var mrna = function (ids, y, col, name) {
        var xx = 50;
        api.label([14, y + 7], name, {color: col, size: 13, weight: 700});
        api.circle([xx - 6, y + 7], 4, {fill: c.muted});
        ids.forEach(function (id) {
          var g = m.gene.filter(function (q) { return q[0] === id; })[0], w = g[1] * k;
          api.rect(xx, y, w, 14, {fill: fill[g[2]], fillOpacity: 0.9, rx: 2, stroke: c.card, width: 1});
          xx += w;
        });
        api.label([xx + 4, y + 7], "AAA", {color: c.muted, size: 12});
        api.label([xx + 36, y + 7], len(v.mode, ids) + " nt", {color: col, size: 12.5, weight: 650});
      };
      mrna(m.A, 132, colA, "A");
      mrna(m.B, 162, colB, "B");
      // ---- 20 transcripts split by psi ----
      var nA = Math.round(20 * v.psi);
      api.label([14, 206], "20 transcripts: " + nA + " A, " + (20 - nA) + " B", {color: c.muted, size: 12});
      for (var t = 0; t < 20; t++) api.rect(14 + t * 18.6, 218, 15, 18, {fill: t < nA ? colA : colB, fillOpacity: 0.85, rx: 3});
      api.label([14, 256], "pattern: " + m.what, {color: c.ink, size: 12.5});
      api.label([14, 280], "constitutive exon", {color: c.c2, size: 12});
      api.label([128, 280], "alternative piece", {color: c.c3, size: 12});
      if (v.mode === "exclusive") api.label([238, 280], "other choice", {color: c.c4, size: 12});
      api.root.querySelectorAll("text").forEach(function (q) { if (q.getAttribute("fill")) q.style.fill = q.getAttribute("fill"); });
    }
  });
})();
