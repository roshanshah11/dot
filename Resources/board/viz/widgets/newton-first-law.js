// Newton's first law on a sliding puck: a strobe picture (one dot every 0.5 s) and its velocity-time graph.
// With no friction there is no net force, so the dots are evenly spaced and v stays at v0. With friction μ the only
// horizontal force is f = μmg backwards, so the puck slows at a = μg (mass cancels) and stops at t = v0/(μg).
// The track is scaled to the frictionless distance v0·T, so the faint rings (where it would be with no net force)
// always fill it and the real dots show how far short friction stops it.
(function () {
  var G = 9.8, T = 5, DT = 0.5;
  function motion(v) {
    var a = v.mu * G, ts = a > 0 ? v.v0 / a : Infinity;
    function x(t) { var u = Math.min(t, ts); return v.v0 * u - 0.5 * a * u * u; }
    function vel(t) { return Math.max(0, v.v0 - a * t); }
    return {a: a, ts: ts, x: x, vel: vel, dist: isFinite(ts) ? v.v0 * v.v0 / (2 * a) : Infinity};
  }
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; }); }   // viz.css paints text ink

  Viz.register("newton-first-law", {
    title: "Newton's first law: inertia",
    subject: "physics",
    shows: "Give the puck a speed and a surface: with no net force it keeps the same velocity forever; friction is a net force and slows it to a stop",
    params: {
      v0: {kind: "number", default: 3, min: 0, max: 6, step: 0.1, label: "v_0\\ (\\mathrm{m/s})"},
      mu: {kind: "number", default: 0, min: 0, max: 0.5, step: 0.01, label: "\\mu"}
    },
    formula: function (v) {
      if (v.v0 === 0) return "\\Sigma F=0\\ \\Rightarrow\\ a=0,\\ v=0";
      if (v.mu === 0) return "\\Sigma F=0\\ \\Rightarrow\\ a=0,\\ v=v_0=" + Viz.n(v.v0, 1) + "\\ \\mathrm{m/s}";
      var m = motion(v);
      return "\\Sigma F=-\\mu mg,\\ \\ a=-\\mu g=-" + Viz.n(m.a, 3) + "\\ \\mathrm{m/s^2}";
    },
    status: function (v) {
      var m = motion(v);
      if (v.v0 === 0) return "Nothing pushes the puck, so friction has nothing to resist: with <b>no net force</b> it stays at rest.";
      if (v.mu === 0) return "No friction means <b>no net force</b>, so the puck keeps " + Viz.fmt(v.v0, 1) + " m/s forever, covering " + Viz.fmt(v.v0 * DT, 2) + " m every 0.5 s.";
      if (m.ts <= T) return "Friction is the only horizontal force, so it is the net force: the puck slows at " + Viz.fmt(m.a, 3) + " m/s² and <b>stops after " + Viz.fmt(m.ts, 2) + " s</b> (" + Viz.fmt(m.dist, 2) + " m).";
      return "Friction slows the puck at " + Viz.fmt(m.a, 3) + " m/s²: at 5 s it still moves at <b>" + Viz.fmt(m.vel(T), 2) + " m/s</b> and will stop after " + Viz.fmt(m.ts, 1) + " s (" + Viz.fmt(m.dist, 1) + " m).";
    },
    examples: [
      {name: "Minimum supported values", values: {v0: 0, mu: 0}},
      {name: "Maximum supported values", values: {v0: 6, mu: 0.5}},
      {name: "rough floor: stops in about 3 s", values: {v0: 3, mu: 0.1}},
      {name: "nearly frictionless: still sliding at 5 s", values: {v0: 6, mu: 0.05}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = motion(v), L = Math.max(v.v0 * T, 1), x0 = 40, x1 = 360, yG = 96, r = 8;
      var X = function (d) { return x0 + (x1 - x0) * d / L; };
      // the surface: ice is a clean line, a rough floor gets hatching that thickens with μ
      api.label([x0 - 10, 18], "strobe: one dot every 0.5 s", {color: c.muted, size: 12});
      api.line([x0 - 18, yG], [x1 + 22, yG], {color: c.axis, width: 1.6});
      if (v.mu > 0) {
        var gap = Math.max(5, 16 - v.mu * 22);
        for (var hx = x0 - 14; hx < x1 + 20; hx += gap) api.line([hx, yG + 1], [hx - 6, yG + 8], {color: c.muted, width: 1, opacity: 0.55});
      }
      api.label([x1 + 22, 18], v.mu > 0 ? "rough floor, μ = " + api.fmt(v.mu, 2) : "frictionless ice", {color: c.muted, size: 12, anchor: "end"});
      for (var d = v.mu > 0 && v.v0 > 0 ? 1 : 0; d <= 2; d++) api.label([X(L * d / 2), yG + 18], api.fmt(L * d / 2, 2) + " m", {color: c.muted, size: 12, anchor: "middle"});
      // ghosts: where the puck would be with no net force
      var n = Math.round(T / DT);
      if (v.mu > 0 && v.v0 > 0) for (var k = 0; k <= n; k++) api.circle([X(v.v0 * k * DT), yG - r - 1], r, {stroke: c.faint, width: 1.2, dash: "3 3"});
      // the real strobe dots, earliest faintest
      for (var j = 0; j <= n; j++) api.circle([X(m.x(j * DT)), yG - r - 1], r, {fill: c.c1, fillOpacity: 0.25 + 0.75 * j / n, stroke: c.c1, width: 1});
      var xEnd = X(m.x(T));
      if (v.v0 > 0 && m.ts <= T) api.label([xEnd, yG - 2 * r - 12], "stops here", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      if (v.mu > 0 && v.v0 > 0) api.label([x1 + 22, 46], "rings: no friction", {color: c.muted, size: 12, anchor: "end"});
      // forces on the puck at t = 0: velocity forward, friction backward (or none)
      var P = [X(0), yG - r - 1];
      var aEnd = P[0] + r + 2 + 22 + 9 * v.v0;
      if (v.v0 > 0) api.arrow([P[0] + r + 2, 46], [aEnd, 46], {color: c.c2, width: 2.5, label: "v₀ " + api.fmt(v.v0, 1) + " m/s", labelAt: "mid", labelOffset: [0, -12], labelSize: 12.5});
      if (v.mu > 0 && v.v0 > 0) api.arrow([P[0] + 2, yG - r - 1], [P[0] - 10 - 40 * v.mu, yG - r - 1], {color: c.c5, width: 2.5, halo: false});
      else api.label([v.v0 > 0 ? aEnd + 14 : x0 - 10, 46], "ΣF = 0", {color: c.c4, size: 12.5, weight: 650});
      if (v.mu > 0 && v.v0 > 0) api.label([X(0) - 14, yG + 18], "f = μmg", {color: c.c5, size: 12, weight: 650, anchor: "start"});
      // velocity-time graph
      var gx0 = 62, gx1 = 360, gy0 = 268, gy1 = 150, vMax = 6;
      var GX = function (t) { return gx0 + (gx1 - gx0) * t / T; }, GY = function (s) { return gy0 - (gy0 - gy1) * s / vMax; };
      api.line([gx0, gy0], [gx1 + 8, gy0], {color: c.axis, width: 1.3, arrow: true});
      api.line([gx0, gy0], [gx0, gy1 - 10], {color: c.axis, width: 1.3, arrow: true});
      for (var t = 0; t <= T; t++) api.label([GX(t), gy0 + 13], String(t), {color: c.muted, size: 12, anchor: "middle"});
      for (var s = 0; s <= vMax; s += 2) { api.label([gx0 - 7, GY(s)], String(s), {color: c.muted, size: 12, anchor: "end"}); if (s) api.line([gx0, GY(s)], [gx1, GY(s)], {color: c.grid, width: 1}); }
      api.label([gx1 + 10, gy0 - 12], "t (s)", {color: c.muted, size: 12, anchor: "end"});
      api.label([gx0 + 6, gy1 - 12], "v (m/s)", {color: c.muted, size: 12});
      if (v.mu > 0 && v.v0 > 0) api.line([GX(0), GY(v.v0)], [GX(T), GY(v.v0)], {color: c.faint, width: 1.5, dash: "5 4"});
      var pts = [[GX(0), GY(v.v0)]];
      if (m.ts < T) pts.push([GX(m.ts), GY(0)]);
      pts.push([GX(T), GY(m.vel(T))]);
      api.polyline(pts, {stroke: c.c2, width: 2.5});
      if (v.v0 > 0 && m.ts <= T) api.point([GX(m.ts), GY(0)], {color: c.c2, r: 4, label: "v = 0 at " + api.fmt(m.ts, 2) + " s", dy: -12, size: 12});
      else api.label([GX(T / 2) + (v.mu > 0 ? 6 : 0), GY(m.vel(T / 2)) - 13], v.v0 === 0 ? "at rest: v = 0" : v.mu > 0 ? "slope = −μg" : "flat: a = 0", {color: c.c2, size: 12, weight: 600, anchor: v.mu > 0 ? "start" : "middle"});
      tint(api);
    }
  });
})();
