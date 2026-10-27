
/* =========================================================
   KajKhun - Complete Fresh script.js
   Authentication, profiles, search, photo upload, reports
   ========================================================= */

"use strict";

const SUPABASE_URL =
  "https://lyuzgzudmnmarbnsplvk.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_HET6b58nsRcn54-mBRxL6g_gm8HM0UX";

let supabaseClient = null;
let currentUser = null;
let authDialog = null;
let authMode = "signin";
let currentProfilePhotoUrl = null;
let photoPreviewObjectUrl = null;

const $ = (id) => document.getElementById(id);

function val(id) {
  return $(id)?.value?.trim() || "";
}

function setVal(id, value) {
  if ($(id)) $(id).value = value ?? "";
}

function status(id, message) {
  if ($(id)) $(id).textContent = message || "";
}

/* ==================== AUTH UI ==================== */

function setAuthButtons(user) {
  currentUser = user || null;

  if ($("signinBtn")) {
    $("signinBtn").hidden = !!user;
  }

  if ($("signoutBtn")) {
    $("signoutBtn").hidden = !user;
  }

  status(
    "authStatus",
    user
      ? `Signed in as ${user.email || "user"}`
      : "আপনি সাইন ইন করেননি।"
  );
}

function showDialog(dialog) {
  if (!dialog) return;

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.hidden = false;
    dialog.style.display = "block";
  }
}

function hideDialog(dialog) {
  if (!dialog) return;

  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.hidden = true;
    dialog.style.display = "none";
  }
}

/* ==================== SIGN UP / SIGN IN ==================== */

function makeAuthDialog() {
  if (authDialog) return authDialog;

  authDialog = document.createElement("dialog");
  authDialog.id = "kajKhunAuthDialog";

  authDialog.innerHTML = `
    <h2 id="authTitle">Sign In</h2>

    <form id="authForm">
      <label for="authEmail">Email</label>
      <input
        id="authEmail"
        type="email"
        autocomplete="email"
        required
      >

      <label for="authPassword">Password</label>
      <input
        id="authPassword"
        type="password"
        minlength="6"
        autocomplete="current-password"
        required
      >

      <p id="authMessage" role="status" aria-live="polite"></p>

      <button id="authSubmit" type="submit">Sign In</button>
      <button id="authSwitch" type="button">Create Account</button>
      <button id="authClose" type="button">Close</button>
    </form>
  `;

  authDialog.style.cssText =
    "width:min(420px,92vw);padding:24px;border:0;border-radius:14px;";

  document.body.appendChild(authDialog);

  $("authSwitch").addEventListener("click", () => {
    authMode = authMode === "signin" ? "signup" : "signin";

    $("authTitle").textContent =
      authMode === "signup"
        ? "Create KajKhun Account"
        : "Sign In";

    $("authSubmit").textContent =
      authMode === "signup" ? "Sign Up" : "Sign In";

    $("authSwitch").textContent =
      authMode === "signup"
        ? "Already have an account? Sign In"
        : "Create Account";

    $("authPassword").autocomplete =
      authMode === "signup"
        ? "new-password"
        : "current-password";

    status("authMessage", "");
  });

  $("authClose").addEventListener("click", () => {
    hideDialog(authDialog);
  });

  $("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) return;

    const email = val("authEmail");
    const password = $("authPassword").value;
    const button = $("authSubmit");

    button.disabled = true;
    status("authMessage", "Please wait...");

    try {
      const result =
        authMode === "signup"
          ? await supabaseClient.auth.signUp({
              email,
              password
            })
          : await supabaseClient.auth.signInWithPassword({
              email,
              password
            });

      if (result.error) throw result.error;

      if (authMode === "signup" && !result.data.session) {
        status(
          "authMessage",
          "অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল যাচাই করে তারপর Sign In করুন।"
        );
        return;
      }

      hideDialog(authDialog);

      await refreshSession();
      await loadMyProfile();
      await searchProfiles();
    } catch (error) {
      status(
        "authMessage",
        error.message || "Authentication failed."
      );
    } finally {
      button.disabled = false;
    }
  });

  return authDialog;
}

