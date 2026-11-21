// node_modules/hachure-fill/bin/hachure.js
function rotatePoints(points, center, degrees) {
  if (points && points.length) {
    const [cx, cy] = center;
    const angle = Math.PI / 180 * degrees;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const p of points) {
      const [x, y] = p;
      p[0] = (x - cx) * cos - (y - cy) * sin + cx;
      p[1] = (x - cx) * sin + (y - cy) * cos + cy;
    }
  }
}
function rotateLines(lines, center, degrees) {
  const points = [];
  lines.forEach((line2) => points.push(...line2));
  rotatePoints(points, center, degrees);
}
function areSamePoints(p1, p2) {
  return p1[0] === p2[0] && p1[1] === p2[1];
}
function hachureLines(polygons, hachureGap, hachureAngle, hachureStepOffset = 1) {
  const angle = hachureAngle;
  const gap = Math.max(hachureGap, 0.1);
  const polygonList = polygons[0] && polygons[0][0] && typeof polygons[0][0] === "number" ? [polygons] : polygons;
  const rotationCenter = [0, 0];
  if (angle) {
    for (const polygon2 of polygonList) {
      rotatePoints(polygon2, rotationCenter, angle);
    }
  }
  const lines = straightHachureLines(polygonList, gap, hachureStepOffset);
  if (angle) {
    for (const polygon2 of polygonList) {
      rotatePoints(polygon2, rotationCenter, -angle);
    }
    rotateLines(lines, rotationCenter, -angle);
  }
  return lines;
}
function straightHachureLines(polygons, gap, hachureStepOffset) {
  const vertexArray = [];
  for (const polygon2 of polygons) {
    const vertices = [...polygon2];
    if (!areSamePoints(vertices[0], vertices[vertices.length - 1])) {
      vertices.push([vertices[0][0], vertices[0][1]]);
    }
    if (vertices.length > 2) {
      vertexArray.push(vertices);
    }
  }
  const lines = [];
  gap = Math.max(gap, 0.1);
  const edges = [];
  for (const vertices of vertexArray) {
    for (let i = 0; i < vertices.length - 1; i++) {
      const p1 = vertices[i];
      const p2 = vertices[i + 1];
      if (p1[1] !== p2[1]) {
        const ymin = Math.min(p1[1], p2[1]);
        edges.push({
          ymin,
          ymax: Math.max(p1[1], p2[1]),
          x: ymin === p1[1] ? p1[0] : p2[0],
          islope: (p2[0] - p1[0]) / (p2[1] - p1[1])
        });
      }
    }
  }
  edges.sort((e1, e2) => {
    if (e1.ymin < e2.ymin) {
      return -1;
    }
    if (e1.ymin > e2.ymin) {
      return 1;
    }
    if (e1.x < e2.x) {
      return -1;
    }
    if (e1.x > e2.x) {
      return 1;
    }
    if (e1.ymax === e2.ymax) {
      return 0;
    }
    return (e1.ymax - e2.ymax) / Math.abs(e1.ymax - e2.ymax);
  });
  if (!edges.length) {
    return lines;
  }
  let activeEdges = [];
  let y = edges[0].ymin;
  let iteration = 0;
  while (activeEdges.length || edges.length) {
    if (edges.length) {
      let ix = -1;
      for (let i = 0; i < edges.length; i++) {
        if (edges[i].ymin > y) {
          break;
        }
        ix = i;
      }
      const removed = edges.splice(0, ix + 1);
      removed.forEach((edge) => {
        activeEdges.push({ s: y, edge });
      });
    }
    activeEdges = activeEdges.filter((ae2) => {
      if (ae2.edge.ymax <= y) {
        return false;
      }
      return true;
    });
    activeEdges.sort((ae1, ae2) => {
      if (ae1.edge.x === ae2.edge.x) {
        return 0;
      }
      return (ae1.edge.x - ae2.edge.x) / Math.abs(ae1.edge.x - ae2.edge.x);
    });
    if (hachureStepOffset !== 1 || iteration % gap === 0) {
      if (activeEdges.length > 1) {
        for (let i = 0; i < activeEdges.length; i = i + 2) {
          const nexti = i + 1;
          if (nexti >= activeEdges.length) {
            break;
          }
          const ce2 = activeEdges[i].edge;
          const ne = activeEdges[nexti].edge;
          lines.push([
            [Math.round(ce2.x), y],
            [Math.round(ne.x), y]
          ]);
        }
      }
    }
    y += hachureStepOffset;
    activeEdges.forEach((ae2) => {
      ae2.edge.x = ae2.edge.x + hachureStepOffset * ae2.edge.islope;
    });
    iteration++;
  }
  return lines;
}

// node_modules/roughjs/bin/fillers/scan-line-hachure.js
function polygonHachureLines(polygonList, o) {
  var _a;
  const angle = o.hachureAngle + 90;
  let gap = o.hachureGap;
  if (gap < 0) {
    gap = o.strokeWidth * 4;
  }
  gap = Math.max(gap, 0.1);
  let skipOffset = 1;
  if (o.roughness >= 1) {
    if ((((_a = o.randomizer) === null || _a === void 0 ? void 0 : _a.next()) || Math.random()) > 0.7) {
      skipOffset = gap;
    }
  }
  return hachureLines(polygonList, gap, angle, skipOffset || 1);
}

// node_modules/roughjs/bin/fillers/hachure-filler.js
var HachureFiller = class {
  constructor(helper2) {
    this.helper = helper2;
  }
  fillPolygons(polygonList, o) {
    return this._fillPolygons(polygonList, o);
  }
  _fillPolygons(polygonList, o) {
    const lines = polygonHachureLines(polygonList, o);
    const ops = this.renderLines(lines, o);
    return { type: "fillSketch", ops };
  }
  renderLines(lines, o) {
    const ops = [];
    for (const line2 of lines) {
      ops.push(...this.helper.doubleLineOps(line2[0][0], line2[0][1], line2[1][0], line2[1][1], o));
    }
    return ops;
  }
};

// node_modules/roughjs/bin/geometry.js
function lineLength(line2) {
  const p1 = line2[0];
  const p2 = line2[1];
  return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
}

// node_modules/roughjs/bin/fillers/zigzag-filler.js
var ZigZagFiller = class extends HachureFiller {
  fillPolygons(polygonList, o) {
    let gap = o.hachureGap;
    if (gap < 0) {
      gap = o.strokeWidth * 4;
    }
    gap = Math.max(gap, 0.1);
    const o2 = Object.assign({}, o, { hachureGap: gap });
    const lines = polygonHachureLines(polygonList, o2);
    const zigZagAngle = Math.PI / 180 * o.hachureAngle;
    const zigzagLines = [];
    const dgx = gap * 0.5 * Math.cos(zigZagAngle);
    const dgy = gap * 0.5 * Math.sin(zigZagAngle);
    for (const [p1, p2] of lines) {
      if (lineLength([p1, p2])) {
        zigzagLines.push([
          [p1[0] - dgx, p1[1] + dgy],
          [...p2]
        ], [
          [p1[0] + dgx, p1[1] - dgy],
          [...p2]
        ]);
      }
    }
    const ops = this.renderLines(zigzagLines, o);
    return { type: "fillSketch", ops };
  }
};

// node_modules/roughjs/bin/fillers/hatch-filler.js
var HatchFiller = class extends HachureFiller {
  fillPolygons(polygonList, o) {
    const set = this._fillPolygons(polygonList, o);
    const o2 = Object.assign({}, o, { hachureAngle: o.hachureAngle + 90 });
    const set2 = this._fillPolygons(polygonList, o2);
    set.ops = set.ops.concat(set2.ops);
    return set;
  }
};

// node_modules/roughjs/bin/fillers/dot-filler.js
var DotFiller = class {
  constructor(helper2) {
    this.helper = helper2;
  }
  fillPolygons(polygonList, o) {
    o = Object.assign({}, o, { hachureAngle: 0 });
    const lines = polygonHachureLines(polygonList, o);
    return this.dotsOnLines(lines, o);
  }
  dotsOnLines(lines, o) {
    const ops = [];
    let gap = o.hachureGap;
    if (gap < 0) {
      gap = o.strokeWidth * 4;
    }
    gap = Math.max(gap, 0.1);
    let fweight = o.fillWeight;
    if (fweight < 0) {
      fweight = o.strokeWidth / 2;
    }
    const ro = gap / 4;
    for (const line2 of lines) {
      const length = lineLength(line2);
      const dl = length / gap;
      const count = Math.ceil(dl) - 1;
      const offset = length - count * gap;
      const x = (line2[0][0] + line2[1][0]) / 2 - gap / 4;
      const minY = Math.min(line2[0][1], line2[1][1]);
      for (let i = 0; i < count; i++) {
        const y = minY + offset + i * gap;
        const cx = x - ro + Math.random() * 2 * ro;
        const cy = y - ro + Math.random() * 2 * ro;
        const el = this.helper.ellipse(cx, cy, fweight, fweight, o);
        ops.push(...el.ops);
      }
    }
    return { type: "fillSketch", ops };
  }
};

// node_modules/roughjs/bin/fillers/dashed-filler.js
var DashedFiller = class {
  constructor(helper2) {
    this.helper = helper2;
  }
  fillPolygons(polygonList, o) {
    const lines = polygonHachureLines(polygonList, o);
    return { type: "fillSketch", ops: this.dashedLine(lines, o) };
  }
  dashedLine(lines, o) {
    const offset = o.dashOffset < 0 ? o.hachureGap < 0 ? o.strokeWidth * 4 : o.hachureGap : o.dashOffset;
    const gap = o.dashGap < 0 ? o.hachureGap < 0 ? o.strokeWidth * 4 : o.hachureGap : o.dashGap;
    const ops = [];
    lines.forEach((line2) => {
      const length = lineLength(line2);
      const count = Math.floor(length / (offset + gap));
      const startOffset = (length + gap - count * (offset + gap)) / 2;
      let p1 = line2[0];
      let p2 = line2[1];
      if (p1[0] > p2[0]) {
        p1 = line2[1];
        p2 = line2[0];
      }
      const alpha = Math.atan((p2[1] - p1[1]) / (p2[0] - p1[0]));
      for (let i = 0; i < count; i++) {
        const lstart = i * (offset + gap);
        const lend = lstart + offset;
        const start = [p1[0] + lstart * Math.cos(alpha) + startOffset * Math.cos(alpha), p1[1] + lstart * Math.sin(alpha) + startOffset * Math.sin(alpha)];
        const end = [p1[0] + lend * Math.cos(alpha) + startOffset * Math.cos(alpha), p1[1] + lend * Math.sin(alpha) + startOffset * Math.sin(alpha)];
        ops.push(...this.helper.doubleLineOps(start[0], start[1], end[0], end[1], o));
      }
    });
    return ops;
  }
};

// node_modules/roughjs/bin/fillers/zigzag-line-filler.js
var ZigZagLineFiller = class {
  constructor(helper2) {
    this.helper = helper2;
  }
  fillPolygons(polygonList, o) {
    const gap = o.hachureGap < 0 ? o.strokeWidth * 4 : o.hachureGap;
    const zo = o.zigzagOffset < 0 ? gap : o.zigzagOffset;
    o = Object.assign({}, o, { hachureGap: gap + zo });
    const lines = polygonHachureLines(polygonList, o);
    return { type: "fillSketch", ops: this.zigzagLines(lines, zo, o) };
  }
  zigzagLines(lines, zo, o) {
    const ops = [];
    lines.forEach((line2) => {
      const length = lineLength(line2);
      const count = Math.round(length / (2 * zo));
      let p1 = line2[0];
      let p2 = line2[1];
      if (p1[0] > p2[0]) {
        p1 = line2[1];
        p2 = line2[0];
      }
      const alpha = Math.atan((p2[1] - p1[1]) / (p2[0] - p1[0]));
      for (let i = 0; i < count; i++) {
        const lstart = i * 2 * zo;
        const lend = (i + 1) * 2 * zo;
        const dz = Math.sqrt(2 * Math.pow(zo, 2));
        const start = [p1[0] + lstart * Math.cos(alpha), p1[1] + lstart * Math.sin(alpha)];
        const end = [p1[0] + lend * Math.cos(alpha), p1[1] + lend * Math.sin(alpha)];
        const middle = [start[0] + dz * Math.cos(alpha + Math.PI / 4), start[1] + dz * Math.sin(alpha + Math.PI / 4)];
        ops.push(...this.helper.doubleLineOps(start[0], start[1], middle[0], middle[1], o), ...this.helper.doubleLineOps(middle[0], middle[1], end[0], end[1], o));
      }
    });
    return ops;
  }
};

// node_modules/roughjs/bin/fillers/filler.js
var fillers = {};
function getFiller(o, helper2) {
  let fillerName = o.fillStyle || "hachure";
  if (!fillers[fillerName]) {
    switch (fillerName) {
      case "zigzag":
        if (!fillers[fillerName]) {
          fillers[fillerName] = new ZigZagFiller(helper2);
        }
        break;
      case "cross-hatch":
        if (!fillers[fillerName]) {
          fillers[fillerName] = new HatchFiller(helper2);
        }
        break;
      case "dots":
        if (!fillers[fillerName]) {
          fillers[fillerName] = new DotFiller(helper2);
        }
        break;
      case "dashed":
        if (!fillers[fillerName]) {
          fillers[fillerName] = new DashedFiller(helper2);
        }
        break;
      case "zigzag-line":
        if (!fillers[fillerName]) {
          fillers[fillerName] = new ZigZagLineFiller(helper2);
        }
        break;
      case "hachure":
      default:
        fillerName = "hachure";
        if (!fillers[fillerName]) {
          fillers[fillerName] = new HachureFiller(helper2);
        }
        break;
    }
  }
  return fillers[fillerName];
}

// node_modules/roughjs/bin/math.js
function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}
var Random = class {
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    if (this.seed) {
      return (2 ** 31 - 1 & (this.seed = Math.imul(48271, this.seed))) / 2 ** 31;
    } else {
      return Math.random();
    }
  }
};

// node_modules/path-data-parser/lib/parser.js
var COMMAND = 0;
var NUMBER = 1;
var EOD = 2;
var PARAMS = { A: 7, a: 7, C: 6, c: 6, H: 1, h: 1, L: 2, l: 2, M: 2, m: 2, Q: 4, q: 4, S: 4, s: 4, T: 2, t: 2, V: 1, v: 1, Z: 0, z: 0 };
function tokenize(d) {
  const tokens = new Array();
  while (d !== "") {
    if (d.match(/^([ \t\r\n,]+)/)) {
      d = d.substr(RegExp.$1.length);
    } else if (d.match(/^([aAcChHlLmMqQsStTvVzZ])/)) {
      tokens[tokens.length] = { type: COMMAND, text: RegExp.$1 };
      d = d.substr(RegExp.$1.length);
    } else if (d.match(/^(([-+]?[0-9]+(\.[0-9]*)?|[-+]?\.[0-9]+)([eE][-+]?[0-9]+)?)/)) {
      tokens[tokens.length] = { type: NUMBER, text: `${parseFloat(RegExp.$1)}` };
      d = d.substr(RegExp.$1.length);
    } else {
      return [];
    }
  }
  tokens[tokens.length] = { type: EOD, text: "" };
  return tokens;
}
function isType(token, type) {
  return token.type === type;
}
function parsePath(d) {
  const segments = [];
  const tokens = tokenize(d);
  let mode = "BOD";
  let index = 0;
  let token = tokens[index];
  while (!isType(token, EOD)) {
    let paramsCount = 0;
    const params = [];
    if (mode === "BOD") {
      if (token.text === "M" || token.text === "m") {
        index++;
        paramsCount = PARAMS[token.text];
        mode = token.text;
      } else {
        return parsePath("M0,0" + d);
      }
    } else if (isType(token, NUMBER)) {
      paramsCount = PARAMS[mode];
    } else {
      index++;
      paramsCount = PARAMS[token.text];
      mode = token.text;
    }
    if (index + paramsCount < tokens.length) {
      for (let i = index; i < index + paramsCount; i++) {
        const numbeToken = tokens[i];
        if (isType(numbeToken, NUMBER)) {
          params[params.length] = +numbeToken.text;
        } else {
          throw new Error("Param not a number: " + mode + "," + numbeToken.text);
        }
      }
      if (typeof PARAMS[mode] === "number") {
        const segment = { key: mode, data: params };
        segments.push(segment);
        index += paramsCount;
        token = tokens[index];
        if (mode === "M")
          mode = "L";
        if (mode === "m")
          mode = "l";
      } else {
        throw new Error("Bad segment: " + mode);
      }
    } else {
      throw new Error("Path data ended short");
    }
  }
  return segments;
}

// node_modules/path-data-parser/lib/absolutize.js
function absolutize(segments) {
  let cx = 0, cy = 0;
  let subx = 0, suby = 0;
  const out = [];
  for (const { key, data } of segments) {
    switch (key) {
      case "M":
        out.push({ key: "M", data: [...data] });
        [cx, cy] = data;
        [subx, suby] = data;
        break;
      case "m":
        cx += data[0];
        cy += data[1];
        out.push({ key: "M", data: [cx, cy] });
        subx = cx;
        suby = cy;
        break;
      case "L":
        out.push({ key: "L", data: [...data] });
        [cx, cy] = data;
        break;
      case "l":
        cx += data[0];
        cy += data[1];
        out.push({ key: "L", data: [cx, cy] });
        break;
      case "C":
        out.push({ key: "C", data: [...data] });
        cx = data[4];
        cy = data[5];
        break;
      case "c": {
        const newdata = data.map((d, i) => i % 2 ? d + cy : d + cx);
        out.push({ key: "C", data: newdata });
        cx = newdata[4];
        cy = newdata[5];
        break;
      }
      case "Q":
        out.push({ key: "Q", data: [...data] });
        cx = data[2];
        cy = data[3];
        break;
      case "q": {
        const newdata = data.map((d, i) => i % 2 ? d + cy : d + cx);
        out.push({ key: "Q", data: newdata });
        cx = newdata[2];
        cy = newdata[3];
        break;
      }
      case "A":
        out.push({ key: "A", data: [...data] });
        cx = data[5];
        cy = data[6];
        break;
      case "a":
        cx += data[5];
        cy += data[6];
        out.push({ key: "A", data: [data[0], data[1], data[2], data[3], data[4], cx, cy] });
        break;
      case "H":
        out.push({ key: "H", data: [...data] });
        cx = data[0];
        break;
      case "h":
        cx += data[0];
        out.push({ key: "H", data: [cx] });
        break;
      case "V":
        out.push({ key: "V", data: [...data] });
        cy = data[0];
        break;
      case "v":
        cy += data[0];
        out.push({ key: "V", data: [cy] });
        break;
      case "S":
        out.push({ key: "S", data: [...data] });
        cx = data[2];
        cy = data[3];
        break;
      case "s": {
        const newdata = data.map((d, i) => i % 2 ? d + cy : d + cx);
        out.push({ key: "S", data: newdata });
        cx = newdata[2];
        cy = newdata[3];
        break;
      }
      case "T":
        out.push({ key: "T", data: [...data] });
        cx = data[0];
        cy = data[1];
        break;
      case "t":
        cx += data[0];
        cy += data[1];
        out.push({ key: "T", data: [cx, cy] });
        break;
      case "Z":
      case "z":
        out.push({ key: "Z", data: [] });
        cx = subx;
        cy = suby;
        break;
    }
  }
  return out;
}

