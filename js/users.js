
import { supabase } from "./supabaseClient.js";

// ========================================
// ELEMENTS
// ========================================

const usersTableBody = document.getElementById("usersTableBody");

const totalUsers = document.getElementById("totalUsers");
const adminCount = document.getElementById("adminCount");
const managerCount = document.getElementById("managerCount");
const staffCount = document.getElementById("staffCount");

const searchUsers = document.getElementById("searchUsers");
const roleFilter = document.getElementById("roleFilter");
const departmentFilter = document.getElementById("departmentFilter");

const userModal = document.getElementById("userModal");
const userForm = document.getElementById("userForm");

const addUserBtn = document.getElementById("addUserBtn");
const closeUserModal = document.getElementById("closeUserModal");
const cancelUserBtn = document.getElementById("cancelUserBtn");

const userRole = document.getElementById("userRole");
const userDepartment = document.getElementById("userDepartment");
const departmentGroup = document.getElementById("departmentGroup");

const userFormMessage = document.getElementById("userFormMessage");
const saveUserBtn = document.getElementById("saveUserBtn");

const headerUserName = document.getElementById("headerUserName");
const headerUserAvatar = document.getElementById("headerUserAvatar");

// Edit User Elements
const editUserModal = document.getElementById("editUserModal");
const editUserForm = document.getElementById("editUserForm");
const editUserId = document.getElementById("editUserId");
const editFirstName = document.getElementById("editFirstName");
const editLastName = document.getElementById("editLastName");
const editUserEmail = document.getElementById("editUserEmail");
const editUserRole = document.getElementById("editUserRole");
const editUserDepartment = document.getElementById("editUserDepartment");
const editDepartmentGroup = document.getElementById("editDepartmentGroup");
const editUserMessage = document.getElementById("editUserMessage");
const updateUserBtn = document.getElementById("updateUserBtn");

// ========================================
// VARIABLES
// ========================================

let users = [];
let currentAdminId = null;

// ========================================
// HELPER FUNCTIONS
// ========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function showMessage(message, isError = false) {
    userFormMessage.textContent = message;
    userFormMessage.style.color = isError ? "#b42318" : "#34734b";
}

function formatDate(date) {
    if (!date) return "N/A";

    return new Date(date).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

// ========================================
// ADMIN ACCESS PROTECTION
// ========================================

async function protectUsersPage() {
    const {
        data: { session },
        error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
        window.location.href = "../index.html";
        return false;
    }

    const { data: profile, error } = await supabase
        .from("users")
        .select("id, first_name, last_name, role, is_active")
        .eq("id", session.user.id)
        .maybeSingle();

    if (error || !profile) {
        await supabase.auth.signOut();
        window.location.href = "../index.html";
        return false;
    }

    // Reject inactive accounts
    if (!profile.is_active) {
        await supabase.auth.signOut();
        window.location.href = "../index.html";
        return false;
    }

    // Only Admin accounts can access User Management
    if (profile.role !== "Admin") {
        alert("Admin access required.");
        await supabase.auth.signOut();
        window.location.href = "../index.html";
        return false;
    }

    currentAdminId = profile.id;

    const fullName =
        `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
        || "Administrator";

    headerUserName.textContent = fullName;
    headerUserAvatar.textContent = fullName.charAt(0).toUpperCase();

    return true;
}

// ========================================
// LOAD USERS
// ========================================

async function loadUsers() {
    usersTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                Loading users...
            </td>
        </tr>
    `;

    const { data, error } = await supabase
        .from("users")
        .select(`
            id,
            first_name,
            last_name,
            email,
            role,
            department,
            created_at,
            is_active
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error loading users:", error);

        usersTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    Unable to load users. Please refresh the page.
                </td>
            </tr>
        `;

        return;
    }

    users = data ?? [];

    updateStatistics();
    displayUsers();
}

// ========================================
// USER STATISTICS
// ========================================

function updateStatistics() {
    totalUsers.textContent = users.length;

    adminCount.textContent = users.filter(
        user => user.role === "Admin"
    ).length;

    managerCount.textContent = users.filter(
        user => user.role === "Head Manager"
    ).length;

    staffCount.textContent = users.filter(
        user => user.role === "Department Staff"
    ).length;
}

// ========================================
// DISPLAY USERS
// ========================================

function displayUsers() {
    const searchTerm = searchUsers.value.toLowerCase().trim();
    const selectedRole = roleFilter.value;
    const selectedDepartment = departmentFilter.value;

    const filteredUsers = users.filter(user => {
        const fullName =
            `${user.first_name} ${user.last_name}`.toLowerCase();

        const matchesSearch =
            fullName.includes(searchTerm) ||
            (user.email ?? "").toLowerCase().includes(searchTerm);

        const matchesRole =
            selectedRole === "All" || user.role === selectedRole;

        const matchesDepartment =
            selectedDepartment === "All" ||
            user.department === selectedDepartment;

        return matchesSearch && matchesRole && matchesDepartment;
    });

    if (filteredUsers.length === 0) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No users found.
                </td>
            </tr>
        `;

        return;
    }

    usersTableBody.innerHTML = filteredUsers.map(user => {
        const fullName =
            `${user.first_name} ${user.last_name}`.trim();

        const role = escapeHTML(user.role);
        const department = escapeHTML(user.department || "None");

        const accountStatus = user.is_active
            ? `<span class="status-badge active">Active</span>`
            : `<span class="status-badge inactive">Inactive</span>`;

        const actionButtons = user.id === currentAdminId
        ? `<span class="current-account-label">Current account</span>`
        : `
            <div class="user-actions">
                <button
                    type="button"
                    class="table-action-btn"
                    data-edit-user="${escapeHTML(user.id)}"
                >
                    Edit
                </button>

                <button
                    type="button"
                    class="table-action-btn status-toggle-btn"
                    data-toggle-status="${escapeHTML(user.id)}"
                    data-current-status="${user.is_active}"
                >
                    ${user.is_active ? "Deactivate" : "Activate"}
                </button>
            </div>
        `;

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(fullName)}</strong>
                </td>

                <td>${escapeHTML(user.email)}</td>

                <td>
                    <span class="role-badge">${role}</span>
                </td>

                <td>${department}</td>

                <td>${formatDate(user.created_at)}</td>

                <td>${accountStatus}</td>

                <td>${actionButtons}</td>
            </tr>
        `;
    }).join("");
}

