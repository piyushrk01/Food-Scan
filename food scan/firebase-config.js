// firebase-config.js — Firebase V9 Modular SDK Setup

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️  Replace these values with your own Firebase project config
//     (Firebase Console → Project Settings → Your Apps → Config)
const firebaseConfig = {
    apiKey:            "AIzaSyDYi4mNarYL5TR9A1CJGYYvNf938QBY21c",
    authDomain:        "food-scan-45d74.firebaseapp.com",
    projectId:         "food-scan-45d74",
    storageBucket:     "food-scan-45d74.firebasestorage.app",
    messagingSenderId: "119317603007",
    appId:             "1:119317603007:web:59d500a4b789084d4b9c0a",
    measurementId:     "G-RYQNNK32ES"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

// Push Notifications (optional — uncomment when needed):
// import { getMessaging } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";
// export const messaging = getMessaging(app);