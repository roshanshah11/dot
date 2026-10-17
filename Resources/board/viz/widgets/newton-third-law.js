// Newton's third law: every force is one half of an interaction pair. The two objects are drawn pulled a little apart
// (an "exploded" view) so each force sits on the object it acts on: equal in size, opposite in direction, on different
// bodies, so the pair never cancels. Colliding balls add the accelerations a = F/m (same force, different masses);
// the box on a table adds the box's weight, which equals the contact force here only because the box is in
// equilibrium; its own partner is the box pulling up on the Earth.
(function () {
  var M_A = 1, M_B = 4, G = 9.8;
  var SCENES = {
    pushingBox: {a: "hand", b: "box"},
    collidingBalls: {a: "ball A", b: "ball B"},
    boxOnTable: {a: "table", b: "box"}
  };
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; }); }   // viz.css paints text ink

  Viz.register("newton-third-law", {
    title: "Newton's third law: interaction pairs",
    subject: "physics",
    shows: "Pick an interaction and set its force: each object pushes the other with the same size force in the opposite direction, acting on different objects",
    params: {
      example: {kind: "enum", values: ["pushingBox", "collidingBalls", "boxOnTable"], default: "pushingBox", label: "example",
                names: {pushingBox: "pushing a box", collidingBalls: "colliding balls", boxOnTable: "box on a table"}},
      force: {kind: "number", default: 10, min: 2, max: 20, step: 1, label: "F\\ (\\mathrm{N})"}
    },
    formula: function (v) {
      var s = SCENES[v.example], F = Viz.n(v.force, 1);
      var pair = "\\vec F_{\\text{" + s.a + " on " + s.b + "}}=-\\vec F_{\\text{" + s.b + " on " + s.a + "}}";
      if (v.example === "collidingBalls") return pair + ",\\ \\ a_A=\\frac{" + F + "}{" + M_A + "}=" + Viz.n(v.force / M_A, 2) + ",\\ a_B=\\frac{" + F + "}{" + M_B + "}=" + Viz.n(v.force / M_B, 2) + "\\ \\mathrm{m/s^2}";
      if (v.example === "boxOnTable") return pair + ",\\ \\ |F|=mg=" + F + "\\ \\mathrm{N}";
      return pair + ",\\ \\ |F|=" + F + "\\ \\mathrm{N}";
    },
    status: function (v) {
      var F = Viz.fmt(v.force, 1);
      if (v.example === "collidingBalls") return "While they touch, each ball pushes the other with <b>" + F + " N</b>, but the " + M_A + " kg ball accelerates at <b>" +
        Viz.fmt(v.force / M_A, 2) + " m/s²</b> and the " + M_B + " kg ball at only <b>" + Viz.fmt(v.force / M_B, 2) + " m/s²</b>.";
      if (v.example === "boxOnTable") return "The " + Viz.fmt(v.force / G, 2) + " kg box presses down on the table with <b>" + F + " N</b> and the table pushes up on it with <b>" + F +
        " N</b>; the box's weight is a different pair (Earth on box, box on Earth).";
      return "The hand pushes the box with <b>" + F + " N</b> and the box pushes back on the hand with exactly <b>" + F + " N</b>; they act on different objects, so they never cancel.";
    },
    examples: [
      {name: "example: collidingBalls", values: {example: "collidingBalls"}},
      {name: "example: boxOnTable", values: {example: "boxOnTable"}},
      {name: "Minimum supported values", values: {force: 2}},
      {name: "Maximum supported values", values: {example: "collidingBalls", force: 20}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, F = v.force, k = 5.5, L = k * F, cA = c.c1, cB = c.c3;   // L: arrow length in px for F newtons
      var fN = api.fmt(F, 1) + " N";
      // a force arrow with its label attached; `at` is where the label's start (side "start") or end (side "end") sits
      function force(a, b, text, color, at, side) {
        var w = text.length * 12.5 * 0.56, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cxl = at[0] + (side === "end" ? -w / 2 : w / 2);
        var t = api.arrow(a, b, {color: color, width: 3.5, label: text, labelAt: "mid", labelSize: 12.5, labelOffset: [cxl - mid[0], at[1] - mid[1]]}).querySelector("text");
        if (t) { t.setAttribute("stroke", c.card); t.setAttribute("stroke-width", 3.5); t.setAttribute("stroke-linejoin", "round"); t.setAttribute("paint-order", "stroke"); }   // outlines pass behind
      }
      if (v.example === "pushingBox") {
        var yG = 222, gap = 26, hx = 150, bx = hx + gap, bw = 150, bh = 124, by = yG - bh, my = yG - bh / 2;   // my: height of the push
        api.line([16, yG], [384, yG], {color: c.axis, width: 1.5});
        api.label([bx - gap / 2, by - 22], "drawn apart: each force on the object it acts on", {color: c.muted, size: 12, anchor: "middle"});
        // the hand: an arm ending in a fist, pushing right
        api.rect(26, my - 15, hx - 52, 18, {fill: c.c6, fillOpacity: 0.25, stroke: c.c6, rx: 8});
        api.rect(hx - 30, my - 22, 30, 44, {fill: c.c6, fillOpacity: 0.35, stroke: c.c6, rx: 10});
        api.label([60, my - 27], "hand", {color: c.c6, size: 12.5, weight: 650, anchor: "middle"});
        api.rect(bx, by, bw, bh, {fill: c.c2, fillOpacity: 0.22, stroke: c.c2, rx: 4});
        api.label([bx + bw / 2, by + bh - 18], "box", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
        // both forces start at the contact point (fist face, box face) near mid-height: one label above, one below
        force([bx, my - 12], [bx + L, my - 12], "hand on box " + fN, cB, [bx + 6, my - 28], "start");
        force([hx, my + 12], [hx - L, my + 12], "box on hand " + fN, cA, [hx - 4, my + 34], "end");
      } else if (v.example === "collidingBalls") {
        var cy = 94, rA = 26, rB = 44, xc = 200, gp = 12;
        var A = [xc - gp / 2 - rA, cy], B = [xc + gp / 2 + rB, cy];
        api.circle(A, rA, {fill: c.c6, fillOpacity: 0.25, stroke: c.c6});
        api.circle(B, rB, {fill: c.c2, fillOpacity: 0.22, stroke: c.c2});
        api.label([A[0], A[1] + rA + 16], "A, " + M_A + " kg", {color: c.c6, size: 12.5, weight: 650, anchor: "middle"});
        api.label([B[0], B[1] + rB + 16], "B, " + M_B + " kg", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
        // forces at the contact point, on each ball, labelled right above each arrow
        force([xc + gp / 2, cy], [xc + gp / 2 + L, cy], "A on B: " + fN, cB, [xc + gp / 2 + 3, cy - 14], "start");
        force([xc - gp / 2, cy], [xc - gp / 2 - L, cy], "B on A: " + fN, cA, [xc - gp / 2 - 3, cy - 14], "end");
        // accelerations to their own scale: 7 px per m/s², same direction as the force on each ball
        var aA = F / M_A, aB = F / M_B, ka = 7, ya = 204;
        api.arrow([A[0], ya], [A[0] - ka * aA, ya], {color: c.c4, width: 2.5, halo: false, dash: "6 4"});
        api.arrow([B[0], ya], [B[0] + ka * aB, ya], {color: c.c4, width: 2.5, halo: false, dash: "6 4"});
        api.label([A[0] + 6, ya + 22], "a = " + api.fmt(aA, 2) + " m/s²", {color: c.c4, size: 12.5, weight: 650, anchor: "end"});
        api.label([B[0] - 6, ya + 22], "a = " + api.fmt(aB, 2) + " m/s²", {color: c.c4, size: 12.5, weight: 650, anchor: "start"});
      } else {
        // own scale (3.6 px/N) and a box lifted 50 px, so the weight arrow from the box's middle ends >= 8 px above the
        // tabletop even at 20 N (bMid + Lv <= tTop - 8): it must never read as the weight pushing on the table
        var Lv = 3.6 * F, tx = 16, tw = 368, tTop = 196, boxW = 84, boxH = 60, bxl = 158, bBot = tTop - 50, bTop = bBot - boxH;
        var bMid = bTop + boxH / 2, cx = bxl + boxW - 12, wx = bxl + 16;
        api.label([200, 44], "drawn apart: each force on the object it acts on", {color: c.muted, size: 12, anchor: "middle"});
        api.rect(tx, tTop, tw, 12, {fill: c.c6, fillOpacity: 0.25, stroke: c.c6, rx: 3});
        api.line([tx + 14, tTop + 12], [tx + 14, 270], {color: c.c6, width: 4});
        api.line([tx + tw - 14, tTop + 12], [tx + tw - 14, 270], {color: c.c6, width: 4});
        api.label([tx + tw - 22, 252], "table", {color: c.c6, size: 12.5, weight: 650, anchor: "end"});
        api.rect(bxl, bTop, boxW, boxH, {fill: c.c2, fillOpacity: 0.22, stroke: c.c2, rx: 4});
        api.label([bxl + 8, bTop + 14], "box", {color: c.c2, size: 12.5, weight: 650});
        // the pair, at the contact: amber for the formula's first force (on the box, as when pushing), teal for its partner
        force([cx, bBot], [cx, bBot - Lv], "table on box " + fN, cB, [bxl + boxW + 8, bBot - 12], "start");
        force([cx, tTop], [cx, tTop + Lv], "box on table " + fN, cA, [cx + 10, tTop + 24], "start");
        // the weight acts on the box too but belongs to the Earth-box pair; equal here only because the box is in equilibrium
        api.arrow([wx, bMid], [wx, bMid + Lv], {color: c.muted, width: 2, halo: false, dash: "5 4"});
        api.label([bxl - 8, bMid - 2], "W = mg = " + fN, {color: c.muted, size: 12.5, weight: 600, anchor: "end"});
        api.label([bxl - 8, bMid + 14], "(Earth on box)", {color: c.muted, size: 12, anchor: "end"});
      }
      tint(api);
    }
  });
})();
