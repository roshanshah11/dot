// Catabolite activation of lac, the textbook model, with lactose present so the repressor is already off the operator.
// Glucose transport turns adenylyl cyclase (the cya gene) down, so cAMP falls; with no glucose cAMP rises, two cAMP
// fill the CAP dimer (the crp gene), CAP-cAMP grips its site just upstream of the weak lac promoter, bends the DNA and
// touches RNA polymerase, which then starts far more often (about 50-fold, the round textbook figure, so without CAP the
// operon runs near 2% of full). The classic tests: cya⁻ cells lack cAMP and are rescued by cAMP in the medium; crp⁻
// cells lack CAP and are not. (Glucose also blocks lactose uptake, inducer exclusion; that is a separate effect.)
(function () {
  function model(v) {
    var made = v.strain !== "cya-" && !v.glucose, high = made || v.added, cap = v.strain !== "crp-", bound = high && cap;
    return {made: made, high: high, cap: cap, bound: bound, rate: bound ? 1 : 1 / 50};
  }
  var NAMES = {"wild type": "wild type", "cya-": "cya⁻", "crp-": "crp⁻"};

  Viz.register("lac-operon-catabolite-activation", {
    title: "lac operon: CAP and cAMP",
    subject: "biology",
    shows: "Toggle glucose, the strain and added cAMP: low glucose raises cAMP, CAP-cAMP binds beside the lac promoter and helps RNA polymerase start about 50 times more often",
    params: {
      glucose: {kind: "boolean", default: false, label: "\\text{glucose}", on: "present", off: "absent"},
      strain: {kind: "enum", values: ["wild type", "cya-", "crp-"], names: NAMES, default: "wild type", label: "strain"},
      added: {kind: "boolean", default: false, label: "\\text{cAMP}", on: "added to medium", off: "none added"}
    },
    formula: function (v) {
      var m = model(v);
      var l1 = v.strain === "cya-" && !v.added ? "\\text{cya}^-\\text{: no adenylyl cyclase}\\Rightarrow\\text{no cAMP}"
        : (m.made ? "\\text{glucose absent}" : v.strain === "cya-" ? "\\text{cAMP from the medium}" : v.added ? "\\text{cAMP added}" : "\\text{glucose present}") +
          "\\Rightarrow[\\text{cAMP}]" + (m.high ? "\\uparrow" : "\\downarrow");
      var l2 = !m.cap ? "\\text{crp}^-\\text{: no CAP}\\Rightarrow\\text{rate}\\approx\\tfrac{1}{50}=2\\%"
        : m.bound ? "\\text{CAP–cAMP on DNA}\\Rightarrow\\text{rate}=100\\%" : "\\text{CAP stays off}\\Rightarrow\\text{rate}\\approx\\tfrac{1}{50}=2\\%";
      return "\\begin{array}{l}" + l1 + "\\\\ " + l2 + "\\end{array}";
    },
    status: function (v) {
      var m = model(v);
      if (v.strain === "crp-") return "<b>crp⁻</b> cells make no CAP, so cAMP (" + (m.high ? "plenty here" : "low here") + ") has nothing to act on: stuck near <b>2%</b>, and added cAMP cannot help.";
      if (v.strain === "cya-") return m.bound ? "Added cAMP rescues <b>cya⁻</b>: CAP takes cAMP from the medium, grips its site, and the operon runs at <b>full rate</b>."
        : "<b>cya⁻</b> cells have no adenylyl cyclase, so no cAMP and CAP never binds: about <b>2%</b>, glucose or not.";
      if (v.glucose && v.added) return "Added cAMP fills CAP even with glucose present, so CAP–cAMP binds and the operon runs at <b>full rate</b>: glucose acts here through cAMP.";
      if (v.glucose) return "Glucose turns adenylyl cyclase down, so cAMP stays low and CAP stays off the DNA: even with lactose the operon runs at about <b>2%</b>.";
      return "No glucose: cAMP rises, fills CAP, and CAP–cAMP grips its site, bends the DNA and helps RNA polymerase start about <b>50 times</b> more often: <b>full rate</b>.";
    },
    examples: [
      {name: "no glucose: activated", values: {glucose: false, strain: "wild type", added: false}},
      {name: "glucose present", values: {glucose: true, strain: "wild type", added: false}},
      {name: "glucose plus added cAMP", values: {glucose: true, strain: "wild type", added: true}},
      {name: "cya⁻ rescued by cAMP", values: {glucose: false, strain: "cya-", added: true}},
      {name: "crp⁻ not rescued", values: {glucose: false, strain: "crp-", added: true}}
    ],
    size: [400, 256],
    draw: function (api, v) {
      var c = api.color, m = model(v), y = 196;
      // ---- glucose and adenylyl cyclase ----
      if (v.glucose) {
        [[22, 26], [40, 40], [20, 54]].forEach(function (p) {
          var h = []; for (var i = 0; i < 6; i++) h.push([p[0] + 7 * Math.cos(i * Math.PI / 3), p[1] + 7 * Math.sin(i * Math.PI / 3)]);
          api.polygon(h, {fill: c.c5, fillOpacity: 0.85});
        });
        api.label([12, 76], "glucose", {color: c.c5, size: 12.5, weight: 650});
        if (v.strain !== "cya-") { api.line([52, 40], [120, 40], {color: c.c5, width: 2}); api.line([120, 31], [120, 49], {color: c.c5, width: 2.5}); }
      } else api.label([12, 40], "no glucose", {color: c.muted, size: 12.5});
      var noAC = v.strain === "cya-";
      api.rect(126, 28, 110, 24, {fill: c.ink, fillOpacity: noAC ? 0.03 : 0.08, stroke: noAC ? c.c5 : (m.made ? c.ink : c.faint), width: 1.3, rx: 10, dash: noAC ? "4 3" : null});
      api.label([181, 40], "adenylyl cyclase", {color: noAC ? c.c5 : m.made ? c.ink : c.muted, size: 12, anchor: "middle"});
      if (noAC) { api.line([132, 26], [230, 54], {color: c.c5, width: 1.6}); api.label([181, 66], "cya⁻: no enzyme", {color: c.c5, size: 12, anchor: "middle", raw: true}); }
      else api.label([181, 66], m.made ? "active: ATP → cAMP" : "turned down", {color: m.made ? c.ink : c.muted, size: 12, anchor: "middle"});
      // ---- the cAMP pool: made in the cell, or added from outside ----
      if (m.made) api.arrow([240, 40], [262, 40], {color: c.c4, width: 2, halo: false, head: 8});
      var dots = m.high ? [[276, 32], [298, 44], [322, 30], [346, 46], [370, 34], [288, 62], [316, 66], [358, 64]] : v.strain === "cya-" ? [] : [[300, 46]];
      dots.forEach(function (p) { api.circle(p, 4, {fill: c.c4}); });
      api.label([390, 84], m.high ? (m.made ? "cAMP high" : "cAMP from the medium") : v.strain === "cya-" ? "no cAMP" : "cAMP low", {color: c.c4, size: 12.5, weight: 650, anchor: "end"});
      if (v.added) api.label([390, 14], "+ cAMP added", {color: c.c4, size: 12, anchor: "end"});
      // ---- the DNA; CAP-cAMP bends it at the CAP site ----
      var bend = m.bound ? 12 : 0;
      api.line([8, y], [66, y], {color: c.muted, width: 3}); api.line([108, y], [392, y], {color: c.muted, width: 3});
      if (m.bound) api.polyline([[66, y], [87, y + bend], [108, y]], {stroke: c.muted, width: 3});   // the CAP site, bent by CAP
      else api.rect(66, y - 8, 42, 16, {fill: c.c4, fillOpacity: 0.12, stroke: c.c4, width: 1.2, rx: 3});
      api.rect(108, y - 8, 40, 16, {fill: c.c2, fillOpacity: 0.15, stroke: c.c2, width: 1.2, rx: 3});
      api.rect(148, y - 8, 26, 16, {fill: c.c6, fillOpacity: 0.15, stroke: c.c6, width: 1.2, rx: 3});
      api.label([87, y + 24], "CAP site", {color: c.c4, size: 12, anchor: "middle"});
      api.label([128, y + 24], "P", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([161, y + 24], "O", {color: c.c6, size: 12.5, weight: 650, anchor: "middle"});
      [["lacZ", 178, 92], ["lacY", 272, 58], ["lacA", 332, 58]].forEach(function (g) {
        api.rect(g[1], y - 9, g[2] - 3, 18, {fill: c.ink, fillOpacity: 0.08, stroke: c.faint, width: 1.2, rx: 3});
        api.label([g[1] + g[2] / 2 - 1.5, y], g[0], {color: c.ink, size: 12, anchor: "middle", italic: true});
      });
      api.label([178, y - 22], "lactose present: O is free", {color: c.c6, size: 12});
      // ---- CAP: missing (crp-), empty and floating, or loaded on its site ----
      var capAt = m.bound ? [87, y - 9] : [96, 118];
      if (!m.cap) {
        [-8, 8].forEach(function (dx) { api.circle([capAt[0] + dx, capAt[1]], 9, {stroke: c.c5, width: 1.4, dash: "3 2"}); });
        api.line([capAt[0] - 20, capAt[1] - 12], [capAt[0] + 20, capAt[1] + 12], {color: c.c5, width: 1.6});
        api.label([capAt[0] + 26, capAt[1]], "crp⁻: no CAP", {color: c.c5, size: 12, raw: true});
      } else {
        [-8, 8].forEach(function (dx) { api.circle([capAt[0] + dx, capAt[1]], 9, m.bound ? {fill: c.c4, fillOpacity: 0.85} : {fill: c.c4, fillOpacity: 0.1, stroke: c.c4, width: 1.5, dash: "3 2"}); });
        if (m.high) [-8, 8].forEach(function (dx) { api.circle([capAt[0] + dx, capAt[1] - 11], 4, {fill: c.c4, fillOpacity: m.bound ? 1 : 0.5}); });
        api.label(m.bound ? [capAt[0] - 18, capAt[1] - 22] : [capAt[0] + 22, capAt[1]], m.bound ? "CAP–cAMP" : "CAP, empty", {color: c.c4, size: 12, anchor: "start"});
      }
      // ---- RNA polymerase: helped by CAP, or binding the weak promoter poorly ----
      api.path("M 112 " + y + " a 16 12 0 1 0 32 0 a 16 12 0 1 0 -32 0", {fill: c.c2, fillOpacity: m.bound ? 0.9 : 0.3, stroke: c.c2, width: 1.2});
      if (m.bound) api.line([103, y - 8], [114, y - 6], {color: c.ink, width: 2});
      api.label([128, y + 44], m.bound ? "RNA polymerase, touched by CAP" : "RNA polymerase binds weakly", {color: c.c2, size: 12, anchor: "start"});
      // ---- transcripts and the meter (linear: CAP's effect is about 50-fold) ----
      var n = m.bound ? 4 : 0;
      for (var k = 0; k < n; k++) {
        var x0 = 192 + k * 46, pts = [];
        for (var s = 0; s <= 26; s += 2) pts.push([x0 + s * 0.35 + 1.6 * Math.sin(s / 2.2), y + 12 + s]);
        api.polyline(pts, {stroke: c.c1, width: 1.7});
      }
      var mx0 = 220, mx1 = 386, my = 128;
      api.label([mx0, my - 16], "transcription:", {color: c.muted, size: 12});
      api.label([mx0 + 80, my - 16], m.bound ? "100% of full" : "≈2% of full", {color: m.bound ? c.c1 : c.c3, size: 12.5, weight: 700});
      api.rect(mx0, my - 5, mx1 - mx0, 10, {fill: c.ink, fillOpacity: 0.06, rx: 5});
      api.rect(mx0, my - 5, Math.max(4, (mx1 - mx0) * m.rate), 10, {fill: m.bound ? c.c1 : c.c3, fillOpacity: 0.9, rx: 3});
      api.label([mx0, my + 17], "0", {color: c.muted, size: 12, anchor: "middle"});
      api.label([mx1, my + 17], "100%", {color: c.muted, size: 12, anchor: "middle"});
      // viz.css paints svg text ink over the fill attribute; restate each label's color inline
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
