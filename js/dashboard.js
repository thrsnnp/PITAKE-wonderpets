
import { supabase } from "./supabaseClient.js";


async function protectDashboard() {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = "../index.html";
        return false;
    }

    const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("first_name, last_name, role, department, is_active")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
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

    // Allow all active users to access the dashboard
    console.log("Dashboard access granted:", profile.role);

    const fullName = `${profile.first_name} ${profile.last_name}`;

    document.getElementById("welcomeName").textContent = profile.first_name;
    document.getElementById("userName").textContent = fullName;
    document.getElementById("userRole").textContent = profile.role;

    const initials =
        `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();

    document.getElementById("userAvatar").textContent = initials;

    console.log("Dashboard access verified:", profile);

    return true;
}

async function loadDashboardStats() {
    // Start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    // 1. Total active inventory items
    const { count: totalInventory, error: inventoryError } = await supabase
        .from("items")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

    // 2. Pending requisitions
    const { count: pendingRequisitions, error: requisitionError } = await supabase
        .from("requisitions")
        .select("*", { count: "exact", head: true })
        .eq("status", "Pending");

    // 3. Inventory stock information
    const { data: items, error: lowStockError } = await supabase
        .from("items")
        .select("current_stock, minimum_stock")
        .eq("is_active", true);

    // 4. Pending deliveries
    const { count: pendingDeliveries, error: deliveryError } = await supabase
        .from("event_deliveries")
        .select("*", { count: "exact", head: true })
        .eq("delivery_status", "Pending");

    // 5. Inventory categories
    const { count: categoryCount, error: categoryError } = await supabase
        .from("item_categories")
        .select("*", { count: "exact", head: true });

    // 6. Requisitions submitted today
    const { count: submittedToday, error: submittedError } = await supabase
        .from("requisitions")
        .select("*", { count: "exact", head: true })
        .gte("request_date", todayStart);

    // 7. Prepared deliveries awaiting release
    const { count: preparedDeliveries, error: preparedError } = await supabase
        .from("event_deliveries")
        .select("*", { count: "exact", head: true })
        .eq("delivery_status", "Prepared");

    // Check for errors
    if (
        inventoryError || requisitionError || lowStockError ||
        deliveryError || categoryError || submittedError || preparedError
    ) {
        console.error("Dashboard statistics error:", {
            inventoryError,
            requisitionError,
            lowStockError,
            deliveryError,
            categoryError,
            submittedError,
            preparedError
        });
        return;
    }

    // Calculate low stock and out-of-stock items
    const lowStockCount = items.filter(
        item => item.current_stock <= item.minimum_stock
    ).length;

    const outOfStockCount = items.filter(
        item => item.current_stock <= 0
    ).length;

    // Calculate inventory readiness
    const readyItems = items.filter(
        item => item.current_stock > item.minimum_stock
    ).length;

    const stockHealthPercentage = items.length > 0
        ? Math.round((readyItems / items.length) * 100)
        : 0;

    // Update main statistics
    document.getElementById("totalInventory").textContent = totalInventory ?? 0;
    document.getElementById("pendingRequisitions").textContent = pendingRequisitions ?? 0;
    document.getElementById("lowStockItems").textContent = lowStockCount;
    document.getElementById("pendingDeliveries").textContent = pendingDeliveries ?? 0;

    // Update stat metadata
    document.getElementById("inventoryCategoryCount").textContent = categoryCount ?? 0;
    document.getElementById("requisitionMeta").textContent = submittedToday ?? 0;
    document.getElementById("lowStockMeta").textContent = outOfStockCount;
    document.getElementById("deliveryMeta").textContent = preparedDeliveries ?? 0;

    // Update stock health widget
    document.getElementById("stockHealthText").textContent =
        `Inventory is ${stockHealthPercentage}% ready`;

    document.getElementById("stockHealthBar").style.width =
        `${stockHealthPercentage}%`;

    console.log("Dashboard statistics loaded!");
}


async function loadInventoryOverview() {
    // Get all active inventory items
    const { data: items, error: itemsError } = await supabase
        .from("items")
        .select("category_id")
        .eq("is_active", true);

    // Get inventory categories
    const { data: categories, error: categoriesError } = await supabase
        .from("item_categories")
        .select("category_id, category_name");

    if (itemsError || categoriesError) {
        console.error("Inventory overview error:", {
            itemsError,
            categoriesError
        });
        return;
    }

    // Count items under each category
    const categoryCounts = {};

    categories.forEach(category => {
        categoryCounts[category.category_name] = items.filter(
            item => item.category_id === category.category_id
        ).length;
    });

    const consumables = categoryCounts["Consumable Supplies"] || 0;
    const equipment = categoryCounts["Equipment"] || 0;
    const costumes = categoryCounts["Rental Costumes"] || 0;

    const total = consumables + equipment + costumes;

    // Calculate category percentages
    const consumablesPercent = total ? consumables / total * 100 : 0;
    const equipmentPercent = total ? equipment / total * 100 : 0;
    const costumesPercent = total ? costumes / total * 100 : 0;

    // Update total
    document.getElementById("inventoryChartTotal").textContent = total.toLocaleString();

    // Update category counts
    document.getElementById("consumableCount").textContent = `${consumables} items`;
    document.getElementById("equipmentCount").textContent = `${equipment} items`;
    document.getElementById("costumeCount").textContent = `${costumes} items`;

    // Update progress bars
    document.getElementById("consumableProgress").style.width = `${consumablesPercent}%`;
    document.getElementById("equipmentProgress").style.width = `${equipmentPercent}%`;
    document.getElementById("costumeProgress").style.width = `${costumesPercent}%`;

    // Update donut chart
    const circumference = 2 * Math.PI * 43;

    const segments = [
        { id: "consumableArc", value: consumables, offset: 0 },
        { id: "equipmentArc", value: equipment, offset: consumables },
        { id: "costumeArc", value: costumes, offset: consumables + equipment }
    ];

    segments.forEach(segment => {
        const arc = document.getElementById(segment.id);
        const length = total ? (segment.value / total) * circumference : 0;
        const offset = total ? -(segment.offset / total) * circumference : 0;

        arc.setAttribute(
            "stroke-dasharray",
            `${length} ${circumference}`
        );

        arc.setAttribute("stroke-dashoffset", offset);
    });

    console.log("Inventory overview loaded!", categoryCounts);
}


async function loadRecentActivity() {
    const { data: movements, error } = await supabase
        .from("stock_movements")
        .select(`
            movement_id,
            movement_type,
            quantity,
            movement_date,
            reference_type,
            remarks,
            items (
                item_name
            )
        `)
        .order("movement_date", { ascending: false })
        .limit(4);

    if (error) {
        console.error("Recent activity error:", error);
        document.getElementById("recentActivityList").innerHTML =
            "<p>Unable to load recent activities.</p>";
        return;
    }

    const activityList = document.getElementById("recentActivityList");

    if (!movements || movements.length === 0) {
        activityList.innerHTML = "<p>No inventory activities yet.</p>";
        return;
    }

    const activityColors = {
        "Stock In": "#8B5E3C",
        "Stock Out": "#E8A6B8",
        "Reserved": "#D4A65A",
        "Reservation Released": "#5B2633",
        "Returned": "#8B5E3C",
        "Damaged": "#B9835A",
        "Adjustment": "#5B2633"
    };

    activityList.innerHTML = movements.map((movement, index) => {
        const itemName = movement.items?.item_name || "Inventory item";
        const color = activityColors[movement.movement_type] || "#8B5E3C";

        const date = new Date(movement.movement_date);
        const timeText = date.toLocaleString();

        const quantityText = movement.quantity
            ? `${movement.quantity} units`
            : "Quantity not specified";

        const description = movement.remarks || itemName;

        return `
            <div class="timeline-item">
                ${index < movements.length - 1
                    ? '<span class="timeline-line"></span>'
                    : ''
                }
                <span class="timeline-dot" style="background-color: ${color}"></span>
                <div class="timeline-content">
                    <div class="timeline-top">
                        <p class="timeline-title">${movement.movement_type}</p>
                        <span class="timeline-time">${timeText}</span>
                    </div>
                    <p class="timeline-desc">
                        ${itemName} · ${quantityText}
                    </p>
                    <p class="timeline-desc">${description}</p>
                </div>
            </div>
        `;
    }).join("");

    console.log("Recent activities loaded!", movements);
}


async function loadRecentRequisitions() {
    const tableBody = document.getElementById("recentRequisitionsBody");

    const { data: requisitions, error } = await supabase
        .from("requisitions")
        .select(`
            requisition_id,
            requisition_number,
            request_date,
            status,
            requested_by,
            users (
                first_name,
                last_name
            ),
            requisition_items (
                requested_quantity,
                items (
                    item_name
                )
            )
        `)
        .order("request_date", { ascending: false })
        .limit(5);

    if (error) {
        console.error("Recent requisitions error:", error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    Unable to load requisitions.
                </td>
            </tr>
        `;
        return;
    }

    if (!requisitions || requisitions.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    No requisitions found.
                </td>
            </tr>
        `;
        console.log("No requisitions available.");
        return;
    }

    const statusClasses = {
        "Pending": "status-pending",
        "Approved": "status-approved",
        "Rejected": "status-rejected",
        "For Revision": "status-in-review",
        "Fulfilled": "status-approved",
        "Cancelled": "status-rejected"
    };

    tableBody.innerHTML = requisitions.map(req => {
        const requester = req.users
            ? `${req.users.first_name} ${req.users.last_name}`
            : "Unknown User";

        const initials = requester
            .split(" ")
            .map(name => name.charAt(0))
            .join("")
            .substring(0, 2)
            .toUpperCase();

        const requestDate = new Date(req.request_date)
            .toLocaleDateString("en-PH", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

        const itemNames = (req.requisition_items || [])
            .map(item => item.items?.item_name)
            .filter(Boolean);

        const itemText = itemNames.length > 0
            ? itemNames.slice(0, 2).join(", ")
            : "No items";

        const totalItems = (req.requisition_items || []).length;

        const statusClass =
            statusClasses[req.status] || "status-pending";

        return `
            <tr>
                <td class="req-id">${req.requisition_number}</td>
                <td>
                    <div class="requester-cell">
                        <span class="requester-avatar">${initials}</span>
                        <span class="requester-name">${requester}</span>
                    </div>
                </td>
                <td class="req-date">${requestDate}</td>
                <td class="req-items">
                    ${itemText}
                    <span class="item-badge">${totalItems}</span>
                </td>
                <td>
                    <span class="status ${statusClass}">
                        ${req.status}
                    </span>
                </td>
                <td class="req-actions">-</td>
            </tr>
        `;
    }).join("");

    console.log("Recent requisitions loaded!", requisitions);
}


async function loadNotifications() {
    // 1. Get low-stock items
    const { data: lowStockItems, error: stockError } = await supabase
        .from("items")
        .select("item_name, current_stock, minimum_stock")
        .eq("is_active", true)
        .order("current_stock", { ascending: true });

    // 2. Count pending requisitions
    const { count: pendingRequests, error: requisitionError } = await supabase
        .from("requisitions")
        .select("*", { count: "exact", head: true })
        .eq("status", "Pending");

    // 3. Count pending deliveries
    const { count: pendingDeliveries, error: deliveryError } = await supabase
        .from("event_deliveries")
        .select("*", { count: "exact", head: true })
        .eq("delivery_status", "Pending");

    if (stockError || requisitionError || deliveryError) {
        console.error("Notification loading error:", {
            stockError,
            requisitionError,
            deliveryError
        });
        return;
    }

    // Filter items at or below minimum stock
    const criticalItems = lowStockItems.filter(
        item => item.current_stock <= item.minimum_stock
    );

    // Calculate total notifications
    const notificationCount =
        criticalItems.length +
        (pendingRequests ?? 0) +
        (pendingDeliveries ?? 0);

    // Update notification badge
    const badge = document.getElementById("notifBadge");
    badge.textContent = notificationCount;
    badge.style.display = notificationCount > 0 ? "flex" : "none";

    // Display notifications
    const notificationList = document.getElementById("notificationList");
    notificationList.replaceChildren();

    function addNotification(message) {
        const paragraph = document.createElement("p");
        paragraph.className = "notif-text";
        paragraph.textContent = message;
        notificationList.appendChild(paragraph);
    }

    if (notificationCount === 0) {
        addNotification("You're all caught up! No new notifications.");
        return;
    }

    if (criticalItems.length > 0) {
        addNotification(
            `${criticalItems.length} inventory item(s) are at or below minimum stock.`
        );
    }

    if (pendingRequests > 0) {
        addNotification(
            `${pendingRequests} requisition(s) are awaiting review.`
        );
    }

    if (pendingDeliveries > 0) {
        addNotification(
            `${pendingDeliveries} delivery(ies) are pending preparation.`
        );
    }

    console.log("Notifications loaded!");
}


async function searchEverything(searchTerm) {
    const resultsContainer = document.getElementById("globalSearchResults");
    const term = searchTerm.trim();

    resultsContainer.replaceChildren();

    if (!term) {
        resultsContainer.classList.add("hidden");
        return;
    }

    resultsContainer.classList.remove("hidden");

    const { data: items, error: itemsError } = await supabase
        .from("items")
        .select("item_id, item_name")
        .ilike("item_name", `%${term}%`)
        .limit(5);

    const { data: requisitions, error: requisitionsError } = await supabase
        .from("requisitions")
        .select("requisition_id, requisition_number, purpose")
        .or(`requisition_number.ilike.%${term}%,purpose.ilike.%${term}%`)
        .limit(5);

    const { data: purchaseOrders, error: purchaseError } = await supabase
        .from("purchase_orders")
        .select("po_id, po_number")
        .ilike("po_number", `%${term}%`)
        .limit(5);

    const { data: suppliers, error: suppliersError } = await supabase
        .from("suppliers")
        .select("supplier_id, supplier_name")
        .ilike("supplier_name", `%${term}%`)
        .limit(5);

    const { data: deliveries, error: deliveriesError } = await supabase
        .from("event_deliveries")
        .select("delivery_id, delivery_number")
        .ilike("delivery_number", `%${term}%`)
        .limit(5);

    const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("event_id, event_name")
        .ilike("event_name", `%${term}%`)
        .limit(5);

    const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, role, department")
        .limit(100);

    const errors = [
        itemsError,
        requisitionsError,
        purchaseError,
        suppliersError,
        deliveriesError,
        eventsError,
        usersError
    ].filter(Boolean);

    if (errors.length > 0) {
        console.error("Global search error:", errors);
        resultsContainer.textContent = "Unable to complete search.";
        return;
    }

    const results = [];

    items?.forEach(item => {
        results.push({
            category: "Inventory",
            title: item.item_name
        });
    });

    requisitions?.forEach(request => {
        results.push({
            category: "Requisition",
            title: request.requisition_number || `Requisition #${request.requisition_id}`
        });
    });

    purchaseOrders?.forEach(po => {
        results.push({
            category: "Purchasing",
            title: po.po_number
        });
    });

    suppliers?.forEach(supplier => {
        results.push({
            category: "Supplier",
            title: supplier.supplier_name
        });
    });

    deliveries?.forEach(delivery => {
        results.push({
            category: "Delivery",
            title: delivery.delivery_number
        });
    });

    events?.forEach(event => {
        results.push({
            category: "Event",
            title: event.event_name
        });
    });

    users?.filter(user =>
        `${user.first_name} ${user.last_name} ${user.email} ${user.role} ${user.department || ""}`
            .toLowerCase()
            .includes(term.toLowerCase())
    ).slice(0, 5).forEach(user => {
        results.push({
            category: "User",
            title: `${user.first_name} ${user.last_name} (${user.email})`
        });
    });

    if (results.length === 0) {
        resultsContainer.textContent = "No matching records found.";
        return;
    }

    results.slice(0, 15).forEach(result => {
        const resultItem = document.createElement("div");
        resultItem.className = "search-result-item";

        const title = document.createElement("strong");
        title.textContent = result.title;

        const category = document.createElement("small");
        category.textContent = result.category;

        resultItem.append(title, category);
        resultsContainer.appendChild(resultItem);
    });

    console.log("Global search completed:", results.length, "results");
}

// Global Search Event Listener
const globalSearch = document.getElementById("globalSearch");

globalSearch.addEventListener("input", async () => {
    const searchTerm = globalSearch.value.trim();

    if (searchTerm.length < 2) {
        document.getElementById("globalSearchResults").classList.add("hidden");
        return;
    }

    await searchEverything(searchTerm);
});


protectDashboard().then(isAuthorized => {
    if (isAuthorized) {
        loadDashboardStats();
        loadInventoryOverview();
        loadRecentActivity();
        loadRecentRequisitions();
        loadNotifications();
    }
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error("Logout error:", error.message);
        alert("Unable to log out. Please try again.");
        return;
    }

    window.location.href = "../index.html";
});

// Display current date
const pageDate = document.getElementById("pageDate");

if (pageDate) {
    pageDate.textContent = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}