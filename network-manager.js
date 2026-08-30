// ==========================================
// SAMCAM NETOPS - 21ST CENTURY LAB ENGINE
// ==========================================

const mockWorkstations = [
    { id: "PC-01", ip: "192.168.1.101", learner: "Byaruhanga Mark", activity: "VS Code - index.html", status: "active", cpu: "14%", ram: "42%" },
    { id: "PC-02", ip: "192.168.1.102", learner: "Namubiru Aisha", activity: "MySQL Workbench - Query Editor", status: "active", cpu: "28%", ram: "64%" },
    { id: "PC-03", ip: "192.168.1.103", learner: "Kigozi Ronald", activity: "Desktop (Idle > 5m)", status: "idle", cpu: "2%", ram: "19%" },
    { id: "PC-04", ip: "192.168.1.104", learner: "Atuhaire Brenda", activity: "Google Chrome - Documentation", status: "active", cpu: "18%", ram: "51%" },
    { id: "PC-05", ip: "192.168.1.105", learner: "Mwesigwa David", activity: "Screen Locked by Instructor", status: "locked", cpu: "0%", ram: "12%" },
    { id: "PC-06", ip: "192.168.1.106", learner: "Nakitto Gloria", activity: "Node.js Terminal Server", status: "active", cpu: "32%", ram: "55%" }
];

document.addEventListener("DOMContentLoaded", () => {
    renderWorkstations(mockWorkstations);
    initEventListeners();
    startLiveTelemetrySimulation();
});

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
                <span style="font-size: 0.75rem; color: var(--text-muted);">${pc.status.toUpperCase()}</span>
            </div>
            <div class="ws-thumbnail-preview">
                <div style="color: var(--text-muted); font-size: 0.8rem; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-desktop" style="font-size: 1.5rem; color: var(--primary);"></i>
                    <span>Live Stream Active</span>
                </div>
            </div>
            <div class="ws-meta">
                <span>Learner: <strong>${pc.learner}</strong></span>
                <span>Active App: <strong>${pc.activity}</strong></span>
                <span>CPU: ${pc.cpu} | RAM: ${pc.ram}</span>
            </div>
        `;

        card.addEventListener("click", () => openNodeModal(pc));
        grid.appendChild(card);
    });

    const onlineCounter = document.getElementById("onlineCount");
    if(onlineCounter) {
        onlineCounter.textContent = stations.filter(s => s.status !== 'locked').length;
    }
}

function initEventListeners() {
    const searchInput = document.getElementById("nodeSearch");
    const statusFilter = document.getElementById("statusFilter");

    const filterData = () => {
        const query = searchInput ? searchInput.value.toLowerCase() : "";
        const filterVal = statusFilter ? statusFilter.value : "ALL";

        const filtered = mockWorkstations.filter(pc => {
            const matchesSearch = pc.id.toLowerCase().includes(query) || pc.learner.toLowerCase().includes(query);
            const matchesStatus = filterVal === "ALL" || pc.status.toUpperCase() === filterVal;
            return matchesSearch && matchesStatus;
        });

        renderWorkstations(filtered);
    };

    if(searchInput) searchInput.addEventListener("input", filterData);
    if(statusFilter) statusFilter.change = statusFilter.addEventListener("change", filterData);

    const closeModalBtn = document.getElementById("closeModalBtn");
    if(closeModalBtn) closeModalBtn.onclick = closeModal;

    const lockAllBtn = document.getElementById("lockAllBtn");
    if(lockAllBtn) {
        lockAllBtn.onclick = () => {
            mockWorkstations.forEach(pc => pc.status = "locked");
            renderWorkstations(mockWorkstations);
        };
    }
}

function openNodeModal(pc) {
    const modal = document.getElementById("nodeModal");
    const title = document.getElementById("modalNodeTitle");
    const body = document.getElementById("modalNodeBody");
    const lockBtn = document.getElementById("modalLockBtn");

    if(!modal) return;

    title.textContent = `Workstation Control: ${pc.id}`;
    body.innerHTML = `
        <p><strong>Assigned Learner:</strong> ${pc.learner}</p>
        <p><strong>IP Address:</strong> ${pc.ip}</p>
        <p><strong>Current Foreground Process:</strong> ${pc.activity}</p>
        <p><strong>Hardware Resource Utilization:</strong> CPU: ${pc.cpu}, Memory: ${pc.ram}</p>
        <p style="margin-top: 10px; color: var(--success);"><i class="fa-solid fa-shield-check"></i> Network Firewall Isolation: Disabled (Normal)</p>
    `;

    lockBtn.textContent = pc.status === "locked" ? "Unlock Terminal" : "Lock Terminal";
    lockBtn.onclick = () => {
        pc.status = pc.status === "locked" ? "active" : "locked";
        renderWorkstations(mockWorkstations);
        closeModal();
    };

    modal.style.display = "flex";
}

function closeModal() {
    const modal = document.getElementById("nodeModal");
    if(modal) modal.style.display = "none";
}

function startLiveTelemetrySimulation() {
    setInterval(() => {
        mockWorkstations.forEach(pc => {
            if(pc.status !== 'locked') {
                const randomCpu = Math.floor(Math.random() * 30) + 10;
                pc.cpu = `${randomCpu}%`;
            }
        });
    }, 4000);
}
