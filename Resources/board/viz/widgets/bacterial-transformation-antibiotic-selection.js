// Bacterial transformation with antibiotic selection: competent cells and an ampR plasmid on ice, heat shock,
// recovery (the transformed cells start making beta-lactamase), then plating on ampicillin, where only cells that
// took up the plasmid survive to form colonies. Colonies N = TE x DNA (ug) x fraction plated (100 uL of 1 mL = 0.1).
(function () {
  var CELLS = [[44, 116, -12], [94, 124, 18], [62, 150, 4], [100, 168, -20], [44, 186, 25], [80, 206, -8]];
  var PL = [[70, 104], [110, 146], [30, 160], [112, 192], [72, 176], [64, 236], [90, 232]];
  var TX = 1;   // the one cell (CELLS[1]) that takes up a plasmid (PL[1]) in the cartoon
  function count(v) { return Math.round(Math.pow(10, v.te) * v.dna * 1e-4); }   // cfu/ug x ng/1000 x 0.1
  function rnd(i, j) { var x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); }
  function big(n) { return n.toLocaleString("en-US"); }
  function result(v) {
    var n = count(v);
    if (v.plate === "none") return "without ampicillin every cell, transformed or not, grows into a lawn, so the plate cannot show which took the plasmid.";
    if (v.dna <= 0) return "with no plasmid DNA no colony grows on ampicillin: this is the negative control.";
    if (n === 0) return "so few transformants are expected (" + Viz.fmt(Math.pow(10, v.te) * v.dna * 1e-4, 2) + ") that the plate is most likely empty.";
    if (n <= 300) return "<b>" + big(n) + "</b> colon" + (n === 1 ? "y grows" : "ies grow") + ", and every one carries the plasmid, because ampicillin kills cells without ampR.";
    return "about <b>" + big(n) + "</b> transformants is too many to count, so plate less of the culture or use less DNA.";
  }

  Viz.register("bacterial-transformation-antibiotic-selection", {
    title: "Transformation and antibiotic selection",
    subject: "biology",
    shows: "Step through ice, heat shock, recovery and plating; change the DNA, the efficiency or the plate to see which cells grow and how many colonies you get",
    params: {
      plate: {kind: "enum", values: ["ampicillin", "none"], names: {ampicillin: "+ ampicillin", none: "no antibiotic"}, default: "ampicillin", label: "plate"},
      dna: {kind: "number", default: 1, min: 0, max: 10, step: 0.1, label: "m\\,(\\text{ng})"},
      te: {kind: "integer", default: 6, min: 5, max: 9, label: "\\log\\text{TE}"}
    },
    steps: ["mix plasmid and cells on ice", "heat shock at 42 °C", "recover at 37 °C", "plate and grow overnight"],
    stepMs: 1800,
    formula: function (v) {
      return "N=\\text{TE}\\times m\\times f=10^{" + v.te + "}\\tfrac{\\text{cfu}}{\\mu\\text{g}}\\times" + Viz.n(v.dna / 1000, 4) + "\\,\\mu\\text{g}\\times0.1=" +
        big(count(v)).replace(/,/g, "{,}") + (v.plate === "none" ? "\\ \\text{(lost in a lawn)}" : "");
    },
    status: function (v) {
      var s = v.step || 1, r = result(v);
      var lead = ["On ice in CaCl₂ the plasmid DNA settles against the cell surface; ",
                  "A 45-second heat shock lets plasmid DNA slip into a rare cell; ",
                  "During an hour at 37 °C the transformed cells start making β-lactamase from ampR; ", ""][s - 1];
      return lead ? lead + r : r.charAt(0).toUpperCase() + r.slice(1);   // "<b>..." is unchanged by toUpperCase
    },
    examples: [
      {name: "negative control: no DNA", values: {dna: 0, step: 4}},
      {name: "no antibiotic: lawn", values: {plate: "none", step: 4}},
      {name: "too many to count", values: {te: 8, dna: 0.5, step: 4}},
      {name: "electrocompetent, lots of DNA", values: {te: 9, dna: 10, step: 4}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, n = count(v), amp = v.plate === "ampicillin";
      var cell = function (x, y, ang, w, h, o) {
        var r = api.rect(x - w / 2, y - h / 2, w, h, Object.assign({fill: c.c1, fillOpacity: 0.12, stroke: c.c1, width: 1.6, rx: h / 2}, o || {}));
        r.setAttribute("transform", "rotate(" + ang + " " + x + " " + y + ")");
      };
      var plasmid = function (p, r, o) { api.circle(p, r, Object.assign({stroke: c.c3, width: 2}, o || {})); };
      var enzyme = function (x, y) { [[-19, -6], [19, 5], [-6, -13], [8, 13], [16, -11], [-15, 11]].forEach(function (d) { api.circle([x + d[0], y + d[1]], 2.4, {fill: c.c4}); }); };
      if (s < 4) {
        api.label([71, 24], ["0 °C, CaCl₂", "42 °C for 45 s", "37 °C, 1 h in SOC"][s - 1], {color: c.ink, size: 13, weight: 650, anchor: "middle"});
        api.polygon([[22, 92], [120, 92], [120, 196], [83, 260], [59, 260], [22, 196]], {fill: s === 1 ? c.c2 : s === 2 ? c.c5 : c.c3, fillOpacity: 0.08});
        api.path("M 20 40 L 122 40 L 122 196 L 84 262 L 58 262 L 20 196 Z", {stroke: c.muted, width: 2});
        CELLS.forEach(function (q, i) {
          cell(q[0], q[1], q[2], 30, 13, s === 2 ? {dash: "3 2"} : null);
          if (i === TX && s >= 2) plasmid([q[0], q[1]], 3.6);
          if (i === TX && s === 3) enzyme(q[0], q[1]);
        });
        PL.forEach(function (p, i) {
          if (i !== TX || s === 1) plasmid(p, 5);
          else if (s === 2) { plasmid(p, 5, {dash: "2 2", opacity: 0.6}); api.line([p[0] - 3, p[1] - 6], [99, 133], {color: c.c3, width: 1.5, arrow: true}); }
        });
        var L = [[["competent cell", c.c1, 124], ["plasmid (ampR)", c.c3, 146]],
                 [["plasmid gets in", c.c3, 132], ["only a rare cell", c.muted, 150], ["takes one up", c.muted, 166]],
                 [["β-lactamase", c.c4, 118], ["made from ampR", c.muted, 134]]][s - 1];
        L.forEach(function (l) { api.label([128, l[2]], l[0], {color: l[1], size: 12.5}); });
      } else {
        // the selection itself: what happens to each kind of cell on this plate
        api.label([60, 58], "with plasmid", {color: c.c3, size: 12.5, anchor: "middle"});
        api.label([156, 58], "without", {color: c.muted, size: 12.5, anchor: "middle"});
        cell(60, 90, 0, 56, 24); plasmid([60, 90], 6); enzyme(60, 90);
        cell(156, 90, 0, 56, 24);
        api.arrow([60, 112], [60, 146], {color: c.muted, width: 1.6, halo: false, head: 8});
        api.arrow([156, 112], [156, 146], {color: c.muted, width: 1.6, halo: false, head: 8});
        api.circle([60, 176], 19, {fill: c.ink, fillOpacity: 0.8});
        api.label([60, 214], "colony", {color: c.c4, size: 12.5, anchor: "middle"});
        if (amp) {
          cell(156, 176, 0, 56, 24, {stroke: c.c5, fill: "none", dash: "4 3"});
          api.label([156, 176], "×", {color: c.c5, size: 18, anchor: "middle", weight: 700});
          api.label([156, 214], "killed", {color: c.c5, size: 12.5, anchor: "middle"});
          api.label([108, 240], "ampicillin blocks cell-wall", {color: c.muted, size: 12, anchor: "middle"});
          api.label([108, 256], "building; β-lactamase destroys it", {color: c.muted, size: 12, anchor: "middle"});
        } else {
          api.circle([156, 176], 19, {fill: c.ink, fillOpacity: 0.8});
          api.label([156, 214], "colony too", {color: c.c4, size: 12.5, anchor: "middle"});
          api.label([108, 248], "no antibiotic: nothing selects", {color: c.muted, size: 12, anchor: "middle"});
        }
      }
      // the plate (faint until it is actually plated at step 4)
      var g = api.group({opacity: s < 4 ? 0.5 : 1}), P = [310, 150], R = 74;
      api.label([310, 22], s < 4 ? "the plate you will get" : "after a night at 37 °C", {color: c.muted, size: 12, anchor: "middle", parent: g});
      api.circle(P, R, {fill: c.c3, fillOpacity: 0.07, stroke: c.muted, width: 2, dash: s < 4 ? "5 4" : null, parent: g});
      var lawn = !amp || n > 5000, main, note = "";
      if (lawn) {
        api.circle(P, R * 0.93, {fill: c.ink, fillOpacity: 0.32, parent: g});
        main = amp ? "≈ " + big(n) + " transformants" : "lawn"; note = amp ? "a near-solid lawn" : "every cell grows";
      } else {
        var shown = Math.min(n, 700), rr = n <= 100 ? 3.2 : n <= 300 ? 2.4 : 1.5;
        for (var i = 0; i < shown; i++) {
          var rad = 0.9 * R * Math.sqrt(rnd(i, 1)), th = 2 * Math.PI * rnd(i, 2);
          api.circle([P[0] + rad * Math.cos(th), P[1] + rad * Math.sin(th)], rr + rnd(i, 3) * 0.8, {fill: c.ink, fillOpacity: 0.85, parent: g});
        }
        main = big(n) + (n === 1 ? " colony" : " colonies"); if (n > 300) note = "too many to count";
      }
      api.label([310, 50], main, {color: c.ink, size: 13.5, weight: 650, anchor: "middle", parent: g});
      api.label([310, 244], amp ? "LB + ampicillin" : "LB, no antibiotic", {color: amp ? c.c5 : c.muted, size: 12, anchor: "middle", parent: g});
      if (note) api.label([310, 262], note, {color: c.muted, size: 12, anchor: "middle", parent: g});
      // viz.css paints every svg label ink (it overrides the fill attribute); keep each label's own color
      api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
