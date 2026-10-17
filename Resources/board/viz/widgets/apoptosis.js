// Apoptosis, programmed cell death, from either trigger. Intrinsic: internal damage -> p53 / BH3-only proteins ->
// Bax and Bak pore the outer mitochondrial membrane -> cytochrome c + Apaf-1 build the apoptosome -> caspase-9.
// Extrinsic: Fas ligand clusters Fas -> FADD + procaspase-8 form the DISC -> caspase-8 (which also cuts Bid to tBid).
// Both converge on the executioner caspases-3/7, and the cell is packaged into apoptotic bodies that phagocytes eat.
// Each step draws what is new in full color and labels it; earlier parts stay, faded.
(function () {
  var TEXT = {
    intrinsic: ["DNA damage or other internal stress activates p53 and BH3-only proteins, which switch on <b>Bax and Bak</b> at the mitochondria",
                "Bax and Bak punch pores in the outer mitochondrial membrane and <b>cytochrome c</b> leaks into the cytosol",
                "Cytochrome c binds Apaf-1, which assembles the wheel-shaped <b>apoptosome</b> and activates the initiator <b>caspase-9</b>",
                "Caspase-9 activates the executioner <b>caspases-3 and -7</b>, which cut hundreds of proteins, freeing the DNA-cutting enzyme CAD and taking apart the nuclear lamina",
                "The cell shrinks, its chromatin condenses and fragments, and it buds into <b>apoptotic bodies</b> whose exposed phosphatidylserine tells phagocytes to eat them, with no inflammation"],
    extrinsic: ["<b>Fas ligand</b> on a killer T cell binds and clusters the cell's own <b>Fas</b> death receptors",
                "The receptors' death domains recruit the adaptor FADD, which pulls in procaspase-8 to form the <b>DISC</b> (death-inducing signaling complex)",
                "Crowded together in the DISC, procaspase-8 molecules cleave each other into active <b>caspase-8</b>, which also cuts Bid to tBid to bring in the mitochondria",
                "Caspase-8 activates the executioner <b>caspases-3 and -7</b>, which cut hundreds of proteins, freeing the DNA-cutting enzyme CAD and taking apart the nuclear lamina",
                "The cell shrinks, its chromatin condenses and fragments, and it buds into <b>apoptotic bodies</b> whose exposed phosphatidylserine tells phagocytes to eat them, with no inflammation"]
  };
  var CHAIN = {intrinsic: ["\\text{DNA damage}", "\\text{cyt }c", "\\text{caspase-9}", "\\text{caspase-3/7}", "\\text{apoptotic bodies}"],
               extrinsic: ["\\text{FasL:Fas}", "\\text{DISC}", "\\text{caspase-8}", "\\text{caspase-3/7}", "\\text{apoptotic bodies}"]};
  function ellipse(cx, cy, rx, ry) { return "M " + (cx - rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx + rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx - rx) + " " + cy + " Z"; }

  Viz.register("apoptosis", {
    title: "Apoptosis: intrinsic and extrinsic pathways",
    subject: "biology",
    shows: "Pick the trigger and step through apoptosis: damage inside releases cytochrome c from mitochondria, a death ligand outside builds the DISC, and both switch on caspases that package the cell neatly for phagocytes",
    params: {
      initiating_signal: {kind: "enum", values: ["intrinsic", "extrinsic"], default: "intrinsic", label: "\\text{signal}"}
    },
    steps: ["death signal", "signal relayed", "initiator caspase on", "executioner caspases", "cell dismantled"],
    stepMs: 1900,
    formula: function (v) {
      var s = v.step || 1, ch = CHAIN[v.initiating_signal].map(function (t, i) { return i === s - 1 ? "\\boxed{" + t + "}" : t; });
      return ch.slice(0, 3).join("\\to ") + "\\newline\\to " + ch.slice(3).join("\\to ");
    },
    status: function (v) { return TEXT[v.initiating_signal][(v.step || 1) - 1] + "."; },
    examples: [
      {name: "intrinsic: cytochrome c leaks", values: {initiating_signal: "intrinsic", step: 2}},
      {name: "extrinsic: the DISC", values: {initiating_signal: "extrinsic", step: 2}},
      {name: "extrinsic: caspase-8", values: {initiating_signal: "extrinsic", step: 3}},
      {name: "apoptotic bodies", values: {initiating_signal: "intrinsic", step: 5}}
    ],
    size: [400, 270],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, ext = v.initiating_signal === "extrinsic";
      var cx = 200, cy = 150, NX = 118, NY = 152, MX = 292, MY = 176, RX = 252;
      var fade = function (k) { return s === k ? 1 : 0.45; };
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 650}, o || {})); };
      api.label([12, 262], ext ? "outside signal: a killer cell's death ligand" : "inside signal: the cell's own damage", {color: c.muted, size: 12});
      if (s === 5) {
        // shrunken cell with blebs, apoptotic bodies budding off, a phagocyte reaching in
        var bx = 150, by = 140;
        api.path(ellipse(bx, by, 96, 60), {fill: c.ink, fillOpacity: 0.05, stroke: c.ink, width: 2});
        [[-0.2, -1], [0.45, -0.9], [0.95, -0.3], [0.8, 0.6], [-0.4, 0.92], [-0.98, 0.2]].forEach(function (q) {
          api.circle([bx + 96 * q[0], by + 60 * q[1]], 11, {fill: c.card, stroke: c.ink, width: 1.6});
        });
        [[-34, -8, 10], [-12, 14, 8], [-46, 18, 7]].forEach(function (q) { api.circle([bx + q[0], by + q[1]], q[2], {fill: c.c6, fillOpacity: 0.85}); });
        L([bx, by + 86], "condensed, fragmented chromatin", c.c6, {anchor: "middle"});
        var bodies = [[300, 92, 22, "n"], [336, 150, 19, "m"], [292, 200, 17, "n"]];
        bodies.forEach(function (q) {
          api.circle([q[0], q[1]], q[2], {fill: c.ink, fillOpacity: 0.05, stroke: c.ink, width: 1.8});
          if (q[3] === "n") api.circle([q[0] - 3, q[1] + 2], q[2] * 0.4, {fill: c.c6, fillOpacity: 0.85});
          else api.path(ellipse(q[0], q[1], q[2] * 0.55, q[2] * 0.3), {stroke: c.c4, width: 1.6});
          [-0.6, 0.2, 1.0].forEach(function (a) {   // phosphatidylserine flipped to the outer leaflet
            var ux = Math.cos(a - 1.2), uy = Math.sin(a - 1.2), p0 = [q[0] + ux * q[2], q[1] + uy * q[2]];
            api.line(p0, [p0[0] + ux * 7, p0[1] + uy * 7], {color: c.c3, width: 1.6});
            api.circle([p0[0] + ux * 9, p0[1] + uy * 9], 2.4, {fill: c.c3});
          });
        });
        L([300, 52], "apoptotic bodies", c.ink, {anchor: "middle"});
        L([296, 244], "phosphatidylserine: “eat me”", c.c3, {anchor: "middle"});
        // a phagocyte coming in from the right, its two arms cupping the nearest body (inner edge 38 from its centre)
        var cup = "M 400 108 C 386 100 358 100 346 104 Q 336 108 342.6 112.6 A 38 38 0 0 1 342.6 187.4 Q 334 194 344 198 C 366 204 388 200 400 192";
        api.path(cup + " Z", {fill: c.muted, fillOpacity: 0.08});
        api.path(cup, {stroke: c.muted, width: 2.2});
        L([398, 216], "phagocyte", c.muted, {anchor: "end", weight: 600});
        L([12, 14], "membrane stays sealed: nothing spills", c.muted, {weight: 500});
        api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
        return;
      }
      // the cell, its nucleus and a mitochondrion
      api.path(ellipse(cx, cy, 176, 98), {fill: c.ink, fillOpacity: 0.04, stroke: c.ink, width: 2});
      api.circle([NX, NY], 44, {fill: c.c6, fillOpacity: 0.08, stroke: c.c6, width: 1.8, dash: s === 4 ? "6 5" : null});
      if (s < 4) {
        [[-26, -12, 10, 14], [-24, 10, 10, 12], [-14, 30, 8, 10]].forEach(function (q) {
          api.path("M " + (NX + q[0]) + " " + (NY + q[1]) + " q " + q[2] + " " + (-q[3]) + " " + 2 * q[2] + " 0 t " + 2 * q[2] + " 0" + (q[2] > 8 ? " t " + 2 * q[2] + " 0" : ""), {stroke: c.c6, width: 2});
        });
      } else {
        [[-18, -12], [4, -16], [20, 0], [-12, 12], [10, 20], [-4, 2]].forEach(function (q) { api.circle([NX + q[0], NY + q[1]], 4.5, {fill: c.c6}); });
      }
      L([NX, NY + 54], s === 4 ? "lamins + DNA cut" : "nucleus", c.c6, {anchor: "middle", weight: s === 4 ? 650 : 500});
      api.path(ellipse(MX, MY, 44, 20), {fill: c.c4, fillOpacity: 0.1, stroke: c.c4, width: 1.8});
      api.path("M 258 176 l 8 -10 l 8 18 l 8 -18 l 8 18 l 8 -18 l 8 18 l 8 -18 l 8 10", {stroke: c.c4, width: 1.3, opacity: 0.8});
      L([MX - 12, MY + 31], "mitochondrion", c.c4, {anchor: "middle", weight: 500});
      // executioner caspases (both pathways, step 4)
      if (s === 4) {
        [[180, 96], [214, 124], [178, 150], [226, 228], [196, 222], [290, 126], [336, 138], [244, 160], [188, 186], [330, 112]].forEach(function (q) {
          api.polygon([[q[0], q[1] - 6], [q[0] + 6, q[1]], [q[0], q[1] + 6], [q[0] - 6, q[1]]], {fill: c.c3, fillOpacity: 0.95});
        });
        L([250, 94], "caspase-3/7", c.c3, {size: 13});
      }
      if (!ext) {
        // Bax/Bak on the outer membrane, then pores and cytochrome c
        var poreX = [266, 286, 306, 322];
        poreX.forEach(function (x, i) {
          var y = MY - 20 * Math.sqrt(Math.max(0, 1 - Math.pow((x - MX) / 44, 2)));
          if (s === 1) api.circle([x, y - 4], 3.5, {fill: c.c5});
          else api.rect(x - 3, y - 6, 6, 9, {fill: c.c5, rx: 1.5, opacity: fade(2)});
        });
        if (s === 1) {
          // breaks sit in the gaps between the chromatin strands, haloed so the strands do not hide them
          [[101, 147], [141, 146], [88, 173]].forEach(function (q) {
            var t = L(q, "✕", c.c5, {size: 16, weight: 800, anchor: "middle"});
            t.setAttribute("stroke", c.card); t.setAttribute("stroke-width", 3); t.setAttribute("paint-order", "stroke");
          });
          L([NX, NY - 56], "DNA damage", c.c5, {anchor: "middle"});
          api.arrow([NX + 46, NY - 6], [258, 160], {color: c.c5, width: 2.2, halo: false, label: "p53 → BH3-only", labelAt: "mid", labelOffset: [14, -18], labelSize: 12});
          L([308, 132], "Bax / Bak", c.c5, {anchor: "middle"});
        }
        if (s >= 2) {
          if (s === 2) [[270, 142], [292, 134], [312, 140], [282, 118], [304, 112], [262, 124]].forEach(function (q) { api.circle(q, 3.2, {fill: c.c1}); });
          if (s === 2) { L([300, 96], "cytochrome c", c.c1, {anchor: "middle"}); L([MX - 50, MY + 2], "Bax/Bak pores", c.c5, {anchor: "end"}); }
        }
        if (s >= 3) {
          var hub = [206, 106];
          for (var k = 0; k < 7; k++) {
            var a = k * 2 * Math.PI / 7, e = [hub[0] + 20 * Math.cos(a), hub[1] + 20 * Math.sin(a)];
            api.line(hub, e, {color: c.c2, width: 2.2, opacity: fade(3)});
            api.circle(e, 4, {fill: c.c2, opacity: fade(3)});
            api.circle([hub[0] + 27 * Math.cos(a), hub[1] + 27 * Math.sin(a)], 3, {fill: c.c1, opacity: fade(3)});
          }
          api.circle(hub, 5.5, {fill: c.c3, opacity: fade(3)});
          if (s === 3) { L([206, 68], "apoptosome: Apaf-1 + cyt c", c.c2, {anchor: "middle"}); L([234, 122], "caspase-9", c.c3, {anchor: "start"}); }
        }
      } else {
        // Fas ligand (from the killer cell) on the Fas receptor; FADD + procaspase-8 below it
        var topY = cy - 98 * Math.sqrt(1 - Math.pow((RX - cx) / 176, 2));
        [-7, 0, 7].forEach(function (d) { api.rect(RX + d - 2.5, topY - 14, 5, 30, {fill: c.c2, rx: 2, opacity: s === 1 ? 1 : 0.7}); });
        // the ligand stays bound at every later step, so it stays nearly full strength (a faded red goes maroon on the card)
        api.polygon([[RX - 12, topY - 30], [RX + 12, topY - 30], [RX, topY - 16]], {fill: c.c5, fillOpacity: 0.95, opacity: s === 1 ? 1 : 0.9});
        if (s === 1) { L([RX - 16, topY - 23], "Fas ligand (on a killer T cell)", c.c5, {anchor: "end"}); L([RX - 14, topY + 16], "Fas receptor", c.c2, {anchor: "end"}); }
        if (s >= 2) {
          [-8, 8].forEach(function (d) {
            api.circle([RX + d, topY + 26], 5.5, {fill: c.c2, opacity: fade(2)});
            if (s === 2) api.circle([RX + d, topY + 40], 5.5, {fill: "none", stroke: c.c3, width: 1.8});
          });
          if (s === 2) { L([RX - 16, topY + 26], "FADD", c.c2, {anchor: "end"}); L([RX - 16, topY + 41], "procaspase-8", c.c3, {anchor: "end"}); L([RX + 18, topY + 34], "DISC", c.ink, {size: 13}); }
        }
        if (s >= 3) {
          [[214, 102], [226, 112], [204, 116]].forEach(function (q) { api.circle(q, 5, {fill: c.c3, opacity: fade(3)}); });
          if (s === 3) {
            L([196, 88], "caspase-8", c.c3, {anchor: "end"});
            api.arrow([238, 118], [276, 152], {color: c.c5, width: 1.8, dash: "4 3", halo: false});
            L([264, 128], "tBid", c.c5, {anchor: "start"});
          }
        }
      }
      // viz.css paints svg text ink; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
