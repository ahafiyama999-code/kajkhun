
"use strict";

// Bondhon Admin Panel
const SUPABASE_URL = "https://lyuzgzudmnmarbnsplvk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_HET6b58nsRcn54-mBRxL6g_gm8HM0UX";

const supabaseClient = window.supabase.createClient(
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

let isAdmin = false;

const $ = (id) => document.getElementById(id);

const REPORT_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "reviewing", label: "Reviewing" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" }
];

function setStatus(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function setTableMessage(id, columns, message) {
  const body = $(id);
  if (!body) return;

  body.replaceChildren();

  const row = document.createElement("tr");
  const cell = document.createElement("td");

  cell.colSpan = columns;
  cell.textContent = message;

  row.appendChild(cell);
  body.appendChild(row);
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value == null ? "" : String(value);
  row.appendChild(cell);
  return cell;
}

async function verifyAdmin() {
  isAdmin = false;

  setStatus("adminStatus", "Checking administrator access...");
  setTableMessage("profilesBody", 5, "Checking admin access...");
  setTableMessage("reportsBody", 6, "Checking admin access...");

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    setStatus("adminStatus", "Session error: " + error.message);
    return;
  }

  const user = data?.session?.user;

  if (!user) {
    setStatus(
      "adminStatus",
      "Please sign in to the main website, then refresh this page."
    );
    return;
  }

  const { data: admin, error: adminError } = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError) {
    setStatus("adminStatus", "Admin verification error: " + adminError.message);
    return;
  }

  if (!admin) {
    setStatus("adminStatus", "Access denied: this account is not an admin.");
    return;
  }

  isAdmin = true;
  setStatus("adminStatus", "Admin verified.");

  await Promise.all([loadProfiles(), loadReports()]);
}

async function loadProfiles() {
  if (!isAdmin) return;

  setStatus("profilesStatus", "Loading profiles...");

  const { data: profiles, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    setStatus("profilesStatus", "Could not load profiles: " + error.message);
    setTableMessage("profilesBody", 5, "Profile loading failed.");
    return;
  }

  const body = $("profilesBody");
  if (!body) return;

  body.replaceChildren();

  if (!profiles || profiles.length === 0) {
    setTableMessage("profilesBody", 5, "No profiles found.");
    setStatus("profilesStatus", "No profiles found.");
    return;
  }

  for (const profile of profiles) {
    const row = document.createElement("tr");

    addCell(row, profile.full_name || "Unnamed");
    addCell(row, profile.profession || "Not specified");
    addCell(row, profile.location || "Not specified");
    addCell(row, profile.is_public ? "Yes" : "No");

    const actionCell = document.createElement("td");
    const button = document.createElement("button");

    button.type = "button";
    button.className = "admin-button";
    button.textContent = profile.is_public ? "Make Private" : "Make Public";

    button.addEventListener("click", async () => {
      if (!isAdmin) return;

      button.disabled = true;

      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({
          is_public: !profile.is_public,
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id);

      if (updateError) {
        button.disabled = false;
        setStatus("profilesStatus", "Update failed: " + updateError.message);
        return;
      }

      await loadProfiles();
    });

    actionCell.appendChild(button);
    row.appendChild(actionCell);
    body.appendChild(row);
  }

  setStatus("profilesStatus", "Profiles loaded: " + profiles.length);
}

async function loadReports() {
  if (!isAdmin) return;

  setStatus("reportsStatus", "Loading reports...");

  const { data: reports, error } = await supabaseClient
    .from("profile_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    setStatus("reportsStatus", "Could not load reports: " + error.message);
    setTableMessage("reportsBody", 6, "Report loading failed.");
    return;
  }

  const body = $("reportsBody");
  if (!body) return;

  body.replaceChildren();

  if (!reports || reports.length === 0) {
    setTableMessage("reportsBody", 6, "No reports to display.");
    setStatus("reportsStatus", "No reports to display.");
    return;
  }

  for (const report of reports) {
    const row = document.createElement("tr");

    addCell(row, report.id);
    addCell(row, report.reported_profile_id);
    addCell(row, report.reason);
    addCell(row, report.details || "");

    // Status dropdown
    const statusCell = document.createElement("td");
    const select = document.createElement("select");

    select.className = "admin-button";

    for (const item of REPORT_STATUSES) {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    }

    select.value = REPORT_STATUSES.some(
      item => item.value === report.status
    ) ? report.status : "pending";

    statusCell.appendChild(select);
    row.appendChild(statusCell);

    // Save button
    const actionCell = document.createElement("td");
    const saveButton = document.createElement("button");

    saveButton.type = "button";
    saveButton.className = "admin-button";
    saveButton.textContent = "Save";

    saveButton.addEventListener("click", async () => {
      if (!isAdmin) return;

      saveButton.disabled = true;
      select.disabled = true;

      setStatus("reportsStatus", "Updating report status...");

      const { error: updateError } = await supabaseClient
        .from("profile_reports")
        .update({ status: select.value })
        .eq("id", report.id);

      if (updateError) {
        saveButton.disabled = false;
        select.disabled = false;

        setStatus(
          "reportsStatus",
          "Status update failed: " + updateError.message
        );
        return;
      }

      setStatus("reportsStatus", "Report status updated successfully.");
      await loadReports();
    });

    actionCell.appendChild(saveButton);
    row.appendChild(actionCell);

    body.appendChild(row);
  }

  setStatus("reportsStatus", "Reports loaded: " + reports.length);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!window.supabase?.createClient) {
    setStatus("adminStatus", "Supabase library did not load. Refresh the page.");
    return;
  }

  $("refreshProfiles")?.addEventListener("click", loadProfiles);
  $("refreshReports")?.addEventListener("click", loadReports);

  verifyAdmin().catch(error => {
    setStatus("adminStatus", "Unexpected error: " + error.message);
  });

  supabaseClient.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
      isAdmin = false;
      setStatus("adminStatus", "You are signed out.");
    }
  });
});
