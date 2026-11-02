
/* ============================================
   BONDHON - COMPLETE FRESH script.js
   Authentication + Profile + Active Status
   Photo Upload + Search + Contact + Report
============================================ */

const SUPABASE_URL = "https://lyuzgzudmnmarbnsplvk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_HET6b58nsRcn54-mBRxL6g_gm8HM0UX";

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
let authPhoneInput = null;

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

  setTimeout(() => toast.classList.remove("show"), 3000);
}

/* ============================================
   INTERNATIONAL PHONE INPUT
============================================ */

function initializeAuthPhoneInput() {
  const input = $("authEmail");

  if (!input || !window.intlTelInput) {
    console.warn("International phone input library পাওয়া যায়নি।");
    return;
  }

  if (authPhoneInput) return;

  authPhoneInput = window.intlTelInput(input, {
    initialCountry: "bd",
    separateDialCode: true,
    nationalMode: true,
    formatOnDisplay: true,
    autoPlaceholder: "polite",
    preferredCountries: ["bd", "us", "gb", "in", "sa", "ae"],
    utilsScript:
      "https://cdn.jsdelivr.net/npm/intl-tel-input@25.3.1/build/js/utils.js"
  });
}

async function getInternationalPhoneNumber() {
  if (!authPhoneInput) {
    throw new Error(
      "Country Code সুবিধা চালু হয়নি। পেজ Refresh করে আবার চেষ্টা করুন।"
    );
  }

  if (authPhoneInput.promise) {
    await authPhoneInput.promise;
  }

  if (!authPhoneInput.getSelectedCountryData()?.dialCode) {
    throw new Error("মোবাইল নম্বরের Country Code নির্বাচন করুন।");
  }

  if (!authPhoneInput.isValidNumber()) {
    throw new Error(
      "সঠিক মোবাইল নম্বর লিখুন। বাংলাদেশ হলে 017XXXXXXXX নম্বরটি 0 বাদ দিয়ে লিখুন।"
    );
  }

  return authPhoneInput.getNumber();
}

/* ============================================
   AUTHENTICATION MODAL
============================================ */

