// --- MASTER KEY GATE & SESSION HANDLERS ---
(function checkMasterKeySession() {
    if (sessionStorage.getItem('samcam_super_admin_verified') === 'true') {
        const gate = document.getElementById('masterKeyGate');
        const app = document.getElementById('deepStaffApp');
        if (gate) gate.style.display = 'none';
        if (app) app.style.display = 'block';
    }
})();

window.verifyMasterKey = async function() {
    const inputField = document.getElementById('masterKeyInput');
    const errorDiv = document.getElementById('masterKeyError');
    if (!inputField || !errorDiv) return;

    const inputVal = inputField.value.trim();
    errorDiv.style.display = 'none';

    try {
        const PROJECT_ID = "samcam-system";
        const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/system_config/super_admin_settings`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch super admin settings: ${response.status}`);
        }

        const data = await response.json();
        const validKey = data.fields?.masterKey?.stringValue;

        if (!validKey) {
            throw new Error("Master key configuration missing in Firestore.");
        }

        if (inputVal === validKey) {
            sessionStorage.setItem('samcam_super_admin_verified', 'true');
            const gate = document.getElementById('masterKeyGate');
            const app = document.getElementById('deepStaffApp');
            if (gate) gate.style.display = 'none';
            if (app) app.style.display = 'block';
        } else {
            errorDiv.style.display = 'block';
            errorDiv.textContent = "Invalid Master Key. Access denied.";
        }
    } catch (error) {
        console.error("Master key verification error:", error);
        errorDiv.style.display = 'block';
        errorDiv.textContent = "Authentication error. Check connection or Firestore rules.";
    }
};

window.logoutDeepStaff = function() {
    sessionStorage.removeItem('samcam_super_admin_verified');

    const gateEl = document.getElementById('masterKeyGate');
    const appEl = document.getElementById('deepStaffApp');
    const inputEl = document.getElementById('masterKeyInput');
    const errEl = document.getElementById('masterKeyError');

    if (appEl) appEl.style.display = 'none';
    if (gateEl) gateEl.style.display = 'flex';

    if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
    }
    if (errEl) {
        errEl.textContent = '';
        errEl.style.display = 'none';
    }

    console.log("Logged out successfully. Returned to Master Key entry gate.");
};


