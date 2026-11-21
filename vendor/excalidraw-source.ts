// Extracted without algorithm changes from excalidraw/excalidraw@701b901a0f1ba3d0b390d9cdf63d112e25abac4b.
// MIT license: see licenses/excalidraw.txt.
import { RoughGenerator } from 'roughjs/bin/generator.js';
import { simplify } from 'points-on-curve';
import { getStroke } from 'perfect-freehand';
import { LaserPointer } from '@excalidraw/laser-pointer';
import tinycolor from 'tinycolor2';
const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const assertNever = (_value, message) => { throw new Error(message); };


const getDashArrayDashed = (strokeWidth: number) => [8, 8 + strokeWidth];

const getDashArrayDotted = (strokeWidth: number) => [1.5, 6 + strokeWidth];

function adjustRoughness(element: ExcalidrawElement): number {
  const roughness = element.roughness;

  const maxSize = Math.max(element.width, element.height);
  const minSize = Math.min(element.width, element.height);

  // don't reduce roughness if
  if (
    // both sides relatively big
    (minSize >= 20 && maxSize >= 50) ||
    // is round & both sides above 15px
    (minSize >= 15 &&
      !!element.roundness &&
      canChangeRoundness(element.type)) ||
    // relatively long linear element
    (isLinearElement(element) && maxSize >= 50)
  ) {
    return roughness;
  }

  return Math.min(roughness / (maxSize < 10 ? 3 : 2), 2.5);
}

