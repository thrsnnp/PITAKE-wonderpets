
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
const logoutBtn = document.getElementById("logoutBtn");

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
        .select("id, first_name, last_name, role")
        .eq("id", session.user.id)
        .maybeSingle();

    if (error || !profile || profile.role !== "Admin") {
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
            created_at
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

        const editButton = user.id === currentAdminId
            ? `<span>Current account</span>`
            : `
                <button
                    class="table-action-btn"
                    data-edit-user="${escapeHTML(user.id)}"
                >
                    Edit
                </button>
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

                <td>${editButton}</td>
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
// ROLE AND DEPARTMENT HANDLING
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
// EDIT USER
// ========================================

async function editUser(userId) {
    const user = users.find(item => item.id === userId);

    if (!user) return;

    const firstName = prompt(
        "Enter first name:",
        user.first_name
    );

    if (firstName === null) return;

    const lastName = prompt(
        "Enter last name:",
        user.last_name
    );

    if (lastName === null) return;

    const role = prompt(
        "Enter role:\nAdmin\nHead Manager\nDepartment Staff",
        user.role
    );

    if (role === null) return;

    const validRoles = [
        "Admin",
        "Head Manager",
        "Department Staff"
    ];

    if (!validRoles.includes(role)) {
        alert("Invalid role.");
        return;
    }

    let department = null;

    if (role !== "Admin") {
        department = prompt(
            "Enter department:\nFinancial\nOperational\nMarketing",
            user.department || "Operational"
        );

        if (department === null) return;

        const validDepartments = [
            "Financial",
            "Operational",
            "Marketing"
        ];

        if (!validDepartments.includes(department)) {
            alert("Invalid department.");
            return;
        }
    }

    if (!firstName.trim() || !lastName.trim()) {
        alert("First name and last name are required.");
        return;
    }

    const confirmed = confirm(
        `Save changes to ${user.first_name} ${user.last_name}?`
    );

    if (!confirmed) return;

    try {
        const { error } = await supabase.rpc(
            "admin_update_user_profile",
            {
                target_user_id: userId,
                new_first_name: firstName.trim(),
                new_last_name: lastName.trim(),
                new_role: role,
                new_department: department
            }
        );

        if (error) throw error;

        alert("User information updated successfully!");

        await loadUsers();

    } catch (error) {
        console.error("Update user error:", error);

        alert(
            error.message || "Unable to update user information."
        );
    }
}

// ========================================
// TABLE ACTIONS
// ========================================

usersTableBody.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-user]");

    if (!editButton) return;

    editUser(editButton.dataset.editUser);
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
