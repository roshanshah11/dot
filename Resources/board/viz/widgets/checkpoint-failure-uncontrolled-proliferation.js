// One cell's family tree over five generations, under two kinds of control. G1/S control (Rb holding E2F until growth
// signals arrive, and contact inhibition when the tissue is full) lets a cell divide only while there is room, here
// for K = 8 cells. p53 guards DNA: a daughter whose DNA was damaged while it was copied is stopped and, in this model,
// removed by apoptosis. Break G1/S control (Rb lost, or an oncogenic Ras that signals with no growth factor) and every
// cell divides every generation; lose p53 and damaged cells live, divide and pass their mutations on. A model, not data:
// which daughters get damaged is a fixed pseudo-random draw, so raising the damage rate only ever adds damage.
(function () {
  var K = 8;
  function u(g, a) { var x = Math.sin(g * 12.9898 + a * 78.233 + 1.7) * 43758.5453; return x - Math.floor(x); }
  function grow(v) {
    var gens = [[{a: 0, b: 1, st: "cycling", hits: 0}]], dead = 0, killed = 0;
    for (var g = 0; g < v.gens; g++) {
      var cur = gens[g], live = cur.filter(function (n) { return n.st !== "dead"; }), next = [];
      var room = v.g1s === "broken" ? Infinity : K - live.length;
      // which live cells divide: all of them without G1/S control, otherwise as many as there is room for
      var order = live.slice().sort(function (p, q) { return u(g + 7, p.a) - u(g + 7, q.a); });
      var divides = {}; order.forEach(function (n, i) { if (i < room) divides[n.a] = true; });
      live.forEach(function (n) {
        n.divides = !!divides[n.a];
        if (!n.divides) { next.push({a: n.a, b: n.b, st: n.hits ? "damaged" : "resting", hits: n.hits, parent: n}); return; }
        var m = (n.a + n.b) / 2;
        [[n.a, m], [m, n.b]].forEach(function (s) {
          var hit = u(g + 1, s[0]) < v.damage, hits = n.hits + (hit ? 1 : 0), st = hits ? "damaged" : "cycling";
          if (hits && v.p53) { st = "dead"; dead++; if (hit) killed++; }
          next.push({a: s[0], b: s[1], st: st, hits: hits, parent: n});
        });
      });
      gens.push(next);
    }
    var counts = gens.map(function (row) { return row.filter(function (n) { return n.st !== "dead"; }).length; });
    var last = gens[gens.length - 1].filter(function (n) { return n.st !== "dead"; });
    return {gens: gens, counts: counts, dead: dead, damaged: last.filter(function (n) { return n.hits; }).length, n: last.length};
  }
  Viz.register("checkpoint-failure-uncontrolled-proliferation", {
    title: "Checkpoint failure and uncontrolled growth",
    subject: "biology",
    shows: "Break the G1/S brake or p53 and follow one cell's descendants: intact checkpoints cap the tissue and remove damaged cells, broken ones let damaged cells multiply",
    params: {
      g1s: {kind: "enum", values: ["intact", "broken"], default: "intact", label: "G_1/S", names: {intact: "Rb + signals work", broken: "Rb lost / Ras on"}},
      p53: {kind: "boolean", default: true, label: "p53", on: "working", off: "mutated"},
      damage: {kind: "number", default: 0.15, min: 0, max: 0.4, step: 0.05, label: "\\text{damage}"},
      gens: {kind: "integer", default: 5, min: 1, max: 5, label: "\\text{gens}"}
    },
    formula: function (v) {
      var r = grow(v);
      return "N_g:\\ " + r.counts.join("\\to") + (v.g1s === "intact" ? "\\quad(\\text{room } K=8)" : "\\quad(\\text{no cap})");
    },
    status: function (v) {
      var r = grow(v), D = r.damaged, X = r.dead;
      var cells = function (k) { return k + " cell" + (k === 1 ? "" : "s"); };
      var full = r.n >= K, cap = full ? "the tree stops at <b>" + cells(r.n) + "</b> once the tissue is full" : "the tissue is still filling (<b>" + r.n + "</b> of its 8 places)";
      if (v.g1s === "intact" && v.p53) return "Checkpoints intact: " + cap +
        (X ? ", and p53 sent <b>" + cells(X) + "</b> with damaged DNA to apoptosis (neighbours divide to refill the gap)." : "; no DNA was damaged, so no cell had to die.");
      if (v.g1s === "intact") return (full ? "Room still caps the tissue at <b>" + cells(r.n) + "</b>" : "Room still limits growth (<b>" + r.n + "</b> of 8 places filled)") +
        ", but without p53 <b>" + D + "</b> " + (D === 1 ? "cell keeps" : "cells keep") + " damaged DNA instead of dying" + (D ? ": one more hit to growth control and " + (D === 1 ? "it" : "they") + " would grow unchecked." : " (none damaged yet).");
      if (v.p53 && !X) return "With the G1/S brake broken every cell divides every generation, doubling to <b>" + cells(r.n) + "</b> with no cap; no DNA was damaged, so p53 had nothing to remove.";
      if (v.p53) return "With the G1/S brake broken every surviving cell divides each generation (<b>" + cells(r.n) + "</b>); p53 still removes damaged daughters (" + X + " so far), which slows the growth but cannot stop it.";
      return "Both controls lost: every cell divides and damaged cells divide too, so <b>" + cells(r.n) + "</b> after " + v.gens + " generation" + (v.gens === 1 ? "" : "s") +
        ", <b>" + D + "</b> carrying mutations that pile up with every division: how a tumour starts.";
    },
    examples: [
      {name: "both checkpoints work", values: {g1s: "intact", p53: true, damage: 0.15, gens: 5}},
      {name: "p53 lost", values: {g1s: "intact", p53: false, damage: 0.15, gens: 5}},
      {name: "G1/S broken", values: {g1s: "broken", p53: true, damage: 0.15, gens: 5}},
      {name: "both lost", values: {g1s: "broken", p53: false, damage: 0.3, gens: 5}},
      {name: "no damage, one generation", values: {damage: 0, gens: 1}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, r = grow(v), X0 = 52, X1 = 326, top = 24, dy = 46;
      var px = function (n) { return X0 + (n.a + n.b) / 2 * (X1 - X0); };
      var col = {cycling: c.c1, resting: c.c1, damaged: c.c3, dead: c.c5};
      api.label([X1 + 40, 10], "live cells", {color: c.muted, size: 12, anchor: "middle"});
      for (var f = v.gens + 1; f <= 5; f++) api.label([10, top + f * dy], "gen " + f, {color: c.faint, size: 12});
      r.gens.forEach(function (row, g) {
        var y = top + g * dy, rad = Math.max(3, Math.min(7, (X1 - X0) / Math.pow(2, g) * 0.3));
        api.label([10, y], "gen " + g, {color: c.muted, size: 12});
        var full = v.g1s === "intact" && r.counts[g] >= K;
        api.label([X1 + 40, y], String(r.counts[g]), {color: full ? c.c1 : c.ink, size: 12.5, weight: 650, anchor: "middle"});
        row.forEach(function (n) {
          var q = [px(n), y];
          if (n.parent) api.line([px(n.parent), y - dy + 6], [q[0], y - rad - 1], {color: c.faint, width: 1.1});
          if (n.st === "dead") {
            var s = rad + 1;
            api.line([q[0] - s, q[1] - s], [q[0] + s, q[1] + s], {color: c.c5, width: 2.2});
            api.line([q[0] - s, q[1] + s], [q[0] + s, q[1] - s], {color: c.c5, width: 2.2});
          } else if (n.st === "resting") api.circle(q, rad, {fill: c.card, stroke: c.c1, width: 1.6});
          else {
            api.circle(q, rad, {fill: col[n.st]});
          }
        });
      });
      if (v.g1s === "intact") api.label([X1 + 40, top + 5 * dy + 17], "max 8", {color: c.c1, size: 12, anchor: "middle"});
      // legend
      var ly = 286, items = [["dividing", "dot", c.c1, 18], ["resting (G₀)", "ring", c.c1, 104], ["damaged DNA", "dot", c.c3, 212], ["apoptosis", "x", c.c5, 318]];
      items.forEach(function (it) {
        var lx = it[3];
        if (it[1] === "dot") api.circle([lx, ly], 5, {fill: it[2]});
        else if (it[1] === "ring") api.circle([lx, ly], 5, {fill: c.card, stroke: it[2], width: 1.6});
        else { api.line([lx - 4, ly - 4], [lx + 4, ly + 4], {color: it[2], width: 2}); api.line([lx - 4, ly + 4], [lx + 4, ly - 4], {color: it[2], width: 2}); }
        api.label([lx + 9, ly], it[0], {color: c.muted, size: 12, raw: true});
      });
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
