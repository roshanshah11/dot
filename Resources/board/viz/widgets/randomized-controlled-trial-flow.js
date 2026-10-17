// A randomized controlled trial in the order a CONSORT flow diagram reports it: screen, randomize, allocate, follow up,
// analyze. One fixed cohort of 36 people walks through all five steps; squares are 65 or older, a baseline trait that
// affects recovery, so step 3 can show the arms starting alike. The allocation sequence is one fixed random draw, and
// every count in the figure, the formula and the status is computed from the arrays below, so they always agree.
// The analysis compares people in the arm they were randomized to; those lost to follow-up have no outcome and are
// counted out, as CONSORT reports them.
// Dot's design: the queue entry has no schema, so this is a pure process (steps, no sliders).
(function () {
  var EXCL = [3, 8, 13, 17, 22, 26, 31, 34];                    // fail the entry criteria
  var OLD = [1, 5, 8, 10, 14, 19, 21, 24, 27, 30, 33, 35];      // age 65+
  var ARM = "TCCTTCTCCTCTTCCTCTTCTCCTTCCT";                     // random allocation, one letter per enrolled person
  var OUT = {T: "1101-110111-01", C: "01001010-01010"};         // by position in the arm: 1 recovered, 0 not, - lost
  var people = [], arms = {T: [], C: []}, e = 0;
  for (var i = 0; i < 36; i++) {
    var p = {old: OLD.indexOf(i) >= 0, elig: EXCL.indexOf(i) < 0, col: i % 9, row: Math.floor(i / 9)};
    if (p.elig) {
      p.arm = ARM.charAt(e++); p.pos = arms[p.arm].length; arms[p.arm].push(p);
      var ch = OUT[p.arm].charAt(p.pos); p.lost = ch === "-"; p.rec = ch === "1";
    }
    people.push(p);
  }
  function tally(a) {
    var k = {n: arms[a].length, old: 0, lost: 0, rec: 0};
    arms[a].forEach(function (p) { k.old += p.old ? 1 : 0; k.lost += p.lost ? 1 : 0; k.rec += p.rec ? 1 : 0; });
    k.ana = k.n - k.lost; k.rate = k.rec / k.ana;
    return k;
  }
  var T = tally("T"), C = tally("C"), ENR = T.n + C.n, EX = 36 - ENR;
  var f2 = function (x) { return Viz.n(x, 2); }, pc = function (x) { return Math.round(x * 100) + "%"; };

  Viz.register("randomized-controlled-trial-flow", {
    title: "Randomized controlled trial: the flow",
    subject: "stats",
    shows: "Step through a trial: screen, randomize, allocate, follow up and analyze; random allocation is what lets the final gap be read as the treatment's effect",
    params: {},
    steps: ["screen for eligibility", "randomize", "allocate to arms", "follow up", "analyze by arm"],
    stepMs: 1800,
    formula: function (v) {
      var s = v.step || 1;
      if (s === 1) return "\\underbrace{36}_{\\text{screened}}-\\underbrace{" + EX + "}_{\\text{excluded}}=\\underbrace{" + ENR + "}_{\\text{enrolled}}";
      if (s === 2) return ENR + "\\ \\text{enrolled}\\ \\xrightarrow{\\text{ random }}\\ " + T.n + "\\ \\text{T}+" + C.n + "\\ \\text{C}";
      if (s === 3) return "\\text{age 65+}:\\ \\tfrac{" + T.old + "}{" + T.n + "}=" + f2(T.old / T.n) + "\\ \\text{vs}\\ \\tfrac{" + C.old + "}{" + C.n + "}=" + f2(C.old / C.n);
      if (s === 4) return "\\begin{array}{l}\\text{treatment: }" + T.n + "-" + T.lost + "=" + T.ana + "\\ \\text{analyzed}\\\\[4pt]\\text{control: }" + C.n + "-" + C.lost + "=" + C.ana + "\\ \\text{analyzed}\\end{array}";
      return "\\begin{array}{l}\\hat p_T-\\hat p_C=\\dfrac{" + T.rec + "}{" + T.ana + "}-\\dfrac{" + C.rec + "}{" + C.ana + "}\\\\[6pt]\\qquad\\quad\\ =" + f2(T.rate) + "-" + f2(C.rate) + "=" + f2(T.rate - C.rate) + "\\end{array}";
    },
    status: function (v) {
      var s = v.step || 1;
      if (s === 1) return "<b>" + EX + "</b> of 36 screened people fail the entry criteria; the <b>" + ENR + "</b> who are eligible and consent are enrolled.";
      if (s === 2) return "A concealed random sequence assigns each enrolled person: <b>" + T.n + "</b> to treatment and <b>" + C.n + "</b> to control, so no one's prognosis or preference picks the arm.";
      if (s === 3) return "The arms start alike: <b>" + T.old + "</b> vs <b>" + C.old + "</b> are 65 or older, and randomization balances traits nobody measured in the same way, on average.";
      if (s === 4) return "Over 12 weeks <b>" + T.lost + "</b> people on treatment and <b>" + C.lost + "</b> on control are lost to follow-up; everyone else is measured in the arm they were randomized to.";
      return "<b>" + pc(T.rate) + "</b> recovered on treatment vs <b>" + pc(C.rate) + "</b> on control: because the arms were randomized, the " +
        Math.round((T.rate - C.rate) * 100) + "-point gap estimates the treatment's effect (with this few people, chance is still part of it).";
    },
    examples: [
      {name: "screening", values: {step: 1}},
      {name: "random allocation", values: {step: 2}},
      {name: "balanced arms", values: {step: 3}},
      {name: "lost to follow-up", values: {step: 4}},
      {name: "the comparison", values: {step: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, col = {T: c.c3, C: c.c2};
      function person(at, p, o) {   // circle: under 65, square: 65 or older
        var r = 7;
        if (p.old) api.rect(at[0] - r + 0.5, at[1] - r + 0.5, 2 * r - 1, 2 * r - 1, {fill: o.fill || "none", fillOpacity: o.fo, stroke: o.stroke, width: o.w || 1.6, rx: 2, dash: o.dash, opacity: o.op});
        else api.circle(at, r, {fill: o.fill || "none", fillOpacity: o.fo, stroke: o.stroke, width: o.w || 1.6, dash: o.dash, opacity: o.op});
      }
      // legend: shapes always, fill in the last step
      api.rect(12, 282, 11, 11, {stroke: c.muted, width: 1.4, rx: 2});
      api.label([29, 288], "65+", {color: c.muted, size: 12});
      api.circle([67, 288], 5.5, {stroke: c.muted, width: 1.4});
      api.label([78, 288], "under 65", {color: c.muted, size: 12});
      if (s <= 2) {
        // everyone screened, in a grid; the same seats in step 2 so the eye follows the same people
        api.label([200, 26], s === 1 ? "36 people screened" : "a concealed random draw for each enrolled person", {color: c.ink, size: 13, weight: 600, anchor: "middle"});
        people.forEach(function (p) {
          var at = [80 + p.col * 30, 62 + p.row * 30];
          if (!p.elig) {
            if (s === 1) {
              person(at, p, {stroke: c.faint});
              api.line([at[0] - 5, at[1] - 5], [at[0] + 5, at[1] + 5], {color: c.c5, width: 2});
              api.line([at[0] - 5, at[1] + 5], [at[0] + 5, at[1] - 5], {color: c.c5, width: 2});
            }
            return;
          }
          if (s === 1) person(at, p, {fill: c.muted, fo: 0.45, stroke: c.muted});
          else person(at, p, {fill: col[p.arm], fo: 0.85, stroke: col[p.arm]});
        });
        if (s === 1) {
          api.label([80, 196], "× " + EX + " excluded: did not meet the entry criteria", {color: c.c5, size: 12.5});
          api.label([80, 220], "○ " + ENR + " eligible and consented: enrolled", {color: c.ink, size: 12.5});
        } else {
          api.label([110, 200], "treatment: " + T.n, {color: c.c3, size: 13, weight: 650, anchor: "middle"});
          api.label([290, 200], "control: " + C.n, {color: c.c2, size: 13, weight: 650, anchor: "middle"});
          api.label([200, 226], "neither patient nor doctor chooses the arm", {color: c.muted, size: 12, anchor: "middle"});
        }
        return;
      }
      // steps 3-5: the two arms
      var K = {T: T, C: C}, box = {T: 12, C: 208}, by = 34, bw = 180, bh = 140;
      ["T", "C"].forEach(function (a) {
        var bx = box[a], k = K[a];
        api.rect(bx, by, bw, bh, {fill: col[a], fillOpacity: 0.06, stroke: col[a], width: 1.4, rx: 8});
        api.label([bx + 10, by + 16], (a === "T" ? "treatment: drug" : "control: placebo") + " (" + k.n + ")", {color: col[a], size: 12.5, weight: 650});
        arms[a].forEach(function (p) {
          var at = [bx + 24 + (p.pos % 7) * 22, by + 44 + Math.floor(p.pos / 7) * 28];
          if (s >= 4 && p.lost) person(at, p, {stroke: c.faint, dash: "2 2.5", op: s === 5 ? 0.6 : 1});
          else if (s === 5 && !p.rec) person(at, p, {stroke: col[a], w: 1.8});
          else person(at, p, {fill: col[a], fo: 0.85, stroke: col[a]});
        });
        var note = s === 3 ? "65 or older: " + k.old + " of " + k.n : s === 4 ? k.lost + " lost to follow-up" : k.rec + " of " + k.ana + " recovered";
        api.label([bx + 12, by + 98], note, {color: c.ink, size: 12.5});
        if (s === 5) {
          var tw = bw - 60;
          api.rect(bx + 12, by + 114, tw, 12, {fill: c.grid, rx: 3});
          api.rect(bx + 12, by + 114, tw * k.rate, 12, {fill: col[a], fillOpacity: 0.9, rx: 3});
          api.label([bx + 18 + tw, by + 120], pc(k.rate), {color: col[a], size: 12.5, weight: 650});
        }
      });
      if (s === 3) {
        api.label([200, 200], "placebo looks identical: double-blind", {color: c.muted, size: 12.5, anchor: "middle"});
        api.label([200, 224], "baseline traits balanced by chance, not by choice", {color: c.muted, size: 12.5, anchor: "middle"});
      } else if (s === 4) {
        api.arrow([40, 206], [360, 206], {color: c.muted, width: 2, halo: false});
        api.label([200, 192], "12 weeks of follow-up", {color: c.muted, size: 12.5, anchor: "middle"});
        api.label([200, 230], "outcomes recorded by an assessor who is blind to the arm", {color: c.muted, size: 12, anchor: "middle"});
      } else {
        // the comparison on one percent axis
        var X = function (q) { return 40 + 320 * q; }, ya = 234;
        api.line([X(0), ya], [X(1), ya], {color: c.axis, width: 1.2});
        [0, 0.5, 1].forEach(function (q) { api.label([X(q), ya + 14], pc(q), {color: c.muted, size: 12, anchor: "middle"}); });
        api.line([X(C.rate), ya - 10], [X(T.rate), ya - 10], {color: c.ink, width: 1.5, arrow: true, arrowStart: true});
        api.point([X(C.rate), ya], {color: c.c2, r: 5.5});
        api.point([X(T.rate), ya], {color: c.c3, r: 5.5});
        api.label([(X(C.rate) + X(T.rate)) / 2, ya - 24], "difference " + Math.round((T.rate - C.rate) * 100) + " points", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
        api.circle([200, 288], 5.5, {fill: c.muted, stroke: c.muted, width: 1.4});
        api.label([211, 288], "recovered", {color: c.muted, size: 12});
        api.circle([286, 288], 5.5, {stroke: c.muted, width: 1.4});
        api.label([297, 288], "not recovered", {color: c.muted, size: 12});
      }
    }
  });
})();
