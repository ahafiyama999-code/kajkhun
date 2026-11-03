
/* ============================================
   BONDHON - FRESH script.js
   Email + Password Login Only
============================================ */

const SUPABASE_URL =
  "https://lyuzgzudmnmarbnsplvk.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_HET6b58nsRcn54-mBRxL6g_gm8HM0UX";

if (!window.supabase) {
  throw new Error("Supabase library load হয়নি।");
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

let currentUser = null;
let authMode = "signin";
let selectedPhoto = null;

const $ = id => document.getElementById(id);

/* ============================================
   COMMON FUNCTIONS
============================================ */

function showMessage(id, message, success = false) {
  const element = $(id);

  if (!element) return;

  element.textContent = message;
  element.style.color = success ? "green" : "red";
}

function showToast(message) {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
/* ============================================
   PART 2 - EMAIL + PASSWORD AUTHENTICATION
============================================ */

// Open authentication modal
function openAuth(mode = "signin") {
  authMode = mode;

  const modal = $("authModal");

  if (!modal) return;

  modal.style.display = "flex";

  updateAuthMode();
}

// Close authentication modal
function closeAuth() {
  const modal = $("authModal");

  if (modal) {
    modal.style.display = "none";
  }

  showMessage("authMessage", "");
}

// Update login/signup interface
function updateAuthMode() {
  const title = $("authTitle");
  const subtitle = $("authSubtitle");
  const submit = $("authSubmit");
  const switchText = $("switchAuth");

  if (authMode === "signup") {
    if (title) title.textContent = "Create Your Account";

    if (subtitle) {
      subtitle.textContent =
        "Create your Bondhon account using your email.";
    }

    if (submit) submit.textContent = "Create Account";

    if (switchText) {
      switchText.textContent = "Already have an account? Sign In";
    }
  } else {
    if (title) title.textContent = "Sign In";

    if (subtitle) {
      subtitle.textContent =
        "Sign in to your Bondhon account.";
    }

    if (submit) submit.textContent = "Sign In";

    if (switchText) {
      switchText.textContent = "Don't have an account? Sign Up";
    }
  }

  showMessage("authMessage", "");
}

// Switch between login and signup
function switchAuthMode() {
  authMode = authMode === "signin" ? "signup" : "signin";

  updateAuthMode();
}

// Email authentication form
async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = $("authEmail")?.value.trim();
  const password = $("authPassword")?.value;
  const submitButton = $("authSubmit");

  if (!email || !password) {
    showMessage(
      "authMessage",
      "Please enter your email and password."
    );
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    showMessage(
      "authMessage",
      "Please enter a valid email address."
    );
    return;
  }

  if (password.length < 6) {
    showMessage(
      "authMessage",
      "Password must be at least 6 characters."
    );
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Please wait...";
  }

  try {
    let result;

    if (authMode === "signup") {
      result = await supabaseClient.auth.signUp({
        email: email,
        password: password
      });

      if (result.error) {
        throw result.error;
      }

      if (!result.data.session) {
        showMessage(
          "authMessage",
          "Account created! Please check your email and verify your account.",
          true
        );

        return;
      }

      currentUser = result.data.user;

      showMessage(
        "authMessage",
        "Account created successfully!",
        true
      );

    } else {
      result = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (result.error) {
        throw result.error;
      }

      currentUser = result.data.user;

      showMessage(
        "authMessage",
        "Login successful!",
        true
      );
    }

    if (typeof updateAuthButtons === "function") {
      updateAuthButtons();
    }

    setTimeout(() => {
      closeAuth();

      if (typeof loadProfile === "function") {
        loadProfile();
      }
    }, 800);

  } catch (error) {
    console.error("Authentication error:", error);

    showMessage(
      "authMessage",
      error.message || "Authentication failed. Please try again."
    );
   } 
  finally {
  if (submitButton) {
    submitButton.disabled = false;

    submitButton.textContent =
      authMode === "signup"
        ? "Create Account"
        : "Sign In";
  }
}
/* ============================================
   PART 3 - AUTH BUTTONS & SESSION
============================================ */

// Update authentication buttons
function updateAuthButtons() {
  const signinBtn = $("signinBtn");
  const signupBtn = $("signupBtn");
  const signoutBtn = $("signoutBtn");
  const authStatus = $("authStatus");

  const loggedIn = Boolean(currentUser);

  if (signinBtn) signinBtn.style.display = loggedIn ? "none" : "";

  if (signupBtn) signupBtn.style.display = loggedIn ? "none" : "";

  if (signoutBtn) signoutBtn.style.display = loggedIn ? "" : "none";

  if (authStatus) {
    authStatus.textContent = loggedIn
      ? `Signed in: ${currentUser.email || ""}`
      : "Not signed in";
  }
}

// Sign out
async function signOut() {
  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    currentUser = null;

    updateAuthButtons();

    const profileForm = $("profileForm");

    if (profileForm) {
      profileForm.reset();
    }

    showToast("You have signed out.");

  } catch (error) {
    console.error("Sign out error:", error);
    showToast(error.message || "Sign out failed.");
  }
}
// Check current session
async function checkSession() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    currentUser = data.session?.user || null;

    updateAuthButtons();

    if (currentUser && typeof loadProfile === "function") {
      await loadProfile();
    }

  } catch (error) {
    console.error("Session error:", error);
  }
}

