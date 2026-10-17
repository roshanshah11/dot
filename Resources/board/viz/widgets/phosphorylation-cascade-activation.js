// How a three-tier kinase cascade turns on and off in time (MAPK module: Raf -> MEK -> ERK). A signal held on for D
// minutes lets the receptor activate Raf; active Raf phosphorylates MEK, active MEK phosphorylates ERK, and each tier's
// phosphatase strips the phosphate at rate p. Active fractions a1, a2, a3 (0-1) follow a schematic mass-action model:
//   da1/dt = k1 S(t) (1 - a1) - p a1,   da_i/dt = k a_(i-1) (1 - a_i) - p a_i,   k1 = 1 /min, k = 3 /min,
// with S = 1 while the signal lasts (0 <= t <= D). Each active kinase works catalytically on many substrates
// (k > k1), so the lower tiers can end up more fully on than the top. Integrated with RK4, dt = 0.05 min. The timing (each tier lags the one
// above, switch-off needs phosphatases, slow phosphatases make the response outlast the signal) is the science;
// the exact percentages are the model's, not measurements.
(function () {
  var K1 = 1, K = 3, DT = 0.05, TMAX = 60;
  function run(v) {
    var a = [0, 0, 0], out = [[0, 0, 0, 0]];
    var f = function (t, x) {
      var S = t <= v.D + 1e-9 ? 1 : 0;
      return [K1 * S * (1 - x[0]) - v.p * x[0], K * x[0] * (1 - x[1]) - v.p * x[1], K * x[1] * (1 - x[2]) - v.p * x[2]];
    };
    for (var i = 1; i <= TMAX / DT; i++) {
      var t = (i - 1) * DT, add = function (x, d, h) { return x.map(function (q, j) { return q + d[j] * h; }); };
      var k1 = f(t, a), k2 = f(t + DT / 2, add(a, k1, DT / 2)), k3 = f(t + DT / 2, add(a, k2, DT / 2)), k4 = f(t + DT, add(a, k3, DT));
      a = a.map(function (q, j) { return q + DT / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]); });
      out.push([i * DT, a[0], a[1], a[2]]);
    }
    return out;
  }
  function at(v) { return run(v)[Math.round(v.t / DT)]; }
  var pc = function (x) { return Math.round(x * 100); };
  Viz.register("phosphorylation-cascade-activation", {
    title: "A kinase cascade switching on and off",
    subject: "biology",
    shows: "Scrub through time: a signal turns on Raf, then MEK, then ERK, each tier lagging the one above, and once the signal stops phosphatases strip the phosphates so the cascade resets, slowly if phosphatases are slow",
    params: {
      t: {kind: "number", default: 8, min: 0, max: 60, step: 1, label: "t\\ (\\text{min})"},
      D: {kind: "number", default: 15, min: 1, max: 60, step: 1, label: "\\text{signal}"},
      p: {kind: "number", default: 0.5, min: 0.1, max: 2, step: 0.1, label: "p\\ (\\text{min}^{-1})"}
    },
    formula: function (v) {
      var s = at(v);
      return "\\tfrac{da_i}{dt}=k\\,a_{i-1}(1-a_i)-p\\,a_i\\newline a(" + Viz.n(v.t, 0) + ")=(" + s[1].toFixed(2) + ",\\," + s[2].toFixed(2) + ",\\," + s[3].toFixed(2) + ")";
    },
    status: function (v) {
      var s = at(v), half = Math.LN2 / v.p;
      if (v.t === 0) return "Before the signal everything is <b>dephosphorylated</b> and off; the signal will last " + v.D + " min.";
      if (v.t <= v.D) return "Signal on for " + Viz.fmt(v.t, 0) + " min: activation spreads down the cascade, Raf <b>" + pc(s[1]) + "%</b>, MEK <b>" + pc(s[2]) + "%</b>, ERK <b>" + pc(s[3]) + "%</b>" + (s[3] < s[1] - 0.01 ? ", the lower tiers still catching up." : s[3] > s[1] + 0.01 ? ", the lower tiers now ahead because each active kinase works on many substrates." : ", every tier level because fast phosphatases cancel the gain.");
      var since = v.t - v.D;
      return "The signal stopped " + Viz.fmt(since, 0) + " min ago: phosphatases (half-time " + Viz.fmt(half, 1) + " min) strip the phosphates and ERK, last to feel it, is still <b>" + pc(s[3]) + "%</b> on" + (s[3] < 0.05 ? ", so the cascade has <b>reset</b>." : ".");
    },
    examples: [
      {name: "start", values: {t: 0}},
      {name: "the signal arrives at ERK", values: {t: 3, D: 15, p: 0.5}},
      {name: "fast phosphatases: a brief pulse", values: {t: 20, D: 15, p: 2}},
      {name: "slow phosphatases: ERK outlasts the signal", values: {t: 40, D: 15, p: 0.1}},
      {name: "short signal", values: {t: 10, D: 1, p: 0.5}},
      {name: "signal held for the hour", values: {t: 60, D: 60, p: 0.5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, data = run(v), s = data[Math.round(v.t / DT)], cols = [c.c2, c.c6, c.c1], names = ["Raf", "MEK", "ERK"], tiers = ["MAPKKK", "MAPKK", "MAPK"];
      var sigOn = v.t <= v.D;
      // the cascade at time t: 8 molecules per tier, the active ones carry a phosphate
      api.rect(10, 12, 50, 26, {fill: c.c3, fillOpacity: sigOn ? 0.35 : 0.08, stroke: c.c3, width: 1.4, rx: 7});
      api.label([35, 25], "signal", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      api.label([35, 50], sigOn ? "on" : "off", {color: sigOn ? c.c3 : c.muted, size: 12, anchor: "middle"});
      for (var i = 0; i < 3; i++) {
        var x0 = 82 + i * 106, on = Math.round(8 * s[i + 1]);
        api.label([x0 + 38, 14], names[i] + " " + pc(s[i + 1]) + "%", {color: cols[i], size: 12.5, weight: 700, anchor: "middle"});
        api.label([x0 + 38, 29], tiers[i], {color: c.muted, size: 12, anchor: "middle"});
        for (var m = 0; m < 8; m++) {
          var cx = x0 + 8 + (m % 4) * 20, cy = 52 + Math.floor(m / 4) * 26, act = m < on;
          api.circle([cx, cy], 8, {fill: cols[i], fillOpacity: act ? 0.85 : 0.12, stroke: cols[i], width: 1.2});
          if (act) { api.circle([cx + 7, cy - 7], 5, {fill: c.c3}); api.label([cx + 7, cy - 6.5], "P", {color: c.card, size: 12, weight: 800, anchor: "middle", raw: true}); }
        }
        api.arrow([x0 - 18, 64], [x0 - 4, 64], {color: i === 0 ? c.c3 : cols[i - 1], width: 2, halo: false, head: 7, opacity: (i === 0 ? sigOn : s[i] > 0.05) ? 1 : 0.25});
      }
      api.label([392, 108], "phosphatases remove P at rate p = " + api.fmt(v.p, 1) + " per min", {color: c.c5, size: 12, anchor: "end"});
      // time course
      var X0 = 40, X1 = 384, Y0 = 280, Y1 = 146, sx = (X1 - X0) / TMAX, sy = (Y0 - Y1);
      var X = function (t) { return X0 + t * sx; }, Y = function (a) { return Y0 - a * sy; };
      api.rect(X(0), Y1, Math.min(v.D, TMAX) * sx, Y0 - Y1, {fill: c.c3, fillOpacity: 0.1, rx: 0});
      api.label([X0, Y1 - 10], "signal on from 0 to " + api.fmt(v.D, 0) + " min", {color: c.c3, size: 12});
      api.line([X0, Y0], [X1, Y0], {color: c.axis, width: 1.2}); api.line([X0, Y0], [X0, Y1], {color: c.axis, width: 1.2});
      [0, 50, 100].forEach(function (q) { api.label([X0 - 6, Y(q / 100)], q + "%", {color: c.muted, size: 12, anchor: "end"}); });
      [0, 20, 40, 60].forEach(function (q) { api.label([X(q) + (q === 60 ? 4 : 0), Y0 + 12], q === 60 ? "60 min" : String(q), {color: c.muted, size: 12, anchor: q === 60 ? "end" : "middle"}); });
      for (var j = 0; j < 3; j++) {
        var pts = []; for (var k = 0; k < data.length; k += 4) pts.push([X(data[k][0]), Y(data[k][j + 1])]);
        api.polyline(pts, {stroke: cols[j], width: 2.4});
        api.point([X(v.t), Y(s[j + 1])], {color: cols[j], r: 4});
      }
      api.line([X(v.t), Y1], [X(v.t), Y0], {color: c.ink, width: 1.2, dash: "3 3"});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints svg text ink
    }
  });
})();
