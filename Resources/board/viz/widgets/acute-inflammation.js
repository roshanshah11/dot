// Acute inflammation after a splinter, in five steps: sentinel cells raise the alarm (mast cells: histamine;
// macrophages: TNF, IL-1, chemokines); arterioles dilate (redness, heat); postcapillary venules leak as endothelial
// cells contract (swelling) while bradykinin and prostaglandin E2 sensitize nerve endings (pain); neutrophils roll on
// selectins, stick by integrins to ICAM-1, cross between endothelial cells and follow CXCL8 (IL-8) to the bacteria;
// then neutrophils phagocytose and die, macrophages clear them, and lipoxins and resolvins end the response.
// Skin surface on top, a small vessel along the bottom, the cardinal signs along the top edge.
(function () {
  var SIGNS = [["redness", 2], ["heat", 2], ["swelling", 3], ["pain", 3], ["loss of function", 3]];
  var CHAIN = ["\\text{injury}", "\\text{dilation}", "\\text{leak}", "\\text{neutrophils}", "\\text{resolution}"];
  var TIME = ["within seconds", "within minutes", "minutes to hours", "hours: peak at 6–24 h", "over 1–3 days"];
  var BUGS = [[-30, 4], [22, -6], [-14, 22], [18, 18], [-36, -14], [4, 30]];

  Viz.register("acute-inflammation", {
    title: "Acute inflammation",
    subject: "biology",
    shows: "Step through a splinter wound: the alarm, wider vessels (red, warm), leaky vessels (swollen, painful), neutrophils crossing the vessel wall to the bacteria, then cleanup and resolution",
    steps: ["injury and alarm", "vasodilation: red and warm", "leaky vessels: swelling and pain", "neutrophils arrive", "clearance and resolution"],
    stepMs: 2000,
    formula: function (v) {
      var s = v.step || 1, f = CHAIN.map(function (t, i) { return i === s - 1 ? "\\boxed{" + t + "}" : t; });
      return f.slice(0, 3).join("\\to ") + "\\newline\\to " + f.slice(3).join("\\to ");
    },
    status: function (v) {
      return ["A splinter carries bacteria into the skin; mast cells release <b>histamine</b> and resident macrophages release <b>TNF, IL-1 and chemokines</b>, raising the alarm.",
              "Histamine, prostaglandins and nitric oxide <b>dilate</b> the nearby vessels, so more blood flows through: the area turns <b>red</b> and <b>warm</b>.",
              "Endothelial cells pull apart, so plasma and proteins <b>leak</b> into the tissue (swelling), while bradykinin and prostaglandin E₂ sensitize nerve endings (<b>pain</b>).",
              "Neutrophils <b>roll</b> along the wall on selectins, <b>stick</b> by integrins, <b>squeeze</b> between endothelial cells and follow the IL-8 gradient to the bacteria.",
              "Neutrophils engulf the bacteria and die; macrophages clear them and the debris, and lipoxins and resolvins <b>switch the response off</b> so the tissue can repair."][(v.step || 1) - 1];
    },
    examples: [
      {name: "the alarm", values: {step: 1}},
      {name: "leaky vessels", values: {step: 3}},
      {name: "neutrophils cross the wall", values: {step: 4}},
      {name: "resolution", values: {step: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, X = 232, TIP = 124;
      // cardinal signs, lit while present
      var x = 14;
      SIGNS.forEach(function (g) {
        var on = s >= g[1] && s < 5, fading = s === 5;
        api.label([x, 12], g[0], {color: on ? c.c5 : c.faint, size: 12, weight: on ? 700 : 500, opacity: fading ? 0.7 : 1});
        x += g[0].length * 6.9 + 14;
      });
      // skin surface, swollen over the wound while fluid leaks
      var bulge = s === 3 || s === 4 ? 12 : s === 5 ? 4 : 0, top = [], bot = [];
      for (var i = 0; i <= 40; i++) {
        var xx = i * 10, y = 44 - bulge * Math.exp(-Math.pow((xx - X) / 80, 2));
        top.push([xx, y]); bot.unshift([xx, y + 9]);
      }
      api.polygon(top.concat(bot), {fill: c.muted, fillOpacity: 0.25, stroke: c.muted, width: 1});
      api.label([388, 64], "skin", {color: c.muted, size: 12, anchor: "end"});
      api.polygon([[X - 9, 30], [X + 9, 30], [X + 1, TIP]], {fill: c.ink, fillOpacity: 0.55, stroke: c.ink, width: 1});
      api.label([X + 10, 68], "splinter", {color: c.ink, size: 12}); // under the skin, beside the shaft
      // bacteria at the tip: most are gone by resolution
      BUGS.forEach(function (b, k) {
        if (s === 5 && k > 1) return;
        var at = s === 5 ? [X - 24 + k * 40, TIP + 12] : [X + b[0], TIP + b[1]];
        api.rect(at[0] - 6, at[1] - 2.5, 12, 5, {fill: c.c4, rx: 2.5});
      });
      if (s < 5) api.label([X - 46, TIP - 20], "bacteria", {color: c.c4, size: 12, anchor: "end"});
      // sentinel cells
      var mast = [78, 112], mac = [338, 104];
      api.circle(mast, 15, {fill: c.c6, fillOpacity: 0.25, stroke: c.c6, width: 1.5});
      [[-6, -5], [5, -6], [-4, 5], [6, 4], [0, 0]].forEach(function (q) { api.circle([mast[0] + q[0], mast[1] + q[1]], 2.2, {fill: c.c6}); });
      api.label([mast[0], mast[1] + 26], "mast cell", {color: c.c6, size: 12, anchor: "middle"});
      api.path("M " + (mac[0] - 18) + " " + mac[1] + " q 4 -18 20 -16 q 18 2 16 16 q 0 16 -18 15 q -20 0 -18 -15 Z", {fill: c.c3, fillOpacity: 0.25, stroke: c.c3, width: 1.5});
      api.label([mac[0], mac[1] + 28], "macrophage", {color: c.c3, size: 12, anchor: "middle"});
      if (s === 1) {
        for (var d = 0; d < 9; d++) {
          api.circle([mast[0] + 22 + (d % 3) * 11, mast[1] + 44 + Math.floor(d / 3) * 13], 2, {fill: c.c6});
          api.circle([mac[0] - 26 - (d % 3) * 11, mac[1] + 48 + Math.floor(d / 3) * 13], 2, {fill: c.c3});
        }
        api.label([mast[0] + 50, mast[1] + 57], "histamine", {color: c.c6, size: 12});
        api.label([mac[0] + 2, mac[1] + 94], "TNF, IL-1, chemokines", {color: c.c3, size: 12, anchor: "middle"});
      }
      // the venule: wider from step 2 to 4, gaps between endothelial cells in steps 3 and 4
      var half = s >= 2 && s <= 4 ? 27 : 19, cy = 238, wt = cy - half, wb = cy + half, leaky = s === 3 || s === 4;
      api.rect(0, wt, 400, wb - wt, {fill: c.c5, fillOpacity: s >= 2 && s <= 4 ? 0.22 : 0.1, rx: 0});
      var cellW = 40, gap = leaky ? 9 : 2;
      for (var e = 0; e < 10; e++) {
        api.rect(e * cellW + gap / 2, wt - 6, cellW - gap, 6, {fill: c.c5, fillOpacity: 0.7, rx: 3});
        api.rect(e * cellW + 1, wb, cellW - 2, 6, {fill: c.c5, fillOpacity: 0.7, rx: 3});
      }
      var nRbc = s >= 2 && s <= 4 ? 14 : 8;
      for (var r = 0; r < nRbc; r++) {
        var rx = 12 + r * 380 / nRbc, ry = cy + (s === 4 ? 1 : (r % 3) - 1) * (half - 9);
        api.path("M " + (rx - 6) + " " + ry + " a 6 3.5 0 1 0 12 0 a 6 3.5 0 1 0 -12 0", {fill: c.c5, fillOpacity: 0.9});
      }
      api.label([14, 290], s >= 2 && s <= 4 ? "vessels: arterioles dilate, more flow →" : "vessels: blood flow →", {color: c.c5, size: 12});
      api.label([388, 290], TIME[s - 1], {color: c.muted, size: 12, anchor: "end"});
      if (leaky) {
        (s === 3 ? [100, 140, 180, 290] : [262, 290]).forEach(function (gx) { api.arrow([gx, wt - 6], [gx, wt - 30], {color: c.c2, width: 2, halo: false, head: 8}); });
        // the leaked fluid's dots only in step 3: in step 4 the tissue belongs to the neutrophils' path to the bacteria
        if (s === 3) for (var f = 0; f < 18; f++) {
          var lx = 40 + (f * 47) % 330, ly = 150 + (f * 23) % 46;
          if (!BUGS.some(function (q) { return Math.abs(X + q[0] - lx) < 13 && Math.abs(TIP + q[1] - ly) < 8; })) api.circle([lx, ly], 2.2, {fill: c.c2, opacity: 0.8});
        }
        api.label([300, wt - 28], "plasma leaks", {color: c.c2, size: 12});
        api.label([300, wt - 14], "from venules", {color: c.c2, size: 12});
      }
      if (s === 3) {
        api.path("M 14 82 q 20 -8 40 0 t 40 0 t 40 0 t 40 0", {stroke: c.c5, width: 1.6, opacity: 0.8});
        api.label([14, 70], "bradykinin, PGE₂: nerves fire", {color: c.c5, size: 12, raw: true});
      }
      // neutrophils: one color, multi-lobed nucleus
      var neut = function (at, dead) {
        api.circle(at, 8, {fill: dead ? c.muted : c.c1, fillOpacity: dead ? 0.35 : 0.3, stroke: dead ? c.muted : c.c1, width: 1.5});
        [[-3, -1], [1, 2], [3, -2]].forEach(function (q) { api.circle([at[0] + q[0], at[1] + q[1]], 1.8, {fill: dead ? c.muted : c.c1}); });
      };
      if (s === 4) {
        neut([46, wt + 10]); neut([84, wt + 9]); neut([134, wt + 6]); neut([200, wt - 3]); neut([208, 186]); neut([224, 170]);
        api.label([65, wt + 27], "roll", {color: c.c1, size: 12, anchor: "middle"});
        api.label([134, wt + 27], "stick", {color: c.c1, size: 12, anchor: "middle"});
        api.label([200, wt + 27], "squeeze through", {color: c.c1, size: 12, anchor: "start"});
        for (var k = 0; k < 6; k++) api.circle([248 + k * 5, 190 - k * 12], 1.5 + k * 0.35, {fill: c.c3, opacity: 0.8});
        api.label([284, 152], "IL-8 gradient", {color: c.c3, size: 12});
      }
      if (s === 5) {
        neut([X - 24, TIP + 12]); neut([X + 16, TIP + 12]); neut([70, 170], true);
        api.path("M 48 170 q 4 -18 22 -18 q 22 0 22 18 q 0 18 -22 18 q -24 0 -22 -18 Z", {stroke: c.c3, width: 1.8});
        api.label([X - 4, TIP + 34], "neutrophils engulf bacteria", {color: c.c1, size: 12, anchor: "middle"});
        api.label([14, 202], "macrophage eats a dead neutrophil", {color: c.c3, size: 12});
      }
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
