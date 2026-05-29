import { initFirebase } from './firebase-init.js';

const { auth, googleProvider } = initFirebase();

export function setupAuth(onSignIn, onSignOut) {
  const overlay     = document.getElementById('authOverlay');
  const signInBtn   = document.getElementById('googleSignInBtn');
  const signOutBtn  = document.getElementById('signOutBtn');
  const authError   = document.getElementById('authError');

  auth.onAuthStateChanged(user => {
    if (user) {
      overlay.style.display = 'none';
      signOutBtn.style.display = '';
      onSignIn(user);
    } else {
      overlay.style.display = 'flex';
      signOutBtn.style.display = 'none';
      onSignOut();
    }
  });

  signInBtn.addEventListener('click', async () => {
    authError.textContent = '';
    try {
      await auth.signInWithPopup(googleProvider);
    } catch (err) {
      authError.textContent = 'Sign-in failed: ' + err.message;
    }
  });

  signOutBtn.addEventListener('click', () => auth.signOut());
}
