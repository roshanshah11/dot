// How transcription stops and the RNA lets go, three ways.
// Intrinsic (bacteria): a GC-rich inverted repeat folds into a hairpin in the RNA right behind the polymerase, and the
//   7-U tract that follows sits in the RNA-DNA hybrid; rU·dA is the weakest base pairing, so the paused complex falls apart.
// Rho-dependent (bacteria): the Rho hexamer loads on a C-rich, unstructured rut site, burns ATP to move 5'->3' along the
//   RNA, catches the polymerase at a pause site and unwinds the hybrid.
// Eukaryotic Pol II: CPSF binds the AAUAAA signal and CstF a GU-rich stretch; the RNA is cut 10-30 nt downstream, the
//   upstream piece gets a poly(A) tail (~200 A), and the 5'->3' exonuclease Xrn2 chews the downstream piece until it
//   knocks Pol II off the DNA (the torpedo model).
// "mutated" breaks the signal (stem arm scrambled; rut made G-rich; AAUAAA -> AAUAAG, a known alpha-thalassemia change):
// the polymerase reads on.
(function () {
  var NAMES = {intrinsic: "hairpin", rho: "Rho", eukaryote: "poly(A)"};
  var POS = {intrinsic: [180, 262, 262, 262], rho: [200, 260, 300, 300], eukaryote: [250, 300, 330, 330]};
  var BAD = [0, 290, 324, 354];
  function px(v) { var s = v.step || 1; return v.broken && s > 1 ? BAD[s - 1] : POS[v.mech][s - 1]; }
  var SAY = {
    intrinsic: ["RNA polymerase copies the terminator: a GC-rich inverted repeat followed by a run of A's on the template.",
      "The two GC-rich arms pair into a <b>hairpin</b> in the RNA just behind the polymerase, which pauses over the U-tract.",
      "The RNA is held only by <b>rU·dA pairs</b>, the weakest there are, and the hairpin pulls it out of the hybrid.",
      "The RNA, ending in UUUUUUU-OH, is <b>released</b> and the polymerase drops off the DNA."],
    rho: ["RNA polymerase moves on while a C-rich, unstructured <b>rut site</b> emerges in the RNA behind it.",
      "Six Rho subunits close into a ring around the RNA at the rut site.",
      "Rho burns <b>ATP</b> to travel 5′ to 3′ along the RNA while the polymerase sits at a pause site.",
      "Rho catches the polymerase and unwinds the RNA-DNA hybrid: the RNA is <b>released</b>."],
    eukaryote: ["Pol II transcribes past the <b>AAUAAA</b> poly(A) signal and keeps going.",
      "CPSF grips AAUAAA, CstF a GU-rich stretch, and the RNA is <b>cut</b> about 20 nt downstream of the signal.",
      "Poly(A) polymerase adds <b>~200 A</b> to the mRNA, while Xrn2 chews the leftover RNA 5′ to 3′ toward Pol II.",
      "Xrn2 catches Pol II and knocks it off the DNA (the <b>torpedo</b>); the finished mRNA leaves with its tail."]
  };
  var BROKE = {intrinsic: ["The second arm is mutated (GCGGGC → CGCCCG), so it cannot pair with the first.", "With no hairpin, nothing pulls the RNA out of the hybrid.",
      "The polymerase barely pauses and <b>reads through</b> the U-tract.", "No termination: the RNA keeps growing into whatever lies downstream."],
    rho: ["The rut site is mutated to a G-rich, folded stretch.", "Rho cannot load on structured, G-rich RNA, so no ring forms.",
      "Without Rho the pause is brief and the polymerase <b>reads through</b>.", "No termination: the RNA keeps growing into whatever lies downstream."],
    eukaryote: ["The signal reads AAUAAG, a single-base change that causes alpha-thalassemia.", "CPSF does not recognize AAUAAG, so the RNA is <b>not cut</b>.",
      "No cut means no free 5′ end for Xrn2 and no poly(A) tail.", "Pol II <b>reads through</b> and the transcript lacks a proper tail."]};

  Viz.register("transcription-termination-rna-release", {
    title: "Transcription termination: releasing the RNA",
    subject: "biology",
    shows: "Pick the mechanism and step through: a hairpin plus a U-tract, the Rho helicase, or poly(A) cleavage plus the Xrn2 torpedo frees the RNA; mutate the signal to see read-through",
    params: {
      mech: {kind: "enum", values: ["intrinsic", "rho", "eukaryote"], names: NAMES, default: "intrinsic", label: "\\text{type}"},
      broken: {kind: "boolean", default: false, label: "\\text{signal}", on: "mutated", off: "intact"}
    },
    // step labels are static, so they read for both the intact path (release) and the mutated one (read-through);
    // each fits the step bar on one line (about 20 characters)
    steps: ["copy the terminator", "signal acts or fails", "the hold is tested", "stop or read-through"],
    stepMs: 1700,
    formula: function (v) {
      var b = v.broken;
      if (v.mech === "intrinsic") return "5'\\cdots\\underbrace{\\texttt{GCCCGC}}_{\\text{arm}}\\,\\texttt{UUCG}\\,\\underbrace{\\texttt{" + (b ? "CGCCCG" : "GCGGGC") + "}}_{\\text{arm}}\\,\\underbrace{\\texttt{UUUUUUU}}_{\\text{U-tract}}\\text{-OH}";
      if (v.mech === "rho") return "\\underbrace{\\texttt{" + (b ? "GGUGGCGG" : "CCUCAUCC") + "}}_{\\text{rut}}\\cdots\\xrightarrow[\\text{ATP}]{\\text{Rho}_6\\ 5'\\to3'}\\ \\text{pol}";
      return "\\underbrace{\\texttt{" + (b ? "AAUAAG" : "AAUAAA") + "}}_{\\text{signal}}\\overbrace{\\cdots\\cdots}^{10\\text{-}30\\text{ nt}}\\texttt{CA}\\!\\downarrow\\ \\Rightarrow\\ \\texttt{CA}\\,\\text{A}_{\\approx200}";
    },
    status: function (v) { var s = (v.step || 1) - 1; return (v.broken ? BROKE : SAY)[v.mech][s]; },
    examples: [
      {name: "hairpin released", values: {mech: "intrinsic", step: 4}},
      {name: "Rho chasing", values: {mech: "rho", step: 3}},
      {name: "poly(A) torpedo", values: {mech: "eukaryote", step: 4}},
      {name: "mutated: read-through", values: {mech: "intrinsic", broken: true, step: 4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, m = v.mech, bad = v.broken, x = px(v), yR = 146, yD = 208;
      var done = !bad && s === 4, euk = m === "eukaryote", tag = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, anchor: "middle"}, o || {})); };
      // DNA: coding and template strands, with the stretch that encodes the signal
      api.line([8, yD], [392, yD], {color: c.c2, width: 2.5, opacity: 0.6});
      api.line([8, yD + 9], [392, yD + 9], {color: c.c1, width: 2.5, opacity: 0.6});
      tag([22, yD + 24], "DNA", c.muted);
      var site = {intrinsic: [170, 282, "terminator"], rho: [282, 324, "pause site"], eukaryote: [130, 230, "poly(A) signal region"]}[m];
      api.rect(site[0], yD - 6, site[1] - site[0], 23, {rx: 4, stroke: c.c6, width: 1.3, dash: "4 3"});
      tag([m === "rho" ? site[1] : (site[0] + site[1]) / 2, 256], site[2], c.c6, {anchor: m === "rho" ? "end" : "middle"});
      var seq = function (y, a, mid, b, col) {   // a sequence in three pieces, the middle one boxed when mutated
        tag([197, y], a, c.c6, {anchor: "end", weight: 600}); tag([226, y], mid, bad ? c.c5 : c.c6, {weight: 700}); tag([255, y], b, col, {anchor: "start", weight: 600});
        if (bad) api.rect(203, y - 9, 46, 18, {rx: 4, stroke: c.c5, width: 1.4});
      };
      // the RNA: 5' end at left, laid out over the DNA it was copied from, entering the polymerase unless released
      var uLetters = m === "intrinsic" && !bad && (s === 2 || s === 3);
      var tail = done ? [[m === "intrinsic" ? 240 : x + 6, yR]] : uLetters ? [[x - 50, yR], [x - 38, 194]] : [[x - 50, yR], [x - 34, 199], [x + 20, 199]];
      var cut = euk && !bad && s >= 2 ? 190 : null, chew = euk && !bad ? [0, 0, 232, x - 50][s - 1] : 0;
      if (cut) {
        api.polyline([[14, yR], [cut - 4, yR]], {stroke: c.c3, width: 3});
        if (s < 4) api.polyline([[Math.max(cut + 4, chew), yR]].concat(tail), {stroke: c.c3, width: 3});
        if (chew) api.polyline([[cut + 4, yR], [chew, yR]], {stroke: c.c3, width: 2, dash: "2 4", opacity: 0.5});
      } else api.polyline([[14, yR]].concat(tail), {stroke: c.c3, width: 3});
      tag([12, yR - 14], "5′ RNA", c.c3, {anchor: "start", weight: 600});
      // the polymerase, on the DNA or dropped off it
      if (done) {
        var pxr = Math.min(x + 56, 356);
        api.line([x, yD + 20], [pxr - 20, 262], {color: c.muted, width: 1.4, arrow: true, dash: "4 3"});
        api.rect(pxr - 36, 264, 72, 34, {rx: 16, fill: c.muted, fillOpacity: 0.08, stroke: c.faint, width: 1.2});
        tag([pxr, 281], euk ? "Pol II off" : "RNA pol off", c.muted);
      } else {
        api.rect(x - 44, 162, 88, 80, {rx: 26, fill: c.muted, fillOpacity: 0.15, stroke: c.faint, width: 1.2});
        tag([x, 175], euk ? "Pol II" : "RNA pol", c.muted);
      }
      if (bad && s > 1) { api.arrow([x - 4, yR - 36], [x + 30, yR - 36], {color: c.c5, width: 2, halo: false}); tag([x - 10, yR - 36], "reads through", c.c5, {weight: 650, anchor: "end"}); }
      if (m === "intrinsic") {
        var arm2 = bad ? "CGCCCG" : "GCGGGC";
        if (s === 1) {   // the DNA being copied, and above it the RNA it becomes: the two arms that fold at step 2
          seq(280, "GCCCGC TTCG", arm2, "TTTTTTT", c.c6);
          var cw = 8.8, x0 = 130, py = 92, ac = bad ? c.c5 : c.c6, a1 = x0 + 2.5 * cw, a2 = x0 + 14.5 * cw;
          ("GCCCGC UUCG " + arm2 + " UUUUUUU").split("").forEach(function (ch, i) {
            if (ch !== " ") tag([x0 + i * cw, py], ch, i < 6 ? c.c6 : i >= 12 && i < 18 ? ac : c.c3, {weight: 700});
          });
          tag([x0 - 9, py], "5′", c.c3, {anchor: "end", weight: 600}); tag([x0 + 25 * cw + 9, py], "3′", c.c3, {anchor: "start", weight: 600});
          [0, 12].forEach(function (k) { api.line([x0 + k * cw - 4, py + 9], [x0 + (k + 5) * cw + 4, py + 9], {color: k ? ac : c.c6, width: 2}); });
          api.path("M " + a1 + " " + (py - 12) + " Q " + (a1 + a2) / 2 + " " + (py - 46) + " " + a2 + " " + (py - 12), {stroke: ac, width: 1.5, dash: bad ? "4 3" : null});
          tag([(a1 + a2) / 2, py - 40], bad ? "these arms can't pair" : "these arms will pair", ac, {weight: 650});
          tag([x0 + 22 * cw, py + 22], "U-tract", c.c3, {weight: 600});
        }
        if (bad && s > 1) seq(yR - 16, "GCCCGC UUCG", arm2, "UUUUUUU", c.c3);
        if (!bad && s >= 2) {   // the hairpin: arm 1 up the left, loop, arm 2 down the right
          for (var i = 0; i < 6; i++) {
            var y = yR - 12 - i * 12;
            tag([196, y], "GCCCGC"[i], c.c6, {weight: 700}); tag([214, y], arm2[5 - i], c.c6, {weight: 700});
            api.line([201, y], [209, y], {color: c.c6, width: 1.2, opacity: 0.7});
          }
          "UUCG".split("").forEach(function (b, j) { var a = Math.PI * (1 - j / 3); tag([205 + 15 * Math.cos(a), yR - 84 - 13 * Math.sin(a)], b, c.c3, {weight: 600}); });
          tag([180, yR - 60], "GC-rich hairpin", c.c6, {anchor: "end", weight: 650});
        }
        if (uLetters) {   // the U-tract held in the hybrid, rU·dA
          var hy = s === 3 ? 192 : 198;
          for (var k = 0; k < 7; k++) {
            tag([x - 32 + k * 8.6, hy], "U", c.c3, {weight: 700});
            api.line([x - 32 + k * 8.6, hy + 7], [x - 32 + k * 8.6, yD - 3], {color: c.c3, width: 1, dash: s === 3 ? "1 2" : null});
          }
          if (s === 3) tag([x + 50, yR + 12], "weak rU·dA", c.c3, {anchor: "start", weight: 650});
        }
        if (done) tag([244, yR], "UUUUUUU-OH 3′", c.c3, {anchor: "start", weight: 650});
      }
      if (m === "rho") {
        api.line([80, yR], [150, yR], {color: bad ? c.c5 : c.c4, width: 7, opacity: 0.5});
        tag([115, yR + 30], bad ? "rut mutated (G-rich)" : "rut site (C-rich)", bad ? c.c5 : c.c4, {weight: 600});
        var ring = function (at, faint) {
          for (var j = 0; j < 6; j++) { var a = j * Math.PI / 3; api.circle([at[0] + 11 * Math.cos(a), at[1] + 11 * Math.sin(a)], 6, {fill: c.c4, fillOpacity: faint ? 0.25 : 0.7, stroke: c.c4, width: 1}); }
          tag([at[0], at[1] - 28], "Rho", c.c4, {weight: 650});
        };
        var rx = bad ? 0 : [0, 115, 210, x - 62][s - 1];
        if (rx) ring([rx, yR], false);
        if (s === 3 && !bad) { api.arrow([130, yR - 44], [192, yR - 44], {color: c.c4, width: 2, halo: false}); tag([161, yR - 58], "5′→3′, ATP", c.c4); }
        if (bad && s >= 2) { ring([64, 72], true); tag([64, 100], "can't load", c.c5); }
      }
      if (euk) {
        api.line([130, yR], [160, yR], {color: bad ? c.c5 : c.c6, width: 7, opacity: 0.5});
        tag([145, yR + 16], bad ? "AAUAAG" : "AAUAAA", bad ? c.c5 : c.c6, {weight: 700});
        if (!bad && s === 2) {
          [[145, "CPSF"], [218, "CstF"]].forEach(function (f) { api.circle([f[0], yR - 22], 17, {fill: c.c4, fillOpacity: 0.3, stroke: c.c4, width: 1.4}); tag([f[0], yR - 22], f[1], c.c4, {weight: 650}); });
          api.line([cut, yR - 12], [cut, yR + 12], {color: c.c5, width: 2}); tag([cut, yR + 26], "cut", c.c5, {weight: 650});
        }
        if (!bad && s >= 3) {
          api.path("M " + (cut - 4) + " " + yR + " q 14 -6 18 -30 t 22 -40", {stroke: c.c3, width: 3});
          tag([cut + 34, yR - 84], "poly(A) tail, ~200 A", c.c3, {weight: 650});
          tag([90, yR - 18], "mRNA", c.c3, {weight: 650});
          var xr2 = chew;
          api.path("M " + (xr2 + 12) + " " + (yR - 9) + " A 12 12 0 1 0 " + (xr2 + 12) + " " + (yR + 9) + " L " + xr2 + " " + yR + " Z", {fill: c.c4, fillOpacity: 0.7, stroke: c.c4, width: 1});
          tag([xr2, yR - 22], "Xrn2", c.c4, {weight: 650});
        }
      }
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
