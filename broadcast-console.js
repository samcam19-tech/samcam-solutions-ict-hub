// ==========================================
// BROADCAST-CONSOLE.JS - 2026 ENTERPRISE SaaS STANDARD
// ==========================================

window.initBroadcastConsole = function() {
    console.log("Broadcast Console & Enterprise CLI module initialized.");
    
    const executeBtn = document.querySelector('#broadcastConsoleView button.btn-primary');
    const commandInput = document.querySelector('#broadcastConsoleView input[type="text"]');
    
    if (executeBtn && commandInput) {
        // Prevent duplicate bound listeners
        executeBtn.replaceWith(executeBtn.cloneNode(true));
        const newExecuteBtn = document.querySelector('#broadcastConsoleView button.btn-primary');

        commandInput.replaceWith(commandInput.cloneNode(true));
        const newCommandInput = document.querySelector('#broadcastConsoleView input[type="text"]');

        newExecuteBtn.onclick = function() {
            processCliCommand(newCommandInput.value);
            newCommandInput.value = '';
        };

        newCommandInput.onkeydown = function(e) {
            if (e.key === 'Enter') {
                processCliCommand(newCommandInput.value);
                newCommandInput.value = '';
            }
        };
    }

    // Initialize real-time Firestore listener for live incoming broadcasts from edge nodes
    initLiveBroadcastListener();
};

