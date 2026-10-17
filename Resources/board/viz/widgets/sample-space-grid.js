// The sample space of two fair dice as a 6 x 6 grid: die 1 across, die 2 down, each cell one ordered outcome with its
// sum written in it. All 36 are equally likely, so P(A) = |A| / 36, the share of shaded cells. The rows on the right
// regroup the same 36 cells by their sum (one square per cell, ordered by die 1), with the event's cells in amber, so
// the shape of the sum's distribution and the event's place in it read at a glance.
(function () {
  var EVENTS = {
    "sum equals 5": function (a, b) { return a + b === 5; },
    "sum equals 7": function (a, b) { return a + b === 7; },
    "sum at least 10": function (a, b) { return a + b >= 10; },
    "matching values": function (a, b) { return a === b; }
  };
  function count(ev) { var k = 0; for (var a = 1; a <= 6; a++) for (var b = 1; b <= 6; b++) if (EVENTS[ev](a, b)) k++; return k; }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function frac(k) { var g = gcd(k, 36); return k + "/" + 36 + (g > 1 ? " = " + k / g + "/" + 36 / g : ""); }

  Viz.register("sample-space-grid", {
    title: "Sample space of two dice",
    subject: "stats",
    shows: "Pick an event: its outcomes light up among the 36 equally likely (die 1, die 2) pairs, and P(A) is the shaded share",
    params: {
      event: {kind: "enum", values: Object.keys(EVENTS), default: "sum equals 7", label: "A"}
    },
    formula: function (v) {
      var k = count(v.event), g = gcd(k, 36);
      return "P(A)=\\frac{|A|}{|S|}=\\frac{" + k + "}{36}" + (g > 1 ? "=\\frac{" + k / g + "}{" + 36 / g + "}" : "") + "\\approx " + Viz.n(k / 36, 3);
    },
    status: function (v) {
      var k = count(v.event), p = frac(k) + " ≈ " + Viz.fmt(k / 36, 3);
      if (v.event === "sum equals 5") return "<b>" + k + "</b> of the 36 equally likely pairs add to 5, namely (1,4), (2,3), (3,2) and (4,1), so P = <b>" + p + "</b>.";
      if (v.event === "sum equals 7") return "<b>" + k + "</b> of the 36 pairs add to 7, one in every row, more than any other sum, so P = <b>" + p + "</b>.";
      if (v.event === "sum at least 10") return "<b>" + k + "</b> pairs reach 10 or more (3 make 10, 2 make 11, 1 makes 12), so P = <b>" + p + "</b>.";
      return "<b>" + k + "</b> of the 36 pairs are doubles, the diagonal, so P = <b>" + p + "</b>: matching is exactly as likely as a sum of 7.";
    },
    examples: [
      {name: "sum equals 5", values: {event: "sum equals 5"}},
      {name: "sum equals 7", values: {event: "sum equals 7"}},
      {name: "sum at least 10", values: {event: "sum at least 10"}},
      {name: "matching values", values: {event: "matching values"}}
    ],
    size: [400, 272],
    draw: function (api, v) {
      var c = api.color, inA = EVENTS[v.event], cs = 32, gx = 46, gy = 46, k = count(v.event);
      api.label([gx + 3 * cs, 14], "die 1 →", {color: c.muted, size: 12.5, anchor: "middle"});
      api.label([4, 14], "die 2 ↓", {color: c.muted, size: 12.5});
      for (var a = 1; a <= 6; a++) {
        api.label([gx + (a - 0.5) * cs, gy - 12], String(a), {color: c.muted, size: 12.5, anchor: "middle"});
        api.label([gx - 10, gy + (a - 0.5) * cs], String(a), {color: c.muted, size: 12.5, anchor: "end"});
      }
      for (var b = 1; b <= 6; b++) for (a = 1; a <= 6; a++) {
        var x = gx + (a - 1) * cs, y = gy + (b - 1) * cs, hit = inA(a, b);
        api.rect(x + 1.5, y + 1.5, cs - 3, cs - 3, {fill: hit ? c.c3 : c.muted, fillOpacity: hit ? 0.9 : 0.1, rx: 4});
        api.label([x + cs / 2, y + cs / 2 + 0.5], String(a + b), {color: hit ? c.card : c.muted, size: 12.5, weight: hit ? 700 : 500, anchor: "middle"});
      }
      api.label([gx + 3 * cs, gy + 6 * cs + 18], k + " of 36 cells in A", {color: c.c3, size: 13, weight: 650, anchor: "middle"});
      // the same 36 cells regrouped by sum
      var rx = 272, ry = gy, rh = cs * 6 / 11, sq = 13;
      api.label([rx - 6, 14], "sum", {color: c.muted, size: 12.5, anchor: "end"});
      api.label([rx + 4, 14], "ways to make it", {color: c.muted, size: 12.5});
      for (var s = 2; s <= 12; s++) {
        var yy = ry + (s - 2 + 0.5) * rh, any = false, j = 0;
        for (a = Math.max(1, s - 6); a <= Math.min(6, s - 1); a++, j++) {
          var h = inA(a, s - a); any = any || h;
          api.rect(rx + 4 + j * (sq + 3), yy - sq / 2, sq, sq, {fill: h ? c.c3 : c.muted, fillOpacity: h ? 0.9 : 0.22, rx: 2});
        }
        api.label([rx - 6, yy], String(s), {color: any ? c.c3 : c.muted, size: 12, weight: any ? 700 : 500, anchor: "end"});
      }
      api.label([rx + 4, gy + 6 * cs + 18], "P(A) = " + frac(k).split(" = ").pop(), {color: c.c3, size: 13, weight: 650});
    }
  });
})();
