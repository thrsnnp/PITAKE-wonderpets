
import { supabase } from "./supabaseClient.js";

// ==========================================
// 1. PAGE DATA
// ==========================================

// These variables store information that different functions need to use.
let currentUser = null;
let currentProfile = null;

let requisitionRecords = [];
let inventoryItems = [];
let userRecords = [];

// Used for table pagination.
let currentPage = 1;
const rowsPerPage = 8;

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

// Gets an HTML element using its ID.
function getElement(id) {
    return document.getElementById(id);
}

// Displays a simple message to the user.
function showMessage(message) {
    alert(message);
}

// Converts database dates into a readable format.
function formatDate(date) {
    if (!date) return "N/A";

    return new Date(date).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

// Converts a value into safe HTML text.
// This helps prevent unwanted HTML from being inserted into the page.
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}

// Combines a user's first and last name.
function getFullName(user) {
    if (!user) return "Unknown User";

    return `${user.first_name || ""} ${user.last_name || ""}`.trim()
        || "Unknown User";
}

// Converts a status into a CSS-friendly class name.
// Example: "For Revision" becomes "for-revision".
function getStatusClass(status) {
    return String(status || "Pending")
        .toLowerCase()
        .replace(/\s+/g, "-");
}

// Gets the available stock of an inventory item.
// Available stock = Current stock - Reserved stock.
function getAvailableStock(item) {
    return Number(item.current_stock || 0)
        - Number(item.reserved_stock || 0);
}

// ==========================================
// 3. INITIALIZE THE PAGE
// ==========================================

// This is the main starting function.
// It checks the logged-in user, loads their profile,
// and retrieves the data needed by the Requisition page.
async function initializePage() {
    try {
        // Check if a user is currently logged in.
        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        // Return the user to the login page if not authenticated.
        if (error || !user) {
            window.location.href = "../index.html";
            return;
        }

        currentUser = user;

        // Retrieve the user's information from the users table.
        const { data: profile, error: profileError } = await supabase
            .from("users")
            .select("first_name, last_name, role, department")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        currentProfile = profile;

        // Display the logged-in user's name and role.
        if (getElement("userName")) {
            getElement("userName").textContent = getFullName(profile);
        }

        if (getElement("userRole")) {
            getElement("userRole").textContent = profile.role || "";
        }

        // Our HTML uses pageDate, not currentDate.
        if (getElement("pageDate")) {
            getElement("pageDate").textContent =
                new Date().toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                });
        }

        // Load the information needed by the page.
        await Promise.all([
            loadRequisitions(),
            loadInventoryItems()
        ]);

    } catch (error) {
        console.error("Page initialization error:", error);
        showMessage("Unable to initialize the requisition page.");
    }
}

// ==========================================
// 4. LOAD REQUISITIONS
// ==========================================

// Retrieves all requisition records from Supabase.
// The newest requisitions appear first.
async function loadRequisitions() {
    try {
        const { data, error } = await supabase
            .from("requisitions")
            .select("*")
            .order("request_date", { ascending: false });

        if (error) throw error;

        requisitionRecords = data || [];

        // Load the names of the users who requested each requisition.
        await loadRequesterInformation();

        // Update the statistics and table after loading.
        updateRequisitionStatistics();
        displayRequisitionRecords();

    } catch (error) {
        console.error("Requisition loading error:", error);
        showMessage("Unable to load requisitions.");
    }
}

// ==========================================
// 5. LOAD REQUESTER INFORMATION
// ==========================================

// Retrieves the names and departments of users
// who submitted the requisitions.
async function loadRequesterInformation() {
    const requesterIds = [
        ...new Set(
            requisitionRecords
                .map(record => record.requested_by)
                .filter(Boolean)
        )
    ];

    if (requesterIds.length === 0) {
        userRecords = [];
        return;
    }

    const { data, error } = await supabase
        .from("users")
        .select("id, first_name, last_name, department")
        .in("id", requesterIds);

    if (error) throw error;

    userRecords = data || [];
}

// Finds a user's information using their user ID.
function getRequester(userId) {
    return userRecords.find(user => user.id === userId);
}

// ==========================================
// 6. DISPLAY REQUISITION TABLE
// ==========================================

