// Integrins hold a cell to the extracellular matrix. An alpha-beta heterodimer grips the RGD motif of fibronectin
// through a divalent cation (Mg2+ / Mn2+) in its head (the MIDAS site): chelate the cations with EDTA and it lets go.
// Inside-out activation: talin binding the beta tail unclasps the legs, so the integrin goes from bent-closed (low
// affinity) to extended-open (high affinity). Bound integrins cluster; talin then recruits vinculin and links the
// cluster to actin stress fibres, and FAK autophosphorylates (outside-in signalling): a focal adhesion.
// Clustering needs ligands close together: on RGD nanopatterns cells form focal adhesions at 58 nm spacing but not at
// 73 nm or more (Arnold et al. 2004), so the threshold here is 70 nm. Ligands sit on a hexagonal lattice, density
// n = 2 / (sqrt(3) d^2). The drawing is a 400 nm wide slice; vertical sizes are schematic.
Viz.register("integrin-cell-matrix-adhesion", {
  title: "Integrins: gripping the matrix",
  subject: "biology",
  shows: "Change the spacing of RGD sites on fibronectin, talin and the cations: integrins grip only when talin opens them and Mg2+ fills their metal site, and they build a focal adhesion linked to actin only when the sites are about 70 nm apart or closer",
  params: {
    d: {kind: "number", default: 50, min: 20, max: 150, step: 5, label: "d\\ (\\text{nm})"},
    talin: {kind: "boolean", default: true, label: "\\text{talin}", on: "bound: integrin open", off: "absent: integrin bent"},
    cation: {kind: "boolean", default: true, label: "\\text{Mg}^{2+}", on: "present", off: "removed (EDTA)"}
  },
  formula: function (v) {
    var n = 2 / (Math.sqrt(3) * Math.pow(v.d / 1000, 2));
    return "n=\\frac{2}{\\sqrt3\\,d^{2}}=\\frac{2}{\\sqrt3\\,(" + (v.d / 1000).toFixed(3) + "\\ \\mu\\text{m})^{2}}=" + Math.round(n).toLocaleString("en-US").replace(/,/g, "{,}") + "\\ \\mu\\text{m}^{-2}";
  },
  status: function (v) {
    var n = Math.round(2 / (Math.sqrt(3) * Math.pow(v.d / 1000, 2)));
    if (!v.cation) return "With Mg²⁺ chelated by EDTA the integrin's metal site is empty, so it cannot grip the RGD on fibronectin: the cell <b>lets go</b> and rounds up.";
    if (!v.talin) return "Without talin on the β tail the integrin stays <b>bent and closed</b> (low affinity), so it ignores the fibronectin below: no adhesion.";
    if (v.d <= 70) return "RGD sites " + v.d + " nm apart (" + n.toLocaleString("en-US") + " per µm²): bound integrins are close enough to <b>cluster</b>, and talin, vinculin and actin build a focal adhesion that signals through FAK.";
    return "RGD sites " + v.d + " nm apart (" + n + " per µm²) are too sparse: integrins bind one by one but <b>cannot cluster</b>, so no focal adhesion matures and the cell spreads poorly.";
  },
  examples: [
    {name: "dense RGD", values: {d: 20}},
    {name: "too sparse", values: {d: 150}},
    {name: "just close enough", values: {d: 60}},
    {name: "just too far", values: {d: 75}},
    {name: "no talin: bent integrins", values: {talin: false}},
    {name: "EDTA: the cell lets go", values: {cation: false}}
  ],
  size: [400, 300],
  draw: function (api, v) {
    var c = api.color, s = 0.78, x0 = 76, mem = 104, lig = 204;
    var bind = v.talin && v.cation, cluster = bind && v.d <= 70;
    var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12}, o || {})); };
    // matrix: a fibronectin fibre with RGD sites every d nm (a 400 nm slice)
    var N = Math.floor(400 / v.d) + 1, off = (400 - (N - 1) * v.d) / 2, xs = [];
    for (var i = 0; i < N; i++) xs.push(x0 + (off + i * v.d) * s);
    api.path("M " + x0 + " " + (lig + 8) + " q 39 6 78 0 t 78 0 t 78 0 t 78 0", {stroke: c.muted, width: 5, opacity: 0.6});
    xs.forEach(function (x) { api.circle([x, lig], 3.6, {fill: c.c4}); });
    L([4, lig], "RGD", c.c4, {weight: 650});
    L([x0, lig + 26], "fibronectin fibre", c.muted);
    // spacing bracket between the two middle sites, and a scale bar
    var mid = Math.max(0, Math.floor(N / 2) - 1), xa = xs[mid], xb = xs[mid + 1];
    api.line([xa, lig + 44], [xb, lig + 44], {color: c.ink, width: 1.4, arrow: true, arrowStart: true});
    L([(xa + xb) / 2, lig + 58], "d = " + v.d + " nm", c.ink, {weight: 650, anchor: "middle"});
    api.line([300, 288], [300 + 100 * s, 288], {color: c.muted, width: 2});
    L([300 + 50 * s, 276], "100 nm", c.muted, {anchor: "middle"});
    // membrane
    api.rect(x0 - 8, mem - 6, 400 - x0 + 8, 12, {fill: c.c3, fillOpacity: 0.08, rx: 0});
    api.line([x0 - 8, mem - 6], [400, mem - 6], {color: c.faint, width: 1.4}); api.line([x0 - 8, mem + 6], [400, mem + 6], {color: c.faint, width: 1.4});
    L([4, mem], "membrane", c.muted);
    // integrins: over each site when they bind, otherwise at fixed spots
    var spots = bind ? xs : [96, 136, 176, 216, 256, 296, 336, 376];
    spots.forEach(function (x) {
      if (!v.talin) {   // bent-closed: legs folded, head turned back toward the membrane
        api.path("M " + (x - 3) + " " + (mem - 10) + " L " + (x - 3) + " " + (mem + 34) + " Q " + (x + 2) + " " + (mem + 44) + " " + (x + 9) + " " + (mem + 30), {stroke: c.c2, width: 2.6});
        api.path("M " + (x + 3) + " " + (mem - 10) + " L " + (x + 3) + " " + (mem + 30) + " Q " + (x + 6) + " " + (mem + 38) + " " + (x + 11) + " " + (mem + 28), {stroke: c.c1, width: 2.6});
        api.circle([x + 11, mem + 22], 5, {fill: c.c2, fillOpacity: 0.6, stroke: c.c2, width: 1.2});
        if (v.cation) api.circle([x + 11, mem + 22], 1.8, {fill: c.ink});
        return;
      }
      var foot = bind ? lig - 9 : lig - 34;
      api.line([x - 3, mem - 10], [x - 3, foot - 4], {color: c.c2, width: 2.6});
      api.line([x + 3, mem - 10], [x + 3, foot - 4], {color: c.c1, width: 2.6});
      api.circle([x, foot], 5.5, {fill: c.c2, fillOpacity: 0.6, stroke: c.c2, width: 1.2});
      if (v.cation) api.circle([x, foot + 1], 1.8, {fill: c.ink});
      api.line([x + 3, mem - 10], [x + 3, mem - 34], {color: c.c3, width: 3});   // talin on the beta tail
      if (cluster) api.circle([x + 3, mem - 42], 4.5, {fill: c.c6});            // vinculin, only in a cluster
    });
    L([4, 146], "integrin", c.c2, {weight: 650});
    if (v.talin) { L([4, 161], "α", c.c2, {weight: 650}); L([18, 161], "β", c.c1, {weight: 650}); } else L([4, 161], "bent, closed", c.c2);
    L([4, bind ? 190 : 182], v.cation ? "• Mg²⁺" : "EDTA", v.cation ? c.ink : c.c5, {weight: 600, raw: true});
    if (v.talin) L([4, 80], "talin", c.c3, {weight: 650});
    if (cluster) {
      api.line([x0 - 6, 46], [394, 46], {color: c.c5, width: 4});
      api.line([x0 - 6, 54], [394, 54], {color: c.c5, width: 4, opacity: 0.6});
      spots.forEach(function (x) { api.line([x + 3, mem - 46], [x + 3, 56], {color: c.c6, width: 1.6}); });
      L([4, 50], "actin", c.c5, {weight: 650});
      L([4, 64], "vinculin", c.c6, {weight: 650});
      L([x0 - 6, 18], "focal adhesion: clustered, tied to actin", c.c4, {weight: 650});
      api.rect(330, 9, 62, 18, {fill: c.c4, fillOpacity: 0.25, stroke: c.c4, rx: 9, width: 1.2});
      L([361, 18], "FAK-P", c.c4, {weight: 700, anchor: "middle"});
    } else if (bind) {
      [[90, 48], [190, 38], [290, 52]].forEach(function (p) { api.line(p, [p[0] + 70, p[1] + 6], {color: c.c5, width: 2.4, dash: "6 5", opacity: 0.6}); });
      L([4, 50], "actin", c.c5, {weight: 650});
      L([x0 - 6, 18], "bound singly: no cluster, actin stays unlinked", c.c5, {weight: 600});
    } else {
      L([x0 - 6, 18], v.cation ? "integrins closed: nothing gripped" : "metal sites empty: nothing gripped", c.c5, {weight: 600});
    }
    api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints svg text ink
  }
});
