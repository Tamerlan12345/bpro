const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
      await page.goto('http://localhost:3000/');
      console.log('Page loaded successfully');

      // Attempt login
      await page.fill('#user-name', 'admin');
      await page.fill('#user-password', 'adminpassword');
      await page.click('#user-login-btn');
      console.log('Login clicked');

      // Wait for admin panel
      await page.waitForTimeout(2000);

      // Take desktop screenshot
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.screenshot({ path: '/home/jules/verification/admin_desktop.png' });

      // Take mobile screenshot
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({ path: '/home/jules/verification/admin_mobile.png' });

      console.log('Admin screenshots generated successfully');

      // Also get to diagram to check toolbars
      await page.goto('http://localhost:3000/');
      // login as user this time
      await page.evaluate(() => {
          localStorage.clear();
      });
      // Just take a screenshot of the main wizard layout with a mobile view
      // We need to inject the diagram toolbar manually as visible just to screenshot it
      await page.evaluate(() => {
          document.querySelector('.main-app-container').style.display = 'block';
          document.querySelector('.auth-wrapper').style.display = 'none';
          document.getElementById('tab-diagram').style.display = 'block';
          document.getElementById('diagram-toolbar').style.display = 'flex';
      });
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({ path: '/home/jules/verification/wizard_mobile.png' });

      console.log('Wizard mobile screenshots generated successfully');

  } catch (e) {
      console.error('Test failed:', e);
  } finally {
      await browser.close();
  }
})();