// Displays requisitions based on the current search,
// filters, and pagination settings.
function displayRequisitionRecords() {
    const tableBody = getElement("requisitionTableBody");

    if (!tableBody) return;

    // Start with all available requisitions.
    let filteredRecords = [...requisitionRecords];

    // Get the current search and filter values.
    const searchValue =
        getElement("searchInput")?.value.trim().toLowerCase() || "";

    const statusValue =
        getElement("statusFilter")?.value || "";

    const dateValue =
        getElement("dateFilter")?.value || "";

    // SEARCH FILTER
    // Searches by requisition number, requester, or purpose.
    if (searchValue) {
        filteredRecords = filteredRecords.filter(record => {
            const requester = getRequester(record.requested_by);

            const requesterName = getFullName(requester).toLowerCase();

            return (
                String(record.requisition_number || "")
                    .toLowerCase().includes(searchValue) ||

                requesterName.includes(searchValue) ||

                String(record.purpose || "")
                    .toLowerCase().includes(searchValue)
            );
        });
    }

    // STATUS FILTER
    // Shows only records with the selected status.
    if (statusValue) {
        filteredRecords = filteredRecords.filter(
            record => record.status === statusValue
        );
    }

    // DATE FILTER
    // Shows requisitions submitted on the selected date.
    if (dateValue) {
        filteredRecords = filteredRecords.filter(record => {
            if (!record.request_date) return false;

            const requestDate = new Date(record.request_date)
                .toLocaleDateString("en-CA");

            return requestDate === dateValue;
        });
    }

    // PAGINATION
    // Calculates how many pages are needed.
    const totalPages = Math.max(
        1,
        Math.ceil(filteredRecords.length / rowsPerPage)
    );

    // Keep the current page within the available page range.
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;

    const displayedRecords = filteredRecords.slice(
        startIndex,
        startIndex + rowsPerPage
    );

    // Display an empty message if no records match.
    if (displayedRecords.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    No requisition records found.
                </td>
            </tr>
        `;
    } else {
        // Retrieve item counts for the displayed requisitions.
        loadRequisitionItemCounts(displayedRecords)
            .then(itemCountMap => {
                // Build the table rows.
                tableBody.innerHTML = displayedRecords.map(record => {
                    const requester = getRequester(record.requested_by);

                    const requesterName = getFullName(requester);

                    const department = requester?.department || "N/A";

                    const itemCount =
                        itemCountMap[record.requisition_id] || 0;

                    const status = record.status || "Pending";

                    return `
                        <tr>
                            <td>
                                ${escapeHTML(
                                    record.requisition_number || "N/A"
                                )}
                            </td>

                            <td>${escapeHTML(requesterName)}</td>

                            <td>${escapeHTML(department)}</td>

                            <td>${formatDate(record.request_date)}</td>

                            <td>${itemCount}</td>

                            <td>
                                <span class="status-badge status-${getStatusClass(status)}">
                                    ${escapeHTML(status)}
                                </span>
                            </td>

                            <td>
                                <button
                                    type="button"
                                    class="view-requisition-btn"
                                    data-view-id="${escapeHTML(record.requisition_id)}"
                                >
                                    View
                                </button>
                            </td>
                        </tr>
                    `;
                }).join("");
            })
            .catch(error => {
                console.error("Item count loading error:", error);
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7">
                            Unable to display requisition items.
                        </td>
                    </tr>
                `;
            });
    }

    // Update the table's pagination information.
    updatePagination(filteredRecords.length, totalPages);
}

// ==========================================
// 7. LOAD REQUISITION ITEM COUNTS
// ==========================================

// Counts how many inventory items belong to each requisition.
// This is used by the Item Count column in the table.
async function loadRequisitionItemCounts(records) {
    const requisitionIds = records.map(
        record => record.requisition_id
    );

    const itemCountMap = {};

    if (requisitionIds.length === 0) return itemCountMap;

    const { data, error } = await supabase
        .from("requisition_items")
        .select("requisition_id")
        .in("requisition_id", requisitionIds);

    if (error) throw error;

    (data || []).forEach(item => {
        itemCountMap[item.requisition_id] =
            (itemCountMap[item.requisition_id] || 0) + 1;
    });

    return itemCountMap;
}

// ==========================================
// 8. UPDATE REQUISITION STATISTICS
// ==========================================

