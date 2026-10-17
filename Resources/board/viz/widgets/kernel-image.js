// T(x) = Ax from R2 to R2, input plane on the left, output plane on the right. The kernel is everything
// that lands on 0; the image is everything T can reach. Drag x and watch T(x); park it on the kernel line.
Viz.register("kernel-image", {
  title: "Kernel and image of a linear map",
  subject: "linear-algebra",
  shows: "Drag x in the input plane: T(x) moves in the output plane; the kernel line is crushed to 0 and the image is the set T can reach",
  params: {
    a: {kind: "number", default: 1, min: -3, max: 3, step: 0.5, label: "a"},
    b: {kind: "number", default: 1, min: -3, max: 3, step: 0.5, label: "b"},
    c: {kind: "number", default: 2, min: -3, max: 3, step: 0.5, label: "c"},
    d: {kind: "number", default: 2, min: -3, max: 3, step: 0.5, label: "d"},
    x: {kind: "number", default: 1.5, min: -3, max: 3, step: 0.25, label: "x_1"},
    y: {kind: "number", default: 0.5, min: -3, max: 3, step: 0.25, label: "x_2"}
  },
  formula: function (v) {
    var tx = v.a * v.x + v.b * v.y, ty = v.c * v.x + v.d * v.y;
    return "T(x)=\\begin{pmatrix}" + Viz.n(v.a) + "&" + Viz.n(v.b) + "\\\\" + Viz.n(v.c) + "&" + Viz.n(v.d) + "\\end{pmatrix}\\begin{pmatrix}" +
      Viz.n(v.x) + "\\\\" + Viz.n(v.y) + "\\end{pmatrix}=\\begin{pmatrix}" + Viz.n(tx) + "\\\\" + Viz.n(ty) + "\\end{pmatrix}";
  },
  status: function (v) {
    var det = v.a * v.d - v.b * v.c, tx = v.a * v.x + v.b * v.y, ty = v.c * v.x + v.d * v.y;
    var zeroMap = !v.a && !v.b && !v.c && !v.d;
    if (zeroMap) return "The zero map: the kernel is the whole plane and the image is just 0.";
    if (Math.abs(det) > 1e-9) return "det ≠ 0, so the kernel is only <b>{0}</b> and the image is the whole plane: T is invertible.";
    var inKer = Math.abs(tx) < 1e-9 && Math.abs(ty) < 1e-9;
    return (inKer ? "x is <b>in the kernel</b>: T(x) = 0. " : "") + "det = 0: the kernel is a <b>line</b> (dimension 1) and so is the image; 1 + 1 = 2 = dim of the input.";
  },
  examples: [
    {name: "x on the kernel", values: {a: 1, b: 1, c: 2, d: 2, x: 1, y: -1}},
    {name: "invertible", values: {a: 2, b: 0, c: 1, d: 1, x: 1, y: 1}},
    {name: "zero map", values: {a: 0, b: 0, c: 0, d: 0}}
  ],
  size: [400, 250],
  draw: function (api, v) {
    var c = api.color, W = api.w, H = api.h, half = W / 2;
    var L = api.plane({x: [-3.5, 3.5], y: [-3.5, 3.5], box: [12, 30, half - 24, H - 46], ticks: false, labels: false});
    var R = api.plane({x: [-7, 7], y: [-7, 7], box: [half + 12, 30, half - 24, H - 46], ticks: false, labels: false, step: 2});
    api.label([half / 2, 14], "input", {color: c.muted, size: 12.5, anchor: "middle"});
    api.label([half + half / 2, 14], "output", {color: c.muted, size: 12.5, anchor: "middle"});
    api.line([half, 26], [half, H - 12], {color: c.grid, width: 1});
    var det = v.a * v.d - v.b * v.c, zero = !v.a && !v.b && !v.c && !v.d;
    // kernel line in the input: null space of A when det = 0
    if (!zero && Math.abs(det) < 1e-9) {
      var kd = (Math.abs(v.a) + Math.abs(v.b) > 1e-9) ? [-v.b, v.a] : [-v.d, v.c];
      L.lineThrough([0, 0], kd, {color: c.c5, width: 3, opacity: 0.9});
      var ke = L.through([0, 0], kd);
      if (ke) api.label(L.px([ke[1][0] * 0.8, ke[1][1] * 0.8]), "ker T", {color: c.c5, size: 13, weight: 650, anchor: "middle"});
      var id = (Math.abs(v.a) + Math.abs(v.c) > 1e-9) ? [v.a, v.c] : [v.b, v.d];
      R.lineThrough([0, 0], id, {color: c.c2, width: 3, opacity: 0.9});
      var ie = R.through([0, 0], id);
      if (ie) api.label(R.px([ie[0][0] * 0.72, ie[0][1] * 0.72]), "im T", {color: c.c2, size: 13, weight: 650, anchor: "middle"});
    } else if (!zero) {
      api.rect(half + 14, 32, half - 28, H - 50, {fill: c.c2, fillOpacity: 0.07, rx: 6});
      api.label([half + half - 18, H - 26], "im T = all of R²", {color: c.c2, size: 12, anchor: "end"});
      api.point(L.px([0, 0]), {color: c.c5, r: 5, label: "ker T = {0}", labelColor: c.c5, size: 12});
    }
    var tx = v.a * v.x + v.b * v.y, ty = v.c * v.x + v.d * v.y;
    var X = L.px([v.x, v.y]), TX = R.px([Math.max(-7, Math.min(7, tx)), Math.max(-7, Math.min(7, ty))]);
    api.arrow(L.px([0, 0]), X, {color: c.c1, label: "x"});
    if (Math.hypot(tx, ty) > 1e-9) api.arrow(R.px([0, 0]), TX, {color: c.c3, label: "T(x)"});
    else api.point(R.px([0, 0]), {color: c.c3, r: 6, label: "T(x) = 0", labelColor: c.c3, size: 12.5});
    api.handle(X, {color: c.c1, plane: L, snap: 0.25, onDrag: function (q) { api.set({x: q[0], y: q[1]}); }});
  }
});
