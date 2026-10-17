// Average speed is total distance over total time: on a distance-time graph it is the slope of the straight
// chord from the start to the finish. A trip of two legs at different speeds shows why it is not the plain mean of
// the two speeds: the slower leg takes longer, so it gets more weight. The faint line is what the mean of the
// speeds would predict; it misses the finish whenever the legs take different times.
// No queue schema: four inputs (each leg's distance and speed) are the least that make the point.
(function () {
  function calc(v) {
    var t1 = v.d1 / v.v1, t2 = v.d2 / v.v2, d = v.d1 + v.d2, t = t1 + t2;
    return {t1: t1, t2: t2, d: d, t: t, avg: d / t, mean: (v.v1 + v.v2) / 2};
  }
  function nice(raw) { var e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; }
  function h(x) { return Viz.fmt(x, x < 1 ? 3 : 2); }

  Viz.register("average-speed-distance-time", {
    title: "Average speed: distance over time",
    subject: "physics",
    shows: "Set two legs of a trip: the average speed is the slope of the start-to-finish chord, total distance over total time, not the mean of the two speeds",
    params: {
      d1: {kind: "number", default: 60, min: 5, max: 150, step: 5, label: "d_1\\ (\\text{km})"},
      v1: {kind: "number", default: 60, min: 10, max: 120, step: 5, label: "v_1\\ (\\text{km/h})"},
      d2: {kind: "number", default: 60, min: 5, max: 150, step: 5, label: "d_2\\ (\\text{km})"},
      v2: {kind: "number", default: 40, min: 10, max: 120, step: 5, label: "v_2\\ (\\text{km/h})"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\bar v=\\dfrac{d}{t}=\\dfrac{d_1+d_2}{d_1/v_1+d_2/v_2}=\\dfrac{" + Viz.n(v.d1) + "+" + Viz.n(v.d2) + "}{" + Viz.n(k.t1, 3) + "+" + Viz.n(k.t2, 3) + "}\\\\" +
        "\\quad=\\dfrac{" + Viz.n(k.d) + "\\ \\text{km}}{" + Viz.n(k.t, 3) + "\\ \\text{h}}=" + Viz.n(k.avg) + "\\ \\text{km/h}\\end{array}";
    },
    status: function (v) {
      var k = calc(v), avg = Viz.fmt(k.avg) + " km/h";
      if (v.v1 === v.v2) return "Both legs at " + Viz.fmt(v.v1) + " km/h, so the average speed is simply <b>" + avg + "</b>.";
      if (Math.abs(k.t1 - k.t2) < 1e-9) return "Both legs take " + h(k.t1) + " h, so here the average does equal the mean of the speeds: <b>" + avg + "</b>.";
      var slow = v.v1 < v.v2 ? "first" : "second";
      return "The trip covers " + Viz.fmt(k.d) + " km in " + h(k.t) + " h, so the average is <b>" + avg + "</b>, not the " + Viz.fmt(k.mean) +
        " km/h mean of the speeds: each speed counts for the time spent at it, and the slower " + slow + " leg takes " +
        (k.t1 > k.t2 === (slow === "first") ? "more" : "less") + " than half the time.";
    },
    examples: [
      {name: "slowest, shortest legs", values: {d1: 5, v1: 10, d2: 5, v2: 10}},
      {name: "longest, fastest legs", values: {d1: 150, v1: 120, d2: 150, v2: 120}},
      {name: "a short fast leg and a long slow one", values: {d1: 5, v1: 120, d2: 150, v2: 10}},
      {name: "equal times: mean of speeds works", values: {d1: 30, v1: 30, d2: 90, v2: 90}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v);
      var ts = nice(k.t * 1.1 / 5), ds = nice(k.d * 1.1 / 5), T = Math.ceil(k.t * 1.08 / ts) * ts, D = Math.ceil(k.d * 1.12 / ds) * ds;
      var pl = api.plane({x: [0, T], y: [0, D], box: [52, 28, 330, 222], equal: false, grid: false, ticks: false, labels: false});
      var O = pl.px([0, 0]), J = pl.px([k.t1, v.d1]), F = pl.px([k.t, k.d]), top = pl.y(D);
      // ticks, leaving room for the finish's own t and d marked on the axes in amber
      for (var x = ts; x <= T + 1e-9; x += ts) {
        api.line([pl.x(x), top], [pl.x(x), O[1]], {color: c.grid, width: 1});
        if (Math.abs(pl.x(x) - F[0]) > 34) api.label([pl.x(x), O[1] + 14], api.fmt(x), {color: c.muted, size: 12, anchor: "middle"});
      }
      for (var y = ds; y <= D + 1e-9; y += ds) {
        api.line([O[0], pl.y(y)], [pl.x(T), pl.y(y)], {color: c.grid, width: 1});
        if (Math.abs(pl.y(y) - F[1]) > 14) api.label([O[0] - 6, pl.y(y)], api.fmt(y), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([pl.x(T), O[1] + 30], "time (h)", {color: c.muted, size: 12, anchor: "end"});
      api.label([6, 12], "distance (km)", {color: c.muted, size: 12});
      api.line(F, [F[0], O[1]], {color: c.c3, width: 1, dash: "3 4", opacity: 0.7});
      api.line(F, [O[0], F[1]], {color: c.c3, width: 1, dash: "3 4", opacity: 0.7});
      api.label([F[0], O[1] + 14], h(k.t) + " h", {color: c.c3, size: 12, anchor: "middle", weight: 650});
      api.label([O[0] - 6, F[1]], api.fmt(k.d, 1), {color: c.c3, size: 12, anchor: "end", weight: 650});
      // what the mean of the speeds would predict (clipped to the plot), labelled where it leaves the plot
      if (Math.abs(k.mean - k.avg) > 1e-6) {
        pl.lineThrough([0, 0], [1, k.mean], {color: c.muted, width: 1.5, dash: "2 4"});
        var ex = pl.px(pl.through([0, 0], [1, k.mean])[1]), mlab = "mean of speeds " + api.fmt(k.mean);
        if (ex[1] <= top + 1) {
          var fits = ex[0] + 6 + mlab.length * 6.8 < 392;
          api.label([ex[0] + (fits ? 6 : -6), top + 10], mlab, {color: c.muted, size: 12, anchor: fits ? "start" : "end"});
        } else api.label([ex[0] - 4, ex[1] - 10], mlab, {color: c.muted, size: 12, anchor: "end"});
      }
      // the average: the chord from start to finish, labelled on the side away from the two legs
      api.line(O, F, {color: c.c3, width: 2.5, dash: "8 5"});
      api.line(O, J, {color: c.c1, width: 4});
      api.line(J, F, {color: c.c2, width: 4});
      api.point(J, {color: c.ink, r: 4});
      api.point(F, {color: c.c3, r: 5.5});
      var dx = F[0] - O[0], dy = F[1] - O[1], L = Math.hypot(dx, dy), side = v.v1 >= v.v2 ? 1 : -1;   // 1: legs above the chord
      var am = [O[0] + dx * 0.56 - side * dy / L * 16, O[1] + dy * 0.56 + side * dx / L * 16];
      api.label(am, "average " + api.fmt(k.avg) + " km/h", {color: c.c3, size: 13, weight: 700, anchor: side > 0 ? "start" : "end"});
      // the legs' speeds and times, keyed by colour just under the finish line's height
      var ky = F[1] + 18;
      [[c.c1, "leg 1: " + api.fmt(v.v1) + " km/h for " + h(k.t1) + " h"], [c.c2, "leg 2: " + api.fmt(v.v2) + " km/h for " + h(k.t2) + " h"]].forEach(function (row, i) {
        api.line([O[0] + 10, ky + i * 17], [O[0] + 26, ky + i * 17], {color: row[0], width: 4});
        api.label([O[0] + 32, ky + i * 17], row[1], {color: row[0], size: 12.5, weight: 650});
      });
    }
  });
})();
