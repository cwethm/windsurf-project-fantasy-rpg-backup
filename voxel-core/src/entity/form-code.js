/**
 * Form codes.
 *
 * A form code is a compact, shareable description of a procedurally built
 * body: a body-plan letter followed by `|`-separated features.
 *
 *   Q|bd:L14W8H9|lg:L7T3|hd:L5W4H4|hn:2L3C1|ud|pt:patch,F2EEE6,3A2A20
 *
 *  - `Q`           body plan (see `body-plans.js`)
 *  - `bd:L14W8H9`  feature `bd` with numeric params L=14, W=8, H=9
 *  - `hn:2L3C1`    a leading bare number is the feature's count (`n`)
 *  - `L14~2`       jitter: each individual rolls 14 ± 2 from its seed
 *  - `ud`          a flag feature with default params
 *  - `pt:patch,…`  a word feature: a style word followed by hex colours
 *
 * Numeric units are 1/16 of a block. Parsing and resolution are pure and
 * browser-safe so the client mesh and the server hitbox come from one source.
 */

import { Random, hashCoords, hashString } from '../core/rng.js';
import { BODY_PLANS, FEATURES } from './body-plans.js';

const NUMERIC_TOKEN = /([A-Za-z])(-?\d+(?:\.\d+)?)(?:~(\d+(?:\.\d+)?))?/gy;
const HEX_COLOR = /^[0-9A-Fa-f]{6}$/;
const WORD = /^[a-z][a-z0-9_]*$/;

/**
 * @typedef {{ value: number, jitter: number }} NumericParam
 * @typedef {{ op: string, params: Record<string, NumericParam>, words: string[], colors: string[] }} FormFeature
 * @typedef {{ plan: string, features: FormFeature[] }} ParsedForm
 * @typedef {{ plan: string, scale: number, features: Record<string, { params: Record<string, number>, words: string[], colors: number[] }> }} ResolvedForm
 */

/** @param {string} text */
function parseNumeric(text, op) {
  /** @type {Record<string, NumericParam>} */
  const params = {};
  let rest = text;
  const lead = /^(\d+)(?=[A-Za-z]|$)/.exec(rest);
  if (lead) {
    params.n = { value: Number(lead[1]), jitter: 0 };
    rest = rest.slice(lead[1].length);
  }
  NUMERIC_TOKEN.lastIndex = 0;
  let consumed = 0;
  let match;
  while ((match = NUMERIC_TOKEN.exec(rest)) !== null) {
    params[match[1]] = { value: Number(match[2]), jitter: match[3] ? Number(match[3]) : 0 };
    consumed = NUMERIC_TOKEN.lastIndex;
  }
  if (consumed !== rest.length) throw new SyntaxError(`feature "${op}" has malformed params "${text}"`);
  return params;
}

/**
 * Parse and validate a form code against the registered body plans/features.
 * @param {string} code
 * @returns {ParsedForm}
 */
export function parseFormCode(code) {
  if (typeof code !== 'string' || code.length === 0) throw new SyntaxError('form code must be a non-empty string');
  const [plan, ...parts] = code.split('|');
  const planDef = BODY_PLANS[plan];
  if (!planDef) throw new SyntaxError(`unknown body plan "${plan}"`);

  const features = [];
  const seen = new Set();
  for (const part of parts) {
    const [op, paramText = ''] = part.split(/:(.*)/s);
    const schema = FEATURES[op];
    if (!schema) throw new SyntaxError(`unknown form feature "${op}"`);
    if (!planDef.features.includes(op)) throw new SyntaxError(`feature "${op}" is not part of body plan "${plan}"`);
    if (seen.has(op)) throw new SyntaxError(`feature "${op}" appears twice`);
    seen.add(op);

    const feature = { op, params: {}, words: [], colors: [] };
    if (schema.style) {
      for (const segment of paramText.split(',').filter(Boolean)) {
        if (HEX_COLOR.test(segment)) feature.colors.push(segment.toUpperCase());
        else if (WORD.test(segment) && schema.style.includes(segment)) feature.words.push(segment);
        else throw new SyntaxError(`feature "${op}" does not understand "${segment}"`);
      }
    } else if (paramText) {
      feature.params = parseNumeric(paramText, op);
      for (const key of Object.keys(feature.params)) {
        if (!(key in schema.params)) throw new SyntaxError(`feature "${op}" has no param "${key}"`);
      }
    }
    features.push(feature);
  }
  for (const required of planDef.required) {
    if (!seen.has(required)) throw new SyntaxError(`body plan "${plan}" requires feature "${required}"`);
  }
  return { plan, features };
}

/** Is a string a valid form code? */
export function isValidFormCode(code) {
  try {
    parseFormCode(code);
    return true;
  } catch {
    return false;
  }
}

/**
 * Turn a form code into concrete numbers for one individual: defaults filled
 * in, jitter rolled from `seed`, and every length scaled by `scale`.
 * @param {string|ParsedForm} form
 * @param {{ seed?: number, scale?: number }} [options]
 * @returns {ResolvedForm}
 */
export function resolveForm(form, { seed = 0, scale = 1 } = {}) {
  const parsed = typeof form === 'string' ? parseFormCode(form) : form;
  const rng = new Random(hashCoords(seed >>> 0, hashString(typeof form === 'string' ? form : parsed.plan)));
  const features = {};
  for (const feature of parsed.features) {
    const schema = FEATURES[feature.op];
    const params = {};
    for (const [key, fallback] of Object.entries(schema.params ?? {})) {
      const given = feature.params[key];
      let value = given ? given.value : fallback;
      if (given?.jitter) value += rng.range(-given.jitter, given.jitter);
      params[key] = schema.unscaled?.includes(key) ? Math.round(value) : value * scale;
    }
    features[feature.op] = {
      params,
      words: feature.words.length ? feature.words : [...(schema.style?.slice(0, 1) ?? [])],
      colors: feature.colors.map((hex) => parseInt(hex, 16)),
    };
  }
  return { plan: parsed.plan, scale, features };
}

/**
 * Collision and hit dimensions, in blocks, derived from a resolved form.
 * @param {ResolvedForm} resolved
 * @returns {{ width: number, height: number, length: number, eyeHeight: number }}
 */
export function formDimensions(resolved) {
  return BODY_PLANS[resolved.plan].dimensions(resolved.features);
}
