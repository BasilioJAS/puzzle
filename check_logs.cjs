const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

    try {
        const urls = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
        for (const url of urls) {
            console.log(`Trying ${url}...`);
            try {
                await page.goto(url, { waitUntil: 'networkidle', timeout: 5000 });
                console.log(`Success on ${url}`);
                await page.waitForTimeout(2000);
                break;
            } catch (e) {
                console.log(`Failed on ${url}:`, e.message);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
})();
