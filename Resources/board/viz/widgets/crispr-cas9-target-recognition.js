// How Cas9 decides where to cut: it reads the PAM first, then the guide RNA pairs with the target strand
// starting at the PAM end (the seed) and zips outward into an R-loop. A seed mismatch stalls it; a PAM-distal
// mismatch is often tolerated, which is where off-target cuts come from. Real bases, real pairing.
(function () {
  var SP = "GTCACCTCCAATGACTAGGG", L5 = "CA", R3 = "TC", COMP = {A: "T", T: "A", G: "C", C: "G"};
  var WRONG = {A: "C", C: "A", G: "U", U: "G"};
  function pamSeq(v) { return v.pam ? "TGG" : "TCT"; }
  // how many bases (counted from the PAM) are paired at this step
  function extent(v) {
    var s = v.step || 1, m = v.mismatch;
    if (!v.pam || s === 1) return 0;
    var stall = m >= 1 && m <= 10 ? m - 1 : 20;
    return Math.min(s === 2 ? 10 : 20, stall);
  }
  Viz.register("crispr-cas9-target-recognition", {
    title: "How Cas9 recognizes its target",
    subject: "biology",
    shows: "Toggle the PAM and move a guide mismatch along the target: Cas9 needs NGG, pairs the seed next to it first, and only a full R-loop leads to a cut",
    params: {
      pam: {kind: "boolean", default: true, label: "PAM", on: "TGG (fits NGG)", off: "TCT (no PAM)"},
      mismatch: {kind: "integer", default: 0, min: 0, max: 20, label: "\\text{mismatch}"}
    },
    steps: ["check PAM", "pair the seed", "R-loop and cut"],
    stepMs: 1700,
    formula: function (v) {
      var hits = v.mismatch ? 19 : 20;
      return "\\text{PAM}=\\text{" + pamSeq(v) + "}\\," + (v.pam ? "\\checkmark" : "\\times") + ",\\ \\ \\text{match}=" + hits + "/20";
    },
    status: function (v) {
      var s = v.step || 1, m = v.mismatch, seed = m >= 1 && m <= 10;
      if (!v.pam) return s === 1 ? "5′-TCT-3′ is not NGG, so Cas9 never stops to unwind here, however well the guide would match."
        : "With <b>no PAM</b> the DNA never opens, so the guide cannot even test the match: <b>no cut</b>.";
      if (s === 1) return "Cas9 checks DNA by briefly gripping PAMs; 5′-TGG-3′ fits <b>NGG</b>, so it holds on and starts unwinding next to it.";
      if (seed) return "Pairing starts at the PAM end and hits the mismatch at base <b>" + m + "</b> of the seed: the R-loop stalls, Cas9 lets go, <b>no cut</b>.";
      if (s === 2) return "The <b>seed</b>, the 10 or so bases next to the PAM, pairs with the target strand first, base by base.";
      if (!m) return "All <b>20</b> bases pair, Cas9 locks on, and both strands are cut <b>3 bp from the PAM</b>.";
      return "The R-loop zips past the mismatch at base <b>" + m + "</b>: PAM-distal mismatches are often tolerated, so Cas9 <b>can still cut</b> (an off-target cut).";
    },
    examples: [
      {name: "perfect match, cut", values: {pam: true, mismatch: 0, step: 3}},
      {name: "seed mismatch", values: {pam: true, mismatch: 4, step: 3}},
      {name: "distal mismatch", values: {pam: true, mismatch: 17, step: 3}},
      {name: "no PAM", values: {pam: false, mismatch: 0, step: 3}}
    ],
    size: [400, 214],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, ext = extent(v), m = v.mismatch, P = pamSeq(v);
      var top = L5 + SP + P + R3, X = function (i) { return 34 + i * 12.6; };
      var yG = 64, yLift = 88, yT = 136, yB = 164, gone = !v.pam && s > 1;
      var dist = function (i) { return i >= 2 && i < 22 ? 22 - i : 0; };       // bases from the PAM, 1..20 on the target
      var open = function (i) { var d = dist(i); return d > 0 && d <= ext; };
      var passed = m > 10 && s === 3 && v.pam;                                    // distal mismatch the R-loop zipped past
      api.rect(46, 34, 330, 148, {fill: c.c6, fillOpacity: gone ? 0.03 : 0.07, stroke: c.c6, width: 1.2, dash: gone ? "5 5" : null, rx: 18, opacity: gone ? 0.5 : 0.8});
      api.label(gone ? [376, 22] : [368, 46], gone ? "Cas9 moves on" : "Cas9", {color: c.c6, size: 12.5, weight: 700, anchor: "end"});   // above the box when it leaves
      // backbones
      // the displaced strand lifts one column early and comes down half a column late, and the guide drops straight
      // down the gap between two columns, so the two lines cross in open space and neither runs through a base
      var topPts = [], gPts = [], botPts = [], f = 22 - ext;
      for (var i = 0; i < top.length; i++) {
        topPts.push([X(i), (open(i) || (ext > 0 && i === f - 1) ? yLift : yT) - 11]);
        if (ext > 0 && i === 21) topPts.push([X(21) + 6, yLift - 11]);
        botPts.push([X(i), yB + 11]);
        if (dist(i)) {
          var down = open(i) || (passed && dist(i) === m);
          if (down && gPts.length && gPts[gPts.length - 1][1] === yG - 11) gPts.push([X(i - 1) + 6.6, yG - 11], [X(i - 1) + 6.6, yT - 11]);
          gPts.push([X(i), (down ? yT : yG) - 11]);
        }
      }
      api.polyline(topPts, {stroke: c.c1, width: 2});
      api.polyline(botPts, {stroke: c.c2, width: 2});
      api.polyline(gPts, {stroke: c.c3, width: 2});
      api.label([20, yT], "5′", {color: c.c1, size: 12, anchor: "middle"});
      api.label([382, yT], "3′", {color: c.c1, size: 12, anchor: "middle"});
      api.label([20, yB], "3′", {color: c.c2, size: 12, anchor: "middle"});
      api.label([382, yB], "5′", {color: c.c2, size: 12, anchor: "middle"});
      if (ext < 15) api.label([X(2) - 14, yG], "5′", {color: c.c3, size: 12, anchor: "middle"});
      api.label(ext < 15 ? [X(2), yG - 22] : [X(4), (yLift + yT) / 2 - 3], "guide RNA", {color: c.c3, size: 12.5, weight: 650});
      // PAM box on the non-target strand
      api.rect(X(22) - 6.5, yT - 9, X(24) - X(22) + 13, 18, {fill: v.pam ? c.c4 : c.c5, fillOpacity: 0.16, stroke: v.pam ? c.c4 : c.c5, width: 1.2, rx: 4});
      api.label([X(23), yB + 38], v.pam ? "PAM" : "no PAM", {color: v.pam ? c.c4 : c.c5, size: 12, weight: 650, anchor: "middle"});
      // seed bracket under the target strand
      api.path("M " + (X(12) - 4) + " " + (yB + 22) + " L " + (X(12) - 4) + " " + (yB + 26) + " L " + (X(21) + 4) + " " + (yB + 26) + " L " + (X(21) + 4) + " " + (yB + 22), {stroke: c.muted, width: 1.2});
      api.label([(X(12) + X(21)) / 2, yB + 38], "seed (~10 nt)", {color: c.muted, size: 12, anchor: "middle"});
      for (i = 0; i < top.length; i++) {
        var d = dist(i), op = open(i), bad = d && d === m;
        var gUp = !(op || (passed && bad));
        // base pairs: DNA-DNA where closed, RNA-DNA in the R-loop
        if (!op && !(passed && bad)) api.line([X(i), yT + 7], [X(i), yB - 7], {color: c.faint, width: 1.2});
        else if (!bad) api.line([X(i), yT + 7], [X(i), yB - 7], {color: c.c3, width: 1.4, opacity: 0.8});
        api.label([X(i), op ? yLift : yT], top.charAt(i), {color: c.c1, size: 12.5, weight: 600, anchor: "middle", clamp: false});
        api.label([X(i), yB], COMP[top.charAt(i)], {color: c.c2, size: 12.5, weight: 600, anchor: "middle", clamp: false});
        if (d) {
          var gb = top.charAt(i).replace("T", "U");
          // text colour is fixed by the stylesheet, so the mismatched base gets a red chip behind it
          if (bad) {
            api.rect(X(i) - 5.5, (gUp ? yG : yT) - 8, 11, 16, {fill: c.card, rx: 3.5});
            api.rect(X(i) - 5.5, (gUp ? yG : yT) - 8, 11, 16, {fill: c.c5, fillOpacity: 0.5, stroke: c.c5, width: 1, rx: 3.5});
          }
          api.label([X(i), gUp ? yG : yT], bad ? WRONG[gb] : gb, {color: bad ? c.c5 : c.c3, size: 12.5, weight: 700, anchor: "middle", clamp: false});
        }
        if (bad && passed) api.label([X(i), (yT + yB) / 2], "×", {color: c.c5, size: 14, weight: 700, anchor: "middle", clamp: false});
        if (bad && !passed && v.pam && s > 1 && d === ext + 1) api.label([X(i), yLift + 18], "×", {color: c.c5, size: 14, weight: 700, anchor: "middle", clamp: false});
      }
      if (s === 3 && v.pam && ext === 20) {
        var xc = (X(18) + X(19)) / 2;
        [[yLift - 22, yLift + 9], [yB - 9, yB + 22]].forEach(function (r) { api.line([xc, r[0]], [xc, r[1]], {color: c.c5, width: 2.5, dash: "4 3"}); });
        api.label([xc + 6, yLift - 26], "cut", {color: c.c5, size: 12.5, weight: 700});
      }
    }
  });
})();
