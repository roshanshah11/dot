// A two-draw probability tree. A bag holds some red and some blue balls; draw one, then another, with or without
// putting the first back. First branches carry red/N and blue/N; the second branches carry what is in the bag at that
// moment, so without replacement they change with the first draw (and with only one red, red-then-red is impossible:
// dashed). Each leaf is the product along its path, the four leaves add to 1, and an event is the sum of its leaves:
// the chosen event's leaves are amber. Branch thickness follows the branch probability.
// The queue's first_outcome_count and second_outcome_count are read as the counts of the two kinds of ball.
// Dot's addition: the event, so the tree shows both rules, multiply along a path and add across paths.
(function () {
  var EV = {"both red": ["RR"], "one of each": ["RB", "BR"], "both blue": ["BB"], "at least one red": ["RR", "RB", "BR"]};
  function calc(v) {
    var r = v.first_outcome_count, b = v.second_outcome_count, N = r + b, rep = v.with_replacement, M = rep ? N : N - 1;
    var after = {R: rep ? [r, b] : [r - 1, b], B: rep ? [r, b] : [r, b - 1]};
    var leaves = {
      RR: {n1: r, n2: after.R[0]}, RB: {n1: r, n2: after.R[1]}, BR: {n1: b, n2: after.B[0]}, BB: {n1: b, n2: after.B[1]}
    };
    Object.keys(leaves).forEach(function (key) { var q = leaves[key]; q.num = q.n1 * q.n2; q.p = q.num / (N * M); });
    var on = EV[v.event], num = on.reduce(function (s, key) { return s + leaves[key].num; }, 0);
    return {r: r, b: b, N: N, M: M, after: after, leaves: leaves, on: on, num: num, den: N * M, p: num / (N * M)};
  }
  var fr = function (a, b) { return "\\tfrac{" + a + "}{" + b + "}"; };

  Viz.register("probability-tree", {
    title: "Probability tree: two draws",
    subject: "stats",
    shows: "Set the bag and whether the first ball goes back: multiply along each path for a leaf, then add the leaves that make up an event",
    params: {
      first_outcome_count: {kind: "integer", default: 3, min: 1, max: 12, label: "\\text{red}"},
      second_outcome_count: {kind: "integer", default: 8, min: 1, max: 12, label: "\\text{blue}"},
      with_replacement: {kind: "boolean", default: false, label: "\\text{put back}", on: "with replacement", off: "without replacement"},
      event: {kind: "enum", values: ["both red", "one of each", "both blue", "at least one red"], default: "one of each", label: "\\text{event}"}
    },
    formula: function (v) {
      var k = calc(v), L = k.leaves;
      var term = function (key) { return fr(L[key].n1, k.N) + "\\cdot" + fr(L[key].n2, k.M); };
      var tail = "\\qquad=" + fr(k.num, k.den) + "=" + Viz.n(k.p, 3) + "\\end{array}";
      if (v.event === "at least one red")   // the complement, one step per line so the long first line never clips
        return "\\begin{array}{l}P(\\text{at least one red})=1-P(\\text{no red})\\\\[8pt]\\qquad=1-" + term("BB") + "=1-" + fr(L.BB.num, k.den) + "\\\\[8pt]" + tail;
      return "\\begin{array}{l}P(\\text{" + v.event + "})=" + k.on.map(term).join("+") + "\\\\[8pt]" + tail;
    },
    status: function (v) {
      var k = calc(v), sec = function (key) { return k.leaves[key].n2 + "/" + k.M; };
      var tail = "; P(" + v.event + ") = <b>" + Viz.fmt(k.p, 3) + "</b>.";
      if (v.with_replacement) return "With the ball put back, the second draw sees the same bag, so red is " + k.r + "/" + k.N + " both times and the draws are independent" + tail;
      return "Without replacement the second draw depends on the first: red is " + sec("RR") + " after a red but " + sec("BR") + " after a blue" + tail;
    },
    examples: [
      {name: "Minimum supported values", values: {first_outcome_count: 1, second_outcome_count: 1, with_replacement: false}},
      {name: "Maximum supported values", values: {first_outcome_count: 12, second_outcome_count: 12, with_replacement: true}},
      {name: "one red ball: red twice is impossible", values: {first_outcome_count: 1, second_outcome_count: 5, event: "both red"}},
      {name: "at least one red, by the complement", values: {first_outcome_count: 4, second_outcome_count: 6, event: "at least one red"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), L = k.leaves;
      // the bag
      var dp = 10, dx = 20;
      for (var i = 0; i < k.N; i++) api.circle([dx + i * dp + 4, 14], 4, {fill: i < k.r ? c.c5 : c.c2, fillOpacity: 0.95});
      api.label([dx + k.N * dp + 6, 14], k.r + " red, " + k.b + " blue", {color: c.muted, size: 12});
      // the tree
      var R0 = [22, 162], N1 = {R: [118, 98], B: [118, 226]};
      var LF = {RR: [226, 54], RB: [226, 122], BR: [226, 202], BB: [226, 270]};
      function br(p, q, n, d, col, below) {
        var pr = n / d, dead = n === 0;
        api.line(p, q, {color: col, width: dead ? 1.4 : 1.5 + 5 * pr, dash: dead ? "4 4" : null, opacity: dead ? 0.7 : 0.9});
        var m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        api.label([m[0] - 4, m[1] + (below ? 12 : -12)], n + "/" + d, {color: col, size: 12.5, weight: 650, anchor: "end"});
      }
      br(R0, N1.R, k.r, k.N, c.c5, false);
      br(R0, N1.B, k.b, k.N, c.c2, true);
      br(N1.R, LF.RR, L.RR.n2, k.M, c.c5, false); br(N1.R, LF.RB, L.RB.n2, k.M, c.c2, true);
      br(N1.B, LF.BR, L.BR.n2, k.M, c.c5, false); br(N1.B, LF.BB, L.BB.n2, k.M, c.c2, true);
      api.point(R0, {color: c.ink, r: 4.5});
      ["R", "B"].forEach(function (key) {
        var p = N1[key], left = k.after[key];
        api.point(p, {color: key === "R" ? c.c5 : c.c2, r: 6});
        // what the bag holds for the second draw, on two lines that end 10 px clear of the node: above the top node and
        // below the bottom one, clear of every branch even with two-digit counts
        var up = key === "R", y1 = p[1] + (up ? -32 : 18);
        api.label([p[0] - 16, y1], v.with_replacement ? "put back:" : "left in the bag:", {color: c.muted, size: 12, anchor: "end", clamp: false});
        api.label([p[0] - 16, y1 + 14], left[0] + " red, " + left[1] + " blue", {color: c.muted, size: 12, anchor: "end", clamp: false});
      });
      var names = {RR: "red, red", RB: "red, blue", BR: "blue, red", BB: "blue, blue"};
      Object.keys(LF).forEach(function (key) {
        var p = LF[key], q = L[key], hit = k.on.indexOf(key) >= 0, col = hit ? c.c3 : c.muted;
        if (hit) api.circle(p, 9, {fill: c.c3, fillOpacity: 0.25, stroke: c.c3, width: 1.5});
        api.point(p, {color: key.charAt(1) === "R" ? c.c5 : c.c2, r: 4.5});
        // measured, the longest leaf text ("blue, blue: 12/24 × 11/23") ends near x = 370, so no clamp (its estimate
        // would shove the text left onto the leaf dot)
        api.label([p[0] + 14, p[1] - 8], names[key] + ": " + q.n1 + "/" + k.N + " × " + q.n2 + "/" + k.M, {color: col, size: 12, weight: hit ? 650 : 500, clamp: false});
        api.label([p[0] + 14, p[1] + 9], q.num === 0 ? "= 0 (impossible)" : "= " + q.num + "/" + k.den + " = " + api.fmt(q.p, 4), {color: col, size: 12.5, weight: hit ? 750 : 500, clamp: false});
      });
      api.label([20, 34], "the four leaves always add to 1", {color: c.muted, size: 12});
      api.label([20, 290], "add the amber leaves: " + api.fmt(k.p, 3), {color: c.c3, size: 12.5, weight: 700});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
