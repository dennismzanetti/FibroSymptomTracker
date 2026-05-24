let _app, _db, _auth, _googleProvider;

export function initFirebase() {
  if (_app) return { app: _app, db: _db, auth: _auth, googleProvider: _googleProvider };

  const config = {
    apiKey: "AIzaSyD7bnVAfclKhMjfqX3VQ1FP-EKyQIMV5Kc",
    authDomain: "fibrosymptomtracker.firebaseapp.com",
    projectId: "fibrosymptomtracker",
    storageBucket: "fibrosymptomtracker.appspot.com",
    messagingSenderId: "399399538093",
    appId: "1:399399538093:web:8a0d4d90e0f81a5e8bb22a"
  };

  _app           = firebase.initializeApp(config);
  _db            = firebase.firestore();
  _auth          = firebase.auth();
  _googleProvider = new firebase.auth.GoogleAuthProvider();

  return { app: _app, db: _db, auth: _auth, googleProvider: _googleProvider };
}