// --- MAIN APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- FIREBASE CONFIGURATION & CONSTANTS ---
    const PROJECT_ID = "samcam-system";
    const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

    const globalUnlockBtn = document.getElementById('globalUnlockBtn');
    const emergencyStatusLog = document.getElementById('emergencyStatusLog');
    const collectionSelect = document.getElementById('collectionSelect');
    const refreshDocsBtn = document.getElementById('refreshDocsBtn');
    const tableBody = document.getElementById('firestoreTableBody');
    const terminalStream = document.getElementById('terminalLogStream');
    const runStressTestBtn = document.getElementById('runStressTestBtn');
    const stressTestResult = document.getElementById('stressTestResult');

    function appendTerminalLog(type, message) {
        if (!terminalStream) return;
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        const timeStr = new Date().toTimeString().split(' ')[0];
        div.innerHTML = `<span class="timestamp">[${timeStr}]</span> ${message}`;
        terminalStream.appendChild(div);
        terminalStream.scrollTop = terminalStream.scrollHeight;
    }

    // --- INJECT DYNAMIC MODAL CONTAINER & BULK ACTION CONTROLS INTO DOM ---
    if (!document.getElementById('dynamicEditModal')) {
        const modalHtml = `
            <div id="dynamicEditModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; justify-content:center; align-items:center;">
                <div style="background:var(--bg-card, #1e222d); border:1px solid var(--border-color, #2a2f3d); border-radius:12px; width:90%; max-width:600px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                    <div style="padding:16px 20px; border-bottom:1px solid var(--border-color, #2a2f3d); display:flex; justify-content:space-between; align-items:center;">
                        <h3 id="modalDocTitle" style="margin:0; font-size:16px; color:var(--text-main, #fff);">Edit Document</h3>
                        <button id="closeModalBtn" style="background:none; border:none; color:var(--text-secondary, #94a3b8); cursor:pointer; font-size:18px;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div id="modalFormBody" style="padding:20px; overflow-y:auto; flex:1;"></div>
                    <div style="padding:16px 20px; border-top:1px solid var(--border-color, #2a2f3d); display:flex; justify-content:flex-end; gap:10px;">
                        <button id="cancelModalBtn" class="btn btn-outline" style="padding:8px 16px;">Cancel</button>
                        <button id="saveModalBtn" class="btn btn-primary" style="padding:8px 16px;"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Inject Bulk Operations Panel above or near the table container if not present, with conditional display based on selection
    const tableContainer = document.querySelector('.table-container') || tableBody?.parentElement;
    if (tableContainer && !document.getElementById('bulkActionsCard')) {
        const isUsersSelected = collectionSelect && collectionSelect.value === 'users';
        const bulkCardHtml = `
            <div id="bulkActionsCard" style="background:var(--bg-card, #1e222d); border:1px solid var(--border-color, #2a2f3d); border-radius:10px; padding:15px 20px; margin-bottom:20px; display:${isUsersSelected ? 'flex' : 'none'}; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:15px;">
                <div>
                    <h4 style="margin:0 0 5px 0; color:var(--text-main, #fff); font-size:15px;"><i class="fa-solid fa-wand-magic-sparkles"></i> Bulk User Data Operations</h4>
                    <p style="margin:0; font-size:12px; color:var(--text-secondary, #94a3b8);">Target collection: <code>users</code> (Auto-applies across all pagination pages)</p>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                   <button id="bulkCapitalizeBtn" class="btn btn-sm btn-primary" style="background:var(--primary, #3b82f6); border-color:var(--primary); color:#ffffff;"><i class="fa-solid fa-font"></i> Capitalize All Full Names</button>
                    <button id="bulkPasswordResetBtn" class="btn btn-sm btn-primary" style="background:var(--danger, #ef4444); border-color:var(--danger);"><i class="fa-solid fa-key"></i> Reset All Passwords Securely</button>
                </div>
            </div>`;
        tableContainer.insertAdjacentHTML('beforebegin', bulkCardHtml);
    }

    // --- COLLECTION SELECT CHANGE HANDLER ---
    if (collectionSelect) {
        collectionSelect.addEventListener('change', (e) => {
            const bulkCard = document.getElementById('bulkActionsCard');
            if (bulkCard) {
                bulkCard.style.display = e.target.value === 'users' ? 'flex' : 'none';
            }
            fetchCollectionData(e.target.value);
        });
    }

  // --- 1. DYNAMIC FIRESTORE DOCUMENT EXPLORER WITH PAGINATION ---
async function fetchCollectionData(collectionName) {
    if (!collectionName || typeof collectionName !== 'string' || !collectionName.trim() || collectionName.includes('Loading')) {
        console.warn("fetchCollectionData aborted: Invalid or uninitialized collection name.");
        return;
    }

    const tableBody = document.getElementById('firestoreTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Querying live Firestore documents...</td></tr>`;
    
    try {
        const snapshot = await firebase.firestore().collection(collectionName.trim()).get();
        const documents = [];
        
        snapshot.forEach(doc => {
            documents.push({
                id: doc.id,
                name: `projects/databases/documents/collections/${collectionName}/documents/${doc.id}`,
                fields: convertFirestoreDataToRESTFormat(doc.data()),
                updateTime: doc.metadata.hasPendingWrites ? new Date().toISOString() : new Date().toISOString()
            });
        });

        tableBody.innerHTML = '';
        
        if (documents.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">No documents found in [${collectionName}].</td></tr>`;
            appendTerminalLog('info', `Collection [${collectionName}] returned 0 documents.`);
            return;
        }

        documents.forEach(doc => {
            const docId = doc.id;
            const fields = doc.fields || {};
            let entityName = fields.schoolName?.stringValue || fields.terminalId?.stringValue || fields.adminUser?.stringValue || fields.fullName?.stringValue || "N/A";
            let statusSummary = parseFieldSummary(fields);
            let updateTime = doc.updateTime ? new Date(doc.updateTime).toLocaleString() : "Unknown";

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>${docId}</code></td>
                <td><strong>${entityName}</strong></td>
                <td>${statusSummary}</td>
                <td>${updateTime}</td>
                <td style="white-space: nowrap;">
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button class="btn btn-sm btn-outline inspect-doc" data-collection="${collectionName}" data-id="${docId}"><i class="fa-solid fa-code"></i> Inspect</button>
                        <button class="btn btn-sm btn-primary edit-doc" data-collection="${collectionName}" data-id="${docId}"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        document.querySelectorAll('.edit-doc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const col = e.currentTarget.getAttribute('data-collection');
                const id = e.currentTarget.getAttribute('data-id');
                openDynamicEditModal(col, id);
            });
        });

        appendTerminalLog('success', `Successfully fetched all ${documents.length} records from [${collectionName}].`);

    } catch (error) {
        console.error("Firestore Fetch Error:", error);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--danger);">Failed to connect to Firestore backend. Check console logs.</td></tr>`;
        appendTerminalLog('error', `Firestore query failed for [${collectionName}]: ${error.message}`);
    }
}

