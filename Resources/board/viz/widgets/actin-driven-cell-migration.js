// A crawling cell's four-phase cycle (protrude, adhere, contract, release) seen from the side, with the leading edge
// close up. At the front, actin polymerizes against the membrane while the network slides back (retrograde flow,
// driven by myosin II and membrane tension). The edge moves at the difference: v_edge = v_poly - v_retro, the
// molecular-clutch picture (Ponti et al. 2004; Mitchison and Kirschner 1988). Adhesions engage the clutch and slow
// the rearward flow; when flow matches polymerization the edge stalls and the cell cannot advance.
Viz.register("actin-driven-cell-migration", {
  title: "Actin-driven cell migration",
  subject: "biology",
  shows: "Step through protrude, adhere, contract and release; slide polymerization and rearward flow to see that the front moves at their difference",
  params: {
    vPoly: {kind: "number", default: 2, min: 0, max: 4, step: 0.1, label: "v_{\\text{poly}}"},
    vRetro: {kind: "number", default: 0.8, min: 0, max: 4, step: 0.1, label: "v_{\\text{retro}}"}
  },
  steps: ["protrude: actin pushes the front", "adhere: new adhesions grip", "contract: myosin II pulls the body", "release: the rear lets go"],
  stepMs: 1700,
  formula: function (v) {
    return "v_{\\text{edge}} = v_{\\text{poly}} - v_{\\text{retro}} = " + Viz.n(v.vPoly, 1) + " - " + Viz.n(v.vRetro, 1) + " = " + Viz.n(v.vPoly - v.vRetro, 1) + "\\ \\mu\\text{m/min}";
  },
  status: function (v) {
    var e = v.vPoly - v.vRetro, s = v.step || 1, f = Viz.fmt(e, 1), a = Viz.fmt(v.vPoly, 1), b = Viz.fmt(v.vRetro, 1);
    if (e < -1e-9) return "The edge <b>retracts</b> at " + Viz.fmt(-e, 1) + " µm/min: the network slides back (" + b + ") faster than it grows (" + a + "), so there is no protrusion to grip and the cell cannot advance.";
    if (e < 1e-9) return "The edge <b>stalls</b>: rearward flow (" + b + " µm/min) cancels polymerization (" + a + "), so actin turns over in place, nothing new protrudes and the cell stays put.";
    return ["Actin filaments grow against the front membrane (Arp2/3 branches them into a flat lamellipodium), so the edge advances <b>" + f + " µm/min</b>: " + a + " of growth minus " + b + " of rearward flow.",
            "Integrins under the new front bind the matrix and build focal adhesions, a clutch that holds the network so its growth pushes the edge on at <b>" + f + " µm/min</b>.",
            "Myosin II pulls on actin stress fibers anchored at the adhesions, dragging the cell body and nucleus forward toward the front, which keeps moving at <b>" + f + " µm/min</b>.",
            "Rear adhesions come apart and the tail retracts, so the whole cell has moved forward; repeating the cycle, it crawls at about the edge's <b>" + f + " µm/min</b>."][s - 1];
  },
  examples: [
    {name: "minimums: no growth, no flow", values: {vPoly: 0, vRetro: 0, step: 1}},
    {name: "maximums: flow cancels growth", values: {vPoly: 4, vRetro: 4, step: 2}},
    {name: "fast front, strong grip", values: {vPoly: 4, vRetro: 0, step: 4}},
    {name: "flow beats growth: edge retracts", values: {vPoly: 1, vRetro: 3, step: 1}},
    {name: "myosin pulls the body", values: {step: 3}}
  ],
  size: [400, 320],
  draw: function (api, v) {
    var c = api.color, s = v.step || 1, e = v.vPoly - v.vRetro;
    // ---- close-up of the leading edge: a branched network above, the three velocities in their own lane below ----
    api.label([14, 14], "leading edge, close up", {color: c.muted, size: 12});
    var mx = 292, t35 = Math.tan(35 * Math.PI / 180), yT = 22, yB = 66;
    var memX = function (y) { var t = (y - yT) / (yB - yT); return mx + 12 * t * (1 - t); };
    // a dendritic network built front-ward, generation by generation: each filament runs at 35 degrees to the push
    // direction until its barbed end meets the membrane (or it leaves the sheet and is capped); Arp2/3 nucleates
    // daughters on its side at 70 degrees, so they run at the mirror angle
    var fil = [], dots = [], queue = [[198, 25, 1], [206, 64, -1]];
    while (queue.length && fil.length < 20) {
      var q0 = queue.shift(), x0 = q0[0], y0 = q0[1], sgn = q0[2], xe = mx, ye;
      for (var it = 0; it < 4; it++) { ye = y0 + sgn * t35 * (xe - x0); xe = memX(Math.max(yT, Math.min(yB, ye))) - 2.5; }
      ye = y0 + sgn * t35 * (xe - x0);
      if (ye < yT || ye > yB) { ye = ye < yT ? yT : yB; xe = x0 + (ye - y0) / (sgn * t35); }
      fil.push([x0, y0, xe, ye]);
      for (var dd = 14; dd < xe - x0 - 10 && x0 + dd < mx - 12; dd += 24) {
        var bx = x0 + dd, by = y0 + sgn * t35 * dd;
        dots.push([bx, by]); queue.push([bx, by, -sgn]);
      }
    }
    fil.forEach(function (f) {
      api.line([f[0], f[1]], [f[2], f[3]], {color: c.muted, width: 1.7, opacity: 0.85});
      if (f[3] > yT && f[3] < yB) api.circle([f[2], f[3]], 2.2, {fill: c.c4}); // a free barbed end at the membrane: subunits add here
    });
    dots.forEach(function (q) { if (fil.some(function (f) { return f[0] === q[0] && f[1] === q[1]; })) api.circle(q, 2.3, {fill: c.c3}); });
    api.label([174, 36], "Arp2/3", {color: c.c3, size: 12, anchor: "end"});
    api.label([174, 52], "branches", {color: c.c3, size: 12, anchor: "end"});
    api.path("M " + mx + " " + (yT - 2) + " Q " + (mx + 6) + " " + (yT + yB) / 2 + " " + mx + " " + (yB + 2), {stroke: c.ink, width: 2.4});
    api.label([mx, 14], "membrane", {color: c.ink, size: 12, anchor: "middle"});
    api.label([mx + 10, (yT + yB) / 2], "← barbed ends", {color: c.c4, size: 12});
    api.line([mx, yB + 6], [mx, 124], {color: c.faint, width: 1, dash: "2 3"});
    var k = 22, minLen = 16; // px per um/min in the close-up; a nonzero speed never draws shorter than its head
    var rows = [["polymerization", c.c4, 80, v.vPoly], ["retrograde flow", c.c5, 98, -v.vRetro], ["edge velocity", c.c1, 116, e]];
    rows.forEach(function (r) {
      api.label([14, r[2]], r[0], {color: r[1], size: 12.5, weight: 600});
      api.label([124, r[2]], (r[0] === "edge velocity" && r[3] < -1e-9 ? "−" : "") + api.fmt(Math.abs(r[3]), 1) + " µm/min", {color: r[1], size: 12});
      if (Math.abs(r[3]) > 1e-9) {
        var len = Math.max(minLen, Math.abs(r[3]) * k) * (r[3] > 0 ? 1 : -1);
        api.arrow([mx, r[2]], [mx + len, r[2]], {color: r[1], width: 3});
      } else api.point([mx, r[2]], {color: r[1], r: 3.5});
    });
    var dy = 20;
    api.line([10, 116 + dy], [390, 116 + dy], {color: c.grid, width: 1});
    // ---- the whole cell from the side; a retracting front is pulled back behind the dashed starting outline ----
    var kc = 16, g = 266 + dy, d = Math.max(-4, Math.min(4, e)) * kc, dp = Math.max(0, d), xr0 = 30, xb0 = 128, xf0 = 240;
    var xr = xr0 + (s >= 4 ? dp : 0), xb = xb0 + (s >= 3 ? dp : 0), xf = xf0 + d;
    var shape = function (r, b, f) {
      var q = Math.min(1, (f - b) / 112); // a front pulled back toward the body keeps its shape, compressed
      return "M " + r + " " + g + " C " + r + " " + (236 + dy) + " " + (b - 70) + " " + (158 + dy) + " " + b + " " + (158 + dy) + " C " + (b + 52 * q) + " " + (158 + dy) + " " + (b + 64 * q) + " " + (226 + dy) + " " + (b + 92 * q) + " " + (246 + dy) + " L " +
        (f - 8 * q) + " " + (253 + dy) + " Q " + f + " " + (254 + dy) + " " + f + " " + (259 + dy) + " L " + f + " " + g + " Z";
    };
    api.path(shape(xr0, xb0, xf0), {stroke: c.faint, width: 1.2, dash: "4 4"});
    api.path(shape(xr, xb, xf), {fill: c.card}); // the cell hides the part of its old outline it now covers
    api.path(shape(xr, xb, xf), {stroke: c.c2, width: 2, fill: c.c2, fillOpacity: 0.12});
    api.path("M " + (xb - 30) + " " + (212 + dy) + " a 30 17 0 1 0 60 0 a 30 17 0 1 0 -60 0", {stroke: c.c6, width: 1.5, fill: c.c6, fillOpacity: 0.18});
    api.label([xb, 212 + dy], "nucleus", {color: c.c6, size: 12, anchor: "middle"});
    api.line([8, g], [392, g], {color: c.axis, width: 2});
    api.label([14, 284 + dy], "substrate (extracellular matrix)", {color: c.muted, size: 12});
    api.label([388, 132 + dy], "migration →", {color: c.muted, size: 12, anchor: "end"});
    // adhesions: rear, an older one under the body, and (from step 2) a new one under the front
    var adh = function (x, on) { api.rect(x - 7, g - 5, 14, 5, {fill: c.c4, fillOpacity: on ? 1 : 0.3, rx: 2}); };
    adh(xr0 + 18, s < 4); adh(xb0 + 44, true);
    if (s >= 2 && dp > 0) adh(xf0 + dp - 22, true);
    if (d < 0) { // the front itself moves back at |v_edge|
      api.arrow([xf0 + 2, 240 + dy], [Math.min(xf + 2, xf0 - 14), 240 + dy], {color: c.c1, width: 2.5, halo: false});
      api.label([xf0 + 6, 256 + dy], "front retracts", {color: c.c1, size: 12, weight: 600});
    }
    if (s === 1) {
      if (d >= 0) api.label([xf + 6, 256 + dy], d > 0 ? "lamellipodium" : "lamellipodium stalls", {color: c.c2, size: 12});
      if (d > 0) api.arrow([xf0 - 4, 240 + dy], [xf, 240 + dy], {color: c.c1, width: 2.5, halo: false});
    } else if (s === 2) {
      if (dp > 0) api.line([xf0 + dp - 22, 154 + dy], [xf0 + dp - 22, g - 8], {color: c.c4, width: 1.2, dash: "3 3"});
      api.label([388, 146 + dy], dp > 0 ? "new adhesion: integrins grip" : "no new adhesion: nothing to grip", {color: c.c4, size: 12, anchor: "end"});
    } else if (s === 3) {
      var y3 = 255 + dy, a0 = xr0 + 22, a1 = xf - 24;
      api.line([a0, y3], [a1, y3], {color: c.c5, width: 2.5});
      for (var m = a0 + 22; m < a1 - 10; m += 34) { api.line([m - 4, y3 - 4], [m - 4, y3 + 4], {color: c.c5, width: 2}); api.line([m + 4, y3 - 4], [m + 4, y3 + 4], {color: c.c5, width: 2}); }
      api.label([xb + 70, 146 + dy], "myosin II contracts stress fibers", {color: c.c5, size: 12, anchor: "start"});
      if (dp > 0) api.arrow([xb0, 146 + dy], [xb, 146 + dy], {color: c.c6, width: 2.5, halo: false});
    } else {
      api.rect(xr0 + 11, g + 3, 14, 5, {fill: c.c4, fillOpacity: 0.3, rx: 2});
      api.label([xr0 - 4, 146 + dy], dp > 0 ? "rear adhesion releases, tail retracts" : "rear adhesion releases", {color: c.c4, size: 12});
      if (dp > 0) api.arrow([xr0, 248 + dy], [xr, 248 + dy], {color: c.c4, width: 2.5, halo: false});
    }
    api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
  }
});