// Calculates the total number of requisitions
// and counts each major status.
function updateRequisitionStatistics() {
    const total = requisitionRecords.length;

    const pending = requisitionRecords.filter(
        record => record.status === "Pending"
    ).length;

    const approved = requisitionRecords.filter(
        record => record.status === "Approved"
    ).length;

    const rejected = requisitionRecords.filter(
        record => record.status === "Rejected"
    ).length;

    if (getElement("totalRequests")) {
        getElement("totalRequests").textContent = total;
    }

    if (getElement("pendingRequests")) {
        getElement("pendingRequests").textContent = pending;
    }

    if (getElement("approvedRequests")) {
        getElement("approvedRequests").textContent = approved;
    }

    if (getElement("rejectedRequests")) {
        getElement("rejectedRequests").textContent = rejected;
    }
}

// ==========================================
// 9. UPDATE PAGINATION
// ==========================================

// Updates the page number and enables/disables
// the Previous and Next buttons.
function updatePagination(totalRecords, totalPages) {
    if (getElement("pageNumberText")) {
        getElement("pageNumberText").textContent =
            `${currentPage} / ${totalPages}`;
    }

    if (getElement("rowCountText")) {
        getElement("rowCountText").textContent =
            `Showing ${totalRecords === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
            }-${Math.min(currentPage * rowsPerPage, totalRecords)} of ${totalRecords}`;
    }

    if (getElement("previousPageBtn")) {
        getElement("previousPageBtn").disabled = currentPage <= 1;
    }

    if (getElement("nextPageBtn")) {
        getElement("nextPageBtn").disabled = currentPage >= totalPages;
    }
}

// Moves the table to the previous page.
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        displayRequisitionRecords();
    }
}

// Moves the table to the next page.
function nextPage() {
    currentPage++;
    displayRequisitionRecords();
}

// ==========================================
// 10. LOAD INVENTORY ITEMS
// ==========================================

// Retrieves active inventory items.
// These will appear as choices in the New Requisition modal.
async function loadInventoryItems() {
    try {
        const { data, error } = await supabase
            .from("items")
            .select(`
                item_id,
                item_name,
                unit,
                current_stock,
                reserved_stock,
                is_active
            `)
            .eq("is_active", true)
            .order("item_name");

        if (error) throw error;

        inventoryItems = data || [];

    } catch (error) {
        console.error("Inventory item loading error:", error);
        showMessage("Unable to load inventory items.");
    }
}

// ==========================================
// 11. OPEN AND CLOSE REQUISITION MODAL
// ==========================================

// Opens the New Requisition modal and prepares
// a fresh form with one empty item row.
function openRequisitionModal() {
    const modal = getElement("requisitionModal");

    if (!modal) return;

    const form = getElement("requisitionForm");

    if (form) form.reset();

    const container = getElement("requisitionItemsContainer");

    if (container) container.innerHTML = "";

    // Add the first item row automatically.
    addRequisitionItemRow();

    modal.classList.remove("hidden");
}

// Closes the New Requisition modal.
function closeRequisitionModal() {
    const modal = getElement("requisitionModal");

    if (modal) {
        modal.classList.add("hidden");
    }
}

// ==========================================
// 12. ADD REQUISITION ITEM ROW
// ==========================================

// Creates a new item selection row inside the modal.
// Users can add multiple inventory items to one requisition.
function addRequisitionItemRow() {
    const container = getElement("requisitionItemsContainer");

    if (!container) return;

    if (inventoryItems.length === 0) {
        showMessage("No active inventory items are available.");
        return;
    }

    // Create the dropdown choices using active inventory items.
    const itemOptions = inventoryItems.map(item => {
        const availableStock = getAvailableStock(item);

        return `
            <option value="${escapeHTML(item.item_id)}">
                ${escapeHTML(item.item_name)}
                (${availableStock} ${escapeHTML(item.unit || "")} available)
            </option>
        `;
    }).join("");

    // Create a new HTML row.
    const row = document.createElement("div");

    row.className = "requisition-item-row";

    row.innerHTML = `
        <div class="form-group">
            <label>Inventory Item</label>

            <select class="requisition-item-select" required>
                <option value="">Select an item</option>
                ${itemOptions}
            </select>
        </div>

        <div class="form-group">
            <label>Requested Quantity</label>

            <input
                type="number"
                class="requisition-item-quantity"
                min="1"
                step="1"
                placeholder="Enter quantity"
                required
            >
        </div>

        <button type="button" class="remove-item-btn">
            Remove
        </button>
    `;

    // Add the newly created row to the modal.
    container.appendChild(row);

    // Allow the user to remove this specific row.
    row.querySelector(".remove-item-btn").addEventListener(
        "click",
        () => row.remove()
    );
}

