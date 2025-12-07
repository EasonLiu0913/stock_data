// Run this in the browser console on wantgoo.com to extract cookies
// 1. Open https://www.wantgoo.com/stock/major-investors/net-buy-sell-rank?market=Listed&orderByDays=15
// 2. Press F12 to open DevTools
// 3. Go to Console tab
// 4. Paste this entire script and press Enter
// 5. The cookies will be copied to your clipboard

(async () => {
    try {
        // Get all cookies using the Cookie Store API (modern browsers)
        const cookies = await cookieStore.getAll();

        // Format cookies for Playwright
        const playwrightCookies = cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || '.wantgoo.com',
            path: cookie.path || '/',
            expires: cookie.expires ? Math.floor(cookie.expires / 1000) : -1,
            httpOnly: cookie.httpOnly || false,
            secure: cookie.secure || false,
            sameSite: cookie.sameSite || 'Lax'
        }));

        const cookiesJson = JSON.stringify(playwrightCookies, null, 2);

        // Copy to clipboard
        await navigator.clipboard.writeText(cookiesJson);

        console.log('✅ Cookies copied to clipboard!');
        console.log('📋 Total cookies:', playwrightCookies.length);
        console.log('\nNext steps:');
        console.log('1. Create a file: /Users/eason/Documents/stock/cookies.json');
        console.log('2. Paste the clipboard content into that file');
        console.log('3. Run the scraper: node scraper.js');

    } catch (error) {
        // Fallback for browsers without Cookie Store API
        console.log('Using fallback method...');

        const cookieString = document.cookie;
        const cookiePairs = cookieString.split(';').map(c => c.trim());

        const playwrightCookies = cookiePairs.map(pair => {
            const [name, value] = pair.split('=');
            return {
                name: name.trim(),
                value: value || '',
                domain: '.wantgoo.com',
                path: '/',
                expires: -1,
                httpOnly: false,
                secure: true,
                sameSite: 'Lax'
            };
        });

        const cookiesJson = JSON.stringify(playwrightCookies, null, 2);

        // Try to copy to clipboard
        navigator.clipboard.writeText(cookiesJson).then(() => {
            console.log('✅ Cookies copied to clipboard!');
            console.log('📋 Total cookies:', playwrightCookies.length);
        }).catch(() => {
            console.log('❌ Could not copy to clipboard. Please copy manually:');
            console.log(cookiesJson);
        });
    }
})();
