// firebase-init.js — plain script, uses firebase compat global
(function () {
  if (window._firebaseInitialized) return;
  window._firebaseInitialized = true;

  var config = {
    apiKey: "AIzaSyD7bnVAfclKhMjfqX3VQ1FP-EKyQIMV5Kc",
    authDomain: "fibrosymptomtracker.firebaseapp.com",
    projectId: "fibrosymptomtracker",
    storageBucket: "fibrosymptomtracker.appspot.com",
    messagingSenderId: "399399538093",
    appId: "1:399399538093:web:8a0d4d90e0f81a5e8bb22a"
  };

  firebase.initializeApp(config);
  window._db             = firebase.firestore();
  window._auth           = firebase.auth();
  window._googleProvider = new firebase.auth.GoogleAuthProvider();
}());
