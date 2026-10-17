// How a transport vesicle buds, travels and fuses, on four routes of the endomembrane system. A small GTPase switched on
// by GTP recruits a coat (Sar1 for COPII, ER to Golgi; ARF1 for COPI, Golgi back to ER; ARF1 with the AP-1 adaptor for
// clathrin, trans-Golgi network to endosome; the AP-2 adaptor for clathrin at the plasma membrane, where dynamin pinches
// the neck). The coat gathers cargo through receptors and curves the membrane; the bud pinches off; the coat comes off
// (GTP hydrolysis by Sar1 or ARF1, or Hsc70 with auxilin for clathrin). At the target a Rab GTPase and a tether catch the
// vesicle, its v-SNARE zips up with the target's t-SNAREs, the bilayers fuse and the cargo enters the target's lumen;
// NSF then pulls the SNAREs apart. Colors: compartments by identity (blue ER, purple Golgi, red endosome, grey plasma
// membrane), teal = coat and dynamin, amber = cargo with its receptor, green = v-SNARE, white = t-SNARE.
(function () {
  var R = {
    "er-golgi": {from: "ER lumen", to: "Golgi lumen", fc: "c2", tc: "c6", coat: "COPII", gtp: "Sar1", tex: ["\\text{ER}", "\\text{COPII}", "\\text{cis Golgi}"], map: 0, toName: "cis Golgi"},
    "golgi-er": {from: "Golgi lumen", to: "ER lumen", fc: "c6", tc: "c2", coat: "COPI", gtp: "ARF1", tex: ["\\text{cis Golgi}", "\\text{COPI}", "\\text{ER}"], map: 2, toName: "ER"},
    "tgn-endosome": {from: "TGN lumen", to: "endosome lumen", fc: "c6", tc: "c5", coat: "clathrin + AP-1", gtp: "ARF1", tex: ["\\text{TGN}", "\\text{clathrin, AP-1}", "\\text{endosome}"], map: 1, toName: "endosome"},
    endocytic: {from: "outside the cell", to: "endosome lumen", fc: "muted", tc: "c5", coat: "clathrin + AP-2", gtp: "dynamin", tex: ["\\text{surface}", "\\text{clathrin, AP-2}", "\\text{endosome}"], map: 3, toName: "early endosome"}
  };
  var FIRST = {
    "er-golgi": "<b>Sar1</b>, switched on by GTP, recruits the COPII coat to an ER exit site, where cargo receptors gather newly folded proteins into a bud.",
    "golgi-er": "<b>ARF1</b>, switched on by GTP, recruits the COPI coat in the cis Golgi, which gathers KDEL receptors holding ER proteins that escaped.",
    "tgn-endosome": "<b>ARF1</b>-GTP and the AP-1 adaptor build a clathrin coat on the trans-Golgi network around M6P receptors loaded with lysosomal enzymes.",
    endocytic: "The <b>AP-2</b> adaptor links clathrin to receptors in the plasma membrane, collecting receptor-bound cargo such as LDL into a coated pit."
  };
  var SHED = {
    "er-golgi": "Sar1 hydrolyses its GTP, the COPII coat falls apart and the bare vesicle heads for the cis Golgi.",
    "golgi-er": "ARF1 hydrolyses its GTP, the COPI coat comes off and the bare vesicle heads back to the ER.",
    "tgn-endosome": "Hsc70 and auxilin strip the clathrin coat and the bare vesicle heads for an endosome.",
    endocytic: "Hsc70 and auxilin strip the clathrin coat and the bare vesicle heads for the early endosome."
  };
  var MAPBOX = [[50, "ER", "c2", 64], [150, "Golgi", "c6", 70], [258, "endosome", "c5", 80], [350, "surface", "muted", 76]];
  var ARCS = [[0, 1, -1, "COPII"], [1, 2, -1, "clathrin + AP-1"], [1, 0, 1, "COPI"], [3, 2, 1, "clathrin + AP-2"]];   // from, to, above/below, coat

  Viz.register("endomembrane-trafficking", {
    title: "Vesicle traffic: coat, bud, dock, fuse",
    subject: "biology",
    shows: "Pick a route between compartments and step a vesicle through it: a GTPase recruits the coat that gathers cargo and bends the membrane, the bud pinches off and sheds its coat, and matching v- and t-SNAREs zip it onto the right target",
    params: {
      route: {kind: "enum", values: ["er-golgi", "golgi-er", "tgn-endosome", "endocytic"], default: "er-golgi", label: "\\text{route}",
              names: {"er-golgi": "ER → Golgi", "golgi-er": "Golgi → ER", "tgn-endosome": "TGN → endosome", endocytic: "surface → endosome"}}
    },
    steps: ["coat gathers cargo", "bud pinches off", "coat sheds, vesicle moves", "SNAREs pair", "membranes fuse"],
    stepMs: 1700,
    formula: function (v) {
      var r = R[v.route], s = v.step || 1;
      var ch = ["\\text{coat}", "\\text{bud}", "\\text{shed}", "\\text{dock}", "\\text{fuse}"].map(function (t, i) { return i === s - 1 ? "\\boxed{" + t + "}" : t; });
      return r.tex[0] + "\\xrightarrow{\\ " + r.tex[1] + "\\ }" + r.tex[2] + "\\newline {\\small " + ch.join("\\to ") + "}";
    },
    status: function (v) {
      var r = R[v.route], s = v.step || 1;
      if (s === 1) return FIRST[v.route];
      if (s === 2) return v.route === "endocytic" ? "<b>Dynamin</b> coils around the narrow neck and uses GTP to pinch the coated vesicle free."
                                                  : "The " + r.coat + " coat keeps curving the membrane until the bud <b>pinches off</b> as a vesicle with the cargo inside.";
      if (s === 3) return SHED[v.route];
      if (s === 4) return "A Rab GTPase and a tether catch the vesicle at the " + r.toName + ", and its <b>v-SNARE</b> twists together with the matching <b>t-SNAREs</b>, so it fuses only with the right membrane.";
      return "The zipped SNAREs pull the two bilayers together until they <b>fuse</b>, delivering the cargo into the " + r.toName + "; NSF then pries the SNAREs apart for reuse.";
    },
    examples: [
      {name: "COPII bud on the ER", values: {route: "er-golgi", step: 1}},
      {name: "dynamin pinches an endocytic vesicle", values: {route: "endocytic", step: 2}},
      {name: "COPI vesicle uncoats", values: {route: "golgi-er", step: 3}},
      {name: "SNAREs zip at the endosome", values: {route: "tgn-endosome", step: 4}},
      {name: "fused with the Golgi", values: {route: "er-golgi", step: 5}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, r = R[v.route], s = v.step || 1, yc = 104, fc = c[r.fc], tc = c[r.tc], endo = v.route === "endocytic";
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var mem = function (d, col) { api.path(d, {stroke: col, width: 8, opacity: 0.65}); api.path(d, {stroke: c.card, width: 2.6}); };
      var P = function (q, rr, deg) { var a = deg * Math.PI / 180; return [q[0] + rr * Math.cos(a), q[1] + rr * Math.sin(a)]; };
      var coat = function (q, rr, a0, a1, op) { for (var a = a0; a <= a1; a += 18) api.line(P(q, rr + 6, a), P(q, rr + 12, a), {color: c.c1, width: 2.2, opacity: op || 1}); };
      var load = function (q, rr, angs) { angs.forEach(function (a) { api.line(P(q, rr - 4, a), P(q, rr - 9, a), {color: c.c3, width: 2.2}); api.circle(P(q, rr - 13, a), 4.2, {fill: c.c3}); }); };
      var vsnare = function (q, rr, angs) { angs.forEach(function (a) { api.line(P(q, rr + 3, a), P(q, rr + 13, a), {color: c.c4, width: 3}); }); };
      // the two compartments: donor lumen on the left, target lumen on the right, cytosol between
      api.rect(8, 30, 62, 148, {fill: fc, fillOpacity: 0.08, rx: 4});
      api.rect(330, 30, 62, 148, {fill: tc, fillOpacity: 0.08, rx: 4});
      L([12, 16], r.from, fc);
      L([388, 16], r.to, tc, {anchor: "end"});
      L([200, 16], "cytosol", c.muted, {anchor: "middle", weight: 500});
      [[30, 56], [46, 150], [24, 168]].forEach(function (q) { api.circle(q, 4.2, {fill: c.c3, opacity: s <= 2 ? 1 : 0.55}); });
      // the donor membrane, with the bud on it
      var Rb = 32;
      if (s === 1 || s === 2) {
        var n = s === 1 ? 26 : 7, h = s === 1 ? 0 : 28, Q = [70 + h + Math.sqrt(Rb * Rb - n * n), yc];
        mem("M 70 30 L 70 " + (yc - n) + " L " + (70 + h) + " " + (yc - n) + " A " + Rb + " " + Rb + " 0 1 1 " + (70 + h) + " " + (yc + n) + " L 70 " + (yc + n) + " L 70 178", fc);
        load(Q, Rb, [-60, 0, 60]);
        coat(Q, Rb, s === 1 ? -72 : -125, s === 1 ? 72 : 125);
        L([Q[0] + Rb + 16, yc - 36], r.coat + " coat", c.c1);
        L([Q[0] + Rb + 16, yc - 21], s === 1 ? "recruited by " + (endo ? "AP-2" : r.gtp + "·GTP") : "bud pinches off", c.c1, {weight: 500});
        if (s === 2 && endo) {
          // the collar wraps the neck tube on its cytosolic face: two turns above it and two below, clear of both membranes
          [80, 89].forEach(function (x) { [-1, 1].forEach(function (sg) { api.circle([x, yc + sg * (n + 9)], 4, {fill: c.c1}); }); });
          L([80, yc + 50], "dynamin", c.c1);
        }
      } else mem("M 70 30 L 70 178", fc);
      // the target membrane, with its t-SNAREs
      if (s < 5) {
        mem("M 330 30 L 330 178", tc);
        [yc - 12, yc + 12].forEach(function (y) { if (s < 4) api.line([326, y], [314, y], {color: c.ink, width: 3}); });
      } else {
        mem("M 330 30 L 330 " + (yc - 26) + " Q 300 " + yc + " 330 " + (yc + 26) + " L 330 178", tc);
        [[352, 90], [366, 112], [350, 124]].forEach(function (q) { api.circle(q, 4.2, {fill: c.c3}); });
        L([362, 150], "delivered", c.c3, {anchor: "middle"});
        api.polyline([[316, yc - 4], [320, yc], [316, yc + 4]], {stroke: c.c4, width: 2.4});
        api.polyline([[318, yc - 4], [314, yc], [318, yc + 4]], {stroke: c.ink, width: 2.4});
        L([300, yc + 40], "SNAREs freed by NSF", c.muted, {anchor: "end", weight: 500});
      }
      if (s === 3 || s === 4) {
        var rv = 28, V = s === 3 ? [190, yc] : [330 - 4 - 16 - 4 - rv, yc];
        api.circle(V, rv, {fill: c.c3, fillOpacity: 0.05});
        mem("M " + (V[0] - rv) + " " + yc + " A " + rv + " " + rv + " 0 1 1 " + (V[0] + rv) + " " + yc + " A " + rv + " " + rv + " 0 1 1 " + (V[0] - rv) + " " + yc, fc);
        load(V, rv, [180, 300, 60]);
        if (s === 3) {
          vsnare(V, rv, [-35, 35]);
          [[-130, -95], [95, 130], [160, 200]].forEach(function (g, i) {
            var off = [[-10, -10], [-10, 12], [-16, 0]][i];
            for (var a = g[0]; a <= g[1]; a += 17) api.line([P(V, rv + 6, a)[0] + off[0], P(V, rv + 6, a)[1] + off[1]], [P(V, rv + 12, a)[0] + off[0], P(V, rv + 12, a)[1] + off[1]], {color: c.c1, width: 2.2, opacity: 0.45});
          });
          L([V[0] - 30, yc + 62], "coat falls off", c.c1, {anchor: "middle"});
          api.arrow([V[0] + 44, yc + 52], [298, yc + 52], {color: c.muted, width: 1.8, halo: false, head: 9});
          L([V[0] + 36, yc - 40], "v-SNARE", c.c4);
          L([322, yc + 30], "t-SNARE", c.ink, {anchor: "end"});
        } else {
          [yc - 12, yc + 12].forEach(function (y) {
            var a = [], b = [];
            for (var x = 310; x <= 326; x += 1) { a.push([x, y + 3 * Math.sin((x - 310) / 2.5)]); b.push([x, y - 3 * Math.sin((x - 310) / 2.5)]); }
            api.polyline(a, {stroke: c.c4, width: 2.4}); api.polyline(b, {stroke: c.ink, width: 2.4});
          });
          L([322, yc - 44], "v-SNARE", c.c4, {anchor: "end"});
          L([322, yc + 46], "t-SNARE", c.ink, {anchor: "end"});
          L([200, yc + 66], "only a matching pair can zip up", c.muted, {anchor: "middle", weight: 500});
        }
      }
      // the route map: the four compartments and the four vesicle routes, this one highlighted
      MAPBOX.forEach(function (b) {
        api.rect(b[0] - b[3] / 2, 228, b[3], 24, {fill: c[b[2]], fillOpacity: 0.16, stroke: c[b[2]], width: 1.4, rx: 7});
        L([b[0], 240], b[1], c[b[2]], {anchor: "middle"});
      });
      ARCS.forEach(function (a, i) {
        var x0 = MAPBOX[a[0]][0], x1 = MAPBOX[a[1]][0], mid = (x0 + x1) / 2, on = i === r.map;
        var y = a[2] < 0 ? 228 : 252, cy = a[2] < 0 ? 196 : 284;
        api.path("M " + (x0 + (x1 > x0 ? 8 : -8)) + " " + y + " Q " + mid + " " + cy + " " + (x1 + (x1 > x0 ? -8 : 8)) + " " + y,
          {stroke: on ? c.c1 : c.faint, width: on ? 2.4 : 1.2, arrow: true});
        L([mid, a[2] < 0 ? 203 : 279], a[3], on ? c.c1 : c.muted, {anchor: "middle", weight: on ? 650 : 500});
      });
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