// ==========================================
// 13. REQUISITION FORM SUBMISSION
// ==========================================

// Validates the user's form and prepares the information
// that will eventually be sent to the database.
//
// IMPORTANT:
// Actual database submission is intentionally not connected yet.
// We still need to verify the exact submit_requisition function.
function handleRequisitionSubmission(event) {
    event.preventDefault();

    const purpose =
        getElement("requisitionPurpose")?.value.trim();

    const isBulk =
        getElement("isBulkRequisition")?.checked || false;

    const itemRows = document.querySelectorAll(
        ".requisition-item-row"
    );

    // Check whether the purpose was provided.
    if (!purpose) {
        showMessage("Please provide the purpose of your requisition.");
        return;
    }

    // Require at least one inventory item.
    if (itemRows.length === 0) {
        showMessage("Please add at least one inventory item.");
        return;
    }

    const requestedItems = [];

    // Read and validate each item row.
    for (const row of itemRows) {
        const itemId = row.querySelector(
            ".requisition-item-select"
        )?.value;

        const quantity = Number(
            row.querySelector(".requisition-item-quantity")?.value
        );

        if (!itemId || !Number.isInteger(quantity) || quantity < 1) {
            showMessage(
                "Please select an item and enter a valid quantity."
            );
            return;
        }

        requestedItems.push({
            item_id: itemId,
            requested_quantity: quantity
        });
    }

    // Prepare the complete requisition information.
    const requisitionData = {
        purpose,
        isBulk,
        items: requestedItems
    };

    console.log("Prepared requisition:", requisitionData);

    showMessage(
        "The requisition form is valid. Database submission will be connected after verifying the database function."
    );
}

// ==========================================
// 14. VIEW REQUISITION DETAILS
// ==========================================

// Opens the detail drawer for the selected requisition.
// It retrieves the associated inventory items from Supabase.
async function viewRequisitionDetails(requisitionId) {
    const record = requisitionRecords.find(
        item => String(item.requisition_id) === String(requisitionId)
    );

    if (!record) {
        showMessage("Requisition record not found.");
        return;
    }

    const drawer = getElement("detailDrawer");
    const drawerBody = getElement("drawerBody");

    if (!drawer || !drawerBody) return;

    const requester = getRequester(record.requested_by);

    // Display a loading message while retrieving the item details.
    drawer.classList.remove("hidden");

    if (getElement("drawerId")) {
        getElement("drawerId").textContent =
            record.requisition_number || "Requisition Details";
    }

    drawerBody.innerHTML = "<p>Loading requisition details...</p>";

    try {
        // Retrieve the items belonging to this requisition.
        const { data, error } = await supabase
            .from("requisition_items")
            .select("*")
            .eq("requisition_id", record.requisition_id);

        if (error) throw error;

        const items = data || [];

        // Match the requisition item IDs with inventory item names.
        const itemDetails = items.map(item => {
            const inventoryItem = inventoryItems.find(
                inventory => String(inventory.item_id) === String(item.item_id)
            );

            return {
                ...item,
                item_name: inventoryItem?.item_name || "Unknown Item",
                unit: inventoryItem?.unit || ""
            };
        });

        // Display the selected requisition information.
        drawerBody.innerHTML = `
            <div class="drawer-detail-group">
                <label>Requester</label>
                <p>${escapeHTML(getFullName(requester))}</p>
            </div>

            <div class="drawer-detail-group">
                <label>Department</label>
                <p>${escapeHTML(requester?.department || "N/A")}</p>
            </div>

            <div class="drawer-detail-group">
                <label>Request Date</label>
                <p>${formatDate(record.request_date)}</p>
            </div>

            <div class="drawer-detail-group">
                <label>Status</label>
                <p>
                    <span class="status-badge status-${getStatusClass(record.status)}">
                        ${escapeHTML(record.status || "Pending")}
                    </span>
                </p>
            </div>

            <div class="drawer-detail-group">
                <label>Purpose</label>
                <p>${escapeHTML(record.purpose || "No purpose provided.")}</p>
            </div>

            <div class="drawer-detail-group">
                <label>Requisition Type</label>
                <p>${record.is_bulk ? "Bulk Requisition" : "Regular Requisition"}</p>
            </div>

            <div class="drawer-detail-group">
                <label>Requested Items (${itemDetails.length})</label>

                <div class="drawer-items-list">
                    ${itemDetails.length === 0
                        ? "<p>No items found.</p>"
                        : itemDetails.map(item => `
                            <div class="drawer-item">
                                <strong>${escapeHTML(item.item_name)}</strong>
                                <p>
                                    Requested: ${Number(item.requested_quantity || 0)}
                                    ${escapeHTML(item.unit)}
                                </p>
                                <p>
                                    Approved: ${Number(item.approved_quantity || 0)}
                                    ${escapeHTML(item.unit)}
                                </p>
                            </div>
                        `).join("")
                    }
                </div>
            </div>

            <div class="drawer-detail-group">
                <label>Remarks</label>
                <p>${escapeHTML(record.remarks || "No remarks.")}</p>
            </div>
        `;

        // Keep the footer empty for now.
        // Approval and rejection actions will be added after
        // verifying the database review function and user permissions.
        if (getElement("drawerFooter")) {
            getElement("drawerFooter").innerHTML = "";
        }

    } catch (error) {
        console.error("Requisition detail loading error:", error);

        drawerBody.innerHTML = `
            <p>Unable to load requisition details.</p>
        `;
    }
}

