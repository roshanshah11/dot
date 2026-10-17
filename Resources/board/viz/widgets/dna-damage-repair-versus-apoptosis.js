// The DNA-damage decision. Sensor kinases ATM (double-strand breaks) and ATR (single-stranded DNA at stalled forks)
// phosphorylate p53, freeing it from MDM2, which otherwise tags it for destruction. How much p53 activity builds up
// picks the genes it switches on: high-affinity targets such as p21 come on first (CDKs blocked, arrest at G1/S while
// the DNA is repaired); only high, sustained activity reaches the low-affinity apoptosis genes PUMA and BAX. Mutant
// p53 cannot bind DNA, so neither happens and the damaged cell divides. The activity levels and the two thresholds
// on the bar are schematic. Colors: red = damage, purple = sensors, amber = p53, green = arrest and repair,
// blue = apoptosis, teal = normal cycling.
(function () {
  var LEVEL = {none: 0.12, mild: 0.5, severe: 0.9};
  function outcome(v) { return v.damage === "none" ? 0 : !v.p53 ? 3 : v.damage === "mild" ? 1 : 2; }
  var OUT = ["no damage: keeps cycling", "p21: arrest, repair, resume", "PUMA, BAX: apoptosis", "no checkpoint: divides damaged"];
  Viz.register("dna-damage-repair-versus-apoptosis", {
    title: "DNA damage: repair or apoptosis",
    subject: "biology",
    shows: "Step from damage to decision: sensors raise p53, a little p53 pauses the cycle for repair, a lot triggers apoptosis, and mutant p53 does neither",
    params: {
      damage: {kind: "enum", values: ["none", "mild", "severe"], default: "mild", label: "\\text{damage}"},
      p53: {kind: "boolean", default: true, label: "p53", on: "working", off: "mutant"}
    },
    steps: ["damage", "sensors free p53", "p53 activity builds", "outcome"],
    stepMs: 1800,
    formula: function (v) {
      var s = v.step || 1, o = outcome(v);
      var ch = v.damage === "none" ? ["\\text{intact DNA}", "\\text{MDM2 holds p53}", "\\text{p53 low}", "\\text{cycle continues}"]
        : ["\\text{" + v.damage + " damage}", "\\text{ATM/ATR}", v.p53 ? "\\text{p53}\\uparrow" : "\\text{mutant p53}",
           ["", "\\text{p21: arrest + repair}", "\\text{PUMA, BAX: apoptosis}", "\\text{divides damaged}"][o]];
      ch = ch.map(function (t, i) { return i === s - 1 ? "\\boxed{" + t + "}" : t; });
      return ch.slice(0, 2).join("\\to ") + "\\newline\\to " + ch.slice(2).join("\\to ");
    },
    status: function (v) {
      var s = v.step || 1, d = v.damage, o = outcome(v);
      if (s === 1) return d === "none" ? "The DNA is intact, and MDM2 keeps p53 scarce by tagging it for destruction."
        : d === "mild" ? "<b>Mild damage</b>: a nicked strand and one damaged base, the kind of lesion repair enzymes fix routinely."
        : "<b>Severe damage</b>: several double-strand breaks, more than the cell can safely fix.";
      if (s === 2) return d === "none" ? "Nothing to sense: ATM and ATR stay quiet and MDM2 keeps p53 low."
        : "ATM and ATR sense the lesions and <b>phosphorylate p53</b>, freeing it from MDM2 so it builds up" + (v.p53 ? "." : ", but this p53 is a mutant.");
      if (s === 3) return d === "none" ? "p53 activity stays below every target gene's threshold."
        : !v.p53 ? "Mutant p53 <b>cannot bind DNA</b>, so neither p21 nor the apoptosis genes come on."
        : d === "mild" ? "Moderate p53 activity switches on the high-affinity target <b>p21</b>, but not the apoptosis genes."
        : "High, sustained p53 activity also switches on the low-affinity apoptosis genes <b>PUMA and BAX</b>.";
      return ["The cell <b>keeps cycling</b> normally.",
              "p21 blocks the CDKs and holds the cell at the <b>G1/S checkpoint</b> while the DNA is repaired; then the cycle resumes.",
              "PUMA and BAX open the mitochondria and caspases dismantle the cell: <b>apoptosis</b> removes DNA too damaged to trust.",
              "With no checkpoint and no apoptosis the cell <b>divides with its damage</b>, passing mutations to both daughters: a step toward cancer."][o];
    },
    examples: [
      {name: "no damage", values: {damage: "none", step: 4}},
      {name: "mild: arrest and repair", values: {damage: "mild", step: 4}},
      {name: "severe: apoptosis", values: {damage: "severe", step: 4}},
      {name: "mutant p53", values: {damage: "severe", p53: false, step: 4}},
      {name: "severe: p53 builds up", values: {damage: "severe", step: 3}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, d = v.damage, o = outcome(v);
      // ---- the DNA, with its lesions ----
      var y1 = 46, y2 = 66, op = s === 1 ? 1 : 0.6;
      var cuts = d === "severe" ? [86, 166, 246, 326] : [];
      var segs = [], last = 18;
      cuts.forEach(function (x) { segs.push([last, x - 5]); last = x + 5; }); segs.push([last, 382]);
      segs.forEach(function (sg, k) {
        var dy = cuts.length ? (k % 2 ? 3 : -3) : 0;
        api.line([sg[0], y1 + dy], [sg[1], y1 + dy], {color: c.ink, width: 2.4, opacity: op});
        api.line([sg[0], y2 + dy], [sg[1], y2 + dy], {color: c.ink, width: 2.4, opacity: op});
        for (var x = sg[0] + 5; x < sg[1] - 2; x += 10) api.line([x, y1 + dy + 2], [x, y2 + dy - 2], {color: c.muted, width: 1.4, opacity: op});
      });
      var lesions = d === "severe" ? cuts : d === "mild" ? [130, 270] : [];
      var fixed = s === 4 && o === 1;
      if (d === "mild" && !fixed) {
        api.line([126, y1], [134, y1], {color: c.card, width: 4});    // a nick in one strand
        api.circle([270, (y1 + y2) / 2], 6, {fill: c.c5});            // a damaged base
      }
      lesions.forEach(function (x) { api.circle([x, (y1 + y2) / 2], 13, {stroke: fixed ? c.c4 : c.c5, width: 2, dash: "3 2"}); });
      api.label([16, 18], d === "none" ? "intact DNA" : fixed ? "repaired: nick sealed, base replaced" : d === "mild" ? "mild: a nick and a damaged base" : "severe: double-strand breaks",
        {color: d === "none" ? c.muted : fixed ? c.c4 : c.c5, size: 12.5, weight: 650});
      // ---- step 2: sensors free p53 from MDM2 ----
      if (s >= 2) lesions.forEach(function (x) {   // the current step gets a solid pill; later steps a pale one with ink text
        api.rect(x - 29, 78, 58, 16, s === 2 ? {fill: c.c6, rx: 8} : {fill: c.c6, fillOpacity: 0.18, stroke: c.c6, width: 1.2, rx: 8});
        api.label([x, 86], "ATM/ATR", {color: s === 2 ? c.card : c.ink, size: 12, weight: 700, anchor: "middle"});
      });
      var px = 40, py = 111, held = s === 1 || d === "none", hi = s === 2 ? 1 : 0.7;
      api.circle([px, py], 13, {fill: c.c3, fillOpacity: 0.9, stroke: v.p53 ? c.c3 : c.c5, width: v.p53 ? 1.5 : 2.5});   // mutant: red ring
      api.label([px, py], "p53", {color: c.card, size: 12, weight: 700, anchor: "middle"});
      var mx = held ? px + 26 : px + 52;
      api.circle([mx, py], 12, {fill: c.muted, fillOpacity: held ? 0.6 : 0.35});
      api.label([mx, py], "M", {color: c.ink, size: 12, weight: 700, anchor: "middle"});
      if (!held) api.label([px + 10, py - 14], "P", {color: c.c6, size: 12, weight: 800});
      var txt = held ? (v.p53 ? "" : "mutant p53, ") + "held by MDM2: kept low" : v.p53 ? "MDM2 released: p53 accumulates" : "mutant p53 accumulates, cannot bind DNA";
      api.label([mx + 18, py], txt, {color: held ? c.muted : v.p53 ? c.c3 : c.c5, size: 12, opacity: held ? 1 : hi});
      // ---- step 3: p53 activity against the two gene thresholds ----
      // the bar sits right of its threshold labels, so the step-4 arrow leaves the bar without crossing any text
      var bx = 106, bt = 158, bh = 114, lvl = !v.p53 && d !== "none" ? 0.04 : LEVEL[d];
      api.label([bx + 11, bt - 10], "p53 activity", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      api.rect(bx, bt, 22, bh, {stroke: c.faint, width: 1.2, rx: 5});
      if (s >= 3) api.rect(bx + 2, bt + bh * (1 - lvl), 18, bh * lvl - 2, {fill: c.c3, fillOpacity: s === 3 ? 0.95 : 0.6, rx: 4});
      [[0.3, "p21", c.c4], [0.7, "PUMA, BAX", c.c2]].forEach(function (t) {
        var y = bt + bh * (1 - t[0]), on = s >= 3 && lvl >= t[0];
        api.line([bx - 4, y], [bx + 26, y], {color: t[2], width: 1.6, dash: "4 3"});
        api.label([bx - 8, y], t[1] + (s >= 3 ? (on ? " on" : " off") : ""), {color: t[2], size: 12, weight: on ? 700 : 500, opacity: s >= 3 && !on ? 0.6 : 1, anchor: "end"});
      });
      // ---- step 4: the four possible outcomes ----
      var cols = [c.c1, c.c4, c.c2, c.c5];
      OUT.forEach(function (t, k) {
        var y = 144 + k * 37, on = s === 4 && k === o;
        api.rect(164, y, 224, 30, {fill: cols[k], fillOpacity: on ? 0.22 : 0.04, stroke: on ? cols[k] : c.faint, width: on ? 2 : 1, rx: 8});
        api.label([176, y + 15], t, {color: on ? cols[k] : c.muted, size: 12, weight: on ? 700 : 500, opacity: on ? 1 : 0.75});
      });
      if (s === 4) {   // from the top of the bar's fill, around the corner, into the chosen outcome
        var yB = 159 + o * 37, yF = Math.abs(bt + bh * (1 - lvl) - yB) < 8 ? yB : bt + bh * (1 - lvl), ex = 146;   // no tiny jog
        api.path("M " + (bx + 24) + " " + yF + " L " + ex + " " + yF + " L " + ex + " " + yB, {stroke: cols[o], width: 2});
        api.arrow([ex, yB], [161, yB], {color: cols[o], width: 2, halo: false, head: 8});
      }
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
