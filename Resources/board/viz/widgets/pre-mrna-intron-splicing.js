// How the spliceosome cuts an intron out, in five pictures. (1) The intron's signals: GU at its 5' end, a branch-point A,
// a polypyrimidine tract (Y)n and AG at its 3' end. (2) Recognition: U1 snRNP base-pairs with the 5' splice site, U2AF
// binds the pyrimidine tract and the AG, and U2 snRNP pairs with the branch site so the A bulges out unpaired. (3) The
// U4/U6.U5 tri-snRNP joins; U1 and U4 leave, U6 takes over the 5' splice site and pairs with U2 to form the catalytic
// core, and U5 holds the exon. (4) First transesterification: the 2'-OH of the branch A attacks the phosphate at the 5'
// splice site, freeing exon 1 with a 3'-OH and joining the intron's first G to the A by a 2'-5' bond: a lariat. (5) Second
// transesterification: exon 1's 3'-OH attacks the phosphate at the 3' splice site, the exons are joined and the lariat is
// released, debranched and degraded; an exon junction complex (EJC) is left about 20-24 nt upstream of the new junction.
// Two phosphodiester bonds are broken and two are made, so splicing needs no ATP for the chemistry itself (ATP drives the
// spliceosome's rearrangements).
(function () {
  var TEXT = [
    "An intron is marked by <b>GU</b> at its 5′ end, a <b>branch-point A</b>, a run of pyrimidines and <b>AG</b> at its 3′ end; everything between is cut out.",
    "<b>U1</b> base-pairs with the 5′ splice site, <b>U2AF</b> grips the pyrimidine tract and AG, and <b>U2</b> pairs around the branch site so the A bulges out.",
    "The U4/U6·U5 tri-snRNP joins, <b>U1 and U4 leave</b>, and U6 pairs with U2 to build the active site that brings the A to the 5′ splice site.",
    "First cut: the A's <b>2′-OH attacks</b> the 5′ splice site, freeing exon 1 with a 3′-OH and tying the intron's G to the A in a <b>lariat</b>.",
    "Second cut: exon 1's <b>3′-OH attacks</b> the 3′ splice site, the <b>exons are joined</b>, and the lariat intron is released and degraded."
  ];
  var FORM = [
    "\\text{exon 1}\\,|\\,\\text{GU}\\cdots\\text{A}\\cdots(\\text{Y})_n\\text{AG}\\,|\\,\\text{exon 2}",
    "\\text{U1}\\to\\text{GU},\\ \\ \\text{U2}\\to\\text{branch site},\\ \\ \\text{U2AF}\\to(\\text{Y})_n\\text{AG}",
    "\\text{U4/U6}\\cdot\\text{U5 joins};\\ \\text{U1, U4 leave}\\ \\Rightarrow\\ \\text{U2/U6 active site}",
    "\\text{A}\\!:\\!2'\\text{OH}+\\text{exon 1}{-}p{-}\\text{GU}\\to\\text{exon 1}{-}3'\\text{OH}+\\text{lariat}",
    "\\text{exon 1}{-}3'\\text{OH}+\\text{AG}{-}p{-}\\text{exon 2}\\to\\text{exon 1}{-}p{-}\\text{exon 2}+\\text{lariat}"
  ];
  function ellipse(cx, cy, rx, ry) { return "M " + (cx - rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx + rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx - rx) + " " + cy + " Z"; }
  Viz.register("pre-mrna-intron-splicing", {
    title: "Splicing an intron out of pre-mRNA",
    subject: "biology",
    shows: "Step through splicing: snRNPs find the GU, the branch-point A and the AG, the A attacks the 5′ splice site to make a lariat, then exon 1 attacks the 3′ splice site and the exons join",
    steps: ["the intron's signals", "U1, U2AF and U2 bind", "the spliceosome activates", "first cut: the lariat forms", "second cut: exons join"],
    stepMs: 2000,
    formula: function (v) { return "\\small " + FORM[(v.step || 1) - 1]; },
    status: function (v) { return TEXT[(v.step || 1) - 1]; },
    examples: [
      {name: "recognition", values: {step: 2}},
      {name: "lariat intermediate", values: {step: 4}},
      {name: "spliced", values: {step: 5}}
    ],
    size: [400, 270],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, y0 = 176;
      var L = function (at, t, o) { return api.label(at, t, Object.assign({size: 12, color: c.muted}, o || {})); };
      var halo = function (t) { t.setAttribute("stroke", c.card); t.setAttribute("stroke-width", 4); t.setAttribute("paint-order", "stroke"); return t; };
      var exon = function (x, w, name) { api.rect(x, y0 - 10, w, 20, {fill: c.c1, rx: 4}); L([x + w / 2, y0], name, {color: c.card, anchor: "middle", weight: 700}); };
      var blob = function (x, y, rx, ry, col, name, op) {
        api.path(ellipse(x, y, rx, ry), {fill: col, fillOpacity: 0.85, opacity: op == null ? 1 : op});
        L([x, y], name, {color: c.card, anchor: "middle", weight: 700, opacity: op == null ? 1 : op});
      };
      var aDot = function (at) { api.circle(at, 6.5, {fill: c.c5}); L([at[0], at[1]], "A", {color: c.card, anchor: "middle", weight: 800, size: 12}); };
      L([12, 14], s < 5 ? "pre-mRNA in the nucleus" : "spliced mRNA and the released intron");
      if (s <= 2) {
        exon(24, 80, "exon 1"); exon(296, 80, "exon 2");
        api.line([104, y0], [296, y0], {color: c.faint, width: 2.5});
        L([200, y0 - 44], "intron", {color: c.ink, anchor: "middle"});
        halo(L([118, y0], "GU", {color: c.c3, anchor: "middle", weight: 800, size: 13}));
        halo(L([252, y0], "(Y)_n", {color: c.c2, anchor: "middle", weight: 700, size: 13}));
        halo(L([283, y0], "AG", {color: c.c3, anchor: "middle", weight: 800, size: 13}));
        var A = s === 1 ? [214, y0] : [214, y0 + 12];
        if (s === 2) api.path("M 204 " + y0 + " Q 214 " + (y0 + 20) + " 224 " + y0, {stroke: c.faint, width: 2});
        aDot(A);
        L([118, y0 + 30], "5′ splice site", {color: c.c3, anchor: "middle"});
        L([290, y0 + 30], "3′ splice site", {color: c.c3, anchor: "middle"});
        L([214, y0 + 48], s === 1 ? "branch point" : "A bulges out", {color: c.c5, anchor: "middle"});
        if (s === 2) {
          blob(116, y0 - 24, 20, 13, c.c6, "U1");
          blob(214, y0 - 24, 20, 13, c.c4, "U2");
          blob(266, y0 - 24, 26, 13, c.c2, "U2AF");
          L([116, y0 - 50], "pairs with GU", {color: c.c6, anchor: "middle"});
          L([214, y0 - 66], "pairs around the A", {color: c.c4, anchor: "middle"});
        }
      } else if (s <= 4) {
        exon(24, 80, "exon 1"); exon(296, 80, "exon 2");
        var A2 = [190, 140];
        if (s === 3) {   // the intron folds: U2/U6 pairing brings the branch A next to the 5' splice site
          api.path("M 104 " + y0 + " C 96 60, 250 40, " + (A2[0] + 6) + " " + (A2[1] - 6), {stroke: c.faint, width: 2.5});
          blob(110, y0 - 22, 18, 12, c.muted, "U6");
          blob(66, y0 + 28, 20, 12, c.muted, "U5");
          blob(A2[0] + 22, A2[1] - 12, 18, 12, c.c4, "U2");
          api.line([128, y0 - 22], [A2[0] + 4, A2[1] - 12], {color: c.ink, width: 1.5, dash: "2 3"});
          L([150, y0 - 60], "U2/U6 active site", {color: c.ink, anchor: "middle"});
          api.path("M " + (A2[0] - 8) + " " + (A2[1] + 4) + " Q 150 " + (y0 + 6) + " 112 " + (y0 - 4), {stroke: c.c5, width: 1.8, dash: "4 3", arrow: true});
          L([156, y0 + 22], "2′-OH attacks", {color: c.c5, anchor: "middle"});
          blob(326, 52, 16, 11, c.c6, "U1", 0.45); blob(366, 52, 16, 11, c.muted, "U4", 0.45);
          api.line([346, 74], [346, 40], {color: c.muted, width: 1.5, arrow: true, opacity: 0.8});
          L([346, 82], "leave", {color: c.muted, anchor: "middle"});
        } else {   // the lariat: the intron's 5' G now joined 2'-5' to the A
          api.circle([A2[0], A2[1] - 38], 36, {stroke: c.faint, width: 2.5});
          halo(L([A2[0] - 26, A2[1] - 20], "G", {color: c.c3, anchor: "middle", weight: 800, size: 13}));
          L([A2[0] - 40, A2[1] + 6], "2′–5′ bond", {color: c.c5, anchor: "end"});
          L([A2[0], A2[1] - 86], "lariat intermediate", {color: c.ink, anchor: "middle"});
          blob(66, y0 + 30, 20, 12, c.muted, "U5");
          L([104, y0 - 22], "3′-OH", {color: c.c3, anchor: "middle", weight: 650});
          api.path("M 110 " + (y0 + 14) + " Q 200 " + (y0 + 60) + " 292 " + (y0 + 14), {stroke: c.c3, width: 1.8, dash: "4 3", arrow: true});
          L([200, y0 + 50], "attacks the 3′ splice site next", {color: c.c3, anchor: "middle"});
        }
        // the tail from the A: pyrimidine tract and AG, still joined to exon 2
        api.path("M " + A2[0] + " " + A2[1] + " Q 214 " + y0 + " 240 " + y0 + " L 296 " + y0, {stroke: c.faint, width: 2.5});
        halo(L([258, y0], "(Y)_n", {color: c.c2, anchor: "middle", weight: 700, size: 13}));
        halo(L([284, y0], "AG", {color: c.c3, anchor: "middle", weight: 800, size: 13}));
        aDot(A2);
      } else {
        exon(60, 90, "exon 1"); exon(150, 90, "exon 2");
        api.line([150, y0 - 14], [150, y0 + 14], {color: c.card, width: 2});
        api.circle([132, y0 - 22], 7, {fill: c.muted, fillOpacity: 0.85});
        L([122, y0 - 22], "EJC", {color: c.muted, anchor: "end"});
        L([150, y0 + 30], "exon–exon junction", {color: c.c1, anchor: "middle"});
        L([30, y0], "5′", {color: c.ink}); L([256, y0], "3′", {color: c.ink});
        // the released lariat with its 3' tail
        var C = [318, 92];
        api.circle(C, 30, {stroke: c.faint, width: 2.5});
        api.path("M " + C[0] + " " + (C[1] + 30) + " Q " + (C[0] + 8) + " " + (C[1] + 52) + " " + (C[0] + 40) + " " + (C[1] + 56), {stroke: c.faint, width: 2.5});
        aDot([C[0], C[1] + 30]);
        L([C[0], C[1] - 44], "lariat intron", {color: c.ink, anchor: "middle"});
        L([C[0] + 2, C[1] + 78], "debranched, degraded", {color: c.muted, anchor: "middle"});
        api.arrow([258, 140], [290, 118], {color: c.muted, width: 1.6, halo: false, head: 8});
      }
      // viz.css paints svg text ink; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
