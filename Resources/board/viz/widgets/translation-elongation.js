// One elongation cycle on the bacterial ribosome. (1) EF-Tu-GTP delivers an aminoacyl-tRNA to the A site and the
// anticodon is checked against the codon; (2) a correct match makes EF-Tu hydrolyze GTP and leave, and the tRNA swings
// in (accommodation); (3) the 23S rRNA of the large subunit (a ribozyme) moves the whole chain from the P-site tRNA onto
// the A-site amino acid (peptide bond); (4) EF-G-GTP moves the mRNA 3 nt and the tRNAs A->P, P->E; the empty tRNA leaves.
// Cost: 2 GTP per cycle (EF-Tu, EF-G). A near-cognate tRNA (one mismatch, here the middle base) is usually rejected,
// before or after GTP hydrolysis (initial selection, then proofreading); errors slip through about once per 10^4 codons.
(function () {
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG", B = "UCAG";
  var NAME = {F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg", I: "Ile", M: "Met",
              T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly", "*": "stop"};
  var ORF = ["AUG", "GCU", "AAA", "GGC", "UUC", "GAC", "UGG"], PAIR = {A: "U", U: "A", G: "C", C: "G"}, TS = {A: "G", G: "A", C: "U", U: "C"};
  function aa(cod) { return NAME[CODE[16 * B.indexOf(cod[0]) + 4 * B.indexOf(cod[1]) + B.indexOf(cod[2])]]; }
  function anti(cod) { return cod.split("").map(function (b) { return PAIR[b]; }).join(""); }   // written 3'->5' under the codon
  function near(cod) { return cod[0] + TS[cod[1]] + cod[2]; }                                   // the codon this tRNA really reads
  function model(v) {
    var k = v.codon, A = ORF[k - 1], wrong = v.trna === "near-cognate";
    var chain = ORF.slice(0, k - 1).map(aa); chain[0] = "fMet";                                   // on the P-site tRNA before the cycle (bacterial)
    return {k: k, A: A, wrong: wrong, chain: chain, inc: wrong ? aa(near(A)) : aa(A), ac: wrong ? anti(near(A)) : anti(A)};
  }

  Viz.register("translation-elongation", {
    title: "Translation elongation: one codon per cycle",
    subject: "biology",
    shows: "Step through one elongation cycle: EF-Tu brings a tRNA, a correct match triggers GTP hydrolysis, the chain moves onto the new amino acid and EF-G shifts the ribosome one codon; try a near-cognate tRNA to see it rejected",
    params: {
      codon: {kind: "integer", default: 3, min: 2, max: 5, label: "\\text{codon}"},
      trna: {kind: "enum", values: ["cognate", "near-cognate"], default: "cognate", label: "\\text{tRNA}"}
    },
    steps: ["tRNA arrives with EF-Tu·GTP", "match checked, GTP hydrolyzed", "peptide bond", "translocation by EF-G"],
    stepMs: 1700,
    formula: function (v) {
      var m = model(v), n = m.chain.length;
      if (m.wrong && (v.step || 1) < 4) return "\\begin{array}{l}\\texttt{" + m.A + "}:3'\\text{-}\\texttt{" + m.ac + "}\\text{-}5'\\ \\ \\text{1 mismatch}\\\\ \\text{chain stays at }" + n + "\\text{ aa}\\end{array}";
      return "\\begin{array}{l}\\texttt{" + m.A + "}:3'\\text{-}\\texttt{" + anti(m.A) + "}\\text{-}5'\\to\\text{" + aa(m.A) + "}\\\\ \\text{chain }" + n + "\\to" + (n + 1) + "\\text{ aa},\\ \\ 2\\,\\text{GTP}\\end{array}";
    },
    status: function (v) {
      var m = model(v), s = v.step || 1, chain = m.chain.join("-");
      if (m.wrong) return ["A near-cognate <b>" + m.inc + "</b>-tRNA (anticodon 3′-" + m.ac + "-5′) samples codon " + m.A + ": one base pair is wrong.",
        "The mismatch distorts the decoding center, so EF-Tu rarely fires and the tRNA <b>falls away</b>; any that get past GTP hydrolysis are proofread off.",
        "No peptide bond forms: <b>" + chain + "</b> stays on the P-site tRNA and the A site waits, so errors cost time, not accuracy (about 1 in 10,000 slips through).",
        "The cognate <b>" + aa(m.A) + "</b>-tRNA arrives with EF-Tu·GTP and the cycle can go on."][s - 1];
      return ["EF-Tu·GTP delivers <b>" + m.inc + "</b>-tRNA; its anticodon 3′-" + m.ac + "-5′ is checked against codon " + m.A + " in the A site.",
        "A correct match makes EF-Tu hydrolyze its <b>GTP</b> and leave; the tRNA swings fully into the A site.",
        "The large subunit's rRNA moves the chain onto " + m.inc + ": the A-site tRNA now holds <b>" + chain + "-" + m.inc + "</b>.",
        "EF-G·GTP shifts the mRNA <b>3 nt</b>: the chain's tRNA moves to P, the empty one to E and out, and codon " + (m.k + 1) + " (" + ORF[m.k] + ") fills the A site."][s - 1];
    },
    examples: [
      {name: "second codon, peptide bond", values: {codon: 2, step: 3}},
      {name: "fifth codon, translocation", values: {codon: 5, step: 4}},
      {name: "near-cognate rejected", values: {codon: 3, trna: "near-cognate", step: 2}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, m = model(v), s = v.step || 1, nt = 14, cw = 3 * nt, P = 200, yM = 228;
      var tag = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, anchor: "middle"}, o || {})); };
      var moved = s === 4 && !m.wrong, pIdx = moved ? m.k : m.k - 1;                       // codon (1-based) sitting in the P site
      var cxOf = function (i) { return P + (i - pIdx) * cw; };                               // centre of codon i
      // ribosome: large subunit above the mRNA with its three sites, small subunit below
      api.rect(P - cw * 1.5 - 14, 72, cw * 3 + 28, yM - 88, {rx: 34, fill: c.c6, fillOpacity: 0.08, stroke: c.c6, width: 1.3});
      api.rect(P - cw * 1.5 - 6, yM + 12, cw * 3 + 12, 28, {rx: 14, fill: c.c6, fillOpacity: 0.08, stroke: c.c6, width: 1.3});
      ["E", "P", "A"].forEach(function (t, j) { tag([P + (j - 1) * cw, yM + 26], t, c.c6, {weight: 700}); });
      tag([P + cw * 1.5 + 12, yM + 26], "ribosome", c.c6, {anchor: "start"});
      // mRNA, 5' at left
      api.line([12, yM + 8], [388, yM + 8], {color: c.c3, width: 2.5, opacity: 0.7});
      tag([12, yM - 6], "5′", c.c3, {anchor: "start", weight: 650}); tag([388, yM - 6], "3′", c.c3, {anchor: "end", weight: 650});
      ORF.forEach(function (cod, i) {
        var cx = cxOf(i + 1); if (cx < 40 || cx > 362) return;
        cod.split("").forEach(function (b, j) { tag([cx + (j - 1) * nt, yM], b, c.c3, {weight: 700}); });
      });
      if (moved) { api.arrow([P - 40, yM + 52], [P - 92, yM + 52], {color: c.c3, width: 2, halo: false}); tag([P - 34, yM + 52], "mRNA moved 3 nt", c.c3, {anchor: "start"}); }
      // a tRNA: anticodon under the body, amino acid (or chain) on top; returns the top point
      function trna(cx, ac, o) {
        o = o || {};
        var g = api.group({opacity: o.fade ? 0.4 : 1}), dy = o.dy || 0;
        api.rect(cx - 4, 120 + dy, 8, 18, {rx: 3, fill: c.c1, fillOpacity: 0.85, parent: g});
        api.rect(cx - 18, 136 + dy, 36, 50, {rx: 10, fill: c.c1, fillOpacity: 0.2, stroke: c.c1, width: 1.5, parent: g});
        ac.split("").forEach(function (b, j) {
          var bx = cx + (j - 1) * nt, bad = o.codon && PAIR[o.codon[j]] !== b;
          api.label([bx, 196 + dy], b, {color: bad ? c.c5 : c.c1, size: 12.5, weight: 700, anchor: "middle", parent: g});
          if (!dy) api.line([bx, 204], [bx, yM - 8], {color: bad ? c.c5 : c.ink, width: 1.3, opacity: 0.7, dash: bad ? "2 2" : null, parent: g});
        });
        return [cx, 120 + dy];
      }
      function chain(top, names, lean) {   // newest residue sits on the tRNA, older ones trail up and out
        var pts = names.map(function (n, j) { var r = names.length - 1 - j; return [top[0] + lean * 26 * r, top[1] - 12 - 21 * r]; });
        for (var j = 1; j < pts.length; j++) api.line(pts[j - 1], pts[j], {color: c.c4, width: 2.5});
        pts.forEach(function (q, j) {
          api.rect(q[0] - 17, q[1] - 10, 34, 20, {rx: 10, fill: c.card});
          api.rect(q[0] - 17, q[1] - 10, 34, 20, {rx: 10, fill: c.c4, fillOpacity: 0.25, stroke: c.c4, width: 1.5});
          tag(q, names[j], c.ink, {weight: 650});
        });
      }
      var Ax = P + cw, Pc = ORF[pIdx - 1];
      if (moved) {   // after translocation: chain on the P-site tRNA, empty tRNA in E on its way out, A site open
        trna(P - cw, anti(ORF[m.k - 2]), {fade: true, dy: -16});
        tag([P - cw - 22, 128], "exits", c.muted, {anchor: "end"});
        chain(trna(P, anti(Pc)), m.chain.concat([m.inc]), -1);
        api.rect(Ax - 21, yM - 12, 42, 24, {rx: 5, stroke: c.ink, width: 1.3, dash: "4 3"});
        api.rect(Ax - 16, 130, 32, 58, {rx: 9, fill: c.c2, fillOpacity: 0.25, stroke: c.c2, width: 1.4});
        tag([Ax + 26, 130], "EF-G", c.c2, {anchor: "start", weight: 650}); tag([Ax + 26, 146], "GTP→GDP", c.c2, {anchor: "start"});
      } else {
        var Pt = trna(P, anti(Pc));
        var accepted = !m.wrong && s >= 2, transferred = !m.wrong && s >= 3;
        if (!transferred) chain(Pt, m.chain, -1); else api.circle([P, 116], 4, {fill: c.c1});   // the P-site tRNA is now empty
        var showA = m.wrong ? s !== 3 : true, isRight = !m.wrong || s === 4;
        if (showA) {
          var At = trna(Ax + (m.wrong && s === 2 ? 24 : 0), isRight ? anti(m.A) : m.ac,
            {codon: isRight ? null : m.A, fade: m.wrong && s === 2, dy: m.wrong && s === 2 ? -14 : 0});
          if (m.wrong && s === 2) { api.arrow([Ax + 46, 112], [Ax + 70, 80], {color: c.c5, width: 2, halo: false}); tag([Ax + 52, 66], "rejected", c.c5, {anchor: "start", weight: 650}); }
          if (transferred) chain(At, m.chain.concat([m.inc]), -1);
          else tag([At[0], At[1] - 12], isRight ? aa(m.A) : m.inc, c.ink, {weight: 650});
          if (!transferred) { api.rect(At[0] - 17, At[1] - 22, 34, 20, {rx: 10, stroke: c.c4, width: 1.5}); }
          if (s === 1 || (m.wrong && s === 4)) {   // EF-Tu still holding GTP
            api.line([At[0] + 18, At[1] + 30], [At[0] + 40, At[1] + 30], {color: c.c2, width: 2});
            api.rect(At[0] + 40, At[1] + 14, 52, 32, {rx: 10, fill: c.c2, fillOpacity: 0.22, stroke: c.c2, width: 1.3});
            tag([At[0] + 66, At[1] + 23], "EF-Tu", c.c2, {weight: 650}); tag([At[0] + 66, At[1] + 37], "GTP", c.c2);
          }
          if (m.wrong && s === 1) tag([At[0] + 40, 196], "mismatch", c.c5, {anchor: "start", weight: 650});
        }
        if (accepted && s === 2) tag([Ax + 24, 108], "EF-Tu·GDP leaves", c.c2, {anchor: "start"});
        if (m.wrong && s === 3) { api.rect(Ax - 21, yM - 12, 42, 24, {rx: 5, stroke: c.c5, width: 1.3, dash: "4 3"}); tag([Ax + 26, 160], "A site empty", c.c5, {anchor: "start"}); }
        if (transferred) {
          api.path("M " + (P + 6) + " 114 Q " + (P + 14) + " 128 " + (Ax - 20) + " 112", {stroke: c.c6, width: 2, arrow: true});
          tag([Ax + 22, 92], "peptide bond", c.c6, {anchor: "start", weight: 650}); tag([Ax + 22, 108], "made by rRNA", c.c6, {anchor: "start"});
        }
      }
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
