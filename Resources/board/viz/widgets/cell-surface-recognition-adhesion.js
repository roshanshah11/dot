// Two cells meet across a gap; each shows one adhesion molecule on its surface. Cadherins bind their own type
// (homophilic) and only with Ca²⁺ bound between their five EC domains, which makes them rigid rods; take the Ca²⁺
// away (EDTA) and they go floppy and let go. N-CAM (Ig superfamily) is homophilic and needs no Ca²⁺. E-selectin's
// lectin head grips the sugar sialyl-Lewis x on a white blood cell, a heterophilic, Ca²⁺-dependent, short-lived bond
// (rolling). E- and N-cadherin bind each other far more weakly than their own type, so mixed cells sort apart.
// Colors: teal E-cadherin, blue N-cadherin, purple N-CAM, amber E-selectin, green the sugar, ink dots Ca²⁺.
(function () {
  var CAD = {"E-cadherin": 1, "N-cadherin": 1};
  function outcome(v) {
    var a = v.cell1, b = v.cell2;
    if (CAD[a] && CAD[b]) {
      if (a !== b) return "sort";
      return v.ca ? "cadherin" : "noCa";
    }
    if (a === "N-CAM" && b === "N-CAM") return "ncam";
    if (a === "E-selectin" && b === "sialyl-Lewis x") return v.ca ? "selectin" : "noCaSel";
    return "none";
  }
  var SHORT = {"E-cadherin": "\\text{E-cad}", "N-cadherin": "\\text{N-cad}", "N-CAM": "\\text{N-CAM}", "E-selectin": "\\text{E-selectin}", "sialyl-Lewis x": "\\text{sLe}^x"};
  Viz.register("cell-surface-recognition-adhesion", {
    title: "Cell surface recognition and adhesion",
    subject: "biology",
    shows: "Choose the molecule on each cell's surface and the calcium: cells stick only when the molecules recognize each other, and cadherins and selectins also need Ca²⁺",
    params: {
      cell1: {kind: "enum", values: ["E-cadherin", "N-cadherin", "N-CAM", "E-selectin"], default: "E-cadherin", label: "\\text{cell 1}",
        names: {"E-cadherin": "E-cad", "N-cadherin": "N-cad", "N-CAM": "N-CAM", "E-selectin": "E-selectin"}},
      cell2: {kind: "enum", values: ["E-cadherin", "N-cadherin", "N-CAM", "sialyl-Lewis x"], default: "E-cadherin", label: "\\text{cell 2}",
        names: {"E-cadherin": "E-cad", "N-cadherin": "N-cad", "N-CAM": "N-CAM", "sialyl-Lewis x": "sugar sLeˣ"}},
      ca: {kind: "boolean", default: true, label: "\\text{Ca}^{2+}", on: "present (~1.8 mM)", off: "removed (EDTA)"}
    },
    formula: function (v) {
      var o = outcome(v), pair = SHORT[v.cell1] + "+" + SHORT[v.cell2];
      if (o === "cadherin") return pair + "\\xrightarrow{\\ \\text{Ca}^{2+}\\ }\\text{bound (like binds like)}";
      if (o === "noCa") return pair + "\\xrightarrow{\\ \\text{EDTA}\\ }\\text{no Ca}^{2+}\\text{: floppy, no bond}";
      if (o === "sort") return pair + "\\to\\text{weak at best: cells sort apart}";
      if (o === "ncam") return pair + "\\to\\text{bound, Ca}^{2+}\\text{ not needed}";
      if (o === "selectin") return pair + "\\xrightarrow{\\ \\text{Ca}^{2+}\\ }\\text{brief bonds (rolling)}";
      if (o === "noCaSel") return pair + "\\xrightarrow{\\ \\text{EDTA}\\ }\\text{lectin cannot grip}";
      return pair + "\\to\\text{no partner: no bond}";
    },
    status: function (v) {
      var o = outcome(v);
      if (o === "cadherin") return "Both cells show " + v.cell1 + " and Ca²⁺ holds each rod rigid, so the tips grip across the gap: <b>strong homophilic adhesion</b>, the basis of adherens junctions.";
      if (o === "noCa") return "Without Ca²⁺ the cadherins go <b>floppy</b> and their tips cannot reach each other, so the cells <b>let go</b>: how EDTA dissociates tissue into single cells.";
      if (o === "sort") return "E- and N-cadherin bind <b>their own type</b> far better than each other, so these cells barely stick and a mixture <b>sorts</b> into separate clumps.";
      if (o === "ncam") return "N-CAM binds N-CAM with its Ig domains and needs <b>no Ca²⁺</b>, so these cells stick " + (v.ca ? "with or without calcium." : "even after EDTA.");
      if (o === "selectin") return "E-selectin's lectin head grabs the sugar <b>sialyl-Lewis x</b> (a heterophilic, Ca²⁺-dependent bond); the bonds form and break fast, so a white blood cell <b>rolls</b> along the vessel wall.";
      if (o === "noCaSel") return "Selectin's lectin head needs <b>Ca²⁺</b> to hold the sugar, so without it the white blood cell is <b>not caught</b>.";
      return v.cell1 + " has no binding site for " + v.cell2 + ": the surfaces <b>do not recognize</b> each other, so the cells stay apart.";
    },
    examples: [
      {name: "E-cadherin pair, Ca²⁺ present", values: {cell1: "E-cadherin", cell2: "E-cadherin", ca: true}},
      {name: "EDTA removes Ca²⁺", values: {cell1: "E-cadherin", cell2: "E-cadherin", ca: false}},
      {name: "mixed cadherins sort", values: {cell1: "E-cadherin", cell2: "N-cadherin", ca: true}},
      {name: "N-CAM without Ca²⁺", values: {cell1: "N-CAM", cell2: "N-CAM", ca: false}},
      {name: "selectin catches a sugar", values: {cell1: "E-selectin", cell2: "sialyl-Lewis x", ca: true}},
      {name: "no partner", values: {cell1: "N-CAM", cell2: "sialyl-Lewis x", ca: true}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, o = outcome(v), bound = o === "cadherin" || o === "ncam" || o === "selectin";
      var COL = {"E-cadherin": c.c1, "N-cadherin": c.c2, "N-CAM": c.c6, "E-selectin": c.c3, "sialyl-Lewis x": c.c4};
      var L = 66, m1 = 128, m2 = bound ? m1 + 2 * L : m1 + 2 * L + 44, top = 34, bot = 246, rows = [80, 140, 200];
      // ---- the two cells: cytoplasm tint, lipid bilayer edge, a nucleus peeking in ----
      api.rect(10, top, m1 - 10, bot - top, {fill: c.ink, fillOpacity: 0.04, rx: 14});
      api.rect(m2, top, 390 - m2, bot - top, {fill: c.ink, fillOpacity: 0.04, rx: 14});
      [[m1 - 6, m1], [m2, m2 + 6]].forEach(function (p) {
        api.line([p[0], top + 8], [p[0], bot - 8], {color: c.muted, width: 1.5});
        api.line([p[1], top + 8], [p[1], bot - 8], {color: c.muted, width: 1.5});
      });
      api.circle([48, 140], 26, {fill: c.ink, fillOpacity: 0.05, stroke: c.faint, width: 1});
      api.circle([(m2 + 390) / 2 + 20, 140], 26, {fill: c.ink, fillOpacity: 0.05, stroke: c.faint, width: 1});
      api.label([(10 + m1) / 2, 18], "cell 1", {color: c.muted, size: 12.5, anchor: "middle"});
      api.label([(m2 + 390) / 2, 18], "cell 2", {color: c.muted, size: 12.5, anchor: "middle"});
      var ion = function (q) { api.circle(q, 2.3, {fill: c.ink}); };
      // one adhesion molecule, from the membrane at x0 pointing dir (+1 right, -1 left); returns its tip
      function molecule(kind, x0, y, dir) {
        var col = COL[kind], x = x0, k;
        if (CAD[kind]) {
          // five EC domains; with Ca²⁺ a straight rod, without it each linker sags
          var ang = 0, p = [x0, y], step = 13;
          for (k = 0; k < 5; k++) {
            if (!v.ca) ang += 0.34;
            var q = [p[0] + dir * step * Math.cos(ang), p[1] + step * Math.sin(ang)], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
            api.circle(mid, 6.2, {fill: col, fillOpacity: 0.85});
            if (v.ca && k < 4) ion([q[0], q[1] - 6.5]);
            p = q;
          }
          return p;
        }
        if (kind === "N-CAM") {
          api.rect(dir > 0 ? x0 : x0 - 16, y - 4, 16, 8, {fill: col, fillOpacity: 0.55, rx: 3});
          for (k = 0; k < 5; k++) api.circle([x0 + dir * (21 + k * 10), y], 5, {fill: col, fillOpacity: 0.85});
          return [x0 + dir * L, y];
        }
        if (kind === "E-selectin") {
          for (k = 0; k < 4; k++) api.circle([x0 + dir * (5 + k * 8), y], 3.6, {fill: col, fillOpacity: 0.6});
          api.circle([x0 + dir * 40, y], 4.4, {fill: col, fillOpacity: 0.75});
          api.circle([x0 + dir * 55, y], 9, {fill: col, fillOpacity: 0.9});
          if (v.ca) ion([x0 + dir * 62, y - 6]);
          return [x0 + dir * L, y];
        }
        // sialyl-Lewis x: a sugar tree on the tip of a long, thin glycoprotein stalk
        api.line([x0, y], [x0 + dir * 48, y], {color: col, width: 2, opacity: 0.7});
        var hex = function (cx, cy) { var pts = []; for (var i = 0; i < 6; i++) pts.push([cx + 4.4 * Math.cos(i * Math.PI / 3), cy + 4.4 * Math.sin(i * Math.PI / 3)]); api.polygon(pts, {fill: col, fillOpacity: 0.85}); };
        hex(x0 + dir * 53, y); hex(x0 + dir * 62, y - 5); hex(x0 + dir * 62, y + 6);
        return [x0 + dir * L, y];
      }
      rows.forEach(function (y) {
        var t1 = molecule(v.cell1, m1, y, 1), t2 = molecule(v.cell2, m2, y, -1);
        if (bound) api.circle([(t1[0] + t2[0]) / 2, y], 11, {fill: c.ink, fillOpacity: 0.12, stroke: c.ink, width: 1.2, dash: o === "selectin" ? "3 3" : null});
      });
      var col1 = COL[v.cell1], col2 = COL[v.cell2];
      api.label([(10 + m1) / 2 - 3, 54], v.cell1, {color: col1, size: 12.5, weight: 650, anchor: "middle"});
      api.label([(m2 + 390) / 2 + 3, 54], v.cell2 === "sialyl-Lewis x" ? "sugar sLeˣ" : v.cell2, {color: col2, size: 12.5, weight: 650, anchor: "middle"});
      if (!bound) {
        var gx = (m1 + L + m2 - L) / 2;
        api.label([gx, 112], "×", {color: c.c5, size: 22, weight: 700, anchor: "middle"});
        api.label([gx, 172], "×", {color: c.c5, size: 22, weight: 700, anchor: "middle"});
      }
      // ---- the verdict under the cells ----
      var head = {cadherin: ["strong adhesion: homophilic, Ca²⁺-dependent", c.ink], noCa: ["no adhesion: cadherins floppy without Ca²⁺", c.c5],
        sort: ["little adhesion: different cadherins", c.c5], ncam: ["adhesion: homophilic, no Ca²⁺ needed", c.ink],
        selectin: ["brief bonds: heterophilic, Ca²⁺-dependent (rolling)", c.ink], noCaSel: ["no catch: the lectin needs Ca²⁺", c.c5],
        none: ["no recognition: no binding partner", c.c5]}[o];
      api.label([200, 266], head[0], {color: head[1], size: 13, weight: 650, anchor: "middle"});
      var dots = v.ca && (CAD[v.cell1] || CAD[v.cell2] || v.cell1 === "E-selectin");
      api.label([200, 287], dots ? "small dots: Ca²⁺ ions bound to the protein" : v.ca ? "Ca²⁺ in the medium (not used by N-CAM)" : "Ca²⁺ chelated by EDTA", {color: c.muted, size: 12, anchor: "middle"});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
