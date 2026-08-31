// firewall-policies.js
// Manages functional firewall access rules directly persisted and synced with Firestore.

window.initFirewallPolicies = function() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.warn("Firebase not initialized for Firewall Policies.");
        return;
    }

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
        { ruleId: "RULE-101", subnet: "192.168.10.0/24", protocol: "TCP / 80, 443", action: "ALLOW", status: "Active" },
        { ruleId: "RULE-102", subnet: "10.45.0.0/16 (Guest)", protocol: "UDP / 53, 67", action: "BLOCK", status: "Active" }
    ];

    defaultRules.forEach((rule) => {
        db.collection("firewall_rules").add(rule).catchall = (err) => console.error(err);
    });
}

window.openAddFirewallRuleModal = function() {
    const targetSubnet = prompt("Enter Target Subnet or IP Address (e.g., 192.168.20.0/24):");
    if (!targetSubnet) return;

    const protocolPort = prompt("Enter Protocol / Port (e.g., TCP / 8080):", "TCP / 80, 443");
    if (!protocolPort) return;

    const action = prompt("Enter Rule Action (ALLOW or BLOCK):", "ALLOW").toUpperCase();
    
    if (action !== "ALLOW" && action !== "BLOCK") {
        alert("Invalid action specified. Must be ALLOW or BLOCK.");
        return;
    }

    if (typeof firebase !== 'undefined' && firebase.apps.length) {
        const db = firebase.firestore();
        const randomIdNum = Math.floor(103 + Math.random() * 900);
        
        db.collection("firewall_rules").add({
            ruleId: `RULE-${randomIdNum}`,
            subnet: targetSubnet,
            protocol: protocolPort,
            action: action,
            status: "Active",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            console.log("Firewall rule successfully added to Firestore.");
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

    const newRow = document.createElement('tr');
    newRow.style.borderBottom = '1px solid #f1f5f9;';
    newRow.innerHTML = `
        <td style="padding: 12px 16px;"><code>${rule.ruleId}</code></td>
        <td style="padding: 12px 16px;">${rule.subnet}</td>
        <td style="padding: 12px 16px;">${rule.protocol}</td>
        <td style="padding: 12px 16px;"><span style="${actionBadgeStyle} font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 4px;">${rule.action}</span></td>
        <td style="padding: 12px 16px;"><span style="color: #16a34a; font-weight: 600;">${rule.status || 'Active'}</span></td>
        <td style="padding: 12px 16px; text-align: right;"><button onclick="deleteFirewallRule('${docId}')" style="background: none; border: none; color: #dc2626; cursor: pointer; font-weight: 600;">Revoke</button></td>
    `;
    tbody.appendChild(newRow);
}
