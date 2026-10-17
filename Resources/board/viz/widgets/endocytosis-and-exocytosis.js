// Exocytosis and endocytosis move membrane as well as cargo. A vesicle that fuses with the plasma membrane releases its
// contents outside and its own membrane becomes part of the cell surface; a pit that buds inward takes a patch of surface,
// and a sip of outside fluid, into the cell. A spherical vesicle of diameter d carries 4 pi r^2 = pi d^2 of membrane, so
// the surface changes at dA/dt = (k_exo - k_endo) pi d^2. Cells keep the two in balance (membrane recycling): after a burst
// of secretion, compensatory endocytosis takes the extra membrane back. The vesicle's inside is topologically outside the
// cell, which is why exocytosed cargo ends up outside and endocytosed fluid arrives inside a vesicle.
// Schematic: one drawn event per 10 vesicles a second (up to 5 a side); bars scale with vesicles per second.
// Colors: amber = exocytosis (secretory vesicles, cargo), teal = endocytosis (coat, fluid), green = net gain, red = net loss.
(function () {
  function rate(v) { return (v.exo - v.endo) * Math.PI * Math.pow(v.d / 1000, 2); }   // um^2 per second
  function a1(x) { return (x > 0 ? "+" : x < 0 ? "−" : "") + Viz.fmt(Math.abs(x), Math.abs(x) < 10 ? 2 : 1); }

  Viz.register("endocytosis-and-exocytosis", {
    title: "Exocytosis and endocytosis",
    subject: "biology",
    shows: "Set how many vesicles fuse and how many bud off each second: exocytosis adds its vesicle membrane to the surface, endocytosis takes membrane back, and the difference decides whether the cell surface grows or shrinks",
    params: {
      exo: {kind: "integer", default: 20, min: 0, max: 50, label: "k_{exo}"},
      endo: {kind: "integer", default: 12, min: 0, max: 50, label: "k_{endo}"},
      d: {kind: "integer", default: 100, min: 40, max: 200, step: 10, label: "d\\ (\\text{nm})"}
    },
    formula: function (v) {
      return "\\frac{dA}{dt}=(k_{exo}-k_{endo})\\,\\pi d^2\\newline =(" + v.exo + "-" + v.endo + ")\\,\\pi\\,(" + Viz.n(v.d / 1000, 2) + "\\,\\mu\\text{m})^2=" +
        Viz.n(rate(v), 3) + "\\,\\mu\\text{m}^2/\\text{s}";
    },
    status: function (v) {
      var diff = v.exo - v.endo, perMin = Math.abs(rate(v)) * 60;
      if (!v.exo && !v.endo) return "No vesicle traffic: nothing is secreted or taken in, and the surface area stays put.";
      if (!diff) return "Balanced: " + v.exo + " vesicles fuse and " + v.endo + " bud off each second, so cargo moves both ways while the surface area stays <b>constant</b>.";
      return (diff > 0 ? "Exocytosis outpaces endocytosis by <b>" + diff + "</b> vesicles a second, so the cell surface gains <b>"
                       : "Endocytosis outpaces exocytosis by <b>" + (-diff) + "</b> vesicles a second, so the cell surface loses <b>") +
        Viz.fmt(perMin, perMin < 10 ? 2 : 1) + " µm²</b> every minute.";
    },
    examples: [
      {name: "balanced recycling", values: {exo: 20, endo: 20, d: 100}},
      {name: "burst of secretion", values: {exo: 50, endo: 0, d: 200}},
      {name: "endocytosis wins", values: {exo: 0, endo: 50, d: 40}},
      {name: "no traffic", values: {exo: 0, endo: 0}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      // a fusing vesicle opens wide and flattens; a pit about to pinch off has a narrow neck
      var c = api.color, y0 = 84, r = 6 + 8 * (v.d - 40) / 160, nx = 0.8 * r, nn = 0.3 * r;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var place = function (k, a, b) { var out = []; for (var i = 0; i < k; i++) out.push(a + (i + 0.5) * (b - a) / k); return out; };
      var ex = place(Math.min(5, Math.round(v.exo / 10)), 24, 186), en = place(Math.min(5, Math.round(v.endo / 10)), 214, 376);
      if (v.exo > 0 && !ex.length) ex = [105];
      if (v.endo > 0 && !en.length) en = [295];
      // the plasma membrane, with an open omega at every event: fusing vesicles on the left, coated pits on the right
      var d = "M 8 " + y0;
      ex.map(function (x) { return [x, nx]; }).concat(en.map(function (x) { return [x, nn]; })).forEach(function (q) {
        d += " L " + (q[0] - q[1]) + " " + y0 + " A " + r + " " + r + " 0 1 0 " + (q[0] + q[1]) + " " + y0;
      });
      d += " L 392 " + y0;
      api.path(d, {stroke: c.muted, width: 7, opacity: 0.55});
      api.path(d, {stroke: c.card, width: 2.4});
      var yx = y0 + Math.sqrt(r * r - nx * nx), yc = y0 + Math.sqrt(r * r - nn * nn);
      ex.forEach(function (x) {   // cargo spilling out of the open fusion pore
        api.circle([x, yx + 2], 2.6, {fill: c.c3});
        [[-4, -8], [4, -15], [-2, -23]].forEach(function (o) { api.circle([x + o[0], y0 + o[1]], 2.6, {fill: c.c3}); });
      });
      en.forEach(function (x) {   // clathrin bristles on the cytoplasmic face, outside fluid inside the pit
        for (var a = 20; a <= 160; a += 20) {
          var t = a * Math.PI / 180;
          api.line([x + (r + 3) * Math.cos(t), yc + (r + 3) * Math.sin(t)], [x + (r + 8) * Math.cos(t), yc + (r + 8) * Math.sin(t)], {color: c.c1, width: 1.8});
        }
        api.circle([x - r * 0.35, yc], 2.6, {fill: c.c1}); api.circle([x + r * 0.35, yc + r * 0.3], 2.6, {fill: c.c1});
      });
      // the next vesicle on each side
      if (v.exo > 0) {
        api.circle([52, 148], r, {fill: c.c3, fillOpacity: 0.12, stroke: c.c3, width: 2});
        api.circle([52, 148], 2.6, {fill: c.c3});
        L([52 + r + 8, 148], "secretory vesicle", c.c3, {weight: 500});
      }
      if (v.endo > 0) {
        api.circle([348, 148], r, {fill: c.c1, fillOpacity: 0.12, stroke: c.c1, width: 2});
        for (var a = 0; a < 360; a += 30) { var t = a * Math.PI / 180; api.line([348 + (r + 3) * Math.cos(t), 148 + (r + 3) * Math.sin(t)], [348 + (r + 7) * Math.cos(t), 148 + (r + 7) * Math.sin(t)], {color: c.c1, width: 1.6}); }
        L([348 - r - 12, 148], "coated vesicle", c.c1, {anchor: "end", weight: 500});
      }
      L([105, 16], "exocytosis  " + v.exo + "/s", c.c3, {anchor: "middle"});
      L([105, 32], "cargo out · surface grows", c.c3, {anchor: "middle", weight: 500});
      L([295, 16], "endocytosis  " + v.endo + "/s", c.c1, {anchor: "middle"});
      L([295, 32], "fluid in · surface shrinks", c.c1, {anchor: "middle", weight: 500});
      L([200, 50], "outside", c.muted, {anchor: "middle", weight: 500});
      L([200, 172], "cytoplasm", c.muted, {anchor: "middle", weight: 500});
      // the membrane budget per minute
      var per = Math.PI * Math.pow(v.d / 1000, 2) * 60, s = 3.2, bx = 92, diff = v.exo - v.endo;
      L([16, 194], "membrane per minute", c.muted, {weight: 500});
      var row = function (y, name, k, col, text) {
        L([16, y], name, col, {weight: 500});
        api.rect(bx, y - 7, Math.max(2, k * s), 14, {fill: col, fillOpacity: k ? 0.85 : 0.3, rx: 3});
        L([bx + Math.max(2, k * s) + 8, y], text, col);
      };
      row(216, "added", v.exo, c.c3, (v.exo ? "+" : "") + Viz.fmt(v.exo * per, 1) + " µm²");
      row(238, "removed", v.endo, c.c1, (v.endo ? "−" : "") + Viz.fmt(v.endo * per, 1) + " µm²");
      row(262, diff > 0 ? "net gain" : diff < 0 ? "net loss" : "net", Math.abs(diff), diff > 0 ? c.c4 : diff < 0 ? c.c5 : c.muted,
        diff ? a1(diff * per) + " µm²" : "0: balanced");
      L([16, 282], "each vesicle: πd² = " + Viz.fmt(Math.PI * Math.pow(v.d / 1000, 2), 3) + " µm² of membrane", c.muted, {weight: 500});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
