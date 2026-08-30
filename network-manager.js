// ==========================================
// SAMCAM NETOPS - LIVE FIRESTORE TELEMETRY ENGINE
// ==========================================

let workstationsData = [];

document.addEventListener("DOMContentLoaded", () => {
    // Wait for window.db to be initialized by firebase-config.js
    const checkDbInterval = setInterval(() => {
        if (window.db) {
            clearInterval(checkDbInterval);
            initLiveTelemetryListener();
        }
    }, 50);

    initEventListeners();
});

// Real-time listener pulling directly from workstation_telemetry collection
function initLiveTelemetryListener() {
    window.db.collection("workstation_telemetry").onSnapshot((snapshot) => {
        const liveStations = [];
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            liveStations.push({
                id: data.workstationId || doc.id,
                ip: data.ip || "192.168.1.105",
                learner: data.learner || "Active Session Learner",
                activity: data.activeTitle || data.activity || "Active Browser Session",
                shortUrl: data.activeUrl || "Local Workspace",
                fullUrl: data.fullUrl || "#",
                status: data.status || "active",
                cpu: data.cpu || "15%",
                ram: data.ram || "45%",
                lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : "Just now"
            });
        });

        // Fallback placeholder if collection is empty
        if (liveStations.length === 0) {
            liveStations.push({
                id: "SMS",
                ip: "192.168.1.100",
                learner: "Waiting for telemetry...",
                activity: "No active signals recorded",
                shortUrl: "idle",
                fullUrl: "#",
                status: "idle",
                cpu: "0%",
                ram: "0%",
                lastUpdated: "--"
            });
        }

        workstationsData = liveStations;
        renderWorkstations(workstationsData);
    }, (error) => {
        console.error("Error reading workstation telemetry:", error);
    });
}

function renderWorkstations(stations) {
    const grid = document.getElementById("workstationGrid");
    if (!grid) return;
    grid.innerHTML = "";

    stations.forEach(pc => {
        const card = document.createElement("div");
        card.className = "workstation-card";
        card.dataset.id = pc.id;
        card.innerHTML = `
            <div class="ws-header">
                <span class="ws-id"><div class="ws-status-indicator ${pc.status}"></div> ${pc.id} (${pc.ip})</span>
                <span style="font-size: 0.70rem; color: var(--text-muted);">${pc.lastUpdated}</span>
            </div>
            <div class="ws-thumbnail-preview" style="padding: 10px; text-align: center;">
                <div style="color: var(--text-muted); font-size: 0.8rem; display: flex; flex-direction: column; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-globe" style="font-size: 1.4rem; color: var(--primary);"></i>
                    <span style="font-weight: 500; color: var(--text-main); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-width: 230px;" title="${pc.activity}">${pc.activity}</span>
                    <span style="font-size: 0.7rem; color: var(--primary); opacity: 0.8;">🔗 ${pc.shortUrl}</span>
                </div>
            </div>
            <div class="ws-meta">
                <span>Learner: <strong>${pc.learner}</strong></span>
                <span>CPU: ${pc.cpu} | RAM: ${pc.ram}</span>
            </div>
        `;

        card.addEventListener("click", () => openNodeModal(pc));
        grid.appendChild(card);
    });

    const onlineCounter = document.getElementById("onlineCount");
    if (onlineCounter) {
        onlineCounter.textContent = stations.filter(s => s.status !== 'locked').length;
    }
}

function initEventListeners() {
    const searchInput = document.getElementById("nodeSearch");
    const statusFilter = document.getElementById("statusFilter");

    const filterData = () => {
        const query = searchInput ? searchInput.value.toLowerCase() : "";
        const filterVal = statusFilter ? statusFilter.value : "ALL";

        const filtered = workstationsData.filter(pc => {
            const matchesSearch = pc.id.toLowerCase().includes(query) || pc.learner.toLowerCase().includes(query) || pc.activity.toLowerCase().includes(query);
            const matchesStatus = filterVal === "ALL" || pc.status.toUpperCase() === filterVal;
            return matchesSearch && matchesStatus;
        });

        renderWorkstations(filtered);
    };

    if (searchInput) searchInput.addEventListener("input", filterData);
    if (statusFilter) statusFilter.addEventListener("change", filterData);

    const closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) closeModalBtn.onclick = closeModal;

    const lockAllBtn = document.getElementById("lockAllBtn");
    if (lockAllBtn) {
        lockAllBtn.onclick = async () => {
            if (!window.db) return;
            const batch = window.db.batch();
            workstationsData.forEach(pc => {
                const ref = window.db.collection("workstation_telemetry").doc(pc.id);
                batch.update(ref, { status: "locked", activity: "Screen Locked by Instructor" });
            });
            await batch.commit();
        };
    }
}

function openNodeModal(pc) {
    const modal = document.getElementById("nodeModal");
    const title = document.getElementById("modalNodeTitle");
    const body = document.getElementById("modalNodeBody");
    const lockBtn = document.getElementById("modalLockBtn");

    if (!modal) return;

    title.textContent = `Workstation Control: ${pc.id}`;
    body.innerHTML = `
        <p><strong>Assigned Learner:</strong> ${pc.learner}</p>
        <p><strong>IP Address:</strong> ${pc.ip}</p>
        <p><strong>Active Window Title:</strong> ${pc.activity}</p>
        <p><strong>Target URL:</strong> <a href="${pc.fullUrl}" target="_blank" style="color: var(--primary);">${pc.fullUrl}</a></p>
        <p><strong>Hardware Resource Utilization:</strong> CPU: ${pc.cpu}, Memory: ${pc.ram}</p>
        <p style="margin-top: 10px; color: var(--success);"><i class="fa-solid fa-shield-check"></i> Live Firestore Feed Synchronized</p>
    `;

    const nextStatus = pc.status === "locked" ? "active" : "locked";
    lockBtn.textContent = pc.status === "locked" ? "Unlock Terminal" : "Lock Terminal";
    
    lockBtn.onclick = async () => {
        if (window.db) {
            await window.db.collection("workstation_telemetry").doc(pc.id).update({
                status: nextStatus,
                activity: nextStatus === "locked" ? "Screen Locked by Instructor" : "Resumed Session"
            });
        }
        closeModal();
    };

    modal.style.display = "flex";
}

function closeModal() {
    const modal = document.getElementById("nodeModal");
    if (modal) modal.style.display = "none";
}
