// The fluid mosaic model: a phospholipid bilayer with cholesterol, an integral (transmembrane) glycoprotein, a
// peripheral protein and a glycolipid, drawn in cross-section. Temperature, the share of tails with a cis double bond
// and the cholesterol content set how fluid it is. Schematic model (directions are right, numbers are approximate):
//   melting point of the tails  Tm = 41 - 58 u  (C), from all-saturated 16:0 (DPPC, 41 C) to all 18:1 (DOPC, -17 C)
//   melting range half-width    w = 3 + 25 x   (x = cholesterol / 50 %): cholesterol broadens the transition
//   fluidity  F = (1 - 0.6 x) s + 0.36 x,   s = 1 / (1 + e^-(T - Tm)/w)  -> cholesterol pulls F toward the middle:
//   it stiffens a warm membrane and keeps a cold one from packing into a gel.
// The queue's fixtures (a, b, c, d from -12 to 12) are a generic schema with no meaning for a membrane; the two
// boundary examples here put every one of this widget's own parameters at its minimum and at its maximum instead.
(function () {
  function model(v) {
    var tm = 41 - 58 * v.u, x = v.chol / 50, w = 3 + 25 * x, s = 1 / (1 + Math.exp(-(v.temp - tm) / w));
    return {tm: tm, w: w, F: (1 - 0.6 * x) * s + 0.36 * x};
  }
  function phase(F) { return F < 0.3 ? "gel" : F > 0.65 ? "fluid" : "between"; }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

  Viz.register("fluid-mosaic-membrane", {
    title: "The fluid mosaic membrane",
    subject: "biology",
    shows: "A bilayer of phospholipids with cholesterol and proteins drifting in it: warm it, add kinked unsaturated tails or change the cholesterol, and watch the tails pack into a gel or loosen into a fluid",
    params: {
      temp: {kind: "number", default: 37, min: 0, max: 50, step: 1, label: "T\\ (^{\\circ}\\mathrm{C})"},
      u: {kind: "number", default: 0.5, min: 0, max: 1, step: 0.05, label: "u\\ \\text{(unsat.)}"},
      chol: {kind: "number", default: 30, min: 0, max: 50, step: 5, label: "\\text{chol.}\\ \\%"}
    },
    formula: function (v) {
      var tm = Math.round(model(v).tm * 10) / 10;
      return "T_m\\approx 41-58u=" + Viz.n(tm, 1) + "^{\\circ}\\mathrm{C}\\newline T-T_m=" + Viz.n(v.temp) + "-" + Viz.p(tm, 1) + "=" + Viz.n(v.temp - tm, 1) + "^{\\circ}\\mathrm{C}";
    },
    status: function (v) {
      var m = model(v), ph = phase(m.F), d = Viz.fmt(Math.abs(v.temp - m.tm), 1);
      var head = ph === "gel" ? "<b>Gel</b>: " + (v.temp < m.tm ? d + " °C below" : "only " + d + " °C above") + " the tails' melting point, they pack straight and tight, so proteins barely drift" :
                 ph === "fluid" ? "<b>Fluid</b>: " + (v.temp >= m.tm ? d + " °C above" : "despite being " + d + " °C below") + " the tails' melting point, the tails flex and lipids and proteins drift sideways freely" :
                 "<b>Partly ordered</b>: tails are neither packed nor loose, so lipids and proteins drift slowly";
      var buf = v.chol >= 25 ? "; the " + v.chol + "% cholesterol buffers it, stiffening a warm membrane and keeping a cold one from freezing into a gel." :
                v.u >= 0.6 ? "; the many cis kinks in the tails keep them from packing." : ".";
      return head + buf;
    },
    examples: [
      {name: "Minimum supported values", values: {temp: 0, u: 0, chol: 0}},
      {name: "Maximum supported values", values: {temp: 50, u: 1, chol: 50}},
      {name: "cold and saturated, no cholesterol: gel", values: {temp: 10, u: 0.2, chol: 0}},
      {name: "same cold membrane with cholesterol", values: {temp: 10, u: 0.2, chol: 40}},
      {name: "warm and unsaturated: fluid", values: {temp: 37, u: 0.8, chol: 0}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v), F = m.F, mid = 118, L = 40 - 6 * F, hyO = mid - L - 7, hyI = mid + L + 7, r = rng(11);
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var PX = 70, GX = 345, PER = 250, sp = 23;
      var nU = Math.round(v.u * 32), order = [5, 12, 1, 27, 9, 20, 15, 30, 3, 24, 7, 18, 11, 29, 0, 22, 14, 6, 26, 2, 19, 10, 31, 4, 23, 16, 8, 28, 13, 21, 25, 17];
      var kinked = {}; for (var k = 0; k < nU; k++) kinked[order[k]] = true;
      var amp = 0.6 + 4.5 * F;
      var lipid = function (x, hy, dir, idx) {
        [-3, 3].forEach(function (off, t) {
          var pts = [], ph = r() * 6.28, kink = t === 1 && kinked[idx];
          for (var j = 0; j <= 6; j++) {
            var dy = 6 + j * (L - 6) / 6, wob = amp * Math.sin(ph + j * 1.4) * j / 6, bend = kink && j > 3 ? (j - 3) * 4.5 : 0;
            pts.push([x + off + wob + bend, hy + dir * dy]);
          }
          api.polyline(pts, {stroke: c.muted, width: 1.6});
        });
        api.circle([x, hy], 6, {fill: c.c2, fillOpacity: 0.85});
      };
      // phospholipids in both leaflets, leaving room for the integral protein and the glycolipid
      for (var i = 0; i < 16; i++) {
        var x = 22 + i * sp;
        if (Math.abs(x - PX) < 26) continue;
        if (Math.abs(x - GX) > 8) lipid(x, hyO, 1, i);
        lipid(x, hyI, -1, 16 + i);
      }
      // glycolipid: a lipid whose head carries a sugar chain on the outside
      lipid(GX, hyO, 1, 31);
      api.polyline([[GX, hyO - 6], [GX, hyO - 16], [GX - 6, hyO - 25], [GX - 4, hyO - 34]], {stroke: c.c6, width: 2});
      [[GX, hyO - 16], [GX - 6, hyO - 25], [GX - 4, hyO - 34], [GX + 7, hyO - 23]].forEach(function (p) { api.circle(p, 3.2, {fill: c.c6}); });
      api.line([GX, hyO - 16], [GX + 7, hyO - 23], {color: c.c6, width: 2});
      T([386, 8], "glycolipid", c.c6, {anchor: "end"}); api.line([GX + 4, 14], [GX - 2, hyO - 38], {color: c.c6, width: 1, dash: "2 2"});
      // cholesterol in the gaps between phospholipids: OH by the heads, rigid rings in the upper tail region
      var slots = []; for (var g = 0; g < 15; g++) { var gx = 22 + (g + 0.5) * sp; if (Math.abs(gx - PX) > 30) { slots.push([gx, hyO, 1]); slots.push([gx, hyI, -1]); } }
      var nC = Math.min(slots.length, Math.round(32 * v.chol / (100 - v.chol))), shuffle = rng(5), used = [];
      for (var q = 0; q < slots.length; q++) { var jj = q + Math.floor(shuffle() * (slots.length - q)), tmp = slots[q]; slots[q] = slots[jj]; slots[jj] = tmp; }
      slots.slice(0, nC).forEach(function (s) {
        api.circle([s[0], s[1] + s[2] * 3], 2.6, {fill: c.c3});
        api.rect(s[0] - 3, Math.min(s[1] + s[2] * 7, s[1] + s[2] * 24), 6, 17, {fill: c.c3, fillOpacity: 0.8, rx: 2});
        api.line([s[0], s[1] + s[2] * 24], [s[0], s[1] + s[2] * 32], {color: c.c3, width: 1.5});
        used.push(s);
      });
      // integral glycoprotein spanning the bilayer, with its sugar chain outside; peripheral protein on the inner face
      api.rect(PX - 17, hyO - 9, 34, hyI - hyO + 18, {fill: c.c1, fillOpacity: 0.35, stroke: c.c1, width: 1.5, rx: 12});
      api.polyline([[PX, hyO - 9], [PX, hyO - 20], [PX + 7, hyO - 29], [PX + 5, hyO - 38]], {stroke: c.c6, width: 2});
      [[PX, hyO - 20], [PX + 7, hyO - 29], [PX + 5, hyO - 38], [PX - 7, hyO - 28]].forEach(function (p) { api.circle(p, 3.2, {fill: c.c6}); });
      api.line([PX, hyO - 20], [PX - 7, hyO - 28], {color: c.c6, width: 2});
      T([PX + 16, 22], "glycoprotein", c.c6, {anchor: "start"});
      api.path("M " + (PER - 22) + " " + (hyI + 7) + " Q " + PER + " " + (hyI + 34) + " " + (PER + 22) + " " + (hyI + 7) + " Z", {fill: c.c4, fillOpacity: 0.4, stroke: c.c4, width: 1.5});
      T([PER, hyI + 40], "peripheral protein", c.c4, {anchor: "middle"});
      // lateral drift of the protein: the arrow grows with fluidity
      var dl = 4 + 30 * F, ay = hyI + 18;
      api.line([PX - dl - 8, ay], [PX + dl + 8, ay], {color: c.ink, width: 1.8, arrow: true, arrowStart: true});
      T([PX, ay + 16], "integral protein", c.c1, {anchor: "middle"});
      T([PX + dl + 14, ay], F < 0.3 ? "barely drifts" : "drifts", c.ink, {anchor: "start", weight: 500});
      // labels with leaders: one phospholipid head, one cholesterol
      var hx = 22 + 9 * sp;
      api.line([hx, 30], [hx, hyO - 7], {color: c.c2, width: 1, dash: "2 2"});
      T([hx, 22], "phospholipid", c.c2, {anchor: "middle"});
      var ch = used.filter(function (s) { return s[2] === -1; }).sort(function (a, b) { return Math.abs(a[0] - 345) - Math.abs(b[0] - 345); })[0];
      if (ch) { api.line([ch[0], ch[1] + 4], [Math.min(ch[0] + 14, 372), 206], {color: c.c3, width: 1, dash: "2 2"}); T([386, 214], "cholesterol", c.c3, {anchor: "end"}); }
      T([16, 8], "outside", c.muted, {weight: 500});
      T([16, 226], "cytosol", c.muted, {weight: 500});
      // ---- temperature line: the melting range around Tm (wider with cholesterol) and the membrane's temperature ----
      var sx0 = 40, sx1 = 360, sy = 274, S = function (t) { return sx0 + (Math.max(-20, Math.min(50, t)) + 20) / 70 * (sx1 - sx0); };
      api.rect(S(m.tm - 2 * m.w), sy - 7, S(m.tm + 2 * m.w) - S(m.tm - 2 * m.w), 14, {fill: c.c2, fillOpacity: 0.16, rx: 3});
      api.line([sx0, sy], [sx1, sy], {color: c.axis, width: 1.2});
      [-20, 0, 20, 40].forEach(function (t) { api.line([S(t), sy + 7], [S(t), sy + 10], {color: c.axis, width: 1}); T([S(t), sy + 18], t + " °C", c.muted, {anchor: "middle", weight: 500}); });
      T([sx0, sy - 17], "gel", c.muted, {anchor: "start", weight: 500}); T([sx1, sy - 17], "fluid", c.muted, {anchor: "end", weight: 500});
      api.line([S(m.tm), sy - 9], [S(m.tm), sy + 9], {color: c.c2, width: 2.2});
      api.polygon([[S(v.temp), sy + 1], [S(v.temp) - 6, sy - 9], [S(v.temp) + 6, sy - 9]], {fill: c.c5, fillOpacity: 1});
      var near = Math.abs(S(v.temp) - S(m.tm)) < 60, tRight = v.temp >= m.tm;
      T([S(m.tm) + (near ? (tRight ? -4 : 4) : 0), sy - 31], "T_m " + api.fmt(m.tm, 1) + " °C", c.c2, {anchor: near ? (tRight ? "end" : "start") : "middle"});
      T([S(v.temp) + (near ? (tRight ? 4 : -4) : 0), sy - 31], "T " + api.fmt(v.temp) + " °C", c.c5, {anchor: near ? (tRight ? "start" : "end") : "middle"});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
