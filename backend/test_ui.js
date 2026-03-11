const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Test 1: Load page and verify it loads without errors
  try {
      await page.goto('http://localhost:3000/');
      console.log('Page loaded successfully');

      // Wait for app header
      await page.waitForSelector('.app-header');
      console.log('Header found');

      // Attempt login
      await page.fill('#user-name', 'user');
      await page.fill('#user-password', 'userpassword');
      await page.click('#user-login-btn');
      console.log('Login clicked');

      // Wait for something to appear after login (department selection or chat login)
      await page.waitForTimeout(1000);

      // Take screenshots
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.screenshot({ path: 'screenshot_desktop.png' });

      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({ path: 'screenshot_mobile.png' });

      console.log('Screenshots generated successfully');
  } catch (e) {
      console.error('Test failed:', e);
  } finally {
      await browser.close();
  }
})();
