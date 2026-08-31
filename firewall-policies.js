// firewall-policies.js
// Manages functional firewall access rules directly persisted and synced with Firestore.

window.initFirewallPolicies = function() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.warn("Firebase not initialized for Firewall Policies.");
        return;
    }

    // Ensure custom modal structure exists in the DOM
    ensureFirewallModalInDOM();

    const db = firebase.firestore();

    // Real-time listener for firewall rules collection
    db.collection("firewall_rules").orderBy("ruleId").onSnapshot((snapshot) => {
        const tbody = document.querySelector('#firewallPoliciesView table tbody');
        if (!tbody) return;

        tbody.innerHTML = ''; // Clear existing DOM rows

        if (snapshot.empty) {
            // Seed initial rules if empty
            seedInitialFirewallRules(db);
            return;
        }

        snapshot.forEach((doc) => {
            const rule = doc.data();
            appendRuleRowToDOM(tbody, doc.id, rule);
        });
    }, (error) => {
        console.error("Error listening to firewall rules: ", error);
    });
};

function seedInitialFirewallRules(db) {
    const defaultRules = [
        { ruleId: "RULE-101", subnetScope: "192.168.10.0/24", contentTarget: "TCP / 80, 443", protocol: "TCP / Port", action: "ALLOW", status: "Active" },
        { ruleId: "RULE-380", subnetScope: "10.212.202.0/24", contentTarget: "youtube.com", protocol: "HTTPS / App Filter", action: "BLOCK", status: "Active" }
    ];

    defaultRules.forEach((rule) => {
        db.collection("firewall_rules").add(rule).catch((err) => console.error(err));
    });
}

// Injects the custom modal HTML and CSS into the page dynamically if not already present
function ensureFirewallModalInDOM() {
    if (document.getElementById('samcamFirewallModal')) return;

    const modalHTML = `
    <div id="samcamFirewallModal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 9999; align-items: center; justify-content: center; backdrop-filter: blur(2px);">
        <div style="background: #ffffff; width: 100%; max-width: 480px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); overflow: hidden; animation: sfModalFadeIn 0.2s ease-out;">
            <div style="background: #f8fafc; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a; font-weight: 600;">Add Security Rule</h3>
                <button type="button" onclick="closeAddFirewallRuleModal()" style="background: none; border: none; font-size: 1.25rem; color: #64748b; cursor: pointer;">&times;</button>
            </div>
            <form id="samcamFirewallForm" onsubmit="submitFirewallRuleForm(event)" style="padding: 20px;">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #334155; margin-bottom: 6px;">Workstation Subnet / IP Scope</label>
                    <select id="fwSubnetScopeInput" required style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; background: #fff; box-sizing: border-box; outline: none;" onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#cbd5e1'">
                        <option value="" disabled selected>-- Select Subnet Scope --</option>
                        <option value="Global (All Subnets)">Global (All Subnets / Workstations)</option>
                        <optgroup label="Common Lab Subnets">
                            <option value="10.212.202.0/24">10.212.202.0/24 (Main Computer Lab)</option>
                            <option value="192.168.10.0/24">192.168.10.0/24 (Admin & Staff Network)</option>
                            <option value="192.168.20.0/24">192.168.20.0/24 (Student Library Terminals)</option>
                            <option value="172.16.50.0/24">172.16.50.0/24 (Examination Hall Scope)</option>
                        </optgroup>
                    </select>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #334155; margin-bottom: 6px;">Target Domain, App, or Category</label>
                    <select id="fwContentTargetInput" required style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; background: #fff; box-sizing: border-box; outline: none;" onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#cbd5e1'">
                        <option value="" disabled selected>-- Select Website, App, or Category Filter --</option>
                        <optgroup label="Executable Files & Downloads">
                            <option value="executables">executables (.exe, .msi, .bat, .cmd, .scr, .pif, .jar)</option>
                        </optgroup>
                        <optgroup label="Popular Sites & Media">
                            <option value="youtube.com">youtube.com (Video Streaming)</option>
                        </optgroup>
                        <optgroup label="Sports Categories & Leagues">
                            <option value="sports">sports (General Sports Sites)</option>
                            <option value="premierleague">premierleague (EPL & Football Trackers)</option>
                        </optgroup>
                        <optgroup label="Social Media & Communication">
                            <option value="social">social (TikTok, Instagram, X/Twitter, Snapchat)</option>
                        </optgroup>
                        <optgroup label="Gaming & Esports">
                            <option value="gaming">gaming (Roblox, CrazyGames, Poki, Twitch)</option>
                        </optgroup>
                        <optgroup label="Entertainment & Streaming">
                            <option value="streaming">streaming (Netflix, Reddit, Imgur)</option>
                        </optgroup>
                        <optgroup label="Music & Audio">
                            <option value="music">music (Spotify, SoundCloud, Audiomack)</option>
                        </optgroup>
                    </select>
                    <small style="display: block; color: #64748b; font-size: 0.75rem; margin-top: 4px;">Select a specific domain or category macro to automatically build network blocking rules.</small>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #334155; margin-bottom: 6px;">Protocol / Filter Type</label>
                    <input type="text" id="fwProtocolInput" required value="HTTPS / App & Media Filter" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; outline: none;" onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#cbd5e1'">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #334155; margin-bottom: 6px;">Rule Action</label>
                    <select id="fwActionInput" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; background: #fff; box-sizing: border-box; outline: none;">
                        <option value="BLOCK">BLOCK (Deny Traffic)</option>
                        <option value="ALLOW">ALLOW (Permit Traffic)</option>
                    </select>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" onclick="closeAddFirewallRuleModal()" style="padding: 9px 16px; background: #f1f5f9; color: #475569; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.875rem;">Cancel</button>
                    <button type="submit" style="padding: 9px 18px; background: #2563eb; color: #ffffff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.875rem;">Save Rule</button>
                </div>
            </form>
        </div>
    </div>`;

    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div);
}