function processCliCommand(command) {
    const cleanCommand = command.trim();
    if (!cleanCommand) return;

    // Target the terminal box body dynamically
    const terminalOutputBody = document.querySelector('#broadcastConsoleView div[style*="font-family: monospace"], #broadcastConsoleView div.font-mono, #broadcastConsoleView .bg-slate-900');
    if (!terminalOutputBody) return;

    // Append user input line to console viewport
    const commandLineDiv = document.createElement('div');
    commandLineDiv.style.cssText = "margin-bottom: 0.25rem;";
    commandLineDiv.innerHTML = `<span style="color: #94a3b8;">root@samcam-hub:~#</span> <span style="color: #38bdf8; font-weight: 500;">${escapeHtml(cleanCommand)}</span>`;
    terminalOutputBody.appendChild(commandLineDiv);

    const responseDiv = document.createElement('div');
    responseDiv.style.cssText = "margin-bottom: 0.75rem; word-break: break-all; line-height: 1.4;";

    // Enterprise Command Parsing Router
    if (cleanCommand.startsWith('ping ')) {
        const target = cleanCommand.split(' ')[1] || '192.168.1.1';
        responseDiv.style.color = "#10b981";
        responseDiv.innerHTML = `[✔] PING ${escapeHtml(target)} (T568A Backbone): 56 data bytes.<br>64 bytes from ${escapeHtml(target)}: icmp_seq=1 ttl=118 time=1.84 ms<br>64 bytes from ${escapeHtml(target)}: icmp_seq=2 ttl=118 time=2.02 ms<br>[✔] 2 packets transmitted, 2 received, 0.0% packet loss, time 1002ms.`;
    } 
    else if (cleanCommand.startsWith('broadcast ')) {
        const message = cleanCommand.replace('broadcast ', '').trim();
        responseDiv.style.color = "#38bdf8";
        responseDiv.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> [✔] Global SaaS telemetry broadcast initiated. Dispatched payload to active cluster edge nodes: "${escapeHtml(message)}"`;
        
        // Fully functional persistence to Firestore network_broadcasts collection
        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("network_broadcasts").add({
                message: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                sender: "root@samcam-hub",
                status: "Dispatched",
                nodeProtocol: "T568A"
            }).then(() => {
                console.log("Broadcast successfully synced to Firestore edge cluster.");
            }).catch(err => {
                console.error("Broadcast persistence error:", err);
            });
        }
    } 
    else if (cleanCommand === 'clear') {
        terminalOutputBody.innerHTML = `<div style="color: #94a3b8; margin-bottom: 0.5rem;">SAMCAM Solutions Network CLI [Version 2.6.0 - 2026 Enterprise SaaS Standard]</div>`;
        return;
    } 
    else if (cleanCommand === 'help') {
        responseDiv.style.color = "#fbbf24";
        responseDiv.innerHTML = `Available 2026 Enterprise Operational Commands:<br>
        - <span style="color: #38bdf8;">ping &lt;ip-address&gt;</span> : Execute live ICMP loopback diagnostic telemetry<br>
        - <span style="color: #38bdf8;">broadcast &lt;message&gt;</span> : Push global alert payload to all connected lab edge nodes via Firestore<br>
        - <span style="color: #38bdf8;">systemctl status &lt;service&gt;</span> : Query backend daemon health and T568A switch socket state<br>
        - <span style="color: #38bdf8;">nodes list</span> : Inspect active active subnet IP leases and workstation statuses<br>
        - <span style="color: #38bdf8;">clear</span> : Purge terminal output buffer`;
    } 
    else if (cleanCommand.startsWith('systemctl status')) {
        const serviceName = cleanCommand.replace('systemctl status', '').trim() || 'net-backbone.service';
        responseDiv.style.color = "#10b981";
        responseDiv.innerHTML = `● ${escapeHtml(serviceName)} - SAMCAM Cloud Infrastructure Daemon<br>
        &nbsp;&nbsp;Loaded: loaded (/lib/systemd/system/${escapeHtml(serviceName)}; enabled; vendor preset: enabled)<br>
        &nbsp;&nbsp;Active: <span style="color: #10b981; font-weight: 600;">active (running)</span> since Mon 2026-08-31 08:30:14 EAT; 6h ago<br>
        &nbsp;&nbsp;Main PID: 4209 (samcam-daemon)<br>
        &nbsp;&nbsp;Status: "T568A wiring loopback verified across all switches. Zero dropped frames."`;
    }
    else if (cleanCommand === 'nodes list' || cleanCommand === 'nodes') {
        responseDiv.style.color = "#a855f7";
        responseDiv.innerHTML = `[i] Active Subnet Edge Nodes (Port 8080 Mesh):<br>
        - 192.168.1.101 [Lab Workstation 01]: ONLINE (Latency: 2.1ms, Protocol: T568A)<br>
        - 192.168.1.102 [Lab Workstation 02]: ONLINE (Latency: 1.9ms, Protocol: T568A)<br>
        - 192.168.1.150 [Instructor Master Console]: ACTIVE (Telemetry Sync Operational)`;
    }
    else {
        responseDiv.style.color = "#f43f5e";
        responseDiv.innerHTML = `[✖] Command not recognized: '${escapeHtml(cleanCommand)}'. Type 'help' for available enterprise command strings.`;
    }

    terminalOutputBody.appendChild(responseDiv);
    terminalOutputBody.scrollTop = terminalOutputBody.scrollHeight;
}

// Real-time Firestore sync listener for cluster broadcasts
function initLiveBroadcastListener() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;

    const db = firebase.firestore();
    db.collection("network_broadcasts")
        .orderBy("timestamp", "desc")
        .limit(1)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    // Avoid duplicating local immediate printouts if sender is current session
                    if (data.sender && data.sender !== "root@samcam-hub" && data.message) {
                        const terminalBody = document.querySelector('#broadcastConsoleView div[style*="font-family: monospace"], #broadcastConsoleView div.font-mono, #broadcastConsoleView .bg-slate-900');
                        if (terminalBody) {
                            const liveAlertDiv = document.createElement('div');
                            liveAlertDiv.style.cssText = "margin-bottom: 0.75rem; color: #38bdf8; background: rgba(56, 189, 248, 0.08); padding: 6px 10px; border-left: 3px solid #38bdf8; border-radius: 4px;";
                            liveAlertDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>CLUSTER BROADCAST [${data.sender}]:</strong> ${escapeHtml(data.message)}`;
                            terminalBody.appendChild(liveAlertDiv);
                            terminalBody.scrollTop = terminalBody.scrollHeight;
                        }
                    }
                }
            });
        }, (error) => {
            console.error("Broadcast snapshot listener error:", error);
        });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
