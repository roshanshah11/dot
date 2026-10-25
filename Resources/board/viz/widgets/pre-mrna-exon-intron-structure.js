// The anatomy of a pre-mRNA (the primary transcript, capped but not yet spliced). Exons are the pieces that stay in the
// mRNA; introns are cut out. Exon 1 starts with the 5' UTR, the coding sequence (CDS) runs from the AUG start codon in
// exon 1 to the stop codon in the last exon, and the last exon ends with the 3' UTR and its AAUAAA poly(A) signal.
// Every intron is marked by the same short signals: GU at its 5' end (consensus GURAGU), a branch-point A about 18-40 nt
// before its 3' end (mammalian consensus YNYURAY, here CUCUAAC with the second-to-last A), a polypyrimidine tract, and
// AG at its 3' end. Model lengths (nt): exon 1 = 80 UTR + 99 CDS, internal exons 141, 120, 159, 111, 150, 132, last
// exon = 120 CDS + 600 UTR; every CDS piece is a multiple of 3 so the CDS is whole codons. Human internal exons average
// about 150 nt while introns run from under 100 nt to hundreds of kb (median about 1.5 kb), so most of a pre-mRNA is intron.
(function () {
  var UTR5 = 80, CDS1 = 99, MID = [141, 120, 159, 111, 150, 132], CDSN = 120, UTR3 = 600;
  function model(v) {
    var ex = [UTR5 + CDS1].concat(MID.slice(0, v.exons - 2), [CDSN + UTR3]);
    var exSum = ex.reduce(function (a, b) { return a + b; }, 0), nIn = v.exons - 1, inSum = nIn * v.intron;
    var cds = CDS1 + MID.slice(0, v.exons - 2).reduce(function (a, b) { return a + b; }, 0) + CDSN;
    return {ex: ex, exSum: exSum, nIn: nIn, inSum: inSum, pre: exSum + inSum, cds: cds};
  }
  function num(x) { return Math.round(x).toLocaleString("en-US"); }
  function tex(x) { return num(x).replace(/,/g, "{,}"); }
  Viz.register("pre-mrna-exon-intron-structure", {
    title: "Pre-mRNA: exons, introns and their signals",
    subject: "biology",
    shows: "Set the exon count and intron length: drawn to scale, introns take up most of the pre-mRNA, and every intron carries the same GU, branch-point A and AG signals the spliceosome reads",
    params: {
      exons: {kind: "integer", default: 4, min: 2, max: 8, label: "\\text{exons}"},
      intron: {kind: "integer", default: 1500, min: 100, max: 10000, step: 100, label: "\\text{intron}"}
    },
    formula: function (v) {
      var m = model(v);
      return "\\small\\begin{array}{l}L_{\\text{pre}}=" + tex(m.exSum) + "+" + m.nIn + "\\times" + tex(v.intron) + "=" + tex(m.pre) + "\\text{ nt}\\\\" +
        "\\text{CDS}=" + tex(m.cds) + "\\text{ nt}=" + (m.cds / 3 - 1) + "\\text{ codons}+\\text{stop}\\end{array}";
    },
    status: function (v) {
      var m = model(v), share = Math.round(100 * m.inSum / m.pre);
      return v.exons + " exons and " + m.nIn + " intron" + (m.nIn > 1 ? "s" : "") + ": introns are <b>" + share + "%</b> of the " + num(m.pre) +
        "-nt pre-mRNA, and splicing keeps only the <b>" + num(m.exSum) + " nt</b> of exons" + (share < 50 ? " (short introns like these are the exception in human genes)." : ".");
    },
    examples: [
      {name: "two exons, shortest intron", values: {exons: 2, intron: 100}},
      {name: "eight exons, 10 kb introns", values: {exons: 8, intron: 10000}},
      {name: "typical human gene", values: {exons: 6, intron: 1500}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v), x0 = 30, x1 = 380, W = x1 - x0;
      var L = function (at, t, o) { return api.label(at, t, Object.assign({size: 12, color: c.muted}, o || {})); };
      // ---- 1. to scale
      var yS = 44, k = W / m.pre, x = x0;
      L([x0 - 18, yS - 24], "to scale: " + num(m.pre) + " nt");
      api.line([x0, yS], [x1, yS], {color: c.c5, width: 1.6, opacity: 0.8});
      m.ex.forEach(function (len, i) {
        var w = Math.max(2, len * k);
        api.rect(x, yS - 7, w, 14, {fill: c.c1, rx: 2});
        x += len * k + (i < m.nIn ? v.intron * k : 0);
      });
      L([x1, yS + 20], "exons " + Math.round(100 * m.exSum / m.pre) + "%   introns " + Math.round(100 * m.inSum / m.pre) + "%", {anchor: "end", color: c.ink});
      L([x0 - 18, yS + 20], "5′", {color: c.ink});
      // ---- 2. the same gene with introns shortened, so the exon contents show
      var yE = 128, gap = Math.min(44, 150 / m.nIn), kE = (W - 16 - gap * m.nIn) / m.exSum, pos = [], xe = x0 + 16;
      L([x0 - 18, yE - 46], "introns shortened; UTRs thin, coding thick");
      api.circle([x0 + 7, yE], 7, {fill: c.c6, fillOpacity: 0.9});
      L([x0 + 7, yE + 19], "cap", {color: c.c6, anchor: "middle"});
      m.ex.forEach(function (len, i) {
        var w = len * kE, seg = {x: xe, w: w};
        if (i === 0) {   // 5' UTR (thin) then CDS
          var u = UTR5 * kE;
          api.rect(xe, yE - 4, u, 8, {fill: c.c1, fillOpacity: 0.45, rx: 1});
          api.rect(xe + u, yE - 8, w - u, 16, {fill: c.c1, rx: 2});
          api.line([xe + u, yE - 10], [xe + u, yE - 22], {color: c.c4, width: 1.6});
          L([xe + u, yE - 29], "AUG", {color: c.c4, anchor: "middle", weight: 650});
        } else if (i === m.ex.length - 1) {   // CDS then 3' UTR (thin) with the poly(A) signal near its end
          var cw = CDSN * kE;
          api.rect(xe, yE - 8, cw, 16, {fill: c.c1, rx: 2});
          api.rect(xe + cw, yE - 4, w - cw, 8, {fill: c.c1, fillOpacity: 0.45, rx: 1});
          api.line([xe + cw, yE - 10], [xe + cw, yE - 22], {color: c.c5, width: 1.6});
          L([xe + cw, yE - 29], "stop", {color: c.c5, anchor: "middle", weight: 650});
          L([xe + w - 4, yE + 17], "AAUAAA", {color: c.c3, anchor: "end"});
          L([xe + w + 4, yE], "3′", {color: c.ink});
        } else api.rect(xe, yE - 8, w, 16, {fill: c.c1, rx: 2});
        if (w >= 9) L([xe + (i === 0 ? (UTR5 + w / kE) / 2 * kE : i === m.ex.length - 1 ? CDSN * kE / 2 : w / 2), yE], String(i + 1), {color: c.card, anchor: "middle", weight: 700});
        pos.push(seg); xe += w;
        if (i < m.nIn) {
          api.path("M " + xe + " " + yE + " Q " + (xe + gap / 2) + " " + (yE + 16) + " " + (xe + gap) + " " + yE, {stroke: c.c5, width: 1.6});
          xe += gap;
        }
      });
      // ---- 3. zoom on intron 1: the signals the spliceosome reads
      var segs = [["…CA", c.c1, 500], ["G", c.c1, 500], ["|", null], ["GU", c.c3, 800], ["AAGU", c.c3, 500], [" ", null], ["//", c.muted, 500], [" ", null],
                  ["CUCUA", c.muted, 500], ["A", c.c5, 800], ["C", c.muted, 500], ["··", c.muted, 500], ["UUUCCUUUCUUU", c.c2, 500], ["C", c.muted, 500], ["AG", c.c3, 800], ["|", null], ["G…", c.c1, 500]];
      var yZ = 240, step = 8.6, cx = 22, at = {};
      segs.forEach(function (sg, si) {
        if (sg[0] === "|") { api.line([cx + 1, yZ - 11], [cx + 1, yZ + 11], {color: c.ink, width: 1.5}); at["bar" + si] = cx + 1; cx += 3; return; }
        at[si] = [cx, cx + sg[0].length * step];
        sg[0].split("").forEach(function (ch) {
          if (sg[1]) { var t = L([cx + step / 2, yZ], ch, {color: sg[1], weight: sg[2], anchor: "middle", size: 13.5}); t.style.fontFamily = "Menlo, monospace"; }
          cx += step;
        });
      });
      var p1 = pos[0].x + pos[0].w, p2 = pos[1].x;
      api.line([p1, yE + 4], [at.bar2, yZ - 14], {color: c.faint, width: 1, dash: "3 3"});
      api.line([p2, yE + 4], [at.bar15, yZ - 14], {color: c.faint, width: 1, dash: "3 3"});
      L([(at[6][0] + at[6][1]) / 2 + 2, yZ - 24], "intron 1: " + num(v.intron) + " nt", {color: c.ink, anchor: "middle"});
      var mid = function (si) { return (at[si][0] + at[si][1]) / 2; };
      L([mid(3) + 10, yZ + 19], "5′ splice site", {color: c.c3, anchor: "middle"});
      L([mid(9), yZ + 19], "branch-point A", {color: c.c5, anchor: "middle"});
      L([at[14][1] + 4, yZ + 19], "3′ splice site", {color: c.c3, anchor: "end"});
      L([mid(12), yZ + 36], "polypyrimidine tract", {color: c.c2, anchor: "middle"});
      api.line([mid(9), yZ - 14], [at[14][1], yZ - 14], {color: c.c5, width: 1.2});
      L([(mid(9) + at[14][1]) / 2 + 30, yZ - 24], "18–40 nt", {color: c.c5, anchor: "middle"});
      // viz.css paints svg text ink; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
