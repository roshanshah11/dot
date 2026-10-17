// A desmosome, close up: desmoglein and desmocollin (desmosomal cadherins, Ca2+-dependent) from both cells clasp
// across a ~30 nm gap; inside each cell the outer dense plaque (plakoglobin, plakophilin) and inner dense plaque
// (desmoplakin) tie them to keratin intermediate filaments, so a pull on the sheet is carried keratin -> plaque ->
// cadherins -> plaque -> keratin into the neighbour. Two diseases break different links: pemphigus vulgaris
// (autoantibodies against desmoglein 3) splits the cells apart at the cadherins (acantholysis); epidermolysis bullosa
// simplex (keratin 5/14 mutations) leaves the desmosome intact but the filaments snap and the cells tear.
// The pull is in relative units and the break points (3 and 5) are illustrative, not measured forces.
// Colors: teal = desmosomal cadherins, purple = plaques, amber = keratin, blue = the pull, red = the defect.
(function () {
  function broken(v) { return v.condition === "pemphigus" ? v.pull >= 3 : v.condition === "keratin defect" ? v.pull >= 5 : false; }
  Viz.register("desmosome-cell-anchoring", {
    title: "Desmosomes: spot welds between cells",
    subject: "biology",
    shows: "Pull on the sheet: the force runs keratin, plaque, cadherins and back, so the junction holds; break the cadherins or the keratin and see where the tissue fails",
    params: {
      pull: {kind: "integer", default: 4, min: 0, max: 10, label: "\\text{pull}"},
      condition: {kind: "enum", values: ["healthy", "pemphigus", "keratin defect"], default: "healthy", label: "\\text{case}",
        names: {"healthy": "healthy", "pemphigus": "pemphigus", "keratin defect": "keratin defect"}}
    },
    formula: function (v) {
      var x = "\\textcolor{#f87171}{\\times}", b = broken(v), cad = v.condition === "pemphigus", ker = v.condition === "keratin defect";
      var K = (b && ker ? x : "") + "\\text{keratin}", link = b && cad ? "\\ " + x + "\\ " : "\\leftrightarrow";
      return K + "\\to\\text{plaque}\\to\\text{Dsg/Dsc}" + link + "\\newline\\text{Dsg/Dsc}\\to\\text{plaque}\\to" + K;
    },
    status: function (v) {
      var b = broken(v);
      if (v.condition === "pemphigus") return b ? "Antibodies block desmoglein, so the pull <b>splits the cells apart</b> at the cadherins (acantholysis): a blister forms inside the epidermis."
        : "Antibodies coat most desmogleins; the few cadherin pairs left still hold " + (v.pull ? "at this light pull" : "the cells together at rest") + ", but the junction is <b>weakened</b>.";
      if (v.condition === "keratin defect") return b ? "The desmosome holds, but the fragile mutant keratin <b>snaps inside the cells</b> and they tear, as in epidermolysis bullosa simplex."
        : (v.pull ? "Mutant keratin still carries this light pull" : "At rest the fragile mutant keratin holds") + "; the weak link is <b>inside</b> the cells, not at the junction.";
      if (v.pull === 0) return "At rest: desmoglein and desmocollin from both cells clasp across a <b>30 nm</b> gap and the plaques tie them to keratin.";
      return "Pull " + v.pull + ": the tension runs <b>keratin → plaque → cadherins → plaque → keratin</b>, so the neighbour shares the load and the junction holds.";
    },
    examples: [
      {name: "at rest", values: {pull: 0}},
      {name: "healthy, hard pull", values: {pull: 10}},
      {name: "pemphigus: cells split", values: {condition: "pemphigus", pull: 6}},
      {name: "pemphigus at rest", values: {condition: "pemphigus", pull: 0}},
      {name: "keratin defect: cells tear", values: {condition: "keratin defect", pull: 8}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, b = broken(v), pem = v.condition === "pemphigus", ker = v.condition === "keratin defect";
      var sep = b && pem ? 10 + 4 * (v.pull - 3) : 0, xm = 200, half = 15 + sep, xL = xm - half, xR = xm + half;
      var top = 96, bot = 190, ys = [104, 120, 136, 152, 168, 184], blocked = [true, false, true, true, false, true];
      api.label([12, 16], "cell 1", {color: c.muted, size: 12.5});
      api.label([388, 16], "cell 2", {color: c.muted, size: 12.5, anchor: "end"});
      // membranes (lipid bilayers)
      [[xL, -1], [xR, 1]].forEach(function (m) {
        api.line([m[0], 40], [m[0], 212], {color: c.ink, width: 1.5, opacity: 0.75});
        api.line([m[0] + 4 * m[1], 40], [m[0] + 4 * m[1], 212], {color: c.ink, width: 1.5, opacity: 0.75});
      });
      // cadherins across the gap
      ys.forEach(function (y, i) {
        var reach = sep ? 6 : (pem && blocked[i] ? half - 6 : half + 5);
        api.line([xL, y], [xL + reach, y], {color: c.c1, width: 2.4}); api.circle([xL + reach, y], 3, {fill: c.c1});
        api.line([xR, y + 6], [xR - reach, y + 6], {color: c.c1, width: 2.4}); api.circle([xR - reach, y + 6], 3, {fill: c.c1});
        if (pem && (blocked[i] || sep)) {   // an antibody (Y) parked on the desmoglein tip
          var ax = xL + reach + 4, ay = y;
          api.line([ax, ay], [ax + 6, ay], {color: c.c5, width: 2}); api.line([ax + 6, ay], [ax + 11, ay - 4], {color: c.c5, width: 2}); api.line([ax + 6, ay], [ax + 11, ay + 4], {color: c.c5, width: 2});
        }
      });
      api.label([xm, 34], "desmoglein + desmocollin (Ca²⁺)", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      api.line([xm, 42], [xm, top - 2], {color: c.c1, width: 1, dash: "2 3", opacity: 0.6});
      // plaques: outer (plakoglobin, plakophilin) next to the membrane, inner (desmoplakin) further in
      [[xL - 18, xL - 34], [xR + 8, xR + 24]].forEach(function (p) {
        api.rect(p[0], top, 10, bot - top, {fill: c.c6, fillOpacity: 0.9, rx: 3});
        api.rect(p[1], top + 6, 10, bot - top - 12, {fill: c.c6, fillOpacity: 0.45, rx: 3});
      });
      // keratin filaments fan out from the inner plaque to the far side of each cell; tension straightens them
      var amp = 7 * (1 - v.pull / 10) + 0.6;
      [-1, 1].forEach(function (side) {
        var px = side < 0 ? xL - 34 : xR + 34, ex = side < 0 ? 20 : 380;
        [64, 108, 152, 196, 222].forEach(function (yEdge, i) {
          var yP = top + 12 + i * 17, pts = [];
          for (var q = 0; q <= 24; q++) {
            var f = q / 24, x = px + (ex - px) * f, y = yP + (yEdge - yP) * f + amp * Math.sin(f * Math.PI * 4 + i);
            pts.push([x, y]);
          }
          if (b && ker) {   // snapped halfway: two pieces with a red break mark
            api.polyline(pts.slice(0, 11), {stroke: c.c3, width: 1.8}); api.polyline(pts.slice(14), {stroke: c.c3, width: 1.8});
            var m = pts[12]; api.label(m, "×", {color: c.c5, size: 15, weight: 800, anchor: "middle"});
          } else api.polyline(pts, {stroke: c.c3, width: 1.8, opacity: ker ? 0.7 : 1, dash: ker ? "5 2" : null});
        });
        api.rect(side < 0 ? 14 : 380, 54, 6, 178, {fill: c.c3, fillOpacity: 0.25, rx: 3});
      });
      api.label([24, 50], ker ? "mutant keratin" : "keratin filaments", {color: c.c3, size: 12, weight: 650});
      api.label([376, 50], "to the next junction", {color: c.c3, size: 12, anchor: "end"});
      // gap width
      api.line([xL, 204], [xR, 204], {color: sep ? c.c5 : c.muted, width: 1});
      api.label([xm, 226], sep ? "gap torn open" : "≈ 30 nm", {color: sep ? c.c5 : c.muted, size: 12, weight: sep ? 650 : 500, anchor: "middle"});
      // the pull on the sheet
      var len = 10 + 8.5 * v.pull;
      if (v.pull > 0) {
        api.arrow([150, 248], [150 - len, 248], {color: c.c2, width: 2.5, halo: false, head: 9});
        api.arrow([250, 248], [250 + len, 248], {color: c.c2, width: 2.5, halo: false, head: 9});
      }
      api.label([xm, 248], v.pull ? "pull " + v.pull : "no pull", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([12, 272], "outer plaque: plakoglobin, plakophilin", {color: c.c6, size: 12, weight: 650});
      api.label([12, 290], "inner plaque: desmoplakin", {color: c.c6, size: 12, opacity: 0.8});
      if (pem) api.label([388, 290], "Y = anti-desmoglein antibody", {color: c.c5, size: 12, anchor: "end"});
      if (ker && b) api.label([388, 290], "× = keratin snapped", {color: c.c5, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