function openAuthModal(mode = "signin") {
  authMode = mode;
  updateAuthUI();

  const modal = $("authModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.style.display = "flex";
}

function closeAuthModal() {
  const modal = $("authModal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.style.display = "none";
}

function updateAuthUI() {
  if ($("authTitle")) {
    $("authTitle").textContent =
      authMode === "signin"
        ? "Bondhon-এ স্বাগতম"
        : "নতুন অ্যাকাউন্ট তৈরি করুন";
  }

  if ($("authSubtitle")) {
    $("authSubtitle").textContent =
      authMode === "signin"
        ? "ইমেইল অথবা মোবাইল নম্বর দিয়ে প্রবেশ করুন"
        : "ইমেইল অথবা মোবাইল নম্বর দিয়ে যুক্ত হোন";
  }

  if ($("authSubmit")) {
    $("authSubmit").textContent =
      authMode === "signin" ? "সাইন ইন" : "নিবন্ধন করুন";
  }

  if ($("switchAuth")) {
    $("switchAuth").textContent =
      authMode === "signin"
        ? "নতুন অ্যাকাউন্ট তৈরি করুন"
        : "আগে থেকেই অ্যাকাউন্ট আছে? সাইন ইন";
  }

  if ($("authPassword")) {
    $("authPassword").autocomplete =
      authMode === "signin" ? "current-password" : "new-password";
  }

  showMessage("authMessage", "");
}

function identifyLoginType(value) {
  return value.includes("@") ? "email" : "phone";
}

/* ============================================
   SIGN UP AND SIGN IN
============================================ */

async function handleAuthentication(event) {
  event.preventDefault();

  const input = $("authEmail").value.trim();
  const password = $("authPassword").value;
  const button = $("authSubmit");

  if (!input || !password) {
    showMessage(
      "authMessage",
      "ইমেইল অথবা মোবাইল নম্বর এবং পাসওয়ার্ড দিন।"
    );
    return;
  }

  if (password.length < 6) {
    showMessage("authMessage", "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
    return;
  }

  button.disabled = true;
  button.textContent = "অপেক্ষা করুন...";

  try {
    const loginType = identifyLoginType(input);
    let result;

    if (loginType === "email") {
      const email = input.toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("সঠিক ইমেইল ঠিকানা লিখুন।");
      }

      if (authMode === "signup") {
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
    } else {
      const phone = await getInternationalPhoneNumber();

      if (authMode === "signup") {
        result = await supabaseClient.auth.signUp({
          phone,
          password
        });
      } else {
        result = await supabaseClient.auth.signInWithPassword({
          phone,
          password
        });
      }
    }

    if (result.error) throw result.error;

    if (authMode === "signup" && !result.data.session) {
      if (loginType === "email") {
        showMessage(
          "authMessage",
          "অ্যাকাউন্ট তৈরি হয়েছে। ইমেইলে পাঠানো লিংক দিয়ে যাচাই করুন।",
          true
        );
      } else {
        showMessage(
          "authMessage",
          "অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু ফোন যাচাই বা Supabase Phone Auto-confirm সেটিংসের কারণে এখনো লগইন হয়নি।",
          true
        );
      }

      return;
    }

    currentUser = result.data.user;

    await updateAuthButtons();

    showMessage(
      "authMessage",
      authMode === "signup"
        ? "অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!"
        : "সফলভাবে লগইন হয়েছে!",
      true
    );

    setTimeout(() => {
      closeAuthModal();
      $("authForm")?.reset();

      if (authPhoneInput) {
        authPhoneInput.setCountry("bd");
      }
    }, 1000);

  } catch (error) {
    console.error("Authentication error:", error);

    showMessage(
      "authMessage",
      error.message || "Authentication সফল হয়নি।"
    );

  } finally {
    button.disabled = false;
    button.textContent =
      authMode === "signin" ? "সাইন ইন" : "নিবন্ধন করুন";
  }
}

/* ============================================
   AUTH BUTTONS AND SESSION
============================================ */

async function updateAuthButtons() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) console.error(error);

  currentUser = data.session?.user || null;

  $("signinBtn")?.classList.toggle("hidden", !!currentUser);
  $("signupBtn")?.classList.toggle("hidden", !!currentUser);
  $("signoutBtn")?.classList.toggle("hidden", !currentUser);

  $("profileForm")?.classList.toggle("hidden", !currentUser);
  $("profileSignIn")?.classList.toggle("hidden", !!currentUser);

  if (currentUser) {
    await loadMyProfile();
  }
}

async function handleSignOut() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    showToast(error.message);
    return;
  }

  currentUser = null;
  selectedPhoto = null;

  $("profileForm")?.reset();
  $("profilePhotoPreview")?.classList.add("hidden");

  await updateAuthButtons();
  await loadProfiles();

  showToast("সফলভাবে সাইন আউট হয়েছে।");
}

/* ============================================
   LOAD MY PROFILE
============================================ */

async function loadMyProfile() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Profile loading error:", error);
    return;
  }

  if (!data) return;

  if ($("fullName")) $("fullName").value = data.full_name || "";
  if ($("profession")) $("profession").value = data.profession || "";
  if ($("division")) $("division").value = data.division || "";
  if ($("district")) $("district").value = data.district || "";
  if ($("upazila")) $("upazila").value = data.upazila || "";
  if ($("experience")) $("experience").value = data.experience || "";
  if ($("bio")) $("bio").value = data.bio || "";

  if ($("isPublic")) {
    $("isPublic").checked = data.is_public !== false;
  }

  // Active / Inactive status
  if ($("isActive")) {
    $("isActive").checked = data.is_active !== false;
  }

  const { data: contact, error: contactError } = await supabaseClient
    .from("profile_contacts")
    .select("phone")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (contactError) console.error(contactError);

  if (contact && $("profileMobile")) {
    $("profileMobile").value = contact.phone || "";
  }

  if (data.avatar_url && $("profilePhotoPreview")) {
    $("profilePhotoPreview").src = data.avatar_url;
    $("profilePhotoPreview").classList.remove("hidden");
  }
}

