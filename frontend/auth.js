/* ═══════════════════════════════════════════════════
   auth.js — Ziphay Authentication & History Engine
   
   Handles:
   ✅ Email/password sign up + sign in
   ✅ Google OAuth sign in
   ✅ Sign out
   ✅ Auth state listener (updates nav in real-time)
   ✅ Save compression/upscale records to Firestore
   ✅ Fetch user compression history
   ✅ Delete individual history records
   ✅ Exposes ZiphayAuth global object used by all pages
═══════════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc,
  getDocs, deleteDoc, doc, query, getDoc, setDoc,
  orderBy, limit, serverTimestamp,
  where, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

/* ── Init ── */
const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

console.log(
  '%c[Ziphay] Auth + Firestore ready ✓',
  'background:#00d4aa;color:#07070f;padding:2px 8px;border-radius:4px;font-weight:bold'
);

/* ════════════════════════════════════════════════
   AUTH STATE — runs on every page that loads auth.js
   Updates the nav bar and fires callbacks
════════════════════════════════════════════════ */
let _onLoginCallbacks = [];
let _onLogoutCallbacks = [];
let _authStateSettled = false;

onAuthStateChanged(auth, user => {
  _authStateSettled = true;
  updateNavForUser(user);
  if (user) _onLoginCallbacks.forEach(fn => fn(user));
  else _onLogoutCallbacks.forEach(fn => fn());
});

function updateNavForUser(user) {
  const loginBtn = document.getElementById('navLoginBtn');
  const logoutBtn = document.getElementById('navLogoutBtn');
  const userInfo = document.getElementById('navUserInfo');
  const dashBtn = document.getElementById('navDashBtn');
  const userAvatar = document.getElementById('navAvatar');
  const userName = document.getElementById('navUserName');
  const getProBtn = document.getElementById('getProBtn');

  if (user) {
    /* Logged IN state */
    if (loginBtn) loginBtn.style.display = 'none';
    if (getProBtn) getProBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (dashBtn) dashBtn.style.display = 'inline-flex';
    if (userInfo) userInfo.style.display = 'flex';

    /* Set display name */
    if (userName)
      userName.textContent = user.displayName || user.email.split('@')[0];

    /* Set avatar — photo (Google) or initial (email) */
    if (userAvatar) {
      if (user.photoURL) {
        /* ── SECURITY: Safe avatar rendering (no innerHTML with user data) ── */
        const img = document.createElement('img');
        img.src = user.photoURL;
        img.alt = '';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
        img.onerror = () => { img.remove(); userAvatar.textContent = (user.displayName || user.email)[0].toUpperCase(); };
        userAvatar.textContent = ''; /* clear previous content safely */
        userAvatar.appendChild(img);
      } else {
        userAvatar.textContent =
          (user.displayName || user.email)[0].toUpperCase();
      }
    }
  } else {
    /* Logged OUT state */
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (getProBtn) getProBtn.style.display = 'inline-flex';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (dashBtn) dashBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'none';
  }
}

/* ════════════════════════════════════════════════
   SIGN UP with email + password
════════════════════════════════════════════════ */
async function signUp(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred.user;
}

/* ════════════════════════════════════════════════
   SIGN IN with email + password
════════════════════════════════════════════════ */
async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/* ════════════════════════════════════════════════
   GOOGLE SIGN IN
════════════════════════════════════════════════ */
async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

/* ════════════════════════════════════════════════
   SIGN OUT
════════════════════════════════════════════════ */
async function logOut() {
  await signOut(auth);
}

