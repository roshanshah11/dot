// Treadmilling of one actin filament. Each end adds subunits at k_on*c and loses them at k_off (per second). Rate
// constants for ATP-actin from Pollard (1986, J Cell Biol 103:2747): barbed end k_on 11.6 /uM/s, k_off 1.4 /s
// (Cc+ = 0.12 uM); pointed end k_on 1.3 /uM/s, k_off 0.8 /s (Cc- = 0.62 uM). The ends differ because the filament
// hydrolyzes its ATP: new subunits carry ATP, older ones toward the pointed end hold ADP and let go more easily.
// Between the two critical concentrations the barbed end grows while the pointed end shrinks; at
// c = (1.4 + 0.8)/(11.6 + 1.3) = 0.17 uM the two rates cancel and the filament treadmills at constant length.
// One subunit adds 2.7 nm of filament length (370 subunits per micrometre).
(function () {
  var KB = 11.6, OB = 1.4, KP = 1.3, OP = 0.8, CSS = (OB + OP) / (KB + KP);
  function rates(c) { var b = KB * c - OB, p = KP * c - OP; return {b: b, p: p, net: b + p}; }
  function sg(x) { return (x < 0 ? "−" : "+") + Viz.fmt(Math.abs(x)); }

  Viz.register("actin-filament-treadmilling", {
    title: "Actin treadmilling",
    subject: "biology",
    shows: "Slide the free ATP-actin concentration: each end grows at k_on c - k_off; between the two critical concentrations the barbed end gains while the pointed end loses, and at 0.17 µM the two cancel so the filament keeps its length while subunits flow through it",
    params: {
      c: {kind: "number", default: 0.17, min: 0.05, max: 0.8, step: 0.01, label: "c\\ (\\mu\\text{M})"}
    },
    formula: function (v) {
      var r = rates(v.c), cs = Viz.n(v.c);
      return "J_B = 11.6\\cdot" + cs + " - 1.4 = " + Viz.n(r.b) + "\\newline J_P = 1.3\\cdot" + cs + " - 0.8 = " + Viz.n(r.p) +
        "\\newline \\tfrac{dL}{dt} = J_B + J_P = " + Viz.n(Math.round(r.b * 100) / 100 + Math.round(r.p * 100) / 100) + "\\ \\text{subunits/s}";
    },
    status: function (v) {
      var r = rates(v.c), net = Math.round(r.b * 100) / 100 + Math.round(r.p * 100) / 100, nm = Viz.fmt(Math.abs(net) * 2.7, 1) + " nm/s";
      if (r.b < 0) return "Below both critical concentrations, <b>both ends lose subunits</b>, so the filament shrinks by " + Viz.fmt(-net) + " subunits/s (" + nm + ").";
      if (Math.abs(net) < 0.15) return "<b>Treadmilling</b>: the barbed end adds " + Viz.fmt(r.b) + " subunits/s while the pointed end loses " + Viz.fmt(-r.p) + ", so the length stays nearly constant while subunits flow in at the + end and out at the − end.";
      if (Math.abs(r.p) < 0.05) return (Math.abs(r.p) < 0.01 ? "At the pointed end's critical concentration (0.62 µM) the pointed end <b>neither gains nor loses</b>" : "Near the pointed end's critical concentration (0.62 µM) the pointed end <b>barely changes</b> (" + sg(r.p) + "/s)") +
        "; only the barbed end grows, " + Viz.fmt(r.b) + " subunits/s (" + Viz.fmt(r.b * 2.7, 1) + " nm/s).";
      if (r.p < 0) return "Between the critical concentrations the barbed end gains " + Viz.fmt(r.b) + "/s and the pointed end loses " + Viz.fmt(-r.p) + "/s, so the filament <b>" + (net > 0 ? "lengthens" : "shortens") + "</b> by " + Viz.fmt(Math.abs(net)) + " subunits/s (" + nm + ").";
      return "Above both critical concentrations <b>both ends grow</b>: " + Viz.fmt(r.b) + " subunits/s at the barbed end and " + Viz.fmt(r.p) + " at the pointed end, " + nm + " in all.";
    },
    examples: [
      {name: "minimum: both ends shrink", values: {c: 0.05}},
      {name: "maximum: both ends grow", values: {c: 0.8}},
      {name: "treadmilling at 0.17 µM", values: {c: 0.17}},
      {name: "barbed grows, pointed shrinks", values: {c: 0.4}},
      {name: "at the pointed end's Cc", values: {c: 0.62}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, r = rates(v.c), yF = 64, xP = 76, xB = 322, n = 35, dx = (xB - xP) / (n - 1);
      // ---- the filament: two strands of subunits, ATP at the young barbed end, ADP toward the old pointed end ----
      for (var i = 0; i < n; i++) {
        var age = n - 1 - i, col = age < 7 ? c.c3 : age < 14 ? c.c3 : c.c2, op = age < 7 ? 1 : age < 14 ? 0.45 : 0.85;
        api.circle([xP + i * dx, yF + (i % 2 ? 5 : -5)], 5.6, {fill: col, fillOpacity: op});
      }
      api.label([xP + 3 * dx, yF + 24], "ADP", {color: c.c2, size: 12, anchor: "middle"});
      api.label([xP + 24.5 * dx, yF + 24], "ADP-Pᵢ", {color: c.c3, size: 12, anchor: "middle", raw: true});
      api.label([xP + 31 * dx, yF + 24], "ATP", {color: c.c3, size: 12, anchor: "middle"});
      api.label([xP - 4, 18], "pointed (−) end", {color: c.c6, size: 12.5, weight: 650});
      api.label([xB + 4, 18], "barbed (+) end", {color: c.c1, size: 12.5, weight: 650, anchor: "end"});
      // each end: a free subunit arriving (net gain) or leaving (net loss), with the net rate
      var end = function (x, dir, J, col, sub) {
        var far = x + dir * 40, lab = sg(J) + "/s";
        if (Math.abs(J) < 0.005) { api.label([x + dir * 14, yF - 22], "0/s", {color: col, size: 12.5, weight: 650, anchor: dir < 0 ? "end" : "start"}); return; }
        if (J > 0) { api.circle([far, yF], 5.6, {fill: c.c3}); api.arrow([far - dir * 8, yF], [x + dir * 9, yF], {color: col, width: 2.5, halo: false}); }
        else { api.circle([far, yF], 5.6, {fill: sub, fillOpacity: 0.85}); api.arrow([x + dir * 8, yF], [far - dir * 9, yF], {color: col, width: 2.5, halo: false}); }
        api.label([x + dir * 26, yF - 22], lab, {color: col, size: 12.5, weight: 650, anchor: "middle"});
      };
      end(xB, 1, r.b, c.c1, c.c3);
      end(xP, -1, r.p, c.c6, c.c2);
      if (r.b > 0 && r.p < 0) {
        api.arrow([xB - 30, yF + 40], [xP + 30, yF + 40], {color: c.ink, width: 1.8, halo: false, dash: "5 4"});
        api.label([(xP + xB) / 2, yF + 54], "in at +, ages from ATP to ADP, out at −", {color: c.muted, size: 12, anchor: "middle"});
      }
      // ---- rates against concentration ----
      var X0 = 52, X1 = 382, Yt = 148, Yb = 264, lo = -1.5, hi = 8;
      var px = function (x) { return X0 + (X1 - X0) * x / 0.8; }, py = function (y) { return Yb - (Yb - Yt) * (y - lo) / (hi - lo); };
      api.line([X0, py(0)], [X1 + 4, py(0)], {color: c.axis, width: 1.3});
      api.line([X0, Yb], [X0, Yt - 6], {color: c.axis, width: 1.3});
      [0, 4, 8].forEach(function (y) { api.label([X0 - 6, py(y)], String(y), {color: c.muted, size: 12, anchor: "end"}); });
      api.label([X0 + 6, Yt - 8], "subunits/s", {color: c.muted, size: 12});
      [0.2, 0.4, 0.6, 0.8].forEach(function (x) { api.label([px(x), Yb + 12], api.fmt(x), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([X1, Yb + 27], "free ATP-actin c (µM)", {color: c.muted, size: 12, anchor: "end"});
      api.line([px(CSS), Yt], [px(CSS), Yb], {color: c.ink, width: 1, dash: "2 4", opacity: 0.5});
      api.label([px(CSS) + 4, Yt + 4], "treadmilling 0.17", {color: c.muted, size: 12});
      api.point([px(OB / KB), py(0)], {color: c.c1, r: 3.5});
      api.label([X0 + 4, py(0) - 11], "Cc⁺ 0.12", {color: c.c1, size: 12, raw: true});
      api.point([px(OP / KP), py(0)], {color: c.c6, r: 3.5});
      api.label([px(OP / KP) + 6, py(0) + 15], "Cc⁻ 0.62", {color: c.c6, size: 12, raw: true});
      api.line([px(0), py(-OB)], [px(0.8), py(KB * 0.8 - OB)], {color: c.c1, width: 2.4});
      api.line([px(0), py(-OP)], [px(0.8), py(KP * 0.8 - OP)], {color: c.c6, width: 2.4});
      api.label([px(0.45) - 4, py(KB * 0.45 - OB) - 10], "barbed", {color: c.c1, size: 12, anchor: "end"}); // left of and above the line, off the marker's path
      api.label([X1, py(KP * 0.8 - OP) - 11], "pointed", {color: c.c6, size: 12, anchor: "end"});
      api.line([px(v.c), Yt], [px(v.c), Yb], {color: c.ink, width: 1.2, opacity: 0.45});
      api.point([px(v.c), py(r.b)], {color: c.c1, r: 5, stroke: c.ink});
      api.point([px(v.c), py(r.p)], {color: c.c6, r: 5, stroke: c.ink});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
