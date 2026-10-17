// Why cells wall off their chemistry: the same N molecules shut inside a compartment that is a fraction f of the
// cell's volume reach a concentration 1/f times higher, c = N / (N_A f V_cell), and two partners shut in together
// meet 1/f times as often (rate per cell = k N_A N_B / (N_A f V)). Volume fractions are the textbook stereology of a
// liver cell (hepatocyte, V about 5,000 um^3): cytosol 54%, mitochondria 22%, rough ER 9%, nucleus 6%, peroxisomes
// 1%, lysosomes 1% (smooth ER + Golgi 6% and endosomes 1% are not offered). The cell drawing is schematic: small
// organelles are drawn larger than life so their molecules can be seen; one dot stands for many molecules.
(function () {
  var VCELL = 5000, PLACES = {"whole cell": 100, "cytosol": 54, "mitochondria": 22, "rough ER": 9, "nucleus": 6, "peroxisomes": 1, "lysosomes": 1};
  var ORDER = ["whole cell", "cytosol", "mitochondria", "rough ER", "nucleus", "peroxisomes", "lysosomes"];
  var CX = 90, CY = 152, RX = 80, RY = 104, NUC = [83, 143, 26], ER = [35, 44, 53];
  var sc = function (p) { return [CX + (p[0] - 104) * 0.85, CY + (p[1] - 150) * 0.9]; };
  var MITO = [[52, 70], [128, 58], [34, 164], [70, 222], [136, 230], [176, 196]].map(sc);
  // the 1% organelles are drawn at r = 10 (pixel positions chosen clear of the ER arcs, mitochondria and membrane)
  var PEROX = [[144, 111], [46, 120], [90, 205], [152, 150]], LYSO = [[68, 181], [132, 89], [40, 198], [83, 85]], RO = 10;
  var conc = function (k, pct) { return 1.6605 * k * 1000 / (pct / 100 * VCELL); };   // k thousand molecules   // nM: 1e9 / (6.022e23 * 1e-15 L/um^3)
  var nice = function (x) { return x >= 1000 ? Viz.fmt(x / 1000, x >= 10000 ? 1 : 2) + " µM" : Viz.fmt(x, x >= 100 ? 0 : x >= 10 ? 1 : 2) + " nM"; };
  var big = function (k) { return (k * 1000).toLocaleString("en-US"); };
  function inside(name, x, y) {
    var inCell = Math.pow((x - CX) / RX, 2) + Math.pow((y - CY) / RY, 2) < 0.9;
    var dN = Math.hypot(x - NUC[0], y - NUC[1]), ang = Math.atan2(y - NUC[1], x - NUC[0]);
    var inNuc = dN < NUC[2] - 3, inEr = Math.abs(ang) < 1.15 && ER.some(function (r) { return Math.abs(dN - r) < 2.2; });
    var inMito = MITO.some(function (m) { return Math.pow((x - m[0]) / 11, 2) + Math.pow((y - m[1]) / 4.5, 2) < 1; });
    var inP = PEROX.some(function (m) { return Math.hypot(x - m[0], y - m[1]) < RO - 3; }), inL = LYSO.some(function (m) { return Math.hypot(x - m[0], y - m[1]) < RO - 3; });
    if (name === "whole cell") return inCell;
    if (name === "cytosol") return inCell && dN > NUC[2] + 3 && !(Math.abs(ang) < 1.25 && dN < 58) && !MITO.some(function (m) { return Math.hypot((x - m[0]) / 1.6, y - m[1]) < 11; }) &&
      !PEROX.concat(LYSO).some(function (m) { return Math.hypot(x - m[0], y - m[1]) < RO + 4; });
    return {mitochondria: inMito, "rough ER": inEr, nucleus: inNuc, peroxisomes: inP, lysosomes: inL}[name];
  }
  function halton(i, b) { var f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }
  Viz.register("cellular-compartmentalization", {
    title: "Compartments concentrate molecules",
    subject: "biology",
    shows: "Shut the same molecules into a smaller compartment: their concentration rises by one over the volume fraction, so partners kept together meet far more often than they would loose in the whole cell",
    params: {
      place: {kind: "enum", values: ORDER, default: "peroxisomes", label: "\\text{inside}"},
      N: {kind: "integer", default: 10, min: 1, max: 100, label: "N/10^3"}   // molecules, in thousands
    },
    formula: function (v) {
      var f = PLACES[v.place] / 100, cc = conc(v.N, PLACES[v.place]);
      return "c=\\frac{N}{N_A\\,f\\,V_{\\text{cell}}}\\newline\\phantom{c}=\\frac{" + big(v.N).replace(/,/g, "{,}") + "}{N_A\\cdot " + Viz.n(f, 2) + "\\cdot 5000\\ \\mu\\text{m}^3}=" +
        nice(cc).replace(" µM", "\\ \\mu\\text{M}").replace(" nM", "\\ \\text{nM}") + (f < 1 ? "\\ \\ (\\times" + Viz.n(1 / f, 1) + ")" : "");
    },
    status: function (v) {
      var pct = PLACES[v.place], cc = conc(v.N, pct), x = 100 / pct;
      if (pct === 100) return "Loose in the whole cell (about 5,000 µm³), " + big(v.N) + " molecules are only <b>" + nice(cc) + "</b>: too dilute for partners to meet often, which is why cells wall reactions off.";
      return "Kept in the " + v.place + ", <b>" + pct + "%</b> of the cell's volume, the same " + big(v.N) + " molecules reach <b>" + nice(cc) + "</b>, <b>" + Viz.fmt(x, 1) + "×</b> their whole-cell concentration, so a partner kept with them meets them " + Viz.fmt(x, 1) + " times as often.";
    },
    examples: [
      {name: "whole cell, fewest molecules", values: {place: "whole cell", N: 1}},
      {name: "lysosomes, most molecules", values: {place: "lysosomes", N: 100}},
      {name: "mitochondria", values: {place: "mitochondria", N: 10}},
      {name: "nucleus", values: {place: "nucleus", N: 50}},
      {name: "rough ER", values: {place: "rough ER"}},
      {name: "cytosol", values: {place: "cytosol"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, sel = v.place;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var hi = function (name) { return sel === name || (sel === "whole cell"); };
      // the cell and its organelles; the chosen compartment is filled, the rest faint
      api.path("M " + (CX - RX) + " " + CY + " A " + RX + " " + RY + " 0 1 0 " + (CX + RX) + " " + CY + " A " + RX + " " + RY + " 0 1 0 " + (CX - RX) + " " + CY,
        {stroke: c.muted, width: 2, fill: c.c1, fillOpacity: sel === "whole cell" || sel === "cytosol" ? 0.14 : 0.02});
      api.circle([NUC[0], NUC[1]], NUC[2], {fill: c.c1, fillOpacity: hi("nucleus") && sel !== "cytosol" ? 0.3 : 0.04, stroke: sel === "nucleus" ? c.c1 : c.faint, width: 1.6});
      ER.forEach(function (r) {
        var a0 = -1.15, a1 = 1.15, p0 = [NUC[0] + r * Math.cos(a0), NUC[1] + r * Math.sin(a0)], p1 = [NUC[0] + r * Math.cos(a1), NUC[1] + r * Math.sin(a1)];
        api.path("M " + p0[0] + " " + p0[1] + " A " + r + " " + r + " 0 0 1 " + p1[0] + " " + p1[1], {stroke: sel === "rough ER" ? c.c1 : c.faint, width: 5, opacity: sel === "rough ER" ? 0.7 : 0.5});
      });
      MITO.forEach(function (m) { api.path("M " + (m[0] - 13) + " " + m[1] + " A 13 6.5 0 1 0 " + (m[0] + 13) + " " + m[1] + " A 13 6.5 0 1 0 " + (m[0] - 13) + " " + m[1],
        {stroke: sel === "mitochondria" ? c.c1 : c.faint, width: 1.5, fill: c.c1, fillOpacity: sel === "mitochondria" ? 0.3 : 0.03}); });
      PEROX.forEach(function (m) { api.circle(m, RO, {stroke: sel === "peroxisomes" ? c.c1 : c.faint, width: 1.5, fill: c.c1, fillOpacity: sel === "peroxisomes" ? 0.3 : 0.03}); });
      LYSO.forEach(function (m) { api.circle(m, RO, {stroke: sel === "lysosomes" ? c.c1 : c.faint, width: 1.5, dash: "3 2", fill: c.c1, fillOpacity: sel === "lysosomes" ? 0.3 : 0.03}); });
      // the molecules: the same count of dots wherever they are kept (one dot = N / dots molecules); a candidate
      // closer than 4 px to a placed dot is skipped so every dot can be counted
      var nd = 14 + Math.round(v.N / 6), dots = [];
      for (var i = 1; i < 60000 && dots.length < nd; i++) {
        var x = CX - RX + 2 * RX * halton(i, 2), y = CY - RY + 2 * RY * halton(i, 3);
        if (inside(sel, x, y) && dots.every(function (d) { return Math.hypot(d[0] - x, d[1] - y) >= 4; })) dots.push([x, y]);
      }
      dots.forEach(function (d) { api.circle(d, 1.6, {fill: c.c3}); });
      L([CX, 18], sel === "whole cell" ? "no walls: spread through all" : "shut in: " + sel + " (" + PLACES[sel] + "%)", c.c1, {anchor: "middle"});
      L([CX, 286], "● = " + Math.round(v.N * 1000 / dots.length).toLocaleString("en-US") + " molecules", c.c3, {anchor: "middle", weight: 500});
      // concentration of the same N in each place: dots on a log axis, 0.1 nM to 10 uM (the range spans 0.33 nM at
      // N = 1,000 in the whole cell to 3.32 uM at N = 100,000 in a 1% compartment), and the gain 1/f per row
      var X0 = 184, X1 = 354, top = 46, rowH = 31, lx = function (nM) { return X0 + (X1 - X0) * (Math.log10(nM) + 1) / 5; };
      var DEC = [[0.1, "0.1"], [1, "1"], [10, "10"], [100, "100"], [1e3, "1"], [1e4, "10"]];
      L([392, 12], "same N, concentration", c.muted, {anchor: "end", weight: 500});
      L([392, 27], "(log scale)", c.muted, {anchor: "end", weight: 500});
      ORDER.forEach(function (name, k) {
        var yN = top + k * rowH, yD = yN + 13, cc = conc(v.N, PLACES[name]), on = name === sel, g = 100 / PLACES[name];
        L([X0, yN], name, on ? c.ink : c.muted, {anchor: "start", weight: on ? 650 : 500});
        api.line([X0, yD], [X1, yD], {color: c.grid, width: 1});
        DEC.forEach(function (t) { api.line([lx(t[0]), yD - 3.5], [lx(t[0]), yD + 3.5], {color: c.grid, width: 1}); });
        api.circle([lx(cc), yD], on ? 5 : 4, {fill: on ? c.c3 : c.muted, opacity: on ? 1 : 0.6});
        L([392, yD], "×" + Viz.fmt(g, g < 10 && g !== 1 ? 1 : 0), on ? c.c3 : c.muted, {anchor: "end", weight: on ? 650 : 500});
        if (on) L([X1, yN], nice(cc), c.c3, {anchor: "end", weight: 650});
      });
      var yA = top + rowH * ORDER.length - 1;
      DEC.forEach(function (t) { L([lx(t[0]), yA], t[1], c.muted, {anchor: "middle", weight: 500}); });
      [[0.1, 100, "nM"], [1e3, 1e4, "µM"]].forEach(function (u) {
        api.line([lx(u[0]) - 6, yA + 9], [lx(u[1]) + 6, yA + 9], {color: c.faint, width: 1});
        L([(lx(u[0]) + lx(u[1])) / 2, yA + 19], u[2], c.muted, {anchor: "middle", weight: 500});
      });
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
