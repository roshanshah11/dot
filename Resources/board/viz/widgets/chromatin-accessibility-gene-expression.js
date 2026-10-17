// One gene's promoter, nucleosome by nucleosome. Histone tails carry positively charged lysines that grip the negatively
// charged DNA; HATs add acetyl groups that cancel the charge, so the nucleosomes loosen and slide off the promoter
// (open chromatin, a peak in an ATAC-seq style accessibility track), and HDACs take them off again. Methylated CpGs in
// the promoter recruit methyl-binding proteins such as MeCP2, which bring HDACs and compact the region whatever the
// HATs do. Open chromatin is necessary but not sufficient: an activator still has to bind and recruit RNA polymerase II.
(function () {
  function state(v) {
    var open = v.acetyl === "acetylated" && !v.cpg;
    return {open: open, on: open && v.activator};
  }
  Viz.register("chromatin-accessibility-gene-expression", {
    title: "Chromatin accessibility and gene expression",
    subject: "biology",
    shows: "Acetylate or deacetylate the histones, methylate the promoter, add or remove the activator: the gene is transcribed only when its promoter is open and an activator binds",
    params: {
      acetyl: {kind: "enum", values: ["acetylated", "deacetylated"], default: "acetylated", label: "\\text{histones}",
        names: {acetylated: "HAT: acetylated", deacetylated: "HDAC: deacetylated"}},
      cpg: {kind: "boolean", default: false, label: "\\text{CpG}", on: "methylated", off: "unmethylated"},
      activator: {kind: "boolean", default: true, label: "\\text{activator}", on: "present", off: "absent"}
    },
    formula: function (v) {
      var st = state(v);
      if (v.cpg) return "\\text{5-methyl-CpG}\\to\\text{MeCP2}\\to\\text{HDAC}\\newline\\to\\text{compact chromatin}\\to\\text{no mRNA}";
      if (!st.open) return "\\text{Lys-Ac}\\xrightarrow{\\text{HDAC}}\\text{Lys}^{+}\\text{ grips DNA}^{-}\\newline\\to\\text{promoter covered}\\to\\text{no mRNA}";
      return "\\text{Lys}^{+}\\xrightarrow{\\text{HAT}}\\text{Lys-Ac (neutral)}\\newline" + (st.on ? "\\to\\text{open}\\to\\text{activator}+\\text{Pol II}\\to\\text{mRNA}" : "\\to\\text{open, no activator}\\to\\text{no mRNA}");
    },
    status: function (v) {
      var st = state(v);
      if (st.on) return "Acetyl groups cancel the lysines' + charge, so the histones loosen their grip: the promoter is <b>open</b>, the activator binds and Pol II makes <b>mRNA</b>.";
      if (st.open) return "The promoter is <b>open</b>, but no activator is there to recruit Pol II, so the gene stays <b>silent</b>: open chromatin is needed, not enough.";
      if (v.cpg) return "Methylated CpGs recruit MeCP2, which brings in HDACs" + (v.acetyl === "acetylated" ? " even with HATs at work" : "") +
        ": the nucleosomes pack tight and the gene is <b>locked off</b>" + (v.activator ? ", activator or not." : ".");
      return "With the acetyls stripped, the positive lysines grip the negative DNA and nucleosomes pack over the promoter: " +
        (v.activator ? "the activator <b>cannot reach</b> its site" : "the promoter is <b>closed</b>") + ", so there is <b>no mRNA</b>.";
    },
    examples: [
      {name: "open and transcribed", values: {acetyl: "acetylated", cpg: false, activator: true}},
      {name: "open, no activator", values: {acetyl: "acetylated", cpg: false, activator: false}},
      {name: "deacetylated: closed", values: {acetyl: "deacetylated", cpg: false, activator: true}},
      {name: "methylated promoter", values: {acetyl: "acetylated", cpg: true, activator: true}},
      {name: "everything off", values: {acetyl: "deacetylated", cpg: true, activator: false}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, st = state(v), y = 112, R = 13, ac = v.acetyl === "acetylated" && !v.cpg;
      // ---- the enzyme the cell is using on the histone tails ----
      var hat = v.acetyl === "acetylated";
      api.rect(12, 12, 46, 20, {fill: hat ? c.c4 : c.c2, fillOpacity: 0.85, rx: 10});
      api.label([35, 22.5], hat ? "HAT" : "HDAC", {color: c.card, size: 12, weight: 700, anchor: "middle"});
      api.label([64, 22], hat ? (v.cpg ? "adds acetyls, but MeCP2's HDACs remove them" : "adds acetyl groups to lysines") : "removes acetyl groups", {color: hat ? c.c4 : c.c2, size: 12});
      // ---- DNA, gene and nucleosomes ----
      var tss = 244;
      api.line([12, y], [388, y], {color: c.muted, width: 2.2});
      api.line([tss, y - 2], [tss, y - 34], {color: c.ink, width: 1.6});
      api.line([tss, y - 34], [tss + 22, y - 34], {color: c.ink, width: 1.6, arrow: true});
      api.label([tss + 28, y - 34], "gene", {color: c.ink, size: 12.5, weight: 650});
      if (!v.cpg) api.label([196, y + 30], st.open ? "promoter: open" : "promoter: covered", {color: st.open ? c.c1 : c.muted, size: 12, anchor: "middle"});
      else {
        api.label([388, y + 40], "compacted", {color: c.c6, size: 12, weight: 650, anchor: "end"});
      }
      var xs = st.open ? [36, 86, 136, 292, 346] : [30, 58, 86, 114, 142, 170, 198, 226, 254, 282, 310, 338, 366];
      xs.forEach(function (x, k) {
        api.circle([x, y], R, {fill: c.c6, fillOpacity: st.open ? 0.45 : 0.8, stroke: c.ink, width: 1.2, opacity: 0.95});
        [-1, 1].forEach(function (sd) {
          var a = [x + sd * 6, y - R + 3], b = [x + sd * 13, y - R - 9];
          api.line(a, b, {color: c.ink, width: 1.2, opacity: 0.7});
          if (ac) api.circle(b, 3.2, {fill: c.c4});
          else { api.line([b[0] - 3, b[1]], [b[0] + 3, b[1]], {color: c.c2, width: 1.6}); api.line([b[0], b[1] - 3], [b[0], b[1] + 3], {color: c.c2, width: 1.6}); }
        });
      });
      // the activator: bound on an open promoter, shut out of a closed one, missing when absent
      var site = 190;
      if (v.activator) {
        if (st.open) api.rect(site - 13, y - 9, 26, 18, {fill: c.c3, rx: 7});
        else { api.rect(site - 13, 46, 26, 18, {fill: c.c3, rx: 7}); api.line([site, 66], [site, y - R - 12], {color: c.c3, width: 1.5, dash: "3 3"}); api.label([site + 18, 55], "activator: cannot bind", {color: c.c3, size: 12}); }
      } else if (st.open) api.rect(site - 13, y - 9, 26, 18, {stroke: c.faint, width: 1.2, dash: "3 3", rx: 7});
      if (st.open) api.label([site, y - 18], v.activator ? "activator" : "empty site", {color: v.activator ? c.c3 : c.muted, size: 12, anchor: "middle"});
      if (st.on) { api.rect(tss - 6, y - 10, 34, 20, {fill: c.ink, fillOpacity: 0.85, rx: 9}); api.label([tss + 11, y + 0.5], "Pol II", {color: c.card, size: 12, weight: 700, anchor: "middle"}); }
      // methylated CpGs and the reader that brings HDACs
      if (v.cpg) {
        [176, 196, 216, 234].forEach(function (x) { api.line([x, y + R], [x, y + R + 9], {color: c.c5, width: 1.4}); api.circle([x, y + R + 12], 3.2, {fill: c.c5}); });
        api.rect(130, y + 31, 132, 18, {fill: c.c2, fillOpacity: 0.25, stroke: c.c2, width: 1, rx: 9});
        api.label([196, y + 40.5], "MeCP2 + HDAC", {color: c.c2, size: 12, weight: 650, anchor: "middle"});
      }
      // ---- accessibility track and the transcript it allows ----
      var base = 222;
      api.line([12, base], [388, base], {color: c.axis, width: 1});
      api.label([12, 180], "accessibility", {color: c.c1, size: 12});
      var d = "M 12 " + base;
      for (var x = 12; x <= 388; x += 3) {
        var h = st.open ? 44 * Math.exp(-Math.pow(x - 200, 2) / 900) + 6 * Math.exp(-Math.pow(x - 318, 2) / 60) + 6 * Math.exp(-Math.pow(x - 112, 2) / 60) : 0;
        d += " L " + x + " " + (base - h - 1.5 - 1.2 * Math.abs(Math.sin(x * 0.37))).toFixed(1);
      }
      api.path(d + " L 388 " + base + " Z", {fill: c.c1, fillOpacity: 0.3, stroke: c.c1, width: 1.4});
      if (st.on) {
        for (var m = 0; m < 3; m++) {
          var p = "M " + (262 + m * 40) + " 248"; for (var k = 1; k <= 8; k++) p += " Q " + (262 + m * 40 + k * 4 - 2) + " " + (248 + (k % 2 ? -4 : 4)) + " " + (262 + m * 40 + k * 4) + " 248";
          api.path(p, {stroke: c.c4, width: 2.2});
        }
        api.label([250, 248], "mRNA", {color: c.c4, size: 12.5, weight: 650, anchor: "end"});
      } else api.label([388, 248], "no mRNA", {color: c.muted, size: 12.5, anchor: "end"});
      // key
      api.line([16, 282], [22, 282], {color: c.c2, width: 1.6}); api.line([19, 279], [19, 285], {color: c.c2, width: 1.6});
      api.label([28, 282], "lysine (+)", {color: c.muted, size: 12});
      api.circle([98, 282], 3.2, {fill: c.c4}); api.label([106, 282], "acetyl", {color: c.muted, size: 12});
      api.circle([164, 282], 3.2, {fill: c.c5}); api.label([172, 282], "methyl-CpG", {color: c.muted, size: 12});
      api.circle([262, 282], 6, {fill: c.c6, fillOpacity: 0.7}); api.label([272, 282], "nucleosome", {color: c.muted, size: 12});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
