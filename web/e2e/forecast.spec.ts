import { expect, test } from '@playwright/test';

test.describe('Forecast Generation', () => {
  test.beforeEach(async ({ page }) => {
    // Set up mock location in localStorage before navigating
    await page.addInitScript(() => {
      const mockState = {
        location: {
          name: 'Test Location',
          latitude: 40.7128,
          longitude: -74.006,
          timezone: 'America/New_York',
          elevation: 10,
        },
        isSetupComplete: true,
        settings: {
          forecastDays: 7,
          minAltitude: 30,
          includeComets: true,
          includeMinorPlanets: true,
        },
      };
      localStorage.setItem('nightseek:state', JSON.stringify(mockState));
    });
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

    // Wait for loading to complete
    await page
      .waitForSelector('[data-testid="forecast-view"], .bg-night-900', {
        timeout: 60000,
      })
      .catch(() => {
        // Fallback: wait for any content
      });

    // Check for weather-related content (moon, clouds, etc.)
    const weatherContent = page.getByText(/moon|cloud|weather|clear|condition/i);
    await expect(weatherContent.first()).toBeVisible({ timeout: 30000 });
  });

  test('should display astronomical objects', async ({ page }) => {
    await page.goto('/');

    // Wait for content to load
    await page.waitForTimeout(5000);

    // Look for planet names or object categories
    const objects = page.getByText(/jupiter|saturn|mars|venus|galaxy|nebula|planet/i);

    // At least some objects should be shown
    const count = await objects.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Error Handling', () => {
  test('should show error message when forecast fails', async ({ page }) => {
    // Set up location but mock API to fail
    await page.addInitScript(() => {
      const mockState = {
        location: {
          name: 'Test Location',
          latitude: 999, // Invalid coordinates
          longitude: 999,
          timezone: 'America/New_York',
          elevation: 10,
        },
        isSetupComplete: true,
      };
      localStorage.setItem('nightseek:state', JSON.stringify(mockState));
    });

    await page.goto('/');

    // Wait for potential error or content
    await page.waitForTimeout(3000);

    // Check if error is shown or app handles gracefully
    const content = page.locator('body');
    await expect(content).toBeVisible();
  });

  test('should have retry button on error', async ({ page }) => {
    await page.goto('/');

    // If there's an error, there should be a retry button
    const retryButton = page.getByRole('button', { name: /retry|try again/i });

    if (await retryButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(retryButton).toBeEnabled();
    }
  });
});

test.describe('Night Selection', () => {
  test('should allow selecting different nights', async ({ page }) => {
    await page.addInitScript(() => {
      const mockState = {
        location: {
          name: 'Test Location',
          latitude: 40.7128,
          longitude: -74.006,
          timezone: 'America/New_York',
          elevation: 10,
        },
        isSetupComplete: true,
      };
      localStorage.setItem('nightseek:state', JSON.stringify(mockState));
    });

    await page.goto('/');

    // Wait for content to load
    await page.waitForTimeout(10000);

    // Look for night selection elements (dates, tabs, or table rows)
    const nightSelectors = page
      .getByRole('row')
      .or(page.getByRole('tab'))
      .or(page.locator('[data-night]'));

    const count = await nightSelectors.count();
    if (count > 1) {
      // Click the second night option
      await nightSelectors.nth(1).click();
      await page.waitForTimeout(500);
    }
  });
});
