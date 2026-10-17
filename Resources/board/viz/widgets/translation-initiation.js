// Translation initiation in bacteria and in eukaryotes.
// Bacteria: the 30S subunit (with IF1, IF3) finds the start because the 3' end of its 16S rRNA (3'-AUUCCUCCAC-5')
//   pairs with the Shine-Dalgarno sequence (AGGAGG) about 7 nt upstream of AUG; IF2-GTP brings fMet-tRNA(fMet) to the
//   P site, its anticodon 3'-UAC-5' pairs with AUG, the 50S joins as IF2 hydrolyzes GTP, and the factors leave.
// Eukaryotes: eIF4F holds the 5' cap and loads the 43S complex (40S + eIF2-GTP-Met-tRNAi); it scans 5'->3' (eIF4A
//   unwinds, using ATP) to the first AUG in good Kozak context (gccRccAUGG: a purine at -3, G at +4); eIF2 hydrolyzes
//   GTP, factors leave and the 60S joins (eIF5B). In weak context most scanning 40S slide past (leaky scanning) and start
//   at the next AUG, here in frame 4 codons on, giving a protein 4 amino acids shorter at its N-terminus.
// A weak Shine-Dalgarno does not change the steps; it makes the first one rare, so this mRNA is made into little protein.
(function () {
  var SEQ = {bacterium: {strong: "AGGAGGUAAAUCCAUGGCUAAA", weak: "ACUACUUAAAUCCAUGGCUAAA"},
             eukaryote: {strong: "GCCACCAUGGCUUCCACCAUGGAA", weak: "UUUUUUAUGUCUUCCACCAUGGAA"}};
  var PAIR = {A: "U", U: "A", G: "C", C: "G"};
  function startAt(v) { return v.cell === "bacterium" ? 13 : v.signal === "strong" ? 6 : 18; }   // 0-based index of the used AUG

  Viz.register("translation-initiation", {
    title: "Translation initiation: finding the start codon",
    subject: "biology",
    shows: "Step through initiation in a bacterium (Shine-Dalgarno pairing) or a eukaryote (cap binding and scanning); weaken the start signal to see rare binding or leaky scanning",
    params: {
      cell: {kind: "enum", values: ["bacterium", "eukaryote"], default: "bacterium", label: "\\text{cell}"},
      signal: {kind: "enum", values: ["strong", "weak"], default: "strong", label: "\\text{signal}"}
    },
    steps: ["small subunit binds", "initiator tRNA at AUG", "large subunit joins", "ready to elongate"],   // each fits the step bar on one line
    stepMs: 1700,
    formula: function (v) {
      var q = SEQ[v.cell][v.signal];
      if (v.cell === "bacterium") return "\\begin{array}{l}5'\\cdots\\underbrace{\\texttt{" + q.slice(0, 6) + "}}_{\\text{SD}}\\texttt{" + q.slice(6, 13) + "}\\,\\underbrace{\\texttt{AUG}}_{\\text{start}}\\texttt{" + q.slice(16) + "}\\cdots3'\\\\" +
        "\\text{16S: }3'\\text{-}\\texttt{AUUCCUCCAC}\\text{-}5'\\ \\ (" + (v.signal === "strong" ? "6\\text{ of }6" : "2\\text{ of }6") + "\\text{ pair})\\end{array}";
      return "\\begin{array}{l}\\text{m}^7\\text{G}\\cdots\\underbrace{\\texttt{" + q.slice(0, 6) + "}}_{-6\\ \\text{to}\\ -1}\\mathbf{AUG}\\,\\underbrace{\\texttt{" + q[9] + "}}_{+4}\\cdots\\\\" +
        "\\text{Kozak gcc}\\mathbf{R}\\text{cc}\\mathbf{AUGG}:\\ " + (v.signal === "strong" ? "-3=\\text{A},\\ +4=\\text{G}" : "-3=\\text{U},\\ +4=\\text{U}") + "\\end{array}";
    },
    status: function (v) {
      var s = v.step || 1, bac = v.cell === "bacterium", weak = v.signal === "weak";
      if (bac) {
        var B = [weak ? "With ACUACU in place of AGGAGG the 16S rRNA has little to pair with, so a 30S subunit only <b>rarely</b> settles on this mRNA."
                      : "The 30S subunit's 16S rRNA pairs with the <b>Shine-Dalgarno</b> sequence AGGAGG, which parks the AUG 7 nt downstream in the P site.",
                 "IF2·GTP brings <b>fMet-tRNA</b>; its anticodon 3′-UAC-5′ pairs with AUG in the P site.",
                 "The <b>50S</b> subunit joins, IF2 hydrolyzes its GTP, and IF1, IF2 and IF3 leave.",
                 "The <b>70S</b> initiation complex has fMet-tRNA in the P site and an empty A site over GCU, ready for elongation."];
        return B[s - 1] + (weak && s > 1 ? " Each step is normal, but it happens <b>rarely</b> on this weak SD." : "");
      }
      var E = ["eIF4F grips the <b>5′ cap</b> and loads the 43S complex: the 40S subunit carrying Met-tRNA and eIF2·GTP.",
        weak ? "The first AUG sits in <b>weak context</b> (U at −3, U at +4), so most scanning subunits slide past it to the <b>next AUG</b>."
             : "The 40S <b>scans</b> 5′ to 3′, burning ATP, and stops at the first AUG in strong context (A at −3, G at +4).",
        "With Met-tRNA paired to AUG, eIF2 hydrolyzes its GTP, the factors leave and the <b>60S</b> joins.",
        weak ? "The <b>80S</b> complex starts at AUG2, in frame, so the protein lacks its first <b>4</b> amino acids."
             : "The <b>80S</b> initiation complex has Met-tRNA in the P site and an empty A site, ready for elongation."];
      return E[s - 1];
    },
    examples: [
      {name: "bacterium, ready", values: {cell: "bacterium", step: 4}},
      {name: "weak Shine-Dalgarno", values: {cell: "bacterium", signal: "weak", step: 1}},
      {name: "eukaryote scanning", values: {cell: "eukaryote", step: 2}},
      {name: "leaky scanning", values: {cell: "eukaryote", signal: "weak", step: 4}}
    ],
    size: [400, 258],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, bac = v.cell === "bacterium", weak = v.signal === "weak", q = SEQ[v.cell][v.signal];
      var sp = bac ? 12.5 : 10, x0 = bac ? 70 : 84, yM = 176, LT = yM - 140;                   // LT: top of the large subunit
      var x = function (i) { return x0 + i * sp; }, a = startAt(v), cx = x(a + 1);                // cx: centre of the AUG used
      var tag = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, anchor: "middle"}, o || {})); };
      var side = function (w) { return cx + 72 + w <= 396 ? [cx + 72, "start"] : [cx - 72, "end"]; };   // a label beside the large subunit
      // the mRNA, with its start signal coloured (red when weak) and the AUG used in white
      api.line([16, yM + 9], [392, yM + 9], {color: c.c3, width: 2.5, opacity: 0.7});
      if (bac) { tag([14, yM - 4], "5′", c.c3, {anchor: "start", weight: 600}); tag([44, yM - 4], "···", c.c3); tag([x(q.length) + 12, yM - 4], "···", c.c3); }
      else { api.circle([20, yM + 9], 5, {fill: c.c3}); tag([12, yM - 6], "m⁷G cap", c.c3, {anchor: "start", weight: 650, raw: true}); }
      tag([392, yM - 4], bac ? "3′" : "(A)ₙ 3′", c.c3, {anchor: "end", weight: 600, raw: true});
      for (var i = 0; i < q.length; i++) {
        var sig = i < 6 || (!bac && i === 9), used = i >= a && i < a + 3;
        tag([x(i), yM], q[i], sig ? (weak ? c.c5 : c.c6) : used ? c.ink : c.c3, {weight: used ? 800 : 600});
      }
      if (bac || weak || s < 3) tag([x(2.5), yM - 18], bac ? "Shine-Dalgarno" : "Kozak", weak ? c.c5 : c.c6, {weight: 650});   // the 60S covers it at AUG1
      // the small subunit (30S or 40S)
      var placed = !(bac && weak && s === 1), scan = !bac && s === 1;
      var sx = bac ? x(-1) : scan ? 34 : cx - 62, sw = bac ? cx + 58 - x(-1) : 124, sy = placed ? yM + 18 : yM + 34;
      api.rect(sx, sy, sw, 44, {rx: 22, fill: c.c2, fillOpacity: 0.16, stroke: c.c2, width: 1.4, dash: placed ? null : "5 4"});
      tag([sx + sw - 16, sy + 30], bac ? "30S" : "40S", c.c2, {anchor: "end", weight: 650});
      if (bac) {   // the 16S rRNA's 3' end, written 3'->5' under the SD; a tick for each Watson-Crick pair
        var anti = "AUUCCUCCAC";
        for (var k = 0; k < anti.length; k++) {
          var up = k >= 2 && k < 8 ? q[k - 2] : null;
          tag([x(k - 2), sy + 16], anti[k], c.c2, {weight: 600});
          if (up && PAIR[up] === anti[k] && placed) api.line([x(k - 2), yM + 7], [x(k - 2), sy + 8], {color: c.c2, width: 1.2});
        }
        tag([x(-2) - 8, sy + 16], "3′", c.c2, {anchor: "end"});
        if (!placed) tag([120, yM + 22], "no SD pairing: the 30S rarely binds", c.c5, {weight: 650});
        if (weak && s > 1) tag([200, 14], "rare on this mRNA: weak Shine-Dalgarno", c.c5, {weight: 650});
        if (s <= 2) {   // what comes next, faded: the 50S over this AUG, and (step 1) fMet-tRNA with IF2 on its way
          var gh = api.group({opacity: 0.55});
          api.rect(cx - 64, LT, 128, 122, {rx: 30, stroke: c.c6, width: 1.3, dash: "5 4", parent: gh});
          api.label([cx + 72, LT + 12], "50S", {color: c.c6, size: 12, weight: 650, anchor: "start", parent: gh});
          api.label([cx, LT + 14], "joins at step 3", {color: c.c6, size: 12, weight: 650, anchor: "middle", parent: gh});
        }
      } else {
        if (s === 1) { api.rect(8, yM - 52, 52, 22, {rx: 11, fill: c.c4, fillOpacity: 0.25, stroke: c.c4, width: 1.3}); tag([34, yM - 41], "eIF4F", c.c4, {weight: 650}); }
        if (s === 2) {
          api.arrow([60, yM - 52], [cx - 44, yM - 52], {color: c.c2, width: 2, halo: false});
          tag([(60 + cx - 44) / 2, yM - 66], "scanning 5′→3′", c.c2);
        }
        if (weak && s >= 2) { api.arrow([x(7), yM + 40], [x(7), yM + 26], {color: c.c5, width: 1.5, halo: false}); tag([x(7), yM + 52], "AUG1 skipped", c.c5, {weight: 650}); }
      }
      // the large subunit (50S or 60S), its sites labelled along the top, clear of the tRNA
      if (s >= 3) {
        api.rect(cx - 64, LT, 128, 122, {rx: 30, fill: c.c6, fillOpacity: 0.1, stroke: c.c6, width: 1.4});
        tag([cx + 72, LT + 12], bac ? "50S" : "60S", c.c6, {anchor: "start", weight: 650});
        ["E", "P", "A"].forEach(function (t, j) { tag([cx + (j - 1) * 3 * sp, LT + 14], t, c.c6, {weight: 700}); });
      }
      if (s === 4) {   // the empty A site, labelled outside the large subunit with a leader
        var ax = cx + 3 * sp;
        api.rect(ax - 18, yM - 12, 36, 24, {rx: 5, stroke: c.ink, width: 1.3, dash: "4 3"});
        api.line([cx + 70, yM - 40], [ax + 12, yM - 14], {color: c.ink, width: 1, opacity: 0.7});
        tag([cx + 73, yM - 40], "empty", c.ink, {anchor: "start"});
      }
      // the initiator tRNA: in bacteria it arrives at step 2 (faded and on its way at step 1); in eukaryotes it rides in on the 40S
      function initiator(tx, ty, low, factor, o) {   // low: anticodon under the body (not yet on the mRNA)
        var g = api.group({opacity: o.fade ? 0.45 : 1});
        api.circle([tx, ty - 14], 15, {fill: c.c4, fillOpacity: 0.3, stroke: c.c4, width: 1.5, parent: g});
        api.label([tx, ty - 14], bac ? "fMet" : "Met", {color: c.ink, size: 12, weight: 650, anchor: "middle", parent: g});
        api.rect(tx - 4, ty + 1, 8, 16, {rx: 3, fill: c.c1, fillOpacity: 0.8, parent: g});
        api.rect(tx - 18, ty + 16, 36, 40, {rx: 9, fill: c.c1, fillOpacity: 0.2, stroke: c.c1, width: 1.5, parent: g});
        "UAC".split("").forEach(function (b, j) {   // anticodon 3'-UAC-5', antiparallel to 5'-AUG-3'
          var bx = tx + (j - 1) * sp;
          api.label([bx, low ? ty + 64 : yM - 19], b, {color: c.c1, size: 12, weight: 700, anchor: "middle", parent: g});
          if (!low) api.line([bx, yM - 12], [bx, yM - 8], {color: c.ink, width: 1.2, opacity: 0.7, parent: g});
        });
        if (factor) {   // IF2 or eIF2, still holding GTP: beside the tRNA (left of it when arriving)
          var fx = o.left ? tx - 62 : tx + 21;
          api.rect(fx, ty - 4, 41, 30, {rx: 10, fill: c.c4, fillOpacity: 0.22, stroke: c.c4, width: 1.2, parent: g});
          api.label([fx + 20.5, ty + 4], bac ? "IF2" : "eIF2", {color: c.c4, size: 12, weight: 650, anchor: "middle", parent: g});
          api.label([fx + 20.5, ty + 18], "GTP", {color: c.c4, size: 12, anchor: "middle", parent: g});
        }
      }
      if (bac && s === 1) {
        initiator(122, yM - 108, true, true, {fade: true, left: true});
        tag([108, LT - 8], "fMet-tRNA·IF2 arriving", c.c4, {weight: 600});
        api.line([144, yM - 84], [cx - 72, yM - 84], {color: c.c4, width: 1.5, dash: "4 3", arrow: true, opacity: 0.7});
      }
      if (s >= 2 || !bac) initiator(scan ? 94 : cx, scan ? yM - 98 : yM - 82, scan, s <= 2, {});
      if (s === 3) { var ls = side(bac ? 86 : 96); tag([ls[0], yM - 74], bac ? "IF2·GDP leaves" : "eIF2·GDP leaves", c.c4, {anchor: ls[1]}); }
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
