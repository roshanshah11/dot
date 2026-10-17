// From B cell to plasma cell: antigen binds the B-cell receptor, the B cell shows antigen on MHC II to a helper T cell,
// gets CD40L and cytokine help, divides into a clone, and the clone splits into antibody-secreting plasma cells and
// memory cells. Below: the clone after n divisions and the antibody output, plasma cells x rate per cell.
Viz.register("b-cell-plasma-cell-antibody-secretion", {
  title: "B cell to plasma cell: antibody secretion",
  subject: "biology",
  shows: "Step from antigen binding through T-cell help and clonal expansion to plasma cells; set divisions, plasma share and rate to see the antibody output",
  params: {
    n: {kind: "integer", default: 8, min: 1, max: 16, label: "n"},
    f: {kind: "number", default: 0.8, min: 0.1, max: 1, step: 0.05, label: "f"},
    r: {kind: "integer", default: 2000, min: 500, max: 5000, step: 100, label: "r"}
  },
  steps: ["antigen binds the B-cell receptor", "B cell shows antigen to a helper T cell", "T-cell help: CD40L and cytokines", "clonal expansion", "plasma cells secrete antibody"],
  stepMs: 1800,
  formula: function (v) {
    var cells = Math.pow(2, v.n), P = Math.round(cells * v.f), big = function (x) { return x.toLocaleString("en-US").replace(/,/g, "{,}"); };
    return "P=2^{" + v.n + "}\\cdot " + Viz.n(v.f) + "\\approx " + big(P) + ",\\ \\ P\\cdot r=" + big(P) + "\\cdot " + big(v.r) + "=" + big(P * v.r) + "\\ \\text{s}^{-1}";
  },
  status: function (v) {
    var s = v.step || 1, cells = Math.pow(2, v.n), P = Math.round(cells * v.f);
    var what = ["A naive B cell's receptor (membrane IgM) binds the one antigen it fits",
                "The B cell takes the antigen in and shows pieces of it on MHC II to a helper T cell that knows the same antigen",
                "The T cell's CD40L and cytokines (IL-4, IL-21) tell the B cell to divide and differentiate",
                "The B cell divides again and again into a clone of <b>" + cells.toLocaleString("en-US") + "</b> cells, all with the same receptor",
                "Plasma cells secrete that same binding site as soluble antibody, while memory cells wait for a second exposure"][s - 1];
    return what + (P === 0 ? "; with this split no cell has become a plasma cell yet." :
      "; <b>" + P.toLocaleString("en-US") + "</b> plasma cells make about <b>" + (P * v.r).toLocaleString("en-US") + "</b> antibodies per second.");
  },
  examples: [
    {name: "one division", values: {n: 1, f: 0.1, r: 500, step: 1}},
    {name: "big clone", values: {n: 16, f: 1, r: 5000, step: 5}},
    {name: "textbook rate", values: {n: 10, f: 0.9, r: 2000, step: 4}}
  ],
  size: [400, 300],
  draw: function (api, v) {
    var c = api.color, s = v.step || 1;
    var sup = "2" + String(v.n).split("").map(function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]; }).join("");
    var Y = function (base, deg, len, color, w) {
      var a = deg * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], m = [base[0] + u[0] * len * 0.55, base[1] + u[1] * len * 0.55];
      api.line(base, m, {color: color, width: w || 2.4});
      [-35, 35].forEach(function (d) { var b = a + d * Math.PI / 180; api.line(m, [m[0] + Math.cos(b) * len * 0.5, m[1] + Math.sin(b) * len * 0.5], {color: color, width: w || 2.4}); });
    };
    var on = function (C, r, deg, out) { var a = deg * Math.PI / 180; return [C[0] + (r + (out || 0)) * Math.cos(a), C[1] + (r + (out || 0)) * Math.sin(a)]; };
    var antigen = function (q) { api.polygon([[q[0], q[1] - 6], [q[0] + 6, q[1]], [q[0], q[1] + 6], [q[0] - 6, q[1]]], {fill: c.c5, fillOpacity: 1}); };
    var mhc = function (C, r, deg) {
      var a = deg * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], p = [-u[1], u[0]], b = on(C, r, deg);
      api.polyline([[b[0] - p[0] * 5 + u[0] * 10, b[1] - p[1] * 5 + u[1] * 10], [b[0] - p[0] * 5, b[1] - p[1] * 5], [b[0] + p[0] * 5, b[1] + p[1] * 5], [b[0] + p[0] * 5 + u[0] * 10, b[1] + p[1] * 5 + u[1] * 10]], {stroke: c.c6, width: 3});
      api.circle([b[0] + u[0] * 6, b[1] + u[1] * 6], 2.8, {fill: c.c5});
    };
    // ---- top: the step ----
    if (s === 1) {
      var B = [140, 90];
      api.circle(B, 40, {stroke: c.ink, width: 2.2, fill: c.ink, fillOpacity: 0.04});
      [0, 45, 135, 180, 225, 270, 315].forEach(function (d) { Y(on(B, 40, d), d, 20, c.c1); });
      antigen(on(B, 40, 0, 24));
      [[296, 52], [334, 104], [282, 132]].forEach(antigen);
      api.label([140, 150], "naive B cell", {color: c.ink, size: 12.5, weight: 600, anchor: "middle"});
      api.label([140, 22], "B-cell receptors (IgM)", {color: c.c1, size: 12, anchor: "middle"});
      api.label([310, 80], "antigen", {color: c.c5, size: 12.5, weight: 600, anchor: "middle"});
    } else if (s <= 3) {
      var B2 = [112, 90], T = [222, 90];
      api.circle(B2, 40, {stroke: c.ink, width: s === 3 ? 3.2 : 2.2, fill: c.ink, fillOpacity: s === 3 ? 0.09 : 0.04});
      [120, 165, 210, 255].forEach(function (d) { Y(on(B2, 40, d), d, 18, c.c1); });
      api.circle([102, 92], 13, {stroke: c.muted, width: 1.2, dash: "3 3"});
      [[97, 88], [106, 95], [100, 99]].forEach(function (q) { api.circle(q, 2.6, {fill: c.c5}); });
      [-40, 0, 40].forEach(function (d) { mhc(B2, 40, d); });
      api.circle(T, 36, {stroke: c.c2, width: 2.2, fill: c.c2, fillOpacity: 0.07});
      api.line(on(T, 36, 180), on(T, 36, 180, 10), {color: c.c2, width: 3}); api.line(on(T, 36, 172), on(T, 36, 172, 9), {color: c.c2, width: 3});
      api.label([44, 30], "B cell", {color: c.ink, size: 12.5, weight: 600, anchor: "middle"});
      api.label([266, 82], "helper T cell", {color: c.c2, size: 12.5, weight: 600});
      api.label([266, 100], "(CD4⁺)", {color: c.c2, size: 12});
      api.label([166, 26], "MHC II + antigen peptide", {color: c.c6, size: 12, anchor: "middle"});
      if (s === 3) {
        api.path("M 214 130 Q 170 156 132 128", {stroke: c.c2, width: 2, arrow: true});
        [[200, 140], [184, 146], [166, 147], [150, 141]].forEach(function (q) { api.circle([q[0], q[1] - 9], 3, {fill: c.c2}); });
        api.label([270, 140], "CD40L + cytokines", {color: c.c2, size: 12.5, weight: 600});
        api.label([270, 156], "(IL-4, IL-21)", {color: c.c2, size: 12});
      }
    } else if (s === 4) {
      // four generations, each cell centred between its two daughters (gen 4: 8 cells, 17 apart, y 30-150)
      var xs = [40, 110, 180, 255], rads = [13, 11, 8, 5], gap = [0, 68, 34, 17], tree = [];
      [1, 2, 4, 8].forEach(function (g, gi) {
        var cur = [];
        for (var j = 0; j < g; j++) cur.push([xs[gi], 90 + (j - (g - 1) / 2) * gap[gi]]);
        tree.push(cur);
      });
      // every parent-daughter line first, then the cells on top, so no line runs into a cell
      tree.forEach(function (cur, gi) { if (gi) cur.forEach(function (q, j) { api.line(tree[gi - 1][Math.floor(j / 2)], q, {color: c.faint, width: 1.2}); }); });
      tree.forEach(function (cur, gi) {
        var rad = rads[gi];
        cur.forEach(function (q) {
          api.circle(q, rad, {stroke: c.ink, width: 1.8, fill: c.card});
          // the packed last generation shows its receptor on the free right side; the others point up into open space
          if (gi === 3) Y([q[0] + rad, q[1]], 0, 7, c.c1, 1.6); else Y([q[0], q[1] - rad], -90, [12, 11, 8][gi], c.c1, 1.8);
        });
      });
      api.label([316, 90], "… " + sup, {color: c.ink, size: 14, weight: 650, anchor: "middle", raw: true});
      api.label([150, 16], "every daughter carries the same receptor", {color: c.c1, size: 12, anchor: "middle"});
    } else {
      var Pc = [104, 86];
      api.circle(Pc, 42, {stroke: c.c3, width: 2.4, fill: c.c3, fillOpacity: 0.06});
      api.circle([88, 98], 13, {stroke: c.muted, width: 1.6});
      [16, 23, 30].forEach(function (rr) { api.path("M " + (Pc[0] + rr * Math.cos(-2.2)) + " " + (Pc[1] + rr * Math.sin(-2.2)) + " A " + rr + " " + rr + " 0 0 1 " + (Pc[0] + rr * Math.cos(0.9)) + " " + (Pc[1] + rr * Math.sin(0.9)), {stroke: c.c3, width: 1.4, opacity: 0.6}); });
      [[172, 60, -20], [196, 96, 15], [220, 52, -40], [238, 88, 30], [262, 64, 0], [266, 112, 50], [290, 44, -60], [300, 90, 20]].forEach(function (q) { Y([q[0], q[1]], q[2] - 90, 18, c.c1, 2.2); });
      var Mc = [350, 112];
      api.circle(Mc, 18, {stroke: c.c4, width: 2.2});
      [-90, 0, 90, 180].forEach(function (d) { Y(on(Mc, 18, d), d, 12, c.c1, 1.8); });
      api.label([104, 146], "plasma cell", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.label([104, 22], "packed with rough ER", {color: c.c3, size: 12, anchor: "middle"});
      api.label([236, 132], "free antibodies", {color: c.c1, size: 12.5, weight: 600, anchor: "middle"});
      api.label([350, 150], "memory B cell", {color: c.c4, size: 12.5, weight: 600, anchor: "middle"});
    }
    api.line([12, 166], [api.w - 12, 166], {color: c.grid, width: 1});
    // ---- bottom: the clone and its output ----
    var cells = Math.pow(2, v.n), P = Math.round(cells * v.f), out = P * v.r, dots = Math.min(cells, 128), per = cells / dots;
    api.label([14, 184], sup + " = " + cells.toLocaleString("en-US") + " cells" + (per > 1 ? ", 1 dot = " + per : ""), {color: c.ink, size: 12, weight: 600, raw: true});
    var pd = Math.round(dots * P / cells);
    for (var i = 0; i < dots; i++) api.circle([20 + (i % 16) * 10.5, 202 + Math.floor(i / 16) * 10.5], 3.4, {fill: i < pd ? c.c3 : c.c4});
    // green = every daughter that did not become a plasma cell: mostly memory B cells, some still in germinal centres
    var pl = api.label([14, 290], P.toLocaleString("en-US") + " plasma", {color: c.c3, size: 12.5, weight: 650});
    var px = 14 + (pl.getComputedTextLength ? pl.getComputedTextLength() || (P.toLocaleString("en-US").length + 7) * 7.3 : 0) + 9;
    api.label([px, 290], (cells - P).toLocaleString("en-US") + " memory / other", {color: c.c4, size: 12.5, weight: 650});
    var bx = 230, bw = 156, frac = out > 0 ? Math.min(1, Math.log10(out) / 9) : 0;
    api.label([bx, 184], "antibodies/s (log scale)", {color: c.muted, size: 12});
    api.rect(bx, 200, bw, 18, {rx: 5, stroke: c.muted, width: 1.2});
    if (frac > 0) api.rect(bx, 200, Math.max(4, bw * frac), 18, {rx: 5, fill: c.c1, fillOpacity: 0.85});
    ["1", "10^3", "10^6", "10^9"].forEach(function (t, j) { api.label([bx + j * bw / 3, 232], t, {color: c.muted, size: 12, anchor: j === 0 ? "start" : j === 3 ? "end" : "middle"}); });
    api.label([bx, 254], out > 0 ? "≈ " + out.toLocaleString("en-US") + " per second" : "no plasma cells yet", {color: c.c1, size: 13, weight: 650});
    api.label([bx, 273], P.toLocaleString("en-US") + " cells × " + v.r.toLocaleString("en-US") + " each", {color: c.muted, size: 12});
    // viz.css paints every svg text ink, over the fill attribute; restate each label's color inline
    api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
  }
});
