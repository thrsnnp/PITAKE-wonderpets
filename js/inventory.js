
import { supabase } from "./supabaseClient.js";
let inventoryItems = [];

/* ========================================
   PITAKE INVENTORY MANAGEMENT
======================================== */

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Inventory module loaded.");

    await loadCategories();
    await loadInventory();
    await loadInventoryStats();

    const inventorySearchInput = document.getElementById("inventorySearchInput");

    if (inventorySearchInput) {
        inventorySearchInput.addEventListener("input", applyInventoryFilters);
    }

    const inventoryCategoryFilter = document.getElementById("inventoryCategoryFilter");

    if (inventoryCategoryFilter) {
        inventoryCategoryFilter.addEventListener("change", applyInventoryFilters);
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
        inventoryStatusFilter.addEventListener("change", applyInventoryFilters);
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
});

/* ========================================
   LOAD CATEGORIES
======================================== */

async function loadCategories() {
    const { data, error } = await supabase
        .from("item_categories")
        .select("category_id, category_name")
        .order("category_name");

    if (error) {
        console.error("Error loading categories:", error.message);
        return;
    }

    const addCategorySelect = document.getElementById("addItemCategory");
    const filterCategorySelect = document.getElementById("inventoryCategoryFilter");

    if (addCategorySelect) {
        addCategorySelect.innerHTML =
            '<option value="">Select category</option>' +
            data.map(category => `
                <option value="${category.category_id}">
                    ${escapeHTML(category.category_name)}
                </option>
            `).join("");
    }

    if (filterCategorySelect) {
        filterCategorySelect.innerHTML =
            '<option value="">All categories</option>' +
            data.map(category => `
                <option value="${category.category_id}">
                    ${escapeHTML(category.category_name)}
                </option>
            `).join("");
    }

    console.log("Categories loaded:", data.length);
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
        .eq("is_active", true)
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

        if (available <= 0) {
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

    tableBody.innerHTML = data.map(item => {
        const available = item.current_stock - item.reserved_stock;

        let status = "In Stock";
        let statusClass = "inventory-status-available";
        let rowClass = "";

        if (available <= 0) {
            status = "Out of Stock";
            statusClass = "inventory-status-out-of-stock";
            rowClass = "row-out-of-stock";
        } else if (available <= item.minimum_stock) {
            status = "Low Stock";
            statusClass = "inventory-status-low-stock";
            rowClass = "row-low-stock";
        }

        const category = item.item_categories?.category_name
            || "Uncategorized";

        return `
            <tr class="${rowClass}">
                <td class="cell-id">#${item.item_id}</td>

                <td>
                    <div class="item-name-cell">
                        <span class="item-box-icon">
                            <svg aria-hidden="true"
                                width="14" height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.7">
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

                <td class="cell-qty text-center">
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
                    <button
                        type="button"
                        class="view-item-btn"
                        data-item-id="${item.item_id}"
                        aria-label="View ${escapeHTML(item.item_name)}">

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
                </td>
            </tr>
        `;
    }).join("");

    console.log("Inventory table rendered:", data.length, "items");
}