window.openAddFirewallRuleModal = function() {
    ensureFirewallModalInDOM();
    const modal = document.getElementById('samcamFirewallModal');
    if (modal) {
        document.getElementById('fwSubnetScopeInput').value = '';
        document.getElementById('fwContentTargetInput').value = '';
        modal.style.display = 'flex';
        document.getElementById('fwSubnetScopeInput').focus();
    }
};

window.closeAddFirewallRuleModal = function() {
    const modal = document.getElementById('samcamFirewallModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.submitFirewallRuleForm = function(event) {
    event.preventDefault();
    
    const subnetScope = document.getElementById('fwSubnetScopeInput').value.trim();
    const contentTarget = document.getElementById('fwContentTargetInput').value.trim();
    const protocolPort = document.getElementById('fwProtocolInput').value.trim();
    const action = document.getElementById('fwActionInput').value;

    if (!subnetScope || !contentTarget) return;

    if (typeof firebase !== 'undefined' && firebase.apps.length) {
        const db = firebase.firestore();
        const randomIdNum = Math.floor(103 + Math.random() * 900);
        
        db.collection("firewall_rules").add({
            ruleId: `RULE-${randomIdNum}`,
            subnetScope: subnetScope,
            contentTarget: contentTarget,
            protocol: protocolPort,
            action: action,
            status: "Active",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            console.log("Service/Firewall rule successfully added to Firestore.");
            closeAddFirewallRuleModal();
        }).catch((error) => {
            alert("Error adding rule: " + error.message);
        });
    }
};

window.deleteFirewallRule = function(docId) {
    if (confirm("Are you sure you want to revoke and delete this security rule?")) {
        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("firewall_rules").doc(docId).delete().then(() => {
                console.log("Rule successfully revoked.");
            }).catch((error) => {
                alert("Error removing rule: " + error.message);
            });
        }
    }
};

function appendRuleRowToDOM(tbody, docId, rule) {
    const actionBadgeStyle = rule.action === 'ALLOW' 
        ? 'background: #dcfce7; color: #16a34a;' 
        : 'background: #fee2e2; color: #dc2626;';

    // Fallback support if legacy single-string `subnet` fields still exist
    const displaySubnet = rule.subnetScope || rule.subnet || "Global";
    const displayTarget = rule.contentTarget || "";

    const newRow = document.createElement('tr');
    newRow.style.borderBottom = '1px solid #f1f5f9;';
    newRow.innerHTML = `
        <td style="padding: 12px 16px;"><code>${rule.ruleId}</code></td>
        <td style="padding: 12px 16px;"><strong>${displaySubnet}</strong><br><span style="color: #64748b; font-size: 0.8rem;">Target: ${displayTarget}</span></td>
        <td style="padding: 12px 16px;">${rule.protocol}</td>
        <td style="padding: 12px 16px;"><span style="${actionBadgeStyle} font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 4px;">${rule.action}</span></td>
        <td style="padding: 12px 16px;"><span style="color: #16a34a; font-weight: 600;">${rule.status || 'Active'}</span></td>
        <td style="padding: 12px 16px; text-align: right;"><button onclick="deleteFirewallRule('${docId}')" style="background: none; border: none; color: #dc2626; cursor: pointer; font-weight: 600;">Revoke</button></td>
    `;
    tbody.appendChild(newRow);
}
