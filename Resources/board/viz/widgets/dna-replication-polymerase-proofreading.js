// Proofreading by DNA polymerase. Base selection alone misplaces about 1 nucleotide in 10^5; when a wrong one goes in, the
// mismatched 3' end frays, slides into the 3'->5' exonuclease site and is clipped off, which removes ~99 in 100 mistakes;
// mismatch repair behind the fork catches ~999 in 1000 of the rest: 10^-5 x 10^-2 x 10^-3 = 10^-10 per base pair
// (Alberts, Molecular Biology of the Cell, Table 5-1). Errors per genome copy = L x error rate, with L = 4.6 x 10^6 bp
// for E. coli and 6.4 x 10^9 bp for a diploid human cell. The close-up puts G opposite a template T (a G.T mismatch).
(function () {
  var TPL = "TACGCATGGACT", PAIR = {A: "T", T: "A", G: "C", C: "G"}, MIS = 6, WRONG = "G";
  var GEN = {"E. coli": 4.6e6, "human": 6.4e9};
  function rate(v) { return 1e-5 * (v.proof ? 1e-2 : 1) * (v.mmr ? 1e-3 : 1); }
  function parts(x) { var e = Math.floor(Math.log10(x) + 1e-9), m = x / Math.pow(10, e); return [Math.round(m * 10) / 10, e]; }
  function texNum(x) {
    if (x >= 1) return Math.round(x).toLocaleString("en-US").replace(/,/g, "{,}");
    if (x >= 0.01) return String(Number(x.toPrecision(2)));
    var p = parts(x); return (p[0] === 1 ? "" : p[0] + "\\times") + "10^{" + p[1] + "}";
  }
  function txtNum(x) {
    if (x >= 1) return Math.round(x).toLocaleString("en-US");
    if (x >= 0.01) return String(Number(x.toPrecision(2)));
    var p = parts(x), sup = String(p[1]).replace(/-/g, "⁻").replace(/\d/g, function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]; });
    return (p[0] === 1 ? "" : p[0] + " × ") + "10" + sup;
  }
  function supPow(e) { return "10" + String(e).replace(/-/g, "⁻").replace(/\d/g, function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]; }); }

  Viz.register("dna-replication-polymerase-proofreading", {
    title: "Proofreading: how DNA polymerase fixes its own mistakes",
    subject: "biology",
    shows: "Step through a wrong base going in and the 3′→5′ exonuclease clipping it off; switch proofreading and mismatch repair off to see errors per genome copy jump",
    params: {
      proof: {kind: "boolean", default: true, label: "\\text{proofread}", on: "3′→5′ exo on", off: "exo-dead"},
      mmr: {kind: "boolean", default: true, label: "\\text{MMR}", on: "mismatch repair on", off: "off"},
      genome: {kind: "enum", values: ["E. coli", "human"], default: "human", label: "\\text{genome}"}
    },
    steps: ["a wrong base goes in", "the 3′ end frays", "exonuclease clips it off", "synthesis resumes"],
    stepMs: 1800,
    formula: function (v) {
      var L = GEN[v.genome], e = rate(v), f = "10^{-5}" + (v.proof ? "\\cdot 10^{-2}" : "") + (v.mmr ? "\\cdot 10^{-3}" : "");
      var Lt = parts(L)[0] + "\\times10^{" + parts(L)[1] + "}";
      return "\\begin{array}{l}\\varepsilon=" + f + (v.proof || v.mmr ? "=" + texNum(e) : "") + "\\ \\text{per bp}\\\\ L\\varepsilon=" + Lt + "\\cdot" + texNum(e) + "=" + texNum(L * e) + "\\end{array}";
    },
    status: function (v) {
      var s = v.step || 1, n = L_ERR(v);
      var on = ["Polymerase has put G opposite T: it picks the right nucleotide about 99,999 times in 100,000, and this is the one miss",
        "The G cannot pair, so the new strand's 3′ end frays and slides into the exonuclease site about 3 nm away",
        "The 3′→5′ exonuclease clips off the wrong nucleotide as dGMP, handing a correctly paired 3′-OH back to the polymerase site",
        "With A now opposite T, synthesis resumes; proofreading catches about 99 of every 100 mistakes"];
      var off = ["Polymerase has put G opposite T: it picks the right nucleotide about 99,999 times in 100,000, and this is the one miss",
        "This polymerase has no working exonuclease, so nothing removes the G and it slowly extends from the mismatched end",
        "Each base added after it buries the G·T mismatch deeper in the new duplex",
        v.mmr ? "The mismatch is left behind, where only mismatch repair can still find it on the new strand"
              : "The mismatch is left behind, and the next round of copying makes it a permanent A·T → G·C change"];
      return (v.proof ? on : off)[s - 1] + "; at this error rate each " + v.genome + " genome copy carries about <b>" + txtNum(n) + "</b> new error" + (n === 1 ? "" : "s") + ".";
    },
    examples: [
      {name: "every check on", values: {step: 4}},
      {name: "proofreading-dead polymerase", values: {proof: false, step: 4}},
      {name: "no checks, human", values: {proof: false, mmr: false, genome: "human"}},
      {name: "E. coli, all checks", values: {genome: "E. coli", step: 3}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, X = function (i) { return 44 + i * 26; };
      var yT = 146, yN = 112, proof = v.proof;
      // which new-strand bases are where, per step
      var made = proof ? [7, 7, 6, 8][s - 1] : [7, 8, 9, 10][s - 1];
      var frayed = proof && s === 2, fixed = proof && s === 4;
      var toward = function (a, b, d) { var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); return [a[0] + dx * d / L, a[1] + dy * d / L]; };
      // polymerase body around the primer-template junction, with the exonuclease pocket up and behind the 3' end
      var tip = X(made - 1), py = 40, pw = 186, px = tip - 120;   // edges fall between template letters
      api.rect(px, py, pw, yT + 19 - py, {rx: 32, fill: c.c6, fillOpacity: 0.1, stroke: c.c6, width: 1.4});
      api.label([px + pw, py - 8], "DNA polymerase", {color: c.c6, size: 12, weight: 650, anchor: "end"});
      var exo = [px + 26, py + 28], ec = proof ? c.c1 : c.muted;
      api.circle(exo, 15, {fill: ec, fillOpacity: proof && (s === 2 || s === 3) ? 0.35 : 0.12, stroke: ec, width: 1.4, dash: proof ? null : "3 3"});
      api.line([px - 3, exo[1]], [exo[0] - 16, exo[1]], {color: ec, width: 1.2});
      api.label([px - 6, exo[1]], proof ? "exo site" : "exo dead", {color: ec, size: 12, weight: 650, anchor: "end", clamp: false});   // real width fits (px >= 54); the estimate would push it onto the body
      api.rect(tip - 14, yN - 13, 28, yT - yN + 26, {rx: 8, stroke: c.c6, width: 1.2, dash: "3 3"});
      api.label([tip, py + 20], "pol site", {color: c.c6, size: 12, anchor: "middle"});
      // template strand, read 3' -> 5' left to right
      api.line([X(0) - 12, yT + 14], [X(11) + 12, yT + 14], {color: c.c2, width: 3});
      api.label([X(0) - 24, yT + 14], "3′", {color: c.c2, size: 12, anchor: "middle"});
      api.label([X(11) + 22, yT + 14], "5′", {color: c.c2, size: 12, anchor: "middle"});
      for (var i = 0; i < 12; i++) api.label([X(i), yT], TPL[i], {color: c.c2, size: 13, weight: 650, anchor: "middle"});
      api.label([X(11) + 12, yT + 31], "template", {color: c.c2, size: 12, anchor: "end"});
      // the new strand, 5' -> 3'; when it frays, its last two bases ride the backbone up into the exo site
      var pts = [], bend = [X(4) - 2, yN - 34];
      for (i = 0; i < made; i++) {
        var wrong = i === MIS && !fixed, base = wrong ? WRONG : PAIR[TPL[i]], off = frayed && i >= 5;
        var at = !off ? [X(i), yN] : i === 5 ? bend : exo;
        if (!off) pts.push([X(i), yN - 12]);
        if (!off && !wrong) api.line([X(i), yN + 9], [X(i), yT - 9], {color: c.faint, width: 1.3});
        if (wrong) api.circle(at, 8, {stroke: c.c5, width: 1.6});
        api.label(at, base, {color: wrong ? c.c5 : c.c3, size: 13, weight: 700, anchor: "middle"});
      }
      if (frayed) {
        pts.push(toward(bend, pts[4], 9));
        api.polyline([toward(bend, exo, 9), toward(exo, bend, 11)], {stroke: c.c3, width: 2.5});
      }
      api.polyline(pts, {stroke: c.c3, width: 2.5});
      api.label([X(0) - 24, yN - 12], "5′", {color: c.c3, size: 12, anchor: "middle"});
      if (!frayed) api.label([tip + 14, yN - 24], "3′", {color: c.c3, size: 12, anchor: "middle"});
      if (s === 1 || (!proof && s >= 2)) api.label([X(MIS), yT + 31], "G·T mismatch", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      if (proof && s === 3) {   // the clipped nucleotide leaves the exo site
        api.arrow([exo[0] - 6, exo[1] - 14], [exo[0] - 20, 14], {color: c.c5, width: 2, halo: false, head: 8});
        api.label([exo[0] - 10, 14], "dGMP released", {color: c.c5, size: 12, weight: 650});
        api.circle([X(MIS), yN], 8, {stroke: c.faint, width: 1.3, dash: "3 3"});
      }
      if (fixed) api.label([X(MIS), yT + 31], "A·T, correct", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
      // ---- fidelity ladder: errors per base pair on a log axis ----
      var a0 = 26, a1 = 300, yA = 252, LX = function (e) { return a0 + (a1 - a0) * e / 10; };
      api.label([a0, 200], "errors per base pair copied (log scale)", {color: c.muted, size: 12});
      api.line([a0, yA + 10], [a1, yA + 10], {color: c.axis, width: 1.2});
      [0, 2, 4, 6, 8, 10].forEach(function (e) {
        api.line([LX(e), yA + 6], [LX(e), yA + 14], {color: c.axis, width: 1.2});
        api.label([LX(e), yA + 25], supPow(-e), {color: c.muted, size: 12, anchor: "middle", raw: true});
      });
      var stages = [["base selection", 5, true, c.c6], ["proofreading", 2, proof, c.c1], ["mismatch repair", 3, v.mmr, c.c4]], e0 = 0;
      stages.forEach(function (st, k) {
        if (!st[2]) return;
        api.rect(LX(e0) + 1, yA - 8, LX(e0 + st[1]) - LX(e0) - 2, 14, {rx: 4, fill: st[3], fillOpacity: 0.7});
        api.label([(LX(e0) + LX(e0 + st[1])) / 2, k === 1 ? yA - 36 : yA - 20], st[0], {color: st[3], size: 12, weight: 650, anchor: "middle"});
        e0 += st[1];
      });
      var n = L_ERR(v);
      api.line([LX(e0), yA - 12], [LX(e0), yA + 10], {color: c.ink, width: 2});
      api.label([LX(e0) + 8, yA - 1], "ε = " + supPow(-e0), {color: c.ink, size: 13, weight: 700, raw: true});
      api.label([200, 304], "≈ " + txtNum(n) + " new error" + (n === 1 ? "" : "s") + " per " + v.genome + " genome copy", {color: n >= 1 ? c.c5 : c.c4, size: 13, weight: 650, anchor: "middle", raw: true});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
  function L_ERR(v) { return GEN[v.genome] * rate(v); }
})();
