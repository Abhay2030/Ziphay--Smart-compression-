/* ═══════════════════════════════════════════════════
   firebase-config.js  —  Ziphay Firebase Credentials
   Project: ziphay

   ⚠️ SECURITY NOTE (M4): Firebase API keys are designed
   to be public (they identify the project, not grant access).
   However, you SHOULD restrict this key in Google Cloud Console:
   1. Go to: console.cloud.google.com > APIs & Services > Credentials
   2. Select your API key
   3. Under "Application restrictions": set HTTP referrers to
      ziphay.web.app/*, ziphay.firebaseapp.com/*, localhost:*
   4. Under "API restrictions": restrict to only:
      - Firebase Auth API
      - Cloud Firestore API
      - Firebase Storage API
      - Firebase Installations API
═══════════════════════════════════════════════════ */

window.FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyCbGR0SuwkRjTFWF22DCtsn0tiBsOwiW1A",
  authDomain: "ziphay.firebaseapp.com",
  projectId: "ziphay",
  storageBucket: "ziphay.firebasestorage.app",
  messagingSenderId: "314714027617",
  appId: "1:314714027617:web:c20283ab667ef6d7809c20",
  measurementId: "G-VYCW0TRHFY"
});

/* ═══════════════════════════════════════════════════
   App Check — prevents API quota abuse (M5)

   App Check verifies that requests come from your
   legitimate app, blocking bot abuse and quota theft.

   TO ACTIVATE:
   1. Go to Firebase Console > App Check
   2. Click "Register" next to your Web app
   3. Choose reCAPTCHA v3 as the provider
   4. Copy the reCAPTCHA Site Key and paste below
   5. Set enabled: true
   6. In Firebase Console > App Check > APIs,
      enable enforcement for:
      - Cloud Firestore
      - Cloud Storage
      - Authentication
   7. Deploy and test

   Without App Check, anyone can call your Firebase
   APIs directly using just the public config above.
   Docs: https://firebase.google.com/docs/app-check
═══════════════════════════════════════════════════ */
window.ZIPHAY_APP_CHECK_CONFIG = Object.freeze({
  // Set to true after you register a reCAPTCHA v3 provider
  // in Firebase Console > App Check > Apps > Register
  enabled: false,
  recaptchaSiteKey: "YOUR_RECAPTCHA_V3_SITE_KEY",
});

// Enable debug token for localhost development
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

/* ═══════════════════════════════════════════════════
   Backend API URL — points to the Render deployment.
   Used by frontend when calling compression/download endpoints.
   Falls back to localhost:8000 for local development.
═══════════════════════════════════════════════════ */
window.ZIPHAY_API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:8000'
  : 'https://ziphay-api.onrender.com';

console.log(
  '%c[Ziphay] Firebase config loaded ✓',
  'background:#00d4aa;color:#07070f;padding:2px 8px;border-radius:4px;font-weight:bold'
);

