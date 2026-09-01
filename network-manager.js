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

window.verifyMasterKey = async function() {
  const inputEl = document.getElementById('masterKeyInput');
  const errEl = document.getElementById('masterKeyError');
  const gateEl = document.getElementById('masterKeyGate');
  const appEl = document.getElementById('networkManagerApp');

  if (!inputEl) return;
  const enteredKey = inputEl.value.trim();

  if (!enteredKey) {
    if (errEl) {
      errEl.textContent = 'Please enter the master key.';
      errEl.style.display = 'block';
    }
    return;
  }

  try {
    if (!window.db) {
      throw new Error("Firestore database instance not found.");
    }

    const configDocRef = window.db.collection("system_config").doc("super_admin_settings");
    const docSnap = await configDocRef.get();

    if (!docSnap.exists) {
      if (errEl) {
        errEl.textContent = 'Master key configuration not found in Firestore.';
        errEl.style.display = 'block';
      }
      return;
    }

    const data = docSnap.data();
    const currentMasterKey = data.masterKey;

    if (currentMasterKey && enteredKey === currentMasterKey.trim()) {
      if (gateEl) gateEl.style.display = 'none';
      if (appEl) appEl.style.display = 'flex';
      localStorage.setItem('netops_master_auth', 'true');
    } else {
      if (errEl) {
        errEl.textContent = 'Invalid Master Key! Access Denied.';
        errEl.style.display = 'block';
      }
    }
  } catch (err) {
    console.error("Error verifying master key from Firestore:", err);
    if (errEl) {
      errEl.textContent = 'Database connection error during verification.';
      errEl.style.display = 'block';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('netops_master_auth') === 'true') {
    const gateEl = document.getElementById('masterKeyGate');
    const appEl = document.getElementById('networkManagerApp');
    if (gateEl) gateEl.style.display = 'none';
    if (appEl) appEl.style.display = 'flex';
  }
});

