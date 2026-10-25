// How a retrovirus (HIV-1) turns its RNA genome into a provirus. The capsid opens in the cytoplasm with two copies of
// the (+) RNA genome (~9.7 kb, HXB2 is 9,719 nt) and a host tRNA-Lys3 primer paired at the primer binding site.
// Reverse transcriptase (RT) copies the RNA into minus-strand DNA (an RNA:DNA hybrid; the new strand grows 5' to 3', so it
// runs right to left under an RNA drawn 5' to 3'), its RNase H domain degrades the RNA, and it copies the DNA again: a
// linear double-stranded DNA with a long terminal repeat (LTR: U3-R-U5) at each end. In the nucleus integrase removes
// two nucleotides from each 3' end and joins those ends into host DNA at a staggered cut 5 bp apart; host repair fills
// the gaps (a 5-bp target-site duplication) and the provirus is transcribed by RNA polymerase II.
// Drugs: NRTIs (zidovudine) lack a 3'-OH and terminate the chain; NNRTIs (efavirenz) bind an allosteric pocket of RT;
// integrase strand-transfer inhibitors (dolutegravir) block the joining step, and the DNA closes into dead-end circles.
// RT has no proofreading: mu ~ 3.4e-5 mutations per nucleotide per cycle (Mansky and Temin 1995), so a copy carries
// a Poisson number of new mutations with mean lambda = mu L, and P(at least one) = 1 - e^-lambda.
(function () {
  var L = 9700, BLOCK = {none: 99, NRTI: 2, NNRTI: 2, INSTI: 4};
  var NAMES = ["uncoat", "− strand", "+ strand", "integrate", "provirus"];
  function model(v) { var lam = v.mu * 1e-5 * L; return {lam: lam, p: 1 - Math.exp(-lam), b: BLOCK[v.drug]}; }
  var order = (function () { var a = [], s = 7; for (var i = 0; i < 100; i++) a.push(i); for (var j = 99; j > 0; j--) { s = (s * 16807) % 2147483647; var k = s % (j + 1), t = a[j]; a[j] = a[k]; a[k] = t; } return a; })();
  function wave(x0, x1, y, amp) { var d = "M " + x0 + " " + y; for (var x = x0 + 4; x <= x1; x += 4) d += " L " + x + " " + (y + amp * Math.sin((x - x0) / 5)).toFixed(1); return d; }
  Viz.register("retroviral-reverse-transcription-and-integration", {
    title: "Retrovirus: reverse transcription and integration",
    subject: "biology",
    shows: "Step HIV from RNA to provirus: reverse transcriptase copies RNA into DNA, RNase H clears the RNA, integrase splices the DNA into a chromosome; add a drug to see where it stops and slide RT's error rate",
    params: {
      drug: {kind: "enum", values: ["none", "NRTI", "NNRTI", "INSTI"], default: "none", label: "\\text{drug}"},
      mu: {kind: "number", default: 3.4, min: 0.5, max: 20, step: 0.1, label: "\\mu\\times10^{5}"}   // mutations per nucleotide per cycle, in units of 1e-5
    },
    steps: ["capsid opens", "RT makes the DNA strand", "RNase H, second strand", "integrase joins host DNA", "provirus"],
    stepMs: 1900,
    formula: function (v) {
      var m = model(v);
      return "\\lambda=\\mu L=" + Viz.n(v.mu, 1) + "\\times10^{-5}\\times9{,}700=" + Viz.n(m.lam, 2) +
        "\\newline P(\\ge1\\text{ mutation})=1-e^{-\\lambda}=" + Viz.n(m.p * 100, 0) + "\\%";
    },
    status: function (v) {
      var m = model(v), s = v.step || 1, tail = "; about <b>" + Math.round(m.p * 100) + " in 100</b> DNA copies carry a new mutation.";
      if (s >= m.b) {
        if (v.drug === "NRTI") return "An NRTI such as zidovudine is built into the growing DNA but has no 3′-OH, so the chain <b>stops</b>: no full-length DNA and no provirus.";
        if (v.drug === "NNRTI") return "An NNRTI such as efavirenz wedges into a pocket beside reverse transcriptase's active site and <b>freezes</b> it, so almost no DNA is made.";
        return "An integrase inhibitor such as dolutegravir blocks the joining step: the viral DNA reaches the nucleus but <b>never enters</b> the chromosome and closes into dead-end circles.";
      }
      if (s === 1) return "The capsid opens in the cytoplasm and releases <b>two copies</b> of the RNA genome, each with a host tRNA already paired near its 5′ end as a primer.";
      if (s === 2) return "Reverse transcriptase reads the RNA and builds a complementary <b>DNA strand</b>, leaving an RNA:DNA hybrid" + tail;
      if (s === 3) return "Its <b>RNase H</b> part chops up the RNA, and it copies the DNA strand to make <b>double-stranded DNA</b> with an LTR at each end" + tail;
      if (s === 4) return "In the nucleus <b>integrase</b> trims 2 nucleotides off each 3′ end and joins those ends into a staggered cut in host DNA" + tail;
      return "Host enzymes fill the gaps: the <b>provirus</b> is now part of the chromosome, copied at every division and read by host RNA polymerase II" + tail;
    },
    examples: [
      {name: "low error rate", values: {mu: 0.5, step: 2}},
      {name: "high error rate", values: {mu: 20, step: 2}},
      {name: "NRTI stops the chain", values: {drug: "NRTI", step: 2}},
      {name: "NNRTI jams the enzyme", values: {drug: "NNRTI", step: 3}},
      {name: "integrase inhibitor", values: {drug: "INSTI", step: 4}},
      {name: "the provirus", values: {step: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v), s = v.step || 1, b = m.b, show = Math.min(s, b), blocked = s >= b;
      var L2 = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // the stage track
      NAMES.forEach(function (nm, i) {
        var x = 13 + i * 76, k = i + 1, here = k === s, stop = k === b, after = k > b;
        var live = here && !after;   // a stage past the block is never shown as running
        api.rect(x, 6, 70, 22, {fill: stop ? c.c5 : live ? c.c1 : c.muted, fillOpacity: stop ? 0.25 : live ? 0.3 : 0.08,
          stroke: stop ? c.c5 : live ? c.c1 : here ? c.muted : null, width: 1.4, rx: 11, dash: here && after ? "4 3" : null, opacity: after ? 0.6 : 1});
        L2([x + 35, 17], (stop ? "✕ " : "") + nm, stop ? c.c5 : live ? c.ink : c.muted, {anchor: "middle", weight: live || stop ? 650 : 500, opacity: after ? 0.6 : 1});
      });
      L2([14, 46], show <= 3 ? "cytoplasm" : "nucleus", c.muted, {weight: 500});
      var x0 = 50, x1 = 350, yR = 96, yM = 112, yP = 126;
      var ends = function (y, left, right, col) { L2([x0 - 8, y], left, col, {anchor: "end", weight: 500}); L2([x1 + 8, y], right, col, {weight: 500}); };
      var rt = function (x, y, jam) {
        api.circle([x, y], 12, {fill: c.c6, fillOpacity: 0.35, stroke: c.c6, width: 1.6});
        if (jam) api.polygon([[x + 4, y - 4], [x + 13, y - 13], [x + 15, y - 1]], {fill: c.c5, fillOpacity: 0.95});
      };
      if (show === 1) {
        api.path("M 34 62 L 366 54 Q 388 108 366 160 L 34 152 Q 18 107 34 62 Z", {stroke: c.c6, width: 1.4, dash: "5 5"});
        L2([200, 176], "capsid shell opening", c.c6, {anchor: "middle", weight: 500});
        [100, 128].forEach(function (y, j) {
          api.path(wave(x0, x1 - 16, y, 2.5), {stroke: c.c3, width: 3});
          L2([x0 - 8, y], "5′", c.c3, {anchor: "end", weight: 500}); L2([x1 - 12, y], "AAA", c.c3, {weight: 500});
          api.path("M 74 " + (y - 3) + " q 6 -12 12 0 q 6 -12 12 0", {stroke: c.c4, width: 2.6});   // tRNA primer on the PBS
          if (!j) rt(86, y - 16);
        });
        L2([104, 82], "reverse transcriptase", c.c6, {weight: 500});
        L2([60, 144], "tRNA primer", c.c4, {weight: 500});
        L2([210, 114], "2 × viral RNA (+), 9.7 kb", c.c3, {anchor: "middle"});
      } else if (show === 2 || show === 3) {
        var stop = v.drug === "NRTI" && blocked ? 216 : v.drug === "NNRTI" && blocked ? 326 : x0;
        if (show === 2) { api.path(wave(x0, x1, yR, 2.5), {stroke: c.c3, width: 3}); ends(yR, "5′", "3′", c.c3); L2([200, yR - 16], "viral RNA template", c.c3, {anchor: "middle"}); }
        else {
          for (var f = 0; f < 6; f++) api.path(wave(x0 + 8 + f * 50, x0 + 38 + f * 50, yR - 8 + (f % 2) * 6, 2), {stroke: c.c3, width: 2.4, opacity: 0.45});
          L2([200, yR - 26], "RNase H cuts the RNA into fragments", c.c3, {anchor: "middle", weight: 500});
        }
        api.line([stop, yM], [x1, yM], {color: c.c2, width: 4});
        ends(yM, stop === x0 ? "3′" : "", "5′", c.c2);
        if (show === 2) {
          if (v.drug === "NRTI" && blocked) {
            api.circle([stop, yM], 6, {fill: c.c5});
            L2([stop - 10, yM + 22], "zidovudine added: no 3′-OH, chain ends", c.c5, {anchor: "middle"});
          } else if (v.drug === "NNRTI" && blocked) {
            rt(stop - 12, yM - 2, true);
            L2([stop - 30, yM + 24], "NNRTI locks reverse transcriptase", c.c5, {anchor: "end"});
          } else {
            rt(x0 + 10, yM - 2);
            api.arrow([200, yM + 18], [120, yM + 18], {color: c.c2, width: 2, halo: false, head: 8});
            L2([206, yM + 18], "new DNA grows 5′ → 3′", c.c2, {weight: 500});
          }
        } else {
          api.line([x0, yP], [x1, yP], {color: c.c1, width: 4});
          ends(yP, "5′", "3′", c.c1);
          [x0, x1 - 44].forEach(function (x) { api.rect(x, yM - 9, 44, yP - yM + 18, {stroke: c.ink, width: 1.4, rx: 4}); L2([x + 22, yP + 22], "LTR", c.ink, {anchor: "middle"}); });
          L2([200, yP + 22], "double-stranded DNA", c.c1, {anchor: "middle"});
        }
        if (show === 2 && !(blocked && v.drug !== "none")) L2([200, yM + 40], "RNA:DNA hybrid", c.muted, {anchor: "middle", weight: 500});
      } else if (show === 4) {
        var yH = 186;
        if (blocked) {
          api.line([20, yH], [380, yH], {color: c.muted, width: 5});
          api.circle([200, 110], 40, {stroke: c.c2, width: 4}); api.circle([200, 110], 33, {stroke: c.c1, width: 4});
          api.circle([160, 110], 9, {fill: c.c4, fillOpacity: 0.6, stroke: c.c4}); api.polygon([[154, 100], [146, 92], [143, 104]], {fill: c.c5, fillOpacity: 0.95});
          L2([252, 96], "viral DNA closed", c.c1, {weight: 500}); L2([252, 112], "into a circle", c.c1, {weight: 500});
          L2([150, 72], "inhibitor on integrase", c.c5, {anchor: "end"});
          L2([200, yH + 18], "host DNA untouched", c.muted, {anchor: "middle", weight: 500});
        } else {
          api.line([20, yH], [156, yH], {color: c.muted, width: 5}); api.line([244, yH], [380, yH], {color: c.muted, width: 5});
          api.path("M 158 " + yH + " C 108 60, 292 60, 242 " + yH, {stroke: c.c2, width: 4});
          api.path("M 168 " + (yH - 2) + " C 128 80, 272 80, 232 " + (yH - 2), {stroke: c.c1, width: 4});
          [162, 238].forEach(function (x) { api.circle([x, yH - 8], 9, {fill: c.c4, fillOpacity: 0.6, stroke: c.c4}); });
          L2([262, 96], "viral DNA", c.c1, {weight: 500});
          L2([148, yH - 12], "integrase", c.c4, {anchor: "end"});
          L2([200, yH + 18], "host chromosome, staggered 5-bp cut", c.muted, {anchor: "middle", weight: 500});
        }
      } else {
        var yV = 150, segs = [["LTR", 60, 90, c.ink], ["gag", 90, 160, c.c1], ["pol", 160, 250, c.c1], ["env", 250, 310, c.c1], ["LTR", 310, 340, c.ink]];
        api.line([16, yV], [60, yV], {color: c.muted, width: 5}); api.line([340, yV], [384, yV], {color: c.muted, width: 5});
        segs.forEach(function (q) { api.rect(q[1], yV - 10, q[2] - q[1], 20, {fill: q[3], fillOpacity: 0.25, stroke: q[3], width: 1.3, rx: 3}); L2([(q[1] + q[2]) / 2, yV], q[0], q[3], {anchor: "middle"}); });
        [54, 340].forEach(function (x) { api.rect(x, yV - 4, 6, 8, {fill: c.c5, rx: 1}); });
        L2([200, yV + 24], "provirus; red: the 5 bp of host DNA, duplicated", c.muted, {anchor: "middle", weight: 500});
        api.arrow([75, yV - 18], [75, yV - 40], {color: c.c3, width: 2, halo: false, head: 7});
        api.path(wave(75, 330, yV - 50, 2.5), {stroke: c.c3, width: 3});
        L2([200, yV - 70], "RNA polymerase II makes new viral RNA", c.c3, {anchor: "middle", weight: 500});
      }
      // RT's copying errors: 100 hypothetical DNA copies, the mutated ones in red (Poisson, mean lambda)
      var k = Math.round(m.p * 100), gx = 20, gy = 246;
      L2([gx, 232], "100 DNA copies: " + k + " with a new mutation", c.c5);
      for (var i = 0; i < 100; i++) {
        var col = i % 25, row = Math.floor(i / 25), hit = order.indexOf(i) < k;
        api.rect(gx + col * 10, gy + row * 10, 8, 8, {fill: hit ? c.c5 : c.muted, fillOpacity: hit ? 0.9 : 0.22, rx: 1.5});
      }
      L2([284, 254], "λ = " + api.fmt(m.lam, 2) + " per copy", c.ink, {weight: 500});
      L2([284, 272], "RT can't proofread", c.muted, {weight: 500});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
