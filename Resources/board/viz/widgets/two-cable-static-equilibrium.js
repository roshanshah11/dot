// A weight W hangs from a knot held by two cables tied to the ceiling; theta1 and theta2 are each cable's angle above
// the horizontal. The knot is at rest, so the forces on it sum to zero: horizontally T1 cos theta1 = T2 cos theta2,
// vertically T1 sin theta1 + T2 sin theta2 = W. Solving: T1 = W cos theta2 / sin(theta1 + theta2) and
// T2 = W cos theta1 / sin(theta1 + theta2). Left: the scene (cable thickness grows with its tension). Right: the three
// forces drawn tip to tail to one scale, which closes into a triangle exactly because they sum to zero.
(function () {
  var D = Math.PI / 180;
  function calc(v) {
    var a = v.leftAngleDegrees * D, b = v.rightAngleDegrees * D, W = v.weightNewtons, s = Math.sin(a + b);
    var T1 = W * Math.cos(b) / s, T2 = W * Math.cos(a) / s;
    return {a: a, b: b, W: W, T1: T1, T2: T2, H: T1 * Math.cos(a), V1: T1 * Math.sin(a), V2: T2 * Math.sin(b)};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 1 : d); };

  Viz.register("two-cable-static-equilibrium", {
    title: "Two cables holding a weight",
    subject: "physics",
    shows: "Change the cable angles and the weight: the tensions' horizontal parts cancel and their vertical parts add to W, so flatter cables pull much harder",
    params: {
      leftAngleDegrees: {kind: "number", default: 45, min: 10, max: 80, step: 1, label: "\\theta_1\\ (^\\circ)"},
      rightAngleDegrees: {kind: "number", default: 45, min: 10, max: 80, step: 1, label: "\\theta_2\\ (^\\circ)"},
      weightNewtons: {kind: "number", default: 200, min: 50, max: 500, step: 10, label: "W\\ (\\text{N})"}
    },
    formula: function (v) {
      var k = calc(v), sum = Viz.n(v.leftAngleDegrees + v.rightAngleDegrees, 0), W = Viz.n(k.W, 0);
      return "\\begin{array}{l}T_{1,2}=\\dfrac{W\\cos\\theta_{2,1}}{\\sin(\\theta_1+\\theta_2)}\\\\[6pt]" +
        "T_1=\\dfrac{" + W + "\\cos" + Viz.n(v.rightAngleDegrees, 0) + "^\\circ}{\\sin" + sum + "^\\circ}=" + Viz.n(k.T1, 1) + "\\,\\text{N}\\\\[6pt]" +
        "T_2=\\dfrac{" + W + "\\cos" + Viz.n(v.leftAngleDegrees, 0) + "^\\circ}{\\sin" + sum + "^\\circ}=" + Viz.n(k.T2, 1) + "\\,\\text{N}\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (v.leftAngleDegrees === v.rightAngleDegrees) {
        var r = k.T1 / k.W;
        return "Equal angles share the load: each cable pulls <b>" + f(k.T1) + " N</b>, " + (r >= 0.995 ? Viz.fmt(r, 2) + " times" : Math.round(100 * r) + "% of") +
          " the weight, yet only its vertical part T sin θ = " + f(k.V1) + " N (half the weight) holds it up.";
      }
      var steepLeft = v.leftAngleDegrees > v.rightAngleDegrees;
      return "The steeper cable carries more: <b>T" + (steepLeft ? "₁" : "₂") + " = " + f(steepLeft ? k.T1 : k.T2) + " N</b> against T" + (steepLeft ? "₂" : "₁") + " = " +
        f(steepLeft ? k.T2 : k.T1) + " N; their horizontal pulls cancel at " + f(k.H) + " N each and their vertical parts add to the " + f(k.W, 0) + " N weight.";
    },
    examples: [
      {name: "Minimum supported values", values: {leftAngleDegrees: 10, rightAngleDegrees: 10, weightNewtons: 50}},
      {name: "Maximum supported values", values: {leftAngleDegrees: 80, rightAngleDegrees: 80, weightNewtons: 500}},
      {name: "Asymmetric cable angles", values: {leftAngleDegrees: 20, rightAngleDegrees: 70, weightNewtons: 300}},
      {name: "flat cables, heavy weight", values: {leftAngleDegrees: 10, rightAngleDegrees: 15, weightNewtons: 500}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), ceil = 34, cx = 128;
      // the scene: knot depth h fits both anchors inside 224 px of ceiling
      var cot1 = 1 / Math.tan(k.a), cot2 = 1 / Math.tan(k.b), h = Math.min(118, 224 / (cot1 + cot2));
      var A1x = cx - h * (cot1 + cot2) / 2, K = [A1x + h * cot1, ceil + h], A1 = [A1x, ceil], A2 = [K[0] + h * cot2, ceil];
      api.line([12, ceil], [244, ceil], {color: c.muted, width: 2.5});
      for (var x = 18; x <= 244; x += 10) api.line([x, ceil], [x - 7, ceil - 8], {color: c.muted, width: 1});
      var big = Math.max(k.T1, k.T2, k.W);
      api.line(A1, K, {color: c.c1, width: 1.5 + 4 * k.T1 / big});
      api.line(A2, K, {color: c.c2, width: 1.5 + 4 * k.T2 / big});
      // angles at the ceiling
      var arc = function (P, from, to, col) { var pts = []; for (var i = 0; i <= 16; i++) { var t = from + (to - from) * i / 16; pts.push([P[0] + 22 * Math.cos(t), P[1] + 22 * Math.sin(t)]); } api.polyline(pts, {stroke: col, width: 1.6}); };
      arc(A1, 0, k.a, c.c1); arc(A2, Math.PI, Math.PI - k.b, c.c2);
      var inward = A2[0] - A1[0] > 150;
      api.label([A1[0] + (inward ? 4 : -4), ceil - 14], "θ₁ " + f(v.leftAngleDegrees, 0) + "°", {color: c.c1, size: 12.5, weight: 650, anchor: inward ? "start" : "end"});
      api.label([A2[0] + (inward ? -4 : 4), ceil - 14], "θ₂ " + f(v.rightAngleDegrees, 0) + "°", {color: c.c2, size: 12.5, weight: 650, anchor: inward ? "end" : "start"});
      // tension labels beside each cable: outside if there is room, else on the inner side
      var m1 = [(A1[0] + K[0]) / 2, (A1[1] + K[1]) / 2], m2 = [(A2[0] + K[0]) / 2, (A2[1] + K[1]) / 2];
      var t1 = "T₁ " + f(k.T1, 0) + " N", t2 = "T₂ " + f(k.T2, 0) + " N", wd = function (t) { return t.length * 12.5 * 0.56; };
      var n1 = [Math.sin(k.a), Math.cos(k.a)], n2 = [Math.sin(k.b), Math.cos(k.b)];
      // outside and below each cable, slid along to stay in the scene; if sliding would put it on the cable, inner side
      var y1 = m1[1] + 14 * n1[1] + 2, xe = Math.max(m1[0] - 12 * n1[0] - 4, 8 + wd(t1)), ok1 = xe <= A1[0] + (y1 - ceil) * cot1 - 4;
      var y2 = m2[1] + 14 * n2[1] + 2, xs = Math.min(m2[0] + 12 * n2[0] + 4, 252 - wd(t2)), ok2 = xs >= A2[0] - (y2 - ceil) * cot2 + 4;
      api.label(ok1 ? [xe, y1] : [m1[0] + 12 * n1[0] + 6, m1[1] - 12 * n1[1] - 2], t1, {color: c.c1, size: 12.5, weight: 650, anchor: ok1 ? "end" : "start"});
      api.label(ok2 ? [xs, y2] : [m2[0] - 12 * n2[0] - 6, m2[1] - 12 * n2[1] - 2], t2, {color: c.c2, size: 12.5, weight: 650, anchor: ok2 ? "start" : "end"});
      // the hanging weight
      var side = 24 + 20 * (k.W - 50) / 450, by = K[1] + 16;
      api.line(K, [K[0], by], {color: c.ink, width: 1.6});
      api.rect(K[0] - side / 2, by, side, side, {fill: c.c3, fillOpacity: 0.85, stroke: c.c3, rx: 3});
      api.label([K[0], by + side + 13], "W " + f(k.W, 0) + " N", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.circle(K, 4, {fill: c.ink});
      // the force triangle: W down, then T2, then T1 back to the start
      var x0 = 262, sc = Math.min(112 / k.H, 196 / k.W), S0 = [x0 + 8, 58];
      var S1 = [S0[0], S0[1] + k.W * sc], S2 = [S1[0] + k.T2 * sc * Math.cos(k.b), S1[1] - k.T2 * sc * Math.sin(k.b)];
      api.line([x0 - 8, 16], [x0 - 8, 290], {color: c.grid, width: 1});
      api.label([x0, 16], "tip to tail:", {color: c.muted, size: 12});
      api.label([x0, 32], "W + T₁ + T₂ = 0", {color: c.ink, size: 12.5, weight: 650});
      api.polygon([S0, S1, S2], {fill: c.ink, fillOpacity: 0.05, stroke: "none"});
      api.arrow(S0, S1, {color: c.c3, width: 2.6, halo: false});
      api.arrow(S1, S2, {color: c.c2, width: 2.6, halo: false});
      api.arrow(S2, S0, {color: c.c1, width: 2.6, halo: false});
      api.label([S0[0] - 6, (S0[1] + S1[1]) / 2], "W", {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      api.label([(S1[0] + S2[0]) / 2 + 8, (S1[1] + S2[1]) / 2 + 10], "T₂", {color: c.c2, size: 12.5, weight: 650});
      api.label([(S0[0] + S2[0]) / 2 + 8, (S0[1] + S2[1]) / 2 - 10], "T₁", {color: c.c1, size: 12.5, weight: 650});
      // the shared horizontal part
      api.line([S1[0], S2[1]], [S2[0], S2[1]], {color: c.faint, width: 1, dash: "3 3"});
      api.label([x0, 284], "horizontal parts " + f(k.H, 0) + " N", {color: c.muted, size: 12});
    }
  });
})();
