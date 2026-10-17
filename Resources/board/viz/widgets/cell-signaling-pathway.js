// A whole signaling pathway, step by step: epinephrine on a liver cell. Reception (the hormone binds a G-protein-
// coupled receptor), transduction (Gs-alpha swaps GDP for GTP, adenylyl cyclase makes cAMP, cAMP frees PKA's catalytic
// subunits, PKA phosphorylates phosphorylase kinase, which phosphorylates glycogen phosphorylase), response (glycogen is
// split into glucose-1-phosphate), then the switch-off (Gs-alpha hydrolyses its GTP, phosphodiesterase turns cAMP into
// AMP). The bars are the textbook illustration of amplification per epinephrine molecule (1 to about 10^8), log scale.
(function () {
  var STEPS = ["reception: epinephrine binds", "G protein swaps GDP for GTP", "adenylyl cyclase makes cAMP", "cAMP frees PKA",
    "kinase cascade", "response: glycogen breakdown", "switch-off"];
  var TEX = [
    "\\text{epinephrine}+\\text{receptor}\\rightleftharpoons\\text{receptor}^{*}",
    "\\text{G}_{\\alpha}\\!\\cdot\\!\\text{GDP}+\\text{GTP}\\to\\text{G}_{\\alpha}\\!\\cdot\\!\\text{GTP}+\\text{GDP}",
    "\\text{ATP}\\xrightarrow{\\text{adenylyl cyclase}}\\text{cAMP}+\\text{PP}_\\text{i}",
    "\\text{R}_2\\text{C}_2+4\\,\\text{cAMP}\\to\\text{R}_2(\\text{cAMP})_4+2\\,\\text{C}^{*}",
    "\\text{PKA}\\to\\text{PhK}\\!-\\!\\text{P}\\newline\\text{PhK}\\!-\\!\\text{P}\\to\\text{GP}\\!-\\!\\text{P (active)}",
    "(\\text{glucose})_n+\\text{P}_\\text{i}\\xrightarrow{\\text{GP}}(\\text{glucose})_{n-1}+\\text{glucose-1-P}",
    "\\text{G}_{\\alpha}\\!\\cdot\\!\\text{GTP}\\to\\text{G}_{\\alpha}\\!\\cdot\\!\\text{GDP}+\\text{P}_\\text{i}\\newline\\text{cAMP}\\xrightarrow{\\text{phosphodiesterase}}\\text{AMP}"
  ];
  var SAY = [
    "<b>Reception</b>: epinephrine cannot enter the cell, so it binds a G-protein-coupled receptor on the surface and changes the receptor's shape.",
    "The active receptor makes the G protein's α subunit swap <b>GDP for GTP</b>; α-GTP lets go of βγ and slides along the membrane. One receptor activates about <b>100</b>.",
    "Each α-GTP switches on <b>adenylyl cyclase</b>, which turns ATP into the second messenger <b>cAMP</b>: about 10⁴ cAMP per epinephrine.",
    "cAMP binds the regulatory subunits of <b>protein kinase A</b>, which release its catalytic subunits: the kinase is now on.",
    "PKA phosphorylates <b>phosphorylase kinase</b>, which phosphorylates <b>glycogen phosphorylase</b>: each kinase activates many of the next, about 10⁶ by the end.",
    "<b>Response</b>: active glycogen phosphorylase splits glucose off glycogen as glucose-1-phosphate, about <b>10⁸</b> per epinephrine, and the liver releases glucose.",
    "<b>Switch-off</b>: α hydrolyses its GTP and rejoins βγ, phosphodiesterase turns cAMP into AMP and phosphatases undo the phosphates, so the signal stops once epinephrine leaves."
  ];
  var BARS = [["hormone", 0], ["G, AC", 2], ["cAMP", 4], ["PKA", 4], ["PhK", 5], ["GP", 6], ["G1P", 8]];
  var LIT = [0, 1, 2, 3, 5, 6, -1];   // highest bar lit at each step (-1: all switched off)
  Viz.register("cell-signaling-pathway", {
    title: "Cell signaling: from receptor to response",
    subject: "biology",
    shows: "Step through epinephrine signaling in a liver cell: receptor, G protein, cAMP, a kinase cascade and glycogen breakdown, with the amplification at each stage and the switch-off at the end",
    params: {},
    steps: STEPS,
    stepMs: 1700,
    formula: function (v) { return TEX[(v.step || 1) - 1]; },
    status: function (v) { return SAY[(v.step || 1) - 1]; },
    examples: [{name: "reception", values: {step: 1}}, {name: "cAMP made", values: {step: 3}}, {name: "response", values: {step: 6}}, {name: "switch-off", values: {step: 7}}],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, off = s === 7, my = 60;
      var on = function (k) { return !off && s >= k; };
      api.label([10, 12], "outside", {color: c.muted, size: 12});
      api.label([392, 84], "cytoplasm", {color: c.muted, size: 12, anchor: "end"});
      [my, my + 6].forEach(function (y) { api.line([6, y], [394, y], {color: c.ink, width: 1.3, opacity: 0.7}); });
      // epinephrine and its receptor
      if (!off) api.circle([44, my - 13], 6, {fill: c.c3});
      else { api.circle([86, 22], 6, {fill: c.c3}); api.arrow([56, my - 12], [76, 28], {color: c.c3, width: 1.6, halo: false, head: 7}); }
      api.label([off ? 98 : 58, off ? 22 : my - 22], "epinephrine", {color: c.c3, size: 12});
      var zig = []; for (var i = 0; i < 8; i++) zig.push([30 + i * 4, i % 2 ? my + 11 : my - 5]);
      api.polyline(zig, {stroke: on(1) ? c.c1 : c.faint, width: 2.8});
      api.label([18, 88], "receptor", {color: on(1) ? c.c1 : c.muted, size: 12});
      // G protein: alpha with GDP sits on beta-gamma until the receptor makes it swap for GTP
      var aOn = on(2), aAt = aOn ? [136, my + 18] : [102, my + 18];
      api.rect(96, my + 22, 16, 13, {fill: c.c6, fillOpacity: 0.45, rx: 5});
      api.circle(aAt, 9, {fill: c.c6, fillOpacity: aOn ? 0.9 : 0.5});
      api.label([aAt[0], aAt[1] + 20], aOn ? "GTP" : "GDP", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
      api.label([88, 116], "G protein", {color: c.c6, size: 12});
      // adenylyl cyclase and the cAMP it makes
      api.rect(150, my - 12, 26, 32, {fill: on(3) ? c.c4 : c.faint, fillOpacity: on(3) ? 0.7 : 0.25, stroke: on(3) ? c.c4 : c.faint, width: 1.2, rx: 7});
      api.label([182, 46], "adenylyl cyclase", {color: on(3) ? c.c4 : c.muted, size: 12});
      var camp = [[154, 100], [170, 110], [188, 98], [160, 124], [180, 130], [194, 116], [150, 140], [168, 144], [188, 146], [146, 118], [176, 90], [196, 134]];
      if (s >= 3) camp.forEach(function (q) { api.circle(q, 3.2, off ? {fill: c.muted, fillOpacity: 0.5} : {fill: c.c2}); });
      if (s >= 3) api.label([162, 158], off ? "cAMP → AMP" : "cAMP", {color: off ? c.c5 : c.c2, size: 12, weight: 650, anchor: "middle"});
      if (off) api.label([aAt[0] + 14, aAt[1] + 6], "GTP → GDP", {color: c.c5, size: 12});
      // the kinase cascade: PKA, phosphorylase kinase, glycogen phosphorylase
      var K = [["PKA", "protein kinase A", 98, 4], ["PhK", "phosphorylase kinase", 134, 5], ["GP", "glycogen phosphorylase", 170, 5]];
      K.forEach(function (k, i) {
        var lit = on(k[3]), x = 216, y = k[2];
        if (i === 0 && lit) {   // PKA: catalytic subunits released from the regulatory pair
          api.rect(x - 16, y - 9, 14, 18, {fill: c.c2, fillOpacity: 0.35, rx: 4}); api.circle([x + 6, y - 4], 5, {fill: c.c4}); api.circle([x + 13, y + 5], 5, {fill: c.c4});
        } else api.rect(x - 16, y - 9, 32, 18, {fill: lit ? c.c4 : c.faint, fillOpacity: lit ? 0.75 : 0.2, stroke: lit ? c.c4 : c.faint, width: 1, rx: 6});
        if (lit && i > 0) api.label([x, y], "P", {color: c.card, size: 12, weight: 800, anchor: "middle"});
        if (i < 2) api.line([x, y + 11], [x, K[i + 1][2] - 11], {color: on(K[i + 1][3]) ? c.c4 : c.faint, width: 1.6, arrow: true});
        api.label([238, y - 7], k[0], {color: lit ? c.c4 : c.muted, size: 12, weight: 700});
        api.label([238, y + 7], k[1], {color: c.muted, size: 12});
      });
      // glycogen and the glucose-1-phosphate cut from it
      var gx = 76, gy = 164, br = [[0, 0, -18, -10], [0, 0, 16, -12], [0, 0, -14, 12], [0, 0, 18, 10], [-18, -10, -30, -4], [16, -12, 24, -24], [18, 10, 30, 4]];
      br.forEach(function (b) { api.line([gx + b[0], gy + b[1]], [gx + b[2], gy + b[3]], {color: c.ink, width: 2.4, opacity: 0.6}); });
      api.label([gx, gy + 24], "glycogen", {color: c.muted, size: 12, anchor: "middle"});
      if (on(5)) api.line([198, 170], [gx + 36, gy + 2], {color: c.c4, width: 1.6, arrow: true});
      if (on(6)) {
        [[22, 150], [16, 170], [30, 186], [124, 184], [140, 190], [112, 196]].forEach(function (q) { api.rect(q[0] - 3.5, q[1] - 3.5, 7, 7, {fill: c.c4, rx: 2}); });
        api.label([10, 134], "glucose-1-P", {color: c.c4, size: 12, weight: 650});
      }
      // amplification per epinephrine, log scale
      var x0 = 30, dx = 52, base = 283, lit = LIT[s - 1];
      api.label([10, 212], off ? "switched off: back to rest" : "molecules per epinephrine (log scale)", {color: off ? c.c5 : c.muted, size: 12});
      BARS.forEach(function (b, i) {
        var x = x0 + i * dx, hgt = 50 * (b[1] + 0.6) / 8.6, isOn = i <= lit;
        api.rect(x, base - hgt, 26, hgt, {fill: isOn ? c.c4 : c.faint, fillOpacity: isOn ? 0.85 : 0.25, rx: 3});
        api.label([x + 13, base - hgt - 9], b[1] === 0 ? "1" : "10^" + b[1], {color: isOn ? c.ink : c.muted, size: 12, anchor: "middle"});
        api.label([x + 13, base + 12], b[0], {color: isOn ? c.ink : c.muted, size: 12, anchor: "middle"});
      });
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
