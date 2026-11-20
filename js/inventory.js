
import { supabase } from "./supabaseClient.js";

let inventoryItems = [];
let currentUserRole = null;

let pendingStatusItemId = null;
let pendingStatusValue = null;

let currentInventoryPage = 1;
const inventoryItemsPerPage = 10;
/* ========================================
   PITAKE INVENTORY MANAGEMENT
======================================== */

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Inventory module loaded.");

    await loadLoggedInUserProfile();

    await loadCategories();
    await loadInventory();
    await loadInventoryStats();

    const inventorySearchInput = document.getElementById("inventorySearchInput");

    if (inventorySearchInput) {
        inventorySearchInput.addEventListener("input", () => {
            currentInventoryPage = 1;
            applyInventoryFilters();
        });
    }

    const inventoryCategoryFilter = document.getElementById("inventoryCategoryFilter");

    if (inventoryCategoryFilter) {
        inventoryCategoryFilter.addEventListener("change", () => {
            currentInventoryPage = 1;
            applyInventoryFilters();
        });
    }

    const openAddItemBtn = document.getElementById("openAddItemBtn");
    const addItemModal = document.getElementById("addItemModal");

    if (openAddItemBtn && addItemModal) {
        openAddItemBtn.addEventListener("click", () => {
            addItemModal.classList.remove("hidden");
        });
    }

    const closeAddItemModalBtn = document.getElementById("closeAddItemModalBtn");

    if (closeAddItemModalBtn && addItemModal) {
        closeAddItemModalBtn.addEventListener("click", () => {
            addItemModal.classList.add("hidden");
        });
    }

    const cancelAddItemBtn = document.getElementById("cancelAddItemBtn");

    if (cancelAddItemBtn && addItemModal) {
        cancelAddItemBtn.addEventListener("click", () => {
            addItemModal.classList.add("hidden");
        });
    }

    const inventoryStatusFilter = document.getElementById("inventoryStatusFilter");

    if (inventoryStatusFilter) {
        inventoryStatusFilter.addEventListener("change", () => {
            currentInventoryPage = 1;
            applyInventoryFilters();
        });
    }

    const inventoryTabs = document.querySelectorAll(".inv-tab");

    inventoryTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            // Update active tab appearance
            inventoryTabs.forEach(item => item.classList.remove("active"));
            tab.classList.add("active");

            // Sync the category dropdown
            const categoryFilter = document.getElementById("inventoryCategoryFilter");

            if (categoryFilter) {
                categoryFilter.value = tab.dataset.categoryId;
            }

            // Apply all filters
            currentInventoryPage = 1;
            applyInventoryFilters();
        });
    });
    
    const addItemForm = document.getElementById("addItemForm");

    if (addItemForm) {
        addItemForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const formData = new FormData(addItemForm);

            const newItem = {
                item_name: formData.get("name").trim(),
                category_id: Number(formData.get("category")),
                unit: formData.get("unit"),
                unit_cost: Number(formData.get("unit_cost")),
                current_stock: Number(formData.get("quantity")),
                minimum_stock: Number(formData.get("minimum")),
                description: formData.get("description").trim()
            };

            if (
                !newItem.item_name ||
                !newItem.category_id ||
                newItem.current_stock < 0 ||
                newItem.minimum_stock < 0 ||
                newItem.unit_cost < 0
            ) {
                alert("Please check your item details.");
                return;
            }

            const { error } = await supabase
                .from("items")
                .insert([newItem]);

            if (error) {
                console.error("Error adding item:", error.message);
                alert("Failed to add item: " + error.message);
                return;
            }

            alert("Inventory item added successfully!");

            addItemForm.reset();
            addItemModal.classList.add("hidden");

            await loadInventory();
            await loadInventoryStats();
        });
    }

    /* ========================================
    EDIT INVENTORY ITEM
    ======================================== */

    const editItemForm = document.getElementById("editItemForm");
    const editItemModal = document.getElementById("editItemModal");

    if (editItemForm) {
        editItemForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const formData = new FormData(editItemForm);
            const itemId = Number(formData.get("item_id"));

            const updatedItem = {
                item_name: formData.get("name").trim(),
                category_id: Number(formData.get("category")),
                unit: formData.get("unit"),
                unit_cost: Number(formData.get("unit_cost")),
                minimum_stock: Number(formData.get("minimum")),
                description: formData.get("description").trim()
            };

            if (
                !updatedItem.item_name ||
                !updatedItem.category_id ||
                updatedItem.unit_cost < 0 ||
                updatedItem.minimum_stock < 0
            ) {
                alert("Please check your item details.");
                return;
            }

            const { error } = await supabase
                .from("items")
                .update(updatedItem)
                .eq("item_id", itemId);

            if (error) {
                console.error("Error updating item:", error.message);
                alert("Failed to update item: " + error.message);
                return;
            }

            alert("Inventory item updated successfully!");

            editItemForm.reset();
            editItemModal.classList.add("hidden");

            await loadInventory();
            await loadInventoryStats();
        });
    }

    /* ========================================
    CLOSE EDIT ITEM MODAL
    ======================================== */

    const closeEditItemModalBtn = document.getElementById("closeEditItemModalBtn");
    const cancelEditItemBtn = document.getElementById("cancelEditItemBtn");

    if (closeEditItemModalBtn && editItemModal) {
        closeEditItemModalBtn.addEventListener("click", () => {
            editItemModal.classList.add("hidden");
            editItemForm.reset();
        });
    }

    if (cancelEditItemBtn && editItemModal) {
        cancelEditItemBtn.addEventListener("click", () => {
            editItemModal.classList.add("hidden");
            editItemForm.reset();
        });
    }

    // View Item Details
    const inventoryTableBody = document.getElementById("inventoryTableBody");

    if (inventoryTableBody) {
        inventoryTableBody.addEventListener("click", async (event) => {
            const viewButton = event.target.closest(".view-item-btn");

            if (!viewButton) return;

            const itemId = Number(viewButton.dataset.itemId);

            await openItemDetails(itemId);
        });
    }

    // Close Item Details Drawer
    const itemDetailsDrawer = document.getElementById("itemDetailsDrawer");
    const closeDrawerBtn = document.querySelector(".inv-drawer-close");

    if (closeDrawerBtn && itemDetailsDrawer) {
        closeDrawerBtn.addEventListener("click", () => {
            itemDetailsDrawer.classList.add("hidden");
        });
    }

    if (itemDetailsDrawer) {
        itemDetailsDrawer.addEventListener("click", (event) => {
            if (event.target === itemDetailsDrawer) {
                itemDetailsDrawer.classList.add("hidden");
            }
        });
    }

    // Open Edit Item modal
    if (inventoryTableBody) {
        inventoryTableBody.addEventListener("click", function (event) {
            const editButton = event.target.closest(".edit-item-btn");

            if (!editButton) return;

            const itemId = Number(editButton.dataset.itemId);
            openEditItem(itemId);
        });
    }


    // Open Adjust Stock modal from Inventory Table
    if (inventoryTableBody) {
        inventoryTableBody.addEventListener("click", (event) => {
            const adjustButton = event.target.closest(".adjust-stock-btn");

            if (!adjustButton) return;

            const itemId = Number(adjustButton.dataset.itemId);
            openAdjustStock(itemId);
        });
    }

    // Open Activate / Deactivate Confirmation Modal
    if (inventoryTableBody) {
        inventoryTableBody.addEventListener("click", (event) => {
            const statusButton = event.target.closest(
                ".toggle-item-status-btn"
            );

            if (!statusButton) return;

            if (currentUserRole !== "Admin") {
                alert("Only Admin users can change item status.");
                return;
            }

            const itemId = Number(statusButton.dataset.itemId);

            const item = inventoryItems.find(
                item => Number(item.item_id) === itemId
            );

            if (!item) {
                alert("Inventory item not found.");
                return;
            }

            pendingStatusItemId = itemId;
            pendingStatusValue = !item.is_active;

            const modal = document.getElementById("confirmStatusModal");

            document.getElementById("confirmStatusTitle").textContent =
                pendingStatusValue ? "Activate Item" : "Deactivate Item";

            document.getElementById("confirmStatusItemName").textContent =
                item.item_name;

            document.getElementById("confirmStatusMessage").textContent =
                pendingStatusValue
                    ? "Are you sure you want to activate this item?"
                    : "Are you sure you want to deactivate this item?";

            document.getElementById("proceedConfirmStatusBtn").textContent =
                pendingStatusValue ? "Activate" : "Deactivate";

            modal.classList.remove("hidden");
        });
    }

    /* ========================================
    CONFIRM ACTIVATE / DEACTIVATE ITEM
    ======================================== */

    const confirmStatusModal = document.getElementById("confirmStatusModal");
    const proceedConfirmStatusBtn = document.getElementById("proceedConfirmStatusBtn");

    function closeConfirmStatusModal() {
        confirmStatusModal.classList.add("hidden");
        pendingStatusItemId = null;
        pendingStatusValue = null;
    }

    document.getElementById("closeConfirmStatusBtn")
        ?.addEventListener("click", closeConfirmStatusModal);

    document.getElementById("cancelConfirmStatusBtn")
        ?.addEventListener("click", closeConfirmStatusModal);

    confirmStatusModal?.addEventListener("click", (event) => {
        if (event.target === confirmStatusModal) {
            closeConfirmStatusModal();
        }
    });

    proceedConfirmStatusBtn?.addEventListener("click", async () => {
        if (currentUserRole !== "Admin") {
            alert("Only Admin users can change item status.");
            closeConfirmStatusModal();
            return;
        }

        if (pendingStatusItemId === null || pendingStatusValue === null) {
            return;
        }

        proceedConfirmStatusBtn.disabled = true;
        proceedConfirmStatusBtn.textContent = "Processing...";

        try {
            const { error } = await supabase
                .from("items")
                .update({ is_active: pendingStatusValue })
                .eq("item_id", pendingStatusItemId);

            if (error) throw error;

            alert(
                pendingStatusValue
                    ? "Item activated successfully!"
                    : "Item deactivated successfully!"
            );

            closeConfirmStatusModal();

            await loadInventory();
            await loadInventoryStats();

        } catch (error) {
            console.error("Item status update error:", error);
            alert("Failed to update item status: " + error.message);

        } finally {
            proceedConfirmStatusBtn.disabled = false;
            proceedConfirmStatusBtn.textContent = "Confirm";
        }
    });
    // Open Adjust Stock modal from Item Details Drawer
    const drawerAdjustButton = document.querySelector(".inv-btn-full");

    if (drawerAdjustButton) {
        drawerAdjustButton.addEventListener("click", () => {
            const drawerItemId = document.getElementById("drawerItemId");

            if (!drawerItemId) return;

            const itemId = Number(
                drawerItemId.textContent.replace("ITEM-", "")
            );

            openAdjustStock(itemId);
        });
    }


    /* ========================================
    ADJUST STOCK TYPE TOGGLE
    ======================================== */

    const adjustmentToggleButtons = document.querySelectorAll(
        ".inv-toggle-btn[data-adjustment-type]"
    );

    const adjustmentTypeInput = document.getElementById("adjustmentType");

    adjustmentToggleButtons.forEach(button => {
        button.addEventListener("click", () => {
            adjustmentToggleButtons.forEach(item =>
                item.classList.remove("active")
            );

            button.classList.add("active");

            adjustmentTypeInput.value =
                button.dataset.adjustmentType;
        });
    });


    /* ========================================
    CLOSE ADJUST STOCK MODAL
    ======================================== */

    const adjustStockModal = document.getElementById("adjustStockModal");
    const closeAdjustStockBtn = document.getElementById("closeAdjustStockBtn");
    const cancelAdjustStockBtn = document.getElementById("cancelAdjustStockBtn");

    function closeAdjustStockModal() {
        adjustStockModal.classList.add("hidden");
    }

    closeAdjustStockBtn?.addEventListener("click", closeAdjustStockModal);
    cancelAdjustStockBtn?.addEventListener("click", closeAdjustStockModal);

    adjustStockModal?.addEventListener("click", (event) => {
        if (event.target === adjustStockModal) {
            closeAdjustStockModal();
        }
    });


    /* ========================================
    SUBMIT STOCK ADJUSTMENT
    ======================================== */

    const adjustStockForm = document.getElementById("adjustStockForm");

    if (adjustStockForm) {
        adjustStockForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const itemId = Number(
                document.getElementById("adjustStockItemId").value
            );

            const adjustmentType =
                document.getElementById("adjustmentType").value;

            const quantity = Number(
                document.getElementById("adjustStockQuantity").value
            );

            const reason =
                document.getElementById("adjustStockReason").value.trim();

            if (!itemId || !quantity || quantity <= 0 || !reason) {
                alert("Please complete all adjustment fields.");
                return;
            }

            const submitButton = adjustStockForm.querySelector(
                'button[type="submit"]'
            );

            submitButton.disabled = true;
            submitButton.textContent = "Recording...";

            try {
                const { data, error } = await supabase.rpc(
                    "admin_adjust_inventory_stock",
                    {
                        p_item_id: itemId,
                        p_adjustment_type: adjustmentType,
                        p_quantity: quantity,
                        p_reason: reason
                    }
                );

                if (error) throw error;

                alert(
                    `Stock adjustment recorded successfully!\nNew stock: ${data.new_stock}`
                );

                adjustStockModal.classList.add("hidden");

                await loadInventory();
                await loadInventoryStats();

            } catch (error) {
                console.error("Stock adjustment error:", error);
                alert("Failed to record adjustment: " + error.message);

            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Record Adjustment";
            }
        });
    }

    // Inventory pagination
    const paginationButtons = document.getElementById("inventoryPaginationButtons");

    if (paginationButtons) {
        paginationButtons.addEventListener("click", (event) => {
            const button = event.target.closest(".inv-page-btn");

            if (!button || button.disabled) return;

            const selectedPage = Number(button.dataset.page);

            if (!selectedPage) return;

            currentInventoryPage = selectedPage;

            applyInventoryFilters();
        });
    }


});

