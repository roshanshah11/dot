// The leukocyte adhesion cascade that brings a neutrophil out of an inflamed venule. TNF and IL-1 make the endothelium
// show P- and E-selectin and ICAM-1. 1) Capture: selectins grab sialyl-Lewis X on PSGL-1. 2) Rolling: selectin bonds
// form and break, slowing the cell from blood speed (on the order of 1 mm/s) to tens of um/s. 3) Activation: CXCL8
// (IL-8) on the endothelial surface signals through CXCR1/2, a GPCR, and inside-out signalling flips LFA-1 to high
// affinity. 4) Arrest: LFA-1 (alpha-L beta-2, CD11a/CD18) binds ICAM-1 and the cell stops and spreads. 5) Crawling to a
// junction, transmigration (PECAM-1/CD31) and chemotaxis up CXCL8, C5a, fMLP and LTB4 gradients at ~10 um/min.
// Leukocyte adhesion deficiency: LAD I lacks CD18 (rolling works, arrest fails); LAD II lacks fucosylated sialyl-Lewis X
// (no capture at all). Both leave neutrophils stuck in the blood (neutrophilia) and infections without pus.
// Speeds are typical orders of magnitude, drawn on a log scale.
(function () {
  var SPEED = {normal: [1000, 30, 8, 0, 0.2], lad1: [1000, 30, 30, 30, 1000], lad2: [1000, 1000, 1000, 1000, 1000]};
  var TEX = [
    "\\text{P/E-selectin}\\leftrightarrow\\text{sialyl-Lewis}^{X}\\ (\\text{PSGL-1})",
    "\\text{selectin bonds form and break}:\\ v\\approx 30\\ \\mu\\text{m/s}",
    "\\text{CXCL8}\\to\\text{CXCR1/2 (GPCR)}\\newline\\to\\text{LFA-1: low}\\to\\text{high affinity}",
    "\\text{LFA-1}\\ (\\alpha_L\\beta_2,\\ \\text{CD11a/CD18})\\leftrightarrow\\text{ICAM-1}",
    "\\text{PECAM-1}\\leftrightarrow\\text{PECAM-1};\\ \\text{chemotaxis to}\\newline\\text{CXCL8, C5a, fMLP, LTB}_4"
  ];
  var SAY = {
    normal: ["Inflamed endothelium shows <b>P- and E-selectin</b>, which snag sialyl-Lewis X on a neutrophil racing past in the blood.",
      "Selectin bonds form at the front and break at the back, so the neutrophil <b>rolls</b> along the wall at tens of µm/s instead of about 1 mm/s.",
      "<b>CXCL8</b> on the endothelium binds its receptor and flips the neutrophil's LFA-1 integrins to <b>high affinity</b>.",
      "LFA-1 grips <b>ICAM-1</b>: the neutrophil stops dead and flattens against the wall.",
      "It squeezes <b>between endothelial cells</b> and crawls up the chemokine gradient to the bacteria, at roughly 10 µm per minute."],
    lad1: ["Capture works in LAD I: selectins still snag sialyl-Lewis X.", "Rolling works too, because selectins need no integrin.",
      "CXCL8 signals, but there is <b>no CD18</b>, so no LFA-1 can switch on.",
      "With no LFA-1 to grip ICAM-1 the neutrophil <b>cannot stop</b>: it rolls on.",
      "It is swept back into the blood: neutrophil counts run high while the bacteria grow unchecked and <b>no pus</b> forms."],
    lad2: ["In LAD II the neutrophil lacks fucosylated <b>sialyl-Lewis X</b>, so the selectins have nothing to grab.",
      "No tethers, so <b>no rolling</b>: it stays in the fast centre of the flow.",
      "It never touches the wall long enough to meet CXCL8.", "No arrest without the earlier steps.",
      "It never leaves the vessel: high blood neutrophil counts, bacteria unchecked, <b>no pus</b>."]
  };

  Viz.register("immune-acute-inflammation-neutrophil-recruitment", {
    title: "Neutrophil recruitment: the adhesion cascade",
    subject: "biology",
    shows: "Step a neutrophil out of an inflamed venule: selectins capture it, it rolls, a chemokine switches its integrins on, it stops on ICAM-1 and squeezes through to the bacteria; switch on LAD I or LAD II to see which step fails",
    params: {
      lad: {kind: "enum", values: ["normal", "lad1", "lad2"], names: {normal: "normal", lad1: "LAD I (no CD18)", lad2: "LAD II (no sLeˣ)"}, default: "normal", label: "\\text{cell}"}
    },
    steps: ["capture", "rolling", "integrin activation", "firm adhesion", "transmigration"],
    stepMs: 1900,
    formula: function (v) {
      var s = v.step || 1;
      if (v.lad === "lad2") return s === 1 ? "\\text{no fucosylation}\\Rightarrow\\text{no sialyl-Lewis}^{X}\\newline\\Rightarrow\\text{no capture}" : "\\text{no capture}\\Rightarrow\\text{no rolling, arrest or exit}";
      if (v.lad === "lad1" && s >= 3) return s === 3 ? "\\text{CXCL8}\\to\\text{CXCR1/2},\\ \\text{but no CD18}\\newline\\Rightarrow\\text{no LFA-1 to activate}" : "\\text{no LFA-1}\\not\\leftrightarrow\\text{ICAM-1}\\Rightarrow\\text{no arrest}";
      return TEX[s - 1];
    },
    status: function (v) { return SAY[v.lad][(v.step || 1) - 1]; },
    examples: [
      {name: "rolling on selectins", values: {step: 2}},
      {name: "firm adhesion", values: {step: 4}},
      {name: "out to the bacteria", values: {step: 5}},
      {name: "LAD I: cannot stop", values: {lad: "lad1", step: 4}},
      {name: "LAD II: never caught", values: {lad: "lad2", step: 2}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, lad = v.lad;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600, raw: true}, o || {})); };
      // speed on a log scale, 0.1 to 1000 um/s
      var sp = SPEED[lad][s - 1], X0 = 176, X1 = 384, sx = function (u) { return X0 + (Math.log10(u) + 1) / 4 * (X1 - X0); };
      api.line([X0, 16], [X1, 16], {color: c.faint, width: 1.5});
      [0.1, 1, 10, 100, 1000].forEach(function (u) { api.line([sx(u), 12], [sx(u), 20], {color: c.faint, width: 1.2}); L([sx(u), 30], String(u), c.muted, {anchor: "middle", weight: 500}); });
      var mx = sp > 0 ? sx(sp) : X0 - 12;
      api.circle([mx, 16], 5.5, {fill: c.c1});
      L([8, 16], "speed " + (sp === 0 ? "0" : sp >= 1000 ? "≈ 1 mm/s" : sp < 1 ? "≈ 10 µm/min" : "≈ " + sp + " µm/s"), c.c1);
      // lumen, endothelium, tissue
      api.rect(0, 40, 400, 112, {fill: c.c5, fillOpacity: 0.06, rx: 0});
      api.arrow([8, 52], [70, 52], {color: c.muted, width: 1.5, halo: false, head: 7});
      L([76, 52], "blood flow", c.muted, {weight: 500});
      for (var e = 0; e < 7; e++) { var ex = Math.max(0, e * 60 - 20) + 1.5; api.rect(ex, 152, Math.min(400, e * 60 + 40) - 1.5 - ex, 16, {fill: c.muted, fillOpacity: 0.3, stroke: c.muted, width: 1, rx: 5}); }
      api.line([0, 174], [400, 174], {color: c.faint, width: 1, dash: "3 3"});
      L([8, 186], "venule wall", c.muted, {weight: 500});
      for (var k = 0; k < 13; k++) {
        var xs = 14 + k * 30;
        api.line([xs, 152], [xs, 144], {color: c.c6, width: 1.6}); api.circle([xs, 142], 2.4, {fill: c.c6});
        api.line([xs + 14, 152], [xs + 14, 146], {color: c.c3, width: 1.6}); api.rect(xs + 11.5, 142, 5, 4, {fill: c.c3, rx: 1});
        if (k % 2) api.circle([xs + 7, 149], 2, {fill: c.c4});
      }
      L([8, 290], "selectin", c.c6, {weight: 500}); L([72, 290], "ICAM-1", c.c3, {weight: 500}); L([130, 290], "CXCL8", c.c4, {weight: 500});
      // tissue: bacteria and a chemokine gradient toward them
      var bugs = lad !== "normal" && s === 5 ? 9 : 5;
      for (var b = 0; b < bugs; b++) api.rect(326 + (b % 3) * 20, 226 + Math.floor(b / 3) * 16, 14, 7, {fill: c.c5, rx: 3.5});
      L([392, 286], "bacteria", c.c5, {anchor: "end"});
      var rnd = function (q) { var t = Math.sin(q * 12.9898) * 43758.5453; return t - Math.floor(t); };
      for (var g = 0; g < 90; g++) { var gx = 120 + rnd(g + 1) * 200, gy = 192 + rnd(g + 200) * 80; if (rnd(g + 400) < (gx - 120) / 220) api.circle([gx, gy], 1.8, {fill: c.c4, opacity: 0.8}); }
      L([8, 204], "tissue", c.muted, {weight: 500});
      // the neutrophil
      var neut = function (p, rx, ry) {
        api.path("M " + (p[0] - rx) + " " + p[1] + " a " + rx + " " + ry + " 0 1 0 " + 2 * rx + " 0 a " + rx + " " + ry + " 0 1 0 " + -2 * rx + " 0", {fill: c.c1, fillOpacity: 0.28, stroke: c.c1, width: 1.8});
        [[-5, -1], [0, 3], [5, -2]].forEach(function (o) { api.circle([p[0] + o[0], p[1] + o[1] * ry / 14], 3, {fill: c.c1}); });
      };
      var P;
      if (lad === "lad2") {
        P = [50 + (s - 1) * 78, 96];
        neut(P, 14, 14);
        api.arrow([P[0] + 18, P[1]], [P[0] + 46, P[1]], {color: c.c1, width: 2, halo: false, head: 8});
        L([P[0], P[1] - 24], "no sLeˣ: nothing to grab", c.c1, {anchor: s > 3 ? "end" : "start"});
      } else if (s === 1) {
        P = [70, 112]; neut(P, 14, 14);
        api.line([P[0] + 4, P[1] + 14], [74, 142], {color: c.c6, width: 1.6});
        api.arrow([P[0] + 18, P[1] - 6], [P[0] + 50, P[1] - 6], {color: c.c1, width: 2, halo: false, head: 8});
        L([P[0] + 22, P[1] + 20], "tethered by a selectin", c.c6);
      } else if (s <= 3 || (lad === "lad1" && s === 4)) {
        P = [s === 2 ? 132 : s === 3 ? 196 : 262, 126]; neut(P, 14, 14);
        [-8, 0, 8].forEach(function (d) { api.line([P[0] + d, P[1] + 13], [Math.round((P[0] + d - 14) / 30) * 30 + 14, 142], {color: c.c6, width: 1.4}); });
        api.path("M " + (P[0] - 10) + " " + (P[1] - 22) + " a 14 14 0 0 1 20 0", {stroke: c.c1, width: 1.6, arrow: true});
        L([P[0], P[1] - 36], s === 2 || lad === "lad1" && s === 4 ? "rolling" : "slow rolling", c.c1, {anchor: "middle"});
        if (s === 3) {
          api.circle([P[0] + 9, P[1] + 14], 3, {fill: c.c4});
          L([P[0] + 22, P[1] - 4], lad === "lad1" ? "CXCL8 signals, but no LFA-1" : "CXCL8 → LFA-1 high affinity", c.c4);
        }
        if (lad === "lad1" && s === 4) L([P[0] - 20, P[1] - 4], "no CD18: can't grip ICAM-1", c.c3, {anchor: "end"});
      } else if (lad === "lad1") {
        P = [350, 84]; neut(P, 14, 14);
        api.arrow([P[0] - 70, P[1] + 30], [P[0] - 18, P[1] + 6], {color: c.c1, width: 1.6, halo: false, head: 7, dash: "4 3"});
        L([P[0] - 22, P[1] - 22], "swept away", c.c1, {anchor: "end"});
        L([392, 206], "unchecked, no pus", c.c5, {anchor: "end"});
      } else if (s === 4) {
        P = [262, 136]; neut(P, 22, 9);
        [-14, -4, 6, 16].forEach(function (d) { api.line([P[0] + d, P[1] + 8], [P[0] + d, 145], {color: c.c3, width: 2}); });
        L([P[0], P[1] - 22], "arrested: LFA-1 grips ICAM-1", c.c3, {anchor: "middle"});
      } else {
        api.path("M 270 140 q 10 -6 20 0 l -4 32 q 6 4 -2 10 l -8 0 q -8 -6 -2 -10 Z", {stroke: c.c1, width: 1.4, dash: "3 3"});
        P = [304, 226]; neut(P, 14, 12);
        api.path("M 280 182 Q 282 208 " + (P[0] - 6) + " " + (P[1] - 10), {stroke: c.c1, width: 1.4, dash: "3 3"});
        api.arrow([P[0] + 14, P[1]], [P[0] + 26, P[1] + 2], {color: c.c1, width: 2, halo: false, head: 7});
        L([270, 196], "between two cells", c.c1, {anchor: "end"});
      }
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
