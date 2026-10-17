// The guide RNA is the address: slide it along a stretch of DNA. Cas9 cuts only where the 20 matched bases are
// followed by an NGG PAM, and then always 3 bp upstream of the PAM: RuvC cuts the displaced (non-target) strand,
// HNH the strand the guide pairs with, at the same spot, so the break has blunt ends.
(function () {
  var TOP = "TTACGATCCAGTTCAAGCTACATGGAGGCAGG", COMP = {A: "T", T: "A", G: "C", C: "G"};
  function site(v) {
    var s = v.site - 1, pam = TOP.substr(s + 20, 3);
    return {s: s, pam: pam, ok: pam.charAt(1) === "G" && pam.charAt(2) === "G", cutAfter: s + 17};   // cutAfter is 1-based
  }
  Viz.register("crispr-guide-directed-dna-cleavage", {
    title: "Guide-directed cutting by Cas9",
    subject: "biology",
    shows: "Slide the guide along the DNA: Cas9 cuts only where an NGG PAM follows the matched 20 bases, always 3 bp from the PAM, with RuvC and HNH each cutting one strand",
    params: {
      site: {kind: "integer", default: 3, min: 1, max: 10, label: "\\text{guide at}"},
      broken: {kind: "boolean", default: false, label: "\\text{ends}", on: "pulled apart", off: "in place"}
    },
    formula: function (v) {
      var q = site(v), a = q.s + 21, b = q.s + 23;
      if (!q.ok) return "\\text{bp } " + a + "\\text{–}" + b + " = \\text{" + q.pam + "} \\ne \\text{NGG} \\Rightarrow \\text{no cut}";
      return "\\text{PAM at bp } " + a + "\\text{–}" + b + " \\Rightarrow \\text{cut after bp } " + q.cutAfter;
    },
    status: function (v) {
      var q = site(v), span = "bp " + (q.s + 1) + "–" + (q.s + 20);
      if (!q.ok) return "This guide matches " + span + ", but the next bases, " + q.pam + ", are not NGG, so <b>Cas9 never binds</b> here.";
      if (v.broken) return "The two cuts line up at bp " + q.cutAfter + "|" + (q.cutAfter + 1) + ", so the break has <b>blunt ends</b> for the cell to repair.";
      return "The guide matches " + span + " and " + q.pam + " follows, so Cas9 cuts <b>after bp " + q.cutAfter + "</b>: RuvC cuts the displaced strand, HNH the one the guide pairs with.";
    },
    examples: [
      {name: "first site with a PAM", values: {site: 3}},
      {name: "no PAM here", values: {site: 1}},
      {name: "last site, ends apart", values: {site: 10, broken: true}}
    ],
    size: [400, 182],
    draw: function (api, v) {
      var c = api.color, q = site(v), s = q.s, n = TOP.length;
      var X0 = 28, dx = 11, yL = 66, yT = 102, yB = 126, yG = 46, apart = q.ok && v.broken;
      var X = function (i) { return X0 + i * dx + (apart ? (i <= s + 16 ? -8 : 8) : 0); };
      var lifted = function (i) { return q.ok && !apart && i >= s && i < s + 20; };
      var xc = (X(s + 16) + X(s + 17)) / 2;
      if (!apart) api.rect(X(s) - 12, 30, X(s + 22) - X(s) + 24, 126, {fill: c.c6, fillOpacity: q.ok ? 0.08 : 0.03, stroke: c.c6, width: 1.2, dash: q.ok ? null : "5 5", rx: 14, opacity: q.ok ? 0.85 : 0.55});
      if (!apart) api.label(q.ok ? [X(s) - 6, 41] : [X(s + 22) + 8, 41], "Cas9", {color: c.c6, size: 12.5, weight: 700, anchor: q.ok ? "start" : "end"});
      // backbones, broken into two pieces when the ends are pulled apart
      [[0, apart ? s + 16 : n - 1], apart ? [s + 17, n - 1] : null].forEach(function (r) {
        if (!r) return;
        var tp = [], bp = [];
        for (var i = r[0]; i <= r[1]; i++) { tp.push([X(i), (lifted(i) ? yL : yT) - 11]); bp.push([X(i), yB + 11]); }
        api.polyline(tp, {stroke: c.c1, width: 2});
        api.polyline(bp, {stroke: c.c2, width: 2});
      });
      api.label([X(0) - 14, yT], "5′", {color: c.c1, size: 12, anchor: "middle"});
      api.label([X(n - 1) + 14, yT], "3′", {color: c.c1, size: 12, anchor: "middle"});
      api.label([X(0) - 14, yB], "3′", {color: c.c2, size: 12, anchor: "middle"});
      api.label([X(n - 1) + 14, yB], "5′", {color: c.c2, size: 12, anchor: "middle"});
      if (!apart) api.rect(X(s + 20) - 6, yT - 9, 3 * dx + 1, 18, {fill: q.ok ? c.c4 : c.c5, fillOpacity: 0.16, stroke: q.ok ? c.c4 : c.c5, width: 1.2, rx: 4});
      if (!apart) api.label([X(s + 21), yB + 21], q.ok ? "PAM" : "not NGG", {color: q.ok ? c.c4 : c.c5, size: 12, weight: 650, anchor: "middle"});
      var gp = [];
      for (var i = 0; i < n; i++) {
        var up = lifted(i), inGuide = !apart && i >= s && i < s + 20;
        api.line([X(i), yT + 7], [X(i), yB - 7], {color: up ? c.c3 : c.faint, width: up ? 1.4 : 1.2, opacity: up ? 0.8 : 1});
        api.label([X(i), up ? yL : yT], TOP.charAt(i), {color: c.c1, size: 12, weight: 600, anchor: "middle", clamp: false});
        api.label([X(i), yB], COMP[TOP.charAt(i)], {color: c.c2, size: 12, weight: 600, anchor: "middle", clamp: false});
        if (inGuide) {
          var gy = q.ok ? yT : yG;
          api.label([X(i), gy], TOP.charAt(i).replace("T", "U"), {color: c.c3, size: 12, weight: 700, anchor: "middle", clamp: false, opacity: q.ok ? 1 : 0.75});
          gp.push([X(i), gy - 11]);
        }
        if (i % 5 === 4 || i === 0) api.label([X(i), yB + 42], String(i + 1), {color: c.muted, size: 12, anchor: "middle", clamp: false});
      }
      if (gp.length) api.polyline(gp, {stroke: c.c3, width: 2, opacity: q.ok ? 1 : 0.7});
      if (!apart) api.label(q.ok ? [X(s) + 2, (yL + yT) / 2 - 2] : [X(s), yG - 20], "guide RNA", {color: c.c3, size: 12.5, weight: 650});
      if (q.ok && !apart) {
        api.line([xc, yL - 22], [xc, yL + 9], {color: c.c5, width: 2.5, dash: "4 3"});
        api.line([xc, yB - 9], [xc, yB + 18], {color: c.c5, width: 2.5, dash: "4 3"});
        api.label([xc - 5, yL - 24], "RuvC", {color: c.c5, size: 12.5, weight: 700, anchor: "end"});
        api.label([xc - 5, yB + 21], "HNH", {color: c.c5, size: 12.5, weight: 700, anchor: "end"});
      }
      if (apart) {
        api.label([(X(s + 16) + X(s + 17)) / 2, yT - 30], "blunt double-strand break", {color: c.c5, size: 12.5, weight: 700, anchor: "middle"});
        api.line([X(s + 16) + 6, yT - 18], [X(s + 16) + 6, yB + 14], {color: c.c5, width: 1.5, dash: "3 3"});
        api.line([X(s + 17) - 6, yT - 18], [X(s + 17) - 6, yB + 14], {color: c.c5, width: 1.5, dash: "3 3"});
      }
    }
  });
})();
