// Type I interferon warns the neighbours of a virus-infected cell. 1) Viral RNA in the cytosol (5'-triphosphate or
// double-stranded) is sensed by RIG-I (MDA5 for long dsRNA). 2) RIG-I signals through MAVS on mitochondria and the
// kinase TBK1, which phosphorylates IRF3; IRF3 dimers enter the nucleus and switch on IFNB, and IFN-beta is secreted.
// 3) IFN-beta binds the IFNAR1/IFNAR2 receptor on nearby cells (and the infected cell itself); the receptor's kinases
// JAK1 and TYK2 phosphorylate STAT1 and STAT2, which join IRF9 as ISGF3 and bind ISREs in the nucleus. 4) Hundreds of
// interferon-stimulated genes are made, among them PKR, OAS and Mx: the antiviral state. 5) When virus arrives, PKR
// phosphorylates eIF2-alpha (translation stops) and OAS makes 2'-5'-oligoadenylate, which activates RNase L to cut
// viral RNA, so the virus cannot replicate. Many viruses carry IFN antagonists: influenza NS1 binds RIG-I (and its
// activator TRIM25) and blocks step 2. A neighbour without IFNAR cannot hear the warning.
Viz.register("interferon-antiviral-signaling-between-cells", {
  title: "Interferon: an infected cell warns its neighbours",
  subject: "biology",
  shows: "Step through an infected cell sensing viral RNA, secreting interferon-beta, and its neighbour reading the signal through IFNAR and JAK-STAT to make antiviral proteins that stop the virus; add a viral blocker or remove the receptor and the neighbour gets infected",
  params: {
    blocker: {kind: "boolean", default: false, label: "\\text{viral NS1}", on: "blocks RIG-I", off: "absent"},
    ifnar: {kind: "boolean", default: true, label: "\\text{IFNAR}", on: "on neighbour", off: "knocked out"}
  },
  steps: ["virus RNA sensed", "IFN-β made", "neighbour hears it", "antiviral state", "virus arrives"],
  stepMs: 2000,
  formula: function (v) {
    var s = v.step || 1, safe = !v.blocker && v.ifnar;
    if (s === 1) return v.blocker ? "\\text{viral RNA}+\\text{RIG-I},\\ \\ \\text{NS1}\\dashv\\text{RIG-I}" : "\\text{viral RNA (5'ppp, dsRNA)}+\\text{RIG-I}";
    if (s === 2) return v.blocker ? "\\text{NS1}\\dashv\\text{RIG-I}\\Rightarrow\\text{no IFN-}\\beta" : "\\text{RIG-I}\\to\\text{MAVS}\\to\\text{TBK1}\\to\\text{IRF3-P}\\to\\textit{IFNB}";
    if (s === 3) return v.blocker ? "\\text{no IFN-}\\beta\\Rightarrow\\text{no signal}" : !v.ifnar ? "\\text{IFN-}\\beta\\ \\text{but no IFNAR}\\Rightarrow\\text{no signal}" :
      "\\text{IFN-}\\beta+\\text{IFNAR}\\to\\text{JAK1, TYK2}\\newline\\to\\text{STAT1{:}STAT2{:}IRF9 (ISGF3)}\\to\\text{ISRE}";
    if (s === 4) return safe ? "\\text{ISRE}\\to\\text{ISGs: PKR, OAS, Mx}" : "\\text{no ISGF3}\\Rightarrow\\text{no ISGs}";
    return safe ? "\\text{PKR}\\to\\text{eIF2}\\alpha\\text{-P (translation stops)}\\newline\\text{OAS}\\to\\text{2-5A}\\to\\text{RNase L cuts viral RNA}" : "\\text{no ISGs}\\Rightarrow\\text{virus replicates in the neighbour}";
  },
  status: function (v) {
    var s = v.step || 1, safe = !v.blocker && v.ifnar;
    if (s === 1) return "A virus has entered the left cell, and <b>RIG-I</b> recognizes its RNA as foreign" + (v.blocker ? ", but the viral protein <b>NS1</b> is already clamped onto RIG-I." : ".");
    if (s === 2) return v.blocker ? "NS1 keeps RIG-I silent, so IRF3 is never activated and <b>no interferon</b> is made." : "RIG-I signals through MAVS on the mitochondrion; phosphorylated <b>IRF3</b> switches on the IFNB gene and the cell secretes <b>IFN-β</b>.";
    if (s === 3) return v.blocker ? "No interferon leaves the infected cell, so the neighbour gets <b>no warning</b>." : !v.ifnar ? "IFN-β reaches the neighbour, but with <b>no IFNAR</b> to bind it the message goes unheard." :
      "IFN-β binds <b>IFNAR</b> on the neighbour; JAK1 and TYK2 phosphorylate STAT1 and STAT2, which join IRF9 as <b>ISGF3</b> and enter the nucleus.";
    if (s === 4) return safe ? "ISGF3 turns on interferon-stimulated genes: the neighbour fills with <b>PKR, OAS and Mx</b> before any virus has reached it." : "With no ISGF3 the neighbour makes <b>no antiviral proteins</b> and stays defenceless.";
    return safe ? "New virus reaches the neighbour, but <b>PKR</b> halts translation and <b>RNase L</b> cuts the viral RNA: the neighbour is <b>protected</b>." : "New virus reaches the unwarned neighbour and <b>replicates</b> there: the infection spreads.";
  },
  examples: [
    {name: "IFN-β secreted", values: {step: 2}},
    {name: "neighbour protected", values: {step: 5}},
    {name: "NS1 blocks the alarm", values: {blocker: true, step: 5}},
    {name: "no IFNAR on the neighbour", values: {ifnar: false, step: 3}},
    {name: "IFNAR knocked out: infected", values: {ifnar: false, step: 5}}
  ],
  size: [400, 300],
  draw: function (api, v) {
    var c = api.color, s = v.step || 1, safe = !v.blocker && v.ifnar, made = !v.blocker, heard = made && v.ifnar;
    var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12}, o || {})); };
    var A = [100, 150], B = [300, 150], RX = 80, RY = 100;
    var on = function (C, deg) { var a = deg * Math.PI / 180; return [C[0] + RX * Math.cos(a), C[1] + RY * Math.sin(a)]; };
    var hex = function (p, r) { var pts = []; for (var k = 0; k < 6; k++) pts.push([p[0] + r * Math.cos(k * Math.PI / 3), p[1] + r * Math.sin(k * Math.PI / 3)]); api.polygon(pts, {fill: c.c5, fillOpacity: 0.85, stroke: c.c5, width: 1.2}); };
    var rna = function (p, w) { api.path("M " + p[0] + " " + p[1] + " q " + w / 6 + " -6 " + w / 3 + " 0 t " + w / 3 + " 0 t " + w / 3 + " 0", {stroke: c.c5, width: 2.2}); };
    var infectedB = s === 5 && !safe;
    // the two cells
    api.path("M " + (A[0] - RX) + " " + A[1] + " a " + RX + " " + RY + " 0 1 0 " + 2 * RX + " 0 a " + RX + " " + RY + " 0 1 0 " + -2 * RX + " 0", {fill: c.c5, fillOpacity: 0.06, stroke: c.c5, width: 1.8});
    api.path("M " + (B[0] - RX) + " " + B[1] + " a " + RX + " " + RY + " 0 1 0 " + 2 * RX + " 0 a " + RX + " " + RY + " 0 1 0 " + -2 * RX + " 0",
      {fill: infectedB ? c.c5 : c.c4, fillOpacity: infectedB ? 0.1 : s >= 4 && safe ? 0.14 : 0.04, stroke: infectedB ? c.c5 : c.c1, width: 1.8});
    api.circle([88, 196], 30, {fill: c.muted, fillOpacity: 0.12, stroke: c.muted, width: 1.2});
    api.circle([312, 196], 30, {fill: c.muted, fillOpacity: 0.12, stroke: c.muted, width: 1.2});
    L([A[0], 16], "infected cell", c.c5, {weight: 700, anchor: "middle"});
    L([B[0], 16], infectedB ? "neighbour: infected" : s >= 4 && safe ? "neighbour: antiviral state" : "neighbouring cell", infectedB ? c.c5 : s >= 4 && safe ? c.c4 : c.c1, {weight: 700, anchor: "middle"});
    // IFNAR on the neighbour's facing side (crossed out when knocked out)
    [160, 180, 200].forEach(function (deg) {
      var p = on(B, deg);
      if (v.ifnar) { api.line([p[0] - 8, p[1]], [p[0] + 8, p[1]], {color: c.c2, width: 3}); api.path("M " + (p[0] - 14) + " " + (p[1] - 5) + " Q " + (p[0] - 8) + " " + p[1] + " " + (p[0] - 14) + " " + (p[1] + 5), {stroke: c.c2, width: 2.4}); }
      else { api.line([p[0] - 5, p[1] - 5], [p[0] + 5, p[1] + 5], {color: c.c5, width: 2}); api.line([p[0] - 5, p[1] + 5], [p[0] + 5, p[1] - 5], {color: c.c5, width: 2}); }
    });
    L([214, 124], v.ifnar ? "IFNAR" : "no IFNAR", v.ifnar ? c.c2 : c.c5, {weight: 650, anchor: "end"});
    // step 1: the virus, its RNA and RIG-I
    hex([60, 64], 9);
    rna([30, 118], 34);
    L([30, 100], "viral RNA", c.c5);
    api.circle([74, 120], 8, {fill: c.c3, fillOpacity: 0.85});
    L([74, 140], "RIG-I", c.c3, {weight: 650, anchor: "middle"});
    if (v.blocker) { api.rect(80, 108, 22, 12, {fill: c.c6, fillOpacity: 0.9, rx: 6}); L([106, 104], "NS1", c.c6, {weight: 700}); }
    // step 2: MAVS -> IRF3 -> IFNB -> IFN-beta out
    if (s >= 2) {
      api.path("M 118 116 a 18 9 0 1 0 36 0 a 18 9 0 1 0 -36 0", {fill: c.muted, fillOpacity: 0.25, stroke: c.muted, width: 1.2});
      L([136, 100], "MAVS", made ? c.ink : c.muted, {anchor: "middle"});
      if (made) {
        api.arrow([84, 120], [116, 117], {color: c.c3, width: 1.8, halo: false, head: 6});
        api.circle([118, 150], 4.5, {fill: c.c3}); api.circle([127, 150], 4.5, {fill: c.c3});
        api.arrow([136, 124], [124, 144], {color: c.c3, width: 1.6, halo: false, head: 6});
        api.arrow([116, 158], [104, 176], {color: c.c3, width: 1.6, halo: false, head: 6});
        L([140, 150], "IRF3-P", c.c3, {weight: 600});
        L([88, 196], "IFNB", c.c4, {weight: 700, anchor: "middle"});
        api.arrow([114, 206], [174, 186], {color: c.c4, width: 1.8, halo: false, head: 7});
      } else {
        L([88, 196], "IFNB off", c.muted, {anchor: "middle"});
        api.line([84, 128], [96, 140], {color: c.c5, width: 2}); api.line([96, 128], [84, 140], {color: c.c5, width: 2});
      }
    }
    // IFN-beta between the cells: step 2 leaving, step 3+ at the neighbour
    if (made && s >= 2) {
      var pts = s === 2 ? [[186, 176], [196, 190], [190, 160]] : v.ifnar ? [[208, on(B, 160)[1]], [204, B[1]], [208, on(B, 200)[1]], [196, 186]] : [[200, 172], [192, 150], [204, 130], [196, 192]];
      pts.forEach(function (p) { api.circle(p, 4, {fill: c.c4}); });
      L([200, 238], "IFN-β", c.c4, {weight: 700, anchor: "middle"});
    }
    // step 3: JAK-STAT inside the neighbour
    if (s >= 3 && heard) {
      api.rect(226, 142, 9, 7, {fill: c.c3, rx: 1}); api.rect(226, 153, 9, 7, {fill: c.c3, rx: 1});
      L([232, 172], "JAK1, TYK2", c.c3, {anchor: "start"});
      [[262, 132], [271, 132], [266.5, 124]].forEach(function (p, k) { api.circle(p, 4.5, {fill: k === 2 ? c.c6 : c.c2}); });
      L([280, 122], "ISGF3", c.c2, {weight: 650});
      api.arrow([268, 140], [296, 170], {color: c.c2, width: 1.6, halo: false, head: 6});
      L([312, 196], s >= 4 ? "ISGs on" : "ISRE", c.c4, {weight: 700, anchor: "middle"});
    } else if (s >= 3) L([312, 196], "silent", c.muted, {anchor: "middle"});
    // step 4: antiviral proteins fill the neighbour
    if (s >= 4 && safe) [["PKR", [286, 82]], ["OAS", [336, 96]], ["Mx", [352, 140]]].forEach(function (q) {
      api.circle(q[1], 6, {fill: c.c4, fillOpacity: 0.8}); L([q[1][0] + 9, q[1][1]], q[0], c.c4, {weight: 650});
    });
    // step 5: new virions reach the neighbour
    if (s === 5) {
      hex([170, 86], 7); hex([200, 70], 7); hex([246, 84], 7);
      if (safe) {
        rna([270, 236], 30);
        L([300, 222], "RNase L cuts", c.c4, {weight: 650});
        api.line([284, 228], [292, 244], {color: c.c4, width: 2.2});
      } else {
        rna([256, 104], 26); rna([330, 120], 26); rna([280, 236], 30); hex([350, 220], 7); hex([336, 74], 7);
        L([300, 262], "virus replicates", c.c5, {weight: 650, anchor: "middle"});
      }
    }
    L([200, 288], ["RIG-I senses viral RNA", v.blocker ? "NS1 silences RIG-I: no IFN" : "IFN-β secreted", !made ? "no IFN: no warning" : v.ifnar ? "JAK-STAT: ISGF3 to the nucleus" : "no IFNAR: warning unheard",
      safe ? "PKR, OAS, Mx made" : "no antiviral proteins", safe ? "virus blocked: neighbour protected" : "neighbour infected"][s - 1], safe || s < 2 ? c.ink : c.c5, {weight: 650, anchor: "middle"});
    api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints svg text ink
  }
});