export const generateRoughOptions = (
  element: ExcalidrawElement,
  continuousPath = false,
  isDarkMode: boolean = false,
): Options => {
  const options: Options = {
    seed: element.seed,
    strokeLineDash:
      element.strokeStyle === "dashed"
        ? getDashArrayDashed(element.strokeWidth)
        : element.strokeStyle === "dotted"
        ? getDashArrayDotted(element.strokeWidth)
        : undefined,
    // for non-solid strokes, disable multiStroke because it tends to make
    // dashes/dots overlay each other
    disableMultiStroke: element.strokeStyle !== "solid",
    // for non-solid strokes, increase the width a bit to make it visually
    // similar to solid strokes, because we're also disabling multiStroke
    strokeWidth:
      element.strokeStyle !== "solid"
        ? element.strokeWidth + 0.5
        : element.strokeWidth,
    // when increasing strokeWidth, we must explicitly set fillWeight and
    // hachureGap because if not specified, roughjs uses strokeWidth to
    // calculate them (and we don't want the fills to be modified)
    fillWeight: element.strokeWidth / 2,
    hachureGap: element.strokeWidth * 4,
    roughness: adjustRoughness(element),
    stroke: applyDarkModeFilter(element.strokeColor, isDarkMode),
    preserveVertices:
      continuousPath || element.roughness < ROUGHNESS.cartoonist,
  };

  switch (element.type) {
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "diamond":
    case "ellipse": {
      options.fillStyle = element.fillStyle;
      options.fill = isTransparent(element.backgroundColor)
        ? undefined
        : applyDarkModeFilter(element.backgroundColor, isDarkMode);
      if (element.type === "ellipse") {
        options.curveFitting = 1;
      }
      return options;
    }
    case "line":
    case "freedraw": {
      if (isPathALoop(element.points)) {
        options.fillStyle = element.fillStyle;
        options.fill =
          element.backgroundColor === "transparent"
            ? undefined
            : applyDarkModeFilter(element.backgroundColor, isDarkMode);
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

const modifyIframeLikeForRoughOptions = (
  element: ExcalidrawElement,
  isExporting: boolean,
  embedsValidationStatus: EmbedsValidationStatus | null,
) => {
  if (
    isIframeLikeElement(element) &&
    (isExporting ||
      (isEmbeddableElement(element) &&
        embedsValidationStatus?.get(element.id) !== true)) &&
    isTransparent(element.backgroundColor) &&
    isTransparent(element.strokeColor)
  ) {
    return {
      ...element,
      roughness: 0,
      backgroundColor: "#d3d3d3",
      fillStyle: "solid",
    } as const;
  } else if (isIframeElement(element)) {
    return {
      ...element,
      strokeColor: isTransparent(element.strokeColor)
        ? "#000000"
        : element.strokeColor,
      backgroundColor: isTransparent(element.backgroundColor)
        ? "#f4f4f6"
        : element.backgroundColor,
    };
  }
  return element;
};

const generateArrowheadCardinalityOne = (
  generator: RoughGenerator,
  arrowheadPoints: number[] | null,
  lineOptions: Options,
) => {
  if (arrowheadPoints === null) {
    return [];
  }

  const [, , x3, y3, x4, y4] = arrowheadPoints;

  return [generator.line(x3, y3, x4, y4, lineOptions)];
};

const generateArrowheadLinesToTip = (
  generator: RoughGenerator,
  arrowheadPoints: number[] | null,
  lineOptions: Options,
) => {
  if (arrowheadPoints === null) {
    return [];
  }

  const [x2, y2, x3, y3, x4, y4] = arrowheadPoints;

  return [
    generator.line(x3, y3, x2, y2, lineOptions),
    generator.line(x4, y4, x2, y2, lineOptions),
  ];
};

const getArrowheadLineOptions = (
  element: ExcalidrawLinearElement,
  options: Options,
) => {
  const lineOptions = { ...options };

  if (element.strokeStyle === "dotted") {
    // for dotted arrows caps, reduce gap to make it more legible
    const dash = getDashArrayDotted(element.strokeWidth - 1);
    lineOptions.strokeLineDash = [dash[0], dash[1] - 1];
  } else {
    // for solid/dashed, keep solid arrow cap
    delete lineOptions.strokeLineDash;
  }
  lineOptions.roughness = Math.min(1, lineOptions.roughness || 0);

  return lineOptions;
};

const generateArrowheadOutlineCircle = (
  generator: RoughGenerator,
  options: Options,
  strokeColor: string,
  arrowheadPoints: number[] | null,
  fill: string,
  diameterScale = 1,
) => {
  if (arrowheadPoints === null) {
    return [];
  }

  const [x, y, diameter] = arrowheadPoints;
  const circleOptions = {
    ...options,
    stroke: strokeColor,
    roughness: Math.min(0.5, options.roughness || 0),
    // a second stroke would stray from the fill
    disableMultiStroke: true,
  };

  delete circleOptions.strokeLineDash;

  return [
    fillArrowheadOutline(
      generator.circle(x, y, diameter * diameterScale, circleOptions),
      fill,
    ),
  ];
};

/**
 * Fills an arrowhead's outline (a polygon or circle drawn as a single rough
 * stroke) along that stroke. rough.js' own solid fill is jittered separately
 * from the outline, by up to 2px, which shows on shapes as small as
 * arrowheads.
 */

const fillArrowheadOutline = (outline: Drawable, fill: string): Drawable => {
  // polygons are drawn edge by edge, each starting with a move
  const ops = outline.sets
    .flatMap((set) => set.ops)
    .map((op, index) =>
      index > 0 && op.op === "move" ? { ...op, op: "lineTo" as const } : op,
    );

  return {
    ...outline,
    options: { ...outline.options, fill },
    sets: [{ type: "fillPath", ops }, ...outline.sets],
  };
};

const getArrowheadShapes = (
  element: ExcalidrawLinearElement,
  shape: Drawable[],
  position: "start" | "end",
  arrowhead: Arrowhead,
  generator: RoughGenerator,
  options: Options,
  canvasBackgroundColor: string,
  isDarkMode: boolean,
) => {
  if (arrowhead === null) {
    return [];
  }

  const strokeColor = applyDarkModeFilter(element.strokeColor, isDarkMode);
  const backgroundFillColor = applyDarkModeFilter(
    canvasBackgroundColor,
    isDarkMode,
  );
  switch (arrowhead) {
    case "circle":
    case "circle_outline": {
      return generateArrowheadOutlineCircle(
        generator,
        options,
        strokeColor,
        getArrowheadPoints(element, shape, position, arrowhead),
        arrowhead === "circle_outline" ? backgroundFillColor : strokeColor,
      );
    }
    case "triangle":
    case "triangle_outline": {
      const arrowheadPoints = getArrowheadPoints(
        element,
        shape,
        position,
        arrowhead,
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
        preserveVertices: true,
      };

      // always use solid stroke for arrowhead
      delete triangleOptions.strokeLineDash;

      return [
        fillArrowheadOutline(
          generator.polygon(
            [
              [x, y],
              [x2, y2],
              [x3, y3],
            ],
            triangleOptions,
          ),
          arrowhead === "triangle_outline" ? backgroundFillColor : strokeColor,
        ),
      ];
    }
    case "diamond":
    case "diamond_outline": {
      const arrowheadPoints = getArrowheadPoints(
        element,
        shape,
        position,
        arrowhead,
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
        preserveVertices: true,
      };

      // always use solid stroke for arrowhead
      delete diamondOptions.strokeLineDash;

      return [
        fillArrowheadOutline(
          generator.polygon(
            [
              [x, y],
              [x2, y2],
              [x3, y3],
              [x4, y4],
            ],
            diamondOptions,
          ),
          arrowhead === "diamond_outline" ? backgroundFillColor : strokeColor,
        ),
      ];
    }
    case "cardinality_one":
      return generateArrowheadCardinalityOne(
        generator,
        getArrowheadPoints(element, shape, position, arrowhead),
        getArrowheadLineOptions(element, options),
      );
    case "cardinality_many":
      return generateArrowheadLinesToTip(
        generator,
        getArrowheadPoints(element, shape, position, arrowhead),
        getArrowheadLineOptions(element, options),
      );
    case "cardinality_one_or_many": {
      const lineOptions = getArrowheadLineOptions(element, options);

      return [
        ...generateArrowheadLinesToTip(
          generator,
          getArrowheadPoints(element, shape, position, "cardinality_many"),
          lineOptions,
        ),
        ...generateArrowheadCardinalityOne(
          generator,
          getArrowheadPoints(
            element,
            shape,
            position,
            "cardinality_one",
            CARDINALITY_ONE_OR_MANY_BAR_OFFSET,
          ),
          lineOptions,
        ),
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
            CARDINALITY_INNER_BAR_OFFSET,
          ),
          lineOptions,
        ),
        ...generateArrowheadCardinalityOne(
          generator,
          getArrowheadPoints(element, shape, position, "cardinality_one"),
          lineOptions,
        ),
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
            CARDINALITY_ZERO_CIRCLE_OFFSET,
          ),
          backgroundFillColor,
          CARDINALITY_ZERO_CIRCLE_SCALE,
        ),
        ...generateArrowheadCardinalityOne(
          generator,
          getArrowheadPoints(
            element,
            shape,
            position,
            "cardinality_one",
            CARDINALITY_INNER_BAR_OFFSET,
          ),
          lineOptions,
        ),
      ];
    }
    case "cardinality_zero_or_many": {
      const lineOptions = getArrowheadLineOptions(element, options);

      return [
        ...generateArrowheadLinesToTip(
          generator,
          getArrowheadPoints(element, shape, position, "cardinality_many"),
          lineOptions,
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
            CARDINALITY_ZERO_CIRCLE_OFFSET,
          ),
          backgroundFillColor,
          CARDINALITY_ZERO_CIRCLE_SCALE,
        ),
      ];
    }
    case "bar":
    case "arrow":
    default: {
      return generateArrowheadLinesToTip(
        generator,
        getArrowheadPoints(element, shape, position, arrowhead),
        getArrowheadLineOptions(element, options),
      );
    }
  }
};

/** The simplified centerline the freedraw fill is drawn along. */

const getFreedrawFillCurvePoints = (element: ExcalidrawFreeDrawElement) =>
  simplify(element.points as Mutable<LocalPoint[]>, 0.75) as [number, number][];

