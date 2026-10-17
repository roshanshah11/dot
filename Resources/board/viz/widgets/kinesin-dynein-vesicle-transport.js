// Motor proteins carry vesicles along microtubules. Every microtubule has a polarity: the end with beta-tubulin
// exposed is the plus end. In an axon all of them point plus-end out, so kinesin (plus-end directed) carries cargo
// out to the axon tip (anterograde) and cytoplasmic dynein (minus-end directed) carries it back to the cell body
// (retrograde). Kinesin-1 walks hand over hand: one ATP per step, the cargo moves 8 nm (one alpha-beta dimer) and the
// trailing head swings 16 nm to the front. Dynein's steps vary in size; 8 nm is the most common, so its distance is
// shown as approximate. Top: the neuron. Bottom: the zoomed lattice, to scale at 22 px per 8 nm.
(function () {
  var X0 = 35, DIM = 22, ROWS = [250, 262, 274], START = {kinesin: 1, dynein: 12};
  function beta(i) { return X0 + DIM * i + 16.5; }   // the beta bead of dimer i (minus end on the left)
  Viz.register("kinesin-dynein-vesicle-transport", {
    title: "Kinesin and dynein: vesicle transport",
    subject: "biology",
    shows: "Switch the motor and spend ATP: kinesin walks to the microtubule's plus end, out to the axon tip; dynein walks to the minus end, back to the cell body; about 8 nm per ATP",
    params: {
      motor: {kind: "enum", values: ["kinesin", "dynein"], default: "kinesin", label: "\\text{motor}"},
      n: {kind: "integer", default: 4, min: 0, max: 11, label: "n_{\\text{ATP}}"}
    },
    formula: function (v) {
      var k = v.motor === "kinesin";
      return "d = n_{\\text{ATP}}\\times 8\\ \\text{nm} " + (k ? "=" : "\\approx") + " " + v.n + "\\times 8 = " + (8 * v.n) + "\\ \\text{nm}";
    },
    status: function (v) {
      var k = v.motor === "kinesin", end = k ? "plus end, out toward the axon tip (anterograde)" : "minus end, back toward the cell body (retrograde)";
      if (v.n === 0) return (k ? "Kinesin" : "Dynein") + " is bound but has hydrolyzed no ATP yet, so the vesicle has not moved; each ATP buys one step toward the " + (k ? "plus" : "minus") + " end.";
      if (k) return "Kinesin has spent <b>" + v.n + " ATP</b> on " + v.n + " hand-over-hand step" + (v.n === 1 ? "" : "s") + ": the vesicle is <b>" + 8 * v.n + " nm</b> closer to the " + end + ".";
      return "Dynein has spent <b>" + v.n + " ATP</b>: the vesicle is about <b>" + 8 * v.n + " nm</b> closer to the " + end + "; its steps vary, but 8 nm is typical.";
    },
    examples: [
      {name: "kinesin before any ATP", values: {motor: "kinesin", n: 0}},
      {name: "kinesin after 11 steps", values: {motor: "kinesin", n: 11}},
      {name: "dynein before any ATP", values: {motor: "dynein", n: 0}},
      {name: "dynein after 11 steps", values: {motor: "dynein", n: 11}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = v.motor === "kinesin", mc = k ? c.c1 : c.c6, dir = k ? 1 : -1;
      // ---- the neuron: cell body on the left, axon running right, plus ends at the tip
      api.circle([50, 62], 36, {fill: c.ink, fillOpacity: 0.04, stroke: c.ink, width: 1.6});
      api.circle([45, 64], 14, {fill: c.muted, fillOpacity: 0.12, stroke: c.muted, width: 1.2});
      api.line([84, 54], [346, 54], {color: c.ink, width: 1.6});
      api.line([84, 70], [346, 70], {color: c.ink, width: 1.6});
      api.path("M 346 54 Q 356 40 372 46 Q 388 62 372 78 Q 356 84 346 70", {stroke: c.ink, width: 1.6});
      api.line([92, 62], [344, 62], {color: c.c2, width: 3});
      api.label([104, 40], "− end", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([336, 40], "+ end", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([50, 110], "cell body", {color: c.muted, size: 12, anchor: "middle"});
      api.label([366, 98], "axon tip", {color: c.muted, size: 12, anchor: "middle"});
      // which way this motor carries cargo
      api.arrow(k ? [140, 28] : [290, 28], k ? [290, 28] : [140, 28], {color: mc, width: 2.5, halo: false});
      api.label([215, 12], k ? "anterograde: out to the tip" : "retrograde: back to the cell body", {color: mc, size: 12.5, weight: 650, anchor: "middle"});
      // the zoomed stretch
      api.rect(200, 48, 34, 28, {stroke: c.muted, width: 1.2, dash: "3 3", rx: 3});
      api.circle([217, 62], 4.5, {fill: c.c3, stroke: c.c3, width: 1});
      api.line([200, 76], [120, 124], {color: c.faint, width: 1, dash: "3 4"});
      api.line([234, 76], [300, 124], {color: c.faint, width: 1, dash: "3 4"});
      api.rect(14, 124, 372, 172, {stroke: c.faint, width: 1, rx: 8});
      // ---- the lattice: alpha (grey) then beta (blue) in every dimer, beta exposed at the plus end
      ROWS.forEach(function (y) {
        for (var i = 0; i < 15; i++) {
          api.circle([X0 + DIM * i + 5.5, y], 5.3, {fill: c.muted, fillOpacity: 0.35});
          api.circle([beta(i), y], 5.3, {fill: c.c2, fillOpacity: 0.55});
        }
      });
      api.label([24, 262], "−", {color: c.c2, size: 18, weight: 700, anchor: "middle"});
      api.label([376, 262], "+", {color: c.c2, size: 18, weight: 700, anchor: "middle"});
      api.path("M " + X0 + " 284 L " + X0 + " 288 L " + (X0 + DIM) + " 288 L " + (X0 + DIM) + " 284", {stroke: c.muted, width: 1.2});
      api.label([X0 + DIM + 6, 288], "αβ-tubulin dimer = 8 nm", {color: c.muted, size: 12});
      // ---- the motor: two heads on neighbouring beta subunits, a stalk up to the vesicle
      var lead = START[v.motor] + dir * (v.n + 1), trail = lead - dir;   // dimer under each head
      var cx = (beta(lead) + beta(trail)) / 2, cx0 = (beta(START[v.motor] + dir) + beta(START[v.motor])) / 2;
      var top = ROWS[0] - 5.3, hub = [cx, k ? 214 : 205], ves = [cx, 176];
      if (v.n > 0) {
        // after one or two steps the ghost and the vesicle overlap: fade the ghost and put "start" on its far side
        var near = Math.abs(cx - cx0) < 50;
        api.circle([cx0, ves[1]], 24, {stroke: c.c3, width: 1.4, dash: "4 4", opacity: v.n <= 2 ? 0.45 : 1});
        if (near) api.label([cx0 - dir * 29, ves[1]], "start", {color: c.muted, size: 12, anchor: k ? "end" : "start"});
        else api.label([cx0, ves[1]], "start", {color: c.muted, size: 12, anchor: "middle"});
        api.arrow([cx0, 146], [cx, 146], {color: c.c3, width: 2, halo: false});
        api.label([(cx0 + cx) / 2, 134], (k ? "" : "≈ ") + 8 * v.n + " nm", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      }
      if (k) {
        // hand over hand: whichever head is in front just came from two dimers back
        [trail, lead].forEach(function (d, j) {
          var h = [beta(d), top - 7];
          api.line(h, hub, {color: mc, width: 2.2});
          api.circle(h, 7, {fill: mc, fillOpacity: j === 1 ? 0.95 : 0.6, stroke: mc, width: 1.2});
        });
        if (v.n > 0) {
          var a = beta(lead - 2), b = beta(lead);
          api.path("M " + a + " " + (top - 16) + " Q " + (a + b) / 2 + " " + (top - 40) + " " + (b - 4) + " " + (top - 17), {stroke: mc, width: 1.4, dash: "3 3", arrow: true});
        }
        api.label([cx + dir * 30, 230], "kinesin", {color: mc, size: 12.5, weight: 650, anchor: k ? "start" : "end"});
      } else {
        // dynein: two ring-shaped motor domains, each on a thin stalk that grips the lattice
        [trail, lead].forEach(function (d) {
          var foot = [beta(d), top], ring = [beta(d) + 4, top - 24];
          api.line(foot, [ring[0], ring[1] + 9], {color: mc, width: 1.6});
          api.circle(ring, 9, {fill: mc, fillOpacity: 0.25, stroke: mc, width: 2.2});
          api.circle(ring, 3.5, {fill: mc, fillOpacity: 0.7});
          api.line([ring[0], ring[1] - 9], hub, {color: mc, width: 2.2});
        });
        api.label([cx + 34, 226], "dynein", {color: mc, size: 12.5, weight: 650});
      }
      api.line(hub, [ves[0], ves[1] + 24], {color: mc, width: 2.6});
      api.circle(ves, 24, {fill: c.c3, fillOpacity: 0.3, stroke: c.c3, width: 2});
      api.label(ves, "vesicle", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      // viz.css paints svg text ink; restate each label's own colour
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });
    }
  });
})();
