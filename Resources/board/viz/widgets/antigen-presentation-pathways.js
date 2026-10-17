// The two antigen-presentation routes and the crossover. MHC class I shows what a cell makes inside itself: proteasome,
// TAP into the ER, loading onto MHC I (8-10 amino-acid peptides), the surface, a CD8+ T cell. MHC class II shows what an
// antigen-presenting cell has taken in: endocytosis, proteases in acidic endosomes (13-25 amino-acid peptides), MHC II
// arriving from the ER with its invariant chain, CLIP swapped for peptide by HLA-DM, the surface, a CD4+ T cell.
// Cross-presentation: a dendritic cell sends outside material into the MHC I route, so it can prime CD8+ T cells against
// viruses that never infected it. The full route is dashed; the part already travelled is solid.
(function () {
  var P = {V: [50, 126], Pr: [104, 92], ER: [108, 165], G: [212, 120], M: [280, 160], T: [312, 160], B: [233, 249], E: [200, 218]};
  var ROUTE = {"MHC I": [["V"], ["Pr"], ["ER"], ["G", "M"], ["T"]], "MHC II": [["B"], ["E"], ["E"], ["M"], ["T"]], cross: [["B"], ["E", "Pr"], ["ER"], ["G", "M"], ["T"]]};
  var FORM = {
    "MHC I": ["\\text{viral protein in cytosol}", "\\text{proteasome}", "\\text{TAP, ER: MHC I}", "\\text{Golgi, surface}", "\\text{CD8}^+\\ \\text{T cell}"],
    "MHC II": ["\\text{endocytosis}", "\\text{endosome proteases}", "\\text{MHC II, CLIP swapped}", "\\text{surface}", "\\text{CD4}^+\\ \\text{T cell}"],
    cross: ["\\text{phagocytosis}", "\\text{cytosol, proteasome}", "\\text{TAP, MHC I}", "\\text{Golgi, surface}", "\\text{CD8}^+\\ \\text{T cell}"]
  };
  var TEXT = {
    "MHC I": ["A virus inside the cell makes its proteins in the cytosol, so any infected cell can show pieces of them on MHC I",
              "The proteasome chops the viral proteins into peptides about 8 to 10 amino acids long",
              "TAP pumps the peptides into the ER, where a new MHC I molecule (with β2-microglobulin) closes around one that fits",
              "The loaded MHC I travels through the Golgi in a vesicle to the cell surface",
              "A CD8⁺ cytotoxic T cell whose receptor fits this peptide on MHC I recognizes the cell as infected and kills it"],
    "MHC II": ["An antigen-presenting cell (dendritic cell, macrophage or B cell) engulfs a bacterium from outside",
               "In acidic endosomes, proteases cut its proteins into peptides about 13 to 25 amino acids long",
               "MHC II arrives from the ER with an invariant chain blocking its groove; in the endosome HLA-DM swaps the leftover CLIP for a bacterial peptide",
               "The loaded MHC II moves out to the cell surface",
               "A CD4⁺ helper T cell whose receptor fits this peptide on MHC II is activated and goes on to help B cells and macrophages"],
    cross: ["A dendritic cell engulfs material from outside, such as virus particles or pieces of an infected cell",
            "Some of it escapes the phagosome into the cytosol, where the proteasome cuts it into peptides of 8 to 10 amino acids",
            "TAP carries those peptides into the ER to load MHC I, the route normally kept for the cell's own proteins",
            "MHC I carrying the outside antigen reaches the surface",
            "A naive CD8⁺ T cell is primed against a virus that never infected the dendritic cell itself"]
  };

  Viz.register("antigen-presentation-pathways", {
    title: "Antigen presentation: MHC I and MHC II",
    subject: "biology",
    shows: "Pick a route and step through it: inside proteins go proteasome, ER and MHC I to CD8 T cells; engulfed proteins go endosome and MHC II to CD4 T cells; dendritic cells cross outside antigen onto MHC I",
    params: {
      path: {kind: "enum", values: ["MHC I", "MHC II", "cross"], names: {"MHC I": "MHC I", "MHC II": "MHC II", cross: "cross-presentation"}, default: "MHC I", label: "\\text{route}"}
    },
    steps: ["where the antigen comes from", "cut into peptides", "loaded onto MHC", "carried to the surface", "shown to a T cell"],
    stepMs: 1800,
    formula: function (v) {
      var s = v.step || 1, f = FORM[v.path].map(function (t, i) { return i === s - 1 ? "\\boxed{" + t + "}" : t; });
      return f.slice(0, 3).join("\\to ") + "\\newline\\to " + f.slice(3).join("\\to ");
    },
    status: function (v) { return TEXT[v.path][(v.step || 1) - 1] + "."; },
    examples: [
      {name: "MHC I: the peptide is loaded in the ER", values: {path: "MHC I", step: 3}},
      {name: "MHC II: shown to a helper T cell", values: {path: "MHC II", step: 5}},
      {name: "cross-presentation: into the cytosol", values: {path: "cross", step: 2}},
      {name: "MHC II: engulfing a bacterium", values: {path: "MHC II", step: 1}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, path = v.path, two = path === "MHC II", mhc = two ? c.c6 : c.c2, T = two ? "CD4" : "CD8";
      // the antigen-presenting cell and its organelles
      api.path("M 16 160 a 132 116 0 1 0 264 0 a 132 116 0 1 0 -264 0", {stroke: c.ink, width: 1.8, fill: c.ink, fillOpacity: 0.03});
      api.circle([80, 205], 32, {fill: c.c6, fillOpacity: 0.07, stroke: c.muted, width: 1.3});
      api.label([80, 207], "nucleus", {color: c.muted, size: 12, anchor: "middle"});
      [42, 49, 56].forEach(function (r) {
        var a0 = -1.66, a1 = -0.26;
        api.path("M " + (80 + r * Math.cos(a0)) + " " + (205 + r * Math.sin(a0)) + " A " + r + " " + r + " 0 0 1 " + (80 + r * Math.cos(a1)) + " " + (205 + r * Math.sin(a1)), {stroke: c.muted, width: 2.4});
      });
      api.label([68, 152], "ER", {color: c.muted, size: 12, anchor: "end"});
      [0, 7, 14].forEach(function (o) { api.path("M " + (202 + o) + " 104 Q " + (194 + o) + " 120 " + (202 + o) + " 136", {stroke: c.muted, width: 3.5}); });
      api.label([212, 150], "Golgi", {color: c.muted, size: 12, anchor: "middle"});
      api.rect(92, 85, 24, 14, {fill: c.c3, fillOpacity: 0.25, stroke: c.c3, width: 1.4, rx: 4});
      [98, 104, 110].forEach(function (x) { api.line([x, 86], [x, 98], {color: c.c3, width: 1}); });
      api.label([104, 74], "proteasome", {color: c.c3, size: 12, anchor: "middle"});
      api.circle(P.E, 18, {fill: c.c4, fillOpacity: 0.1, stroke: c.c4, width: 1.4});
      api.label([176, 248], "endosome", {color: c.c4, size: 12, anchor: "end"});
      // where the antigen came from, faded once it has moved on
      var src = s === 1 ? 1 : 0.4;
      if (path === "MHC I") {
        // the virus has already got in: it sits in the cytosol beside the proteins it is making
        api.polygon([[44, 98.5], [50, 95], [56, 98.5], [56, 105.5], [50, 109], [44, 105.5]], {fill: c.c5, fillOpacity: 0.6, stroke: c.c5, opacity: src});
        api.label([38, 80], "virus", {color: c.c5, size: 12, anchor: "end", opacity: src});
        api.line([36, 86], [45, 97], {color: c.c5, width: 1, opacity: 0.7 * src});
        api.path("M 38 122 q 4 -6 8 0 t 8 0 t 8 0", {stroke: c.c5, width: 2.4, opacity: src}); api.path("M 38 132 q 4 -6 8 0 t 8 0", {stroke: c.c5, width: 2.4, opacity: src});
      } else {
        api.rect(244, 266, 24, 12, {fill: c.c5, fillOpacity: 0.6, stroke: c.c5, rx: 6, opacity: src});
        if (s === 1) api.path("M 222 240 Q 248 238 258 262", {stroke: c.ink, width: 1.4, opacity: 0.6});
        api.label([274, 274], path === "cross" ? "virus, cell debris" : "bacterium", {color: c.c5, size: 12, opacity: src});
      }
      // the T cell on the right; it engages only at the last step
      var engaged = s === 5;
      api.circle([350, 160], 38, {stroke: c.c1, width: engaged ? 2.4 : 1.4, dash: engaged ? null : "4 4", fill: c.c1, fillOpacity: engaged ? 0.08 : 0.02});
      api.label([350, 110], T + "⁺ T cell", {color: c.c1, size: 12.5, weight: engaged ? 650 : 500, anchor: "middle", opacity: engaged ? 1 : 0.6});
      // the route: dashed in full, solid as far as this step
      var R = ROUTE[path], pts = [], done = [];
      R.forEach(function (st, i) { st.forEach(function (k) { pts.push(P[k]); if (i < s) done.push(P[k]); }); });
      api.polyline(pts, {stroke: c.faint, width: 1.4, dash: "4 4"});
      if (done.length > 1) api.polyline(done, {stroke: mhc, width: 2.4});
      if (two && s >= 3) {   // MHC II arrives from the ER through the Golgi, stopping at the endosome's edge
        var gl = Math.hypot(P.G[0] - P.E[0], P.G[1] - P.E[1]), eg = [P.E[0] + 18 * (P.G[0] - P.E[0]) / gl, P.E[1] + 18 * (P.G[1] - P.E[1]) / gl];
        api.polyline([P.ER, P.G, eg], {stroke: c.c6, width: 1.6, dash: "2 3"});
      }
      var here = done[done.length - 1];
      // the current station; wider where the MHC sits inside it, and none on step 5, where the engaged T cell marks it
      if (s < 5) api.circle(here, two && s === 3 ? 23 : s === 4 ? 18 : 13, {stroke: c.c5, width: 2});
      // a label on a patch of card colour, so the faint route behind it stops short of the text
      var tag = function (at, text, o) {
        var w = text.length * o.size * 0.54 + 8;
        api.rect(at[0] - w / 2, at[1] - o.size * 0.62 - 2, w, o.size * 1.24 + 4, {fill: c.card, rx: 3});
        api.rect(at[0] - w / 2, at[1] - o.size * 0.62 - 2, w, o.size * 1.24 + 4, {fill: c.ink, fillOpacity: 0.03, rx: 3});   // the cell's own tint
        api.label(at, text, Object.assign({anchor: "middle"}, o));
      };
      // what is at the current station
      var half = two ? 11 : 4.5;   // 13-25 aa vs 8-10 aa: the MHC II peptide is drawn about twice as long
      var pep = function (q, vert) { api.line(vert ? [q[0], q[1] - half] : [q[0] - half, q[1]], vert ? [q[0], q[1] + half] : [q[0] + half, q[1]], {color: c.c5, width: 3.5}); };
      if (s === 2) {
        var at = two ? P.E : P.Pr;
        (two ? [[30, -12], [36, -1], [30, 10]] : [[28, -4], [34, 6], [26, 14]]).forEach(function (o) { pep([at[0] + o[0], at[1] + o[1]]); });
        if (two) { tag([242, 180], "peptides", {color: c.c5, size: 12}); tag([242, 194], "13–25 aa", {color: c.c5, size: 12, weight: 650}); }
        else { api.label([148, 92], "peptides", {color: c.c5, size: 12}); api.label([148, 106], "8–10 aa", {color: c.c5, size: 12, weight: 650}); }
        if (path === "cross") api.label([P.E[0] + 12, P.E[1] - 21], "escapes", {color: c.muted, size: 12});
      } else if (s === 3) {
        var L = two ? P.E : P.ER;
        if (two) {   // open-ended groove: low end walls, the long peptide hangs out of both ends
          api.path("M " + (L[0] - 8) + " " + (L[1] + 2) + " L " + (L[0] - 8) + " " + (L[1] + 6) + " L " + (L[0] + 8) + " " + (L[1] + 6) + " L " + (L[0] + 8) + " " + (L[1] + 2), {stroke: mhc, width: 3});
          // HLA-DM has just swapped CLIP out of the groove
          api.line([L[0] - 9, L[1] - 5], [L[0] - 20, L[1] - 17], {color: c.muted, width: 1, dash: "2 2"});
          api.line([L[0] - 34, L[1] - 20], [L[0] - 22, L[1] - 20], {color: c.muted, width: 3.5});
          api.label([L[0] - 28, L[1] - 33], "CLIP out", {color: c.muted, size: 12, anchor: "middle"});
        } else {     // closed groove: tall end walls hold the short peptide inside
          api.path("M " + (L[0] - 7) + " " + (L[1] - 6) + " L " + (L[0] - 7) + " " + (L[1] + 6) + " L " + (L[0] + 7) + " " + (L[1] + 6) + " L " + (L[0] + 7) + " " + (L[1] - 6), {stroke: mhc, width: 3});
        }
        pep([L[0], L[1] + 1]);
        api.label(two ? [L[0] + 28, L[1] + 4] : [L[0] + 30, L[1] + 4], two ? "MHC II + peptide" : "MHC I + peptide", {color: mhc, size: 12});
        if (!two) api.label([98, 128], "TAP", {color: c.muted, size: 12, anchor: "end"});
      }
      if (s >= 4) {   // the loaded MHC on the surface, groove facing the T cell
        var M = P.M, wall = two ? 6 : 14;
        api.path("M " + (M[0] + wall) + " " + (M[1] - 8) + " L " + (M[0] + 2) + " " + (M[1] - 8) + " L " + (M[0] + 2) + " " + (M[1] + 8) + " L " + (M[0] + wall) + " " + (M[1] + 8), {stroke: mhc, width: 3.2});
        pep([M[0] + (two ? 8 : 9), M[1]], true);
        // label on the side away from the incoming route (MHC II comes up from the endosome, MHC I down from the Golgi)
        api.label([M[0] - 10, M[1] + (two ? -26 : 27)], two ? "MHC II" : "MHC I", {color: mhc, size: 12.5, weight: 650, anchor: "end"});
      }
      if (engaged) {
        api.path("M 312 152 L 300 152 M 312 168 L 300 168", {stroke: c.c1, width: 3});
        api.line([314, 180], [296, 176], {color: c.c1, width: 2});
        api.label([306, 138], "TCR", {color: c.c1, size: 12, anchor: "middle"});
        api.label([300, 194], T, {color: c.c1, size: 12, anchor: "middle"});
      }
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