const _generateElementShape = (
  element: Exclude<ExcalidrawElement, ExcalidrawSelectionElement>,
  generator: RoughGenerator,
  {
    isExporting,
    canvasBackgroundColor,
    embedsValidationStatus,
    theme,
  }: {
    isExporting: boolean;
    canvasBackgroundColor: string;
    embedsValidationStatus: EmbedsValidationStatus | null;
    theme?: AppState["theme"];
  },
): ElementShape => {
  const isDarkMode = theme === THEME.DARK;
  switch (element.type) {
    case "rectangle":
    case "iframe":
    case "embeddable": {
      let shape: ElementShapes[typeof element.type];
      // this is for rendering the stroke/bg of the embeddable, especially
      // when the src url is not set

      if (element.roundness) {
        const w = element.width;
        const h = element.height;
        const r = getCornerRadius(Math.min(w, h), element);
        shape = generator.path(
          `M ${r} 0 L ${w - r} 0 Q ${w} 0, ${w} ${r} L ${w} ${
            h - r
          } Q ${w} ${h}, ${w - r} ${h} L ${r} ${h} Q 0 ${h}, 0 ${
            h - r
          } L 0 ${r} Q 0 0, ${r} 0`,
          generateRoughOptions(
            modifyIframeLikeForRoughOptions(
              element,
              isExporting,
              embedsValidationStatus,
            ),
            true,
            isDarkMode,
          ),
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
              embedsValidationStatus,
            ),
            false,
            isDarkMode,
          ),
        );
      }
      return shape;
    }
    case "diamond": {
      let shape: ElementShapes[typeof element.type];

      const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
        getDiamondPoints(element);
      if (element.roundness) {
        const verticalRadius = getCornerRadius(Math.abs(topX - leftX), element);

        const horizontalRadius = getCornerRadius(
          Math.abs(rightY - topY),
          element,
        );

        shape = generator.path(
          `M ${topX + verticalRadius} ${topY + horizontalRadius} L ${
            rightX - verticalRadius
          } ${rightY - horizontalRadius}
            C ${rightX} ${rightY}, ${rightX} ${rightY}, ${
            rightX - verticalRadius
          } ${rightY + horizontalRadius}
            L ${bottomX + verticalRadius} ${bottomY - horizontalRadius}
            C ${bottomX} ${bottomY}, ${bottomX} ${bottomY}, ${
            bottomX - verticalRadius
          } ${bottomY - horizontalRadius}
            L ${leftX + verticalRadius} ${leftY + horizontalRadius}
            C ${leftX} ${leftY}, ${leftX} ${leftY}, ${leftX + verticalRadius} ${
            leftY - horizontalRadius
          }
            L ${topX - verticalRadius} ${topY + horizontalRadius}
            C ${topX} ${topY}, ${topX} ${topY}, ${topX + verticalRadius} ${
            topY + horizontalRadius
          }`,
          generateRoughOptions(element, true, isDarkMode),
        );
      } else {
        shape = generator.polygon(
          [
            [topX, topY],
            [rightX, rightY],
            [bottomX, bottomY],
            [leftX, leftY],
          ],
          generateRoughOptions(element, false, isDarkMode),
        );
      }
      return shape;
    }
    case "ellipse": {
      const shape: ElementShapes[typeof element.type] = generator.ellipse(
        element.width / 2,
        element.height / 2,
        element.width,
        element.height,
        generateRoughOptions(element, false, isDarkMode),
      );
      return shape;
    }
    case "line":
    case "arrow": {
      let shape: ElementShapes[typeof element.type];
      const options = generateRoughOptions(element, false, isDarkMode);

      // points array can be empty in the beginning, so it is important to add
      // initial position to it
      const points = element.points.length
        ? element.points
        : [pointFrom<LocalPoint>(0, 0)];

      if (isElbowArrow(element)) {
        // NOTE (mtolmacs): Temporary fix for extremely big arrow shapes
        if (
          !points.every(
            (point) => Math.abs(point[0]) <= 1e6 && Math.abs(point[1]) <= 1e6,
          )
        ) {
          console.error(
            `Elbow arrow with extreme point positions detected. Arrow not rendered.`,
            element.id,
            JSON.stringify(points),
          );
          shape = [];
        } else {
          shape = [
            generator.path(
              generateElbowArrowShape(points, ELBOW_ARROW_CORNER_RADIUS),
              generateRoughOptions(element, true, isDarkMode),
            ),
          ];
        }
      } else if (!element.roundness) {
        // curve is always the first element
        // this simplifies finding the curve for an element
        if (options.fill) {
          shape = [
            generator.polygon(points as unknown as RoughPoint[], options),
          ];
        } else {
          shape = [
            generator.linearPath(points as unknown as RoughPoint[], options),
          ];
        }
      } else {
        shape = [generator.curve(points as unknown as RoughPoint[], options)];
      }

      // add lines only in arrow
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
            isDarkMode,
          );
          shape.push(...shapes);
        }

        if (endArrowhead !== null) {
          if (endArrowhead === undefined) {
            // Hey, we have an old arrow here!
          }

          const shapes = getArrowheadShapes(
            element,
            shape,
            "end",
            endArrowhead,
            generator,
            options,
            canvasBackgroundColor,
            isDarkMode,
          );
          shape.push(...shapes);
        }
      }
      return shape;
    }
    case "freedraw": {
      // oredered in terms of z-index [background, stroke]
      const shapes: ElementShapes[typeof element.type] = [];

      // (1) background fill (rc shape), optional
      if (isPathALoop(element.points)) {
        // generate rough polygon to fill freedraw shape
        shapes.push(
          generator.curve(getFreedrawFillCurvePoints(element), {
            ...generateRoughOptions(element, false, isDarkMode),
            stroke: "none",
          }),
        );
      }

      // (2) stroke
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
      const shape: ElementShapes[typeof element.type] = null;
      // we return (and cache) `null` to make sure we don't regenerate
      // `element.canvas` on rerenders
      return shape;
    }
    default: {
      assertNever(
        element,
        `generateElementShape(): Unimplemented type ${(element as any)?.type}`,
      );
      return null;
    }
  }
};

export const ELBOW_ARROW_CORNER_RADIUS = 16;

