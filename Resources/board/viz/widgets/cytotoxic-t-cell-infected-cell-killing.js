// How a cytotoxic T cell kills an infected cell. Every nucleated cell shows peptides from its own proteins on MHC class I;
// a virus replicating inside adds viral peptides. A CD8+ T cell whose receptor (TCR) fits one viral peptide on MHC I
// locks on (CD8 binds MHC I itself), forms an immunological synapse, moves its lytic granules to the contact, and
// releases perforin (pores in the target membrane) and granzymes (which enter and activate caspases). The target dies
// by apoptosis, its fragments cleared by phagocytes, and the T cell detaches to kill again (serial killing).
// Contrasts: a healthy cell shows only self peptides, which no surviving T cell recognizes (self-reactive cells are
// deleted in the thymus), so nothing happens; a cell whose virus strips MHC I off the surface is invisible to T cells,
// but missing MHC I releases the brake on NK cells, which kill it with the same perforin and granzymes.
(function () {
  var TEXT = {
    infected: ["A CD8⁺ cytotoxic T cell crawls over a cell whose MHC I molecules show mostly self peptides and a few <b>viral peptides</b>, pieces of the virus replicating inside.",
               "Its T cell receptor fits this <b>viral peptide on MHC I</b> and CD8 grips the MHC I itself, so the T cell locks on.",
               "The T cell forms an immunological synapse with its target and moves its <b>lytic granules</b> to the contact point.",
               "The granules release <b>perforin</b>, which punches pores in the target's membrane, and <b>granzymes</b>, which enter and switch on its caspases.",
               "The target dies by <b>apoptosis</b>, breaking into fragments that phagocytes clear before the virus can finish, and the T cell moves on to kill again."],
    healthy: ["The T cell scans a healthy cell, whose MHC I molecules show only <b>self peptides</b> made from its own proteins.",
              "No receptor fits a self peptide (T cells that did were deleted in the thymus), so <b>nothing binds</b>.",
              "With no signal from its receptor the T cell never aims its granules; it <b>moves on</b>.",
              "No perforin or granzyme is released, so the healthy cell's membrane stays <b>intact</b>.",
              "The healthy cell <b>survives</b>: killing needs a foreign peptide on MHC I."],
    hidden: ["This virus makes the infected cell pull <b>MHC I</b> off its surface, so it shows no peptides at all.",
             "With no peptide on MHC I to bind, the T cell receptor <b>cannot recognize</b> the infected cell.",
             "The T cell moves on, but an <b>NK cell</b> arrives: a cell missing MHC I has lost the signal that holds NK cells back.",
             "The NK cell releases the same <b>perforin and granzymes</b> into the cell that hid its MHC I.",
             "The hidden cell dies by <b>apoptosis</b> after all, killed by the NK cell instead of the T cell."]
  };
  var FORM = ["\\text{TCR scans peptide:MHC I}", "\\text{TCR}+\\text{CD8}\\ \\leftrightarrow\\ \\text{viral peptide:MHC I}", "\\text{granules}\\to\\text{synapse}",
              "\\text{perforin pores}+\\text{granzymes}\\to\\text{caspases}", "\\text{caspases}\\to\\text{apoptosis}"];

  Viz.register("cytotoxic-t-cell-infected-cell-killing", {
    title: "Cytotoxic T cell killing",
    subject: "biology",
    shows: "Step through a kill: a CD8 T cell recognizes a viral peptide on MHC I, aims its granules and releases perforin and granzymes so the infected cell dies by apoptosis; a healthy cell is spared, and a cell hiding MHC I falls to an NK cell instead",
    params: {
      target: {kind: "enum", values: ["infected", "healthy", "hidden"], names: {infected: "infected", healthy: "healthy", hidden: "MHC I hidden"}, default: "infected", label: "\\text{target}"}
    },
    steps: ["scan", "match?", "respond", "attack", "outcome"],   // names that fit all three targets
    stepMs: 1700,
    formula: function (v) {
      if (v.target === "healthy") return "\\text{self peptide:MHC I}\\Rightarrow\\text{no match, no kill}";
      if (v.target === "hidden" && (v.step || 1) <= 2) return "\\text{no MHC I}\\Rightarrow\\text{TCR has nothing to bind}";
      if (v.target === "hidden") return "\\text{missing MHC I}\\Rightarrow\\text{NK cell}\\to\\text{perforin, granzymes}";
      return FORM[(v.step || 1) - 1];
    },
    status: function (v) { return TEXT[v.target][(v.step || 1) - 1]; },
    examples: [
      {name: "recognition", values: {target: "infected", step: 2}},
      {name: "perforin and granzymes", values: {target: "infected", step: 4}},
      {name: "the infected cell dies", values: {target: "infected", step: 5}},
      {name: "healthy cell: no match", values: {target: "healthy", step: 2}},
      {name: "MHC I hidden: an NK cell kills", values: {target: "hidden", step: 4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, t = v.target, T = c.c1, MHC = c.c2, VIR = c.c5, GR = c.c6, NK = c.c4;
      var tc = [288, 150], tr = 66;
      var kills = t === "infected" ? s >= 2 && s <= 4 : false;
      var cx = t === "infected" ? [92, 150, 150, 150, 92][s - 1] : [92, 132, 84, 84, 84][s - 1], C = [cx, 150];
      var dead = s === 5 && t !== "healthy";
      var at = function (P, r, deg, k) { var a = deg * Math.PI / 180; return [P[0] + (r + (k || 0)) * Math.cos(a), P[1] + (r + (k || 0)) * Math.sin(a)]; };
      // the target cell
      if (!dead) {
        api.circle(tc, tr, {fill: c.ink, fillOpacity: 0.05, stroke: c.muted, width: 1.8});
        api.circle([tc[0] + 16, tc[1] + 12], 20, {fill: c.c6, fillOpacity: 0.08, stroke: c.muted, width: 1.2});
        if (t !== "healthy") [[-22, -26], [24, -30], [-30, 20]].forEach(function (o) {
          var q = [tc[0] + o[0], tc[1] + o[1]], pts = [];
          for (var i = 0; i < 6; i++) pts.push([q[0] + 6 * Math.cos(i * Math.PI / 3), q[1] + 6 * Math.sin(i * Math.PI / 3)]);
          api.polygon(pts, {fill: VIR, fillOpacity: 0.7, stroke: VIR, width: 1});
        });
        api.label([tc[0], tc[1] - tr - 14], {infected: "infected cell", healthy: "healthy cell", hidden: "infected cell, MHC I hidden"}[t], {color: t === "healthy" ? c.muted : VIR, size: 12.5, weight: 650, anchor: "middle"});
        // MHC I cups, each holding a peptide: an infected cell still shows mostly self peptides, with viral ones on a few
        if (t !== "hidden") [168, 180, 192, 135, 225, 100, 260, 40, 320].forEach(function (deg) {
          var a = deg * Math.PI / 180, n = [Math.cos(a), Math.sin(a)], tg = [-n[1], n[0]], b = at(tc, tr, deg), o = at(tc, tr, deg, 8);
          api.path("M " + (o[0] + tg[0] * 4) + " " + (o[1] + tg[1] * 4) + " L " + (b[0] + tg[0] * 4) + " " + (b[1] + tg[1] * 4) + " L " + (b[0] - tg[0] * 4) + " " + (b[1] - tg[1] * 4) + " L " + (o[0] - tg[0] * 4) + " " + (o[1] - tg[1] * 4), {stroke: MHC, width: 2.4});
          api.circle(at(tc, tr, deg, 4), 2.6, {fill: t === "infected" && (deg === 180 || deg === 225 || deg === 40) ? VIR : c.muted});
        });
      } else {
        [[-18, -20, 24], [20, -12, 20], [-4, 24, 22], [30, 26, 14], [-36, 8, 13]].forEach(function (b, i) {
          api.circle([tc[0] + b[0], tc[1] + b[1]], b[2], {fill: c.ink, fillOpacity: 0.05, stroke: c.muted, width: 1.4, dash: "3 2"});
          if (i < 3) api.circle([tc[0] + b[0] + 4, tc[1] + b[1] + 3], 3.4, {fill: c.c6, fillOpacity: 0.6});
        });
        api.label([tc[0], tc[1] - 62], "apoptotic bodies", {color: c.muted, size: 12.5, weight: 650, anchor: "middle"});
        api.label([tc[0], tc[1] + 72], "cleared by phagocytes", {color: c.muted, size: 12, anchor: "middle"});
      }
      // the cytotoxic T cell, its receptors facing right
      api.circle(C, 56, {fill: T, fillOpacity: 0.08, stroke: T, width: 2});
      api.circle([C[0] - 14, C[1] - 6], 20, {fill: T, fillOpacity: 0.12, stroke: T, width: 1});
      api.label([C[0], C[1] + 72], "CD8⁺ T cell", {color: T, size: 12.5, weight: 650, anchor: "middle", raw: true});
      [-14, 0, 14].forEach(function (deg) {
        var a = deg * Math.PI / 180, b = at(C, 56, deg), o = at(C, 56, deg, 8), tg = [-Math.sin(a), Math.cos(a)];
        [-2.2, 2.2].forEach(function (k) { api.line([b[0] + tg[0] * k, b[1] + tg[1] * k], [o[0] + tg[0] * k, o[1] + tg[1] * k], {color: T, width: 2}); });
      });
      if (kills) api.label([206, 86], s === 2 ? "TCR + CD8 bind" : "synapse", {color: T, size: 12, anchor: "middle"});
      // lytic granules: scattered, then aimed at the contact
      var aim = (t === "infected" && s >= 3 && s <= 4);
      var gpos = aim ? [[34, -14], [40, 0], [34, 14], [24, -26], [24, 26]] : [[-20, -24], [12, -30], [-30, 16], [8, 26], [24, 2]];
      gpos.forEach(function (o) { api.circle([C[0] + o[0], C[1] + o[1]], 5.5, {fill: GR, fillOpacity: 0.85}); });
      if (aim && s === 3) api.label([C[0], C[1] - 70], "granules move to the synapse", {color: GR, size: 12, anchor: "middle"});
      if (t === "healthy" && s === 2) api.label([168, 72], "self peptide: no match", {color: c.muted, size: 12, anchor: "middle"});
      if (t === "hidden" && s === 2) api.label([168, 72], "nothing to bind", {color: c.muted, size: 12, anchor: "middle"});
      if ((t !== "infected" && s >= 3) || (t === "infected" && s === 5)) {
        api.arrow([C[0] + 24, C[1] + 92], [C[0] - 54, C[1] + 92], {color: T, width: 2, halo: false, head: 9});
        api.label([C[0] - 14, C[1] + 108], t === "infected" ? "on to the next target" : "moves on", {color: T, size: 12, anchor: "middle"});
      }
      // perforin pores and granzymes, from the T cell (infected) or from an NK cell (MHC I hidden)
      var poke = function (degs, from) {
        degs.forEach(function (deg) { var q = at(tc, tr, deg); api.circle(q, 3.6, {fill: c.card, stroke: GR, width: 2}); });
        [[-40, -10], [-34, 12], [-46, 2], [-28, -24]].forEach(function (o) { api.circle(from(o), 2.6, {fill: GR}); });
        api.label([tc[0], tc[1] + tr + 16], "perforin pores, granzymes inside", {color: GR, size: 12, anchor: "middle"});
      };
      // pores just above and below the TCR contacts (168-192 degrees), so they do not pile onto the gripped MHC I
      if (t === "infected" && s === 4) poke([148, 157, 203, 212], function (o) { return [tc[0] + o[0], tc[1] + o[1]]; });
      if (t === "hidden" && s >= 3 && s <= 5) {
        var nk = s === 3 ? [336, 246] : [292, 246], nr = s === 3 ? 24 : 30;
        api.circle(nk, nr, {fill: NK, fillOpacity: 0.12, stroke: NK, width: 2});
        if (s === 3) api.label([nk[0] - nr - 6, nk[1] + 4], "NK cell", {color: NK, size: 12.5, weight: 650, anchor: "end"});
        else api.label([nk[0] + nr + 6, nk[1] + 4], "NK cell", {color: NK, size: 12.5, weight: 650});
        if (s >= 4) [[-11, -19], [0, -22], [11, -19]].forEach(function (o) { api.circle([nk[0] + o[0], nk[1] + o[1]], 4.5, {fill: GR, fillOpacity: 0.85}); });
        if (s === 4) {
          [80, 92, 104].forEach(function (deg) { api.circle(at(tc, tr, deg), 3.6, {fill: c.card, stroke: GR, width: 2}); });
          [[-6, 40], [10, 36], [2, 28]].forEach(function (o) { api.circle([tc[0] + o[0], tc[1] + o[1]], 2.6, {fill: GR}); });
          api.label([250, 226], "perforin, granzymes", {color: GR, size: 12, anchor: "end"});
        }
      }
      // legend for the small marks
      var lx = 30, ly = 288;
      api.path("M " + lx + " " + (ly - 5) + " L " + lx + " " + (ly + 4) + " L " + (lx + 8) + " " + (ly + 4) + " L " + (lx + 8) + " " + (ly - 5), {stroke: MHC, width: 2.4});
      api.label([lx + 14, ly], "MHC I", {color: c.muted, size: 12});
      api.circle([lx + 70, ly], 3.4, {fill: VIR}); api.label([lx + 78, ly], "viral peptide", {color: c.muted, size: 12});
      api.circle([lx + 168, ly], 3.4, {fill: c.muted}); api.label([lx + 176, ly], "self peptide", {color: c.muted, size: 12});
      api.circle([lx + 260, ly], 5, {fill: GR, fillOpacity: 0.85}); api.label([lx + 269, ly], "granules", {color: c.muted, size: 12});
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
