import { initFirebase } from './firebase-init.js';

const { auth, googleProvider } = initFirebase();

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// Must be called on every page load to consume the redirect token after sign-in
auth.getRedirectResult().then(result => {
  if (result && result.user) {
    console.log('Redirect sign-in complete:', result.user.displayName);
  }
}).catch(err => {
  console.error('Redirect sign-in error:', err);
  const authError = document.getElementById('authError');
  if (authError) authError.textContent = 'Sign-in failed. Please try again.';
});

export function setupAuth(onSignIn, onSignOut) {
  const overlay    = document.getElementById('authOverlay');
  const signInBtn  = document.getElementById('googleSignInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const authError  = document.getElementById('authError');

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

  signInBtn.addEventListener('click', () => {
    authError.textContent = '';
    if (isMobile()) {
      auth.signInWithRedirect(googleProvider).catch(err => {
        console.error('Redirect sign-in error:', err);
        authError.textContent = 'Sign-in failed. Please try again.';
      });
    } else {
      auth.signInWithPopup(googleProvider).catch(err => {
        console.error('Sign-in error:', err);
        authError.textContent = 'Sign-in failed. Please try again.';
      });
    }
  });

  signOutBtn.addEventListener('click', () => auth.signOut());
}
