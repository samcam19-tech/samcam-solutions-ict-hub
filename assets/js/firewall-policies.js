// ==========================================
// FIREWALL-POLICIES.JS - 2026 ENTERPRISE NGFW STANDARD
// ==========================================

window.initFirewallPolicies = function() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.warn("Firebase not initialized for Firewall Policies.");
        return;
    }

    // Ensure custom modal and master control header exist in the DOM
    ensureFirewallModalInDOM();
    ensureMasterControlsHeader();

    const db = firebase.firestore();

    // Real-time listener for firewall rules collection
    db.collection("firewall_rules").orderBy("ruleId").onSnapshot((snapshot) => {
        const tbody = document.querySelector('#firewallPoliciesView table tbody');
        if (!tbody) return;

        tbody.innerHTML = ''; // Clear existing DOM rows

        if (snapshot.empty) {
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
        { 
            ruleId: "RULE-101", 
            subnetScope: "192.168.10.0/24", 
            contentTarget: "TCP / 80, 443", 
            protocol: "TCP / Port", 
            action: "ALLOW", 
            status: "Active",
            geoIp: "UG (Uganda)",
            dpiEnabled: true,
            qosRate: "Full Line Rate",
            schedule: "24/7 Continuous",
            ipsAction: "Drop"
        },
        { 
            ruleId: "RULE-380", 
            subnetScope: "10.212.202.0/24", 
            contentTarget: "youtube.com", 
            protocol: "HTTPS / App Filter", 
            action: "BLOCK", 
            status: "Active",
            geoIp: "Global (Any)",
            dpiEnabled: true,
            qosRate: "Throttled (5 Mbps)",
            schedule: "Lab Hours (08:00 - 17:00)",
            ipsAction: "TCP Reset"
        }
    ];

    defaultRules.forEach((rule) => {
        db.collection("firewall_rules").add(rule).catch((err) => console.error(err));
    });
}

// Injects Global Kill Switch & NGFW Toolbar header if not present
function ensureMasterControlsHeader() {
    const view = document.getElementById('firewallPoliciesView');
    if (!view || document.getElementById('samcamMasterNgfwBar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'samcamMasterNgfwBar';
    toolbar.style.cssText = 'background: #ffffff; padding: 14px 20px; border-radius: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;';
    
    toolbar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 8px rgba(22,163,74,0.6);" id="ngfwStatusDot"></div>
            <div>
                <strong style="font-size: 0.9rem; color: #0f172a; display: block;">Next-Gen Firewall Core: Active</strong>
                <span style="font-size: 0.75rem; color: #64748b;">DPI Engine & Geo-Routing Signatures Synchronized</span>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <button type="button" onclick="toggleGlobalKillSwitch()" id="globalKillSwitchBtn" style="padding: 7px 14px; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-shield-halved"></i> Global Kill Switch: OFF
            </button>
            <button type="button" onclick="openAddFirewallRuleModal()" style="padding: 7px 16px; background: #2563eb; color: #ffffff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-plus"></i> Add Security Rule
            </button>
        </div>
    `;

    const tableWrapper = view.querySelector('div:has(table)') || view.querySelector('table').parentNode;
    view.insertBefore(toolbar, tableWrapper);
}

window.toggleGlobalKillSwitch = function() {
    const btn = document.getElementById('globalKillSwitchBtn');
    const dot = document.getElementById('ngfwStatusDot');
    if (!btn) return;

    const isEngaged = btn.getAttribute('data-active') === 'true';
    if (!isEngaged) {
        if (confirm("WARNING: Engaging the Global Kill Switch will enforce an immediate Zero-Trust lockdown across all subnets, dropping all non-admin traffic. Proceed?")) {
            btn.setAttribute('data-active', 'true');
            btn.style.background = '#dc2626';
            btn.style.color = '#ffffff';
            btn.style.borderColor = '#b91c1c';
            btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Global Kill Switch: ENGAGED';
            if (dot) dot.style.background = '#dc2626';
            console.warn("NGFW Global Kill Switch ENGAGED by administrator.");
        }
    } else {
        btn.setAttribute('data-active', 'false');
        btn.style.background = '#fee2e2';
        btn.style.color = '#dc2626';
        btn.style.borderColor = '#fca5a5';
        btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Global Kill Switch: OFF';
        if (dot) dot.style.background = '#16a34a';
        console.log("NGFW Global Kill Switch disengaged.");
    }
};

// Injects the expanded modal HTML with Geo-IP, DPI, QoS, Schedule & IPS settings
function ensureFirewallModalInDOM() {
    if (document.getElementById('samcamFirewallModal')) return;

    const modalHTML = `
    <div id="samcamFirewallModal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 9999; align-items: center; justify-content: center; backdrop-filter: blur(2px); overflow-y: auto; padding: 20px;">
        <div style="background: #ffffff; width: 100%; max-width: 560px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); overflow: hidden; margin: auto;">
            <div style="background: #f8fafc; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a; font-weight: 600;">Configure Advanced NGFW Security Rule</h3>
                <button type="button" onclick="closeAddFirewallRuleModal()" style="background: none; border: none; font-size: 1.25rem; color: #64748b; cursor: pointer;">&times;</button>
            </div>
            <form id="samcamFirewallForm" onsubmit="submitFirewallRuleForm(event)" style="padding: 20px; max-height: 80vh; overflow-y: auto;">
                
                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Workstation Subnet / IP Scope</label>
                    <select id="fwSubnetScopeInput" required style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; background: #fff; box-sizing: border-box;">
                        <option value="" disabled selected>-- Select Subnet Scope --</option>
                        <option value="Global (All Subnets)">Global (All Subnets / Workstations)</option>
                        <optgroup label="Lab Subnets">
                            <option value="10.212.202.0/24">10.212.202.0/24 (Main Computer Lab)</option>
                            <option value="192.168.10.0/24">192.168.10.0/24 (Admin & Staff Network)</option>
                            <option value="192.168.20.0/24">192.168.20.0/24 (Student Library Terminals)</option>
                            <option value="172.16.50.0/24">172.16.50.0/24 (Examination Hall Scope)</option>
                        </optgroup>
                    </select>
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Target Domain, App, or Category</label>
                    <select id="fwContentTargetInput" required style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; background: #fff; box-sizing: border-box;">
                        <option value="" disabled selected>-- Select Website, App, or Category Filter --</option>
                        <optgroup label="Executables & Downloads">
                            <option value="executables">executables (.exe, .msi, .bat, .cmd, .scr)</option>
                        </optgroup>
                        <optgroup label="Popular Sites & Media">
                            <option value="youtube.com">youtube.com (Video Streaming)</option>
                        </optgroup>
                        <optgroup label="Sports & Entertainment">
                            <option value="sports">sports (General Sports Sites)</option>
                            <option value="streaming">streaming (Netflix, Reddit)</option>
                            <option value="social">social (TikTok, Instagram, X)</option>
                            <option value="gaming">gaming (Roblox, Twitch)</option>
                        </optgroup>
                    </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                    <div>
                        <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Protocol / Filter Type</label>
                        <input type="text" id="fwProtocolInput" required value="HTTPS / App & Media Filter" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Geo-IP Restriction</label>
                        <select id="fwGeoIpInput" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; background: #fff; box-sizing: border-box;">
                            <option value="Global (Any)">Global (Any Region)</option>
                            <option value="UG (Uganda Only)">UG (Uganda Only)</option>
                            <option value="Block High-Risk Regions">Block High-Risk Regions (RU, CN, KP)</option>
                            <option value="North America Only">North America Only</option>
                        </select>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                    <div>
                        <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">QoS Bandwidth Shaping</label>
                        <select id="fwQosInput" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; background: #fff; box-sizing: border-box;">
                            <option value="Full Line Rate">Full Line Rate (No Throttling)</option>
                            <option value="Throttled (5 Mbps)">Throttle to 5 Mbps (Low Priority)</option>
                            <option value="Throttled (2 Mbps)">Throttle to 2 Mbps (Restricted)</option>
                            <option value="Throttled (512 Kbps)">Capped at 512 Kbps</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Schedule Window</label>
                        <select id="fwScheduleInput" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; background: #fff; box-sizing: border-box;">
                            <option value="24/7 Continuous">24/7 Continuous Enforcement</option>
                            <option value="Lab Hours (08:00 - 17:00)">Lab Hours (Mon-Fri 08:00 - 17:00)</option>
                            <option value="Exam Mode (Strict)">Exam Mode (All-Day Lock)</option>
                            <option value="After Hours Only">After Hours Only (17:00 - 08:00)</option>
                        </select>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div>
                        <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">IPS Action Mode</label>
                        <select id="fwIpsActionInput" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; background: #fff; box-sizing: border-box;">
                            <option value="Drop">Drop (Immediate Silenced Drop)</option>
                            <option value="TCP Reset">TCP Reset (Send RST Packet)</option>
                            <option value="Alert / Log Only">Alert / Log Only (Audit Mode)</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">Rule Action</label>
                        <select id="fwActionInput" style="width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; background: #fff; box-sizing: border-box;">
                            <option value="BLOCK">BLOCK (Deny Traffic)</option>
                            <option value="ALLOW">ALLOW (Permit Traffic)</option>
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 18px; display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="fwDpiToggle" checked style="width: 16px; height: 16px; accent-color: #2563eb; cursor: pointer;">
                    <label for="fwDpiToggle" style="font-size: 0.85rem; font-weight: 600; color: #334155; cursor: pointer;">Enable Deep Packet Inspection (DPI) & Signature Analysis</label>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" onclick="closeAddFirewallRuleModal()" style="padding: 9px 16px; background: #f1f5f9; color: #475569; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">Cancel</button>
                    <button type="submit" style="padding: 9px 18px; background: #2563eb; color: #ffffff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">Deploy Security Rule</button>
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
    const geoIp = document.getElementById('fwGeoIpInput').value;
    const qosRate = document.getElementById('fwQosInput').value;
    const schedule = document.getElementById('fwScheduleInput').value;
    const ipsAction = document.getElementById('fwIpsActionInput').value;
    const action = document.getElementById('fwActionInput').value;
    const dpiEnabled = document.getElementById('fwDpiToggle').checked;

    if (!subnetScope || !contentTarget) return;

    if (typeof firebase !== 'undefined' && firebase.apps.length) {
        const db = firebase.firestore();
        const randomIdNum = Math.floor(200 + Math.random() * 800);
        
        db.collection("firewall_rules").add({
            ruleId: `RULE-${randomIdNum}`,
            subnetScope: subnetScope,
            contentTarget: contentTarget,
            protocol: protocolPort,
            action: action,
            status: "Active",
            geoIp: geoIp,
            qosRate: qosRate,
            schedule: schedule,
            ipsAction: ipsAction,
            dpiEnabled: dpiEnabled,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            console.log("Enterprise NGFW rule successfully deployed to Firestore.");
            closeAddFirewallRuleModal();
        }).catch((error) => {
            alert("Error adding rule: " + error.message);
        });
    }
};

window.deleteFirewallRule = function(docId) {
    if (confirm("Are you sure you want to revoke and delete this advanced security rule?")) {
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

    const displaySubnet = rule.subnetScope || rule.subnet || "Global";
    const displayTarget = rule.contentTarget || "";
    const geoBadge = rule.geoIp ? `<br><span style="color: #0284c7; font-size: 0.75rem;"><i class="fa-solid fa-globe"></i> ${rule.geoIp}</span>` : '';
    const qosBadge = rule.qosRate && rule.qosRate !== 'Full Line Rate' ? ` | <span style="color: #7c3aed; font-size: 0.75rem;"><i class="fa-solid fa-gauge"></i> ${rule.qosRate}</span>` : '';
    const scheduleBadge = rule.schedule ? ` | <span style="color: #d97706; font-size: 0.75rem;"><i class="fa-regular fa-clock"></i> ${rule.schedule}</span>` : '';

    const newRow = document.createElement('tr');
    newRow.style.borderBottom = '1px solid #f1f5f9;';
    newRow.innerHTML = `
        <td style="padding: 12px 16px;"><code>${rule.ruleId}</code></td>
        <td style="padding: 12px 16px;"><strong>${displaySubnet}</strong><br><span style="color: #64748b; font-size: 0.8rem;">Target: ${displayTarget}</span>${geoBadge}</td>
        <td style="padding: 12px 16px;">${rule.protocol}${qosBadge}<br><span style="color: #64748b; font-size: 0.75rem;">IPS: ${rule.ipsAction || 'Drop'} ${scheduleBadge}</span></td>
        <td style="padding: 12px 16px;"><span style="${actionBadgeStyle} font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 4px;">${rule.action}</span></td>
        <td style="padding: 12px 16px;"><span style="color: #16a34a; font-weight: 600;">${rule.status || 'Active'}</span></td>
        <td style="padding: 12px 16px; text-align: right;"><button onclick="deleteFirewallRule('${docId}')" style="background: none; border: none; color: #dc2626; cursor: pointer; font-weight: 600;">Revoke</button></td>
    `;
    tbody.appendChild(newRow);
}
