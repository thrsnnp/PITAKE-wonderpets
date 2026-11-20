
import { supabase } from "./supabaseClient.js";

// PITAKE Purchasing Management
// Read-only database integration

document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);

    const searchInput = $("purchaseSearch");
    const statusFilter = $("statusFilter");
    const supplierFilter = $("supplierFilter");
    const dateFilter = $("dateFilter");
    const tableBody = $("purchaseOrdersBody");
    const purchaseCount = $("purchaseCount");

    let purchaseOrders = [];
    let suppliers = [];
    let items = [];
    let orderItems = [];
    let users = [];

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function setText(id, value) {
        const element = $(id);
        if (element) element.textContent = value;
    }

    function getSupplierName(supplierId) {
        return suppliers.find(
            (supplier) =>
                String(supplier.supplier_id) === String(supplierId)
        )?.supplier_name ?? "Unknown Supplier";
    }

    function getItemNames(poId) {
        const matchingItems = orderItems.filter(
            (orderItem) =>
                String(orderItem.po_id) === String(poId)
        );

        if (!matchingItems.length) return "No items";

        return matchingItems.map((orderItem) => {
            const item = items.find(
                (entry) =>
                    String(entry.item_id) ===
                    String(orderItem.item_id)
            );

            return item?.item_name ?? "Unknown Item";
        }).join(", ");
    }

    function getCreatorName(userId) {
        const user = users.find(
            (entry) => entry.id === userId
        );

        if (!user) return "Unknown User";

        return [
            user.first_name,
            user.last_name
        ].filter(Boolean).join(" ") || "Unknown User";
    }

    function updateStats() {
        setText("totalOrders", purchaseOrders.length);

        setText(
            "pendingOrders",
            purchaseOrders.filter((order) =>
                order.approval_status === "Pending"
            ).length
        );

        setText(
            "approvedOrders",
            purchaseOrders.filter((order) =>
                order.approval_status === "Approved"
            ).length
        );

        setText(
            "receivedOrders",
            purchaseOrders.filter((order) =>
                order.purchase_status === "Fully Received"
            ).length
        );
    }

    function renderPurchaseOrders() {
        const search = (searchInput?.value ?? "")
            .toLowerCase().trim();

        const selectedStatus = statusFilter?.value ?? "";
        const selectedSupplier = supplierFilter?.value ?? "";
        const selectedDate = dateFilter?.value ?? "";

        const filtered = purchaseOrders.filter((order) => {
            const supplierName = getSupplierName(order.supplier_id);
            const itemNames = getItemNames(order.po_id);

            const searchableText = [
                order.po_number,
                supplierName,
                itemNames
            ].join(" ").toLowerCase();

            const matchesSearch = searchableText.includes(search);

            const matchesStatus =
                !selectedStatus ||
                order.approval_status === selectedStatus ||
                order.purchase_status === selectedStatus;

            const matchesSupplier =
                !selectedSupplier ||
                String(order.supplier_id) === selectedSupplier;

            const matchesDate =
                !selectedDate ||
                order.purchase_date === selectedDate;

            return matchesSearch &&
                matchesStatus &&
                matchesSupplier &&
                matchesDate;
        });

        if (!tableBody) return;

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-message">
                        No matching purchase orders found.
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = filtered.map((order) => {
                const status = order.purchase_status || "Pending";

                const statusClass = status
                    .toLowerCase()
                    .replace(/\s+/g, "-");

                const amount = Number(order.total_amount ?? 0);

                return `
                    <tr>
                        <td>${escapeHTML(order.po_number)}</td>
                        <td>${escapeHTML(
                            getSupplierName(order.supplier_id)
                        )}</td>
                        <td>${escapeHTML(order.purchase_date)}</td>
                        <td>${escapeHTML(
                            getItemNames(order.po_id)
                        )}</td>
                        <td>₱${amount.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })}</td>
                        <td>${escapeHTML(
                            getCreatorName(order.created_by)
                        )}</td>
                        <td>
                            <span class="po-status po-status-${statusClass}">
                                ${escapeHTML(status)}
                            </span>
                        </td>
                        <td>
                            <button
                                type="button"
                                class="view-order-btn"
                                data-order-id="${escapeHTML(order.po_id)}"
                            >
                                View
                            </button>
                        </td>
                    </tr>
                `;
            }).join("");
        }

        if (purchaseCount) {
            purchaseCount.textContent =
                `Showing ${filtered.length} of ${purchaseOrders.length} purchase orders`;
        }

        updateStats();
    }

    function populateSuppliers() {
        const activeSuppliers = suppliers.filter(
            (supplier) => supplier.status === "Active"
        );

        if (supplierFilter) {
            supplierFilter.innerHTML =
                '<option value="">All Suppliers</option>';

            suppliers.forEach((supplier) => {
                const option = document.createElement("option");
                option.value = supplier.supplier_id;
                option.textContent = supplier.supplier_name;
                supplierFilter.appendChild(option);
            });
        }

        const purchaseSupplier = $("purchaseSupplier");

        if (purchaseSupplier) {
            purchaseSupplier.innerHTML =
                '<option value="">Select a supplier (optional)</option>';

            activeSuppliers.forEach((supplier) => {
                const option = document.createElement("option");
                option.value = supplier.supplier_id;
                option.textContent = supplier.supplier_name;
                purchaseSupplier.appendChild(option);
            });
        }
    }

    function populateItems() {
        const purchaseItem = $("purchaseItem");
        if (!purchaseItem) return;

        purchaseItem.innerHTML =
            '<option value="">Select an item</option>';

        items.filter((item) => item.is_active === true)
            .forEach((item) => {
                const option = document.createElement("option");
                option.value = item.item_id;
                option.textContent = item.item_name;
                purchaseItem.appendChild(option);
            });
    }

    async function loadPurchasingData() {
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-message">
                        Loading purchase orders...
                    </td>
                </tr>
            `;
        }

        try {
            const results = await Promise.all([
                supabase.from("purchase_orders").select("*")
                    .order("purchase_date", { ascending: false }),

                supabase.from("suppliers").select("*"),

                supabase.from("items")
                    .select("item_id, item_name, is_active"),

                supabase.from("purchase_order_items").select("*"),

                supabase.from("users")
                    .select("id, first_name, last_name")
            ]);

            const names = [
                "purchase_orders",
                "suppliers",
                "items",
                "purchase_order_items",
                "users"
            ];

            const errors = results
                .map((result, index) => ({
                    table: names[index],
                    error: result.error
                }))
                .filter((entry) => entry.error);

            if (errors.length > 0) {
                errors.forEach(({ table, error }) => {
                    console.error(`${table} error:`, error);
                });

                throw new Error(
                    "Unable to load all purchasing data. Check Console."
                );
            }

            [
                purchaseOrders,
                suppliers,
                items,
                orderItems,
                users
            ] = results.map((result) => result.data ?? []);

            populateSuppliers();
            populateItems();
            renderPurchaseOrders();

            console.log(
                "Purchasing data loaded:",
                purchaseOrders.length,
                "orders"
            );

        } catch (error) {
            console.error("Purchasing loading error:", error);

            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-message">
                            Unable to load purchasing data.
                            Check the browser Console.
                        </td>
                    </tr>
                `;
            }
        }
    }

    searchInput?.addEventListener("input", renderPurchaseOrders);
    statusFilter?.addEventListener("change", renderPurchaseOrders);
    supplierFilter?.addEventListener("change", renderPurchaseOrders);
    dateFilter?.addEventListener("change", renderPurchaseOrders);

    // View button is not implemented yet.
    tableBody?.addEventListener("click", (event) => {
        const button = event.target.closest(".view-order-btn");
        if (!button) return;

        alert(
            "Purchase order details will be added in the next step."
        );
    });

    loadPurchasingData();
});
