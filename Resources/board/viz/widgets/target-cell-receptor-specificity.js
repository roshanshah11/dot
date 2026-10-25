// Target-cell specificity: a signal reaches many cells, but only cells with a matching receptor respond, and the
// receptor subtype, not the signal, decides what the response is. Epinephrine (from the adrenal medulla, in the blood):
// beta-1 on heart muscle (faster, stronger beats), beta-2 on airway smooth muscle (relaxes, airway opens), alpha-1 on
// gut arteriole smooth muscle (contracts, vessel narrows). Acetylcholine (released by nerve endings): nicotinic receptors
// on skeletal muscle (contracts), M2 on the heart's pacemaker (rate slows), M3 on salivary glands (secretion).
// Blockers show the subtype is what matters: propranolol blocks beta-1 and beta-2 but not alpha-1; atropine blocks
// muscarinic (M2, M3) but not nicotinic receptors. Fraction of receptors bound: theta = [L]/([L] + K_d), with [L] given in
// units of K_d (every receptor drawn with the same K_d, for comparison); a blocked receptor binds no agonist.
(function () {
  var SIG = {
    epinephrine: {name: "Epinephrine", blocker: "propranolol", via: "in the blood", cells: [
      {n: ["heart", "muscle"], r: "β₁", resp: ["beats faster,", "stronger"], blk: true},
      {n: ["airway", "muscle"], r: "β₂", resp: ["relaxes:", "airway opens"], blk: true},
      {n: ["gut", "arteriole"], r: "α₁", resp: ["contracts:", "narrows"], blk: false},
      {n: ["no matching", "receptor"], r: null}]},
    acetylcholine: {name: "Acetylcholine", blocker: "atropine", via: "from nerve endings", cells: [
      {n: ["skeletal", "muscle"], r: "nicotinic", resp: ["contracts"], blk: false},
      {n: ["heart", "pacemaker"], r: "M₂", resp: ["rate", "slows"], blk: true},
      {n: ["salivary", "gland"], r: "M₃", resp: ["secretes", "saliva"], blk: true},
      {n: ["no matching", "receptor"], r: null}]}
  };
  function theta(v) { return v.L / (v.L + 1); }
  function responds(v, cell) { return !!cell.r && v.L > 0 && !(v.blocker && cell.blk); }
  function nResp(v) { return SIG[v.signal].cells.filter(function (cl) { return responds(v, cl); }).length; }

  Viz.register("target-cell-receptor-specificity", {
    title: "Target cells: only matching receptors respond",
    subject: "biology",
    shows: "Send epinephrine or acetylcholine past four cells and raise its concentration: only cells with a matching receptor respond, each subtype makes its own response, and a blocker silences one subtype while another still answers",
    params: {
      signal: {kind: "enum", values: ["epinephrine", "acetylcholine"], default: "epinephrine", label: "\\text{signal}"},
      L: {kind: "number", default: 2, min: 0, max: 10, step: 0.5, label: "[L]/K_d"},
      blocker: {kind: "boolean", default: false, label: "\\text{blocker}", on: "added", off: "none"}
    },
    formula: function (v) {
      var t = theta(v);
      return "\\theta=\\frac{[L]}{[L]+K_d}=\\frac{" + Viz.n(v.L) + "}{" + Viz.n(v.L) + "+1}=" + Viz.n(Math.round(t * 100) / 100) +
        "\\newline \\text{cells responding: }" + nResp(v) + "\\ \\text{of}\\ 4";
    },
    status: function (v) {
      var S = SIG[v.signal], pct = Math.round(theta(v) * 100) + "%";
      if (v.L === 0) return "No " + v.signal + ": every receptor is empty, so <b>no cell</b> responds, matching receptor or not.";
      if (v.blocker && v.signal === "epinephrine") return "Propranolol blocks β receptors, so the heart and airway go quiet, but the gut arteriole's <b>α₁</b> receptors still answer: the receptor subtype, not the signal, decides.";
      if (v.blocker) return "Atropine blocks muscarinic receptors, so the heart and salivary gland go quiet, but skeletal muscle's <b>nicotinic</b> receptors still answer: the receptor subtype, not the signal, decides.";
      return S.name + " reaches all four cells, but only the <b>three with matching receptors</b> respond, each in its own way, with " + pct + " of their receptors bound.";
    },
    examples: [
      {name: "no signal", values: {signal: "epinephrine", L: 0, blocker: false}},
      {name: "epinephrine with propranolol", values: {signal: "epinephrine", L: 2, blocker: true}},
      {name: "acetylcholine", values: {signal: "acetylcholine", L: 2, blocker: false}},
      {name: "acetylcholine with atropine", values: {signal: "acetylcholine", L: 2, blocker: true}},
      {name: "every value at its maximum", values: {signal: "acetylcholine", L: 10, blocker: true}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, S = SIG[v.signal], t = theta(v), W = 90, top = 74, bot = 186;
      var T = function (at, tx, col, o) { api.label(at, tx, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var mol = function (p, col) { api.polygon([[p[0], p[1] - 5], [p[0] + 5, p[1]], [p[0], p[1] + 5], [p[0] - 5, p[1]]], {fill: col, fillOpacity: 0.95}); };
      // the signal arriving: molecules drawn in proportion to [L]
      api.rect(8, 22, 384, 24, {fill: c.c3, fillOpacity: 0.07, rx: 6});
      T([12, 10], S.name + " " + S.via + ": [L] = " + api.fmt(v.L) + " × Kd", c.c3, {weight: 500});
      var k = Math.round(v.L * 4);
      for (var i = 0; i < k; i++) mol([20 + ((i * 97) % 368), 28 + ((i * 7) % 3) * 6], c.c3);
      S.cells.forEach(function (cl, j) {
        var x0 = 8 + j * (W + 8), cx = x0 + W / 2, on = responds(v, cl), blocked = !!cl.r && v.blocker && cl.blk;
        api.rect(x0, top, W, bot - top, {fill: on ? c.c4 : c.ink, fillOpacity: on ? 0.14 : 0.04, stroke: on ? c.c4 : c.faint, width: 1.4, rx: 10});
        // three receptors in the top membrane; bound ones hold a signal molecule, blocked ones hold the drug
        var nb = Math.round(3 * t);
        if (cl.r) {
          [-24, 0, 24].forEach(function (dx, r) {
            var rx = cx + dx;
            api.path("M " + (rx - 8) + " " + (top + 10) + " L " + (rx - 8) + " " + (top - 4) + " L " + (rx - 4) + " " + (top - 4) + " L " + rx + " " + (top + 2) + " L " + (rx + 4) + " " + (top - 4) + " L " + (rx + 8) + " " + (top - 4) + " L " + (rx + 8) + " " + (top + 10),
              {stroke: blocked ? c.c5 : c.c2, width: 2});
            if (blocked) api.rect(rx - 5, top - 10, 10, 9, {fill: c.c5, fillOpacity: 0.9, rx: 2});
            else if (r < nb) mol([rx, top - 6], c.c3);
          });
          T([cx, top - 20], cl.r, blocked ? c.c5 : c.c2, {anchor: "middle"});
        } else {
          [-24, 0, 24].forEach(function (dx) { mol([cx + dx, top - 12 - (dx === 0 ? 4 : 0)], c.c3); });
        }
        // response inside the cell
        var lines = on ? cl.resp : blocked ? ["blocked"] : ["no", "response"], col = on ? c.c4 : blocked ? c.c5 : c.muted;
        lines.forEach(function (ln, q) { T([cx, top + 34 + q * 15 - (lines.length - 1) * 7], ln, col, {anchor: "middle", weight: on ? 650 : 500}); });
        cl.n.forEach(function (ln, q) { T([cx, bot - 28 + q * 14], ln, c.ink, {anchor: "middle", weight: 500}); });
        // fraction of this cell's receptors carrying the signal
        var frac = cl.r && !blocked ? t : 0, by = 206;
        api.rect(x0 + 6, by, W - 12, 10, {fill: c.ink, fillOpacity: 0.06, rx: 3});
        if (frac > 0) api.rect(x0 + 6, by, (W - 12) * frac, 10, {fill: c.c2, fillOpacity: 0.85, rx: 3});
        T([cx, by + 24], cl.r ? Math.round(frac * 100) + "% bound" : "nothing to bind", cl.r && !blocked ? c.c2 : c.muted, {anchor: "middle", weight: 500});
      });
      T([200, 264], "same signal, different receptor subtypes, different responses", c.muted, {anchor: "middle", weight: 500});
      if (v.blocker) T([200, 284], "red: receptors occupied by " + S.blocker, c.c5, {anchor: "middle", weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
