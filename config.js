// ═══════════════════════════════════════════════
// JAVIA — Firebase Configuration
// ★★★ 아래 값들을 본인의 Firebase 프로젝트 설정으로 교체하세요 ★★★
// Firebase Console → 프로젝트 설정 → 일반 → 내 앱 → SDK 설정
// ═══════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
db.settings({ ignoreUndefinedProperties: true });

const COLLECTIONS = {
  USERS: 'users',
  CONTENTS: 'contents',
  CATEGORIES: 'categories',
  TRANSACTIONS: 'transactions',
  VIEW_LOGS: 'view_logs',
  PROPOSALS: 'partner_proposals',
  PAYMENTS: 'payments',
  FAVORITES: 'favorites',
  NOTICES: 'notices',
  TERMS: 'terms',
  CHARGE_OPTIONS: 'charge_options',
  ADMINS: 'admins',
};
