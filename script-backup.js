
"use strict";

// ==========================================
// KajKhun - Supabase Authentication & Search
// ==========================================

const SUPABASE_URL = "https://lyuzgzudmnmarbnsplvk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_HET6b58nsRcn54-mBRxL6g_gm8HM0UX";

let supabaseClient;
let authDialog;

// ---------- Helpers ----------

function getElement(id) {
  return document.getElementById(id);
}

function showStatus(message) {
  const status = getElement("authStatus");
  if (status) status.textContent = message;
}

function setButtonVisibility(isLoggedIn) {
  const signInButton = getElement("signinBtn");
  const signOutButton = getElement("signoutBtn");

  if (signInButton) signInButton.hidden = isLoggedIn;
  if (signOutButton) signOutButton.hidden = !isLoggedIn;
}

function showMessage(element, message) {
  if (element) element.textContent = message;
}

// ---------- Authentication Dialog ----------

function createAuthDialog() {
  if (authDialog) return authDialog;

  authDialog = document.createElement("dialog");
  authDialog.id = "kajkhunAuthDialog";

  authDialog.style.cssText = [
    "width: min(420px, calc(100% - 32px))",
    "padding: 24px",
    "border: 1px solid #ddd",
    "border-radius: 14px",
    "box-sizing: border-box",
    "font-family: Arial, sans-serif",
    "color: #222"
  ].join(";");

  authDialog.innerHTML = `
    <h2 id="authDialogTitle">Sign In</h2>

    <form id="authForm">
      <label for="authEmail">Email address</label>
      <input
        id="authEmail"
        type="email"
        autocomplete="email"
        required
        style="display:block;width:100%;box-sizing:border-box;padding:12px;margin:8px 0 16px"
      >

      <label for="authPassword">Password</label>
      <input
        id="authPassword"
        type="password"
        autocomplete="current-password"
        minlength="6"
        required
        style="display:block;width:100%;box-sizing:border-box;padding:12px;margin:8px 0 16px"
      >

      <p id="authFormMessage" role="status" aria-live="polite"></p>

      <button id="authSubmitButton" type="submit">
        Sign In
      </button>

      <button id="switchAuthMode" type="button">
        Create New Account
      </button>

      <button id="closeAuthDialog" type="button">
        Cancel
      </button>
    </form>
  `;

  document.body.appendChild(authDialog);

  let mode = "signin";

  const form = getElement("authForm");
  const title = getElement("authDialogTitle");
  const submitButton = getElement("authSubmitButton");
  const switchButton = getElement("switchAuthMode");
  const passwordInput = getElement("authPassword");
  const message = getElement("authFormMessage");

  function updateMode(newMode) {
    mode = newMode;

    const isSignUp = mode === "signup";

    title.textContent = isSignUp ? "Create Account" : "Sign In";
    submitButton.textContent = isSignUp ? "Sign Up" : "Sign In";
    switchButton.textContent = isSignUp
      ? "Already have an account? Sign In"
      : "Create New Account";

    passwordInput.autocomplete = isSignUp
      ? "new-password"
      : "current-password";

    message.textContent = "";
  }

  switchButton.addEventListener("click", () => {
    updateMode(mode === "signin" ? "signup" : "signin");
  });

  getElement("closeAuthDialog").addEventListener("click", () => {
    authDialog.close();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = getElement("authEmail").value.trim();
    const password = passwordInput.value;

    if (!supabaseClient) {
      showMessage(message, "Supabase connection is unavailable.");
      return;
    }

    submitButton.disabled = true;
    showMessage(message, "Please wait...");

    try {
      let result;

      if (mode === "signup") {
        result = await supabaseClient.auth.signUp({
          email,
          password
        });
      } else {
        result = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
      }

      if (result.error) {
        showMessage(message, result.error.message);
        return;
      }

      if (mode === "signup" && !result.data.session) {
        showMessage(
          message,
          "Account created. Check your email for a confirmation link before signing in."
        );
        return;
      }

      authDialog.close();
      await updateAuthUI();

      showStatus(
        mode === "signup"
          ? "Account created and signed in."
          : "You are signed in."
      );
    } catch (error) {
      showMessage(
        message,
        error.message || "An unexpected error occurred."
      );
    } finally {
      submitButton.disabled = false;
    }
  });

  updateMode("signin");
  return authDialog;
}