// ========================================
// CREATE USER MODAL
// ========================================

function openModal() {
    userForm.reset();

    showMessage("");

    departmentGroup.style.display = "flex";
    userDepartment.required = true;

    userModal.classList.add("show");
}

function closeModal() {
    userModal.classList.remove("show");
    userForm.reset();
    showMessage("");
}

addUserBtn.addEventListener("click", openModal);

closeUserModal.addEventListener("click", closeModal);

cancelUserBtn.addEventListener("click", closeModal);

// ========================================
// CREATE USER ROLE HANDLING
// ========================================

userRole.addEventListener("change", () => {
    if (userRole.value === "Admin") {
        departmentGroup.style.display = "none";
        userDepartment.required = false;
        userDepartment.value = "";
    } else {
        departmentGroup.style.display = "flex";
        userDepartment.required = true;
    }
});

// ========================================
// CREATE USER
// ========================================

userForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const first_name =
        document.getElementById("firstName").value.trim();

    const last_name =
        document.getElementById("lastName").value.trim();

    const email =
        document.getElementById("email").value.trim().toLowerCase();

    const password =
        document.getElementById("password").value;

    const role = userRole.value;

    const department =
        role === "Admin" ? null : userDepartment.value;

    if (!first_name || !last_name || !email || !password || !role) {
        showMessage("Please complete all required fields.", true);
        return;
    }

    if (password.length < 10) {
        showMessage(
            "Password must contain at least 10 characters.",
            true
        );
        return;
    }

    if (role !== "Admin" && !department) {
        showMessage("Please select a department.", true);
        return;
    }

    saveUserBtn.disabled = true;
    saveUserBtn.textContent = "Creating...";

    showMessage("Creating account...");

    try {
        const { data, error } = await supabase.functions.invoke(
            "admin-create-user",
            {
                body: {
                    first_name,
                    last_name,
                    email,
                    password,
                    role,
                    department
                }
            }
        );

        if (error) {
            throw new Error(
                data?.error || error.message ||
                "Unable to create account."
            );
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        showMessage("Account created successfully!");

        await loadUsers();

        setTimeout(() => {
            closeModal();
        }, 1000);

    } catch (error) {
        console.error("Create user error:", error);

        showMessage(
            error.message || "Something went wrong.",
            true
        );

    } finally {
        saveUserBtn.disabled = false;
        saveUserBtn.textContent = "Create Account";
    }
});

// ========================================
// EDIT USER MODAL
// ========================================

function openEditUserModal(user) {
    editUserForm.reset();

    editUserId.value = user.id;
    editFirstName.value = user.first_name || "";
    editLastName.value = user.last_name || "";
    editUserEmail.value = user.email || "";
    editUserRole.value = user.role || "Department Staff";
    editUserDepartment.value = user.department || "";

    editUserMessage.textContent = "";

    const isAdmin = user.role === "Admin";

    editDepartmentGroup.style.display =
        isAdmin ? "none" : "block";

    editUserDepartment.required = !isAdmin;

    editUserModal.classList.add("show");
}

