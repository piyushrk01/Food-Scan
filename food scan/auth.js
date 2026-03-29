// auth.js — Firebase Authentication (V9 Modular SDK)

import { auth, db } from './firebase-config.js';
import {
    GoogleAuthProvider,
    signInWithPopup,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── DOM references ───────────────────────────────────────────────────
const googleBtn       = document.getElementById('btn-google-login');
const phoneBtn        = document.getElementById('btn-phone-login');
const authScreen      = document.getElementById('auth-screen');
const onboardingScreen= document.getElementById('onboarding-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const bottomNav       = document.getElementById('bottom-nav');

export let currentUser   = null;
export let userProfile   = null;

// ── Screen Manager ───────────────────────────────────────────────────
function showScreen(screenId) {
    // Hide every possible screen
    const screens = ['auth-screen', 'onboarding-screen', 'dashboard-screen', 'scanner-screen', 'games-screen'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden-force');
    });

    // Show requested screen
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden-force');
        target.classList.add('screen-anim');
    }

    // Bottom nav visibility
    const navScreens = ['dashboard-screen', 'scanner-screen', 'games-screen'];
    if (navScreens.includes(screenId)) {
        bottomNav.classList.remove('hidden-force');
    } else {
        bottomNav.classList.add('hidden-force');
    }
}

// ── 1. Google Login ──────────────────────────────────────────────────
googleBtn.addEventListener('click', async () => {
    googleBtn.disabled = true;
    googleBtn.innerText = 'Signing in...';
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error('Google Login Error:', error);
        alert('Google Login failed: ' + error.message);
        googleBtn.disabled = false;
        googleBtn.innerText = 'Continue with Google';
    }
});

// ── 2. Phone / OTP Login ─────────────────────────────────────────────
// RecaptchaVerifier must be init after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'normal',
            callback: () => { /* reCAPTCHA solved */ },
            'expired-callback': () => { /* reCAPTCHA expired */ }
        });
        window.recaptchaVerifier.render();
    } catch (e) {
        console.warn('reCAPTCHA init skipped (possibly already rendered):', e.message);
    }
});

phoneBtn.addEventListener('click', async () => {
    const phoneNumber = document.getElementById('phone-input').value.trim();
    if (!phoneNumber.startsWith('+')) {
        alert('Please include country code (e.g. +91 98765 43210)');
        return;
    }

    phoneBtn.disabled = true;
    phoneBtn.innerText = 'Sending...';

    try {
        const appVerifier = window.recaptchaVerifier;
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        const code = prompt('Enter the OTP sent to your phone:');
        if (code) {
            await confirmationResult.confirm(code.trim());
        }
    } catch (error) {
        console.error('Phone Login Error:', error);
        alert('Phone Login failed: ' + error.message);
    } finally {
        phoneBtn.disabled = false;
        phoneBtn.innerText = 'Send OTP →';
    }
});

// ── 3. Auth State Observer ────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;

        const docRef  = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            userProfile = docSnap.data();
            showScreen('dashboard-screen');
            window.dispatchEvent(new Event('userDataLoaded'));
        } else {
            // New user → onboarding
            showScreen('onboarding-screen');
        }
    } else {
        currentUser  = null;
        userProfile  = null;
        showScreen('auth-screen');
    }
});

// ── 4. Save Onboarding Profile ────────────────────────────────────────
document.getElementById('btn-save-profile').addEventListener('click', async () => {
    const age             = document.getElementById('user-age').value;
    const weight          = document.getElementById('user-weight').value;
    const goal            = document.getElementById('user-goal').value;
    const allergiesInput  = document.getElementById('user-allergies').value;

    if (!age || !weight) {
        alert('Age and Weight are required!');
        return;
    }

    const ageNum    = Number(age);
    const weightNum = Number(weight);

    // Simple TDEE-based calorie goal (Harris-Benedict rough)
    let dailyGoalKcal;
    if (goal === 'lose')     dailyGoalKcal = Math.round(weightNum * 22 * 0.85);
    else if (goal === 'gain') dailyGoalKcal = Math.round(weightNum * 22 * 1.15);
    else                      dailyGoalKcal = Math.round(weightNum * 22);

    const profileData = {
        age:          ageNum,
        weight:       weightNum,
        goal:         goal,
        allergies:    allergiesInput
            ? allergiesInput.split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
            : [],
        dailyGoalKcal: dailyGoalKcal
    };

    const saveBtn = document.getElementById('btn-save-profile');
    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    try {
        await setDoc(doc(db, 'users', currentUser.uid), profileData);
        userProfile = profileData;
        showScreen('dashboard-screen');
        window.dispatchEvent(new Event('userDataLoaded'));
    } catch (error) {
        console.error('Profile save error:', error);
        alert('Error saving profile: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save & Start 🚀';
    }
});