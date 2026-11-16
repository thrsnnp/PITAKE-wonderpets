
import { supabase } from "./supabaseClient.js";

const sidebarContainer = document.getElementById("sidebar-container");

async function loadSidebar() {
    if (!sidebarContainer) return;

    try {
        const response = await fetch("../components/sidebar.html");

        if (!response.ok) {
            throw new Error("Unable to load sidebar.");
        }

        sidebarContainer.innerHTML = await response.text();

        setActivePage();
        setupLogout();
        loadStockHealth();

    } catch (error) {
        console.error("Sidebar loading error:", error);
        sidebarContainer.innerHTML =
            "<p>Unable to load navigation.</p>";
    }
}

// ========================================
// STOCK HEALTH
// ========================================

async function loadStockHealth() {
    const stockHealthText = document.getElementById("stockHealthText");
    const stockHealthBar = document.getElementById("stockHealthBar");

    if (!stockHealthText || !stockHealthBar) return;

    const { data: items, error } = await supabase
        .from("items")
        .select("current_stock, minimum_stock")
        .eq("is_active", true);

    if (error) {
        console.error("Stock health loading error:", error);
        stockHealthText.textContent = "Unable to load stock health";
        return;
    }

    const readyItems = items.filter(
        item => item.current_stock > item.minimum_stock
    ).length;

    const percentage = items.length > 0
        ? Math.round((readyItems / items.length) * 100)
        : 0;

    stockHealthText.textContent =
        `Inventory is ${percentage}% ready`;

    stockHealthBar.style.width = `${percentage}%`;
}

function setActivePage() {
    const currentPage = window.location.pathname
        .split("/")
        .pop()
        .replace(".html", "");

    document.querySelectorAll(".sidebar .nav-link").forEach(link => {
        if (link.dataset.page === currentPage) {
            link.classList.add("active");
        }
    });
}

function setupLogout() {
    const logoutBtn = document.getElementById("logoutBtn");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async () => {
        const confirmed = confirm("Are you sure you want to log out?");

        if (!confirmed) return;

        const { error } = await supabase.auth.signOut();

        if (error) {
            alert("Unable to log out. Please try again.");
            console.error(error);
            return;
        }

        window.location.href = "../index.html";
    });
}

loadSidebar();
