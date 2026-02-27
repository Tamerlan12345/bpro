const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const appUrl = 'http://localhost:3000'; // Assuming server is running here

    try {
        await page.goto(appUrl);
        // Login as admin
        await page.fill('#user-name', 'admin');
        await page.fill('#user-password', 'adminpassword');
        await page.click('#user-login-btn');

        // Wait for admin panel
        await page.waitForSelector('#admin-panel', { state: 'visible' });

        // Screenshot Admin Panel (Department List & Chat List)
        await page.screenshot({ path: '/home/jules/verification/admin_panel.png', fullPage: true });
        console.log('Admin panel screenshot taken.');

        // Login as User (need to logout or restart context, let's restart context for simplicity)
        await page.context().clearCookies();
        await page.reload(); // Should show login again
        // Actually, reloading might keep session if cookies aren't cleared effectively or if server uses memory store which persists.
        // Let's use logout button if available or just a new context.
    } catch (e) {
        console.error('Error during admin verification:', e);
    }
    await browser.close();
})();

(async () => {
     const browser = await chromium.launch();
    const page = await browser.newPage();
    const appUrl = 'http://localhost:3000';

    try {
         await page.goto(appUrl);
        // Login as User
        await page.fill('#user-name', 'user');
        await page.fill('#user-password', 'userpassword');
        await page.click('#user-login-btn');

        // Wait for Department Selection
        await page.waitForSelector('#department-selection', { state: 'visible' });
        // Wait for cards to load
        await page.waitForSelector('.department-card');

        // Screenshot Department Selection
        await page.screenshot({ path: '/home/jules/verification/user_department_selection.png' });
        console.log('User department selection screenshot taken.');

    } catch(e) {
        console.error('Error during user verification:', e);
    }
    await browser.close();
})();
