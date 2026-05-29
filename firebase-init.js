// firebase-init.js — plain script, uses firebase compat global
(function () {
  if (window._firebaseInitialized) return;
  window._firebaseInitialized = true;

  var config = {
    apiKey: "AIzaSyD75EQyz7w9ZYuK8iDewQDzI5Z2RUzMk1k",
    authDomain: "fibrosymptomtracker.firebaseapp.com",
    projectId: "fibrosymptomtracker",
    storageBucket: "fibrosymptomtracker.firebasestorage.app",
    messagingSenderId: "729903386531",
    appId: "1:729903386531:web:b73385c230369ac53b9416",
    measurementId: "G-N20WEFRW9Y"
  };

  firebase.initializeApp(config);
  window._db             = firebase.firestore();
  window._auth           = firebase.auth();
  window._googleProvider = new firebase.auth.GoogleAuthProvider();
}());
