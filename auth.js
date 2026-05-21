// ---- Auth ----
const authOverlay = document.getElementById("authOverlay");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const appMain = document.querySelector("main");

if (appMain) appMain.style.display = "none";

let _appInitialised = false;

auth.onAuthStateChanged((user) => {
  if (user) {
    if (authOverlay) authOverlay.style.display = "none";
    if (appMain) appMain.style.display = "";
    if (signOutBtn) signOutBtn.style.display = "inline-block";
    console.log("Signed in as", user.displayName, "UID:", user.uid);
    if (!_appInitialised) {
      _appInitialised = true;
      loadTodayDate();
      loadDayFromCloud(currentDateStr);
    }
  } else {
    if (authOverlay) authOverlay.style.display = "flex";
    if (appMain) appMain.style.display = "none";
    if (signOutBtn) signOutBtn.style.display = "none";
    _appInitialised = false;
  }
});

googleSignInBtn?.addEventListener("click", () => {
  const authError = document.getElementById("authError");
  auth.signInWithPopup(provider).catch((err) => {
    console.error("Sign-in error:", err);
    if (authError) authError.textContent = "Sign-in failed. Please try again.";
  });
});

signOutBtn?.addEventListener("click", () => auth.signOut());