function closeEditUserModal() {
    editUserModal.classList.remove("show");
    editUserForm.reset();
    editUserMessage.textContent = "";
}

// ========================================
// EDIT USER
// ========================================

function editUser(userId) {
    // Use the existing users array
    const user = users.find(u => u.id === userId);

    if (!user) {
        alert("User not found.");
        return;
    }

    if (user.id === currentAdminId) {
        alert("You cannot edit your own account here.");
        return;
    }

    openEditUserModal(user);
}

// ========================================
// EDIT USER MODAL CONTROLS
// ========================================

document.getElementById("closeEditUserModal")
    .addEventListener("click", closeEditUserModal);

document.getElementById("cancelEditUserBtn")
    .addEventListener("click", closeEditUserModal);

editUserModal.addEventListener("click", event => {
    if (event.target === editUserModal) {
        closeEditUserModal();
    }
});

// Show or hide department based on selected role
editUserRole.addEventListener("change", () => {
    const isAdmin = editUserRole.value === "Admin";

    editDepartmentGroup.style.display =
        isAdmin ? "none" : "block";

    editUserDepartment.required = !isAdmin;

    if (isAdmin) {
        editUserDepartment.value = "";
    }
});

// ========================================
// SAVE EDITED USER
// ========================================

editUserForm.addEventListener("submit", async event => {
    event.preventDefault();

    const userId = editUserId.value;
    const firstName = editFirstName.value.trim();
    const lastName = editLastName.value.trim();
    const role = editUserRole.value;

    const department = role === "Admin"
        ? null
        : editUserDepartment.value;

    if (!firstName || !lastName) {
        editUserMessage.textContent =
            "Please complete the name fields.";
        return;
    }

    if (!["Admin", "Head Manager", "Department Staff"].includes(role)) {
        editUserMessage.textContent = "Invalid user role.";
        return;
    }

    if (
        role !== "Admin" &&
        !["Financial", "Operational", "Marketing"].includes(department)
    ) {
        editUserMessage.textContent = "Please select a valid department.";
        return;
    }

    updateUserBtn.disabled = true;
    updateUserBtn.textContent = "Saving...";
    editUserMessage.textContent = "";

    try {
        const { error } = await supabase.rpc(
            "admin_update_user_profile",
            {
                target_user_id: userId,
                new_first_name: firstName,
                new_last_name: lastName,
                new_role: role,
                new_department: department
            }
        );

        if (error) {
            throw error;
        }

        editUserMessage.textContent =
            "User updated successfully!";

        await loadUsers();

        setTimeout(() => {
            closeEditUserModal();
        }, 800);

    } catch (error) {
        console.error("Update user error:", error);

        editUserMessage.textContent =
            error.message || "Unable to update user.";

    } finally {
        updateUserBtn.disabled = false;
        updateUserBtn.textContent = "Save Changes";
    }
});

// ========================================
// TABLE ACTIONS
// ========================================

usersTableBody.addEventListener("click", async event => {
    // EDIT USER
    const editButton = event.target.closest("[data-edit-user]");

    if (editButton) {
        editUser(editButton.dataset.editUser);
        return;
    }

    // ACTIVATE / DEACTIVATE USER
    const statusButton = event.target.closest("[data-toggle-status]");

    if (!statusButton) return;

    const userId = statusButton.dataset.toggleStatus;
    const user = users.find(u => u.id === userId);

    if (!user) return;

    if (user.id === currentAdminId) {
        alert("You cannot deactivate your own account.");
        return;
    }

    const newStatus = !user.is_active;

    const action = newStatus ? "activate" : "deactivate";

    const confirmed = confirm(
        `Are you sure you want to ${action} ${user.first_name} ${user.last_name}?`
    );

    if (!confirmed) return;

    statusButton.disabled = true;
    statusButton.textContent = "Updating...";

    try {
        const { error } = await supabase.rpc("admin_set_user_status", {
            target_user_id: userId,
            new_status: newStatus
        });

        if (error) throw error;
        await loadUsers();

    } catch (error) {
        console.error("Account status update error:", error);

        alert(
            error.message || "Unable to update account status."
        );

        statusButton.disabled = false;
        statusButton.textContent =
            user.is_active ? "Deactivate" : "Activate";
    }
});

// ========================================
// SEARCH AND FILTERS
// ========================================

searchUsers.addEventListener("input", displayUsers);
roleFilter.addEventListener("change", displayUsers);
departmentFilter.addEventListener("change", displayUsers);

// ========================================
// INITIALIZE PAGE
// ========================================

async function initializeUsersPage() {
    const isAdmin = await protectUsersPage();

    if (!isAdmin) return;

    await loadUsers();
}

initializeUsersPage();
