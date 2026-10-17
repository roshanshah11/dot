// Velocity is the slope of the position-time graph. Five positions, 2.5 s apart, joined by straight segments; each
// segment's slope triangle shows its run (dashed, always 2.5 s) and its rise Delta x (teal). Below, the velocity-time
// graph: each segment's slope v = Delta x / Delta t becomes a flat amber step, so a flat stretch of x is v = 0 and a
// downhill stretch is a negative v. Drag the blue points or use the sliders. Both graphs zoom out only when a value
// Dot passes lies past the sliders' +-10 m.
(function () {
  var T = [0, 2.5, 5, 7.5, 10], KEYS = ["positionAt0SecondsMeters", "positionAt2_5SecondsMeters", "positionAt5SecondsMeters", "positionAt7_5SecondsMeters", "positionAt10SecondsMeters"];
  function pos(v) { return KEYS.map(function (k) { return v[k]; }); }
  function vel(v) { var P = pos(v); return [0, 1, 2, 3].map(function (i) { return (P[i + 1] - P[i]) / 2.5; }); }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };
  var sg = function (x) { return (x > 0 ? "+" : "") + f(x); };
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; }); }   // viz.css paints text ink
  var params = {};
  KEYS.forEach(function (k, i) { params[k] = {kind: "number", default: [-3, 4, 4, -2, 3][i], min: -10, max: 10, step: 0.5, label: "x(" + T[i] + ")"}; });

  Viz.register("velocity-as-slope-graph", {
    title: "Velocity as the slope of a position graph",
    subject: "physics",
    shows: "Drag the positions: each straight piece of the x-t graph has slope Δx/Δt, and that slope is the height of the matching step on the v-t graph",
    params: params,
    formula: function (v) {
      // the four segments as a small table: each rise over the common 2.5 s run gives that segment's slope
      var P = pos(v), V = vel(v), row = function (a) { return a.map(function (x) { return "\\!\\!" + Viz.n(x, 2); }).join("&"); };   // negative thin spaces trim the fixed column gap
      return "\\begin{array}{l|rrrr}\\Delta x\\ (\\mathrm{m})&" + row([0, 1, 2, 3].map(function (i) { return P[i + 1] - P[i]; })) + "\\\\ \\hline " +
        "v=\\tfrac{\\Delta x}{2.5\\,\\mathrm{s}}&" + row(V) + "\\end{array}";
    },
    status: function (v) {
      var P = pos(v), V = vel(v), still = V.every(function (x) { return Math.abs(x) < 1e-9; });
      if (still) return "It stays at x = " + f(P[0]) + " m the whole time: every segment is flat, so <b>v = 0</b> throughout.";
      if (V.every(function (x) { return Math.abs(x - V[0]) < 1e-9; })) return "One straight line, so one slope: the velocity is a constant <b>" + f(V[0]) + " m/s</b> for all 10 s.";
      var k = 0; V.forEach(function (x, i) { if (Math.abs(x) > Math.abs(V[k]) + 1e-9) k = i; });
      var flat = V.some(function (x) { return Math.abs(x) < 1e-9; }), back = V.some(function (x) { return x < -1e-9; });
      var tie = V.map(function (x, i) { return i !== k && Math.abs(Math.abs(x) - Math.abs(V[k])) < 1e-9 ? T[i] + "–" + T[i + 1] + " s" : null; }).filter(Boolean);
      return "Steepest from " + T[k] + " to " + T[k + 1] + " s" + (tie.length ? " (tied with " + tie.join(" and ") + ")" : "") + ": x " + (V[k] > 0 ? "rises " : "falls ") + f(Math.abs(P[k + 1] - P[k])) + " m in 2.5 s, so <b>v = " + f(V[k]) + " m/s</b>" +
        (flat ? "; a flat stretch means it is standing still." : back && V[k] > 0 ? "; downhill stretches mean it is moving back toward −x." : back ? ", moving toward −x." : ".");
    },
    examples: [
      {name: "Minimum supported values", values: {positionAt0SecondsMeters: -10, positionAt2_5SecondsMeters: -10, positionAt5SecondsMeters: -10, positionAt7_5SecondsMeters: -10, positionAt10SecondsMeters: -10}},
      {name: "Maximum supported values", values: {positionAt0SecondsMeters: 10, positionAt2_5SecondsMeters: 10, positionAt5SecondsMeters: 10, positionAt7_5SecondsMeters: 10, positionAt10SecondsMeters: 10}},
      {name: "constant velocity 2 m/s", values: {positionAt0SecondsMeters: -10, positionAt2_5SecondsMeters: -5, positionAt5SecondsMeters: 0, positionAt7_5SecondsMeters: 5, positionAt10SecondsMeters: 10}},
      {name: "out and back", values: {positionAt0SecondsMeters: -8, positionAt2_5SecondsMeters: 2, positionAt5SecondsMeters: 8, positionAt7_5SecondsMeters: 2, positionAt10SecondsMeters: -8}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      var c = api.color, P = pos(v), V = vel(v);
      var R = Math.max(10, Math.ceil(Math.max.apply(null, P.map(Math.abs)) / 5) * 5);
      var VR = Math.max(8, Math.ceil(Math.max.apply(null, V.map(Math.abs)) / 4) * 4);
      var x0 = 44, x1 = 380, X = function (t) { return x0 + (x1 - x0) * t / 10; };
      var top = 26, bot = 188, Y = function (x) { return top + (bot - top) * (R - x) / (2 * R); };
      var vz = 282, vh = 44, Yv = function (q) { return vz - vh * q / VR; };
      var pl = api.plane({x: [0, 10], y: [-R, R], box: [x0, top, x1 - x0, bot - top], equal: false, grid: false, axes: false});
      // frames: grid, zero lines, tick labels; the t labels between the graphs serve both
      [-R, -R / 2, R / 2, R].forEach(function (q) { api.line([x0, Y(q)], [x1, Y(q)], {color: c.grid, width: 1}); });
      [-VR, -VR / 2, VR / 2, VR].forEach(function (q) { api.line([x0, Yv(q)], [x1, Yv(q)], {color: c.grid, width: 1}); });
      T.forEach(function (t) {
        api.line([X(t), top], [X(t), bot], {color: c.grid, width: 1});
        api.line([X(t), Yv(VR)], [X(t), Yv(-VR)], {color: c.grid, width: 1});
        api.label([X(t), 205], String(t), {color: c.muted, size: 12, anchor: "middle"});
      });
      api.line([x0, Y(0)], [x1, Y(0)], {color: c.axis, width: 1.2});
      api.line([x0, vz], [x1, vz], {color: c.axis, width: 1.2});
      api.line([x0, top], [x0, bot], {color: c.axis, width: 1.2});
      api.line([x0, Yv(VR)], [x0, Yv(-VR)], {color: c.axis, width: 1.2});
      [-R, -R / 2, 0, R / 2, R].forEach(function (q) { api.label([x0 - 6, Y(q)], api.fmt(q), {color: c.muted, size: 12, anchor: "end"}); });
      [-VR, 0, VR].forEach(function (q) { api.label([x0 - 6, Yv(q)], api.fmt(q), {color: c.muted, size: 12, anchor: "end"}); });
      api.label([4, 12], "x (m)", {color: c.muted, size: 12.5});
      api.label([4, 205], "t (s)", {color: c.muted, size: 12.5});
      api.label([4, 226], "v (m/s)", {color: c.c3, size: 12.5});
      api.label([x1, 12], "each run Δt = 2.5 s", {color: c.muted, size: 12, anchor: "end"});
      // slope triangles: run dashed, rise teal, labelled in the corner (inside if there is room, else just outside)
      for (var i = 0; i < 4; i++) {
        var dx = P[i + 1] - P[i];
        if (Math.abs(dx) < 1e-9) continue;
        var lx = X(T[i + 1]), ya = Y(P[i]), yb = Y(P[i + 1]), L = Math.abs(yb - ya), dir = yb < ya ? -1 : 1;
        api.polygon([[X(T[i]), ya], [lx, ya], [lx, yb]], {fill: c.c1, fillOpacity: 0.07});
        api.line([X(T[i]), ya], [lx, ya], {color: c.muted, width: 1.3, dash: "4 3"});
        api.line([lx, ya], [lx, yb], {color: c.c1, width: 2.2});
        var inside = L >= 30;
        api.label([lx - (inside ? 6 : 10), ya + (inside ? dir : -dir) * 10], sg(dx) + " m", {color: c.c1, size: 12, weight: 650, anchor: "end"});
      }
      // the position graph and its draggable points
      api.polyline(T.map(function (t, k) { return [X(t), Y(P[k])]; }), {stroke: c.c2, width: 2.6});
      // the velocity graph: one flat step per segment, height = that segment's slope
      for (var j = 0; j < 4; j++) {
        var a = X(T[j]) + 3, b = X(T[j + 1]) - 3, yv = Yv(V[j]);
        if (Math.abs(V[j]) > 1e-9) api.rect(a, Math.min(yv, vz), b - a, Math.abs(yv - vz), {fill: c.c3, fillOpacity: 0.22, rx: 0});
        api.line([a, yv], [b, yv], {color: c.c3, width: 3});
        api.label([(a + b) / 2, V[j] < -1e-9 ? yv + 10 : yv - 9], api.fmt(V[j], 2), {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      }
      T.forEach(function (t, k) {
        api.handle([X(t), Y(P[k])], {color: c.c2, r: 6, plane: pl, snap: 0.5, onDrag: function (q) {
          var patch = {}; patch[KEYS[k]] = Math.max(-10, Math.min(10, q[1])); api.set(patch);
        }});
      });
      tint(api);
    }
  });
})();