function openSignIn() {
  authMode = "signin";

  const dialog = makeAuthDialog();

  $("authTitle").textContent = "Sign In";
  $("authSubmit").textContent = "Sign In";
  $("authSwitch").textContent = "Create Account";

  status("authMessage", "");
  showDialog(dialog);
}

async function refreshSession() {
  const { data, error } =
    await supabaseClient.auth.getSession();

  if (error) throw error;

  setAuthButtons(data.session?.user || null);
}

async function signOut() {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    status("authStatus", "Sign Out failed: " + error.message);
    return;
  }

  setAuthButtons(null);
  currentProfilePhotoUrl = null;

  status("profileStatus", "");
  status("reportStatus", "");

  await searchProfiles();
}

/* ==================== INTERNATIONAL PHONE ==================== */

function getPhonePicker() {
  const input = $("profileMobile");
  if (!input) return null;

  if (window.intlTelInput?.getInstance) {
    const instance = window.intlTelInput.getInstance(input);
    if (instance) return instance;
  }

  if (window.intlTelInputGlobals?.getInstance) {
    const instance =
      window.intlTelInputGlobals.getInstance(input);

    if (instance) return instance;
  }

  if (typeof window.intlTelInput === "function") {
    return window.intlTelInput(input, {
      initialCountry: "bd",
      separateDialCode: true,
      nationalMode: false,
      preferredCountries: [
        "bd", "us", "gb", "in", "sa", "ae"
      ]
    });
  }

  return null;
}

function getInternationalMobile() {
  const input = $("profileMobile");
  if (!input) return "";

  const picker = getPhonePicker();

  if (picker && input.value.trim()) {
    return (picker.getNumber() || input.value).trim();
  }

  return input.value.trim();
}

/* ==================== PROFILE PHOTO ==================== */

function previewSelectedPhoto() {
  const input = $("profilePhoto");
  const file = input?.files?.[0];

  if (!file) return;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    status(
      "profileStatus",
      "JPG, PNG অথবা WebP ছবি নির্বাচন করুন।"
    );

    input.value = "";
    return;
  }

  if (file.size > 3 * 1024 * 1024) {
    status(
      "profileStatus",
      "ছবির সাইজ সর্বোচ্চ 3 MB হতে পারবে।"
    );

    input.value = "";
    return;
  }

  let preview = $("profilePhotoPreview");

  if (!preview) {
    preview = document.createElement("img");
    preview.id = "profilePhotoPreview";
    preview.alt = "Profile photo preview";

    preview.style.cssText =
      "width:120px;height:120px;object-fit:cover;border-radius:50%;";

    input.insertAdjacentElement("afterend", preview);
  }

  if (photoPreviewObjectUrl) {
    URL.revokeObjectURL(photoPreviewObjectUrl);
  }

  photoPreviewObjectUrl = URL.createObjectURL(file);
  preview.src = photoPreviewObjectUrl;
  preview.hidden = false;

  status("profileStatus", "");
}

