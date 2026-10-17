// Contact (juxtacrine) signaling: the signal never leaves the sender's surface, so the cells must touch.
// Delta-Notch: Delta in the sender's membrane binds Notch on the neighbour; each bound Notch is cut (ADAM10, then
// gamma-secretase) and its intracellular domain (NICD) goes to the nucleus to switch on target genes (Hes); bound
// pairs = min(Delta, Notch). Gap junction: docked connexons join the two cytoplasms, so small molecules (ions, cAMP,
// IP3, under ~1 kDa) spread until the two equal-sized cells hold the same amount, n/2 each; proteins are too big.
// Colors: teal = the sender's signal (Delta / connexons), blue = Notch and NICD, amber = small signal molecules,
// purple = a protein, green = target-gene output.
(function () {
  var DSLOT = [1, 2, 3, 4, 5, 6, 0, 7];   // y slots filled by the 1st..8th Delta; Notch sits in slots 1-6
  function bound(v) { return v.contact ? Math.min(v.n, 6) : 0; }
  Viz.register("direct-contact-cell-signaling", {
    title: "Signaling by direct contact",
    subject: "biology",
    shows: "Put the cells together or apart: a membrane-bound signal (Delta to Notch) or a gap junction only works while the cells touch",
    params: {
      route: {kind: "enum", values: ["notch", "gap junction"], default: "notch", label: "\\text{route}", names: {"notch": "Delta–Notch", "gap junction": "gap junction"}},
      contact: {kind: "boolean", default: true, label: "\\text{cells}", on: "touching", off: "apart"},
      n: {kind: "integer", default: 4, min: 0, max: 8, label: "n"}
    },
    formula: function (v) {
      if (v.route === "notch") return v.contact ? "\\text{bound}=\\min(n_{\\text{Delta}},\\,n_{\\text{Notch}})=\\min(" + v.n + ",6)=" + bound(v) : "\\text{bound}=0\\quad(\\text{no contact})";
      return v.contact ? "c_{\\text{sender}}=c_{\\text{receiver}}=\\frac{n}{2}=" + Viz.n(v.n / 2, 1) : "c_{\\text{sender}}=n=" + v.n + ",\\ c_{\\text{receiver}}=0";
    },
    status: function (v) {
      var b = bound(v);
      if (v.route === "notch") {
        if (!v.contact) return "Apart: Delta is anchored in the sender's membrane and cannot diffuse, so <b>no Notch is activated</b>.";
        if (!v.n) return "Touching, but the sender shows no Delta: Notch stays whole and the neighbour's target genes stay <b>off</b>.";
        return "Touching: <b>" + b + "</b> Delta ligand" + (b > 1 ? "s grip " : " grips ") + b + " of 6 Notch receptors; each is cut and its intracellular domain switches on genes in the neighbour's nucleus" +
          (v.n > 6 ? ", and the extra " + (v.n - 6) + " Delta find no partner." : ".");
      }
      if (!v.contact) return "Apart: each cell's half-channels stay closed, so all <b>" + v.n + "</b> signal molecules stay in the sender.";
      if (!v.n) return "Touching: the connexons dock into open channels, but there are no signal molecules to share yet.";
      return "Touching: connexons dock into channels and the small molecules spread until each cell holds <b>" + Viz.fmt(v.n / 2, 1) + "</b> on average; the protein is too big to pass.";
    },
    examples: [
      {name: "Notch, apart", values: {route: "notch", contact: false}},
      {name: "no Delta", values: {route: "notch", n: 0}},
      {name: "Notch saturated", values: {route: "notch", n: 8}},
      {name: "gap junction shares", values: {route: "gap junction", n: 8}},
      {name: "gap junction, apart", values: {route: "gap junction", contact: false, n: 6}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, notch = v.route === "notch", b = bound(v);
      var xS = v.contact ? 186 : 150, xR = v.contact ? 214 : 250, top = 34, bot = 250;
      api.rect(12, top, xS - 12, bot - top, {fill: c.ink, fillOpacity: 0.04, stroke: c.ink, width: 1.5, rx: 18});
      api.rect(xR, top, 388 - xR, bot - top, {fill: c.ink, fillOpacity: 0.04, stroke: c.ink, width: 1.5, rx: 18});
      api.label([16, 18], "sending cell", {color: c.muted, size: 12.5});
      api.label([384, 18], "receiving cell", {color: c.muted, size: 12.5, anchor: "end"});
      var nuc = [xR + (388 - xR) * 0.64, 142], NR = 44, sn = [70, 142];
      api.circle(nuc, NR, {fill: c.ink, fillOpacity: 0.05, stroke: c.muted, width: 1.2});
      api.circle(sn, 32, {fill: c.ink, fillOpacity: 0.05, stroke: c.muted, width: 1.2});
      var slotY = function (k) { return 54 + k * 25; };
      if (notch) {
        // Notch on the receiver, slots 1-6: a cup outside, a tail inside that is cut once Delta binds
        for (var k = 1; k <= 6; k++) {
          var y = slotY(k), on = b >= k;
          if (on) api.circle([xR - 10, y], 11, {fill: c.c2, fillOpacity: 0.16});
          api.line([xR - 8, y], [xR, y], {color: c.c2, width: 2.6});
          api.path("M " + (xR - 17) + " " + (y - 7) + " L " + (xR - 8) + " " + (y - 7) + " L " + (xR - 8) + " " + (y + 7) + " L " + (xR - 17) + " " + (y + 7), {stroke: c.c2, width: 2.6});
          if (on) api.line([xR + 9, y], [xR + 20, y], {color: c.c2, width: 2.6, opacity: 0.3});
          else api.line([xR, y], [xR + 20, y], {color: c.c2, width: 2.6});
        }
        // Delta on the sender
        for (var d = 0; d < v.n; d++) {
          var yd = slotY(DSLOT[d]);
          api.line([xS, yd], [xS + 10, yd], {color: c.c1, width: 2.6});
          api.rect(xS + 9, yd - 5, 10, 10, {fill: c.c1, rx: 2});
        }
        api.label([xS - 4, bot + 13], "Delta", {color: c.c1, size: 12.5, weight: 650, anchor: "end"});
        // the sender's nucleus expresses the Delta gene; the protein goes out to the membrane
        api.label([sn[0], sn[1] - 8], "Delta", {color: v.n ? c.c1 : c.muted, size: 12, weight: 650, anchor: "middle"});
        api.label([sn[0], sn[1] + 8], v.n ? "gene on" : "gene off", {color: v.n ? c.c1 : c.muted, size: 12, anchor: "middle"});
        if (v.n) api.arrow([sn[0] + 36, sn[1]], [xS - 12, sn[1]], {color: c.c1, width: 1.6, halo: false, head: 7, dash: "4 3"});
        api.label([xR + 4, bot + 13], "Notch", {color: c.c2, size: 12.5, weight: 650});
        // released intracellular domains travel toward the nucleus: each heads for its own spot 12 px outside the
        // envelope (spread 12 px apart) and has gone at most 80% of the way, so pills never stack or touch the nucleus
        for (var i = 0; i < b; i++) {
          var f = 0.8 * (i + 1) / b, ty = nuc[1] - 30 + i * 12, from = [xR + 26, slotY(i + 1)];
          var to = [nuc[0] - Math.sqrt(NR * NR - (ty - nuc[1]) * (ty - nuc[1])) - 12, ty];
          var at = [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f];
          api.rect(at[0] - 9, at[1] - 4, 18, 8, {fill: c.c2, rx: 4});
        }
        if (b) {
          api.label([xR + 12, bot - 14], "cut frees NICD", {color: c.c2, size: 12});
          api.arrow([nuc[0] - 16, nuc[1] + 2], [nuc[0] + 6, nuc[1] + 2], {color: c.c2, width: 2, halo: false, head: 7});
        }
        // target-gene output in the nucleus
        api.label([nuc[0], nuc[1] - 18], "Hes genes", {color: b ? c.c4 : c.muted, size: 12, weight: 650, anchor: "middle"});
        api.rect(nuc[0] - 26, nuc[1] + 14, 52, 9, {stroke: c.faint, width: 1, rx: 4.5});
        if (b) api.rect(nuc[0] - 26, nuc[1] + 14, 52 * b / 6, 9, {fill: c.c4, rx: 4.5});
        api.label([nuc[0], nuc[1] + NR + 12], b ? "on: " + b + "/6" : "off", {color: b ? c.c4 : c.muted, size: 12, weight: 650, anchor: "middle"});
        api.label([16, bot + 32], v.contact ? "membrane signal: reaches only a touching neighbour" : "no contact: Delta cannot reach Notch", {color: c.muted, size: 12});
      } else {
        // three connexon pairs; docked = open channel, undocked = closed half-channel
        [86, 142, 198].forEach(function (y) {
          var out = v.contact ? 14 : 6;   // docked connexons reach across the narrow gap and meet in the middle
          api.rect(xS - 8, y - 12, 8 + out, 24, {fill: c.c1, fillOpacity: 0.85, rx: 3});
          api.rect(xR - out, y - 12, 8 + out, 24, {fill: c.c1, fillOpacity: 0.85, rx: 3});
          if (v.contact) api.line([xS - 8, y], [xR + 8, y], {color: c.card, width: 3.5});
        });
        api.label([200, top - 16], v.contact ? "open channels" : "closed half-channels", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
        var inR = v.contact ? Math.floor(v.n / 2) : 0, inS = v.n - inR;
        var spot = function (k, x0) { var row = Math.floor(k / 3); return [x0 + (k % 3) * 20 + (row % 2) * 8, 62 + row * 22]; };
        for (var s = 0; s < inS; s++) api.circle(spot(s, xS - 76), 6, {fill: c.c3});
        for (var r = 0; r < inR; r++) api.circle(spot(r, xR + 22), 6, {fill: c.c3});
        api.circle([60, 214], 15, {fill: c.c6, fillOpacity: 0.75});
        api.label([82, 214], "protein", {color: c.c6, size: 12, weight: 650});
        api.label([16, bot + 26], "amber: ions, cAMP, IP₃ (under ~1 kDa) pass; proteins cannot", {color: c.c3, size: 12});
      }
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
