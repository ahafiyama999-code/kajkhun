
"use strict";

const SUPABASE_URL = "https://lyuzgzudmnmarbnsplvk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_HET6b58nsRcn54-mBRxL6g_gm8HM0UX";

let supabaseClient;
let currentUser = null;
let authDialog;

const $ = (id) => document.getElementById(id);

function setStatus(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function setAuthButtons(user) {
  currentUser = user || null;
  if ($("signinBtn")) $("signinBtn").hidden = !!user;
  if ($("signoutBtn")) $("signoutBtn").hidden = !user;

  setStatus(
    "authStatus",
    user ? "Signed in as " + user.email : "আপনি সাইন ইন করেননি।"
  );
}

function makeDialog() {
  if (authDialog) return authDialog;

  authDialog = document.createElement("dialog");
  authDialog.innerHTML = `
    <h2 id="authTitle">Sign In</h2>
    <form id="authForm">
      <label for="authEmail">Email</label>
      <input id="authEmail" type="email" autocomplete="email" required>
      <label for="authPassword">Password</label>
      <input id="authPassword" type="password" minlength="6"
        autocomplete="current-password" required>
      <p id="authMessage" role="status"></p>
      <button id="authSubmit" type="submit">Sign In</button>
      <button id="authSwitch" type="button">Create Account</button>
      <button id="authClose" type="button">Cancel</button>
    </form>
  `;
  authDialog.style.cssText =
    "width:min(420px,90%);padding:24px;border:0;border-radius:12px";
  document.body.appendChild(authDialog);

  let mode = "signin";

  $("authSwitch").addEventListener("click", () => {
    mode = mode === "signin" ? "signup" : "signin";
    $("authTitle").textContent =
      mode === "signup" ? "Create Account" : "Sign In";
    $("authSubmit").textContent =
      mode === "signup" ? "Sign Up" : "Sign In";
    $("authSwitch").textContent =
      mode === "signup" ? "Already have an account? Sign In" : "Create Account";
    $("authPassword").autocomplete =
      mode === "signup" ? "new-password" : "current-password";
    setStatus("authMessage", "");
  });

  $("authClose").addEventListener("click", () => authDialog.close());

  $("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    const submit = $("authSubmit");
    submit.disabled = true;
    setStatus("authMessage", "Please wait...");

    try {
      const result = mode === "signup"
        ? await supabaseClient.auth.signUp({ email, password })
        : await supabaseClient.auth.signInWithPassword({ email, password });

      if (result.error) {
        setStatus("authMessage", result.error.message);
        return;
      }

      if (mode === "signup" && !result.data.session) {
        setStatus(
          "authMessage",
          "Account created. Check your email to confirm it, then sign in."
        );
        return;
      }

      authDialog.close();
      await refreshSession();
    } catch (error) {
      setStatus("authMessage", error.message);
    } finally {
      submit.disabled = false;
    }
  });

  return authDialog;
}

function openSignIn() {
  const dialog = makeDialog();
  if (!dialog.open) dialog.showModal();
}

async function refreshSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setStatus("authStatus", error.message);
    return;
  }
  setAuthButtons(data.session?.user || null);
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setStatus("authStatus", "Sign out failed: " + error.message);
    return;
  }
  setAuthButtons(null);
  setStatus("profileStatus", "");
  setStatus("reportStatus", "");
}