// Listen for login/logout changes
supabaseClient.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;

  updateAuthButtons();
});
/* ============================================
   PART 4 - LOAD USER PROFILE
============================================ */

async function loadProfile() {
  if (!currentUser) return;

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      showMessage(
        "profileMessage",
        "Welcome! Please complete your profile.",
        true
      );
      return;
    }

    // Fill profile form
    const fields = {
      fullName: data.full_name,
      profession: data.profession,
      division: data.division,
      district: data.district,
      upazila: data.upazila,
      experience: data.experience,
      bio: data.bio
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = $(id);

      if (element && value !== null && value !== undefined) {
        element.value = value;
      }
    });

    if ($("isPublic")) {
      $("isPublic").checked = data.is_public ?? true;
    }

    if ($("isActive")) {
      $("isActive").checked = data.is_active ?? true;
    }

    if ($("profilePhotoPreview") && data.avatar_url) {
      $("profilePhotoPreview").src = data.avatar_url;
      $("profilePhotoPreview").style.display = "block";
    }

    // Load saved mobile number
    const { data: contact, error: contactError } = await supabaseClient
      .from("profile_contacts")
      .select("phone")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (contactError) throw contactError;

    if ($("profileMobile") && contact) {
      $("profileMobile").value = contact.phone || "";
    }

    showMessage(
      "profileMessage",
      "Profile loaded successfully.",
      true
    );

  } catch (error) {
    console.error("Profile loading error:", error);

    showMessage(
      "profileMessage",
      error.message || "Could not load profile."
    );
  }
}
/* ============================================
   PART 5 - PROFILE PHOTO PREVIEW
============================================ */

function handlePhotoPreview() {
  const photoInput = $("profilePhoto");
  const preview = $("profilePhotoPreview");

  if (!photoInput || !preview) return;

  const file = photoInput.files?.[0];

  if (!file) {
    selectedPhoto = null;
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    showMessage(
      "profileMessage",
      "Only JPG, PNG and WebP images are allowed."
    );

    photoInput.value = "";
    selectedPhoto = null;
    return;
  }

  const maxSize = 3 * 1024 * 1024;

  if (file.size > maxSize) {
    showMessage(
      "profileMessage",
      "Image size must be less than 3 MB."
    );

    photoInput.value = "";
    selectedPhoto = null;
    return;
  }

  selectedPhoto = file;

  const imageURL = URL.createObjectURL(file);

  preview.src = imageURL;
  preview.style.display = "block";

  showMessage(
    "profileMessage",
    "Photo selected successfully.",
    true
  );
}
/* ============================================
   PART 6 - SAVE PROFILE
============================================ */

