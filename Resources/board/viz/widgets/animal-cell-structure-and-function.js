// An animal cell and what each organelle does. Pick an organelle to light it up; pick a cell type to see structure
// follow function: a pancreatic acinar cell that exports enzymes is crowded with rough ER, Golgi and secretory
// granules, a heart muscle cell with mitochondria, a liver cell with smooth ER and peroxisomes, a macrophage with
// lysosomes. Counts are illustrative, not measured. Mitochondria, lysosomes, peroxisomes, granules and free ribosomes
// are placed by a fixed low-discrepancy (Halton) scan of the cytoplasm, skipping anything they would overlap.
(function () {
  var TYPES = {
    typical: {mito: 5, lyso: 3, perox: 2, rer: 3, ser: 1, golgi: 4, gran: 2},
    secretory: {mito: 4, lyso: 2, perox: 1, rer: 6, ser: 1, golgi: 5, gran: 9},
    "heart muscle": {mito: 11, lyso: 2, perox: 1, rer: 2, ser: 1, golgi: 3, gran: 0},
    liver: {mito: 7, lyso: 3, perox: 5, rer: 4, ser: 2, golgi: 4, gran: 2},
    macrophage: {mito: 4, lyso: 9, perox: 1, rer: 3, ser: 1, golgi: 4, gran: 0}
  };
  var JOB = {
    nucleus: ["\\text{DNA}\\xrightarrow{\\text{transcription}}\\text{mRNA}\\newline\\qquad\\to\\text{out through the pores}", "holds the DNA: genes are copied into mRNA here and leave through the nuclear pores, and the nucleolus builds ribosomes"],
    "rough ER": ["\\text{mRNA}+\\text{ribosome}\\to\\text{protein}\\newline\\qquad\\to\\text{folded inside the ER}", "is studded with ribosomes making proteins for export and for membranes, which fold inside it"],
    "smooth ER": ["\\text{lipids, steroids};\\ \\text{Ca}^{2+}\\ \\text{store};\\ \\text{detox}", "makes lipids and steroids, stores Ca²⁺ and breaks down drugs"],
    Golgi: ["\\text{ER}\\to\\text{cis face}\\to\\text{trans face}\\to\\text{vesicles}", "modifies, sorts and ships the ER's proteins in vesicles"],
    mitochondria: ["\\text{C}_6\\text{H}_{12}\\text{O}_6+6\\,\\text{O}_2\\to 6\\,\\text{CO}_2+6\\,\\text{H}_2\\text{O}\\newline\\qquad+\\approx 30\\ \\text{ATP}", "make most of the cell's ATP by aerobic respiration on their folded inner membranes"],
    lysosomes: ["\\text{polymers}\\xrightarrow{\\text{hydrolases, pH}\\,\\approx\\,5}\\text{monomers}", "digest worn-out parts and engulfed material with acid enzymes"],
    peroxisomes: ["2\\,\\text{H}_2\\text{O}_2\\xrightarrow{\\text{catalase}}2\\,\\text{H}_2\\text{O}+\\text{O}_2", "break down fatty acids and toxins, making hydrogen peroxide and destroying it with catalase"],
    ribosomes: ["\\text{mRNA}\\to\\text{amino acids joined into a protein}", "read mRNA and build proteins: free ones for the cytosol, ER-bound ones for export"],
    centrosome: ["2\\ \\text{centrioles}\\to\\text{microtubules}\\newline\\qquad\\to\\text{spindle poles}", "organizes the microtubules and forms the spindle poles when the cell divides"],
    membrane: ["\\text{phospholipid bilayer}+\\text{proteins}\\newline\\qquad=\\text{selective barrier}", "controls what enters and leaves and carries the receptors for signals"]
  };
  var FIT = {"rough ER|secretory": "a pancreatic cell exporting digestive enzymes is crowded with it", "Golgi|secretory": "here it packs enzymes into secretory granules",
             "mitochondria|heart muscle": "heart muscle, which never rests, is packed with them", "smooth ER|liver": "liver cells carry extra to detoxify the blood",
             "smooth ER|heart muscle": "in muscle it is the sarcoplasmic reticulum, releasing Ca²⁺ for every beat", "peroxisomes|liver": "liver cells are rich in them",
             "lysosomes|macrophage": "a macrophage that eats bacteria is full of them"};
  function halton(i, b) { var f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }

  Viz.register("animal-cell-structure-and-function", {
    title: "Animal cell: organelles and their jobs",
    subject: "biology",
    shows: "Pick an organelle to see where it sits and what it does; switch the cell type to see structure follow function, from enzyme-exporting pancreas cells to mitochondria-packed heart muscle",
    params: {
      part: {kind: "enum", values: Object.keys(JOB), default: "mitochondria", label: "\\text{organelle}"},
      cell: {kind: "enum", values: Object.keys(TYPES), default: "typical", label: "\\text{cell}"}
    },
    formula: function (v) { return JOB[v.part][0]; },
    status: function (v) {
      var name = v.part === "membrane" ? "The plasma membrane" : v.part === "rough ER" || v.part === "smooth ER" || v.part === "Golgi" || v.part === "centrosome" || v.part === "nucleus" ? "The " + v.part : v.part.charAt(0).toUpperCase() + v.part.slice(1);
      var fit = FIT[v.part + "|" + v.cell];
      return "<b>" + name + "</b> " + JOB[v.part][1] + (fit ? "; " + fit + "." : ".");
    },
    examples: [
      {name: "mitochondria in heart muscle", values: {part: "mitochondria", cell: "heart muscle"}},
      {name: "rough ER in a secretory cell", values: {part: "rough ER", cell: "secretory"}},
      {name: "lysosomes in a macrophage", values: {part: "lysosomes", cell: "macrophage"}},
      {name: "peroxisomes in a liver cell", values: {part: "peroxisomes", cell: "liver"}},
      {name: "nucleus", values: {part: "nucleus", cell: "typical"}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, T = TYPES[v.cell], P = v.part, cx = 200, cy = 172, rx = 182, ry = 136, N = [168, 178];
      var on = function (k) { return k === P; }, col = function (k) { return on(k) ? c.c1 : c.muted; }, op = function (k) { return on(k) ? 1 : 0.55; };
      api.label([12, 14], P === "membrane" ? "plasma membrane" : P, {color: c.c1, size: 14, weight: 700});
      api.label([388, 14], v.cell === "typical" ? "a typical cell" : v.cell === "secretory" ? "pancreatic (secretory) cell" : v.cell + " cell", {color: c.muted, size: 12, anchor: "end"});
      api.path("M " + (cx - rx) + " " + cy + " a " + rx + " " + ry + " 0 1 0 " + 2 * rx + " 0 a " + rx + " " + ry + " 0 1 0 " + -2 * rx + " 0",
        {stroke: col("membrane"), width: on("membrane") ? 3.5 : 2, fill: c.ink, fillOpacity: 0.03});
      // smooth ER: wavy tubes, lower right
      var serBox = [262, 218, 84 + 22 * (T.ser - 1), 46];
      for (var k = 0; k < 2 + T.ser; k++) {
        var y0 = serBox[1] + 8 + k * (36 / (1 + T.ser)), d = "M " + serBox[0] + " " + y0;
        for (var x = serBox[0]; x < serBox[0] + serBox[2] - 10; x += 14) d += " q 7 " + (k % 2 ? 7 : -7) + " 14 0";
        api.path(d, {stroke: col("smooth ER"), width: 4, opacity: op("smooth ER")});
      }
      // rough ER: sheets wrapped round the nucleus, ribosomes on the outer face
      var rerOut = 54 + 9 * (T.rer - 1);
      for (k = 0; k < T.rer; k++) {
        var r = 54 + 9 * k, a0 = -1.2, a1 = 1.2;
        api.path("M " + (N[0] + r * Math.cos(a0)) + " " + (N[1] + r * Math.sin(a0)) + " A " + r + " " + r + " 0 0 1 " + (N[0] + r * Math.cos(a1)) + " " + (N[1] + r * Math.sin(a1)),
          {stroke: col("rough ER"), width: 2.6, opacity: op("rough ER")});
        for (var a = a0 + 0.08; a < a1; a += 0.16) api.circle([N[0] + (r + 3.2) * Math.cos(a), N[1] + (r + 3.2) * Math.sin(a)], 1.4, {fill: col("ribosomes"), opacity: op("ribosomes")});
      }
      // nucleus: double envelope with pores, nucleolus
      api.circle(N, 42, {fill: c.c6, fillOpacity: on("nucleus") ? 0.18 : 0.07, stroke: col("nucleus"), width: on("nucleus") ? 2.6 : 1.6});
      api.circle(N, 37.5, {stroke: col("nucleus"), width: 1.2, opacity: op("nucleus")});
      for (a = 0; a < 6.28; a += 0.785) api.line([N[0] + 36 * Math.cos(a), N[1] + 36 * Math.sin(a)], [N[0] + 44 * Math.cos(a), N[1] + 44 * Math.sin(a)], {color: c.card, width: 3});
      api.circle([N[0] - 10, N[1] - 6], 11, {fill: col("nucleus"), fillOpacity: on("nucleus") ? 0.7 : 0.35});
      // Golgi: a stack of curved cisternae, cis face toward the ER, vesicles budding off the trans face
      for (k = 0; k < T.golgi; k++) {
        var gr = 50 + 8 * k, ga = 0.55;
        api.path("M " + (374 - gr * Math.cos(ga)) + " " + (138 - gr * Math.sin(ga)) + " A " + gr + " " + gr + " 0 0 0 " + (374 - gr * Math.cos(ga)) + " " + (138 + gr * Math.sin(ga)),
          {stroke: col("Golgi"), width: 4.5, opacity: op("Golgi")});
      }
      [[332, 96], [338, 182], [346, 110]].forEach(function (q) { api.circle(q, 3.5, {stroke: col("Golgi"), width: 1.5, opacity: op("Golgi")}); });
      // centrosome: two centrioles at right angles beside the nucleus
      var CS = [104, 112];
      api.rect(CS[0] - 7, CS[1] - 3, 14, 6, {fill: col("centrosome"), rx: 2, opacity: op("centrosome")});
      api.rect(CS[0] + 4, CS[1] - 2, 6, 14, {fill: col("centrosome"), rx: 2, opacity: op("centrosome")});
      // everything else, placed without overlaps
      var placed = [{x: N[0], y: N[1], r: rerOut + 6, sector: true}, {x: N[0], y: N[1], r: 50}, {x: CS[0] + 2, y: CS[1] + 4, r: 13}];
      var blocked = function (x, y, r) {
        if (Math.pow((x - cx) / (rx - r - 8), 2) + Math.pow((y - cy) / (ry - r - 8), 2) > 1) return true;
        if (x + r > 278 && x - r < 342 && y + r > 82 && y - r < 196) return true;                         // Golgi
        if (x + r > serBox[0] - 4 && x - r < serBox[0] + serBox[2] && y + r > serBox[1] && y - r < serBox[1] + serBox[3]) return true;
        return placed.some(function (o) { return o.sector ? x > N[0] && Math.hypot(x - o.x, y - o.y) < o.r + r : Math.hypot(x - o.x, y - o.y) < o.r + r + 3; });
      };
      var idx = 1, put = function (n, r, drawOne) {
        for (var i = 0, tries = 0; i < n && tries < 600; tries++, idx++) {
          var x = cx - rx + 2 * rx * halton(idx, 2), y = cy - ry + 2 * ry * halton(idx, 3);
          if (!blocked(x, y, r)) { placed.push({x: x, y: y, r: r}); drawOne([x, y], i); i++; }
        }
      };
      put(T.mito, 14, function (q, i) {
        var g = api.group({transform: "rotate(" + ((i * 53) % 180 - 90) + " " + q[0] + " " + q[1] + ")", opacity: op("mitochondria")});
        api.rect(q[0] - 14, q[1] - 7, 28, 14, {rx: 7, stroke: col("mitochondria"), width: 1.8, fill: c.c5, fillOpacity: on("mitochondria") ? 0.18 : 0.06, parent: g});
        api.path("M " + (q[0] - 9) + " " + (q[1] + 5) + " l 3 -9 l 3 9 l 3 -9 l 3 9 l 3 -9 l 3 9", {stroke: col("mitochondria"), width: 1.2, parent: g});
      });
      put(T.lyso, 8, function (q) {
        api.circle(q, 7.5, {fill: c.c4, fillOpacity: on("lysosomes") ? 0.3 : 0.08, stroke: col("lysosomes"), width: 1.6, opacity: op("lysosomes")});
        api.circle([q[0] - 2, q[1] - 1], 1.4, {fill: col("lysosomes"), opacity: op("lysosomes")}); api.circle([q[0] + 2.5, q[1] + 2], 1.4, {fill: col("lysosomes"), opacity: op("lysosomes")});
      });
      put(T.perox, 7, function (q) {
        api.circle(q, 6, {stroke: col("peroxisomes"), width: 1.5, opacity: op("peroxisomes")});
        api.rect(q[0] - 2.5, q[1] - 2.5, 5, 5, {fill: col("peroxisomes"), rx: 1, opacity: op("peroxisomes")});
      });
      put(T.gran, 7, function (q) { api.circle(q, 6, {fill: col("Golgi"), fillOpacity: on("Golgi") ? 0.6 : 0.25, opacity: op("Golgi")}); });
      put(14, 3, function (q) { api.circle(q, 1.8, {fill: col("ribosomes"), opacity: op("ribosomes")}); });
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
