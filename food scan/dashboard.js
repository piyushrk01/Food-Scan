// dashboard.js — Dashboard & Diet Log Logic

import { db } from './firebase-config.js';
import { currentUser, userProfile } from './auth.js';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let dailyTotalKcal = 0;
let logUnsubscribe  = null; // Store unsubscribe fn to avoid duplicate listeners

// ── Init when user data is ready ──────────────────────────────────────
window.addEventListener('userDataLoaded', () => {
    const goalEl = document.getElementById('cals-goal');
    if (goalEl && userProfile) {
        goalEl.innerText = userProfile.dailyGoalKcal || 2000;
    }
    loadDietLog();
});

// ── Real-time Diet Log ────────────────────────────────────────────────
function loadDietLog() {
    if (!currentUser) return;

    // Detach previous listener if any
    if (logUnsubscribe) {
        logUnsubscribe();
        logUnsubscribe = null;
    }

    const q = query(
        collection(db, 'users', currentUser.uid, 'dietLog'),
        orderBy('timestamp', 'desc')
    );

    logUnsubscribe = onSnapshot(q, (snapshot) => {
        const logList = document.getElementById('diet-log-list');
        if (!logList) return;

        logList.innerHTML = '';
        dailyTotalKcal = 0;

        if (snapshot.empty) {
            logList.innerHTML = `
                <div class="text-center text-[#7D89A4] py-8 text-sm">
                    <div class="text-4xl mb-2">🍽</div>
                    <p>No food logged yet.<br>Scan a product to get started!</p>
                </div>`;
            updateMacroRing();
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const kcal = typeof data.kcal === 'number' ? data.kcal : 0;
            dailyTotalKcal += kcal;

            const item = document.createElement('div');
            item.className = 'log-item';
            item.innerHTML = `
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-2xl bg-[#DBEAFE] flex items-center justify-center text-xl flex-shrink-0">🍱</div>
                    <div class="min-w-0">
                        <div class="font-semibold text-[#2A3B5F] truncate text-sm">${escapeHtml(data.name || 'Unknown')}</div>
                        <div class="text-xs text-[#7D89A4] mt-0.5">${Math.round(kcal)} kcal</div>
                    </div>
                </div>
                <button class="delete-btn" data-id="${docSnap.id}" title="Remove">✕</button>
            `;
            logList.appendChild(item);
        });

        updateMacroRing();
        attachDeleteListeners();

    }, (error) => {
        console.error('Firestore snapshot error:', error);
    });
}

// ── Macro Ring Update ────────────────────────────────────────────────
function updateMacroRing() {
    const goal   = userProfile?.dailyGoalKcal || 2000;
    const circle = document.getElementById('macro-ring-progress');
    const calEl  = document.getElementById('cals-consumed');

    if (!circle || !calEl) return;

    calEl.innerText = Math.round(dailyTotalKcal);

    const percent = Math.min(dailyTotalKcal / goal, 1);
    const offset  = 377 - percent * 377;
    circle.style.strokeDashoffset = offset;

    // Color ring: green if within 10%, red if over
    if (dailyTotalKcal > goal * 1.05) {
        circle.style.stroke = '#F87171'; // over budget
    } else if (dailyTotalKcal > goal * 0.9) {
        circle.style.stroke = '#34D399'; // on target
    } else {
        circle.style.stroke = '#3B82F6'; // default blue
    }

    // Streak: mark if within 10% of goal
    if (dailyTotalKcal > 0 && Math.abs(dailyTotalKcal - goal) < goal * 0.1) {
        document.getElementById('streak-counter').innerText = '1';
    }
}

// ── Delete Listeners ─────────────────────────────────────────────────
function attachDeleteListeners() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute('data-id');
            try {
                await deleteDoc(doc(db, 'users', currentUser.uid, 'dietLog', id));
            } catch (err) {
                console.error('Delete error:', err);
                alert('Could not delete item. Try again.');
            }
        });
    });
}

// ── Share ─────────────────────────────────────────────────────────────
document.getElementById('btn-share').addEventListener('click', async () => {
    const text = `I tracked ${Math.round(dailyTotalKcal)} kcal today with LiquidDiet! 🥗🔥`;
    if (navigator.share) {
        try {
            await navigator.share({ title: 'My Diet Stats – LiquidDiet', text });
        } catch (e) {
            if (e.name !== 'AbortError') alert('Could not share: ' + e.message);
        }
    } else {
        // Fallback: copy to clipboard
        try {
            await navigator.clipboard.writeText(text);
            alert('Copied to clipboard! 📋');
        } catch {
            alert(text);
        }
    }
});

// ── Water Counter ─────────────────────────────────────────────────────
let water = 0;

document.getElementById('btn-water-plus').addEventListener('click', () => {
    water++;
    updateWater();
});

document.getElementById('btn-water-minus').addEventListener('click', () => {
    if (water > 0) { water--; updateWater(); }
});

function updateWater() {
    const el = document.getElementById('water-count');
    if (el) el.innerText = water;
}

// ── Helper ────────────────────────────────────────────────────────────
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}