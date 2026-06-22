// ---- Firebase Configuration & Initialization ----
// This is the single source of truth for Firebase setup.
// All other modules consume the global `db` and `auth` objects initialized here.

const firebaseConfig = {
  apiKey: "AIzaSyD75EQyz7w9ZYuK8iDewQDzI5Z2RUzMk1k",
  authDomain: "fibrosymptomtracker.firebaseapp.com",
  projectId: "fibrosymptomtracker",
  storageBucket: "fibrosymptomtracker.firebasestorage.app",
  messagingSenderId: "729903386531",
  appId: "1:729903386531:web:b73385c230369ac53b9416",
  measurementId: "G-N20WEFRW9Y"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

FibroDiag.info('FirebaseInit', 'Firebase initialised');
FibroDiag.hookFirebase();
