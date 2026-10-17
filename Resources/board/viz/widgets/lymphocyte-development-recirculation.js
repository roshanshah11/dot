// Where lymphocytes are made, where they mature and how they patrol. Both kinds come from hematopoietic stem cells in
// the bone marrow (a primary lymphoid organ). B cells mature there; T-cell precursors move to the thymus, where
// positive selection (must recognize self-MHC) and negative selection (must not bind self too strongly) kill about
// 98% of thymocytes. Mature naive cells enter the blood, leave it through high endothelial venules (HEVs) into a lymph
// node (a secondary organ): T cells to the T zone, B cells to the follicles. With no antigen they leave in the
// efferent lymph and the thoracic duct pours them back into the blood, again and again; with their antigen they are
// activated and divide (clonal expansion).
(function () {
  var HEV = [[240, 172], [296, 172]], LOOP = [[140, 108], [160, 88], [212, 88], [232, 108], [232, 172]];
  var SPOT = {T: [322, 170], B: [340, 116]}, DUCT = [[292, 146], [262, 146], [262, 44], [186, 44], [186, 80]];
  var ROUTE = {   // per step: the waypoints travelled during that step (the route rides just inside the blood loop)
    T: [[[68, 236]], [[68, 88], [70, 66]], [[90, 70], [140, 108]], LOOP.slice(1).concat(HEV, [SPOT.T]), [[310, 152]].concat(DUCT)],
    // B cells keep to the cortex, up the hilum side to the top follicle, so the T zone stays clear
    B: [[[68, 236]], [[68, 236]], [[104, 230], [140, 226]], LOOP.concat(HEV, [[312, 150], [326, 128], SPOT.B]), [[310, 112]].concat(DUCT)]
  };
  function key(v) { return v.lineage === "T cell" ? "T" : "B"; }
  var FORM = {
    T: ["\\text{HSC}", "\\text{thymus}", "\\text{blood}", "\\text{node}"],
    B: ["\\text{HSC}", "\\text{marrow}", "\\text{blood}", "\\text{node}"]
  };

  Viz.register("lymphocyte-development-recirculation", {
    title: "Lymphocytes: development and recirculation",
    subject: "biology",
    shows: "Pick T or B cells and step through a life: born in the bone marrow, tested in the thymus or marrow, then blood, lymph node, lymph and back to blood until they meet their antigen",
    params: {
      lineage: {kind: "enum", values: ["T cell", "B cell"], default: "T cell", label: "\\text{cell}"},
      antigen: {kind: "boolean", default: false, label: "\\text{antigen}", on: "in the node", off: "none"}
    },
    steps: ["born in the bone marrow", "matures and is tested", "enters the blood", "enters a lymph node", "recirculates or is activated"],
    stepMs: 1800,
    formula: function (v) {
      var s = v.step || 1, f = FORM[key(v)].concat([v.antigen ? "\\text{clonal expansion}" : "\\text{lymph}\\to\\text{blood}"]);
      f = f.map(function (t, i) { return i === s - 1 ? "\\boxed{" + t + "}" : t; });
      return f.slice(0, 3).join("\\to ") + "\\newline\\to " + f.slice(3).join("\\to ");
    },
    status: function (v) {
      var s = v.step || 1, T = key(v) === "T";
      if (s === 1) return "A hematopoietic stem cell in the bone marrow makes a lymphoid progenitor; " + (T ? "T-cell precursors leave for the thymus." : "B cells stay in the marrow to mature.");
      if (s === 2) return T ? "In the thymus, cells that cannot recognize self-MHC die (positive selection) and cells that bind self too strongly are deleted (negative selection): about <b>98%</b> never leave."
        : "B cells mature in the bone marrow itself, where cells whose receptors bind self antigens are edited or deleted.";
      if (s === 3) return T ? "Mature naive <b>CD4</b> and <b>CD8</b> T cells leave the thymus and travel in the blood." : "Mature naive B cells, carrying <b>IgM</b> and <b>IgD</b>, leave the marrow and travel in the blood.";
      if (s === 4) return "They squeeze out of the blood through <b>HEVs</b> into a lymph node and settle in " + (T ? "the T zone, checking dendritic cells" : "a follicle, sampling what the lymph brings in") +
        (v.antigen ? ", and this time their antigen is there." : " for their antigen.");
      if (!v.antigen) return "No match: they leave in the efferent lymph and the thoracic duct returns them to the blood to <b>try another node</b>, over and over.";
      return T ? "A match: the T cell is activated, divides many times (<b>clonal expansion</b>) and its daughters become effector and memory T cells."
        : "A match: the B cell is activated (usually with T-cell help), divides (<b>clonal expansion</b>) and its daughters become antibody-secreting plasma cells and memory B cells.";
    },
    examples: [
      {name: "T cell selection in the thymus", values: {lineage: "T cell", step: 2}},
      {name: "B cell matures in the marrow", values: {lineage: "B cell", step: 2}},
      {name: "no antigen: back to the blood", values: {lineage: "T cell", antigen: false, step: 5}},
      {name: "antigen found: clonal expansion", values: {lineage: "B cell", antigen: true, step: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, K = key(v), lc = K === "T" ? c.c1 : c.c2;
      api.label([10, 12], "primary organs", {color: c.muted, size: 12});
      api.label([390, 12], "secondary organ", {color: c.muted, size: 12, anchor: "end"});
      // thymus (two lobes) and a long bone with its marrow
      api.path("M 58 44 a 14 22 0 1 0 0.1 0 Z M 82 44 a 14 22 0 1 0 0.1 0 Z", {stroke: c.ink, width: 1.5, fill: c.ink, fillOpacity: 0.04});
      api.label([70, 30], "thymus", {color: c.ink, size: 12.5, anchor: "middle", weight: 600});
      api.rect(36, 228, 64, 16, {fill: c.c5, fillOpacity: 0.12, stroke: c.ink, width: 1.4, rx: 3});
      [[30, 224], [30, 248], [106, 224], [106, 248]].forEach(function (q) { api.circle(q, 9, {fill: c.card, stroke: c.ink, width: 1.4}); });
      api.rect(37, 229, 62, 14, {fill: c.c5, fillOpacity: 0.12, rx: 2});
      api.label([68, 272], "bone marrow", {color: c.ink, size: 12.5, anchor: "middle", weight: 600});
      // blood: a loop running clockwise; the HEV branch carries it into the node
      api.rect(132, 80, 108, 170, {stroke: c.c5, width: 3, rx: 24});
      api.arrow([132, 186], [132, 156], {color: c.c5, width: 3, halo: false});
      api.arrow([240, 196], [240, 226], {color: c.c5, width: 3, halo: false});
      api.label([186, 166], "blood", {color: c.c5, size: 13, weight: 650, anchor: "middle"});
      api.line(HEV[0], HEV[1], {color: c.c5, width: 3});
      api.label([270, 160], "HEV", {color: c.c5, size: 12, anchor: "middle"});
      // efferent lymph and the thoracic duct back into the blood
      api.polyline(DUCT, {stroke: c.c4, width: 3});
      api.arrow([200, 44], [190, 44], {color: c.c4, width: 3, halo: false});
      api.label([206, 30], "efferent lymph, thoracic duct", {color: c.c4, size: 12, anchor: "middle"});
      // the lymph node: T zone in the middle, B follicles in the outer cortex, hilum on the left
      api.path("M 306 92 C 350 72 396 104 394 160 C 394 216 352 244 306 230 C 288 224 284 204 296 190 C 304 180 304 148 296 138 C 284 124 288 100 306 92 Z", {stroke: c.ink, width: 1.6, fill: c.ink, fillOpacity: 0.04});
      // the top follicle swells into a germinal centre when its B cell finds antigen and divides
      var bExp = s === 5 && v.antigen && K === "B", tExp = s === 5 && v.antigen && K === "T";
      [[SPOT.B, bExp ? 24 : 14], [[379, 162], 11], [[364, 203], 12]].forEach(function (f) { api.circle(f[0], f[1], {stroke: c.c2, width: 1.2, dash: "3 3", fill: c.c2, fillOpacity: 0.06}); });
      if (!bExp && !tExp) { api.label([318, 78], "B follicles", {color: c.c2, size: 12, anchor: "middle"}); api.line([322, 86], [333, 103], {color: c.c2, width: 1}); }
      api.label([318, 194], "T zone", {color: c.c1, size: 12, anchor: "middle"});
      api.label([336, 254], "lymph node", {color: c.ink, size: 12.5, anchor: "middle", weight: 600});
      if (v.antigen) {   // a dendritic cell holding antigen in the T zone, free antigen in a follicle
        var dc = [348, 160], arms = "";
        for (var a = 0; a < 5; a++) { var t = a * 2 * Math.PI / 5 - 0.3; arms += "M " + dc[0] + " " + dc[1] + " L " + (dc[0] + 11 * Math.cos(t)) + " " + (dc[1] + 11 * Math.sin(t)) + " "; }
        api.path(arms, {stroke: c.c3, width: 3});
        api.circle(dc, 4, {fill: c.c3});
        var ag = bExp ? 21 : 11;   // free antigen in the follicle, at its rim so a cell there does not hide it
        [-1.9, -0.6, 0.6].forEach(function (t) { api.circle([SPOT.B[0] + ag * Math.cos(t), SPOT.B[1] + ag * Math.sin(t)], 2.6, {fill: c.c3}); });
        api.label(bExp ? [356, 181] : [350, 141], "antigen", {color: c.c3, size: 12, anchor: "middle"});
      }
      // the route: dashed in full, solid as far as this step
      var R = ROUTE[K], all = [], done = [];
      R.forEach(function (seg, i) {
        if (i === 4 && v.antigen) return;
        seg.forEach(function (q) { all.push(q); if (i < s) done.push(q); });
      });
      api.polyline(all, {stroke: lc, width: 1.4, dash: "4 4", opacity: 0.55});
      if (done.length > 1) api.polyline(done, {stroke: lc, width: 2.6});
      // where the cell is now
      var cell = function (q, r) {
        api.circle(q, r, {fill: lc, stroke: c.card, width: 2});
        if (r > 7) api.label([q[0], q[1] + 0.5], K, {color: c.card, size: 12, weight: 700, anchor: "middle"});
      };
      if (s === 2) {   // most fail selection; drawn as faded crosses beside the survivor
        var at = R[1][R[1].length - 1], T2 = K === "T", e = T2 ? 4 : 3;   // B cells stay inside the marrow shaft
        (T2 ? [[-16, -8], [16, -8], [-16, 8], [16, 8]] : [[-16, -4], [16, -4], [-16, 4], [16, 4]]).forEach(function (o) {
          var q = [at[0] + o[0], at[1] + o[1]];
          api.path("M " + (q[0] - e) + " " + (q[1] - e) + " L " + (q[0] + e) + " " + (q[1] + e) + " M " + (q[0] + e) + " " + (q[1] - e) + " L " + (q[0] - e) + " " + (q[1] + e), {stroke: c.muted, width: 1.6});
        });
        if (T2) { api.label([60, 122], "~98% fail", {color: c.muted, size: 12, anchor: "end"}); api.label([60, 136], "selection", {color: c.muted, size: 12, anchor: "end"}); }
        else { api.label([12, 190], "self-reactive cells", {color: c.muted, size: 12}); api.label([12, 204], "edited or deleted", {color: c.muted, size: 12}); }
        cell(at, 8);
      } else if (s === 5 && v.antigen) {
        var hub = SPOT[K];
        if (tExp) [[0, 0], [-14, -6], [14, -6], [-10, 10], [10, 10], [0, -16], [-20, 6], [20, 6]].forEach(function (o) { cell([hub[0] + o[0], hub[1] + o[1]], 6); });
        else [[0, 0], [12, 0], [-12, 0], [-6, -10.4], [6, -10.4], [-6, 10.4], [6, 10.4]].forEach(function (o) { cell([hub[0] + o[0], hub[1] + o[1]], 5.5); });
        api.label([tExp ? 326 : 340, 78], "clonal expansion", {color: lc, size: 12, weight: 650, anchor: "middle"});
        if (tExp) api.line([314, 86], [319, 148], {color: lc, width: 1});
      } else {
        var seg = R[s - 1], here = s === 5 ? [226, 44] : seg[seg.length - 1];
        cell(here, 8);
      }
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
