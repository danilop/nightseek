import { expect, test } from '@playwright/test';

const MOCK_LOCATION = {
  name: 'Test Location',
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
};

async function mockWeather(page: import('@playwright/test').Page): Promise<void> {
  const first = Date.parse('2026-11-01T00:00:00Z');
  const time = Array.from({ length: 72 }, (_, index) => (first + index * 3600000) / 1000);
  await page.route('https://api.open-meteo.com/v1/forecast?*', route =>
    route.fulfill({
      json: {
        timezone: 'Europe/London',
        hourly: {
          time,
          cloud_cover: time.map(t =>
            [19, 20, 22, 23, 0, 2, 3, 4].includes(new Date(t * 1000).getUTCHours()) ? 0 : 95
          ),
          wind_speed_10m: time.map(() => 5),
          wind_gusts_10m: time.map(() => 7),
          relative_humidity_2m: time.map(() => 50),
          temperature_2m: time.map(() => 10),
          dew_point_2m: time.map(() => 0),
          precipitation: time.map(() => 0),
          precipitation_probability: time.map(() => 0),
          visibility: time.map(() => 20000),
        },
      },
    })
  );
}

async function seedLocation(
  page: import('@playwright/test').Page,
  location: typeof MOCK_LOCATION = MOCK_LOCATION
): Promise<void> {
  await page.goto('/');
  await page.evaluate(async location => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('keyval-store', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('keyval')) {
          request.result.createObjectStore('keyval');
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction('keyval', 'readwrite');
        transaction.objectStore('keyval').put(
          {
            data: location,
            timestamp: Date.now(),
          },
          'nightseek:location'
        );
        transaction.oncomplete = () => {
          request.result.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
    localStorage.setItem('nightseek:onboarded', 'true');
    localStorage.setItem('nightseek:settings', JSON.stringify({ forecastDays: 2 }));
  }, location);
}

test.describe('Forecast Generation', () => {
  test.describe.configure({ timeout: 90000 });

  test.beforeEach(async ({ page }) => {
    await seedLocation(page);
  });

  test('should show loading screen during forecast generation', async ({ page }) => {
    await page.goto('/');

    // The loading screen might flash quickly, so we check for any loading indicators
    const loadingIndicators = page.getByText(/loading|generating|calculating|starting/i);

    // Either loading is visible or forecast is already shown
    try {
      await expect(loadingIndicators.first()).toBeVisible({ timeout: 2000 });
    } catch {
      // If loading is too fast, forecast should be visible
      const forecast = page.getByText(/tonight|observation|forecast/i);
      await expect(forecast.first()).toBeVisible();
    }
  });

  test('should display weather information', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('forecast-view')).toBeVisible({ timeout: 60000 });

    // Check for weather-related content (moon, clouds, etc.)
    const weatherContent = page.getByText(/moon|cloud|weather|clear|condition/i);
    await expect(weatherContent.first()).toBeVisible({ timeout: 30000 });
  });

  test('should display astronomical objects', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('forecast-view')).toBeVisible({ timeout: 60000 });
    await page.locator('button[role="tab"]:visible', { hasText: 'Targets' }).click();
    await expect(page.locator('[data-testid="object-card"]:visible').first()).toBeVisible({
      timeout: 30000,
    });
  });
});