async function uploadProfilePhoto(file) {
  if (!currentUser) {
    throw new Error("প্রথমে Sign In করুন।");
  }

  if (!file) return currentProfilePhotoUrl;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("JPG, PNG অথবা WebP ছবি নির্বাচন করুন।");
  }

  if (file.size > 3 * 1024 * 1024) {
    throw new Error("ছবির সাইজ সর্বোচ্চ 3 MB হতে পারবে।");
  }

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

  const filePath =
    `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabaseClient
    .storage
    .from("profile-photos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;

  const { data } = supabaseClient
    .storage
    .from("profile-photos")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/* ==================== SAVE PROFILE ==================== */

async function saveProfile(event) {
  event?.preventDefault();

  if (!currentUser) {
    status(
      "profileStatus",
      "প্রোফাইল সংরক্ষণের আগে Sign In করুন।"
    );

    openSignIn();
    return;
  }

  const full_name = val("profileName");
  const profession = val("profileProfession");
  const location = val("profileLocation");
  const division = val("profileDivision");
  const district = val("profileDistrict");
  const upazila = val("profileUpazila");
  const experience = val("profileExperience");
  const bio = val("profileBio");

  const is_public =
    $("profileIsPublic")?.checked ?? true;

  const mobile = getInternationalMobile();

  if (!full_name || !profession) {
    status("profileStatus", "নাম ও পেশা অবশ্যই লিখুন।");
    return;
  }

  const button =
    $("saveProfileBtn") ||
    $("profileForm")?.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

  if (button) button.disabled = true;

  status("profileStatus", "প্রোফাইল সংরক্ষণ হচ্ছে...");

  try {
    const selectedPhoto =
      $("profilePhoto")?.files?.[0] || null;

    let photoUrl = currentProfilePhotoUrl;

    if (selectedPhoto) {
      photoUrl = await uploadProfilePhoto(selectedPhoto);
    }

    const profileData = {
      id: currentUser.id,
      full_name,
      profession,
      location,
      division,
      district,
      upazila,
      experience,
      bio,
      is_public,
      avatar_url: photoUrl,
      updated_at: new Date().toISOString()
    };

    const { error: profileError } = await supabaseClient
      .from("profiles")
      .upsert(profileData, {
        onConflict: "id"
      });

    if (profileError) throw profileError;

    if (mobile) {
      const { error: contactError } = await supabaseClient
        .from("profile_contacts")
        .upsert(
          {
            user_id: currentUser.id,
            phone: mobile
          },
          {
            onConflict: "user_id"
          }
        );

      if (contactError) {
        currentProfilePhotoUrl = photoUrl;

        status(
          "profileStatus",
          "প্রোফাইল সংরক্ষণ হয়েছে, কিন্তু ফোন নম্বর সংরক্ষণ হয়নি: " +
            contactError.message
        );

        await searchProfiles();
        return;
      }
    }

    currentProfilePhotoUrl = photoUrl;

    if ($("profilePhoto")) {
      $("profilePhoto").value = "";
    }

    const preview = $("profilePhotoPreview");

    if (preview && photoUrl) {
      preview.src = photoUrl;
      preview.hidden = false;
    }

    status(
      "profileStatus",
      "প্রোফাইল ও যোগাযোগের তথ্য সংরক্ষণ হয়েছে।"
    );

    await loadMyProfile();
    await searchProfiles();
  } catch (error) {
    console.error("Profile save error:", error);

    status(
      "profileStatus",
      "প্রোফাইল সংরক্ষণ করা যায়নি: " + error.message
    );
  } finally {
    if (button) button.disabled = false;
  }
}

/* ==================== LOAD MY PROFILE ==================== */

async function loadMyProfile() {
  if (!currentUser || !supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select(
        "full_name, profession, location, division, district, upazila, experience, bio, is_public, avatar_url"
      )
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      setVal("profileName", data.full_name);
      setVal("profileProfession", data.profession);
      setVal("profileLocation", data.location);
      setVal("profileDivision", data.division);
      setVal("profileDistrict", data.district);
      setVal("profileUpazila", data.upazila);
      setVal("profileExperience", data.experience);
      setVal("profileBio", data.bio);

      if ($("profileIsPublic")) {
        $("profileIsPublic").checked =
          data.is_public !== false;
      }

      currentProfilePhotoUrl = data.avatar_url || null;

      const preview = $("profilePhotoPreview");

      if (preview && currentProfilePhotoUrl) {
        preview.src = currentProfilePhotoUrl;
        preview.hidden = false;
      }
    }

    const { data: contact, error: contactError } =
      await supabaseClient
        .from("profile_contacts")
        .select("fullPhoneNumber")
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (contactError) {
      console.warn(
        "Contact load error:",
        contactError.message
      );
    } else if (contact) {
      const picker = getPhonePicker();

      if (picker && contact.phone) {
        try {
          picker.setNumber(contact.phone);
        } catch {
          setVal("profileMobile", contact.phone);
        }
      } else {
        setVal("profileMobile", contact.phone);
      }
    }
  } catch (error) {
    console.error("Load profile error:", error);

    status(
      "profileStatus",
      "প্রোফাইল লোড করা যায়নি: " + error.message
    );
  }
}

/* ==================== SEARCH PUBLIC PROFILES ==================== */

async function searchProfiles(event) {
  if (event) event.preventDefault();
  if (!supabaseClient) return;

  const term = val("searchInput");
  const locationTerm = val("locationInput");

  const results =
    $("searchResults") ||
    $("peopleGrid") ||
    $("people");

  if (!results) {
    status(
      "searchStatus",
      "HTML-এ searchResults বা peopleGrid ID পাওয়া যায়নি।"
    );
    return;
  }

  results.replaceChildren();
  status("searchStatus", "প্রোফাইল খোঁজা হচ্ছে...");

  try {
    let query = supabaseClient
      .from("profiles")
      .select(
        "id, full_name, profession, location, division, district, upazila, experience, bio, avatar_url"
      )
      .eq("is_public", true)
      .limit(50);

    if (term) {
      query = query.or(
        `full_name.ilike.%${term}%,profession.ilike.%${term}%`
      );
    }

    if (locationTerm) {
      query = query.or(
        `location.ilike.%${locationTerm}%,division.ilike.%${locationTerm}%,district.ilike.%${locationTerm}%,upazila.ilike.%${locationTerm}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data?.length) {
      results.textContent =
        "কোনো পাবলিক প্রোফাইল পাওয়া যায়নি।";

      status("searchStatus", "");
      return;
    }

    const ids = data.map((profile) => profile.id);
    const contactsByUser = {};

    const { data: contacts, error: contactError } =
      await supabaseClient
        .from("profile_contacts")
        .select("user_id, phone")
        .in("user_id", ids);

    if (contactError) {
      console.warn(
        "Public contact lookup:",
        contactError.message
      );
    } else {
      for (const contact of contacts || []) {
        contactsByUser[contact.user_id] = contact.phone;
      }
    }

    for (const profile of data) {
      const card = document.createElement("article");
      card.className = "profile-card";

      const imageUrl =
        profile.avatar_url || profile.photo_url;

      if (imageUrl) {
        const image = document.createElement("img");

        image.src = imageUrl;
        image.alt =
          (profile.full_name || "Profile") + " এর ছবি";
        image.loading = "lazy";

        image.style.cssText =
          "width:100px;height:100px;object-fit:cover;border-radius:50%;";

        card.appendChild(image);
      }

      const heading = document.createElement("h3");
      heading.textContent =
        profile.full_name || "নাম উল্লেখ নেই";

      card.appendChild(heading);

      const addLine = (label, text) => {
        if (!text) return;

        const p = document.createElement("p");
        p.textContent = `${label}: ${text}`;
        card.appendChild(p);
      };

      addLine("পেশা", profile.profession);
      addLine("বিভাগ", profile.division);
      addLine("জেলা", profile.district);
      addLine("থানা/উপজেলা", profile.upazila);
      addLine("এলাকা", profile.location);
      addLine("অভিজ্ঞতা", profile.experience);
      addLine("মোবাইল", contactsByUser[profile.id]);
      addLine("সম্পর্কে", profile.bio);

      if (!currentUser || profile.id !== currentUser.id) {
        const reportButton =
          document.createElement("button");

        reportButton.type = "button";
        reportButton.textContent = "প্রোফাইল রিপোর্ট করুন";

        reportButton.addEventListener("click", () => {
          if ($("reportProfileId")) {
            $("reportProfileId").value = profile.id;
          }

          const reportSection =
            $("report") || $("reportForm");

          reportSection?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        });

        card.appendChild(reportButton);
      }

      results.appendChild(card);
    }

    status(
      "searchStatus",
      `${data.length}টি প্রোফাইল পাওয়া গেছে।`
    );
  } catch (error) {
    console.error("Search error:", error);

    status(
      "searchStatus",
      "সার্চ করা যায়নি: " + error.message
    );
  }
}

