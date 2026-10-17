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
        return "2\\text{O}_2+\\text{NADPH}\\to 2\\text{O}_2^{\\bullet-}+\\text{NADP}^{+}+\\text{H}^{+}\\newline" +
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
      // the bacterium with its opsonins (IgG blue, C3b amber dots)
      var bug = function (p, dead, opso) {
        api.rect(p[0] - 16, p[1] - 8, 32, 16, {fill: c.c5, fillOpacity: dead ? 0.25 : 0.9, stroke: c.c5, width: 1.4, rx: 8, dash: dead ? "3 3" : null});
        if (opso) {
          [[-10, 8], [8, 8]].forEach(function (o) { var x = p[0] + o[0], y = p[1] + o[1]; api.line([x, y], [x, y + 8], {color: c.c2, width: 1.6}); api.line([x, y + 8], [x - 4, y + 13], {color: c.c2, width: 1.6}); api.line([x, y + 8], [x + 4, y + 13], {color: c.c2, width: 1.6}); });
          api.circle([p[0] - 1, p[1] + 11], 2.6, {fill: c.c3});
        }
      };
      var top = 96;
      if (s === 1) {
        bug([206, 52], false, true);
        [192, 210, 222].forEach(function (x) { api.line([x, top], [x, top - 8], {color: c.c1, width: 2}); });
        L([234, 46], "IgG + C3b on a bacterium", c.c5);
        L([234, 76], "receptors grip", c.c1, {weight: 500});
      } else if (s === 2) {
        api.path("M 150 " + top + " q -6 -50 30 -66 q 10 -4 12 4 q -16 16 -12 58", {fill: c.c1, fillOpacity: 0.18, stroke: c.c1, width: 2});
        api.path("M 262 " + top + " q 6 -50 -30 -66 q -10 -4 -12 4 q 16 16 12 58", {fill: c.c1, fillOpacity: 0.18, stroke: c.c1, width: 2});
        bug([206, 58], false, true);
        L([272, 44], "pseudopods (actin)", c.c1);
      } else {
        var P = s === 3 ? [206, 136] : [196, 160], R = s === 3 ? 26 : 34;
        api.circle(P, R, {fill: s >= 4 ? c.c6 : c.c1, fillOpacity: s >= 4 ? 0.18 : 0.1, stroke: s >= 4 ? c.c6 : c.c1, width: 1.8});
        if (ox) [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (d) { api.rect(P[0] + d[0] * R * 0.7 - 3, P[1] + d[1] * R * 0.7 - 3, 6, 6, {fill: c.c3, rx: 1}); });
        var dead = s >= 4 && ox;
        if (s === 5 && !ox) [[-12, -10], [10, 2], [-6, 14]].forEach(function (o) { api.rect(P[0] + o[0] - 10, P[1] + o[1] - 5, 20, 10, {fill: c.c5, fillOpacity: 0.9, rx: 5}); });
        else if (s === 5 && mac) [[-8, -6], [6, 4], [-2, 12], [10, -10]].forEach(function (o) { api.circle([P[0] + o[0], P[1] + o[1]], 3, {fill: c.c5, fillOpacity: 0.7}); });
        else bug(P, dead, false);
        L([P[0] + R + 8, P[1] - R + 4], s === 3 ? "phagosome" : "phagolysosome", s >= 4 ? c.c6 : c.c1);
        if (s >= 4) {
          L([P[0] + R + 8, P[1] - R + 20], "pH ≈ 5", c.c6, {weight: 500});
          if (s === 4) [[P[0] - 44, P[1] - 22], [P[0] - 40, P[1] + 26]].forEach(lyso);
          if (s === 4) L([108, 214], "lysosomes fuse", c.c6, {weight: 500, anchor: "middle"});
        }
        if (s === 4 && ox) {
          [[-18, -14], [16, -16], [20, 12], [-20, 14], [0, -24], [4, 22]].forEach(function (o) { L([P[0] + o[0], P[1] + o[1]], "✶", c.c3, {anchor: "middle", size: 12}); });
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
