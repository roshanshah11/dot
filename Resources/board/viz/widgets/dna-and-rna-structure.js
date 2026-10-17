// DNA and RNA as polymers. DNA: two antiparallel strands on a deoxyribose backbone, bases A T G C, every base paired
// (A-T by 2 hydrogen bonds, G-C by 3), twisted into a double helix. RNA: one strand on a ribose backbone (an -OH on
// every 2' carbon), U in place of T, paired only where it folds back on itself; here a hairpin: an n-pair stem closed
// by a GAAA loop. Hydrogen bonds H = 2 n_AT + 3 n_GC. The G-C positions are chosen by a fixed order so the sequence
// changes smoothly with the G-C share. Colors: green A, red T, purple U, amber G, blue C, teal = the 2'-OH.
(function () {
  var PRI = [3, 8, 0, 10, 5, 1, 11, 6, 2, 9, 4, 7];   // which positions turn G-C first
  function seq(v) {
    var g = Math.round(v.gc / 100 * v.n), rna = v.molecule === "RNA", top = [];
    var gcSet = PRI.filter(function (p) { return p < v.n; }).slice(0, g);
    for (var i = 0; i < v.n; i++) {
      var flip = (i * 7 + 3) % 5 < 2;
      top.push(gcSet.indexOf(i) >= 0 ? (flip ? "C" : "G") : (flip ? (rna ? "U" : "T") : "A"));
    }
    return {top: top, g: g, at: v.n - g};
  }
  var PAIR = {DNA: {A: "T", T: "A", G: "C", C: "G"}, RNA: {A: "U", U: "A", G: "C", C: "G"}};
  Viz.register("dna-and-rna-structure", {
    title: "DNA and RNA structure",
    subject: "biology",
    shows: "Switch between DNA and RNA: two antiparallel strands versus one strand that folds back on itself; slide the G–C share to see the hydrogen bonds add up",
    params: {
      molecule: {kind: "enum", values: ["DNA", "RNA"], default: "DNA", label: "\\text{molecule}"},
      n: {kind: "integer", default: 8, min: 4, max: 12, label: "n\\ (\\text{bp})"},
      gc: {kind: "number", default: 50, min: 0, max: 100, step: 10, label: "\\text{GC}\\ \\%"}
    },
    formula: function (v) {
      var s = seq(v), au = v.molecule === "RNA" ? "AU" : "AT";
      return "H=2\\,n_{\\text{" + au + "}}+3\\,n_{\\text{GC}}=2\\cdot" + s.at + "+3\\cdot" + s.g + "=" + (2 * s.at + 3 * s.g);
    },
    status: function (v) {
      var s = seq(v), H = 2 * s.at + 3 * s.g, rna = v.molecule === "RNA";
      if (rna) return "One strand folds back: its <b>" + v.n + "</b>-pair stem has " + s.g + " G–C and " + s.at + " A–U pairs, <b>" + H + "</b> hydrogen bonds, while the 4-base loop stays unpaired.";
      return "Two antiparallel strands, <b>" + v.n + "</b> base pairs: " + s.g + " G–C (3 H-bonds each) and " + s.at + " A–T (2 each) make <b>" + H + "</b> hydrogen bonds" +
        (s.g === v.n ? ", the most this length can have." : s.g === 0 ? ", the fewest this length can have." : ".");
    },
    examples: [
      {name: "short, all A–T", values: {n: 4, gc: 0}},
      {name: "long, all G–C", values: {n: 12, gc: 100}},
      {name: "RNA hairpin", values: {molecule: "RNA", n: 6, gc: 50}},
      {name: "long RNA stem", values: {molecule: "RNA", n: 12, gc: 30}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, rna = v.molecule === "RNA", s = seq(v), n = v.n;
      var COL = {A: c.c4, T: c.c5, U: c.c6, G: c.c3, C: c.c2};
      var sp = Math.min(28, (rna ? 270 : 316) / n), cx = rna ? 172 : 200, yT = 64, yB = 168;
      var X = function (i) { return cx - (n - 1) / 2 * sp + i * sp; };
      var base = function (at, b, up) {
        api.rect(at[0] - 8, at[1] - 10, 16, 20, {fill: COL[b], fillOpacity: 0.22, stroke: COL[b], width: 1.3, rx: 4});
        api.label(at, b, {color: COL[b], size: 12.5, weight: 700, anchor: "middle"});
        api.line([at[0], up ? at[1] - 10 : at[1] + 10], [at[0], up ? yT : yB], {color: COL[b], width: 1.6, opacity: 0.7});
      };
      // backbones
      var xa = X(0) - sp / 2, xb = X(n - 1) + (rna ? 0 : sp / 2);
      api.line([xa, yT], [xb, yT], {color: c.ink, width: 3, opacity: 0.7});
      api.line([xa, yB], [xb, yB], {color: c.ink, width: 3, opacity: 0.7});
      for (var i = 0; i < n; i++) {
        var b = s.top[i], p = PAIR[v.molecule][b];
        base([X(i), yT + 26], b, true);
        base([X(i), yB - 26], p, false);
        var hb = (b === "G" || b === "C") ? 3 : 2;
        for (var h = 0; h < hb; h++) { var hx = X(i) + (h - (hb - 1) / 2) * 4.5; api.line([hx, yT + 39], [hx, yB - 39], {color: c.muted, width: 1.4, dash: "2 2.5"}); }
        [yT, yB].forEach(function (y) {
          api.circle([X(i), y], 3.6, {fill: c.card, stroke: c.ink, width: 1.4});
          if (rna) api.label([X(i) + 7, y + (y === yT ? -9 : 9)], "OH", {color: c.c1, size: 12, weight: 600});
        });
      }
      api.label([xa - 4, yT], "5′", {color: c.ink, size: 12.5, weight: 650, anchor: "end"});
      api.label([xa - 4, yB], "3′", {color: c.ink, size: 12.5, weight: 650, anchor: "end"});
      if (!rna) {
        api.label([xb + 4, yT], "3′", {color: c.ink, size: 12.5, weight: 650});
        api.label([xb + 4, yB], "5′", {color: c.ink, size: 12.5, weight: 650});
      } else {
        // GAAA loop closing the hairpin
        var r = (yB - yT) / 2, ox = xb, oy = (yT + yB) / 2;
        api.path("M " + ox + " " + yT + " A " + r + " " + r + " 0 0 1 " + ox + " " + yB, {stroke: c.ink, width: 3, opacity: 0.7});
        "GAAA".split("").forEach(function (b, k) {
          var a = -Math.PI / 2 + Math.PI * (k + 1) / 5, at = [ox + r * Math.cos(a), oy + r * Math.sin(a)];
          api.circle(at, 9, {fill: c.card, stroke: COL[b], width: 1.4});
          api.label(at, b, {color: COL[b], size: 12, weight: 700, anchor: "middle"});
          api.label([ox + (r + 20) * Math.cos(a), oy + (r + 18) * Math.sin(a)], "OH", {color: c.c1, size: 12, weight: 600, anchor: "middle"});
        });
        api.label([ox + r * 0.55, oy], "loop", {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([16, 30], rna ? "one sugar–phosphate backbone" : "two sugar–phosphate backbones, wound into a double helix", {color: c.ink, size: 12, opacity: 0.8});
      api.label([16, 196], rna ? "one strand folds back; OH = the 2′-OH on every ribose" : "two strands, antiparallel; dashes = hydrogen bonds", {color: rna ? c.c1 : c.muted, size: 12});
      // the comparison table, active column bright
      var rows = [["strands", "two, antiparallel", "one (folds back)"], ["sugar", "deoxyribose (2′-H)", "ribose (2′-OH)"],
                  ["bases", "A  T  G  C", "A  U  G  C"], ["pairs", "A–T, G–C", "A–U, G–C"]];
      api.rect(rna ? 252 : 108, 210, 140, 84, {fill: c.ink, fillOpacity: 0.06, rx: 8});
      api.label([116, 220], "DNA", {color: rna ? c.muted : c.ink, size: 12.5, weight: 700});
      api.label([260, 220], "RNA", {color: rna ? c.ink : c.muted, size: 12.5, weight: 700});
      rows.forEach(function (row, k) {
        var y = 238 + k * 17;
        api.label([16, y], row[0], {color: c.muted, size: 12});
        api.label([116, y], row[1], {color: rna ? c.muted : c.ink, size: 12, opacity: rna ? 0.7 : 1});
        api.label([260, y], row[2], {color: rna ? c.ink : c.muted, size: 12, opacity: rna ? 1 : 0.7});
      });
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
