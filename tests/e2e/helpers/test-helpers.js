/**
 * E2E Test Helper Utilities
 * Common functions for Playwright E2E tests
 */

import { expect } from '@playwright/test';

/**
 * Wait for network idle state
 */
export async function waitForNetworkIdle(page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for API response
 */
export async function waitForAPIResponse(page, urlPattern, timeout = 10000) {
  const response = await page.waitForResponse(
    (response) => response.url().includes(urlPattern) && response.status() === 200,
    { timeout }
  );
  return response;
}

/**
 * Fill form field with validation
 */
export async function fillFormField(page, selector, value) {
  await page.waitForSelector(selector, { state: 'visible' });
  await page.fill(selector, value);
  const actualValue = await page.inputValue(selector);
  expect(actualValue).toBe(value);
}

/**
 * Select dropdown option
 */
export async function selectDropdownOption(page, selector, value) {
  await page.waitForSelector(selector, { state: 'visible' });
  await page.selectOption(selector, value);
}

/**
 * Click button with retry logic
 */
export async function clickButton(page, selector, options = {}) {
  await page.waitForSelector(selector, { state: 'visible' });
  await page.click(selector, options);
}

/**
 * Wait for element to be visible
 */
export async function waitForElement(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Wait for element to be hidden
 */
export async function waitForElementHidden(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { state: 'hidden', timeout });
}

/**
 * Get text content of element
 */
export async function getTextContent(page, selector) {
  await waitForElement(page, selector);
  return page.textContent(selector);
}

/**
 * Take screenshot with name
 */
export async function takeScreenshot(page, name) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });
}

/**
 * Check if element exists
 */
export async function elementExists(page, selector) {
  try {
    await page.waitForSelector(selector, { state: 'attached', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get element count
 */
export async function getElementCount(page, selector) {
  return page.locator(selector).count();
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page, expectedText) {
  const toastSelector = '[role="alert"], .toast, [data-testid="toast"]';
  await waitForElement(page, toastSelector);
  const toastText = await getTextContent(page, toastSelector);

  if (expectedText) {
    expect(toastText).toContain(expectedText);
  }

  return toastText;
}

/**
 * Clear local storage
 */
export async function clearLocalStorage(page) {
  await page.evaluate(() => localStorage.clear());
}

/**
 * Set local storage item
 */
export async function setLocalStorageItem(page, key, value) {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key, value }
  );
}

/**
 * Get local storage item
 */
export async function getLocalStorageItem(page, key) {
  return page.evaluate(
    (key) => {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    },
    key
  );
}

/**
 * Mock API response
 */
export async function mockAPIResponse(page, urlPattern, response, status = 200) {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Intercept and log network requests
 */
export async function logNetworkRequests(page) {
  const requests = [];

  page.on('request', (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      timestamp: Date.now(),
    });
  });

  return requests;
}

/**
 * Check for console errors
 */
export async function checkForConsoleErrors(page) {
  const errors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  return errors;
}

/**
 * Simulate slow network
 */
export async function simulateSlowNetwork(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (500 * 1024) / 8, // 500 Kbps
    uploadThroughput: (500 * 1024) / 8,
    latency: 400,
  });
}

/**
 * Restore normal network
 */
export async function restoreNormalNetwork(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  });
}