/* ========================================
   LOAD LOGGED-IN USER PROFILE
======================================== */

async function loadLoggedInUserProfile() {
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) {
        console.error("No logged-in user found.");
        return;
    }

    const { data: profile, error } = await supabase
        .from("users")
        .select("first_name, last_name, role")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("Error loading user profile:", error.message);
        return;
    }

    currentUserRole = profile.role;

    const fullName = `${profile.first_name} ${profile.last_name}`;
    const initials = `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`;

    document.getElementById("loggedInUserName").textContent = fullName;
    document.getElementById("loggedInUserRole").textContent = profile.role;
    document.getElementById("loggedInUserAvatar").textContent = initials.toUpperCase();
}

/* ========================================
   LOAD CATEGORIES
======================================== */

async function loadCategories() {
    const { data, error } = await supabase
        .from("item_categories")
        .select("category_id, category_name")
        .order("category_name");

    if (error) {
        console.error("Error loading categories:", error);
        return;
    }

    const addCategorySelect = document.getElementById("addItemCategory");
    const editCategorySelect = document.getElementById("editItemCategory");
    const filterCategorySelect = document.getElementById("inventoryCategoryFilter");

    const options = data.map(category => `
        <option value="${category.category_id}">
            ${escapeHTML(category.category_name)}
        </option>
    `).join("");

    if (addCategorySelect) {
        addCategorySelect.innerHTML =
            '<option value="">Select category</option>' + options;
    }

    if (editCategorySelect) {
        editCategorySelect.innerHTML =
            '<option value="">Select category</option>' + options;
    }

    if (filterCategorySelect) {
        filterCategorySelect.innerHTML =
            '<option value="">All categories</option>' + options;
    }
}

