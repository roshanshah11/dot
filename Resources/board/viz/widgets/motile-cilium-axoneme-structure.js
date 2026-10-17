// A motile cilium's 9+2 axoneme in cross-section (seen from base toward tip) and from the side. Nine outer doublets
// (complete A tubule, incomplete B tubule) ring a central pair of singlets; radial spokes run from each A tubule to the
// central sheath, nexin-dynein regulatory complexes (nexin links) join neighboring doublets, and outer and inner dynein
// arms on each A tubule reach the B tubule of the next doublet. Doublet 1 is at 12 o'clock and the doublets are numbered
// clockwise, the way the arms point; the beat plane runs through doublet 1 and the 5-6 bridge, at right angles to the
// central pair. Dynein walks toward the base, so the arms on doublet n push doublet n+1 toward the tip. With arms on
// doublets 1-4 active the cilium bends toward 5-6 (effective stroke); with arms on 6-9 it bends back toward 1 (the
// switch-point model). Because nexin links stop the doublets sliding freely, sliding becomes bending: at the tip the
// doublets on the concave side lead by delta_l = d * theta, d = axoneme diameter of about 0.2 um, so 3.5 nm per degree
// (Satir; Satir, Heuser and Sale 2014). Digest the links with trypsin and ATP makes doublets slide apart instead
// (Summers and Gibbons 1971). The side view exaggerates the width about fivefold.
(function () {
  var D_NM = 200;
  Viz.register("motile-cilium-axoneme-structure", {
    title: "Motile cilium: the 9+2 axoneme",
    subject: "biology",
    shows: "Bend the cilium: dynein arms on one half of the 9+2 ring push their neighbors toward the tip, nexin links turn that sliding into a bend with tip offset d times theta, and with the links digested the doublets just slide apart",
    params: {
      theta: {kind: "number", default: 40, min: -80, max: 80, step: 5, label: "\\theta\\ (^\\circ)"},
      nexin: {kind: "boolean", default: true, label: "\\text{nexin}", on: "intact", off: "digested"}
    },
    formula: function (v) {
      var rad = v.theta * Math.PI / 180, dl = D_NM * Math.abs(rad);
      var arms = (v.nexin ? "d=200\\ \\text{nm},\\ " : "") + (v.theta > 0 ? "\\text{arms on 1–4 active}" : v.theta < 0 ? "\\text{arms on 6–9 active}" : "\\text{no net sliding}");
      if (!v.nexin) return "\\Delta l=" + Viz.n(dl, 0) + "\\ \\text{nm of sliding},\\ \\ \\theta_{\\text{bend}}=0\\newline " + arms;
      return "\\Delta l=d\\,|\\theta|=200\\times" + Viz.n(Math.abs(rad), 3) + "=" + Viz.n(dl, 0) + "\\ \\text{nm}\\newline " + arms;
    },
    status: function (v) {
      var dl = Viz.fmt(D_NM * Math.abs(v.theta) * Math.PI / 180, 0), a = Math.abs(v.theta);
      if (!v.nexin) return v.theta === 0 ? "With the nexin links digested nothing holds neighboring doublets together: any dynein sliding would push them <b>apart</b>, not bend them."
        : "Links digested: the same <b>" + dl + " nm</b> of dynein sliding just pushes the doublets past each other, so they <b>telescope apart</b> and nothing bends (Summers and Gibbons, 1971).";
      if (v.theta === 0) return "No net sliding, so the axoneme is <b>straight</b>; a beat switches the active arms between doublets 1–4 and 6–9.";
      return v.theta > 0
        ? "Arms on doublets <b>1–4</b> push their neighbors tipward, so 5–6 lead doublet 1 by <b>" + dl + " nm</b> at the tip; the nexin links turn that into a <b>" + a + "° bend toward 5–6</b>, the effective stroke."
        : "Arms on doublets <b>6–9</b> push the other way, so doublet 1 leads 5–6 by <b>" + dl + " nm</b>; resisted by the nexin links this becomes a <b>" + a + "° bend toward doublet 1</b>, the recovery stroke.";
    },
    examples: [
      {name: "effective stroke at maximum bend", values: {theta: 80}},
      {name: "recovery stroke at maximum bend", values: {theta: -80}},
      {name: "straight", values: {theta: 0}},
      {name: "nexin links digested", values: {theta: 40, nexin: false}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, cx = 98, cy = 138, R = 58, act = v.theta > 0 ? [1, 2, 3, 4] : v.theta < 0 ? [6, 7, 8, 9] : [];
      // seen from base to tip and turned so the beat plane is horizontal: doublet 1 on the left, the 5-6 bridge on the
      // right, as in the side view; numbering runs clockwise, the way the arms point
      var ang = function (k) { return (180 + (k - 1) * 40) * Math.PI / 180; };
      var at = function (k, r, dA) { var a = ang(k) + (dA || 0); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
      // ---- cross-section ----
      api.circle([cx, cy], 78, {stroke: c.faint, width: 1.5});
      api.line([cx - 80, cy], [cx + 80, cy], {color: c.faint, width: 1, dash: "4 4"});
      api.circle([cx, cy], 21, {stroke: c.c2, width: 1, dash: "3 3"});
      api.circle([cx, cy - 7.5], 6, {stroke: c.c2, width: 2}); api.circle([cx, cy + 7.5], 6, {stroke: c.c2, width: 2});
      for (var k = 1; k <= 9; k++) {
        var on = act.indexOf(k) >= 0, nb = k % 9 + 1;
        api.line(at(k, R - 7, 0.07), at(k, 25), {color: c.c6, width: 1.6, opacity: 0.85});    // radial spoke
        api.circle(at(k, 26), 2.4, {fill: c.c6});
        if (v.nexin) api.line(at(k, R - 5, 0.16), at(nb, R - 1, -0.2), {color: c.c4, width: 2});   // nexin link
        // B tubule on the counterclockwise side, A tubule (complete) drawn over it so they share a wall
        api.circle(at(k, R + 3, -0.11), 6, {stroke: c.ink, width: 1.7, fill: c.card});
        api.circle(at(k, R - 1, 0.07), 6.3, {stroke: c.ink, width: 1.7, fill: c.card});
        // outer and inner dynein arms reach clockwise toward the next doublet
        [[R + 2, R + 6], [R - 4, R - 6]].forEach(function (rr) {
          var p0 = at(k, rr[0], 0.18), p1 = at(k, rr[1], 0.36);
          api.line(p0, p1, {color: c.c3, width: on ? 3.2 : 1.5, opacity: on ? 1 : 0.35});
        });
        api.label(at(k, 90), String(k), {color: on ? c.c3 : c.muted, size: 12.5, weight: on ? 750 : 500, anchor: "middle"});
      }
      // legend
      api.line([10, 252], [34, 252], {color: c.faint, width: 1, dash: "4 4"});
      api.label([40, 252], "beat plane", {color: c.muted, size: 12});
      api.label([118, 252], "dynein arms", {color: c.c3, size: 12, weight: 600});
      api.label([10, 272], "spokes", {color: c.c6, size: 12, weight: 600});
      api.label([62, 272], "nexin", {color: c.c4, size: 12, weight: 600, opacity: v.nexin ? 1 : 0.4});
      api.label([108, 272], "central pair", {color: c.c2, size: 12, weight: 600});
      api.label([10, 292], "seen from base to tip", {color: c.faint, size: 12});
      // ---- side view in the beat plane: doublet 1 on the left rail, doublets 5-6 on the right ----
      var bx = 302, by = 256, Lc = 118, d = 18, th = v.nexin ? v.theta * Math.PI / 180 : 0, kap = th / Lc;
      var rail = function (o) { // follow the centerline at offset o (right = +) until the rail's own length is Lc
        var pts = [], x = bx, y = by, phi = 0, len = 0, ds = 2;
        pts.push([x + o, y]);
        for (var i = 0; i < 400 && len < Lc - 1e-6; i++) {
          var step = Math.min(ds, (Lc - len) / Math.max(0.2, 1 - o * kap));
          phi += kap * step; x += Math.sin(phi) * step; y -= Math.cos(phi) * step;
          len += step * (1 - o * kap);
          pts.push([x + Math.cos(phi) * o, y + Math.sin(phi) * o]);
        }
        return pts;
      };
      var slide = v.nexin ? 0 : 18 * Math.abs(v.theta) * Math.PI / 180 * 1.6, lead = v.theta >= 0 ? 1 : -1;
      var r1 = rail(-d / 2), r5 = rail(d / 2);
      if (!v.nexin) { // free sliding: the leading doublet is pushed tipward and the two drift apart
        var shift = function (pts, dy, dx) { return pts.map(function (q) { return [q[0] + dx, q[1] - dy]; }); };
        r5 = shift(r5, lead > 0 ? slide : 0, 4); r1 = shift(r1, lead < 0 ? slide : 0, -4);
      }
      if (v.nexin) for (var m = 6; m < Math.min(r1.length, r5.length) - 2; m += 8) api.line(r1[m], r5[m], {color: c.c4, width: 1.6, opacity: 0.75});
      api.polyline(r1, {stroke: c.ink, width: 4});
      api.polyline(r5, {stroke: c.c1, width: 4});
      api.rect(bx - 16, by, 32, 14, {fill: c.muted, fillOpacity: 0.5, rx: 3});
      api.label([bx, by + 28], "basal body", {color: c.muted, size: 12, anchor: "middle"});
      api.label([bx - d / 2 - 8, by - 10], "1", {color: c.ink, size: 12.5, weight: 700, anchor: "end"});
      api.label([bx + d / 2 + 8, by - 10], "5–6", {color: c.c1, size: 12.5, weight: 700});
      // tip offset: the concave-side doublet leads by delta l
      var t1 = r1[r1.length - 1], t5 = r5[r5.length - 1], dlnm = D_NM * Math.abs(v.theta) * Math.PI / 180;
      if (Math.abs(v.theta) > 0) {
        var leadP = lead > 0 ? t5 : t1;
        api.point(leadP, {color: c.c5, r: 3.5});
        api.label([Math.min(360, Math.max(250, (t1[0] + t5[0]) / 2)), Math.min(t1[1], t5[1]) - 16], "Δl = " + Viz.fmt(dlnm, 0) + " nm", {color: c.c5, size: 12.5, weight: 650, anchor: "middle", raw: true});
      }
      api.label([392, 18], v.nexin ? "side view, width not to scale" : "links gone: sliding, no bend", {color: v.nexin ? c.faint : c.c5, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
