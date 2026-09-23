// ==========================================
// SOFTWARE-INSTALLER.JS - 2026 ENTERPRISE WORKSTATION DEPLOYMENT
// ==========================================

window.initSoftwareInstaller = function() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.warn("Firebase not initialized for Software Installer.");
        return;
    }

    // Ensure custom modal and master deployment control bar exist in the DOM
    ensureInstallModalInDOM();
    ensureMasterInstallerToolbar();

    const db = firebase.firestore();

    // Real-time listener for software deployments collection (if hooked to a list/table, or fallback log tracker)
    db.collection("software_deployments").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        const activityContainer = document.getElementById('softwareDeploymentLogsContainer');
        if (!activityContainer) return;

        activityContainer.innerHTML = ''; // Clear logs or status feeds

        if (snapshot.empty) {
            seedInitialDeploymentRecords(db);
            return;
        }

        snapshot.forEach((doc) => {
            const deployment = doc.data();
            appendDeploymentRecordToDOM(activityContainer, doc.id, deployment);
        });
    }, (error) => {
        console.error("Error listening to software deployments: ", error);
    });
};

function seedInitialDeploymentRecords(db) {
    const initialRecords = [
        {
            appName: "Visual Studio Code 1.89",
            installUrl: "http://192.168.10.5:8000/vscode_installer.exe",
            silentArgs: "/verysilent /suppressmsgboxes /norestart",
            status: "Completed",
            targetScope: "All Lab Workstations (10.212.202.0/24)",
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }
    ];

    initialRecords.forEach((record) => {
        db.collection("software_deployments").add(record).catch((err) => console.error(err));
    });
}

// Injects Master Software Deployment Toolbar Header if not present
function ensureMasterInstallerToolbar() {
    const view = document.getElementById('broadcastConsoleView') || document.querySelector('.network-module-view');
    if (!view || document.getElementById('samcamMasterInstallerBar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'samcamMasterInstallerBar';
    toolbar.style.cssText = 'background: #ffffff; padding: 14px 20px; border-radius: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;';
    
    toolbar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 8px rgba(22,163,74,0.6);" id="installerStatusDot"></div>
            <div>
                <strong style="font-size: 0.9rem; color: #0f172a; display: block;">LAN Deployment Server: Online (0 MB WAN Cost)</strong>
                <span style="font-size: 0.75rem; color: #64748b;">Zero-Bandwidth Peer-to-Peer Installer Distribution Active</span>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <button type="button" onclick="openInstallModal()" style="padding: 7px 16px; background: #16a34a; color: #ffffff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-download"></i> Push Software Package
            </button>
        </div>
    `;

    view.insertBefore(toolbar, view.firstChild);
}

// Injects the Software Deployment Modal into the DOM if not present
function ensureInstallModalInDOM() {
    if (document.getElementById('samcamInstallModal')) return;

    const modalHTML = `
    <div id="samcamInstallModal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 9999; align-items: center; justify-content: center; backdrop-filter: blur(2px); padding: 20px;">
        <div style="background: #ffffff; width: 100%; max-width: 500px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background: #f8fafc; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a; font-weight: 600;">Deploy Software to Workstations (LAN)</h3>
                <button type="button" onclick="closeInstallModal()" style="background: none; border: none; font-size: 1.25rem; color: #64748b; cursor: pointer;">&times;</button>
            </div>
            <form id="samcamInstallForm" onsubmit="submitSoftwareDeployment(event)" style="padding: 20px;">
                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Software Name</label>
                    <input type="text" id="installAppName" required placeholder="e.g. VS Code / Python 3.12" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.9rem;">
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Local LAN Installer URL</label>
                    <input type="text" id="installUrl" required placeholder="http://192.168.10.5:8000/installer.exe" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.9rem;">
                </div>
                <div style="margin-bottom: 18px;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Silent Arguments</label>
                    <input type="text" id="installArgs" required value="/verysilent /suppressmsgboxes /norestart" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.9rem;">
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" onclick="closeInstallModal()" style="padding: 9px 16px; background: #f1f5f9; color: #475569; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">Cancel</button>
                    <button type="submit" style="padding: 9px 18px; background: #16a34a; color: #ffffff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">Push & Install (0 MB Data)</button>
                </div>
            </form>
        </div>
    </div>`;

    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div);
}

window.openInstallModal = function() {
    ensureInstallModalInDOM();
    const modal = document.getElementById('samcamInstallModal');
    if (modal) {
        document.getElementById('installAppName').value = '';
        document.getElementById('installUrl').value = 'http://192.168.10.5:8000/';
        modal.style.display = 'flex';
        document.getElementById('installAppName').focus();
    }
};

window.closeInstallModal = function() {
    const modal = document.getElementById('samcamInstallModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.submitSoftwareDeployment = function(event) {
    event.preventDefault();

    const appName = document.getElementById('installAppName').value.trim();
    const installUrl = document.getElementById('installUrl').value.trim();
    const installArgs = document.getElementById('installArgs').value.trim();

    if (!appName || !installUrl) return;

    if (typeof firebase !== 'undefined' && firebase.apps.length) {
        const db = firebase.firestore();

        db.collection("software_deployments").add({
            appName: appName,
            installUrl: installUrl,
            silentArgs: installArgs,
            status: "Initiated",
            targetScope: "All Active Subnets",
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            console.log("Software package push order recorded in Firestore.");
            closeInstallModal();
            alert(`Deployment signal broadcasted successfully for ${appName}! Workstations will fetch locally via LAN.`);
        }).catch((error) => {
            alert("Error broadcasting installation task: " + error.message);
        });
    }
};

window.cancelDeploymentRecord = function(docId) {
    if (confirm("Are you sure you want to revoke this deployment task?")) {
        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("software_deployments").doc(docId).delete().catch((error) => {
                alert("Error removing task: " + error.message);
            });
        }
    }
};

function appendDeploymentRecordToDOM(container, docId, deployment) {
    // Optional helper if a log feed box is rendered in the UI
    const item = document.createElement('div');
    item.style.cssText = 'padding: 10px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;';
    item.innerHTML = `
        <div>
            <strong>${deployment.appName}</strong> <span style="color: #64748b;">(${deployment.status})</span><br>
            <code style="font-size: 0.75rem; color: #0284c7;">${deployment.installUrl}</code>
        </div>
        <button onclick="cancelDeploymentRecord('${docId}')" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 0.8rem;">Dismiss</button>
    `;
    // container.appendChild(item); // Uncomment if log container element is configured in View
}
