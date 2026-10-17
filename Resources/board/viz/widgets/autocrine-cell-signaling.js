// Autocrine signaling: a cell secretes a ligand and responds to it through its own receptors (IL-2 on activated
// T cells, growth factors in many tumors). Occupancy follows simple binding, theta = [L] / ([L] + Kd), so half the
// receptors are full when [L] = Kd. The response often switches on more ligand and receptor, closing a positive loop;
// a receptor-blocking antibody breaks it, a standard test for an autocrine loop.
(function () {
  var N = 12;
  function theta(v) { return v.blocked ? 0 : v.L / (v.L + v.kd); }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

  Viz.register("autocrine-cell-signaling", {
    title: "Autocrine signaling: a cell talks to itself",
    subject: "biology",
    shows: "Step through a cell secreting a ligand that binds its own receptors; raise the ligand level or the receptors' Kd to change how many are occupied, or block the receptors to break the loop",
    params: {
      L: {kind: "number", default: 2, min: 0, max: 10, step: 0.1, label: "[L]\\ (\\text{nM})"},
      kd: {kind: "number", default: 1, min: 0.1, max: 5, step: 0.1, label: "K_d\\ (\\text{nM})"},
      blocked: {kind: "boolean", default: false, label: "\\text{antibody}", on: "blocking", off: "none"}
    },
    steps: ["secrete the ligand", "bind its own receptors", "respond and reinforce"],
    stepMs: 1800,
    formula: function (v) {
      if (v.blocked) return "\\theta=\\frac{[L]}{[L]+K_d}\\ \\to\\ 0\\quad\\text{(receptors blocked)}";
      return "\\theta=\\frac{[L]}{[L]+K_d}=\\frac{" + Viz.n(v.L, 1) + "}{" + Viz.n(v.L, 1) + "+" + Viz.n(v.kd, 1) + "}=" + Viz.n(theta(v), 2);
    },
    status: function (v) {
      var s = v.step || 1, th = theta(v), pct = Math.round(th * 100) + "%";
      if (s === 1) return v.L > 0 ? "The cell secretes its ligand into the fluid around itself, where it builds up to <b>" + api_fmt(v.L) + " nM</b>."
                                  : "The cell is not secreting yet, so there is <b>no ligand</b> around it to bind.";
      if (v.blocked) return s === 2 ? "A blocking antibody sits on the receptors, so the cell's own ligand cannot bind: <b>0%</b> occupied."
                                    : "With the receptors blocked <b>no signal</b> reaches the nucleus and the loop is broken, a standard test for autocrine signaling.";
      if (s === 2) return "The ligand binds receptors on the very cell that made it: with Kd = " + api_fmt(v.kd) + " nM, <b>" + pct + "</b> of them are occupied" +
        (Math.abs(v.L - v.kd) < 1e-9 && v.L > 0 ? ", exactly half because [L] = Kd." : ".");
      return th < 0.005 ? "No receptors are occupied, so <b>no signal</b> reaches the nucleus." :
        "Occupied receptors (<b>" + pct + "</b>) signal to the nucleus, which turns on genes including more ligand and receptor, so the loop reinforces itself.";
    },
    examples: [
      {name: "no ligand", values: {L: 0, step: 2}},
      {name: "half occupied: [L] = Kd", values: {L: 1, kd: 1, step: 2}},
      {name: "saturated, tight binding", values: {L: 10, kd: 0.1, step: 3}},
      {name: "weak binding", values: {L: 2, kd: 5, step: 3}},
      {name: "blocked receptors", values: {blocked: true, step: 3}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, th = theta(v), C = [112, 150], R = 64;
      var L = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var P = function (r, a) { return [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)]; };
      // the cell, its nucleus and secretory vesicles
      api.circle(C, R, {fill: c.ink, fillOpacity: 0.05, stroke: c.ink, width: 2});
      var glow = s === 3 ? th : 0;
      api.circle([C[0] - 10, C[1] + 10], 27, {fill: c.c6, fillOpacity: 0.1 + 0.45 * glow, stroke: c.c6, width: 1.8});
      L([C[0] - 10, C[1] + 10], "nucleus", c.c6, {anchor: "middle", size: 12, weight: 500});
      var ves = [[C[0] + 22, C[1] - 30], [C[0] + 36, C[1] - 12], [C[0] + 8, C[1] - 42]];
      ves.forEach(function (q) { api.circle(q, 6, {fill: c.c3, fillOpacity: 0.18, stroke: c.c3, width: 1.4}); api.circle(q, 2.2, {fill: c.c3}); });
      // receptors around the membrane, bound ones carry a ligand; antibodies cap them when blocked
      var nBound = s >= 2 ? Math.round(th * N) : 0, order = [0, 6, 3, 9, 1, 7, 4, 10, 2, 8, 5, 11];
      for (var k = 0; k < N; k++) {
        var a = -Math.PI / 2 + k * 2 * Math.PI / N + 0.13, base = P(R, a), tip = P(R + 11, a);
        var bound = order.indexOf(k) < nBound;
        api.line(base, tip, {color: c.c2, width: 2.4});
        api.line(tip, [tip[0] + 6 * Math.cos(a - 0.6), tip[1] + 6 * Math.sin(a - 0.6)], {color: c.c2, width: 2.2});
        api.line(tip, [tip[0] + 6 * Math.cos(a + 0.6), tip[1] + 6 * Math.sin(a + 0.6)], {color: c.c2, width: 2.2});
        if (v.blocked) api.rect(P(R + 17, a)[0] - 4, P(R + 17, a)[1] - 4, 8, 8, {fill: c.c5, rx: 2});
        else if (bound) api.circle(P(R + 16, a), 3.6, {fill: c.c3});
        if (s === 3 && bound) api.arrow(P(R - 4, a), [C[0] - 10 + 31 * Math.cos(a), C[1] + 10 + 31 * Math.sin(a)], {color: c.c1, width: 1.6, halo: false});
      }
      // free ligand around the cell, more as [L] rises
      var r = rng(5), nFree = Math.round(v.L * 3.2);
      for (var i = 0; i < nFree; i++) { var aa = r() * 2 * Math.PI, rr = R + 26 + r() * 18; api.circle(P(rr, aa), 2.6, {fill: c.c3, opacity: 0.85}); }
      if (s === 1 && v.L > 0) {
        api.arrow(ves[0], P(R + 22, -1.0), {color: c.c3, width: 1.8, halo: false});
        api.arrow(ves[1], P(R + 22, -0.45), {color: c.c3, width: 1.8, halo: false});
        L([C[0] + 10, C[1] - R - 36], "secreted ligand", c.c3, {anchor: "middle"});
      }
      if (s === 2) L([C[0], C[1] - R - 50], v.blocked ? "antibody on every receptor" : nBound + " of " + N + " receptors bound", v.blocked ? c.c5 : c.c2, {anchor: "middle"});
      if (s === 3) {
        if (th >= 0.005) {
          api.path("M " + (C[0] + 4) + " " + (C[1] - 4) + " Q " + (C[0] + 36) + " " + (C[1] + 2) + " " + (ves[1][0] + 2) + " " + (ves[1][1] + 8), {stroke: c.c4, width: 2, dash: "4 3", arrow: true});
          L([C[0], C[1] + R + 46], "more ligand + receptor: the loop feeds itself", c.c4, {anchor: "middle"});
        } else L([C[0], C[1] + R + 46], v.blocked ? "loop broken: no signal" : "no signal", c.c5, {anchor: "middle"});
      }
      // the binding curve theta([L]) with this Kd
      var pl = api.plane({x: [0, 10], y: [0, 1], box: [250, 46, 136, 150], equal: false, grid: false, ticks: false, labels: false});
      var pts = []; for (var x = 0; x <= 10.001; x += 0.1) pts.push(pl.px([x, x / (x + v.kd)]));
      api.polyline(pts, {stroke: c.c2, width: 2.2, opacity: v.blocked ? 0.35 : 1});
      api.line(pl.px([0, 0.5]), pl.px([Math.min(v.kd, 10), 0.5]), {color: c.muted, width: 1, dash: "3 3"});
      api.line(pl.px([v.kd, 0]), pl.px([v.kd, 0.5]), {color: c.muted, width: 1, dash: "3 3"});
      L([pl.x(v.kd), pl.y(0) + 14], "Kd", c.muted, {anchor: "middle", weight: 500});
      L([pl.x(0) - 6, pl.y(1)], "1", c.muted, {anchor: "end", weight: 500}); L([pl.x(0) - 6, pl.y(0.5)], "½", c.muted, {anchor: "end", weight: 500});
      L([pl.x(10), pl.y(0) + 14], "10 nM", c.muted, {anchor: "end", weight: 500});
      L([pl.x(0), 26], "θ, receptors bound", c.muted, {weight: 500});
      L([pl.x(10), pl.y(0) + 30], "[L]", c.muted, {anchor: "end", weight: 500});
      api.point(pl.px([v.L, th]), {color: v.blocked ? c.c5 : c.c3, r: 5.5});
      L([pl.x(v.L) + (v.L > 6 ? -8 : 8), pl.y(th) + (th > 0.85 ? 14 : -12)], Math.round(th * 100) + "%", v.blocked ? c.c5 : c.c3, {anchor: v.L > 6 ? "end" : "start", size: 13});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
  function api_fmt(x) { return Viz.fmt(x, 1); }
})();