/* ========================================
   LOAD INVENTORY
======================================== */
async function loadInventory() {
    const { data, error } = await supabase
        .from("items")
        .select(`
            item_id,
            category_id,
            item_name,
            description,
            unit,
            current_stock,
            reserved_stock,
            minimum_stock,
            unit_cost,
            is_active,
            item_categories (
                category_name
            )
        `)
        .order("item_id");

    if (error) {
        console.error("Error loading inventory:", error.message);
        return;
    }

    inventoryItems = data || [];

    renderInventoryTable(inventoryItems);
}

/* Prevent database text from being interpreted as HTML */
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


async function loadInventoryStats() {
    const { data, error } = await supabase
        .from("items")
        .select(`
            item_id,
            category_id,
            current_stock,
            reserved_stock,
            minimum_stock,
            is_active,
            item_categories (
                category_name
            )
        `)
        .eq("is_active", true);

    if (error) {
        console.error("Error loading inventory statistics:", error.message);
        return;
    }

    const totalItems = data.length;

    const lowStock = data.filter(item =>
        item.current_stock > 0 &&
        item.current_stock <= item.minimum_stock
    ).length;

    const outOfStock = data.filter(item =>
        item.current_stock <= 0
    ).length;

    const equipmentInUse = data.filter(item =>
        item.item_categories?.category_name === "Equipment" &&
        item.reserved_stock > 0
    ).length;

    document.getElementById("totalItemsCount").textContent = totalItems;
    document.getElementById("lowStockCount").textContent = lowStock;
    document.getElementById("outOfStockCount").textContent = outOfStock;
    document.getElementById("equipmentInUseCount").textContent = equipmentInUse;

    console.log("Inventory statistics updated.");
}