// node_modules/path-data-parser/lib/normalize.js
function normalize(segments) {
  const out = [];
  let lastType = "";
  let cx = 0, cy = 0;
  let subx = 0, suby = 0;
  let lcx = 0, lcy = 0;
  for (const { key, data } of segments) {
    switch (key) {
      case "M":
        out.push({ key: "M", data: [...data] });
        [cx, cy] = data;
        [subx, suby] = data;
        break;
      case "C":
        out.push({ key: "C", data: [...data] });
        cx = data[4];
        cy = data[5];
        lcx = data[2];
        lcy = data[3];
        break;
      case "L":
        out.push({ key: "L", data: [...data] });
        [cx, cy] = data;
        break;
      case "H":
        cx = data[0];
        out.push({ key: "L", data: [cx, cy] });
        break;
      case "V":
        cy = data[0];
        out.push({ key: "L", data: [cx, cy] });
        break;
      case "S": {
        let cx1 = 0, cy1 = 0;
        if (lastType === "C" || lastType === "S") {
          cx1 = cx + (cx - lcx);
          cy1 = cy + (cy - lcy);
        } else {
          cx1 = cx;
          cy1 = cy;
        }
        out.push({ key: "C", data: [cx1, cy1, ...data] });
        lcx = data[0];
        lcy = data[1];
        cx = data[2];
        cy = data[3];
        break;
      }
      case "T": {
        const [x, y] = data;
        let x1 = 0, y1 = 0;
        if (lastType === "Q" || lastType === "T") {
          x1 = cx + (cx - lcx);
          y1 = cy + (cy - lcy);
        } else {
          x1 = cx;
          y1 = cy;
        }
        const cx1 = cx + 2 * (x1 - cx) / 3;
        const cy1 = cy + 2 * (y1 - cy) / 3;
        const cx2 = x + 2 * (x1 - x) / 3;
        const cy2 = y + 2 * (y1 - y) / 3;
        out.push({ key: "C", data: [cx1, cy1, cx2, cy2, x, y] });
        lcx = x1;
        lcy = y1;
        cx = x;
        cy = y;
        break;
      }
      case "Q": {
        const [x1, y1, x, y] = data;
        const cx1 = cx + 2 * (x1 - cx) / 3;
        const cy1 = cy + 2 * (y1 - cy) / 3;
        const cx2 = x + 2 * (x1 - x) / 3;
        const cy2 = y + 2 * (y1 - y) / 3;
        out.push({ key: "C", data: [cx1, cy1, cx2, cy2, x, y] });
        lcx = x1;
        lcy = y1;
        cx = x;
        cy = y;
        break;
      }
      case "A": {
        const r1 = Math.abs(data[0]);
        const r2 = Math.abs(data[1]);
        const angle = data[2];
        const largeArcFlag = data[3];
        const sweepFlag = data[4];
        const x = data[5];
        const y = data[6];
        if (r1 === 0 || r2 === 0) {
          out.push({ key: "C", data: [cx, cy, x, y, x, y] });
          cx = x;
          cy = y;
        } else {
          if (cx !== x || cy !== y) {
            const curves = arcToCubicCurves(cx, cy, x, y, r1, r2, angle, largeArcFlag, sweepFlag);
            curves.forEach(function(curve2) {
              out.push({ key: "C", data: curve2 });
            });
            cx = x;
            cy = y;
          }
        }
        break;
      }
      case "Z":
        out.push({ key: "Z", data: [] });
        cx = subx;
        cy = suby;
        break;
    }
    lastType = key;
  }
  return out;
}
function degToRad(degrees) {
  return Math.PI * degrees / 180;
}
function rotate(x, y, angleRad) {
  const X = x * Math.cos(angleRad) - y * Math.sin(angleRad);
  const Y = x * Math.sin(angleRad) + y * Math.cos(angleRad);
  return [X, Y];
}
function arcToCubicCurves(x1, y1, x2, y2, r1, r2, angle, largeArcFlag, sweepFlag, recursive) {
  const angleRad = degToRad(angle);
  let params = [];
  let f1 = 0, f2 = 0, cx = 0, cy = 0;
  if (recursive) {
    [f1, f2, cx, cy] = recursive;
  } else {
    [x1, y1] = rotate(x1, y1, -angleRad);
    [x2, y2] = rotate(x2, y2, -angleRad);
    const x = (x1 - x2) / 2;
    const y = (y1 - y2) / 2;
    let h = x * x / (r1 * r1) + y * y / (r2 * r2);
    if (h > 1) {
      h = Math.sqrt(h);
      r1 = h * r1;
      r2 = h * r2;
    }
    const sign = largeArcFlag === sweepFlag ? -1 : 1;
    const r1Pow = r1 * r1;
    const r2Pow = r2 * r2;
    const left = r1Pow * r2Pow - r1Pow * y * y - r2Pow * x * x;
    const right = r1Pow * y * y + r2Pow * x * x;
    const k = sign * Math.sqrt(Math.abs(left / right));
    cx = k * r1 * y / r2 + (x1 + x2) / 2;
    cy = k * -r2 * x / r1 + (y1 + y2) / 2;
    f1 = Math.asin(parseFloat(((y1 - cy) / r2).toFixed(9)));
    f2 = Math.asin(parseFloat(((y2 - cy) / r2).toFixed(9)));
    if (x1 < cx) {
      f1 = Math.PI - f1;
    }
    if (x2 < cx) {
      f2 = Math.PI - f2;
    }
    if (f1 < 0) {
      f1 = Math.PI * 2 + f1;
    }
    if (f2 < 0) {
      f2 = Math.PI * 2 + f2;
    }
    if (sweepFlag && f1 > f2) {
      f1 = f1 - Math.PI * 2;
    }
    if (!sweepFlag && f2 > f1) {
      f2 = f2 - Math.PI * 2;
    }
  }
  let df = f2 - f1;
  if (Math.abs(df) > Math.PI * 120 / 180) {
    const f2old = f2;
    const x2old = x2;
    const y2old = y2;
    if (sweepFlag && f2 > f1) {
      f2 = f1 + Math.PI * 120 / 180 * 1;
    } else {
      f2 = f1 + Math.PI * 120 / 180 * -1;
    }
    x2 = cx + r1 * Math.cos(f2);
    y2 = cy + r2 * Math.sin(f2);
    params = arcToCubicCurves(x2, y2, x2old, y2old, r1, r2, angle, 0, sweepFlag, [f2, f2old, cx, cy]);
  }
  df = f2 - f1;
  const c1 = Math.cos(f1);
  const s1 = Math.sin(f1);
  const c2 = Math.cos(f2);
  const s2 = Math.sin(f2);
  const t = Math.tan(df / 4);
  const hx = 4 / 3 * r1 * t;
  const hy = 4 / 3 * r2 * t;
  const m1 = [x1, y1];
  const m2 = [x1 + hx * s1, y1 - hy * c1];
  const m3 = [x2 + hx * s2, y2 - hy * c2];
  const m4 = [x2, y2];
  m2[0] = 2 * m1[0] - m2[0];
  m2[1] = 2 * m1[1] - m2[1];
  if (recursive) {
    return [m2, m3, m4].concat(params);
  } else {
    params = [m2, m3, m4].concat(params);
    const curves = [];
    for (let i = 0; i < params.length; i += 3) {
      const r12 = rotate(params[i][0], params[i][1], angleRad);
      const r22 = rotate(params[i + 1][0], params[i + 1][1], angleRad);
      const r3 = rotate(params[i + 2][0], params[i + 2][1], angleRad);
      curves.push([r12[0], r12[1], r22[0], r22[1], r3[0], r3[1]]);
    }
    return curves;
  }
}

// node_modules/roughjs/bin/renderer.js
var helper = {
  randOffset,
  randOffsetWithRange,
  ellipse,
  doubleLineOps: doubleLineFillOps
};
function line(x1, y1, x2, y2, o) {
  return { type: "path", ops: _doubleLine(x1, y1, x2, y2, o) };
}
function linearPath(points, close, o) {
  const len = (points || []).length;
  if (len > 2) {
    const ops = [];
    for (let i = 0; i < len - 1; i++) {
      ops.push(..._doubleLine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], o));
    }
    if (close) {
      ops.push(..._doubleLine(points[len - 1][0], points[len - 1][1], points[0][0], points[0][1], o));
    }
    return { type: "path", ops };
  } else if (len === 2) {
    return line(points[0][0], points[0][1], points[1][0], points[1][1], o);
  }
  return { type: "path", ops: [] };
}
function polygon(points, o) {
  return linearPath(points, true, o);
}
function rectangle(x, y, width, height, o) {
  const points = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height]
  ];
  return polygon(points, o);
}
function curve(points, o) {
  let o1 = _curveWithOffset(points, 1 * (1 + o.roughness * 0.2), o);
  if (!o.disableMultiStroke) {
    const o2 = _curveWithOffset(points, 1.5 * (1 + o.roughness * 0.22), cloneOptionsAlterSeed(o));
    o1 = o1.concat(o2);
  }
  return { type: "path", ops: o1 };
}
function ellipse(x, y, width, height, o) {
  const params = generateEllipseParams(width, height, o);
  return ellipseWithParams(x, y, o, params).opset;
}
function generateEllipseParams(width, height, o) {
  const psq = Math.sqrt(Math.PI * 2 * Math.sqrt((Math.pow(width / 2, 2) + Math.pow(height / 2, 2)) / 2));
  const stepCount = Math.ceil(Math.max(o.curveStepCount, o.curveStepCount / Math.sqrt(200) * psq));
  const increment = Math.PI * 2 / stepCount;
  let rx = Math.abs(width / 2);
  let ry = Math.abs(height / 2);
  const curveFitRandomness = 1 - o.curveFitting;
  rx += _offsetOpt(rx * curveFitRandomness, o);
  ry += _offsetOpt(ry * curveFitRandomness, o);
  return { increment, rx, ry };
}
function ellipseWithParams(x, y, o, ellipseParams) {
  const [ap1, cp1] = _computeEllipsePoints(ellipseParams.increment, x, y, ellipseParams.rx, ellipseParams.ry, 1, ellipseParams.increment * _offset(0.1, _offset(0.4, 1, o), o), o);
  let o1 = _curve(ap1, null, o);
  if (!o.disableMultiStroke && o.roughness !== 0) {
    const [ap2] = _computeEllipsePoints(ellipseParams.increment, x, y, ellipseParams.rx, ellipseParams.ry, 1.5, 0, o);
    const o2 = _curve(ap2, null, o);
    o1 = o1.concat(o2);
  }
  return {
    estimatedPoints: cp1,
    opset: { type: "path", ops: o1 }
  };
}
function arc(x, y, width, height, start, stop, closed, roughClosure, o) {
  const cx = x;
  const cy = y;
  let rx = Math.abs(width / 2);
  let ry = Math.abs(height / 2);
  rx += _offsetOpt(rx * 0.01, o);
  ry += _offsetOpt(ry * 0.01, o);
  let strt = start;
  let stp = stop;
  while (strt < 0) {
    strt += Math.PI * 2;
    stp += Math.PI * 2;
  }
  if (stp - strt > Math.PI * 2) {
    strt = 0;
    stp = Math.PI * 2;
  }
  const ellipseInc = Math.PI * 2 / o.curveStepCount;
  const arcInc = Math.min(ellipseInc / 2, (stp - strt) / 2);
  const ops = _arc(arcInc, cx, cy, rx, ry, strt, stp, 1, o);
  if (!o.disableMultiStroke) {
    const o2 = _arc(arcInc, cx, cy, rx, ry, strt, stp, 1.5, o);
    ops.push(...o2);
  }
  if (closed) {
    if (roughClosure) {
      ops.push(..._doubleLine(cx, cy, cx + rx * Math.cos(strt), cy + ry * Math.sin(strt), o), ..._doubleLine(cx, cy, cx + rx * Math.cos(stp), cy + ry * Math.sin(stp), o));
    } else {
      ops.push({ op: "lineTo", data: [cx, cy] }, { op: "lineTo", data: [cx + rx * Math.cos(strt), cy + ry * Math.sin(strt)] });
    }
  }
  return { type: "path", ops };
}
function svgPath(path, o) {
  const segments = normalize(absolutize(parsePath(path)));
  const ops = [];
  let first = [0, 0];
  let current = [0, 0];
  for (const { key, data } of segments) {
    switch (key) {
      case "M": {
        current = [data[0], data[1]];
        first = [data[0], data[1]];
        break;
      }
      case "L":
        ops.push(..._doubleLine(current[0], current[1], data[0], data[1], o));
        current = [data[0], data[1]];
        break;
      case "C": {
        const [x1, y1, x2, y2, x, y] = data;
        ops.push(..._bezierTo(x1, y1, x2, y2, x, y, current, o));
        current = [x, y];
        break;
      }
      case "Z":
        ops.push(..._doubleLine(current[0], current[1], first[0], first[1], o));
        current = [first[0], first[1]];
        break;
    }
  }
  return { type: "path", ops };
}
function solidFillPolygon(polygonList, o) {
  const ops = [];
  for (const points of polygonList) {
    if (points.length) {
      const offset = o.maxRandomnessOffset || 0;
      const len = points.length;
      if (len > 2) {
        ops.push({ op: "move", data: [points[0][0] + _offsetOpt(offset, o), points[0][1] + _offsetOpt(offset, o)] });
        for (let i = 1; i < len; i++) {
          ops.push({ op: "lineTo", data: [points[i][0] + _offsetOpt(offset, o), points[i][1] + _offsetOpt(offset, o)] });
        }
      }
    }
  }
  return { type: "fillPath", ops };
}
function patternFillPolygons(polygonList, o) {
  return getFiller(o, helper).fillPolygons(polygonList, o);
}
function patternFillArc(x, y, width, height, start, stop, o) {
  const cx = x;
  const cy = y;
  let rx = Math.abs(width / 2);
  let ry = Math.abs(height / 2);
  rx += _offsetOpt(rx * 0.01, o);
  ry += _offsetOpt(ry * 0.01, o);
  let strt = start;
  let stp = stop;
  while (strt < 0) {
    strt += Math.PI * 2;
    stp += Math.PI * 2;
  }
  if (stp - strt > Math.PI * 2) {
    strt = 0;
    stp = Math.PI * 2;
  }
  const increment = (stp - strt) / o.curveStepCount;
  const points = [];
  for (let angle = strt; angle <= stp; angle = angle + increment) {
    points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }
  points.push([cx + rx * Math.cos(stp), cy + ry * Math.sin(stp)]);
  points.push([cx, cy]);
  return patternFillPolygons([points], o);
}
function randOffset(x, o) {
  return _offsetOpt(x, o);
}
function randOffsetWithRange(min, max, o) {
  return _offset(min, max, o);
}
function doubleLineFillOps(x1, y1, x2, y2, o) {
  return _doubleLine(x1, y1, x2, y2, o, true);
}
function cloneOptionsAlterSeed(ops) {
  const result = Object.assign({}, ops);
  result.randomizer = void 0;
  if (ops.seed) {
    result.seed = ops.seed + 1;
  }
  return result;
}
function random(ops) {
  if (!ops.randomizer) {
    ops.randomizer = new Random(ops.seed || 0);
  }
  return ops.randomizer.next();
}
function _offset(min, max, ops, roughnessGain = 1) {
  return ops.roughness * roughnessGain * (random(ops) * (max - min) + min);
}
function _offsetOpt(x, ops, roughnessGain = 1) {
  return _offset(-x, x, ops, roughnessGain);
}
function _doubleLine(x1, y1, x2, y2, o, filling = false) {
  const singleStroke = filling ? o.disableMultiStrokeFill : o.disableMultiStroke;
  const o1 = _line(x1, y1, x2, y2, o, true, false);
  if (singleStroke) {
    return o1;
  }
  const o2 = _line(x1, y1, x2, y2, o, true, true);
  return o1.concat(o2);
}
function _line(x1, y1, x2, y2, o, move, overlay) {
  const lengthSq = Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);
  const length = Math.sqrt(lengthSq);
  let roughnessGain = 1;
  if (length < 200) {
    roughnessGain = 1;
  } else if (length > 500) {
    roughnessGain = 0.4;
  } else {
    roughnessGain = -16668e-7 * length + 1.233334;
  }
  let offset = o.maxRandomnessOffset || 0;
  if (offset * offset * 100 > lengthSq) {
    offset = length / 10;
  }
  const halfOffset = offset / 2;
  const divergePoint = 0.2 + random(o) * 0.2;
  let midDispX = o.bowing * o.maxRandomnessOffset * (y2 - y1) / 200;
  let midDispY = o.bowing * o.maxRandomnessOffset * (x1 - x2) / 200;
  midDispX = _offsetOpt(midDispX, o, roughnessGain);
  midDispY = _offsetOpt(midDispY, o, roughnessGain);
  const ops = [];
  const randomHalf = () => _offsetOpt(halfOffset, o, roughnessGain);
  const randomFull = () => _offsetOpt(offset, o, roughnessGain);
  const preserveVertices = o.preserveVertices;
  if (move) {
    if (overlay) {
      ops.push({
        op: "move",
        data: [
          x1 + (preserveVertices ? 0 : randomHalf()),
          y1 + (preserveVertices ? 0 : randomHalf())
        ]
      });
    } else {
      ops.push({
        op: "move",
        data: [
          x1 + (preserveVertices ? 0 : _offsetOpt(offset, o, roughnessGain)),
          y1 + (preserveVertices ? 0 : _offsetOpt(offset, o, roughnessGain))
        ]
      });
    }
  }
  if (overlay) {
    ops.push({
      op: "bcurveTo",
      data: [
        midDispX + x1 + (x2 - x1) * divergePoint + randomHalf(),
        midDispY + y1 + (y2 - y1) * divergePoint + randomHalf(),
        midDispX + x1 + 2 * (x2 - x1) * divergePoint + randomHalf(),
        midDispY + y1 + 2 * (y2 - y1) * divergePoint + randomHalf(),
        x2 + (preserveVertices ? 0 : randomHalf()),
        y2 + (preserveVertices ? 0 : randomHalf())
      ]
    });
  } else {
    ops.push({
      op: "bcurveTo",
      data: [
        midDispX + x1 + (x2 - x1) * divergePoint + randomFull(),
        midDispY + y1 + (y2 - y1) * divergePoint + randomFull(),
        midDispX + x1 + 2 * (x2 - x1) * divergePoint + randomFull(),
        midDispY + y1 + 2 * (y2 - y1) * divergePoint + randomFull(),
        x2 + (preserveVertices ? 0 : randomFull()),
        y2 + (preserveVertices ? 0 : randomFull())
      ]
    });
  }
  return ops;
}
function _curveWithOffset(points, offset, o) {
  const ps = [];
  ps.push([
    points[0][0] + _offsetOpt(offset, o),
    points[0][1] + _offsetOpt(offset, o)
  ]);
  ps.push([
    points[0][0] + _offsetOpt(offset, o),
    points[0][1] + _offsetOpt(offset, o)
  ]);
  for (let i = 1; i < points.length; i++) {
    ps.push([
      points[i][0] + _offsetOpt(offset, o),
      points[i][1] + _offsetOpt(offset, o)
    ]);
    if (i === points.length - 1) {
      ps.push([
        points[i][0] + _offsetOpt(offset, o),
        points[i][1] + _offsetOpt(offset, o)
      ]);
    }
  }
  return _curve(ps, null, o);
}
function _curve(points, closePoint, o) {
  const len = points.length;
  const ops = [];
  if (len > 3) {
    const b2 = [];
    const s = 1 - o.curveTightness;
    ops.push({ op: "move", data: [points[1][0], points[1][1]] });
    for (let i = 1; i + 2 < len; i++) {
      const cachedVertArray = points[i];
      b2[0] = [cachedVertArray[0], cachedVertArray[1]];
      b2[1] = [cachedVertArray[0] + (s * points[i + 1][0] - s * points[i - 1][0]) / 6, cachedVertArray[1] + (s * points[i + 1][1] - s * points[i - 1][1]) / 6];
      b2[2] = [points[i + 1][0] + (s * points[i][0] - s * points[i + 2][0]) / 6, points[i + 1][1] + (s * points[i][1] - s * points[i + 2][1]) / 6];
      b2[3] = [points[i + 1][0], points[i + 1][1]];
      ops.push({ op: "bcurveTo", data: [b2[1][0], b2[1][1], b2[2][0], b2[2][1], b2[3][0], b2[3][1]] });
    }
    if (closePoint && closePoint.length === 2) {
      const ro = o.maxRandomnessOffset;
      ops.push({ op: "lineTo", data: [closePoint[0] + _offsetOpt(ro, o), closePoint[1] + _offsetOpt(ro, o)] });
    }
  } else if (len === 3) {
    ops.push({ op: "move", data: [points[1][0], points[1][1]] });
    ops.push({
      op: "bcurveTo",
      data: [
        points[1][0],
        points[1][1],
        points[2][0],
        points[2][1],
        points[2][0],
        points[2][1]
      ]
    });
  } else if (len === 2) {
    ops.push(..._doubleLine(points[0][0], points[0][1], points[1][0], points[1][1], o));
  }
  return ops;
}
function _computeEllipsePoints(increment, cx, cy, rx, ry, offset, overlap, o) {
  const coreOnly = o.roughness === 0;
  const corePoints = [];
  const allPoints = [];
  if (coreOnly) {
    increment = increment / 4;
    allPoints.push([
      cx + rx * Math.cos(-increment),
      cy + ry * Math.sin(-increment)
    ]);
    for (let angle = 0; angle <= Math.PI * 2; angle = angle + increment) {
      const p = [
        cx + rx * Math.cos(angle),
        cy + ry * Math.sin(angle)
      ];
      corePoints.push(p);
      allPoints.push(p);
    }
    allPoints.push([
      cx + rx * Math.cos(0),
      cy + ry * Math.sin(0)
    ]);
    allPoints.push([
      cx + rx * Math.cos(increment),
      cy + ry * Math.sin(increment)
    ]);
  } else {
    const radOffset = _offsetOpt(0.5, o) - Math.PI / 2;
    allPoints.push([
      _offsetOpt(offset, o) + cx + 0.9 * rx * Math.cos(radOffset - increment),
      _offsetOpt(offset, o) + cy + 0.9 * ry * Math.sin(radOffset - increment)
    ]);
    const endAngle = Math.PI * 2 + radOffset - 0.01;
    for (let angle = radOffset; angle < endAngle; angle = angle + increment) {
      const p = [
        _offsetOpt(offset, o) + cx + rx * Math.cos(angle),
        _offsetOpt(offset, o) + cy + ry * Math.sin(angle)
      ];
      corePoints.push(p);
      allPoints.push(p);
    }
    allPoints.push([
      _offsetOpt(offset, o) + cx + rx * Math.cos(radOffset + Math.PI * 2 + overlap * 0.5),
      _offsetOpt(offset, o) + cy + ry * Math.sin(radOffset + Math.PI * 2 + overlap * 0.5)
    ]);
    allPoints.push([
      _offsetOpt(offset, o) + cx + 0.98 * rx * Math.cos(radOffset + overlap),
      _offsetOpt(offset, o) + cy + 0.98 * ry * Math.sin(radOffset + overlap)
    ]);
    allPoints.push([
      _offsetOpt(offset, o) + cx + 0.9 * rx * Math.cos(radOffset + overlap * 0.5),
      _offsetOpt(offset, o) + cy + 0.9 * ry * Math.sin(radOffset + overlap * 0.5)
    ]);
  }
  return [allPoints, corePoints];
}
function _arc(increment, cx, cy, rx, ry, strt, stp, offset, o) {
  const radOffset = strt + _offsetOpt(0.1, o);
  const points = [];
  points.push([
    _offsetOpt(offset, o) + cx + 0.9 * rx * Math.cos(radOffset - increment),
    _offsetOpt(offset, o) + cy + 0.9 * ry * Math.sin(radOffset - increment)
  ]);
  for (let angle = radOffset; angle <= stp; angle = angle + increment) {
    points.push([
      _offsetOpt(offset, o) + cx + rx * Math.cos(angle),
      _offsetOpt(offset, o) + cy + ry * Math.sin(angle)
    ]);
  }
  points.push([
    cx + rx * Math.cos(stp),
    cy + ry * Math.sin(stp)
  ]);
  points.push([
    cx + rx * Math.cos(stp),
    cy + ry * Math.sin(stp)
  ]);
  return _curve(points, null, o);
}
function _bezierTo(x1, y1, x2, y2, x, y, current, o) {
  const ops = [];
  const ros = [o.maxRandomnessOffset || 1, (o.maxRandomnessOffset || 1) + 0.3];
  let f = [0, 0];
  const iterations = o.disableMultiStroke ? 1 : 2;
  const preserveVertices = o.preserveVertices;
  for (let i = 0; i < iterations; i++) {
    if (i === 0) {
      ops.push({ op: "move", data: [current[0], current[1]] });
    } else {
      ops.push({ op: "move", data: [current[0] + (preserveVertices ? 0 : _offsetOpt(ros[0], o)), current[1] + (preserveVertices ? 0 : _offsetOpt(ros[0], o))] });
    }
    f = preserveVertices ? [x, y] : [x + _offsetOpt(ros[i], o), y + _offsetOpt(ros[i], o)];
    ops.push({
      op: "bcurveTo",
      data: [
        x1 + _offsetOpt(ros[i], o),
        y1 + _offsetOpt(ros[i], o),
        x2 + _offsetOpt(ros[i], o),
        y2 + _offsetOpt(ros[i], o),
        f[0],
        f[1]
      ]
    });
  }
  return ops;
}