/* ════════════════════════════════════════════════
   SAVE COMPRESSION RECORD to Firestore
   Called by script.js after every successful compress/upscale
════════════════════════════════════════════════ */
async function saveRecord(record) {
  const user = auth.currentUser;
  if (!user) return null; /* silently skip if not logged in */

  const docRef = await addDoc(
    collection(db, "users", user.uid, "history"),
    {
      /* file info — all values sanitized to safe types */
      filename: String(record.filename || "unknown").slice(0, 500),
      outputName: String(record.outputName || "ziphay_output").slice(0, 500),
      mode: ["compress", "upscale", "denoise", "bgremove"].includes(record.mode) ? record.mode : "compress",
      goal: ["web", "email", "social", "archive", "auto"].includes(record.goal) ? record.goal : "web",
      level: ["low", "medium", "high"].includes(record.level) ? record.level : "medium",
      format: String(record.format || "webp").slice(0, 10),
      /* sizes — coerce to safe integers */
      origSize: Math.max(0, parseInt(record.origSize, 10) || 0),
      newSize: Math.max(0, parseInt(record.newSize, 10) || 0),
      savedPct: Math.max(0, Math.min(100, parseInt(record.savedPct, 10) || 0)),
      /* upscale specific */
      scale: [2, 4, 8].includes(Number(record.scale)) ? Number(record.scale) : null,
      /* metadata — userAgent removed for GDPR compliance */
      createdAt: serverTimestamp(),
    }
  );
  return docRef.id;
}

/* ════════════════════════════════════════════════
   FETCH COMPRESSION HISTORY
   Returns array sorted by newest first
════════════════════════════════════════════════ */
async function getHistory(maxRecords = 50) {
  const user = auth.currentUser;
  if (!user) return [];

  const q = query(
    collection(db, "users", user.uid, "history"),
    orderBy("createdAt", "desc"),
    limit(maxRecords)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ════════════════════════════════════════════════
   GET STATS SUMMARY for dashboard hero cards
════════════════════════════════════════════════ */
async function getStats() {
  const history = await getHistory(200);
  const totalFiles = history.length;
  const totalSavedBytes = history.reduce((s, r) => s + Math.max(0, r.origSize - r.newSize), 0);
  const compressions = history.filter(r => r.mode === 'compress').length;
  const upscales = history.filter(r => r.mode === 'upscale').length;
  const avgSaved = totalFiles > 0
    ? Math.round(history.reduce((s, r) => s + (r.savedPct || 0), 0) / totalFiles)
    : 0;
  return { totalFiles, totalSavedBytes, compressions, upscales, avgSaved };
}

/* ════════════════════════════════════════════════
   DELETE A HISTORY RECORD
════════════════════════════════════════════════ */
async function deleteRecord(recordId) {
  const user = auth.currentUser;
  if (!user) return;
  await deleteDoc(doc(db, "users", user.uid, "history", recordId));
}

/* ════════════════════════════════════════════════
   USER PROFILE & PRO PLAN
════════════════════════════════════════════════ */
async function getUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const docRef = doc(db, "users", user.uid);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    } else {
      const defaultProfile = { plan: 'pro', createdAt: serverTimestamp() };
      await setDoc(docRef, defaultProfile);
      return defaultProfile;
    }
  } catch (e) {
    console.error("[Ziphay] Profile fetch error:", e);
    return { plan: 'pro' };
  }
}

async function upgradeToPro() {
  const user = auth.currentUser;
  if (!user) throw new Error("Need to be logged in to upgrade");
  await setDoc(doc(db, "users", user.uid), { plan: 'pro', upgradedAt: serverTimestamp() }, { merge: true });
}

/* ════════════════════════════════════════════════
   CURRENT USER helper
════════════════════════════════════════════════ */
function currentUser() {
  return auth.currentUser;
}

/* ════════════════════════════════════════════════
   EVENT HOOKS
════════════════════════════════════════════════ */
function onLogin(fn) { 
  _onLoginCallbacks.push(fn); 
  if (_authStateSettled && auth.currentUser) fn(auth.currentUser);
}
function onLogout(fn) { 
  _onLogoutCallbacks.push(fn); 
  if (_authStateSettled && !auth.currentUser) fn();
}

/* ════════════════════════════════════════════════
   GLOBAL EXPORT
   window.ZiphayAuth is available to all pages
════════════════════════════════════════════════ */
/* ── SECURITY: Freeze global export to prevent prototype pollution / DOM clobbering ── */
window.ZiphayAuth = Object.freeze({
  signUp, signIn, signInWithGoogle, logOut,
  saveRecord, getHistory, getStats, deleteRecord,
  currentUser, onLogin, onLogout, getUserProfile, upgradeToPro
});