/* ==================== REPORT PROFILE ==================== */

async function submitReport(event) {
  event.preventDefault();

  if (!currentUser) {
    status(
      "reportStatus",
      "রিপোর্ট জমা দিতে আগে Sign In করুন।"
    );

    openSignIn();
    return;
  }

  const reported_profile_id = val("reportProfileId");
  const reason = val("reportReason");

  if (!reported_profile_id || !reason) {
    status(
      "reportStatus",
      "প্রোফাইল ও অভিযোগের কারণ নির্বাচন করুন।"
    );
    return;
  }

  if (reported_profile_id === currentUser.id) {
    status(
      "reportStatus",
      "নিজের প্রোফাইল রিপোর্ট করা যাবে না।"
    );
    return;
  }

  const button =
    $("submitReportBtn") ||
    $("reportForm")?.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

  if (button) button.disabled = true;

  status("reportStatus", "রিপোর্ট জমা হচ্ছে...");

  try {
    const { error } = await supabaseClient
      .from("profile_reports")
      .insert({
        reporter_id: currentUser.id,
        reported_profile_id,
        reason,
        status: "pending"
      });

    if (error) throw error;

    $("reportForm")?.reset();

    status(
      "reportStatus",
      "অভিযোগ সফলভাবে জমা হয়েছে। ধন্যবাদ।"
    );
  } catch (error) {
    status(
      "reportStatus",
      "রিপোর্ট জমা হয়নি: " + error.message
    );
  } finally {
    if (button) button.disabled = false;
  }
}

