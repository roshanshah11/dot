// One replication fork, step by step. The fork moves right. The top template runs 3' -> 5' left to right, so its new
// strand grows 5' -> 3' toward the fork (leading); the bottom template runs the other way, so its new strand grows
// away from the fork in Okazaki fragments (lagging). Purple marks the enzyme at work in each step.
Viz.register("dna-replication", {
  title: "DNA replication at the fork",
  subject: "biology",
  shows: "Step through a replication fork: helicase opens it, primase lays RNA primers, polymerase builds the leading strand continuously and the lagging strand in Okazaki fragments, then pol I and ligase finish the job",
  params: {},
  steps: ["helicase opens", "primase primes", "leading strand", "Okazaki fragments", "pol I + ligase"],
  stepMs: 1800,
  formula: function (v) {
    return ["\\text{helicase} + \\text{SSB} + \\text{topoisomerase}",
            "\\text{RNA primer} \\Rightarrow \\text{a free } 3'\\text{-OH}",
            "5' \\to 3' \\text{ toward the fork: leading}",
            "5' \\to 3' \\text{ away from the fork: lagging}",
            "\\text{pol I: RNA} \\to \\text{DNA},\\ \\ \\text{ligase seals nicks}"][(v.step || 1) - 1];
  },
  status: function (v) {
    return ["Helicase breaks the hydrogen bonds and unzips the helix; <b>SSB</b> proteins hold the strands apart and <b>topoisomerase</b> relieves the over-winding ahead.",
            "Polymerase can only add to an existing 3′ end, so <b>primase</b> lays short RNA primers: one for the leading strand, one per fragment on the lagging strand.",
            "<b>DNA polymerase III</b> reads the template 3′→5′ and adds to the new strand's 3′ end, so here it runs continuously toward the fork: the <b>leading strand</b>.",
            "The other template runs the opposite way, so its copy is made away from the fork in short <b>Okazaki fragments</b>, each from its own primer.",
            "<b>DNA polymerase I</b> swaps each RNA primer for DNA and <b>DNA ligase</b> seals the nicks, joining the fragments into one strand."][(v.step || 1) - 1];
  },
  examples: [{name: "fork opened", values: {step: 1}}, {name: "Okazaki fragments", values: {step: 4}}, {name: "finished", values: {step: 5}}],
  size: [400, 240],
  draw: function (api, v) {
    var c = api.color, s = v.step || 1;
    var yT = 64, yB = 206, yP = 122, yQ = 148, yL = 84, yG = 186, fx = 270;
    var rung = function (x, y0, y1, col) { api.line([x, y0], [x, y1], {color: col || c.faint, width: 1.2}); };
    var bez = function (t, a, b, cc, d) { var u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * cc + t * t * t * d; };
    // parental duplex ahead of the fork, and the two separated templates behind it
    for (var x = fx + 6; x < 390; x += 8) rung(x, yP + 3, yQ - 3);
    api.path("M 392 " + yP + " L " + fx + " " + yP + " C 246 " + yP + " 246 " + yT + " 222 " + yT + " L 16 " + yT, {stroke: c.c1, width: 4.5});
    api.path("M 392 " + yQ + " L " + fx + " " + yQ + " C 246 " + yQ + " 246 " + yB + " 222 " + yB + " L 16 " + yB, {stroke: c.c2, width: 4.5});
    api.label([9, yT], "3′", {color: c.c1, size: 12, anchor: "middle"});
    api.label([391, yP - 13], "5′", {color: c.c1, size: 12, anchor: "middle"});
    api.label([9, yB], "5′", {color: c.c2, size: 12, anchor: "middle"});
    api.label([391, yQ + 13], "3′", {color: c.c2, size: 12, anchor: "middle"});
    api.arrow([318, 22], [372, 22], {color: c.muted, width: 2, halo: false});
    api.label([312, 22], "fork moves", {color: c.muted, size: 12, anchor: "end"});
    var on = function (k) { return s === k; };
    var enzyme = function (at, w, h, name, active, labelAt, anchor) {
      api.rect(at[0] - w / 2, at[1] - h / 2, w, h, {fill: c.c6, fillOpacity: active ? 0.35 : 0.08, stroke: c.c6, width: active ? 2 : 1, rx: h / 2, opacity: active ? 1 : 0.55});
      api.label(labelAt, name, {color: active ? c.c6 : c.muted, size: 12, weight: active ? 700 : 500, anchor: anchor || "middle"});
    };
    // SSB on the single-stranded lagging template
    [0.35, 0.68].forEach(function (t) {
      api.circle([bez(t, fx, 246, 246, 222) + 5, bez(t, yQ, yQ, yB, yB) + 2], 5, {fill: c.muted, fillOpacity: on(1) ? 0.9 : 0.45});
    });
    api.label([264, 192], "SSB", {color: on(1) ? c.ink : c.muted, size: 12, weight: on(1) ? 650 : 500});
    enzyme([fx - 4, (yP + yQ) / 2], 22, 34, "helicase", on(1), [fx + 12, yP - 16], "start");
    enzyme([345, (yP + yQ) / 2], 30, 40, "topoisomerase", on(1), [345, yQ + 26]);
    // leading strand: one primer at the left, extended toward the fork from step 3
    var lead = s >= 3 ? 232 : 36;
    if (s >= 2) {
      for (x = 24; x < lead - 2; x += 8) rung(x, yT + 4, yL - 4, x < 36 ? c.c5 : c.c3);
      if (s >= 3) api.arrow([36, yL], [lead, yL], {color: c.c3, width: 4, halo: false});
      api.line([22, yL], [36, yL], {color: s === 5 ? c.c3 : c.c5, width: 5});
      api.label([10, yL], "5′", {color: c.c3, size: 12, anchor: "middle"});
    }
    if (s === 2) api.label([44, yL + 2], "RNA primer", {color: c.c5, size: 12.5, weight: 650});
    if (s >= 3) {
      api.label([112, yL + 17], "leading strand (continuous)", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      enzyme([lead + 4, yL], 26, 18, "pol III", on(3), [lead - 4, yT - 18]);
    }
    // lagging strand: three Okazaki fragments, each begun at its own primer (5' end, right) and made leftward
    var frags = [[96, 22], [166, 100], [226, s >= 5 ? 172 : 190]];
    if (s >= 2) frags.forEach(function (f, i) {
      var grown = s >= 4 ? f[1] : f[0] - 12, replaced = s === 5 && i === 0;
      for (x = f[0] - 3; x > grown + 2; x -= 8) rung(x, yG + 4, yB - 4, x > f[0] - 12 && !replaced ? c.c5 : c.c3);
      if (s >= 4) api.arrow([f[0] - 12, yG], [grown, yG], {color: c.c3, width: 4, halo: false});
      api.line([f[0] - 12, yG], [f[0], yG], {color: replaced ? c.c3 : c.c5, width: 5});
    });
    if (s >= 2) api.label([233, yG - 12], "5′", {color: c.c3, size: 12, anchor: "middle"});
    if (s === 2) {
      enzyme([204, yG - 22], 34, 14, "primase", true, [204, yG - 40]);   // clear of the lagging strand's 5′ label
      api.label([122, yB + 20], "RNA primers, one per fragment", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
    }
    if (s >= 4) api.label([122, yB + 20], "lagging strand: Okazaki fragments", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
    if (s === 4) enzyme([186, yG], 22, 16, "pol III", true, [186, yG - 20]);
    if (s === 5) {
      enzyme([160, yG], 22, 16, "pol I", true, [160, yG - 20]);
      api.circle([98, yG], 7, {fill: c.c6, fillOpacity: 0.35, stroke: c.c6, width: 2});
      api.label([98, yG - 20], "ligase", {color: c.c6, size: 12, weight: 700, anchor: "middle"});
    }
  }
});
