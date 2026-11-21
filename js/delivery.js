
import { supabase } from "./supabaseClient.js";

// Delivery Management UI prototype.
// Data is temporary and is not saved to Supabase.

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const statuses = [
    "Pending Preparation",
    "Ready for Release",
    "Released",
    "Partially Returned",
    "Returned",
    "Completed"
  ];

  const today = () => {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  };

  const itemCatalog = [
    { name: "Premium photo paper 4 × 6", type: "Consumable" },
    { name: "DNP printer ink ribbon", type: "Consumable" },
    { name: "Canon EOS R6 camera", type: "Equipment" },
    { name: "DNP DS-RX1HS printer", type: "Equipment" },
    { name: "Godox softbox lighting kit", type: "Equipment" },
    { name: "1970s disco costume set", type: "Rental Costume" }
  ];

  const seed = [
    {
      id: "DLV-DEMO-0068",
      event: "Amara & Dito Wedding",
      isoDate: "2025-05-31",
      venue: "Ballroom",
      requester: "Alya Putri",
      personnel: "Bayu Pratama",
      requisition: "REQ-DEMO-094",
      releaseDate: "",
      status: "Pending Preparation",
      inspected: false,
      items: [
        {
          name: "Premium photo paper 4 × 6",
          type: "Consumable",
          requested: 12,
          prepared: 0,
          released: 0,
          used: 0,
          returned: 0,
          condition: "New"
        },
        {
          name: "Canon EOS R6 camera",
          type: "Equipment",
          requested: 1,
          prepared: 0,
          released: 0,
          used: 0,
          returned: 0,
          condition: "Excellent"
        }
      ]
    },
    {
      id: "DLV-DEMO-0067",
      event: "Nusantara Brand Launch",
      isoDate: "2025-05-30",
      venue: "Main Hall",
      requester: "Dimas Arta",
      personnel: "Raka Maulana",
      requisition: "REQ-DEMO-093",
      releaseDate: "",
      status: "Ready for Release",
      inspected: false,
      items: [
        {
          name: "DNP printer ink ribbon",
          type: "Consumable",
          requested: 6,
          prepared: 6,
          released: 0,
          used: 0,
          returned: 0,
          condition: "New"
        },
        {
          name: "Godox softbox lighting kit",
          type: "Equipment",
          requested: 2,
          prepared: 2,
          released: 0,
          used: 0,
          returned: 0,
          condition: "Good"
        }
      ]
    },
    {
      id: "DLV-DEMO-0066",
      event: "Heritage Festival",
      isoDate: "2025-05-29",
      venue: "Museum Courtyard",
      requester: "Nadia Rahma",
      personnel: "Citra Lestari",
      requisition: "REQ-DEMO-092",
      releaseDate: "2025-05-28",
      status: "Released",
      inspected: true,
      items: [
        {
          name: "1970s disco costume set",
          type: "Rental Costume",
          requested: 8,
          prepared: 8,
          released: 8,
          used: 0,
          returned: 0,
          condition: "Good"
        },
        {
          name: "Premium photo paper 4 × 6",
          type: "Consumable",
          requested: 10,
          prepared: 10,
          released: 10,
          used: 7,
          returned: 0,
          condition: "New"
        }
      ]
    }
  ];

  let deliveries = structuredClone(seed);
  let selectedId = null;
  let currentUser = null;

  const selected = () =>
    deliveries.find((delivery) => delivery.id === selectedId);

  function formatDate(iso) {
    if (!iso) return "—";

    return new Date(`${iso}T00:00:00`).toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    );
  }

  function make(tag, text = "", className = "") {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function open(id) {
    $(id).hidden = false;
  }

  function close(id) {
    $(id).hidden = true;
  }

  function statusBadge(status) {
    const badge = make(
      "span",
      status,
      "delivery-status delivery-status-" +
        status.toLowerCase().replaceAll(" ", "-")
    );
    return badge;
  }

  function refresh() {
    const search = $("deliverySearch").value.toLowerCase().trim();
    const status = $("deliveryStatusFilter").value;
    const requester = $("deliveryRequesterFilter").value;
    const date = $("deliveryDateFilter").value;

    const filtered = deliveries.filter((delivery) => {
      const searchable =
        `${delivery.id} ${delivery.event} ${delivery.venue}`.toLowerCase();

      return (
        searchable.includes(search) &&
        (!status || delivery.status === status) &&
        (!requester || delivery.requester === requester) &&
        (!date || delivery.isoDate === date)
      );
    });

    const body = $("deliveryTableBody");
    body.replaceChildren();

    if (filtered.length === 0) {
      const row = document.createElement("tr");
      const cell = make(
        "td",
        "No deliveries found.",
        "delivery-empty"
      );
      cell.colSpan = 8;
      row.appendChild(cell);
      body.appendChild(row);
    }

    filtered.forEach((delivery) => {
      const row = document.createElement("tr");

      [
        delivery.id,
        delivery.event,
        formatDate(delivery.isoDate),
        delivery.requester,
        `${delivery.items.length} line items`,
        formatDate(delivery.releaseDate)
      ].forEach((value) => {
        row.appendChild(make("td", value));
      });

      const statusCell = document.createElement("td");
      statusCell.appendChild(statusBadge(delivery.status));
      row.appendChild(statusCell);

      const actionCell = document.createElement("td");
      const viewButton = make(
        "button",
        "View",
        "delivery-view-btn"
      );
      viewButton.type = "button";
      viewButton.addEventListener("click", () => {
        showDetails(delivery.id);
      });
      actionCell.appendChild(viewButton);
      row.appendChild(actionCell);

      row.addEventListener("click", (event) => {
        if (!event.target.closest("button")) {
          showDetails(delivery.id);
        }
      });

      body.appendChild(row);
    });

    $("deliveryCount").textContent =
      `Showing ${filtered.length} of ${deliveries.length} deliveries`;

    $("totalDeliveries").textContent = deliveries.length;

    $("pendingDeliveries").textContent = deliveries.filter(
      (delivery) => delivery.status === "Pending Preparation"
    ).length;

    $("releasedItems").textContent = deliveries.reduce(
      (sum, delivery) =>
        sum + delivery.items.reduce(
          (itemSum, item) => itemSum + item.released,
          0
        ),
      0
    );

    $("pendingReturns").textContent = deliveries.filter(
      (delivery) =>
        delivery.status === "Released" ||
        delivery.status === "Partially Returned"
    ).length;

    populateRequesterFilter();
  }

  function populateRequesterFilter() {
    const filter = $("deliveryRequesterFilter");
    const currentValue = filter.value;

    filter.replaceChildren(
      new Option("All requesters", "")
    );

    const requesters = [
      ...new Set(deliveries.map((delivery) => delivery.requester))
    ].sort();

    requesters.forEach((name) => {
      filter.add(new Option(name, name));
    });

    filter.value = requesters.includes(currentValue)
      ? currentValue
      : "";
  }

  function updateSelected(changes) {
    const delivery = selected();
    if (!delivery) return;

    Object.assign(delivery, changes);
    refresh();
    showDetails(delivery.id);
  }

  function showDetails(id) {
    selectedId = id;

    const delivery = selected();
    if (!delivery) return;

    $("deliveryDetailsTitle").textContent = delivery.id;
    $("detailEventName").textContent = delivery.event;

    $("detailEventInfo").textContent =
      `${formatDate(delivery.isoDate)} · ${delivery.venue}`;

    $("detailRequester").textContent = delivery.requester;
    $("detailPersonnel").textContent = delivery.personnel;
    $("detailRequisition").textContent = delivery.requisition;

    $("detailStatus").replaceWith(
      Object.assign(statusBadge(delivery.status), {
        id: "detailStatus"
      })
    );

    renderChecklist(delivery);
    renderActions(delivery);

    open("deliveryDetailsModal");
  }

  function renderChecklist(delivery) {
    const container = $("deliveryChecklist");
    container.replaceChildren();

    const header = make(
      "div",
      "",
      "delivery-checklist-header"
    );

    ["Item", "Req.", "Prep.", "Used", "Return"].forEach(
      (label) => header.appendChild(make("span", label))
    );

    container.appendChild(header);

    delivery.items.forEach((item) => {
      const row = make(
        "div",
        "",
        "delivery-checklist-row"
      );

      const description = document.createElement("div");
      description.appendChild(make("strong", item.name));
      description.appendChild(
        make("small", `${item.type} · ${item.condition}`)
      );

      row.appendChild(description);
      row.appendChild(make("span", String(item.requested)));
      row.appendChild(make("span", String(item.prepared)));

      row.appendChild(
        make(
          "span",
          item.type === "Consumable" ? String(item.used) : "—"
        )
      );

      row.appendChild(
        make(
          "span",
          item.type !== "Consumable"
            ? String(item.returned)
            : "—"
        )
      );

      container.appendChild(row);
    });
  }

  function actionButton(label, handler, secondary = false) {
    const button = make(
      "button",
      label,
      secondary
        ? "delivery-secondary-btn"
        : "delivery-primary-btn"
    );

    button.type = "button";
    button.addEventListener("click", handler);

    return button;
  }

  function renderActions(delivery) {
    const footer = $("deliveryActionFooter");
    footer.replaceChildren();

    if (delivery.status === "Pending Preparation") {
      footer.appendChild(
        actionButton("Prepare Items", () => {
          delivery.items.forEach((item) => {
            item.prepared = item.requested;
          });

          updateSelected({
            status: "Ready for Release",
            inspected: false
          });
        })
      );
    }

    else if (delivery.status === "Ready for Release") {
      const inspectButton = actionButton(
        delivery.inspected
          ? "Inspection Passed"
          : "Inspect Items",
        () => {
          updateSelected({ inspected: true });
        },
        true
      );

      const releaseButton = actionButton(
        "Release Items",
        () => {
          if (!delivery.inspected) return;

          delivery.items.forEach((item) => {
            item.released = item.prepared;
          });

          updateSelected({
            status: "Released",
            releaseDate: today()
          });
        }
      );

      releaseButton.disabled = !delivery.inspected;

      footer.append(inspectButton, releaseButton);
    }

    else if (delivery.status === "Released") {
      footer.appendChild(
        actionButton(
          "Record Actual Usage",
          showUsageModal,
          true
        )
      );

      footer.appendChild(
        actionButton(
          "Receive Returns",
          showReturnModal
        )
      );
    }

    else if (delivery.status === "Partially Returned") {
      footer.appendChild(
        actionButton(
          "Receive Remaining Returns",
          showReturnModal
        )
      );
    }

    else if (delivery.status === "Returned") {
      footer.appendChild(
        actionButton(
          "Mark Delivery Complete",
          () => {
            updateSelected({ status: "Completed" });
          }
        )
      );
    }

    else if (delivery.status === "Completed") {
      footer.appendChild(
        make(
          "p",
          "Delivery reconciled and completed. This is demo data."
        )
      );
    }
  }

  function populateDemoSelectors() {
    const personnel = $("deliveryPersonnel");

    [
      "Bayu Pratama",
      "Raka Maulana",
      "Citra Lestari"
    ].forEach((name) => {
      personnel.add(new Option(name, name));
    });

    const requisitions = $("deliveryRequisition");

    [
      "REQ-DEMO-094",
      "REQ-DEMO-093",
      "REQ-DEMO-092"
    ].forEach((id) => {
      requisitions.add(new Option(id, id));
    });
  }

  function addItemRow() {
    const container = $("deliveryItemRows");
    const row = make("div", "", "delivery-item-row");

    const select = document.createElement("select");
    select.required = true;

    select.add(new Option("Select inventory item", ""));

    itemCatalog.forEach((item) => {
      select.add(new Option(item.name, item.name));
    });

    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.value = "1";
    quantity.required = true;
    quantity.setAttribute("aria-label", "Item quantity");

    const removeButton = make(
      "button",
      "×",
      "delivery-remove-item"
    );
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", "Remove item");

    removeButton.addEventListener("click", () => {
      row.remove();
    });

    row.append(select, quantity, removeButton);
    container.appendChild(row);
  }

  function createDelivery(event) {
    event.preventDefault();

    const eventName = $("deliveryEventName").value.trim();
    const eventDate = $("deliveryEventDate").value;
    const venue = $("deliveryVenue").value.trim();
    const personnel = $("deliveryPersonnel").value;
    const requisition = $("deliveryRequisition").value;

    const rows = [
      ...$("deliveryItemRows").querySelectorAll(".delivery-item-row")
    ];

    if (rows.length === 0) {
      alert("Please add at least one inventory item.");
      return;
    }

    const items = [];

    for (const row of rows) {
      const name = row.querySelector("select").value;
      const quantity = Number(
        row.querySelector('input[type="number"]').value
      );

      if (!name || !Number.isInteger(quantity) || quantity < 1) {
        alert("Please select valid items and quantities.");
        return;
      }

      if (items.some((item) => item.name === name)) {
        alert("Please select each inventory item only once.");
        return;
      }

      const catalogItem = itemCatalog.find(
        (item) => item.name === name
      );

      items.push({
        name,
        type: catalogItem.type,
        requested: quantity,
        prepared: 0,
        released: 0,
        used: 0,
        returned: 0,
        condition: "Good"
      });
    }

    const nextNumber = Math.max(
      68,
      ...deliveries.map((delivery) => {
        const match = delivery.id.match(/(\d+)$/);
        return match ? Number(match[1]) : 0;
      })
    ) + 1;

    const requester = currentUser?.name || "Demo User";

    const delivery = {
      id: `DLV-DEMO-${String(nextNumber).padStart(4, "0")}`,
      event: eventName,
      isoDate: eventDate,
      venue,
      requester,
      personnel,
      requisition,
      releaseDate: "",
      status: "Pending Preparation",
      inspected: false,
      items
    };

    deliveries.unshift(delivery);

    close("createDeliveryModal");
    $("createDeliveryForm").reset();
    $("deliveryItemRows").replaceChildren();

    refresh();
    showDetails(delivery.id);
  }

  function showUsageModal() {
    const delivery = selected();
    if (!delivery) return;

    const container = $("deliveryUsageItems");
    container.replaceChildren();

    const consumables = delivery.items.filter(
      (item) => item.type === "Consumable"
    );

    if (consumables.length === 0) {
      alert("This delivery has no consumable items.");
      return;
    }

    consumables.forEach((item, index) => {
      const row = make("div", "", "delivery-usage-row");

      const description = document.createElement("div");
      description.appendChild(make("strong", item.name));
      description.appendChild(
        make("small", `${item.released} units released`)
      );

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = String(item.released);
      input.value = String(item.used);
      input.required = true;
      input.dataset.index = String(index);
      input.setAttribute("aria-label", `Used quantity for ${item.name}`);

      row.append(description, input);
      container.appendChild(row);
    });

    open("deliveryUsageModal");
  }

  function saveUsage(event) {
    event.preventDefault();

    const delivery = selected();
    if (!delivery) return;

    const consumables = delivery.items.filter(
      (item) => item.type === "Consumable"
    );

    const inputs = [
      ...$("deliveryUsageItems").querySelectorAll("input")
    ];

    const quantities = inputs.map((input) => Number(input.value));

    if (quantities.some(
      (quantity, index) =>
        !Number.isInteger(quantity) ||
        quantity < 0 ||
        quantity > consumables[index].released
    )) {
      alert("Please enter valid usage quantities.");
      return;
    }

    consumables.forEach((item, index) => {
      item.used = quantities[index];
    });

    close("deliveryUsageModal");
    updateSelected({});
  }

  function showReturnModal() {
    const delivery = selected();
    if (!delivery) return;

    const reusable = delivery.items.filter(
      (item) => item.type !== "Consumable"
    );

    if (reusable.length === 0) {
      alert("This delivery has no reusable items to return.");
      return;
    }

    const container = $("deliveryReturnItems");
    container.replaceChildren();

    reusable.forEach((item) => {
      const row = make("div", "", "delivery-return-row");

      const description = document.createElement("div");
      description.appendChild(make("strong", item.name));
      description.appendChild(
        make(
          "small",
          `${item.released} released · ${item.returned} already returned`
        )
      );

      const quantity = document.createElement("input");
      quantity.type = "number";
      quantity.min = "0";
      quantity.max = String(item.released - item.returned);
      quantity.value = "0";
      quantity.required = true;
      quantity.setAttribute("aria-label", `Additional returns for ${item.name}`);

      const condition = document.createElement("select");

      [
        "Good",
        "Cleaning required",
        "Minor damage",
        "Damaged"
      ].forEach((value) => {
        condition.add(new Option(value, value));
      });

      row.append(description, quantity, condition);
      container.appendChild(row);
    });

    $("deliveryReturnRemarks").value = "";
    open("deliveryReturnModal");
  }

  function saveReturns(event) {
    event.preventDefault();

    const delivery = selected();
    if (!delivery) return;

    const reusable = delivery.items.filter(
      (item) => item.type !== "Consumable"
    );

    const rows = [
      ...$("deliveryReturnItems").querySelectorAll(".delivery-return-row")
    ];

    const updates = rows.map((row, index) => ({
      item: reusable[index],
      quantity: Number(row.querySelector("input").value),
      condition: row.querySelector("select").value
    }));

    if (updates.some(
      ({ item, quantity }) =>
        !Number.isInteger(quantity) ||
        quantity < 0 ||
        quantity > item.released - item.returned
    )) {
      alert("Please enter valid return quantities.");
      return;
    }

    updates.forEach(({ item, quantity, condition }) => {
      item.returned += quantity;

      if (quantity > 0) {
        item.condition = condition;
      }
    });

    const allReturned = reusable.every(
      (item) => item.returned === item.released
    );

    close("deliveryReturnModal");

    updateSelected({
      status: allReturned ? "Returned" : "Partially Returned"
    });
  }

  async function loadProfile() {
    try {
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (authError || !user) return;

      const { data: profile, error } = await supabase
        .from("users")
        .select("first_name, last_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("Profile loading failed:", error.message);
        return;
      }

      const name = [
        profile?.first_name,
        profile?.last_name
      ].filter(Boolean).join(" ");

      currentUser = {
        name: name || user.email || "User"
      };

      $("userName").textContent = currentUser.name;
      $("userRole").textContent = profile?.role || "User";

      $("userAvatar").textContent = name
        ? name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()
        : "U";
    } catch (error) {
      console.warn("Unable to load user profile:", error);
    }
  }

  // CREATE DELIVERY EVENTS

  $("createDeliveryBtn").addEventListener("click", () => {
    $("createDeliveryForm").reset();
    $("deliveryEventDate").value = today();
    $("deliveryItemRows").replaceChildren();
    addItemRow();
    open("createDeliveryModal");
  });

  $("addDeliveryItemBtn").addEventListener("click", addItemRow);

  $("createDeliveryForm").addEventListener(
    "submit",
    createDelivery
  );

  // USAGE AND RETURN EVENTS

  $("deliveryUsageForm").addEventListener(
    "submit",
    saveUsage
  );

  $("deliveryReturnForm").addEventListener(
    "submit",
    saveReturns
  );

  // MODAL CLOSE BUTTONS

  [
    ["closeCreateDelivery", "createDeliveryModal"],
    ["cancelCreateDelivery", "createDeliveryModal"],
    ["closeDeliveryDetails", "deliveryDetailsModal"],
    ["closeUsageModal", "deliveryUsageModal"],
    ["cancelUsageModal", "deliveryUsageModal"],
    ["closeReturnModal", "deliveryReturnModal"],
    ["cancelReturnModal", "deliveryReturnModal"]
  ].forEach(([buttonId, modalId]) => {
    $(buttonId).addEventListener("click", () => close(modalId));
  });

  [
    "createDeliveryModal",
    "deliveryDetailsModal",
    "deliveryUsageModal",
    "deliveryReturnModal"
  ].forEach((id) => {
    $(id).addEventListener("click", (event) => {
      if (event.target === $(id)) {
        close(id);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      for (const id of [
        "deliveryReturnModal",
        "deliveryUsageModal",
        "deliveryDetailsModal",
        "createDeliveryModal"
      ]) {
        if (!$(id).hidden) {
          close(id);
          break;
        }
      }
    }
  });

  // SEARCH AND FILTER EVENTS

  [
    "deliverySearch",
    "deliveryStatusFilter",
    "deliveryRequesterFilter",
    "deliveryDateFilter"
  ].forEach((id) => {
    $(id).addEventListener("input", refresh);
  });

  // NOTIFICATION DROPDOWN

  $("notif-btn")?.addEventListener("click", () => {
    $("notif-popover")?.classList.toggle("hidden");
  });

  // INITIALIZE PAGE

  populateDemoSelectors();
  refresh();
  loadProfile();
});