test.describe('Error Handling', () => {
  test('should show error message when forecast fails', async ({ page }) => {
    await seedLocation(page, {
      ...MOCK_LOCATION,
      latitude: 999,
      longitude: 999,
    });

    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText('Something went wrong', { timeout: 30000 });
  });

  test('should have retry button on error', async ({ page }) => {
    await seedLocation(page, {
      ...MOCK_LOCATION,
      latitude: 999,
      longitude: 999,
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeEnabled({ timeout: 30000 });
  });
});

test.describe('Night Selection', () => {
  test('should allow selecting different nights', async ({ page }) => {
    test.setTimeout(90000);
    await seedLocation(page);

    await page.goto('/');

    await expect(page.getByTestId('forecast-view')).toBeVisible({ timeout: 60000 });
    const nightSelectors = page
      .getByRole('listbox', { name: 'Night selection' })
      .getByRole('option');
    await expect(nightSelectors).toHaveCount(2, { timeout: 30000 });
    await nightSelectors.nth(1).click();
    await expect(nightSelectors.nth(1)).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Eclipse presentation', () => {
  test('shows local solar circumstances visually and safely', async ({ page }) => {
    test.setTimeout(90000);
    await page.clock.setFixedTime(new Date('2026-08-12T12:00:00Z'));
    await seedLocation(page, {
      name: 'London',
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: 'Europe/London',
    });

    await page.goto('/');
    await expect(page.getByTestId('forecast-view')).toBeVisible({ timeout: 60000 });
    await page.locator('button[role="tab"]:visible', { hasText: 'Events' }).click();

    await expect(page.getByText('Partial Solar Eclipse', { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole('img', { name: /maximum visible solar coverage/i })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Eclipse timeline' })).toBeVisible();
    await expect(page.getByText(/Sun 10° high at visible maximum/)).toBeVisible();
    await expect(page.getByText(/ISO 12312-2/)).toBeVisible();
  });
});

test.describe('Visual summaries and progressive disclosure', () => {
  test.beforeEach(async ({ page }) => {
    await mockWeather(page);
    test.setTimeout(90000);
    await page.clock.setFixedTime(new Date('2026-11-01T12:00:00Z'));
    await seedLocation(page, {
      name: 'London',
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: 'Europe/London',
    });
    await page.evaluate(() => {
      localStorage.setItem(
        'nightseek:settings',
        JSON.stringify({ forecastDays: 2, telescope: 'dwarf_mini' })
      );
    });
    await page.goto('/');
    await expect(page.getByTestId('forecast-view')).toBeVisible({ timeout: 60000 });
  });

  test('leads with night conditions and reveals explanations on demand', async ({ page }) => {
    const night = page.getByRole('region', { name: 'Night conditions', exact: true });
    await expect(night).toBeVisible();
    await expect(night.getByRole('slider', { name: 'Night timeline scrubber' })).toBeVisible();
    const explain = page.getByRole('button', { name: 'Why this night rating?', exact: true });
    await expect(explain).toHaveAttribute('aria-expanded', 'false');
    await explain.click();
    await expect(page.getByText(/Whole-night average/)).toBeVisible();
    await explain.click();
    await expect(page.getByText(/Whole-night average/)).toHaveCount(0);
    const evidence = page.getByRole('button', { name: /^Forecast evidence/ });
    await expect(evidence).toHaveAttribute('aria-expanded', 'false');
    await evidence.click();
    await expect(
      page.getByRole('button', { name: 'Compare free weather forecasts' })
    ).toBeVisible();
  });

  test('keeps the magnitude filter visible and filters target cards', async ({ page }) => {
    await page.locator('button[role="tab"]:visible', { hasText: 'Targets' }).click();
    const slider = page.getByRole('slider', { name: 'Magnitude limit', exact: true });
    await expect(slider).toBeVisible();
    await slider.press('Home');
    const min = Number(await slider.getAttribute('min'));
    for (let value = min; value < 6; value += 0.5) await slider.press('ArrowRight');
    await expect(slider).toHaveValue('6');
    const cards = page.getByTestId('object-card');
    await expect(cards.first()).toBeVisible();
    for (const card of await cards.all()) {
      const label = await card.getByTestId('target-magnitude').innerText();
      const value = Number(label.match(/mag (-?\d+(?:\.\d+)?)/)?.[1]);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeLessThanOrEqual(6);
    }
    await page.reload();
    await expect(page.getByTestId('forecast-view')).toBeVisible({ timeout: 60000 });
    await page.locator('button[role="tab"]:visible', { hasText: 'Targets' }).click();
    await expect(page.getByRole('slider', { name: 'Magnitude limit', exact: true })).toHaveValue(
      '6'
    );
  });

  test('shares an active limit with search and restores unknowns when cleared', async ({
    page,
  }) => {
    await page.locator('button[role="tab"]:visible', { hasText: 'Targets' }).click();
    const slider = page.getByRole('slider', { name: 'Magnitude limit', exact: true });
    await slider.press('Home');
    await slider.press('End');
    await expect(page.getByRole('button', { name: 'Clear magnitude filter' })).toBeVisible();
    await page.locator('button[role="tab"]:visible', { hasText: 'Overview' }).click();
    await expect(page.getByRole('button', { name: 'Clear magnitude filter' })).toBeVisible();
    await page.getByRole('button', { name: 'Search objects', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Search objects', { exact: false }).fill('IC0341');
    await expect(dialog.getByText(/No targets match/)).toBeVisible({ timeout: 30000 });
    await dialog.getByRole('button', { name: 'Clear magnitude filter' }).click();
    await expect(dialog.getByText('mag unknown', { exact: true }).first()).toBeVisible({
      timeout: 30000,
    });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.locator('button[role="tab"]:visible', { hasText: 'Targets' }).click();
    await expect(page.getByText('All magnitudes', { exact: true })).toBeVisible();
  });

  test('keeps sidereal time visually separated and identical across views', async ({ page }) => {
    await page.getByRole('button', { name: /^Weather details/ }).click();
    await page.getByRole('button', { name: 'Weather conditions', exact: true }).click();
    const card = page.getByTestId('sidereal-time');
    const value = await card.locator('dd').innerText();
    await expect(card.locator('dt')).toContainText('Local sidereal time');
    await expect(card.locator('dd')).toBeVisible();
    const term = await card.locator('dt').boundingBox();
    const definition = await card.locator('dd').boundingBox();
    expect(term).not.toBeNull();
    expect(definition).not.toBeNull();
    expect(
      definition!.x >= term!.x + term!.width + 8 || definition!.y >= term!.y + term!.height + 8
    ).toBe(true);
    await page.locator('button[role="tab"]:visible', { hasText: 'Sky' }).click();
    await page.getByRole('button', { name: /^Sky coordinates/ }).click();
    await expect(page.getByTestId('sidereal-time').locator('dd')).toHaveText(value);
  });

  test('shares framing and imaging windows between compact cards and detail', async ({ page }) => {
    await page.locator('button[role="tab"]:visible', { hasText: 'Targets' }).click();
    await expect(page.getByRole('slider', { name: 'Magnitude limit', exact: true })).toBeVisible();
    const setup = page.getByRole('button', { name: /^Equipment & sky access/ });
    await expect(setup).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('slider', { name: 'Minimum target altitude' })).toHaveCount(0);
    await setup.click();
    await expect(page.getByRole('slider', { name: 'Minimum target altitude' })).toBeVisible();
    await setup.click();
    const card = page
      .getByTestId('object-card')
      .filter({ has: page.getByTestId('target-frame') })
      .first();
    await expect(card).toBeVisible({ timeout: 30000 });
    const magnitude = await card.getByTestId('target-magnitude').innerText();
    await expect(card.getByTestId('target-magnitude')).toBeVisible();
    const name = await card.getByRole('heading').innerText();
    const window = await card.getByTestId('imaging-window-summary').innerText();
    const ratingColor = await card
      .getByRole('img', { name: /Target suitability:/ })
      .evaluate(el => getComputedStyle(el).color);
    await card.click();
    const detail = page.getByRole('dialog', { name });
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId('target-magnitude').first()).toHaveText(magnitude, {
      useInnerText: true,
    });
    await expect(detail.getByTestId('imaging-window-summary')).toHaveText(window, {
      useInnerText: true,
    });
    await expect(detail.locator('.star-rating')).toHaveCSS('color', ratingColor);
    await expect(detail.getByRole('button', { name: 'Why this target rating?' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(
      detail.getByRole('button', { name: /Star field & survey imagery/ })
    ).toHaveAttribute('aria-expanded', 'false');
    await expect(detail.getByText(/Schematic · long axes aligned/)).toBeVisible();
    await detail.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(detail).not.toBeVisible();
    await page.locator('button[role="tab"]:visible', { hasText: 'Sky' }).click();
    await expect(page.getByRole('button', { name: /^Sky chart/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });
});

test('shows separated usable periods and inspects one without expanding explanations', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00Z'));
  await mockWeather(page);
  await seedLocation(page, {
    name: 'London',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
  });
  await page.goto('/');
  const night = page.getByRole('region', { name: 'Night conditions', exact: true });
  await expect(night).toBeVisible({ timeout: 60000 });
  await expect(night.getByTestId('observing-window-segment')).toHaveCount(3);
  await expect(night.getByText(/^Recommended ·/)).toBeVisible();
  await night.getByRole('button', { name: /Inspect period 2/ }).click();
  await expect(night.getByRole('slider', { name: 'Night timeline scrubber' })).toHaveAttribute(
    'aria-valuetext',
    /11:30 PM/
  );
  await expect(night.getByRole('button', { name: 'Why this night rating?' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
});
