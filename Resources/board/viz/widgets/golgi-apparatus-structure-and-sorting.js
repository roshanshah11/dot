// The Golgi as a conveyor from the rough ER to three exits. Cargo leaves the ER in COPII vesicles, enters the cis
// face, passes the medial and trans cisternae, and is sorted in the trans-Golgi network (TGN). N-glycan processing in
// textbook order: the ER trims glucoses and one mannose and hands over Man8GlcNAc2; cis mannosidase I trims it to Man5; medial GlcNAc-TI, mannosidase II
// and GlcNAc-TII leave GlcNAc2Man3GlcNAc2; trans enzymes add galactose and sialic acid. Lysosomal hydrolases instead get
// GlcNAc-1-phosphate on a mannose in the cis Golgi (phosphotransferase), stay high-mannose, and the TGN's uncovering
// enzyme exposes mannose-6-phosphate, which M6P receptors carry in clathrin-coated vesicles to endosomes and lysosomes.
// ER residents end in KDEL: the KDEL receptor grabs them in the (slightly acidic) cis Golgi and COPI vesicles bring
// them back; the neutral ER releases them and the receptor cycles forward again.
(function () {
  var CX = [106, 146, 186, 226], MID = 128;               // cis, medial, trans, TGN centre lines; cargo height
  var GLY = {                                               // glycan arms after the core GlcNAc-GlcNAc-Man
    man8: {up: "mmm", down: "m", a: "m", b: "mm"}, man5: {up: "m", down: "m", a: "m", b: "m"},
    medial: {up: "mn", down: "mn"}, complex: {up: "mngs", down: "mngs"},
    lysoP: {up: "mmmPn", down: "m", a: "m", b: "mm"}, m6p: {up: "mmmP", down: "m", a: "m", b: "mm"}
  };
  var STATE = {secreted: ["man8", "man5", "medial", "complex", "complex"], lysosomal: ["man8", "lysoP", "lysoP", "lysoP", "m6p"]};
  STATE.membrane = STATE.secreted;
  var NOTE = {
    man8: ["high-mannose glycan from the ER", "8 mannoses on a GlcNAc₂ core"], man5: ["mannosidase I trims", "8 mannoses down to 5"],
    medial: ["GlcNAc added, 2 mannoses removed", "branches ready to extend"], complex: ["galactose and sialic acid added", "a finished complex glycan"],
    lysoP: ["GlcNAc-phosphate on a mannose", "the tag is still covered"], m6p: ["uncovering enzyme removes GlcNAc", "mannose-6-phosphate exposed"]
  };
  var ROUTE = {
    secreted: ["\\text{ER}", "\\text{cis}", "\\text{medial}", "\\text{trans}", "\\text{TGN}\\to\\text{outside}"],
    membrane: ["\\text{ER}", "\\text{cis}", "\\text{medial}", "\\text{trans}", "\\text{TGN}\\to\\text{membrane}"],
    lysosomal: ["\\text{ER}", "\\text{cis (+P)}", "\\text{medial}", "\\text{trans}", "\\text{TGN}\\xrightarrow{\\text{M6P}}\\text{lysosome}"],
    resident: ["\\text{ER}", "\\text{cis (KDEL-R)}", "\\text{COPI}", "\\text{ER}", "\\text{receptor}\\to\\text{cis}"]
  };
  var SAY = {
    secreted: ["A new secretory protein, carrying an <b>8-mannose</b> glycan from the ER, buds off in a <b>COPII</b> vesicle toward the cis face.",
      "In the <b>cis</b> cisterna mannosidase I trims its glycan from eight mannoses to <b>five</b>.",
      "In the <b>medial</b> cisterna GlcNAc transferases add <b>GlcNAc</b> while mannosidase II removes two more mannoses.",
      "In the <b>trans</b> cisterna <b>galactose</b> and <b>sialic acid</b> cap both branches, finishing a complex glycan.",
      "The <b>TGN</b> packs it into a secretory vesicle that fuses with the plasma membrane and releases it <b>outside the cell</b>."],
    membrane: ["A new membrane protein, anchored in the ER membrane with an <b>8-mannose</b> glycan, buds off in a <b>COPII</b> vesicle.",
      "In the <b>cis</b> cisterna mannosidase I trims its glycan from eight mannoses to <b>five</b>, on the lumen side.",
      "In the <b>medial</b> cisterna GlcNAc transferases add <b>GlcNAc</b> while mannosidase II removes two more mannoses.",
      "In the <b>trans</b> cisterna <b>galactose</b> and <b>sialic acid</b> finish the glycan, still facing the lumen.",
      "The TGN ships it in a vesicle's membrane; when the vesicle fuses the protein stays <b>in the plasma membrane</b>, its glycan now facing out."],
    lysosomal: ["A lysosomal enzyme leaves the ER with an <b>8-mannose</b> glycan in a <b>COPII</b> vesicle.",
      "In the <b>cis</b> Golgi phosphotransferase recognises the folded enzyme and adds <b>GlcNAc-phosphate</b> to a mannose.",
      "The tagged glycan mostly <b>stays high-mannose</b> as it passes the medial cisterna.",
      "It crosses the <b>trans</b> cisterna with its phosphate tag still covered by GlcNAc.",
      "In the TGN the uncovering enzyme exposes <b>mannose-6-phosphate</b>; M6P receptors pull it into clathrin-coated vesicles bound for the <b>lysosome</b>."],
    resident: ["An ER-resident protein such as BiP sometimes escapes in a <b>COPII</b> vesicle with the bulk flow.",
      "In the cis Golgi its C-terminal <b>KDEL</b> signal is caught by the KDEL receptor.",
      "A <b>COPI</b> vesicle carries the receptor and its passenger back toward the ER while other cargo moves on.",
      "In the neutral ER the receptor lets go: the protein is <b>home</b> and never reaches the trans cisterna.",
      "The empty receptor rides forward again to catch the next escapee while the protein <b>stays in the ER</b>."]
  };

  Viz.register("golgi-apparatus-structure-and-sorting", {
    title: "Golgi apparatus: processing and sorting",
    subject: "biology",
    shows: "Pick a cargo and step it through: COPII vesicles bring it from the ER to the cis face, each cisterna edits its sugar chain, and the trans-Golgi network sends it out of the cell, into the membrane or to the lysosome, while ER proteins with KDEL are sent back",
    params: {
      cargo: {kind: "enum", values: ["secreted", "membrane", "lysosomal", "resident"], names: {resident: "ER resident"}, default: "secreted", label: "\\text{cargo}"}
    },
    // generic stop names: the ER-resident path turns back after the cis Golgi, so the bar must not promise medial/trans
    steps: ["leave the ER", "cis Golgi", "onward or back", "next stop", "destination"],
    stepMs: 1800,
    formula: function (v) {
      var s = v.step || 1, r = ROUTE[v.cargo].map(function (t, i) { return i === s - 1 ? "\\boxed{" + t + "}" : t; });
      return r.slice(0, 3).join("\\to ") + "\\newline\\to " + r.slice(3).join("\\to ");
    },
    status: function (v) { return SAY[v.cargo][(v.step || 1) - 1]; },
    examples: [
      {name: "secreted protein leaves the cell", values: {cargo: "secreted", step: 5}},
      {name: "membrane protein reaches the surface", values: {cargo: "membrane", step: 5}},
      {name: "lysosomal enzyme gets its tag", values: {cargo: "lysosomal", step: 2}},
      {name: "lysosomal enzyme reaches the lysosome", values: {cargo: "lysosomal", step: 5}},
      {name: "KDEL protein sent back", values: {cargo: "resident", step: 3}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, cg = v.cargo, res = cg === "resident";
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // rough ER: three sheets studded with ribosomes
      for (var i = 0; i < 3; i++) {
        api.rect(14 + i * 16, 44, 9, 166, {fill: c.c2, fillOpacity: s === 1 || (res && s >= 4) ? 0.4 : 0.2, stroke: c.c2, width: 1.2, rx: 4.5});
        for (var y = 50; y < 208; y += 13) api.circle([12 + i * 16, y], 1.6, {fill: c.c2});
      }
      L([37, 22], "rough ER", c.c2, {anchor: "middle", weight: s === 1 ? 700 : 500});
      // the stack: cis, medial, trans cisternae curved toward the ER, then the tubular TGN
      ["cis", "medial", "trans", "TGN"].forEach(function (name, k) {
        var x = CX[k], on = s === k + 2 && !(res && s > 2);
        if (k < 3) api.path("M " + x + " 48 Q " + (x - 18) + " " + MID + " " + x + " 208", {stroke: c.c6, width: 11, opacity: on ? 1 : 0.45});
        else {
          api.path("M " + x + " 56 Q " + (x - 14) + " " + MID + " " + x + " 200", {stroke: c.c6, width: 5, dash: "10 5", opacity: on ? 1 : 0.5});
          [70, 104, 160, 190].forEach(function (yy) { api.circle([x + 8, yy], 4, {stroke: c.c6, width: 1.4, opacity: on ? 1 : 0.5}); });
        }
        L([x, 22], name, c.c6, {anchor: "middle", weight: on ? 700 : 500});
      });
      // the plasma membrane on the right, the lysosome above the exits
      api.rect(352, 34, 7, 182, {fill: c.muted, fillOpacity: 0.4, rx: 3});
      L([392, 221], "plasma membrane", c.muted, {anchor: "end", weight: 500});
      api.circle([296, 62], 19, {fill: c.c5, fillOpacity: cg === "lysosomal" ? 0.3 : 0.12, stroke: c.c5, width: 1.6});
      L([296, 30], "lysosome", c.c5, {anchor: "middle", weight: 500});
      // the three exits from the TGN; the chosen cargo's exit is drawn solid
      var exits = {lysosomal: [[238, 96], [279, 73], "M6P receptor", [264, 100]], secreted: [[240, 140], [346, 140], "secretory vesicle", [240, 124]],
                   membrane: [[240, 182], [346, 182], "to the membrane", [240, 166]]};
      Object.keys(exits).forEach(function (k) {
        var e = exits[k], mine = k === cg;
        api.line(e[0], e[1], {color: mine ? c.c3 : c.faint, width: mine ? 2 : 1.3, dash: mine && s === 5 ? null : "4 4", arrow: true});
        L(e[3], e[2], mine ? c.c3 : c.muted, {weight: mine ? 600 : 500});
      });
      // COPI retrieval arc from cis back to the ER (solid for the KDEL cargo)
      api.path("M 96 86 Q 78 60 60 84", {stroke: res ? c.c1 : c.faint, width: res ? 2 : 1.3, dash: res ? null : "4 4", arrow: true});
      L(res && s === 3 ? [70, 112] : [78, 98], "COPI", res ? c.c1 : c.muted, {anchor: "middle", weight: 500});   // clear of the step-3 vesicle
      // the cargo itself
      var cargoAt = function (p) {
        if (cg === "membrane") api.rect(p[0] - 8, p[1] - 3, 16, 6, {fill: c.c3, rx: 2});
        else api.circle(p, 5.5, {fill: c.c3});
        if (cg === "lysosomal" && s >= 2) L([p[0] + 8, p[1] - 9], "P", c.ink, {size: 12, weight: 700});
      };
      var vesicle = function (p, label) { api.circle(p, 11, {stroke: c.c1, width: 2, fill: c.c1, fillOpacity: 0.08}); if (label) L([p[0], p[1] + 22], label, c.c1, {anchor: "middle", weight: 500}); };
      var receptor = function (p) { api.rect(p[0] - 2, p[1] - 9, 4, 13, {fill: c.ink, rx: 1.5}); api.circle([p[0], p[1] - 10], 3, {stroke: c.ink, width: 1.5}); };
      if (res) {
        if (s === 1) { vesicle([80, MID], "COPII"); cargoAt([80, MID]); }
        if (s === 2) { cargoAt([CX[0] - 7, MID - 6]); receptor([CX[0] - 7, MID + 12]); L([CX[0] + 6, MID + 30], "KDEL receptor", c.ink, {weight: 500}); }
        if (s === 3) { vesicle([92, 90]); cargoAt([88, 87]); receptor([97, 98]); }   // buds at the start of the arc, arc stays visible
        if (s >= 4) cargoAt([39, MID + 30]);
        if (s === 4) receptor([39, MID + 52]);
        if (s === 5) { vesicle([80, MID], "COPII"); receptor([80, MID + 5]); L([39, 220], "stays", c.c3, {anchor: "middle"}); }
      } else if (s === 1) { vesicle([80, MID], "COPII"); cargoAt([80, MID]); }
      else if (s <= 4) cargoAt([CX[s - 2] - 9, MID]);
      else if (cg === "lysosomal") { cargoAt([296, 62]); vesicle([256, 86]); }
      else if (cg === "secreted") { api.path("M 351 131 A 10 10 0 1 0 351 149", {stroke: c.c1, width: 2}); cargoAt([378, 140]); L([380, 160], "outside", c.c3, {anchor: "middle", weight: 500}); }
      else { api.rect(348, 179, 15, 6, {fill: c.c3, rx: 2}); api.path("M 351 172 A 10 10 0 1 0 351 192", {stroke: c.c1, width: 2}); L([344, 200], "in membrane", c.c3, {anchor: "end"}); }
      // the zoom strip: the cargo's sugar chain (or its KDEL tail) at this step
      api.rect(6, 228, 388, 68, {stroke: c.faint, width: 1, rx: 8});
      var gx = 14, gy = 258;
      api.rect(gx, gy - 8, 22, 16, {fill: c.c3, rx: 5});
      var sym = function (k, p) {
        if (k === "n") api.rect(p[0] - 4.5, p[1] - 4.5, 9, 9, {fill: c.c4, rx: 1});
        else if (k === "m") api.circle(p, 4.5, {fill: c.c4});
        else if (k === "g") api.circle(p, 4, {stroke: c.c4, width: 1.8});
        else if (k === "s") api.polygon([[p[0], p[1] - 5.5], [p[0] + 5.5, p[1]], [p[0], p[1] + 5.5], [p[0] - 5.5, p[1]]], {fill: c.c4, fillOpacity: 1});
        else L(p, "P", c.ink, {anchor: "middle", weight: 700});
      };
      var chain = function (str, x0, y0, x1, y1) {
        for (var j = 0; j < str.length; j++) {
          var p = [x0 + (j + 1) * 13, y1];
          api.line(j ? [p[0] - 13, y1] : [x0, y0], p, {color: c.c4, width: 1.3});
          sym(str[j], p);
        }
      };
      if (res) {
        api.line([gx + 22, gy], [gx + 40, gy], {color: c.c3, width: 2});
        L([gx + 44, gy], "–KDEL", c.c3, {weight: 700});
        L([150, 248], s === 2 || s === 3 ? "KDEL is bound by its receptor" : s === 1 ? "an escaped ER protein" : s === 4 ? "released in the neutral ER" : "the protein stays in the ER", c.ink);
        L([150, 266], "retrieval signal at the C-terminus", c.muted, {weight: 500});
      } else {
        var g = GLY[STATE[cg][s - 1]];
        api.line([gx + 22, gy], [gx + 30, gy], {color: c.c4, width: 1.3});
        ["n", "n", "m"].forEach(function (k, j) { if (j) api.line([gx + 30 + (j - 1) * 13, gy], [gx + 30 + j * 13, gy], {color: c.c4, width: 1.3}); sym(k, [gx + 30 + j * 13, gy]); });
        var bx = gx + 56;
        chain(g.up, bx, gy, bx, gy - 13);
        chain(g.down, bx, gy, bx, gy + 9);
        if (g.a) { chain(g.a, bx + 13, gy + 9, bx + 13, gy + 2); chain(g.b, bx + 13, gy + 9, bx + 13, gy + 22); }
        var note = NOTE[STATE[cg][s - 1]];
        L([150, 244], note[0], c.ink);
        L([150, 260], note[1], c.muted, {weight: 500});
        [["n", "GlcNAc"], ["m", "Man"], ["g", "Gal"], ["s", "Sia"]].forEach(function (q, j) { sym(q[0], [154 + j * 62, 280]); L([162 + j * 62, 280], q[1], c.c4, {weight: 500}); });
      }
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