/* ==================== INITIALIZE WEBSITE ==================== */

document.addEventListener("DOMContentLoaded", async () => {
  $("signinBtn")?.addEventListener("click", openSignIn);
  $("signoutBtn")?.addEventListener("click", signOut);

  $("searchForm")?.addEventListener(
    "submit",
    searchProfiles
  );

  $("profileForm")?.addEventListener(
    "submit",
    saveProfile
  );

  $("profilePhoto")?.addEventListener(
    "change",
    previewSelectedPhoto
  );

  $("reportForm")?.addEventListener(
    "submit",
    submitReport
  );

  if (!window.supabase?.createClient) {
    status(
      "authStatus",
      "Supabase library লোড হয়নি। index.html পরীক্ষা করুন।"
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

  getPhonePicker();

  try {
    await refreshSession();
    await loadMyProfile();
    await searchProfiles();
  } catch (error) {
    console.error("KajKhun startup error:", error);

    status(
      "authStatus",
      "ওয়েবসাইট চালু করতে সমস্যা: " + error.message
    );
  }

  supabaseClient.auth.onAuthStateChange(
    (event, session) => {
      currentUser = session?.user || null;
      setAuthButtons(currentUser);

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        setTimeout(async () => {
          await loadMyProfile();
          await searchProfiles();
        }, 0);
      }

      if (event === "SIGNED_OUT") {
        currentProfilePhotoUrl = null;

        status("profileStatus", "");
        status("reportStatus", "");

        setTimeout(() => {
          searchProfiles();
        }, 0);
      }
    }
  );
});

function setupCountryCodes() {
  const countryCode =
  document.getElementById("countryCode")?.value || "+880";

const localNumber =
  document.getElementById("profileMobile")?.value.trim() || "";

const fullPhoneNumber = localNumber
  ? countryCode + localNumber.replace(/^0+/, "")
  : "";
  if (!select || !window.libphonenumber) return;

  const countries = window.libphonenumber.getCountries();
  const callingCodes = window.libphonenumber.getCountryCallingCode;

  const countryNames = new Intl.DisplayNames(["en"], {
    type: "region"
  });

  const currentCountry = select.value || "+880";
  select.innerHTML = "";

  countries
    .map((country) => ({
      country,
      name: countryNames.of(country) || country,
      code: "+" + callingCodes(country)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(({ country, name, code }) => {
      const option = document.createElement("option");
      option.value = code;
      option.dataset.country = country;
      option.textContent = `${name} (${code})`;

      if (country === "BD") option.selected = true;
      select.appendChild(option);
    });

  if (currentCountry !== "+880") {
    const matchingOption = [...select.options].find(
      (option) => option.value === currentCountry
    );
    if (matchingOption) matchingOption.selected = true;
  }
}

document.addEventListener("DOMContentLoaded", setupCountryCodes);
