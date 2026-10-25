// Secondary active transport: a Na+/glucose symporter (SGLT) moves glucose uphill by letting Na+ run downhill, and the
// Na+/K+ pump (primary active, ATP) is what keeps the Na+ gradient there. Carrier cycle: Na+ binds the outward-facing
// carrier first (raising its glucose affinity), glucose binds, the loaded carrier flips, both are released inside.
// Thermodynamic ceiling for n Na+ per neutral glucose (Vm = inside minus outside, 37 °C, RT/F = 26.7 mV):
//   [glc]in/[glc]out <= ( [Na+]out/[Na+]in * exp(-F Vm / RT) )^n
// e.g. 145/12 mM, -70 mV: n = 1 (SGLT2) about 166x, n = 2 (SGLT1) about 27,700x. [Na+]out is held at 145 mM.
(function () {
  var NAO = 145, RTF = 26.7;
  var OUT_NA = [[116, 30], [142, 56], [168, 28], [186, 60], [126, 76], [160, 80], [282, 30], [306, 54], [330, 26], [354, 58], [378, 34], [292, 78], [336, 80], [372, 72]];
  var IN_NA = [[134, 146], [300, 146], [172, 172], [352, 150], [382, 172], [128, 188], [186, 146], [276, 178], [334, 174], [152, 166], [312, 192], [362, 192], [282, 150], [190, 192]];
  var OUT_G = [[108, 52], [366, 54], [312, 74]];
  var IN_G = [[150, 146], [326, 150], [298, 172], [370, 152], [118, 166], [176, 186], [350, 186], [258, 186]];
  var STEPS = ["pump sets the Na⁺ gradient", "Na⁺ binds outside", "glucose binds", "flip: both released inside"];
  function calc(v) {
    var n = v.carrier === "SGLT2" ? 1 : 2, conc = Math.pow(NAO / v.naIn, n), volt = Math.pow(Math.exp(-v.vm / RTF), n);
    return {n: n, conc: conc, volt: volt, ratio: conc * volt};
  }
  function sig(x) { var r = Number(x.toPrecision(3)); return r >= 1000 ? Math.round(r).toLocaleString("en-US") : String(r); }
  Viz.register("secondary-active-cotransport", {
    title: "Secondary active transport: Na⁺-glucose symport",
    subject: "biology",
    shows: "Step through a Na⁺-glucose symporter and change the Na⁺ inside, the membrane voltage and how many Na⁺ ride along: Na⁺ running downhill pays for glucose going uphill, and the Na⁺/K⁺ pump's ATP keeps that gradient there",
    params: {
      naIn: {kind: "number", default: 12, min: 5, max: 145, step: 1, label: "[\\mathrm{Na^+}]_i"},
      vm: {kind: "number", default: -70, min: -100, max: 0, step: 5, label: "V_m"},
      carrier: {kind: "enum", values: ["SGLT1", "SGLT2"], names: {SGLT1: "SGLT1 · 2 Na⁺", SGLT2: "SGLT2 · 1 Na⁺"}, default: "SGLT1", label: "\\text{carrier}"}
    },
    steps: STEPS,
    stepMs: 1700,
    formula: function (v) {
      var k = calc(v);
      return "\\frac{[\\text{glc}]_\\text{in}}{[\\text{glc}]_\\text{out}}\\le\\left(\\frac{[\\mathrm{Na^+}]_\\text{out}}{[\\mathrm{Na^+}]_\\text{in}}e^{-FV_m/RT}\\right)^{n}\\newline=\\left(\\frac{" + NAO + "}{" + Viz.n(v.naIn) +
        "}\\,e^{" + Viz.n(-v.vm) + "/" + RTF + "}\\right)^{" + k.n + "}=" + sig(k.ratio).replace(/,/g, "{,}");
    },
    status: function (v) {
      var k = calc(v), s = v.step || 1, na = k.n === 2 ? "2 Na⁺" : "1 Na⁺";
      if (s === 1) return v.naIn >= NAO ? "The pump is not keeping up: Na⁺ inside equals the <b>145 mM</b> outside, so only the voltage is left to drive the carrier." :
        "The Na⁺/K⁺ pump spends ATP to hold Na⁺ at <b>" + Viz.fmt(v.naIn) + " mM</b> inside against 145 mM outside: that gradient is stored energy.";
      if (s === 2) return "<b>" + na + "</b> bind" + (k.n === 1 ? "s" : "") + " the carrier while it faces outside, which raises its grip on glucose.";
      if (s === 3) return "Glucose binds next, and the loaded carrier flips to face the cytoplasm, carrying <b>" + na + " per glucose</b>.";
      if (k.ratio < 1.05) return "With no Na⁺ gradient and no voltage nothing drives the carrier: glucose can only even out, <b>ratio 1</b>.";
      return "Na⁺ runs downhill into the cell and pays for glucose going uphill: glucose can pile up to <b>" + sig(k.ratio) + "×</b> its outside level.";
    },
    examples: [
      {name: "SGLT1 in a resting cell", values: {naIn: 12, vm: -70, carrier: "SGLT1", step: 4}},
      {name: "SGLT2: one Na⁺ per glucose", values: {naIn: 12, vm: -70, carrier: "SGLT2", step: 4}},
      {name: "pump blocked: gradient and voltage gone", values: {naIn: 145, vm: 0, step: 4}},
      {name: "lowest Na⁺, most negative voltage", values: {naIn: 5, vm: -100, step: 1}},
      {name: "voltage only", values: {naIn: 145, vm: -100, step: 4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, k = calc(v), out = s <= 3;
      var hex = function (q, r, o) { var p = []; for (var i = 0; i < 6; i++) p.push([q[0] + r * Math.cos(Math.PI / 6 + i * Math.PI / 3), q[1] + r * Math.sin(Math.PI / 6 + i * Math.PI / 3)]); api.polygon(p, Object.assign({fill: c.c4, fillOpacity: 0.85}, o || {})); };
      // membrane: two leaflets of heads
      api.rect(0, 94, 400, 28, {fill: c.ink, fillOpacity: 0.05, rx: 0});
      for (var x = 4; x < 400; x += 9) { api.circle([x, 96], 3, {fill: c.faint, fillOpacity: 0.5}); api.circle([x, 120], 3, {fill: c.faint, fillOpacity: 0.5}); }
      api.label([392, 12], "outside · Na⁺ " + NAO + " mM", {color: c.muted, size: 12, anchor: "end"});
      api.label([392, 206], "cytoplasm · Na⁺ " + api.fmt(v.naIn) + " mM", {color: c.muted, size: 12, anchor: "end"});
      // membrane voltage: + outside, - inside, more signs for a larger |Vm|
      var nq = Math.round(-v.vm / 100 * 7);
      for (var i = 0; i < nq; i++) {
        var qx = 274 + i * 17;
        api.label([qx, 86], "+", {color: c.c3, size: 13, anchor: "middle", weight: 700});
        api.label([qx, 131], "−", {color: c.c3, size: 13, anchor: "middle", weight: 700});
      }
      api.label([392, 108], "V_m " + api.fmt(v.vm) + " mV", {color: c.c3, size: 12, anchor: "end", weight: 650});
      // Na+ and glucose, outside and in: Na+ inside scales with [Na+]i
      OUT_NA.forEach(function (q) { api.circle(q, 4, {fill: c.c2}); });
      var nin = Math.max(1, Math.round(OUT_NA.length * v.naIn / NAO));
      IN_NA.slice(0, nin).forEach(function (q) { api.circle(q, 4, {fill: c.c2}); });
      OUT_G.forEach(function (q) { hex(q, 6); });
      IN_G.forEach(function (q) { hex(q, 6); });
      api.label([108, 38], "glucose", {color: c.c4, size: 12, anchor: "middle"});
      // the Na+/K+ pump (primary active transport)
      var lit = s === 1 ? 1 : 0.45;
      api.rect(48, 84, 46, 48, {fill: c.c1, fillOpacity: 0.3 * lit + 0.1, stroke: c.c1, width: 1.5, rx: 11, opacity: lit + 0.2});
      api.arrow([60, 140], [60, 52], {color: c.c2, width: 2.2, halo: false, head: 8, opacity: lit + 0.3});
      api.arrow([82, 52], [82, 140], {color: c.c6, width: 2.2, halo: false, head: 8, opacity: lit + 0.3});
      api.label([56, 42], "3 Na⁺", {color: c.c2, size: 12, anchor: "end", weight: 650});
      api.label([86, 150], "2 K⁺", {color: c.c6, size: 12, anchor: "start", weight: 650});
      api.label([54, 166], "ATP → ADP + P_i", {color: c.c5, size: 12, anchor: "middle", opacity: lit + 0.3});
      api.label([71, 108], "pump", {color: c.ink, size: 12, anchor: "middle", weight: 650});
      // the symporter: a cleft open to the outside (steps 1-3) or to the inside (step 4)
      var cx = 230;
      api.rect(cx - 30, 80, 60, 56, {fill: c.ink, fillOpacity: s > 1 ? 0.3 : 0.18, stroke: c.ink, width: 1.4, rx: 12});
      api.polygon(out ? [[cx - 15, 78], [cx + 15, 78], [cx, 116]] : [[cx - 15, 138], [cx + 15, 138], [cx, 100]], {fill: c.card, fillOpacity: 1});
      api.label([cx + 36, 108], v.carrier, {color: c.ink, size: 12, weight: 650});
      var sites = k.n === 2 ? [[cx - 20, 108], [cx + 20, 108]] : [[cx - 20, 108]];
      if (s === 2 || s === 3) sites.forEach(function (q) { api.circle(q, 4.5, {fill: c.c2, stroke: c.card, width: 1.5}); });
      if (s === 3) hex([cx, 92], 6.5);
      if (s === 2 || s === 3) {   // the approach into the cleft
        api.arrow([cx - 34, 60], [cx - 8, 84], {color: s === 2 ? c.c2 : c.c4, width: 2, halo: false, head: 8});
      }
      if (s === 4) {
        var rel = k.n === 2 ? [[cx - 16, 154], [cx - 4, 170]] : [[cx - 10, 160]];
        rel.forEach(function (q) { api.circle(q, 4.5, {fill: c.c2}); });
        hex([cx + 14, 160], 6.5);
        api.arrow([cx - 44, 58], [cx - 44, 166], {color: c.c2, width: 2.4, halo: false, head: 9});
        api.label([cx - 50, 166], "downhill", {color: c.c2, size: 12, anchor: "end", weight: 650});
        api.arrow([cx + 44, 70], [cx + 44, 132], {color: c.c4, width: 2.4, halo: false, head: 9});
        api.label([cx + 48, 142], "uphill", {color: c.c4, size: 12, anchor: "start", weight: 650});
      }
      // the ceiling on glucose accumulation, log scale, split into the concentration and voltage parts
      var x0 = 24, dec = 50, by = 238, lc = Math.log10(k.conc), lv = Math.log10(k.volt);
      api.label([10, 222], "most glucose in ÷ out: " + sig(k.ratio) + "× (log scale)", {color: c.ink, size: 12, weight: 650});
      api.rect(x0, by, 7 * dec, 16, {fill: c.ink, fillOpacity: 0.05, rx: 3});
      if (lc > 0.005) api.rect(x0, by, lc * dec, 16, {fill: c.c2, fillOpacity: 0.85, rx: 3});
      if (lv > 0.005) api.rect(x0 + lc * dec, by, lv * dec, 16, {fill: c.c3, fillOpacity: 0.85, rx: 3});
      for (var d = 0; d <= 7; d++) {
        api.line([x0 + d * dec, by + 18], [x0 + d * dec, by + 22], {color: c.axis, width: 1});
        api.label([x0 + d * dec, by + 31], d === 0 ? "1" : d === 1 ? "10" : "10^" + d, {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x0, 290], "×" + sig(k.conc) + " Na⁺ gradient", {color: c.c2, size: 12, weight: 650});
      api.label([392, 290], "×" + sig(k.volt) + " voltage", {color: c.c3, size: 12, weight: 650, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
