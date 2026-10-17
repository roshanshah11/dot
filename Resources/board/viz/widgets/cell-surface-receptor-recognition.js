// How a surface receptor recognizes its ligand: by shape and chemistry, with an affinity Kd. Ten receptors sit in the
// membrane; the fraction occupied at equilibrium is theta = [L] / ([L] + Kd) (simple one-site binding, ligand in
// excess), so half are bound when [L] = Kd. An agonist fits and switches the receptor on; an antagonist fits the same
// site but triggers no shape change, so it occupies without signaling; a molecule of the wrong shape does not bind.
// Bound count = round(10 theta). Signaling is drawn as proportional to agonist occupancy (simple occupancy model).
(function () {
  var N = 10, ORDER = [3, 7, 1, 9, 5, 0, 8, 2, 6, 4];
  function theta(v) { return v.ligand === "wrong shape" || v.L === 0 ? 0 : v.L / (v.L + v.Kd); }
  function halton(i, b) { var f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }
  Viz.register("cell-surface-receptor-recognition", {
    title: "Receptor recognition: fit and affinity",
    subject: "biology",
    shows: "Set the ligand's concentration, the receptor's Kd and the ligand's shape: half the receptors fill at [L] = Kd, agonists switch them on, antagonists only block, wrong shapes never bind",
    params: {
      L: {kind: "number", default: 10, min: 0, max: 100, step: 1, label: "[L]\\ \\text{nM}"},
      Kd: {kind: "number", default: 10, min: 1, max: 50, step: 1, label: "K_d\\ \\text{nM}"},
      ligand: {kind: "enum", values: ["agonist", "antagonist", "wrong shape"], default: "agonist", label: "\\text{ligand}"}
    },
    formula: function (v) {
      if (v.ligand === "wrong shape") return "\\text{no fit}\\ \\Rightarrow\\ \\theta=0";
      var t = theta(v), f = "\\theta=\\frac{[L]}{[L]+K_d}=\\frac{" + Viz.n(v.L) + "}{" + Viz.n(v.L) + "+" + Viz.n(v.Kd) + "}=" + Viz.n(t, 2);
      return v.ligand === "antagonist" ? f + "\\newline\\text{signal}=0" : f;
    },
    status: function (v) {
      var t = theta(v), nb = Math.round(N * t);
      if (v.ligand === "wrong shape") return "<b>Wrong shape</b>: it cannot fit the binding site, so <b>no receptors</b> bind it at any concentration: recognition is by shape and chemistry.";
      if (v.L === 0) return "No ligand, so every receptor is empty and nothing happens.";
      if (v.ligand === "antagonist") return "The antagonist fits the site, so about <b>" + nb + " of 10</b> receptors are occupied, but it causes no shape change: <b>no signal</b>, and those sites are blocked for the real ligand.";
      var rel = Math.abs(v.L - v.Kd) < 1e-9 ? "[L] = Kd, so exactly half are filled" : v.L > v.Kd ? "[L] is above Kd, so more than half are filled" : "[L] is below Kd, so fewer than half are filled";
      return "θ = <b>" + Viz.fmt(t, 2) + "</b>: about <b>" + nb + " of 10</b> receptors hold the agonist and signal; " + rel + ".";
    },
    examples: [
      {name: "[L] = Kd: half bound", values: {L: 10, Kd: 10, ligand: "agonist"}},
      {name: "high affinity, saturated", values: {L: 100, Kd: 1, ligand: "agonist"}},
      {name: "low affinity", values: {L: 10, Kd: 50, ligand: "agonist"}},
      {name: "antagonist blocks", values: {L: 40, Kd: 10, ligand: "antagonist"}},
      {name: "wrong shape", values: {L: 100, ligand: "wrong shape"}},
      {name: "no ligand", values: {L: 0}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, t = theta(v), nb = Math.round(N * t), my = 172, lig = v.ligand;
      var col = lig === "agonist" ? c.c3 : lig === "antagonist" ? c.c6 : c.c5;
      var shape = function (x, y, kind, color, op) {   // y = tip of the wedge (agonist, antagonist) or centre (wrong shape)
        if (kind === "wrong shape") { api.rect(x - 6, y - 12, 12, 12, {fill: color, rx: 1, opacity: op}); return; }
        api.polygon([[x - 5, y - 9], [x, y], [x + 5, y - 9]], {fill: color, fillOpacity: 1, opacity: op});
        if (kind === "agonist") api.rect(x - 5, y - 19, 10, 10, {fill: color, rx: 2, opacity: op});
        else api.circle([x, y - 14], 6, {fill: color, opacity: op});
      };
      api.label([12, 14], "outside", {color: c.muted, size: 12});
      api.label([12, 232], "inside", {color: c.muted, size: 12});
      [my, my + 9].forEach(function (y) { api.line([8, y], [232, y], {color: c.ink, width: 1.3, opacity: 0.7}); });
      var bound = {}; ORDER.slice(0, nb).forEach(function (i) { bound[i] = true; });
      for (var i = 0; i < N; i++) {
        var x = 24 + i * 21.3, on = bound[i] && lig === "agonist";
        // receptor: a stalk through the membrane and a cup with a V-shaped binding site
        api.path("M " + (x - 4) + " " + (my + 30) + " L " + (x - 4) + " " + (my - 22) + " L " + (x - 9) + " " + (my - 22) + " L " + (x - 9) + " " + (my - 40) +
          " L " + (x - 5) + " " + (my - 40) + " L " + x + " " + (my - 31) + " L " + (x + 5) + " " + (my - 40) + " L " + (x + 9) + " " + (my - 40) + " L " + (x + 9) + " " + (my - 22) +
          " L " + (x + 4) + " " + (my - 22) + " L " + (x + 4) + " " + (my + 30) + " Z", {fill: c.c1, fillOpacity: 0.35, stroke: c.c1, width: 1.3});
        // inside: the tail changes shape and signals only when an agonist sits in the site
        if (on) { api.line([x, my + 30], [x + 6, my + 44], {color: c.c4, width: 4}); api.circle([x + 7, my + 47], 4, {fill: c.c4}); }
        else api.line([x, my + 30], [x, my + 44], {color: c.muted, width: 4, opacity: 0.6});
        if (bound[i]) shape(x, my - 31, lig, col, 1);
      }
      api.label([64, 232], lig === "agonist" && nb ? "green tail = switched on" : lig === "antagonist" && nb ? "occupied, none switched on" : "nothing bound", {color: lig === "agonist" && nb ? c.c4 : c.muted, size: 12});
      // free ligand molecules, more of them at higher concentration
      var free = Math.round(v.L / 4);
      for (var k = 1; k <= free; k++) shape(16 + halton(k, 2) * 208, 44 + halton(k, 3) * 74, lig, col, 0.85);
      api.label([228, 14], free ? lig + " in solution" : "no ligand", {color: col, size: 12, weight: 650, anchor: "end"});
      // ---- binding curve: fraction bound against concentration ----
      var gx0 = 266, gx1 = 388, gy0 = 156, gy1 = 36, X = function (L) { return gx0 + (gx1 - gx0) * L / 100; }, Y = function (q) { return gy0 - (gy0 - gy1) * q; };
      api.line([gx0, gy0], [gx1 + 4, gy0], {color: c.axis, width: 1.3, arrow: true}); api.line([gx0, gy0], [gx0, gy1 - 8], {color: c.axis, width: 1.3, arrow: true});
      api.label([gx0 - 4, 18], "fraction bound θ", {color: c.muted, size: 12});
      api.label([gx0 - 5, Y(1)], "1", {color: c.muted, size: 12, anchor: "end"}); api.label([gx0 - 5, Y(0.5)], "0.5", {color: c.muted, size: 12, anchor: "end"});
      api.label([gx0, gy0 + 13], "0", {color: c.muted, size: 12, anchor: "middle"}); api.label([gx1, gy0 + 13], "100 nM", {color: c.muted, size: 12, anchor: "end"});
      api.line([gx0, Y(1)], [gx1, Y(1)], {color: c.grid, width: 1});
      var pts = [];
      for (var L = 0; L <= 100.001; L += 1) pts.push([X(L), Y(lig === "wrong shape" ? 0 : L / (L + v.Kd))]);
      if (lig !== "wrong shape") {
        api.line([X(v.Kd), gy0], [X(v.Kd), Y(0.5)], {color: c.muted, width: 1, dash: "3 3"}); api.line([gx0, Y(0.5)], [X(v.Kd), Y(0.5)], {color: c.muted, width: 1, dash: "3 3"});
        api.label([X(v.Kd) + 5, Y(0.5) + 12], "Kd", {color: c.muted, size: 12});
      }
      api.polyline(pts, {stroke: c.c1, width: 2.5});
      api.point([X(v.L), Y(t)], {color: col, r: 5.5});
      // the readout
      api.label([gx0 - 8, 192], "θ = " + api.fmt(t, 2), {color: c.ink, size: 13, weight: 700});
      api.label([gx0 - 8, 210], nb + " of 10 bound", {color: c.c1, size: 12});
      api.label([gx0 - 8, 228], lig === "agonist" ? nb + " signaling" : lig === "antagonist" ? "0 signaling: blocked" : "shape does not fit", {color: lig === "agonist" ? c.c4 : col, size: 12, weight: 650});
      // the three kinds of ligand, current one lit
      [["agonist", "fits, switches on"], ["antagonist", "fits, blocks"], ["wrong shape", "doesn't fit"]].forEach(function (q, j) {
        var x = 18 + j * 128, me = q[0] === lig, cc = j === 0 ? c.c3 : j === 1 ? c.c6 : c.c5;
        shape(x, j === 2 ? 282 : 286, q[0], cc, me ? 1 : 0.4);
        api.label([x + 12, 268], q[0], {color: me ? cc : c.muted, size: 12, weight: me ? 700 : 500});
        api.label([x + 12, 284], q[1], {color: c.muted, size: 12});
      });
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
