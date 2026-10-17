// The G1 DNA damage checkpoint, step by step: ATM (ATR for single-stranded DNA) senses the damage and activates
// Chk2/Chk1; they and ATM phosphorylate p53, so MDM2 can no longer tag it for destruction and p53 builds up; p53
// switches on p21, which shuts off cyclin E-CDK2; Rb stays unphosphorylated and keeps E2F bound, so S-phase genes
// stay off and the cell waits in G1. Then: repair and resume, apoptosis if the damage is too great, or, with a mutant
// p53, no arrest at all. Levels on the right are schematic (low/high), not measured values.
(function () {
  function key(v) { return v.damage === "none" ? "none" : v.p53 === "mutant" ? "mut" : v.damage === "severe" ? "sev" : "rep"; }
  var TXT = [
    {none: "No DNA damage, so ATM and ATR stay quiet and no alarm is raised", dmg: "ATM senses the double-strand breaks (ATR senses single-stranded DNA) and activates Chk2 and Chk1"},
    {none: "MDM2 tags p53 with ubiquitin, so p53 is destroyed and stays low", ok: "ATM and Chk2 phosphorylate p53, so MDM2 can no longer tag it and <b>p53 builds up</b>", mut: "The alarm reaches p53, but this mutant p53 cannot bind DNA, so it switches on no genes"},
    {none: "With p53 low, no p21 is made", ok: "p53 switches on the p21 gene: <b>p21</b>, a CDK inhibitor, accumulates", mut: "With no working p53, no p21 is made"},
    {go: "Cyclin E–CDK2 phosphorylates Rb, Rb lets go of E2F, and E2F switches on the S-phase genes", ok: "p21 shuts off cyclin E–CDK2, so Rb stays unphosphorylated and keeps <b>E2F bound</b>: S-phase genes stay off"},
    {none: "The cell passes the G1/S checkpoint and starts copying its DNA", rep: "The cell waits in G1 while the breaks are repaired; then p53 falls, p21 fades and the cell <b>enters S</b>",
     sev: "The damage is beyond repair, so p53 switches on pro-apoptotic genes (PUMA, BAX) and the cell dies by <b>apoptosis</b>",
     mut: "The cell enters S with broken DNA and copies the damage into <b>mutations</b>, a step toward cancer (TP53 is mutated in about half of human tumours)"}
  ];
  function say(v) {
    var k = key(v), s = (v.step || 1) - 1, t = TXT[s];
    if (k === "none" && v.p53 === "mutant" && s === 1) return "With no damage nothing calls on p53, so this mutant p53 makes no difference yet";
    if (k === "none" && v.p53 === "mutant" && s === 4) return t.none + "; its mutant p53 will only matter once its DNA is damaged";
    if (s === 0) return k === "none" ? t.none : t.dmg;
    if (s === 3) return k === "rep" || k === "sev" ? t.ok : t.go;
    if (s === 4) return t[k];
    return k === "none" ? t.none : k === "mut" ? t.mut : t.ok;
  }
  var OUT = {none: ["passes G1/S", "copies its DNA in S phase"], rep: ["arrest, repair, then S phase", "p53 falls once the DNA is fixed"],
             sev: ["apoptosis", "p53 → PUMA, BAX: the cell is removed"], mut: ["no arrest: enters S damaged", "breaks are copied into mutations"]};

  Viz.register("g1-dna-damage-checkpoint-arrest", {
    title: "G1 checkpoint: DNA damage arrest",
    subject: "biology",
    shows: "Step through the G1 DNA damage checkpoint: ATM senses breaks, p53 builds up, p21 shuts off cyclin E–CDK2, Rb keeps E2F bound and the cell waits, repairs or dies; break p53 and the cell divides with damaged DNA",
    params: {
      damage: {kind: "enum", values: ["none", "repairable", "severe"], default: "repairable", label: "\\text{damage}"},
      p53: {kind: "enum", values: ["working", "mutant"], default: "working", label: "p53"}
    },
    steps: ["sensors (ATM, Chk2)", "p53", "p21", "CDK2, Rb and E2F", "outcome"],
    stepMs: 1700,
    formula: function (v) {
      var k = key(v);
      if (k === "none" && v.p53 === "mutant") return "\\text{no damage: mutant }p53\\text{ never tested}\\newline\\text{CDK2}\\to\\text{Rb-P}\\Rightarrow\\text{E2F on: S phase}";
      if (k === "none") return "\\text{MDM2}\\dashv p53\\ \\text{(kept low)}\\newline\\text{CDK2}\\to\\text{Rb-P}\\Rightarrow\\text{E2F on: S phase}";
      if (k === "mut") return "\\text{damage}\\to\\text{ATM}\\to\\cancel{p53}\\newline\\text{no }p21\\Rightarrow\\text{E2F on: S phase}";
      return "\\text{damage}\\to\\text{ATM}\\to p53\\uparrow\\to p21\\newline p21\\dashv\\text{CDK2, so Rb holds E2F}";
    },
    status: function (v) { return say(v) + "."; },
    examples: [
      {name: "repairable damage: arrest, then resume", values: {damage: "repairable", p53: "working", step: 5}},
      {name: "severe damage: apoptosis", values: {damage: "severe", p53: "working", step: 5}},
      {name: "mutant p53: no arrest", values: {damage: "repairable", p53: "mutant", step: 5}},
      {name: "no damage: the cell proceeds", values: {damage: "none", step: 4}},
      {name: "p21 blocks CDK2", values: {damage: "repairable", step: 4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, k = key(v), dmg = k !== "none", ok = k === "rep" || k === "sev", arrest = ok;
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // a node: pending (not reached yet) is a faint outline; reached and active is filled in its colour; reached but
      // switched off is a muted outline, so a coloured outline always means active
      var node = function (x0, x1, y, text, reached, col, on) {
        var hue = !reached ? c.faint : on ? col : c.muted;
        api.rect(x0, y - 13, x1 - x0, 26, {fill: hue, fillOpacity: reached && on ? 0.22 : 0.04, stroke: hue, width: reached && on ? 1.8 : 1, rx: 7, opacity: reached && !on ? 0.55 : 1});
        T([(x0 + x1) / 2, y], text, reached ? (on ? col : c.muted) : c.faint, {anchor: "middle", weight: reached && on ? 650 : 500});
      };
      var act = function (a, b, col) { api.line(a, b, {color: col, width: 1.8, arrow: true}); };
      var inh = function (a, b, col) {
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), px = -dy / L * 6, py = dx / L * 6;
        api.line(a, b, {color: col, width: 1.8}); api.line([b[0] + px, b[1] + py], [b[0] - px, b[1] - py], {color: col, width: 2.4});
      };
      var y1 = 30, y2 = 96, y3 = 162, red = c.c5, grn = c.c4;
      // row 1: sensing
      var repaired = s === 5 && k === "rep";
      // three columns, 8-108, 120-198 and 210-312, wide enough for the bold row-3 labels (about 90 px) with padding;
      // every arrow between boxes stays in a 12 px gap
      node(8, 108, y1, repaired ? "DNA fixed" : "DNA", true, c.c2, true);
      if (dmg && !repaired) api.polyline([[97, 20], [90, 29], [98, 31], [91, 41]], {stroke: red, width: 2.2});   // right of the word, not over it
      node(120, 198, y1, "ATM / ATR", s >= 1, red, dmg && !repaired);
      node(210, 312, y1, "Chk2 / Chk1", s >= 1, red, dmg && !repaired);
      act([108, y1], [118, y1], s >= 1 && dmg ? red : c.faint); act([198, y1], [208, y1], s >= 1 && dmg ? red : c.faint);
      // row 2: MDM2 and p53, then p21
      node(8, 108, y2, "MDM2", s >= 2, c.c6, !dmg && v.p53 === "working");
      node(120, 198, y2, k === "mut" ? "mutant p53" : "p53", s >= 2, red, (ok && !repaired) || k === "mut");
      if (s >= 2 && k === "mut") api.line([126, y2 + 9], [192, y2 - 9], {color: red, width: 1.6});
      node(210, 312, y2, "p21", s >= 3, red, ok && !repaired);
      act([254, y1 + 13], [182, y2 - 15], s >= 2 && dmg ? red : c.faint);
      T([230, 62], "P", s >= 2 && dmg ? c.c3 : c.faint, {anchor: "middle", weight: 700});
      inh([108, y2], [118, y2], s >= 2 && !dmg && v.p53 === "working" ? c.c6 : c.faint);
      if (s >= 2 && dmg) T([113, y2 - 14], "×", c.c6, {anchor: "middle", weight: 700, size: 13});
      act([198, y2], [208, y2], s >= 3 && ok ? red : c.faint);
      // row 3: CDK2, Rb and E2F, S-phase genes
      var go = !arrest || repaired;
      node(210, 312, y3, "cyclin E–CDK2", s >= 4, grn, go);
      node(120, 198, y3, go ? "Rb-P + E2F" : "Rb · E2F", s >= 4, go ? grn : red, true);
      node(8, 108, y3, "S-phase genes", s >= 4, grn, go);
      inh([261, y2 + 13], [261, y3 - 15], s >= 4 && arrest && !repaired ? red : c.faint);
      act([210, y3], [200, y3], s >= 4 && go ? grn : c.faint); act([120, y3], [110, y3], s >= 4 && go ? grn : c.faint);
      // row 4: the outcome
      var oc = k === "sev" ? red : k === "mut" ? red : k === "rep" ? c.c1 : grn;
      api.rect(8, 196, 304, 42, {fill: s >= 5 ? oc : c.faint, fillOpacity: s >= 5 ? 0.12 : 0.03, stroke: s >= 5 ? oc : c.faint, width: 1.2, rx: 8});
      if (s >= 5) { T([160, 210], OUT[k][0], oc, {anchor: "middle", weight: 700}); T([160, 226], OUT[k][1], c.ink, {anchor: "middle", weight: 500}); }
      else T([160, 217], "outcome at step 5", c.faint, {anchor: "middle", weight: 500});
      api.line([58, y3 + 13], [58, 194], {color: s >= 5 ? oc : c.faint, width: 1.4, dash: "3 3"});
      [[12, "→ activates"], [100, "⊣ inhibits"], [180, "P = phosphate"]].forEach(function (q) { T([q[0], 262], q[1], c.muted, {weight: 500}); });   // SVG collapses runs of spaces
      // ---- right: where the cell is in its cycle, and the levels of p53, p21 and CDK2 activity ----
      var cx = 352, cy = 62, R = 28, pos = function (f, r) { var a = (-90 + 360 * f) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
      var arc = function (f0, f1) { var a = pos(f0, R), b = pos(f1, R); return "M " + a[0].toFixed(1) + " " + a[1].toFixed(1) + " A " + R + " " + R + " 0 " + (f1 - f0 > 0.5 ? 1 : 0) + " 1 " + b[0].toFixed(1) + " " + b[1].toFixed(1); };
      [["G_1", 0, 0.42], ["S", 0.42, 0.7], ["G_2", 0.7, 0.86], ["M", 0.86, 1]].forEach(function (p) {
        api.path(arc(p[1] + 0.004, p[2] - 0.004), {stroke: c.ink, width: 11, opacity: 0.13});
        T(pos((p[1] + p[2]) / 2, R + 15), p[0], c.muted, {anchor: "middle", weight: 600});
      });
      var gate = s < 4 ? c.faint : arrest && !repaired ? red : grn;
      api.line(pos(0.42, R - 9), pos(0.42, R + 9), {color: gate, width: 4});
      if (s >= 5 && k === "sev") T([cx, cy], "✕", red, {anchor: "middle", size: 18, weight: 700});
      else {
        var f = s >= 5 && go ? 0.53 : 0.37;
        api.circle(pos(f, R), 6, {fill: c.c1, stroke: c.card, width: 1.5});
        T([cx, cy], s >= 5 && go ? "in S" : s >= 4 && arrest ? "held" : "late G_1", s >= 4 && arrest && !(s >= 5 && go) ? red : c.c1, {anchor: "middle", weight: 650});
      }
      var lv = function (name, base, after, at, col, y) {
        var val = s >= at ? after : base;
        T([320, y], name, c.muted, {weight: 600});
        api.rect(357, y - 5, 36, 10, {fill: c.ink, fillOpacity: 0.07, rx: 3});
        api.rect(357, y - 5, 36 * val, 10, {fill: col, fillOpacity: 0.85, rx: 3});
      };
      T([320, 204], "levels", c.muted, {weight: 500});   // beside the outcome box, below the cycle
      var p53v = k === "sev" ? 1 : k === "rep" ? (repaired ? 0.25 : 0.85) : k === "mut" ? 0.6 : 0.12;
      lv("p53", 0.12, p53v, 2, k === "mut" ? c.faint : red, 222);
      lv("p21", 0.1, ok ? (repaired ? 0.25 : 0.85) : 0.1, 3, red, 242);
      lv("CDK2", 0.75, arrest && !repaired ? 0.1 : 0.9, 4, grn, 262);
      if (k === "mut" && s >= 2) T([392, 282], "p53 inactive", c.muted, {anchor: "end", weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
