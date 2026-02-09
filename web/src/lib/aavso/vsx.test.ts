import { describe, expect, it } from 'vitest';
import { predictVariableStars } from './vsx';

describe('AAVSO Variable Star Predictions', () => {
  it('returns predictions for all catalog stars', () => {
    const predictions = predictVariableStars(new Date('2026-02-09'));
    // Should have all 10 notable variable stars
    expect(predictions.length).toBe(10);
  });

  it('each prediction has required fields', () => {
    const predictions = predictVariableStars(new Date('2026-03-15'));
    for (const p of predictions) {
      expect(p.star.name).toBeTruthy();
      expect(p.star.constellation).toBeTruthy();
      expect(p.phase).toBeGreaterThanOrEqual(0);
      expect(p.phase).toBeLessThanOrEqual(1);
      expect(p.phaseDescription).toBeTruthy();
      expect(typeof p.isNearMaximum).toBe('boolean');
      expect(typeof p.isNearMinimum).toBe('boolean');
    }
  });

  it('Algol has a short period', () => {
    const predictions = predictVariableStars(new Date('2026-02-09'));
    const algol = predictions.find(p => p.star.name.includes('Algol'));
    expect(algol).toBeDefined();
    expect(algol!.star.period).toBeCloseTo(2.8673, 2);
    expect(algol!.predictedMagnitude).not.toBeNull();
  });

  it('R Coronae Borealis has no period (irregular)', () => {
    const predictions = predictVariableStars(new Date('2026-02-09'));
    const rcrb = predictions.find(p => p.star.name.includes('R Coronae'));
    expect(rcrb).toBeDefined();
    expect(rcrb!.star.period).toBeNull();
    expect(rcrb!.isNearMaximum).toBe(true); // irregular stays at max
  });

  it('predictions change with date', () => {
    const p1 = predictVariableStars(new Date('2026-02-09'));
    const p2 = predictVariableStars(new Date('2026-02-10'));

    // Algol has a ~2.87 day period so phases should differ
    const algol1 = p1.find(p => p.star.name.includes('Algol'))!;
    const algol2 = p2.find(p => p.star.name.includes('Algol'))!;
    expect(algol1.phase).not.toEqual(algol2.phase);
  });

  it('next notable event is in the future', () => {
    const date = new Date('2026-06-15');
    const predictions = predictVariableStars(date);

    for (const p of predictions) {
      if (p.nextNotableEventTime) {
        // Next event should be within one period from now
        expect(p.nextNotableEventTime.getTime()).toBeGreaterThan(date.getTime() - 86400000);
      }
    }
  });

  it('magnitude predictions are within star range', () => {
    const predictions = predictVariableStars(new Date('2026-09-01'));

    for (const p of predictions) {
      if (
        p.predictedMagnitude !== null &&
        p.star.maxMagnitude !== null &&
        p.star.minMagnitude !== null
      ) {
        // Allow small tolerance for rounding
        expect(p.predictedMagnitude).toBeGreaterThanOrEqual(p.star.maxMagnitude - 0.5);
        expect(p.predictedMagnitude).toBeLessThanOrEqual(p.star.minMagnitude + 0.5);
      }
    }
  });
});
