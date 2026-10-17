// Calcium as a second messenger, relayed through the Gq / phospholipase C pathway: ligand -> Gq-coupled receptor ->
// Gaq-GTP -> PLC-beta cuts PIP2 into IP3 (diffuses) and DAG (stays in the membrane) -> IP3 opens IP3 receptors on the
// ER -> Ca2+ (ER ~500 uM, cytosol ~0.1 uM at rest) floods the cytosol to ~1 uM -> Ca2+ binds calmodulin (4 per CaM)
// and with DAG activates PKC -> SERCA (into the ER) and PMCA (out of the cell) pump it back down using ATP.
// The trace is schematic in time but uses those typical concentrations on a log axis.
(function () {
  var TEXT = ["A hormone or neurotransmitter binds a <b>Gq-coupled receptor</b>, which swaps GDP for GTP on its Gαq subunit",
              "Gαq-GTP switches on <b>phospholipase C-β</b>, which cuts the membrane lipid PIP₂ into <b>IP₃</b>, free to diffuse, and <b>DAG</b>, which stays in the membrane",
              "IP₃ opens the <b>IP₃ receptor</b> channel in the ER, and Ca²⁺ rushes down its steep gradient (about 500 µM inside, 0.1 µM in the cytosol), raising cytosolic Ca²⁺ about <b>tenfold, to ~1 µM</b>",
              "Ca²⁺ binds <b>calmodulin</b>, four ions per molecule, which then activates CaM kinases, and together with DAG it switches on <b>protein kinase C</b>"];
  function ca(t, pumps) {            // cytosolic [Ca2+] in uM; step k spans t in [k-1, k]
    var x = t < 2.2 ? 0 : t < 2.7 ? (1 - Math.cos(Math.PI * (t - 2.2) / 0.5)) / 2 : 1, v = 0.1 + 0.9 * x;
    if (t > 2.7) v -= 0.12 * Math.min(1, (t - 2.7) / 1.4);
    if (t > 4.1 && pumps) v = 0.1 + (ca(4.1, true) - 0.1) * Math.exp(-(t - 4.1) / 0.2);
    return v;
  }
  function now(v) { return ca((v.step || 1) - 0.15, v.pumps); }

  Viz.register("calcium-second-messenger-relay", {
    title: "Calcium as a second messenger",
    subject: "biology",
    shows: "Step through the relay from a Gq-coupled receptor to IP₃, an ER calcium release that lifts cytosolic Ca²⁺ tenfold, calmodulin and PKC, and the pumps that end the signal; block the pumps and the signal cannot switch off",
    params: {
      pumps: {kind: "boolean", default: true, label: "\\text{pumps}", on: "working", off: "blocked"}
    },
    steps: ["receptor activates Gq", "PLC-β makes IP₃ and DAG", "IP₃ opens the ER channel", "Ca²⁺ binds calmodulin, PKC", "pumps clear the Ca²⁺"],
    stepMs: 1900,
    formula: function (v) {
      var s = v.step || 1, c = Viz.n(now(v), 1);
      return ["\\text{GPCR}^{*}\\Rightarrow\\text{G}\\alpha_q\\text{: GDP}\\to\\text{GTP}",
              "\\text{PIP}_2\\xrightarrow{\\ \\text{PLC-}\\beta\\ }\\text{IP}_3+\\text{DAG}",
              "[\\text{Ca}^{2+}]_{\\text{cyt}}:\\ 0.1\\to" + c + "\\ \\mu\\text{M}\\ \\ (\\times" + Viz.n(now(v) / 0.1, 0) + ")",
              "4\\,\\text{Ca}^{2+}+\\text{CaM}\\to\\text{Ca}_4\\cdot\\text{CaM}\\newline\\text{Ca}^{2+}+\\text{DAG}\\to\\text{active PKC}",
              v.pumps ? "\\text{SERCA, PMCA}:\\ [\\text{Ca}^{2+}]_{\\text{cyt}}\\to" + c + "\\ \\mu\\text{M}" : "\\text{no pumps}:\\ [\\text{Ca}^{2+}]_{\\text{cyt}}\\text{ stays}\\approx" + c + "\\ \\mu\\text{M}"][s - 1];
    },
    status: function (v) {
      var s = v.step || 1;
      if (s < 5) return TEXT[s - 1] + ".";
      return v.pumps ? "<b>SERCA</b> pumps Ca²⁺ back into the ER and <b>PMCA</b> pumps it out of the cell, both spending ATP, so cytosolic Ca²⁺ falls back to <b>~0.1 µM</b> and the signal ends."
                     : "With both pumps blocked nothing clears the Ca²⁺, so it stays near <b>" + Viz.fmt(now(v), 1) + " µM</b> and the signal cannot switch off.";
    },
    examples: [
      {name: "IP₃ made", values: {step: 2}},
      {name: "calcium released", values: {step: 3}},
      {name: "signal ends", values: {step: 5, pumps: true}},
      {name: "pumps blocked", values: {step: 5, pumps: false}}
    ],
    size: [400, 316],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, m0 = 44, m1 = 58;
      var L = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var dim = function (on) { return on ? 1 : 0.5; };
      // plasma membrane, the ER and the calcium in each compartment
      api.rect(8, m0, 384, m1 - m0, {fill: c.muted, fillOpacity: 0.2, rx: 3});
      L([392, 14], "outside: Ca²⁺ ≈ 1–2 mM", c.muted, {anchor: "end", weight: 500});
      L([392, 206], "cytosol", c.muted, {anchor: "end", weight: 500});
      var ER = [20, 150, 184, 46];
      api.rect(ER[0], ER[1], ER[2], ER[3], {fill: c.c3, fillOpacity: 0.06, stroke: c.muted, width: 2, rx: 20});
      L([ER[0] + 4, ER[1] + ER[3] + 12], "ER: Ca²⁺ ≈ 500 µM", c.muted, {weight: 500});
      var high = s === 3 || s === 4 || (s === 5 && !v.pumps), erN = high ? 9 : 20, cyN = high ? 16 : 3;
      var ord = [0, 12, 5, 17, 9, 2, 14, 7, 19, 4, 11, 16, 1, 8, 13, 3, 18, 6, 10, 15];
      for (var i = 0; i < erN; i++) { var g = ord[i], row = Math.floor(g / 10); api.circle([ER[0] + 18 + (g % 10) * 16 + row * 8, ER[1] + 15 + row * 16], 3, {fill: c.c3}); }
      var cy = [[236, 172], [372, 100], [222, 96], [248, 124], [214, 140], [262, 190], [206, 186], [356, 132], [384, 152], [364, 186], [330, 192], [296, 186], [250, 98], [230, 150], [388, 120], [342, 104]];
      for (var j = 0; j < cyN; j++) api.circle(cy[j], 3, {fill: c.c3});
      // receptor with its ligand, then G alpha q
      var RX = 40, GX = 92, PX = 156;
      for (var k = 0; k < 7; k++) api.rect(RX - 14 + k * 4, m0 - 4, 3, m1 - m0 + 8, {fill: c.c2, rx: 1, opacity: dim(s === 1)});
      api.polygon([[RX - 7, m0 - 20], [RX + 7, m0 - 20], [RX, m0 - 8]], {fill: c.c5, fillOpacity: 1});
      L([RX + 14, m0 - 16], "ligand", c.c5);
      L([RX - 4, m1 + 34], "GPCR", c.c2, {anchor: "middle", opacity: dim(s === 1)});
      api.circle([GX, m1 + 13], 10, {fill: c.c2, fillOpacity: 0.45, stroke: c.c2, width: 1.5, opacity: dim(s <= 2)});
      L([GX, m1 + 34], s === 1 ? "Gαq-GTP" : "Gαq", c.c2, {anchor: "middle", opacity: dim(s <= 2)});
      if (s === 1) api.arrow([RX + 14, m1 + 8], [GX - 12, m1 + 12], {color: c.c2, width: 1.8, halo: false});
      // PLC-beta cuts PIP2 into IP3 (leaves) and DAG (stays)
      api.rect(PX - 28, m1 + 3, 56, 20, {fill: c.c1, fillOpacity: s >= 2 ? 0.35 : 0.06, stroke: c.c1, width: 1.5, rx: 8, opacity: dim(s === 2)});
      L([PX, m1 + 13], "PLC-β", c.c1, {anchor: "middle", opacity: dim(s === 2)});
      if (s === 2) api.arrow([GX + 12, m1 + 13], [PX - 32, m1 + 13], {color: c.c2, width: 1.8, halo: false});
      if (s >= 2) {
        api.rect(PX + 40, m0 + 3, 28, 8, {fill: c.c4, rx: 3, opacity: dim(s === 2 || s === 4)});
        L([PX + 54, m0 - 9], "DAG", c.c4, {anchor: "middle", opacity: dim(s === 2 || s === 4)});
        var ip3 = s === 2 ? [[PX - 10, 100], [PX + 6, 112], [PX - 4, 126]] : [[118, 138], [132, 134]];
        if (s < 5) {
          ip3.forEach(function (q) { api.polygon([[q[0], q[1] - 5], [q[0] + 5, q[1] + 4], [q[0] - 5, q[1] + 4]], {fill: c.c6, fillOpacity: 1, opacity: dim(s <= 3)}); });
          L(s === 2 ? [PX + 14, 102] : [125, 121], "IP₃", c.c6, {opacity: dim(s <= 3), anchor: s === 2 ? "start" : "middle"});
        }
      }
      // the IP3 receptor channel on the ER opens while Ca2+ is up
      var IX = 124, open = high;
      api.rect(IX - 12, ER[1] - 7, 10, 14, {fill: c.c6, fillOpacity: 0.45, stroke: c.c6, width: 1.2, rx: 2});
      api.rect(IX + (open ? 6 : 2), ER[1] - 7, 10, 14, {fill: c.c6, fillOpacity: 0.45, stroke: c.c6, width: 1.2, rx: 2});
      if (s === 3) { api.arrow([IX + 4, ER[1] - 2], [IX + 70, 104], {color: c.c3, width: 2.6, halo: false}); L([IX - 18, ER[1] - 20], "IP₃ receptor", c.c6, {anchor: "end"}); }
      // calmodulin, CaM kinase and PKC
      if (s >= 4) {
        var CM = [290, 126], on4 = s === 4 || !v.pumps;
        api.circle([CM[0] - 10, CM[1]], 8, {stroke: c.ink, width: 1.6}); api.circle([CM[0] + 10, CM[1]], 8, {stroke: c.ink, width: 1.6});
        api.line([CM[0] - 2, CM[1]], [CM[0] + 2, CM[1]], {color: c.ink, width: 2});
        [[-13, -3], [-7, 3], [7, -3], [13, 3]].forEach(function (q) { api.circle([CM[0] + q[0], CM[1] + q[1]], 2.6, {fill: c.c3, opacity: on4 ? 1 : 0.3}); });
        L([CM[0], CM[1] - 18], "calmodulin", c.ink, {anchor: "middle", opacity: dim(s === 4)});
        api.arrow([CM[0] + 18, CM[1] + 6], [CM[0] + 34, CM[1] + 24], {color: c.ink, width: 1.6, halo: false, opacity: dim(s === 4)});
        L([CM[0] + 44, CM[1] + 34], "CaM kinase", c.ink, {anchor: "middle", opacity: dim(s === 4)});
        api.rect(PX + 78, m1 + 3, 36, 18, {fill: c.c4, fillOpacity: 0.3, stroke: c.c4, width: 1.4, rx: 6, opacity: dim(s === 4)});
        L([PX + 96, m1 + 12], "PKC", c.c4, {anchor: "middle", opacity: dim(s === 4)});
      }
      // SERCA (into the ER) and PMCA (out of the cell)
      var serca = [ER[0] + 44, ER[1]], pmca = [372, (m0 + m1) / 2], work = s === 5 && v.pumps;
      [serca, pmca].forEach(function (q) { api.rect(q[0] - 7, q[1] - 7, 14, 14, {fill: work ? c.c1 : c.muted, fillOpacity: 0.5, stroke: work ? c.c1 : c.muted, width: 1.4, rx: 3}); });
      if (s === 5) {
        if (v.pumps) {
          api.arrow([serca[0] + 20, serca[1] - 34], [serca[0] + 2, serca[1] + 4], {color: c.c1, width: 2.2, halo: false});
          api.arrow([pmca[0] - 22, pmca[1] + 44], [pmca[0], pmca[1] - 14], {color: c.c1, width: 2.2, halo: false});
        }
        L([serca[0] + 24, serca[1] - 44], v.pumps ? "SERCA (ATP)" : "SERCA blocked", v.pumps ? c.c1 : c.c5, {anchor: "middle"});
        L([pmca[0] - 28, m1 + 12], v.pumps ? "PMCA (ATP)" : "PMCA blocked", v.pumps ? c.c1 : c.c5, {anchor: "end"});
      }
      // the cytosolic calcium trace on a log axis, with this step marked
      var gx0 = 60, gx1 = 388, gy0 = 302, gy1 = 240, ly = function (u) { return gy0 - (Math.log10(u) - Math.log10(0.05)) / (Math.log10(2) - Math.log10(0.05)) * (gy0 - gy1); };
      var tx = function (t) { return gx0 + (gx1 - gx0) * t / 5; };
      L([gx0, 226], "cytosolic Ca²⁺ (log scale)", c.c3, {weight: 500});
      api.line([gx0, gy0], [gx1, gy0], {color: c.axis, width: 1.2}); api.line([gx0, gy0], [gx0, gy1 - 6], {color: c.axis, width: 1.2});
      [0.1, 1].forEach(function (u) { api.line([gx0 - 4, ly(u)], [gx1, ly(u)], {color: c.grid, width: 1}); L([gx0 - 7, ly(u)], u + " µM", c.muted, {anchor: "end", weight: 500}); });
      for (var b = 1; b < 5; b++) api.line([tx(b), gy0], [tx(b), gy0 + 4], {color: c.axis, width: 1});
      var pts = []; for (var t = 0; t <= 5.0001; t += 0.05) pts.push([tx(t), ly(ca(t, v.pumps))]);
      api.polyline(pts, {stroke: c.c3, width: 2.4});
      var tn = s - 0.15;
      api.line([tx(tn), gy1 - 6], [tx(tn), gy0], {color: c.accent, width: 1.4, dash: "3 3"});
      api.point([tx(tn), ly(now(v))], {color: c.accent, r: 4.5});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
