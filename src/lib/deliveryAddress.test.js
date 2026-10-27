// The optional delivery address: present-or-absent honest, checked
// locally only — nothing here ever calls out, and a blank form is simply
// no address, not a broken one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyDelivery,
  addressFromForm,
  deliveryMisses,
  addressMisses,
  addressWords,
} from './deliveryAddress.js';

test('address: a good form passes and maps to the shared field shape', () => {
  const form = {
    name: 'Sam Taylor', street: '12 Ash Row', city: 'Springfield',
    state: 'IL', postalCode: '62704', country: 'US',
  };
  assert.deepEqual(deliveryMisses(form), []);
  const shape = addressFromForm(form);
  assert.deepEqual(shape, {
    name: 'Sam Taylor', lines: ['12 Ash Row'], city: 'Springfield',
    region: 'IL', postal: '62704', country: 'US',
  });
});

test('address: one miss per broken field, in form order', () => {
  const misses = deliveryMisses(emptyDelivery());
  assert.deepEqual(misses.map((miss) => miss.field),
    ['name', 'street', 'city', 'state', 'postalCode'],
    'a blank form names what is missing — the US default stands, absence is not breakage');
  // a cleared country is its own miss
  assert.deepEqual(
    deliveryMisses({ ...emptyDelivery(), country: '' }).map((miss) => miss.field).pop(),
    'country',
  );
});

test('address: US shapes are checked, US written recognizably still counts', () => {
  const base = {
    name: 'Sam Taylor', street: '12 Ash Row', city: 'Springfield',
    state: 'ILLINOIS', postalCode: '627041', country: 'US',
  };
  assert.deepEqual(
    deliveryMisses(base).map((miss) => miss.field), ['state', 'postalCode'],
    'long state and six-digit postal refuse under the US rules');
  assert.deepEqual(deliveryMisses({ ...base, country: 'United States of America' }).map((miss) => miss.field),
    ['state', 'postalCode'], 'the long name still earns the US checks');
});

test('address: the reading side re-checks the field shape it was handed', () => {
  assert.deepEqual(addressMisses({ name: 'x' }).map((miss) => miss.field),
    ['street', 'city', 'state', 'postalCode', 'country']);
  assert.equal(addressMisses(null).length, 6, 'absence checks as absence');
  const good = addressFromForm({
    name: 'Sam Taylor', street: '12 Ash Row', city: 'Springfield',
    state: 'IL', postalCode: '62704', country: 'US',
  });
  assert.deepEqual(addressMisses(good), [], 'a good shape re-checks clean');
});

test('address: the words read one line per line, nothing blank', () => {
  const good = addressFromForm({
    name: 'Sam Taylor', street: '12 Ash Row', city: 'Springfield',
    state: 'IL', postalCode: '62704', country: 'US',
  });
  assert.deepEqual(addressWords(good),
    ['Sam Taylor', '12 Ash Row', 'Springfield', 'IL 62704', 'US']);
});
