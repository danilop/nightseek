import { expect, test } from '@playwright/test';

const MOCK_LOCATION = {
  name: 'Test Location',
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
};

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

  test('shares framing and imaging windows between compact cards and detail', async ({ page }) => {
    await page.locator('button[role="tab"]:visible', { hasText: 'Targets' }).click();
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
    const name = await card.getByRole('heading').innerText();
    const window = await card.getByTestId('imaging-window-summary').innerText();
    const ratingColor = await card
      .getByRole('img', { name: /Target suitability:/ })
      .evaluate(el => getComputedStyle(el).color);
    await card.click();
    const detail = page.getByRole('dialog', { name });
    await expect(detail).toBeVisible();
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