// node_modules/roughjs/node_modules/points-on-curve/lib/curve-to-bezier.js
function clone(p) {
  return [...p];
}
function curveToBezier(pointsIn, curveTightness = 0) {
  const len = pointsIn.length;
  if (len < 3) {
    throw new Error("A curve must have at least three points.");
  }
  const out = [];
  if (len === 3) {
    out.push(clone(pointsIn[0]), clone(pointsIn[1]), clone(pointsIn[2]), clone(pointsIn[2]));
  } else {
    const points = [];
    points.push(pointsIn[0], pointsIn[0]);
    for (let i = 1; i < pointsIn.length; i++) {
      points.push(pointsIn[i]);
      if (i === pointsIn.length - 1) {
        points.push(pointsIn[i]);
      }
    }
    const b2 = [];
    const s = 1 - curveTightness;
    out.push(clone(points[0]));
    for (let i = 1; i + 2 < points.length; i++) {
      const cachedVertArray = points[i];
      b2[0] = [cachedVertArray[0], cachedVertArray[1]];
      b2[1] = [cachedVertArray[0] + (s * points[i + 1][0] - s * points[i - 1][0]) / 6, cachedVertArray[1] + (s * points[i + 1][1] - s * points[i - 1][1]) / 6];
      b2[2] = [points[i + 1][0] + (s * points[i][0] - s * points[i + 2][0]) / 6, points[i + 1][1] + (s * points[i][1] - s * points[i + 2][1]) / 6];
      b2[3] = [points[i + 1][0], points[i + 1][1]];
      out.push(b2[1], b2[2], b2[3]);
    }
  }
  return out;
}

// node_modules/roughjs/node_modules/points-on-curve/lib/index.js
function distance(p1, p2) {
  return Math.sqrt(distanceSq(p1, p2));
}
function distanceSq(p1, p2) {
  return Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2);
}
function distanceToSegmentSq(p, v, w) {
  const l2 = distanceSq(v, w);
  if (l2 === 0) {
    return distanceSq(p, v);
  }
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  return distanceSq(p, lerp(v, w, t));
}
function lerp(a2, b2, t) {
  return [
    a2[0] + (b2[0] - a2[0]) * t,
    a2[1] + (b2[1] - a2[1]) * t
  ];
}
function flatness(points, offset) {
  const p1 = points[offset + 0];
  const p2 = points[offset + 1];
  const p3 = points[offset + 2];
  const p4 = points[offset + 3];
  let ux = 3 * p2[0] - 2 * p1[0] - p4[0];
  ux *= ux;
  let uy = 3 * p2[1] - 2 * p1[1] - p4[1];
  uy *= uy;
  let vx = 3 * p3[0] - 2 * p4[0] - p1[0];
  vx *= vx;
  let vy = 3 * p3[1] - 2 * p4[1] - p1[1];
  vy *= vy;
  if (ux < vx) {
    ux = vx;
  }
  if (uy < vy) {
    uy = vy;
  }
  return ux + uy;
}
function getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints) {
  const outPoints = newPoints || [];
  if (flatness(points, offset) < tolerance) {
    const p0 = points[offset + 0];
    if (outPoints.length) {
      const d = distance(outPoints[outPoints.length - 1], p0);
      if (d > 1) {
        outPoints.push(p0);
      }
    } else {
      outPoints.push(p0);
    }
    outPoints.push(points[offset + 3]);
  } else {
    const t = 0.5;
    const p1 = points[offset + 0];
    const p2 = points[offset + 1];
    const p3 = points[offset + 2];
    const p4 = points[offset + 3];
    const q1 = lerp(p1, p2, t);
    const q2 = lerp(p2, p3, t);
    const q3 = lerp(p3, p4, t);
    const r1 = lerp(q1, q2, t);
    const r2 = lerp(q2, q3, t);
    const red = lerp(r1, r2, t);
    getPointsOnBezierCurveWithSplitting([p1, q1, r1, red], 0, tolerance, outPoints);
    getPointsOnBezierCurveWithSplitting([red, r2, q3, p4], 0, tolerance, outPoints);
  }
  return outPoints;
}
function simplifyPoints(points, start, end, epsilon, newPoints) {
  const outPoints = newPoints || [];
  const s = points[start];
  const e = points[end - 1];
  let maxDistSq = 0;
  let maxNdx = 1;
  for (let i = start + 1; i < end - 1; ++i) {
    const distSq = distanceToSegmentSq(points[i], s, e);
    if (distSq > maxDistSq) {
      maxDistSq = distSq;
      maxNdx = i;
    }
  }
  if (Math.sqrt(maxDistSq) > epsilon) {
    simplifyPoints(points, start, maxNdx + 1, epsilon, outPoints);
    simplifyPoints(points, maxNdx, end, epsilon, outPoints);
  } else {
    if (!outPoints.length) {
      outPoints.push(s);
    }
    outPoints.push(e);
  }
  return outPoints;
}
function pointsOnBezierCurves(points, tolerance = 0.15, distance3) {
  const newPoints = [];
  const numSegments = (points.length - 1) / 3;
  for (let i = 0; i < numSegments; i++) {
    const offset = i * 3;
    getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints);
  }
  if (distance3 && distance3 > 0) {
    return simplifyPoints(newPoints, 0, newPoints.length, distance3);
  }
  return newPoints;
}

// node_modules/points-on-path/node_modules/points-on-curve/lib/index.js
function distance2(p1, p2) {
  return Math.sqrt(distanceSq2(p1, p2));
}
function distanceSq2(p1, p2) {
  return Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2);
}
function distanceToSegmentSq2(p, v, w) {
  const l2 = distanceSq2(v, w);
  if (l2 === 0) {
    return distanceSq2(p, v);
  }
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  return distanceSq2(p, lerp2(v, w, t));
}
function lerp2(a2, b2, t) {
  return [
    a2[0] + (b2[0] - a2[0]) * t,
    a2[1] + (b2[1] - a2[1]) * t
  ];
}
function flatness2(points, offset) {
  const p1 = points[offset + 0];
  const p2 = points[offset + 1];
  const p3 = points[offset + 2];
  const p4 = points[offset + 3];
  let ux = 3 * p2[0] - 2 * p1[0] - p4[0];
  ux *= ux;
  let uy = 3 * p2[1] - 2 * p1[1] - p4[1];
  uy *= uy;
  let vx = 3 * p3[0] - 2 * p4[0] - p1[0];
  vx *= vx;
  let vy = 3 * p3[1] - 2 * p4[1] - p1[1];
  vy *= vy;
  if (ux < vx) {
    ux = vx;
  }
  if (uy < vy) {
    uy = vy;
  }
  return ux + uy;
}
function getPointsOnBezierCurveWithSplitting2(points, offset, tolerance, newPoints) {
  const outPoints = newPoints || [];
  if (flatness2(points, offset) < tolerance) {
    const p0 = points[offset + 0];
    if (outPoints.length) {
      const d = distance2(outPoints[outPoints.length - 1], p0);
      if (d > 1) {
        outPoints.push(p0);
      }
    } else {
      outPoints.push(p0);
    }
    outPoints.push(points[offset + 3]);
  } else {
    const t = 0.5;
    const p1 = points[offset + 0];
    const p2 = points[offset + 1];
    const p3 = points[offset + 2];
    const p4 = points[offset + 3];
    const q1 = lerp2(p1, p2, t);
    const q2 = lerp2(p2, p3, t);
    const q3 = lerp2(p3, p4, t);
    const r1 = lerp2(q1, q2, t);
    const r2 = lerp2(q2, q3, t);
    const red = lerp2(r1, r2, t);
    getPointsOnBezierCurveWithSplitting2([p1, q1, r1, red], 0, tolerance, outPoints);
    getPointsOnBezierCurveWithSplitting2([red, r2, q3, p4], 0, tolerance, outPoints);
  }
  return outPoints;
}
function simplify(points, distance3) {
  return simplifyPoints2(points, 0, points.length, distance3);
}
function simplifyPoints2(points, start, end, epsilon, newPoints) {
  const outPoints = newPoints || [];
  const s = points[start];
  const e = points[end - 1];
  let maxDistSq = 0;
  let maxNdx = 1;
  for (let i = start + 1; i < end - 1; ++i) {
    const distSq = distanceToSegmentSq2(points[i], s, e);
    if (distSq > maxDistSq) {
      maxDistSq = distSq;
      maxNdx = i;
    }
  }
  if (Math.sqrt(maxDistSq) > epsilon) {
    simplifyPoints2(points, start, maxNdx + 1, epsilon, outPoints);
    simplifyPoints2(points, maxNdx, end, epsilon, outPoints);
  } else {
    if (!outPoints.length) {
      outPoints.push(s);
    }
    outPoints.push(e);
  }
  return outPoints;
}
function pointsOnBezierCurves2(points, tolerance = 0.15, distance3) {
  const newPoints = [];
  const numSegments = (points.length - 1) / 3;
  for (let i = 0; i < numSegments; i++) {
    const offset = i * 3;
    getPointsOnBezierCurveWithSplitting2(points, offset, tolerance, newPoints);
  }
  if (distance3 && distance3 > 0) {
    return simplifyPoints2(newPoints, 0, newPoints.length, distance3);
  }
  return newPoints;
}

// node_modules/points-on-path/lib/index.js
function pointsOnPath(path, tolerance, distance3) {
  const segments = parsePath(path);
  const normalized = normalize(absolutize(segments));
  const sets = [];
  let currentPoints = [];
  let start = [0, 0];
  let pendingCurve = [];
  const appendPendingCurve = () => {
    if (pendingCurve.length >= 4) {
      currentPoints.push(...pointsOnBezierCurves2(pendingCurve, tolerance));
    }
    pendingCurve = [];
  };
  const appendPendingPoints = () => {
    appendPendingCurve();
    if (currentPoints.length) {
      sets.push(currentPoints);
      currentPoints = [];
    }
  };
  for (const { key, data } of normalized) {
    switch (key) {
      case "M":
        appendPendingPoints();
        start = [data[0], data[1]];
        currentPoints.push(start);
        break;
      case "L":
        appendPendingCurve();
        currentPoints.push([data[0], data[1]]);
        break;
      case "C":
        if (!pendingCurve.length) {
          const lastPoint = currentPoints.length ? currentPoints[currentPoints.length - 1] : start;
          pendingCurve.push([lastPoint[0], lastPoint[1]]);
        }
        pendingCurve.push([data[0], data[1]]);
        pendingCurve.push([data[2], data[3]]);
        pendingCurve.push([data[4], data[5]]);
        break;
      case "Z":
        appendPendingCurve();
        currentPoints.push([start[0], start[1]]);
        break;
    }
  }
  appendPendingPoints();
  if (!distance3) {
    return sets;
  }
  const out = [];
  for (const set of sets) {
    const simplifiedSet = simplify(set, distance3);
    if (simplifiedSet.length) {
      out.push(simplifiedSet);
    }
  }
  return out;
}

