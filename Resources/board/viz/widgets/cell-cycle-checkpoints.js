// The three cell-cycle checkpoints, one per step, each drawn as sensor -> relay -> brake -> target. G1/S: ATM senses
// a double-strand break, Chk2 and ATM stabilize p53 (MDM2 stops destroying it), p53 makes p21, and p21 inhibits cyclin
// E-CDK2, so Rb keeps E2F bound and S phase cannot start. G2/M: ATR senses single-stranded DNA at stalled or
// unfinished forks, Chk1 inhibits Cdc25 (and supports Wee1), so CDK1 keeps its inhibitory Tyr15 phosphate and cyclin
// B-CDK1 stays off. Spindle assembly checkpoint: an unattached kinetochore makes the mitotic checkpoint complex
// (Mad2, BubR1, Bub3), which traps Cdc20, so APC/C stays off, securin survives, separase cannot cut cohesin and anaphase
// waits. With no problem the target's activity rises past its threshold and the cell moves on. Activity levels are
// schematic (low/high around a threshold), not measured.
(function () {
  var GATES = [
    {chain: [["ATM", "senses the break"], ["Chk2 → p53", "p53 builds up"], ["p21", "a CDK inhibitor"]], target: "cyclin E–CDK2",
     qs: [["growth signals?", true], ["cell big enough?", true], ["DNA undamaged?", false]], go: "→ S phase", stop: "waits in G₁: repair or apoptosis",
     f1: "\\text{break}\\to\\text{ATM}\\to\\text{Chk2}\\to p53\\to p21\\newline\\dashv\\text{cyclin E–CDK2: Rb holds E2F}", f0: "\\text{cyclin E–CDK2}\\to\\text{Rb–P}\\newline\\to\\text{E2F free}\\to S\\text{ phase}",
     s1: "Damage found in G₁: ATM and Chk2 stabilize <b>p53</b>, which makes <b>p21</b>; p21 shuts off cyclin E–CDK2, so Rb keeps E2F bound and the cell waits in G₁ to repair, or dies by apoptosis.",
     s0: "Signals present, cell big enough, DNA intact: <b>cyclin E–CDK2</b> rises past its threshold, phosphorylates Rb and the cell commits to <b>S phase</b>."},
    {chain: [["ATR", "senses stalled forks"], ["Chk1", "blocks Cdc25"], ["CDK1 Tyr15-P", "inhibitory phosphate stays"]], target: "cyclin B–CDK1",
     qs: [["all DNA copied?", false], ["DNA undamaged?", true]], go: "→ mitosis", stop: "waits in G₂ until copying ends",
     f1: "\\text{open fork}\\to\\text{ATR}\\to\\text{Chk1}\\dashv\\text{Cdc25}\\newline\\Rightarrow\\text{cyclin B–CDK1 stays off}", f0: "\\text{Cdc25 removes Tyr15-P}\\newline\\to\\text{cyclin B–CDK1 on}\\to M",
     s1: "Some DNA is still uncopied: <b>ATR</b> and <b>Chk1</b> block Cdc25, so cyclin B–CDK1 keeps its inhibitory phosphate and the cell waits in G₂ until replication finishes.",
     s0: "DNA fully copied and intact: <b>Cdc25</b> strips the inhibitory phosphate from <b>cyclin B–CDK1</b>, which switches on and takes the cell into mitosis."},
    {chain: [["free kinetochore", "makes the signal"], ["Mad2 + BubR1", "wait-anaphase signal"], ["Cdc20 trapped", "in the checkpoint complex"]], target: "APC/C",
     qs: [["kinetochores attached?", false], ["pulled from both poles?", true]], go: "→ anaphase", stop: "waits in metaphase",
     f1: "\\text{unattached kinetochore}\\to\\text{Mad2}\\dashv\\text{Cdc20}\\newline\\Rightarrow\\text{APC/C off: securin stays}", f0: "\\text{APC/C–Cdc20}\\to\\text{securin destroyed}\\newline\\to\\text{separase cuts cohesin}",
     s1: "One kinetochore is unattached: it keeps making the <b>Mad2</b> signal that traps Cdc20, so <b>APC/C</b> stays off, securin protects cohesin and anaphase waits.",
     s0: "Every kinetochore is attached from both poles: the Mad2 signal stops, <b>APC/C–Cdc20</b> destroys securin, separase cuts cohesin and the sisters separate."}
  ];
  Viz.register("cell-cycle-checkpoints", {
    title: "The three cell cycle checkpoints",
    subject: "biology",
    shows: "Step through the G1/S, G2/M and spindle checkpoints: each senses one problem and brakes one switch (cyclin E–CDK2, cyclin B–CDK1, APC/C); turn the problem off and the switch flips and the cell moves on",
    params: {
      problem: {kind: "boolean", default: true, label: "\\text{problem}", on: "found", off: "none"}
    },
    steps: ["G₁/S: safe to copy the DNA?", "G₂/M: DNA copied and intact?", "spindle: every chromosome attached?"],
    stepMs: 2200,
    formula: function (v) { var g = GATES[(v.step || 1) - 1]; return v.problem ? g.f1 : g.f0; },
    status: function (v) { var g = GATES[(v.step || 1) - 1]; return v.problem ? g.s1 : g.s0; },
    examples: [
      {name: "G1/S, DNA damage", values: {step: 1, problem: true}},
      {name: "G1/S, all clear", values: {step: 1, problem: false}},
      {name: "G2/M, DNA uncopied", values: {step: 2, problem: true}},
      {name: "G2/M, all clear", values: {step: 2, problem: false}},
      {name: "spindle, unattached kinetochore", values: {step: 3, problem: true}},
      {name: "spindle, all attached", values: {step: 3, problem: false}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = (v.step || 1) - 1, g = GATES[s], bad = v.problem;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // ---- the cycle as a track with its three gates (phase widths schematic) ----
      var PH = [["G₁", 20, 140], ["S", 140, 236], ["G₂", 236, 300], ["M", 300, 380]], GX = [140, 300, 344];
      PH.forEach(function (p) { api.rect(p[1] + 1, 18, p[2] - p[1] - 2, 18, {fill: c.ink, fillOpacity: 0.07, rx: 4}); L([(p[1] + p[2]) / 2, 27], p[0], c.muted, {anchor: "middle", weight: 500}); });
      GX.forEach(function (x, i) {
        var cur = i === s, passed = i < s;
        api.line([x, 12], [x, 42], {color: cur ? (bad ? c.c5 : c.c4) : passed ? c.c4 : c.faint, width: cur ? 4 : 2.5});
        L([x, 52], String(i + 1), cur ? c.ink : c.muted, {anchor: "middle", weight: 700});
      });
      var tok = bad ? GX[s] - 9 : GX[s] + 12;
      api.circle([tok, 27], 6, {fill: c.c1, stroke: c.card, width: 2});
      // ---- what this checkpoint looks at ----
      var cx = 92, cy = 118, n0 = api.root.childNodes.length;
      L([cx, 70], "what it checks", c.muted, {anchor: "middle", weight: 500});
      if (s === 0) {
        var pts = function (ph, x0, x1) { var a = []; for (var x = x0; x <= x1; x += 3) a.push([x, cy + 12 * Math.sin((x - 20) / 9 + ph)]); return a; };
        var gap = bad ? [cx - 6, cx + 6] : null;
        [0, Math.PI].forEach(function (ph, k) {
          if (gap) { api.polyline(pts(ph, 24, gap[0]), {stroke: k ? c.c6 : c.c2, width: 2.4}); api.polyline(pts(ph, gap[1], 160), {stroke: k ? c.c6 : c.c2, width: 2.4}); }
          else api.polyline(pts(ph, 24, 160), {stroke: k ? c.c6 : c.c2, width: 2.4});
        });
        if (bad) { api.circle([cx, cy - 26], 9, {fill: c.c5, fillOpacity: 0.25, stroke: c.c5, width: 1.5}); L([cx, cy - 26], "ATM", c.c5, {anchor: "middle", size: 12, weight: 700}); L([cx, cy + 30], "double-strand break", c.c5, {anchor: "middle"}); }
        else L([cx, cy + 30], "intact DNA", c.c4, {anchor: "middle"});
      } else if (s === 1) {
        var y1 = cy - 12, y2 = cy + 12, fork = bad ? 112 : 166;
        api.line([20, cy - 3], [44, cy - 3], {color: c.c2, width: 3}); api.line([20, cy + 3], [44, cy + 3], {color: c.c6, width: 3});
        api.path("M 44 " + (cy - 3) + " Q 54 " + y1 + " 64 " + y1 + " L " + fork + " " + y1, {stroke: c.c2, width: 3});
        api.path("M 64 " + (y1 + 5) + " L " + (fork - 6) + " " + (y1 + 5), {stroke: c.c4, width: 3});
        api.path("M 44 " + (cy + 3) + " Q 54 " + y2 + " 64 " + y2 + " L " + fork + " " + y2, {stroke: c.c6, width: 3});
        api.path("M 64 " + (y2 - 5) + " L " + (fork - 6) + " " + (y2 - 5), {stroke: c.c4, width: 3});
        if (bad) {
          api.line([fork, y1], [fork + 10, cy - 3], {color: c.c2, width: 3}); api.line([fork, y2], [fork + 10, cy + 3], {color: c.c6, width: 3});
          api.line([fork + 10, cy - 3], [164, cy - 3], {color: c.c2, width: 3}); api.line([fork + 10, cy + 3], [164, cy + 3], {color: c.c6, width: 3});
          api.circle([fork + 4, cy - 26], 9, {fill: c.c5, fillOpacity: 0.25, stroke: c.c5, width: 1.5}); L([fork + 4, cy - 26], "ATR", c.c5, {anchor: "middle", weight: 700});
          L([cx, cy + 32], "fork still open: uncopied", c.c5, {anchor: "middle"});
        } else L([cx, cy + 32], "every stretch copied", c.c4, {anchor: "middle"});
        L([28, cy + 18], "old", c.muted, {weight: 500}); L([96, cy + 2], "new", c.c4, {anchor: "middle", weight: 500});
      } else {
        var P1 = [cx - 62, cy], P2 = [cx + 62, cy];
        [P1, P2].forEach(function (p) { api.circle(p, 4.5, {fill: c.c4}); });
        [-30, -10, 10, 30].forEach(function (dy, i) {
          var loose = bad && i === 3, y = cy + dy, xo = loose ? 22 : 0;
          api.line(P1, [cx - 5 + xo, y], {color: c.c4, width: 1.2, opacity: 0.75});
          if (!loose) api.line(P2, [cx + 5, y], {color: c.c4, width: 1.2, opacity: 0.75});
          api.rect(cx - 6 + xo, y - 4, 5, 8, {fill: i % 2 ? c.c6 : c.c2, rx: 2}); api.rect(cx + 1 + xo, y - 4, 5, 8, {fill: i % 2 ? c.c6 : c.c2, rx: 2});
          if (loose) { api.circle([cx + 9 + xo, y], 6, {stroke: c.c5, width: 1.6}); L([cx + 30 + xo, y + 2], "Mad2", c.c5, {weight: 700}); }
        });
        L([cx, cy + 50], bad ? "one kinetochore unattached" : "all attached to both poles", bad ? c.c5 : c.c4, {anchor: "middle"});
      }
      // enlarge the picture (drawn at 1x around cx, cy) into the space it has
      var grp = api.group({transform: "translate(" + cx + " " + (cy + 14) + ") scale(1.18) translate(" + (-cx) + " " + (-cy) + ")"}), kids = Array.prototype.slice.call(api.root.childNodes, n0);
      kids.forEach(function (k) { if (k !== grp) grp.appendChild(k); });
      // the questions this checkpoint asks
      g.qs.forEach(function (q, i) {
        var ok = q[1] || !bad, y = 236 + i * 17;
        L([12, y], q[0], c.ink, {weight: 500});
        L([180, y], ok ? "✓" : "✗", ok ? c.c4 : c.c5, {anchor: "end", weight: 700});
      });
      // ---- sensor -> relay -> brake -> target ----
      var X = 196, W = 196;
      L([X + W / 2, 70], "the brake", c.muted, {anchor: "middle", weight: 500});
      g.chain.forEach(function (b, i) {
        var y = 80 + i * 44;
        api.rect(X, y, W, 32, {fill: bad ? c.c5 : c.ink, fillOpacity: bad ? 0.1 : 0.03, stroke: bad ? c.c5 : c.faint, width: 1.3, rx: 7});
        L([X + 10, y + 11], b[0], bad ? c.ink : c.muted, {weight: 650});
        L([X + 10, y + 24], bad ? b[1] : "idle", c.muted, {weight: 500, size: 12});
        if (i < 2) api.arrow([X + W / 2, y + 33], [X + W / 2, y + 43], {color: bad ? c.c5 : c.faint, width: 2, halo: false, head: 6});
        else { api.line([X + W / 2, y + 33], [X + W / 2, y + 42], {color: bad ? c.c5 : c.faint, width: 2}); api.line([X + W / 2 - 9, y + 42], [X + W / 2 + 9, y + 42], {color: bad ? c.c5 : c.faint, width: 3}); }
      });
      // target switch: activity against the threshold it must cross
      var ty = 212, act = bad ? 0.14 : 0.9, mw = W - 20;
      api.rect(X, ty, W, 56, {fill: c.ink, fillOpacity: 0.04, stroke: bad ? c.c5 : c.c4, width: 1.6, rx: 8});
      L([X + 10, ty + 13], g.target + (bad ? ": off" : ": on"), bad ? c.c5 : c.c4, {weight: 700});
      api.rect(X + 10, ty + 26, mw, 10, {fill: c.ink, fillOpacity: 0.08, rx: 5});
      api.rect(X + 10, ty + 26, mw * act, 10, {fill: bad ? c.c5 : c.c4, rx: 5});
      api.line([X + 10 + mw * 0.5, ty + 22], [X + 10 + mw * 0.5, ty + 40], {color: c.ink, width: 1.6, dash: "2 2"});
      L([X + 10 + mw * 0.5, ty + 48], "threshold", c.muted, {anchor: "middle", weight: 500, size: 12});
      L([X + W, 286], bad ? g.stop : g.go, bad ? c.c5 : c.c4, {anchor: "end", weight: 650, size: 12.5});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