/* ============================================
   PROFILE PHOTO PREVIEW
============================================ */

$("profilePhoto")?.addEventListener("change", event => {
  const file = event.target.files[0];

  if (!file) return;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    showMessage(
      "profileMessage",
      "JPG, PNG অথবা WebP ছবি নির্বাচন করুন।"
    );

    event.target.value = "";
    return;
  }

  if (file.size > 3 * 1024 * 1024) {
    showMessage(
      "profileMessage",
      "ছবির সাইজ সর্বোচ্চ ৩ MB হতে পারবে।"
    );

    event.target.value = "";
    return;
  }

  selectedPhoto = file;

  const preview = $("profilePhotoPreview");

  if (preview) {
    if (preview.dataset.objectUrl) {
      URL.revokeObjectURL(preview.dataset.objectUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    preview.dataset.objectUrl = objectUrl;
    preview.src = objectUrl;
    preview.classList.remove("hidden");
  }

  showMessage("profileMessage", "");
});

/* ============================================
   SAVE PROFILE
============================================ */

async function handleProfileSave(event) {
  event.preventDefault();

  if (!currentUser) {
    openAuthModal("signin");
    return;
  }

  const form = $("profileForm");
  const button = form?.querySelector('button[type="submit"]');

  if (button) {
    button.disabled = true;
    button.textContent = "সংরক্ষণ হচ্ছে...";
  }

  try {
    const fullName = $("fullName").value.trim();
    const profession = $("profession").value.trim();
    const division = $("division").value.trim();
    const district = $("district").value.trim();
    const upazila = $("upazila").value.trim();
    const phone = $("profileMobile").value.trim();

    if (!fullName || !profession) {
      throw new Error("নাম ও পেশা অবশ্যই লিখুন।");
    }

    const location = [division, district, upazila]
      .filter(Boolean)
      .join(", ");

    const { data: oldProfile, error: oldProfileError } =
      await supabaseClient
        .from("profiles")
        .select("avatar_url")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (oldProfileError) throw oldProfileError;

    let avatarUrl = oldProfile?.avatar_url || null;

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

      const { data: publicData } = supabaseClient
        .storage
        .from("profile-photos")
        .getPublicUrl(filePath);

      avatarUrl = publicData.publicUrl;
    }

    const profileData = {
      id: currentUser.id,
      full_name: fullName,
      profession,
      location,
      division,
      district,
      upazila,
      experience: $("experience").value.trim(),
      bio: $("bio").value.trim(),
      is_public: $("isPublic")?.checked ?? true,
      is_active: $("isActive")?.checked ?? true,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    };

    const { error: profileError } = await supabaseClient
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (profileError) throw profileError;

    if (phone) {
      const { error: contactError } = await supabaseClient
        .from("profile_contacts")
        .upsert(
          {
            user_id: currentUser.id,
            phone
          },
          { onConflict: "user_id" }
        );

      if (contactError) throw contactError;
    }

    selectedPhoto = null;

    showMessage(
      "profileMessage",
      "আপনার প্রোফাইল সফলভাবে সংরক্ষণ হয়েছে!",
      true
    );

    await loadProfiles();
    showToast("প্রোফাইল সংরক্ষণ হয়েছে!");

  } catch (error) {
    console.error("Profile save error:", error);

    showMessage(
      "profileMessage",
      error.message || "প্রোফাইল সংরক্ষণ হয়নি।"
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "প্রোফাইল সংরক্ষণ করুন";
    }
  }
}

/* ============================================
   SEARCH AND DISPLAY PROFILES
============================================ */

