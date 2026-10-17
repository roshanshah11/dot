// The cell cycle as a ring (G1, S, G2, M) with its three checkpoints, and a decision map beside it. Set what the
// cell finds: growth factors, DNA damage, unfinished replication, an unattached kinetochore. The cell runs round the
// ring until the first checkpoint whose answer is no, and the map shows the question it failed, the molecules that
// stop it and what can happen next (G0, repair or apoptosis, waiting). Arc lengths are schematic: M is about an hour
// of a roughly 24-hour human cycle, drawn wider so it can be read.
(function () {
  var F = {g1s: 0.42, g2m: 0.86, sac: 0.93};            // where each checkpoint sits on the ring (fraction of a turn)
  var PH = [["G_1", 0, 0.42], ["S", 0.42, 0.70], ["G_2", 0.70, 0.86], ["M", 0.86, 1]];
  // which checkpoint stops the cell, and why; checks run in the order the cell meets them
  function verdict(v) {
    if (!v.gf) return {gate: 1, why: "gf", at: F.g1s};
    if (v.damage === "in G1") return {gate: 1, why: "dna", at: F.g1s};
    if (!v.replicated) return {gate: 2, why: "rep", at: F.g2m};
    if (v.damage === "in G2") return {gate: 2, why: "dna", at: F.g2m};
    if (!v.attached) return {gate: 3, why: "kt", at: F.sac};
    return {gate: 0, why: "", at: 1};
  }
  var FORMULA = {
    "1gf": "\\text{no growth factor}\\to\\text{no cyclin D}\\newline\\to\\text{Rb holds E2F}\\to G_0",
    "1dna": "\\text{DNA damage}\\to p53\\to p21\\newline\\dashv\\text{cyclin E–CDK2}\\text{: no S phase}",
    "2rep": "\\text{unreplicated DNA}\\to\\text{ATR–Chk1}\\newline\\dashv\\text{Cdc25}\\text{: cyclin B–CDK1 off}",
    "2dna": "\\text{DNA damage}\\to\\text{ATM/ATR–Chk1/2}\\newline\\dashv\\text{Cdc25}\\text{: cyclin B–CDK1 off}",
    "3kt": "\\text{unattached kinetochore}\\to\\text{Mad2}\\newline\\dashv\\text{APC/C}\\text{: securin stays}",
    "0": "\\text{APC/C}\\to\\text{securin destroyed}\\newline\\to\\text{separase cuts cohesin}"
  };
  var STATUS = {
    "1gf": "Without growth factors the cell never passes the <b>restriction point</b>: Rb keeps E2F off and the cell rests in <b>G0</b> until signals return.",
    "1dna": "Damage found in G1 stops the cell at <b>G1/S</b>: p53 builds up and p21 blocks cyclin E–CDK2; it resumes once repaired, or p53 triggers <b>apoptosis</b> if it cannot be.",
    "2rep": "Replication is unfinished, so the <b>G2/M</b> checkpoint holds cyclin B–CDK1 inactive: the cell waits in G2 rather than divide half-copied DNA.",
    "2dna": "Damage found in G2 stops the cell at <b>G2/M</b>: Chk1/Chk2 block Cdc25, so cyclin B–CDK1 stays off until repair, or the cell dies by apoptosis.",
    "3kt": "One kinetochore is unattached, so the <b>spindle checkpoint</b> holds the cell in metaphase: Mad2 blocks APC/C and no sister chromatids separate.",
    "0": "Every checkpoint says yes: the cell copies its DNA, lines up its chromosomes and divides into <b>2 daughter cells</b>."
  };
  Viz.register("cell-cycle-checkpoint-decision-map", {
    title: "Cell cycle checkpoints: go or stop",
    subject: "biology",
    shows: "Give the cell a problem: it runs round G1, S, G2 and M until the first checkpoint that says no, and the map shows why it stops and what happens next",
    params: {
      gf: {kind: "boolean", default: true, label: "\\text{signals}", on: "growth factors", off: "none"},
      damage: {kind: "enum", values: ["none", "in G1", "in G2"], default: "none", label: "\\text{damage}"},
      replicated: {kind: "boolean", default: true, label: "\\text{S phase}", on: "DNA fully copied", off: "unfinished"},
      attached: {kind: "boolean", default: true, label: "\\text{spindle}", on: "all attached", off: "one unattached"}
    },
    formula: function (v) { var d = verdict(v); return FORMULA[d.gate ? d.gate + d.why : "0"]; },
    status: function (v) { var d = verdict(v); return STATUS[d.gate ? d.gate + d.why : "0"]; },
    examples: [
      {name: "everything fine: divides", values: {gf: true, damage: "none", replicated: true, attached: true}},
      {name: "no growth factors: G0", values: {gf: false}},
      {name: "DNA damage in G1", values: {damage: "in G1"}},
      {name: "replication unfinished", values: {replicated: false}},
      {name: "DNA damage in G2", values: {damage: "in G2"}},
      {name: "unattached kinetochore", values: {attached: false}},
      {name: "every problem at once", values: {gf: false, damage: "in G2", replicated: false, attached: false}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, d = verdict(v), cx = 112, cy = 150, R = 76;
      var pos = function (f, r) { var a = (-90 + 360 * f) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
      var arc = function (f0, f1, r) {
        var a = pos(f0, r), b = pos(f1, r), big = (f1 - f0) > 0.5 ? 1 : 0;
        return "M " + a[0].toFixed(2) + " " + a[1].toFixed(2) + " A " + r + " " + r + " 0 " + big + " 1 " + b[0].toFixed(2) + " " + b[1].toFixed(2);
      };
      // the four phases, faint, with their names
      PH.forEach(function (p) {
        api.path(arc(p[1] + 0.003, p[2] - 0.003, R), {stroke: c.ink, width: 20, opacity: 0.12}).setAttribute("stroke-linecap", "butt");
        var m = pos(p[0] === "M" ? 0.895 : (p[1] + p[2]) / 2, R);
        api.label(m, p[0], {color: c.ink, size: 13, weight: 700, anchor: "middle"});
      });
      // how far this cell gets: teal from the start of G1 to where it stops
      api.path(arc(0.004, Math.min(d.at, 0.996) - 0.004, R + 15), {stroke: c.c1, width: 4});
      if (d.gate === 0) api.arrow(pos(0.975, R + 15), pos(0.999, R + 15), {color: c.c1, width: 4, halo: false, head: 10});
      // checkpoints: green tick if passed, red bar if this is where it stops, faint if never reached
      [[1, F.g1s], [2, F.g2m], [3, F.sac]].forEach(function (g) {
        var state = d.gate === 0 || g[1] < d.at ? "pass" : d.gate === g[0] ? "stop" : "off";
        var col = state === "pass" ? c.c4 : state === "stop" ? c.c5 : c.faint;
        api.line(pos(g[1], R - 14), pos(g[1], R + 20), {color: col, width: state === "stop" ? 6 : 3.5});
        var b = pos(g[1], R + 34);
        api.circle(b, 10, {fill: c.card, stroke: col, width: 2});
        api.label(b, String(g[0]), {color: col, size: 12, weight: 700, anchor: "middle"});
      });
      // G0: the side exit for a cell with no growth signals
      var g0 = [196, 262], exitFrom = pos(0.36, R + 12);
      api.circle(g0, 15, {fill: c.c6, fillOpacity: d.why === "gf" ? 0.35 : 0.06, stroke: c.c6, width: d.why === "gf" ? 2 : 1, opacity: d.why === "gf" ? 1 : 0.45});
      api.label(g0, "G_0", {color: c.c6, size: 13, weight: 700, anchor: "middle", opacity: d.why === "gf" ? 1 : 0.5});
      if (d.why === "gf") api.arrow(exitFrom, [g0[0] - 12, g0[1] - 10], {color: c.c6, width: 2.5, halo: false, head: 9});
      // the cell itself, at the point where it stops (or at the start, split in two, if it divides)
      var center = [cx, cy];
      if (d.gate === 0) {
        api.circle([cx - 17, cy - 4], 15, {fill: c.c1, fillOpacity: 0.2, stroke: c.c1, width: 2});
        api.circle([cx + 17, cy - 4], 15, {fill: c.c1, fillOpacity: 0.2, stroke: c.c1, width: 2});
        api.circle([cx - 17, cy - 4], 5, {fill: c.c1}); api.circle([cx + 17, cy - 4], 5, {fill: c.c1});
        api.label([cx, cy + 24], "2 daughter cells", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
        api.point(pos(0, R + 15), {color: c.c1, r: 6});
      } else {
        var here = pos(d.at - 0.012, R + 15);
        api.point(here, {color: c.c1, r: 7});
        var word = d.why === "gf" ? "resting in G_0" : d.why === "kt" ? "waiting in metaphase" : d.gate === 1 ? "arrested in G_1" : "arrested in G_2";
        api.circle([cx, cy - 8], 15, {fill: c.c5, fillOpacity: 0.12, stroke: c.c5, width: 2});
        api.rect(cx - 6, cy - 14, 4, 12, {fill: c.c5, rx: 1}); api.rect(cx + 2, cy - 14, 4, 12, {fill: c.c5, rx: 1});
        api.label([cx, cy + 22], word, {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      }
      // ---- the decision map: one card per checkpoint, in the order the cell meets them ----
      var X = 224, Wd = 172, mark = function (ok, reached) { return !reached ? ["–", c.faint] : ok ? ["✓", c.c4] : ["✗", c.c5]; };
      var cards = [
        {n: 1, title: "G_1/S checkpoint", qs: [["growth factors?", v.gf], ["DNA intact?", v.damage !== "in G1"]]},
        {n: 2, title: "G_2/M checkpoint", qs: [["DNA fully copied?", v.replicated], ["DNA intact?", v.damage !== "in G2"]]},
        {n: 3, title: "spindle checkpoint", qs: [["kinetochores attached?", v.attached]]}
      ];
      var OUT = {   // what the stopped checkpoint does, and the branches that follow
        "1gf": [["→ G_0 (leaves the cycle)", c.c6], ["Rb keeps E2F off", c.muted], ["signals back → G_1", c.muted]],
        "1dna": [["→ p53 → p21: arrest", c.c5], ["repaired → resumes", c.muted], ["unfixable → apoptosis", c.muted]],
        "2rep": [["→ arrest in G_2", c.c5], ["cyclin B–CDK1 kept off", c.muted], ["copied → resumes", c.muted]],
        "2dna": [["→ Chk1/2 block Cdc25", c.c5], ["repaired → resumes", c.muted], ["unfixable → apoptosis", c.muted]],
        "3kt": [["→ Mad2 blocks APC/C", c.c5], ["sisters stay joined", c.muted], ["attached → anaphase", c.muted]]
      };
      var y = 10;
      cards.forEach(function (cd) {
        var reached = d.gate === 0 || d.gate >= cd.n, stopped = d.gate === cd.n;
        var edge = stopped ? c.c5 : reached ? c.c4 : c.faint, h = 26 + cd.qs.length * 16 + (stopped ? 50 : 0);
        api.rect(X, y, Wd, h, {fill: c.ink, fillOpacity: 0.03, stroke: edge, width: stopped ? 1.8 : 1, rx: 8, opacity: reached ? 1 : 0.6});
        api.label([X + 9, y + 14], cd.n + "  " + cd.title, {color: reached ? c.ink : c.muted, size: 12, weight: 700});
        var failedYet = false;
        cd.qs.forEach(function (q, i) {
          var asked = reached && !failedYet, mk = mark(q[1], asked);
          if (asked && !q[1]) failedYet = true;
          api.label([X + 9, y + 32 + i * 16], q[0], {color: asked ? c.ink : c.muted, size: 12});
          api.label([X + Wd - 9, y + 32 + i * 16], mk[0], {color: mk[1], size: 12, weight: 700, anchor: "end"});
        });
        if (stopped) OUT[cd.n + d.why].forEach(function (o, i) { api.label([X + 9, y + h - 42 + i * 15], o[0], {color: o[1], size: 12, weight: i ? 500 : 650}); });
        y += h + 8;
      });
      if (d.gate !== 3) api.label([X + 9, Math.min(y + 8, api.h - 10)], d.gate === 0 ? "→ anaphase, cytokinesis" : "later checks not reached", {color: d.gate === 0 ? c.c1 : c.muted, size: 12, weight: d.gate === 0 ? 650 : 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
