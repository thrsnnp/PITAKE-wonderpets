
import { supabase } from "./supabaseClient.js";

/* ==========================================
   PITAKE ERP - PURCHASING MANAGEMENT
   Purchase Requests + Purchase Orders
   Supabase RPC Integration
========================================== */

const $ = (id) => document.getElementById(id);

let purchaseRequestRecords = [];
let allocatedByRequisitionItem = new Map();

let purchaseOrders = [];
let purchaseOrderRequisitions = [];
let suppliers = [];
let items = [];
let orderItems = [];
let users = [];

let selectedRequisition = null;
let selectedRequisitionItem = null;
let isSubmittingPurchase = false;

/* ==========================================
   UTILITIES
========================================== */

function escapeHTML(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]
    );
}

function formatPeso(value) {
    return `₱${Number(value ?? 0).toLocaleString(
        "en-PH",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )}`;
}

function formatDate(value) {
    if (!value) return "N/A";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent = value;
    }
}

function remainingShortage(entry) {
    const shortage = Number(
        entry?.shortage_quantity ?? 0
    );

    const allocated = Number(
        allocatedByRequisitionItem.get(
            String(entry?.requisition_item_id)
        ) ?? 0
    );

    return Math.max(0, shortage - allocated);
}

/* ==========================================
   PURCHASE REQUEST STATUS
========================================== */


function getRequestItemStatus(request, entry) {
    if (request.status === "Fulfilled") {
        return "Fulfilled";
    }

    if (request.status !== "Approved") {
        return "Not Active";
    }

    const shortage = Number(
        entry?.shortage_quantity ?? 0
    );

    const remaining = remainingShortage(entry);

    const allocated = Math.max(
        0,
        shortage - remaining
    );

    if (shortage <= 0) {
        return "No Shortage";
    }

    if (allocated <= 0) {
        return "Needs Purchasing";
    }

    if (remaining > 0) {
        return "Partially Ordered";
    }

    return "Fully Ordered";
}


/* ==========================================
   RENDER PURCHASE REQUESTS
========================================== */

