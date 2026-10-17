// The G2/M replication checkpoint: a cell must not divide until every stretch of its DNA is copied. Unfinished or
// stalled forks expose single-stranded DNA coated with RPA, which recruits ATR (with ATRIP); ATR activates Chk1, and
// Chk1 inhibits Cdc25 and activates Wee1. Wee1 keeps the inhibitory phosphate on CDK1 (Tyr15), Cdc25 would remove it,
// so cyclin B-CDK1 stays off and the cell waits in G2. When the last fork finishes, ATR falls silent, Cdc25 wins and
// the cell enters mitosis. Block Chk1 (Chk1-inhibitor drugs) and the cell divides with DNA still uncopied.
// The chromosome is drawn with five origins firing together, so each unreplicated gap is (100 - copied)% / 5 long.
(function () {
  var N = 5;
  function state(v) { var done = v.copied >= 100; return {done: done, held: !done && v.chk1 === "working", crash: !done && v.chk1 === "inhibited"}; }

  Viz.register("g2-replication-completion-checkpoint", {
    title: "G2/M replication checkpoint",
    subject: "biology",
    shows: "Slide how much of the DNA is copied: while any fork is still open, ATR and Chk1 keep cyclin B–CDK1 switched off and the cell waits in G2; finish replication, or block Chk1, and it enters mitosis",
    params: {
      copied: {kind: "number", default: 85, min: 50, max: 100, step: 5, label: "\\%\\ \\text{copied}"},
      chk1: {kind: "enum", values: ["working", "inhibited"], default: "working", label: "\\text{Chk1}"}
    },
    formula: function (v) {
      var st = state(v);
      if (st.done) return "\\text{no ssDNA}\\Rightarrow\\text{ATR, Chk1 off}\\newline\\text{Cdc25}\\to\\text{CDK1 on}\\to\\text{mitosis}";
      if (st.crash) return "\\text{ATR}\\to\\cancel{\\text{Chk1}}\\Rightarrow\\text{Cdc25}\\to\\text{CDK1 on}\\newline\\text{mitosis with }" + (100 - v.copied) + "\\%\\text{ uncopied}";
      return "\\text{ssDNA at forks}\\to\\text{ATR}\\to\\text{Chk1}\\newline\\text{Chk1}\\dashv\\text{Cdc25: CDK1-P stays off}";
    },
    status: function (v) {
      var st = state(v), left = 100 - v.copied;
      if (st.done && v.chk1 === "inhibited") return "Replication is complete, so blocking Chk1 changes nothing here: Cdc25 activates cyclin B–CDK1 and the cell <b>enters mitosis</b> normally.";
      if (st.done) return "Replication is complete: with no single-stranded DNA left, ATR falls silent, Cdc25 strips the inhibitory phosphate off CDK1 and the cell <b>enters mitosis</b>.";
      if (st.crash) return "With Chk1 blocked the alarm goes nowhere: Cdc25 switches on CDK1 and the cell divides with <b>" + left + "%</b> of its DNA uncopied, so chromosomes break (<b>mitotic catastrophe</b>), the idea behind Chk1-inhibitor cancer drugs.";
      return "<b>" + left + "%</b> of the DNA is still uncopied, so ATR–Chk1 keep Cdc25 off and Wee1 on: CDK1 keeps its inhibitory phosphate and the cell <b>waits in G2</b>.";
    },
    examples: [
      {name: "halfway: held in G2", values: {copied: 50, chk1: "working"}},
      {name: "fully copied: mitosis", values: {copied: 100, chk1: "working"}},
      {name: "Chk1 inhibitor: divides too early", values: {copied: 80, chk1: "inhibited"}},
      {name: "inhibitor, but replication done", values: {copied: 100, chk1: "inhibited"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, st = state(v), p = v.copied / 100, red = c.c5, grn = c.c4;
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // ---- one chromosome: replicated stretches as two sister strands, gaps as one strand, forks at the edges ----
      var x0 = 20, x1 = 296, yc = 44, X = function (f) { return x0 + f * (x1 - x0); }, h = p / (2 * N);
      T([x0, 12], "one chromosome, " + v.copied + "% copied", c.muted, {weight: 500});
      if (!st.done) api.line([X(0), yc], [X(1), yc], {color: c.c2, width: 2.5});
      var forks = [];
      if (st.done) [-1, 1].forEach(function (sg) { api.line([X(0), yc + sg * 7], [X(1), yc + sg * 7], {color: c.c2, width: 2.5}); });
      for (var i = 0; i < N && !st.done; i++) {
        var o = (i + 0.5) / N, a = Math.max(0, o - h), b = Math.min(1, o + h);
        [-1, 1].forEach(function (sg) {
          api.path("M " + X(a) + " " + yc + " C " + (X(a) + 6) + " " + (yc + sg * 7) + " " + (X(a) + 6) + " " + (yc + sg * 7) + " " + (X(a) + 10) + " " + (yc + sg * 7) +
            " L " + (X(b) - 10) + " " + (yc + sg * 7) + " C " + (X(b) - 6) + " " + (yc + sg * 7) + " " + (X(b) - 6) + " " + (yc + sg * 7) + " " + X(b) + " " + yc, {stroke: c.c2, width: 2.5});
        });
        if (!st.done) { forks.push(X(a)); forks.push(X(b)); }
      }
      // with Chk1 blocked the cell divides anyway: the uncopied stretches between the bubbles are where chromosomes break
      if (st.crash) for (var g = 0; g <= N; g++) {
        var ga = g === 0 ? 0 : (g - 0.5) / N + h, gb = g === N ? 1 : (g + 0.5) / N - h;
        if (gb - ga > 1e-6) api.line([X(ga), yc], [X(gb), yc], {color: red, width: 2.5});
      }
      forks.forEach(function (fx) { api.circle([fx, yc], 3.6, {fill: red}); });
      if (!st.done) {
        T([x1, 66], (2 * N) + " open forks: ssDNA + RPA recruit ATR", red, {anchor: "end"});
        api.line([X(0.1 - h) , yc + 6], [60, 94], {color: red, width: 1.6, arrow: true});
      } else T([x1, 66], "every stretch copied: no open forks", c.c2, {anchor: "end"});
      // ---- the switch: ATR -> Chk1, Chk1 -> Wee1 (adds P to CDK1), Chk1 -| Cdc25 (removes it) ----
      var alarm = !st.done, chkOn = st.held, wee = st.held, cdc = !st.held, cdk = !st.held;
      var box = function (xa, xb, y, text, on, col) {
        api.rect(xa, y - 13, xb - xa, 26, {fill: on ? col : c.faint, fillOpacity: on ? 0.2 : 0.04, stroke: on ? col : c.faint, width: on ? 1.8 : 1, rx: 7});
        T([(xa + xb) / 2, y], text, on ? col : c.muted, {anchor: "middle", weight: on ? 650 : 500});
      };
      var act = function (a, b, on, col) { api.line(a, b, {color: on ? col : c.faint, width: 1.8, arrow: true}); };
      var inh = function (a, b, on, col) {
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), px = -dy / L * 6, py = dx / L * 6, k = on ? col : c.faint;
        api.line(a, b, {color: k, width: 1.8}); api.line([b[0] + px, b[1] + py], [b[0] - px, b[1] - py], {color: k, width: 2.4});
      };
      var yA = 108, yB = 170;
      box(20, 100, yA, "ATR", alarm, red);
      box(150, 230, yA, v.chk1 === "inhibited" ? "Chk1 (drug)" : "Chk1", chkOn, red);
      if (v.chk1 === "inhibited") api.line([156, yA + 9], [224, yA - 9], {color: red, width: 1.6});
      act([100, yA], [148, yA], alarm && v.chk1 === "working", red);
      box(20, 100, yB, "Wee1", wee, red);
      box(290, 380, yB, "Cdc25", cdc, grn);
      act([170, yA + 13], [80, yB - 15], chkOn, red);
      inh([212, yA + 13], [318, yB - 15], chkOn, red);
      box(132, 258, yB, "cyclin B–CDK1", cdk, grn);
      if (!cdk) { api.circle([252, yB - 13], 8, {fill: c.c3}); T([252, yB - 13], "P", c.card, {anchor: "middle", weight: 700}); }
      act([100, yB], [130, yB], wee, red); T([115, yB - 10], "+P", wee ? red : c.faint, {anchor: "middle", weight: 700});
      act([290, yB], [260, yB], cdc, grn); T([275, yB - 10], "−P", cdc ? grn : c.faint, {anchor: "middle", weight: 700});
      T([195, yB + 23], cdk ? "MPF active" : "Tyr15 phosphate: MPF off", cdk ? grn : c.c3, {anchor: "middle", weight: 600});
      // ---- outcome and the cell itself ----
      var oc = st.held ? red : st.crash ? red : grn;
      var line1 = st.held ? "held in G2" : st.crash ? "mitosis too early: mitotic catastrophe" : "enters mitosis";
      var line2 = st.held ? "no mitosis until the last fork finishes" : st.crash ? (100 - v.copied) + "% uncopied: chromosomes break apart" : "chromosomes condense and separate";
      api.rect(20, 214, 274, 42, {fill: oc, fillOpacity: 0.1, stroke: oc, width: 1.2, rx: 8});
      T([157, 228], line1, oc, {anchor: "middle", weight: 700}); T([157, 244], line2, c.ink, {anchor: "middle", weight: 500});
      var cx = 344, cy = 236;
      api.circle([cx, cy], 36, {fill: c.ink, fillOpacity: 0.04, stroke: c.muted, width: 1.4});
      if (st.held) {
        api.circle([cx, cy], 20, {fill: c.c2, fillOpacity: 0.15, stroke: c.c2, width: 1.5});
        [[-8, -5], [6, -8], [-2, 6], [9, 5]].forEach(function (d) { api.path("M " + (cx + d[0] - 5) + " " + (cy + d[1]) + " q 3 -4 6 0 t 6 0", {stroke: c.c2, width: 1.5}); });
      } else {
        [-14, -5, 4, 13].forEach(function (dx, j) {
          var y = cy + (j % 2 ? 4 : -4), broke = st.crash && j % 2 === 0;
          api.line([cx + dx - 4, y - 9], [cx + dx + 4, y + 9], {color: broke ? red : c.c2, width: 3});
          if (!broke) api.line([cx + dx + 4, y - 9], [cx + dx - 4, y + 9], {color: c.c2, width: 3});
          else api.line([cx + dx + 5, y - 10], [cx + dx + 1, y - 3], {color: red, width: 3});
        });
      }
      T([cx, 284], st.held ? "G2 nucleus" : st.crash ? "broken chromosomes" : "mitosis", st.held ? c.c2 : st.crash ? red : c.c2, {anchor: "middle"});
      [[20, "→ activates"], [94, "⊣ inhibits"], [160, "P on CDK1 = off"]].forEach(function (q) { T([q[0], 284], q[1], c.muted, {weight: 500}); });   // SVG collapses runs of spaces
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
