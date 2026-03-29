// app.js — Navigation + Service Worker

// ── Service Worker ──────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg  => console.log('✅ SW registered:', reg.scope))
            .catch(err => console.warn('❌ SW failed:', err));
    });
}

// ── Navigation ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    const navDash  = document.getElementById('nav-dashboard');
    const navScan  = document.getElementById('nav-scanner');
    const scrDash  = document.getElementById('dashboard-screen');
    const scrScan  = document.getElementById('scanner-screen');

    function showDashboard() {
        scrScan.classList.add('hidden-force');
        scrDash.classList.remove('hidden-force');
        scrDash.classList.add('screen-anim');

        navDash.classList.add('active-nav');
        navScan.classList.remove('active-nav');

        if (window.stopScanner) window.stopScanner();
    }

    function showScanner() {
        scrDash.classList.add('hidden-force');
        scrScan.classList.remove('hidden-force');
        scrScan.classList.add('screen-anim');

        navScan.classList.add('active-nav');
        navDash.classList.remove('active-nav');

        if (window.startScanner) window.startScanner();
    }

    navDash.addEventListener('click', showDashboard);
    navScan.addEventListener('click', showScanner);
});