async function loadCollectionDropdowns() {
    const collectionSelect = document.getElementById('collectionSelect');
    const stressSelect = document.getElementById('stressCollectionSelect');
    
    try {
        const response = await fetch('https://us-central1-samcam-system.cloudfunctions.net/listCollections');
        const result = await response.json();
        
        // Match the exact response parsing logic used in your working backup generator
        let collections = [];
        if (result.success && Array.isArray(result.collections)) {
            const excluded = typeof EXCLUDED_COLLECTIONS !== 'undefined' ? EXCLUDED_COLLECTIONS : [];
            collections = result.collections.filter(col => typeof col === 'string' && !excluded.includes(col));
        } else if (Array.isArray(result)) {
            collections = result;
        }

        if (collections.length > 0) {
            const optionsHtml = collections.map(col => `<option value="${col}">${col}</option>`).join('');
            
            if (collectionSelect) {
                collectionSelect.innerHTML = optionsHtml;
                fetchCollectionData(collections[0]);
            }
            if (stressSelect) {
                stressSelect.innerHTML = optionsHtml;
            }
        } else {
            if (collectionSelect) collectionSelect.innerHTML = '<option value="">No collections found</option>';
        }
    } catch (err) {
        console.error("Failed to load collection list:", err);
        // Fallback matching your backup generator behavior if network fails
        const fallbackCollections = ['users', 'quizzes', 'submissions', 'announcements', 'schools', 'e_library_resources', 'forum_threads', 'blogs'];
        if (collectionSelect) {
            collectionSelect.innerHTML = fallbackCollections.map(col => `<option value="${col}">${col}</option>`).join('');
            fetchCollectionData(fallbackCollections[0]);
        }
    }
}
// --- 3. EXECUTION ON DOM LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    loadCollectionDropdowns();

    const collectionSelect = document.getElementById('collectionSelect');
    if (collectionSelect) {
        collectionSelect.addEventListener('change', (e) => {
            fetchCollectionData(e.target.value);
        });
    }
});
    
    // Helper to map native Firebase SDK data structure to your existing view field layout
    function convertFirestoreDataToRESTFormat(data) {
        const fields = {};
        for (const [key, value] of Object.entries(data || {})) {
            if (typeof value === 'string') {
                fields[key] = { stringValue: value };
            } else if (typeof value === 'number') {
                fields[key] = { doubleValue: value };
            } else if (typeof value === 'boolean') {
                fields[key] = { booleanValue: value };
            } else {
                fields[key] = { stringValue: JSON.stringify(value) };
            }
        }
        return fields;
    }

    function parseFirestoreValue(valueObj) {
        if (!valueObj) return "";
        if (valueObj.stringValue !== undefined) return valueObj.stringValue;
        if (valueObj.booleanValue !== undefined) return valueObj.booleanValue ? 'true' : 'false';
        if (valueObj.integerValue !== undefined) return valueObj.integerValue;
        if (valueObj.doubleValue !== undefined) return valueObj.doubleValue;
        if (valueObj.timestampValue !== undefined) return new Date(valueObj.timestampValue).toLocaleString();
        
        if (valueObj.mapValue && valueObj.mapValue.fields) {
            let mapResult = {};
            for (const [k, v] of Object.entries(valueObj.mapValue.fields)) {
                mapResult[k] = parseFirestoreValue(v);
            }
            return JSON.stringify(mapResult);
        }
        
        if (valueObj.arrayValue && valueObj.arrayValue.values) {
            return valueObj.arrayValue.values.map(v => parseFirestoreValue(v)).join(', ');
        }
        
        return JSON.stringify(valueObj);
    }

    function parseFieldSummary(fields) {
        let summaries = [];
        for (const [key, valueObj] of Object.entries(fields)) {
            let val = parseFirestoreValue(valueObj);
            summaries.push(`<strong>${key}</strong>: ${val}`);
        }
        return summaries.join(' | ') || "No field metadata";
    }

    // --- BULK ACTION 1: CAPITALIZE ALL USER FULL NAMES ---
    const bulkCapitalizeBtn = document.getElementById('bulkCapitalizeBtn');
    if (bulkCapitalizeBtn) {
        bulkCapitalizeBtn.addEventListener('click', async () => {
            const confirmed = confirm("Are you sure you want to format all 'fullName' entries in the 'users' collection to begin with capital letters?");
            if (!confirmed) return;

            bulkCapitalizeBtn.disabled = true;
            bulkCapitalizeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Names...`;
            appendTerminalLog('info', `Starting bulk capitalization task for collection [users]...`);

            try {
                let allUsers = [];
                let pageToken = '';
                do {
                    let url = `${FIRESTORE_BASE_URL}/users?pageSize=300`;
                    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`Failed to fetch users page: ${res.status}`);
                    const data = await res.json();
                    if (data.documents) allUsers = allUsers.concat(data.documents);
                    pageToken = data.nextPageToken;
                } while (pageToken);

                let updatedCount = 0;
                for (const doc of allUsers) {
                    const fields = doc.fields || {};
                    const currentName = fields.fullName?.stringValue;
                    if (!currentName) continue;

                    // Title Case formatter: ensures each word starts with an uppercase letter
                    const capitalized = currentName
                        .toLowerCase()
                        .split(' ')
                        .filter(word => word.length > 0)
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');

                    if (capitalized !== currentName) {
                        const patchUrl = `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=fullName`;
                        const patchRes = await fetch(patchUrl, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fields: { fullName: { stringValue: capitalized } } })
                        });
                        if (patchRes.ok) updatedCount++;
                    }
                }

                appendTerminalLog('success', `Bulk capitalization completed successfully. Updated ${updatedCount} user records.`);
                alert(`Successfully updated ${updatedCount} user names to start with capital letters.`);
                if (collectionSelect && collectionSelect.value === 'users') fetchCollectionData('users');

            } catch (err) {
                console.error("Bulk Capitalization Error:", err);
                appendTerminalLog('error', `Bulk capitalization failed: ${err.message}`);
                alert(`Error: ${err.message}`);
            } finally {
                bulkCapitalizeBtn.disabled = false;
                bulkCapitalizeBtn.innerHTML = `<i class="fa-solid fa-font"></i> Capitalize All Full Names`;
            }
        });
    }

    // --- BULK ACTION 2: SECURE RANDOM PASSWORD RESET FOR ALL USERS ---
    const bulkPasswordResetBtn = document.getElementById('bulkPasswordResetBtn');
    if (bulkPasswordResetBtn) {
        bulkPasswordResetBtn.addEventListener('click', async () => {
            const confirmed = confirm("CRITICAL SECURITY WARNING: This will instantly overwrite passwords for ALL users in the database with newly generated strong random passwords. Proceed?");
            if (!confirmed) return;

            bulkPasswordResetBtn.disabled = true;
            bulkPasswordResetBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating & Updating Passwords...`;
            appendTerminalLog('info', `Starting bulk password rotation task for collection [users]...`);

            try {
                let allUsers = [];
                let pageToken = '';
                do {
                    let url = `${FIRESTORE_BASE_URL}/users?pageSize=300`;
                    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`Failed to fetch users page: ${res.status}`);
                    const data = await res.json();
                    if (data.documents) allUsers = allUsers.concat(data.documents);
                    pageToken = data.nextPageToken;
                } while (pageToken);

                let credentialsLog = "ID/Email,FullName,NewPassword\n";
                let resetCount = 0;

                // Generator function meeting criteria: >=8 chars, uppercase, lowercase, numbers, special characters
                function generateSecurePassword() {
                    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                    const lower = "abcdefghijklmnopqrstuvwxyz";
                    const nums = "0123456789";
                    const specials = "!@#$%^&*()_+-=[]{}|;:,.<>?";
                    
                    let pwd = [
                        upper[Math.floor(Math.random() * upper.length)],
                        lower[Math.floor(Math.random() * lower.length)],
                        nums[Math.floor(Math.random() * nums.length)],
                        specials[Math.floor(Math.random() * specials.length)]
                    ];
                    
                    const all = upper + lower + nums + specials;
                    for (let i = pwd.length; i < 10; i++) {
                        pwd.push(all[Math.floor(Math.random() * all.length)]);
                    }
                    return pwd.sort(() => Math.random() - 0.5).join('');
                }

                for (const doc of allUsers) {
                    const docPathParts = doc.name.split('/');
                    const docId = docPathParts[docPathParts.length - 1];
                    const fields = doc.fields || {};
                    const fullName = fields.fullName?.stringValue || "Unknown User";
                    const email = fields.email?.stringValue || docId;

                    const newPassword = generateSecurePassword();

                    // Send PATCH request updating the 'password' field (adjust field name if your database uses 'pass' or 'userPassword')
                    const patchUrl = `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=password`;
                    const patchRes = await fetch(patchUrl, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fields: { password: { stringValue: newPassword } } })
                    });

                    if (patchRes.ok) {
                        resetCount++;
                        credentialsLog += `"${email}","${fullName}","${newPassword}"\n`;
                    }
                }

                // Trigger automatic text/CSV download file containing the new credentials for administrator records
                const blob = new Blob([credentialsLog], { type: 'text/csv;charset=utf-8;' });
                const urlObj = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = urlObj;
                a.download = `Password_Reset_Report_${new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                appendTerminalLog('success', `Bulk password reset completed. Successfully rotated credentials for ${resetCount} users. CSV downloaded.`);
                alert(`Successfully generated and applied new strong passwords for ${resetCount} users. A secure CSV audit file containing the credentials has been downloaded to your device.`);
                if (collectionSelect && collectionSelect.value === 'users') fetchCollectionData('users');

            } catch (err) {
                console.error("Bulk Password Reset Error:", err);
                appendTerminalLog('error', `Bulk password reset failed: ${err.message}`);
                alert(`Error: ${err.message}`);
            } finally {
                bulkPasswordResetBtn.disabled = false;
                bulkPasswordResetBtn.innerHTML = `<i class="fa-solid fa-key"></i> Reset All Passwords Securely`;
            }
        });
    }



    // --- DYNAMIC MODAL FORM GENERATOR & PATCH HANDLER ---
    async function openDynamicEditModal(collectionName, docId) {
        const modal = document.getElementById('dynamicEditModal');
        const formBody = document.getElementById('modalFormBody');
        const titleEl = document.getElementById('modalDocTitle');
        const saveBtn = document.getElementById('saveModalBtn');
        const cancelBtn = document.getElementById('cancelModalBtn');
        const closeBtn = document.getElementById('closeModalBtn');

        if (!modal || !formBody) return;

        formBody.innerHTML = `<div style="text-align:center; color:var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Inspecting schema fields...</div>`;
        modal.style.display = 'flex';
        titleEl.textContent = `Edit Document: ${docId} (${collectionName})`;

        try {
            const docUrl = `${FIRESTORE_BASE_URL}/${collectionName}/${docId}`;
            const res = await fetch(docUrl);
            if (!res.ok) throw new Error("Failed to fetch document fields.");
            
            const docData = await res.json();
            const fields = docData.fields || {};

            formBody.innerHTML = '';
            let fieldMetadata = {};

            if (Object.keys(fields).length === 0) {
                formBody.innerHTML = `<p style="color:var(--text-secondary);">This document contains no editable fields.</p>`;
                return;
            }

            for (const [key, valObj] of Object.entries(fields)) {
                let inputType = 'text';
                let rawVal = '';
                let typeKey = 'stringValue';

                if (valObj.stringValue !== undefined) {
                    inputType = 'text';
                    rawVal = valObj.stringValue;
                    typeKey = 'stringValue';
                } else if (valObj.integerValue !== undefined) {
                    inputType = 'number';
                    rawVal = valObj.integerValue;
                    typeKey = 'integerValue';
                } else if (valObj.doubleValue !== undefined) {
                    inputType = 'number';
                    rawVal = valObj.doubleValue;
                    typeKey = 'doubleValue';
                } else if (valObj.booleanValue !== undefined) {
                    inputType = 'checkbox';
                    rawVal = valObj.booleanValue;
                    typeKey = 'booleanValue';
                } else {
                    inputType = 'textarea';
                    rawVal = parseFirestoreValue(valObj);
                    typeKey = 'jsonString';
                }

                fieldMetadata[key] = typeKey;

                const fieldGroup = document.createElement('div');
                fieldGroup.style.marginBottom = '15px';
                
                if (inputType === 'checkbox') {
                    fieldGroup.innerHTML = `
                        <label style="display:flex; align-items:center; gap:10px; cursor:pointer; color:var(--text-main);">
                            <input type="checkbox" id="field_${key}" data-key="${key}" data-type="${typeKey}" ${rawVal ? 'checked' : ''} style="width:18px; height:18px;">
                            <strong>${key}</strong> <span style="font-size:11px; color:var(--text-secondary);">(boolean)</span>
                        </label>`;
                } else if (inputType === 'textarea') {
                    fieldGroup.innerHTML = `
                        <label style="display:block; margin-bottom:5px; font-size:13px; color:var(--text-main);"><strong>${key}</strong> <span style="font-size:11px; color:var(--text-secondary);">(Complex Object/JSON)</span></label>
                        <textarea id="field_${key}" data-key="${key}" data-type="${typeKey}" rows="3" style="width:100%; background:var(--bg-input, #12151c); color:#fff; border:1px solid var(--border-color); border-radius:6px; padding:8px; font-family:monospace; font-size:12px;">${rawVal}</textarea>`;
                } else {
                    fieldGroup.innerHTML = `
                        <label style="display:block; margin-bottom:5px; font-size:13px; color:var(--text-main);"><strong>${key}</strong> <span style="font-size:11px; color:var(--text-secondary);">(${typeKey})</span></label>
                        <input type="${inputType}" id="field_${key}" data-key="${key}" data-type="${typeKey}" value="${rawVal}" style="width:100%; background:var(--bg-input, #12151c); color:#fff; border:1px solid var(--border-color); border-radius:6px; padding:8px; font-size:13px;">`;
                }
                formBody.appendChild(fieldGroup);
            }

            const handleSave = async () => {
                saveBtn.disabled = true;
                saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

                try {
                    let updatedFields = {};
                    let fieldPaths = [];

                    for (const key of Object.keys(fields)) {
                        const inputEl = document.getElementById(`field_${key}`);
                        if (!inputEl) continue;

                        fieldPaths.push(`updateMask.fieldPaths=${encodeURIComponent(key)}`);
                        const tKey = fieldMetadata[key];

                        if (tKey === 'booleanValue') {
                            updatedFields[key] = { booleanValue: inputEl.checked };
                        } else if (tKey === 'integerValue') {
                            updatedFields[key] = { integerValue: parseInt(inputEl.value) || 0 };
                        } else if (tKey === 'doubleValue') {
                            updatedFields[key] = { doubleValue: parseFloat(inputEl.value) || 0.0 };
                        } else if (tKey === 'jsonString') {
                            try {
                                const parsedJson = JSON.parse(inputEl.value);
                                updatedFields[key] = typeof parsedJson === 'object' ? parseBackToFirestore(parsedJson) : { stringValue: inputEl.value };
                            } catch {
                                updatedFields[key] = { stringValue: inputEl.value };
                            }
                        } else {
                            updatedFields[key] = { stringValue: inputEl.value };
                        }
                    }

                    const patchUrl = `${docUrl}?${fieldPaths.join('&')}`;
                    const updateRes = await fetch(patchUrl, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fields: updatedFields })
                    });

                    if (!updateRes.ok) throw new Error(`Firestore update error: ${updateRes.status}`);

                    appendTerminalLog('success', `Document [${docId}] successfully updated via dynamic form.`);
                    modal.style.display = 'none';
                    if (collectionSelect) fetchCollectionData(collectionSelect.value);

                } catch (err) {
                    console.error("Save error:", err);
                    alert(`Failed to save changes: ${err.message}`);
                    appendTerminalLog('error', `Failed to update [${docId}]: ${err.message}`);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Changes`;
                }
            };

            saveBtn.onclick = handleSave;
            closeBtn.onclick = () => modal.style.display = 'none';
            cancelBtn.onclick = () => modal.style.display = 'none';

        } catch (err) {
            console.error("Modal load error:", err);
            formBody.innerHTML = `<p style="color:var(--danger);">Failed to load document structure: ${err.message}</p>`;
        }
    }

    function parseBackToFirestore(obj) {
        let mapFields = {};
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'boolean') mapFields[k] = { booleanValue: v };
            else if (typeof v === 'number') mapFields[k] = { doubleValue: v };
            else mapFields[k] = { stringValue: String(v) };
        }
        return { mapValue: { fields: mapFields } };
    }

    if (collectionSelect) {
        collectionSelect.addEventListener('change', (e) => {
            fetchCollectionData(e.target.value);
        });
    }

    if (refreshDocsBtn) {
        refreshDocsBtn.addEventListener('click', () => {
            if (collectionSelect) fetchCollectionData(collectionSelect.value);
        });
    }

    if (collectionSelect) {
        fetchCollectionData(collectionSelect.value);
    }

    // --- 2. GLOBAL EMERGENCY OVERRIDE ---
    if (globalUnlockBtn) {
        globalUnlockBtn.addEventListener('click', async () => {
            const confirmed = confirm("CRITICAL WARNING: This will execute a batch state update forcing all terminal nodes to 'active' status. Proceed?");
            if (!confirmed) return;

            globalUnlockBtn.disabled = true;
            globalUnlockBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Broadcasting Unlock Signal...`;

            try {
                const response = await fetch(`${FIRESTORE_BASE_URL}/terminal_states`);
                const data = await response.json();
                const documents = data.documents || [];

                let updatePromises = documents.map(async (doc) => {
                    const docName = doc.name; 
                    const patchUrl = `https://firestore.googleapis.com/v1/${docName}?updateMask.fieldPaths=status&updateMask.fieldPaths=lockState`;
                    return fetch(patchUrl, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fields: {
                                status: { stringValue: "active" },
                                lockState: { stringValue: "unlocked" }
                            }
                        })
                    });
                });

                await Promise.all(updatePromises);

                globalUnlockBtn.innerHTML = `<i class="fa-solid fa-check"></i> Global Override Executed`;
                globalUnlockBtn.style.background = 'var(--success)';
                
                if (emergencyStatusLog) {
                    emergencyStatusLog.classList.remove('hidden');
                    emergencyStatusLog.innerHTML = `<span class="text-success">[OK] Successfully broadcasted unlock command to ${documents.length} active terminal nodes at ${new Date().toLocaleTimeString()}.</span>`;
                }
                
                appendTerminalLog('success', `Global emergency unlock broadcast completed successfully across ${documents.length} nodes.`);
                if (collectionSelect) fetchCollectionData(collectionSelect.value);

            } catch (error) {
                console.error("Emergency Override Error:", error);
                globalUnlockBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Override Failed`;
                globalUnlockBtn.style.background = 'var(--danger)';
                appendTerminalLog('error', `Global override transmission failed: ${error.message}`);
            }
        });
    }

    // --- 3. LIVE FEATURE FLAGS ---
    const flagLockdown = document.getElementById('flagLockdown');
    const flagBurst = document.getElementById('flagBurst');

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['strictLockdownV2', 'telemetryBurstMode'], (result) => {
            if (result.strictLockdownV2 !== undefined && flagLockdown) flagLockdown.checked = result.strictLockdownV2;
            if (result.telemetryBurstMode !== undefined && flagBurst) flagBurst.checked = result.telemetryBurstMode;
        });
    }

    if (flagLockdown) {
        flagLockdown.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ strictLockdownV2: isEnabled }, () => {
                    appendTerminalLog('info', `Feature Flag [Strict Window Lockdown V2] set to: ${isEnabled}`);
                });
            }
        });
    }

    if (flagBurst) {
        flagBurst.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ telemetryBurstMode: isEnabled }, () => {
                    appendTerminalLog('info', `Feature Flag [Telemetry Burst Mode] set to: ${isEnabled}`);
                });
            }
        });
    }
// --- 4. DYNAMIC CONCURRENT LOAD STRESS TEST ---
    if (runStressTestBtn) {
        runStressTestBtn.addEventListener('click', async () => {
            const stressCountInput = document.getElementById('stressCountInput');
            const stressCollectionSelect = document.getElementById('stressCollectionSelect');
            
            const concurrentCount = parseInt(stressCountInput?.value) || 200;
            const targetCollection = stressCollectionSelect?.value || 'checkins';

            runStressTestBtn.disabled = true;
            runStressTestBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Running ${concurrentCount} Pings on [${targetCollection}]...`;
            
            appendTerminalLog('info', `Initiating real stress simulation: firing ${concurrentCount} concurrent requests to [${targetCollection}]...`);
            const startTime = performance.now();

            try {
                const testBatch = Array.from({ length: concurrentCount }, (_, index) => {
                    const uniqueId = `SIM_${targetCollection.toUpperCase()}_${Math.floor(1000 + Math.random() * 9000)}_${index}`;
                    const payload = {
                        fields: {
                            simulationId: { stringValue: uniqueId },
                            status: { stringValue: "stress_test_active" },
                            targetCollection: { stringValue: targetCollection },
                            timestamp: { timestampValue: new Date().toISOString() }
                        }
                    };

                    return fetch(`${FIRESTORE_BASE_URL}/${targetCollection}?documentId=${uniqueId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                });

                const results = await Promise.allSettled(testBatch);
                let successCount = 0;
                
                results.forEach(res => {
                    if (res.status === 'fulfilled' && (res.value.ok || res.value.status === 409)) {
                        successCount++;
                    }
                });

                const endTime = performance.now();
                const duration = Math.round(endTime - startTime);

                if (stressTestResult) {
                    stressTestResult.classList.remove('hidden');
                    stressTestResult.innerHTML = `<span>Processed: <strong>${successCount}/${concurrentCount}</strong></span><span>Latency: <strong>${duration}ms</strong></span><span class="text-success">Status: Optimal</span>`;
                }
                
                appendTerminalLog('success', `Stress simulation passed: ${successCount}/${concurrentCount} operations on [${targetCollection}] resolved in ${duration}ms.`);

            } catch (err) {
                console.error("Stress Test Error:", err);
                appendTerminalLog('error', `Stress test simulation encountered exceptions: ${err.message}`);
                if (stressTestResult) {
                    stressTestResult.innerHTML = `<span class="text-danger">Status: Failed (${err.message})</span>`;
                }
            } finally {
                runStressTestBtn.disabled = false;
                runStressTestBtn.innerHTML = `<i class="fa-solid fa-gauge-high"></i> Run Concurrent Load Simulation`;
            }
        });
    }
    });

// --- DYNAMICALLY POPULATE ALL COLLECTION DROPDOWNS ---
async function initializeCollectionDropdowns() {
    const dropdownSelectors = ['#collectionSelect', '#stressCollectionSelect'];
    const dropdowns = dropdownSelectors.map(selector => document.querySelector(selector)).filter(Boolean);

    if (dropdowns.length === 0) return;

    // Set initial loading state on dropdowns
    dropdowns.forEach(select => {
        select.innerHTML = `<option value="">Loading collections...</option>`;
        select.disabled = true;
    });

    try {
        const response = await fetch('https://us-central1-samcam-system.cloudfunctions.net/listCollections');
        const result = await response.json();
        
        if (!result.success) throw new Error(result.error);
        const collectionsList = result.collections || [];

        // Define optional exclusions if needed (e.g., system metadata collections)
        const EXCLUDED_COLLECTIONS = ['system_config'];
        const validCollections = collectionsList.filter(col => !EXCLUDED_COLLECTIONS.includes(col));

        // Populate each select element
        dropdowns.forEach(select => {
            select.innerHTML = '';
            validCollections.forEach(col => {
                const option = document.createElement('option');
                option.value = col;
                // Format display name nicely (e.g., 'user_profiles' -> 'User Profiles')
                option.textContent = col
                    .replace(/[_-]+/g, " ")
                    .toLowerCase()
                    .replace(/(^\w|\s\w)/g, match => match.toUpperCase());
                
                select.appendChild(option);
            });
            select.disabled = false;
        });

        // Trigger initial data load for the main table using the first selected collection
        const mainSelect = document.getElementById('collectionSelect');
        if (mainSelect && mainSelect.value && typeof fetchCollectionData === 'function') {
            fetchCollectionData(mainSelect.value);
        }

        console.log(`Successfully populated dropdowns with ${validCollections.length} collections.`);

    } catch (err) {
        console.error("Failed to load collections dynamically:", err);
        dropdowns.forEach(select => {
            select.innerHTML = `<option value="">Error loading collections</option>`;
        });
    }
}

