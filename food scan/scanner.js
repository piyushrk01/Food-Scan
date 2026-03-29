// scanner.js — Barcode Scanner + Open Food Facts + Allergy Check

import { db } from './firebase-config.js';
import { currentUser, userProfile } from './auth.js';
import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let html5QrcodeScanner = null;
let scannedItemData    = null;
let isScannerRunning   = false;

// ── DOM References ───────────────────────────────────────────────────
const scanTitle   = document.getElementById('scan-title');
const scanNutrition = document.getElementById('scan-nutrition');
const aiDiv       = document.getElementById('ai-verdict');
const addBtn      = document.getElementById('btn-add-scanned');
const loadingDiv  = document.getElementById('scan-loading');

// ── Start Scanner ─────────────────────────────────────────────────────
const startScanner = () => {
    if (isScannerRunning) return;

    // Reset UI
    resetScanUI();

    if (typeof Html5QrcodeScanner === 'undefined') {
        console.warn('html5-qrcode library not loaded yet');
        return;
    }

    html5QrcodeScanner = new Html5QrcodeScanner(
        'reader',
        { fps: 10, qrbox: { width: 240, height: 180 }, aspectRatio: 1.5 },
        /* verbose= */ false
    );
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    isScannerRunning = true;
};

// ── Stop Scanner ──────────────────────────────────────────────────────
const stopScanner = () => {
    if (html5QrcodeScanner && isScannerRunning) {
        html5QrcodeScanner.clear().catch(() => {});
        html5QrcodeScanner = null;
    }
    isScannerRunning = false;
};

// ── Reset scan result UI ──────────────────────────────────────────────
function resetScanUI() {
    scannedItemData = null;
    if (scanTitle)    scanTitle.innerText    = '📷 Scan a Barcode';
    if (scanNutrition) scanNutrition.innerText = 'Align the barcode inside the camera frame above.';
    if (aiDiv)        { aiDiv.className = 'hidden-force'; aiDiv.innerText = ''; }
    if (addBtn)       addBtn.classList.add('hidden-force');
    if (loadingDiv)   loadingDiv.classList.add('hidden-force');
}

// ── On Scan Success ───────────────────────────────────────────────────
async function onScanSuccess(decodedText) {
    stopScanner();

    if (scanTitle)    scanTitle.innerText    = 'Fetching product...';
    if (scanNutrition) scanNutrition.innerText = `Barcode: ${decodedText}`;
    if (loadingDiv)   loadingDiv.classList.remove('hidden-force');
    if (addBtn)       addBtn.classList.add('hidden-force');
    if (aiDiv)        aiDiv.classList.add('hidden-force');

    try {
        const response = await fetch(
            `https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (loadingDiv) loadingDiv.classList.add('hidden-force');

        if (data.status === 1 && data.product) {
            const product     = data.product;
            const productName = product.product_name || 'Unnamed Product';
            const kcal        = product.nutriments?.['energy-kcal_100g'] ?? 0;
            const ingredients = (product.ingredients_text || '').toLowerCase();

            scannedItemData = {
                name: productName,
                kcal: Math.round(kcal),
                barcode: decodedText,
                date: new Date().toISOString()
            };

            if (scanTitle)    scanTitle.innerText    = productName;
            if (scanNutrition) scanNutrition.innerText = `${Math.round(kcal)} kcal per 100g`;
            if (addBtn)       addBtn.classList.remove('hidden-force');

            // ── Allergy Check ──
            let allergyFound = false;
            let allergyName  = '';

            if (userProfile?.allergies?.length > 0 && ingredients) {
                userProfile.allergies.forEach(allergy => {
                    if (ingredients.includes(allergy)) {
                        allergyFound = true;
                        allergyName  = allergy;
                    }
                });
            }

            showVerdict(allergyFound, allergyName, kcal);

        } else {
            if (scanTitle)    scanTitle.innerText    = '❌ Product Not Found';
            if (scanNutrition) scanNutrition.innerText = 'Try scanning another barcode.';

            if (aiDiv) {
                aiDiv.className = 'text-sm font-medium p-4 rounded-2xl mb-3 border border-[#DBEAFE] bg-[#DBEAFE] text-[#7D89A4]';
                aiDiv.innerText = 'This barcode is not in the Open Food Facts database.';
            }
        }
    } catch (err) {
        console.error('Fetch error:', err);
        if (loadingDiv) loadingDiv.classList.add('hidden-force');
        if (scanTitle)  scanTitle.innerText = 'Network Error';
        if (scanNutrition) scanNutrition.innerText = 'Check your internet connection and try again.';
    }
}

// ── Show AI/Allergy Verdict ───────────────────────────────────────────
function showVerdict(hasAllergy, allergyName, kcal) {
    if (!aiDiv) return;

    if (hasAllergy) {
        aiDiv.className = 'text-sm font-medium p-4 rounded-2xl mb-3 bg-red-50 text-red-500 border border-red-200';
        aiDiv.innerText = `⚠️ ALLERGY WARNING: Contains "${allergyName}" which is on your allergy list!`;
    } else {
        const verdict = kcal < 150
            ? '✅ Low calorie — great choice!'
            : kcal < 300
            ? '🟡 Moderate calories — enjoy in moderation.'
            : '🔴 High calorie — consider your daily budget.';

        aiDiv.className = 'text-sm font-medium p-4 rounded-2xl mb-3 bg-green-50 text-green-600 border border-green-200';
        aiDiv.innerText = verdict;
    }
}

// ── Scan Failure (silent) ─────────────────────────────────────────────
function onScanFailure() { /* ignore per-frame failures silently */ }

// ── Add to Firestore ──────────────────────────────────────────────────
addBtn.addEventListener('click', async () => {
    if (!scannedItemData || !currentUser) {
        alert('Please scan a product first.');
        return;
    }

    addBtn.disabled = true;
    addBtn.innerText = 'Adding...';

    try {
        await addDoc(collection(db, 'users', currentUser.uid, 'dietLog'), {
            ...scannedItemData,
            timestamp: serverTimestamp()
        });

        // Success feedback
        addBtn.innerText = '✅ Added!';
        addBtn.style.background = '#34D399';
        setTimeout(() => {
            addBtn.classList.add('hidden-force');
            addBtn.style.background = '';
            addBtn.innerText = '➕ Add to Log';
            addBtn.disabled = false;
            resetScanUI();
            startScanner(); // Auto-restart for next scan
        }, 1500);

    } catch (e) {
        console.error('Firestore addDoc error:', e);
        alert('Failed to save. Please try again.');
        addBtn.disabled = false;
        addBtn.innerText = '➕ Add to Log';
    }
});

// ── Expose to window for app.js routing ──────────────────────────────
window.startScanner = startScanner;
window.stopScanner  = stopScanner;