// node_modules/roughjs/bin/generator.js
var NOS = "none";
var RoughGenerator = class {
  constructor(config) {
    this.defaultOptions = {
      maxRandomnessOffset: 2,
      roughness: 1,
      bowing: 1,
      stroke: "#000",
      strokeWidth: 1,
      curveTightness: 0,
      curveFitting: 0.95,
      curveStepCount: 9,
      fillStyle: "hachure",
      fillWeight: -1,
      hachureAngle: -41,
      hachureGap: -1,
      dashOffset: -1,
      dashGap: -1,
      zigzagOffset: -1,
      seed: 0,
      disableMultiStroke: false,
      disableMultiStrokeFill: false,
      preserveVertices: false,
      fillShapeRoughnessGain: 0.8
    };
    this.config = config || {};
    if (this.config.options) {
      this.defaultOptions = this._o(this.config.options);
    }
  }
  static newSeed() {
    return randomSeed();
  }
  _o(options) {
    return options ? Object.assign({}, this.defaultOptions, options) : this.defaultOptions;
  }
  _d(shape, sets, options) {
    return { shape, sets: sets || [], options: options || this.defaultOptions };
  }
  line(x1, y1, x2, y2, options) {
    const o = this._o(options);
    return this._d("line", [line(x1, y1, x2, y2, o)], o);
  }
  rectangle(x, y, width, height, options) {
    const o = this._o(options);
    const paths = [];
    const outline = rectangle(x, y, width, height, o);
    if (o.fill) {
      const points = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
      if (o.fillStyle === "solid") {
        paths.push(solidFillPolygon([points], o));
      } else {
        paths.push(patternFillPolygons([points], o));
      }
    }
    if (o.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d("rectangle", paths, o);
  }
  ellipse(x, y, width, height, options) {
    const o = this._o(options);
    const paths = [];
    const ellipseParams = generateEllipseParams(width, height, o);
    const ellipseResponse = ellipseWithParams(x, y, o, ellipseParams);
    if (o.fill) {
      if (o.fillStyle === "solid") {
        const shape = ellipseWithParams(x, y, o, ellipseParams).opset;
        shape.type = "fillPath";
        paths.push(shape);
      } else {
        paths.push(patternFillPolygons([ellipseResponse.estimatedPoints], o));
      }
    }
    if (o.stroke !== NOS) {
      paths.push(ellipseResponse.opset);
    }
    return this._d("ellipse", paths, o);
  }
  circle(x, y, diameter, options) {
    const ret = this.ellipse(x, y, diameter, diameter, options);
    ret.shape = "circle";
    return ret;
  }
  linearPath(points, options) {
    const o = this._o(options);
    return this._d("linearPath", [linearPath(points, false, o)], o);
  }
  arc(x, y, width, height, start, stop, closed = false, options) {
    const o = this._o(options);
    const paths = [];
    const outline = arc(x, y, width, height, start, stop, closed, true, o);
    if (closed && o.fill) {
      if (o.fillStyle === "solid") {
        const fillOptions = Object.assign({}, o);
        fillOptions.disableMultiStroke = true;
        const shape = arc(x, y, width, height, start, stop, true, false, fillOptions);
        shape.type = "fillPath";
        paths.push(shape);
      } else {
        paths.push(patternFillArc(x, y, width, height, start, stop, o));
      }
    }
    if (o.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d("arc", paths, o);
  }
  curve(points, options) {
    const o = this._o(options);
    const paths = [];
    const outline = curve(points, o);
    if (o.fill && o.fill !== NOS && points.length >= 3) {
      if (o.fillStyle === "solid") {
        const fillShape = curve(points, Object.assign(Object.assign({}, o), { disableMultiStroke: true, roughness: o.roughness ? o.roughness + o.fillShapeRoughnessGain : 0 }));
        paths.push({
          type: "fillPath",
          ops: this._mergedShape(fillShape.ops)
        });
      } else {
        const bcurve = curveToBezier(points);
        const polyPoints = pointsOnBezierCurves(bcurve, 10, (1 + o.roughness) / 2);
        paths.push(patternFillPolygons([polyPoints], o));
      }
    }
    if (o.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d("curve", paths, o);
  }
  polygon(points, options) {
    const o = this._o(options);
    const paths = [];
    const outline = linearPath(points, true, o);
    if (o.fill) {
      if (o.fillStyle === "solid") {
        paths.push(solidFillPolygon([points], o));
      } else {
        paths.push(patternFillPolygons([points], o));
      }
    }
    if (o.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d("polygon", paths, o);
  }
  path(d, options) {
    const o = this._o(options);
    const paths = [];
    if (!d) {
      return this._d("path", paths, o);
    }
    d = (d || "").replace(/\n/g, " ").replace(/(-\s)/g, "-").replace("/(ss)/g", " ");
    const hasFill = o.fill && o.fill !== "transparent" && o.fill !== NOS;
    const hasStroke = o.stroke !== NOS;
    const simplified = !!(o.simplification && o.simplification < 1);
    const distance3 = simplified ? 4 - 4 * (o.simplification || 1) : (1 + o.roughness) / 2;
    const sets = pointsOnPath(d, 1, distance3);
    const shape = svgPath(d, o);
    if (hasFill) {
      if (o.fillStyle === "solid") {
        if (sets.length === 1) {
          const fillShape = svgPath(d, Object.assign(Object.assign({}, o), { disableMultiStroke: true, roughness: o.roughness ? o.roughness + o.fillShapeRoughnessGain : 0 }));
          paths.push({
            type: "fillPath",
            ops: this._mergedShape(fillShape.ops)
          });
        } else {
          paths.push(solidFillPolygon(sets, o));
        }
      } else {
        paths.push(patternFillPolygons(sets, o));
      }
    }
    if (hasStroke) {
      if (simplified) {
        sets.forEach((set) => {
          paths.push(linearPath(set, false, o));
        });
      } else {
        paths.push(shape);
      }
    }
    return this._d("path", paths, o);
  }
  opsToPath(drawing, fixedDecimals) {
    let path = "";
    for (const item of drawing.ops) {
      const data = typeof fixedDecimals === "number" && fixedDecimals >= 0 ? item.data.map((d) => +d.toFixed(fixedDecimals)) : item.data;
      switch (item.op) {
        case "move":
          path += `M${data[0]} ${data[1]} `;
          break;
        case "bcurveTo":
          path += `C${data[0]} ${data[1]}, ${data[2]} ${data[3]}, ${data[4]} ${data[5]} `;
          break;
        case "lineTo":
          path += `L${data[0]} ${data[1]} `;
          break;
      }
    }
    return path.trim();
  }
  toPaths(drawable) {
    const sets = drawable.sets || [];
    const o = drawable.options || this.defaultOptions;
    const paths = [];
    for (const drawing of sets) {
      let path = null;
      switch (drawing.type) {
        case "path":
          path = {
            d: this.opsToPath(drawing),
            stroke: o.stroke,
            strokeWidth: o.strokeWidth,
            fill: NOS
          };
          break;
        case "fillPath":
          path = {
            d: this.opsToPath(drawing),
            stroke: NOS,
            strokeWidth: 0,
            fill: o.fill || NOS
          };
          break;
        case "fillSketch":
          path = this.fillSketch(drawing, o);
          break;
      }
      if (path) {
        paths.push(path);
      }
    }
    return paths;
  }
  fillSketch(drawing, o) {
    let fweight = o.fillWeight;
    if (fweight < 0) {
      fweight = o.strokeWidth / 2;
    }
    return {
      d: this.opsToPath(drawing),
      stroke: o.fill || NOS,
      strokeWidth: fweight,
      fill: NOS
    };
  }
  _mergedShape(input) {
    return input.filter((d, i) => {
      if (i === 0) {
        return true;
      }
      if (d.op === "move") {
        return false;
      }
      return true;
    });
  }
};

// node_modules/points-on-curve/lib/index.js
function distanceSq3(p1, p2) {
  return Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2);
}
function distanceToSegmentSq3(p, v, w) {
  const l2 = distanceSq3(v, w);
  if (l2 === 0) {
    return distanceSq3(p, v);
  }
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  return distanceSq3(p, lerp3(v, w, t));
}
function lerp3(a2, b2, t) {
  return [
    a2[0] + (b2[0] - a2[0]) * t,
    a2[1] + (b2[1] - a2[1]) * t
  ];
}
function simplify2(points, distance3) {
  return simplifyPoints3(points, 0, points.length, distance3);
}
function simplifyPoints3(points, start, end, epsilon, newPoints) {
  const outPoints = newPoints || [];
  const s = points[start];
  const e = points[end - 1];
  let maxDistSq = 0;
  let maxNdx = 1;
  for (let i = start + 1; i < end - 1; ++i) {
    const distSq = distanceToSegmentSq3(points[i], s, e);
    if (distSq > maxDistSq) {
      maxDistSq = distSq;
      maxNdx = i;
    }
  }
  if (Math.sqrt(maxDistSq) > epsilon) {
    simplifyPoints3(points, start, maxNdx + 1, epsilon, outPoints);
    simplifyPoints3(points, maxNdx, end, epsilon, outPoints);
  } else {
    if (!outPoints.length) {
      outPoints.push(s);
    }
    outPoints.push(e);
  }
  return outPoints;
}

// node_modules/perfect-freehand/dist/esm/index.js
function $(e, t, u, x = (h) => h) {
  return e * x(0.5 - t * (0.5 - u));
}
function se(e) {
  return [-e[0], -e[1]];
}
function l(e, t) {
  return [e[0] + t[0], e[1] + t[1]];
}
function a(e, t) {
  return [e[0] - t[0], e[1] - t[1]];
}
function b(e, t) {
  return [e[0] * t, e[1] * t];
}
function he(e, t) {
  return [e[0] / t, e[1] / t];
}
function R(e) {
  return [e[1], -e[0]];
}
function B(e, t) {
  return e[0] * t[0] + e[1] * t[1];
}
function ue(e, t) {
  return e[0] === t[0] && e[1] === t[1];
}
function ge(e) {
  return Math.hypot(e[0], e[1]);
}
function de(e) {
  return e[0] * e[0] + e[1] * e[1];
}
function A(e, t) {
  return de(a(e, t));
}
function G(e) {
  return he(e, ge(e));
}
function ie(e, t) {
  return Math.hypot(e[1] - t[1], e[0] - t[0]);
}
function L(e, t, u) {
  let x = Math.sin(u), h = Math.cos(u), y = e[0] - t[0], n = e[1] - t[1], f = y * h - n * x, d = y * x + n * h;
  return [f + t[0], d + t[1]];
}
function K(e, t, u) {
  return l(e, b(a(t, e), u));
}
function ee(e, t, u) {
  return l(e, b(t, u));
}
var { min: C, PI: xe } = Math;
var pe = 0.275;
var V = xe + 1e-4;
function ce(e, t = {}) {
  let { size: u = 16, smoothing: x = 0.5, thinning: h = 0.5, simulatePressure: y = true, easing: n = (r) => r, start: f = {}, end: d = {}, last: D = false } = t, { cap: S = true, easing: j = (r) => r * (2 - r) } = f, { cap: q = true, easing: c = (r) => --r * r * r + 1 } = d;
  if (e.length === 0 || u <= 0) return [];
  let p = e[e.length - 1].runningLength, g = f.taper === false ? 0 : f.taper === true ? Math.max(u, p) : f.taper, T = d.taper === false ? 0 : d.taper === true ? Math.max(u, p) : d.taper, te = Math.pow(u * x, 2), _ = [], M = [], H = e.slice(0, 10).reduce((r, i) => {
    let o = i.pressure;
    if (y) {
      let s = C(1, i.distance / u), W = C(1, 1 - s);
      o = C(1, r + (W - r) * (s * pe));
    }
    return (r + o) / 2;
  }, e[0].pressure), m = $(u, h, e[e.length - 1].pressure, n), U, X = e[0].vector, z = e[0].point, F = z, O = z, E = F, J = false;
  for (let r = 0; r < e.length; r++) {
    let { pressure: i } = e[r], { point: o, vector: s, distance: W, runningLength: I } = e[r];
    if (r < e.length - 1 && p - I < 3) continue;
    if (h) {
      if (y) {
        let v = C(1, W / u), Z = C(1, 1 - v);
        i = C(1, H + (Z - H) * (v * pe));
      }
      m = $(u, h, i, n);
    } else m = u / 2;
    U === void 0 && (U = m);
    let le = I < g ? j(I / g) : 1, fe = p - I < T ? c((p - I) / T) : 1;
    m = Math.max(0.01, m * Math.min(le, fe));
    let re = (r < e.length - 1 ? e[r + 1] : e[r]).vector, Y = r < e.length - 1 ? B(s, re) : 1, be = B(s, X) < 0 && !J, ne = Y !== null && Y < 0;
    if (be || ne) {
      let v = b(R(X), m);
      for (let Z = 1 / 13, w = 0; w <= 1; w += Z) O = L(a(o, v), o, V * w), _.push(O), E = L(l(o, v), o, V * -w), M.push(E);
      z = O, F = E, ne && (J = true);
      continue;
    }
    if (J = false, r === e.length - 1) {
      let v = b(R(s), m);
      _.push(a(o, v)), M.push(l(o, v));
      continue;
    }
    let oe = b(R(K(re, s, Y)), m);
    O = a(o, oe), (r <= 1 || A(z, O) > te) && (_.push(O), z = O), E = l(o, oe), (r <= 1 || A(F, E) > te) && (M.push(E), F = E), H = i, X = s;
  }
  let P = e[0].point.slice(0, 2), k = e.length > 1 ? e[e.length - 1].point.slice(0, 2) : l(e[0].point, [1, 1]), Q = [], N = [];
  if (e.length === 1) {
    if (!(g || T) || D) {
      let r = ee(P, G(R(a(P, k))), -(U || m)), i = [];
      for (let o = 1 / 13, s = o; s <= 1; s += o) i.push(L(r, P, V * 2 * s));
      return i;
    }
  } else {
    if (!(g || T && e.length === 1)) if (S) for (let i = 1 / 13, o = i; o <= 1; o += i) {
      let s = L(M[0], P, V * o);
      Q.push(s);
    }
    else {
      let i = a(_[0], M[0]), o = b(i, 0.5), s = b(i, 0.51);
      Q.push(a(P, o), a(P, s), l(P, s), l(P, o));
    }
    let r = R(se(e[e.length - 1].vector));
    if (T || g && e.length === 1) N.push(k);
    else if (q) {
      let i = ee(k, r, m);
      for (let o = 1 / 29, s = o; s < 1; s += o) N.push(L(i, k, V * 3 * s));
    } else N.push(l(k, b(r, m)), l(k, b(r, m * 0.99)), a(k, b(r, m * 0.99)), a(k, b(r, m)));
  }
  return _.concat(N, M.reverse(), Q);
}
function me(e, t = {}) {
  var q;
  let { streamline: u = 0.5, size: x = 16, last: h = false } = t;
  if (e.length === 0) return [];
  let y = 0.15 + (1 - u) * 0.85, n = Array.isArray(e[0]) ? e : e.map(({ x: c, y: p, pressure: g = 0.5 }) => [c, p, g]);
  if (n.length === 2) {
    let c = n[1];
    n = n.slice(0, -1);
    for (let p = 1; p < 5; p++) n.push(K(n[0], c, p / 4));
  }
  n.length === 1 && (n = [...n, [...l(n[0], [1, 1]), ...n[0].slice(2)]]);
  let f = [{ point: [n[0][0], n[0][1]], pressure: n[0][2] >= 0 ? n[0][2] : 0.25, vector: [1, 1], distance: 0, runningLength: 0 }], d = false, D = 0, S = f[0], j = n.length - 1;
  for (let c = 1; c < n.length; c++) {
    let p = h && c === j ? n[c].slice(0, 2) : K(S.point, n[c], y);
    if (ue(S.point, p)) continue;
    let g = ie(p, S.point);
    if (D += g, c < j && !d) {
      if (D < x) continue;
      d = true;
    }
    S = { point: p, pressure: n[c][2] >= 0 ? n[c][2] : 0.5, vector: G(a(S.point, p)), distance: g, runningLength: D }, f.push(S);
  }
  return f[0].vector = ((q = f[1]) == null ? void 0 : q.vector) || [0, 0], f;
}
function ae(e, t = {}) {
  return ce(me(e, t), t);
}

// node_modules/@excalidraw/laser-pointer/dist/esm.js
function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, { get: v, set: s, enumerable: true, configurable: true });
}
var $94cfa2cfccc8cc22$exports = {};
$parcel$export($94cfa2cfccc8cc22$exports, "LaserPointer", () => $94cfa2cfccc8cc22$export$6531021b3bf36eae);
function $8cd7efb5af385306$export$e16d8520af44a096([ax, ay, ar], [bx, by, br]) {
  return [
    ax + bx,
    ay + by,
    ar + br
  ];
}
function $8cd7efb5af385306$export$f93b5905241a7cca([ax, ay, ar], [bx, by, br]) {
  return [
    ax - bx,
    ay - by,
    ar - br
  ];
}
function $8cd7efb5af385306$export$1c8884ee32bdf443([x, y, r], s) {
  return [
    x * s,
    y * s,
    r * s
  ];
}
function $8cd7efb5af385306$export$1991ecd29cc92c6b([x, y, r]) {
  return [
    x / Math.sqrt(x ** 2 + y ** 2),
    y / Math.sqrt(x ** 2 + y ** 2),
    r
  ];
}
function $8cd7efb5af385306$export$855df823ceb9b81b([x, y, r], rad) {
  return [
    Math.cos(rad) * x - Math.sin(rad) * y,
    Math.sin(rad) * x + Math.cos(rad) * y,
    r
  ];
}
function $8cd7efb5af385306$export$92d8e23769117a5e(a2, b2, t) {
  return $8cd7efb5af385306$export$e16d8520af44a096(a2, $8cd7efb5af385306$export$1c8884ee32bdf443($8cd7efb5af385306$export$f93b5905241a7cca(b2, a2), t));
}
function $8cd7efb5af385306$export$944b09d2ad10b378(p, p1, p2) {
  return Math.atan2(p2[1] - p[1], p2[0] - p[0]) - Math.atan2(p1[1] - p[1], p1[0] - p[0]);
}
function $8cd7efb5af385306$export$3c05aaf71f141f73(a2) {
  return Math.atan2(Math.sin(a2), Math.cos(a2));
}
function $8cd7efb5af385306$export$1b9bab504faa9305([x, y]) {
  return Math.sqrt(x ** 2 + y ** 2);
}
function $8cd7efb5af385306$export$6c4a311cc157c764([ax, ay], [bx, by]) {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}
function $8cd7efb5af385306$export$ccb1b4dfbd3f36a7(ps) {
  if (ps.length < 2) return 0;
  let len = 0;
  for (let i = 1; i <= ps.length - 1; i++) len += $8cd7efb5af385306$export$6c4a311cc157c764(ps[i - 1], ps[i]);
  len += $8cd7efb5af385306$export$6c4a311cc157c764(ps[ps.length - 2], ps[ps.length - 1]);
  return len;
}
var $8cd7efb5af385306$export$7d15b64cf5a3a4c4 = (v, min, max) => Math.max(min, Math.min(max, v));
function $8cd7efb5af385306$export$548cc43590159af6(p3, p1, p2) {
  const sMag = $8cd7efb5af385306$export$6c4a311cc157c764(p1, p2);
  if (sMag === 0) return $8cd7efb5af385306$export$6c4a311cc157c764(p3, p1);
  const u = $8cd7efb5af385306$export$7d15b64cf5a3a4c4(((p3[0] - p1[0]) * (p2[0] - p1[0]) + (p3[1] - p1[1]) * (p2[1] - p1[1])) / sMag ** 2, 0, 1);
  const pi = [
    p1[0] + u * (p2[0] - p1[0]),
    p1[1] + u * (p2[1] - p1[1]),
    p3[2]
  ];
  return $8cd7efb5af385306$export$6c4a311cc157c764(pi, p3);
}
function $34bab0059f842ce6$export$ef693d1572e64fb8(points, epsilon) {
  if (epsilon === 0) return points;
  if (points.length <= 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const [maxDistance, maxIndex] = points.reduce(([maxDistance2, maxIndex2], point, index) => {
    const distance3 = (0, $8cd7efb5af385306$export$548cc43590159af6)(point, first, last);
    return distance3 > maxDistance2 ? [
      distance3,
      index
    ] : [
      maxDistance2,
      maxIndex2
    ];
  }, [
    0,
    -1
  ]);
  if (maxDistance >= epsilon) {
    const maxIndexPoint = points[maxIndex];
    return [
      ...$34bab0059f842ce6$export$ef693d1572e64fb8([
        first,
        ...points.slice(1, maxIndex),
        maxIndexPoint
      ], epsilon).slice(0, -1),
      maxIndexPoint,
      ...$34bab0059f842ce6$export$ef693d1572e64fb8([
        maxIndexPoint,
        ...points.slice(maxIndex, -1),
        last
      ], epsilon).slice(1)
    ];
  } else return [
    first,
    last
  ];
}
var _$94cfa2cfccc8cc22$export$6531021b3bf36eae = class _$94cfa2cfccc8cc22$export$6531021b3bf36eae {
  constructor(options) {
    this.originalPoints = [];
    this.stablePoints = [];
    this.tailPoints = [];
    this.isFresh = true;
    this.options = Object.assign({}, _$94cfa2cfccc8cc22$export$6531021b3bf36eae.defaults, options);
  }
  get lastPoint() {
    return this.tailPoints[this.tailPoints.length - 1] ?? this.stablePoints[this.stablePoints.length - 1];
  }
  addPoint(point) {
    const lastPoint = this.originalPoints[this.originalPoints.length - 1];
    if (lastPoint && lastPoint[0] === point[0] && lastPoint[1] === point[1]) return;
    this.originalPoints.push(point);
    if (this.isFresh) {
      this.isFresh = false;
      this.stablePoints.push(point);
      return;
    }
    if (this.options.streamline > 0) point = $8cd7efb5af385306$export$92d8e23769117a5e(this.lastPoint, point, 1 - this.options.streamline);
    this.tailPoints.push(point);
    if ($8cd7efb5af385306$export$ccb1b4dfbd3f36a7(this.tailPoints) > _$94cfa2cfccc8cc22$export$6531021b3bf36eae.constants.maxTailLength) this.stabilizeTail();
  }
  close() {
    this.stabilizeTail();
  }
  stabilizeTail() {
    if (this.options.simplify > 0 && this.options.simplifyPhase == "tail") throw new Error("Not implemented yet");
    else {
      this.stablePoints.push(...this.tailPoints);
      this.tailPoints = [];
    }
  }
  getSize(sizeOverride, pressure, index, totalLength, runningLength) {
    return (sizeOverride ?? this.options.size) * this.options.sizeMapping({
      pressure,
      runningLength,
      currentIndex: index,
      totalLength
    });
  }
  getStrokeOutline(sizeOverride) {
    if (this.isFresh) return [];
    let points = [
      ...this.stablePoints,
      ...this.tailPoints
    ];
    if (this.options.simplify > 0 && this.options.simplifyPhase === "input") points = (0, $34bab0059f842ce6$export$ef693d1572e64fb8)(points, this.options.simplify);
    const len = points.length;
    if (len === 0) return [];
    if (len === 1) {
      const c = points[0];
      const size = this.getSize(sizeOverride, c[2], 0, len, 0);
      if (size < 0.5) return [];
      const ps = [];
      for (let theta = 0; theta <= Math.PI * 2; theta += Math.PI / 16) ps.push($8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$1c8884ee32bdf443($8cd7efb5af385306$export$855df823ceb9b81b([
        1,
        0,
        0
      ], theta), size)));
      ps.push($8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$1c8884ee32bdf443([
        1,
        0,
        0
      ], this.getSize(sizeOverride, c[2], 0, len, 0))));
      return ps;
    }
    if (len === 2) {
      const c = points[0];
      const n = points[1];
      const cSize = this.getSize(sizeOverride, c[2], 0, len, 0);
      const nSize = this.getSize(sizeOverride, n[2], 0, len, 0);
      if (cSize < 0.5 || nSize < 0.5) return [];
      const ps = [];
      const pAngle = $8cd7efb5af385306$export$944b09d2ad10b378(c, [
        c[0],
        c[1] - 100,
        c[2]
      ], n);
      for (let theta = pAngle; theta <= Math.PI + pAngle; theta += Math.PI / 16) ps.push($8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$1c8884ee32bdf443($8cd7efb5af385306$export$855df823ceb9b81b([
        1,
        0,
        0
      ], theta), cSize)));
      for (let theta = Math.PI + pAngle; theta <= Math.PI * 2 + pAngle; theta += Math.PI / 16) ps.push($8cd7efb5af385306$export$e16d8520af44a096(n, $8cd7efb5af385306$export$1c8884ee32bdf443($8cd7efb5af385306$export$855df823ceb9b81b([
        1,
        0,
        0
      ], theta), nSize)));
      ps.push(ps[0]);
      return ps;
    }
    const forwardPoints = [];
    const backwardPoints = [];
    let speed = 0;
    let prevSpeed = 0;
    let visibleStartIndex = 0;
    let runningLength = 0;
    for (let i = 1; i < len - 1; i++) {
      const p = points[i - 1], c = points[i], n = points[i + 1];
      let pressure = c[2];
      const d = $8cd7efb5af385306$export$6c4a311cc157c764(p, c);
      runningLength += d;
      speed = prevSpeed + (d - prevSpeed) * 0.2;
      const cSize = this.getSize(sizeOverride, pressure, i, len, runningLength);
      if (cSize === 0) {
        visibleStartIndex = i + 1;
        continue;
      }
      const dirPC = $8cd7efb5af385306$export$1991ecd29cc92c6b($8cd7efb5af385306$export$f93b5905241a7cca(p, c));
      const dirNC = $8cd7efb5af385306$export$1991ecd29cc92c6b($8cd7efb5af385306$export$f93b5905241a7cca(n, c));
      const p1dirPC = $8cd7efb5af385306$export$855df823ceb9b81b(dirPC, Math.PI / 2);
      const p2dirPC = $8cd7efb5af385306$export$855df823ceb9b81b(dirPC, -Math.PI / 2);
      const p1dirNC = $8cd7efb5af385306$export$855df823ceb9b81b(dirNC, Math.PI / 2);
      const p2dirNC = $8cd7efb5af385306$export$855df823ceb9b81b(dirNC, -Math.PI / 2);
      const p1PC = $8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$1c8884ee32bdf443(p1dirPC, cSize));
      const p2PC = $8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$1c8884ee32bdf443(p2dirPC, cSize));
      const p1NC = $8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$1c8884ee32bdf443(p1dirNC, cSize));
      const p2NC = $8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$1c8884ee32bdf443(p2dirNC, cSize));
      const ftdir = $8cd7efb5af385306$export$e16d8520af44a096(p1dirPC, p2dirNC);
      const btdir = $8cd7efb5af385306$export$e16d8520af44a096(p2dirPC, p1dirNC);
      const paPC = $8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$1c8884ee32bdf443($8cd7efb5af385306$export$1b9bab504faa9305(ftdir) === 0 ? dirPC : $8cd7efb5af385306$export$1991ecd29cc92c6b(ftdir), cSize));
      const paNC = $8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$1c8884ee32bdf443($8cd7efb5af385306$export$1b9bab504faa9305(btdir) === 0 ? dirNC : $8cd7efb5af385306$export$1991ecd29cc92c6b(btdir), cSize));
      const cAngle = $8cd7efb5af385306$export$3c05aaf71f141f73($8cd7efb5af385306$export$944b09d2ad10b378(c, p, n));
      const D_ANGLE = _$94cfa2cfccc8cc22$export$6531021b3bf36eae.constants.cornerDetectionMaxAngle / 180 * Math.PI * _$94cfa2cfccc8cc22$export$6531021b3bf36eae.constants.cornerDetectionVariance(speed);
      if (Math.abs(cAngle) < D_ANGLE) {
        const tAngle = Math.abs($8cd7efb5af385306$export$3c05aaf71f141f73(Math.PI - cAngle));
        if (tAngle === 0) continue;
        if (cAngle < 0) {
          backwardPoints.push(p2PC, paNC);
          for (let theta = 0; theta <= tAngle; theta += tAngle / 4) forwardPoints.push($8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$855df823ceb9b81b($8cd7efb5af385306$export$1c8884ee32bdf443(p1dirPC, cSize), theta)));
          for (let theta = tAngle; theta >= 0; theta -= tAngle / 4) backwardPoints.push($8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$855df823ceb9b81b($8cd7efb5af385306$export$1c8884ee32bdf443(p1dirPC, cSize), theta)));
          backwardPoints.push(paNC, p1NC);
        } else {
          forwardPoints.push(p1PC, paPC);
          for (let theta = 0; theta <= tAngle; theta += tAngle / 4) backwardPoints.push($8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$855df823ceb9b81b($8cd7efb5af385306$export$1c8884ee32bdf443(p1dirPC, -cSize), -theta)));
          for (let theta = tAngle; theta >= 0; theta -= tAngle / 4) forwardPoints.push($8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$855df823ceb9b81b($8cd7efb5af385306$export$1c8884ee32bdf443(p1dirPC, -cSize), -theta)));
          forwardPoints.push(paPC, p2NC);
        }
      } else {
        forwardPoints.push(paPC);
        backwardPoints.push(paNC);
      }
      prevSpeed = speed;
    }
    if (visibleStartIndex >= len - 2) {
      if (this.options.keepHead) {
        const c = points[len - 1];
        const ps = [];
        for (let theta = 0; theta <= Math.PI * 2; theta += Math.PI / 16) ps.push($8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$1c8884ee32bdf443($8cd7efb5af385306$export$855df823ceb9b81b([
          1,
          0,
          0
        ], theta), this.options.size)));
        ps.push($8cd7efb5af385306$export$e16d8520af44a096(c, $8cd7efb5af385306$export$1c8884ee32bdf443([
          1,
          0,
          0
        ], this.options.size)));
        return ps;
      } else return [];
    }
    const first = points[visibleStartIndex];
    const second = points[visibleStartIndex + 1];
    const penultimate = points[len - 2];
    const ultimate = points[len - 1];
    const dirFS = $8cd7efb5af385306$export$1991ecd29cc92c6b($8cd7efb5af385306$export$f93b5905241a7cca(second, first));
    const dirPU = $8cd7efb5af385306$export$1991ecd29cc92c6b($8cd7efb5af385306$export$f93b5905241a7cca(penultimate, ultimate));
    const ppdirFS = $8cd7efb5af385306$export$855df823ceb9b81b(dirFS, -Math.PI / 2);
    const ppdirPU = $8cd7efb5af385306$export$855df823ceb9b81b(dirPU, Math.PI / 2);
    const startCapSize = this.getSize(sizeOverride, first[2], 0, len, 0);
    const startCap = [];
    const endCapSize = this.options.keepHead ? this.options.size : this.getSize(sizeOverride, penultimate[2], len - 2, len, runningLength);
    const endCap = [];
    if (startCapSize > 1) {
      for (let theta = 0; theta <= Math.PI; theta += Math.PI / 16) startCap.unshift($8cd7efb5af385306$export$e16d8520af44a096(first, $8cd7efb5af385306$export$855df823ceb9b81b($8cd7efb5af385306$export$1c8884ee32bdf443(ppdirFS, startCapSize), -theta)));
      startCap.unshift($8cd7efb5af385306$export$e16d8520af44a096(first, $8cd7efb5af385306$export$1c8884ee32bdf443(ppdirFS, -startCapSize)));
    } else startCap.push(first);
    for (let theta = 0; theta <= Math.PI * 3; theta += Math.PI / 16) endCap.push($8cd7efb5af385306$export$e16d8520af44a096(ultimate, $8cd7efb5af385306$export$855df823ceb9b81b($8cd7efb5af385306$export$1c8884ee32bdf443(ppdirPU, -endCapSize), -theta)));
    const strokeOutline = [
      ...startCap,
      ...forwardPoints,
      ...endCap.reverse(),
      ...backwardPoints.reverse()
    ];
    if (startCap.length > 0) strokeOutline.push(startCap[0]);
    if (this.options.simplify > 0 && this.options.simplifyPhase === "output") return (0, $34bab0059f842ce6$export$ef693d1572e64fb8)(strokeOutline, this.options.simplify);
    return strokeOutline;
  }
};
_$94cfa2cfccc8cc22$export$6531021b3bf36eae.defaults = {
  size: 2,
  streamline: 0.45,
  simplify: 0.1,
  simplifyPhase: "output",
  keepHead: false,
  sizeMapping: () => 1
};
_$94cfa2cfccc8cc22$export$6531021b3bf36eae.constants = {
  cornerDetectionMaxAngle: 75,
  cornerDetectionVariance: (s) => s > 35 ? 0.5 : 1,
  maxTailLength: 50
};
var $94cfa2cfccc8cc22$export$6531021b3bf36eae = _$94cfa2cfccc8cc22$export$6531021b3bf36eae;

