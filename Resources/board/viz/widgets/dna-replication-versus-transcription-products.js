// What replication and transcription each make from the same stretch of DNA. Replication copies both strands of the whole
// molecule into two duplexes, each keeping one parental strand (semiconservative), once per cell cycle. Transcription copies
// one strand of one gene into single-stranded RNA (U for T, built 5'->3' against the template), as many times as the cell
// needs, and the DNA re-zips unchanged. Which strand is the template depends on the gene's direction: a gene read left to
// right uses the bottom strand; one read right to left uses the top strand. Sequence chosen so both directions start AUG.
(function () {
  var TOP = "GCATGGCTACATGC", PAIR = {A: "T", T: "A", G: "C", C: "G"}, N = TOP.length, G0 = 2, G1 = 11;
  var BOT = TOP.split("").map(function (b) { return PAIR[b]; }).join("");
  function rnaAt(v, i) { return (v.gene === "rightward" ? TOP[i] : BOT[i]).replace("T", "U"); }   // RNA base made over position i
  function rna53(v) {                                                                              // the transcript, written 5' -> 3'
    var s = ""; for (var i = G0; i <= G1; i++) s += rnaAt(v, i);
    return v.gene === "rightward" ? s : s.split("").reverse().join("");
  }

  Viz.register("dna-replication-versus-transcription-products", {
    title: "Replication vs transcription: what each one makes",
    subject: "biology",
    shows: "The same DNA, copied two ways: replication turns both strands of the whole molecule into two duplexes; transcription turns one strand of one gene into as many RNAs as the cell needs",
    params: {
      gene: {kind: "enum", values: ["rightward", "leftward"], default: "rightward", label: "\\text{gene}", names: {rightward: "reads →", leftward: "reads ←"}},
      rnas: {kind: "integer", default: 3, min: 1, max: 5, label: "\\text{RNAs}"}
    },
    formula: function (v) {
      return "\\begin{array}{l}\\text{replication: }1\\ \\text{duplex}\\to 2\\ \\text{duplexes}\\\\ \\text{transcription: }1\\ \\text{gene}\\to " + v.rnas + "\\ \\text{RNA" + (v.rnas > 1 ? "s" : "") +
        "}\\\\ \\text{RNA}=5'\\text{-}\\texttt{" + rna53(v) + "}\\text{-}3'\\end{array}";
    },
    status: function (v) {
      var right = v.gene === "rightward";
      return "Replication copies <b>both strands</b> end to end into 2 duplexes, each half old; transcription copies only the gene's template (the <b>" + (right ? "bottom" : "top") +
        "</b> strand, read 3′→5′) into " + v.rnas + " single-stranded RNA" + (v.rnas > 1 ? "s" : "") + " that match the " + (right ? "top" : "bottom") + " strand with U for T.";
    },
    examples: [
      {name: "gene read left to right", values: {gene: "rightward", rnas: 1}},
      {name: "gene read right to left", values: {gene: "leftward", rnas: 5}},
      {name: "a busy gene", values: {rnas: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, right = v.gene === "rightward";
      var letter = function (x, y, b, col, op) { api.label([x, y], b, {color: col, size: 12.5, weight: 650, anchor: "middle", opacity: op == null ? 1 : op}); };
      var ends = function (x0, x1, y, left, rt, col, op) {
        api.label([x0 - 15, y], left, {color: col, size: 12, anchor: "middle", opacity: op == null ? 1 : op});
        api.label([x1 + 15, y], rt, {color: col, size: 12, anchor: "middle", opacity: op == null ? 1 : op});
      };
      // ---- the parent duplex, with the gene marked ----
      var PX = function (i) { return 120 + i * 12.4; }, yA = 46, yB = 64;
      api.label([PX(0) - 28, 55], "DNA", {color: c.ink, size: 12.5, weight: 700, anchor: "end"});
      api.label([PX(N - 1) + 28, right ? yA : yB], "coding", {color: c.muted, size: 12});
      api.label([PX(N - 1) + 28, right ? yB : yA], "template", {color: right ? c.c2 : c.c1, size: 12, weight: 700});
      for (var i = 0; i < N; i++) { letter(PX(i), yA, TOP[i], c.c1); letter(PX(i), yB, BOT[i], c.c2); }
      ends(PX(0), PX(N - 1), yA, "5′", "3′", c.c1); ends(PX(0), PX(N - 1), yB, "3′", "5′", c.c2);
      var gy = right ? 26 : 84, from = right ? PX(G0) - 5 : PX(G1) + 5, to = right ? PX(G1) + 6 : PX(G0) - 6;
      api.rect(PX(G0) - 7, yA - 10, PX(G1) - PX(G0) + 14, yB - yA + 20, {rx: 5, fill: c.c5, fillOpacity: 0.12, stroke: c.c5, width: 1, dash: "3 3"});
      api.line([from, gy + (right ? 8 : -8)], [from, gy], {color: c.c5, width: 2});
      api.arrow([from, gy], [to, gy], {color: c.c5, width: 2, halo: false, head: 8});
      api.label([right ? PX(G1) + 14 : PX(G0) - 14, gy], "gene", {color: c.c5, size: 12, weight: 650, anchor: right ? "start" : "end"});
      api.label([right ? PX(G0) - 14 : PX(G1) + 14, gy], "promoter", {color: c.muted, size: 12, anchor: right ? "end" : "start"});
      api.line([200, 98], [200, 236], {color: c.grid, width: 1});
      // ---- replication: two duplexes, each one old strand + one new ----
      var RX = function (i) { return 18 + i * 12.4; };
      api.label([100, 108], "replication", {color: c.ink, size: 12.5, weight: 700, anchor: "middle"});
      [[132, 148, "old", "new"], [182, 198, "new", "old"]].forEach(function (d) {
        for (var i = 0; i < N; i++) {
          letter(RX(i), d[0], TOP[i], d[2] === "old" ? c.c1 : c.c3);
          letter(RX(i), d[1], BOT[i], d[3] === "old" ? c.c2 : c.c3);
        }
      });
      api.label([100, 165], "+", {color: c.muted, size: 13, anchor: "middle"});
      // ---- transcription: the DNA re-zips unchanged; the RNAs cover only the gene ----
      var TX = function (i) { return 218 + i * 12.4; };
      api.label([300, 108], "transcription", {color: c.ink, size: 12.5, weight: 700, anchor: "middle"});
      api.line([TX(0) - 6, 126], [TX(N - 1) + 6, 126], {color: c.c1, width: 2, opacity: right ? 0.45 : 1});
      api.line([TX(0) - 6, 132], [TX(N - 1) + 6, 132], {color: c.c2, width: 2, opacity: right ? 1 : 0.45});
      api.label([TX(N - 1) + 8, 140], "DNA unchanged", {color: c.muted, size: 12, anchor: "end"});
      var gap = v.rnas > 3 ? 17 : 20;
      for (var k = 0; k < v.rnas; k++) {
        var y = 158 + k * gap;
        for (i = G0; i <= G1; i++) letter(TX(i), y, rnaAt(v, i), c.c5);
        ends(TX(G0), TX(G1), y, right ? "5′" : "3′", right ? "3′" : "5′", c.c5, 0.85);
      }
      // ---- the comparison ----
      var rows = [["both strands, whole molecule", "one strand of one gene"], ["→ 2 DNA duplexes (T)", "→ single-stranded RNA (U)"], ["once per cell cycle", "many copies, as needed"]];
      rows.forEach(function (r, j) {
        var y = 250 + j * 17, col = j === 1;
        api.label([100, y], r[0], {color: col ? c.c3 : c.muted, size: 12, weight: col ? 650 : 500, anchor: "middle"});
        api.label([300, y], r[1], {color: col ? c.c5 : c.muted, size: 12, weight: col ? 650 : 500, anchor: "middle"});
      });
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
