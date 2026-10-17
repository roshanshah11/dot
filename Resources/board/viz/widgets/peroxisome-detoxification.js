// What a peroxisome does with toxic molecules, counted one molecule at a time. Oxidases (acyl-CoA oxidase for very long
// fatty acids, D-amino acid oxidase, and others) take two H from a substrate and hand them to O2, making hydrogen
// peroxide: RH2 + O2 -> R + H2O2. Catalase, the peroxisome's most abundant enzyme, then uses that H2O2 in one of two
// ways: peroxidatic, oxidizing a small toxin such as ethanol (H2O2 + CH3CH2OH -> CH3CHO + 2 H2O; in the liver this is a
// minor route for alcohol beside alcohol dehydrogenase), or catalatic, splitting H2O2 two at a time
// (2 H2O2 -> 2 H2O + O2), so the oxidant never reaches the cytosol. In this count catalase spends H2O2 on ethanol first,
// a simplification: the catalase route for ethanol is limited by the H2O2 supply, and what ethanol does not use is split.
// Every count follows from those three balanced equations.
(function () {
  function tally(v) {
    var k = Math.min(v.n, v.e), left = v.n - k, p = Math.floor(left / 2);
    return {k: k, left: left, p: p, odd: left - 2 * p};
  }
  function co(x, t) { return (x === 1 ? "" : x + "\\,") + "\\mathrm{" + t + "}"; }   // species upright, not math italic
  Viz.register("peroxisome-detoxification", {
    title: "Peroxisome detoxification",
    subject: "biology",
    shows: "Step through a peroxisome: oxidases strip hydrogen from toxic substrates onto O₂ and make H₂O₂, then catalase spends that H₂O₂ oxidizing ethanol and splits the rest into water and oxygen before it can harm the cell",
    params: {
      n: {kind: "integer", default: 6, min: 1, max: 10, label: "\\mathrm{RH_2}"},
      e: {kind: "integer", default: 2, min: 0, max: 10, label: "\\text{ethanol}"}
    },
    steps: ["oxidases make H₂O₂", "catalase oxidizes ethanol", "catalase splits the rest"],
    stepMs: 1800,
    formula: function (v) {
      var t = tally(v), s = v.step || 1;
      if (s === 1) return co(v.n, "RH_2") + "+" + co(v.n, "O_2") + "\\to " + co(v.n, "R") + "+" + co(v.n, "H_2O_2");
      if (s === 2) return t.k ? co(t.k, "H_2O_2") + "+" + co(t.k, "C_2H_5OH") + "\\to " + co(t.k, "CH_3CHO") + "+" + co(2 * t.k, "H_2O") : "\\text{no ethanol: no }\\mathrm{H_2O_2}\\text{ used}";
      if (!t.p) return "\\text{nothing to split}" + (t.odd ? "\\ (1\\,\\mathrm{H_2O_2}\\text{ waits})" : "");
      return co(2 * t.p, "H_2O_2") + "\\to " + co(2 * t.p, "H_2O") + "+" + co(t.p, "O_2") + (t.odd ? "\\newline\\text{1 }\\mathrm{H_2O_2}\\text{ waits for a partner}" : "");
    },
    status: function (v) {
      var t = tally(v), s = v.step || 1, w = function (x, one, many) { return x + " " + (x === 1 ? one : many); };
      if (s === 1) return "Oxidases strip two H from each of <b>" + v.n + "</b> substrate molecule" + (v.n > 1 ? "s" : "") + " and pass them to O₂, making <b>" + w(v.n, "H₂O₂", "H₂O₂") + "</b>, a strong oxidant kept inside the peroxisome with catalase.";
      if (s === 2) {
        if (!t.k) return "No ethanol is present, so catalase oxidizes nothing yet and " + (v.n === 1 ? "the <b>1 H₂O₂</b> waits" : "all <b>" + v.n + " H₂O₂</b> wait") + " to be split.";
        return "Catalase spends <b>" + t.k + " H₂O₂</b> oxidizing " + w(t.k, "ethanol", "ethanol molecules") + " to acetaldehyde, making " + (2 * t.k) + " water" +
          (v.e > v.n ? "; every H₂O₂ is used and <b>" + (v.e - v.n) + "</b> ethanol is left for alcohol dehydrogenase in the cytosol." :
           t.left ? "; <b>" + t.left + "</b> H₂O₂ remain" + (t.left === 1 ? "s." : ".") : "; every H₂O₂ is used.");
      }
      if (!t.p && t.odd) return "Only <b>1 H₂O₂</b> is left, so catalase has no partner to split it with yet; it waits for the next one.";
      if (!t.left) return "No H₂O₂ is left to split: ethanol used all of it, so the peroxisome released <b>no O₂</b> and no peroxide reached the cell.";
      return "Catalase splits <b>" + (2 * t.p) + " H₂O₂</b> two at a time into " + (2 * t.p) + " water and <b>" + w(t.p, "O₂", "O₂") + "</b>" +
        (t.odd ? "; the odd one waits for the next H₂O₂, so catalase can pair it." : ", so no peroxide escapes into the cell.");
    },
    examples: [
      {name: "oxidases fill the pool", values: {n: 6, e: 2, step: 1}},
      {name: "no ethanol: catalase splits it all", values: {n: 6, e: 0, step: 3}},
      {name: "ethanol uses every H2O2", values: {n: 4, e: 10, step: 3}},
      {name: "an odd one waits", values: {n: 5, e: 0, step: 3}},
      {name: "one substrate, no ethanol", values: {n: 1, e: 0, step: 2}},
      {name: "one H2O2 left, no partner", values: {n: 5, e: 4, step: 3}},
      {name: "full load", values: {n: 10, e: 10, step: 2}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, t = tally(v), enz = c.c4, sub = c.c3, hp = c.c5, eth = c.c6, wat = c.c2, ox = c.c1;
      var L = function (at, txt, col, o) { return api.label(at, txt, Object.assign({color: col, size: 12, weight: 600, anchor: "middle"}, o || {})); };
      // a grid of molecules: filled = present, hollow = used up (or made into something else)
      var grid = function (cx, y, count, col, cols, used, hollowCol) {
        for (var i = 0; i < count; i++) {
          var r = Math.floor(i / cols), q = i % cols, x = cx + (q - (Math.min(count, cols) - 1) / 2) * 17, yy = y + r * 17, gone = i < used;
          api.circle([x, yy], 6.5, gone ? {fill: "none", stroke: hollowCol || col, width: 1.3, dash: hollowCol ? null : "2 2"} : {fill: col, fillOpacity: 0.9});
        }
      };
      api.path("M 200 34 C 330 34 390 80 390 152 C 390 226 330 270 200 270 C 70 270 10 226 10 152 C 10 80 70 34 200 34 Z", {stroke: c.muted, width: 3, fill: c.muted, fillOpacity: 0.05});
      L([200, 14], "peroxisome: one membrane, oxidases and catalase inside", c.muted, {weight: 500});
      // oxidases: substrates in, H2O2 out
      L([112, 68], v.n + " RH₂ → " + v.n + " R", sub);
      L([112, 82], "substrates oxidized", sub, {weight: 500});
      grid(112, 100, v.n, sub, 5, v.n, sub);
      api.rect(58, 132, 76, 24, {fill: enz, fillOpacity: 0.25, stroke: enz, width: 1.4, rx: 8});
      L([96, 144], "oxidase", enz, {weight: 700});
      L([96, 170], "+ " + v.n + " O₂ used", ox, {weight: 500});
      api.arrow([136, 144], [158, 144], {color: hp, width: 2, halo: false, head: 8});
      // the H2O2 pool
      var used = s >= 3 ? t.k + 2 * t.p : s >= 2 ? t.k : 0, remain = v.n - used;
      L([200, 116], v.n + " H₂O₂ made", hp);
      grid(200, 136, v.n, hp, 5, used);
      L([200, 180], remain ? remain + " left" + (s === 3 && t.odd ? ": waits for a partner" : "") : "none left", hp, {weight: 500});
      // catalase: ethanol in, acetaldehyde out (step 2); pairs of H2O2 to water and O2 (step 3)
      var ce = s >= 2 ? t.k : 0;
      L([290, 68], v.e ? (ce ? ce + " ethanol oxidized" : v.e + " ethanol") : "no ethanol", eth);
      if (ce) L([290, 82], "→ " + ce + " acetaldehyde", eth, {weight: 500});
      if (v.e) grid(290, 100, v.e, eth, 5, ce, eth);
      api.rect(266, 132, 76, 24, {fill: enz, fillOpacity: 0.25, stroke: enz, width: 1.4, rx: 8});
      L([304, 144], "catalase", enz, {weight: 700});
      var act = (s === 2 && t.k) || (s === 3 && t.p);
      api.arrow([242, 144], [264, 144], {color: hp, width: 2, halo: false, head: 8, opacity: act ? 1 : 0.25});
      if (s === 2 && t.k) api.line([344, 100], [336, 130], {color: eth, width: 2, arrow: true});
      // products
      var water = (s >= 2 ? 2 * t.k : 0) + (s >= 3 ? 2 * t.p : 0), o2 = s >= 3 ? t.p : 0;
      if (s >= 2) api.arrow([304, 158], [304, 200], {color: wat, width: 2, halo: false, head: 8, opacity: act ? 1 : 0.25});
      L([170, 208], water + " H₂O made", wat);
      grid(170, 228, water, wat, 10, 0);
      L([316, 214], o2 + " O₂ released", ox);
      grid(316, 234, o2, ox, 3, 0);
      api.label([392, 290], "cytosol", {color: c.muted, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints svg text ink
    }
  });
})();