async function saveProfile(event) {
  event.preventDefault();

  if (!currentUser) {
    setStatus("profileStatus", "Please Sign In before saving your profile.");
    openSignIn();
    return;
  }

  const full_name = $("profileName").value.trim();
  const profession = $("profileProfession").value.trim();
  const location = $("profileLocation").value.trim();
  const bio = $("profileBio").value.trim();
  const is_public = $("profileIsPublic").checked;

  if (!full_name) {
    setStatus("profileStatus", "Please enter your name.");
    return;
  }

  const button = $("saveProfileBtn");
  button.disabled = true;
  setStatus("profileStatus", "Saving profile...");

  try {
    const { error } = await supabaseClient
      .from("profiles")
      .upsert({
        id: currentUser.id,
        full_name,
        profession,
        location,
        bio,
        is_public,
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

    if (error) throw error;

    setStatus("profileStatus", "প্রোফাইল সফলভাবে সংরক্ষণ হয়েছে।");
    await searchProfiles();
  } catch (error) {
    setStatus("profileStatus", "Profile save failed: " + error.message);
  } finally {
    button.disabled = false;
  }
}

async function searchProfiles(event) {
  if (event) event.preventDefault();

  const term = $("searchInput")?.value.trim() || "";
  const results = $("searchResults");
  if (!results) return;

  results.replaceChildren();
  setStatus("searchStatus", "");

  let query = supabaseClient
    .from("profiles")
    .select("id, full_name, profession, location, bio")
    .eq("is_public", true)
    .limit(30);

  if (term) {
    const escaped = term.replace(/[,%()]/g, " ").trim();
    if (!escaped) {
      results.textContent = "Enter a valid search term.";
      return;
    }
    query = query.or(
      `full_name.ilike.%${escaped}%,profession.ilike.%${escaped}%,location.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    results.textContent = "Search failed: " + error.message;
    return;
  }

  if (!data?.length) {
    results.textContent = "কোনো পাবলিক প্রোফাইল পাওয়া যায়নি।";
    return;
  }

  for (const profile of data) {
    const card = document.createElement("article");
    card.className = "profile-card";

    const heading = document.createElement("h3");
    heading.textContent = profile.full_name || "Unnamed";

    const profession = document.createElement("p");
    profession.textContent = "পেশা: " + (profile.profession || "উল্লেখ নেই");

    const location = document.createElement("p");
    location.textContent = "এলাকা: " + (profile.location || "উল্লেখ নেই");

    const bio = document.createElement("p");
    bio.textContent = profile.bio || "";

    const reportButton = document.createElement("button");
    reportButton.type = "button";
    reportButton.textContent = "Report Profile";
    reportButton.addEventListener("click", () => {
      $("reportProfileId").value = profile.id;
      $("report").scrollIntoView({ behavior: "smooth" });
    });

    card.append(heading, profession, location, bio, reportButton);
    results.appendChild(card);
  }
}

async function submitReport(event) {
  event.preventDefault();

  if (!currentUser) {
    setStatus("reportStatus", "অভিযোগ জমা দিতে আগে Sign In করুন।");
    openSignIn();
    return;
  }

  const reported_profile_id = $("reportProfileId").value.trim();
  const reason = $("reportReason").value;
  const details = $("reportDetails").value.trim();

  if (!reported_profile_id || !reason) {
    setStatus("reportStatus", "প্রোফাইল ও অভিযোগের কারণ নির্বাচন করুন।");
    return;
  }

  const button = $("submitReportBtn");
  button.disabled = true;
  setStatus("reportStatus", "অভিযোগ জমা হচ্ছে...");

  try {
    const { error } = await supabaseClient
      .from("profile_reports")
      .insert({
        reporter_id: currentUser.id,
        reported_profile_id,
        reason,
        details: details || null
      });

    if (error) throw error;

    $("reportForm").reset();
    setStatus("reportStatus", "অভিযোগ সফলভাবে জমা হয়েছে। ধন্যবাদ।");
  } catch (error) {
    setStatus("reportStatus", "Report failed: " + error.message);
  } finally {
    button.disabled = false;
  }
}

async function loadMyProfile() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("full_name, profession, location, bio, is_public")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    setStatus("profileStatus", "Profile loading failed: " + error.message);
    return;
  }

  if (!data) return;

  $("profileName").value = data.full_name || "";
  $("profileProfession").value = data.profession || "";
  $("profileLocation").value = data.location || "";
  $("profileBio").value = data.bio || "";
  $("profileIsPublic").checked = data.is_public !== false;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabase?.createClient) {
    setStatus("authStatus", "Supabase library did not load. Refresh the page.");
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

  $("signinBtn")?.addEventListener("click", openSignIn);
  $("signoutBtn")?.addEventListener("click", signOut);
  $("searchForm")?.addEventListener("submit", searchProfiles);
  $("profileForm")?.addEventListener("submit", saveProfile);
  $("reportForm")?.addEventListener("submit", submitReport);

  await refreshSession();
  await loadMyProfile();
  await searchProfiles();

  supabaseClient.auth.onAuthStateChange((event, session) => {
    setAuthButtons(session?.user || null);
    if (event === "SIGNED_IN") {
      setTimeout(loadMyProfile, 0);
    }
  });
});
