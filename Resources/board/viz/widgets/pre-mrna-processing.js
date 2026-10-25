// Pre-mRNA processing as it really happens, while RNA polymerase II is still moving along the gene. (1) When the RNA is
// 20-30 nt long, capping enzymes riding on Pol II's phosphorylated tail (CTD) cap the 5' end: a triphosphatase removes one
// phosphate, guanylyltransferase adds GMP from GTP in a 5'-to-5' triphosphate bridge, and a methyltransferase puts a
// methyl from SAM on the guanine's N7. (2) Spliceosomes remove each intron as a lariat soon after it is made and join the
// exons. (3) Past the AAUAAA signal, CPSF binds AAUAAA and CstF a GU-rich element downstream; the RNA is cut 10-30 nt
// after AAUAAA, usually after a CA. (4) Poly(A) polymerase adds A's from ATP (releasing PPi) to the new 3' end, about 200
// in mammals (50-250), coated by poly(A)-binding protein; the exonuclease Xrn2 chews the leftover RNA still on Pol II and
// Pol II lets go (the torpedo model). (5) The finished mRNA leaves through a nuclear pore cap first, carrying the cap-binding
// complex (CBC), an exon junction complex (EJC) at each junction and PABP on the tail. Colors: teal exons, purple cap,
// blue Pol II, amber AAUAAA and tail, green processing proteins, red the cut. The gene is drawn schematically, not to scale.
(function () {
  var Y = 150, DY = 246, X0 = 40, EX1 = 30, EXM = 24, EXL = 70, GEND = 320, SIG = 44, DOWN = 52, TAIL = 58;
  function gene(n) {   // exon/intron segments of the gene on the DNA: E1 I1 E2 ... E(n+1)
    var iw = (GEND - X0 - EX1 - EXM * (n - 1) - EXL) / n, segs = [], x = X0;
    for (var i = 0; i <= n; i++) {
      var w = i === 0 ? EX1 : i === n ? EXL : EXM;
      segs.push({k: "exon", x: x, w: w, i: i + 1}); x += w;
      if (i < n) { segs.push({k: "intron", x: x, w: iw, i: i + 1}); x += iw; }
    }
    return segs;
  }
  function ellipse(cx, cy, rx, ry) { return "M " + (cx - rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx + rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx - rx) + " " + cy + " Z"; }
  var TEXT = [
    "When the RNA is only <b>20–30 nt</b> long, enzymes riding on Pol II's tail give its 5′ end a <b>7-methylguanosine cap</b>, joined backwards 5′ to 5′ through three phosphates.",
    "Spliceosomes cut out the <b>{n}</b> as lariats while Pol II keeps transcribing, joining the <b>{e} exons</b> into one continuous message.",
    "Pol II has passed the <b>AAUAAA</b> signal: CPSF binds it, CstF binds a GU-rich stretch downstream, and the RNA is <b>cut 10–30 nt</b> past AAUAAA, usually after a CA.",
    "Poly(A) polymerase adds about <b>200 A's</b> (50–250) from ATP to the new 3′ end, while Xrn2 chews up the leftover RNA and <b>Pol II lets go</b> of the DNA.",
    "Capped, spliced and tailed, the mRNA leaves through a <b>nuclear pore cap first</b>; the cap and tail shield it from exonucleases and help the ribosome start."
  ];
  Viz.register("pre-mrna-processing", {
    title: "Pre-mRNA processing: cap, splice, tail",
    subject: "biology",
    shows: "Step along with RNA polymerase II: the 5′ end is capped at about 25 nt, introns are spliced out as lariats, the RNA is cut past AAUAAA and given a poly(A) tail, and the finished mRNA leaves the nucleus cap first",
    params: {
      introns: {kind: "integer", default: 2, min: 1, max: 3, label: "\\text{introns}"}
    },
    steps: ["cap the 5′ end", "splice out the introns", "cut past AAUAAA", "add the poly(A) tail", "export the mRNA"],
    stepMs: 2000,
    formula: function (v) {
      var s = v.step || 1, n = v.introns, pre = "", post = "";
      for (var i = 1; i <= n + 1; i++) { pre += "E_" + i + (i <= n ? "\\,I_" + i + "\\," : ""); post += "E_" + i; }
      return "\\small " + [
        "\\text{ppp}N\\to\\text{pp}N\\xrightarrow{\\text{GTP}}\\text{G}ppp\\text{N}\\xrightarrow{\\text{SAM}}\\text{m}^7\\text{G}ppp\\text{N}",
        pre + "\\to" + post + "+" + n + "\\ \\text{lariat" + (n > 1 ? "s" : "") + "}",
        "\\cdots\\text{AAUAAA}\\underbrace{\\cdots\\text{CA}}_{10\\text{–}30\\text{ nt}}\\!\\downarrow\\ \\text{GU-rich}\\cdots",
        "\\cdots\\text{CA}+200\\,\\text{ATP}\\to\\cdots\\text{CA}(\\text{A})_{200}+200\\,\\text{PP}_i",
        "\\text{m}^7\\text{G}{-}" + post + "{-}(\\text{A})_{200}:\\ \\text{nucleus}\\to\\text{cytoplasm}"
      ][s - 1];
    },
    status: function (v) {
      var n = v.introns;
      return TEXT[(v.step || 1) - 1].replace("{n}", n === 1 ? "intron" : n + " introns").replace("{e}", String(n + 1));
    },
    examples: [
      {name: "one intron", values: {introns: 1, step: 2}},
      {name: "three introns", values: {introns: 3, step: 2}},
      {name: "cleavage", values: {step: 3}},
      {name: "poly(A) tail", values: {step: 4}},
      {name: "export", values: {introns: 3, step: 5}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, n = v.introns, segs = gene(n), exons = segs.filter(function (q) { return q.k === "exon"; });
      var L = function (at, t, o) { return api.label(at, t, Object.assign({size: 12, color: c.muted}, o || {})); };
      var halo = function (t) { t.setAttribute("stroke", c.card); t.setAttribute("stroke-width", 4); t.setAttribute("paint-order", "stroke"); return t; };
      var blob = function (at, rx, name, col) {
        api.path(ellipse(at[0], at[1], rx, 10), {fill: col || c.c4, fillOpacity: 0.9});
        L(at, name, {color: c.card, anchor: "middle", weight: 700});
      };
      var cap = function (at) { api.circle(at, 7, {fill: c.c6}); };
      // draw exons left to right from x; widths from the gene; the last exon may be partial
      var rna = function (x, widths, labels) {
        widths.forEach(function (w, k) {
          api.rect(x, Y - 7, w - 1, 14, {fill: c.c1, rx: 3});
          if (labels && w >= 20) L([x + w / 2, Y], String(k + 1), {color: c.card, anchor: "middle", weight: 700});
          x += w;
        });
        return x;
      };
      var spliced = exons.map(function (q) { return q.w; });
      var lastStart = exons[n].x;
      if (s < 5) {
        // the gene on the DNA, with Pol II sliding along it
        L([12, 14], "nucleus: Pol II transcribing the gene, RNA above");
        api.line([16, DY - 3], [392, DY - 3], {color: c.faint, width: 1.4});
        api.line([16, DY + 3], [392, DY + 3], {color: c.faint, width: 1.4});
        segs.forEach(function (q) { if (q.k === "exon") api.rect(q.x, DY - 6, q.w - 1, 12, {fill: c.c1, fillOpacity: 0.3, rx: 2}); });
        api.path("M " + X0 + " " + (DY - 7) + " L " + X0 + " " + (DY - 20) + " L " + (X0 + 12) + " " + (DY - 20), {stroke: c.muted, width: 1.5, arrow: true});
        api.line([GEND, DY - 9], [GEND, DY + 9], {color: c.c3, width: 2});
        L([GEND, DY + 22], "poly(A) site", {color: c.c3, anchor: "middle"});
        L([X0, DY + 22], "DNA: exons and introns", {anchor: "start"});
        var xp = [X0 + 24, lastStart + 24, 372, 380][s - 1], py = s === 4 ? DY - 26 : DY;
        var rnaEnd;
        if (s === 1) {
          rnaEnd = rna(X0, [24], false);
          L([X0 + 12, Y + 22], "≈ 25 nt", {anchor: "middle"});
          blob([X0 + 34, Y - 34], 32, "capping");
          L([X0 + 76, Y - 34], "enzymes ride on Pol II's tail", {anchor: "start", color: c.c4});
          api.path("M " + (xp + 18) + " " + (DY + 6) + " q 14 10 4 18 q -10 8 4 16", {stroke: c.c2, width: 2});
          L([xp + 30, DY + 26], "tail (CTD)", {color: c.c2, anchor: "start"});
        } else if (s === 2) {
          rnaEnd = rna(X0, spliced.slice(0, n).concat([24]), true);
          var junction = X0 + spliced.slice(0, n).reduce(function (a, b) { return a + b; }, 0);
          blob([junction, Y - 22], 40, "spliceosome");
          for (var i = 0; i < n; i++) {   // released introns: lariat loops with a short tail
            var lx = 150 + i * 62, ly = 78;
            api.circle([lx, ly], 12, {stroke: c.faint, width: 2.5});
            api.path("M " + lx + " " + (ly + 12) + " q 6 14 22 16", {stroke: c.faint, width: 2.5});
            api.circle([lx, ly + 12], 3, {fill: c.ink});
          }
          L([150 + (n - 1) * 31, 46], n === 1 ? "the intron, cut out as a lariat" : "introns cut out as lariats", {anchor: "middle", color: c.ink});
        } else {
          rnaEnd = rna(X0, spliced, true);
          var last0 = rnaEnd - EXL, sigX = last0 + SIG;
          halo(L([sigX, Y - 18], "AAUAAA", {color: c.c3, anchor: "middle", weight: 700}));
          api.line([sigX - 10, Y - 9], [sigX + 10, Y - 9], {color: c.c3, width: 2.5});
          if (s === 3) {
            api.line([rnaEnd, Y], [rnaEnd + DOWN, Y], {color: c.faint, width: 2.5});
            blob([sigX, Y - 40], 22, "CPSF");
            blob([rnaEnd + 26, Y - 26], 22, "CstF");
            L([rnaEnd + 26, Y + 20], "GU-rich", {anchor: "middle"});
            api.line([rnaEnd, Y - 16], [rnaEnd, Y + 16], {color: c.c5, width: 2, dash: "3 3"});
            L([rnaEnd - 4, Y + 30], "cut after CA", {color: c.c5, anchor: "middle", weight: 650});
            rnaEnd += DOWN;
          } else {
            api.line([rnaEnd, Y], [rnaEnd + TAIL, Y], {color: c.c3, width: 6});
            halo(L([rnaEnd + TAIL / 2, Y + 20], "AAA…A ≈ 200", {color: c.c3, anchor: "middle", weight: 700}));
            blob([rnaEnd + TAIL + 18, Y - 18], 20, "PAP");
            L([rnaEnd + TAIL - 4, Y - 40], "poly(A) polymerase", {color: c.c4, anchor: "middle"});
            // leftover RNA still on Pol II, being degraded 5' to 3'
            api.path("M " + (xp - 28) + " " + (py - 34) + " q 14 4 18 20", {stroke: c.faint, width: 2.5});
            blob([xp - 44, py - 40], 20, "Xrn2");
            L([xp + 4, py + 30], "Pol II lets go", {color: c.c2, anchor: "end"});
          }
        }
        if (s < 4) api.path("M " + rnaEnd + " " + Y + " Q " + (rnaEnd + 12) + " " + ((Y + DY) / 2) + " " + (xp - 2) + " " + (DY - 14), {stroke: s === 3 ? c.faint : c.c1, width: 2.5});
        cap([X0 - 8, Y]);
        halo(L([X0 - 8, Y + 22], "m^7G cap", {color: c.c6, anchor: "start", weight: 650}));
        L([X0 - 8, Y - 18], "5′", {color: c.ink, anchor: "middle"});
        api.path(ellipse(xp, py, 22, 14), {fill: c.c2, fillOpacity: s === 4 ? 0.55 : 0.9});
        L([xp, py], "Pol II", {color: c.card, anchor: "middle", weight: 700});
      } else {
        // export: the finished mRNA threads through a nuclear pore, cap first, into the cytoplasm on the left
        var ex = 118, pore0 = 134, pore1 = 166;
        [ex, ex + 12].forEach(function (x) {
          api.line([x, 34], [x, pore0], {color: c.muted, width: 2}); api.line([x, pore1], [x, 272], {color: c.muted, width: 2});
        });
        api.rect(ex - 4, pore0 - 8, 20, 8, {fill: c.muted, rx: 3}); api.rect(ex - 4, pore1, 20, 8, {fill: c.muted, rx: 3});
        L([56, 20], "cytoplasm", {color: c.ink, anchor: "middle"});
        L([260, 20], "nucleus", {color: c.ink, anchor: "middle"});
        L([ex + 6, 286], "nuclear envelope", {anchor: "middle"});
        L([ex + 6, pore0 - 22], "pore", {anchor: "middle"});
        var x5 = 104, end = rna(x5, spliced, true);
        api.line([end, Y], [end + TAIL, Y], {color: c.c3, width: 6});
        halo(L([end + TAIL / 2, Y + 20], "AAA…A ≈ 200", {color: c.c3, anchor: "middle", weight: 700}));
        for (var t = 0; t < 4; t++) api.circle([end + 8 + t * 14, Y - 9], 4, {fill: c.c4});
        L([end + TAIL / 2, Y - 24], "PABP", {color: c.c4, anchor: "middle"});
        var jx = x5;
        for (var j = 0; j < n; j++) { jx += spliced[j]; api.circle([jx - 10, Y - 14], 4.5, {fill: c.c4}); }
        L([x5 + spliced[0] + (n > 1 ? spliced[1] : 0) / 2, Y - 34], n === 1 ? "EJC" : "EJCs mark junctions", {color: c.c4, anchor: "start"});
        cap([x5 - 8, Y]);
        blob([x5 - 18, Y + 26], 18, "CBC");
        halo(L([x5 - 8, Y - 18], "m^7G cap", {color: c.c6, anchor: "middle", weight: 650}));
        api.arrow([96, 214], [30, 214], {color: c.ink, width: 2, halo: false, label: "out, cap first", labelAt: "mid", labelOffset: [0, -14], labelSize: 12});
        L([end + TAIL, Y + 44], "3′", {color: c.ink, anchor: "end"});
      }
      // viz.css paints svg text ink; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
