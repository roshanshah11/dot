// MHC I and MHC II side by side, one step at a time, so each stage can be compared. MHC class I: any nucleated cell
// shows what it makes inside itself (endogenous antigen): proteasome, peptides of 8-10 amino acids, TAP into the ER,
// loading onto MHC I with beta2-microglobulin, Golgi, surface, a CD8+ cytotoxic T cell. MHC class II: an
// antigen-presenting cell shows what it has engulfed (exogenous antigen): proteases in acidic endosomes, peptides of
// 13-25 amino acids, MHC II from the ER with its groove blocked by the invariant chain (trimmed to CLIP), HLA-DM swapping
// CLIP for the peptide, surface, a CD4+ helper T cell. The chosen route is bright; the other stays faint for contrast.
(function () {
  var ONE = "MHC I (endogenous)", TWO = "MHC II (exogenous)";
  // stations in each column (MHC I on the left, MHC II shifted right by 196); the last one is the surface MHC, its base
  // on the plasma membrane at y = 100
  var R1 = [[40, 134], [66, 176], [118, 238], [146, 168], [150, 96]];
  var R2 = [[376, 200], [310, 180], [310, 180], [324, 132], [346, 96]];
  var FORM = {
    one: ["\\text{viral protein in the cytosol}", "\\text{proteasome}\\to 8\\text{–}10\\ \\text{aa}", "\\text{TAP}\\to\\text{ER, loads MHC I}", "\\text{Golgi}\\to\\text{surface}", "\\text{CD8}^+\\ \\text{T cell kills}"],
    two: ["\\text{engulfed bacterium}", "\\text{endosome}\\to 13\\text{–}25\\ \\text{aa}", "\\text{HLA-DM swaps CLIP}", "\\text{vesicle}\\to\\text{surface}", "\\text{CD4}^+\\ \\text{T cell helps}"]
  };
  var TEXT = {
    one: ["A virus inside the cell makes its proteins in the cytosol, so this is endogenous antigen, and any nucleated cell can show it",
          "The proteasome chops the viral proteins into peptides of 8 to 10 amino acids; MHC II instead relies on proteases in acidic endosomes",
          "TAP pumps the peptides into the ER, where a new MHC I (with β2-microglobulin) closes its groove around one that fits",
          "The loaded MHC I rides a vesicle through the Golgi to the surface, as MHC II also does from its endosome",
          "A CD8⁺ cytotoxic T cell whose receptor fits peptide plus MHC I recognizes an infected cell and kills it; MHC II talks to CD4⁺ cells"],
    two: ["An antigen-presenting cell (dendritic cell, macrophage or B cell) engulfs a bacterium from outside, so this is exogenous antigen",
          "Proteases in the acidic endosome cut its proteins into peptides of 13 to 25 amino acids; MHC I instead uses the proteasome",
          "MHC II arrives from the ER with its groove blocked by the invariant chain; in the endosome HLA-DM swaps the leftover CLIP for a peptide",
          "The loaded MHC II moves out to the cell surface, its open-ended groove holding the longer peptide",
          "A CD4⁺ helper T cell whose receptor fits peptide plus MHC II is activated and helps B cells and macrophages; MHC I talks to CD8⁺ cells"]
  };
  Viz.register("mhc-i-vs-mhc-ii-presentation", {
    title: "MHC I vs MHC II: two routes to the surface",
    subject: "biology",
    shows: "Step both routes side by side: inside proteins go proteasome, TAP, ER and MHC I to CD8 T cells; engulfed proteins go endosome, CLIP swap and MHC II to CD4 T cells",
    params: {
      initial_pathway: {kind: "enum", values: [ONE, TWO], default: ONE, label: "\\text{route}"}
    },
    steps: ["where the antigen comes from", "cut into peptides", "loaded onto MHC", "carried to the surface", "shown to a T cell"],
    stepMs: 1800,
    formula: function (v) {
      var s = (v.step || 1) - 1, a = v.initial_pathway === ONE ? "one" : "two", b = a === "one" ? "two" : "one";
      return "\\textbf{" + (a === "one" ? "MHC I" : "MHC II") + "}:\\ " + FORM[a][s] + "\\newline\\text{vs " + (b === "one" ? "MHC I" : "MHC II") + ": }" + FORM[b][s];
    },
    status: function (v) { return TEXT[v.initial_pathway === ONE ? "one" : "two"][(v.step || 1) - 1] + "."; },
    examples: [
      {name: "MHC I: proteasome cuts", values: {initial_pathway: ONE, step: 2}},
      {name: "MHC II: CLIP swapped for peptide", values: {initial_pathway: TWO, step: 3}},
      {name: "MHC I: CD8 T cell", values: {initial_pathway: ONE, step: 5}},
      {name: "MHC II: engulfing", values: {initial_pathway: TWO, step: 1}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, first = v.initial_pathway === ONE, TOP = 100;   // TOP: the plasma membrane
      var gOne = api.group({opacity: first ? 1 : 0.32}), gTwo = api.group({opacity: first ? 0.32 : 1});
      var P = function (g) { return function (o) { return Object.assign({parent: g}, o); }; };
      var groove = function (at, two, o) {   // MHC I: closed groove, short peptide; MHC II: open ends, long peptide sticking out
        var w = 8, h = two ? 4 : 9, col = two ? c.c6 : c.c2, half = two ? 11 : 4.5;
        api.path("M " + (at[0] - w) + " " + (at[1] - h) + " L " + (at[0] - w) + " " + (at[1] + 4) + " L " + (at[0] + w) + " " + (at[1] + 4) + " L " + (at[0] + w) + " " + (at[1] - h), o({stroke: col, width: 3}));
        api.line([at[0] - half, at[1]], [at[0] + half, at[1]], o({color: c.c5, width: 3}));
      };
      [[0, gOne, false], [196, gTwo, true]].forEach(function (col) {
        var ox = col[0], o = P(col[1]), two = col[2], mc = two ? c.c6 : c.c2, R = two ? R2 : R1, T = two ? "CD4" : "CD8";
        // the cell, its nucleus, ER and Golgi
        api.rect(ox + 8, TOP, 180, 312 - TOP, o({fill: c.ink, fillOpacity: 0.03, stroke: c.ink, width: 1.5, rx: 26}));
        api.label([ox + 12, 12], two ? "MHC II" : "MHC I", o({color: mc, size: 13, weight: 700}));
        api.label([ox + 12, 28], two ? "professional APC" : "any nucleated cell", o({color: c.muted, size: 12}));
        api.circle([ox + 98, 282], 20, o({fill: c.c6, fillOpacity: 0.06, stroke: c.muted, width: 1.2}));
        [30, 36].forEach(function (r) {
          api.path("M " + (ox + 98 + r * Math.cos(3.6)) + " " + (282 + r * Math.sin(3.6)) + " A " + r + " " + r + " 0 0 1 " + (ox + 98 + r * Math.cos(5.8)) + " " + (282 + r * Math.sin(5.8)), o({stroke: c.muted, width: 2.2}));
        });
        api.label([ox + 54, 262], "ER", o({color: c.muted, size: 12, anchor: "end"}));
        var gx = two ? ox + 52 : ox + 146, gy = two ? 186 : 168;
        [0, 6, 12].forEach(function (d) { api.path("M " + (gx - 12) + " " + (gy - 8 + d) + " Q " + gx + " " + (gy - 14 + d) + " " + (gx + 12) + " " + (gy - 8 + d), o({stroke: c.muted, width: 2.6})); });
        api.label([gx, gy + 20], "Golgi", o({color: c.muted, size: 12, anchor: "middle"}));
        // the route: dashed in full, solid as far as this step
        api.polyline(R, o({stroke: c.faint, width: 1.4, dash: "4 4"}));
        if (s > 1) api.polyline(R.slice(0, s), o({stroke: mc, width: 2.2}));
        if (s < 5) api.circle(R[s - 1], 15, o({stroke: c.accent, width: 1.8}));
        // the T cell waits above the surface MHC; at step 5 its receptor and co-receptor dock: CD8 on MHC I, CD4 on MHC II
        var on = s === 5, m = R[4], tc = [m[0], 58], side = two ? 1 : -1;
        api.circle(tc, 18, o({stroke: c.c1, width: on ? 2.4 : 1.2, dash: on ? null : "4 4", fill: c.c1, fillOpacity: on ? 0.1 : 0.02}));
        api.label(tc, T + "⁺", o({color: c.c1, size: 12, weight: on ? 700 : 500, anchor: "middle"}));
        if (on) {
          [-3, 3].forEach(function (d) { api.line([tc[0] + d, 76], [tc[0] + d, two ? 91 : 89], o({color: c.c1, width: 2.4})); });   // TCR on peptide + groove
          var foot = [m[0] + side * 9, TOP - 3];   // the co-receptor grips the membrane-near part of the MHC
          api.line([tc[0] + side * 12.7, tc[1] + 12.7], foot, o({color: c.c1, width: 3}));
          api.circle(foot, 2.6, o({fill: c.c1}));
          api.label([tc[0] + side * 18, 86], T, o({color: c.c1, size: 12, weight: 650, anchor: two ? "start" : "end"}));
          api.label([tc[0] - 24, 50], two ? "helps" : "kills", o({color: c.c1, size: 12, weight: 650, anchor: "end"}));
        }
        if (!two) {   // virus and viral protein in the cytosol; proteasome
          var V = R1[0];
          api.polygon([[V[0] - 8, V[1] - 6], [V[0], V[1] - 11], [V[0] + 8, V[1] - 6], [V[0] + 8, V[1] + 4], [V[0], V[1] + 9], [V[0] - 8, V[1] + 4]], o({fill: c.c5, fillOpacity: 0.5, stroke: c.c5}));
          api.label([V[0] + 18, V[1] - 12], "virus", o({color: c.c5, size: 12}));
          api.path("M 30 157 q 4 -6 8 0 t 8 0 t 8 0", o({stroke: c.c5, width: 2.2}));
          api.rect(54, 170, 24, 13, o({fill: c.c3, fillOpacity: 0.3, stroke: c.c3, width: 1.4, rx: 4}));
          [60, 66, 72].forEach(function (x) { api.line([x, 171], [x, 182], o({color: c.c3, width: 1})); });
          api.label([66, 196], "proteasome", o({color: c.c3, size: 12, anchor: "middle"}));
          api.rect(108, 228, 8, 12, o({fill: c.muted, fillOpacity: 0.6, rx: 2}));
          api.label([98, 232], "TAP", o({color: c.muted, size: 12, anchor: "end"}));
        } else {      // a bacterium half engulfed at the right edge; endosome
          var B = R2[0];
          api.rect(B[0] - 10, B[1] - 8, 26, 16, o({fill: c.c5, fillOpacity: 0.5, stroke: c.c5, rx: 8}));
          api.label([394, B[1] - 26], "bacterium", o({color: c.c5, size: 12, anchor: "end"}));
          api.circle(R2[1], 20, o({fill: c.c4, fillOpacity: 0.1, stroke: c.c4, width: 1.5}));
          api.label([R2[1][0], R2[1][1] + 34], "endosome", o({color: c.c4, size: 12, anchor: "middle"}));
        }
        // what sits at the current station
        if (s === 2) {
          var at = two ? [R2[1][0] - 6, R2[1][1]] : [86, 168], len = two ? 7 : 3.5;
          [[0, -6], [5, 2], [0, 10]].forEach(function (d) { api.line([at[0] + d[0] - len, at[1] + d[1]], [at[0] + d[0] + len, at[1] + d[1]], o({color: c.c5, width: 3})); });
          api.label(two ? [286, 150] : [100, 150], two ? "13–25 aa" : "8–10 aa", o({color: c.c5, size: 12, weight: 650, anchor: two ? "end" : "start"}));
        } else if (s === 3) {
          if (two) {
            groove([R2[1][0], R2[1][1] + 2], true, o);
            api.polyline([[ox + 98, 246], [gx, gy], [R2[1][0] - 14, R2[1][1] - 4]], o({stroke: c.c6, width: 1.4, dash: "2 3"}));
            api.line([R2[1][0] + 12, R2[1][1] - 20], [R2[1][0] + 22, R2[1][1] - 30], o({color: c.muted, width: 3}));
            api.label([R2[1][0] + 26, R2[1][1] - 38], "CLIP out", o({color: c.muted, size: 12}));
          } else {
            groove([132, 242], false, o);
            api.label([140, 224], "MHC I", o({color: c.c2, size: 12, anchor: "start"}));
          }
        } else if (s >= 4) {   // on the surface: groove opening up, its base on the membrane, a stalk through it
          if (s === 4) api.circle([R[3][0], R[3][1]], 9, o({stroke: mc, width: 1.4}));
          api.line([m[0], TOP], [m[0], TOP + 7], o({color: mc, width: 3}));
          groove([m[0], TOP - 4], two, o);
          api.label([m[0] - side * (two ? 18 : 13), TOP - 6], two ? "MHC II" : "MHC I", o({color: mc, size: 12, weight: 650, anchor: two ? "end" : "start"}));
        }
      });
      api.line([198, 44], [198, 312], {color: c.grid, width: 1});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
