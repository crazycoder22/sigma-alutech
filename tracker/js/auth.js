// ============================================================
// Shared auth helpers — imported by admin.js and customer.js
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { FIREBASE_CONFIG } from './firebase-config.js';

export const app  = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db   = getFirestore(app);

/**
 * Guard a page to a required role.
 * Redirects to index.html if not authenticated or wrong role.
 * Resolves with the Firebase User object when access is confirmed.
 *
 * @param {string} requiredRole  'admin' | 'customer'
 * @returns {Promise<{user, userData}>}
 */
export function requireRole(requiredRole) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = 'index.html';
        return;
      }
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists() || snap.data().role !== requiredRole) {
        window.location.href = 'index.html';
        return;
      }
      resolve({ user, userData: snap.data() });
    });
  });
}

export function signOutAndRedirect() {
  signOut(auth).then(() => { window.location.href = 'index.html'; });
}
