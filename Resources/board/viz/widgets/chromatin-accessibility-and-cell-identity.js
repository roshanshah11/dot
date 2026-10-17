// Cell identity written in open chromatin. Five stretches of the genome, read the way an ATAC-seq track reads them
// (a peak where the DNA is free of nucleosomes and open to transcription factors): the pluripotency gene OCT4, the
// liver, muscle and neuron programs (represented by their master regulators HNF4A, MYOD1, NEUROD1) and the
// housekeeping gene GAPDH. A stem cell keeps OCT4 open and holds the lineage programs packed but unlocked; a committed
// progenitor opens its own program and packs OCT4 and the other lineages away; the differentiated cell has its own
// program wide open, OCT4 locked by promoter DNA methylation, the other lineages compact. Peak heights are schematic.
(function () {
  var LOCI = [["OCT4", "pluripotency"], ["liver", "HNF4A"], ["muscle", "MYOD1"], ["neuron", "NEUROD1"], ["GAPDH", "housekeeping"]];
  var PROG = {liver: "hepatoblast", muscle: "myoblast", neuron: "neural progenitor"};
  var CELL = {liver: "liver cell", muscle: "muscle fiber", neuron: "neuron"};
  function access(step, lin) {
    return LOCI.map(function (l, j) {
      var name = l[0];
      if (name === "GAPDH") return {a: 0.95, me: false};
      if (name === "OCT4") return {a: step === 1 ? 1 : step === 2 ? 0.07 : 0.0, me: step === 3};
      if (step === 1) return {a: 0.16, me: false};
      return {a: name === lin ? (step === 2 ? 0.6 : 1) : step === 2 ? 0.06 : 0.02, me: false};
    });
  }
  Viz.register("chromatin-accessibility-and-cell-identity", {
    title: "Open chromatin and cell identity",
    subject: "biology",
    shows: "Step a stem cell toward liver, muscle or neuron: the regions of open chromatin narrow to the cell's own program, and that pattern is its identity",
    params: {
      lineage: {kind: "enum", values: ["liver", "muscle", "neuron"], default: "liver", label: "\\text{lineage}"}
    },
    steps: ["embryonic stem cell", "committed progenitor", "differentiated cell"],
    stepMs: 1800,
    formula: function (v) {
      var s = v.step || 1, L = "\\text{" + v.lineage + "}";
      if (s === 1) return "\\text{open}=\\{\\text{OCT4},\\text{GAPDH}\\}\\newline\\text{lineages: closed, unlocked}";
      if (s === 2) return "\\text{open}=\\{" + L + "\\ (\\text{opening}),\\text{GAPDH}\\}\\newline\\text{OCT4: closed}";
      return "\\text{open}=\\{" + L + ",\\text{GAPDH}\\}\\Rightarrow\\text{" + CELL[v.lineage] + "}\\newline\\text{OCT4: methylated}";
    },
    status: function (v) {
      var s = v.step || 1, others = ["liver", "muscle", "neuron"].filter(function (x) { return x !== v.lineage; }).join(" and ");
      if (s === 1) return "A stem cell keeps <b>OCT4</b> and GAPDH open; the liver, muscle and neuron programs are packed but not locked, so it can still become <b>any</b> of them.";
      if (s === 2) return "Committed as a " + PROG[v.lineage] + ": its " + v.lineage + " program is <b>opening</b>, OCT4 has been packed away and the " + others + " programs are closing, so its options narrow.";
      return "A differentiated " + CELL[v.lineage] + ": its " + v.lineage + " genes are <b>wide open</b>, OCT4 is <b>locked</b> by DNA methylation and the " + others + " programs sit in compact chromatin. Same genome, different open regions: that is its identity.";
    },
    examples: [
      {name: "stem cell", values: {step: 1}},
      {name: "liver progenitor", values: {lineage: "liver", step: 2}},
      {name: "differentiated muscle", values: {lineage: "muscle", step: 3}},
      {name: "differentiated neuron", values: {lineage: "neuron", step: 3}}
    ],
    size: [400, 310],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, A = access(s, v.lineage), cw = 76, x0 = 10;
      var cx = function (j) { return x0 + cw * (j + 0.5); };
      // ---- where the cell is on its way ----
      var stages = [["stem cell", 60], [PROG[v.lineage], 200], [CELL[v.lineage], 340]];
      stages.forEach(function (st, i) {
        var on = i + 1 === s, done = i + 1 <= s, q = [st[1], 24];
        if (i < 2) api.line([st[1] + 16, 24], [stages[i + 1][1] - 18, 24], {color: done && i + 2 <= s ? c.ink : c.faint, width: 1.4, arrow: true});
        api.circle(q, 11, {fill: c.ink, fillOpacity: on ? 0.22 : 0.06, stroke: on ? c.ink : c.faint, width: on ? 2 : 1});
        if (i === 2) api.circle(q, 4, {fill: on ? c.ink : c.faint});
        api.label([st[1], 46], st[0], {color: on ? c.ink : c.muted, size: 12, weight: on ? 650 : 500, anchor: "middle"});
      });
      // ---- accessibility track: a peak where the DNA is open ----
      var base = 142, hmax = 68;
      api.line([x0, base], [x0 + cw * 5, base], {color: c.axis, width: 1});
      api.label([x0 + 2, 70], "open chromatin signal", {color: c.c1, size: 12});
      A.forEach(function (q, j) {
        var X = cx(j), h = q.a * hmax, d = "M " + (X - 32) + " " + base;
        for (var t = -32; t <= 32; t += 2) d += " L " + (X + t).toFixed(1) + " " + (base - h * Math.exp(-t * t / 120) - 1.2).toFixed(1);
        d += " L " + (X + 32) + " " + base + " Z";
        api.path(d, {fill: c.c1, fillOpacity: 0.3, stroke: c.c1, width: 1.6});
        // the DNA itself: nucleosomes (purple beads) with a free stretch at the promoter when open
        var y = 166, gap = q.a * 30, closed = q.a < 0.1;
        api.line([X - 34, y], [X + 34, y], {color: c.muted, width: 1.6});
        var spc = closed ? 10.5 : 13;
        for (var x = X - 30; x <= X + 30.1; x += spc) {
          if (Math.abs(x - X) < gap / 2 + 5) continue;
          api.circle([x, y], closed ? 5.6 : 5, {fill: c.c6, fillOpacity: closed ? 0.9 : 0.45});
        }
        if (closed && s > 1 && !q.me) for (var x2 = X - 25; x2 <= X + 25.1; x2 += 10.5) api.circle([x2, y - 9], 5, {fill: c.c6, fillOpacity: 0.6});
        if (q.a >= 0.5) api.rect(X - 7, y - 6, 14, 12, {fill: c.c3, rx: 4});
        if (q.me) [-18, -6, 6, 18].forEach(function (dx) { api.line([X + dx, y + 6], [X + dx, y + 14], {color: c.c5, width: 1.4}); api.circle([X + dx, y + 16], 3, {fill: c.c5}); });
        var on = q.a >= 0.5;
        api.label([X, 198], LOCI[j][0], {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
        api.label([X, 214], LOCI[j][1], {color: c.muted, size: 12, anchor: "middle"});
        api.label([X, 238], on ? "transcribed" : q.me ? "locked" : closed ? "silent" : "poised", {color: on ? c.c4 : q.me ? c.c5 : c.muted, size: 12, weight: on ? 650 : 500, anchor: "middle"});
      });
      // key
      api.circle([18, 272], 5, {fill: c.c6, fillOpacity: 0.8}); api.label([27, 272], "nucleosome", {color: c.muted, size: 12});
      api.rect(112, 266, 12, 12, {fill: c.c3, rx: 4}); api.label([129, 272], "transcription factor", {color: c.muted, size: 12});
      api.circle([268, 272], 3, {fill: c.c5}); api.label([276, 272], "DNA methylation", {color: c.muted, size: 12});
      api.label([200, 296], "same DNA in every cell; only which parts are open changes", {color: c.muted, size: 12, anchor: "middle"});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
