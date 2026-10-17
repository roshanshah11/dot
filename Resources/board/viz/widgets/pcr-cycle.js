// One PCR cycle in three temperatures (denature, anneal, extend), then the doubling it repeats.
Viz.register("pcr-cycle", {
  title: "PCR: one cycle, then doubling",
  subject: "biology",
  shows: "Step through denature, anneal and extend on one template; slide the cycle count to see the copies double every cycle",
  params: {
    cycles: {kind: "integer", default: 3, min: 1, max: 30, label: "cycles"},
    start: {kind: "integer", default: 1, min: 1, max: 100, label: "N_0"}
  },
  steps: ["denature at 95 °C", "anneal primers at 55 °C", "extend at 72 °C"],
  stepMs: 1600,
  formula: function (v) {
    return "N = N_0\\cdot 2^{n} = " + v.start + "\\cdot 2^{" + v.cycles + "} = " + (v.start * Math.pow(2, v.cycles)).toLocaleString("en-US").replace(/,/g, "{,}");
  },
  status: function (v) {
    var s = v.step || 1;
    var what = ["Heat splits the double helix: the hydrogen bonds between the strands break, leaving two single-stranded templates.",
                "Cooling lets each primer bind its matching 3′ end, giving polymerase a starting point.",
                "Taq polymerase extends each primer 5′ to 3′, so one double strand has become two."][s - 1];
    return what + " After <b>" + v.cycles + "</b> cycle" + (v.cycles > 1 ? "s" : "") + ": <b>" + (v.start * Math.pow(2, v.cycles)).toLocaleString("en-US") + "</b> copies.";
  },
  examples: [{name: "one cycle", values: {cycles: 1, step: 3}}, {name: "thirty cycles", values: {cycles: 30, step: 3}}],
  size: [400, 300],
  draw: function (api, v) {
    var c = api.color, s = v.step || 1, x0 = 46, x1 = 330, len = x1 - x0;
    var temps = [95, 55, 72], t = temps[s - 1];
    // thermometer
    api.rect(362, 22, 14, 120, {fill: "none", stroke: c.muted, width: 1.2, rx: 7});
    var fillH = 120 * (t - 40) / 60;
    api.rect(364, 142 - fillH, 10, fillH - 2, {fill: s === 1 ? c.c5 : s === 2 ? c.c2 : c.c3, rx: 5});
    api.label([369, 156], t + " °C", {color: c.ink, size: 12.5, anchor: "middle", weight: 600});
    var gap = s === 1 ? 46 : 30, yTop = 70 - gap / 2, yBot = 70 + gap / 2;
    // template strands: top runs 5'->3' left to right, bottom 3'->5'
    api.line([x0, yTop], [x1, yTop], {color: c.c1, width: 6});
    api.line([x0, yBot], [x1, yBot], {color: c.c2, width: 6});
    api.label([x0 - 8, yTop], "5′", {color: c.c1, size: 12, anchor: "end"});
    api.label([x1 + 8, yTop], "3′", {color: c.c1, size: 12});
    api.label([x0 - 8, yBot], "3′", {color: c.c2, size: 12, anchor: "end"});
    api.label([x1 + 8, yBot], "5′", {color: c.c2, size: 12});
    if (s === 1) {
      for (var i = 0; i < 6; i++) api.label([x0 + 30 + i * 46, 70], "~", {color: c.c5, size: 15, anchor: "middle"});
    } else {
      // primers bind the 3' ends: forward on the bottom strand (left), reverse on the top strand (right)
      api.line([x0, yBot - 9], [x0 + 46, yBot - 9], {color: c.c4, width: 6});
      api.line([x1 - 46, yTop + 9], [x1, yTop + 9], {color: c.c4, width: 6});
      api.label([x0 + 23, yBot + 18], "primer", {color: c.c4, size: 12, anchor: "middle"});
      api.label([x1 - 23, yTop - 14], "primer", {color: c.c4, size: 12, anchor: "middle"});
      if (s === 3) {
        api.arrow([x0 + 46, yBot - 9], [x1 - 4, yBot - 9], {color: c.c3, width: 5, halo: false});
        api.arrow([x1 - 46, yTop + 9], [x0 + 4, yTop + 9], {color: c.c3, width: 5, halo: false});
        api.label([(x0 + x1) / 2, yBot + 20], "new strands (5′ → 3′)", {color: c.c3, size: 12.5, anchor: "middle"});
      }
    }
    // copies by cycle, log scale
    var bx = 46, by = 268, bw = 300, bh = 92, n = v.cycles, maxLog = Math.log10(v.start * Math.pow(2, 30));
    api.line([bx, by], [bx + bw, by], {color: c.axis, width: 1.2});
    api.label([bx, by - bh - 12], "copies per cycle (log scale)", {color: c.muted, size: 12});
    var barW = bw / 31;
    for (var k = 0; k <= 30; k++) {
      var val = v.start * Math.pow(2, k), hgt = bh * Math.max(0.02, Math.log10(val) / maxLog);
      api.rect(bx + k * barW + 1, by - hgt, barW - 2, hgt, {fill: k <= n ? c.c3 : c.grid, rx: 2, opacity: k === n ? 1 : 0.75});
    }
    api.label([bx, by + 13], "0", {color: c.muted, size: 12, anchor: "middle"});
    api.label([bx + bw, by + 13], "30 cycles", {color: c.muted, size: 12, anchor: "end"});
    api.label([bx + (n + 0.5) * barW, by - bh * Math.log10(v.start * Math.pow(2, n)) / maxLog - 12], "2" + "^" + "n", {color: c.c3, size: 12.5, anchor: "middle", weight: 650, raw: false});
  }
});
