import * as R from 'ramda';

import isSvg from '../node/isSvg';
import matchPercent from '../utils/matchPercent';

const STYLE_PROPS = [
  'width',
  'height',
  'color',
  'stroke',
  'strokeWidth',
  'opacity',
  'fillOpacity',
  'strokeOpacity',
  'fill',
  'fillRule',
  'transform',
  'strokeLinejoin',
  'strokeLinecap',
  'strokeDasharray',
];

const VERTICAL_PROPS = ['y', 'y1', 'y2', 'height', 'cy', 'ry'];
const HORIZONTAL_PROPS = ['x', 'x1', 'x2', 'width', 'cx', 'rx'];

const pickStyleProps = node => {
  const styleProps = R.o(R.pick(STYLE_PROPS), R.propOr({}, 'props'))(node);
  return R.evolve({ style: R.merge(styleProps) }, node);
};

const isOdd = x => x % 2 !== 0;
const lengthIsOdd = R.o(isOdd, R.prop('length'));

const parsePoints = R.compose(
  R.splitEvery(2),
  R.map(parseFloat),
  R.when(lengthIsOdd, R.slice(0, -1)),
  R.split(/\s+/),
  R.replace(/(\d)-(\d)/g, '$1 -$2'),
  R.replace(/,/g, ' '),
  R.trim,
);

const parseAspectRatio = value => {
  const match = value
    .replace(/[\s\r\t\n]+/gm, ' ')
    .replace(/^defer\s/, '')
    .split(' ');

  const align = match[0] || 'xMidYMid';
  const meetOrSlice = match[1] || 'meet';

  return { align, meetOrSlice };
};

const parseViewbox = value => {
  const values = value.split(/[,\s]+/).map(parseFloat);
  if (values.length !== 4) return null;
  return { minX: values[0], minY: values[1], maxX: values[2], maxY: values[3] };
};

const parseSvgProps = R.evolve({
  props: R.evolve({
    viewBox: parseViewbox,
    preserveAspectRatio: parseAspectRatio,
  }),
});

const transformPercent = container =>
  R.mapObjIndexed((value, key) => {
    const match = matchPercent(value);

    if (match && VERTICAL_PROPS.includes(key)) {
      return match.percent * container.height;
    }

    if (match && HORIZONTAL_PROPS.includes(key)) {
      return match.percent * container.width;
    }

    return value;
  });

const parseProps = container =>
  R.compose(
    R.evolve({
      props: R.o(
        R.evolve({
          x: parseFloat,
          x1: parseFloat,
          x2: parseFloat,
          y: parseFloat,
          y1: parseFloat,
          y2: parseFloat,
          r: parseFloat,
          rx: parseFloat,
          ry: parseFloat,
          cx: parseFloat,
          cy: parseFloat,
          points: parsePoints,
        }),
        transformPercent(container),
      ),
    }),
  );

const resolveSvgNode = container => node =>
  R.compose(
    R.evolve({ children: R.map(resolveSvgNode(container)) }),
    pickStyleProps,
    parseProps(container),
  )(node);

const getRootContainer = R.compose(
  R.map(parseFloat),
  R.pick(['width', 'height']),
  R.prop('props'),
);

const resolveSvgRoot = node => {
  const container = getRootContainer(node);

  return R.compose(
    R.evolve({ children: R.map(resolveSvgNode(container)) }),
    pickStyleProps,
    parseSvgProps,
  )(node);
};

const resolveSvgChildren = node =>
  R.compose(
    R.evolve({ children: R.map(resolveSvgChildren) }),
    R.when(isSvg, resolveSvgRoot),
  )(node);

export default resolveSvgChildren;
