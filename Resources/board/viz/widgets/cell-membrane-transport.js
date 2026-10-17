// Three ways across a membrane, with numbers. Simple diffusion through the lipids follows Fick's law (flux grows
// in a straight line with the gradient); facilitated diffusion through a carrier saturates (a symmetric carrier:
// J = Jmax [Co/(K+Co) - Ci/(K+Ci)]); a primary active pump moves solute in whatever the gradient, paid for with ATP
// (J = Jmax Co/(K+Co)). Flux is in relative units, inward positive, with k = 0.5 per mM, Jmax = 10, K = 2 mM. The free
// energy of bringing an uncharged solute in is dG = RT ln(Ci/Co), RT = 2.58 kJ/mol at 37 °C: negative means downhill.
(function () {
  var K = 2, JMAX = 10, KD = 0.5, RT = 2.58;
  function flux(m, co, ci) {
    if (m === "diffusion") return KD * (co - ci);
    if (m === "facilitatedDiffusion") return JMAX * (co / (K + co) - ci / (K + ci));
    return JMAX * co / (K + co);
  }
  function dG(co, ci) { return co === 0 && ci === 0 ? NaN : co === 0 ? Infinity : ci === 0 ? -Infinity : RT * Math.log(ci / co); }
  var NAME = {diffusion: "Simple diffusion", facilitatedDiffusion: "Facilitated diffusion", activeTransport: "Active transport"};
  var PROPS = {diffusion: ["protein: none", "saturates: no", "energy: none"],
    facilitatedDiffusion: ["protein: carrier", "saturates: yes", "energy: none"],
    activeTransport: ["protein: pump", "saturates: yes", "energy: ATP"]};
  function halton(i, b) { var f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }
  Viz.register("cell-membrane-transport", {
    title: "Membrane transport: diffusion, carriers, pumps",
    subject: "biology",
    shows: "Pick a mechanism and set the concentrations: passive transport only runs downhill (straight-line or saturating), a pump keeps moving solute in against the gradient by spending ATP",
    params: {
      mechanism: {kind: "enum", values: ["diffusion", "facilitatedDiffusion", "activeTransport"], default: "diffusion", label: "\\text{route}",
        names: {diffusion: "simple diffusion", facilitatedDiffusion: "facilitated", activeTransport: "active"}},
      cOut: {kind: "number", default: 10, min: 0, max: 20, step: 0.5, label: "C_\\text{out}"},
      cIn: {kind: "number", default: 2, min: 0, max: 20, step: 0.5, label: "C_\\text{in}"}
    },
    formula: function (v) {
      var j = flux(v.mechanism, v.cOut, v.cIn), co = Viz.n(v.cOut), ci = Viz.n(v.cIn);
      if (v.mechanism === "diffusion") return "J=k\\,(C_\\text{out}-C_\\text{in})\\newline =0.5\\,(" + co + "-" + ci + ")=" + Viz.n(j);
      if (v.mechanism === "facilitatedDiffusion") return "J=J_{\\max}\\Big(\\tfrac{C_\\text{out}}{K+C_\\text{out}}-\\tfrac{C_\\text{in}}{K+C_\\text{in}}\\Big)\\newline =10\\Big(\\tfrac{" + co + "}{2+" + co + "}-\\tfrac{" + ci + "}{2+" + ci + "}\\Big)=" + Viz.n(j);
      return "J=J_{\\max}\\tfrac{C_\\text{out}}{K+C_\\text{out}}\\newline =10\\cdot\\tfrac{" + co + "}{2+" + co + "}=" + Viz.n(j) + "\\ \\ (+\\,\\text{ATP})";
    },
    status: function (v) {
      var m = v.mechanism, j = flux(m, v.cOut, v.cIn), g = dG(v.cOut, v.cIn), dir = j > 1e-9 ? "inward" : j < -1e-9 ? "outward" : "none";
      if (m === "activeTransport") {
        if (v.cOut === 0) return "Active transport: with no solute outside the pump has nothing to bind, so <b>no flow</b> despite the ATP on hand.";
        return "Active transport: the pump spends ATP to move solute <b>in</b> at J = <b>" + Viz.fmt(j) + "</b>" +
          (g > 0 ? ", <b>against</b> the gradient (ΔG = +" + Viz.fmt(g) + " kJ/mol, well under the ≈ 50 kJ/mol one ATP releases)." : ", and would keep going even if the inside were richer.");
      }
      if (v.cOut === 0 && v.cIn === 0) return NAME[m] + ": there is <b>no solute</b> on either side, so nothing moves.";
      if (dir === "none") return NAME[m] + ": equal concentrations, so molecules still cross both ways but there is <b>no net flow</b>.";
      var who = m === "diffusion" ? " through the lipids (small nonpolar molecules such as O₂ and CO₂)" : " through a carrier (glucose uses GLUT1)";
      return NAME[m] + who + ": net <b>" + dir + "</b>, J = <b>" + Viz.fmt(j) + "</b>" + (j < 0 ? " (inward counts as positive)" : "") + ", always down the gradient" +
        (m === "diffusion" ? ", in proportion to it." : ", levelling off as the carriers fill.");
    },
    examples: [
      {name: "mechanism: facilitatedDiffusion", values: {mechanism: "facilitatedDiffusion"}},
      {name: "mechanism: activeTransport", values: {mechanism: "activeTransport"}},
      {name: "pump against the gradient", values: {mechanism: "activeTransport", cOut: 2, cIn: 18}},
      {name: "diffusion outward", values: {mechanism: "diffusion", cOut: 2, cIn: 16}},
      {name: "equal: no net flow", values: {mechanism: "facilitatedDiffusion", cOut: 8, cIn: 8}},
      {name: "carrier saturated", values: {mechanism: "facilitatedDiffusion", cOut: 20, cIn: 0}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = v.mechanism, j = flux(m, v.cOut, v.cIn), g = dG(v.cOut, v.cIn);
      // ---- membrane cross-section: outside on top, inside below ----
      var X0 = 12, X1 = 222, mT = 120, mB = 150, rx = 74;
      api.rect(X0, 14, X1 - X0, mT - 18, {fill: c.c2, fillOpacity: 0.03, rx: 6});
      api.rect(X0, mB + 4, X1 - X0, 100, {fill: c.c2, fillOpacity: 0.03, rx: 6});
      api.label([X0 + 6, 24], "outside  C_o = " + api.fmt(v.cOut) + " mM", {color: c.muted, size: 12});
      api.label([X0 + 6, 246], "inside  C_i = " + api.fmt(v.cIn) + " mM", {color: c.muted, size: 12});
      for (var x = X0 + 4; x <= X1 - 4; x += 8) {   // phospholipids: heads on both faces, tails meeting in the middle
        if (m !== "diffusion" && Math.abs(x - rx) < 20) continue;
        api.circle([x, mT + 3], 3.4, {fill: c.muted, fillOpacity: 0.8}); api.circle([x, mB - 3], 3.4, {fill: c.muted, fillOpacity: 0.8});
        api.line([x, mT + 7], [x, mB - 7], {color: c.muted, width: 1, opacity: 0.45});
      }
      var dots = function (n, y0, h) {
        var placed = 0;
        for (var i = 1; placed < n && i < 400; i++) {
          var q = [X0 + 8 + halton(i, 2) * (X1 - X0 - 16), y0 + halton(i, 3) * h];
          if (Math.abs(q[0] - rx) < 22 || (q[0] > rx + 20 && q[0] < X1 - 4 && Math.abs(q[1] - (y0 < mT ? mT - 16 : mB + 16)) < 11)) continue;
          api.circle(q, 3.2, {fill: c.c2}); placed++;
        }
      };
      dots(Math.round(v.cOut * 1.6), 36, 72); dots(Math.round(v.cIn * 1.6), 162, 70);
      if (m === "facilitatedDiffusion") {
        api.rect(rx - 19, mT - 8, 15, mB - mT + 16, {fill: c.c6, fillOpacity: 0.75, rx: 6}); api.rect(rx + 4, mT - 8, 15, mB - mT + 16, {fill: c.c6, fillOpacity: 0.75, rx: 6});
        api.label([rx + 28, mT - 16], "carrier protein", {color: c.c6, size: 12, weight: 650});
      } else if (m === "activeTransport") {
        api.rect(rx - 20, mT - 10, 40, mB - mT + 20, {fill: c.c6, fillOpacity: 0.75, rx: 9});
        api.label([rx + 28, mT - 16], "pump protein", {color: c.c6, size: 12, weight: 650});
        api.label([rx + 28, mB + 16], "ATP → ADP + P_i", {color: c.c3, size: 12, weight: 650});
        api.circle([rx + 15, mB + 9], 4.5, {fill: c.c3});
      } else {
        api.label([rx + 28, mT - 16], "through the lipids", {color: c.muted, size: 12});
      }
      // the net flux arrow, thickness by size
      var w = 2 + 5 * Math.min(1, Math.abs(j) / 10);
      if (Math.abs(j) > 1e-9) {
        var a = j > 0 ? [rx, mT - 26] : [rx, mB + 26], b = j > 0 ? [rx, mB + 30] : [rx, mT - 30];
        api.arrow(a, b, {color: c.c1, width: w, head: 10 + w});
      } else if (m === "activeTransport" || (v.cOut === 0 && v.cIn === 0)) {
        api.label([rx + 28, (mT + mB) / 2 + 40], v.cOut === 0 && v.cIn === 0 ? "no solute at all" : "nothing outside to pump", {color: c.c1, size: 12});
      } else {
        api.arrow([rx - 7, mT - 14], [rx - 7, mB + 14], {color: c.c1, width: 1.6, halo: false, head: 7});
        api.arrow([rx + 7, mB + 14], [rx + 7, mT - 14], {color: c.c1, width: 1.6, halo: false, head: 7});
        api.label([rx + 28, mB + 16], "no net flow", {color: c.c1, size: 12, weight: 650});
      }
      // ---- flux against the outside concentration, inside held at its value ----
      // y runs to ±11 so the J label sits above the highest the curve reaches (J = 10); axis labels drawn by hand below
      var pl = api.plane({x: [0, 20], y: [-11, 11], box: [250, 26, 140, 150], equal: false, grid: false, tickEvery: 10, step: 10, labels: false});
      if (v.cIn > 0) {   // inward flux with less outside than inside = uphill: only a pump gets in here
        api.rect(pl.x(0), pl.y(11), pl.x(v.cIn) - pl.x(0), pl.y(0) - pl.y(11), {fill: c.c3, fillOpacity: 0.1, rx: 0});
        if (v.cIn >= 6) api.label([pl.x(v.cIn / 2), pl.y(0) - 9], "uphill", {color: c.c3, size: 12, anchor: "middle"});
      }
      // the dashed C_o = C_i line stops short of the "J (in +)" label when it would run through it
      api.line([pl.x(v.cIn), pl.y(-11)], [pl.x(v.cIn), pl.y(11) + (v.cIn > 0.5 && v.cIn < 7 ? 15 : 0)], {color: c.muted, width: 1, dash: "3 3"});
      api.label([pl.x(v.cIn), pl.y(-11) + 12], "C_o = C_i", {color: c.muted, size: 12, anchor: v.cIn > 14 ? "end" : v.cIn < 6 ? "start" : "middle"});
      // C_o at the axis end, or just left of the dashed line once that line reaches the end
      api.label([v.cIn > 14 ? pl.x(v.cIn) - 4 : pl.x(20) - 2, pl.y(0) - 11], "C_o", {color: c.muted, size: 12.5, anchor: "end"});
      api.label([pl.x(0) + 9, pl.y(11) + 6], "J (in +)", {color: c.muted, size: 12.5});
      var pts = [];
      for (var co = 0; co <= 20.001; co += 0.25) pts.push(pl.px([co, flux(m, co, v.cIn)]));
      api.polyline(pts, {stroke: c.c1, width: 2.5});
      api.point(pl.px([v.cOut, j]), {color: c.c1, r: 5.5});
      api.label([392, 13], "net flux J as C_o varies", {color: c.muted, size: 12, anchor: "end"});
      // ---- energy, and how the three routes differ ----
      var gTxt = isNaN(g) ? "no solute" : !isFinite(g) ? (g > 0 ? "+∞" : "−∞") : (g > 0 ? "+" : "") + api.fmt(g);
      var pump = m === "activeTransport", note = isNaN(g) ? "" : !isFinite(g) ? (g < 0 ? "nothing inside yet: downhill in" : "nothing outside to bring in") : g > 1e-9 ? (pump ? "uphill: ATP pays" : "uphill in, so it flows out") : g < -1e-9 ? "downhill in" : "no push either way";
      api.label([244, 208], "ΔG_{in} = RT ln(C_i/C_o)", {color: c.muted, size: 12});
      api.label([244, 226], "= " + gTxt + (isNaN(g) ? "" : " kJ/mol"), {color: g > 1e-9 && pump ? c.c3 : c.ink, size: 12.5, weight: 650});
      api.label([244, 244], note, {color: g > 1e-9 && pump ? c.c3 : c.muted, size: 12});
      PROPS[m].forEach(function (t, i) {
        var x = 12 + i * 128;
        api.rect(x, 268, 120, 22, {fill: c.ink, fillOpacity: 0.05, stroke: c.faint, width: 1, rx: 11});
        api.label([x + 60, 279], t, {color: t.indexOf("ATP") >= 0 ? c.c3 : c.ink, size: 12, anchor: "middle"});
      });
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
