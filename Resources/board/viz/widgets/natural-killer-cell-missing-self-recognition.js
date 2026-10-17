// How a natural killer cell decides. Its inhibitory receptors (KIRs in humans, and CD94/NKG2A) read MHC class I, which
// almost every healthy nucleated cell displays: engaged, they hold the NK cell back. Its activating receptors (NKG2D and
// others) read ligands that healthy cells show only a little of and that stressed, infected or transformed cells
// raise (MICA/MICB and ULBPs for NKG2D). The NK cell kills, by releasing perforin and granzymes into the synapse, when
// activation outweighs inhibition. Missing self (Karre): a virus or tumour that drops MHC I to escape cytotoxic T cells
// loses the brake. Induced self: enough stress ligand overrides normal MHC I. The numbers are a schematic balance, not a
// measured scale: activating A = 30 + 0.9 s (30 = the healthy baseline of activating ligands), inhibitory I = MHC I
// level m, both in % of a healthy cell's; kill when A > I. Colors: blue = the inhibitory pair (KIR + MHC I), amber = the
// activating pair (NKG2D + stress ligand), purple = cytotoxic granules, red = the dying target.
(function () {
  function sig(v) { var A = 30 + 0.9 * v.stress, I = v.mhc; return {A: A, I: I, kill: A > I + 1e-9}; }
  Viz.register("natural-killer-cell-missing-self-recognition", {
    title: "NK cells: missing-self recognition",
    subject: "biology",
    shows: "Lower a target cell's MHC class I or raise its stress ligands: the NK cell weighs inhibitory against activating signals and kills when MHC I goes missing or stress ligands win",
    params: {
      mhc: {kind: "number", default: 100, min: 0, max: 100, step: 5, label: "\\text{MHC I}"},
      stress: {kind: "number", default: 0, min: 0, max: 100, step: 5, label: "\\text{stress}"}
    },
    formula: function (v) {
      var s = sig(v);
      return "\\begin{array}{l}A=30+0.9\\cdot" + Viz.n(v.stress) + "=" + Viz.n(s.A, 1) + ",\\ \\ I=" + Viz.n(v.mhc) + "\\\\ A-I=" + Viz.n(s.A - s.I, 1) +
        (s.kill ? ">0\\Rightarrow\\text{kill}" : "\\le 0\\Rightarrow\\text{spare}") + "\\end{array}";
    },
    status: function (v) {
      var s = sig(v), A = Viz.fmt(s.A, 1), I = Viz.fmt(s.I);
      if (!s.kill) return "<b>Spared</b>: MHC I at " + I + "% keeps inhibition (" + I + ") at or above activation (" + A + "), so the NK cell leaves this cell alone.";
      if (v.mhc < 30 && v.stress < 20) return "<b>Missing self</b>: with " + (v.mhc ? "MHC I at only " + I + "%" : "no MHC I") + ", the brake is gone and even weak activation (" + A + ") wins, so the NK cell <b>kills</b>; this catches cells that hide from T cells by dropping MHC I.";
      if (v.mhc < 30) return "MHC I is down to " + I + "% and stress ligands are up, so activation (" + A + ") swamps inhibition (" + I + ") and the NK cell <b>kills</b>.";
      return "<b>Induced self</b>: stress ligands lift activation to " + A + ", past the MHC I brake of " + I + ", so the NK cell <b>kills</b> even though MHC I is " + (v.mhc >= 100 ? "normal" : "still present") + ".";
    },
    examples: [
      {name: "healthy cell: spared", values: {mhc: 100, stress: 0}},
      {name: "virus removes MHC I: missing self", values: {mhc: 10, stress: 0}},
      {name: "stressed tumour cell: induced self", values: {mhc: 100, stress: 100}},
      {name: "partly lowered MHC I: still spared", values: {mhc: 60, stress: 20}},
      {name: "no MHC I, no stress (minimum)", values: {mhc: 0, stress: 0}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = sig(v), cy = 110, dead = s.kill;
      // the two cells, facing across the synapse
      api.path("M 172 " + (cy - 74) + " C 60 " + (cy - 92) + " 8 " + (cy - 48) + " 12 " + cy + " C 8 " + (cy + 48) + " 60 " + (cy + 92) + " 172 " + (cy + 74) + " Z",
        {fill: c.c1, fillOpacity: 0.08, stroke: c.c1, width: 2});
      api.path("M 48 " + (cy - 18) + " q 0 -26 30 -26 q 28 0 26 24 q -2 14 -16 12 q -12 -4 -22 4 q -18 8 -18 -14 Z", {fill: c.muted, fillOpacity: 0.3, stroke: c.muted, width: 1.2});
      api.label([36, cy + 26], "NK cell", {color: c.c1, size: 13, weight: 700});
      api.path("M 240 " + (cy - 74) + " C 340 " + (cy - 90) + " 392 " + (cy - 46) + " 388 " + cy + " C 392 " + (cy + 46) + " 340 " + (cy + 90) + " 240 " + (cy + 74) + " Z",
        {fill: dead ? c.c5 : c.ink, fillOpacity: dead ? 0.08 : 0.05, stroke: dead ? c.c5 : c.muted, width: 2, dash: dead ? "7 5" : null});
      api.circle([322, cy - 10], 22, {fill: c.muted, fillOpacity: dead ? 0.12 : 0.3, stroke: c.muted, width: 1.2, dash: dead ? "3 3" : null});
      api.label([320, cy + 34], dead ? "target dying" : "target cell", {color: dead ? c.c5 : c.muted, size: 13, weight: 700, anchor: "middle"});
      if (dead) [[358, cy - 46], [372, cy + 4], [292, cy + 54]].forEach(function (p) { api.circle(p, 7, {fill: c.c5, fillOpacity: 0.2, stroke: c.c5, width: 1.2}); });
      // receptor pairs across the synapse: three inhibitory slots (top), three activating slots (bottom)
      // both rows on one scale (120 = the top of the balance), then made to agree with the verdict
      // (on one scale a rounded tie is the only clash; break it by moving whichever row is closer to the next count,
      // so missing self loses its brake and induced self gains a ligand; nL >= 1 always, since A >= 30)
      var a = 3 * s.A / 120, b = 3 * s.I / 120, nM = Math.round(b), nL = Math.round(a);
      if (s.kill && nL <= nM) { if (nL < 3 && nM + 1 - a <= b - (nM - 1)) nL = nM + 1; else nM = nL - 1; }
      if (!s.kill && s.A < s.I && nM <= nL) { if (nL >= 2 && a - (nL - 1) < nL + 1 - b) nL = nM - 1; else nM = nL + 1; }
      var slotsY = [cy - 58, cy - 40, cy - 22, cy + 22, cy + 40, cy + 58];
      for (var i = 0; i < 6; i++) {
        var y = slotsY[i], inh = i < 3, col = inh ? c.c2 : c.c3, k = inh ? i : i - 3, present = inh ? k < nM : k < nL;
        // receptor on the NK membrane (a Y); its ligand on the target membrane, docked when present
        api.line([174, y], [190, y], {color: col, width: 2.4});
        api.line([190, y], [198, y - 6], {color: col, width: 2.4});
        api.line([190, y], [198, y + 6], {color: col, width: 2.4});
        if (present) {
          if (inh) api.rect(204, y - 7, 16, 14, {fill: col, fillOpacity: 0.85, rx: 3});
          else api.circle([212, y], 7, {fill: col, fillOpacity: 0.9});
          api.line([220, y], [238, y], {color: col, width: 2.4});
        } else api.line([230, y], [238, y], {color: col, width: 1.4, opacity: 0.4});
      }
      api.label([206, 16], "KIR + MHC I: " + nM + " of 3 engaged", {color: c.c2, size: 12, weight: 650, anchor: "middle"});
      api.label([206, 203], "NKG2D + stress ligand: " + nL + " of 3 engaged", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      // granules: kept inside, or fired into the synapse
      if (dead) {
        api.arrow([140, cy], [190, cy], {color: c.c6, width: 2, halo: false, head: 8});
        [198, 212, 226].forEach(function (x) { api.circle([x, cy], 5, {fill: c.c6, fillOpacity: 0.85}); });
        api.circle([124, cy - 30], 5, {fill: c.c6, fillOpacity: 0.85});
        api.label([104, cy + 52], "perforin + granzymes", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
      } else {
        [[124, cy - 30], [146, cy - 8], [120, cy + 6], [148, cy + 22]].forEach(function (p) { api.circle(p, 5, {fill: c.c6, fillOpacity: 0.85}); });
        api.label([104, cy + 52], "granules held back", {color: c.c6, size: 12, anchor: "middle"});
      }
      // the balance
      var bx = 104, bw = 240, sc = bw / 120, y1 = 232, y2 = 256;
      api.label([12, y1], "activating", {color: c.c3, size: 12.5, weight: 650});
      api.label([12, y2], "inhibitory", {color: c.c2, size: 12.5, weight: 650});
      api.rect(bx, y1 - 8, s.A * sc, 16, {fill: c.c3, fillOpacity: 0.85, rx: 3});
      api.rect(bx, y2 - 8, Math.max(1.5, s.I * sc), 16, {fill: c.c2, fillOpacity: 0.85, rx: 3});
      api.label([bx + s.A * sc + 5, y1], Viz.fmt(s.A, 1), {color: c.c3, size: 12, weight: 650});
      api.label([bx + s.I * sc + 5, y2], Viz.fmt(s.I), {color: c.c2, size: 12, weight: 650});
      api.line([bx, y1 - 14], [bx, y2 + 12], {color: c.axis, width: 1});
      api.label([12, 286], s.kill ? "activation > inhibition: KILL" : "inhibition ≥ activation: SPARE", {color: s.kill ? c.c5 : c.c4, size: 13.5, weight: 750});
      api.label([388, 286], "schematic units", {color: c.faint, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
