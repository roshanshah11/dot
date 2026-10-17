// Actin polymerization in a test tube: lag (nucleation), elongation, steady state. A model, integrated in the widget:
// free monomer c = c0 - F; new nuclei appear at kn*c^3 (a trimer is the smallest stable nucleus, so nucleation is
// steeply concentration-dependent); each filament grows at kon*c - koff, which is zero at the critical concentration
// Cc = koff/kon = 0.1 uM (ATP-actin). So the plateau is F = c0 - Cc and free actin settles at Cc. Preformed seeds (or a
// nucleator such as formin or Arp2/3) skip nucleation, which removes the lag. kon = 10 /uM/s per filament, kn = 1e-7
// /uM^2/s, seeds = 1 nM of filament ends: chosen so 3 uM actin is half polymerized in about 4 minutes, as in pyrene assays.
(function () {
  var CC = 0.1, KON = 10, KOFF = 1, KN = 1e-7, SEED = 0.001, DT = 0.5, TMAX = 1200, memo = {};
  function run(c0, seeds) {
    var key = c0 + "|" + seeds;
    if (memo[key]) return memo[key];
    var F = 0, N = seeds ? SEED : 0, out = [0];
    for (var i = 1; i <= TMAX / DT; i++) {
      var c = c0 - F;
      N += KN * c * c * c * DT;
      F = Math.max(0, Math.min(c0, F + N * (KON * c - KOFF) * DT));
      out.push(F);
    }
    return (memo[key] = out);
  }
  function at(v) { var o = run(v.c0, v.seeds); return o[Math.min(o.length - 1, Math.round(v.t * 60 / DT))]; }
  function phase(v) {
    var Finf = v.c0 - CC, f = at(v) / Math.max(Finf, 1e-9);
    if (Finf <= 1e-9) return "none";
    return f >= 0.95 ? "steady" : f >= 0.05 || v.seeds ? "elong" : "lag";
  }
  function tAt(o, y) { for (var i = 0; i < o.length; i++) if (o[i] >= y) return i * DT / 60; return null; }

  Viz.register("actin-filament-polymerization", {
    title: "Actin polymerization: lag, growth, plateau",
    subject: "biology",
    shows: "Slide the actin concentration and the time: filaments form only after a slow nucleation lag, grow fast, then level off where free actin has fallen to the critical concentration; seeds skip the lag",
    params: {
      c0: {kind: "number", default: 3, min: 0.05, max: 8, step: 0.05, label: "c_0\\ (\\mu\\text{M})"},
      seeds: {kind: "boolean", default: false, label: "\\text{seeds}", on: "added", off: "none"},
      t: {kind: "number", default: 4, min: 0, max: 20, step: 0.5, label: "t\\ (\\text{min})"}
    },
    formula: function (v) {
      var F = at(v), Finf = v.c0 - CC;
      if (Finf <= 1e-9) return "c_0 = " + Viz.n(v.c0) + " \\le C_c = 0.1\\ \\mu\\text{M} \\Rightarrow F = 0";
      return "F(" + Viz.n(v.t, 1) + "\\,\\text{min}) = " + Viz.n(F) + "\\ \\mu\\text{M},\\ \\ F_\\infty = c_0 - C_c = " + Viz.n(v.c0) + " - 0.1 = " + Viz.n(Finf) + "\\ \\mu\\text{M}";
    },
    status: function (v) {
      var F = at(v), Finf = v.c0 - CC, ph = phase(v), pc = F / v.c0 < 0.005 ? "almost none" : Math.round(100 * F / v.c0) + "%", tm = Viz.fmt(v.t, 1) + " min";
      if (ph === "none") return "At " + Viz.fmt(v.c0) + " µM the actin is at or below the critical concentration (0.1 µM): subunits leave ends as fast as they join, so <b>no filaments</b> form.";
      if (ph === "lag") return "At " + tm + " it is still the <b>lag phase</b>: free monomers only rarely meet as a stable trimer nucleus, so " + (pc === "almost none" ? pc : "just " + pc) + " of the actin is in filaments.";
      if (ph === "elong") return (v.seeds ? "Seeds skip nucleation, so there is no lag: " : "Nuclei have formed and now ") + "filaments <b>elongate</b> at their ends; at " + tm + ", " + pc + " of the actin (" + Viz.fmt(F) + " µM) is polymerized.";
      var gs = Viz.fmt(v.c0 - F);
      return "<b>Steady state</b>: free actin is down to " + gs + " µM, " + (gs === "0.1" ? "at" : "approaching") + " the critical concentration Cc = 0.1 µM where subunits join and leave ends equally, so " + Viz.fmt(F) + " of the " + Viz.fmt(Finf) + " µM plateau is in filaments.";
    },
    examples: [
      {name: "minimums: below the critical concentration", values: {c0: 0.05, seeds: false, t: 0}},
      {name: "maximums: seeded, at 20 min", values: {c0: 8, seeds: true, t: 20}},
      {name: "lag phase", values: {c0: 2, seeds: false, t: 1.5}},
      {name: "seeds remove the lag", values: {c0: 2, seeds: true, t: 1.5}},
      {name: "steady state", values: {c0: 3, seeds: false, t: 20}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, o = run(v.c0, v.seeds), F = at(v), G = v.c0 - F, Finf = Math.max(0, v.c0 - CC), ph = phase(v);
      // ---- what the tube holds at time t: 40 subunits ----
      var nF = Math.round(40 * F / v.c0), lag = ph === "lag" && v.t > 0, nG = 40 - (lag ? Math.max(nF, 3) : nF);
      api.label([14, 14], "free G-actin " + api.fmt(G) + " µM", {color: c.c3, size: 12.5, weight: 600});
      api.label([388, 14], "in filaments " + api.fmt(F) + " µM", {color: c.c1, size: 12.5, weight: 600, anchor: "end"});
      for (var i = 0; i < nG; i++) {
        var col = i % 10, row = Math.floor(i / 10);
        api.circle([22 + col * 17 + (row % 2) * 8 + ((i * 7) % 5) - 2, 34 + row * 15 + ((i * 3) % 4)], 4.6, {fill: c.c3, fillOpacity: 0.85});
      }
      var nfil = v.seeds ? 4 : nF === 0 || lag ? 0 : Math.min(3, 1 + Math.floor(nF / 14)), left = nF;
      for (var f = 0; f < nfil; f++) {
        var len = Math.round(left / (nfil - f)); left -= len;
        var y0 = 32 + f * 17, x0 = 214;
        if (v.seeds) { for (var s = 0; s < 3; s++) api.circle([x0 + s * 6, y0 + (s % 2 ? 2.5 : -2.5)], 3.3, {fill: c.c6}); x0 += 18; }
        for (var j = 0; j < len; j++) api.circle([x0 + j * 6, y0 + (j % 2 ? 2.5 : -2.5)], 3.3, {fill: c.c1, fillOpacity: 0.9});
      }
      if (v.seeds) api.label([214, 98], "purple: seeds (preformed nuclei)", {color: c.c6, size: 12});
      else if (lag) {
        [[0, 0], [9, 0], [4.5, -8]].forEach(function (q) { api.circle([300 + q[0], 64 + q[1]], 4.6, {fill: c.c1}); });
        api.label([300, 86], "rare stable trimer: a nucleus", {color: c.c1, size: 12, anchor: "middle"});
      }
      api.line([10, 106], [390, 106], {color: c.grid, width: 1});
      // ---- the time course ----
      var ymax = [0.2, 0.5, 1, 2, 4, 8].filter(function (m) { return v.c0 <= m + 1e-9; })[0];
      var X0 = 48, X1 = 378, Y0 = 270, Y1 = 140, px = function (tm) { return X0 + (X1 - X0) * tm / 20; }, py = function (y) { return Y0 - (Y0 - Y1) * y / ymax; };
      // phase bands, from where F crosses 5% and 95% of its plateau
      if (Finf > 0) {
        var t5 = v.seeds ? 0 : tAt(o, 0.05 * Finf), t95 = tAt(o, 0.95 * Finf), e5 = t5 == null ? 20 : t5, e95 = t95 == null ? 20 : t95;
        // band names in the header strip, left to right, each pushed clear of the one before; a narrow lag band is
        // still named, starting at the axis
        var right = 0;
        [[0, e5, "lag"], [e5, e95, "elongation"], [e95, 20, "steady state"]].forEach(function (b, k) {
          var w = px(b[1]) - px(b[0]), tw = b[2].length * 6.8;
          if (w <= 0) return;
          api.rect(px(b[0]), Y1 - 6, w, Y0 - Y1 + 6, {fill: c.ink, fillOpacity: k === 1 ? 0.06 : 0.025, rx: 0});
          var mid = Math.min(X1 - tw / 2, Math.max((px(b[0]) + px(b[1])) / 2, right + 8 + tw / 2, k === 0 ? X0 + tw / 2 : 0));
          if (k === 0 || mid - tw / 2 < px(b[1]) - 4) { api.label([mid, 116], b[2], {color: c.muted, size: 12, anchor: "middle"}); right = mid + tw / 2; }
        });
        api.line([X0, py(Finf)], [X1, py(Finf)], {color: c.c1, width: 1, dash: "4 4", opacity: 0.6});

      }
      api.line([X0, Y0], [X1 + 6, Y0], {color: c.axis, width: 1.3});
      api.line([X0, Y0], [X0, Y1 - 8], {color: c.axis, width: 1.3});
      [0, 5, 10, 15, 20].forEach(function (tm) { api.label([px(tm), Y0 + 15], tm === 20 ? "20 min" : String(tm), {color: c.muted, size: 12, anchor: tm === 20 ? "end" : "middle"}); });
      [0, ymax / 2, ymax].forEach(function (y) { api.label([X0 - 9, py(y)], api.fmt(y) + (y === ymax ? " µM" : ""), {color: c.muted, size: 12, anchor: "end"}); });
      var gPts = [], fPts = [];
      for (var k2 = 0; k2 < o.length; k2 += 8) { var tm2 = k2 * DT / 60; fPts.push([px(tm2), py(o[k2])]); gPts.push([px(tm2), py(v.c0 - o[k2])]); }
      api.polyline(gPts, {stroke: c.c3, width: 2.2});
      api.polyline(fPts, {stroke: c.c1, width: 2.6});
      api.line([px(v.t), Y1 - 6], [px(v.t), Y0], {color: c.ink, width: 1, opacity: 0.4});
      api.point([px(v.t), py(G)], {color: c.c3, r: 4.5});
      api.point([px(v.t), py(F)], {color: c.c1, r: 5, stroke: c.ink});
      // curve names near t = 15-16 min, set off from each curve's own values under the label (not its end value), then
      // the plateau's name; each moves along when the current-time line, a curve or another name would run into it
      var val = function (which, tm) { var y = o[Math.min(o.length - 1, Math.round(Math.min(20, tm) * 60 / DT))]; return which === "P" ? Finf : which === "F" ? y : v.c0 - y; };
      var range = function (which, a, b) { var lo = Infinity, hi = -Infinity; for (var tm = a; tm <= b + 1e-9; tm += 0.1) { var y = val(which, tm); lo = Math.min(lo, y); hi = Math.max(hi, y); } return [py(hi), py(lo)]; };
      var boxes = [], last = null, mpp = 20 / (X1 - X0);
      var place = function (which, text, wpx, tcs, o2) {
        var hw = wpx / 2 * mpp, best = null;
        for (var i = 0; i < tcs.length && !best; i++) {
          var a = Math.max(0, tcs[i] - hw), b = a + 2 * hw, me = range(which, a, b), xa = px(a), xb = px(b);
          var cands = [me[0] - 10, me[1] + 10];
          for (var j = 0; j < 2 && !best; j++) {
            var y = cands[j], top = y - 7, bot = y + 7;
            if (top < Y1 - 16 || bot > Y0 - 3) continue;            // the strip under the band names is free
            if ((Finf > 0 ? ["F", "G", "P"] : ["F", "G"]).some(function (w) { if (w === which) return false; var r = range(w, a, b); return bot > r[0] - 3 && top < r[1] + 3; })) continue;
            if (Math.abs(px(v.t) - (xa + xb) / 2) < (xb - xa) / 2 + 7) continue;     // the current-time line and its points
            if (boxes.some(function (q) { return xa < q[2] + 4 && xb > q[0] - 4 && top < q[3] && bot > q[1]; })) continue;
            best = [(xa + xb) / 2, y];
          }
        }
        if (!best) best = [last ? last[0] : px(15.5), last ? last[1] - 15 : py(val(which, 15.5)) - 10]; // stack above the last name
        boxes.push([best[0] - wpx / 2, best[1] - 7, best[0] + wpx / 2, best[1] + 7]); last = best;
        api.label(best, text, Object.assign({color: which === "G" ? c.c3 : c.c1, size: 12.5, weight: 650, anchor: "middle"}, o2 || {}));
      };
      var near = [15.5, 11, 20 - 45 * mpp, 7, 4], gName = Finf > 0 ? ["G-actin → Cc", 86] : ["G-actin", 52], fName = Finf > 0 ? "F-actin" : "F-actin: none";
      if (Finf <= 0 || val("G", 15.5) > val("F", 15.5)) { place("G", gName[0], gName[1], near); place("F", fName, Finf > 0 ? 52 : 84, near); }
      else { place("F", fName, 52, near); place("G", gName[0], gName[1], near); }
      if (Finf > 0) place("P", "plateau c₀ − Cc", 100, [8, 4.5, 11, 14, 17], {size: 12, weight: 500, raw: true});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
