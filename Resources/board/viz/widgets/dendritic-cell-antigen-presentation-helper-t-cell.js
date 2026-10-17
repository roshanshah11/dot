// A dendritic cell starts an adaptive response. In a tissue an immature dendritic cell engulfs antigen; when it also
// senses a microbe (Toll-like receptors), it matures: it cuts the protein into peptides in endosomes, loads them on
// MHC II, raises B7 (CD80/CD86) on its surface and follows CCR7 signals through the lymph to a lymph node's T cell zone.
// There a naive CD4+ T cell whose receptor fits the peptide needs three signals: 1, TCR (with CD4) binding peptide on
// MHC II; 2, CD28 binding B7 (costimulation); 3, cytokines around them that set its fate (IL-12 -> Th1, which activates
// macrophages with IFN-gamma; IL-4 -> Th2, which helps B cells and fights worms; TGF-beta + IL-6 -> Th17, which calls in
// neutrophils with IL-17). With all three it makes IL-2, divides and differentiates. Signal 1 without signal 2 (antigen
// picked up with no danger signal, so B7 stays low) leaves the T cell anergic: one way self-reactive T cells are kept quiet.
(function () {
  var SUB = {IL12: {cyt: "IL-12", th: "Th1", job: "activate macrophages (IFN-γ)"},
             IL4: {cyt: "IL-4", th: "Th2", job: "help B cells, fight worms"},
             TGF: {cyt: "TGF-β + IL-6", short: "TGF-β+IL-6", th: "Th17", job: "call in neutrophils (IL-17)"}};

  Viz.register("dendritic-cell-antigen-presentation-helper-t-cell", {
    title: "Dendritic cell activates a helper T cell",
    subject: "biology",
    shows: "Step through it: a dendritic cell picks up antigen in a tissue, carries peptides on MHC II to a lymph node and gives a naive CD4 T cell three signals; without costimulation (B7) the T cell turns anergic, and the cytokines decide Th1, Th2 or Th17",
    params: {
      b7: {kind: "boolean", default: true, label: "\\text{signal 2}", on: "B7 on the DC", off: "no B7"},
      cyto: {kind: "enum", values: ["IL12", "IL4", "TGF"], names: {IL12: "IL-12", IL4: "IL-4", TGF: "TGF-β + IL-6"}, default: "IL12", label: "\\text{signal 3}"}
    },
    steps: ["capture antigen in a tissue", "carry it to a lymph node", "three signals", "the T cell's fate"],
    stepMs: 1800,
    formula: function (v) {
      var s = v.step || 1, q = SUB[v.cyto];
      if (s === 1) return "\\text{antigen}\\xrightarrow{\\text{phagocytosis}}\\text{endosome}\\to\\text{peptides}";
      if (s === 2) return "\\text{peptide}+\\text{MHC II}\\to\\text{surface},\\ \\text{DC}\\xrightarrow{\\text{lymph}}\\text{node}";
      if (s === 3) return "\\underbrace{\\text{pMHC II:TCR}}_{1}+\\underbrace{" + (v.b7 ? "\\text{B7:CD28}" : "\\text{(none)}") + "}_{2}+\\underbrace{\\text{" + q.cyt + "}}_{3}";
      return v.b7 ? "1+2+3\\Rightarrow\\text{IL-2, divides}\\to\\text{" + q.th + "}" : "1\\ \\text{without}\\ 2\\Rightarrow\\text{anergy}";
    },
    status: function (v) {
      var s = v.step || 1, q = SUB[v.cyto];
      if (s === 1) return v.b7 ? "In a tissue an immature dendritic cell engulfs a bacterium, and its <b>Toll-like receptors</b> sense the microbe, which tells it to mature."
                               : "In a tissue an immature dendritic cell picks up a harmless protein but senses <b>no microbe</b>, so nothing tells it to mature.";
      if (s === 2) return v.b7 ? "It cuts the protein into peptides, loads them on <b>MHC II</b>, raises <b>B7</b> on its surface and travels through the lymph to a lymph node."
                               : "It still loads peptides on <b>MHC II</b> and drifts to a lymph node, but without a danger signal it keeps <b>B7</b> low.";
      if (s === 3) return "A naive CD4⁺ T cell whose receptor fits binds the peptide on MHC II (signal 1), " + (v.b7 ? "CD28 binds <b>B7</b> (signal 2)" : "but CD28 finds <b>no B7</b> (no signal 2)") + ", and " + q.cyt + " around them is signal 3.";
      return v.b7 ? "With all three signals the T cell makes IL-2, divides into a clone and becomes <b>" + q.th + "</b> cells that " + q.job.replace(/ \(.*\)/, "") + "."
                  : "Signal 1 without signal 2 leaves the T cell <b>anergic</b>, switched off instead of activated, one way T cells that see self are kept quiet.";
    },
    examples: [
      {name: "capturing a bacterium", values: {b7: true, cyto: "IL12", step: 1}},
      {name: "carried to a lymph node", values: {b7: true, cyto: "IL12", step: 2}},
      {name: "three signals", values: {b7: true, cyto: "IL12", step: 3}},
      {name: "no B7 at the synapse", values: {b7: false, cyto: "IL12", step: 3}},
      {name: "Th2 fate", values: {b7: true, cyto: "IL4", step: 4}},
      {name: "Th17 fate", values: {b7: true, cyto: "TGF", step: 4}},
      {name: "no costimulation: anergy", values: {b7: false, step: 4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, q = SUB[v.cyto], DC = c.c3, TC = c.c1, M2 = c.c6, AG = c.c5, B7 = c.c4, CY = c.c2;
      var dend = function (C, r0, r1, o) {   // a dendritic cell: six lobes, valleys at 0, 60, ... degrees
        var d = "", pt = function (r, deg) { var a = deg * Math.PI / 180; return (C[0] + r * Math.cos(a)).toFixed(1) + " " + (C[1] + r * Math.sin(a)).toFixed(1); };
        for (var i = 0; i < 6; i++) d += (i ? " " : "M " + pt(r0, 0) + " ") + "Q " + pt(r1, 60 * i + 30) + " " + pt(r0, 60 * i + 60);
        api.path(d + " Z", Object.assign({fill: DC, fillOpacity: 0.12, stroke: DC, width: 2}, o || {}));
      };
      var mhc = function (p, n, len) {   // an MHC II cup at p facing direction n, holding a red peptide
        var tg = [-n[1], n[0]], o = [p[0] + n[0] * len, p[1] + n[1] * len];
        api.path("M " + (o[0] + tg[0] * 4) + " " + (o[1] + tg[1] * 4) + " L " + (p[0] + tg[0] * 4) + " " + (p[1] + tg[1] * 4) + " L " + (p[0] - tg[0] * 4) + " " + (p[1] - tg[1] * 4) + " L " + (o[0] - tg[0] * 4) + " " + (o[1] - tg[1] * 4), {stroke: M2, width: 2.4});
        api.circle([p[0] + n[0] * len * 0.55, p[1] + n[1] * len * 0.55], 2.4, {fill: AG});
      };
      var stick = function (p, n, len, col) { api.line(p, [p[0] + n[0] * len, p[1] + n[1] * len], {color: col, width: 2.4}); api.circle([p[0] + n[0] * len, p[1] + n[1] * len], 2.8, {fill: col}); };
      var dir = function (deg) { var a = deg * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; };
      var at = function (C, r, deg) { var n = dir(deg); return [C[0] + r * n[0], C[1] + r * n[1]]; };
      if (s === 1) {
        api.label([16, 24], "tissue", {color: c.muted, size: 12, weight: 650});
        var D = [140, 108];
        dend(D, 30, 60);
        api.circle([D[0] + 6, D[1] + 4], 12, {stroke: DC, width: 1.2, dash: "3 2"});
        if (v.b7) {
          api.rect(D[0] - 2, D[1], 16, 8, {fill: AG, fillOpacity: 0.8, rx: 4});
          [[232, 92], [262, 128], [228, 150]].forEach(function (p) { api.rect(p[0], p[1], 24, 11, {fill: AG, fillOpacity: 0.8, rx: 5.5}); });
          api.label([300, 70], "bacteria", {color: AG, size: 12, weight: 650, anchor: "middle"});
          api.label([300, 178], "TLRs sense a microbe", {color: DC, size: 12, anchor: "middle"});
        } else {
          api.circle([D[0] + 6, D[1] + 4], 4, {fill: AG, fillOpacity: 0.8});
          [[236, 96], [258, 124], [234, 146], [270, 100]].forEach(function (p) { api.circle(p, 4, {fill: AG, fillOpacity: 0.8}); });
          api.label([300, 70], "harmless protein", {color: AG, size: 12, weight: 650, anchor: "middle"});
          api.label([300, 178], "no danger signal", {color: DC, size: 12, anchor: "middle"});
        }
        api.label([D[0], D[1] + 76], "immature dendritic cell", {color: DC, size: 12.5, weight: 650, anchor: "middle"});
      } else if (s === 2) {
        api.path("M 14 150 C 90 150 150 92 236 98", {stroke: c.muted, width: 1.6});
        api.path("M 14 186 C 100 186 160 128 240 132", {stroke: c.muted, width: 1.6});
        api.label([24, 206], "lymph vessel", {color: c.muted, size: 12});
        api.path("M 236 112 C 230 40 360 30 382 90 C 396 140 360 196 300 186 C 270 182 286 150 262 140 C 240 132 238 124 236 112 Z", {fill: TC, fillOpacity: 0.05, stroke: c.muted, width: 1.6});
        api.label([318, 30], "lymph node", {color: c.muted, size: 12, weight: 650, anchor: "middle"});
        [[300, 96], [330, 112], [312, 140], [348, 84], [350, 140]].forEach(function (p) { api.circle(p, 9, {fill: TC, fillOpacity: 0.15, stroke: TC, width: 1.4}); });
        api.label([316, 66], "naive T cells", {color: TC, size: 12, anchor: "middle"});
        var E = [125, 140];
        dend(E, 16, 27);
        [0, 120, 240].forEach(function (d) { mhc(at(E, 16, d), dir(d), 8); });
        if (v.b7) [60, 180, 300].forEach(function (d) { stick(at(E, 16, d), dir(d), 7, B7); });
        api.arrow([170, 152], [214, 140], {color: DC, width: 2, halo: false, head: 8});
        api.label([126, 88], "mature DC", {color: DC, size: 12.5, weight: 650, anchor: "middle"});
        api.label([126, 70], v.b7 ? "peptide on MHC II, B7 up" : "peptide on MHC II, B7 low", {color: M2, size: 12, anchor: "middle"});
      } else {
        var F = [118, 112], T = [264, 112];
        api.label([16, 24], "lymph node T cell zone", {color: c.muted, size: 12, weight: 650});
        dend(F, 34, 64, s === 4 ? {opacity: 0.4} : {});
        if (s === 3) {
          // the synapse, drawn large: the DC's surface (x ~ 156) faces the T cell's (x ~ 220) across a 64 px gap, with
          // signal 1 (MHC II, TCR, CD4) above and signal 2 (B7, CD28) below
          api.circle(T, 46, {fill: TC, fillOpacity: 0.1, stroke: TC, width: 2});
          api.label([T[0], T[1] - 60], "naive CD4⁺ T cell", {color: TC, size: 12.5, weight: 650, anchor: "middle", raw: true});
          var y1 = 98, y4 = 114, y2 = 132, edge = function (y) { return T[0] - Math.sqrt(46 * 46 - (y - T[1]) * (y - T[1])); };
          mhc([155, y1], [1, 0], 29);                                   // peptide on MHC II ...
          [-2.6, 2.6].forEach(function (k) { api.line([edge(y1 + k), y1 + k], [185, y1 + k], {color: TC, width: 2.4}); });   // ... held by the TCR
          api.path("M " + edge(y4) + " " + y4 + " L 176 " + y4 + " L 166 " + (y1 + 5), {stroke: TC, width: 2.4});   // CD4 grips the MHC II's side
          api.label([148, y1], "MHC II", {color: M2, size: 12, weight: 650, anchor: "end"});
          api.label([edge(y1) + 6, y1], "TCR", {color: TC, size: 12, weight: 650});
          api.label([edge(y4) + 6, y4], "CD4", {color: TC, size: 12, weight: 650});
          stick([edge(y2), y2], [-1, 0], edge(y2) - 180, TC);             // CD28 reaching for B7
          api.label([edge(y2) + 6, y2], "CD28", {color: TC, size: 12, weight: 650});
          if (v.b7) { stick([155, y2], [1, 0], 23, B7); api.label([148, y2], "B7", {color: B7, size: 12, weight: 650, anchor: "end"}); }
          else {
            api.line([164, y2 - 5], [174, y2 + 5], {color: c.c5, width: 2.2}); api.line([164, y2 + 5], [174, y2 - 5], {color: c.c5, width: 2.2});
            api.label([148, y2], "no B7", {color: c.c5, size: 12, weight: 650, anchor: "end"});
          }
          [[178, 164], [196, 174], [168, 182], [214, 168]].forEach(function (p) { api.circle(p, 3.6, {fill: CY}); });
          api.label([192, 198], "3: " + q.cyt, {color: CY, size: 12, weight: 650, anchor: "middle"});
        } else if (v.b7) {
          // the clone: seven cells, r 19 and 40 apart so each label sits inside its own cell
          [[266, 70], [306, 70], [246, 104], [286, 104], [326, 104], [266, 138], [306, 138]].forEach(function (p) {
            api.circle(p, 19, {fill: TC, fillOpacity: 0.16, stroke: TC, width: 2});
            api.label(p, q.th, {color: TC, size: 12, weight: 700, anchor: "middle"});
          });
          api.label([286, 178], q.th + " cells: " + q.job, {color: TC, size: 12, weight: 650, anchor: "middle"});
          api.label([196, 40], "IL-2 → divides", {color: CY, size: 12, anchor: "middle"});
          api.arrow([180, 108], [224, 104], {color: TC, width: 2, halo: false, head: 8});
        } else {
          api.circle([240, 112], 30, {fill: c.muted, fillOpacity: 0.1, stroke: c.muted, width: 2, dash: "4 3"});
          api.label([240, 112], "T", {color: c.muted, size: 13, weight: 700, anchor: "middle"});
          api.label([240, 160], "anergic: switched off", {color: c.muted, size: 12.5, weight: 650, anchor: "middle"});
        }
      }
      // the three signals, kept on screen at every step; without B7 the cytokines set no fate
      var dead3 = !v.b7 && s === 4;
      var boxes = [["signal 1", "MHC II : TCR", "with CD4", M2, true],
                   ["signal 2", v.b7 ? "B7 : CD28" : "no B7", v.b7 ? "costimulation" : "CD28 unbound", v.b7 ? B7 : c.c5, v.b7],
                   ["signal 3", q.short || q.cyt, v.b7 ? "→ " + q.th : dead3 ? "no effect" : "needs signal 2", dead3 ? c.muted : CY, true]];
      boxes.forEach(function (b, i) {
        var x = 14 + i * 126, live = s >= 3, mark = !live || dead3 && i === 2 ? "" : b[4] ? "  ✓" : "  ✗";
        api.rect(x, 220, 120, 70, {fill: b[3], fillOpacity: live && !(dead3 && i === 2) ? 0.12 : 0.04, stroke: b[3], width: live ? 1.6 : 1, dash: live && !(dead3 && i === 2) ? null : "4 3", rx: 8});
        api.label([x + 10, 237], b[0] + mark, {color: live ? b[3] : c.muted, size: 12, weight: 700});
        api.label([x + 10, 257], b[1], {color: live && !(dead3 && i === 2) ? c.ink : c.muted, size: 12});
        api.label([x + 10, 275], b[2], {color: c.muted, size: 12});
      });
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