function renderPurchaseRequests() {
    const tableBody = $("purchaseRequestsBody");
    const count = $("purchaseRequestCount");

    if (!tableBody) return;

    const search = (
        $("purchaseRequestSearch")?.value ?? ""
    ).trim().toLowerCase();

    const selectedStatus =
        $("purchaseRequestStatusFilter")?.value ?? "";

    const rows = [];

    purchaseRequestRecords.forEach((request) => {
        const entries = request.requisition_items?.length
            ? request.requisition_items
            : [null];

        entries.forEach((entry) => {
            const status = getRequestItemStatus(
                request,
                entry
            );

            const searchable = [
                request.requisition_number,
                request.purpose,
                entry?.item_name
            ].join(" ").toLowerCase();

            if (!searchable.includes(search)) {
                return;
            }

            if (
                selectedStatus &&
                status !== selectedStatus
            ) {
                return;
            }

            rows.push({
                request,
                entry,
                status
            });
        });
    });

    if (!rows.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-message">
                    No matching purchase requests found.
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = rows.map((row) => {
            const { request, entry, status } = row;

            const shortage = remainingShortage(entry);

            const needsPurchasing =
                request.status === "Approved" &&
                shortage > 0 &&
                Boolean(entry?.requisition_item_id);

            
const statusClass = {
    "Needs Purchasing": "pending",
    "Partially Ordered": "pending",
    "Fully Ordered": "approved",
    "No Shortage": "approved",
    "Fulfilled": "fully-received",
    "Not Active": "pending"
}[status] ?? "pending";


            return `
                <tr>
                    <td>
                        <strong>
                            ${escapeHTML(
                                request.requisition_number
                            )}
                        </strong>
                    </td>

                    <td>
                        ${escapeHTML(
                            formatDate(request.request_date)
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            entry?.item_name ?? "No item"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            entry?.requested_quantity ?? 0
                        )}
                    </td>

                    <td>
                        ${escapeHTML(shortage)}
                    </td>

                    <td>
                        ${escapeHTML(
                            request.purpose ?? "N/A"
                        )}
                    </td>

                    <td>
                        <span class="po-status po-status-${statusClass}">
                            ${escapeHTML(status)}
                        </span>
                    </td>

                    <td>
                        <button
                            type="button"
                            class="view-order-btn create-po-from-request"
                            data-requisition-id="${escapeHTML(
                                request.requisition_id
                            )}"
                            data-requisition-item-id="${escapeHTML(
                                entry?.requisition_item_id ?? ""
                            )}"
                            ${needsPurchasing ? "" : "disabled"}
                        >
                            Create PO
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    if (count) {
        count.textContent =
            `Showing ${rows.length} requisition item(s)`;
    }
}

/* ==========================================
   LOAD PURCHASE REQUESTS
========================================== */

async function loadPurchaseRequests() {
    const tableBody = $("purchaseRequestsBody");

    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-message">
                    Loading requisitions from Supabase...
                </td>
            </tr>
        `;
    }

    try {
        const {
            data: requisitions,
            error: requisitionError
        } = await supabase
            .from("requisitions")
            .select(`
                requisition_id,
                requisition_number,
                request_date,
                purpose,
                status,
                requisition_items (
                    requisition_item_id,
                    item_id,
                    requested_quantity,
                    approved_quantity,
                    available_quantity,
                    shortage_quantity,
                    estimated_unit_cost
                )
            `)
            .in("status", ["Approved", "Fulfilled"])
            .order("request_date", {
                ascending: false
            });

        if (requisitionError) {
            throw requisitionError;
        }

        const {
            data: inventoryItems,
            error: itemsError
        } = await supabase
            .from("items")
            .select("item_id, item_name");

        if (itemsError) {
            throw itemsError;
        }

        const itemNames = new Map(
            (inventoryItems ?? []).map((item) => [
                String(item.item_id),
                item.item_name
            ])
        );

        purchaseRequestRecords = (
            requisitions ?? []
        ).map((request) => ({
            ...request,

            requisition_items: (
                request.requisition_items ?? []
            ).map((entry) => ({
                ...entry,

                item_name:
                    itemNames.get(String(entry.item_id)) ??
                    `Item #${entry.item_id}`
            }))
        }));

        /* Load active PO allocations */

        const {
            data: allocations,
            error: allocationError
        } = await supabase
            .from("purchase_order_requisition_items")
            .select(
                "requisition_item_id, quantity_allocated"
            )
            .eq("allocation_status", "Active");

        if (allocationError) {
            throw allocationError;
        }

        allocatedByRequisitionItem = new Map();

        for (const allocation of allocations ?? []) {
            const key = String(
                allocation.requisition_item_id
            );

            const previous =
                allocatedByRequisitionItem.get(key) ?? 0;

            allocatedByRequisitionItem.set(
                key,
                previous + Number(
                    allocation.quantity_allocated
                )
            );
        }

        renderPurchaseRequests();

        console.log(
            "Purchase requests loaded:",
            purchaseRequestRecords
        );

    } catch (error) {
        console.error(
            "Purchase requests loading error:",
            error
        );

        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-message">
                        Unable to load requisitions.
                        Check the browser Console.
                    </td>
                </tr>
            `;
        }
    }
}

/* ==========================================
   PURCHASE ORDER DATA HELPERS
========================================== */

function getSupplierName(supplierId) {
    return suppliers.find(
        (supplier) =>
            String(supplier.supplier_id) ===
            String(supplierId)
    )?.supplier_name ?? "Unknown Supplier";
}

function getItemNames(poId) {
    const matchingItems = orderItems.filter(
        (entry) =>
            String(entry.po_id) === String(poId)
    );

    if (!matchingItems.length) {
        return "No items";
    }

    return matchingItems.map((entry) => {
        const item = items.find(
            (record) =>
                String(record.item_id) ===
                String(entry.item_id)
        );

        return item?.item_name ?? "Unknown Item";
    }).join(", ");
}

function getCreatorName(userId) {
    const user = users.find(
        (entry) => entry.id === userId
    );

    if (!user) {
        return "Unknown User";
    }

    return [
        user.first_name,
        user.last_name
    ].filter(Boolean).join(" ") || "Unknown User";
}

/* ==========================================
   DASHBOARD STATISTICS
========================================== */

function updateStats() {
    setText(
        "totalOrders",
        purchaseOrders.length
    );

setText("pendingOrders", purchaseOrders.filter(order => order.purchase_status === "Pending").length);

setText("awaitingDelivery", purchaseOrders.filter(order =>
    ["Ordered", "Partially Received"].includes(order.purchase_status)
).length);

    setText(
        "receivedOrders",
        purchaseOrders.filter(
            (order) =>
                order.purchase_status === "Fully Received"
        ).length
    );
}

/* ==========================================
   RENDER PURCHASE ORDERS
========================================== */


function renderPurchaseOrders() {
    const tableBody = $("purchaseOrdersBody");
    const count = $("purchaseCount");

    if (!tableBody) return;

    const search = (
        $("purchaseSearch")?.value ?? ""
    ).trim().toLowerCase();

    const selectedStatus =
        $("statusFilter")?.value ?? "";

    const selectedSupplier =
        $("supplierFilter")?.value ?? "";

    const selectedDate =
        $("dateFilter")?.value ?? "";

    const filtered = purchaseOrders.filter((order) => {
        const supplierName =
            getSupplierName(order.supplier_id);

        const itemNames =
            getItemNames(order.po_id);

        const searchable = [
            order.po_number,
            supplierName,
            itemNames
        ].join(" ").toLowerCase();

        const matchesSearch =
            searchable.includes(search);

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

        return (
            matchesSearch &&
            matchesStatus &&
            matchesSupplier &&
            matchesDate
        );
    });

    if (!filtered.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-message">
                    No matching purchase orders found.
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = filtered.map((order) => {
            const approvalStatus =
                order.approval_status || "Pending";

            const purchaseStatus =
                order.purchase_status || "Pending";

            const approvalClass = approvalStatus
                .toLowerCase()
                .replace(/\s+/g, "-");

            const purchaseClass = purchaseStatus
                .toLowerCase()
                .replace(/\s+/g, "-");

            return `
                <tr>
                    <td>
                        ${escapeHTML(order.po_number)}
                    </td>

                    <td>
                        ${escapeHTML(
                            getSupplierName(order.supplier_id)
                        )}
                    </td>

                    <td>
                        ${escapeHTML(order.purchase_date)}
                    </td>

                    <td>
                        ${escapeHTML(
                            getItemNames(order.po_id)
                        )}
                    </td>

                    <td>
                        ${formatPeso(order.total_amount)}
                    </td>

                    <td>
                        ${escapeHTML(
                            getCreatorName(order.created_by)
                        )}
                    </td>

                    <td>
                        <span class="po-status po-status-${approvalClass}">
                            ${escapeHTML(approvalStatus)}
                        </span>
                    </td>

                    <td>
                        <span class="po-status po-status-${purchaseClass}">
                            ${escapeHTML(purchaseStatus)}
                        </span>
                    </td>

                    <td>
                        <button
                            type="button"
                            class="view-order-btn"
                            data-order-id="${escapeHTML(
                                order.po_id
                            )}"
                        >
                            View
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    if (count) {
        count.textContent =
            `Showing ${filtered.length} of ` +
            `${purchaseOrders.length} purchase orders`;
    }

    updateStats();
}


/* ==========================================
   SUPPLIER OPTIONS
========================================== */

function populateSuppliers() {
    const supplierFilter = $("supplierFilter");
    const supplierSelect = $("purchaseSupplier");

    const activeSuppliers = suppliers.filter(
        (supplier) => supplier.status === "Active"
    );

    if (supplierFilter) {
        supplierFilter.innerHTML =
            '<option value="">All Suppliers</option>';

        suppliers.forEach((supplier) => {
            const option =
                document.createElement("option");

            option.value = supplier.supplier_id;
            option.textContent = supplier.supplier_name;

            supplierFilter.appendChild(option);
        });
    }

    if (supplierSelect) {
        supplierSelect.innerHTML =
            '<option value="">Select a supplier</option>';

        activeSuppliers.forEach((supplier) => {
            const option =
                document.createElement("option");

            option.value = supplier.supplier_id;
            option.textContent = supplier.supplier_name;

            supplierSelect.appendChild(option);
        });
    }
}

/* ==========================================
   ITEM OPTIONS
========================================== */

function populateItems() {
    const itemSelect = $("purchaseItem");

    if (!itemSelect) return;

    itemSelect.innerHTML =
        '<option value="">Select an item</option>';

    items.filter(
        (item) => item.is_active === true
    ).forEach((item) => {
        const option =
            document.createElement("option");

        option.value = item.item_id;
        option.textContent = item.item_name;

        itemSelect.appendChild(option);
    });
}

/* ==========================================
   LOAD PURCHASE ORDERS
========================================== */

async function loadPurchasingData() {
    const tableBody = $("purchaseOrdersBody");

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
            supabase
                .from("purchase_orders")
                .select("*")
                .order("purchase_date", {
                    ascending: false
                }),

            supabase
                .from("suppliers")
                .select("*"),

            supabase
                .from("items")
                .select(
                    "item_id, item_name, is_active"
                ),

            supabase
                .from("purchase_order_items")
                .select("*"),

            supabase
    .from("users")
    .select(
        "id, first_name, last_name"
    ),

supabase
    .from("purchase_order_requisition_items")
    .select(`
        po_item_id,
        requisition_item_id,
        purchase_order_items!inner (
            po_id
        ),
        requisition_items!inner (
            requisitions!inner (
                requisition_number
            )
        )
    `)
        ]);

       const names = [
    "purchase_orders",
    "suppliers",
    "items",
    "purchase_order_items",
    "users",
    "purchase_order_requisition_items"
];

        const errors = results
            .map((result, index) => ({
                table: names[index],
                error: result.error
            }))
            .filter((entry) => entry.error);

        if (errors.length) {
            errors.forEach(({ table, error }) => {
                console.error(`${table} error:`, error);
            });

            throw new Error(
                "Unable to load purchasing data."
            );
        }

