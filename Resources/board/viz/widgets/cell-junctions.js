// The five junctions of an epithelium as molecular stacks. Left: where each one sits on two neighbouring cells, from
// the apical tight junction down to hemidesmosomes on the basal lamina. Right: the chosen junction taken apart into
// its layers (cytoskeleton, adaptor, the protein that crosses the gap) drawn with the real gap width between the two
// membranes (about 20 nm adherens, 30 nm desmosome, 2-4 nm gap junction), and below, its class and its job.
// Colors: teal = the protein across the gap, purple = adaptor or plaque, red = actin, amber = keratin
// intermediate filaments, blue = what passes through a channel, green = the basal lamina.
(function () {
  var J = {
    "tight junction": {short: "tight", cls: 0, gapNm: "≈ 0 nm: sealed", gapPx: 10, links: "cell–cell", y: 42,
      across: "claudin, occludin", adaptor: "ZO-1", cyto: "actin",
      job: "seals the space between cells",
      tex: "\\text{claudin, occludin}\\to\\text{ZO-1}\\to\\text{actin}",
      status: "<b>Tight junctions</b> ring the very top of the cell: claudin and occludin strands from both cells fuse, so the lumen cannot leak between cells and membrane proteins cannot drift between the apical and basal faces."},
    "adherens junction": {short: "adherens", cls: 1, gapNm: "≈ 20 nm", gapPx: 26, links: "cell–cell", y: 58,
      across: "E-cadherin (Ca²⁺)", adaptor: "catenins", cyto: "actin",
      job: "holds cells together via an actin belt",
      tex: "\\text{E-cadherin}\\,(\\text{Ca}^{2+})\\to\\text{catenins}\\to\\text{actin}",
      status: "<b>Adherens junctions</b> join E-cadherins of neighbouring cells across a 20 nm gap (they need Ca²⁺) and tie them through catenins to a belt of actin, holding the sheet together."},
    "desmosome": {short: "desmosome", cls: 1, gapNm: "≈ 30 nm", gapPx: 36, links: "cell–cell", y: 92,
      across: "desmoglein, desmocollin", adaptor: "plaque", cyto: "keratin",
      job: "spot weld: spreads pulling force",
      tex: "\\text{desmoglein, desmocollin}\\to\\newline\\text{plakoglobin, desmoplakin}\\to\\text{keratin}",
      status: "<b>Desmosomes</b> are spot welds: desmosomal cadherins clamp the cells across a 30 nm gap and dense plaques tie them to keratin filaments, so a pull on one cell is spread through the whole sheet."},
    "gap junction": {short: "gap", cls: 2, gapNm: "2–4 nm", gapPx: 6, links: "cytoplasm–cytoplasm", y: 132,
      across: "connexons", adaptor: "", cyto: "",
      job: "passes ions and molecules under ≈ 1 kDa",
      tex: "6\\ \\text{connexins}=1\\ \\text{connexon}\\newline 2\\ \\text{connexons}=1\\ \\text{channel}",
      status: "<b>Gap junctions</b> are channels: a connexon from each cell docks across a 2–4 nm gap, joining the two cytoplasms so ions, sugars and cAMP pass (heart cells beat together this way) while proteins cannot."},
    "hemidesmosome": {short: "hemi", cls: 1, gapNm: "", gapPx: 0, links: "cell–basal lamina", y: 232,
      across: "integrin α₆β₄", adaptor: "plectin, BP230", cyto: "keratin",
      job: "anchors the cell to the basal lamina",
      tex: "\\text{laminin-332}\\leftarrow\\text{integrin }\\alpha_6\\beta_4\\newline\\to\\text{plectin, BP230}\\to\\text{keratin}",
      status: "<b>Hemidesmosomes</b> anchor the base of the cell, not a neighbour: integrin α6β4 grips laminin in the basal lamina outside and plectin ties it to keratin filaments inside."}
  };
  var CLASSES = ["occluding", "anchoring", "communicating"];
  Viz.register("cell-junctions", {
    title: "Cell junctions, layer by layer",
    subject: "biology",
    shows: "Pick a junction: see where it sits on the cell, what crosses the gap, what it grips inside, and whether it seals, anchors or lets molecules through",
    params: {
      initial_junction: {kind: "enum", values: Object.keys(J), default: "tight junction", label: "\\text{junction}",
        names: {"tight junction": "tight", "adherens junction": "adherens", "desmosome": "desmosome", "gap junction": "gap", "hemidesmosome": "hemidesmosome"}}
    },
    formula: function (v) { return J[v.initial_junction].tex; },
    status: function (v) { return J[v.initial_junction].status; },
    examples: Object.keys(J).map(function (k) { return {name: k, values: {initial_junction: k}}; }),
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, key = v.initial_junction, I = J[key];
      // ---- where: two neighbouring cells, apical up ----
      api.label([64, 12], "apical", {color: c.muted, size: 12, anchor: "middle"});
      [14, 66].forEach(function (x) {
        for (var m = x + 5; m < x + 46; m += 8) api.line([m, 34], [m, 25], {color: c.ink, width: 3, opacity: 0.25});
        api.rect(x, 34, 48, 196, {fill: c.ink, fillOpacity: 0.04, stroke: c.ink, width: 1.3, rx: 6, opacity: 0.8});
        api.circle([x + 24, 186], 12, {stroke: c.muted, width: 1, fill: c.ink, fillOpacity: 0.05});
      });
      api.rect(8, 234, 112, 6, {fill: c.c4, fillOpacity: 0.55, rx: 3});
      api.label([64, 252], "basal lamina", {color: c.c4, size: 12, anchor: "middle"});
      var col = function (k) { return k === key ? c.ink : c.muted; }, op = function (k) { return k === key ? 1 : 0.55; };
      [38, 42, 46].forEach(function (y) { api.line([60, y], [68, y], {color: col("tight junction"), width: 1.6, opacity: op("tight junction")}); });
      api.rect(59, 55, 10, 7, {fill: col("adherens junction"), rx: 2, opacity: op("adherens junction")});
      api.rect(57, 84, 4, 16, {fill: col("desmosome"), rx: 1, opacity: op("desmosome")}); api.rect(67, 84, 4, 16, {fill: col("desmosome"), rx: 1, opacity: op("desmosome")});
      [126, 132, 138].forEach(function (y) { api.rect(60, y - 2, 8, 4, {fill: col("gap junction"), rx: 1, opacity: op("gap junction")}); });
      [[26, 42], [78, 94]].forEach(function (q) { api.rect(q[0], 229, q[1] - q[0], 4, {fill: col("hemidesmosome"), rx: 1, opacity: op("hemidesmosome")}); });
      var box = key === "hemidesmosome" ? [20, 222, 80, 16] : [52, I.y - 13, 24, 26];
      api.rect(box[0], box[1], box[2], box[3], {stroke: c.ink, width: 1.4, dash: "3 3", rx: 4});
      api.line([box[0] + box[2], box[1] + box[3] / 2], [132, 110], {color: c.ink, width: 1, dash: "2 3", opacity: 0.45});
      // ---- the close-up stack ----
      var L = 134, R = 394, T = 22, B = 204, xm = 264;
      api.rect(L, T, R - L, B - T, {stroke: c.faint, width: 1, rx: 10});
      api.label([xm, 11], key.charAt(0).toUpperCase() + key.slice(1), {color: c.ink, size: 13.5, weight: 700, anchor: "middle"});
      var keratin = function (x0, xp, ys) {   // hairpin loops of intermediate filament reaching from x0 to the plaque at xp
        ys.forEach(function (y) { api.path("M " + x0 + " " + (y - 26) + " C " + (xp + (xp - x0) * 0.25) + " " + (y - 26) + " " + (xp + (xp - x0) * 0.25) + " " + (y + 26) + " " + x0 + " " + (y + 26), {stroke: c.c3, width: 1.8}); });
      };
      if (key !== "hemidesmosome") {
        var g = I.gapPx, x1 = xm - g / 2, x2 = xm + g / 2, y0 = T + 34, y1 = B - 22;
        [x1 - 5, x1, x2, x2 + 5].forEach(function (x) { api.line([x, y0], [x, y1], {color: c.ink, width: 1.4, opacity: 0.75}); });
        api.label([L + 8, T + 12], "cell 1", {color: c.muted, size: 12}); api.label([R - 8, T + 12], "cell 2", {color: c.muted, size: 12, anchor: "end"});
        api.label([xm, T + 12], I.across, {color: c.c1, size: 12, weight: 650, anchor: "middle"});
        if (key === "tight junction") {
          [64, 88, 112, 136, 160].forEach(function (y) {
            api.circle([xm - 4, y], 5, {fill: c.c1}); api.circle([xm + 4, y], 5, {fill: c.c1});
            api.circle([x1 - 13, y], 4, {fill: c.c6}); api.circle([x2 + 13, y], 4, {fill: c.c6});
          });
          [x1 - 26, x1 - 32, x2 + 26, x2 + 32].forEach(function (x) { api.line([x, y0 + 4], [x, y1 - 4], {color: c.c5, width: 1.8, opacity: 0.85}); });
          api.label([R - 8, B - 10], "membranes touch at strands", {color: c.muted, size: 12, anchor: "end"});
        } else if (key === "adherens junction" || key === "desmosome") {
          var des = key === "desmosome", ys = des ? [86, 98, 110, 122, 134, 146] : [66, 86, 106, 126, 146, 166];
          ys.forEach(function (y) {   // cadherins from both membranes meet and overlap in the middle of the gap
            api.line([x1, y], [xm + 4, y], {color: c.c1, width: 2.2}); api.circle([xm + 4, y], 2.8, {fill: c.c1});
            api.line([x2, y + 6], [xm - 4, y + 6], {color: c.c1, width: 2.2}); api.circle([xm - 4, y + 6], 2.8, {fill: c.c1});
          });
          if (des) {
            api.rect(x1 - 19, 78, 12, 84, {fill: c.c6, fillOpacity: 0.85, rx: 3}); api.rect(x2 + 7, 78, 12, 84, {fill: c.c6, fillOpacity: 0.85, rx: 3});
            keratin(L + 14, x1 - 19, [102, 140]); keratin(R - 14, x2 + 19, [102, 140]);
          } else {
            ys.forEach(function (y) { api.circle([x1 - 12, y + 3], 4, {fill: c.c6}); api.circle([x2 + 12, y + 3], 4, {fill: c.c6}); });
            [x1 - 24, x1 - 30, x1 - 36, x2 + 24, x2 + 30, x2 + 36].forEach(function (x) { api.line([x, y0 + 4], [x, y1 - 4], {color: c.c5, width: 1.8, opacity: 0.85}); });
          }
        } else {
          [74, 118, 162].forEach(function (y) {   // two docked connexons per channel, pore through the middle
            api.rect(x1 - 12, y - 10, 13, 20, {fill: c.c1, fillOpacity: 0.85, rx: 4}); api.rect(x2 - 1, y - 10, 13, 20, {fill: c.c1, fillOpacity: 0.85, rx: 4});
            api.line([x1 - 12, y], [x2 + 12, y], {color: c.card, width: 3});
          });
          [74, 162].forEach(function (y) { api.arrow([xm - 70, y], [xm + 70, y], {color: c.c2, width: 1.6, halo: false, head: 8}); });
          [[188, 62], [204, 86], [318, 150], [334, 176], [170, 96]].forEach(function (q) { api.circle(q, 3, {fill: c.c2}); });
          api.circle([196, 118], 12, {fill: c.c5, fillOpacity: 0.2, stroke: c.c5, width: 1.4});
          api.label([L + 8, B - 10], "protein: too big", {color: c.c5, size: 12});
          api.label([R - 8, 118], "ions, cAMP", {color: c.c2, size: 12, anchor: "end"});
        }
        if (I.cyto) api.label([L + 8, T + 28], I.cyto, {color: I.cyto === "actin" ? c.c5 : c.c3, size: 12, weight: 650});
        if (I.adaptor) api.label([L + 8, B - 10], I.adaptor, {color: c.c6, size: 12, weight: 650});
        if (key !== "tight junction") {
          api.line([x1, B - 24], [x2, B - 24], {color: c.muted, width: 1});
          api.label([x2 + 8, B - 22], "gap " + I.gapNm, {color: c.muted, size: 12});
        }
      } else {
        var mY = 124, lam = 158;
        api.label([R - 8, T + 12], "cell", {color: c.muted, size: 12, anchor: "end"});
        [mY, mY + 5].forEach(function (y) { api.line([L + 10, y], [R - 10, y], {color: c.ink, width: 1.4, opacity: 0.75}); });
        api.rect(238, mY - 13, 116, 10, {fill: c.c6, fillOpacity: 0.85, rx: 3});
        [250, 272, 294, 316, 338].forEach(function (x) { api.line([x, mY - 3], [x, lam], {color: c.c1, width: 2.4}); api.circle([x, lam], 3.5, {fill: c.c1}); });
        [258, 296, 334].forEach(function (x) { api.path("M " + (x - 18) + " " + (T + 20) + " C " + (x - 18) + " " + (mY - 4) + " " + (x + 18) + " " + (mY - 4) + " " + (x + 18) + " " + (T + 20), {stroke: c.c3, width: 1.8}); });
        api.rect(L + 6, lam, R - L - 12, 18, {fill: c.c4, fillOpacity: 0.45, rx: 3});
        api.label([L + 8, T + 28], "keratin", {color: c.c3, size: 12, weight: 650});
        api.label([L + 8, mY - 8], "plectin, BP230", {color: c.c6, size: 12, weight: 650});
        api.label([L + 8, mY + 20], "integrin α₆β₄", {color: c.c1, size: 12, weight: 650});
        api.label([xm, B - 12], "basal lamina (laminin-332)", {color: c.c4, size: 12, anchor: "middle"});
      }
      // ---- class and job ----
      var cws = [76, 76, 100];
      CLASSES.forEach(function (name, i) {
        var on = i === I.cls, cw = cws[i], x = L + (i ? cws[0] + 4 : 0) + (i > 1 ? cws[1] + 4 : 0);
        api.rect(x, 216, cw, 22, {fill: c.ink, fillOpacity: on ? 0.16 : 0.03, stroke: on ? c.ink : c.faint, width: on ? 1.5 : 1, rx: 11});
        api.label([x + cw / 2, 227], name, {color: on ? c.ink : c.muted, size: 12, weight: on ? 700 : 500, anchor: "middle"});
      });
      api.label([L, 256], "links " + I.links, {color: c.muted, size: 12});
      api.label([L, 276], I.job, {color: c.ink, size: 12.5, weight: 600});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
