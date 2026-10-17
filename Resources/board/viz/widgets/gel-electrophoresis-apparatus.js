// A horizontal agarose gel box seen from above. The gel sits under buffer between two platinum electrodes; the power
// supply's black (−) lead goes to the end with the wells and the red (+) lead to the far end, because DNA's phosphate
// backbone is negative and runs toward + ("run to red"). The field is E = V / L with L the electrode spacing (15 cm
// here); a band moves d = μ E t. The loading dyes are the visible progress bar: in a 1% gel bromophenol blue runs with
// DNA of roughly 300 bp (μ ≈ 0.18 mm/min per V/cm, a calibrated round figure) and xylene cyanol with roughly 4 kb
// (μ ≈ 0.065). Water splits at the electrodes: hydrogen at the cathode (−), oxygen at the anode (+), two bubbles of H2
// for each of O2. Above about 10 V/cm a gel heats and bands smear. Reversed leads send the DNA out of the wells backward.
(function () {
  var L = 15, MU_B = 0.18, MU_X = 0.065, GEL = 70, X0 = 78, PX = 3.6, LANES = [144, 170, 196, 222];
  function model(v) {
    var E = v.V / L, db = MU_B * E * v.t, dx = MU_X * E * v.t, rev = v.leads === "reversed";
    return {E: E, db: db, dx: dx, rev: rev, off: !rev && db > GEL, offX: !rev && dx > GEL};
  }

  Viz.register("gel-electrophoresis-apparatus", {
    title: "Gel electrophoresis: the setup",
    subject: "biology",
    shows: "Set the voltage, the run time and which lead goes where: DNA is negative, so with black at the wells it runs toward red, at a speed set by the field V/L",
    params: {
      V: {kind: "integer", default: 100, min: 25, max: 200, step: 5, label: "V\\ (\\text{volts})"},
      t: {kind: "integer", default: 30, min: 0, max: 90, step: 5, label: "t\\ (\\text{min})"},
      leads: {kind: "enum", values: ["correct", "reversed"], names: {correct: "black at wells", reversed: "red at wells"}, default: "correct", label: "\\text{leads}"}
    },
    formula: function (v) {
      var m = model(v), sg = m.rev ? "-" : "";   // reversed leads: the dye moves away from the gel, a negative distance
      var where = m.rev ? (X0 - m.db * PX < 62 ? "\\text{, off the gel}" : "") : m.db > GEL ? "\\text{, past the " + GEL + " mm gel}" : "";
      return "\\begin{array}{l}E=\\frac{V}{L}=\\frac{" + v.V + "}{15}=" + Viz.n(m.E, 2) + "\\ \\text{V/cm}\\\\ d_{\\text{blue}}=" + sg + "\\mu E t=" + sg + "0.18\\cdot " + Viz.n(m.E, 2) + "\\cdot " + v.t +
        "\\\\ \\phantom{d_{\\text{blue}}}=" + (m.db ? sg : "") + Viz.n(m.db, 0) + "\\text{ mm}" + where + "\\end{array}";
    },
    status: function (v) {
      var m = model(v), hot = m.E > 10 ? ", and above about 10 V/cm the gel heats and the bands smear" : "";
      if (m.rev) return "The red (+) lead is on the well end, so the negative DNA runs backward out of the wells" + (!v.t ? "" : X0 - m.db * PX < 62 ? " into the buffer and is lost" : " toward the near edge of the gel") + ": swap the leads, black at the wells, <b>run to red</b>.";
      if (!v.t) return "Ready: wells at the black (−) end, so the negative DNA will run toward red (+), in a field of <b>" + Viz.fmt(m.E, 1) + " V/cm</b>" + hot + ".";
      if (m.offX) return "Both dyes ran off the far end (blue at about " + Math.round(GEL / (MU_B * m.E)) + " min, cyan at about <b>" + Math.round(GEL / (MU_X * m.E)) + " min</b>), taking DNA up to about 4 kb with them" + hot + ": stop when the blue dye is three quarters down.";
      if (m.off) return "The blue dye ran off the far end at about " + Math.round(GEL / (MU_B * m.E)) + " min, taking DNA of about 300 bp and smaller with it, while the cyan one is at <b>" + Math.round(m.dx) + " mm</b>" + hot + ": stop when the blue dye is three quarters down.";
      return "At " + Viz.fmt(m.E, 1) + " V/cm the blue dye front (≈300 bp) has run <b>" + Math.round(m.db) + " mm</b> of the gel's " + GEL + " mm and the cyan one (≈4 kb) <b>" + Math.round(m.dx) + " mm</b>" + hot + ".";
    },
    examples: [
      {name: "loaded, not yet running", values: {V: 100, t: 0}},
      {name: "low voltage: 30 min barely moves the dyes", values: {V: 25, t: 30}},
      {name: "high voltage, long run: dye runs off", values: {V: 200, t: 90}},
      {name: "leads reversed", values: {V: 100, t: 30, leads: "reversed"}}
    ],
    size: [400, 334],
    draw: function (api, v) {
      var c = api.color, m = model(v), neg = c.muted, pos = c.c5;
      var wellEnd = m.rev ? pos : neg, farEnd = m.rev ? neg : pos;
      // ---- the power supply and its two leads ----
      api.rect(126, 6, 148, 48, {fill: c.ink, fillOpacity: 0.06, stroke: c.faint, width: 1.2, rx: 8});
      api.rect(136, 14, 70, 26, {fill: c.c4, fillOpacity: 0.12, stroke: c.c4, width: 1, rx: 4});
      api.label([171, 27], v.V + " V", {color: c.c4, size: 14, weight: 700, anchor: "middle"});
      api.circle([232, 26], 6, {fill: neg}); api.circle([256, 26], 6, {fill: pos});
      api.label([222, 26], "−", {color: c.ink, size: 14, weight: 700, anchor: "middle"});
      api.label([266, 26], "+", {color: pos, size: 14, weight: 700, anchor: "middle"});
      var lead = function (from, toX, yRun, col) { api.path("M " + from + " 32 L " + from + " " + yRun + " L " + toX + " " + yRun + " L " + toX + " 100", {stroke: col, width: 2.2}); };
      if (!m.rev) { lead(232, 30, 66, neg); lead(256, 370, 72, pos); }
      else { lead(232, 370, 66, neg); lead(256, 30, 74, pos); }
      // ---- the chamber, buffer, electrodes ----
      api.rect(16, 88, 368, 190, {fill: c.c2, fillOpacity: 0.08, stroke: c.axis, width: 1.2, rx: 8});
      api.line([30, 100], [30, 266], {color: wellEnd, width: 2.5});
      api.line([370, 100], [370, 266], {color: farEnd, width: 2.5});
      api.label([38, 80], m.rev ? "+ anode" : "− cathode", {color: m.rev ? pos : c.ink, size: 12});
      api.label([362, 80], m.rev ? "cathode −" : "anode +", {color: m.rev ? c.ink : pos, size: 12, anchor: "end"});
      // electrolysis bubbles once current flows: H2 at the cathode, twice as many as O2 at the anode
      if (v.t > 0) {
        var bub = function (x, nB, side) { for (var i = 0; i < nB; i++) api.circle([x + side * (5 + (i % 2) * 5), 110 + i * 150 / nB], 2.6, {stroke: c.ink, width: 1, fill: "none"}); };
        bub(m.rev ? 370 : 30, 10, m.rev ? -1 : 1); bub(m.rev ? 30 : 370, 5, m.rev ? 1 : -1);
        api.label([m.rev ? 352 : 48, 270], "H_2", {color: c.muted, size: 12, anchor: "middle"});
        api.label([m.rev ? 48 : 352, 270], "O_2", {color: c.muted, size: 12, anchor: "middle"});
      }
      // ---- the gel, wells and the two dye fronts in each lane ----
      api.rect(62, 100, 276, 166, {fill: c.ink, fillOpacity: 0.07, stroke: c.faint, width: 1, rx: 3});
      var dir = m.rev ? -1 : 1, xb = X0 + dir * m.db * PX, xx = X0 + dir * m.dx * PX;
      var lostB = m.rev && xb < 62, lostX = m.rev && xx < 62;
      LANES.forEach(function (y) {
        api.rect(X0 - 2, y - 9, 4, 18, {fill: c.card, stroke: c.muted, width: 1, rx: 1});
        [[xx, c.c1, m.dx, lostX], [xb, c.c6, m.db, lostB]].forEach(function (d) {
          if (!m.rev && d[2] > GEL) return;                                  // ran off the far end
          if (d[3]) {                                                        // run backward out of the gel: a faded smear in the
            var both = lostB && lostX, top = both && d[1] === c.c1 ? y + 0.5 : y - 7;   // buffer gap, clear of the bubbles
            [0.12, 0.26, 0.34, 0.2].forEach(function (op, k) { api.rect(46 + k * 3.25, top, 3.6, both ? 6.5 : 14, {fill: d[1], fillOpacity: op, rx: 0}); });
            return;
          }
          api.rect(d[0] - 2.5, y - 8, 5, 16, {fill: d[1], fillOpacity: 0.9, rx: 1.5});
        });
      });
      if (!m.rev && v.t > 0) {                                              // how far each front has run, in its own color
        if (m.db <= GEL) api.label([xb, 110], Math.round(m.db) + " mm", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
        if (m.dx <= GEL) api.label([xx, 124], Math.round(m.dx) + " mm", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      }
      api.label([X0 - 4, 252], "wells", {color: c.muted, size: 12, anchor: "start"});
      if (m.offX) api.label([330, 252], "both dyes ran off", {color: c.ink, size: 12, anchor: "end"});
      else if (m.off) api.label([330, 252], "blue dye ran off", {color: c.c6, size: 12, anchor: "end"});
      else if (m.rev && v.t > 0) api.label([140, 252], lostB ? "← lost into the buffer" : "← running backward", {color: c.c5, size: 12});
      else api.arrow([150, 252], [250, 252], {color: c.c5, width: 2, halo: false, head: 8, label: "DNA runs to +", labelAt: "mid", labelOffset: [0, -12], labelSize: 12});
      // ---- key: which band is which loading dye ----
      [[30, c.c6, "bromophenol blue ≈300 bp"], [220, c.c1, "xylene cyanol ≈4 kb"]].forEach(function (k) {
        api.rect(k[0], 285, 5, 14, {fill: k[1], fillOpacity: 0.9, rx: 1.5});
        api.label([k[0] + 11, 292], k[2], {color: k[1], size: 12, anchor: "start"});
      });
      // ---- the electrode spacing that sets the field ----
      api.line([30, 310], [370, 310], {color: c.muted, width: 1.2, arrow: true, arrowStart: true});
      api.label([200, 324], "15 cm between electrodes: E = " + api.fmt(m.E, 1) + " V/cm", {color: m.E > 10 ? c.c3 : c.muted, size: 12, anchor: "middle"});
      // viz.css paints svg text ink over the fill attribute; restate each label's color inline
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
