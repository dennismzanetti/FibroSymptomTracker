// ---- Firebase init -----
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

// ---- Auth globals ----
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// ---- Shared frequency labels (used by medications + print) ----
const FREQ_LABELS = {
  daily: "Daily",
  twice_daily: "2×/day",
  three_times_daily: "3×/day",
  as_needed: "PRN",
  weekly: "Weekly",
  other: "Other"
};
