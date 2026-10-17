// How a dividing cell makes sure each daughter gets one copy of every chromosome. Sister kinetochores must attach to
// opposite poles (bi-orientation, amphitelic) so the spindle puts them under tension. Any unattached kinetochore makes
// the spindle assembly checkpoint (SAC) signal: Mad2 and partners hold Cdc20, so APC/C stays off, securin keeps
// separase inhibited and cohesin keeps the sisters together. Attachments without tension (syntelic: both sisters to
// one pole) are released by Aurora B, which creates unattached kinetochores and so also delays anaphase. When every
// kinetochore is attached and under tension the signal stops: APC/C-Cdc20 tags securin for destruction, separase cuts
// cohesin, kinetochore fibers shorten (anaphase A) and the poles move apart (anaphase B). Merotelic attachment (one
// kinetochore held by both poles) is attached and under tension, so the SAC misses it; the chromatid lags in anaphase
// and can end up in a micronucleus or the wrong daughter.
(function () {
  var ROWS = [60, 98, 136, 174], HI = 3;
  function chain(v) {
    var s = v.step || 1, err = v.attach === "monotelic" || v.attach === "syntelic";
    var sac = err && s === 1, cut = err ? s >= 3 : s >= 2;
    return {sac: sac, cut: cut};
  }
  function counts(v) {
    var s = v.step || 1;
    if (s === 1 && v.attach === "monotelic") return [7, 6];
    if (s === 1 && v.attach === "syntelic") return [8, 6];
    return [8, 8];
  }
  Viz.register("mitosis-chromosome-segregation", {
    title: "Chromosome segregation and the spindle checkpoint",
    subject: "biology",
    shows: "Pick how one chromosome's sister kinetochores attach and step through anaphase: an unattached or tensionless kinetochore keeps the checkpoint on and anaphase waits; bi-orientation lets separase cut cohesin; a merotelic chromatid slips past the checkpoint and lags",
    params: {
      attach: {kind: "enum", values: ["amphitelic", "monotelic", "syntelic", "merotelic"], default: "amphitelic", label: "\\text{attach}",
        names: {amphitelic: "bi-oriented", monotelic: "one unattached", syntelic: "both to one pole", merotelic: "merotelic"}}
    },
    steps: ["metaphase: attachment check", "checkpoint decision", "anaphase A: chromatids to poles", "anaphase B: poles move apart"],
    stepMs: 1900,
    formula: function (v) {
      var s = v.step || 1, k = chain(v), n = counts(v);
      if (s <= 2) {
        var l1 = "\\text{attached}=" + n[0] + "/8,\\ \\ \\text{under tension}=" + n[1] + "/8";
        var l2 = k.sac ? "\\Rightarrow\\text{SAC on}\\dashv\\text{APC/C: anaphase waits}"
          : k.cut ? "\\Rightarrow\\text{securin destroyed, separase cuts cohesin}" : "\\Rightarrow\\text{SAC off, APC/C}^{\\text{Cdc20}}\\ \\text{active}";
        return l1 + "\\newline " + l2;
      }
      var mero = v.attach === "merotelic";
      return (s === 3 ? "\\text{anaphase A: kinetochore fibers shorten}" : "\\text{anaphase B: poles move apart}") +
        "\\newline \\text{pole 1}=4,\\ \\ \\text{pole 2}=" + (mero ? "3,\\ \\ \\text{lagging}=1" : "4");
    },
    status: function (v) {
      var s = v.step || 1, a = v.attach;
      var T = {
        amphitelic: ["Every pair is bi-oriented: sister kinetochores face opposite poles and are <b>stretched under tension</b>, so the checkpoint falls silent.",
          "APC/C-Cdc20 tags securin for destruction; freed <b>separase cuts cohesin</b> and the sisters let go of each other.",
          "Anaphase A: kinetochore fibers shorten and each chromatid moves <b>centromere first</b> to its own pole.",
          "Anaphase B: the poles move apart and each pole ends with <b>4 chromatids</b>, one copy of every chromosome."],
        monotelic: ["One kinetochore is <b>unattached</b>: it emits the Mad2 'wait' signal, so APC/C stays blocked, securin holds separase and cohesin stays intact.",
          "The far pole <b>captures</b> the free kinetochore; with all 8 attached and under tension the signal stops and APC/C turns on.",
          "Only now is securin destroyed and cohesin cut: after the delay, anaphase A runs normally.",
          "The checkpoint bought time to fix it, so each pole still gets <b>4</b>."],
        syntelic: ["Both sisters face <b>one pole</b>: attached but with <b>no tension</b>, so Aurora B releases them, the free kinetochores signal and anaphase waits.",
          "A released kinetochore is <b>re-captured by the far pole</b>; bi-oriented and under tension, the checkpoint can go silent.",
          "After the correction separase cuts cohesin and the chromatids move to opposite poles.",
          "The error was caught in time, so each pole still gets <b>4</b>."],
        merotelic: ["One kinetochore is held by microtubules from <b>both poles</b>; it is attached and under tension, so the checkpoint <b>does not see</b> the error.",
          "The checkpoint goes silent on schedule: securin is destroyed and separase cuts cohesin.",
          "Pulled toward both poles at once, the merotelic chromatid <b>lags</b> in the middle of the spindle.",
          "The lagging chromatid may be left in a <b>micronucleus</b> or reach the wrong daughter: <b>4 : 3</b> plus one, a route to aneuploidy."]
      };
      return T[a][s - 1];
    },
    examples: [
      {name: "bi-oriented, anaphase B", values: {attach: "amphitelic", step: 4}},
      {name: "unattached kinetochore holds the checkpoint", values: {attach: "monotelic", step: 1}},
      {name: "syntelic, before correction", values: {attach: "syntelic", step: 1}},
      {name: "merotelic chromatid lags", values: {attach: "merotelic", step: 4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, a = v.attach, k = chain(v), cx = 200;
      var pw = s === 4 ? 180 : 160, L = [cx - pw, 120], R = [cx + pw, 120];
      var fiber = function (pole, to, col, w) { [-3, 0, 3].forEach(function (d) { api.line(pole, [to[0], to[1] + d], {color: col || c.muted, width: w || 1.1, opacity: 0.85}); }); };
      // interpolar microtubules overlapping at the middle (longer in anaphase B)
      var ov = s === 4 ? 40 : 18;
      [-16, -6, 6, 16].forEach(function (d) { api.line(L, [cx + ov, 120 + d * 4], {color: c.muted, width: 1, opacity: 0.3}); api.line(R, [cx - ov, 120 + d * 4], {color: c.muted, width: 1, opacity: 0.3}); });
      // a duplicated chromosome; kL / kR are the kinetochore positions returned for the fibers
      var pair = function (x, y, col, stretch, rot) {
        var sep = stretch ? 7.5 : 4.5;
        [-1, 1].forEach(function (sg) {
          api.path("M " + (x + sg * (sep + 3)) + " " + (y - 15) + " Q " + (x + sg * sep) + " " + y + " " + (x + sg * (sep + 3)) + " " + (y + 15), {stroke: col, width: 6});
        });
        var kL = [x - sep - 6, y], kR = [x + sep + 6, y];
        api.rect(kL[0] - 2, y - 5, 4, 10, {fill: c.c3, rx: 1.5}); api.rect(kR[0] - 2, y - 5, 4, 10, {fill: c.c3, rx: 1.5});
        if (!k.cut) api.path("M " + (x - sep - 3) + " " + y + " A " + (sep + 3) + " 3.5 0 1 0 " + (x + sep + 3) + " " + y + " A " + (sep + 3) + " 3.5 0 1 0 " + (x - sep - 3) + " " + y, {stroke: c.c4, width: 2});
        return {kL: kL, kR: kR};
      };
      var single = function (x, y, col, dir, lag) {   // a chromatid in anaphase, centromere toward its pole
        var sp = lag ? 26 : 12;
        api.path("M " + (x - dir * sp) + " " + (y - 13) + " Q " + (x + dir * sp) + " " + y + " " + (x - dir * sp) + " " + (y + 13), {stroke: col, width: 6});
        api.rect(x + dir * 2 - 2, y - 5, 4, 10, {fill: c.c3, rx: 1.5});
        return [x, y];
      };
      ROWS.forEach(function (y, i) {
        var hi = i === HI, col = hi ? c.c6 : c.c2;
        if (s <= 2) {
          var x = cx, stretch = true, p;
          if (hi && a === "monotelic") { x = s === 1 ? 118 : 178; stretch = s === 2; }
          if (hi && a === "syntelic") { x = s === 1 ? 128 : 182; stretch = s === 2; }
          p = pair(x, y, col, stretch);
          if (hi && a === "monotelic" && s === 1) {
            fiber(L, p.kL);
            api.circle(p.kR, 9, {fill: c.c5, fillOpacity: 0.35}); api.circle(p.kR, 13, {stroke: c.c5, width: 1.2, dash: "2 3"});
            api.label([p.kR[0] + 16, y + 20], "unattached: 'wait' signal", {color: c.c5, size: 12, weight: 650});
          } else if (hi && a === "syntelic" && s === 1) {
            fiber(L, p.kL); fiber(L, p.kR);
            api.label([p.kR[0] + 12, y + 22], "both to one pole: no tension", {color: c.c5, size: 12, weight: 650});
          } else {
            fiber(L, p.kL);
            fiber(R, p.kR, hi && (a === "monotelic" || a === "syntelic") && s === 2 ? c.c3 : null, hi && s === 2 && a !== "amphitelic" && a !== "merotelic" ? 1.8 : null);
            if (hi && a === "merotelic") {
              api.line(L, [p.kR[0] + 1, y + 2], {color: c.c5, width: 1.8});
              api.label([cx + 22, y + 22], "one kinetochore, both poles", {color: c.c5, size: 12, weight: 650});
            }
            if (hi && (a === "monotelic" || a === "syntelic") && s === 2) api.label([cx + 22, y + 22], "captured by the far pole", {color: c.c3, size: 12, weight: 650});
          }
        } else {
          var d = s === 3 ? 78 : 136, lag = hi && a === "merotelic";
          fiber(L, single(cx - d, y, col, -1));
          if (lag) {
            var q = single(s === 3 ? cx + 14 : cx + 4, y, col, 1, true);
            fiber(R, q); api.line(L, [q[0], q[1] + 2], {color: c.c5, width: 1.8});
            api.label([cx, y + 26], s === 3 ? "lagging chromatid" : "micronucleus or wrong daughter", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
          } else fiber(R, single(cx + d, y, col, 1));
        }
      });
      [L, R].forEach(function (P) {
        for (var t = 0; t < 10; t++) { var an = t * Math.PI / 5; api.line([P[0] + 6 * Math.cos(an), P[1] + 6 * Math.sin(an)], [P[0] + 13 * Math.cos(an), P[1] + 13 * Math.sin(an)], {color: c.muted, width: 1, opacity: 0.6}); }
        api.circle(P, 5, {fill: c.c3});
      });
      if (s === 4) {
        api.arrow([L[0] + 22, 150], [L[0] - 2, 150], {color: c.ink, width: 2, halo: false}); api.arrow([R[0] - 22, 150], [R[0] + 2, 150], {color: c.ink, width: 2, halo: false});
      }
      if (s <= 2) api.line([cx, 38], [cx, 200], {color: c.faint, width: 1, dash: "3 4"});
      // the checkpoint's switch: each step inhibits the next
      var nodes = [["SAC", k.sac, k.sac ? "on" : "off", c.c5], ["APC/C", !k.sac, k.sac ? "blocked" : "active", c.c1],
        ["securin", !k.cut, k.cut ? "destroyed" : "present", c.muted], ["separase", k.cut, k.cut ? "active" : "held", c.c1], ["cohesin", !k.cut, k.cut ? "cut" : "intact", c.c4]];
      var y0 = 238, sp = 78, x0 = 42;
      nodes.forEach(function (nd, i) {
        var x = x0 + i * sp;
        api.rect(x - 31, y0 - 12, 62, 24, {fill: nd[3], fillOpacity: nd[1] ? 0.85 : 0.12, stroke: nd[3], width: 1.2, rx: 7});
        api.label([x, y0 + 0.5], nd[0], {color: nd[1] ? c.card : nd[3], size: 12, weight: 700, anchor: "middle"});
        api.label([x, y0 + 24], nd[2], {color: nd[1] ? c.ink : c.muted, size: 12, anchor: "middle"});
        if (i < 4) { api.line([x + 33, y0], [x + sp - 37, y0], {color: c.muted, width: 1.6}); api.line([x + sp - 37, y0 - 6], [x + sp - 37, y0 + 6], {color: c.muted, width: 2}); }
      });
      api.label([cx, 288], "each inhibits or removes the next", {color: c.faint, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
