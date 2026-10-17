// Epigenetic memory: a promoter's CpG methylation is inherited through cell division with no change in the DNA sequence.
// Replication is semiconservative: each daughter duplex keeps one old strand, with its methyl marks, and gets a new,
// unmethylated strand. DNMT1 finds the hemimethylated CpGs and methylates the new strand opposite each mark, with a per-site
// efficiency e. Ignoring de novo methylation (DNMT3) and active removal (TET), the average level per strand follows
// m_n = m_{n-1} (1 + e) / 2, so m_n = m_0 ((1 + e) / 2)^n: with e = 1 the pattern is copied forever; with e = 0 (DNMT1
// blocked, as by 5-azacytidine) it halves every division (passive demethylation). Dense promoter methylation keeps the
// gene silent; the 50% line here is a schematic threshold, not a measured constant.
// Duplex drawing: template marks = round(10 m_{n-1}); copied marks = round(10 m_{n-1} e), opposite the first template marks.
// Colors: amber = methyl marks, purple = DNMT1, red = silenced, green = gene on.
(function () {
  var ORDER = [3, 7, 0, 5, 9, 2, 6, 1, 8, 4];   // which CpG sites hold the marks first (a fixed scatter)
  function level(e, n) { return Math.pow((1 + e) / 2, n); }
  function pct(m) { return Viz.fmt(m * 100, m >= 0.1 ? 1 : 2) + "%"; }

  Viz.register("epigenetics", {
    title: "Epigenetics: methylation memory",
    subject: "biology",
    shows: "Divide the cell and set how faithfully DNMT1 copies methyl marks onto each new strand: good copying keeps a gene silenced for generations with the DNA sequence unchanged, poor copying dilutes the marks by half each division",
    params: {
      e: {kind: "number", default: 0.95, min: 0, max: 1, step: 0.01, label: "e"},
      n: {kind: "integer", default: 4, min: 0, max: 10, label: "n"}
    },
    formula: function (v) {
      return "m_n=m_0\\left(\\tfrac{1+e}{2}\\right)^{n}\\newline =100\\%\\cdot\\left(\\tfrac{1+" + Viz.n(v.e, 2) + "}{2}\\right)^{" + v.n + "}=" + pct(level(v.e, v.n)).replace("%", "\\%");
    },
    status: function (v) {
      var m = level(v.e, v.n), ep = v.e === 0 ? "no maintenance (DNMT1 blocked)" : Math.round(v.e * 100) + "% maintenance";
      if (v.n === 0) return "Before any division the promoter's CpGs are <b>100%</b> methylated and the gene is silenced.";
      if (v.e === 1) return "Perfect maintenance: DNMT1 re-methylates every new strand, so <b>100%</b> of the marks pass through " + v.n + " division" + (v.n > 1 ? "s" : "") + " and the gene stays silenced.";
      if (m >= 0.5) return "With " + ep + ", <b>" + pct(m) + "</b> of the marks survive " + v.n + " division" + (v.n > 1 ? "s" : "") + ", so the daughter cells inherit a silenced gene though its DNA sequence never changed.";
      return "With " + (v.e === 0 ? "" : "only ") + ep + " the marks dilute to <b>" + pct(m) + "</b> after " + v.n + " division" + (v.n > 1 ? "s" : "") + ", so the gene can switch back on, the way DNMT1-blocking drugs reactivate silenced genes.";
    },
    examples: [
      {name: "no maintenance: halves each division", values: {e: 0, n: 10}},
      {name: "perfect maintenance", values: {e: 1, n: 10}},
      {name: "before division", values: {e: 0.95, n: 0}},
      {name: "leaky copying crosses the line", values: {e: 0.7, n: 4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = level(v.e, v.n), prev = v.n ? level(v.e, v.n - 1) : 1;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var X = function (i) { return 34 + i * 33; }, yT = 52, yB = 86;
      var tmpl = v.n ? Math.round(10 * prev) : 10, copy = v.n ? Math.round(10 * prev * v.e) : 10;
      var onT = [], onB = [];
      for (var i = 0; i < 10; i++) { onT.push(ORDER.indexOf(i) < tmpl); onB.push(ORDER.indexOf(i) < copy); }
      // the duplex: two strands, base-pair rungs, a CpG lollipop on each strand at every site
      for (var x = 22; x <= 378; x += 8) api.line([x, yT + 3], [x, yB - 3], {color: c.faint, width: 1, opacity: 0.6});
      api.line([18, yT], [382, yT], {color: c.ink, width: 3});
      api.line([18, yB], [382, yB], {color: c.ink, width: 3, opacity: v.n ? 0.7 : 1});
      for (i = 0; i < 10; i++) {
        api.line([X(i), yT], [X(i), yT - 14], {color: c.ink, width: 1.6, opacity: 0.7});
        api.circle([X(i), yT - 20], 6, onT[i] ? {fill: c.c3} : {fill: c.card, stroke: c.muted, width: 1.5});
        api.line([X(i), yB], [X(i), yB + 14], {color: c.ink, width: 1.6, opacity: 0.7});
        api.circle([X(i), yB + 20], 6, onB[i] ? {fill: c.c3} : {fill: c.card, stroke: c.muted, width: 1.5});
      }
      L([24, 12], v.n ? "old strand (parent's marks)" : "parent: both strands marked", c.muted, {weight: 500});
      L([376, 12], "DNA sequence unchanged", c.muted, {anchor: "end", weight: 500});
      if (v.n) {
        L([24, 124], "new strand: DNMT1 copies " + Math.round(v.e * 100) + "% of the marks", c.c6, {weight: 500});
        var miss = -1;
        for (i = 0; i < 10; i++) if (onT[i] && !onB[i]) { miss = i; break; }
        var dx = miss >= 0 ? X(miss) : 358;   // parked past the last site once every mark is copied
        api.rect(dx - 22, yB - 8, 44, 16, {fill: c.c6, fillOpacity: 0.9, rx: 8});
        L([dx, yB], "DNMT1", c.card, {anchor: "middle", weight: 700});
      }
      // the verdict for this promoter
      var silent = m >= 0.5;
      L([24, 150], "promoter " + pct(m) + " methylated", c.c3);
      L([376, 150], silent ? "→ gene silenced" : "→ gene can switch on", silent ? c.c5 : c.c4, {anchor: "end", weight: 700});
      // the level after each division, this division solid, later ones faint (same e)
      var base = 280, top = 202, bx = function (k) { return 46 + k * 31.4; };
      L([24, 174], "methylation by division", c.muted, {weight: 500});
      L([376, 174], "silencing line (schematic)", c.c5, {anchor: "end", weight: 500});
      api.line([34, base], [372, base], {color: c.axis, width: 1.2});
      for (var k = 0; k <= 10; k++) {
        var mk = level(v.e, k), h = Math.max(1.5, (base - top) * mk);
        api.rect(bx(k) - 9, base - h, 18, h, {fill: k > v.n ? c.muted : c.c3, fillOpacity: k === v.n ? 1 : k < v.n ? 0.5 : 0.18, rx: 3});
        L([bx(k), base + 12], String(k), k === v.n ? c.c3 : c.muted, {anchor: "middle", weight: k === v.n ? 700 : 500});
      }
      var yh = base - (base - top) * 0.5;
      api.line([34, yh], [372, yh], {color: c.c5, width: 1.4, dash: "5 4"});
      L([30, yh], "50%", c.c5, {anchor: "end", weight: 500});
      L([30, top], "100%", c.muted, {anchor: "end", weight: 500});
      L([bx(v.n), base - (base - top) * m - 11], pct(m), c.c3, {anchor: "middle", weight: 700});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
