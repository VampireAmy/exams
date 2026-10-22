// Shared Firebase setup. Paste your config from:
// Firebase console > Project settings > General > Your apps > Web app > SDK setup and configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAE1atiiY0I8dNQhvhOkSeAicLOaCrQo70",
  authDomain: "exams-b4863.firebaseapp.com",
  projectId: "exams-b4863",
  storageBucket: "exams-b4863.firebasestorage.app",
  messagingSenderId: "532466227181",
  appId: "1:532466227181:web:3e7ce10ed74c523f18b9e4"
};

export const SETTINGS = {
  // Set to false once your students have accounts, so nobody else can register.
  allowSignup: true
};

export const isConfigured = !firebaseConfig.apiKey.startsWith("PASTE");

export const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const auth = isConfigured ? getAuth(app) : null;
export const db = isConfigured ? initializeFirestore(app, { experimentalForceLongPolling: true }) : null;
