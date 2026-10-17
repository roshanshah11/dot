// A point going round a circle f times a second. Each turn is 2 pi radians, so it sweeps omega = 2 pi f radians
// per second; its height traces sin(omega t) on the right, and one full turn takes T = 1/f = 2 pi / omega.
// The queue's range for f (0.01 to 1000 Hz) cannot be drawn or slid usefully on a linear slider, so f runs from
// 0.1 to 10 Hz, where a 2-second window shows from a fifth of a turn up to twenty turns. Time t is Dot's addition:
// it places the point, so theta = omega t is visible on the circle and on the wave at the same instant.
(function () {
  var TW = 2; // seconds shown on the wave
  function calc(v) { var w = 2 * Math.PI * v.frequency; return {w: w, T: 1 / v.frequency, th: w * v.time}; }

  Viz.register("angular-frequency-relation", {
    title: "Angular frequency and period",
    subject: "physics",
    shows: "Slide f and t: a point turning f times a second sweeps 2π rad per turn, so ω = 2πf rad/s, and one turn takes T = 1/f",
    params: {
      frequency: {kind: "number", default: 1.5, min: 0.1, max: 10, step: 0.05, label: "f\\ (\\text{Hz})"},
      time: {kind: "number", default: 0.25, min: 0, max: 2, step: 0.01, label: "t\\ (\\text{s})"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\omega=2\\pi f=2\\pi\\cdot" + Viz.n(v.frequency) + "=" + Viz.n(k.w) + "\\ \\text{rad/s}\\\\" +
        "T=\\tfrac{1}{f}=\\tfrac{2\\pi}{\\omega}=" + Viz.n(k.T, 3) + "\\ \\text{s}\\\\" +
        "\\theta=\\omega t=" + Viz.n(k.w) + "\\cdot" + Viz.n(v.time) + "=" + Viz.n(k.th) + "\\ \\text{rad}\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      return "<b>" + Viz.fmt(v.frequency) + "</b> turn" + (v.frequency === 1 ? "" : "s") + " a second × 2π rad a turn = <b>" + Viz.fmt(k.w) +
        " rad/s</b>, so one turn takes <b>" + Viz.fmt(k.T, 3) + " s</b>.";
    },
    examples: [
      {name: "one hertz", values: {frequency: 1, time: 0.25}},
      {name: "slowest: a fifth of a turn in the window", values: {frequency: 0.1, time: 2}},
      {name: "fastest: ten turns a second", values: {frequency: 10, time: 0.03}},
      {name: "start", values: {frequency: 1.5, time: 0}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, k = calc(v), cx = 76, cy = 138, r = 56, x0 = 164, x1 = 388;
      var X = function (t) { return x0 + (x1 - x0) * t / TW; }, Yw = function (t) { return cy - r * Math.sin(k.w * t); };
      // circle and the angle swept so far (the part past whole turns)
      api.circle([cx, cy], r, {stroke: c.faint, width: 1.5});
      api.line([cx - r - 8, cy], [cx + r + 8, cy], {color: c.grid, width: 1});
      api.line([cx, cy - r - 8], [cx, cy + r + 8], {color: c.grid, width: 1});
      var turns = v.frequency * v.time, frac = turns - Math.floor(turns + 1e-9), a = frac * 2 * Math.PI, ra = 22;
      if (a > 0.02) {
        var pts = []; for (var i = 0; i <= 48; i++) { var q = a * i / 48; pts.push([cx + ra * Math.cos(q), cy - ra * Math.sin(q)]); }
        api.polygon([[cx, cy]].concat(pts), {fill: c.c3, fillOpacity: 0.18});
        api.polyline(pts, {stroke: c.c3, width: 2.5});
      }
      var P = [cx + r * Math.cos(k.th), cy - r * Math.sin(k.th)];
      api.line([cx, cy], P, {color: c.c1, width: 2.5});
      api.label([cx, cy - r - 18], api.fmt(v.frequency) + " turn" + (v.frequency === 1 ? "" : "s") + " per second", {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      api.label([cx, cy + r + 18], "θ = " + api.fmt(k.th) + " rad", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.label([cx, cy + r + 35], Math.floor(turns + 1e-9) > 0 ? "= " + api.fmt(turns) + " turns" : "1 turn = 2π rad", {color: c.muted, size: 12, anchor: "middle"});
      // the wave: height of the point against time
      api.line([x0, cy], [x1 + 4, cy], {color: c.axis, width: 1.2});
      [0, 0.5, 1, 1.5, 2].forEach(function (t) {
        api.line([X(t), cy + r + 2], [X(t), cy + r + 6], {color: c.axis, width: 1});
        api.label([X(t), cy + r + 17], String(t), {color: c.muted, size: 12, anchor: "middle"});
      });
      api.label([x1, cy + r + 33], "t (s)", {color: c.muted, size: 12, anchor: "end"});
      api.line([x0, cy + r + 2], [x1, cy + r + 2], {color: c.grid, width: 1});
      var wave = [];
      for (var j = 0; j <= 800; j++) { var t = TW * j / 800; wave.push([X(t), Yw(t)]); }
      api.polyline(wave, {stroke: c.c2, width: 1.8});
      api.label([x0, cy + r + 33], "height = sin ωt", {color: c.c2, size: 12.5, weight: 650});
      // one period, bracketed above the wave
      var yb = cy - r - 18, te = Math.min(k.T, TW), lab = "T = " + api.fmt(k.T, 3) + " s" + (k.T > TW ? " (past the window)" : "");
      api.line([X(0), yb], [X(te), yb], {color: c.c4, width: 2, arrow: k.T > TW});
      api.line([X(0), yb - 5], [X(0), yb + 5], {color: c.c4, width: 2});
      if (k.T <= TW) api.line([X(te), yb - 5], [X(te), yb + 5], {color: c.c4, width: 2});
      var wide = X(te) - X(0) > 150;
      api.label(wide ? [(X(0) + X(te)) / 2, yb - 13] : [X(te) + 7, yb], lab, {color: c.c4, size: 12.5, weight: 650, anchor: wide ? "middle" : "start"});
      // now: the point's height carried across to the wave
      var W = [X(v.time), Yw(v.time)];
      api.line(P, W, {color: c.faint, width: 1.2, dash: "4 4"});
      api.line([W[0], cy - r], [W[0], cy + r], {color: c.c1, width: 1, opacity: 0.5});
      api.point(P, {color: c.c1, r: 6});
      api.handle(W, {color: c.c1, r: 6, onDrag: function (q) {
        api.set({time: Math.round(Math.max(0, Math.min(TW, (q[0] - x0) / (x1 - x0) * TW)) * 100) / 100});
      }});
    }
  });
})();
