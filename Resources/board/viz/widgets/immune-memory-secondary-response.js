// Why the second response to an antigen is faster: a lag model. The response becomes detectable once the antigen-
// specific clone reaches N* cells. A naive response starts from N0 = 100 precursors (roughly the number of naive T or B
// cells that fit one epitope in a mouse) and needs about 3 days to be primed before dividing; memory cells start from a
// pool fold times larger and are primed faster. Cells then double every t_d hours, so
//   lag = t_act + (t_d / 24) * log2(N* / N_start)   (days; zero doublings if the pool already reaches N*).
// N* = 1e5 is an illustrative threshold chosen so the textbook numbers come out: about a week for a first response and
// 1-3 days for a second. The curves are drawn only while the clone grows exponentially (before the peak).
(function () {
  var N0 = 100, NSTAR = 1e5, TNAIVE = 3;
  function model(v) {
    var f = Number(v.fold), d = v.td / 24;
    var dn = Math.log2(NSTAR / N0), dm = Math.max(0, Math.log2(NSTAR / (N0 * f)));
    return {f: f, d: d, dn: dn, dm: dm, ln: TNAIVE + d * dn, lm: v.act + d * dm};
  }
  var r1 = function (x) { return Viz.n(Math.round(x * 10) / 10); };
  var pow = function (x) { return "10^{" + Math.round(Math.log10(x)) + "}"; };

  Viz.register("immune-memory-secondary-response", {
    title: "Immune memory: why the second response is faster",
    subject: "biology",
    shows: "Set the size of the memory pool, how fast memory cells get going and how fast cells divide: the second response clears the detection line sooner because it skips the slow start and needs fewer doublings",
    params: {
      fold: {kind: "enum", values: ["1", "10", "100", "1000"], names: {"1": "1×", "10": "10×", "100": "100×", "1000": "1000×"}, default: "100", label: "\\text{pool}"},
      act: {kind: "number", default: 1, min: 0.5, max: 3, step: 0.5, label: "t_{\\text{act}}\\,(\\text{d})"},
      td: {kind: "integer", default: 8, min: 6, max: 24, label: "t_d\\,(\\text{h})"}
    },
    formula: function (v) {
      var m = model(v), fr = "\\tfrac{" + v.td + "}{24}";
      return "\\text{naive: }" + TNAIVE + "+" + fr + "\\log_2\\tfrac{10^5}{10^2}=" + r1(m.ln) + "\\ \\text{d}\\newline\\text{memory: }" + Viz.n(v.act) + "+" + fr +
        "\\log_2\\tfrac{10^5}{" + pow(N0 * m.f) + "}=" + r1(m.lm) + "\\ \\text{d}";
    },
    status: function (v) {
      var m = model(v), sa = TNAIVE - v.act, sd = m.d * (m.dn - m.dm);
      var parts = [];
      if (sa > 0) parts.push(r1(sa) + " d saved by quicker priming");
      if (m.f > 1) parts.push(r1(sd) + (sa > 0 ? " d by starting " : " d saved by starting ") + v.fold + "× larger (" + r1(m.dn - m.dm) + " fewer doublings)");
      if (!parts.length) return "No head start: with as many cells as the naive pool and the same slow priming, the second response takes the same <b>" + r1(m.ln) + " days</b>.";
      return "The memory response is detectable after <b>" + r1(m.lm) + " days</b> instead of <b>" + r1(m.ln) + "</b>: " + parts.join(" and ") + ".";
    },
    examples: [
      {name: "no memory advantage", values: {fold: "1", act: 3}},
      {name: "large memory pool, quick start", values: {fold: "1000", act: 0.5}},
      {name: "slow division (24 h)", values: {td: 24}},
      {name: "fast division (6 h)", values: {td: 6, fold: "10"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v);
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var X0 = 46, X1 = 390, Y0 = 176, Y1 = 18, TMAX = 15, LMIN = 1, LMAX = 6;
      var px = function (t) { return X0 + t / TMAX * (X1 - X0); }, py = function (lg) { return Y0 - (lg - LMIN) / (LMAX - LMIN) * (Y0 - Y1); };
      // axes and grid
      for (var lg = LMIN; lg <= LMAX; lg++) {
        api.line([X0, py(lg)], [X1, py(lg)], {color: c.grid, width: 1});
        L([X0 - 6, py(lg)], "10^" + lg, c.muted, {anchor: "end", weight: 500});
      }
      for (var t = 0; t <= TMAX; t += 3) L([px(t), Y0 + 13], t === TMAX ? t + " days" : String(t), c.muted, {anchor: t === TMAX ? "end" : "middle", weight: 500});
      api.line([X0, Y0], [X1, Y0], {color: c.axis, width: 1.2});
      api.line([X0, Y0], [X0, Y1], {color: c.axis, width: 1.2});
      L([X0 + 4, Y1 - 6], "antigen-specific cells", c.muted, {weight: 500});
      // the detection line
      api.line([X0, py(5)], [X1, py(5)], {color: c.c5, width: 1.5, dash: "6 4"});
      // the two clones: flat while being primed, then doubling every t_d
      var curve = function (start, wait, col) {
        var pts = [], ls = Math.log10(start);
        for (var tt = 0; tt <= TMAX + 1e-9; tt += 0.05) {
          var l = ls + (tt > wait ? (tt - wait) * 24 / v.td * Math.LOG10E * Math.LN2 : 0);
          pts.push([px(tt), py(Math.min(l, LMAX))]);
          if (l >= LMAX) break;
        }
        api.polyline(pts, {stroke: col, width: 3});
        return pts;
      };
      curve(N0, TNAIVE, c.c2);
      curve(N0 * m.f, v.act, c.c1);
      L([px(0) + 4, py(2) + 11], "naive 10²", c.c2, {weight: 650});
      var lmS = Math.log10(N0 * m.f);
      if (m.f > 1) L([px(0) + 4, py(lmS) + 11], "memory " + (m.f === 1000 ? "10⁵" : m.f === 100 ? "10⁴" : "10³"), c.c1, {weight: 650});
      else L([px(0) + 74, py(2) + 11], "= memory", c.c1, {weight: 650});
      // lag markers
      [[m.ln, c.c2], [m.lm, c.c1]].forEach(function (q) {
        api.line([px(q[0]), py(5)], [px(q[0]), Y0], {color: q[1], width: 1.2, dash: "3 3"});
        api.circle([px(q[0]), py(5)], 4.5, {fill: q[1]});
      });
      var det = L([X1, py(5) - 9], "detectable response", c.c5, {anchor: "end", weight: 500});
      det.style.stroke = c.card; det.style.strokeWidth = "4px"; det.style.paintOrder = "stroke"; det.style.strokeLinejoin = "round";
      // where the time goes: priming wait, then doublings
      var bar = function (y, wait, dbl, col, name, n) {
        api.rect(px(0), y, px(wait) - px(0), 14, {fill: col, fillOpacity: 0.25, stroke: col, width: 1, rx: 3});
        if (dbl > 0.005) api.rect(px(wait), y, px(Math.min(TMAX, wait + dbl)) - px(wait), 14, {fill: col, fillOpacity: 0.85, rx: 3});
        L([px(0), y - 9], name + ": wait " + r1(wait) + " d + " + r1(n) + " doublings (" + r1(dbl) + " d) = " + r1(wait + dbl) + " d", col, {weight: 600});
      };
      bar(218, TNAIVE, m.d * m.dn, c.c2, "naive", m.dn);
      bar(262, v.act, m.d * m.dm, c.c1, "memory", m.dm);
      L([392, 290], "faint = priming · solid = dividing", c.muted, {anchor: "end", weight: 500});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
