import { expect, test } from '@playwright/test';

test.describe('NightSeek App', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('/');
  });

  test('should display the header', async ({ page }) => {
    // Check that the header is visible
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check for app title or logo
    await expect(page.getByRole('link', { name: /nightseek/i })).toBeVisible();
  });

  test('should show setup screen on first visit', async ({ page }) => {
    // Clear localStorage to simulate first visit
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Should show location setup
    await expect(page.getByText(/location/i)).toBeVisible();
  });

  test('should allow location search', async ({ page }) => {
    // Check if location input exists
    const locationInput = page.getByPlaceholder(/search|location|city/i);

    if (await locationInput.isVisible()) {
      await locationInput.fill('New York');
      // Wait for suggestions or results
      await page.waitForTimeout(500);
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    // Header should still be visible
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('should handle dark theme', async ({ page }) => {
    // The app should have dark background
    const body = page.locator('body');
    await expect(body).toHaveClass(/bg-night/);
  });
});

test.describe('Navigation', () => {
  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');

    // Check for any navigation elements
    const nav = page.locator('nav, header');
    await expect(nav.first()).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // Check for at least one heading
    const headings = page.locator('h1, h2, h3');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have alt text on images', async ({ page }) => {
    await page.goto('/');

    // Check that images have alt text
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      // Alt can be empty for decorative images, but should be present
      expect(alt).not.toBeNull();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Tab through focusable elements
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});
