// A bacterial promoter and how transcription starts. The σ70 subunit of RNA polymerase reads two hexamers on the
// non-template strand: the -35 box (consensus TTGACA) and the -10 box (TATAAT), ideally 17 bp apart. The closer both are
// to consensus, the tighter σ binds and the more often the promoter fires; each base pair of spacing away from 17 turns
// one box about 34° around the helix (10.5 bp per turn) relative to the other. Then: closed complex, DNA melts around
// -11 to +2 (open complex), RNA starts at +1 (short, often aborted tries), and after ~10 nt σ lets go as the core moves on.
(function () {
  var C35 = "TTGACA", C10 = "TATAAT";
  var ORD35 = [5, 3, 4, 0, 2, 1], ALT35 = "CATGTG", ORD10 = [4, 2, 1, 3, 0, 5], ALT10 = "CGCGCG";   // which base goes off-consensus first, and to what
  function box(cons, ord, alt, m) {
    var out = cons.split(""), bad = ord.slice(0, 6 - m);
    bad.forEach(function (i) { out[i] = alt[i]; });
    return {seq: out.join(""), bad: bad};
  }
  function model(v) {
    var t = v.m35 + v.m10, off = Math.abs(v.sp - 17);
    var deg = Math.round(off * 34.3);
    var fit = off >= 2 && t <= 8 ? "far from consensus and <b>" + deg + "° out of line</b> on the helix, so σ barely binds" :
      off >= 2 ? "good boxes, but <b>" + deg + "° out of line</b> on the helix, so σ grips both poorly and binds less often" :
      t <= 6 ? "<b>far from consensus</b>, so σ binds rarely and the promoter is weak" :
      t >= 11 && !off ? "<b>close to ideal</b>, so σ binds tightly and transcription starts often" :
      "<b>middling</b>, so σ binds, but less often than at consensus" + (off ? " (one extra or missing bp twists the boxes " + deg + "°)" : "");
    return {b35: box(C35, ORD35, ALT35, v.m35), b10: box(C10, ORD10, ALT10, v.m10), t: t, off: off, deg: deg, fit: fit};
  }

  Viz.register("promoter-rna-polymerase-initiation", {
    title: "Promoter: how RNA polymerase starts",
    subject: "biology",
    shows: "Set how well the -35 and -10 boxes match consensus and the spacer between them, then step through binding, DNA opening, the first RNA and σ letting go",
    params: {
      m35: {kind: "integer", default: 5, min: 0, max: 6, label: "m_{-35}"},
      m10: {kind: "integer", default: 6, min: 0, max: 6, label: "m_{-10}"},
      sp: {kind: "integer", default: 17, min: 15, max: 19, label: "\\text{spacer}"}
    },
    steps: ["σ binds the -35 and -10 boxes", "DNA opens around -10", "RNA starts at +1", "σ lets go; elongation"],
    stepMs: 1700,
    formula: function (v) {
      var m = model(v);
      return "\\begin{array}{l}\\text{consensus match}=" + v.m35 + "+" + v.m10 + "=" + m.t + "/12\\\\ \\text{spacer}=" + v.sp + "\\text{ bp}" + (m.off ? "\\ (" + (v.sp > 17 ? "+" : "-") + m.off + "\\text{ from }17)" : "\\ (\\text{ideal})") + "\\end{array}";
    },
    status: function (v) {
      var m = model(v), s = v.step || 1;
      if (s === 1) return "σ reads the −35 and −10 boxes, " + m.t + " of 12 consensus bases, " + v.sp + " bp apart" + (m.off ? "" : " (ideal)") + ": " + m.fit + ".";
      if (s === 2) return "The open complex: polymerase melts about 13 bp from −11 to +2, the AT-rich −10 box opening first, so the template strand is exposed.";
      if (s === 3) return "RNA starts at <b>+1</b>, copying the template strand 5′ → 3′; the first short RNAs are often released and restarted.";
      return "After about 10 nucleotides <b>σ lets go</b> and the core enzyme leaves the promoter, free for the next polymerase to bind.";
    },
    examples: [
      {name: "weakest: no matches, worst spacer", values: {m35: 0, m10: 0, sp: 15}},
      {name: "perfect consensus", values: {m35: 6, m10: 6, sp: 17, step: 2}},
      {name: "good boxes, bad spacing", values: {m35: 6, m10: 6, sp: 19, step: 1}}
    ],
    size: [400, 252],
    draw: function (api, v) {
      var c = api.color, m = model(v), s = v.step || 1, X = function (p) { return 296 + 5.4 * p; }, yT = 136, yB = 148;
      var a35 = -13 - v.sp - 5, a10 = -12;   // first position of each box
      // RNA polymerase: core (blue) with σ (purple) on the promoter; at step 4 the core has moved on and σ is free
      var core = s < 4 ? [X(-52), X(18)] : [X(-1), 394], bub = s < 4 ? [-11, 2] : [5, 15];
      api.rect(core[0], 70, core[1] - core[0], 92, {rx: 34, fill: c.c2, fillOpacity: 0.16, stroke: c.c2, width: 1.4});
      if (s < 4) api.label([X(5), 86], "RNA polymerase", {color: c.c2, size: 12, weight: 650, anchor: "middle"});
      var sig = s < 4 ? [X(a35) - 6, 102, X(a10 + 6) - X(a35) + 12, 22] : [24, 16, 64, 22];
      api.rect(sig[0], sig[1], sig[2], sig[3], {rx: 11, fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 1.6});
      api.label([sig[0] + sig[2] / 2, sig[1] + 11], s < 4 ? "σ" : "σ released", {color: c.ink, size: 12.5, weight: 700, anchor: "middle"});
      if (s < 4) {   // contacts: thicker for a better match, dashed when the spacing twists the -35 box away
        [[a35 + 3, v.m35, m.off > 0], [a10 + 3, v.m10, false]].forEach(function (q) {
          api.line([X(q[0]), 124], [X(q[0]), yT - 5], {color: c.c6, width: 1 + q[1] * 0.6, dash: q[2] || q[1] < 3 ? "3 3" : null});
        });
        if (m.off) api.label([X(a35) - 8, 94], "twisted " + m.deg + "°", {color: c.c5, size: 12, weight: 650, anchor: "end"});
      }
      // DNA: top = non-template (coding) strand 5'->3', bottom = template; a bubble where it is open
      var open = s >= 2, top = [], bot = [];
      for (var p = -53; p <= 17; p += 0.5) {
        var bump = open && p > bub[0] - 1 && p < bub[1] + 1 ? Math.sin(Math.PI * (p - bub[0] + 1) / (bub[1] - bub[0] + 2)) * 12 : 0;
        top.push([X(p), yT - bump]); bot.push([X(p), yB + bump]);
      }
      api.polyline(top, {stroke: c.ink, width: 2.4}); api.polyline(bot, {stroke: c.muted, width: 2.4});
      api.label([X(-53) - 4, yT - 10], "5′", {color: c.ink, size: 12}); api.label([X(-53) - 4, yB + 10], "3′", {color: c.muted, size: 12});
      api.label([X(17) + 6, yB + 12], "template", {color: c.muted, size: 12, anchor: "end"});
      // the two boxes, their sequences (mismatches in red) and the spacer
      [[a35, m.b35, "−35", v.m35], [a10, m.b10, "−10", v.m10]].forEach(function (q) {
        var x0 = X(q[0]), w = 6 * 5.4, cx = x0 + w / 2;
        api.rect(x0, yT - 4, w, yB - yT + 8, {rx: 3, fill: c.c4, fillOpacity: 0.55});
        q[1].seq.split("").forEach(function (b, i) {
          api.label([cx + (i - 2.5) * 10.5, 190], b, {color: q[1].bad.indexOf(i) >= 0 ? c.c5 : c.c4, size: 13, weight: 700, anchor: "middle"});
        });
        api.label([cx, 208], q[2] + " box " + q[3] + "/6", {color: c.c4, size: 12, anchor: "middle"});
      });
      var sp0 = X(a35 + 6), sp1 = X(a10);
      api.line([sp0 + 2, 166], [sp1 - 2, 166], {color: m.off ? c.c5 : c.muted, width: 1.3});
      api.line([sp0 + 2, 162], [sp0 + 2, 170], {color: m.off ? c.c5 : c.muted, width: 1.3}); api.line([sp1 - 2, 162], [sp1 - 2, 170], {color: m.off ? c.c5 : c.muted, width: 1.3});
      api.label([(sp0 + sp1) / 2, 178], v.sp + " bp", {color: m.off ? c.c5 : c.ink, size: 12, weight: 650, anchor: "middle"});
      // +1 and the RNA
      api.line([X(1), yB + 14], [X(1), yB + 22], {color: c.c1, width: 1.5});
      api.label([X(1), 180], "+1", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      if (s === 2) api.label([X(-4.5), 58], "open: −11 to +2", {color: c.ink, size: 12, anchor: "middle"});
      if (s === 3) { api.line([X(1), yB + 2], [X(7), yB + 2], {color: c.c1, width: 4}); api.label([X(10), 58], "first RNA", {color: c.c1, size: 12, weight: 650, anchor: "middle"}); api.line([X(8), 64], [X(5), yB - 6], {color: c.c1, width: 1.2, arrow: true}); }
      if (s === 4) {
        api.polyline([[X(18), yB + 2], [X(12), yB + 2], [X(8), 116], [X(2), 86], [X(-6), 62], [X(-16), 50]], {stroke: c.c1, width: 3});
        api.label([X(-16) - 6, 50], "5′ RNA", {color: c.c1, size: 12, weight: 650, anchor: "end"});
        api.arrow([300, 40], [350, 40], {color: c.c2, width: 2.5, halo: false, label: "core polymerase moves on", labelAt: "mid", labelOffset: [0, -14], labelSize: 12});
      }
      api.label([200, 238], "consensus  TTGACA · 17 bp · TATAAT", {color: c.muted, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
