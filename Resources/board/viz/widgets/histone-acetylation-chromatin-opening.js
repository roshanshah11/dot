// Histone acetylation opens chromatin. Top: a stretch of chromatin with a gene. Bottom: one histone H4 N-terminal tail,
// residues 1-16 (SGRGKGGKGLGKGGAK), lying on DNA. Its positive side chains are R3 and the four lysines K5, K8, K12 and
// K16, so it carries +5 and clings to the negatively charged phosphate backbone. An activator recruits a histone
// acetyltransferase (HAT, such as p300/CBP), which moves acetyl groups from acetyl-CoA onto the lysine epsilon-amino
// groups: Lys-NH3+ + acetyl-CoA -> Lys-NH-COCH3 + CoA-SH + H+. Each acetyl removes one positive charge (+5 -> +1),
// the tails let go of DNA, nucleosomes loosen, bromodomain readers (BRD4) bind acetyl-lysine and RNA polymerase II
// transcribes. Histone deacetylases (HDACs) hydrolyse the marks back (Lys-NH-COCH3 + H2O -> Lys-NH3+ + acetate) and
// the chromatin closes; an HDAC inhibitor such as vorinostat blocks that step, so the marks and the gene stay on.
(function () {
  var TAIL = "SGRGKGGKGLGKGGAK", POS = {2: "R3", 4: "K5", 7: "K8", 11: "K12", 15: "K16"};
  var SAY = [
    "Closed chromatin: each H4 tail carries <b>+5</b> (R3 and lysines K5, K8, K12, K16), so it clings to the negative DNA and the nucleosomes pack tightly.",
    "An activator finds its site and recruits a <b>histone acetyltransferase</b> (HAT), which brings acetyl-CoA.",
    "The HAT puts an <b>acetyl group</b> on K5, K8, K12 and K16: each one cancels a positive charge, so the tail drops from +5 to <b>+1</b> and lets go of the DNA.",
    "Loosened nucleosomes slide apart, a bromodomain protein <b>reads</b> the acetyl marks and RNA polymerase II <b>transcribes</b> the gene."
  ];

  Viz.register("histone-acetylation-chromatin-opening", {
    title: "Histone acetylation opens chromatin",
    subject: "biology",
    shows: "Step through it: positive lysines on the histone tails hold DNA tight, acetyl groups from a HAT cancel those charges so the chromatin opens and the gene is read, and HDACs remove them again unless an HDAC inhibitor blocks them",
    params: {
      hdaci: {kind: "boolean", default: false, label: "\\text{HDACi}", on: "HDAC inhibitor", off: "none"}
    },
    // short labels (one line in the bar); step 5 is named so it stays true with the inhibitor on
    steps: ["closed chromatin", "HAT recruited", "tail acetylated", "chromatin opens", "HDAC step"],
    stepMs: 1900,
    formula: function (v) {
      var s = v.step || 1;
      if (s === 1) return "\\text{H4 tail}:\\ R_3,K_5,K_8,K_{12},K_{16}\\ \\Rightarrow\\ \\text{charge}\\ {+5}";
      if (s === 2) return "\\text{activator}\\to\\text{HAT (p300/CBP)}+\\text{acetyl-CoA}";
      if (s === 3) return "\\text{Lys-NH}_3^{+}+\\text{acetyl-CoA}\\xrightarrow{\\text{HAT}}\\newline\\text{Lys-NHCOCH}_3+\\text{CoA-SH}+\\text{H}^{+}";
      if (s === 4) return "\\text{charge}\\ {+5}\\to{+1}:\\ \\text{tails release DNA}\\newline\\text{BRD4 reads K-ac, Pol II transcribes}";
      if (v.hdaci) return "\\text{vorinostat}\\dashv\\text{HDAC}:\\ \\text{marks stay},\\ {+1}";
      return "\\text{Lys-NHCOCH}_3+\\text{H}_2\\text{O}\\xrightarrow{\\text{HDAC}}\\newline\\text{Lys-NH}_3^{+}+\\text{acetate}\\quad({+1}\\to{+5})";
    },
    status: function (v) {
      var s = v.step || 1;
      if (s === 5) return v.hdaci ? "The HDAC inhibitor (vorinostat) jams the deacetylase, so the tails <b>stay acetylated</b> at +1 and the gene stays on." :
        "An <b>HDAC</b> hydrolyses the acetyl groups off as acetate: the tails return to +5, grip the DNA and the gene <b>falls silent</b>.";
      return SAY[s - 1] + (s === 1 && v.hdaci ? " An HDAC inhibitor is waiting to stop the eraser later." : "");
    },
    examples: [
      {name: "closed", values: {step: 1}},
      {name: "acetylated tail (+1)", values: {step: 3}},
      {name: "gene on", values: {step: 4}},
      {name: "HDAC closes it again", values: {step: 5, hdaci: false}},
      {name: "HDAC inhibitor keeps it open", values: {step: 5, hdaci: true}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, ac = s === 3 || s === 4 || (s === 5 && v.hdaci), open = s === 4 || (s === 5 && v.hdaci);
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600, raw: true}, o || {})); };
      // ---- chromatin view
      var Y = 84, nucs = [];
      if (open) nucs = [[20, Y], [74, Y], [128, Y], [182, Y]];
      else for (var i = 0; i < (s === 3 ? 10 : 14); i++) nucs.push(s === 3 ? [24 + i * 38, Y + (i % 2 ? 6 : -6)] : [24 + i * 26, Y + (i % 2 ? 12 : -12)]);
      api.polyline([[0, nucs[0][1]]].concat(nucs, open ? [[400, Y]] : [[400, nucs[nucs.length - 1][1]]]), {stroke: c.c2, width: 2.5});
      nucs.forEach(function (n) {
        api.circle(n, 15, {fill: c.card, stroke: c.c2, width: 3});
        api.circle(n, 11, {fill: c.c6, fillOpacity: 0.6});
        if (ac) [-5, 5].forEach(function (d) { api.circle([n[0] + d, n[1] - 18], 3, {fill: c.c3}); });
      });
      L([8, 122], open ? "open: nucleosomes spread out" : s === 3 ? "loosening" : "closed: nucleosomes packed tight", c.c6, {weight: 500});
      // gene with its promoter, the activator and the HAT
      var gy = open ? Y - 6 : 56;
      api.path("M 262 " + gy + " L 262 " + (gy - 18) + " L 284 " + (gy - 18), {stroke: open ? c.ink : c.muted, width: 2, arrow: true});
      L([292, gy - 18], open ? "gene on" : "gene silent", open ? c.ink : c.muted);
      if (s >= 2 && !(s === 5 && !v.hdaci)) {
        var ay = open ? Y - 7 : 40;
        if (!open) api.line([245, ay + 12], [245, 62], {color: c.ink, width: 1.5});
        api.rect(236, ay, 18, 14, {fill: c.ink, fillOpacity: 0.8, rx: 4});
        L([open ? 245 : 214, open ? Y + 20 : ay + 7], "activator", c.ink, {anchor: open ? "middle" : "end", weight: 500});
      }
      if (s === 2 || s === 3) { api.circle([268, 18], 12, {fill: c.c4, fillOpacity: 0.35, stroke: c.c4, width: 1.6}); L([268, 18], "HAT", c.c4, {anchor: "middle", weight: 700, size: 12}); api.line([258, 26], [250, 38], {color: c.c4, width: 1.5}); }
      if (open) {
        api.path("M 330 " + (Y - 16) + " q 18 0 18 16 q 0 16 -18 16 q -18 0 -18 -16 q 0 -16 18 -16 Z", {fill: c.ink, fillOpacity: 0.25, stroke: c.ink, width: 1.5});
        L([330, Y], "Pol II", c.ink, {anchor: "middle", weight: 700, size: 12});
        api.path("M 346 " + (Y - 10) + " q 12 -14 24 -6 t 22 -8", {stroke: c.ink, width: 1.6, dash: "4 3"});
        L([392, Y + 30], "mRNA", c.ink, {anchor: "end", weight: 500});
        api.rect(119, 54, 18, 10, {fill: c.muted, fillOpacity: 0.9, rx: 3});
        L([141, 56], "reader", c.muted, {weight: 500});
      }
      // the eraser
      var hd = s === 5 && !v.hdaci ? [118, 30] : [40, 30];
      api.circle(hd, 12, {fill: c.c1, fillOpacity: 0.35, stroke: c.c1, width: 1.6});
      L(hd, "HD", c.c1, {anchor: "middle", weight: 700, size: 12});
      L([hd[0] + 17, hd[1]], v.hdaci ? "HDAC + inhibitor" : s === 5 ? "HDAC at work" : "HDAC", c.c1, {weight: 500});
      if (v.hdaci) {                          // the inhibitor: a red ring and bar across the HDAC badge
        api.circle(hd, 15, {stroke: c.c5, width: 2.2});
        api.line([hd[0] - 10.6, hd[1] + 10.6], [hd[0] + 10.6, hd[1] - 10.6], {color: c.c5, width: 2.6});
      }
      // ---- one H4 tail on DNA
      api.line([0, 146], [400, 146], {color: c.faint, width: 1, dash: "2 4"});
      L([8, 162], "one H4 tail, residues 1–16", c.muted, {weight: 500});
      L([392, 162], "net charge +" + (ac ? 1 : 5), ac ? c.c3 : c.c5, {anchor: "end", size: 13, weight: 700});
      var DY = 274;
      api.line([40, DY], [392, DY], {color: c.c2, width: 3});
      for (var m = 52; m < 392; m += 21) L([m, DY + 13], "−", c.c2, {anchor: "middle", size: 13, weight: 700});
      L([4, DY + 13], "DNA", c.c2, {weight: 500});
      api.circle([24, 238], 18, {fill: c.c6, fillOpacity: 0.55, stroke: c.c6, width: 1});
      var ty = ac ? 206 : 248, pts = [[40, 236]];
      for (var j = 0; j < 16; j++) pts.push([52 + j * 21, ty]);
      api.polyline(pts, {stroke: c.c6, width: 2});
      for (j = 0; j < 16; j++) {
        var p = [52 + j * 21, ty], lab = POS[j], isK = TAIL[j] === "K";
        if (!lab) { api.circle(p, 3, {fill: c.c6}); continue; }
        if (isK && ac) {
          api.circle(p, 7, {fill: c.card, stroke: c.c3, width: 2});
          api.line([p[0], p[1] - 7], [p[0], p[1] - 18], {color: c.c3, width: 1.6});
          L([p[0], p[1] - 25], "Ac", c.c3, {anchor: "middle"});
          L([p[0], p[1] + 17], lab, c.muted, {anchor: "middle", weight: 500});
        } else {
          api.circle(p, 8, {fill: c.c5, fillOpacity: 0.85});
          L([p[0], p[1] + 0.5], "+", c.ink, {anchor: "middle", size: 13, weight: 800});
          L([p[0], p[1] - 17], lab, c.muted, {anchor: "middle", weight: 500});
          if (!ac || !isK) api.line([p[0], p[1] + 9], [p[0], DY - 5], {color: c.c5, width: 1.2, dash: "2 3"});
        }
      }
      // who is acting on the tail at this step
      if (s === 2) { api.circle([300, 206], 13, {fill: c.c4, fillOpacity: 0.35, stroke: c.c4, width: 1.6}); L([300, 206], "HAT", c.c4, {anchor: "middle", weight: 700}); L([318, 206], "+ acetyl-CoA", c.c4, {weight: 500}); }
      if (s === 3) L([392, 250], "CoA-SH leaves", c.c4, {anchor: "end", weight: 500});
      if (s === 4) L([392, 250], "a bromodomain reads the Ac marks", c.muted, {anchor: "end", weight: 500});
      if (s === 5 && !v.hdaci) { api.circle([300, 204], 13, {fill: c.c1, fillOpacity: 0.35, stroke: c.c1, width: 1.6}); L([300, 204], "HD", c.c1, {anchor: "middle", weight: 700}); L([318, 204], "→ acetate", c.c1, {weight: 500}); }
      if (s === 5 && v.hdaci) {               // the HDAC reaches for the tail and is stopped: a red inhibition bar
        api.circle([178, 252], 12, {fill: c.c1, fillOpacity: 0.35, stroke: c.c1, width: 1.6}); L([178, 252], "HD", c.c1, {anchor: "middle", weight: 700});
        api.line([178, 239], [178, 229], {color: c.c5, width: 2.6});
        api.line([166, 229], [190, 229], {color: c.c5, width: 3.2});
        L([198, 252], "HDAC blocked: marks stay", c.c5, {weight: 600});
      }
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