// node_modules/tinycolor2/esm/tinycolor.js
function _typeof(obj) {
  "@babel/helpers - typeof";
  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(obj2) {
    return typeof obj2;
  } : function(obj2) {
    return obj2 && "function" == typeof Symbol && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
  }, _typeof(obj);
}
var trimLeft = /^\s+/;
var trimRight = /\s+$/;
function tinycolor(color, opts) {
  color = color ? color : "";
  opts = opts || {};
  if (color instanceof tinycolor) {
    return color;
  }
  if (!(this instanceof tinycolor)) {
    return new tinycolor(color, opts);
  }
  var rgb = inputToRGB(color);
  this._originalInput = color, this._r = rgb.r, this._g = rgb.g, this._b = rgb.b, this._a = rgb.a, this._roundA = Math.round(100 * this._a) / 100, this._format = opts.format || rgb.format;
  this._gradientType = opts.gradientType;
  if (this._r < 1) this._r = Math.round(this._r);
  if (this._g < 1) this._g = Math.round(this._g);
  if (this._b < 1) this._b = Math.round(this._b);
  this._ok = rgb.ok;
}
tinycolor.prototype = {
  isDark: function isDark() {
    return this.getBrightness() < 128;
  },
  isLight: function isLight() {
    return !this.isDark();
  },
  isValid: function isValid() {
    return this._ok;
  },
  getOriginalInput: function getOriginalInput() {
    return this._originalInput;
  },
  getFormat: function getFormat() {
    return this._format;
  },
  getAlpha: function getAlpha() {
    return this._a;
  },
  getBrightness: function getBrightness() {
    var rgb = this.toRgb();
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1e3;
  },
  getLuminance: function getLuminance() {
    var rgb = this.toRgb();
    var RsRGB, GsRGB, BsRGB, R2, G2, B2;
    RsRGB = rgb.r / 255;
    GsRGB = rgb.g / 255;
    BsRGB = rgb.b / 255;
    if (RsRGB <= 0.03928) R2 = RsRGB / 12.92;
    else R2 = Math.pow((RsRGB + 0.055) / 1.055, 2.4);
    if (GsRGB <= 0.03928) G2 = GsRGB / 12.92;
    else G2 = Math.pow((GsRGB + 0.055) / 1.055, 2.4);
    if (BsRGB <= 0.03928) B2 = BsRGB / 12.92;
    else B2 = Math.pow((BsRGB + 0.055) / 1.055, 2.4);
    return 0.2126 * R2 + 0.7152 * G2 + 0.0722 * B2;
  },
  setAlpha: function setAlpha(value) {
    this._a = boundAlpha(value);
    this._roundA = Math.round(100 * this._a) / 100;
    return this;
  },
  toHsv: function toHsv() {
    var hsv = rgbToHsv(this._r, this._g, this._b);
    return {
      h: hsv.h * 360,
      s: hsv.s,
      v: hsv.v,
      a: this._a
    };
  },
  toHsvString: function toHsvString() {
    var hsv = rgbToHsv(this._r, this._g, this._b);
    var h = Math.round(hsv.h * 360), s = Math.round(hsv.s * 100), v = Math.round(hsv.v * 100);
    return this._a == 1 ? "hsv(" + h + ", " + s + "%, " + v + "%)" : "hsva(" + h + ", " + s + "%, " + v + "%, " + this._roundA + ")";
  },
  toHsl: function toHsl() {
    var hsl = rgbToHsl(this._r, this._g, this._b);
    return {
      h: hsl.h * 360,
      s: hsl.s,
      l: hsl.l,
      a: this._a
    };
  },
  toHslString: function toHslString() {
    var hsl = rgbToHsl(this._r, this._g, this._b);
    var h = Math.round(hsl.h * 360), s = Math.round(hsl.s * 100), l2 = Math.round(hsl.l * 100);
    return this._a == 1 ? "hsl(" + h + ", " + s + "%, " + l2 + "%)" : "hsla(" + h + ", " + s + "%, " + l2 + "%, " + this._roundA + ")";
  },
  toHex: function toHex(allow3Char) {
    return rgbToHex(this._r, this._g, this._b, allow3Char);
  },
  toHexString: function toHexString(allow3Char) {
    return "#" + this.toHex(allow3Char);
  },
  toHex8: function toHex8(allow4Char) {
    return rgbaToHex(this._r, this._g, this._b, this._a, allow4Char);
  },
  toHex8String: function toHex8String(allow4Char) {
    return "#" + this.toHex8(allow4Char);
  },
  toRgb: function toRgb() {
    return {
      r: Math.round(this._r),
      g: Math.round(this._g),
      b: Math.round(this._b),
      a: this._a
    };
  },
  toRgbString: function toRgbString() {
    return this._a == 1 ? "rgb(" + Math.round(this._r) + ", " + Math.round(this._g) + ", " + Math.round(this._b) + ")" : "rgba(" + Math.round(this._r) + ", " + Math.round(this._g) + ", " + Math.round(this._b) + ", " + this._roundA + ")";
  },
  toPercentageRgb: function toPercentageRgb() {
    return {
      r: Math.round(bound01(this._r, 255) * 100) + "%",
      g: Math.round(bound01(this._g, 255) * 100) + "%",
      b: Math.round(bound01(this._b, 255) * 100) + "%",
      a: this._a
    };
  },
  toPercentageRgbString: function toPercentageRgbString() {
    return this._a == 1 ? "rgb(" + Math.round(bound01(this._r, 255) * 100) + "%, " + Math.round(bound01(this._g, 255) * 100) + "%, " + Math.round(bound01(this._b, 255) * 100) + "%)" : "rgba(" + Math.round(bound01(this._r, 255) * 100) + "%, " + Math.round(bound01(this._g, 255) * 100) + "%, " + Math.round(bound01(this._b, 255) * 100) + "%, " + this._roundA + ")";
  },
  toName: function toName() {
    if (this._a === 0) {
      return "transparent";
    }
    if (this._a < 1) {
      return false;
    }
    return hexNames[rgbToHex(this._r, this._g, this._b, true)] || false;
  },
  toFilter: function toFilter(secondColor) {
    var hex8String = "#" + rgbaToArgbHex(this._r, this._g, this._b, this._a);
    var secondHex8String = hex8String;
    var gradientType = this._gradientType ? "GradientType = 1, " : "";
    if (secondColor) {
      var s = tinycolor(secondColor);
      secondHex8String = "#" + rgbaToArgbHex(s._r, s._g, s._b, s._a);
    }
    return "progid:DXImageTransform.Microsoft.gradient(" + gradientType + "startColorstr=" + hex8String + ",endColorstr=" + secondHex8String + ")";
  },
  toString: function toString(format) {
    var formatSet = !!format;
    format = format || this._format;
    var formattedString = false;
    var hasAlpha = this._a < 1 && this._a >= 0;
    var needsAlphaFormat = !formatSet && hasAlpha && (format === "hex" || format === "hex6" || format === "hex3" || format === "hex4" || format === "hex8" || format === "name");
    if (needsAlphaFormat) {
      if (format === "name" && this._a === 0) {
        return this.toName();
      }
      return this.toRgbString();
    }
    if (format === "rgb") {
      formattedString = this.toRgbString();
    }
    if (format === "prgb") {
      formattedString = this.toPercentageRgbString();
    }
    if (format === "hex" || format === "hex6") {
      formattedString = this.toHexString();
    }
    if (format === "hex3") {
      formattedString = this.toHexString(true);
    }
    if (format === "hex4") {
      formattedString = this.toHex8String(true);
    }
    if (format === "hex8") {
      formattedString = this.toHex8String();
    }
    if (format === "name") {
      formattedString = this.toName();
    }
    if (format === "hsl") {
      formattedString = this.toHslString();
    }
    if (format === "hsv") {
      formattedString = this.toHsvString();
    }
    return formattedString || this.toHexString();
  },
  clone: function clone2() {
    return tinycolor(this.toString());
  },
  _applyModification: function _applyModification(fn, args) {
    var color = fn.apply(null, [this].concat([].slice.call(args)));
    this._r = color._r;
    this._g = color._g;
    this._b = color._b;
    this.setAlpha(color._a);
    return this;
  },
  lighten: function lighten() {
    return this._applyModification(_lighten, arguments);
  },
  brighten: function brighten() {
    return this._applyModification(_brighten, arguments);
  },
  darken: function darken() {
    return this._applyModification(_darken, arguments);
  },
  desaturate: function desaturate() {
    return this._applyModification(_desaturate, arguments);
  },
  saturate: function saturate() {
    return this._applyModification(_saturate, arguments);
  },
  greyscale: function greyscale() {
    return this._applyModification(_greyscale, arguments);
  },
  spin: function spin() {
    return this._applyModification(_spin, arguments);
  },
  _applyCombination: function _applyCombination(fn, args) {
    return fn.apply(null, [this].concat([].slice.call(args)));
  },
  analogous: function analogous() {
    return this._applyCombination(_analogous, arguments);
  },
  complement: function complement() {
    return this._applyCombination(_complement, arguments);
  },
  monochromatic: function monochromatic() {
    return this._applyCombination(_monochromatic, arguments);
  },
  splitcomplement: function splitcomplement() {
    return this._applyCombination(_splitcomplement, arguments);
  },
  // Disabled until https://github.com/bgrins/TinyColor/issues/254
  // polyad: function (number) {
  //   return this._applyCombination(polyad, [number]);
  // },
  triad: function triad() {
    return this._applyCombination(polyad, [3]);
  },
  tetrad: function tetrad() {
    return this._applyCombination(polyad, [4]);
  }
};
tinycolor.fromRatio = function(color, opts) {
  if (_typeof(color) == "object") {
    var newColor = {};
    for (var i in color) {
      if (color.hasOwnProperty(i)) {
        if (i === "a") {
          newColor[i] = color[i];
        } else {
          newColor[i] = convertToPercentage(color[i]);
        }
      }
    }
    color = newColor;
  }
  return tinycolor(color, opts);
};
function inputToRGB(color) {
  var rgb = {
    r: 0,
    g: 0,
    b: 0
  };
  var a2 = 1;
  var s = null;
  var v = null;
  var l2 = null;
  var ok = false;
  var format = false;
  if (typeof color == "string") {
    color = stringInputToObject(color);
  }
  if (_typeof(color) == "object") {
    if (isValidCSSUnit(color.r) && isValidCSSUnit(color.g) && isValidCSSUnit(color.b)) {
      rgb = rgbToRgb(color.r, color.g, color.b);
      ok = true;
      format = String(color.r).substr(-1) === "%" ? "prgb" : "rgb";
    } else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.v)) {
      s = convertToPercentage(color.s);
      v = convertToPercentage(color.v);
      rgb = hsvToRgb(color.h, s, v);
      ok = true;
      format = "hsv";
    } else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.l)) {
      s = convertToPercentage(color.s);
      l2 = convertToPercentage(color.l);
      rgb = hslToRgb(color.h, s, l2);
      ok = true;
      format = "hsl";
    }
    if (color.hasOwnProperty("a")) {
      a2 = color.a;
    }
  }
  a2 = boundAlpha(a2);
  return {
    ok,
    format: color.format || format,
    r: Math.min(255, Math.max(rgb.r, 0)),
    g: Math.min(255, Math.max(rgb.g, 0)),
    b: Math.min(255, Math.max(rgb.b, 0)),
    a: a2
  };
}
function rgbToRgb(r, g, b2) {
  return {
    r: bound01(r, 255) * 255,
    g: bound01(g, 255) * 255,
    b: bound01(b2, 255) * 255
  };
}
function rgbToHsl(r, g, b2) {
  r = bound01(r, 255);
  g = bound01(g, 255);
  b2 = bound01(b2, 255);
  var max = Math.max(r, g, b2), min = Math.min(r, g, b2);
  var h, s, l2 = (max + min) / 2;
  if (max == min) {
    h = s = 0;
  } else {
    var d = max - min;
    s = l2 > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b2) / d + (g < b2 ? 6 : 0);
        break;
      case g:
        h = (b2 - r) / d + 2;
        break;
      case b2:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h,
    s,
    l: l2
  };
}
function hslToRgb(h, s, l2) {
  var r, g, b2;
  h = bound01(h, 360);
  s = bound01(s, 100);
  l2 = bound01(l2, 100);
  function hue2rgb(p2, q2, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
    if (t < 1 / 2) return q2;
    if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
    return p2;
  }
  if (s === 0) {
    r = g = b2 = l2;
  } else {
    var q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s;
    var p = 2 * l2 - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: r * 255,
    g: g * 255,
    b: b2 * 255
  };
}
function rgbToHsv(r, g, b2) {
  r = bound01(r, 255);
  g = bound01(g, 255);
  b2 = bound01(b2, 255);
  var max = Math.max(r, g, b2), min = Math.min(r, g, b2);
  var h, s, v = max;
  var d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max == min) {
    h = 0;
  } else {
    switch (max) {
      case r:
        h = (g - b2) / d + (g < b2 ? 6 : 0);
        break;
      case g:
        h = (b2 - r) / d + 2;
        break;
      case b2:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h,
    s,
    v
  };
}
function hsvToRgb(h, s, v) {
  h = bound01(h, 360) * 6;
  s = bound01(s, 100);
  v = bound01(v, 100);
  var i = Math.floor(h), f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s), mod = i % 6, r = [v, q, p, p, t, v][mod], g = [t, v, v, q, p, p][mod], b2 = [p, p, t, v, v, q][mod];
  return {
    r: r * 255,
    g: g * 255,
    b: b2 * 255
  };
}
function rgbToHex(r, g, b2, allow3Char) {
  var hex = [pad2(Math.round(r).toString(16)), pad2(Math.round(g).toString(16)), pad2(Math.round(b2).toString(16))];
  if (allow3Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1)) {
    return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0);
  }
  return hex.join("");
}
function rgbaToHex(r, g, b2, a2, allow4Char) {
  var hex = [pad2(Math.round(r).toString(16)), pad2(Math.round(g).toString(16)), pad2(Math.round(b2).toString(16)), pad2(convertDecimalToHex(a2))];
  if (allow4Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1) && hex[3].charAt(0) == hex[3].charAt(1)) {
    return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0) + hex[3].charAt(0);
  }
  return hex.join("");
}
function rgbaToArgbHex(r, g, b2, a2) {
  var hex = [pad2(convertDecimalToHex(a2)), pad2(Math.round(r).toString(16)), pad2(Math.round(g).toString(16)), pad2(Math.round(b2).toString(16))];
  return hex.join("");
}
tinycolor.equals = function(color1, color2) {
  if (!color1 || !color2) return false;
  return tinycolor(color1).toRgbString() == tinycolor(color2).toRgbString();
};
tinycolor.random = function() {
  return tinycolor.fromRatio({
    r: Math.random(),
    g: Math.random(),
    b: Math.random()
  });
};
function _desaturate(color, amount) {
  amount = amount === 0 ? 0 : amount || 10;
  var hsl = tinycolor(color).toHsl();
  hsl.s -= amount / 100;
  hsl.s = clamp01(hsl.s);
  return tinycolor(hsl);
}
function _saturate(color, amount) {
  amount = amount === 0 ? 0 : amount || 10;
  var hsl = tinycolor(color).toHsl();
  hsl.s += amount / 100;
  hsl.s = clamp01(hsl.s);
  return tinycolor(hsl);
}
function _greyscale(color) {
  return tinycolor(color).desaturate(100);
}
function _lighten(color, amount) {
  amount = amount === 0 ? 0 : amount || 10;
  var hsl = tinycolor(color).toHsl();
  hsl.l += amount / 100;
  hsl.l = clamp01(hsl.l);
  return tinycolor(hsl);
}
function _brighten(color, amount) {
  amount = amount === 0 ? 0 : amount || 10;
  var rgb = tinycolor(color).toRgb();
  rgb.r = Math.max(0, Math.min(255, rgb.r - Math.round(255 * -(amount / 100))));
  rgb.g = Math.max(0, Math.min(255, rgb.g - Math.round(255 * -(amount / 100))));
  rgb.b = Math.max(0, Math.min(255, rgb.b - Math.round(255 * -(amount / 100))));
  return tinycolor(rgb);
}
function _darken(color, amount) {
  amount = amount === 0 ? 0 : amount || 10;
  var hsl = tinycolor(color).toHsl();
  hsl.l -= amount / 100;
  hsl.l = clamp01(hsl.l);
  return tinycolor(hsl);
}
function _spin(color, amount) {
  var hsl = tinycolor(color).toHsl();
  var hue = (hsl.h + amount) % 360;
  hsl.h = hue < 0 ? 360 + hue : hue;
  return tinycolor(hsl);
}
function _complement(color) {
  var hsl = tinycolor(color).toHsl();
  hsl.h = (hsl.h + 180) % 360;
  return tinycolor(hsl);
}
function polyad(color, number) {
  if (isNaN(number) || number <= 0) {
    throw new Error("Argument to polyad must be a positive number");
  }
  var hsl = tinycolor(color).toHsl();
  var result = [tinycolor(color)];
  var step = 360 / number;
  for (var i = 1; i < number; i++) {
    result.push(tinycolor({
      h: (hsl.h + i * step) % 360,
      s: hsl.s,
      l: hsl.l
    }));
  }
  return result;
}
function _splitcomplement(color) {
  var hsl = tinycolor(color).toHsl();
  var h = hsl.h;
  return [tinycolor(color), tinycolor({
    h: (h + 72) % 360,
    s: hsl.s,
    l: hsl.l
  }), tinycolor({
    h: (h + 216) % 360,
    s: hsl.s,
    l: hsl.l
  })];
}
function _analogous(color, results, slices) {
  results = results || 6;
  slices = slices || 30;
  var hsl = tinycolor(color).toHsl();
  var part = 360 / slices;
  var ret = [tinycolor(color)];
  for (hsl.h = (hsl.h - (part * results >> 1) + 720) % 360; --results; ) {
    hsl.h = (hsl.h + part) % 360;
    ret.push(tinycolor(hsl));
  }
  return ret;
}
function _monochromatic(color, results) {
  results = results || 6;
  var hsv = tinycolor(color).toHsv();
  var h = hsv.h, s = hsv.s, v = hsv.v;
  var ret = [];
  var modification = 1 / results;
  while (results--) {
    ret.push(tinycolor({
      h,
      s,
      v
    }));
    v = (v + modification) % 1;
  }
  return ret;
}
tinycolor.mix = function(color1, color2, amount) {
  amount = amount === 0 ? 0 : amount || 50;
  var rgb1 = tinycolor(color1).toRgb();
  var rgb2 = tinycolor(color2).toRgb();
  var p = amount / 100;
  var rgba = {
    r: (rgb2.r - rgb1.r) * p + rgb1.r,
    g: (rgb2.g - rgb1.g) * p + rgb1.g,
    b: (rgb2.b - rgb1.b) * p + rgb1.b,
    a: (rgb2.a - rgb1.a) * p + rgb1.a
  };
  return tinycolor(rgba);
};
tinycolor.readability = function(color1, color2) {
  var c1 = tinycolor(color1);
  var c2 = tinycolor(color2);
  return (Math.max(c1.getLuminance(), c2.getLuminance()) + 0.05) / (Math.min(c1.getLuminance(), c2.getLuminance()) + 0.05);
};
tinycolor.isReadable = function(color1, color2, wcag2) {
  var readability = tinycolor.readability(color1, color2);
  var wcag2Parms, out;
  out = false;
  wcag2Parms = validateWCAG2Parms(wcag2);
  switch (wcag2Parms.level + wcag2Parms.size) {
    case "AAsmall":
    case "AAAlarge":
      out = readability >= 4.5;
      break;
    case "AAlarge":
      out = readability >= 3;
      break;
    case "AAAsmall":
      out = readability >= 7;
      break;
  }
  return out;
};
tinycolor.mostReadable = function(baseColor, colorList, args) {
  var bestColor = null;
  var bestScore = 0;
  var readability;
  var includeFallbackColors, level, size;
  args = args || {};
  includeFallbackColors = args.includeFallbackColors;
  level = args.level;
  size = args.size;
  for (var i = 0; i < colorList.length; i++) {
    readability = tinycolor.readability(baseColor, colorList[i]);
    if (readability > bestScore) {
      bestScore = readability;
      bestColor = tinycolor(colorList[i]);
    }
  }
  if (tinycolor.isReadable(baseColor, bestColor, {
    level,
    size
  }) || !includeFallbackColors) {
    return bestColor;
  } else {
    args.includeFallbackColors = false;
    return tinycolor.mostReadable(baseColor, ["#fff", "#000"], args);
  }
};
var names = tinycolor.names = {
  aliceblue: "f0f8ff",
  antiquewhite: "faebd7",
  aqua: "0ff",
  aquamarine: "7fffd4",
  azure: "f0ffff",
  beige: "f5f5dc",
  bisque: "ffe4c4",
  black: "000",
  blanchedalmond: "ffebcd",
  blue: "00f",
  blueviolet: "8a2be2",
  brown: "a52a2a",
  burlywood: "deb887",
  burntsienna: "ea7e5d",
  cadetblue: "5f9ea0",
  chartreuse: "7fff00",
  chocolate: "d2691e",
  coral: "ff7f50",
  cornflowerblue: "6495ed",
  cornsilk: "fff8dc",
  crimson: "dc143c",
  cyan: "0ff",
  darkblue: "00008b",
  darkcyan: "008b8b",
  darkgoldenrod: "b8860b",
  darkgray: "a9a9a9",
  darkgreen: "006400",
  darkgrey: "a9a9a9",
  darkkhaki: "bdb76b",
  darkmagenta: "8b008b",
  darkolivegreen: "556b2f",
  darkorange: "ff8c00",
  darkorchid: "9932cc",
  darkred: "8b0000",
  darksalmon: "e9967a",
  darkseagreen: "8fbc8f",
  darkslateblue: "483d8b",
  darkslategray: "2f4f4f",
  darkslategrey: "2f4f4f",
  darkturquoise: "00ced1",
  darkviolet: "9400d3",
  deeppink: "ff1493",
  deepskyblue: "00bfff",
  dimgray: "696969",
  dimgrey: "696969",
  dodgerblue: "1e90ff",
  firebrick: "b22222",
  floralwhite: "fffaf0",
  forestgreen: "228b22",
  fuchsia: "f0f",
  gainsboro: "dcdcdc",
  ghostwhite: "f8f8ff",
  gold: "ffd700",
  goldenrod: "daa520",
  gray: "808080",
  green: "008000",
  greenyellow: "adff2f",
  grey: "808080",
  honeydew: "f0fff0",
  hotpink: "ff69b4",
  indianred: "cd5c5c",
  indigo: "4b0082",
  ivory: "fffff0",
  khaki: "f0e68c",
  lavender: "e6e6fa",
  lavenderblush: "fff0f5",
  lawngreen: "7cfc00",
  lemonchiffon: "fffacd",
  lightblue: "add8e6",
  lightcoral: "f08080",
  lightcyan: "e0ffff",
  lightgoldenrodyellow: "fafad2",
  lightgray: "d3d3d3",
  lightgreen: "90ee90",
  lightgrey: "d3d3d3",
  lightpink: "ffb6c1",
  lightsalmon: "ffa07a",
  lightseagreen: "20b2aa",
  lightskyblue: "87cefa",
  lightslategray: "789",
  lightslategrey: "789",
  lightsteelblue: "b0c4de",
  lightyellow: "ffffe0",
  lime: "0f0",
  limegreen: "32cd32",
  linen: "faf0e6",
  magenta: "f0f",
  maroon: "800000",
  mediumaquamarine: "66cdaa",
  mediumblue: "0000cd",
  mediumorchid: "ba55d3",
  mediumpurple: "9370db",
  mediumseagreen: "3cb371",
  mediumslateblue: "7b68ee",
  mediumspringgreen: "00fa9a",
  mediumturquoise: "48d1cc",
  mediumvioletred: "c71585",
  midnightblue: "191970",
  mintcream: "f5fffa",
  mistyrose: "ffe4e1",
  moccasin: "ffe4b5",
  navajowhite: "ffdead",
  navy: "000080",
  oldlace: "fdf5e6",
  olive: "808000",
  olivedrab: "6b8e23",
  orange: "ffa500",
  orangered: "ff4500",
  orchid: "da70d6",
  palegoldenrod: "eee8aa",
  palegreen: "98fb98",
  paleturquoise: "afeeee",
  palevioletred: "db7093",
  papayawhip: "ffefd5",
  peachpuff: "ffdab9",
  peru: "cd853f",
  pink: "ffc0cb",
  plum: "dda0dd",
  powderblue: "b0e0e6",
  purple: "800080",
  rebeccapurple: "663399",
  red: "f00",
  rosybrown: "bc8f8f",
  royalblue: "4169e1",
  saddlebrown: "8b4513",
  salmon: "fa8072",
  sandybrown: "f4a460",
  seagreen: "2e8b57",
  seashell: "fff5ee",
  sienna: "a0522d",
  silver: "c0c0c0",
  skyblue: "87ceeb",
  slateblue: "6a5acd",
  slategray: "708090",
  slategrey: "708090",
  snow: "fffafa",
  springgreen: "00ff7f",
  steelblue: "4682b4",
  tan: "d2b48c",
  teal: "008080",
  thistle: "d8bfd8",
  tomato: "ff6347",
  turquoise: "40e0d0",
  violet: "ee82ee",
  wheat: "f5deb3",
  white: "fff",
  whitesmoke: "f5f5f5",
  yellow: "ff0",
  yellowgreen: "9acd32"
};
var hexNames = tinycolor.hexNames = flip(names);
function flip(o) {
  var flipped = {};
  for (var i in o) {
    if (o.hasOwnProperty(i)) {
      flipped[o[i]] = i;
    }
  }
  return flipped;
}
function boundAlpha(a2) {
  a2 = parseFloat(a2);
  if (isNaN(a2) || a2 < 0 || a2 > 1) {
    a2 = 1;
  }
  return a2;
}
function bound01(n, max) {
  if (isOnePointZero(n)) n = "100%";
  var processPercent = isPercentage(n);
  n = Math.min(max, Math.max(0, parseFloat(n)));
  if (processPercent) {
    n = parseInt(n * max, 10) / 100;
  }
  if (Math.abs(n - max) < 1e-6) {
    return 1;
  }
  return n % max / parseFloat(max);
}
function clamp01(val) {
  return Math.min(1, Math.max(0, val));
}
function parseIntFromHex(val) {
  return parseInt(val, 16);
}
function isOnePointZero(n) {
  return typeof n == "string" && n.indexOf(".") != -1 && parseFloat(n) === 1;
}
function isPercentage(n) {
  return typeof n === "string" && n.indexOf("%") != -1;
}
function pad2(c) {
  return c.length == 1 ? "0" + c : "" + c;
}
function convertToPercentage(n) {
  if (n <= 1) {
    n = n * 100 + "%";
  }
  return n;
}
function convertDecimalToHex(d) {
  return Math.round(parseFloat(d) * 255).toString(16);
}
function convertHexToDecimal(h) {
  return parseIntFromHex(h) / 255;
}
var matchers = (function() {
  var CSS_INTEGER = "[-\\+]?\\d+%?";
  var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";
  var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";
  var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
  var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
  return {
    CSS_UNIT: new RegExp(CSS_UNIT),
    rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
    rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
    hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
    hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
    hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
    hsva: new RegExp("hsva" + PERMISSIVE_MATCH4),
    hex3: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
    hex6: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
    hex4: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
    hex8: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
  };
})();
function isValidCSSUnit(color) {
  return !!matchers.CSS_UNIT.exec(color);
}
function stringInputToObject(color) {
  color = color.replace(trimLeft, "").replace(trimRight, "").toLowerCase();
  var named = false;
  if (names[color]) {
    color = names[color];
    named = true;
  } else if (color == "transparent") {
    return {
      r: 0,
      g: 0,
      b: 0,
      a: 0,
      format: "name"
    };
  }
  var match;
  if (match = matchers.rgb.exec(color)) {
    return {
      r: match[1],
      g: match[2],
      b: match[3]
    };
  }
  if (match = matchers.rgba.exec(color)) {
    return {
      r: match[1],
      g: match[2],
      b: match[3],
      a: match[4]
    };
  }
  if (match = matchers.hsl.exec(color)) {
    return {
      h: match[1],
      s: match[2],
      l: match[3]
    };
  }
  if (match = matchers.hsla.exec(color)) {
    return {
      h: match[1],
      s: match[2],
      l: match[3],
      a: match[4]
    };
  }
  if (match = matchers.hsv.exec(color)) {
    return {
      h: match[1],
      s: match[2],
      v: match[3]
    };
  }
  if (match = matchers.hsva.exec(color)) {
    return {
      h: match[1],
      s: match[2],
      v: match[3],
      a: match[4]
    };
  }
  if (match = matchers.hex8.exec(color)) {
    return {
      r: parseIntFromHex(match[1]),
      g: parseIntFromHex(match[2]),
      b: parseIntFromHex(match[3]),
      a: convertHexToDecimal(match[4]),
      format: named ? "name" : "hex8"
    };
  }
  if (match = matchers.hex6.exec(color)) {
    return {
      r: parseIntFromHex(match[1]),
      g: parseIntFromHex(match[2]),
      b: parseIntFromHex(match[3]),
      format: named ? "name" : "hex"
    };
  }
  if (match = matchers.hex4.exec(color)) {
    return {
      r: parseIntFromHex(match[1] + "" + match[1]),
      g: parseIntFromHex(match[2] + "" + match[2]),
      b: parseIntFromHex(match[3] + "" + match[3]),
      a: convertHexToDecimal(match[4] + "" + match[4]),
      format: named ? "name" : "hex8"
    };
  }
  if (match = matchers.hex3.exec(color)) {
    return {
      r: parseIntFromHex(match[1] + "" + match[1]),
      g: parseIntFromHex(match[2] + "" + match[2]),
      b: parseIntFromHex(match[3] + "" + match[3]),
      format: named ? "name" : "hex"
    };
  }
  return false;
}
function validateWCAG2Parms(parms) {
  var level, size;
  parms = parms || {
    level: "AA",
    size: "small"
  };
  level = (parms.level || "AA").toUpperCase();
  size = (parms.size || "small").toLowerCase();
  if (level !== "AA" && level !== "AAA") {
    level = "AA";
  }
  if (size !== "small" && size !== "large") {
    size = "small";
  }
  return {
    level,
    size
  };
}