[
    purchaseOrders,
    suppliers,
    items,
    orderItems,
    users,
    purchaseOrderRequisitions
] = results.map(
    (result) => result.data ?? []
);

        populateSuppliers();
        populateItems();
        renderPurchaseOrders();

        console.log(
            "Purchasing data loaded:",
            purchaseOrders.length,
            "orders"
        );

    } catch (error) {
        console.error(
            "Purchasing loading error:",
            error
        );

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

/* ==========================================
   PURCHASE ORDER DETAILS
========================================== */

function showOrderDetails(poId) {
    const order = purchaseOrders.find(
        (entry) =>
            String(entry.po_id) === String(poId)
    );

    const viewModal = $("viewPurchaseModal");
    const viewItems = $("viewItems");

    if (!order || !viewModal) return;

    setText(
        "viewPoNumber",
        order.po_number ?? "N/A"
    );

    setText(
        "viewPurchaseDate",
        order.purchase_date
            ? formatDate(
                `${order.purchase_date}T00:00:00`
            )
            : "N/A"
    );

    setText(
        "viewSupplier",
        getSupplierName(order.supplier_id)
    );

    setText(
        "viewTotalAmount",
        formatPeso(order.total_amount)
    );

    setText(
        "viewRequestedBy",
        getCreatorName(order.created_by)
    );
    const linkedRequisitions = purchaseOrderRequisitions
    .filter((entry) =>
        String(entry.purchase_order_items?.po_id) ===
        String(order.po_id)
    )
    .map((entry) =>
        entry.requisition_items?.requisitions?.requisition_number
    )
    .filter(Boolean);

const uniqueRequisitions = [...new Set(linkedRequisitions)];

setText(
    "viewSourceRequisition",
    uniqueRequisitions.length
        ? uniqueRequisitions.join(", ")
        : "No linked requisition"
);

    setText(
        "viewApprovalStatus",
        order.approval_status ?? "N/A"
    );

    setText(
        "viewPurchaseStatus",
        order.purchase_status ?? "N/A"
    );
// Show Mark as Ordered only for approved, pending POs
const markAsOrderedBtn = $("markAsOrderedBtn");

if (markAsOrderedBtn) {
    const canMarkAsOrdered =
        order.approval_status === "Approved" &&
        order.purchase_status === "Pending";

    markAsOrderedBtn.hidden = !canMarkAsOrdered;
    markAsOrderedBtn.dataset.orderId = String(order.po_id);
}
    const badge = $("viewStatusBadge");

    if (badge) {
        const status =
            order.purchase_status || "Pending";

        badge.textContent = status;

        badge.style.background =
            status === "Fully Received"
                ? "#dcece2"
                : status === "Cancelled"
                    ? "#f8d7da"
                    : "#fff0d5";

        badge.style.color =
            status === "Fully Received"
                ? "#3d785b"
                : status === "Cancelled"
                    ? "#9b3944"
                    : "#9a6b25";
    }

    const matching = orderItems.filter(
        (entry) =>
            String(entry.po_id) === String(order.po_id)
    );

    if (viewItems) {
        viewItems.replaceChildren();

        if (!matching.length) {
            const empty =
                document.createElement("p");

            empty.textContent = "No items recorded.";

            viewItems.appendChild(empty);
        } else {
            matching.forEach((entry) => {
                const itemName = items.find(
                    (item) =>
                        String(item.item_id) ===
                        String(entry.item_id)
                )?.item_name ?? "Unknown Item";

                const card =
                    document.createElement("div");

                card.className = "po-item-card";

                const top =
                    document.createElement("div");

                top.className = "po-item-card-top";

                const name =
                    document.createElement("strong");

                name.textContent = itemName;

                const subtotal =
                    document.createElement("span");

                subtotal.textContent =
                    formatPeso(entry.subtotal);

                top.append(name, subtotal);

                const details =
                    document.createElement("p");

                details.textContent =
                    `Quantity: ${entry.quantity_ordered ?? 0} · ` +
                    `Unit cost: ${formatPeso(entry.unit_cost)}`;

                card.append(top, details);

                viewItems.appendChild(card);
            });
        }
    }

    viewModal.hidden = false;

    $("closeViewPurchaseModal")?.focus();
}
/* ==========================================
   MARK PURCHASE ORDER AS ORDERED
========================================== */
function showOrderedConfirmation(poNumber) {
    return new Promise((resolve) => {
        const modal = $("confirmOrderedModal");
        const number = $("confirmOrderedNumber");
        const confirmBtn = $("approveOrderedBtn");
        const cancelBtn = $("cancelOrderedBtn");

        if (!modal || !number || !confirmBtn || !cancelBtn) {
            console.error("Ordered confirmation modal is missing.");
            resolve(false);
            return;
        }

        number.textContent = poNumber;
        modal.hidden = false;
        confirmBtn.focus();

        function finish(confirmed) {
            modal.hidden = true;

            confirmBtn.removeEventListener("click", onConfirm);
            cancelBtn.removeEventListener("click", onCancel);
            modal.removeEventListener("click", onBackdrop);
            document.removeEventListener("keydown", onEscape, true);

            resolve(confirmed);
        }

        function onConfirm() {
            finish(true);
        }

        function onCancel() {
            finish(false);
        }

        function onBackdrop(event) {
            if (event.target === modal) {
                finish(false);
            }
        }

        function onEscape(event) {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopImmediatePropagation();
                finish(false);
            }
        }

        confirmBtn.addEventListener("click", onConfirm);
        cancelBtn.addEventListener("click", onCancel);
        modal.addEventListener("click", onBackdrop);
        document.addEventListener("keydown", onEscape, true);
    });
}
function showOrderedSuccess(poNumber) {
    const modal = document.createElement("div");

    modal.className = "po-confirm-overlay";

    modal.innerHTML = `
        <div class="po-confirm-card"
             role="dialog"
             aria-modal="true"
             aria-labelledby="orderedSuccessTitle">

            <div class="po-confirm-icon">✓</div>

            <h2 id="orderedSuccessTitle">
                Purchase Order Confirmed
            </h2>

            <p class="po-confirm-description">
                Purchase Order
                <strong>${escapeHTML(poNumber)}</strong>
                has been successfully marked as Ordered.
            </p>

            <div class="po-confirm-details">
                The Purchase Order is now awaiting
                supplier delivery.
            </div>

            <div class="po-confirm-actions">
                <button type="button"
                        class="po-confirm-approve"
                        id="closeOrderedSuccess">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeButton = modal.querySelector(
        "#closeOrderedSuccess"
    );

    function closeSuccess() {
        modal.remove();
    }

    closeButton.addEventListener("click", closeSuccess);
    closeButton.focus();
}
function showOrderedMessage(title, message) {
    const modal = document.createElement("div");
    modal.className = "po-confirm-overlay";

    const card = document.createElement("div");
    card.className = "po-confirm-card";
    card.setAttribute("role", "alertdialog");
    card.setAttribute("aria-modal", "true");

    const icon = document.createElement("div");
    icon.className = "po-confirm-icon";
    icon.textContent = "!";

    const heading = document.createElement("h2");
    heading.textContent = title;

    const description = document.createElement("p");
    description.className = "po-confirm-description";
    description.textContent = message;

    const actions = document.createElement("div");
    actions.className = "po-confirm-actions";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "po-confirm-approve";
    button.textContent = "OK";

    actions.appendChild(button);
    card.append(icon, heading, description, actions);
    modal.appendChild(card);
    document.body.appendChild(modal);

    function closeMessage() {
        modal.remove();
    }

    button.addEventListener("click", closeMessage);
    button.focus();
}
let isMarkingAsOrdered = false;

async function markPurchaseOrderAsOrdered(poId) {
    if (isMarkingAsOrdered) return;

    const order = purchaseOrders.find(
        (entry) => String(entry.po_id) === String(poId)
    );

if (
    !order ||
    order.approval_status !== "Approved" ||
    order.purchase_status !== "Pending"
) {
    showOrderedMessage(
        "Purchase Order Unavailable",
        "Only approved and pending Purchase Orders can be marked as ordered."
    );
    return;
}

const confirmed = await showOrderedConfirmation(
    order.po_number
);

if (!confirmed) return;

    const button = $("markAsOrderedBtn");
    isMarkingAsOrdered = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Processing...";
    }

    try {
        const { data, error } = await supabase.rpc(
            "mark_purchase_order_as_ordered",
            {
                p_po_id: Number(poId)
            }
        );

        if (error) throw error;

        if (!data?.success) {
            throw new Error("The order status was not updated.");
        }

        await loadPurchasingData();

        closeViewModal();

showOrderedSuccess(order.po_number);
    } catch (error) {
        console.error("Mark as Ordered failed:", error);

        alert(
            "Unable to mark Purchase Order as Ordered:\n\n" +
            (error.message ?? "Unknown error")
        );

    } finally {
        isMarkingAsOrdered = false;

        if (button) {
            button.disabled = false;
            button.textContent = "Mark as Ordered";
        }
    }
}
function closeViewModal() {
    const modal = $("viewPurchaseModal");

    if (modal) {
        modal.hidden = true;
    }
}

/* ==========================================
   CREATE PURCHASE ORDER FORM
========================================== */

function resetPurchaseForm() {
    const form = $("purchaseForm");

    form?.reset();

    selectedRequisition = null;
    selectedRequisitionItem = null;

    const itemSelect = $("purchaseItem");
    const quantityInput = $("purchaseQuantity");
    const purposeInput = $("purchasePurpose");
    const supplierSelect = $("purchaseSupplier");

    if (itemSelect) {
        itemSelect.disabled = false;
    }

    if (quantityInput) {
        quantityInput.removeAttribute("max");
    }

    if (purposeInput) {
        purposeInput.readOnly = false;
    }

    if (supplierSelect) {
        supplierSelect.required = false;
    }
}

function closePurchaseModal() {
    if (isSubmittingPurchase) return;

    const modal = $("purchaseModal");

    if (modal) {
        modal.hidden = true;
    }

    resetPurchaseForm();
}

function openPOFromRequisition(button) {
    if (isSubmittingPurchase) return;

    const requisition = purchaseRequestRecords.find(
        (request) =>
            String(request.requisition_id) ===
            button.dataset.requisitionId
    );

    const entry = requisition?.requisition_items?.find(
        (item) =>
            String(item.requisition_item_id) ===
            button.dataset.requisitionItemId
    );

    if (!requisition || !entry) {
        alert("Requisition item was not found.");
        return;
    }

    const shortage = remainingShortage(entry);

    if (
        requisition.status !== "Approved" ||
        !Number.isInteger(shortage) ||
        shortage <= 0
    ) {
        alert(
            "Only Approved requisitions with a remaining " +
            "shortage can create a Purchase Order."
        );

        return;
    }

    const modal = $("purchaseModal");
    const form = $("purchaseForm");
    const itemSelect = $("purchaseItem");
    const quantityInput = $("purchaseQuantity");
    const costInput = $("purchaseUnitCost");
    const supplierSelect = $("purchaseSupplier");
    const purposeInput = $("purchasePurpose");

    if (
        !modal ||
        !form ||
        !itemSelect ||
        !quantityInput ||
        !costInput
    ) {
        alert("Purchase Order form is unavailable.");
        return;
    }

    resetPurchaseForm();

    itemSelect.value = String(entry.item_id);

    if (itemSelect.value !== String(entry.item_id)) {
        alert(
            "The requested item is not available " +
            "in the Purchase Order form."
        );

        return;
    }

    selectedRequisition = requisition;
    selectedRequisitionItem = entry;

    itemSelect.disabled = true;

    quantityInput.value = shortage;
    quantityInput.min = "1";
    quantityInput.max = String(shortage);
    quantityInput.step = "1";

    costInput.value = Number(
        entry.estimated_unit_cost ?? 0
    ).toFixed(2);

    if (purposeInput) {
        purposeInput.value =
            requisition.purpose ?? "";

        purposeInput.readOnly = true;
    }

    if (supplierSelect) {
        supplierSelect.required = true;
    }

    modal.hidden = false;

    console.log(
        "Purchase Order form prepared:",
        {
            requisition_id:
                requisition.requisition_id,

            requisition_item_id:
                entry.requisition_item_id,

            item_id:
                entry.item_id,

            remaining_shortage:
                shortage
        }
    );
}

/* ==========================================
   SAVE PURCHASE ORDER USING SUPABASE RPC
========================================== */

function showPOConfirmation(details) {
    return new Promise((resolve) => {
        const modal = $("confirmPOModal");
        const detailsBox = $("confirmPODetails");
        const confirmButton = $("approvePOConfirmation");
        const cancelButton = $("cancelPOConfirmation");

        if (
            !modal ||
            !detailsBox ||
            !confirmButton ||
            !cancelButton
        ) {
            console.error("PO confirmation modal is missing.");
            resolve(false);
            return;
        }

        detailsBox.innerHTML = `
            <div><strong>Requisition:</strong>
                ${escapeHTML(details.requisition)}
            </div>
            <div><strong>Item:</strong>
                ${escapeHTML(details.item)}
            </div>
            <div><strong>Supplier:</strong>
                ${escapeHTML(details.supplier)}
            </div>
            <div><strong>Quantity:</strong>
                ${escapeHTML(details.quantity)}
            </div>
            <div><strong>Unit Cost:</strong>
                ${formatPeso(details.unitCost)}
            </div>
            <div><strong>Total:</strong>
                ${formatPeso(details.total)}
            </div>
        `;

        modal.hidden = false;
        confirmButton.focus();

        function finish(confirmed) {
            modal.hidden = true;

            confirmButton.removeEventListener(
                "click", onConfirm
            );
            cancelButton.removeEventListener(
                "click", onCancel
            );
            modal.removeEventListener(
                "click", onBackdrop
            );
            document.removeEventListener(
                "keydown", onKeydown
            );

            resolve(confirmed);
        }

        function onConfirm() {
            finish(true);
        }

        function onCancel() {
            finish(false);
        }

        function onBackdrop(event) {
            if (event.target === modal) {
                finish(false);
            }
        }

        function onKeydown(event) {
            if (event.key === "Escape") {
                event.stopImmediatePropagation();
                finish(false);
            }
        }

        confirmButton.addEventListener(
            "click", onConfirm
        );
        cancelButton.addEventListener(
            "click", onCancel
        );
        modal.addEventListener(
            "click", onBackdrop
        );
        document.addEventListener(
            "keydown", onKeydown, true
        );
    });
}

async function submitPurchaseOrder(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (isSubmittingPurchase) return;

    if (
        !selectedRequisition ||
        !selectedRequisitionItem
    ) {
        alert(
            "Please select Create PO from an " +
            "Approved requisition with a shortage."
        );

        return;
    }

    const quantityInput = $("purchaseQuantity");
    const costInput = $("purchaseUnitCost");
    const supplierSelect = $("purchaseSupplier");

    const quantity = Number(
        quantityInput?.value
    );

    const unitCost = Number(
        costInput?.value
    );

    const supplierId = Number(
        supplierSelect?.value
    );

    const remaining = remainingShortage(
        selectedRequisitionItem
    );

    if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > remaining
    ) {
        alert(
            `Quantity must be between 1 and ${remaining}.`
        );

        return;
    }

    if (
        !costInput?.value?.trim() ||
        !Number.isFinite(unitCost) ||
        unitCost < 0
    ) {
        alert("Please enter a valid unit cost.");
        return;
    }

    if (
        !Number.isSafeInteger(supplierId) ||
        supplierId <= 0
    ) {
        alert("Please select a supplier.");
        return;
    }

    const supplierName =
        supplierSelect.selectedOptions[0]?.textContent ??
        "N/A";

    const total = quantity * unitCost;

    /* Confirm real database creation */

    
const confirmed = await showPOConfirmation({
    requisition:
        selectedRequisition.requisition_number,
    item:
        selectedRequisitionItem.item_name,
    supplier:
        supplierName,
    quantity:
        quantity,
    unitCost:
        unitCost,
    total:
        total
});


    if (!confirmed) return;

    const submitButton = $("purchaseForm")
        ?.querySelector('button[type="submit"]');

    isSubmittingPurchase = true;

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent =
            "Creating Purchase Order...";
    }

    try {
        const {
            data,
            error
        } = await supabase.rpc(
            "create_purchase_order_from_requisition",
            {
                p_requisition_item_id: Number(
                    selectedRequisitionItem.requisition_item_id
                ),

                p_supplier_id: supplierId,

                p_quantity: quantity,

                p_unit_cost: unitCost
            }
        );

        if (error) {
            throw error;
        }

        const created = Array.isArray(data)
            ? data[0]
            : data;

        if (
            !created?.created_po_id ||
            !created?.created_po_number
        ) {
            throw new Error(
                "The RPC returned no Purchase Order details. " +
                "Check Supabase before retrying."
            );
        }

        /* Close and reset form */

        const modal = $("purchaseModal");

        if (modal) {
            modal.hidden = true;
        }

        resetPurchaseForm();

        alert(
            `Purchase Order ${created.created_po_number} ` +
            "created successfully!"
        );

        /* Refresh Purchase Requests and Orders */

        await Promise.all([
            loadPurchaseRequests(),
            loadPurchasingData()
        ]);

        /* Switch to Purchase Orders tab */

        $("purchaseOrdersTab")?.click();

        console.log(
            "Purchase Order created:",
            created
        );

    } catch (error) {
        console.error(
            "Create Purchase Order failed:",
            error
        );

        alert(
            "Unable to create Purchase Order:\n\n" +
            (error.message ?? "Unknown error") +
            "\n\nIf the request timed out, check the " +
            "Purchase Orders table before retrying."
        );

    } finally {
        isSubmittingPurchase = false;

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent =
                "Create Purchase Order";
        }
    }
}

/* ==========================================
   LOGGED-IN USER PROFILE
========================================== */

async function loadLoggedInUser() {
    try {
        const {
            data: authData,
            error: authError
        } = await supabase.auth.getUser();

        if (authError) {
            throw authError;
        }

        const authUser = authData?.user;

        if (!authUser) {
            console.warn("No logged-in user found.");
            return;
        }

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("users")
            .select(
                "first_name, last_name, role"
            )
            .eq("id", authUser.id)
            .single();

        if (profileError) {
            throw profileError;
        }

        const fullName = [
            profile.first_name,
            profile.last_name
        ].filter(Boolean).join(" ");

        const initials = [
            profile.first_name?.charAt(0),
            profile.last_name?.charAt(0)
        ].filter(Boolean).join("").toUpperCase();

        setText(
            "userName",
            fullName || "User"
        );

        setText(
            "userRole",
            profile.role || "User"
        );

        setText(
            "userAvatar",
            initials || "U"
        );

    } catch (error) {
        console.error(
            "Unable to load user profile:",
            error
        );

        setText("userName", "User");
        setText("userRole", "Profile unavailable");
        setText("userAvatar", "U");
    }
}

/* ==========================================
   INITIALIZE PURCHASING MODULE
========================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /* Purchase Request filters */

        $("purchaseRequestSearch")?.addEventListener(
            "input",
            renderPurchaseRequests
        );

        $("purchaseRequestStatusFilter")?.addEventListener(
            "change",
            renderPurchaseRequests
        );

        /* Purchase Order filters */

        $("purchaseSearch")?.addEventListener(
            "input",
            renderPurchaseOrders
        );

        $("statusFilter")?.addEventListener(
            "change",
            renderPurchaseOrders
        );

        $("supplierFilter")?.addEventListener(
            "change",
            renderPurchaseOrders
        );

        $("dateFilter")?.addEventListener(
            "change",
            renderPurchaseOrders
        );

        /* Create PO from requisition */

        $("purchaseRequestsBody")?.addEventListener(
            "click",
            (event) => {
                const button = event.target.closest(
                    ".create-po-from-request"
                );

                if (!button || button.disabled) {
                    return;
                }

                openPOFromRequisition(button);
            }
        );

        /* Disable unlinked Purchase Orders */

        const generalCreateButton =
            $("createPurchaseBtn");

        if (generalCreateButton) {
            generalCreateButton.disabled = true;

            generalCreateButton.title =
                "Select Create PO from an Approved " +
                "requisition with a shortage.";

            generalCreateButton.addEventListener(
                "click",
                (event) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                },
                true
            );
        }

        /* Purchase Order form submission */

        $("purchaseForm")?.addEventListener(
            "submit",
            submitPurchaseOrder,
            true
        );

        /* Close Create PO modal */

        $("closePurchaseModal")?.addEventListener(
            "click",
            closePurchaseModal
        );

        $("cancelPurchaseBtn")?.addEventListener(
            "click",
            closePurchaseModal
        );

        $("purchaseModal")?.addEventListener(
            "click",
            (event) => {
                if (
                    event.target === $("purchaseModal")
                ) {
                    closePurchaseModal();
                }
            }
        );

        /* View Purchase Order */

        $("purchaseOrdersBody")?.addEventListener(
            "click",
            (event) => {
                const button = event.target.closest(
                    ".view-order-btn"
                );

                if (!button) return;

                showOrderDetails(
                    button.dataset.orderId
                );
            }
        );
/* Mark Purchase Order as Ordered */

$("markAsOrderedBtn")?.addEventListener(
    "click",
    async () => {
        const button = $("markAsOrderedBtn");

        if (!button || button.disabled) return;

        await markPurchaseOrderAsOrdered(
            button.dataset.orderId
        );
    }
);
        /* Close details drawer */

        $("closeViewPurchaseModal")?.addEventListener(
            "click",
            closeViewModal
        );

        $("closeViewPurchaseBtn")?.addEventListener(
            "click",
            closeViewModal
        );

        $("viewPurchaseModal")?.addEventListener(
            "click",
            (event) => {
                if (
                    event.target === $("viewPurchaseModal")
                ) {
                    closeViewModal();
                }
            }
        );

        /* Escape key */

        document.addEventListener(
            "keydown",
            (event) => {
                if (event.key !== "Escape") {
                    return;
                }

                if (
                    $("purchaseModal") &&
                    !$("purchaseModal").hidden
                ) {
                    closePurchaseModal();
                }

                if (
                    $("viewPurchaseModal") &&
                    !$("viewPurchaseModal").hidden
                ) {
                    closeViewModal();
                }
            }
        );

        /* Initial data loading */

        loadLoggedInUser();
        loadPurchaseRequests();
        loadPurchasingData();

    }
);
