// Joining two Okazaki fragments, base by base. Close-up of a lagging strand with the fork off to the left, so the new
// strand reads 5'->3' left to right: the newer fragment (left) has grown up to the older fragment's RNA primer (right).
// E. coli: pol I binds the 3'-OH, its 5'->3' exonuclease removes the ribonucleotides one by one while its polymerase
// fills in DNA behind (nick translation); DNA ligase then seals the nick using NAD+ (-> AMP + NMN). Human: pol delta
// keeps synthesizing and peels the RNA off as a 5' flap, FEN1 cuts the flap (RNase H2 and Dna2 help), and DNA ligase I
// seals the nick using ATP (-> AMP + PPi). Primers are about 10-12 nt; drawn 4 nt so the bases stay legible.
(function () {
  var TPL = "TACGGTCAAGTACATG", PAIR = {A: "T", T: "A", G: "C", C: "G"}, NB = 7, RNA = [7, 10];
  var CELL = {
    "E. coli": {pol: "pol III", fix: "pol I", lig: "DNA ligase", co: "NAD⁺ → AMP + NMN"},
    "human": {pol: "pol δ", fix: "pol δ + FEN1", lig: "DNA ligase I", co: "ATP → AMP + PPᵢ"}
  };
  function X(i) { return 36 + i * 22; }

  Viz.register("dna-replication-okazaki-fragment-joining", {
    title: "Joining Okazaki fragments",
    subject: "biology",
    shows: "Step through how two Okazaki fragments become one strand: the RNA primer between them is removed and replaced with DNA, leaving a nick that DNA ligase seals; switch between E. coli and human enzymes",
    params: {
      cell: {kind: "enum", values: ["E. coli", "human"], default: "E. coli", label: "\\text{cell}"}
    },
    steps: ["fragments meet at a primer", "primer removed, DNA filled in", "a nick is left", "ligase seals the nick"],
    stepMs: 1800,
    formula: function (v) {
      var e = v.cell === "E. coli", s = v.step || 1;
      return ["\\text{DNA }3'\\text{-OH meets RNA }5'\\text{ end}",
        e ? "\\text{pol I: }5'\\to3'\\text{ exo out, DNA in}" : "\\text{pol }\\delta\\text{ makes a flap, FEN1 cuts it}",
        "\\text{nick: }3'\\text{-OH beside a }5'\\text{-phosphate}",
        e ? "\\text{ligase: NAD}^+\\to\\text{AMP}+\\text{NMN}" : "\\text{ligase I: ATP}\\to\\text{AMP}+\\text{PP}_i"][s - 1];
    },
    status: function (v) {
      var e = v.cell === "E. coli", s = v.step || 1;
      return [(e ? "Pol III" : "Pol δ") + " has extended the newer fragment right up to the older fragment's <b>RNA primer</b>; DNA and RNA now sit end to end.",
        e ? "<b>Pol I</b> starts at the 3′-OH: its 5′→3′ exonuclease clips off the ribonucleotides one by one while it fills the space with <b>DNA</b>."
          : "<b>Pol δ</b> keeps copying and peels the RNA primer off as a flap, which <b>FEN1</b> cuts away.",
        "The RNA is gone and the space is DNA, but one bond is missing: a <b>nick</b> between a 3′-OH and a 5′-phosphate.",
        "<b>" + (e ? "DNA ligase" : "DNA ligase I") + "</b> forms that last phosphodiester bond, spending " + (e ? "NAD⁺" : "ATP") + ", and the two fragments are one strand."][s - 1];
    },
    examples: [
      {name: "E. coli, fragments meet", values: {cell: "E. coli", step: 1}},
      {name: "E. coli, nick translation", values: {cell: "E. coli", step: 2}},
      {name: "human, flap cut", values: {cell: "human", step: 2}},
      {name: "E. coli, the nick", values: {cell: "E. coli", step: 3}},
      {name: "human, sealed", values: {cell: "human", step: 4}}
    ],
    size: [400, 250],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, o = CELL[v.cell], e = v.cell === "E. coli";
      var yN = 128, yT = 164, yB = yN - 15;
      // how far DNA has replaced the primer at this step, and the flap (human, step 2)
      var filled = s === 1 ? NB - 1 : s === 2 ? (e ? 8 : 9) : 10;
      var flap = !e && s === 2;
      // template
      api.line([X(0) - 12, yT + 14], [X(15) + 12, yT + 14], {color: c.c2, width: 3});
      for (var i = 0; i < 16; i++) api.label([X(i), yT], TPL.charAt(i), {color: c.c2, size: 13, weight: 650, anchor: "middle"});
      api.label([X(0) - 24, yT + 14], "3′", {color: c.c2, size: 12, anchor: "middle"});
      api.label([X(15) + 22, yT + 14], "5′", {color: c.c2, size: 12, anchor: "middle"});
      // new strand, base by base: DNA (amber), primer RNA (red), DNA laid down in this repair (green)
      for (i = 0; i < 16; i++) {
        var b = PAIR[TPL.charAt(i)], inRna = i >= RNA[0] && i <= RNA[1], col, txt = b, y = yN, x = X(i);
        if (inRna && i <= filled) col = c.c4;
        else if (inRna) { col = c.c5; txt = b.replace("T", "U"); }
        else col = c.c3;
        api.line([x, yN + 8], [x, yT - 8], {color: c.faint, width: 1.2});
        api.label([x, y], txt, {color: col, size: 13, weight: 700, anchor: "middle"});
        if (flap && inRna && i < 10) api.label([X(10) - (10 - i) * 15 - 4, yN - 18 - (10 - i) * 16], b.replace("T", "U"), {color: c.c5, size: 13, weight: 700, anchor: "middle"});
      }
      // backbones, broken at the nick until ligase seals it
      var nick = s === 4 ? null : s === 1 ? 6 : s === 2 ? filled : 10;
      var run = function (a, z, col) { api.line([X(a) - 9, yB], [X(z) + 9, yB], {color: col, width: 2.5}); };
      if (nick === null) run(0, 15, c.c3);
      else { run(0, nick, c.c3); if (!flap) run(nick + 1, 15, c.c3); else { run(10, 15, c.c3); api.line([X(10) - 9, yB], [X(10) - 64, yB - 50], {color: c.c5, width: 2, opacity: 0.7}); } }
      if (nick !== null && !flap) {
        api.line([X(nick) + 11, yB - 9], [X(nick) + 11, yB + 9], {color: c.c1, width: 2});
        if (s !== 2) api.label([X(nick) + 11, yB - 18], "nick", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      }
      api.label([X(0) - 24, yB], "5′", {color: c.c3, size: 12, anchor: "middle"});
      api.label([X(15) + 22, yB], "3′", {color: c.c3, size: 12, anchor: "middle"});
      // fragment names and the fork
      api.label([X(3), 30], "newer fragment", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      api.label([X(12), 30], "older fragment", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      api.line([X(6) + 11, 22], [X(6) + 11, 40], {color: c.faint, width: 1});
      if (s < 3) api.label([X(8.5), 50], "RNA primer", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      if (s >= 2) api.label([X(3), 214], "green: DNA that replaced the RNA", {color: c.c4, size: 12, anchor: "middle"});
      api.arrow([92, 238], [36, 238], {color: c.muted, width: 2, halo: false});
      api.label([98, 238], "fork is this way", {color: c.muted, size: 12});
      // the enzyme at work
      var blob = function (cx, w, name, ly) {
        api.rect(cx - w / 2, yN - 30, w, 50, {fill: c.c6, fillOpacity: 0.18, stroke: c.c6, width: 1.6, rx: 16});
        if (name) api.label([cx, ly || yN - 40], name, {color: c.c6, size: 12, weight: 700, anchor: "middle"});
      };
      if (s === 1) {
        api.rect(X(4) - 20, yN - 66, 46, 26, {fill: c.c6, fillOpacity: 0.1, stroke: c.c6, width: 1.4, rx: 12, dash: "4 3"});
        api.label([X(4) + 3, yN - 53], o.pol, {color: c.c6, size: 12, weight: 700, anchor: "middle"});
        api.arrow([X(5) + 4, yN - 24], [X(5) + 10, yN - 38], {color: c.c6, width: 2, halo: false, head: 7});
        api.label([X(6) + 18, yN - 53], e ? "lets go at the primer" : "reaches the primer", {color: c.c6, size: 12});
      } else if (s === 2 && e) {
        blob(X(8) + 11, 46, "pol I");
        [[0, 7], [1, 8]].forEach(function (q) { api.label([X(9) + 34 + q[0] * 20, 64 - q[0] * 6], PAIR[TPL.charAt(q[1])].replace("T", "U"), {color: c.c5, size: 13, weight: 700, anchor: "middle", opacity: 0.75}); });
        api.label([X(11) + 30, 76], "ribonucleotides out", {color: c.c5, size: 12, anchor: "start"});
      } else if (s === 2) {
        blob(X(8), 50, "");
        api.label([X(8) - 32, yN - 30], "pol δ", {color: c.c6, size: 12, weight: 700, anchor: "end"});
        api.circle([X(10) - 12, yB - 14], 9, {fill: c.c6, fillOpacity: 0.35, stroke: c.c6, width: 1.6});
        api.label([X(10) + 4, yB - 26], "FEN1 cuts the flap", {color: c.c6, size: 12, weight: 700});
      } else if (s === 3) {
        api.label([X(10), yB - 34], "3′-OH", {color: c.c1, size: 12, weight: 650, anchor: "end"});
        api.label([X(11), yB - 34], "5′-P", {color: c.c1, size: 12, weight: 650, anchor: "start"});
      } else {
        api.circle([X(10) + 11, yB], 10, {fill: c.c6, fillOpacity: 0.35, stroke: c.c6, width: 1.8});
        api.label([X(10) + 11, yB - 22], o.lig, {color: c.c6, size: 12, weight: 700, anchor: "middle"});
        api.label([X(10) + 11, yB - 38], o.co, {color: c.c6, size: 12, anchor: "middle"});
      }
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
