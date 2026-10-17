// A CD4 helper T cell as the hub of adaptive immunity. A dendritic cell gives it signal 1 (peptide on MHC II to the TCR
// and CD4), signal 2 (B7 to CD28) and signal 3, the polarizing cytokine that picks the subset: IL-12 -> Th1, IL-4 ->
// Th2, TGF-beta + IL-6 -> Th17, IL-6 + IL-21 -> Tfh. Each subset then helps different cells: Th1 (IFN-gamma, IL-2)
// activates macrophages, drives CD8 T-cell expansion and IgG switching; Th2 (IL-4, IL-5, IL-13) drives IgE switching,
// eosinophils and alternatively activated (repair) macrophages; Th17 (IL-17, IL-22) brings neutrophils (through
// chemokines from tissue cells) and strengthens epithelial barriers; Tfh (CD40L, IL-21) drives germinal-centre B cells to
// switch class, mature affinity and become plasma and memory cells. The CD4 count bands are the clinical ones: about
// 500-1500 cells/uL is normal, and below 200 an HIV infection is classed as AIDS.
(function () {
  var TARGETS = [["B cell", 36], ["CD8 T cell", 82], ["macrophage", 128], ["neutrophil", 174], ["eosinophil", 220], ["epithelium", 266]];
  var SUB = {
    Th1: {in: "IL-12", tex: "\\text{IL-12}", out: {0: ["IFN-γ", "IgG", "IgG switching"], 1: ["IL-2", "multiply", "CD8 T-cell expansion"], 2: ["IFN-γ", "kills more", "macrophage killing"]}, cyt: "\\text{IFN-}\\gamma,\\ \\text{IL-2}",
      say: "make IFN-γ and IL-2, so macrophages kill what they have eaten, CD8 T cells multiply and B cells switch to IgG against microbes that live inside cells"},
    Th2: {in: "IL-4", tex: "\\text{IL-4}", out: {0: ["IL-4", "IgE", "IgE switching"], 2: ["IL-13", "repair mode", "repair macrophages"], 4: ["IL-5", "activated", "eosinophil activation"]}, cyt: "\\text{IL-4, IL-5, IL-13}",
      say: "make IL-4, IL-5 and IL-13, so B cells switch to IgE, eosinophils activate and macrophages turn to repair against parasitic worms (and in allergy)"},
    Th17: {in: "TGF-β + IL-6", tex: "\\text{TGF-}\\beta+\\text{IL-6}", out: {3: ["IL-17", "recruited", "neutrophil recruitment"], 5: ["IL-22", "barrier up", "barrier repair"]}, cyt: "\\text{IL-17, IL-22}",
      say: "make IL-17 and IL-22, so tissue cells call in neutrophils and epithelia shore up the barrier against extracellular bacteria and fungi"},
    Tfh: {in: "IL-6 + IL-21", tex: "\\text{IL-6}+\\text{IL-21}", out: {0: ["CD40L + IL-21", "Ab + memory", "class-switched antibody and memory B cells"]}, cyt: "\\text{CD40L, IL-21}",
      say: "give B cells CD40L and IL-21 in germinal centres, so they switch class, sharpen their affinity and become plasma and memory cells"}
  };
  var band = function (n) { return n >= 500 ? 2 : n >= 200 ? 1 : 0; };

  Viz.register("helper-t-cell-coordinates-adaptive-immunity", {
    title: "Helper T cells coordinate adaptive immunity",
    subject: "biology",
    shows: "Pick the helper subset and the CD4 count: a dendritic cell activates the CD4 T cell with three signals, the cytokines it then makes decide which cells it helps, and losing CD4 cells (as in HIV) takes that help away from all of them",
    params: {
      subset: {kind: "enum", values: ["Th1", "Th2", "Th17", "Tfh"], default: "Th1", label: "\\text{subset}"},
      cd4: {kind: "integer", default: 1000, min: 0, max: 1500, step: 50, label: "\\text{CD4}/\\mu\\text{L}"}
    },
    formula: function (v) {
      var q = SUB[v.subset];
      return "\\text{signal 3: }" + q.tex + "\\Rightarrow\\text{" + v.subset + "}\\to " + q.cyt + "\\newline\\text{CD4 count}=" + v.cd4 + "\\ \\text{cells}/\\mu\\text{L}";
    },
    status: function (v) {
      var q = SUB[v.subset], b = band(v.cd4);
      if (b === 0) {                          // name only the help this subset gives (its arrows in the figure)
        var lost = Object.keys(q.out).map(function (k) { return q.out[k][2]; });
        var list = lost.length > 1 ? lost.slice(0, -1).join(", ") + " and " + lost[lost.length - 1] : lost[0];
        return (v.cd4 ? "Only <b>" + v.cd4 + " CD4 cells/µL</b>" : "<b>No CD4 cells</b>") + ": below 200 an HIV infection is classed as <b>AIDS</b>, and with " +
          (v.cd4 ? "too few" : "no") + " <b>" + v.subset + "</b> cells " + list + " fade, so opportunistic infections take hold.";
      }
      return "<b>" + v.subset + "</b> cells " + q.say + (b === 2 ? "; <b>" + v.cd4 + "/µL</b> is a normal count." : "; at <b>" + v.cd4 + "/µL</b> that help is thinning (normal is about 500–1500).");
    },
    examples: [
      {name: "Th2 against worms", values: {subset: "Th2"}},
      {name: "Th17 at a barrier", values: {subset: "Th17"}},
      {name: "Tfh in a germinal centre", values: {subset: "Tfh"}},
      {name: "no CD4 cells", values: {cd4: 0}},
      {name: "AIDS range", values: {subset: "Th1", cd4: 150}},
      {name: "high normal", values: {cd4: 1500}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, q = SUB[v.subset], b = band(v.cd4), T = [168, 150], R = 30;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600, raw: true}, o || {})); };
      // the three activation signals, as a short list
      L([8, 14], "1  peptide–MHC II → TCR + CD4", c.c2, {weight: 500});
      L([8, 30], "2  B7 → CD28", c.c2, {weight: 500});
      L([8, 46], "3  " + q.in + " → " + v.subset, c.c3, {weight: 600});
      // dendritic cell
      var D = [56, 150], pts = [];
      for (var k = 0; k < 16; k++) { var rr = k % 2 ? 14 : 30, a = k * Math.PI / 8; pts.push([D[0] + rr * Math.cos(a), D[1] + rr * Math.sin(a)]); }
      api.polygon(pts, {fill: c.c2, fillOpacity: 0.25, stroke: c.c2, width: 1.5});
      L([D[0], D[1] + 44], "dendritic cell", c.c2, {anchor: "middle"});
      // synapse: MHC II-peptide and B7 meet TCR and CD28
      api.rect(D[0] + 30, T[1] - 13, 10, 8, {fill: c.c2, rx: 2});
      api.rect(D[0] + 30, T[1] + 5, 10, 8, {fill: c.c2, rx: 2});
      api.rect(T[0] - R - 10, T[1] - 13, 10, 8, {fill: c.c1, rx: 2});
      api.rect(T[0] - R - 10, T[1] + 5, 10, 8, {fill: c.c1, rx: 2});
      L([(D[0] + T[0]) / 2 + 2, T[1] - 24], "1", c.c2, {anchor: "middle"});
      L([(D[0] + T[0]) / 2 + 2, T[1] + 25], "2", c.c2, {anchor: "middle"});
      api.arrow([D[0] + 8, D[1] - 32], [T[0] - 22, T[1] - 30], {color: c.c3, width: 2, halo: false, head: 8});
      L([D[0] + 8, D[1] - 44], q.in, c.c3);
      // the helper T cell
      var dim = b === 2 ? 1 : b === 1 ? 0.6 : 0.3;
      api.circle(T, R, {fill: c.c1, fillOpacity: 0.12 + 0.2 * dim, stroke: c.c1, width: 2, opacity: Math.max(0.5, dim)});
      L([T[0], T[1] - 4], v.subset, c.c1, {anchor: "middle", size: 15, weight: 700});
      L([T[0], T[1] + 13], "CD4", c.c1, {anchor: "middle", weight: 500});
      // CD4 count as a dot field: one dot per 100 cells/uL and a half dot for 50, rounded down so the dots never
      // claim more cells than the count (150 shows 1.5 dots, not 2, and stays inside the < 200 band)
      var halves = Math.floor(v.cd4 / 50 + 1e-9), nd = Math.floor(halves / 2), half = halves % 2;
      for (var d = 0; d < 15; d++) {
        var p = [T[0] - 40 + (d % 5) * 20, 206 + Math.floor(d / 5) * 15];
        if (d < nd) api.circle(p, 5, {fill: c.c1, fillOpacity: 0.75});
        else if (d === nd && half) {
          api.circle(p, 5, {stroke: c.c1, width: 1});
          api.path("M " + p[0] + " " + (p[1] - 5) + " A 5 5 0 0 0 " + p[0] + " " + (p[1] + 5) + " Z", {fill: c.c1, fillOpacity: 0.75});
        } else api.circle(p, 5, {stroke: c.faint, width: 1});
      }
      L([T[0], 260], v.cd4 + " CD4 cells/µL", c.c1, {anchor: "middle"});
      L([T[0], 276], ["AIDS range (< 200)", "low (200–500)", "normal (500–1500)"][b], b === 0 ? c.c5 : c.muted, {anchor: "middle", weight: b === 0 ? 700 : 500});
      L([T[0], 292], half ? "one dot = 100 cells/µL, half = 50" : "one dot = 100 cells/µL", c.muted, {anchor: "middle", weight: 500});
      // the cells it helps
      TARGETS.forEach(function (t, i) {
        var y = t[1], X = 300, on = q.out[i], col = on ? c.ink : c.faint;
        var ang = Math.atan2(y - T[1], X - 14 - T[0]), s0 = [T[0] + R * Math.cos(ang), T[1] + R * Math.sin(ang)];
        if (on) {
          api.line(s0, [X - 16 - 4 * Math.cos(ang), y - 4 * Math.sin(ang)], {color: c.c3, width: b === 0 ? 1.4 : 2.6, dash: b === 0 ? "4 4" : null, arrow: true, opacity: dim});
          var ux = Math.cos(ang), uy = Math.sin(ang), m = [s0[0] + (X - 16 - s0[0]) * 0.74 + uy * 9, s0[1] + (y - s0[1]) * 0.74 - ux * 9];
          L(m, on[0], c.c3, {anchor: uy < -0.25 ? "end" : uy > 0.25 ? "start" : "middle", opacity: Math.max(0.5, dim)});
        } else api.line(s0, [X - 16, y], {color: c.faint, width: 1, dash: "2 4"});
        if (i === 0) { api.circle([X, y], 12, {stroke: col, width: 1.6}); [-1, 1].forEach(function (sx) { api.path("M " + (X + sx * 9) + " " + (y - 8) + " l " + sx * 4 + " -5 m " + -sx * 4 + " 5 l 0 -5", {stroke: col, width: 1.3}); }); }
        else if (i === 1) { api.circle([X, y], 12, {stroke: col, width: 1.6}); api.circle([X, y], 6, {fill: col, fillOpacity: 0.6}); }
        else if (i === 2) api.path("M " + (X - 13) + " " + y + " q 2 -14 14 -12 q 14 0 12 12 q 2 12 -12 13 q -16 0 -14 -13 Z", {stroke: col, width: 1.6});
        else if (i === 3) { api.circle([X, y], 12, {stroke: col, width: 1.6}); [[-5, -2], [0, 3], [5, -2]].forEach(function (o) { api.circle([X + o[0], y + o[1]], 2.6, {fill: col}); }); }
        else if (i === 4) { api.circle([X, y], 12, {stroke: col, width: 1.6}); [[-4, 0], [4, 0]].forEach(function (o) { api.circle([X + o[0], y + o[1]], 3.4, {fill: col}); }); }
        else [-1, 0, 1].forEach(function (o) { api.rect(X - 6 + o * 11, y - 9, 10, 18, {stroke: col, width: 1.4, rx: 2}); });
        L([X + 18, on ? y - 7 : y], t[0], on ? c.ink : c.muted, {weight: on ? 650 : 500});
        if (on) L([X + 18, y + 8], on[1], c.c3, {weight: 500, opacity: Math.max(0.5, dim)});
      });
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
