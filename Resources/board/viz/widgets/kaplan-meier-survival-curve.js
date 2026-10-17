// The Kaplan-Meier estimate built one event time at a time. Top: twelve subjects' follow-up lines, each ending in an
// event (x) or a censoring (o: last seen still event-free). Bottom: the survival curve S(t). At each event time t_i,
// n_i subjects are still at risk and d_i have the event, so the curve is multiplied by (1 - d_i / n_i); a censored
// subject leaves the risk set without moving the curve. The three endpoints are three small illustrative cohorts
// (Dot's own numbers, not real trial data); the time unit only relabels the axis, the curve itself does not change.
(function () {
  var DATA = {   // [months, 1 = event / 0 = censored]; each cohort has 12 subjects and 7 distinct event times
    death: [[2, 1], [5, 1], [5, 1], [7, 0], [9, 1], [12, 0], [14, 1], [20, 1], [24, 0], [27, 1], [31, 1], [36, 0]],
    relapse: [[1.5, 1], [3, 1], [4, 1], [5, 0], [6, 1], [6, 1], [9, 1], [11, 0], [13, 1], [16, 0], [18, 1], [24, 0]],
    "device failure": [[8, 1], [12, 0], [15, 1], [22, 1], [26, 0], [30, 1], [38, 1], [38, 1], [41, 0], [45, 1], [52, 1], [60, 0]]
  };
  var WORDS = {death: {who: "patients", ev: "death", v1: "dies", vn: "die", free: "alive"},
               relapse: {who: "patients", ev: "relapse", v1: "relapses", vn: "relapse", free: "relapse-free"},
               "device failure": {who: "devices", ev: "failure", v1: "fails", vn: "fail", free: "working"}};
  var UNIT = {days: {k: 365.25 / 12, steps: [90, 180, 365]}, months: {k: 1, steps: [3, 6, 12]}, years: {k: 1 / 12, steps: [0.5, 1]}};
  function km(endpoint) {
    var d = DATA[endpoint], times = [], rows = [], S = 1;
    d.forEach(function (s) { if (s[1] && times.indexOf(s[0]) < 0) times.push(s[0]); });
    times.forEach(function (t) {
      var n = d.filter(function (s) { return s[0] >= t; }).length, dd = d.filter(function (s) { return s[0] === t && s[1]; }).length, prev = S;
      S = S * (1 - dd / n);
      rows.push({t: t, n: n, d: dd, prev: prev, S: S});
    });
    return {data: d, rows: rows, max: d[d.length - 1][0]};
  }
  function tfmt(m, unit) {
    var x = m * UNIT[unit].k;
    return (unit === "days" ? String(Math.round(x)) : Viz.fmt(x, unit === "years" ? 2 : 1)) + " " + (unit === "months" && x === 1 ? "month" : unit);
  }
  var f3 = function (x) { return Viz.fmt(x, 3); };
  function stepOf(v) { return Math.max(1, Math.min(8, v.step || 1)); }

  Viz.register("kaplan-meier-survival-curve", {
    title: "Kaplan-Meier survival curve",
    subject: "stats",
    shows: "Step through the event times: each event multiplies the curve by 1 − d/n of those still at risk, while a censored subject just leaves the risk set",
    params: {
      endpoint: {kind: "enum", values: ["death", "relapse", "device failure"], default: "relapse", label: "event"},
      time_unit: {kind: "enum", values: ["days", "months", "years"], default: "months", label: "time"}
    },
    steps: ["start", "event time 1", "event time 2", "event time 3", "event time 4", "event time 5", "event time 6", "event time 7"],
    stepMs: 1500,
    formula: function (v) {
      var K = km(v.endpoint), e = stepOf(v) - 1, top = "S(t)=\\prod_{t_i\\le t}\\left(1-\\frac{d_i}{n_i}\\right)";
      if (!e) return "\\begin{array}{l}" + top + "\\\\[4pt]S(0)=1\\end{array}";
      var r = K.rows[e - 1];
      return "\\begin{array}{l}" + top + "\\\\[4pt]S(t_" + e + ")=" + (e > 1 ? Viz.n(r.prev, 3) + "\\cdot" : "") + "\\left(1-\\frac{" + r.d + "}{" + r.n + "}\\right)=" + Viz.n(r.S, 3) + "\\end{array}";
    },
    status: function (v) {
      var K = km(v.endpoint), W = WORDS[v.endpoint], e = stepOf(v) - 1;
      if (!e) return "All 12 " + W.who + " start " + W.free + ", so <b>S(0) = 1</b>; each step moves to the next time a " + W.ev + " happens.";
      var r = K.rows[e - 1], lastT = e > 1 ? K.rows[e - 2].t : 0;
      var cens = K.data.filter(function (s) { return !s[1] && s[0] > lastT && s[0] < r.t; }).length;
      return "At " + tfmt(r.t, v.time_unit) + ", <b>" + r.d + "</b> of the <b>" + r.n + "</b> still at risk " + (r.d > 1 ? W.vn : W.v1) + ", so S drops by the factor " +
        (r.n - r.d) + "/" + r.n + " to <b>" + f3(r.S) + "</b>" + (cens ? "; " + cens + " censored " + W.who.replace(/s$/, "") + (cens > 1 ? "s" : "") + " had left the risk set since the last " + W.ev + ", with no drop." : ".");
    },
    examples: [
      {name: "start (relapse, months)", values: {endpoint: "relapse", time_unit: "months", step: 1}},
      {name: "tied relapses at 6 months", values: {endpoint: "relapse", time_unit: "months", step: 5}},
      {name: "death, in days, full curve", values: {endpoint: "death", time_unit: "days", step: 8}},
      {name: "device failure, in years, full curve", values: {endpoint: "device failure", time_unit: "years", step: 8}}
    ],
    size: [400, 330],
    draw: function (api, v) {
      var c = api.color, K = km(v.endpoint), W = WORDS[v.endpoint], U = UNIT[v.time_unit], e = stepOf(v) - 1;
      var tc = e ? K.rows[e - 1].t : 0, x0 = 56, x1 = 384, X = function (m) { return x0 + (x1 - x0) * m / K.max; };
      var yS0 = 30, rh = 8.4, yK0 = 160, yK1 = 282, Y = function (s) { return yK1 - (yK1 - yK0) * s; };
      // ---- follow-up lines, shortest at the top -------------------------------------------------------------------
      api.label([x0, 12], "one line per " + W.who.replace(/s$/, "") + ":  × " + W.ev + "   ○ censored (last seen " + W.free + ")", {color: c.muted, size: 12});
      K.data.forEach(function (s, i) {
        var y = yS0 + i * rh, atRisk = s[0] >= tc, hit = s[1] && s[0] === tc && e > 0, col = hit ? c.c5 : atRisk ? c.c2 : c.faint;
        api.line([X(0), y], [X(s[0]), y], {color: col, width: 2.6, opacity: atRisk ? 1 : 0.7});
        if (s[1]) {
          var r = hit ? 4.5 : 3.4, ec = hit ? c.c5 : atRisk ? c.c5 : c.faint;
          api.line([X(s[0]) - r, y - r], [X(s[0]) + r, y + r], {color: ec, width: hit ? 2.6 : 1.8});
          api.line([X(s[0]) - r, y + r], [X(s[0]) + r, y - r], {color: ec, width: hit ? 2.6 : 1.8});
        } else api.circle([X(s[0]), y], 3.2, {stroke: atRisk ? c.ink : c.faint, width: 1.6, fill: c.card, fillOpacity: 1});
      });
      // ---- the survival curve --------------------------------------------------------------------------------------
      [0, 0.25, 0.5, 0.75, 1].forEach(function (g) {
        api.line([x0, Y(g)], [x1, Y(g)], {color: g === 0 ? c.axis : c.grid, width: g === 0 ? 1.3 : 1});
        api.label([x0 - 6, Y(g)], Viz.fmt(g, 2), {color: c.muted, size: 12, anchor: "end"});
      });
      api.label([x0 - 6, yK0 - 18], "S(t)", {color: c.c1, size: 12.5, weight: 650, anchor: "end"});
      var pts = [[X(0), Y(1)]], done = [[X(0), Y(1)]], S = 1;
      K.rows.forEach(function (r, i) {
        pts.push([X(r.t), Y(S)], [X(r.t), Y(r.S)]);
        if (i < e) done.push([X(r.t), Y(S)], [X(r.t), Y(r.S)]);
        S = r.S;
      });
      pts.push([X(K.max), Y(S)]);
      done.push([X(e < K.rows.length ? (e ? tc : 0) : K.max), Y(e ? K.rows[e - 1].S : 1)]);
      api.polyline(pts, {stroke: c.faint, width: 1.5, dash: "4 4"});
      api.polyline(done, {stroke: c.c1, width: 3});
      // censoring ticks sit on the curve at the level it had when the subject left
      K.data.forEach(function (s) {
        if (s[1]) return;
        var lev = 1; K.rows.forEach(function (r) { if (r.t <= s[0]) lev = r.S; });
        var shown = s[0] <= tc || e === K.rows.length;
        api.line([X(s[0]), Y(lev) - 5], [X(s[0]), Y(lev) + 5], {color: shown ? c.c1 : c.faint, width: 1.8});
      });
      // time axis in the chosen unit
      var maxU = K.max * U.k, st = U.steps.filter(function (q) { return maxU / q <= 7; })[0] || U.steps[U.steps.length - 1];
      for (var t = 0; t <= maxU + 1e-9; t += st) {
        api.line([X(t / U.k), yK1], [X(t / U.k), yK1 + 4], {color: c.axis, width: 1});
        api.label([X(t / U.k), yK1 + 14], Viz.fmt(t, 1), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1 + 6, yK1 + 32], "time (" + v.time_unit + ")", {color: c.muted, size: 12, anchor: "end"});
      // the current event time: cursor through both panels, the factor, and S after the drop
      if (e) {
        var r = K.rows[e - 1], cx = X(r.t);
        api.line([cx, yS0 - 6], [cx, yK1], {color: c.c3, width: 1.4, dash: "3 4"});
        var note = "n = " + r.n + " at risk, d = " + r.d + "  →  × (1 − " + r.d + "/" + r.n + ")", w = note.length * 12.5 * 0.56, right = cx + 8 + w < 396;
        api.label([right ? cx + 8 : cx - 8, yK0 - 18], note, {color: c.c3, size: 12.5, weight: 650, anchor: right ? "start" : "end"});
        api.point([cx, Y(r.S)], {color: c.c1, r: 5});
        var sl = "S = " + f3(r.S), sr = cx + 10 + sl.length * 7.4 < 396;
        api.label([sr ? cx + 10 : cx - 10, Y(r.S) + 13], sl, {color: c.c1, size: 13, weight: 700, anchor: sr ? "start" : "end"});
      } else {
        api.point([X(0), Y(1)], {color: c.c1, r: 5});
        api.label([X(0) + 10, Y(1) - 13], "S = 1: all 12 at risk", {color: c.c1, size: 13, weight: 700});
      }
    }
  });
})();