export const generateElbowArrowShape = (
  routePoints: readonly LocalPoint[],
  radius: number,
) => {
  // a jog too short to see (e.g. a fixed segment lined up with the ones
  // around it, while dragging an element the arrow is bound to) is drawn
  // straight, as rough.js draws its two corners as a knot: a segment shorter
  // than 1px between two longer ones heading the same way (not a U-turn, nor
  // a corner of short segments)
  const isJog = (i: number) => {
    if (i < 2 || i > routePoints.length - 2) {
      return false;
    }
    const [a, b, c, d] = routePoints.slice(i - 2, i + 2);
    return (
      pointDistance(b, c) < 1 &&
      pointDistance(a, b) >= 1 &&
      pointDistance(c, d) >= 1 &&
      (b[0] - a[0]) * (d[0] - c[0]) + (b[1] - a[1]) * (d[1] - c[1]) > 0
    );
  };
  const points = routePoints.filter((_, i) => !isJog(i) && !isJog(i + 1));
  const subpoints = [] as [number, number][];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const next = points[i + 1];
    const point = points[i];
    const prevIsHorizontal = headingForPointIsHorizontal(point, prev);
    const nextIsHorizontal = headingForPointIsHorizontal(next, point);
    const corner = Math.min(
      radius,
      pointDistance(points[i], next) / 2,
      pointDistance(points[i], prev) / 2,
    );

    if (prevIsHorizontal) {
      if (prev[0] < point[0]) {
        // LEFT
        subpoints.push([points[i][0] - corner, points[i][1]]);
      } else {
        // RIGHT
        subpoints.push([points[i][0] + corner, points[i][1]]);
      }
    } else if (prev[1] < point[1]) {
      // UP
      subpoints.push([points[i][0], points[i][1] - corner]);
    } else {
      subpoints.push([points[i][0], points[i][1] + corner]);
    }

    subpoints.push(points[i] as [number, number]);

    if (nextIsHorizontal) {
      if (next[0] < point[0]) {
        // LEFT
        subpoints.push([points[i][0] - corner, points[i][1]]);
      } else {
        // RIGHT
        subpoints.push([points[i][0] + corner, points[i][1]]);
      }
    } else if (next[1] < point[1]) {
      // UP
      subpoints.push([points[i][0], points[i][1] - corner]);
    } else {
      // DOWN
      subpoints.push([points[i][0], points[i][1] + corner]);
    }
  }

  const d = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 0; i < subpoints.length; i += 3) {
    d.push(`L ${subpoints[i][0]} ${subpoints[i][1]}`);
    d.push(
      `Q ${subpoints[i + 1][0]} ${subpoints[i + 1][1]}, ${
        subpoints[i + 2][0]
      } ${subpoints[i + 2][1]}`,
    );
  }
  d.push(`L ${points[points.length - 1][0]} ${points[points.length - 1][1]}`);

  return d.join(" ");
};

/**
 * get the pure geometric shape of an excalidraw elementw
 * which is then used for hit detection
 */

const getFreeDrawSvgPath = (element: ExcalidrawFreeDrawElement) => {
  return getSvgPathFromStroke(
    getFreedrawOutlinePoints(element),
  ) as SVGPathString;
};

/**
 * Freedraw stroke geometry tuning constants.
 *
 * These factors are not derived analytically — they were tuned empirically by
 * visually comparing rendered strokes until they matched the desired feel.
 * Treat them as magic numbers backed by visual verification.
 */

const VARIABLE_WIDTH_FREEDRAW = {
  /** Stroke size relative to `strokeWidth` for pressure-sensitive strokes. */
  SIZE_FACTOR: 4.25,
  THINNING: 0.6,
  SMOOTHING: 0.5,
} as const;

const CONSTANT_WIDTH_FREEDRAW = {
  /** Stroke size relative to `strokeWidth` for uniform (laser) strokes. */
  SIZE_FACTOR: 1.4,
  /**
   * Max deviation (px) when dropping vertices of the dense laser outline for
   * collision. Perfect-freehand outlines are already thinned by `smoothing`.
   */
  COLLISION_SIMPLIFY_TOLERANCE: 0.2,
} as const;

const getFreedrawStreamline = (element: ExcalidrawFreeDrawElement) =>
  element.strokeOptions?.streamline ?? DEFAULT_STROKE_STREAMLINE;

/**
 * Pressure-sensitive (variable width) freedraw outline, rendered with
 * perfect-freehand. This is the original Excalidraw freedraw look.
 */

const getVariableWidthFreedrawOutline = (
  element: ExcalidrawFreeDrawElement,
): [number, number][] => {
  // If input points are empty (should they ever be?) return a dot
  const inputPoints = element.simulatePressure
    ? element.points
    : element.points.length
    ? element.points.map(
        ([x, y], i) => [x, y, element.pressures[i]] as [number, number, number],
      )
    : [[0, 0, 0.5]];

  return getStroke(inputPoints as number[][], {
    simulatePressure: element.simulatePressure,
    size: element.strokeWidth * VARIABLE_WIDTH_FREEDRAW.SIZE_FACTOR,
    thinning: VARIABLE_WIDTH_FREEDRAW.THINNING,
    smoothing: VARIABLE_WIDTH_FREEDRAW.SMOOTHING,
    streamline: getFreedrawStreamline(element),
    easing: (t) => Math.sin((t * Math.PI) / 2), // https://easings.net/#easeOutSine
    last: true,
  }) as [number, number][];
};

const createLaserPointer = (element: ExcalidrawFreeDrawElement) =>
  new LaserPointer({
    size: element.strokeWidth * CONSTANT_WIDTH_FREEDRAW.SIZE_FACTOR,
    streamline: getFreedrawStreamline(element),
    simplify: 0,
    sizeMapping: (details) => Math.max(0.1, details.pressure),
  });

/**
 * Uniform (constant width) freedraw outline, rendered with the laser-pointer
 * geometry. Pressure is pinned to 1 so the stroke keeps a constant width.
 */

const getConstantWidthFreedrawOutline = (
  element: ExcalidrawFreeDrawElement,
): [number, number][] => {
  const laserPointer = createLaserPointer(element);
  element.points.map(([x, y]) => laserPointer.addPoint([x, y, 1]));

  return laserPointer
    .getStrokeOutline()
    .map(([x, y]) => [x, y] as [number, number]);
};

export const getFreedrawOutlinePoints = (
  element: ExcalidrawFreeDrawElement,
): [number, number][] => {
  // Unknown/absent variability falls back to the original variable rendering.
  return element.strokeOptions?.variability === "constant"
    ? getConstantWidthFreedrawOutline(element)
    : getVariableWidthFreedrawOutline(element);
};

/**
 * Upper bound on how far a freedraw stroke's ink reaches past its centerline
 * points. Both stroke generators scale the stroke size by at most 1 (easing
 * or pressure), so the size itself bounds the radius, except for
 * perfect-freehand's short strokes: under 3px long, the start cap is drawn
 * around the first point from an outline point of the last one (reaching
 * sqrt(size² + 3²)), and a single point gets a synthetic neighbor 1px away.
 */

const med = (A: number[], B: number[]) => {
  return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
};

// Trim SVG path data so number are each two decimal points. This
// improves SVG exports, and prevents rendering errors on points
// with long decimals.

