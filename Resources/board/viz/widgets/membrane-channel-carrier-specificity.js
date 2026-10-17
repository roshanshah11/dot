// Channels and carriers are both picky, in different ways. A K+ channel is a water-filled pore whose selectivity
// filter (about 0.3 nm wide) is lined with carbonyl oxygens spaced to stand in for a K+ ion's water shell: K+ sheds its
// water and streams through with no shape change, while the smaller Na+ cannot be held by those oxygens, stays
// hydrated and is too big (K+ is passed over 1000-fold better). A carrier such as GLUT1 binds its solute like an enzyme
// and must flip from outward- to inward-facing for every molecule, so it is far slower and saturates.
// Rates are one-way fluxes through one protein from its entry side, the side each solute really comes from: the cytosol
// for the K+ channel (cells hold about 140 mM K+ against about 5 outside, so K+ flows out) and the outside for GLUT1
// (glucose flows in). C is the concentration on that side, so the slider runs to 150 mM and starts at a cytosolic 140.
// Open channel, illustrative: J = k C, treated as linear (real channels start to saturate near the top of this range),
// k = 4e5 per s per mM, about 6e7 ions/s at 140 mM, inside the 1e7-1e8 per s measured for open K+ channels; Na+ through
// it at most k C / 1000. GLUT1: J = kcat C / (Km + C), kcat about 1000 per s, Km 1.5 mM for D-glucose and above 3000 mM
// for L-glucose (3000 used, so its rate is an upper bound). No fit: J = 0.
(function () {
  var KCH = 4e5, KCAT = 1000, KM = {"D-glucose": 1.5, "L-glucose": 3000}, CMAX = 150, SPAN = Math.log10(CMAX) + 1;
  function rate(p, s, C) {
    if (p === "channel") return s === "K" ? KCH * C : s === "Na" ? KCH * C / 1000 : 0;
    return KM[s] ? KCAT * C / (KM[s] + C) : 0;
  }
  function sci(x) {   // 2.0×10⁶ style, LaTeX
    if (x < 1) return String(Number(x.toPrecision(2)));
    if (x < 1000) return Viz.n(x, x < 10 ? 1 : 0);
    var e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e);
    if (m >= 9.95) { m /= 10; e += 1; }
    return m.toFixed(1) + "\\times10^{" + e + "}";
  }
  function txt(x) { return sci(x).replace("\\times10^{", "×10^").replace("}", "").replace(/\^(\d)(\d?)/, function (_, a, b) { var s = "⁰¹²³⁴⁵⁶⁷⁸⁹"; return s[+a] + (b ? s[+b] : ""); }); }
  var ION = {K: "K⁺", Na: "Na⁺"};
  Viz.register("membrane-channel-carrier-specificity", {
    title: "Channels vs carriers: how each picks its solute",
    subject: "biology",
    shows: "Pick a protein, a solute and a concentration: a K⁺ channel sorts by size and charge in its filter and lets K⁺ out of the cell at tens of millions per second; a glucose carrier sorts by shape, flips for every molecule and tops out near 10³",
    params: {
      protein: {kind: "enum", values: ["channel", "carrier"], names: {channel: "K⁺ channel", carrier: "GLUT1 carrier"}, default: "channel", label: "\\text{protein}"},
      solute: {kind: "enum", values: ["K", "Na", "D-glucose", "L-glucose"], names: {K: "K⁺", Na: "Na⁺", "D-glucose": "D-glucose", "L-glucose": "L-glucose"}, default: "K", label: "\\text{solute}"},
      C: {kind: "number", default: 140, min: 0.1, max: CMAX, step: 0.1, label: "C\\ (\\text{mM})"}
    },
    formula: function (v) {
      var j = rate(v.protein, v.solute, v.C), C = Viz.n(v.C, 1);
      if (!j) return "J = 0\\ \\ (\\text{no fit})";
      if (v.protein === "channel") return v.solute === "K" ? "J = kC = 4\\times10^{5}\\cdot " + C + "\\newline = " + sci(j) + "\\ \\text{s}^{-1}"
        : "J \\lesssim \\tfrac{kC}{1000} = \\tfrac{4\\times10^{5}\\cdot " + C + "}{1000} = " + sci(j) + "\\ \\text{s}^{-1}";
      return "J " + (v.solute === "L-glucose" ? "\\lesssim" : "=") + " \\frac{k_{cat}C}{K_m+C} = \\frac{1000\\cdot " + C + "}{" + KM[v.solute] + "+" + C + "} = " + sci(j) + "\\ \\text{s}^{-1}";
    },
    status: function (v) {
      var j = rate(v.protein, v.solute, v.C);
      if (v.protein === "channel") {
        if (v.solute === "K") return "From the cytosol at " + Viz.fmt(v.C, 1) + " mM (real cells hold about 140, the outside about 5, so K⁺ flows out), K⁺ sheds its water in the filter and streams through at about <b>" + txt(j) + " per second</b>, an illustrative rate about " + Number((j / rate("carrier", "D-glucose", v.C)).toPrecision(2)).toLocaleString("en-US") + " times a glucose carrier's at the same concentration.";
        if (v.solute === "Na") return "Na⁺ is smaller, but the filter's oxygens sit too far apart to replace its water shell, so it stays hydrated and is mostly turned away: at most about <b>" + txt(j) + " per second</b> get through, 1000 times fewer than K⁺.";
        return v.solute + " is uncharged and roughly 0.8 nm across, far too big for the 0.3 nm K⁺ filter: <b>no passage</b>.";
      }
      if (v.solute === "D-glucose") return "D-glucose fits GLUT1's site and the carrier flips to face the cytosol for each one: <b>" + txt(j) + " per second</b>, " + Viz.fmt(100 * j / KCAT, 0) + "% of its 1000 per second ceiling.";
      if (v.solute === "L-glucose") return "L-glucose is D-glucose's mirror image, so it barely fits the site (Km above 3000 mM, against 1.5 mM): at most <b>" + txt(j) + " per second</b>.";
      return "GLUT1's site binds sugars, not ions, so " + ION[v.solute] + " is <b>not carried</b> at all.";
    },
    examples: [
      {name: "K⁺ channel at 0.1 mM", values: {protein: "channel", solute: "K", C: 0.1}},
      {name: "K⁺ channel at 150 mM", values: {protein: "channel", solute: "K", C: 150}},
      {name: "Na⁺ mostly turned away by the K⁺ filter", values: {protein: "channel", solute: "Na", C: 100}},
      {name: "glucose carrier near saturation", values: {protein: "carrier", solute: "D-glucose", C: 150}},
      {name: "mirror-image sugar", values: {protein: "carrier", solute: "L-glucose", C: 5}},
      {name: "glucose cannot use the K⁺ channel", values: {protein: "channel", solute: "D-glucose", C: 0.1}}
    ],
    size: [400, 330],
    draw: function (api, v) {
      var c = api.color, ch = v.protein === "channel", pc = ch ? c.c1 : c.c6, j = rate(v.protein, v.solute, v.C);
      var sc = {"K": c.c3, "Na": c.c2, "D-glucose": c.c4, "L-glucose": c.c4}[v.solute];
      // the membrane
      api.rect(8, 66, 384, 40, {fill: c.c3, fillOpacity: 0.1, rx: 0});
      for (var x = 14; x < 392; x += 12) { api.circle([x, 68], 4, {fill: c.muted, fillOpacity: 0.35}); api.circle([x, 104], 4, {fill: c.muted, fillOpacity: 0.35}); }
      api.label([12, 14], "outside", {color: c.muted, size: 12});
      api.label([12, 136], "cytosol", {color: c.muted, size: 12});
      api.label([12, ch ? 150 : 28], "C = " + Viz.fmt(v.C, 1) + " mM here", {color: c.ink, size: 12, weight: 650});   // the entry side
      var cross = function (q) { api.path("M " + (q[0] - 6) + " " + (q[1] - 6) + " L " + (q[0] + 6) + " " + (q[1] + 6) + " M " + (q[0] + 6) + " " + (q[1] - 6) + " L " + (q[0] - 6) + " " + (q[1] + 6), {stroke: c.c5, width: 2.4}); };
      var ion = function (q, wet, o) {   // wet: true for a full water shell, or the shell radius
        if (wet) api.circle(q, wet === true ? 12 : wet, Object.assign({stroke: c.c2, width: 1.2, dash: "2 3", fill: c.c2, fillOpacity: 0.08}, o));
        api.circle(q, v.solute === "K" ? 5.5 : 4, Object.assign({fill: sc}, o));
      };
      var sugar = function (q, mirror) {   // a six-ring with one side group; L-glucose has it on the mirrored side
        var pts = []; for (var k = 0; k < 6; k++) pts.push([q[0] + 11 * Math.cos(k * Math.PI / 3), q[1] + 11 * Math.sin(k * Math.PI / 3)]);
        api.polygon(pts, {fill: c.c4, fillOpacity: 0.35, stroke: c.c4, width: 1.6});
        var t = mirror ? -2 * Math.PI / 3 : -Math.PI / 3;
        api.line([q[0] + 11 * Math.cos(t), q[1] + 11 * Math.sin(t)], [q[0] + 18 * Math.cos(t), q[1] + 18 * Math.sin(t)], {color: c.c4, width: 3});
      };
      var sug = v.solute.indexOf("glucose") > 0, mir = v.solute === "L-glucose";
      if (ch) {
        // two subunits around a pore; the narrow top is the selectivity filter lined with carbonyl oxygens
        api.polygon([[166, 56], [194, 56], [194, 78], [189, 84], [189, 114], [166, 114]], {fill: pc, fillOpacity: 0.3, stroke: pc, width: 1.6});
        api.polygon([[234, 56], [206, 56], [206, 78], [211, 84], [211, 114], [234, 114]], {fill: pc, fillOpacity: 0.3, stroke: pc, width: 1.6});
        [60, 67, 74].forEach(function (y) { api.circle([195.5, y], 1.8, {fill: c.ink}); api.circle([204.5, y], 1.8, {fill: c.ink}); });
        api.label([156, 42], "filter, 0.3 nm", {color: pc, size: 12, anchor: "end"});
        api.line([158, 46], [192, 62], {color: pc, width: 1});
        api.label([158, 122], "K⁺ channel", {color: pc, size: 12.5, weight: 650, anchor: "end"});
        // the channel's entry side is the cytosol: every solute comes up from below
        if (v.solute === "K") {   // hydrated in the cytosol and the wide cavity, bare in the filter, hydrated again outside
          ion([200, 136], true); ion([200, 100], 10); ion([200, 67], false); ion([200, 30], true);
          api.arrow([252, 142], [252, 26], {color: sc, width: 2.4, halo: false});
          api.label([262, 30], "sheds its water", {color: sc, size: 12});
          api.label([262, 44], "in the filter", {color: sc, size: 12});
        } else if (v.solute === "Na") {   // most bounce off the filter; the odd one gets through
          ion([200, 136], true); ion([200, 100], 10); cross([200, 86]); ion([200, 64], false, {opacity: 0.35});
          api.label([218, 18], "Na⁺ keeps its water shell", {color: sc, size: 12});
          api.label([218, 32], "and is mostly turned away:", {color: c.c5, size: 12});
          api.label([218, 46], "≤ 1 in 1000 as often as K⁺", {color: c.muted, size: 12});
        } else {
          sugar([200, 140], mir); cross([200, 112]);
          api.label([222, 140], "far too big, uncharged", {color: c.c5, size: 12});
        }
      } else {
        // alternating access: outward-facing (left) binds, inward-facing (right) releases
        var lobe = function (cx, up) {   // two halves; the cavity between them opens up (outside) or down (cytosol)
          var f = function (q) { return [q[0], up ? q[1] : 170 - q[1]]; };
          [-1, 1].forEach(function (d) {
            api.polygon([[cx + 30 * d, 55], [cx + 16 * d, 55], [cx + 3 * d, 106], [cx + 3 * d, 115], [cx + 30 * d, 115]].map(f), {fill: pc, fillOpacity: 0.3, stroke: pc, width: 1.6});
          });
        };
        lobe(130, true); lobe(286, false);
        api.arrow([170, 86], [244, 86], {color: pc, width: 2, halo: false});
        api.label([207, 54], "flips", {color: pc, size: 12, anchor: "middle"});
        api.label([207, 132], "GLUT1 carrier", {color: pc, size: 12.5, weight: 650, anchor: "middle"});
        if (v.solute === "D-glucose") {
          sugar([130, 74], false); sugar([286, 142], false);
          api.label([300, 30], "binds, flips, releases", {color: sc, size: 12, anchor: "middle"});
        } else if (sug) {
          sugar([130, 28], true); cross([130, 50]);
          api.label([152, 22], "mirror image: no fit", {color: c.c5, size: 12});
        } else {
          ion([130, 30], true); cross([130, 50]);
          api.label([152, 24], "no site for an ion", {color: c.c5, size: 12});
        }
      }
      // transport rate against concentration, both on log scales
      var X0 = 64, X1 = 384, YT = 186, YB = 294, lx = function (C) { return X0 + (X1 - X0) * (Math.log10(C) + 1) / SPAN; };
      var ly = function (J) { return YB - (YB - YT) * (Math.log10(J) + 2) / 10; };
      api.line([X0, YB], [X1, YB], {color: c.axis, width: 1.2});
      api.line([X0, YB], [X0, YT - 4], {color: c.axis, width: 1.2});
      [0.1, 1, 10, 100].forEach(function (C) { api.label([lx(C), YB + 13], String(C), {color: c.muted, size: 12, anchor: "middle"}); });
      [0, 2, 4, 6, 8].forEach(function (e) { api.label([X0 - 6, ly(Math.pow(10, e))], e ? "10^" + e : "1", {color: c.muted, size: 12, anchor: "end"}); });
      api.label([X0 - 4, 170], "molecules per second (log)", {color: c.muted, size: 12});
      api.label([X1, 322], "C on the entry side, mM (log)", {color: c.muted, size: 12, anchor: "end"});
      var curve = function (p, s, o) {
        var pts = []; for (var e = -1; e <= SPAN - 1 + 1e-9; e += 0.05) { var J = rate(p, s, Math.pow(10, e)); if (J >= 0.01) pts.push([lx(Math.pow(10, e)), ly(J)]); }
        if (rate(p, s, CMAX) >= 0.01) pts.push([lx(CMAX), ly(rate(p, s, CMAX))]);
        if (pts.length > 1) api.polyline(pts, o);
      };
      curve("channel", "K", {stroke: c.c1, width: 1.4, dash: "4 4", opacity: 0.6});
      curve("carrier", "D-glucose", {stroke: c.c6, width: 1.4, dash: "4 4", opacity: 0.6});
      // name the faint reference curves, unless the bold curve already sits on one
      if (!(ch && v.solute === "K")) api.label([lx(0.13), ly(KCH * 0.13) - 11], "channel", {color: c.c1, size: 12});
      if (!(!ch && v.solute === "D-glucose")) api.label([lx(0.13), ly(rate("carrier", "D-glucose", 0.13)) + 13], "carrier", {color: c.c6, size: 12});
      if (j) {
        curve(v.protein, v.solute, {stroke: pc, width: 2.6});
        api.point([lx(v.C), ly(Math.max(j, 0.01))], {color: sc, r: 5.5, stroke: c.card});
        var right = lx(v.C) < 250;
        api.label([lx(v.C) + (right ? 10 : -10), ly(j) - 12], txt(j) + " /s", {color: sc, size: 12.5, weight: 650, anchor: right ? "start" : "end"});
      } else {
        api.line([lx(v.C), YB - 2], [lx(v.C), YT], {color: c.c5, width: 1, dash: "2 4"});
        api.label([lx(v.C) + (lx(v.C) < 250 ? 8 : -8), YB - 12], "no transport", {color: c.c5, size: 12.5, weight: 650, anchor: lx(v.C) < 250 ? "start" : "end"});
      }
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
