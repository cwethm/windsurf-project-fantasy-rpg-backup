/**
 * Body plans and form features.
 *
 * A body plan is a skeleton family (bone names, which features it accepts and
 * how its hitbox is derived). A feature is a named, parameterised piece of
 * that body; `params` lists each numeric parameter with its default, in 1/16
 * block units unless listed in `unscaled`. Features with `style` take a style
 * word plus hex colours instead of numbers.
 *
 * The client turns the same resolved features into meshes, so adding a plan or
 * feature is a table entry here plus a builder in `client/js/entity-view.js`.
 */

/** @type {Record<string, { params?: Record<string, number>, unscaled?: string[], style?: string[] }>} */
export const FEATURES = {
  bd: { params: { L: 14, W: 8, H: 8 } },          // body length, width, height
  lg: { params: { L: 7, T: 3 } },                 // leg length, thickness
  nk: { params: { L: 3, A: 20 } },                // neck length, upward angle (degrees)
  hd: { params: { L: 5, W: 4, H: 4 } },           // head
  sn: { params: { L: 2 } },                       // snout / muzzle
  hn: { params: { n: 2, L: 3, C: 0 }, unscaled: ['n', 'C'] },  // horns: count, length, curl
  an: { params: { n: 3, L: 6 }, unscaled: ['n'] },               // antlers: tines, length
  ea: { params: { n: 2, L: 2 }, unscaled: ['n'] },               // ears
  tl: { params: { L: 6, T: 1 } },                 // tail
  ud: { params: {} },                             // udder
  mn: { params: { L: 4 } },                       // mane
  fl: { params: { D: 2 } },                       // fleece thickness
  pt: { style: ['solid', 'patch', 'spot', 'stripe'] },  // pattern + colours
};

const deg = (a) => (a * Math.PI) / 180;
const p = (features, op, key, fallback = 0) => features[op]?.params[key] ?? fallback;

/** @type {Record<string, { name: string, features: string[], required: string[], bones: string[], dimensions: (f: object) => { width: number, height: number, length: number, eyeHeight: number } }>} */
export const BODY_PLANS = {
  Q: {
    name: 'large quadruped',
    features: ['bd', 'lg', 'nk', 'hd', 'sn', 'hn', 'an', 'ea', 'tl', 'ud', 'mn', 'fl', 'pt'],
    required: ['bd', 'lg', 'hd'],
    bones: ['root', 'body', 'neck', 'head', 'leg_fl', 'leg_fr', 'leg_bl', 'leg_br', 'tail'],
    dimensions(f) {
      const fleece = p(f, 'fl', 'D');
      const neckRise = p(f, 'nk', 'L') * Math.sin(deg(p(f, 'nk', 'A')));
      const neckReach = p(f, 'nk', 'L') * Math.cos(deg(p(f, 'nk', 'A')));
      const legs = p(f, 'lg', 'L');
      const body = p(f, 'bd', 'H') + fleece * 2;
      const head = p(f, 'hd', 'H');
      const height = (legs + body + Math.max(0, neckRise + head / 2)) / 16;
      return {
        width: Math.min(0.95, Math.max(0.3, (p(f, 'bd', 'W') + fleece * 2) / 16)),
        height: Math.max(0.4, height),
        length: (p(f, 'bd', 'L') + neckReach + p(f, 'hd', 'L') * 0.6) / 16,
        eyeHeight: Math.max(0.3, height - (head * 0.35) / 16),
      };
    },
  },
};
