// Endocytosis in its three textbook forms, step by step. Receptor-mediated: LDL binds LDL receptors, the AP-2 adaptor
// links them to clathrin, the clathrin lattice curves the membrane into a coated pit, dynamin collars the neck from the
// cytosol and pinches it with GTP, the coat comes off and the vesicle fuses with an early endosome, whose acid pH frees
// LDL while the receptors recycle. Pinocytosis: the membrane folds in with no receptor, so solutes enter at the same
// concentration as outside (the solute dots come from one lattice over all fluid, so every region has the same density).
// Phagocytosis: receptors on a phagocyte grip a large particle (often coated with antibody or complement), actin drives
// pseudopods around it while more receptors zip along its surface, they seal into a phagosome, and a lysosome fuses with
// it to digest the particle. The bottom band shows what sets each type apart: concentration in the vesicle against
// outside (receptor-mediated concentrates LDL, pinocytosis is 1 : 1) or, for phagocytosis, size drawn to scale.
// Colors: amber = cargo (LDL, fluid solutes, bacterium), blue = receptors, teal = clathrin, green = dynamin and actin
// (the force generators), purple = endosome and lysosome.
(function () {
  var CHAIN = {
    "receptor-mediated": ["\\text{bind}", "\\text{coated pit}", "\\text{pinch off}", "\\text{endosome}"],
    pinocytosis: ["\\text{dip}", "\\text{fluid pocket}", "\\text{seal}", "\\text{endosome}"],
    phagocytosis: ["\\text{grip}", "\\text{pseudopods}", "\\text{phagosome}", "\\text{phagolysosome}"]
  };
  var SAY = {
    "receptor-mediated": ["LDL particles bind <b>LDL receptors</b>, which gather where clathrin assembles under the membrane.",
      "The clathrin lattice curves the membrane into a <b>coated pit</b> packed with receptors, concentrating LDL far above its level outside.",
      "<b>Dynamin</b> coils around the narrow neck and uses GTP to pinch the coated vesicle off the membrane.",
      "The clathrin coat falls off and the vesicle fuses with an <b>early endosome</b>, whose acid pH frees the LDL while the receptors recycle to the surface."],
    pinocytosis: ["The membrane dips inward with <b>no receptor</b> involved, so whatever is dissolved in the fluid comes along.",
      "The pocket deepens around a droplet of outside fluid, holding solutes at the <b>same concentration</b> as outside.",
      "The neck narrows and the membrane <b>seals</b>, closing the droplet into a vesicle.",
      "The vesicle hands its sip of fluid to an <b>endosome</b>; uptake is nonselective, so it scales with the outside concentration."],
    phagocytosis: ["Receptors on a phagocyte such as a macrophage <b>grip a bacterium</b>, often through antibodies or complement coating it.",
      "<b>Actin</b> pushes pseudopods out around the bacterium, zipping more receptors along its surface.",
      "The pseudopods fuse over the top and enclose the bacterium in a <b>phagosome</b> inside the cell.",
      "A <b>lysosome</b> fuses with the phagosome and its acid hydrolases digest the bacterium in the phagolysosome."]
  };
  var LDL = [[62, 36], [300, 24], [364, 52]], BY = 248;

  Viz.register("endocytosis-vesicle-uptake", {
    title: "Endocytosis: taking material in",
    subject: "biology",
    shows: "Pick receptor-mediated endocytosis, pinocytosis or phagocytosis and step through it: the membrane wraps the cargo, pinches off a vesicle, and delivers it to an endosome or lysosome",
    params: {
      kind: {kind: "enum", values: ["receptor-mediated", "pinocytosis", "phagocytosis"], default: "receptor-mediated", label: "\\text{type}"}
    },
    steps: ["capture the cargo", "wrap the membrane around it", "close it off", "deliver it"],
    stepMs: 1700,
    formula: function (v) {
      var s = v.step || 1, r = CHAIN[v.kind].map(function (t, i) { return i === s - 1 ? "\\boxed{" + t + "}" : t; });
      return r[0] + "\\to " + r[1] + "\\newline\\to " + r[2] + "\\to " + r[3];
    },
    status: function (v) { return SAY[v.kind][(v.step || 1) - 1]; },
    examples: [
      {name: "coated pit forms", values: {kind: "receptor-mediated", step: 2}},
      {name: "dynamin pinches", values: {kind: "receptor-mediated", step: 3}},
      {name: "cell drinking", values: {kind: "pinocytosis", step: 2}},
      {name: "pseudopods around a bacterium", values: {kind: "phagocytosis", step: 2}},
      {name: "digested in a phagolysosome", values: {kind: "phagocytosis", step: 4}}
    ],
    size: [400, 292],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, k = v.kind, rm = k === "receptor-mediated", pino = k === "pinocytosis", phago = k === "phagocytosis";
      var cx = 150, y0 = phago ? 112 : 84;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var mem = function (d) { api.path(d, {stroke: c.muted, width: 8, opacity: 0.55}); api.path(d, {stroke: c.card, width: 2.6}); };
      var P = function (q, R, deg) { var a = deg * Math.PI / 180; return [q[0] + R * Math.cos(a), q[1] + R * Math.sin(a)]; };
      var D = function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); };
      var dist = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
      var bristles = function (q, R, a0, a1) { for (var a = a0; a <= a1; a += 15) api.line(P(q, R + 6, a), P(q, R + 12, a), {color: c.c1, width: 2}); };
      // a receptor anchored in the membrane at radius R around q, its LDL held one dot-width clear of its neighbours
      var receptor = function (q, R, a, ldl) { api.line(P(q, R - 3, a), P(q, R - 13, a), {color: c.c2, width: 2.4}); if (ldl) api.circle(P(q, R - 18.5, a), 5, {fill: c.c3}); };
      var tick = function (q, r0, r1, a) { api.line(P(q, r0, a), P(q, r1, a), {color: c.c2, width: 2.4}); };
      L([16, y0 - 14], "outside", c.muted, {weight: 500});
      L([16, y0 + 18], "cytoplasm", c.muted, {weight: 500});
      if (!phago) {
        var W = 83, dip = function (x) { var t = (x - cx + W) / (2 * W); return t > 0 && t < 1 ? y0 + 68 * t * (1 - t) : y0; };
        var R = s === 2 ? 52 : 42, n = s === 2 ? 46 : 7, h = s === 2 ? 0 : 32, q = [cx, y0 + h + Math.sqrt(R * R - n * n)];
        var V = [cx, y0 + 78], rv = 32, E = [330, 170], re = 34;
        // the endosome the cargo is headed for sits in the cytoplasm from the first step
        api.circle(E, re, {fill: c.c6, fillOpacity: s === 4 ? 0.2 : 0.1, stroke: c.c6, width: 2.2});
        L([E[0], 216], rm ? (s === 4 ? "early endosome, pH ≈ 6:" : "early endosome") : "endosome", c.c6, {anchor: "middle"});
        // the membrane for this step
        if (s === 1) mem("M 8 " + y0 + " L " + (cx - W) + " " + y0 + " Q " + cx + " " + (y0 + 34) + " " + (cx + W) + " " + y0 + " L 392 " + y0);
        else if (s < 4) mem("M 8 " + y0 + " L " + (cx - n) + " " + y0 + " L " + (cx - n) + " " + (y0 + h) + " A " + R + " " + R + " 0 1 0 " + (cx + n) + " " + (y0 + h) + " L " + (cx + n) + " " + y0 + " L 392 " + y0);
        else {
          mem("M 8 " + y0 + " L 392 " + y0);
          api.circle(V, rv, {stroke: c.muted, width: 3.4, fill: c.c3, fillOpacity: 0.06});
          api.arrow([V[0] + rv + 8, V[1] + 2], [E[0] - re - 6, E[1]], {color: c.muted, width: 1.8, halo: false, head: 9});
        }
        if (pino) {
          // one fixed lattice of solutes over the whole picture; a dot shows wherever that spot is fluid, so densities match
          var keep = [[10, y0 - 22, 72, y0 - 6]].concat(s === 1 ? [[198, 32, 396, 50]] : []);
          var fluid = function (p) {
            if (p[0] < 12 || p[0] > 388 || keep.some(function (b) { return p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3]; })) return false;
            if (s === 1) return p[1] < dip(p[0]) - 8;
            if (p[1] < y0 - 8) return true;
            return s < 4 ? dist(p, q) < R - 8 : dist(p, V) < rv - 8 || dist(p, E) < re - 7;
          };
          for (var i = 0; i < 8; i++) for (var j = 0; j < 12; j++) {
            var jx = Math.sin(i * 127.1 + j * 311.7) * 43758.5, jy = Math.sin(i * 269.5 + j * 183.3) * 43758.5;
            var p = [14 + (i % 2) * 17 + j * 34 + 8 * (jx - Math.floor(jx) - 0.5), 16 + i * 29 + 8 * (jy - Math.floor(jy) - 0.5)];
            if (fluid(p)) api.circle(p, 3, {fill: c.c3});
          }
          if (s === 1) L([392, 41], "fluid with dissolved solutes", c.c3, {anchor: "end", weight: 500});
          else if (s === 2) { L([cx + R + 16, q[1] + 12], "same concentration", c.c3, {weight: 500}); L([cx + R + 16, q[1] + 27], "as outside", c.c3, {weight: 500}); }
          else if (s === 3) L([cx + n + 12, y0 + 16], "membrane seals", c.c3, {weight: 500});
        } else {
          LDL.forEach(function (p) { api.circle(p, 5, {fill: c.c3}); });
          L([74, 36], "LDL", c.c3);
          if (s === 1) {
            [-40, 0, 40].forEach(function (dx) { var y = dip(cx + dx); receptor([cx + dx, y - 100], 100, 90, true); });
            for (var x = cx - 60; x <= cx + 60; x += 12) api.line([x, dip(x) + 6], [x, dip(x) + 12], {color: c.c1, width: 2});
            L([cx + 56, y0 - 30], "LDL receptors", c.c2);
            L([cx + 70, y0 + 24], "clathrin", c.c1);
            // free clathrin triskelions in the cytosol, recruited to the patch by the AP-2 adaptor
            [[100, 158], [180, 182], [250, 150]].forEach(function (p) {
              [[-6, -7], [7, -5], [0, 8]].forEach(function (d) { api.line(p, [p[0] + d[0], p[1] + d[1]], {color: c.c1, width: 2}); });
              api.line([p[0], p[1] - 12], [p[0] + (cx - p[0]) * 0.25, p[1] - 12 - (p[1] - y0 - 30) * 0.5], {color: c.c1, width: 1.4, dash: "3 4", arrow: true, opacity: 0.7});
            });
          } else if (s < 4) {
            [50, 90, 130].forEach(function (a) { receptor(q, R, a, true); });
            bristles(q, R, s === 2 ? 0 : -45, s === 2 ? 180 : 225);
            L(s === 2 ? [cx + R + 16, q[1] + 12] : [cx + R + 12, q[1] + 34], "clathrin coat", c.c1);
            if (s === 3) {
              // dynamin: a collar on the cytosolic face of the neck, two turns on each side, clear of membrane and lumen
              [11, 21].forEach(function (dy) { [-1, 1].forEach(function (sg) { api.circle([cx + sg * (n + 9), y0 + dy], 4, {fill: c.c4}); }); });
              L([cx + n + 19, y0 + 16], "dynamin", c.c4);
            }
          } else {
            [30, 150, 270].forEach(function (a) { receptor(V, rv, a, true); });
            bristles(V, rv, -75, -15);
            [[V[0] - 56, y0 + 62], [V[0] - 64, y0 + 104]].forEach(function (p) { [[-6, -7], [7, -5], [0, 8]].forEach(function (d) { api.line(p, [p[0] + d[0], p[1] + d[1]], {color: c.c1, width: 2}); }); });
            L([V[0] - 60, 212], "coat falls off", c.c1, {anchor: "middle"});
            [[-13, 6], [11, -12], [8, 15], [-14, -13]].forEach(function (o) { api.circle([E[0] + o[0], E[1] + o[1]], 5, {fill: c.c3}); });
            api.line([E[0], E[1] - re - 3], [E[0], y0 + 9], {color: c.c2, width: 2, dash: "4 4", arrow: true});
            L([E[0] - 8, y0 + 28], "receptors recycle", c.c2, {anchor: "end"});
            L([E[0], 230], "LDL lets go", c.c6, {anchor: "middle", weight: 500});
          }
        }
      } else {
        // phagocytosis: a 100 x 40 bacterium; the cup's inner membrane runs 12 px off its surface, receptors bridge the gap
        var Cl = [cx - 30, y0 - 36], Cr = [cx + 30, y0 - 36], B = s < 3 ? [cx, y0 - 36] : [cx, y0 + 60];
        var zip = function (ql, qr, angL, angR, bottom) {
          angL.forEach(function (a) { tick(ql, 27, 21, a); });
          angR.forEach(function (a) { tick(qr, 27, 21, a); });
          bottom.forEach(function (x) { api.line([x, ql[1] + 27], [x, ql[1] + 21], {color: c.c2, width: 2.4}); });
        };
        if (s === 1) {
          mem("M 8 " + y0 + " L 392 " + y0);
          [-36, -12, 12, 36].forEach(function (dx) {
            var x = cx + dx;
            api.line([x, y0 - 4], [x, y0 - 11], {color: c.c2, width: 2.4});
            api.line([x, y0 - 11], [x - 4, y0 - 15], {color: c.c2, width: 2.2}); api.line([x, y0 - 11], [x + 4, y0 - 15], {color: c.c2, width: 2.2});
          });
          L([cx + 64, y0 - 18], "receptors grip it", c.c2);
        } else if (s === 2) {
          mem("M 8 " + y0 + " L " + (cx - 100) + " " + y0 + " C " + (cx - 84) + " " + y0 + " " + (cx - 78) + " " + (y0 - 14) + " " + D(P(Cl, 48, 180)) +
              " A 48 48 0 0 1 " + D(P(Cl, 48, 250)) + " A 8 8 0 0 1 " + D(P(Cl, 32, 250)) + " A 32 32 0 0 0 " + D(P(Cl, 32, 90)) +
              " L " + D(P(Cr, 32, 90)) + " A 32 32 0 0 0 " + D(P(Cr, 32, -70)) + " A 8 8 0 0 1 " + D(P(Cr, 48, -70)) + " A 48 48 0 0 1 " + D(P(Cr, 48, 0)) +
              " C " + (cx + 78) + " " + (y0 - 14) + " " + (cx + 84) + " " + y0 + " " + (cx + 100) + " " + y0 + " L 392 " + y0);
          [[188, 214], [222, 244]].forEach(function (g) {
            api.line(P(Cl, 40, g[0]), P(Cl, 40, g[1]), {color: c.c4, width: 2.2});
            api.line(P(Cr, 40, 180 - g[0]), P(Cr, 40, 180 - g[1]), {color: c.c4, width: 2.2});
          });
          zip(Cl, Cr, [115, 145, 175, 205, 235], [65, 35, 5, -25, -55], [cx - 18, cx, cx + 18]);
          L([cx + 96, y0 - 44], "actin drives", c.c4);
          L([cx + 96, y0 - 29], "pseudopods", c.c4);
          L([cx - 84, y0 - 66], "receptors", c.c2, {anchor: "end"});
          L([cx - 84, y0 - 51], "zip it in", c.c2, {anchor: "end", weight: 500});
        } else if (s === 3) {
          mem("M 8 " + y0 + " L 392 " + y0);
          var ql = [cx - 30, B[1]], qr = [cx + 30, B[1]];
          mem("M " + D(P(ql, 32, -90)) + " L " + D(P(qr, 32, -90)) + " A 32 32 0 0 1 " + D(P(qr, 32, 90)) + " L " + D(P(ql, 32, 90)) + " A 32 32 0 0 1 " + D(P(ql, 32, -90)) + " Z");
          zip(ql, qr, [120, 160, 200, 240], [60, 20, -20, -60], [cx - 18, cx, cx + 18]);
          [cx - 18, cx, cx + 18].forEach(function (x) { api.line([x, B[1] - 27], [x, B[1] - 21], {color: c.c2, width: 2.4}); });
          L([cx + 80, B[1]], "phagosome", c.ink);
        } else {
          mem("M 8 " + y0 + " L 392 " + y0);
          api.rect(cx - 78, y0 + 22, 156, 80, {fill: c.c6, fillOpacity: 0.14, stroke: c.c6, width: 2.2, rx: 40});
          [[-46, 16], [44, 10], [66, 48], [-56, 56], [10, 66], [-10, 18], [74, 26], [-66, 34]].forEach(function (o) { api.circle([cx + o[0], y0 + 22 + o[1]], 3, {fill: c.c6}); });
          [[-38, 34, 28], [-6, 46, 22], [24, 32, 26]].forEach(function (f) { api.rect(cx + f[0], y0 + f[1], f[2], 14, {fill: c.c3, fillOpacity: 0.5, stroke: c.c3, width: 1.4, rx: 7}); });
          L([cx + 92, y0 + 52], "phagolysosome:", c.c6);
          L([cx + 92, y0 + 68], "enzymes digest it", c.c6, {weight: 500});
        }
        if (s < 4) {
          api.circle([330, 186], 24, {fill: c.c6, fillOpacity: 0.12, stroke: c.c6, width: 2});
          [[-10, -8], [8, -10], [-2, 6], [12, 8], [-12, 10]].forEach(function (o) { api.circle([330 + o[0], 186 + o[1]], 2.6, {fill: c.c6}); });
          L([330, 224], "lysosome", c.c6, {anchor: "middle"});
          api.rect(B[0] - 50, B[1] - 20, 100, 40, {fill: c.c3, fillOpacity: 0.35, stroke: c.c3, width: 2, rx: 20});
          L(s < 3 ? [cx, s === 1 ? 40 : 14] : [cx - 74, B[1]], "bacterium", c.c3, {anchor: s < 3 ? "middle" : "end"});
        }
      }
      // the band: what sets this type apart
      api.line([16, BY - 6], [384, BY - 6], {color: c.faint, width: 1});
      if (!phago) {
        L([106, BY + 10], "outside", c.muted, {anchor: "end", weight: 500});
        L([106, BY + 32], "in the vesicle", c.muted, {anchor: "end", weight: 500});
        api.rect(114, BY + 4, 40, 12, {fill: c.c3, fillOpacity: 0.8, rx: 2});
        L([160, BY + 10], "1×", c.c3);
        L([196, BY + 10], rm ? "LDL: receptors concentrate it" : "solutes: 1 : 1, nonselective", c.ink, {weight: 500});
        if (rm) {
          api.rect(114, BY + 26, 106, 12, {fill: c.c3, fillOpacity: 0.8, rx: 2});
          api.rect(230, BY + 26, 100, 12, {fill: c.c3, fillOpacity: 0.8, rx: 2});
          [220, 226].forEach(function (x) { api.line([x - 1, BY + 41], [x + 5, BY + 23], {color: c.c3, width: 1.6}); });
          L([336, BY + 32], "≫ 1×", c.c3);
        } else {
          api.rect(114, BY + 26, 40, 12, {fill: c.c3, fillOpacity: 0.8, rx: 2});
          L([160, BY + 32], "1×", c.c3);
        }
      } else {
        // to scale at 50 px per µm: a 2 µm bacterium, a 0.1 µm vesicle and a 1 µm bar
        api.rect(16, BY - 1, 100, 24, {fill: c.c3, fillOpacity: 0.35, stroke: c.c3, width: 1.6, rx: 12});
        L([66, BY + 11], "2 µm", c.c3, {anchor: "middle"});
        api.line([16, BY + 34], [66, BY + 34], {color: c.muted, width: 2});
        [16, 66].forEach(function (x) { api.line([x, BY + 30], [x, BY + 38], {color: c.muted, width: 1.6}); });
        L([72, BY + 34], "1 µm", c.muted, {weight: 500});
        api.circle([140, BY + 10], 2.5, {fill: c.muted});
        L([150, BY + 10], "pinocytic vesicle ≈ 0.1 µm, to scale", c.muted, {weight: 500});
        L([134, BY + 34], "a phagosome is > 0.25 µm across", c.ink, {weight: 500});
      }
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
