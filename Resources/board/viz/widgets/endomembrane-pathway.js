// The secretory pathway on a whole-cell map: rough ER -> COPII vesicle -> Golgi -> one of three destinations.
// A signal sequence brings the ribosome to the ER, so the protein is made into the ER lumen (or, with a hydrophobic
// stop-transfer stretch, into the ER membrane). Chaperones fold it and an N-linked sugar chain is added. COPII vesicles
// carry it to the cis Golgi; cisternae edit its sugars cis to trans and the trans-Golgi network (TGN) sorts it:
// secretory vesicles fuse with the plasma membrane and release soluble cargo outside; a membrane protein rides in the
// vesicle's membrane and ends in the plasma membrane with its lumen-side domain facing outside (topology is kept);
// lysosomal enzymes get a mannose-6-phosphate tag (added in the cis Golgi, uncovered in the TGN) and M6P receptors carry
// them via endosomes to the lysosome. Colors: blue = ER and ribosomes, purple = Golgi, teal = transport vesicles,
// amber = the cargo protein (a bar across the membrane when it is a membrane protein; the dot is its lumen side),
// green = sugar chain, red = lysosome.
(function () {
  var ROUTE = {
    secretion: ["\\text{ribosome}", "\\text{ER}", "\\text{COPII}", "\\text{Golgi}", "\\text{outside}"],
    "plasma membrane": ["\\text{ribosome}", "\\text{ER membrane}", "\\text{COPII}", "\\text{Golgi}", "\\text{plasma membrane}"],
    lysosome: ["\\text{ribosome}", "\\text{ER}", "\\text{COPII}", "\\text{Golgi (M6P)}", "\\text{lysosome}"]
  };
  var SAY = {
    secretion: ["A ribosome's signal sequence docks it on the rough ER, so the new protein is threaded into the ER lumen as it is made.",
      "Inside the ER, chaperones fold the protein and an N-linked <b>sugar chain</b> is attached.",
      "A <b>COPII vesicle</b> buds from the ER and carries the folded protein to the cis face of the Golgi.",
      "Golgi enzymes edit its sugars from cis to trans, and the trans-Golgi network packs it into a <b>secretory vesicle</b>.",
      "The secretory vesicle fuses with the plasma membrane and releases the protein <b>outside the cell</b> by exocytosis."],
    "plasma membrane": ["A ribosome on the rough ER makes a membrane protein; a hydrophobic stretch stops transfer and anchors it in the <b>ER membrane</b>.",
      "It stays in the ER membrane while its lumen-side domain folds and picks up a <b>sugar chain</b>.",
      "A <b>COPII vesicle</b> carries it, still in the membrane, to the cis Golgi, its lumen-side domain inside the vesicle.",
      "The Golgi finishes its sugars and the trans-Golgi network ships it in the membrane of a vesicle bound for the surface.",
      "When the vesicle fuses, the protein becomes part of the <b>plasma membrane</b>, and its lumen-side domain now faces outside."],
    lysosome: ["A ribosome on the rough ER threads a lysosomal enzyme into the ER lumen, exactly as it would a secreted protein.",
      "In the ER the enzyme folds and gets a high-mannose <b>sugar chain</b>.",
      "A <b>COPII vesicle</b> carries it to the cis face of the Golgi with the rest of the secretory cargo.",
      "In the Golgi its sugar gains a <b>mannose-6-phosphate</b> tag, and M6P receptors in the trans-Golgi network pull it into clathrin-coated vesicles.",
      "The vesicles reach endosomes that mature into lysosomes; the acid pH frees the enzyme from its receptor and it now works in the <b>lysosome</b>."]
  };
  var N = [64, 126], ER = [52, 64, 76], GX = [196, 210, 224, 238], LY = [280, 186], VC = [163, 98];   // VC: the COPII vesicle, where the ER-Golgi gap is widest

  Viz.register("endomembrane-pathway", {
    title: "The endomembrane pathway",
    subject: "biology",
    shows: "Pick where a new protein is headed and step it through the cell: made on the rough ER, folded, carried to the Golgi in a COPII vesicle, edited and sorted, then secreted, put in the plasma membrane or sent to the lysosome",
    params: {
      cargo_destination: {kind: "enum", values: ["secretion", "plasma membrane", "lysosome"], default: "secretion", label: "\\text{goes to}"}
    },
    steps: ["made on the rough ER", "folded in the ER", "COPII vesicle to the Golgi", "edited and sorted in the Golgi", "delivered"],
    stepMs: 1800,
    formula: function (v) {
      var s = v.step || 1, r = ROUTE[v.cargo_destination].map(function (t, i) { return i === s - 1 ? "\\boxed{" + t + "}" : t; });
      return r.slice(0, 3).join("\\to ") + "\\newline\\to " + r.slice(3).join("\\to ");
    },
    status: function (v) { return SAY[v.cargo_destination][(v.step || 1) - 1]; },
    examples: [
      {name: "secreted protein leaves the cell", values: {cargo_destination: "secretion", step: 5}},
      {name: "membrane protein reaches the surface", values: {cargo_destination: "plasma membrane", step: 5}},
      {name: "lysosomal enzyme gets its M6P tag", values: {cargo_destination: "lysosome", step: 4}},
      {name: "lysosomal enzyme arrives", values: {cargo_destination: "lysosome", step: 5}},
      {name: "made on the rough ER", values: {cargo_destination: "plasma membrane", step: 1}}
    ],
    size: [400, 256],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, dest = v.cargo_destination, memb = dest === "plasma membrane", lyso = dest === "lysosome";
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var P = function (r, deg) { var a = deg * Math.PI / 180; return [N[0] + r * Math.cos(a), N[1] + r * Math.sin(a)]; };
      var band = function (d, col, on) { api.path(d, {stroke: col, width: 9, opacity: on ? 0.75 : 0.4}); api.path(d, {stroke: c.card, width: 3.4}); };
      // the sugar chain always points into the lumen (d), never into the cytosol
      var glycan = function (at, d, branched) {
        var t = [at[0] + d[0] * 11, at[1] + d[1] * 11];
        api.line(at, t, {color: c.c4, width: 2.4});
        api.circle(t, 3.6, {fill: c.c4});
        if (branched) api.circle([t[0] - d[1] * 7, t[1] + d[0] * 7], 3.6, {fill: c.c4});
        if (lyso && s >= 4) api.circle([t[0] + d[1] * 8, t[1] - d[0] * 8], 4.5, {fill: c.c5});   // the mannose-6-phosphate tag
      };
      // the cargo: a dot when soluble; a bar across the membrane (lumen end dotted) when it is a membrane protein.
      // out points from the lumen side to the cytosol side, d along the lumen for the sugar chain.
      var cargo = function (at, out, d) {
        var g = s >= 2;
        if (!memb) { api.circle(at, 8, {fill: c.c3}); if (g) glycan([at[0] + d[0] * 8, at[1] + d[1] * 8], d, s >= 4 && !lyso); return; }
        var lum = [at[0] - out[0] * 4, at[1] - out[1] * 4];
        api.line(lum, [at[0] + out[0] * 14, at[1] + out[1] * 14], {color: c.c3, width: 5.5});
        api.circle(lum, 5.5, {fill: c.c3});
        if (g) glycan([lum[0] + d[0] * 5.5, lum[1] + d[1] * 5.5], d, s >= 4);
      };
      // the cell, the nucleus and the rough ER wrapped around it
      api.rect(6, 8, 338, 238, {stroke: c.muted, width: 3, rx: 30});
      api.circle(N, 40, {fill: c.muted, fillOpacity: 0.08, stroke: c.muted, width: 2});
      L(N, "nucleus", c.muted, {anchor: "middle", weight: 500});
      ER.forEach(function (r) {
        var a = P(r, -70), b = P(r, 70);
        band("M " + a[0] + " " + a[1] + " A " + r + " " + r + " 0 0 1 " + b[0] + " " + b[1], c.c2, s <= 2);
        for (var d = -64; d <= 64; d += 14) api.circle(P(r + 7, d), 1.8, {fill: c.c2});
      });
      L([104, 34], "rough ER", c.c2, {anchor: "middle"});
      // the Golgi stack, cis face toward the ER, and the trans-Golgi network
      GX.forEach(function (x) { band("M " + x + " 82 Q " + (x - 16) + " 126 " + x + " 170", c.c6, s === 4); });
      api.path("M 254 88 Q 240 126 254 164", {stroke: c.c6, width: 3, dash: "8 5", opacity: s === 4 ? 1 : 0.5});
      L([217, 186], "Golgi", c.c6, {anchor: "middle"});
      // the lysosome
      api.circle(LY, 18, {fill: c.c5, fillOpacity: lyso && s === 5 ? 0.3 : 0.12, stroke: c.c5, width: 1.8});
      L([LY[0], LY[1] + 30], "lysosome", c.c5, {anchor: "middle", weight: 500});
      L([322, 24], "plasma membrane", c.muted, {anchor: "end", weight: 500});
      L([372, 236], "outside", c.muted, {anchor: "middle", weight: 500});
      // the whole route, faint, for the chosen destination
      var end = dest === "secretion" ? [331, 150] : memb ? [336, 70] : [273, 170];
      api.polyline([P(80, -25), VC, [190, 122], [216, 126], [254, 126], end], {stroke: c.faint, width: 1.4, dash: "3 5"});
      // where the protein is at this step
      if (s === 1) {
        var rb = P(87, -25), m0 = P(95, -44), m1 = P(95, -6);
        api.path("M " + m0[0] + " " + m0[1] + " A 95 95 0 0 1 " + m1[0] + " " + m1[1], {stroke: c.muted, width: 1.8});   // mRNA, read between the subunits
        api.circle(rb, 8, {fill: c.c2}); api.circle(P(99, -25), 5.5, {fill: c.c2});
        L([162, 54], "ribosome on the ER", c.c2);
        L([162, 69], "reading the mRNA", c.muted, {weight: 500});
        if (memb) cargo(P(80, -25), [Math.cos(-25 * Math.PI / 180), Math.sin(-25 * Math.PI / 180)], [0, 1]);
        else { api.polyline([P(80, -25), P(77, -19), P(74, -24), P(72, -18)], {stroke: c.c3, width: 3}); api.circle(P(72, -18), 4.5, {fill: c.c3}); }
      } else if (s === 2) {
        var a2 = -28 * Math.PI / 180;
        cargo(memb ? P(80, -28) : P(76, -28), [Math.cos(a2), Math.sin(a2)], [-Math.sin(a2), Math.cos(a2)]);
        L([144, 68], "folded, glycosylated", c.c3);
      } else if (s === 3) {
        api.circle(VC, 19, {stroke: c.c1, width: 2.2, fill: c.c1, fillOpacity: 0.08});
        cargo(memb ? [VC[0], VC[1] + 19] : [VC[0], VC[1] + 6], [0, 1], [0, -1]);
        L([VC[0], 70], "COPII", c.c1, {anchor: "middle"});
      } else if (s === 4) {
        cargo(memb ? [220, 126] : [216, 126], [1, 0], [0, 1]);
        L([262, 104], lyso ? "M6P tag" : "sugars edited", lyso ? c.c5 : c.c3);
      } else {
        if (dest === "secretion") {
          api.circle([331, 150], 13, {stroke: c.c1, width: 2.4});
          api.rect(339, 142, 12, 16, {fill: c.card, rx: 0});
          [[357, 138], [370, 152], [357, 166], [382, 136]].forEach(function (q) { api.circle(q, 6, {fill: c.c3}); });
          L([370, 122], "secreted", c.c3, {anchor: "middle"});
        } else if (memb) {
          cargo([344, 70], [-1, 0], [1, 0]);
          L([322, 56], "in the membrane,", c.c3, {anchor: "end"});
          L([322, 71], "domain facing out", c.c3, {anchor: "end", weight: 500});
        } else {
          [[-4, 4, 7], [7, -6, 4], [8, 9, 4]].forEach(function (q) { api.circle([LY[0] + q[0], LY[1] + q[1]], q[2], {fill: c.c3}); });
          api.circle([262, 144], 8, {stroke: c.c1, width: 2});
          api.line([265, 154], [273, 167], {color: c.c1, width: 1.6, arrow: true});
          L([LY[0], LY[1] + 45], "enzyme arrives", c.c3, {anchor: "middle"});
        }
      }
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