const TO_FIXED_PRECISION = /(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g;

const getSvgPathFromStroke = (points: number[][]): string => {
  if (!points.length) {
    return "";
  }

  const max = points.length - 1;

  return points
    .reduce(
      (acc, point, i, arr) => {
        if (i === max) {
          acc.push(point, med(point, arr[0]), "L", arr[0], "Z");
        } else {
          acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
      },
      ["M", points[0], "Q"],
    )
    .join(" ")
    .replace(TO_FIXED_PRECISION, "$1");
};

// -----------------------------------------------------------------------------

export const getDiamondPoints = (element: ExcalidrawElement) => {
  // Here we add +1 to avoid these numbers to be 0
  // otherwise rough.js will throw an error complaining about it
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

// reference: https://eliot-jones.com/2019/12/cubic-bezier-curve-bounding-boxes

const CARDINALITY_MARKER_SIZE = 20;

const CROWFOOT_ARROWHEAD_SIZE = 15;

// layout of the parts of composite cardinality markers, in multiples of
// the part's size (negative offsets move a part toward the tip)

export const CARDINALITY_ONE_OR_MANY_BAR_OFFSET = -0.25;

export const CARDINALITY_INNER_BAR_OFFSET = -0.5;

export const CARDINALITY_ZERO_CIRCLE_OFFSET = 1.5;

export const CARDINALITY_ZERO_CIRCLE_SCALE = 0.8;

/** @returns number in pixels */

export const getArrowheadSize = (arrowhead: Arrowhead): number => {
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

const ARROW_ARROWHEAD_ANGLE = 20;
// scaled down `arrow` arrowheads open up to this angle so that they don't
// collapse into the line, reaching it at ARROW_ARROWHEAD_WIDEST_SIZE

const ARROW_ARROWHEAD_WIDEST_ANGLE = 30;

const ARROW_ARROWHEAD_WIDEST_SIZE = 10;

/** @returns number in degrees */

export const getArrowheadAngle = (
  arrowhead: Arrowhead,
  /** size the arrowhead is drawn at, if scaled down */
  size = getArrowheadSize(arrowhead),
): Degrees => {
  switch (arrowhead) {
    case "bar":
      return 90 as Degrees;
    case "arrow": {
      const fullSize = getArrowheadSize(arrowhead);
      const shrinkage = clamp(
        (fullSize - size) / (fullSize - ARROW_ARROWHEAD_WIDEST_SIZE),
        0,
        1,
      );
      return (ARROW_ARROWHEAD_ANGLE +
        (ARROW_ARROWHEAD_WIDEST_ANGLE - ARROW_ARROWHEAD_ANGLE) *
          shrinkage) as Degrees;
    }
    default:
      return 25 as Degrees;
  }
};

/**
 * The arrow's last segment at the arrowhead's end, and how much the arrow
 * turns into it from the previous segment (0 if it continues straight).
 *
 * @returns null if there's no previous segment
 */

const getArrowheadCorner = (
  element: ExcalidrawLinearElement,
  position: "start" | "end",
) => {
  const { points } = element;
  const [tip, corner, prev] =
    position === "end"
      ? [points.at(-1), points.at(-2), points.at(-3)]
      : [points[0], points[1], points[2]];

  if (!tip || !corner || !prev) {
    return null;
  }

  let length = pointDistance(tip, corner);
  let prevLength = pointDistance(corner, prev);

  if (length === 0 || prevLength === 0) {
    return null;
  }

  // elbow arrows round their corners off, the arrow effectively turns
  // halfway into the rounding
  if (isElbowArrow(element)) {
    const rounding =
      Math.min(ELBOW_ARROW_CORNER_RADIUS, length / 2, prevLength / 2) / 2;
    length -= rounding;
    prevLength -= rounding;
  }

  const turn = Math.acos(
    clamp(
      vectorDot(vectorFromPoint(tip, corner), vectorFromPoint(corner, prev)) /
        (length * prevLength),
      -1,
      1,
    ),
  );

  return { length, prevLength, turn };
};

const getSidesClearSize = (
  { length, turn }: ArrowheadCorner,
  sideAngle: Degrees,
  clearance: number,
) => {
  const angle = degreesToRadians(sideAngle);

  // the previous segment stays between the sides
  if (turn <= angle) {
    return Infinity;
  }

  // in the tip-corner-side-end triangle, the side end is
  // `length * sin(turn)` away from the previous segment at size 0,
  // and every unit of size takes it `sin(turn - angle)` closer
  return (length * Math.sin(turn) - clearance) / Math.sin(turn - angle);
};

const isCardinalityArrowhead = (
  arrowhead: Arrowhead,
): arrowhead is CardinalityArrowhead => arrowhead.startsWith("cardinality_");

/**
 * Scale (at most 1) at which all parts of a cardinality marker fit on the
 * last segment: the crow's foot reaches back at most to the corner, the
 * circle stays clear of it, and the bars' ends stay closer to the arrow than
 * to the previous segment.
 */

const getCardinalityMarkerScale = (
  marker: CardinalityArrowhead,
  { length, turn }: ArrowheadCorner,
  strokeWidth: number,
) => {
  // scales at which each part reaches back from the tip at most to the corner
  const bar = (offset: number) => {
    const angle = degreesToRadians(getArrowheadAngle("cardinality_one"));
    return (
      length /
      (getArrowheadSize("cardinality_one") *
        (offset +
          Math.cos(angle) +
          // the bar's ends stay closer to the arrow than to the previous
          // segment, which (other than when going straight) is at an angle
          Math.sin(angle) * Math.tan(turn / 2)))
    );
  };
  const crowsFoot = () => length / getArrowheadSize("cardinality_many");
  // see generateArrowheadOutlineCircle() for the diameter
  const circle = () =>
    (length -
      ((strokeWidth - 2) * CARDINALITY_ZERO_CIRCLE_SCALE) / 2 -
      strokeWidth) /
    (getArrowheadSize("circle_outline") *
      (CARDINALITY_ZERO_CIRCLE_OFFSET + CARDINALITY_ZERO_CIRCLE_SCALE / 2));

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

/**
 * Size an arrowhead may grow to when the last segment of an arrow is too
 * short to fit it, by using up the whole segment or extending past its start.
 *
 * @param arrowhead the arrowhead, or the part of a composite marker, to size
 * @returns 0 if the arrowhead shouldn't grow
 */

const getArrowheadSizeBeyondLastSegment = (
  element: ExcalidrawLinearElement,
  position: "start" | "end",
  arrowhead: Arrowhead,
): number => {
  const corner = getArrowheadCorner(element, position);

  if (!corner) {
    return 0;
  }

  const { length, prevLength, turn } = corner;
  // don't take up more than half of the last two segments
  const maxSize = (length + prevLength) / 2;
  // the end of curved arrows bends away from a longer arrowhead, and its
  // direction is too unreliable for a wider one
  const isCurved = !!element.roundness && !isElbowArrow(element);
  const marker =
    position === "start" ? element.startArrowhead : element.endArrowhead;

  // all parts of cardinality markers scale together, and the marker has to
  // stay on the last segment to be read along it
  if (marker && isCardinalityArrowhead(marker)) {
    return isCurved
      ? 0
      : getArrowheadSize(arrowhead) *
          getCardinalityMarkerScale(marker, corner, element.strokeWidth);
  }

  // circles have no direction, the previous segment can run into them
  if (arrowhead === "circle" || arrowhead === "circle_outline") {
    return maxSize;
  }

  if (isCurved) {
    return 0;
  }

  switch (arrowhead) {
    case "bar":
      // keep the bar's ends closer to the tip than to the previous segment,
      // which (other than when going straight) runs at an angle to the bar
      return Math.min(maxSize, length / Math.tan(turn / 2));
    case "diamond":
    case "diamond_outline":
      // the diamond can reach back to the corner (at twice its size), past
      // it the previous segment would cut through the diamond
      return length / 2;
    case "triangle":
    case "triangle_outline":
      // the triangle's base may sit on the previous segment
      return Math.min(
        maxSize,
        getSidesClearSize(corner, getArrowheadAngle(arrowhead), 0),
      );
    case "arrow": {
      // only grow as much as legibility needs, a full-size arrowhead past
      // a sharp turn looks like an outline triangle
      const legibleSize = getArrowheadSize(arrowhead) / 2;
      // keep the open sides' strokes off the previous segment's. Smaller
      // arrowheads are wider, so check the angles at both ends of the range.
      return Math.min(
        legibleSize,
        maxSize,
        getSidesClearSize(
          corner,
          getArrowheadAngle(arrowhead, legibleSize),
          element.strokeWidth,
        ),
        getSidesClearSize(
          corner,
          getArrowheadAngle(arrowhead, 0),
          element.strokeWidth,
        ),
      );
    }
    default:
      return 0;
  }
};

export const getArrowheadPoints = (
  element: ExcalidrawLinearElement,
  shape: Drawable[],
  position: "start" | "end",
  arrowhead: Arrowhead,
  offsetMultiplier = 0,
) => {
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

  // The index of the bCurve operation to examine.
  const index = position === "start" ? 1 : ops.length - 1;

  const data = ops[index].data;

  invariant(data.length === 6, "Op data length is not 6");

  const p3 = pointFrom(data[4], data[5]);
  const p2 = pointFrom(data[2], data[3]);
  const p1 = pointFrom(data[0], data[1]);

  // We need to find p0 of the bezier curve.
  // It is typically the last point of the previous
  // curve; it can also be the position of moveTo operation.
  const prevOp = ops[index - 1];
  let p0 = pointFrom(0, 0);
  if (prevOp.op === "move") {
    const p = pointFromArray(prevOp.data);
    invariant(p != null, "Op data is not a point");
    p0 = p;
  } else if (prevOp.op === "bcurveTo") {
    p0 = pointFrom(prevOp.data[4], prevOp.data[5]);
  }

  // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
  const equation = (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);

  // Ee know the last point of the arrow (or the first, if start arrowhead).
  const [x2, y2] = position === "start" ? p0 : p3;

  // By using cubic bezier equation (B(t)) and the given parameters,
  // we calculate a point that is closer to the last point.
  // The value 0.3 is chosen arbitrarily and it works best for all
  // the tested cases.
  const [x1, y1] = [equation(0.3, 0), equation(0.3, 1)];

  // Find the normalized direction vector based on the
  // previously calculated points.
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const nx = (x2 - x1) / distance;
  const ny = (y2 - y1) / distance;

  const size = getArrowheadSize(arrowhead);

  let length = 0;

  {
    // Length for -> arrows is based on the length of the last section
    const [cx, cy] =
      position === "end"
        ? element.points[element.points.length - 1]
        : element.points[0];
    const [px, py] =
      element.points.length > 1
        ? position === "end"
          ? element.points[element.points.length - 2]
          : element.points[1]
        : [0, 0];

    length = Math.hypot(cx - px, cy - py);
  }

  // Scale down the arrowhead until we hit a certain size so that it doesn't look weird.
  // This value is selected by minimizing a minimum size with the last segment of the arrowhead
  const lengthMultiplier =
    arrowhead === "diamond" || arrowhead === "diamond_outline" ? 0.25 : 0.5;
  let minSize = Math.min(size, length * lengthMultiplier);
  if (minSize < size) {
    minSize = Math.min(
      size,
      Math.max(
        minSize,
        getArrowheadSizeBeyondLastSegment(element, position, arrowhead),
      ),
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

  if (
    arrowhead === "cardinality_many" ||
    arrowhead === "cardinality_one_or_many"
  ) {
    // swap (xs, ys) with (x2, y2)
    const [x3, y3] = pointRotateRads(
      pointFrom(tx, ty),
      pointFrom(xs, ys),
      degreesToRadians(-angle as Degrees),
    );
    const [x4, y4] = pointRotateRads(
      pointFrom(tx, ty),
      pointFrom(xs, ys),
      degreesToRadians(angle),
    );
    return [xs, ys, x3, y3, x4, y4];
  }

  // Return points
  const [x3, y3] = pointRotateRads(
    pointFrom(xs, ys),
    pointFrom(tx, ty),
    ((-angle * Math.PI) / 180) as Radians,
  );
  const [x4, y4] = pointRotateRads(
    pointFrom(xs, ys),
    pointFrom(tx, ty),
    degreesToRadians(angle),
  );

  if (arrowhead === "diamond" || arrowhead === "diamond_outline") {
    // point opposite to the arrowhead point
    let ox;
    let oy;

    if (position === "start") {
      const [px, py] = element.points.length > 1 ? element.points[1] : [0, 0];

      [ox, oy] = pointRotateRads(
        pointFrom(tx + minSize * 2, ty),
        pointFrom(tx, ty),
        Math.atan2(py - ty, px - tx) as Radians,
      );
    } else {
      const [px, py] =
        element.points.length > 1
          ? element.points[element.points.length - 2]
          : [0, 0];

      [ox, oy] = pointRotateRads(
        pointFrom(tx - minSize * 2, ty),
        pointFrom(tx, ty),
        Math.atan2(ty - py, tx - px) as Radians,
      );
    }

    return [tx, ty, x3, y3, ox, oy, x4, y4];
  }

  return [tx, ty, x3, y3, x4, y4];
};

// TODO reuse shape.ts

export const isPathALoop = (
  points: ExcalidrawLinearElement["points"],
  /** supply if you want the loop detection to account for current zoom */
  zoomValue: Zoom["value"] = 1 as NormalizedZoomValue,
): boolean => {
  if (points.length >= 3) {
    const [first, last] = [points[0], points[points.length - 1]];
    const distance = pointDistance(first, last);

    // Adjusting LINE_CONFIRM_THRESHOLD to current zoom so that when zoomed in
    // really close we make the threshold smaller, and vice versa.
    return distance <= LINE_CONFIRM_THRESHOLD / zoomValue;
  }
  return false;
};

export const getCornerRadius = (x: number, element: ExcalidrawElement) => {
  if (
    element.roundness?.type === ROUNDNESS.PROPORTIONAL_RADIUS ||
    element.roundness?.type === ROUNDNESS.LEGACY
  ) {
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

export const LINE_CONFIRM_THRESHOLD = 8; // px

export const THEME = {
  LIGHT: "light",
  DARK: "dark",
} as const;

export const DEFAULT_PROPORTIONAL_RADIUS = 0.25;
// Fixed radius for the ADAPTIVE_RADIUS algorithm. In pixels.

export const DEFAULT_ADAPTIVE_RADIUS = 32;
// roundness type (algorithm)

export const ROUNDNESS = {
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
  ADAPTIVE_RADIUS: 3,
} as const;

export const ROUGHNESS = {
  architect: 0,
  artist: 1,
  cartoonist: 2,
} as const;

export const DEFAULT_STROKE_STREAMLINE = 0.5;

const DARK_MODE_COLORS_CACHE: Map<string, string> | null =
  typeof window !== "undefined" ? new Map() : null;

const DARK_MODE_FILTER_INVERT_PERCENT = 93;

const DARK_MODE_FILTER_HUE_ROTATE_DEGREES = 180 as Degrees;

function cssHueRotate(
  red: number,
  green: number,
  blue: number,
  degrees: Degrees,
): { r: number; g: number; b: number } {
  // normalize
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;

  // Convert degrees to radians
  const a = degreesToRadians(degrees);

  const c = Math.cos(a);
  const s = Math.sin(a);

  // rotation matrix
  const matrix = [
    0.213 + c * 0.787 - s * 0.213,
    0.715 - c * 0.715 - s * 0.715,
    0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143,
    0.715 + c * 0.285 + s * 0.14,
    0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787,
    0.715 - c * 0.715 + s * 0.715,
    0.072 + c * 0.928 + s * 0.072,
  ];

  // transform
  const newR = r * matrix[0] + g * matrix[1] + b * matrix[2];
  const newG = r * matrix[3] + g * matrix[4] + b * matrix[5];
  const newB = r * matrix[6] + g * matrix[7] + b * matrix[8];

  // clamp the values to [0, 1] range and convert back to [0, 255]
  return {
    r: Math.round(Math.max(0, Math.min(1, newR)) * 255),
    g: Math.round(Math.max(0, Math.min(1, newG)) * 255),
    b: Math.round(Math.max(0, Math.min(1, newB)) * 255),
  };
}

const cssInvert = (
  r: number,
  g: number,
  b: number,
  percent: number,
): { r: number; g: number; b: number } => {
  const p = clamp(percent, 0, 100) / 100;

  // Function to invert a single color component
  const invertComponent = (color: number): number => {
    // Apply the invert formula
    const inverted = color * (1 - p) + (255 - color) * p;
    // Round to the nearest integer and clamp to [0, 255]
    return Math.round(clamp(inverted, 0, 255));
  };

  // Calculate the inverted RGB components
  const invertedR = invertComponent(r);
  const invertedG = invertComponent(g);
  const invertedB = invertComponent(b);

  return { r: invertedR, g: invertedG, b: invertedB };
};

export const applyDarkModeFilter = (color: string, enable = true): string => {
  if (!enable) {
    return color;
  }

  const cached = DARK_MODE_COLORS_CACHE?.get(color);
  if (cached) {
    return cached;
  }

  const tc = tinycolor(color);
  const alpha = tc.getAlpha();

  // order of operations matters
  // (corresponds to "filter: invert(invertPercent) hue-rotate(hueDegrees)" in css)
  const rgb = tc.toRgb();
  const inverted = cssInvert(
    rgb.r,
    rgb.g,
    rgb.b,
    DARK_MODE_FILTER_INVERT_PERCENT,
  );
  const rotated = cssHueRotate(
    inverted.r,
    inverted.g,
    inverted.b,
    DARK_MODE_FILTER_HUE_ROTATE_DEGREES,
  );

  const result = rgbToHex(rotated.r, rotated.g, rotated.b, alpha);

  if (DARK_MODE_COLORS_CACHE) {
    DARK_MODE_COLORS_CACHE.set(color, result);
  }

  return result;
};

export const rgbToHex = (r: number, g: number, b: number, a?: number) => {
  // (1 << 24) adds 0x1000000 to ensure the hex string is always 7 chars,
  // then slice(1) removes the leading "1" to get exactly 6 hex digits
  // e.g. rgb(0,0,0) -> 0x1000000 -> "1000000" -> "000000"
  const hex6 = `#${((1 << 24) + (r << 16) + (g << 8) + b)
    .toString(16)
    .slice(1)}`;
  if (a !== undefined && a < 1) {
    // convert alpha from 0-1 float to 0-255 int, then to 2-digit hex
    // e.g. 0.5 -> 128 -> "80"
    const alphaHex = Math.round(a * 255)
      .toString(16)
      .padStart(2, "0");
    return `${hex6}${alphaHex}`;
  }
  return hex6;
};

/**
 * @returns the color with its alpha replaced by `alpha` (as #RRGGBBAA), or the
 *  input unchanged if it's not a valid color
 */

export const isTransparent = (color: string) => {
  return tinycolor(color).getAlpha() === 0;
};

/**
 * Whether the color is fully opaque (alpha exactly 1).
 *
 * NOT the negation of `isTransparent`, which is true only at alpha 0 — a
 * partial-alpha color (`#RRGGBBAA`, `rgba(…, 0.5)`) is neither transparent
 * (it renders) nor opaque (what's beneath shows through it).
 */

export const isEmbeddableElement = <T extends ExcalidrawElement>(
  element: T | null | undefined,
): element is T & ExcalidrawEmbeddableElement => {
  return !!element && element.type === "embeddable";
};

export const isIframeElement = <T extends ExcalidrawElement>(
  element: T | null,
): element is T & ExcalidrawIframeElement => {
  return !!element && element.type === "iframe";
};

export const isIframeLikeElement = <T extends ExcalidrawElement>(
  element: T | null,
): element is T & ExcalidrawIframeLikeElement => {
  return (
    !!element && (element.type === "iframe" || element.type === "embeddable")
  );
};

export const isLinearElement = <T extends ExcalidrawElement>(
  element?: T | null,
): element is T & ExcalidrawLinearElement => {
  return element != null && isLinearElementType(element.type);
};

export const isArrowElement = <T extends ExcalidrawElement>(
  element?: T | null,
): element is T & ExcalidrawArrowElement => {
  return element != null && element.type === "arrow";
};

export const isElbowArrow = <T extends ExcalidrawElement>(
  element?: T,
): element is T & ExcalidrawElbowArrowElement => {
  return isArrowElement(element) && element.elbowed;
};

/**
 * sharp or curved arrow, but not elbow
 */

export const isLinearElementType = (
  elementType: ElementOrToolType,
): boolean => {
  return (
    elementType === "arrow" || elementType === "line" // || elementType === "freedraw"
  );
};

export const canChangeRoundness = (type: ElementOrToolType) =>
  type === "rectangle" ||
  type === "iframe" ||
  type === "embeddable" ||
  type === "line" ||
  type === "diamond" ||
  type === "stickynote" ||
  type === "image";

export const HEADING_RIGHT = [1, 0] as Heading;

export const HEADING_DOWN = [0, 1] as Heading;

export const HEADING_LEFT = [-1, 0] as Heading;

export const HEADING_UP = [0, -1] as Heading;

export const vectorToHeading = (vec: Vector): Heading => {
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

export const headingForPoint = <P extends GlobalPoint | LocalPoint>(
  p: P,
  o: P,
) => vectorToHeading(vectorFromPoint<P>(p, o));

export const headingForPointIsHorizontal = <P extends GlobalPoint | LocalPoint>(
  p: P,
  o: P,
) => headingIsHorizontal(headingForPoint<P>(p, o));

export const compareHeading = (a: Heading, b: Heading) =>
  a[0] === b[0] && a[1] === b[1];

export const headingIsHorizontal = (a: Heading) =>
  compareHeading(a, HEADING_RIGHT) || compareHeading(a, HEADING_LEFT);

export function pointFrom<Point extends GlobalPoint | LocalPoint>(
  x: number,
  y: number,
): Point;
// TODO remove the overload once we migrate to using Point tuples everywhere

export function pointFrom<Coord extends GlobalCoord | LocalCoord>(
  coords: Coord,
): Coord extends GlobalCoord ? GlobalPoint : LocalPoint;
// TODO remove the overload once we migrate to using Point tuples everywhere

export function pointFrom<Point extends GlobalPoint | LocalPoint>(coords: {
  x: number;
  y: number;
}): Point;

export function pointFrom<Point extends GlobalPoint | LocalPoint>(
  xOrCoords: number | { x: number; y: number },
  y?: number,
): Point {
  return typeof xOrCoords === "object"
    ? ([xOrCoords.x, xOrCoords.y] as Point)
    : ([xOrCoords, y!] as Point);
}

/**
 * Converts and remaps an array containing a pair of numbers to Point.
 *
 * @param numberArray The number array to check and to convert to Point
 * @returns The point instance
 */

export function pointFromArray<Point extends GlobalPoint | LocalPoint>(
  numberArray: number[],
): Point | undefined {
  return numberArray.length === 2
    ? pointFrom<Point>(numberArray[0], numberArray[1])
    : undefined;
}

/**
 * Converts and remaps a pair of numbers to Point.
 *
 * @param pair A number pair to convert to Point
 * @returns The point instance
 */

export function pointRotateRads<Point extends GlobalPoint | LocalPoint>(
  point: Point,
  center: Point,
  angle: Radians,
): Point {
  if (!angle) {
    return point;
  }
  const [x, y] = point;
  const [cx, cy] = center;
  return pointFrom(
    (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle) + cx,
    (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle) + cy,
  );
}

/**
 * Rotate a point by [angle] degree.
 *
 * @param point The point to rotate
 * @param center The point to rotate around, the center point
 * @param angle The degree to rotate the point by
 * @returns The rotated point
 */

export function pointDistance<P extends LocalPoint | GlobalPoint>(
  a: P,
  b: P,
): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Calculate the squared distance between two points.
 *
 * Note: Use this if you only compare distances, it saves a square root.
 *
 * @param a First point
 * @param b Second point
 * @returns The euclidean distance between the two points.
 */

export function vector(
  x: number,
  y: number,
  originX: number = 0,
  originY: number = 0,
): Vector {
  return [x - originX, y - originY] as Vector;
}

/**
 * Turn a point into a vector with the origin point.
 *
 * @param p The point to turn into a vector
 * @param origin The origin point in a given coordiante system
 * @param threshold The threshold to consider the vector as 'undefined'
 * @param defaultValue The default value to return if the vector is 'undefined'
 * @returns The created vector from the point and the origin or default
 */

export function vectorFromPoint<Point extends GlobalPoint | LocalPoint>(
  p: Point,
  origin: Point = [0, 0] as Point,
  threshold?: number,
  defaultValue: Vector = [0, 1] as Vector,
): Vector {
  const vec = vector(p[0] - origin[0], p[1] - origin[1]);

  if (threshold && vectorMagnitudeSq(vec) < threshold * threshold) {
    return defaultValue;
  }

  return vec;
}

/**
 * Cross product is a binary operation on two vectors in 2D space.
 * It results in a vector that is perpendicular to both vectors.
 *
 * @param a One of the vectors to use for the directed area calculation
 * @param b The other vector to use for the directed area calculation
 * @returns The directed area value for the two vectos
 */

export function vectorDot(a: Vector, b: Vector) {
  return a[0] * b[0] + a[1] * b[1];
}

/**
 * Determines if the value has the shape of a Vector.
 *
 * @param v The value to test
 * @returns TRUE if the value has the shape and components of a Vectors
 */

export function vectorMagnitudeSq(v: Vector) {
  return v[0] * v[0] + v[1] * v[1];
}

/**
 * Calculates the magnitude of a vector.
 *
 * @param v The vector to measure
 * @returns The scalar magnitude of the vector
 */

export const getCurvePathOps = (shape: Drawable): Op[] => {
  // NOTE (mtolmacs): Temporary fix for extremely large elements
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

// linear

export function degreesToRadians(degrees: Degrees): Radians {
  return ((degrees * Math.PI) / 180) as Radians;
}

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export { _generateElementShape as generateElementShape, RoughGenerator };