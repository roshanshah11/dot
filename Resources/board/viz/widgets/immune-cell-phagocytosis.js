// Phagocytosis in five steps. 1) Receptors on a macrophage or neutrophil bind the microbe: Fc-gamma receptors grip IgG,
// complement receptors grip C3b/iC3b, pattern-recognition receptors (mannose receptor, dectin-1) bind microbial
// surfaces. 2) Actin-driven pseudopods wrap it. 3) They fuse: the microbe sits in a phagosome, where NADPH oxidase
// assembles. 4) Lysosomes fuse (phagolysosome, pH about 4.5-5, hydrolases) and the respiratory burst makes superoxide:
// 2 O2 + NADPH -> 2 O2.- + NADP+ + H+; dismutation gives H2O2; in neutrophils myeloperoxidase makes HOCl
// (H2O2 + Cl- -> HOCl + OH-). 5) A macrophage loads microbial peptides onto MHC II for helper T cells and expels debris;
// a neutrophil dies within a day or two and is cleared by macrophages (pus). Without NADPH oxidase (chronic granulomatous
// disease) there is no burst, and catalase-positive microbes such as Staphylococcus aureus survive and form granulomas.
(function () {
  var TEX = {
    1: "\\text{IgG}+\\text{Fc}\\gamma\\text{R},\\ \\text{C3b}+\\text{CR}\\Rightarrow\\text{engulf}",
    2: "\\text{receptor signal}\\to\\text{actin}\\to\\text{pseudopods}",
    3: "\\text{pseudopods fuse}\\Rightarrow\\text{phagosome}"
  };
  Viz.register("immune-cell-phagocytosis", {
    title: "Phagocytosis: engulf, fuse, kill",
    subject: "biology",
    shows: "Step a phagocyte through eating a bacterium: receptors grip it, pseudopods wrap it into a phagosome, lysosomes and the oxidative burst kill it, and a macrophage shows its pieces to T cells; switch off NADPH oxidase to see chronic granulomatous disease",
    params: {
      cell: {kind: "enum", values: ["macrophage", "neutrophil"], default: "macrophage", label: "\\text{cell}"},
      oxidase: {kind: "boolean", default: true, label: "\\text{NOX2}", on: "working", off: "absent (CGD)"}
    },
    steps: ["recognize", "engulf", "phagosome", "phagolysosome: kill", "digest and present"],
    stepMs: 1900,
    formula: function (v) {
      var s = v.step || 1;
      if (s <= 3) return TEX[s];
      if (s === 4) {
        if (!v.oxidase) return "\\text{no NADPH oxidase: no O}_2^{\\bullet-},\\ \\text{no H}_2\\text{O}_2\\newline\\text{only acid (pH}\\approx 5\\text{) and hydrolases}";
        return "2\\text{O}_2+\\text{NADPH}\\newline\\to 2\\text{O}_2^{\\bullet-}+\\text{NADP}^{+}+\\text{H}^{+}\\newline" +
          (v.cell === "neutrophil" ? "\\text{H}_2\\text{O}_2+\\text{Cl}^{-}\\xrightarrow{\\text{MPO}}\\text{HOCl}+\\text{OH}^{-}" : "2\\text{O}_2^{\\bullet-}+2\\text{H}^{+}\\xrightarrow{\\text{SOD}}\\text{H}_2\\text{O}_2+\\text{O}_2");
      }
      if (!v.oxidase) return "\\text{catalase}^{+}\\ \\text{microbe survives}\\Rightarrow\\text{granuloma}";
      return v.cell === "macrophage" ? "\\text{peptide}+\\text{MHC II}\\to\\text{shown to CD4 T cells}" : "\\text{neutrophil dies}\\to\\text{pus; macrophages clear it}";
    },
    status: function (v) {
      var s = v.step || 1, m = v.cell === "macrophage";
      if (s === 1) return "A " + v.cell + "'s <b>Fc receptors</b> grip IgG and its complement receptors grip C3b on a bacterium" + (v.oxidase ? "." : ", but this cell has <b>no NADPH oxidase</b> (chronic granulomatous disease).");
      if (s === 2) return "Receptor signals polymerize <b>actin</b>, pushing pseudopods out around the bacterium.";
      if (s === 3) return "The pseudopods fuse, sealing the bacterium in a <b>phagosome</b>" + (v.oxidase ? " where NADPH oxidase assembles." : " with no oxidase to assemble.");
      if (s === 4) return v.oxidase ? "Lysosomes fuse, the pH falls to about <b>5</b>, and the oxidative burst makes superoxide and H₂O₂" + (m ? "" : ", which myeloperoxidase turns into <b>bleach (HOCl)</b>") + ": the bacterium dies." :
        "Lysosomes fuse and acidify, but with <b>no oxidative burst</b> a catalase-positive bacterium such as S. aureus survives.";
      if (!v.oxidase) return "The surviving bacteria multiply inside the phagocyte and the body walls them off in a <b>granuloma</b>, the hallmark of CGD.";
      return m ? "The macrophage digests the bacterium and shows its peptides on <b>MHC II</b> to helper T cells, linking innate and adaptive immunity." :
        "Its job done, the short-lived neutrophil <b>dies</b> within a day or two; dead neutrophils are pus, and macrophages clear them.";
    },
    examples: [
      {name: "engulfing", values: {step: 2}},
      {name: "killing in the phagolysosome", values: {step: 4}},
      {name: "neutrophil makes bleach", values: {cell: "neutrophil", step: 4}},
      {name: "macrophage presents on MHC II", values: {step: 5}},
      {name: "CGD: the microbe survives", values: {oxidase: false, step: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, mac = v.cell === "macrophage", ox = v.oxidase;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600, raw: true}, o || {})); };
      var dying = s === 5 && !mac && ox;
      // the phagocyte: body, nucleus, oxidase badge
      api.path("M 30 196 a 176 100 0 1 0 352 0 a 176 100 0 1 0 -352 0", {fill: c.c1, fillOpacity: dying ? 0.03 : 0.08, stroke: c.c1, width: 2, dash: dying ? "6 4" : null});
      L([60, 240], v.cell, c.c1, {size: 13, weight: 700});
      if (mac) api.path("M 282 222 q 0 -22 30 -22 q 30 0 30 22 q 0 18 -16 16 q -14 -8 -28 0 q -16 4 -16 -16 Z", {fill: c.muted, fillOpacity: 0.35, stroke: c.muted, width: 1.4});
      else { [[290, 226], [312, 212], [334, 228]].forEach(function (p) { api.circle(p, dying ? 8 : 11, {fill: c.muted, fillOpacity: 0.35, stroke: c.muted, width: 1.4}); }); api.line([298, 220], [304, 216], {color: c.muted, width: 2}); api.line([320, 216], [326, 222], {color: c.muted, width: 2}); }
      L([60, 258], ox ? "NADPH oxidase ✓" : "no NADPH oxidase (CGD)", ox ? c.c3 : c.c5, {weight: 600});
      var lyso = function (q) { api.circle(q, 11, {fill: c.c6, fillOpacity: 0.35, stroke: c.c6, width: 1.4}); [[-4, -3], [3, 2], [-1, 5]].forEach(function (o) { api.circle([q[0] + o[0], q[1] + o[1]], 1.8, {fill: c.c6}); }); };
      if (s <= 3) { [[96, 180], [140, 214], [240, 236]].forEach(lyso); L([114, 196], "lysosomes", c.c6, {weight: 500}); }
      else if (s === 4) lyso([250, 238]);
      // the bacterium (64 x 32)
      var bug = function (p, dead) {
        api.rect(p[0] - 32, p[1] - 16, 64, 32, {fill: c.c5, fillOpacity: dead ? 0.25 : 0.9, stroke: c.c5, width: 1.6, rx: 16, dash: dead ? "4 3" : null});
      };
      // opsonins and the receptors that grip them: IgG (blue) binds the microbe with its two Fab arms and points its Fc stem
      // down into an Fc-gamma receptor's cup; C3b (amber) on the surface sits in a complement receptor (CR)
      var grip = function (B, labels) {
        var low = B[1] + 16, mem = function (x) { return 196 - 100 * Math.sqrt(1 - Math.pow((x - 206) / 176, 2)); };
        [B[0] - 22, B[0] - 6].forEach(function (x) {
          api.line([x - 6, low], [x, low + 9], {color: c.c2, width: 2.2}); api.line([x + 6, low], [x, low + 9], {color: c.c2, width: 2.2});
          api.line([x, low + 9], [x, low + 20], {color: c.c2, width: 2.6});
          api.line([x, mem(x)], [x, low + 24], {color: c.c1, width: 2.4});
          api.path("M " + (x - 5) + " " + (low + 19) + " L " + (x - 5) + " " + (low + 24) + " L " + (x + 5) + " " + (low + 24) + " L " + (x + 5) + " " + (low + 19), {stroke: c.c1, width: 2});
        });
        [B[0] + 10, B[0] + 24].forEach(function (x) {
          api.circle([x, low + 5], 4.5, {fill: c.c3});
          api.line([x, mem(x)], [x, low + 13], {color: c.c1, width: 2.4});
          api.path("M " + (x - 6) + " " + (low + 6) + " Q " + x + " " + (low + 17) + " " + (x + 6) + " " + (low + 6), {stroke: c.c1, width: 2});
        });
        if (!labels) return;
        L([B[0] - 36, low + 6], "IgG", c.c2, {anchor: "end"});
        L([B[0] - 36, low + 24], "FcγR", c.c1, {anchor: "end"});
        L([B[0] + 38, low + 4], "C3b", c.c3);
        L([B[0] + 38, low + 22], "CR", c.c1);
      };
      if (s === 1) {
        bug([206, 46], false); grip([206, 46], true);
        L([246, 30], "opsonized bacterium", c.c5);
      } else if (s === 2) {
        api.path("M 132 106 q -10 -64 44 -88 q 11 -3 10 7 q -36 16 -30 79", {fill: c.c1, fillOpacity: 0.18, stroke: c.c1, width: 2});
        api.path("M 280 106 q 10 -64 -44 -88 q -11 -3 -10 7 q 36 16 30 79", {fill: c.c1, fillOpacity: 0.18, stroke: c.c1, width: 2});
        bug([206, 46], false); grip([206, 46], false);
        L([288, 38], "pseudopods (actin)", c.c1);
      } else {
        var P = s === 3 ? [204, 156] : [196, 164], R = 40;
        api.circle(P, R, {fill: s >= 4 ? c.c6 : c.c1, fillOpacity: s >= 4 ? 0.18 : 0.1, stroke: s >= 4 ? c.c6 : c.c1, width: 1.8});
        if (ox) [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (d) { api.rect(P[0] + d[0] * R * 0.7 - 3.5, P[1] + d[1] * R * 0.7 - 3.5, 7, 7, {fill: c.c3, rx: 1}); });
        var dead = s >= 4 && ox;
        if (s === 5 && !ox) [[-14, -14], [12, 0], [-8, 16]].forEach(function (o) { api.rect(P[0] + o[0] - 14, P[1] + o[1] - 7, 28, 14, {fill: c.c5, fillOpacity: 0.9, rx: 7}); });
        else if (s === 5 && mac) [[-10, -8], [8, 6], [-3, 16], [14, -14], [-16, 8]].forEach(function (o) { api.circle([P[0] + o[0], P[1] + o[1]], 3.5, {fill: c.c5, fillOpacity: 0.7}); });
        else bug(P, dead);
        L([P[0] + R + 8, P[1] - R + 10], s === 3 ? "phagosome" : "phagolysosome", s >= 4 ? c.c6 : c.c1);
        if (s >= 4) {
          L([P[0] + R + 8, P[1] - R + 26], "pH ≈ 5", c.c6, {weight: 500});
          if (s === 4) [[P[0] - R - 10, P[1] - 22], [P[0] - R - 8, P[1] + 24]].forEach(lyso);
          if (s === 4) L([P[0] - R - 24, P[1] + 1], "lysosomes fuse", c.c6, {weight: 500, anchor: "end"});   // beside the two fusing lysosomes
        }
        if (s === 4 && ox) {
          [[-14, -27], [0, -31], [14, -27], [-14, 27], [0, 31], [14, 27]].forEach(function (o) { L([P[0] + o[0], P[1] + o[1]], "✶", c.c3, {anchor: "middle", size: 12}); });
          L([P[0] + R + 8, P[1] + 4], mac ? "O₂•⁻ → H₂O₂" : "O₂•⁻ → H₂O₂ → HOCl", c.c3);
          L([P[0] + R + 8, P[1] + 20], "bacterium dies", c.c5, {weight: 500});
        }
        if (s >= 4 && !ox) { L([P[0] + R + 8, P[1] + 4], s === 4 ? "no burst: it survives" : "survives, multiplies", c.c5); if (s === 5) L([P[0] + R + 8, P[1] + 20], "→ granuloma", c.c5, {weight: 500}); }
        if (s === 5 && ox && mac) {
          api.arrow([P[0] - 16, P[1] - 32], [172, 104], {color: c.c4, width: 1.6, halo: false, head: 7, dash: "4 3"});
          api.line([166, 98], [166, 84], {color: c.c4, width: 3}); api.line([174, 98], [174, 84], {color: c.c4, width: 3});
          api.circle([170, 81], 3.5, {fill: c.c5});
          L([184, 60], "MHC II shows a peptide", c.c4); L([184, 76], "to helper T cells", c.c4, {weight: 500});
          api.arrow([P[0] + 30, P[1] + 34], [262, 300 - 14], {color: c.muted, width: 1.4, halo: false, head: 7, dash: "3 3"});
          L([262, 270], "debris out", c.muted, {weight: 500});
        }
        if (dying) L([P[0] + R + 8, P[1] + 4], "neutrophil dies (pus)", c.muted);
      }
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
