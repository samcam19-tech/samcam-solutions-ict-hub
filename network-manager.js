// ==========================================
// SAMCAM NETOPS - FULLY FUNCTIONAL LIVE TELEMETRY & COMMAND ENGINE
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
                screenUrl: data.screenUrl || "", // Captured screenshot URL / Base64 string
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
                screenUrl: "",
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

        // Dynamic thumbnail content: display image snapshot if available, else show fallback title/icon
        let previewContent = "";
        if (pc.screenUrl) {
            previewContent = `
                <div style="width: 100%; height: 110px; background: #000; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    <img src="${pc.screenUrl}" alt="Live Screen Preview" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
            `;
        } else {
            previewContent = `
                <div style="color: var(--text-muted); font-size: 0.8rem; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 15px 0;">
                    <i class="fa-solid fa-globe" style="font-size: 1.4rem; color: var(--primary);"></i>
                    <span style="font-weight: 500; color: var(--text-main); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-width: 230px;" title="${pc.activity}">${pc.activity}</span>
                    <span style="font-size: 0.7rem; color: var(--primary); opacity: 0.8;">🔗 ${pc.shortUrl}</span>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="ws-header">
                <span class="ws-id"><div class="ws-status-indicator ${pc.status}"></div> ${pc.id} (${pc.ip})</span>
                <span style="font-size: 0.70rem; color: var(--text-muted);">${pc.lastUpdated}</span>
            </div>
            <div class="ws-thumbnail-preview" style="padding: 8px;">
                ${previewContent}
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

    const loadCounter = document.getElementById("globalLoadCount");
    if (loadCounter && stations.length > 0) {
        const avgCpu = Math.round(stations.reduce((acc, s) => acc + parseInt(s.cpu || 0), 0) / stations.length);
        loadCounter.textContent = `${avgCpu}%`;
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

    // Close modal when clicking outside content wrapper
    const modal = document.getElementById("nodeModal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // Fully Functional: Lock All Screens Action
    const lockAllBtn = document.getElementById("lockAllBtn");
    if (lockAllBtn) {
        lockAllBtn.onclick = async () => {
            if (!window.db) return;
            if (!confirm("Are you sure you want to lock all connected workstation screens?")) return;
            
            try {
                const batch = window.db.batch();
                workstationsData.forEach(pc => {
                    const ref = window.db.collection("workstation_telemetry").doc(pc.id);
                    batch.update(ref, { status: "locked", activity: "Screen Locked by Instructor" });
                });
                await batch.commit();
                alert("All workstation screens have been successfully locked.");
            } catch (err) {
                console.error("Error locking all screens:", err);
                alert("Failed to lock all screens. Check console logs.");
            }
        };
    }

    // Fully Functional: Push Prompt / Broadcast Modal Action
    const pushPromptBtn = document.getElementById("pushPromptBtn") || document.querySelector("button[onclick*='Push'], .btn-primary");
    if (pushPromptBtn && !pushPromptBtn.id) pushPromptBtn.id = "pushPromptBtn";

    if (document.getElementById("pushPromptBtn")) {
        document.getElementById("pushPromptBtn").onclick = () => {
            openBroadcastModal();
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
        ${pc.screenUrl ? `<div style="margin-bottom: 15px; border-radius: 8px; overflow: hidden; border: 1px solid #334155;"><img src="${pc.screenUrl}" alt="Enlarged Screen View" style="width: 100%; max-height: 250px; object-fit: cover; display: block;" /></div>` : '<div style="padding: 20px; text-align: center; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 15px; color: var(--text-muted);">No live screen snapshot available yet</div>'}
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
            try {
                await window.db.collection("workstation_telemetry").doc(pc.id).update({
                    status: nextStatus,
                    activity: nextStatus === "locked" ? "Screen Locked by Instructor" : "Resumed Session"
                });
            } catch (err) {
                console.error("Error updating terminal lock state:", err);
            }
        }
        closeModal();
    };

    modal.style.display = "flex";
}

function closeModal() {
    const modal = document.getElementById("nodeModal");
    if (modal) modal.style.display = "none";
}

// Additional helper to manage the Push Prompt / Broadcast console modal if present in DOM
function openBroadcastModal() {
    let bModal = document.getElementById("broadcastModal");
    if (!bModal) {
        bModal = document.createElement("div");
        bModal.id = "broadcastModal";
        bModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999;";
        bModal.innerHTML = `
            <div style="background: #1e293b; padding: 25px; border-radius: 10px; width: 450px; border: 1px solid #334155; color: #f8fafc;">
                <h3 style="margin-top: 0; margin-bottom: 15px; color: #38bdf8;"><i class="fa-solid fa-bullhorn"></i> Broadcast Prompt to Class</h3>
                <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 15px;">Send an instant notification or instruction banner to all active student terminals.</p>
                <textarea id="broadcastMessage" placeholder="Type instructions or task prompt here..." style="width: 100%; height: 100px; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 10px; border-radius: 6px; resize: none; margin-bottom: 15px;"></textarea>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="closeBroadcast" style="padding: 8px 16px; background: #475569; border: none; color: #fff; border-radius: 5px; cursor: pointer;">Cancel</button>
                    <button id="sendBroadcast" style="padding: 8px 16px; background: #0ea5e9; border: none; color: #fff; border-radius: 5px; cursor: pointer; font-weight: 600;">Broadcast Now</button>
                </div>
            </div>
        `;
        document.body.appendChild(bModal);

        document.getElementById("closeBroadcast").onclick = () => { bModal.style.display = "none"; };
        document.getElementById("sendBroadcast").onclick = async () => {
            const msg = document.getElementById("broadcastMessage").value.trim();
            if (!msg) {
                alert("Please enter a message to broadcast.");
                return;
            }
            if (window.db) {
                try {
                    const batch = window.db.batch();
                    workstationsData.forEach(pc => {
                        const ref = window.db.collection("workstation_telemetry").doc(pc.id);
                        batch.update(ref, { broadcastNotice: msg });
                    });
                    await batch.commit();
                    alert("Broadcast message sent successfully to all workstations!");
                    bModal.style.display = "none";
                    document.getElementById("broadcastMessage").value = "";
                } catch (err) {
                    console.error("Broadcast failed:", err);
                    alert("Error sending broadcast.");
                }
            }
        };
    }
    bModal.style.display = "flex";
}
