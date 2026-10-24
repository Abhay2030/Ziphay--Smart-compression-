const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.error('PAGE ERROR:', error.message));

        await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
        
        console.log('--- Clicking Upscale Button ---');
        await page.click('.mode-tab[data-mode="upscale"]');
        
        // Wait a bit to see if any errors pop up
        await new Promise(r => setTimeout(r, 2000));
        
        await browser.close();
    } catch (e) {
        console.error('Puppeteer Script Error:', e);
    }
})();
