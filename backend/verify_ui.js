const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const appUrl = 'http://localhost:3000';

  try {
    // 1. Admin Verification
    await page.goto(appUrl);

    // Login as Admin
    await page.fill('#user-name', 'admin');
    await page.fill('#user-password', 'adminpassword'); // Assuming default is 'adminpassword' if not set
    // Check server.js default if env not set
    // In server.js: process.env.ADMIN_INITIAL_PASSWORD
    // If running in test env, we need to know what password is set.
    // Wait, let's check if we can even login. The server is running with 'yarn start' potentially?
    // No, I haven't started the server explicitly for this test yet.
    // I need to start the server in background first.

    await page.click('#user-login-btn');

    // Wait for Admin Panel
    await page.waitForSelector('#admin-panel', { state: 'visible', timeout: 5000 });

    // Take screenshot of Admin Panel (Department List layout)
    await page.screenshot({ path: '/home/jules/verification/admin_panel.png' });
    console.log('Admin panel screenshot saved.');

    // Logout
    await page.click('#logout-btn');
    await page.waitForSelector('#login-container', { state: 'visible' });

    // 2. User Verification
    // Login as User
    await page.fill('#user-name', 'user');
    await page.fill('#user-password', 'userpassword');
    await page.click('#user-login-btn');

    // Wait for Department Selection
    await page.waitForSelector('#department-selection', { state: 'visible', timeout: 5000 });

    // Wait for department cards to load
    await page.waitForSelector('.department-card', { state: 'visible', timeout: 5000 });

    // Take screenshot of Department Selection
    await page.screenshot({ path: '/home/jules/verification/user_dept_selection.png' });
    console.log('User department selection screenshot saved.');

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await browser.close();
  }
})();
