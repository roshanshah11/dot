// The spindle assembly checkpoint (SAC) as a count of unattached kinetochores. Every kinetochore without microtubules
// is a factory for the wait-anaphase signal: Mps1 and Bub1 recruit Mad1-Mad2, which converts free Mad2 into the form
// that binds Cdc20, building the mitotic checkpoint complex (MCC: Mad2, BubR1, Bub3, Cdc20). MCC keeps APC/C-Cdc20
// off, so securin (and cyclin B) survive, securin keeps separase inactive, and cohesin holds the sisters together. Even
// one unattached kinetochore keeps anaphase waiting. When the last one attaches the signal stops: APC/C-Cdc20 tags
// securin for destruction, separase cuts cohesin and the sisters part. If the checkpoint is disabled (an Mps1 inhibitor,
// or Mad2 knocked down) APC/C fires on time whatever the attachments, and unattached chromatids lag or go to the
// wrong daughter: aneuploidy. Unattached chromosomes are drawn off the plate (mono-oriented ones near their pole).
(function () {
  var ROWS = [42, 76, 110, 144], PL = [30, 94], PR = [370, 94], ORDER = [[0, 1], [1, 0], [2, 1], [3, 0], [0, 0], [1, 1], [2, 0], [3, 1]];
  function free(v) { var f = [[false, false], [false, false], [false, false], [false, false]]; ORDER.slice(0, v.unattached).forEach(function (o) { f[o[0]][o[1]] = true; }); return f; }
  function signal(v) { return v.sac && v.unattached > 0; }

  Viz.register("spindle-assembly-checkpoint-attachment", {
    title: "Spindle checkpoint: waiting for every attachment",
    subject: "biology",
    shows: "Set how many kinetochores still lack microtubules: any unattached kinetochore makes the Mad2 wait signal, APC/C stays off and anaphase waits; at zero the sisters part, and with the checkpoint disabled the cell divides anyway and missegregates",
    params: {
      unattached: {kind: "integer", default: 1, min: 0, max: 8, label: "k"},
      sac: {kind: "boolean", default: true, label: "\\text{SAC}", on: "working", off: "disabled"}
    },
    formula: function (v) {
      var k = v.unattached;
      if (signal(v)) return "k=" + k + ">0\\ \\Rightarrow\\ \\text{MCC}\\dashv\\text{APC/C}^{\\text{Cdc20}}\\newline\\Rightarrow\\text{securin}\\dashv\\text{separase: cohesin holds}";
      if (!v.sac && k) return "\\text{SAC off: no MCC despite }k=" + k + "\\newline\\text{APC/C}^{\\text{Cdc20}}\\to\\text{separase cuts cohesin}";
      return "k=0\\ \\Rightarrow\\ \\text{no MCC},\\ \\text{APC/C}^{\\text{Cdc20}}\\ \\text{on}\\newline\\to\\text{securin destroyed}\\to\\text{cohesin cut}";
    },
    status: function (v) {
      var k = v.unattached, kt = k + " unattached kinetochore" + (k > 1 ? "s" : "");
      if (signal(v)) return (k === 1 ? "Even <b>one</b> unattached kinetochore" : "<b>" + kt.charAt(0).toUpperCase() + kt.slice(1) + "</b>") + " keep" + (k === 1 ? "s" : "") + " making the wait signal (Mad2 holding Cdc20), so APC/C stays off and <b>anaphase waits</b>.";
      if (!v.sac && k) return "With the checkpoint disabled, APC/C fires anyway: anaphase starts with <b>" + kt + "</b>, chromatids lag or go to the wrong pole, and the daughters can be <b>aneuploid</b>.";
      if (!v.sac) return "Every kinetochore is attached, so this division is correct even with the checkpoint disabled, but nothing would have stopped an error.";
      return "Every kinetochore is attached: the signal stops, APC/C tags securin for destruction, separase cuts cohesin and <b>anaphase starts</b>.";
    },
    examples: [
      {name: "all attached: anaphase", values: {unattached: 0, sac: true}},
      {name: "one unattached: waits", values: {unattached: 1, sac: true}},
      {name: "checkpoint disabled", values: {unattached: 3, sac: false}},
      {name: "nothing attached", values: {unattached: 8, sac: true}},
      {name: "disabled, nothing attached", values: {unattached: 8, sac: false}}
    ],
    size: [400, 310],
    draw: function (api, v) {
      var c = api.color, f = free(v), sig = signal(v), ana = !sig, k = v.unattached, firstFree = null;
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // spindle poles and a few interpolar microtubules
      [PL, PR].forEach(function (p) { api.circle(p, 7, {fill: c.c2, fillOpacity: 0.9}); });
      [-1, 1].forEach(function (sg) { api.line(PL, [228, 94 + sg * 18], {color: c.c2, width: 1, opacity: 0.25}); api.line(PR, [172, 94 + sg * 18], {color: c.c2, width: 1, opacity: 0.25}); });
      T(ana ? [200, 12] : [200, 12], sig ? "metaphase: anaphase waits" : !v.sac && k ? "anaphase with errors" : "anaphase", sig ? c.c5 : !v.sac && k ? c.c5 : c.c4, {anchor: "middle"});
      ROWS.forEach(function (y, i) {
        var a = !f[i][0], b = !f[i][1];                          // left / right kinetochore attached?
        var dx = a && b ? 0 : a ? -62 : b ? 62 : (i % 2 ? 108 : -108);
        var lx = 194 + dx, rx = 206 + dx;                         // chromatid centres
        if (ana) { if (a) lx = 118; if (b) rx = 282; }            // attached chromatids are pulled to their poles
        var kL = [lx - 5, y], kR = [rx + 5, y];
        [lx, rx].forEach(function (x) { api.rect(x - 4.5, y - 12, 9, 24, {fill: c.c6, fillOpacity: 0.75, rx: 4}); });
        if (!ana) { api.line([lx + 4, y - 6], [rx - 4, y - 6], {color: c.c3, width: 2.4}); api.line([lx + 4, y + 6], [rx - 4, y + 6], {color: c.c3, width: 2.4}); }
        [[kL, a, PL], [kR, b, PR]].forEach(function (q) {
          if (q[1]) { api.line(q[2], q[0], {color: c.c2, width: 1.6, opacity: 0.85}); api.circle(q[0], 3, {fill: c.c2}); }
          else {
            api.circle(q[0], 7, {fill: c.c5, fillOpacity: v.sac ? 0.3 : 0.12}); api.circle(q[0], 3, {fill: c.c5});
            if (!firstFree) firstFree = q[0];
          }
        });
        if (ana && (!a || !b) && (a || b)) T([(!a ? lx : rx), y + 20], "lagging", c.c5, {anchor: "middle", weight: 500});
      });
      if (firstFree && v.sac && !ana) T([firstFree[0] + (firstFree[0] > 200 ? 12 : -12), firstFree[1] - 13], "Mad2", c.c5, {anchor: firstFree[0] > 200 ? "start" : "end"});
      if (!ana) T([200, 166], "cohesin", c.c3, {anchor: "middle", weight: 500});
      // ---- the signalling chain ----
      var box = function (x, y, w, t, col, on, sub) {
        api.rect(x, y, w, 32, {fill: col, fillOpacity: on ? 0.26 : 0.05, stroke: col, width: 1.3, dash: on ? null : "4 3", rx: 6});
        T([x + w / 2, y + (sub ? 11 : 16)], t, on ? c.ink : c.muted, {anchor: "middle", weight: on ? 650 : 500});
        if (sub) T([x + w / 2, y + 24], sub, on ? col : c.muted, {anchor: "middle", weight: 500});
      };
      var y1 = 186, y2 = 252, apcOn = ana;
      box(10, y1, 104, k + " unattached", c.c5, k > 0, k ? "kinetochore" + (k > 1 ? "s" : "") : "none left");
      box(144, y1, 112, "Mad2 · Cdc20", c.c5, sig, !v.sac ? "SAC disabled" : "MCC");
      if (sig) api.rect(152, y1 + 28, 96 * k / 8, 3, {fill: c.c5, rx: 1.5});
      box(286, y1, 104, "APC/C", c.c4, apcOn, apcOn ? "active" : "off");
      box(10, y2, 104, "securin", c.c3, !apcOn, apcOn ? "destroyed" : "intact");
      box(144, y2, 112, "separase", c.c4, apcOn, apcOn ? "active" : "held off");
      box(286, y2, 104, "cohesin", c.c3, !apcOn, apcOn ? "cut" : "holds sisters");
      var arrow = function (a, b, col, on) { api.line(a, b, {color: on ? col : c.faint, width: 1.6, arrow: true, dash: on ? null : "3 3"}); };
      var bar = function (a, b, col, on) { api.line(a, b, {color: on ? col : c.faint, width: 1.6, dash: on ? null : "3 3"}); api.line([b[0], b[1] - 7], [b[0], b[1] + 7], {color: on ? col : c.faint, width: 2.2}); };
      arrow([116, y1 + 16], [142, y1 + 16], c.c5, sig);
      bar([258, y1 + 16], [283, y1 + 16], c.c5, sig);
      api.path("M 338 " + (y1 + 33) + " V " + (y1 + 48) + " H 62 V " + (y2 - 2), {stroke: apcOn ? c.c4 : c.faint, width: 1.6, dash: apcOn ? null : "3 3", arrow: true});
      T([200, y1 + 42], "tags for destruction", apcOn ? c.c4 : c.muted, {anchor: "middle", weight: 500});
      bar([116, y2 + 16], [141, y2 + 16], c.c3, !apcOn);
      arrow([258, y2 + 16], [284, y2 + 16], c.c4, apcOn);
      T([271, y2 + 42], "cuts", apcOn ? c.c4 : c.muted, {anchor: "middle", weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