// vendor/excalidraw-source.ts
var invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
var assertNever = (_value, message) => {
  throw new Error(message);
};
var getDashArrayDashed = (strokeWidth) => [8, 8 + strokeWidth];
var getDashArrayDotted = (strokeWidth) => [1.5, 6 + strokeWidth];
function adjustRoughness(element) {
  const roughness = element.roughness;
  const maxSize = Math.max(element.width, element.height);
  const minSize = Math.min(element.width, element.height);
  if (
    // both sides relatively big
    minSize >= 20 && maxSize >= 50 || // is round & both sides above 15px
    minSize >= 15 && !!element.roundness && canChangeRoundness(element.type) || // relatively long linear element
    isLinearElement(element) && maxSize >= 50
  ) {
    return roughness;
  }
  return Math.min(roughness / (maxSize < 10 ? 3 : 2), 2.5);
}
var generateRoughOptions = (element, continuousPath = false, isDarkMode = false) => {
  const options = {
    seed: element.seed,
    strokeLineDash: element.strokeStyle === "dashed" ? getDashArrayDashed(element.strokeWidth) : element.strokeStyle === "dotted" ? getDashArrayDotted(element.strokeWidth) : void 0,
    // for non-solid strokes, disable multiStroke because it tends to make
    // dashes/dots overlay each other
    disableMultiStroke: element.strokeStyle !== "solid",
    // for non-solid strokes, increase the width a bit to make it visually
    // similar to solid strokes, because we're also disabling multiStroke
    strokeWidth: element.strokeStyle !== "solid" ? element.strokeWidth + 0.5 : element.strokeWidth,
    // when increasing strokeWidth, we must explicitly set fillWeight and
    // hachureGap because if not specified, roughjs uses strokeWidth to
    // calculate them (and we don't want the fills to be modified)
    fillWeight: element.strokeWidth / 2,
    hachureGap: element.strokeWidth * 4,
    roughness: adjustRoughness(element),
    stroke: applyDarkModeFilter(element.strokeColor, isDarkMode),
    preserveVertices: continuousPath || element.roughness < ROUGHNESS.cartoonist
  };
  switch (element.type) {
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "diamond":
    case "ellipse": {
      options.fillStyle = element.fillStyle;
      options.fill = isTransparent(element.backgroundColor) ? void 0 : applyDarkModeFilter(element.backgroundColor, isDarkMode);
      if (element.type === "ellipse") {
        options.curveFitting = 1;
      }
      return options;
    }
    case "line":
    case "freedraw": {
      if (isPathALoop(element.points)) {
        options.fillStyle = element.fillStyle;
        options.fill = element.backgroundColor === "transparent" ? void 0 : applyDarkModeFilter(element.backgroundColor, isDarkMode);
      }
      return options;
    }
    case "arrow":
      return options;
    default: {
      throw new Error(`Unimplemented type ${element.type}`);
    }
  }
};
var modifyIframeLikeForRoughOptions = (element, isExporting, embedsValidationStatus) => {
  if (isIframeLikeElement(element) && (isExporting || isEmbeddableElement(element) && embedsValidationStatus?.get(element.id) !== true) && isTransparent(element.backgroundColor) && isTransparent(element.strokeColor)) {
    return {
      ...element,
      roughness: 0,
      backgroundColor: "#d3d3d3",
      fillStyle: "solid"
    };
  } else if (isIframeElement(element)) {
    return {
      ...element,
      strokeColor: isTransparent(element.strokeColor) ? "#000000" : element.strokeColor,
      backgroundColor: isTransparent(element.backgroundColor) ? "#f4f4f6" : element.backgroundColor
    };
  }
  return element;
};
var generateArrowheadCardinalityOne = (generator, arrowheadPoints, lineOptions) => {
  if (arrowheadPoints === null) {
    return [];
  }
  const [, , x3, y3, x4, y4] = arrowheadPoints;
  return [generator.line(x3, y3, x4, y4, lineOptions)];
};
var generateArrowheadLinesToTip = (generator, arrowheadPoints, lineOptions) => {
  if (arrowheadPoints === null) {
    return [];
  }
  const [x2, y2, x3, y3, x4, y4] = arrowheadPoints;
  return [
    generator.line(x3, y3, x2, y2, lineOptions),
    generator.line(x4, y4, x2, y2, lineOptions)
  ];
};
var getArrowheadLineOptions = (element, options) => {
  const lineOptions = { ...options };
  if (element.strokeStyle === "dotted") {
    const dash = getDashArrayDotted(element.strokeWidth - 1);
    lineOptions.strokeLineDash = [dash[0], dash[1] - 1];
  } else {
    delete lineOptions.strokeLineDash;
  }
  lineOptions.roughness = Math.min(1, lineOptions.roughness || 0);
  return lineOptions;
};
var generateArrowheadOutlineCircle = (generator, options, strokeColor, arrowheadPoints, fill, diameterScale = 1) => {
  if (arrowheadPoints === null) {
    return [];
  }
  const [x, y, diameter] = arrowheadPoints;
  const circleOptions = {
    ...options,
    stroke: strokeColor,
    roughness: Math.min(0.5, options.roughness || 0),
    // a second stroke would stray from the fill
    disableMultiStroke: true
  };
  delete circleOptions.strokeLineDash;
  return [
    fillArrowheadOutline(
      generator.circle(x, y, diameter * diameterScale, circleOptions),
      fill
    )
  ];
};
var fillArrowheadOutline = (outline, fill) => {
  const ops = outline.sets.flatMap((set) => set.ops).map(
    (op, index) => index > 0 && op.op === "move" ? { ...op, op: "lineTo" } : op
  );
  return {
    ...outline,
    options: { ...outline.options, fill },
    sets: [{ type: "fillPath", ops }, ...outline.sets]
  };
};
var getArrowheadShapes = (element, shape, position, arrowhead, generator, options, canvasBackgroundColor, isDarkMode) => {
  if (arrowhead === null) {
    return [];
  }
  const strokeColor = applyDarkModeFilter(element.strokeColor, isDarkMode);
  const backgroundFillColor = applyDarkModeFilter(
    canvasBackgroundColor,
    isDarkMode
  );
  switch (arrowhead) {
    case "circle":
    case "circle_outline": {
      return generateArrowheadOutlineCircle(
        generator,
        options,
        strokeColor,
        getArrowheadPoints(element, shape, position, arrowhead),
        arrowhead === "circle_outline" ? backgroundFillColor : strokeColor
      );
    }
    case "triangle":
    case "triangle_outline": {
      const arrowheadPoints = getArrowheadPoints(
        element,
        shape,
        position,
        arrowhead
      );
      if (arrowheadPoints === null) {
        return [];
      }
      const [x, y, x2, y2, x3, y3] = arrowheadPoints;
      const triangleOptions = {
        ...options,
        roughness: Math.min(1, options.roughness || 0),
        // a second stroke would stray from the fill
        disableMultiStroke: true,
        // keep the corners of the small polygon in place, only bow the edges
        preserveVertices: true
      };
      delete triangleOptions.strokeLineDash;
      return [
        fillArrowheadOutline(
          generator.polygon(
            [
              [x, y],
              [x2, y2],
              [x3, y3]
            ],
            triangleOptions
          ),
          arrowhead === "triangle_outline" ? backgroundFillColor : strokeColor
        )
      ];
    }
    case "diamond":
    case "diamond_outline": {
      const arrowheadPoints = getArrowheadPoints(
        element,
        shape,
        position,
        arrowhead
      );
      if (arrowheadPoints === null) {
        return [];
      }
      const [x, y, x2, y2, x3, y3, x4, y4] = arrowheadPoints;
      const diamondOptions = {
        ...options,
        roughness: Math.min(1, options.roughness || 0),
        // a second stroke would stray from the fill
        disableMultiStroke: true,
        // keep the corners of the small polygon in place, only bow the edges
        preserveVertices: true
      };
      delete diamondOptions.strokeLineDash;
      return [
        fillArrowheadOutline(
          generator.polygon(
            [
              [x, y],
              [x2, y2],
              [x3, y3],
              [x4, y4]
            ],
            diamondOptions
          ),
          arrowhead === "diamond_outline" ? backgroundFillColor : strokeColor
        )
      ];
    }
    case "cardinality_one":
      return generateArrowheadCardinalityOne(
        generator,
        getArrowheadPoints(element, shape, position, arrowhead),
        getArrowheadLineOptions(element, options)
      );
    case "cardinality_many":
      return generateArrowheadLinesToTip(
        generator,
        getArrowheadPoints(element, shape, position, arrowhead),
        getArrowheadLineOptions(element, options)
      );
    case "cardinality_one_or_many": {
      const lineOptions = getArrowheadLineOptions(element, options);
      return [
        ...generateArrowheadLinesToTip(
          generator,
          getArrowheadPoints(element, shape, position, "cardinality_many"),
          lineOptions
        ),
        ...generateArrowheadCardinalityOne(
          generator,
          getArrowheadPoints(
            element,
            shape,
            position,
            "cardinality_one",
            CARDINALITY_ONE_OR_MANY_BAR_OFFSET
          ),
          lineOptions
        )
      ];
    }
    case "cardinality_exactly_one": {
      const lineOptions = getArrowheadLineOptions(element, options);
      return [
        ...generateArrowheadCardinalityOne(
          generator,
          getArrowheadPoints(
            element,
            shape,
            position,
            "cardinality_one",
            CARDINALITY_INNER_BAR_OFFSET
          ),
          lineOptions
        ),
        ...generateArrowheadCardinalityOne(
          generator,
          getArrowheadPoints(element, shape, position, "cardinality_one"),
          lineOptions
        )
      ];
    }
    case "cardinality_zero_or_one": {
      const lineOptions = getArrowheadLineOptions(element, options);
      return [
        ...generateArrowheadOutlineCircle(
          generator,
          options,
          strokeColor,
          getArrowheadPoints(
            element,
            shape,
            position,
            "circle_outline",
            CARDINALITY_ZERO_CIRCLE_OFFSET
          ),
          backgroundFillColor,
          CARDINALITY_ZERO_CIRCLE_SCALE
        ),
        ...generateArrowheadCardinalityOne(
          generator,
          getArrowheadPoints(
            element,
            shape,
            position,
            "cardinality_one",
            CARDINALITY_INNER_BAR_OFFSET
          ),
          lineOptions
        )
      ];
    }
    case "cardinality_zero_or_many": {
      const lineOptions = getArrowheadLineOptions(element, options);
      return [
        ...generateArrowheadLinesToTip(
          generator,
          getArrowheadPoints(element, shape, position, "cardinality_many"),
          lineOptions
        ),
        ...generateArrowheadOutlineCircle(
          generator,
          options,
          strokeColor,
          getArrowheadPoints(
            element,
            shape,
            position,
            "circle_outline",
            CARDINALITY_ZERO_CIRCLE_OFFSET
          ),
          backgroundFillColor,
          CARDINALITY_ZERO_CIRCLE_SCALE
        )
      ];
    }
    case "bar":
    case "arrow":
    default: {
      return generateArrowheadLinesToTip(
        generator,
        getArrowheadPoints(element, shape, position, arrowhead),
        getArrowheadLineOptions(element, options)
      );
    }
  }
};
var getFreedrawFillCurvePoints = (element) => simplify2(element.points, 0.75);
var _generateElementShape = (element, generator, {
  isExporting,
  canvasBackgroundColor,
  embedsValidationStatus,
  theme
}) => {
  const isDarkMode = theme === THEME.DARK;
  switch (element.type) {
    case "rectangle":
    case "iframe":
    case "embeddable": {
      let shape;
      if (element.roundness) {
        const w = element.width;
        const h = element.height;
        const r = getCornerRadius(Math.min(w, h), element);
        shape = generator.path(
          `M ${r} 0 L ${w - r} 0 Q ${w} 0, ${w} ${r} L ${w} ${h - r} Q ${w} ${h}, ${w - r} ${h} L ${r} ${h} Q 0 ${h}, 0 ${h - r} L 0 ${r} Q 0 0, ${r} 0`,
          generateRoughOptions(
            modifyIframeLikeForRoughOptions(
              element,
              isExporting,
              embedsValidationStatus
            ),
            true,
            isDarkMode
          )
        );
      } else {
        shape = generator.rectangle(
          0,
          0,
          element.width,
          element.height,
          generateRoughOptions(
            modifyIframeLikeForRoughOptions(
              element,
              isExporting,
              embedsValidationStatus
            ),
            false,
            isDarkMode
          )
        );
      }
      return shape;
    }
    case "diamond": {
      let shape;
      const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] = getDiamondPoints(element);
      if (element.roundness) {
        const verticalRadius = getCornerRadius(Math.abs(topX - leftX), element);
        const horizontalRadius = getCornerRadius(
          Math.abs(rightY - topY),
          element
        );
        shape = generator.path(
          `M ${topX + verticalRadius} ${topY + horizontalRadius} L ${rightX - verticalRadius} ${rightY - horizontalRadius}
            C ${rightX} ${rightY}, ${rightX} ${rightY}, ${rightX - verticalRadius} ${rightY + horizontalRadius}
            L ${bottomX + verticalRadius} ${bottomY - horizontalRadius}
            C ${bottomX} ${bottomY}, ${bottomX} ${bottomY}, ${bottomX - verticalRadius} ${bottomY - horizontalRadius}
            L ${leftX + verticalRadius} ${leftY + horizontalRadius}
            C ${leftX} ${leftY}, ${leftX} ${leftY}, ${leftX + verticalRadius} ${leftY - horizontalRadius}
            L ${topX - verticalRadius} ${topY + horizontalRadius}
            C ${topX} ${topY}, ${topX} ${topY}, ${topX + verticalRadius} ${topY + horizontalRadius}`,
          generateRoughOptions(element, true, isDarkMode)
        );
      } else {
        shape = generator.polygon(
          [
            [topX, topY],
            [rightX, rightY],
            [bottomX, bottomY],
            [leftX, leftY]
          ],
          generateRoughOptions(element, false, isDarkMode)
        );
      }
      return shape;
    }
    case "ellipse": {
      const shape = generator.ellipse(
        element.width / 2,
        element.height / 2,
        element.width,
        element.height,
        generateRoughOptions(element, false, isDarkMode)
      );
      return shape;
    }
    case "line":
    case "arrow": {
      let shape;
      const options = generateRoughOptions(element, false, isDarkMode);
      const points = element.points.length ? element.points : [pointFrom(0, 0)];
      if (isElbowArrow(element)) {
        if (!points.every(
          (point) => Math.abs(point[0]) <= 1e6 && Math.abs(point[1]) <= 1e6
        )) {
          console.error(
            `Elbow arrow with extreme point positions detected. Arrow not rendered.`,
            element.id,
            JSON.stringify(points)
          );
          shape = [];
        } else {
          shape = [
            generator.path(
              generateElbowArrowShape(points, ELBOW_ARROW_CORNER_RADIUS),
              generateRoughOptions(element, true, isDarkMode)
            )
          ];
        }
      } else if (!element.roundness) {
        if (options.fill) {
          shape = [
            generator.polygon(points, options)
          ];
        } else {
          shape = [
            generator.linearPath(points, options)
          ];
        }
      } else {
        shape = [generator.curve(points, options)];
      }
      if (element.type === "arrow") {
        const { startArrowhead = null, endArrowhead = "arrow" } = element;
        if (startArrowhead !== null) {
          const shapes = getArrowheadShapes(
            element,
            shape,
            "start",
            startArrowhead,
            generator,
            options,
            canvasBackgroundColor,
            isDarkMode
          );
          shape.push(...shapes);
        }
        if (endArrowhead !== null) {
          if (endArrowhead === void 0) {
          }
          const shapes = getArrowheadShapes(
            element,
            shape,
            "end",
            endArrowhead,
            generator,
            options,
            canvasBackgroundColor,
            isDarkMode
          );
          shape.push(...shapes);
        }
      }
      return shape;
    }
    case "freedraw": {
      const shapes = [];
      if (isPathALoop(element.points)) {
        shapes.push(
          generator.curve(getFreedrawFillCurvePoints(element), {
            ...generateRoughOptions(element, false, isDarkMode),
            stroke: "none"
          })
        );
      }
      shapes.push(getFreeDrawSvgPath(element));
      return shapes;
    }
    // sticky notes are painted directly (canvas + SVG) from
    // `getStickyNoteRenderPoints`, never through roughjs
    case "stickynote":
    case "frame":
    case "magicframe":
    case "text":
    case "image": {
      const shape = null;
      return shape;
    }
    default: {
      assertNever(
        element,
        `generateElementShape(): Unimplemented type ${element?.type}`
      );
      return null;
    }
  }
};
var ELBOW_ARROW_CORNER_RADIUS = 16;
var generateElbowArrowShape = (routePoints, radius) => {
  const isJog = (i) => {
    if (i < 2 || i > routePoints.length - 2) {
      return false;
    }
    const [a2, b2, c, d2] = routePoints.slice(i - 2, i + 2);
    return pointDistance(b2, c) < 1 && pointDistance(a2, b2) >= 1 && pointDistance(c, d2) >= 1 && (b2[0] - a2[0]) * (d2[0] - c[0]) + (b2[1] - a2[1]) * (d2[1] - c[1]) > 0;
  };
  const points = routePoints.filter((_, i) => !isJog(i) && !isJog(i + 1));
  const subpoints = [];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const next = points[i + 1];
    const point = points[i];
    const prevIsHorizontal = headingForPointIsHorizontal(point, prev);
    const nextIsHorizontal = headingForPointIsHorizontal(next, point);
    const corner = Math.min(
      radius,
      pointDistance(points[i], next) / 2,
      pointDistance(points[i], prev) / 2
    );
    if (prevIsHorizontal) {
      if (prev[0] < point[0]) {
        subpoints.push([points[i][0] - corner, points[i][1]]);
      } else {
        subpoints.push([points[i][0] + corner, points[i][1]]);
      }
    } else if (prev[1] < point[1]) {
      subpoints.push([points[i][0], points[i][1] - corner]);
    } else {
      subpoints.push([points[i][0], points[i][1] + corner]);
    }
    subpoints.push(points[i]);
    if (nextIsHorizontal) {
      if (next[0] < point[0]) {
        subpoints.push([points[i][0] - corner, points[i][1]]);
      } else {
        subpoints.push([points[i][0] + corner, points[i][1]]);
      }
    } else if (next[1] < point[1]) {
      subpoints.push([points[i][0], points[i][1] - corner]);
    } else {
      subpoints.push([points[i][0], points[i][1] + corner]);
    }
  }
  const d = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 0; i < subpoints.length; i += 3) {
    d.push(`L ${subpoints[i][0]} ${subpoints[i][1]}`);
    d.push(
      `Q ${subpoints[i + 1][0]} ${subpoints[i + 1][1]}, ${subpoints[i + 2][0]} ${subpoints[i + 2][1]}`
    );
  }
  d.push(`L ${points[points.length - 1][0]} ${points[points.length - 1][1]}`);
  return d.join(" ");
};
var getFreeDrawSvgPath = (element) => {
  return getSvgPathFromStroke(
    getFreedrawOutlinePoints(element)
  );
};
var VARIABLE_WIDTH_FREEDRAW = {
  /** Stroke size relative to `strokeWidth` for pressure-sensitive strokes. */
  SIZE_FACTOR: 4.25,
  THINNING: 0.6,
  SMOOTHING: 0.5
};
var CONSTANT_WIDTH_FREEDRAW = {
  /** Stroke size relative to `strokeWidth` for uniform (laser) strokes. */
  SIZE_FACTOR: 1.4,
  /**
   * Max deviation (px) when dropping vertices of the dense laser outline for
   * collision. Perfect-freehand outlines are already thinned by `smoothing`.
   */
  COLLISION_SIMPLIFY_TOLERANCE: 0.2
};
var getFreedrawStreamline = (element) => element.strokeOptions?.streamline ?? DEFAULT_STROKE_STREAMLINE;
var getVariableWidthFreedrawOutline = (element) => {
  const inputPoints = element.simulatePressure ? element.points : element.points.length ? element.points.map(
    ([x, y], i) => [x, y, element.pressures[i]]
  ) : [[0, 0, 0.5]];
  return ae(inputPoints, {
    simulatePressure: element.simulatePressure,
    size: element.strokeWidth * VARIABLE_WIDTH_FREEDRAW.SIZE_FACTOR,
    thinning: VARIABLE_WIDTH_FREEDRAW.THINNING,
    smoothing: VARIABLE_WIDTH_FREEDRAW.SMOOTHING,
    streamline: getFreedrawStreamline(element),
    easing: (t) => Math.sin(t * Math.PI / 2),
    // https://easings.net/#easeOutSine
    last: true
  });
};
var createLaserPointer = (element) => new $94cfa2cfccc8cc22$export$6531021b3bf36eae({
  size: element.strokeWidth * CONSTANT_WIDTH_FREEDRAW.SIZE_FACTOR,
  streamline: getFreedrawStreamline(element),
  simplify: 0,
  sizeMapping: (details) => Math.max(0.1, details.pressure)
});
var getConstantWidthFreedrawOutline = (element) => {
  const laserPointer = createLaserPointer(element);
  element.points.map(([x, y]) => laserPointer.addPoint([x, y, 1]));
  return laserPointer.getStrokeOutline().map(([x, y]) => [x, y]);
};
var getFreedrawOutlinePoints = (element) => {
  return element.strokeOptions?.variability === "constant" ? getConstantWidthFreedrawOutline(element) : getVariableWidthFreedrawOutline(element);
};
var med = (A2, B2) => {
  return [(A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2];
};
var TO_FIXED_PRECISION = /(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g;
var getSvgPathFromStroke = (points) => {
  if (!points.length) {
    return "";
  }
  const max = points.length - 1;
  return points.reduce(
    (acc, point, i, arr) => {
      if (i === max) {
        acc.push(point, med(point, arr[0]), "L", arr[0], "Z");
      } else {
        acc.push(point, med(point, arr[i + 1]));
      }
      return acc;
    },
    ["M", points[0], "Q"]
  ).join(" ").replace(TO_FIXED_PRECISION, "$1");
};
var getDiamondPoints = (element) => {
  const topX = Math.floor(element.width / 2) + 1;
  const topY = 0;
  const rightX = element.width;
  const rightY = Math.floor(element.height / 2) + 1;
  const bottomX = topX;
  const bottomY = element.height;
  const leftX = 0;
  const leftY = rightY;
  return [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY];
};
var CARDINALITY_MARKER_SIZE = 20;
var CROWFOOT_ARROWHEAD_SIZE = 15;
var CARDINALITY_ONE_OR_MANY_BAR_OFFSET = -0.25;
var CARDINALITY_INNER_BAR_OFFSET = -0.5;
var CARDINALITY_ZERO_CIRCLE_OFFSET = 1.5;
var CARDINALITY_ZERO_CIRCLE_SCALE = 0.8;
var getArrowheadSize = (arrowhead) => {
  switch (arrowhead) {
    case "arrow":
      return 25;
    case "diamond":
    case "diamond_outline":
      return 12;
    case "cardinality_many":
    case "cardinality_one_or_many":
    case "cardinality_zero_or_many":
      return CROWFOOT_ARROWHEAD_SIZE;
    case "cardinality_one":
    case "cardinality_exactly_one":
    case "cardinality_zero_or_one":
      return CARDINALITY_MARKER_SIZE;
    default:
      return 15;
  }
};
var ARROW_ARROWHEAD_ANGLE = 20;
var ARROW_ARROWHEAD_WIDEST_ANGLE = 30;
var ARROW_ARROWHEAD_WIDEST_SIZE = 10;
var getArrowheadAngle = (arrowhead, size = getArrowheadSize(arrowhead)) => {
  switch (arrowhead) {
    case "bar":
      return 90;
    case "arrow": {
      const fullSize = getArrowheadSize(arrowhead);
      const shrinkage = clamp(
        (fullSize - size) / (fullSize - ARROW_ARROWHEAD_WIDEST_SIZE),
        0,
        1
      );
      return ARROW_ARROWHEAD_ANGLE + (ARROW_ARROWHEAD_WIDEST_ANGLE - ARROW_ARROWHEAD_ANGLE) * shrinkage;
    }
    default:
      return 25;
  }
};
var getArrowheadCorner = (element, position) => {
  const { points } = element;
  const [tip, corner, prev] = position === "end" ? [points.at(-1), points.at(-2), points.at(-3)] : [points[0], points[1], points[2]];
  if (!tip || !corner || !prev) {
    return null;
  }
  let length = pointDistance(tip, corner);
  let prevLength = pointDistance(corner, prev);
  if (length === 0 || prevLength === 0) {
    return null;
  }
  if (isElbowArrow(element)) {
    const rounding = Math.min(ELBOW_ARROW_CORNER_RADIUS, length / 2, prevLength / 2) / 2;
    length -= rounding;
    prevLength -= rounding;
  }
  const turn = Math.acos(
    clamp(
      vectorDot(vectorFromPoint(tip, corner), vectorFromPoint(corner, prev)) / (length * prevLength),
      -1,
      1
    )
  );
  return { length, prevLength, turn };
};
var getSidesClearSize = ({ length, turn }, sideAngle, clearance) => {
  const angle = degreesToRadians(sideAngle);
  if (turn <= angle) {
    return Infinity;
  }
  return (length * Math.sin(turn) - clearance) / Math.sin(turn - angle);
};
var isCardinalityArrowhead = (arrowhead) => arrowhead.startsWith("cardinality_");
var getCardinalityMarkerScale = (marker, { length, turn }, strokeWidth) => {
  const bar = (offset) => {
    const angle = degreesToRadians(getArrowheadAngle("cardinality_one"));
    return length / (getArrowheadSize("cardinality_one") * (offset + Math.cos(angle) + // the bar's ends stay closer to the arrow than to the previous
    // segment, which (other than when going straight) is at an angle
    Math.sin(angle) * Math.tan(turn / 2)));
  };
  const crowsFoot = () => length / getArrowheadSize("cardinality_many");
  const circle = () => (length - (strokeWidth - 2) * CARDINALITY_ZERO_CIRCLE_SCALE / 2 - strokeWidth) / (getArrowheadSize("circle_outline") * (CARDINALITY_ZERO_CIRCLE_OFFSET + CARDINALITY_ZERO_CIRCLE_SCALE / 2));
  switch (marker) {
    case "cardinality_one":
      return Math.min(1, bar(0));
    case "cardinality_many":
      return Math.min(1, crowsFoot());
    case "cardinality_one_or_many":
      return Math.min(1, crowsFoot(), bar(CARDINALITY_ONE_OR_MANY_BAR_OFFSET));
    case "cardinality_exactly_one":
      return Math.min(1, bar(CARDINALITY_INNER_BAR_OFFSET), bar(0));
    case "cardinality_zero_or_one":
      return Math.min(1, circle(), bar(CARDINALITY_INNER_BAR_OFFSET));
    case "cardinality_zero_or_many":
      return Math.min(1, crowsFoot(), circle());
  }
};
var getArrowheadSizeBeyondLastSegment = (element, position, arrowhead) => {
  const corner = getArrowheadCorner(element, position);
  if (!corner) {
    return 0;
  }
  const { length, prevLength, turn } = corner;
  const maxSize = (length + prevLength) / 2;
  const isCurved = !!element.roundness && !isElbowArrow(element);
  const marker = position === "start" ? element.startArrowhead : element.endArrowhead;
  if (marker && isCardinalityArrowhead(marker)) {
    return isCurved ? 0 : getArrowheadSize(arrowhead) * getCardinalityMarkerScale(marker, corner, element.strokeWidth);
  }
  if (arrowhead === "circle" || arrowhead === "circle_outline") {
    return maxSize;
  }
  if (isCurved) {
    return 0;
  }
  switch (arrowhead) {
    case "bar":
      return Math.min(maxSize, length / Math.tan(turn / 2));
    case "diamond":
    case "diamond_outline":
      return length / 2;
    case "triangle":
    case "triangle_outline":
      return Math.min(
        maxSize,
        getSidesClearSize(corner, getArrowheadAngle(arrowhead), 0)
      );
    case "arrow": {
      const legibleSize = getArrowheadSize(arrowhead) / 2;
      return Math.min(
        legibleSize,
        maxSize,
        getSidesClearSize(
          corner,
          getArrowheadAngle(arrowhead, legibleSize),
          element.strokeWidth
        ),
        getSidesClearSize(
          corner,
          getArrowheadAngle(arrowhead, 0),
          element.strokeWidth
        )
      );
    }
    default:
      return 0;
  }
};
var getArrowheadPoints = (element, shape, position, arrowhead, offsetMultiplier = 0) => {
  if (arrowhead === null) {
    return null;
  }
  if (shape.length < 1) {
    return null;
  }
  const ops = getCurvePathOps(shape[0]);
  if (ops.length < 1) {
    return null;
  }
  const index = position === "start" ? 1 : ops.length - 1;
  const data = ops[index].data;
  invariant(data.length === 6, "Op data length is not 6");
  const p3 = pointFrom(data[4], data[5]);
  const p2 = pointFrom(data[2], data[3]);
  const p1 = pointFrom(data[0], data[1]);
  const prevOp = ops[index - 1];
  let p0 = pointFrom(0, 0);
  if (prevOp.op === "move") {
    const p = pointFromArray(prevOp.data);
    invariant(p != null, "Op data is not a point");
    p0 = p;
  } else if (prevOp.op === "bcurveTo") {
    p0 = pointFrom(prevOp.data[4], prevOp.data[5]);
  }
  const equation = (t, idx) => Math.pow(1 - t, 3) * p3[idx] + 3 * t * Math.pow(1 - t, 2) * p2[idx] + 3 * Math.pow(t, 2) * (1 - t) * p1[idx] + p0[idx] * Math.pow(t, 3);
  const [x2, y2] = position === "start" ? p0 : p3;
  const [x1, y1] = [equation(0.3, 0), equation(0.3, 1)];
  const distance3 = Math.hypot(x2 - x1, y2 - y1);
  const nx = (x2 - x1) / distance3;
  const ny = (y2 - y1) / distance3;
  const size = getArrowheadSize(arrowhead);
  let length = 0;
  {
    const [cx, cy] = position === "end" ? element.points[element.points.length - 1] : element.points[0];
    const [px, py] = element.points.length > 1 ? position === "end" ? element.points[element.points.length - 2] : element.points[1] : [0, 0];
    length = Math.hypot(cx - px, cy - py);
  }
  const lengthMultiplier = arrowhead === "diamond" || arrowhead === "diamond_outline" ? 0.25 : 0.5;
  let minSize = Math.min(size, length * lengthMultiplier);
  if (minSize < size) {
    minSize = Math.min(
      size,
      Math.max(
        minSize,
        getArrowheadSizeBeyondLastSegment(element, position, arrowhead)
      )
    );
  }
  const tx = x2 - nx * minSize * offsetMultiplier;
  const ty = y2 - ny * minSize * offsetMultiplier;
  const xs = tx - nx * minSize;
  const ys = ty - ny * minSize;
  if (arrowhead === "circle" || arrowhead === "circle_outline") {
    const diameter = Math.hypot(ys - ty, xs - tx) + element.strokeWidth - 2;
    return [tx, ty, diameter];
  }
  const angle = getArrowheadAngle(arrowhead, minSize);
  if (arrowhead === "cardinality_many" || arrowhead === "cardinality_one_or_many") {
    const [x32, y32] = pointRotateRads(
      pointFrom(tx, ty),
      pointFrom(xs, ys),
      degreesToRadians(-angle)
    );
    const [x42, y42] = pointRotateRads(
      pointFrom(tx, ty),
      pointFrom(xs, ys),
      degreesToRadians(angle)
    );
    return [xs, ys, x32, y32, x42, y42];
  }
  const [x3, y3] = pointRotateRads(
    pointFrom(xs, ys),
    pointFrom(tx, ty),
    -angle * Math.PI / 180
  );
  const [x4, y4] = pointRotateRads(
    pointFrom(xs, ys),
    pointFrom(tx, ty),
    degreesToRadians(angle)
  );
  if (arrowhead === "diamond" || arrowhead === "diamond_outline") {
    let ox;
    let oy;
    if (position === "start") {
      const [px, py] = element.points.length > 1 ? element.points[1] : [0, 0];
      [ox, oy] = pointRotateRads(
        pointFrom(tx + minSize * 2, ty),
        pointFrom(tx, ty),
        Math.atan2(py - ty, px - tx)
      );
    } else {
      const [px, py] = element.points.length > 1 ? element.points[element.points.length - 2] : [0, 0];
      [ox, oy] = pointRotateRads(
        pointFrom(tx - minSize * 2, ty),
        pointFrom(tx, ty),
        Math.atan2(ty - py, tx - px)
      );
    }
    return [tx, ty, x3, y3, ox, oy, x4, y4];
  }
  return [tx, ty, x3, y3, x4, y4];
};
var isPathALoop = (points, zoomValue = 1) => {
  if (points.length >= 3) {
    const [first, last] = [points[0], points[points.length - 1]];
    const distance3 = pointDistance(first, last);
    return distance3 <= LINE_CONFIRM_THRESHOLD / zoomValue;
  }
  return false;
};
var getCornerRadius = (x, element) => {
  if (element.roundness?.type === ROUNDNESS.PROPORTIONAL_RADIUS || element.roundness?.type === ROUNDNESS.LEGACY) {
    return x * DEFAULT_PROPORTIONAL_RADIUS;
  }
  if (element.roundness?.type === ROUNDNESS.ADAPTIVE_RADIUS) {
    const fixedRadiusSize = element.roundness?.value ?? DEFAULT_ADAPTIVE_RADIUS;
    const CUTOFF_SIZE = fixedRadiusSize / DEFAULT_PROPORTIONAL_RADIUS;
    if (x <= CUTOFF_SIZE) {
      return x * DEFAULT_PROPORTIONAL_RADIUS;
    }
    return fixedRadiusSize;
  }
  return 0;
};
var LINE_CONFIRM_THRESHOLD = 8;
var THEME = {
  LIGHT: "light",
  DARK: "dark"
};
var DEFAULT_PROPORTIONAL_RADIUS = 0.25;
var DEFAULT_ADAPTIVE_RADIUS = 32;
var ROUNDNESS = {
  // Used for legacy rounding (rectangles), which currently works the same
  // as PROPORTIONAL_RADIUS, but we need to differentiate for UI purposes and
  // forwards-compat.
  LEGACY: 1,
  // Used for linear elements & diamonds
  PROPORTIONAL_RADIUS: 2,
  // Current default algorithm for rectangles, using fixed pixel radius.
  // It's working similarly to a regular border-radius, but attemps to make
  // radius visually similar across differnt element sizes, especially
  // very large and very small elements.
  //
  // NOTE right now we don't allow configuration and use a constant radius
  // (see DEFAULT_ADAPTIVE_RADIUS constant)
  ADAPTIVE_RADIUS: 3
};
var ROUGHNESS = {
  architect: 0,
  artist: 1,
  cartoonist: 2
};
var DEFAULT_STROKE_STREAMLINE = 0.5;
var DARK_MODE_COLORS_CACHE = typeof window !== "undefined" ? /* @__PURE__ */ new Map() : null;
var DARK_MODE_FILTER_INVERT_PERCENT = 93;
var DARK_MODE_FILTER_HUE_ROTATE_DEGREES = 180;
function cssHueRotate(red, green, blue, degrees) {
  const r = red / 255;
  const g = green / 255;
  const b2 = blue / 255;
  const a2 = degreesToRadians(degrees);
  const c = Math.cos(a2);
  const s = Math.sin(a2);
  const matrix = [
    0.213 + c * 0.787 - s * 0.213,
    0.715 - c * 0.715 - s * 0.715,
    0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143,
    0.715 + c * 0.285 + s * 0.14,
    0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787,
    0.715 - c * 0.715 + s * 0.715,
    0.072 + c * 0.928 + s * 0.072
  ];
  const newR = r * matrix[0] + g * matrix[1] + b2 * matrix[2];
  const newG = r * matrix[3] + g * matrix[4] + b2 * matrix[5];
  const newB = r * matrix[6] + g * matrix[7] + b2 * matrix[8];
  return {
    r: Math.round(Math.max(0, Math.min(1, newR)) * 255),
    g: Math.round(Math.max(0, Math.min(1, newG)) * 255),
    b: Math.round(Math.max(0, Math.min(1, newB)) * 255)
  };
}
var cssInvert = (r, g, b2, percent) => {
  const p = clamp(percent, 0, 100) / 100;
  const invertComponent = (color) => {
    const inverted = color * (1 - p) + (255 - color) * p;
    return Math.round(clamp(inverted, 0, 255));
  };
  const invertedR = invertComponent(r);
  const invertedG = invertComponent(g);
  const invertedB = invertComponent(b2);
  return { r: invertedR, g: invertedG, b: invertedB };
};
var applyDarkModeFilter = (color, enable = true) => {
  if (!enable) {
    return color;
  }
  const cached = DARK_MODE_COLORS_CACHE?.get(color);
  if (cached) {
    return cached;
  }
  const tc = tinycolor(color);
  const alpha = tc.getAlpha();
  const rgb = tc.toRgb();
  const inverted = cssInvert(
    rgb.r,
    rgb.g,
    rgb.b,
    DARK_MODE_FILTER_INVERT_PERCENT
  );
  const rotated = cssHueRotate(
    inverted.r,
    inverted.g,
    inverted.b,
    DARK_MODE_FILTER_HUE_ROTATE_DEGREES
  );
  const result = rgbToHex2(rotated.r, rotated.g, rotated.b, alpha);
  if (DARK_MODE_COLORS_CACHE) {
    DARK_MODE_COLORS_CACHE.set(color, result);
  }
  return result;
};
var rgbToHex2 = (r, g, b2, a2) => {
  const hex6 = `#${((1 << 24) + (r << 16) + (g << 8) + b2).toString(16).slice(1)}`;
  if (a2 !== void 0 && a2 < 1) {
    const alphaHex = Math.round(a2 * 255).toString(16).padStart(2, "0");
    return `${hex6}${alphaHex}`;
  }
  return hex6;
};
var isTransparent = (color) => {
  return tinycolor(color).getAlpha() === 0;
};
var isEmbeddableElement = (element) => {
  return !!element && element.type === "embeddable";
};
var isIframeElement = (element) => {
  return !!element && element.type === "iframe";
};
var isIframeLikeElement = (element) => {
  return !!element && (element.type === "iframe" || element.type === "embeddable");
};
var isLinearElement = (element) => {
  return element != null && isLinearElementType(element.type);
};
var isArrowElement = (element) => {
  return element != null && element.type === "arrow";
};
var isElbowArrow = (element) => {
  return isArrowElement(element) && element.elbowed;
};
var isLinearElementType = (elementType) => {
  return elementType === "arrow" || elementType === "line";
};
var canChangeRoundness = (type) => type === "rectangle" || type === "iframe" || type === "embeddable" || type === "line" || type === "diamond" || type === "stickynote" || type === "image";
var HEADING_RIGHT = [1, 0];
var HEADING_DOWN = [0, 1];
var HEADING_LEFT = [-1, 0];
var HEADING_UP = [0, -1];
var vectorToHeading = (vec) => {
  const [x, y] = vec;
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (x > absY) {
    return HEADING_RIGHT;
  } else if (x <= -absY) {
    return HEADING_LEFT;
  } else if (y > absX) {
    return HEADING_DOWN;
  }
  return HEADING_UP;
};
var headingForPoint = (p, o) => vectorToHeading(vectorFromPoint(p, o));
var headingForPointIsHorizontal = (p, o) => headingIsHorizontal(headingForPoint(p, o));
var compareHeading = (a2, b2) => a2[0] === b2[0] && a2[1] === b2[1];
var headingIsHorizontal = (a2) => compareHeading(a2, HEADING_RIGHT) || compareHeading(a2, HEADING_LEFT);
function pointFrom(xOrCoords, y) {
  return typeof xOrCoords === "object" ? [xOrCoords.x, xOrCoords.y] : [xOrCoords, y];
}
function pointFromArray(numberArray) {
  return numberArray.length === 2 ? pointFrom(numberArray[0], numberArray[1]) : void 0;
}
function pointRotateRads(point, center, angle) {
  if (!angle) {
    return point;
  }
  const [x, y] = point;
  const [cx, cy] = center;
  return pointFrom(
    (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle) + cx,
    (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle) + cy
  );
}
function pointDistance(a2, b2) {
  return Math.hypot(b2[0] - a2[0], b2[1] - a2[1]);
}
function vector(x, y, originX = 0, originY = 0) {
  return [x - originX, y - originY];
}
function vectorFromPoint(p, origin = [0, 0], threshold, defaultValue = [0, 1]) {
  const vec = vector(p[0] - origin[0], p[1] - origin[1]);
  if (threshold && vectorMagnitudeSq(vec) < threshold * threshold) {
    return defaultValue;
  }
  return vec;
}
function vectorDot(a2, b2) {
  return a2[0] * b2[0] + a2[1] * b2[1];
}
function vectorMagnitudeSq(v) {
  return v[0] * v[0] + v[1] * v[1];
}
var getCurvePathOps = (shape) => {
  if (!shape) {
    return [];
  }
  for (const set of shape.sets) {
    if (set.type === "path") {
      return set.ops;
    }
  }
  return shape.sets[0].ops;
};
function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}
var clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};
export {
  CARDINALITY_INNER_BAR_OFFSET,
  CARDINALITY_ONE_OR_MANY_BAR_OFFSET,
  CARDINALITY_ZERO_CIRCLE_OFFSET,
  CARDINALITY_ZERO_CIRCLE_SCALE,
  DEFAULT_ADAPTIVE_RADIUS,
  DEFAULT_PROPORTIONAL_RADIUS,
  DEFAULT_STROKE_STREAMLINE,
  ELBOW_ARROW_CORNER_RADIUS,
  HEADING_DOWN,
  HEADING_LEFT,
  HEADING_RIGHT,
  HEADING_UP,
  LINE_CONFIRM_THRESHOLD,
  ROUGHNESS,
  ROUNDNESS,
  RoughGenerator,
  THEME,
  applyDarkModeFilter,
  canChangeRoundness,
  clamp,
  compareHeading,
  degreesToRadians,
  generateElbowArrowShape,
  _generateElementShape as generateElementShape,
  generateRoughOptions,
  getArrowheadAngle,
  getArrowheadPoints,
  getArrowheadSize,
  getCornerRadius,
  getCurvePathOps,
  getDiamondPoints,
  getFreedrawOutlinePoints,
  headingForPoint,
  headingForPointIsHorizontal,
  headingIsHorizontal,
  isArrowElement,
  isElbowArrow,
  isEmbeddableElement,
  isIframeElement,
  isIframeLikeElement,
  isLinearElement,
  isLinearElementType,
  isPathALoop,
  isTransparent,
  pointDistance,
  pointFrom,
  pointFromArray,
  pointRotateRads,
  rgbToHex2 as rgbToHex,
  vector,
  vectorDot,
  vectorFromPoint,
  vectorMagnitudeSq,
  vectorToHeading
};
