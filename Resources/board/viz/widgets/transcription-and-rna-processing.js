// A eukaryotic gene from DNA to exported mRNA. RNA polymerase II copies the whole gene, exons and introns, into a
// pre-mRNA. A 7-methylguanosine (m7G) cap goes on the 5' end; the RNA is cut about 10-30 nt past the AAUAAA signal in the
// last exon and given a poly(A) tail of about 200 A's; the spliceosome cuts each intron out (GU at its 5' end, AG at its
// 3' end) as a lariat and joins the exons; the finished mRNA leaves through a nuclear pore. In the cell these overlap with
// transcription; here they are taken one at a time. The first exon carries the 5' UTR and the last the 3' UTR, so the
// mature length is the sum of the exons. Exon lengths are fixed; the intron length slider sets every intron.
(function () {
  var MID = [150, 120], FIRST = 200, LAST = 230, PAST = 80, TAIL = 200;
  function model(v) {
    var ex = [FIRST].concat(MID.slice(0, v.exons - 2), [LAST]), nIn = v.exons - 1, exSum = ex.reduce(function (a, b) { return a + b; }, 0);
    var pre = exSum + nIn * v.intron;
    return {ex: ex, nIn: nIn, exSum: exSum, pre: pre, share: nIn * v.intron / pre};
  }
  function num(x) { return Math.round(x).toLocaleString("en-US"); }
  Viz.register("transcription-and-rna-processing", {
    title: "Transcription and RNA processing",
    subject: "biology",
    shows: "Step from gene to exported mRNA: the pre-mRNA copies exons and introns, gets a 5′ cap and a poly(A) tail, and splicing cuts the introns out; slide the intron length",
    params: {
      exons: {kind: "integer", default: 3, min: 2, max: 4, label: "\\text{exons}"},
      intron: {kind: "integer", default: 600, min: 100, max: 2000, step: 50, label: "\\text{intron}"}
    },
    steps: ["transcription makes the pre-mRNA", "a 5′ cap is added", "cleavage and a poly(A) tail", "splicing removes the introns", "export to the cytoplasm"],
    stepMs: 1800,
    formula: function (v) {
      var m = model(v);
      return "\\small\\begin{array}{l}\\text{pre-mRNA} = " + m.exSum + " + " + m.nIn + "\\times" + v.intron + " = " + num(m.pre).replace(/,/g, "{,}") + "\\text{ nt}\\\\" +
        "\\text{mRNA} = \\text{cap} + " + m.exSum + "\\text{ nt} + \\text{A}_{\\sim " + TAIL + "}\\end{array}";
    },
    status: function (v) {
      var m = model(v), s = v.step || 1;
      if (s === 1) return "RNA polymerase II copies the whole gene, <b>" + v.exons + " exons and " + m.nIn + " intron" + (m.nIn > 1 ? "s" : "") + "</b>, into a pre-mRNA of " + num(m.pre) + " nt (plus a stretch past the end).";
      if (s === 2) return "A <b>7-methylguanosine cap</b> is joined to the 5′ end by a 5′-to-5′ triphosphate bridge; it shields the RNA from 5′ exonucleases and later helps the ribosome find it.";
      if (s === 3) return "The RNA is cut about 20 nt past the <b>AAUAAA</b> signal in the last exon, and poly(A) polymerase adds a tail of about <b>" + TAIL + " A's</b>.";
      if (s === 4) return "The spliceosome cuts out " + (m.nIn > 1 ? "the " + m.nIn + " introns as lariats" : "the intron as a lariat") + ", <b>" + num(m.nIn * v.intron) + " nt</b> or " + Math.round(m.share * 100) + "% of the transcript, and joins the exons into <b>" + num(m.exSum) + " nt</b> of message.";
      return "The capped, tailed, spliced mRNA leaves through a <b>nuclear pore</b>; in the cytoplasm the ribosome binds near the cap and translates it.";
    },
    examples: [
      {name: "two exons, short intron", values: {exons: 2, intron: 100, step: 4}},
      {name: "four exons, long introns", values: {exons: 4, intron: 2000, step: 4}},
      {name: "the pre-mRNA", values: {exons: 3, intron: 600, step: 1}},
      {name: "exported", values: {exons: 3, intron: 900, step: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v), s = v.step || 1, x0 = 44, W = 316, k = W / (m.pre + TAIL), yG = 64, yR = 150, yN = 236;
      // segment layout along the gene, nt -> px (room is kept for the 200-nt tail); exons at least 12 px wide so short ones show
      var segs = [], x = x0;
      m.ex.forEach(function (L, i) {
        var w = Math.max(12, L * k); segs.push({kind: "exon", i: i, x: x, w: w, L: L}); x += w;
        if (i < m.nIn) { var wi = Math.max(10, v.intron * k); segs.push({kind: "intron", x: x, w: wi, L: v.intron}); x += wi; }
      });
      var tl = Math.max(30, TAIL * k), scale = Math.min(1, (W - tl) / (x - x0));   // squeeze back into the width if the minimums pushed it
      segs.forEach(function (q) { q.x = x0 + (q.x - x0) * scale; q.w *= scale; });
      var geneEnd = x0 + (x - x0) * scale, past = Math.max(14, PAST * k);
      var exonBox = function (q, xx, y) {
        api.rect(xx, y - 8, q.w, 16, {fill: c.c1, fillOpacity: 0.85, rx: 3});
        if (q.w >= 14) api.label([xx + q.w / 2, y], String(q.i + 1), {color: c.card, size: 12, weight: 700, anchor: "middle"});
      };
      // the gene
      api.line([x0 - 14, yG], [geneEnd + past + 8, yG], {color: c.faint, width: 2});
      api.line([x0, yG - 9], [x0, yG - 24], {color: c.ink, width: 1.8});
      api.arrow([x0, yG - 24], [x0 + 22, yG - 24], {color: c.ink, width: 1.8, halo: false, head: 7});
      api.label([x0 + 28, yG - 24], "promoter", {color: c.ink, size: 12});
      api.label([x0 - 14, yG + 22], "gene (DNA): exons teal, introns between", {color: c.muted, size: 12});
      segs.forEach(function (q) { if (q.kind === "exon") exonBox(q, q.x, yG); });
      // the RNA as it is processed
      var drawCapTail = function (xs, xe, y, capLeft) {   // capLeft: the cap's label sits left of it (in the cytoplasm row)
        if (s >= 2) {
          api.circle([xs - 9, y], 7, {fill: c.c6, fillOpacity: 0.85});
          api.label(capLeft ? [xs - 22, y] : [xs - 9, y - 18], "m^7G cap", {color: c.c6, size: 12, weight: 650, anchor: capLeft ? "end" : "start"});
        }
        if (s >= 3) {
          api.line([xe + 1, y], [xe + tl, y], {color: c.c3, width: 4});
          api.label([xe + tl / 2, y + 17], "AAA…A", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
        }
      };
      if (s <= 3) {
        api.label([x0 + (s >= 2 ? 62 : -14), yR - 30], "pre-mRNA, " + num(m.pre) + " nt" + (s < 3 ? " + run-on" : ""), {color: c.muted, size: 12});
        segs.forEach(function (q) {
          if (q.kind === "exon") { exonBox(q, q.x, yR); return; }
          api.rect(q.x, yR - 3, q.w, 6, {fill: c.c5, fillOpacity: 0.65, rx: 2});
          if (q.w >= 44) api.label([q.x + q.w / 2, yR + 16], "GU…AG", {color: c.c5, size: 12, anchor: "middle"});
        });
        if (s < 3) api.line([geneEnd, yR], [geneEnd + past, yR], {color: c.c1, width: 3, opacity: 0.45});
        else {   // the run-on piece past the cleavage site drifts off and is degraded
          api.line([geneEnd + 10, yR - 22], [geneEnd + 10 + past, yR - 30], {color: c.c1, width: 3, opacity: 0.3});
          api.label([geneEnd + 12 + past, yR - 44], "cut off", {color: c.muted, size: 12, anchor: "end"});
          api.label([geneEnd - 4, yR - 18], "AAUAAA", {color: c.c3, size: 12, anchor: "end"});
        }
        drawCapTail(x0, geneEnd, yR);
      } else {
        // spliced: exons butt together, at the same scale (named once in the caption: long introns leave exons too thin to number)
        var y = s === 4 ? yR : yN + 38, xs = s === 4 ? x0 : 100, xx = xs;   // step 5: below the envelope; caption beside the pore arrow
        api.label(s === 4 ? [xs + 62, y - 30] : [212, yN + 16], "mRNA, " + m.ex.length + " exons, " + num(m.exSum) + " nt + tail", {color: c.muted, size: 12});
        segs.filter(function (q) { return q.kind === "exon"; }).forEach(function (q) { exonBox(q, xx, y); xx += q.w; });
        drawCapTail(xs, xx, y, s === 5);
        if (s === 4) {   // the removed introns, as lariats, on a row of their own under the spliced mRNA
          var yL = yR + 44, lx0 = x0 + 9;
          for (var j = 0; j < m.nIn; j++) {
            var lx = lx0 + j * 46;
            api.circle([lx, yL], 9, {stroke: c.c5, width: 2});
            api.line([lx + 9, yL], [lx + 22, yL + 8], {color: c.c5, width: 2});
          }
          api.label([lx0 + (m.nIn - 1) * 46 + 32, yL], m.nIn > 1 ? m.nIn + " introns out as lariats" : "the intron out as a lariat", {color: c.c5, size: 12});
        }
      }
      // the nuclear envelope with a pore
      api.line([10, yN], [186, yN], {color: c.faint, width: 3}); api.line([214, yN], [390, yN], {color: c.faint, width: 3});
      api.line([186, yN - 7], [186, yN + 7], {color: c.faint, width: 3}); api.line([214, yN - 7], [214, yN + 7], {color: c.faint, width: 3});
      api.label([12, yN - 13], "nucleus", {color: c.muted, size: 12});
      api.label([12, yN + 15], "cytoplasm", {color: c.muted, size: 12});
      api.label([222, yN - 13], "nuclear pore", {color: c.muted, size: 12});
      if (s === 5) api.arrow([200, yR], [200, yN + 8], {color: c.c6, width: 2, halo: false, head: 8});   // from where it was processed, out through the pore
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
