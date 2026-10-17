// One cilium's beat, computed. The power stroke (a third of the cycle) swings the cilium forward nearly straight and
// upright; the recovery stroke brings it back with a bend that runs from base to tip, so it travels low and edgewise
// along the cell surface. The push on the fluid is resistive-force theory (a slender rod is dragged twice as hard
// broadside as lengthwise) weighted by height above the cell, because a force near a no-slip wall pumps fluid in
// proportion to its height (Blake; Liron). Water at this scale has no inertia, so a stroke that comes back the same way
// it went ("same path back") pumps nothing: the forward and backward pushes cancel exactly. Push units are relative.
(function () {
  var P = 1 / 3, N = 24, M = 144, D2R = Math.PI / 180, cache = {};
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function theta(phi, asym) {   // angle from vertical (degrees) as a function of arclength s in [0, 1]
    phi = phi - Math.floor(phi);
    var power = function (u) { var base = -70 + 150 * (1 - Math.cos(Math.PI * u)) / 2, lag = 22 * Math.sin(Math.PI * u); return function (s) { return base - lag * s; }; };
    if (phi < P) return power(phi / P);
    var u = (phi - P) / (1 - P);
    if (!asym) return power(1 - u);
    var bend = -0.2 + 1.4 * u;
    return function (s) { return -70 + 150 * smooth(bend - 0.2, bend + 0.2, s); };
  }
  function shape(phi, asym) {
    var th = theta(phi, asym), pts = [[0, 0]], x = 0, y = 0;
    for (var k = 0; k < N; k++) { var a = th((k + 0.5) / N) * D2R; x += Math.sin(a) / N; y += Math.cos(a) / N; pts.push([x, y]); }
    return pts;
  }
  function push(phi, asym) {    // wall-weighted x-force on the fluid at this phase, per unit beat rate
    var h = 1e-3, A = shape(phi - h, asym), B = shape(phi + h, asym), S = shape(phi, asym), F = 0;
    for (var k = 0; k < N; k++) {
      var mx = (S[k][0] + S[k + 1][0]) / 2, my = (S[k][1] + S[k + 1][1]) / 2;
      var vx = ((B[k][0] + B[k + 1][0]) - (A[k][0] + A[k + 1][0])) / (4 * h), vy = ((B[k][1] + B[k + 1][1]) - (A[k][1] + A[k + 1][1])) / (4 * h);
      var tx = (S[k + 1][0] - S[k][0]) * N, ty = (S[k + 1][1] - S[k][1]) * N, vt = vx * tx + vy * ty;
      var fx = 2 * (vx - vt * tx) + 1 * vt * tx;          // zeta_perp = 2, zeta_par = 1
      F += my * fx / N;
    }
    return F;
  }
  function beat(asym) {
    var key = asym ? "a" : "s";
    if (cache[key]) return cache[key];
    var F = [], Q = 0, Qp = 0;
    for (var j = 0; j < M; j++) { var phi = (j + 0.5) / M, f = push(phi, asym); F.push(f); Q += f / M; if (phi < P) Qp += f / M; }
    var net = Math.abs(Q / Qp) < 0.005 ? 0 : Q / Qp;
    return (cache[key] = {F: F, net: net, back: 1 - net, max: Math.max.apply(null, F.map(Math.abs))});
  }
  var phaseOf = function (v) { return ((v.step || 1) - 1) / 12; };
  Viz.register("ciliary-power-and-recovery-stroke", {
    title: "Cilia: power and recovery strokes",
    subject: "biology",
    shows: "Play one beat: the cilium sweeps forward straight and tall, then comes back bent and low, so each beat moves fluid one way; make it come back the same way and the flow cancels",
    params: {
      asym: {kind: "boolean", default: true, label: "\\text{beat}", on: "power + recovery", off: "same path back"},
      f: {kind: "integer", default: 12, min: 5, max: 25, label: "f\\ (\\text{Hz})"}
    },
    steps: ["power stroke, 1 of 4", "power stroke, 2 of 4", "power stroke, 3 of 4", "power stroke, 4 of 4",
      "recovery stroke, 1 of 8", "recovery stroke, 2 of 8", "recovery stroke, 3 of 8", "recovery stroke, 4 of 8",
      "recovery stroke, 5 of 8", "recovery stroke, 6 of 8", "recovery stroke, 7 of 8", "recovery stroke, 8 of 8"],
    stepMs: 450,
    formula: function (v) {
      var b = beat(v.asym), back = Viz.n(b.back), net = Viz.n(b.net);
      return "\\text{net}=\\text{fwd}-\\text{back}=1-" + back + "=" + net + "\\newline\\text{flow}\\propto " + net + "\\times " + v.f + "\\,\\text{Hz}=" + Viz.n(b.net * v.f, 1) + "\\ \\text{s}^{-1}";
    },
    status: function (v) {
      var b = beat(v.asym), ph = phaseOf(v), pw = ph < P - 1e-9;
      if (!v.asym) return (pw ? "Forward stroke" : "Return stroke") + ": coming back along the same path undoes the forward push exactly (water has no inertia at this scale), so the net flow is <b>zero</b> at any beat rate.";
      return (pw ? "Power stroke: the cilium sweeps forward <b>straight and tall</b>, broadside to the fluid and far from the cell, so it pushes hard"
                 : "Recovery stroke: the cilium swings back <b>bent and low</b> along the cell surface, edgewise, so it drags little fluid back") +
        "; over a beat <b>" + Math.round(b.net * 100) + "%</b> of the forward push survives, " + v.f + " times a second.";
    },
    examples: [
      {name: "power stroke, upright", values: {step: 3}},
      {name: "recovery stroke, low", values: {step: 8}},
      {name: "same path back: no net flow", values: {asym: false, step: 8}},
      {name: "slowest beat (5 Hz)", values: {f: 5, step: 2}},
      {name: "fastest beat (25 Hz)", values: {f: 25, step: 6}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, b = beat(v.asym), ph = phaseOf(v), pw = ph < P - 1e-9, L = 122, bx = 150, by = 194;
      var PX = function (q) { return [bx + L * q[0], by - L * q[1]]; };
      // the cell surface with its basal body
      api.rect(8, by, 384, 18, {fill: c.ink, fillOpacity: 0.06, rx: 4});
      api.line([8, by], [392, by], {color: c.muted, width: 1.4});
      api.rect(bx - 4, by + 1, 8, 12, {fill: c.muted, rx: 2});
      api.label([388, by + 9], "cell surface", {color: c.muted, size: 12, anchor: "end"});
      // ghosts of the whole beat and the path the tip traces
      for (var k = 0; k < 12; k++) {
        var gp = k / 12, gpow = gp < P - 1e-9;
        if (Math.abs(gp - ph) < 1e-9) continue;
        api.polyline(shape(gp, v.asym).map(PX), {stroke: gpow ? c.c3 : c.c2, width: 1.2, opacity: 0.28});
      }
      var tipP = [], tipR = [];
      for (var j = 0; j <= 120; j++) { var tp = j / 120, tip = PX(shape(tp, v.asym)[N]); (tp <= P ? tipP : tipR).push(tip); }
      tipR.unshift(tipP[tipP.length - 1]);
      api.polyline(tipP, {stroke: c.c3, width: 1.6, dash: "2 4"});
      api.polyline(tipR, {stroke: c.c2, width: 1.6, dash: "2 4", opacity: v.asym ? 1 : 0.55});
      // the cilium now
      var now = shape(ph, v.asym).map(PX);
      api.polyline(now, {stroke: pw ? c.c3 : c.c2, width: 5});
      api.circle(now[N], 3.5, {fill: pw ? c.c3 : c.c2});
      api.label([300, 70], v.asym ? "power stroke" : "forward stroke", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.label(v.asym ? [330, 150] : [300, 86], v.asym ? "recovery stroke" : "return: same path", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      // net flow above the cilia
      var al = 7 * b.net * v.f;
      if (al > 2) { api.arrow([200 - al / 2, 22], [200 + al / 2, 22], {color: c.c1, width: 3, halo: false}); api.label([200 - al / 2 - 8, 22], "net flow", {color: c.c1, size: 12.5, weight: 650, anchor: "end"}); }
      else api.label([200, 22], "no net flow", {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      // push on the fluid over one beat: forward (amber) and back (blue); the net is what is left
      var x0 = 44, x1 = 388, mid = 268, hh = 24, bw = (x1 - x0) / M;
      api.label([8, 234], "push on fluid", {color: c.muted, size: 12});
      api.label([x1, 234], "one beat = " + api.fmt(1000 / v.f, 0) + " ms", {color: c.muted, size: 12, anchor: "end"});
      b.F.forEach(function (f, j) {
        var hgt = f / b.max * hh;
        api.rect(x0 + j * bw, f > 0 ? mid - hgt : mid, bw + 0.3, Math.abs(hgt), {fill: f > 0 ? c.c3 : c.c2, fillOpacity: 0.75, rx: 0});
      });
      api.line([x0, mid], [x1, mid], {color: c.axis, width: 1});
      api.line([x0 + ph * (x1 - x0), mid - hh - 4], [x0 + ph * (x1 - x0), mid + hh + 4], {color: c.ink, width: 1.5});
      api.label([x0 - 6, mid - 12], "fwd", {color: c.c3, size: 12, anchor: "end"});
      api.label([x0 - 6, mid + 12], "back", {color: c.c2, size: 12, anchor: "end"});
      api.label([x0, mid + hh + 16], "0", {color: c.muted, size: 12, anchor: "middle"});
      api.label([x0 + P * (x1 - x0), mid + hh + 16], "T/3", {color: c.muted, size: 12, anchor: "middle"});
      api.label([x1, mid + hh + 16], "T", {color: c.muted, size: 12, anchor: "middle"});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
