// How a eukaryotic pre-mRNA gets its 3' end and poly(A) tail. Pol II transcribes past the polyadenylation signal AAUAAA
// in the 3' UTR and a GU-rich downstream element. CPSF binds AAUAAA and CstF binds the GU-rich element; CPSF73 cuts the
// RNA 10-30 nt past the signal (usually after a CA), releasing a downstream piece. Poly(A) polymerase then adds A's to the
// new 3'-OH from ATP with no template, and nuclear PABPN1 coats the tail, makes PAP processive and stops it near 250 A
// (mammals). Xrn2 degrades the downstream RNA and catches Pol II, ending transcription (torpedo model).
// AUUAAA is the commonest natural variant and is processed less efficiently; most single-base changes, such as AAGAAA,
// all but abolish recognition: no cut, no tail, read-through, and the RNA is not exported but degraded in the nucleus.
// d counts nucleotides from the end of the hexamer to the cut; the length shown runs from the signal's first A to the
// 3' end: 6 + d + n_A.
(function () {
  var SIG = {AAUAAA: 2, AUUAAA: 1, AAGAAA: 0};                    // 2 = strong, 1 = weaker, 0 = not recognized
  Viz.register("three-prime-poly-a-tail-addition", {
    title: "Poly(A) tail: cleavage and polyadenylation",
    subject: "biology",
    shows: "Step through 3′ end processing: CPSF finds AAUAAA, the RNA is cut 10 to 30 nt downstream, poly(A) polymerase adds A's with no template, and Pol II is released; change the signal, the cut distance and the tail length",
    params: {
      signal: {kind: "enum", values: ["AAUAAA", "AUUAAA", "AAGAAA"], default: "AAUAAA", label: "\\text{signal}",
        names: {AAUAAA: "AAUAAA", AUUAAA: "AUUAAA (weak)", AAGAAA: "AAGAAA (mutant)"}},
      d: {kind: "integer", default: 20, min: 10, max: 30, label: "d\\ (\\text{nt})"},
      nA: {kind: "integer", default: 200, min: 20, max: 250, step: 10, label: "n_A"}
    },
    steps: ["Pol II passes the signal", "CPSF and CstF bind", "cleavage", "poly(A) polymerase adds A's", "tail coated, Pol II released"],
    stepMs: 1800,
    formula: function (v) {
      if (!SIG[v.signal]) return "\\text{AAGAAA: CPSF cannot bind}\\newline\\Rightarrow\\text{no cut, no tail, no 3′ end}";
      return "\\ell=6+d+n_A\\newline\\ \\ =6+" + v.d + "+" + v.nA + "=" + (6 + v.d + v.nA) + "\\ \\text{nt}";
    },
    status: function (v) {
      var s = v.step || 1, k = SIG[v.signal];
      if (s === 1) return "Pol II transcribes past " + (k === 2 ? "the <b>AAUAAA</b> signal" : k ? "<b>AUUAAA</b>, a common but weaker version of the signal," : "<b>AAGAAA</b>, a broken signal,") + " in the 3′ UTR and a GU-rich stretch beyond it.";
      if (s === 2) return k === 2 ? "<b>CPSF</b> grabs AAUAAA and <b>CstF</b> grabs the GU-rich element, marking the cut site between them."
        : k ? "CPSF binds AUUAAA <b>less tightly</b>, so the cutting complex assembles less often and fewer transcripts are processed." : "CPSF barely recognizes AAGAAA, so the cutting complex <b>does not assemble</b>.";
      if (!k) return s === 3 ? "<b>No cut</b>: the RNA gets no new 3′ end and Pol II reads on past where it should stop."
        : s === 4 ? "With no 3′ end to extend, <b>no tail</b> is added." : "An uncut, tailless transcript is <b>not exported</b>: it is degraded in the nucleus.";
      if (s === 3) return "CPSF73 cuts the RNA <b>" + v.d + " nt</b> past the signal (usually after a CA), freeing a new 3′ end and a downstream piece.";
      if (s === 4) return "Poly(A) polymerase adds <b>" + v.nA + " A's</b> to the new 3′ end from ATP, with <b>no template</b>: the tail is not written in the gene.";
      return "PABPN1 coats the tail and stops it near 250 A's, while Xrn2 chews up the downstream piece and knocks <b>Pol II</b> off the DNA, ending transcription.";
    },
    examples: [
      {name: "cut 10 nt past the signal", values: {d: 10, nA: 20, step: 3}},
      {name: "full tail, Pol II released", values: {d: 30, nA: 250, step: 5}},
      {name: "weaker signal", values: {signal: "AUUAAA", step: 2}},
      {name: "mutant signal: no cut", values: {signal: "AAGAAA", step: 3}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, k = SIG[v.signal], ok = k > 0, cut = ok && s >= 3;
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var RY = 104, SX = 108, SW = 54, CX = SX + SW + 3 * v.d, GX = CX + 16, tailPx = v.nA * 0.4;
      // DNA and RNA polymerase II
      api.line([10, 52], [390, 52], {color: c.muted, width: 3, opacity: 0.6}); T([12, 40], "DNA", c.muted, {weight: 500});
      var polX = ok ? [CX + 70, CX + 86, CX + 96, CX + 108, 372][s - 1] : [CX + 70, CX + 86, CX + 100, 360, 372][s - 1];
      var released = ok && s === 5, pol = released ? [polX, 22] : [Math.min(polX, 372), 58];
      api.rect(pol[0] - 22, pol[1] - 12, 44, 24, {fill: c.c2, fillOpacity: 0.3, stroke: c.c2, width: 1.6, rx: 12});
      T([pol[0], pol[1] + 0.5], "Pol II", c.c2, {anchor: "middle", size: 12});
      if (released) T([pol[0] - 28, 22], "released", c.c2, {anchor: "end", weight: 500});
      // the RNA: 5' part on the left, signal, cut site, GU-rich element, and the stretch still in Pol II
      var endX = cut ? CX : Math.min(pol[0] - 10, 388);
      api.line([10, RY], [endX, RY], {color: c.c1, width: 4});
      if (!cut) api.path("M " + endX + " " + RY + " Q " + (endX + 6) + " " + (RY - 30) + " " + (pol[0] - 6) + " " + (pol[1] + 12), {stroke: c.c1, width: 3});
      T([12, RY + 16], "5′ … 3′ UTR", c.c1, {weight: 500});
      api.rect(SX, RY - 10, SW, 20, {fill: c.c4, fillOpacity: ok ? 0.35 : 0.12, stroke: ok ? c.c4 : c.c5, width: 1.4, rx: 4});
      T([SX + SW / 2, RY + 0.5], v.signal, ok ? c.ink : c.c5, {anchor: "middle", size: 12, weight: 700});
      // GU-rich downstream element (on the downstream piece once cut)
      var dsY = cut ? 156 : RY, dsX = cut ? GX + 30 : GX;
      if (cut) { api.line([dsX - 16, dsY], [Math.min(dsX + 70, 380), dsY], {color: c.c1, width: 3, opacity: s === 5 ? 0.35 : 0.8, dash: s === 5 ? "3 4" : null}); }
      api.rect(dsX, dsY - 9, 40, 18, {fill: c.c6, fillOpacity: cut && s === 5 ? 0.12 : 0.3, stroke: c.c6, width: 1.2, rx: 4});
      T([dsX + 20, dsY + 0.5], "GU", c.c6, {anchor: "middle", size: 12, weight: 700});
      if (cut) T([dsX + 20, dsY + 18], s === 5 ? "Xrn2 degrades it" : "downstream piece", c.c6, {anchor: "middle", weight: 500});
      // the cut site, d nt past the signal
      if (s <= 3 || !ok) api.line([CX, RY + 12], [CX, RY + 26], {color: cut ? c.c5 : c.faint, width: 1.6});
      api.line([SX + SW, RY + 14], [CX - 1, RY + 14], {color: c.muted, width: 1.2, arrow: true});
      T([CX - 4, RY + 26], "d = " + v.d + " nt" + (s < 3 || !ok ? " to the cut" : ""), ok ? c.muted : c.c5, {anchor: "end", weight: 500});
      if (s >= 2 && ok) {
        var weak = k === 1, dash = weak ? "4 3" : null;
        if (!cut || s === 3) {
          api.rect(SX - 6, RY - 34, SW + 12, 22, {fill: c.c3, fillOpacity: weak ? 0.12 : 0.3, stroke: c.c3, width: 1.4, dash: dash, rx: 10});
          T([SX + SW / 2, RY - 23], "CPSF", c.c3, {anchor: "middle"});
        }
        if (s === 2) { api.rect(GX - 4, RY + 12, 48, 22, {fill: c.c3, fillOpacity: weak ? 0.12 : 0.3, stroke: c.c3, width: 1.4, dash: dash, rx: 10}); T([GX + 20, RY + 23], "CstF", c.c3, {anchor: "middle"}); }
      }
      if (s >= 2 && !ok) T([SX + SW / 2, RY - 22], "CPSF can't bind", c.c5, {anchor: "middle"});
      if (cut && s === 3) T([CX + 4, RY - 16], "cut by CPSF73", c.c5, {anchor: "start"});
      // the tail
      if (cut && s >= 4) {
        api.rect(CX, RY - 4, tailPx, 8, {fill: c.c3, fillOpacity: 0.85, rx: 4});
        if (s === 4) { api.circle([CX + tailPx + 9, RY], 9, {fill: c.c3, fillOpacity: 0.35, stroke: c.c3, width: 1.4}); T([CX + tailPx + 21, RY], "PAP", c.c3); }
        if (s === 5) { for (var b = CX + 5; b < CX + tailPx - 1; b += 11) api.circle([b, RY], 4.5, {fill: c.c4, fillOpacity: 0.75}); T([CX + tailPx, RY - 16], "PABPN1", c.c4, {anchor: "end"}); }
        T([CX + Math.max(tailPx, 50) / 2, RY + 18], "A × " + v.nA, c.c3, {anchor: "middle", weight: 500});
      }
      // ---- the processed 3' end, to scale (1 nt = 1.1 px): signal, spacer, tail ----
      var by = 232, bx = 24, px = 1.1, done = cut && s >= 4;
      T([bx, by - 26], ok ? "signal's first A to the 3′ end, to scale" + (done ? "" : " (to come)") : "no processed 3′ end", ok ? c.muted : c.c5, {weight: 500});
      if (ok) {
        var op = done ? 0.85 : 0.25, x = bx;
        api.rect(x, by - 7, 6 * px, 14, {fill: c.c4, fillOpacity: op, rx: 1}); x += 6 * px;
        api.rect(x, by - 7, v.d * px, 14, {fill: c.c1, fillOpacity: op, rx: 1}); x += v.d * px;
        api.rect(x, by - 7, v.nA * px, 14, {fill: c.c3, fillOpacity: op, rx: 2});
        T([bx, by + 22], "signal 6 + d " + v.d, c.c1, {weight: 500});
        var aEnd = x + v.nA * px, aTxt = "+ " + v.nA + " A = " + (6 + v.d + v.nA) + " nt";
        if (aEnd + 118 < 396) T([aEnd + 8, by], aTxt, c.c3, {weight: 500}); else T([aEnd, by + 22], aTxt, c.c3, {anchor: "end", weight: 500});
      } else {
        api.line([bx, by], [380, by], {color: c.c5, width: 2, dash: "5 4", opacity: 0.6});
        T([200, by + 22], "uncut RNA: kept in the nucleus and degraded", c.c5, {anchor: "middle", weight: 500});
      }
      T([bx, 290], "tail added after cutting, with no DNA template", c.muted, {weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
