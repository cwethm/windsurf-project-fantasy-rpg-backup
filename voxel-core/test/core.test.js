import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../src/core/event-bus.js';
import { Registry, HandlerRegistry } from '../src/core/registry.js';
import { Random, WorldSeed, hashString, hashCoords, randomAt } from '../src/core/rng.js';

test('EventBus delivers, unsubscribes and isolates handler errors', () => {
  const bus = new EventBus();
  const seen = [];

  const off = bus.on('tick', (n) => seen.push(n));
  bus.on('tick', () => {
    throw new Error('subscriber blew up');
  });
  const tail = [];
  bus.on('tick', (n) => tail.push(n));

  bus.emit('tick', 1);
  assert.deepEqual(seen, [1]);
  assert.deepEqual(tail, [1], 'a throwing handler must not stop later handlers');

  off();
  bus.emit('tick', 2);
  assert.deepEqual(seen, [1]);
  assert.deepEqual(tail, [1, 2]);
});

test('EventBus once() fires a single time', () => {
  const bus = new EventBus();
  let calls = 0;
  bus.once('x', () => { calls += 1; });
  bus.emit('x');
  bus.emit('x');
  assert.equal(calls, 1);
  assert.equal(bus.listenerCount('x'), 0);
});

test('EVENTS names are unique', () => {
  const values = Object.values(EVENTS);
  assert.equal(new Set(values).size, values.length);
});

test('Registry rejects duplicates, validates and freezes definitions', () => {
  const registry = new Registry('widget', {
    validate(def) {
      if (typeof def.name !== 'string') throw new TypeError('name required');
    },
  });

  const def = registry.register({ id: 1, name: 'alpha', power: 3 });
  assert.equal(registry.get(1).power, 3);
  assert.equal(registry.getByName('alpha').id, 1);
  assert.throws(() => registry.register({ id: 1, name: 'other' }), /already has a definition/);
  assert.throws(() => registry.register({ id: 2, name: 'alpha' }), /already has a definition named/);
  assert.throws(() => registry.register({ id: 3 }), /name required/);
  assert.throws(() => registry.register({ name: 'no-id' }), /missing "id"/);

  assert.throws(() => { 'use strict'; def.power = 99; }, TypeError);
  assert.equal(registry.require(1).power, 3);
  assert.throws(() => registry.require(42), /Unknown widget id/);

  registry.freeze();
  assert.throws(() => registry.register({ id: 9, name: 'late' }), /frozen/);
});

test('HandlerRegistry dispatches, falls back and reports misses', () => {
  const handlers = new HandlerRegistry('use');
  handlers.register('consume', (ctx) => ({ ok: true, ctx }));
  assert.deepEqual(handlers.dispatch('consume', 7), { ok: true, ctx: 7 });

  const miss = handlers.dispatch('unknown');
  assert.equal(miss.ok, false);
  assert.match(miss.reason, /no use handler/);

  const withFallback = new HandlerRegistry('use', () => ({ ok: true, fallback: true }));
  assert.deepEqual(withFallback.dispatch('anything'), { ok: true, fallback: true });
});

test('Random is deterministic and reproducible from a seed', () => {
  const a = new Random(1234);
  const b = new Random(1234);
  const first = Array.from({ length: 16 }, () => a.next());
  const second = Array.from({ length: 16 }, () => b.next());
  assert.deepEqual(first, second);
  assert.ok(first.every((v) => v >= 0 && v < 1));

  a.reset();
  assert.equal(a.next(), first[0]);

  const other = new Random(1235);
  assert.notEqual(other.next(), first[0]);
});

test('Random helpers stay in range', () => {
  const rng = new Random('helpers');
  for (let i = 0; i < 500; i++) {
    const n = rng.int(3, 7);
    assert.ok(Number.isInteger(n) && n >= 3 && n <= 7);
    const f = rng.range(-2, 2);
    assert.ok(f >= -2 && f < 2);
  }
  assert.equal(rng.pick([]), undefined);
  assert.equal(rng.pick(['only']), 'only');
  assert.equal(rng.pickWeighted([{ item: 'a', weight: 0 }]), undefined);
  assert.equal(rng.pickWeighted([{ item: 'a', weight: 1 }]).item, 'a');
});

test('pickWeighted respects weights', () => {
  const rng = new Random('weights');
  const entries = [{ id: 'common', weight: 9 }, { id: 'rare', weight: 1 }];
  let rare = 0;
  const trials = 5000;
  for (let i = 0; i < trials; i++) {
    if (rng.pickWeighted(entries).id === 'rare') rare += 1;
  }
  const ratio = rare / trials;
  assert.ok(ratio > 0.05 && ratio < 0.15, `rare ratio out of band: ${ratio}`);
});

test('coordinate hashing is stable and position dependent', () => {
  assert.equal(hashCoords(1, 5, 9), hashCoords(1, 5, 9));
  assert.notEqual(hashCoords(1, 5, 9), hashCoords(1, 9, 5));
  assert.notEqual(hashCoords(2, 5, 9), hashCoords(1, 5, 9));
  assert.equal(hashString('seed'), hashString('seed'));
  const r = randomAt(7, -3, 12);
  assert.ok(r >= 0 && r < 1);
  assert.equal(r, randomAt(7, -3, 12));
});

test('WorldSeed derives stable, independent layer seeds', () => {
  const seed = new WorldSeed('my-world');
  const same = new WorldSeed('my-world');
  assert.equal(seed.layer('height'), same.layer('height'));
  assert.notEqual(seed.layer('height'), seed.layer('biome'));
  assert.equal(seed.chunk('height', 2, -3), same.chunk('height', 2, -3));
  assert.notEqual(seed.chunk('height', 2, -3), seed.chunk('height', -3, 2));

  const rngA = seed.chunkRandom('flora', 0, 0);
  const rngB = same.chunkRandom('flora', 0, 0);
  assert.equal(rngA.next(), rngB.next());
});
