// What a broken checkpoint does to the genome. Three problems a dividing cell meets, each caught by one checkpoint in
// a normal cell: DNA damage in G1 (ATM -> p53 -> p21 blocks cyclin E-CDK2: repair or apoptosis), DNA not fully copied
// in G2 (ATR -> Chk1 blocks Cdc25, so cyclin B-CDK1 stays off), and a kinetochore not attached in M (the spindle
// assembly checkpoint: Mad2 holds APC/C-Cdc20 off, so securin stays and sisters stay joined). In a cancer cell the
// guard is lost (TP53 is mutated in about half of human tumors) or too weak, and the cell divides anyway: a lesion
// copied in S becomes a permanent mutation in one daughter's DNA; uncopied stretches tie the sisters together so the
// anaphase bridge breaks (a deletion in one daughter, a stray fragment in a micronucleus in the other); an early
// anaphase sends both sisters to one pole (3 copies and 1 copy: aneuploidy, found in most solid tumors).
(function () {
  var KEYS = {"G1 DNA damage": "g1", "G2 incomplete replication": "g2", "M spindle attachment error": "m"};
  var CHAIN = {   // sensor, relay, brake target, what the brake stops
    g1: [["ATM", "senses the break"], ["p53 → p21", "build up"], ["cyclin E–CDK2", "off: no S phase"]],
    g2: [["ATR", "senses gaps"], ["Chk1", "blocks Cdc25"], ["cyclin B–CDK1", "off: no mitosis"]],
    m: [["kinetochore", "unattached"], ["Mad2", "signal spreads"], ["APC/C", "off: no anaphase"]]
  };
  var LOST = {g1: "p53 mutated", g2: "Chk1 too weak", m: "Mad2 / SAC weak"};
  var FORMULA = {
    g1normal: "\\text{damage}\\to\\text{ATM}\\to p53\\to p21\\newline\\dashv\\text{cyclin E–CDK2: no S phase}",
    g1cancer: "p53^{\\text{mut}}\\Rightarrow\\text{no }p21\\newline\\Rightarrow\\text{S phase copies the damage}",
    g2normal: "\\text{gaps}\\to\\text{ATR}\\to\\text{Chk1}\\dashv\\text{Cdc25}\\newline\\Rightarrow\\text{cyclin B–CDK1 stays off}",
    g2cancer: "\\text{weak Chk1}\\Rightarrow\\text{CDK1 on}\\newline\\Rightarrow\\text{mitosis with gaps}",
    mnormal: "\\text{unattached kinetochore}\\to\\text{Mad2}\\newline\\dashv\\text{APC/C: sisters stay joined}",
    mcancer: "\\text{weak SAC}\\Rightarrow\\text{APC/C on early}\\newline\\Rightarrow 3+1\\text{ copies, not }2+2"
  };
  var STATUS = {
    g1normal: "p53 holds the cell in G1 while the DNA is repaired, or triggers <b>apoptosis</b> if it cannot be, so no damaged copy is ever made.",
    g1cancer: "With p53 lost, as in about <b>half of human tumors</b>, the cell enters S with the damage and copies it into a <b>permanent mutation</b> that one daughter and all its descendants carry.",
    g2normal: "ATR and Chk1 keep cyclin B–CDK1 off, so the cell waits in G2 until every stretch is copied, then divides into <b>two intact daughters</b>.",
    g2cancer: "The cell divides with stretches still uncopied: the sisters stay tied there, the bridge <b>breaks</b> in anaphase, and one daughter gets a <b>deletion</b> while the lost piece ends up in the other's micronucleus.",
    mnormal: "One unattached kinetochore is enough to keep APC/C off, so anaphase waits until every chromosome is attached and each daughter gets <b>2 copies</b>.",
    mcancer: "A weak spindle checkpoint lets anaphase start early: both sisters go to one pole, so the daughters get <b>3 copies and 1 copy</b>, the aneuploidy seen in most solid tumors."
  };
  Viz.register("cancer-cell-cycle-failure", {
    title: "Cancer: when a checkpoint fails",
    subject: "biology",
    shows: "Pick the problem a dividing cell meets and compare a normal cell, whose checkpoint stops it, with a cancer cell, whose broken checkpoint lets it divide into daughters with a mutation, a broken chromosome or the wrong number",
    params: {
      challenge: {kind: "enum", values: ["G1 DNA damage", "G2 incomplete replication", "M spindle attachment error"], default: "G1 DNA damage", label: "\\text{error}",
                  names: {"G1 DNA damage": "G₁ DNA damage", "G2 incomplete replication": "G₂ uncopied DNA", "M spindle attachment error": "M unattached"}},
      cell: {kind: "enum", values: ["normal", "cancer"], default: "cancer", label: "\\text{cell}", names: {normal: "normal: checkpoint works", cancer: "cancer: checkpoint lost"}}
    },
    formula: function (v) { return FORMULA[KEYS[v.challenge] + v.cell]; },
    status: function (v) { return STATUS[KEYS[v.challenge] + v.cell]; },
    examples: [
      {name: "G1 damage, p53 lost", values: {challenge: "G1 DNA damage", cell: "cancer"}},
      {name: "G1 damage, normal cell", values: {challenge: "G1 DNA damage", cell: "normal"}},
      {name: "G2 uncopied DNA, cancer", values: {challenge: "G2 incomplete replication", cell: "cancer"}},
      {name: "G2 uncopied DNA, normal", values: {challenge: "G2 incomplete replication", cell: "normal"}},
      {name: "unattached kinetochore, cancer", values: {challenge: "M spindle attachment error", cell: "cancer"}},
      {name: "unattached kinetochore, normal", values: {challenge: "M spindle attachment error", cell: "normal"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, key = KEYS[v.challenge], bad = v.cell === "cancer";
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var rod = function (x, y, h, col, o) { o = o || {}; api.rect(x - 3, y - h / 2, 6, h, {fill: col, rx: 3, opacity: o.op}); };
      var xchrom = function (x, y, h, col, o) {   // a replicated chromosome: two sister chromatids joined at the centromere
        o = o || {}; rod(x - 3.5, y, h, col); rod(x + 3.5, y, h, col);
        api.circle([x, y + (o.cen || 0)], 3, {fill: c.card, stroke: col, width: 1.5});
      };
      var zap = function (x, y) { api.path("M " + (x - 7) + " " + (y - 8) + " L " + (x + 1) + " " + (y - 1) + " L " + (x - 3) + " " + (y + 1) + " L " + (x + 7) + " " + (y + 9), {stroke: c.c5, width: 2.4}); };
      [["1  problem", 62], ["2  checkpoint", 198], ["3  daughters", 336]].forEach(function (h) { L([h[1], 14], h[0], c.muted, {anchor: "middle", weight: 600}); });
      api.arrow([118, 150], [131, 150], {color: c.faint, width: 2, halo: false, head: 8});
      api.arrow([265, 150], [290, 150], {color: c.faint, width: 2, halo: false, head: 8});
      // ---- 1: the cell with its problem ----
      var C1 = [62, 140];
      api.circle(C1, 54, {stroke: c.muted, width: 1.6});
      if (key === "g1") {
        api.circle(C1, 36, {stroke: c.faint, width: 1.2, dash: "4 3"});
        rod(C1[0] - 10, C1[1], 40, c.c2); rod(C1[0] + 10, C1[1], 40, c.c6);
        zap(C1[0] + 10, C1[1] - 6);
        L([C1[0], 212], "DNA damage", c.c5, {anchor: "middle"});
        L([C1[0], 227], "found in G₁", c.muted, {anchor: "middle", weight: 500});
      } else if (key === "g2") {
        api.circle(C1, 36, {stroke: c.faint, width: 1.2, dash: "4 3"});
        rod(C1[0] - 3.5, C1[1] - 16, 16, c.c2); rod(C1[0] + 3.5, C1[1] - 16, 16, c.c2);
        api.rect(C1[0] - 4, C1[1] - 8, 8, 14, {fill: c.c5, rx: 3});
        rod(C1[0] - 3.5, C1[1] + 15, 18, c.c2); rod(C1[0] + 3.5, C1[1] + 15, 18, c.c2);
        api.line([C1[0] + 8, C1[1] - 1], [C1[0] + 30, C1[1] - 12], {color: c.c5, width: 1.4});
        L([C1[0], 212], "uncopied stretch", c.c5, {anchor: "middle"});
        L([C1[0], 227], "at the end of G₂", c.muted, {anchor: "middle", weight: 500});
      } else {
        // one homolog pair, each chromosome = two sister chromatids stacked toward the two poles (P1 top, P2 bottom):
        // the purple one is bi-oriented at the plate; the blue one is mono-oriented (only its top kinetochore holds a
        // fiber from P1), so its bottom kinetochore, facing P2, is unattached. These 4 chromatids are the daughters' 2+2 or 3+1.
        var P1 = [C1[0], C1[1] - 44], P2 = [C1[0], C1[1] + 44];
        [P1, P2].forEach(function (p) { api.circle(p, 4, {fill: c.c4}); });
        var sisters = function (x, y, col) {
          api.rect(x - 12, y - 7.5, 24, 6.5, {fill: col, rx: 3}); api.rect(x - 12, y + 1, 24, 6.5, {fill: col, rx: 3});
          api.circle([x, y], 3, {fill: c.card, stroke: col, width: 1.4});
        };
        var A = [C1[0] - 18, C1[1]], B = [C1[0] + 18, C1[1] - 10];
        api.line(P1, [A[0], A[1] - 8], {color: c.c4, width: 1.3, opacity: 0.85}); api.line(P2, [A[0], A[1] + 8], {color: c.c4, width: 1.3, opacity: 0.85});
        api.line(P1, [B[0], B[1] - 8], {color: c.c4, width: 1.3, opacity: 0.85});
        sisters(A[0], A[1], c.c6); sisters(B[0], B[1], c.c2);
        api.circle([B[0], B[1] + 11], 6, {stroke: c.c5, width: 1.7});
        L([C1[0], 212], "unattached", c.c5, {anchor: "middle"});
        L([C1[0], 227], "kinetochore", c.muted, {anchor: "middle", weight: 500});
      }
      // ---- 2: the checkpoint chain, working or lost ----
      var X = 134, W = 128, steps = CHAIN[key];
      steps.forEach(function (s, i) {
        var y = 40 + i * 52, broken = bad && i === 1;   // the relay is what a cancer cell loses
        api.rect(X, y, W, 36, {fill: c.ink, fillOpacity: 0.04, stroke: broken ? c.c5 : i === 2 ? (bad ? c.c4 : c.c5) : c.c1, width: 1.4, rx: 7, opacity: bad && i === 2 ? 0.9 : 1});
        L([X + W / 2, y + 12], s[0], broken ? c.c5 : c.ink, {anchor: "middle", size: 12.5, weight: 650});
        L([X + W / 2, y + 27], broken ? LOST[key] : i === 2 && bad ? "stays active" : s[1], broken ? c.c5 : c.muted, {anchor: "middle", weight: 500});
        if (broken) {   // a red X badge on the box's right edge marks the lost relay; the labels stay clear
          var bx = X + W, by = y + 18;
          api.circle([bx, by], 8, {fill: c.c5, stroke: c.card, width: 1.5});
          api.line([bx - 3.5, by - 3.5], [bx + 3.5, by + 3.5], {color: c.card, width: 2});
          api.line([bx - 3.5, by + 3.5], [bx + 3.5, by - 3.5], {color: c.card, width: 2});
        }
        if (i < 2) {
          if (i === 1) {   // the inhibitory link onto the brake target
            api.line([X + W / 2, y + 37], [X + W / 2, y + 50], {color: bad ? c.faint : c.c5, width: 2, dash: bad ? "3 3" : null});
            api.line([X + W / 2 - 8, y + 50], [X + W / 2 + 8, y + 50], {color: bad ? c.faint : c.c5, width: 2.5});
          } else api.arrow([X + W / 2, y + 37], [X + W / 2, y + 51], {color: c.c1, width: 2, halo: false, head: 7});
        }
      });
      var vy = 210;
      if (bad) {
        api.rect(X, vy, W, 30, {fill: c.c4, fillOpacity: 0.15, stroke: c.c4, width: 1.4, rx: 15});
        L([X + W / 2, vy + 15], "no arrest: divides", c.c4, {anchor: "middle", weight: 650});
      } else {
        api.rect(X, vy, W, 30, {fill: c.c5, fillOpacity: 0.15, stroke: c.c5, width: 1.4, rx: 15});
        L([X + W / 2, vy + 15], key === "g1" ? "arrest: repair or die" : "arrest: wait", c.c5, {anchor: "middle", weight: 650});
      }
      // ---- 3: the two daughters ----
      var D1 = [336, 92], D2 = [336, 200], R = 38;
      [D1, D2].forEach(function (d) { api.circle(d, R, {stroke: c.muted, width: 1.6}); });
      var pair = function (d, cols, o) { o = o || {}; cols.forEach(function (col, i) { rod(d[0] - (cols.length - 1) * 8 + i * 16, d[1], 30, col); }); };
      if (!bad) {
        pair(D1, [c.c2, c.c6]); pair(D2, [c.c2, c.c6]);
        L([D1[0], D1[1] + R + 12], "2 copies, intact", c.c4, {anchor: "middle"});
        L([D2[0], D2[1] + R + 12], "2 copies, intact", c.c4, {anchor: "middle"});
      } else if (key === "g1") {
        pair(D1, [c.c2, c.c6]); pair(D2, [c.c2, c.c6]);
        api.rect(D2[0] + 5, D2[1] - 4, 6, 8, {fill: c.c5, rx: 1});
        L([D1[0], D1[1] + R + 12], "normal copy", c.muted, {anchor: "middle", weight: 500});
        L([D2[0], D2[1] + R + 12], "mutation, inherited", c.c5, {anchor: "middle"});
      } else if (key === "g2") {
        rod(D1[0] - 8, D1[1], 30, c.c6); rod(D1[0] + 8, D1[1] + 7, 16, c.c2);
        api.line([D1[0] + 8, D1[1] - 9], [D1[0] + 8, D1[1] - 15], {color: c.c5, width: 2, dash: "2 2"});
        pair(D2, [c.c2, c.c6]);
        api.circle([D2[0] + 19, D2[1] - 19], 7, {stroke: c.c5, width: 1.4}); rod(D2[0] + 19, D2[1] - 19, 8, c.c2);   // 26.9 + 7 < R
        L([D1[0], D1[1] + R + 12], "deletion", c.c5, {anchor: "middle"});
        L([D2[0], D2[1] + R + 12], "fragment in micronucleus", c.c5, {anchor: "middle"});
      } else {
        pair(D1, [c.c2, c.c2, c.c6]); pair(D2, [c.c6]);
        L([D1[0], D1[1] + R + 12], "3 copies", c.c5, {anchor: "middle"});
        L([D2[0], D2[1] + R + 12], "1 copy", c.c5, {anchor: "middle"});
      }
      L([200, 284], bad ? "the error is passed on: genome instability" : "the genome is kept intact", bad ? c.c5 : c.c4, {anchor: "middle", size: 12.5, weight: 650});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