function openAuthDialog() {
  const dialog = createAuthDialog();

  if (!dialog.open) {
    dialog.showModal();
  }
}

// ---------- Sign In / Sign Out ----------

async function updateAuthUI() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    setButtonVisibility(false);
    showStatus("Could not check sign-in status: " + error.message);
    return;
  }

  const user = data.session?.user;
  setButtonVisibility(Boolean(user));

  if (user) {
    showStatus("Signed in as " + user.email);
  } else {
    showStatus("You are signed out.");
  }
}

async function signOut() {
  const button = getElement("signoutBtn");
  if (button) button.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      showStatus("Sign out failed: " + error.message);
      return;
    }

    setButtonVisibility(false);
    showStatus("You have signed out successfully.");

    const results = getElement("searchResults");
    if (results) {
      results.replaceChildren();
      const message = document.createElement("p");
      message.textContent = "Search for public profiles.";
      results.appendChild(message);
    }
  } catch (error) {
    showStatus("Sign out failed: " + error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

// ---------- Public Profile Search ----------

async function searchProfiles() {
  const input = getElement("searchInput");
  const results = getElement("searchResults");

  if (!input || !results) return;

  const term = input.value.trim();

  results.replaceChildren();

  if (!term) {
    const message = document.createElement("p");
    message.textContent = "Enter a name, profession, or location.";
    results.appendChild(message);
    return;
  }

  const loading = document.createElement("p");
  loading.textContent = "Searching...";
  results.appendChild(loading);

  try {
    const safeTerm = term.replace(/[,%()]/g, " ").trim();

    if (!safeTerm) {
      showMessage(results, "Please enter a valid search term.");
      return;
    }

    const pattern = "%" + safeTerm + "%";

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, full_name, profession, location, bio")
      .eq("is_public", true)
      .or(
        "full_name.ilike." + pattern +
        ",profession.ilike." + pattern +
        ",location.ilike." + pattern
      )
      .limit(30);

    results.replaceChildren();

    if (error) {
      const message = document.createElement("p");
      message.textContent = "Search failed: " + error.message;
      results.appendChild(message);
      return;
    }

    if (!data || data.length === 0) {
      const message = document.createElement("p");
      message.textContent = "No public profiles found.";
      results.appendChild(message);
      return;
    }

    for (const profile of data) {
      const card = document.createElement("article");

      card.style.cssText =
        "border:1px solid #ddd;border-radius:10px;padding:16px;margin:12px 0";

      const name = document.createElement("h3");
      name.textContent = profile.full_name || "Unnamed";

      const profession = document.createElement("p");
      profession.textContent =
        "Profession: " + (profile.profession || "Not specified");

      const location = document.createElement("p");
      location.textContent =
        "Location: " + (profile.location || "Not specified");

      const bio = document.createElement("p");
      bio.textContent = profile.bio || "";

      card.append(name, profession, location, bio);
      results.appendChild(card);
    }
  } catch (error) {
    results.replaceChildren();

    const message = document.createElement("p");
    message.textContent = "Search failed: " + error.message;
    results.appendChild(message);
  }
}

// ---------- Initialize ----------

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabase?.createClient) {
    showStatus(
      "Supabase library did not load. Refresh the page and check your internet connection."
    );
    return;
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  getElement("signinBtn")?.addEventListener("click", openAuthDialog);
  getElement("signoutBtn")?.addEventListener("click", signOut);
  getElement("searchBtn")?.addEventListener("click", searchProfiles);

  getElement("searchInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchProfiles();
    }
  });

  try {
    await updateAuthUI();

    supabaseClient.auth.onAuthStateChange((event, session) => {
      setButtonVisibility(Boolean(session?.user));

      if (event === "SIGNED_IN") {
        showStatus("Signed in successfully.");
      } else if (event === "SIGNED_OUT") {
        showStatus("You are signed out.");
      }
    });
  } catch (error) {
    showStatus("Initialization failed: " + error.message);
  }
});