// Real-time listener pulling directly from workstation_telemetry collection
function initLiveTelemetryListener() {
    window.db.collection("workstation_telemetry").onSnapshot((snapshot) => {
        const liveStations = [];
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            liveStations.push({
                id: data.workstationId || doc.id,
                ip: data.ip || data.clientIp || data.localIp || "192.168.1.105",
                learner: data.learner || data.learnerName || data.studentName || "Active Session Learner",
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
        populateTargetWorkstationSelect(workstationsData);
        updateGlobalLockToggleButtonState();
    }, (error) => {
        console.error("Error reading workstation telemetry:", error);
    });
}

function populateTargetWorkstationSelect(stations) {
    const select = document.getElementById("targetWorkstationSelect");
    if (!select) return;

    // Preserve currently selected value if possible
    const currentVal = select.value;
    
    select.innerHTML = '<option value="">-- Select Specific Learner --</option>';
    stations.forEach(pc => {
        const opt = document.createElement("option");
        opt.value = pc.id;
        opt.textContent = `${pc.id} - ${pc.learner} (${pc.ip})`;
        select.appendChild(opt);
    });

    if (currentVal) {
        select.value = currentVal;
    }
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
                <div class="thumbnail-container" style="width: 100%; height: 110px; background: #000; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative;" title="Click to view full image">
                    <img src="${pc.screenUrl}" alt="Live Screen Preview" style="width: 100%; height: 100%; object-fit: cover;" />
                    <div class="zoom-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s ease;">
                        <i class="fa-solid fa-expand" style="color: #fff; font-size: 1.2rem;"></i>
                    </div>
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
            <div class="ws-inline-actions" style="padding: 0 8px 8px 8px; display: flex; gap: 6px;">
                <button class="btn-assign-learner" data-id="${pc.id}" data-current="${pc.learner}" style="flex: 1; padding: 4px 8px; font-size: 0.75rem; background: #0ea5e9; border: none; color: #fff; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-user-pen"></i> Assign Name</button>
            </div>
        `;

        // Bind quick assign learner button inside card
        const assignBtn = card.querySelector(".btn-assign-learner");
        assignBtn.onclick = (e) => {
            e.stopPropagation();
            openAssignLearnerModal(pc.id, pc.learner);
        };

        // Add hover effect for zoom icon if thumbnail exists
        if (pc.screenUrl) {
            const thumbDiv = card.querySelector(".thumbnail-container");
            const overlay = card.querySelector(".zoom-overlay");
            thumbDiv.onmouseenter = () => overlay.style.opacity = "1";
            thumbDiv.onmouseleave = () => overlay.style.opacity = "0";

            // Click on thumbnail opens full image viewer directly
            thumbDiv.onclick = (e) => {
                e.stopPropagation(); // Prevent opening the node control modal
                openFullImageViewer(pc.screenUrl, `Live Feed: ${pc.id} - ${pc.learner}`);
            };
        }

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

    updateGlobalLockToggleButtonState();
    updateQuickToggleBtnState();
}

function areAllTerminalsLocked() {
    if (!workstationsData || workstationsData.length === 0) return false;
    return workstationsData.every(pc => pc.status === "locked");
}

function updateGlobalLockToggleButtonState() {
    const lockAllBtn = document.getElementById("lockAllBtn");
    if (!lockAllBtn) return;

    const allLocked = areAllTerminalsLocked();
    if (allLocked) {
        lockAllBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> Unlock All Screens`;
        lockAllBtn.style.background = "#10b981"; // Green color accent for unlocking action
    } else {
        lockAllBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Lock All Screens`;
        lockAllBtn.style.background = ""; // Reset or default theme background
    }
}

function updateQuickToggleBtnState() {
    const select = document.getElementById("targetWorkstationSelect");
    const quickToggleBtn = document.getElementById("quickToggleLockBtn");
    if (!select || !quickToggleBtn) return;

    const selectedId = select.value;
    if (!selectedId) {
        quickToggleBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Toggle Selected`;
        quickToggleBtn.style.background = "";
        return;
    }

    const targetPc = workstationsData.find(pc => pc.id === selectedId);
    if (targetPc && targetPc.status === "locked") {
        quickToggleBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> Unlock Selected`;
        quickToggleBtn.style.background = "#10b981";
    } else {
        quickToggleBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Lock Selected`;
        quickToggleBtn.style.background = "";
    }
}

function initEventListeners() {
    const searchInput = document.getElementById("nodeSearch");
    const statusFilter = document.getElementById("statusFilter");
    const targetWorkstationSelect = document.getElementById("targetWorkstationSelect");
    const quickToggleLockBtn = document.getElementById("quickToggleLockBtn");

    const filterData = () => {
        const query = searchInput ? searchInput.value.toLowerCase() : "";
        const filterVal = statusFilter ? statusFilter.value : "ALL";

        const filtered = workstationsData.filter(pc => {
            const matchesSearch = pc.id.toLowerCase().includes(query) || pc.learner.toLowerCase().includes(query) || pc.activity.toLowerCase().includes(query) || pc.ip.toLowerCase().includes(query);
            const matchesStatus = filterVal === "ALL" || pc.status.toUpperCase() === filterVal;
            return matchesSearch && matchesStatus;
        });

        renderWorkstations(filtered);
    };

    if (searchInput) searchInput.addEventListener("input", filterData);
    if (statusFilter) statusFilter.addEventListener("change", filterData);
    if (targetWorkstationSelect) {
        targetWorkstationSelect.addEventListener("change", () => {
            updateQuickToggleBtnState();
        });
    }

    // Add Assign Learner Header Action if container exists or create toolbar hook
    const dashboardHeaderActions = document.querySelector(".dashboard-actions") || document.querySelector("header") || document.body;
    let assignGlobalBtn = document.getElementById("assignGlobalLearnerBtn");
    if (!assignGlobalBtn && dashboardHeaderActions) {
        assignGlobalBtn = document.createElement("button");
        assignGlobalBtn.id = "assignGlobalLearnerBtn";
        assignGlobalBtn.innerHTML = `<i class="fa-solid fa-user-gear"></i> Manage Node Learners`;
        assignGlobalBtn.style.cssText = "padding: 8px 14px; background: #3b82f6; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem; margin-left: 10px; display: inline-flex; align-items: center; gap: 6px;";
        assignGlobalBtn.onclick = () => openBatchAssignModal();
        // Append near lock buttons if found
        const lockAllBtnRef = document.getElementById("lockAllBtn");
        if (lockAllBtnRef && lockAllBtnRef.parentNode) {
            lockAllBtnRef.parentNode.insertBefore(assignGlobalBtn, lockAllBtnRef.nextSibling);
        }
    }

    if (quickToggleLockBtn) {
        quickToggleLockBtn.onclick = async () => {
            if (!targetWorkstationSelect) return;
            const selectedId = targetWorkstationSelect.value;
            if (!selectedId) {
                showCustomAlert("Selection Required", "Please select a specific learner/workstation from the dropdown list first.");
                return;
            }

            const targetPc = workstationsData.find(pc => pc.id === selectedId);
            if (!targetPc || !window.db) return;

            const nextStatus = targetPc.status === "locked" ? "active" : "locked";
            try {
                await window.db.collection("workstation_telemetry").doc(targetPc.id).update({
                    status: nextStatus,
                    activity: nextStatus === "locked" ? "Screen Locked by Instructor" : "Resumed Session"
                });
                showCustomAlert("Status Updated", `Workstation ${targetPc.id} has been successfully ${nextStatus === "locked" ? "locked" : "unlocked"}.`);
            } catch (err) {
                console.error("Error toggling single workstation state:", err);
                showCustomAlert("Error", "Failed to update workstation status. Check console logs.");
            }
        };
    }

    const closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) closeModalBtn.onclick = closeModal;

    // Close modal when clicking outside content wrapper
    const modal = document.getElementById("nodeModal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // Fully Functional: Dynamic Global Lock / Unlock Action (Using Custom Dialog Modal)
    const lockAllBtn = document.getElementById("lockAllBtn");
    if (lockAllBtn) {
        lockAllBtn.onclick = () => {
            if (!window.db) return;
            const allLocked = areAllTerminalsLocked();
            const targetStatus = allLocked ? "active" : "locked";
            const actionTitle = allLocked ? "Unlock All Terminals" : "Lock All Terminals";
            const actionDesc = allLocked 
                ? "Are you sure you want to lift the lock on all connected workstation screens across the lab?"
                : "Are you sure you want to lock all connected workstation screens across the lab (including your test device)?";
            const successMsg = allLocked 
                ? "All workstation screens have been successfully unlocked." 
                : "All workstation screens have been successfully locked.";
            const errorMsg = allLocked ? "Failed to unlock all screens. Check console logs." : "Failed to lock all screens. Check console logs.";

            showCustomConfirm(
                actionTitle,
                actionDesc,
                async () => {
                    try {
                        const batch = window.db.batch();
                        workstationsData.forEach(pc => {
                            const ref = window.db.collection("workstation_telemetry").doc(pc.id);
                            batch.update(ref, { 
                                status: targetStatus, 
                                activity: targetStatus === "locked" ? "Screen Locked by Instructor" : "Resumed Session" 
                            });
                        });
                        await batch.commit();
                        showCustomAlert("Success", successMsg);
                    } catch (err) {
                        console.error("Error updating all screens state:", err);
                        showCustomAlert("Error", errorMsg);
                    }
                }
            );
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
        ${pc.screenUrl ? `<div class="modal-img-container" style="margin-bottom: 15px; border-radius: 8px; overflow: hidden; border: 1px solid #334155; cursor: pointer; position: relative;" title="Click to view full image"><img src="${pc.screenUrl}" alt="Enlarged Screen View" style="width: 100%; max-height: 250px; object-fit: cover; display: block;" /><div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;"><i class="fa-solid fa-expand"></i> Click to Expand</div></div>` : '<div style="padding: 20px; text-align: center; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 15px; color: var(--text-muted);">No live screen snapshot available yet</div>'}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <p style="margin: 0;"><strong>Assigned Learner:</strong> <span id="modalLearnerNameText">${pc.learner}</span></p>
            <button id="modalChangeLearnerBtn" style="padding: 4px 10px; background: #0ea5e9; border: none; color: #fff; border-radius: 4px; font-size: 0.75rem; cursor: pointer;"><i class="fa-solid fa-pen"></i> Edit Name</button>
        </div>
        <p><strong>IP Address:</strong> ${pc.ip}</p>
        <p><strong>Active Window Title:</strong> ${pc.activity}</p>
        <p><strong>Target URL:</strong> <a href="${pc.fullUrl}" target="_blank" style="color: var(--primary);">${pc.fullUrl}</a></p>
        <p><strong>Hardware Resource Utilization:</strong> CPU: ${pc.cpu}, Memory: ${pc.ram}</p>
        <p style="margin-top: 10px; color: var(--success);"><i class="fa-solid fa-shield-check"></i> Live Firestore Feed Synchronized</p>
    `;

    // Bind Edit Name inside Node Modal
    const editLearnerBtn = body.querySelector("#modalChangeLearnerBtn");
    if (editLearnerBtn) {
        editLearnerBtn.onclick = () => {
            openAssignLearnerModal(pc.id, pc.learner);
        };
    }

    // Bind full screen zoom if image exists inside modal body
    if (pc.screenUrl) {
        const modalImgWrapper = body.querySelector(".modal-img-container");
        if (modalImgWrapper) {
            modalImgWrapper.onclick = () => {
                openFullImageViewer(pc.screenUrl, `Live Feed: ${pc.id} - ${pc.learner}`);
            };
        }
    }

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

// Dedicated Modal to Assign/Update Learner Name on a Station
function openAssignLearnerModal(workstationId, currentLearnerName) {
    let assignModal = document.getElementById("samcamAssignLearnerModal");
    if (!assignModal) {
        assignModal = document.createElement("div");
        assignModal.id = "samcamAssignLearnerModal";
        assignModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 25000;";
        document.body.appendChild(assignModal);
    }

    assignModal.innerHTML = `
        <div style="background: #1e293b; padding: 25px; border-radius: 10px; width: 420px; border: 1px solid #334155; color: #f8fafc; box-shadow: 0 15px 30px rgba(0,0,0,0.6);">
            <h3 style="margin-top: 0; margin-bottom: 10px; color: #38bdf8; font-size: 1.1rem;"><i class="fa-solid fa-user-pen"></i> Assign Learner to Node</h3>
            <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 15px;">Set or update the student name seated at workstation <strong>${workstationId}</strong>.</p>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 6px;">Learner Full Name / ID:</label>
                <input type="text" id="newLearnerNameInput" value="${currentLearnerName === 'Active Session Learner' || currentLearnerName === 'Waiting for telemetry...' ? '' : currentLearnerName}" placeholder="e.g., Mugisha John (S.5 ICT)" style="width: 100%; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 10px; border-radius: 6px; font-size: 0.9rem;" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="cancelAssignBtn" style="padding: 8px 16px; background: #475569; border: none; color: #fff; border-radius: 6px; cursor: pointer;">Cancel</button>
                <button id="saveAssignBtn" style="padding: 8px 16px; background: #0ea5e9; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Save Assignment</button>
            </div>
        </div>
    `;

    assignModal.style.display = "flex";
    const nameInput = document.getElementById("newLearnerNameInput");
    nameInput.focus();
    nameInput.select();

    document.getElementById("cancelAssignBtn").onclick = () => {
        assignModal.style.display = "none";
    };

    document.getElementById("saveAssignBtn").onclick = async () => {
        const newName = nameInput.value.trim();
        if (!newName) {
            showCustomAlert("Validation Error", "Learner name cannot be empty.");
            return;
        }

        if (!window.db) {
            showCustomAlert("Error", "Firestore database instance not found.");
            return;
        }

        try {
            await window.db.collection("workstation_telemetry").doc(workstationId).update({
                learner: newName
            });
            assignModal.style.display = "none";
            showCustomAlert("Success", `Assigned "${newName}" to workstation ${workstationId} successfully.`);
        } catch (err) {
            console.error("Error updating assigned learner:", err);
            showCustomAlert("Error", "Failed to save learner name. Check console logs.");
        }
    };

    assignModal.onclick = (e) => {
        if (e.target === assignModal) {
            assignModal.style.display = "none";
        }
    };
}

// Batch Manage / View All Connected Nodes Modal
function openBatchAssignModal() {
    let batchModal = document.getElementById("samcamBatchAssignModal");
    if (!batchModal) {
        batchModal = document.createElement("div");
        batchModal.id = "samcamBatchAssignModal";
        batchModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 25000; padding: 20px;";
        document.body.appendChild(batchModal);
    }

    let rowsHtml = workstationsData.map(pc => `
        <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 10px; font-weight: 600; color: #38bdf8;">${pc.id}</td>
            <td style="padding: 10px; color: #94a3b8; font-size: 0.85rem;">${pc.ip}</td>
            <td style="padding: 10px;">
                <input type="text" data-station-id="${pc.id}" value="${pc.learner === 'Active Session Learner' || pc.learner === 'Waiting for telemetry...' ? '' : pc.learner}" placeholder="Enter learner name..." style="width: 100%; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 0.85rem;" />
            </td>
        </tr>
    `).join('');

    batchModal.innerHTML = `
        <div style="background: #1e293b; padding: 25px; border-radius: 10px; width: 650px; max-height: 85vh; display: flex; flex-direction: column; border: 1px solid #334155; color: #f8fafc; box-shadow: 0 15px 35px rgba(0,0,0,0.7);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; color: #38bdf8; font-size: 1.1rem;"><i class="fa-solid fa-network-wired"></i> Connected Nodes & Seating Registry</h3>
                <button id="closeBatchModal" style="background: #ef4444; border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 15px;">Review all currently active network nodes and assign learners across the computer lab in bulk.</p>
            
            <div style="overflow-y: auto; max-height: 50vh; border: 1px solid #334155; border-radius: 6px; margin-bottom: 15px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background: #0f172a; color: #cbd5e1; font-size: 0.8rem; border-bottom: 1px solid #334155;">
                            <th style="padding: 10px;">Workstation ID</th>
                            <th style="padding: 10px;">IP Address</th>
                            <th style="padding: 10px;">Assigned Learner Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="cancelBatchBtn" style="padding: 8px 16px; background: #475569; border: none; color: #fff; border-radius: 6px; cursor: pointer;">Close</button>
                <button id="saveBatchBtn" style="padding: 8px 20px; background: #10b981; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Save All Changes</button>
            </div>
        </div>
    `;

    batchModal.style.display = "flex";

    const closeModalAction = () => { batchModal.style.display = "none"; };
    document.getElementById("closeBatchModal").onclick = closeModalAction;
    document.getElementById("cancelBatchBtn").onclick = closeModalAction;

    document.getElementById("saveBatchBtn").onclick = async () => {
        if (!window.db) return;
        const inputs = batchModal.querySelectorAll("input[data-station-id]");
        
        try {
            const batch = window.db.batch();
            inputs.forEach(input => {
                const stationId = input.getAttribute("data-station-id");
                const nameVal = input.value.trim() || "Active Session Learner";
                const ref = window.db.collection("workstation_telemetry").doc(stationId);
                batch.update(ref, { learner: nameVal });
            });

            await batch.commit();
            batchModal.style.display = "none";
            showCustomAlert("Registry Updated", "All workstation learner assignments have been updated successfully.");
        } catch (err) {
            console.error("Batch assignment failed:", err);
            showCustomAlert("Error", "Failed to update node registry. Check console logs.");
        }
    };

    batchModal.onclick = (e) => {
        if (e.target === batchModal) batchModal.style.display = "none";
    };
}

// Full Image Lightbox Modal Viewer
function openFullImageViewer(imageUrl, captionText) {
    let viewerModal = document.getElementById("samcamFullImageViewer");
    if (!viewerModal) {
        viewerModal = document.createElement("div");
        viewerModal.id = "samcamFullImageViewer";
        viewerModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 20000; padding: 20px;";
        document.body.appendChild(viewerModal);
    }

    viewerModal.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 85vh; display: flex; flex-direction: column; align-items: center;">
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 10px; color: #f8fafc;">
                <span style="font-weight: 600; font-size: 1rem;"><i class="fa-solid fa-image"></i> ${captionText || "Full Screen Inspection"}</span>
                <button id="closeFullImage" style="background: #ef4444; border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.7); max-width: 100%; max-height: 75vh;">
                <img src="${imageUrl}" alt="Expanded Live Snapshot" style="width: 100%; height: auto; max-height: 75vh; object-fit: contain; display: block;" />
            </div>
        </div>
    `;

    viewerModal.style.display = "flex";

    // Close options
    document.getElementById("closeFullImage").onclick = () => {
        viewerModal.style.display = "none";
    };

    viewerModal.onclick = (e) => {
        if (e.target === viewerModal) {
            viewerModal.style.display = "none";
        }
    };
}

function closeModal() {
    const modal = document.getElementById("nodeModal");
    if (modal) modal.style.display = "none";
}

// Custom UI Modal Replacement for standard browser alert()
function showCustomAlert(titleText, messageText) {
    let alertModal = document.getElementById("samcamCustomAlert");
    if (!alertModal) {
        alertModal = document.createElement("div");
        alertModal.id = "samcamCustomAlert";
        alertModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;";
        document.body.appendChild(alertModal);
    }
    alertModal.innerHTML = `
        <div style="background: #1e293b; padding: 25px; border-radius: 10px; width: 400px; border: 1px solid #334155; color: #f8fafc; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h3 id="alertTitle" style="margin-top: 0; margin-bottom: 12px; color: #38bdf8; font-size: 1.1rem;"><i class="fa-solid fa-circle-info"></i> ${titleText}</h3>
            <p id="alertMessage" style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 20px; line-height: 1.4;">${messageText}</p>
            <div style="display: flex; justify-content: flex-end;">
                <button id="alertOkBtn" style="padding: 8px 18px; background: #0ea5e9; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">OK</button>
            </div>
        </div>
    `;
    alertModal.style.display = "flex";
    document.getElementById("alertOkBtn").onclick = () => {
        alertModal.style.display = "none";
    };
}

// Custom UI Modal Replacement for standard browser confirm()
function showCustomConfirm(titleText, messageText, onConfirmCallback) {
    let confirmModal = document.getElementById("samcamCustomConfirm");
    if (!confirmModal) {
        confirmModal = document.createElement("div");
        confirmModal.id = "samcamCustomConfirm";
        confirmModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;";
        document.body.appendChild(confirmModal);
    }
    confirmModal.innerHTML = `
        <div style="background: #1e293b; padding: 25px; border-radius: 10px; width: 400px; border: 1px solid #334155; color: #f8fafc; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="margin-top: 0; margin-bottom: 12px; color: #f59e0b; font-size: 1.1rem;"><i class="fa-solid fa-triangle-exclamation"></i> ${titleText}</h3>
            <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 20px; line-height: 1.4;">${messageText}</p>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="confirmCancelBtn" style="padding: 8px 16px; background: #475569; border: none; color: #fff; border-radius: 6px; cursor: pointer;">Cancel</button>
                <button id="confirmOkBtn" style="padding: 8px 16px; background: #ef4444; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Proceed</button>
            </div>
        </div>
    `;
    confirmModal.style.display = "flex";

    document.getElementById("confirmCancelBtn").onclick = () => {
        confirmModal.style.display = "none";
    };

    document.getElementById("confirmOkBtn").onclick = () => {
        confirmModal.style.display = "none";
        if (typeof onConfirmCallback === "function") {
            onConfirmCallback();
        }
    };
}

/* ==========================================================================
   BROADCAST MODAL & PUSH PROMPT CONTROLLER (FIXED)
   ========================================================================== */
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
                showCustomAlert("Validation Error", "Please enter a message to broadcast.");
                return;
            }
            
            if (window.db) {
                try {
                    // Fetch live workstation documents directly from Firestore to ensure we target active machines
                    const snapshot = await window.db.collection("workstation_telemetry").get();
                    if (snapshot.empty) {
                        showCustomAlert("Notice", "No active workstations found in database.");
                        return;
                    }

                    const batch = window.db.batch();
                    const timestamp = new Date().toISOString();

                    snapshot.forEach((doc) => {
                        const ref = window.db.collection("workstation_telemetry").doc(doc.id);
                        // Structure matches what the Chrome extension background script checks for
                        batch.update(ref, {
                            pushedPrompt: {
                                type: "broadcast",
                                content: msg,
                                timestamp: timestamp
                            }
                        });
                    });

                    await batch.commit();
                    showCustomAlert("Broadcast Sent", "Broadcast message sent successfully to all workstations!");
                    bModal.style.display = "none";
                    document.getElementById("broadcastMessage").value = "";
                } catch (err) {
                    console.error("Broadcast failed:", err);
                    showCustomAlert("Error", "Error sending broadcast: " + err.message);
                }
            } else {
                showCustomAlert("Error", "Firestore database instance 'db' not found.");
            }
        };
    }
    bModal.style.display = "flex";
}

const pushBtnElem = document.getElementById('pushPromptBtn');
if (pushBtnElem) {
    pushBtnElem.addEventListener('click', () => {
        openBroadcastModal();
    });
}

async function broadcastPromptToClass(type, content) {
    if (!window.db) {
        console.error("Firestore database 'db' not initialized.");
        return;
    }

    const timestamp = new Date().toISOString();

    try {
        const snapshot = await window.db.collection("workstation_telemetry").get();
        if (snapshot.empty) {
            console.log("No workstations found in database to broadcast to.");
            return;
        }

        const batch = window.db.batch();
        snapshot.forEach((doc) => {
            const ref = window.db.collection("workstation_telemetry").doc(doc.id);
            batch.update(ref, {
                pushedPrompt: {
                    type: type,
                    content: content,
                    timestamp: timestamp
                }
            });
        });

        await batch.commit();
        alert("Prompt successfully pushed to all class terminals!");
    } catch (err) {
        console.error("Error pushing prompt to class:", err);
        alert("Failed to send broadcast. Check console for details.");
    }
}
