// auth.js — plain script (no import/export)
// Firebase compat SDK is loaded via CDN and initialised in app.js before setupAuth() is called.

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function setupAuth(onSignIn, onSignOut) {
  const auth       = firebase.auth();
  const provider   = new firebase.auth.GoogleAuthProvider();
  const overlay    = document.getElementById('authOverlay');
  const signInBtn  = document.getElementById('googleSignInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const authError  = document.getElementById('authError');

  // Consume any pending redirect result now that Firebase is initialised
  auth.getRedirectResult().then(result => {
    if (result && result.user) {
      console.log('Redirect sign-in complete:', result.user.displayName);
    }
  }).catch(err => {
    console.error('Redirect sign-in error:', err);
    if (authError) authError.textContent = 'Sign-in failed. Please try again.';
  });

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
      auth.signInWithRedirect(provider).catch(err => {
        console.error('Redirect sign-in error:', err);
        authError.textContent = 'Sign-in failed. Please try again.';
      });
    } else {
      auth.signInWithPopup(provider).catch(err => {
        console.error('Sign-in error:', err);
        authError.textContent = 'Sign-in failed. Please try again.';
      });
    }
  });

  signOutBtn.addEventListener('click', () => auth.signOut());
}