// Closes the requisition detail drawer.
function closeDetailDrawer() {
    const drawer = getElement("detailDrawer");

    if (drawer) {
        drawer.classList.add("hidden");
    }
}

// ==========================================
// 15. LOGOUT
// ==========================================

// Signs the current user out of Supabase
// and redirects them to the login page.
async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error("Logout error:", error);
        showMessage("Unable to log out. Please try again.");
        return;
    }

    window.location.href = "../index.html";
}

// ==========================================
// 16. EVENT LISTENERS
// ==========================================

// Connects HTML buttons, inputs, and other controls
// to the functions defined above.
function setupEventListeners() {

    // Open and close the New Requisition modal.
    getElement("newRequisitionBtn")?.addEventListener(
        "click",
        openRequisitionModal
    );

    getElement("closeRequisitionModal")?.addEventListener(
        "click",
        closeRequisitionModal
    );

    getElement("cancelRequisition")?.addEventListener(
        "click",
        closeRequisitionModal
    );

    // Add another inventory item row.
    getElement("addRequisitionItem")?.addEventListener(
        "click",
        addRequisitionItemRow
    );

    // Validate the requisition form.
    getElement("requisitionForm")?.addEventListener(
        "submit",
        handleRequisitionSubmission
    );

    // Close the detail drawer.
    getElement("closeDetailDrawer")?.addEventListener(
        "click",
        closeDetailDrawer
    );

    getElement("closeDrawerBtn")?.addEventListener(
        "click",
        closeDetailDrawer
    );

    // Logout.
    getElement("logoutBtn")?.addEventListener(
        "click",
        logout
    );

    // Search and filter controls.
    // Reset to the first page whenever the user changes a filter.
    ["searchInput", "statusFilter", "dateFilter"].forEach(id => {
        getElement(id)?.addEventListener("input", () => {
            currentPage = 1;
            displayRequisitionRecords();
        });

        getElement(id)?.addEventListener("change", () => {
            currentPage = 1;
            displayRequisitionRecords();
        });
    });

    // Pagination buttons.
    getElement("previousPageBtn")?.addEventListener(
        "click",
        previousPage
    );

    getElement("nextPageBtn")?.addEventListener(
        "click",
        nextPage
    );

    // Event delegation for View buttons.
    // This works even when the table rows are recreated.
    getElement("requisitionTableBody")?.addEventListener(
        "click",
        event => {
            const button = event.target.closest(
                ".view-requisition-btn"
            );

            if (!button) return;

            viewRequisitionDetails(button.dataset.viewId);
        }
    );
}

// ==========================================
// 17. START THE PAGE
// ==========================================

// First connect the event listeners.
// Then initialize the page and retrieve its data.
setupEventListeners();
initializePage();