async function loadProfiles(searchTerm = "", locationTerm = "") {
  const container = $("searchResults");
  const count = $("resultCount");

  if (!container) return;

  container.replaceChildren();

  const loading = document.createElement("div");
  loading.className = "empty-state";
  loading.textContent = "প্রোফাইল লোড হচ্ছে...";
  container.appendChild(loading);

  try {
    let query = supabaseClient
      .from("profiles")
      .select(
        "id,full_name,profession,location,division,district,upazila,experience,bio,avatar_url,is_active"
      )
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (searchTerm) {
      query = query.ilike("profession", `%${searchTerm}%`);
    }

    if (locationTerm) {
      query = query.ilike("location", `%${locationTerm}%`);
    }

    // এখানে is_active দিয়ে কোনো filter দেওয়া হয়নি।
    // তাই Active এবং Inactive উভয় প্রোফাইল দেখা যাবে।

    const { data: profiles, error } = await query;

    if (error) throw error;

    container.replaceChildren();

    if (!profiles || profiles.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "কোনো প্রোফাইল পাওয়া যায়নি।";
      container.appendChild(empty);

      if (count) count.textContent = "০টি প্রোফাইল";
      return;
    }

    const ids = profiles.map(profile => profile.id);
    let contacts = [];

    const { data: contactData, error: contactError } =
      await supabaseClient
        .from("profile_contacts")
        .select("user_id,phone")
        .in("user_id", ids);

    if (!contactError && contactData) {
      contacts = contactData;
    }

    const contactMap = new Map(
      contacts.map(item => [item.user_id, item.phone])
    );

    profiles.forEach(profile => {
      const card = document.createElement("article");
      card.className = "person-card";

      const image = document.createElement("img");
      image.className = "person-avatar";
      image.alt = profile.full_name || "প্রোফাইল ছবি";

      if (profile.avatar_url) {
        image.src = profile.avatar_url;
      } else {
        image.style.display = "none";
      }

      image.onerror = () => {
        image.style.display = "none";
      };

      const name = document.createElement("h3");
      name.textContent = profile.full_name || "নাম দেওয়া হয়নি";

      const profession = document.createElement("p");
      profession.className = "person-profession";
      profession.textContent = profile.profession || "";

      // Profile Active / Inactive status
      const status = document.createElement("p");

      status.className = profile.is_active
        ? "profile-status active"
        : "profile-status inactive";

      status.textContent = profile.is_active
        ? "🟢 Active — কাজ নিচ্ছেন"
        : "⚪ Inactive — আপাতত কাজ নিচ্ছেন না";

      const location = document.createElement("p");
      location.textContent = [
        profile.division,
        profile.district,
        profile.upazila
      ].filter(Boolean).join(", ");

      const experience = document.createElement("p");
      experience.textContent = profile.experience
        ? `অভিজ্ঞতা: ${profile.experience}`
        : "";

      const bio = document.createElement("p");
      bio.textContent = profile.bio || "";

      card.append(
        image,
        name,
        profession,
        status,
        location,
        experience,
        bio
      );

      const phone = contactMap.get(profile.id);

      if (phone) {
        const phoneText = document.createElement("p");
        phoneText.textContent = `মোবাইল: ${phone}`;
        card.appendChild(phoneText);
      }

      if (currentUser && currentUser.id !== profile.id) {
        const reportButton = document.createElement("button");

        reportButton.type = "button";
        reportButton.className = "btn btn-outline";
        reportButton.textContent = "প্রোফাইল রিপোর্ট করুন";

        reportButton.addEventListener("click", () => {
          $("reportedProfileId").value = profile.id;
          $("report").scrollIntoView({ behavior: "smooth" });

          showMessage(
            "reportMessage",
            "রিপোর্টের কারণ নির্বাচন করুন।",
            true
          );
        });

        card.appendChild(reportButton);
      }

      container.appendChild(card);
    });

    if (count) {
      count.textContent = `${profiles.length}টি প্রোফাইল`;
    }

  } catch (error) {
    console.error("Search error:", error);

    container.replaceChildren();

    const message = document.createElement("div");
    message.className = "empty-state";
    message.textContent =
      "প্রোফাইল লোড করা যায়নি। পরে আবার চেষ্টা করুন।";

    container.appendChild(message);

    if (count) count.textContent = "লোড করা যায়নি";
  }
}

/* ============================================
   SEARCH FORM
============================================ */

async function handleSearch(event) {
  event.preventDefault();

  const searchTerm = $("searchInput").value.trim();
  const locationTerm = $("locationInput").value.trim();

  $("people")?.scrollIntoView({ behavior: "smooth" });

  await loadProfiles(searchTerm, locationTerm);
}

/* ============================================
   PROFILE REPORT
============================================ */

