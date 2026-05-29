// auth.js — plain script, depends on firebase-init.js being loaded first
function setupAuth(onSignIn, onSignOut) {
  var overlay    = document.getElementById('authOverlay');
  var signInBtn  = document.getElementById('googleSignInBtn');
  var signOutBtn = document.getElementById('signOutBtn');
  var authError  = document.getElementById('authError');

  window._auth.onAuthStateChanged(function (user) {
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

  signInBtn.addEventListener('click', function () {
    authError.textContent = '';
    window._auth.signInWithPopup(window._googleProvider)
      .catch(function (err) {
        authError.textContent = 'Sign-in failed: ' + err.message;
      });
  });

  signOutBtn.addEventListener('click', function () {
    window._auth.signOut();
  });
}
