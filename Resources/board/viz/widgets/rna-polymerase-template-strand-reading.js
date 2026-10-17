// Which DNA strand gets read depends on which way the gene points. RNA polymerase can only build RNA 5'->3', so it must
// read its template 3'->5'; the promoter sets the direction of travel, and that fixes the template: moving right along
// this duplex (top strand 5'->3' left to right) it reads the bottom strand; moving left it reads the top strand. Either
// way the RNA is complementary and antiparallel to the template and spells the other (coding) strand with U for T.
// Two genes on the same stretch of DNA can therefore use opposite strands.
(function () {
  var TOP = "ATGGCATTCGGAACTT", COMP = {A: "T", T: "A", G: "C", C: "G"}, RNA = {A: "U", T: "A", G: "C", C: "G"}, N = TOP.length;
  var BOT = TOP.split("").map(function (b) { return COMP[b]; }).join("");
  function model(v) {
    var right = v.promoter === "left", k = v.k, idx = [];
    for (var j = 0; j < k; j++) idx.push(right ? j : N - 1 - j);              // template positions in the order they are read
    var tpl = right ? BOT : TOP, cod = right ? TOP : BOT;
    return {right: right, k: k, idx: idx, tpl: idx.map(function (i) { return tpl[i]; }).join(""), rna: idx.map(function (i) { return RNA[tpl[i]]; }).join(""),
            cod: idx.map(function (i) { return cod[i]; }).join("")};
  }
  Viz.register("rna-polymerase-template-strand-reading", {
    title: "Which strand is the template?",
    subject: "biology",
    shows: "Flip the promoter to the other end: the polymerase travels the other way, so it reads the other strand 3′→5′, and the RNA always spells the coding strand with U for T",
    params: {
      promoter: {kind: "enum", values: ["left", "right"], default: "left", label: "\\text{promoter}", names: {left: "on the left", right: "on the right"}},
      k: {kind: "integer", default: 7, min: 1, max: 16, label: "\\text{RNA nt}"}
    },
    formula: function (v) {
      var m = model(v);
      return "\\begin{array}{rl}\\text{template}&3'\\text{-}\\texttt{" + m.tpl + "}\\text{-}5'\\\\\\text{RNA}&5'\\text{-}\\texttt{" + m.rna + "}\\text{-}3'\\\\" +
        "\\text{coding}&5'\\text{-}\\texttt{" + m.cod + "}\\text{-}3'\\end{array}";
    },
    status: function (v) {
      var m = model(v);
      return "Promoter on the " + v.promoter + ": the polymerase moves <b>" + (m.right ? "right" : "left") + "</b>, so it reads the <b>" + (m.right ? "bottom" : "top") +
        "</b> strand 3′→5′, and its " + m.k + (m.k === 1 ? " RNA base matches" : " RNA bases match") + " the " + (m.right ? "top" : "bottom") + " strand with U for T.";
    },
    examples: [
      {name: "first base, gene runs right", values: {promoter: "left", k: 1}},
      {name: "whole gene, runs left", values: {promoter: "right", k: 16}},
      {name: "gene runs left, partway", values: {promoter: "right", k: 6}}
    ],
    size: [400, 260],
    draw: function (api, v) {
      var c = api.color, m = model(v), X = function (i) { return 100 + i * 17; };
      var yTop = m.right ? 92 : 128, yBot = yTop + 34, yR = m.right ? yBot + 36 : yTop - 36, yTpl = m.right ? yBot : yTop;
      var tplCol = c.c2, codCol = c.c1;
      // RNA polymerase over the newest few bases
      var a = m.right ? Math.max(0, m.k - 6) : N - m.k, b = m.right ? m.k - 1 : Math.min(N - 1, N - m.k + 5);
      var py0 = Math.min(yTop, yR) - 18, py1 = Math.max(yBot, yR) + 18;
      api.rect(X(a) - 10, py0, X(b) - X(a) + 20, py1 - py0, {rx: 16, fill: c.c6, fillOpacity: 0.08, stroke: c.c6, width: 1.2, dash: "5 4"});
      // RNA behind the polymerase has left the template (which re-pairs with the coding strand): it bends away from the duplex
      var rnaY = function (i) {
        var j = m.right ? a - i : i - b;   // positions past the polymerase's trailing edge
        return j > 0 ? yR + (m.right ? 1 : -1) * Math.round(28 * (1 - Math.exp(-j / 2))) : yR;
      };
      api.label([m.right ? X(b) + 18 : X(a) - 18, m.right ? py1 + 14 : py0 - 14], m.right ? "RNA polymerase →" : "← RNA polymerase", {color: c.c6, size: 12, anchor: m.right ? "start" : "end"});
      // the two strands
      for (var i = 0; i < N; i++) {
        var read = m.idx.indexOf(i) >= 0;
        api.label([X(i), yTop], TOP[i], {color: m.right ? codCol : tplCol, size: 13.5, weight: 700, anchor: "middle", opacity: !m.right && read ? 1 : 0.8});
        api.label([X(i), yBot], BOT[i], {color: m.right ? tplCol : codCol, size: 13.5, weight: 700, anchor: "middle", opacity: m.right && read ? 1 : 0.8});
        if (!(i >= a && i <= b)) api.line([X(i), yTop + 9], [X(i), yBot - 9], {color: c.ink, width: 1.1, opacity: 0.35});   // the duplex is open inside the polymerase
        if (read) {
          var inPol = i >= a && i <= b;
          api.label([X(i), rnaY(i)], RNA[(m.right ? BOT : TOP)[i]], {color: c.c3, size: 13.5, weight: 700, anchor: "middle", opacity: inPol ? 1 : 0.75});
          if (inPol) api.line([X(i), Math.min(yTpl, yR) + 9], [X(i), Math.max(yTpl, yR) - 9], {color: c.ink, width: 1.1, opacity: 0.5});
        }
      }
      // strand names on the left, ends on both sides
      api.label([80, yTop], (m.right ? "coding" : "template") + " 5′", {color: m.right ? codCol : tplCol, size: 12.5, weight: 650, anchor: "end"});
      api.label([80, yBot], (m.right ? "template" : "coding") + " 3′", {color: m.right ? tplCol : codCol, size: 12.5, weight: 650, anchor: "end"});
      api.label([X(N - 1) + 20, yTop], "3′", {color: m.right ? codCol : tplCol, size: 12, anchor: "middle"});
      api.label([X(N - 1) + 20, yBot], "5′", {color: m.right ? tplCol : codCol, size: 12, anchor: "middle"});
      // an RNA end that reaches position 0 shares the row label, like the DNA strands
      var first = m.idx[0], last = m.idx[m.k - 1], leftEnd = m.right ? "5′" : last === 0 ? "3′" : "";
      api.label([80, m.right ? rnaY(0) : yR], "RNA" + (leftEnd ? " " + leftEnd : ""), {color: c.c3, size: 12.5, weight: 650, anchor: "end"});   // follows a peeled 5' end
      if (!m.right) api.label([X(first) + 20, rnaY(first)], "5′", {color: c.c3, size: 12, anchor: "middle"});
      if (m.right || last > 0) api.label([X(last) + (m.right ? 20 : -20), yR], "3′", {color: c.c3, size: 12, anchor: "middle"});
      // the promoter: a bent arrow at the start of the gene, pointing the way transcription goes
      var sx = m.right ? X(0) - 9 : X(N - 1) + 9, dir = m.right ? 1 : -1, yA = m.right ? yTop - 14 : yBot + 14, yA2 = m.right ? yTop - 40 : yBot + 40;
      api.line([sx, yA], [sx, yA2], {color: c.ink, width: 2});
      api.arrow([sx, yA2], [sx + dir * 40, yA2], {color: c.ink, width: 2, halo: false, head: 8});
      if (m.right) api.label([sx - 6, yA2], "promoter", {color: c.ink, size: 12.5, weight: 650, anchor: "end"});
      else api.label([sx + 4, yA2 + 16], "promoter", {color: c.ink, size: 12.5, weight: 650, anchor: "end"});
      // the reading direction under the template
      api.label([200, m.right ? 240 : 22], "template read 3′→5′, RNA built 5′→3′", {color: c.muted, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
