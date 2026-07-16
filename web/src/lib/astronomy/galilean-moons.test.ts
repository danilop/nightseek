import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { createMockNightInfo } from '@/test/factories';
import { AU_TO_KM } from './constants';
import { getGalileanMoonPositions, getJupiterMoonsData } from './galilean-moons';

describe('Galilean moon geometry', () => {
  it('uses light-time-corrected EQJ vectors and a positive-west sky axis', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    const apparentJupiter = Astronomy.BackdatePosition(
      date,
      Astronomy.Body.Earth,
      Astronomy.Body.Jupiter,
      true
    );
    const jupiter = Astronomy.EquatorFromVector(apparentJupiter);
    const ra = (jupiter.ra * 15 * Math.PI) / 180;
    const east = { x: -Math.sin(ra), y: Math.cos(ra), z: 0 };
    const radiusAu = Astronomy.JUPITER_EQUATORIAL_RADIUS_KM / AU_TO_KM;
    const correctedIo = Astronomy.JupiterMoons(apparentJupiter.t).io;
    const instantaneousIo = Astronomy.JupiterMoons(date).io;
    const expectedWest =
      -(correctedIo.x * east.x + correctedIo.y * east.y + correctedIo.z * east.z) / radiusAu;
    const instantaneousWest =
      -(instantaneousIo.x * east.x + instantaneousIo.y * east.y + instantaneousIo.z * east.z) /
      radiusAu;
    const io = getGalileanMoonPositions(date).find(moon => moon.name === 'Io');

    expect(io).toBeDefined();
    expect(io?.x).toBeCloseTo(expectedWest, 12);
    expect(Math.abs((io?.x ?? 0) - instantaneousWest)).toBeGreaterThan(0.01);
    expect(apparentJupiter.t.date.getTime()).toBeLessThan(date.getTime());
  });

  it('preserves each jovicentric distance under sky-plane projection', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    const apparentJupiter = Astronomy.BackdatePosition(
      date,
      Astronomy.Body.Earth,
      Astronomy.Body.Jupiter,
      true
    );
    const states = Astronomy.JupiterMoons(apparentJupiter.t);
    const length = (state: Astronomy.StateVector) => Math.hypot(state.x, state.y, state.z);
    const expectedByName = {
      Io: length(states.io),
      Europa: length(states.europa),
      Ganymede: length(states.ganymede),
      Callisto: length(states.callisto),
    };
    const radiusAu = Astronomy.JUPITER_EQUATORIAL_RADIUS_KM / AU_TO_KM;

    for (const position of getGalileanMoonPositions(date)) {
      const projectedRadius = Math.hypot(position.x, position.y, position.z);
      expect(projectedRadius).toBeCloseTo(expectedByName[position.name] / radiusAu, 10);
      if (position.shadowOnJupiter) {
        expect(position.shadowX).not.toBeNull();
        expect(Math.hypot(position.shadowX ?? 2, position.shadowY ?? 2)).toBeLessThanOrEqual(1.001);
      }
    }
  });

  it('does not invent events when the selected date has no astronomical darkness', () => {
    const nightInfo = createMockNightInfo({
      astronomicalNightMode: 'none',
      observingWindowMode: 'none',
      astronomicalDusk: new Date('2026-06-21T12:00:00Z'),
      astronomicalDawn: new Date('2026-06-21T12:00:00Z'),
    });

    expect(getJupiterMoonsData(nightInfo, true)).toBeNull();
  });

  it('refines reported event times to actual state transitions', () => {
    let data: ReturnType<typeof getJupiterMoonsData> = null;
    for (let day = 1; day <= 7 && !data?.events.length; day++) {
      const dusk = new Date(Date.UTC(2026, 0, day, 18));
      const nightInfo = createMockNightInfo({
        date: dusk,
        astronomicalDusk: dusk,
        astronomicalDawn: new Date(dusk.getTime() + 12 * 60 * 60 * 1000),
      });
      data = getJupiterMoonsData(nightInfo, true);
    }

    expect(data?.events.length).toBeGreaterThan(0);
    for (const event of data?.events ?? []) {
      const state = event.type.startsWith('transit') ? 'isTransiting' : 'shadowOnJupiter';
      const before = getGalileanMoonPositions(new Date(event.time.getTime() - 1500)).find(
        moon => moon.name === event.moon
      );
      const after = getGalileanMoonPositions(new Date(event.time.getTime() + 1500)).find(
        moon => moon.name === event.moon
      );
      expect(before?.[state]).not.toBe(after?.[state]);
      expect(after?.[state]).toBe(event.type.endsWith('start'));
    }
  });
});