async function handleReport(event) {
  event.preventDefault();

  if (!currentUser) {
    openAuthModal("signin");

    showMessage(
      "reportMessage",
      "রিপোর্ট করতে আগে সাইন ইন করুন।"
    );

    return;
  }

  const reportedId = $("reportedProfileId").value;
  const reason = $("reportReason").value;

  if (!reportedId) {
    showMessage(
      "reportMessage",
      "আগে একটি প্রোফাইল থেকে রিপোর্ট নির্বাচন করুন।"
    );
    return;
  }

  if (reportedId === currentUser.id) {
    showMessage(
      "reportMessage",
      "নিজের প্রোফাইল রিপোর্ট করা যাবে না।"
    );
    return;
  }

  if (!reason) {
    showMessage(
      "reportMessage",
      "রিপোর্টের কারণ নির্বাচন করুন।"
    );
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("profile_reports")
      .insert({
        reporter_id: currentUser.id,
        reported_profile_id: reportedId,
        reason,
        status: "pending"
      });

    if (error) throw error;

    $("reportForm").reset();
    $("reportedProfileId").value = "";

    showMessage(
      "reportMessage",
      "আপনার রিপোর্ট পাঠানো হয়েছে।",
      true
    );

  } catch (error) {
    console.error("Report error:", error);

    showMessage(
      "reportMessage",
      error.message || "রিপোর্ট পাঠানো যায়নি।"
    );
  }
}

/* ============================================
   CATEGORY BUTTONS
============================================ */

document.querySelectorAll("[data-category]").forEach(button => {
  button.addEventListener("click", () => {
    $("searchInput").value = button.dataset.category || "";
    $("locationInput").value = "";

    $("people")?.scrollIntoView({ behavior: "smooth" });

    loadProfiles(button.dataset.category || "", "");
  });
});

/* ============================================
   NAVIGATION
============================================ */

$("menuToggle")?.addEventListener("click", () => {
  $("mainNav")?.classList.toggle("open");
});

document.querySelectorAll("#mainNav a").forEach(link => {
  link.addEventListener("click", () => {
    $("mainNav")?.classList.remove("open");
  });
});

$("navSearch")?.addEventListener("click", () => {
  $("searchForm")?.scrollIntoView({ behavior: "smooth" });
  $("searchInput")?.focus();
});

/* ============================================
   INITIALIZE WEBSITE
============================================ */

function initializeBondhon() {
  console.log("Bondhon starting...");

  initializeAuthPhoneInput();

  $("signinBtn")?.addEventListener("click", () => {
    openAuthModal("signin");
  });

  $("signupBtn")?.addEventListener("click", () => {
    openAuthModal("signup");
  });

  $("profileSignIn")?.addEventListener("click", () => {
    openAuthModal("signin");
  });

  $("joinBtn")?.addEventListener("click", () => {
    openAuthModal("signup");
  });

  $("closeAuth")?.addEventListener("click", closeAuthModal);

  $("switchAuth")?.addEventListener("click", () => {
    authMode = authMode === "signin" ? "signup" : "signin";
    updateAuthUI();
  });

  $("authForm")?.addEventListener(
    "submit",
    handleAuthentication
  );

  $("profileForm")?.addEventListener(
    "submit",
    handleProfileSave
  );

  $("searchForm")?.addEventListener(
    "submit",
    handleSearch
  );

  $("reportForm")?.addEventListener(
    "submit",
    handleReport
  );

  $("signoutBtn")?.addEventListener(
    "click",
    handleSignOut
  );

  $("authModal")?.addEventListener("click", event => {
    if (event.target === $("authModal")) {
      closeAuthModal();
    }
  });

  if ($("year")) {
    $("year").textContent = new Date().getFullYear();
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;

    setTimeout(() => {
      updateAuthButtons();

      loadProfiles(
        $("searchInput")?.value.trim() || "",
        $("locationInput")?.value.trim() || ""
      );
    }, 0);
  });

  updateAuthButtons();
  loadProfiles();

  console.log("Bondhon is ready!");
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeBondhon
  );
} else {
  initializeBondhon();
}
