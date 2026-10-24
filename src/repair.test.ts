import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAverageGrade } from './grades';

test('returns 0 when scores array is empty', () => {
  assert.equal(computeAverageGrade([], 0), 0);
});

test('returns 0 when totalStudents is zero', () => {
  assert.equal(computeAverageGrade([90, 80], 0), 0);
});

test('returns 0 when totalStudents is negative', () => {
  assert.equal(computeAverageGrade([90, 80], -2), 0);
});

test('calculates correct average for positive scores and student count', () => {
  assert.equal(computeAverageGrade([90, 80], 2), 85);
});
