// Regulated exocytosis at a synapse. A vesicle full of neurotransmitter docks at the active zone next to voltage-gated
// Ca2+ channels; its v-SNARE (synaptobrevin) starts to zip with the plasma membrane's t-SNAREs (syntaxin, SNAP-25),
// priming it, while synaptotagmin holds the last step. An action potential opens the channels, local Ca2+ binds
// synaptotagmin, the SNAREs zip fully, a fusion pore opens and transmitter floods the cleft; the vesicle membrane flattens
// into the plasma membrane and is later retrieved by endocytosis. Release rises steeply with Ca2+ because several Ca2+
// ions must bind (Dodge and Rahamimoff's fourth-power law): P = [Ca]^4 / ([Ca]^4 + K^4), with K = 10 uM as a typical
// half-activation (schematic). The bottom row is an active zone of 6 docked vesicles, round(6P) of them drawn fusing.
// Colors: teal = transmitter (and the release curve), amber = Ca2+, blue = v-SNARE, red = t-SNARE, purple = synaptotagmin.
(function () {
  var K = 10, ORDER = [2, 4, 0, 5, 1, 3];
  function P(ca) { return Math.pow(ca, 4) / (Math.pow(ca, 4) + Math.pow(K, 4)); }
  function pn(p) { return p >= 0.995 ? Viz.n(p, 3) : p >= 0.01 ? Viz.n(p, 2) : p > 0 ? Viz.n(p, 4) : "0"; }
  var TX = [[-12, -8], [4, -12], [14, -2], [-4, 2], [-14, 8], [8, 12], [-2, 16]];

  Viz.register("exocytosis-vesicle-secretion", {
    title: "Exocytosis: Ca²⁺-triggered secretion",
    subject: "biology",
    shows: "Step a synaptic vesicle from docking to fusion and slide the local calcium level: SNAREs zip the vesicle to the membrane, calcium binding synaptotagmin opens the fusion pore, and release climbs with the fourth power of calcium",
    params: {
      ca: {kind: "integer", default: 10, min: 0, max: 50, label: "[\\text{Ca}^{2+}]"}
    },
    steps: ["dock beside Ca²⁺ channels", "prime: SNAREs start to zip", "Ca²⁺ rushes in", "fusion pore opens", "membrane merges"],
    stepMs: 1600,
    formula: function (v) {
      return "P=\\frac{[\\text{Ca}^{2+}]^4}{[\\text{Ca}^{2+}]^4+K^4}=\\frac{" + v.ca + "^4}{" + v.ca + "^4+" + K + "^4}=" + pn(P(v.ca));
    },
    status: function (v) {
      var s = v.step || 1, p = P(v.ca), k = Math.round(6 * p);
      if (s === 1) return "A vesicle full of neurotransmitter docks beside voltage-gated Ca²⁺ channels; at " + v.ca + " µM Ca²⁺ a docked vesicle would fuse with probability <b>" + pn(p) + "</b>.";
      if (s === 2) return "Its v-SNARE (synaptobrevin) starts to zip with the membrane's t-SNAREs (syntaxin, SNAP-25), priming it, while <b>synaptotagmin</b> waits for Ca²⁺.";
      if (s === 3) return v.ca ? "An action potential opens the channels and local Ca²⁺ jumps to <b>" + v.ca + " µM</b>, where it binds synaptotagmin on the vesicle."
                               : "The channels open but no Ca²⁺ flows in, so synaptotagmin stays empty and the vesicle waits.";
      if (s === 4) return k ? "The SNAREs zip fully, a fusion pore opens and <b>" + k + " of 6</b> docked vesicles release their transmitter into the cleft (P = " + pn(p) + ")."
                            : "At " + v.ca + " µM Ca²⁺, P = " + pn(p) + ", so <b>none</b> of the 6 docked vesicles is expected to fuse and no transmitter is released.";
      return k ? "The fused vesicle membrane flattens into the plasma membrane, adding its area, and <b>endocytosis</b> later retrieves it for refilling."
               : "No vesicle fused, so the membrane is unchanged and the docked vesicles stay <b>primed</b> for the next action potential.";
    },
    examples: [
      {name: "no calcium: nothing fuses", values: {ca: 0, step: 4}},
      {name: "half-activation", values: {ca: 10, step: 4}},
      {name: "saturating calcium", values: {ca: 50, step: 4}},
      {name: "membrane merges", values: {ca: 20, step: 5}}
    ],
    size: [400, 292],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, p = P(v.ca), k = Math.round(6 * p), fuse = k > 0 && s >= 4, y0 = 80, cx = 132, R = 28;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var mem = function (d) { api.path(d, {stroke: c.muted, width: 8, opacity: 0.55}); api.path(d, {stroke: c.card, width: 2.6}); };
      var coil = function (x, ya, yb) {
        var a = [], b = [];
        for (var y = ya; y <= yb; y += 1.5) { a.push([x + 2.6 * Math.sin((y - ya) / 2.2), y]); b.push([x - 2.6 * Math.sin((y - ya) / 2.2), y]); }
        api.polyline(a, {stroke: c.c2, width: 2.2}); api.polyline(b, {stroke: c.c5, width: 2.2});
      };
      L([12, 14], "outside: synaptic cleft", c.muted, {weight: 500});
      L([12, 176], "axon terminal (inside)", c.muted, {weight: 500});
      // the release site: plasma membrane, Ca2+ channels, the vesicle and its SNAREs
      var V = [cx, y0 + 14 + R];
      if (fuse && s === 4) {
        var n = 11, yc = y0 + Math.sqrt(R * R - n * n);
        mem("M 8 " + y0 + " L " + (cx - n) + " " + y0 + " A " + R + " " + R + " 0 1 0 " + (cx + n) + " " + y0 + " L 256 " + y0);
        TX.slice(0, 3).forEach(function (o) { api.circle([cx + o[0], yc + 8 + o[1] * 0.6], 3, {fill: c.c1}); });
        [[-6, -12], [8, -20], [-14, -26], [2, -34], [18, -30], [-24, -18], [26, -14]].forEach(function (o) { api.circle([cx + o[0], y0 + o[1]], 3, {fill: c.c1}); });
        coil(cx - n - 8, y0 + 4, y0 + 14); coil(cx + n + 8, y0 + 4, y0 + 14);
        L([cx + 38, y0 - 44], "fusion pore:", c.c1);
        L([cx + 38, y0 - 30], "transmitter out", c.c1, {weight: 500});
      } else if (fuse) {
        mem("M 8 " + y0 + " L " + (cx - 40) + " " + y0 + " Q " + cx + " " + (y0 + 22) + " " + (cx + 40) + " " + y0 + " L 256 " + y0);
        [[-60, -20], [-30, -40], [0, -26], [30, -46], [56, -22], [84, -38], [-84, -36]].forEach(function (o) { api.circle([cx + o[0], y0 + o[1]], 3, {fill: c.c1}); });
        coil(cx - 6, y0 + 3, y0 + 11);
        L([cx, y0 + 42], "vesicle membrane merged", c.muted, {anchor: "middle", weight: 500});
        L([cx, y0 + 57], "into the surface", c.muted, {anchor: "middle", weight: 500});
      } else {
        mem("M 8 " + y0 + " L 256 " + y0);
        api.circle(V, R, {stroke: c.muted, width: 3, fill: c.c1, fillOpacity: 0.07});
        TX.forEach(function (o) { api.circle([V[0] + o[0], V[1] + o[1]], 3, {fill: c.c1}); });
        if (s === 1) {
          [cx - 12, cx + 12].forEach(function (x) {
            api.line([x, V[1] - R + 1], [x, V[1] - R - 5], {color: c.c2, width: 2.4});
            api.line([x, y0 + 4], [x, y0 + 8], {color: c.c5, width: 2.4});
          });
          L([cx + R + 14, y0 + 20], "v-SNARE", c.c2);
          L([cx + R + 14, y0 + 6], "t-SNARE", c.c5);
        } else {
          coil(cx - 12, y0 + 4, V[1] - R + 1); coil(cx + 12, y0 + 4, V[1] - R + 1);
          if (s === 2) L([cx + R + 10, V[1] - 8], "SNAREs zipping", c.c2);
        }
        // synaptotagmin on the vesicle, with Ca2+ bound from step 3
        [-150, -30].forEach(function (deg) {
          var a = deg * Math.PI / 180, q = [V[0] + (R + 5) * Math.cos(a), V[1] + (R + 5) * Math.sin(a)];
          api.rect(q[0] - 5, q[1] - 4, 10, 8, {fill: c.c6, rx: 3});
          if (s >= 3 && v.ca > 0) { api.circle([q[0] + (deg < -90 ? -7 : 7), q[1] - 5], 2.6, {fill: c.c3}); api.circle([q[0] + (deg < -90 ? -9 : 9), q[1] + 3], 2.6, {fill: c.c3}); }
        });
        if (s >= 2) L([cx - R - 16, V[1] + 8], "synaptotagmin", c.c6, {anchor: "end"});
        if (s >= 4) L([cx + R + 14, V[1] + 22], "no fusion", c.muted, {weight: 500});
      }
      // voltage-gated Ca2+ channels, open from step 3, with Ca2+ flowing in
      [28, 240].forEach(function (x) {
        api.rect(x - 8, y0 - 11, 16, 22, {fill: c.c3, fillOpacity: s >= 3 ? 0.3 : 0.12, stroke: c.c3, width: 1.6, rx: 4});
        api.line([x, y0 - 8], [x, y0 + 8], {color: s >= 3 ? c.card : c.c3, width: s >= 3 ? 3 : 1.6});
      });
      if (s <= 3) L([44, y0 - 16], "Ca²⁺ channel", c.c3);
      if (s >= 3 && v.ca > 0) {
        var nCa = Math.min(8, Math.max(1, Math.round(v.ca / 6)));
        for (var i = 0; i < nCa; i++) {
          var side = i % 2 ? 240 : 28, t = Math.floor(i / 2);
          api.circle([side + (t % 2 ? 5 : -5), y0 + 18 + t * 9], 2.8, {fill: c.c3});
        }
        if (s === 3) [[20, 24], [34, 32], [232, 26], [248, 34]].forEach(function (q) { api.circle([q[0], y0 - q[1]], 2.8, {fill: c.c3, opacity: 0.7}); });
      }
      // the release curve: P against Ca2+
      var gx0 = 284, gx1 = 386, gy0 = 150, gy1 = 46, GX = function (x) { return gx0 + (gx1 - gx0) * x / 50; }, GY = function (q) { return gy0 - (gy0 - gy1) * q; };
      L([gx0 - 8, 22], "release vs Ca²⁺", c.muted, {weight: 500});
      api.line([gx0, gy0], [gx1, gy0], {color: c.axis, width: 1.2}); api.line([gx0, gy0], [gx0, gy1 - 4], {color: c.axis, width: 1.2});
      var pts = []; for (var x = 0; x <= 50; x += 0.5) pts.push([GX(x), GY(P(x))]);
      api.polyline(pts, {stroke: c.c1, width: 2.4});
      api.line([GX(v.ca), gy0], [GX(v.ca), GY(p)], {color: c.c3, width: 1.2, dash: "3 3"});
      api.point([GX(v.ca), GY(p)], {color: c.c3, r: 4.5});
      L([GX(v.ca) + (v.ca > 30 ? -8 : 8), GY(p) + (p > 0.6 ? 14 : -12)], "P = " + pn(p), c.c3, {anchor: v.ca > 30 ? "end" : "start"});
      L([gx0 - 5, gy1], "1", c.muted, {anchor: "end", weight: 500});
      L([gx0, gy0 + 13], "0", c.muted, {anchor: "middle", weight: 500});
      L([GX(K) + 2, gy0 + 13], "K = 10", c.muted, {anchor: "start", weight: 500});
      L([gx1, gy0 + 13], "50 µM", c.muted, {anchor: "end", weight: 500});
      // the active zone: 6 docked vesicles, round(6P) fused from step 4
      var yr = 218;
      var d = "M 16 " + yr;
      var fusedSet = []; for (i = 0; i < 6; i++) fusedSet.push(s >= 4 && ORDER.indexOf(i) < k);
      for (i = 0; i < 6; i++) { var x6 = 50 + i * 60; if (fusedSet[i]) d += " L " + (x6 - 9) + " " + yr + " A 14 14 0 1 0 " + (x6 + 9) + " " + yr; }
      mem(d + " L 384 " + yr);
      for (i = 0; i < 6; i++) {
        var xv = 50 + i * 60;
        if (fusedSet[i]) [[-4, -8], [5, -15], [-3, -22]].forEach(function (o) { api.circle([xv + o[0], yr + o[1]], 2.6, {fill: c.c1}); });
        else { api.circle([xv, yr + 22], 14, {stroke: c.muted, width: 2.4, fill: c.c1, fillOpacity: 0.07}); [[-5, -3], [5, 2], [-1, 6]].forEach(function (o) { api.circle([xv + o[0], yr + 22 + o[1]], 2.4, {fill: c.c1}); }); }
      }
      L([200, 270], s >= 4 ? "active zone: " + k + " of 6 docked vesicles fuse (6 × P = " + Viz.fmt(6 * p, 1) + ")" : "active zone: 6 docked vesicles, 6 × P = " + Viz.fmt(6 * p, 1) + " expected to fuse",
        s >= 4 ? c.c1 : c.muted, {anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