async function saveProfile(event) {
  event.preventDefault();

  if (!currentUser) {
    showMessage(
      "profileMessage",
      "Please sign in before saving your profile."
    );
    openAuth("signin");
    return;
  }

  const saveButton = $("saveProfileBtn");
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
  }

  try {
    let avatarURL = null;

    // Upload selected profile photo
    if (selectedPhoto) {
      const extension = selectedPhoto.name
        .split(".")
        .pop()
        .toLowerCase();

      const filePath =
        `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabaseClient
        .storage
        .from("profile-photos")
        .upload(filePath, selectedPhoto, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedPhoto.type
        });

      if (uploadError) throw uploadError;

      const { data: publicURL } = supabaseClient
        .storage
        .from("profile-photos")
        .getPublicUrl(filePath);

      avatarURL = publicURL.publicUrl;
    } else {
      const { data: oldProfile, error: oldProfileError } =
        await supabaseClient
          .from("profiles")
          .select("avatar_url")
          .eq("id", currentUser.id)
          .maybeSingle();

      if (oldProfileError) throw oldProfileError;

      avatarURL = oldProfile?.avatar_url || null;
    }

    // Profile information
    const profileData = {
      id: currentUser.id,
      full_name: $("fullName")?.value.trim() || "",
      profession: $("profession")?.value.trim() || "",
      division: $("division")?.value.trim() || "",
      district: $("district")?.value.trim() || "",
      upazila: $("upazila")?.value.trim() || "",
      experience: $("experience")?.value.trim() || "",
      bio: $("bio")?.value.trim() || "",
      is_public: $("isPublic")?.checked ?? true,
      is_active: $("isActive")?.checked ?? true,
      avatar_url: avatarURL,
      updated_at: new Date().toISOString()
    };

    const { error: profileError } = await supabaseClient
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (profileError) throw profileError;

    // Save contact number separately
    const phone = $("profileMobile")?.value.trim() || "";

    if (phone) {
      const { error: contactError } = await supabaseClient
        .from("profile_contacts")
        .upsert(
          {
            user_id: currentUser.id,
            phone: phone
          },
          { onConflict: "user_id" }
        );

      if (contactError) throw contactError;
    } else {
      const { error: deleteError } = await supabaseClient
        .from("profile_contacts")
        .delete()
        .eq("user_id", currentUser.id);

      if (deleteError) throw deleteError;
    }

    selectedPhoto = null;

    if ($("profilePhoto")) {
      $("profilePhoto").value = "";
    }

    showMessage(
      "profileMessage",
      "Profile saved successfully!",
      true
    );

    showToast("Profile saved successfully!");

  } catch (error) {
    console.error("Profile save error:", error);

    showMessage(
      "profileMessage",
      error.message || "Could not save profile."
    );

  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Save Profile";
    }
  }
}
/* ============================================
   PART 7 - SEARCH PUBLIC PROFILES
============================================ */

async function searchProfiles(event) {
  if (event) event.preventDefault();

  const resultsContainer =
    $("searchResults") || $("peopleGrid");

  const resultCount = $("resultCount");

  if (!resultsContainer) return;

  resultsContainer.innerHTML = "<p>Searching...</p>";

  const keyword = $("searchInput")?.value.trim() || "";
  const location = $("locationInput")?.value.trim() || "";

  try {
    let query = supabaseClient
      .from("profiles")
      .select(`
        id,
        full_name,
        profession,
        location,
        division,
        district,
        upazila,
        experience,
        bio,
        avatar_url
      `)
      .eq("is_public", true)
      .eq("is_active", true);

    if (keyword && location) {
  query = query
    .or(`full_name.ilike.%${keyword}%,profession.ilike.%${keyword}%`)
    .or(
      `location.ilike.%${location}%,division.ilike.%${location}%,district.ilike.%${location}%,upazila.ilike.%${location}%`
    );
} else if (keyword) {
  query = query.or(
    `full_name.ilike.%${keyword}%,profession.ilike.%${keyword}%`
  );
} else if (location) {
  query = query.or(
    `location.ilike.%${location}%,division.ilike.%${location}%,district.ilike.%${location}%,upazila.ilike.%${location}%`
  );
}
    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!data || data.length === 0) {
      resultsContainer.innerHTML =
        "<p>No public profiles found.</p>";

      if (resultCount) resultCount.textContent = "0 profiles";

      return;
    }

    // Fetch public contact numbers
    const profileIds = data.map(profile => profile.id);

    const { data: contacts, error: contactError } =
      await supabaseClient
        .from("profile_contacts")
        .select("user_id, phone")
        .in("user_id", profileIds);

    if (contactError) {
      console.warn("Contact numbers unavailable:", contactError);
    }

    const contactMap = new Map(
      (contacts || []).map(contact => [
        contact.user_id,
        contact.phone
      ])
    );

    resultsContainer.innerHTML = data.map(profile => {
      const phone = contactMap.get(profile.id) || "";

      const safeName = escapeHTML(profile.full_name || "Unnamed");
      const safeProfession = escapeHTML(profile.profession || "");
      const safeLocation = escapeHTML(
        [
          profile.upazila,
          profile.district,
          profile.division
        ].filter(Boolean).join(", ")
      );
      const safeExperience = escapeHTML(profile.experience || "");
      const safeBio = escapeHTML(profile.bio || "");
      const safePhone = escapeHTML(phone);

      const photo = profile.avatar_url
        ? `<img src="${escapeHTML(profile.avatar_url)}"
                alt="${safeName}"
                class="profile-card-photo">`
        : `<div class="profile-card-photo profile-placeholder">
             ${safeName.charAt(0)}
           </div>`;

      return `
        <article class="profile-card">
          ${photo}

          <div class="profile-card-content">
            <h3>${safeName}</h3>
            <p>${safeProfession}</p>
            <p>${safeLocation}</p>
            ${safeExperience
              ? `<p>Experience: ${safeExperience}</p>`
              : ""}
            ${safeBio ? `<p>${safeBio}</p>` : ""}

            ${safePhone
              ? `<a href="tel:${safePhone}">Call: ${safePhone}</a>`
              : ""}

            ${currentUser && currentUser.id !== profile.id
              ? `<button type="button"
                         class="report-profile-btn"
                         data-profile-id="${profile.id}">
                   Report Profile
                 </button>`
              : ""}
          </div>
        </article>
      `;
    }).join("");

    if (resultCount) {
      resultCount.textContent = `${data.length} profiles found`;
    }

  } catch (error) {
    console.error("Search error:", error);

    resultsContainer.innerHTML =
      "<p>Could not search profiles. Please try again.</p>";
  }
}

// Escape text before inserting it into HTML
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}
/* ============================================
   PART 8 - PROFILE REPORT SYSTEM
============================================ */

// Open report form
function openReport(profileId) {
  if (!currentUser) {
    showToast("Please sign in to report a profile.");
    openAuth("signin");
    return;
  }

  const reportForm = $("reportForm");

  if (!reportForm) {
    showToast("Report form not found.");
    return;
  }

  if ($("reportedProfileId")) {
    $("reportedProfileId").value = profileId;
  }

  showMessage("reportMessage", "");

  reportForm.style.display = "block";

  reportForm.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

// Submit report
async function submitReport(event) {
  event.preventDefault();

  if (!currentUser) {
    showToast("Please sign in first.");
    openAuth("signin");
    return;
  }

  const reportedProfileId = $("reportedProfileId")?.value;
  const reason = $("reportReason")?.value;
  const details = $("reportDetails")?.value.trim() || "";

  if (!reportedProfileId || !reason) {
    showMessage(
      "reportMessage",
      "Please select a reason for reporting."
    );
    return;
  }

  if (reportedProfileId === currentUser.id) {
    showMessage(
      "reportMessage",
      "You cannot report your own profile."
    );
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("profile_reports")
      .insert({
        reporter_id: currentUser.id,
        reported_profile_id: reportedProfileId,
        reason: reason,
        details: details,
        status: "pending"
      });

    if (error) throw error;

    showMessage(
      "reportMessage",
      "Report submitted successfully. Thank you!",
      true
    );

    $("reportForm")?.reset();

    setTimeout(() => {
      if ($("reportForm")) {
        $("reportForm").style.display = "none";
      }
    }, 1500);

  } catch (error) {
    console.error("Report error:", error);

    showMessage(
      "reportMessage",
      error.message || "Could not submit report."
    );
  }
}

// Handle report buttons in search results
document.addEventListener("click", event => {
  const button = event.target.closest(".report-profile-btn");

  if (!button) return;

  const profileId = button.dataset.profileId;

  if (profileId) {
    openReport(profileId);
  }
});
/* ============================================
   PART 9 - FINAL INITIALIZATION
============================================ */

function initializeBondhon() {

  // Login button
  $("signinBtn")?.addEventListener("click", () => {
    openAuth("signin");
  });

  $("profileSignIn")?.addEventListener("click", () => {
    openAuth("signin");
  });

  // Signup button
  $("signupBtn")?.addEventListener("click", () => {
    openAuth("signup");
  });

  $("joinBtn")?.addEventListener("click", () => {
    openAuth("signup");
  });

  // Logout
  $("signoutBtn")?.addEventListener("click", signOut);

  // Authentication form
  $("authForm")?.addEventListener("submit", handleAuthSubmit);

  // Switch login/signup
  $("switchAuth")?.addEventListener("click", switchAuthMode);

  // Close authentication modal
  $("closeAuth")?.addEventListener("click", closeAuth);

  // Profile form
  $("profileForm")?.addEventListener("submit", saveProfile);

  // Photo preview
  $("profilePhoto")?.addEventListener("change", handlePhotoPreview);

  // Search form
  $("searchForm")?.addEventListener("submit", searchProfiles);

  // Report form
  $("reportForm")?.addEventListener("submit", submitReport);

  // Mobile navigation
  $("menuToggle")?.addEventListener("click", () => {
    $("mainNav")?.classList.toggle("active");
  });

  // Close navigation after clicking a link
  $("mainNav")?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      $("mainNav")?.classList.remove("active");
    });
  });

  // Search navigation
  $("navSearch")?.addEventListener("click", () => {
    $("searchInput")?.focus();

    $("searchForm")?.scrollIntoView({
      behavior: "smooth"
    });
  });

  // Current year
  if ($("year")) {
    $("year").textContent = new Date().getFullYear();
  }

  // Authentication session
  checkSession();

  // Initial authentication interface
  updateAuthButtons();

  console.log("Bondhon website initialized successfully.");
}

// Start website after HTML loads
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeBondhon
  );
} else {
  initializeBondhon();
}