function applyInventoryFilters() {
    const searchInput = document.getElementById("inventorySearchInput");
    const categoryFilter = document.getElementById("inventoryCategoryFilter");
    const statusFilter = document.getElementById("inventoryStatusFilter");

    const searchTerm = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    const selectedCategory = categoryFilter
        ? categoryFilter.value
        : "";

    const selectedStatus = statusFilter
        ? statusFilter.value
        : "";

    const filteredItems = inventoryItems.filter(item => {
        const itemName = item.item_name.toLowerCase();
        const itemId = String(item.item_id);
        const available = item.current_stock - item.reserved_stock;

        let status = "In Stock";

        if (!item.is_active) {
            status = "Inactive";
        } else if (available <= 0) {
            status = "Out of Stock";
        } else if (available <= item.minimum_stock) {
            status = "Low Stock";
        }

        const matchesSearch =
            itemName.includes(searchTerm) ||
            itemId.includes(searchTerm);

        const matchesCategory =
            !selectedCategory ||
            String(item.category_id) === selectedCategory;

        const matchesStatus =
            !selectedStatus ||
            status === selectedStatus;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    renderInventoryTable(filteredItems);
}


function renderInventoryTable(data) {
    const tableBody = document.getElementById("inventoryTableBody");

    if (!tableBody) return;

    const paginationInfo = document.getElementById("inventoryPaginationInfo");
    const paginationButtons = document.getElementById("inventoryPaginationButtons");

    // Pagination calculations
    const totalItems = data ? data.length : 0;

    const totalPages = Math.max(
        1,
        Math.ceil(totalItems / inventoryItemsPerPage)
    );

    currentInventoryPage = Math.min(currentInventoryPage, totalPages);

    const startIndex = (currentInventoryPage - 1) * inventoryItemsPerPage;

    const endIndex = Math.min(
        startIndex + inventoryItemsPerPage,
        totalItems
    );

    const pageItems = data
        ? data.slice(startIndex, endIndex)
        : [];

    // Update pagination information
    if (paginationInfo) {
        const showingStart = totalItems === 0 ? 0 : startIndex + 1;

        paginationInfo.textContent =
            `Showing ${showingStart}-${endIndex} of ${totalItems} inventory items`;
    }

    // Generate pagination buttons
    if (paginationButtons) {
        let buttonsHTML = `
            <button
                type="button"
                class="inv-page-btn"
                data-page="${currentInventoryPage - 1}"
                ${currentInventoryPage === 1 ? "disabled" : ""}
            >
                Previous
            </button>
        `;

        for (let page = 1; page <= totalPages; page++) {
            buttonsHTML += `
                <button
                    type="button"
                    class="inv-page-btn ${page === currentInventoryPage ? "active" : ""}"
                    data-page="${page}"
                >
                    ${page}
                </button>
            `;
        }

        buttonsHTML += `
            <button
                type="button"
                class="inv-page-btn"
                data-page="${currentInventoryPage + 1}"
                ${currentInventoryPage === totalPages ? "disabled" : ""}
            >
                Next
            </button>
        `;

        paginationButtons.innerHTML = buttonsHTML;
    }

    // Empty inventory check
    if (!data || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    No inventory items found.
                </td>
            </tr>
        `;
        return;
    }

    // Render current page only
    tableBody.innerHTML = pageItems.map(item => {
        const available = item.current_stock - item.reserved_stock;
        const isLowOrOut = available <= item.minimum_stock;

        let status = "In Stock";
        let statusClass = "inventory-status-available";
        let rowClass = "";

        if (!item.is_active) {
            status = "Inactive";
            statusClass = "inventory-status-inactive";
        } else if (available <= 0) {
            status = "Out of Stock";
            statusClass = "inventory-status-out-of-stock";
            rowClass = "row-out-of-stock";
        } else if (available <= item.minimum_stock) {
            status = "Low Stock";
            statusClass = "inventory-status-low-stock";
            rowClass = "row-low-stock";
        }

        const category = item.item_categories?.category_name || "Uncategorized";

        return `
            <tr class="${rowClass}">
                <td class="cell-id">
                    <div class="item-id-cell">
                        <span>#${item.item_id}</span>
                        <button
                            type="button"
                            class="view-item-btn"
                            data-item-id="${item.item_id}"
                            aria-label="View ${escapeHTML(item.item_name)}"
                            title="View Item"
                        >
                            <svg aria-hidden="true"
                                width="15" height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.7"
                                stroke-linecap="round"
                                stroke-linejoin="round">
                                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>
                                <circle cx="12" cy="12" r="2.5"/>
                            </svg>
                        </button>
                    </div>
                </td>

                <td>
                    <div class="item-name-cell">
                        <span class="item-box-icon">
                            <svg aria-hidden="true"
                                width="14" height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.7"
                                stroke-linecap="round"
                                stroke-linejoin="round">
                                <path d="m3 7 9-4 9 4-9 4-9-4Z"/>
                                <path d="m3 7 9 4 9-4v10l-9 4-9-4V7ZM12 11v10"/>
                            </svg>
                        </span>
                        <span class="item-title">
                            ${escapeHTML(item.item_name)}
                        </span>
                    </div>
                </td>

                <td class="cell-muted">
                    ${escapeHTML(category)}
                </td>

                <td class="cell-qty text-center ${isLowOrOut ? "qty-alert" : "qty-normal"}">
                    ${available}
                </td>

                <td class="cell-muted text-center">
                    ${item.minimum_stock}
                </td>

                <td class="cell-muted">
                    ${escapeHTML(item.unit)}
                </td>

                <td>
                    <span class="inventory-status ${statusClass}">
                        ${status}
                    </span>
                </td>

                <td class="cell-view">
                    <div class="inventory-actions">

                        <button
                            type="button"
                            class="adjust-stock-btn"
                            ${!item.is_active ? "disabled" : ""}
                            data-item-id="${item.item_id}"
                            aria-label="Adjust stock for ${escapeHTML(item.item_name)}"
                            title="Adjust Stock"
                        >
                            <svg aria-hidden="true"
                                width="15" height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.7"
                                stroke-linecap="round"
                                stroke-linejoin="round">
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            class="edit-item-btn"
                            ${!item.is_active ? "disabled" : ""}
                            data-item-id="${item.item_id}"
                            aria-label="Edit ${escapeHTML(item.item_name)}"
                            title="Edit Item"
                        >
                            <svg aria-hidden="true"
                                width="15" height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.7"
                                stroke-linecap="round"
                                stroke-linejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            class="toggle-item-status-btn ${item.is_active ? "is-active" : "is-inactive"}"
                            data-item-id="${item.item_id}"
                            aria-label="${item.is_active ? "Deactivate" : "Activate"} ${escapeHTML(item.item_name)}"
                            title="${item.is_active ? "Deactivate Item" : "Activate Item"}"
                        >
                            ${item.is_active ? "Deactivate" : "Activate"}
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    console.log("Inventory table rendered:", pageItems.length, "items");
}


/* ========================================
   VIEW INVENTORY ITEM DETAILS
======================================== */

async function openItemDetails(itemId) {
    const item = inventoryItems.find(
        item => Number(item.item_id) === itemId
    );

    if (!item) {
        alert("Inventory item not found.");
        return;
    }

    const available = item.current_stock - item.reserved_stock;

    let status = "In Stock";
    let statusClass = "inventory-status-available";

    if (!item.is_active) {
        status = "Inactive";
        statusClass = "inventory-status-inactive";
    } else if (available <= 0) {
        status = "Out of Stock";
        statusClass = "inventory-status-out-of-stock";
    } else if (available <= item.minimum_stock) {
        status = "Low Stock";
        statusClass = "inventory-status-low-stock";
    }

    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    setText("drawerItemName", item.item_name);
    setText("drawerItemId", `ITEM-${item.item_id}`);
    setText("drawerAvailableStock", available);
    setText("drawerItemUnit", item.unit);
    setText("drawerItemCategory",
        item.item_categories?.category_name || "Uncategorized"
    );
    setText("drawerMinimumStock", `${item.minimum_stock} ${item.unit}`);
    setText("drawerUnitCost", `₱${Number(item.unit_cost).toFixed(2)}`);
    setText("drawerTotalStock", `${item.current_stock} ${item.unit}`);
    setText("drawerReservedStock", `${item.reserved_stock} ${item.unit}`);
    setText("drawerItemDescription", item.description || "No description provided.");

    const statusElement = document.getElementById("drawerItemStatus");

    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `inventory-status ${statusClass}`;
    }

    const drawer = document.getElementById("itemDetailsDrawer");

    if (drawer) {
        drawer.classList.remove("hidden");
    }

    await loadItemMovementHistory(itemId);
}

/* ========================================
   LOAD ITEM MOVEMENT HISTORY
======================================== */

async function loadItemMovementHistory(itemId) {
    const movementList = document.getElementById("drawerMovementList");

    if (!movementList) return;

    movementList.innerHTML = `
        <p class="inv-history-sub">Loading inventory history...</p>
    `;

    const { data, error } = await supabase
        .from("stock_movements")
        .select(`
            movement_type,
            quantity,
            reference_type,
            reference_id,
            movement_date,
            remarks
        `)
        .eq("item_id", itemId)
        .order("movement_date", { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error loading movement history:", error.message);

        movementList.innerHTML = `
            <p class="inv-history-sub">Unable to load inventory history.</p>
        `;

        return;
    }

    if (!data || data.length === 0) {
        movementList.innerHTML = `
            <p class="inv-history-sub">No inventory movements recorded yet.</p>
        `;
        return;
    }

    movementList.innerHTML = data.map(movement => {
        const movementDate = new Date(movement.movement_date)
            .toLocaleString("en-PH", {
                dateStyle: "medium",
                timeStyle: "short"
            });

        return `
            <div class="inv-movement-row">
                <span class="inv-move-badge ${
                    movement.movement_type === "Stock In"
                    ? "incoming"
                    : "outgoing"
                }">
                    ${escapeHTML(movement.movement_type)}
                </span>

                <div class="inv-move-info">
                    <div class="inv-move-top">
                        <p class="inv-move-type">
                            ${escapeHTML(movement.movement_type)}
                            · ${movement.quantity}
                        </p>

                        <p class="inv-move-date">
                            ${escapeHTML(movementDate)}
                        </p>
                    </div>

                    <p class="inv-move-reason">
                        ${escapeHTML(movement.remarks || movement.reference_type || "Stock movement")}
                    </p>

                    <p class="inv-move-by">
                        Reference: ${escapeHTML(movement.reference_id || "N/A")}
                    </p>
                </div>
            </div>
        `;
    }).join("");
}

/* ========================================
   OPEN EDIT INVENTORY ITEM
======================================== */

function openEditItem(itemId) {
    const item = inventoryItems.find(
        item => Number(item.item_id) === Number(itemId)
    );

    if (!item) {
        alert("Inventory item not found.");
        return;
    }

    document.getElementById("editItemId").value = item.item_id;
    document.getElementById("editItemName").value = item.item_name;
    document.getElementById("editItemCategory").value = item.category_id;
    document.getElementById("editItemUnit").value = item.unit;
    document.getElementById("editItemCost").value = item.unit_cost;
    document.getElementById("editItemMinimum").value = item.minimum_stock;
    document.getElementById("editItemDescription").value =
        item.description || "";

    document.getElementById("editItemModal").classList.remove("hidden");
}


/* ========================================
   OPEN ADJUST STOCK MODAL
======================================== */

function openAdjustStock(itemId) {
    const item = inventoryItems.find(
        item => Number(item.item_id) === Number(itemId)
    );

    if (!item) {
        alert("Inventory item not found.");
        return;
    }

    document.getElementById("adjustStockItemId").value = item.item_id;

    document.getElementById("adjustStockItemName").textContent =
        `${item.item_name} · Item #${item.item_id}`;

    document.getElementById("adjustStockCurrent").textContent =
        `${item.current_stock} ${item.unit}`;

    document.getElementById("adjustStockQuantity").value = "";

    document.getElementById("adjustStockReason").value = "";

    document.getElementById("adjustmentType").value = "Incoming";

    const toggleButtons = document.querySelectorAll(
        ".inv-toggle-btn[data-adjustment-type]"
    );

    toggleButtons.forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.adjustmentType === "Incoming"
        );
    });

    document.getElementById("adjustStockModal").classList.remove("hidden");
}

