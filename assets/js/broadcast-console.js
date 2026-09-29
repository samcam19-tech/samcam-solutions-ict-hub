// ==========================================
// BROADCAST-CONSOLE.JS - 2026 ENTERPRISE SaaS STANDARD (Fully Dynamic Refactor)
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

    // Initialize real-time Firestore listeners for incoming broadcasts and host daemon responses
    initLiveBroadcastListener();
    initDaemonResponseListener();
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
        const target = cleanCommand.split(' ')[1];
        if (!target) {
            responseDiv.style.color = "#f43f5e";
            responseDiv.innerHTML = `[✖] Usage: <code style="color: #38bdf8;">ping &lt;ip-address&gt;</code>`;
            terminalOutputBody.appendChild(responseDiv);
            return;
        }

        responseDiv.style.color = "#10b981";
        responseDiv.innerHTML = `[i] Dispatching ICMP ping probe to target node <code style="color: #38bdf8;">${escapeHtml(target)}</code> via Firestore telemetry...`;
        terminalOutputBody.appendChild(responseDiv);

        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            // Write a ping request to Firestore so the Python host daemon or edge node can process it live
            firebase.firestore().collection("server_control").doc("main_server").set({
                pingAction: {
                    targetIp: target,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                },
                pingResult: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(err => console.error("Ping dispatch error:", err));
        }
    } 
    else if (cleanCommand.startsWith('broadcast ')) {
        const message = cleanCommand.replace('broadcast ', '').trim();
        if (!message) {
            responseDiv.style.color = "#f43f5e";
            responseDiv.innerHTML = `[✖] Usage: <code style="color: #38bdf8;">broadcast &lt;message&gt;</code>`;
            terminalOutputBody.appendChild(responseDiv);
            return;
        }

        responseDiv.style.color = "#38bdf8";
        responseDiv.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> [✔] Global SaaS telemetry broadcast initiated. Dispatched payload to active cluster edge nodes: "${escapeHtml(message)}"`;
        
        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("network_broadcasts").add({
                message: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                sender: "root@samcam-hub",
                status: "Dispatched"
            }).catch(err => console.error("Broadcast persistence error:", err));
        }
        terminalOutputBody.appendChild(responseDiv);
    } 
    else if (cleanCommand.startsWith('server start')) {
        const parts = cleanCommand.split(' ');
        const serverDir = parts.slice(2).join(' ') || '';
        
        responseDiv.style.color = "#38bdf8";
        responseDiv.innerHTML = serverDir 
            ? `<i class="fa-solid fa-server"></i> [✔] Dispatching signal to host node: Starting local LAN HTTP server at directory <code style="color: #f43f5e;">${escapeHtml(serverDir)}</code>...`
            : `<i class="fa-solid fa-server"></i> [✔] Dispatching signal to host node: Starting local LAN HTTP server at default workspace root...`;
        
        const payload = {
            state: "running",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (serverDir) payload.directory = serverDir;

        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("server_control").doc("main_server").set(payload, { merge: true })
                .catch(err => console.error("Server control sync error:", err));
        }
        terminalOutputBody.appendChild(responseDiv);
    }
    else if (cleanCommand === 'server stop') {
        responseDiv.style.color = "#f43f5e";
        responseDiv.innerHTML = `<i class="fa-solid fa-power-off"></i> [✔] Dispatching signal to host node: Halting local LAN file server daemon...`;
        
        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("server_control").doc("main_server").set({
                state: "stopped",
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(err => console.error("Server control sync error:", err));
        }
        terminalOutputBody.appendChild(responseDiv);
    }
    else if (cleanCommand === 'server status') {
        responseDiv.style.color = "#10b981";
        responseDiv.innerHTML = `[i] Querying host node server binding status dynamically from Firestore metadata...`;
        terminalOutputBody.appendChild(responseDiv);

        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("server_control").doc("main_server").get().then((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    const state = data.state || 'stopped';
                    const directory = data.directory || 'Not explicitly bound (Default)';
                    const stateColor = state === 'running' ? '#10b981' : '#f43f5e';
                    const lastUpdated = data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate().toLocaleTimeString() : 'Live';
                    
                    responseDiv.innerHTML = `[i] Host Node Server Metadata (Live Database Sync):<br>` +
                    `- Status: <span style="color: ${stateColor}; font-weight: 650;">${escapeHtml(state.toUpperCase())}</span><br>` +
                    `- Directory: <span style="color: #38bdf8;">${escapeHtml(directory)}</span><br>` +
                    `- Last State Transition: <span style="color: #cbd5e1;">${escapeHtml(lastUpdated)}</span>`;
                } else {
                    responseDiv.innerHTML = `[i] Host node server control record not found in Firestore.`;
                }
                terminalOutputBody.scrollTop = terminalOutputBody.scrollHeight;
            }).catch((err) => {
                responseDiv.style.color = "#f43f5e";
                responseDiv.innerHTML = `[✖] Failed to query server status: ${escapeHtml(err.message)}`;
                terminalOutputBody.scrollTop = terminalOutputBody.scrollHeight;
            });
        }
        return; 
    }
    else if (cleanCommand.startsWith('browse ')) {
        const targetIp = cleanCommand.split(' ')[1];
        if (!targetIp) {
            responseDiv.style.color = "#f43f5e";
            responseDiv.innerHTML = `[✖] Please provide an IP address. Usage: <code style="color: #38bdf8;">browse &lt;ip-address&gt;</code>`;
            terminalOutputBody.appendChild(responseDiv);
            return;
        }

        window._lastBrowseResult = null;

        responseDiv.style.color = "#38bdf8";
        responseDiv.innerHTML = `<i class="fa-solid fa-folder-open"></i> [i] Querying directory structure from workstation node <code style="color: #10b981;">${escapeHtml(targetIp)}</code>...`;
        
        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("server_control").doc("main_server").set({
                browseAction: {
                    targetIp: targetIp,
                    path: "Desktop"
                },
                browseResult: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        terminalOutputBody.appendChild(responseDiv);
    }
    else if (cleanCommand.startsWith('pull ')) {
        const parts = cleanCommand.split(' ');
        const targetIp = parts[1];
        const fileName = parts.slice(2).join(' ');

        if (!targetIp || !fileName) {
            responseDiv.style.color = "#f43f5e";
            responseDiv.innerHTML = `[✖] Invalid syntax. Usage: <code style="color: #38bdf8;">pull &lt;ip-address&gt; &lt;filename&gt;</code>`;
            terminalOutputBody.appendChild(responseDiv);
            return;
        }

        window._lastPullResult = null;

        responseDiv.style.color = "#38bdf8";
        responseDiv.innerHTML = `<i class="fa-solid fa-download"></i> [✔] Initiating selective pull of <code style="color: #f43f5e;">${escapeHtml(fileName)}</code> from workstation <code style="color: #10b981;">${escapeHtml(targetIp)}</code>...`;

        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("server_control").doc("main_server").set({
                pullAction: {
                    targetIp: targetIp,
                    filename: fileName,
                    subfolder: "student_submissions"
                },
                pullResult: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        terminalOutputBody.appendChild(responseDiv);
    }
    else if (cleanCommand.startsWith('push ')) {
        const parts = cleanCommand.split(' ');
        const targetIp = parts[1];
        const fileName = parts.slice(2).join(' ');

        if (!targetIp || !fileName) {
            responseDiv.style.color = "#f43f5e";
            responseDiv.innerHTML = `[✖] Invalid syntax. Usage: <code style="color: #38bdf8;">push &lt;ip-address&gt; &lt;filename&gt;</code>`;
            terminalOutputBody.appendChild(responseDiv);
            return;
        }

        window._lastPushResult = null;

        responseDiv.style.color = "#38bdf8";
        responseDiv.innerHTML = `<i class="fa-solid fa-upload"></i> [✔] Initiating selective push of <code style="color: #f43f5e;">${escapeHtml(fileName)}</code> to workstation <code style="color: #10b981;">${escapeHtml(targetIp)}</code>...`;

        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("server_control").doc("main_server").set({
                pushAction: {
                    targetIp: targetIp,
                    filename: fileName,
                    subfolder: "repository"
                },
                pushResult: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        terminalOutputBody.appendChild(responseDiv);
    }
    else if (cleanCommand === 'clear') {
        terminalOutputBody.innerHTML = `<div style="color: #94a3b8; margin-bottom: 0.5rem;">SAMCAM Solutions Network CLI [Version 2.6.0 - Dynamic SaaS Standard]</div>`;
        return;
    } 
    else if (cleanCommand === 'help') {
        responseDiv.style.color = "#fbbf24";
        responseDiv.innerHTML = `Available Dynamic Enterprise Commands:<br>
        - <span style="color: #38bdf8;">ping &lt;ip-address&gt;</span> : Trigger dynamic ICMP loopback probe via database daemon<br>
        - <span style="color: #38bdf8;">broadcast &lt;message&gt;</span> : Push global alert payload to active cluster edge nodes via Firestore<br>
        - <span style="color: #38bdf8;">server start [path]</span> : Spin up local LAN HTTP server / repository on host node<br>
        - <span style="color: #38bdf8;">server stop</span> : Gracefully terminate the local LAN file server daemon<br>
        - <span style="color: #38bdf8;">server status</span> : Query live host server binding properties from Firestore<br>
        - <span style="color: #38bdf8;">browse &lt;ip-address&gt;</span> : Request directory and file listing from a workstation node<br>
        - <span style="color: #38bdf8;">pull &lt;ip-address&gt; &lt;filename&gt;</span> : Select and copy a specific file from a workstation node<br>
        - <span style="color: #38bdf8;">push &lt;ip-address&gt; &lt;filename&gt;</span> : Push repository file down to a target workstation node<br>
        - <span style="color: #38bdf8;">systemctl status &lt;service&gt;</span> : Query backend daemon health dynamically from database registry<br>
        - <span style="color: #38bdf8;">nodes list</span> : Inspect active subnet IP leases and nodes dynamically from Firestore<br>
        - <span style="color: #38bdf8;">clear</span> : Purge terminal output buffer`;
        terminalOutputBody.appendChild(responseDiv);
    } 
    else if (cleanCommand.startsWith('systemctl status')) {
        const serviceName = cleanCommand.replace('systemctl status', '').trim() || 'net-backbone.service';
        responseDiv.style.color = "#10b981";
        responseDiv.innerHTML = `[i] Querying live service status for <code style="color: #38bdf8;">${escapeHtml(serviceName)}</code> from Firestore...`;
        terminalOutputBody.appendChild(responseDiv);

        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("services").doc(serviceName.replace(/[\/\.]/g, '_')).get().then((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    responseDiv.innerHTML = `● ${escapeHtml(serviceName)} - ${escapeHtml(data.description || 'Cloud Infrastructure Daemon')}<br>` +
                    `&nbsp;&nbsp;Active: <span style="color: #10b981; font-weight: 600;">${escapeHtml(data.status || 'active (running)')}</span><br>` +
                    `&nbsp;&nbsp;Main PID: ${escapeHtml(String(data.pid || 'N/A'))}<br>` +
                    `&nbsp;&nbsp;Diagnostic Status: "${escapeHtml(data.message || 'Operational')}"`;
                } else {
                    responseDiv.innerHTML = `● ${escapeHtml(serviceName)}<br>&nbsp;&nbsp;Status: <span style="color: #fbbf24;">Active (Dynamic Mock Registry)</span><br>&nbsp;&nbsp;Note: No explicit database record found for '${escapeHtml(serviceName)}', returning live fallback state.`;
                }
                terminalOutputBody.scrollTop = terminalOutputBody.scrollHeight;
            }).catch((err) => {
                responseDiv.style.color = "#f43f5e";
                responseDiv.innerHTML = `[✖] Failed to query service status: ${escapeHtml(err.message)}`;
                terminalOutputBody.scrollTop = terminalOutputBody.scrollHeight;
            });
        }
        return;
    }
    else if (cleanCommand === 'nodes list' || cleanCommand === 'nodes') {
        responseDiv.style.color = "#a855f7";
        responseDiv.innerHTML = `[i] Fetching active subnet edge nodes dynamically from Firestore...`;
        terminalOutputBody.appendChild(responseDiv);

        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            firebase.firestore().collection("workstations").get().then((querySnapshot) => {
                if (querySnapshot.empty) {
                    responseDiv.innerHTML = `[i] Active Subnet Edge Nodes: No registered workstations found in Firestore collection 'workstations'.`;
                } else {
                    let html = `[i] Active Subnet Edge Nodes (Dynamic Cluster Registry):<br>`;
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        const ip = data.ipAddress || data.ip || 'Unknown IP';
                        const name = data.name || doc.id;
                        const status = data.status || 'ONLINE';
                        const latency = data.latency || 'N/A';
                        html += `- ${escapeHtml(ip)} [${escapeHtml(name)}]: <span style="color: #10b981;">${escapeHtml(status)}</span> (Latency: ${escapeHtml(latency)})<br>`;
                    });
                    responseDiv.innerHTML = html;
                }
                terminalOutputBody.scrollTop = terminalOutputBody.scrollHeight;
            }).catch((err) => {
                responseDiv.style.color = "#f43f5e";
                responseDiv.innerHTML = `[✖] Failed to load nodes from database: ${escapeHtml(err.message)}`;
                terminalOutputBody.scrollTop = terminalOutputBody.scrollHeight;
            });
        }
        return; 
    }
    else {
        responseDiv.style.color = "#f43f5e";
        responseDiv.innerHTML = `[✖] Command not recognized: '${escapeHtml(cleanCommand)}'. Type 'help' for available dynamic enterprise command strings.`;
        terminalOutputBody.appendChild(responseDiv);
    }

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
                    if (data.sender && data.sender !== "root@samcam-hub" && data.message) {
                        const terminalBody = document.querySelector('#broadcastConsoleView div[style*="font-family: monospace"], #broadcastConsoleView div.font-mono, #broadcastConsoleView .bg-slate-900');
                        if (terminalBody) {
                            const liveAlertDiv = document.createElement('div');
                            liveAlertDiv.style.cssText = "margin-bottom: 0.75rem; color: #38bdf8; background: rgba(56, 189, 248, 0.08); padding: 6px 10px; border-left: 3px solid #38bdf8; border-radius: 4px;";
                            liveAlertDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>CLUSTER BROADCAST [${escapeHtml(data.sender)}]:</strong> ${escapeHtml(data.message)}`;
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

// Real-time Firestore listener for host daemon file operations and ping responses
function initDaemonResponseListener() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;

    const db = firebase.firestore();
    db.collection("server_control").doc("main_server").onSnapshot((doc) => {
        if (!doc.exists) return;
        const data = doc.data();
        const terminalBody = document.querySelector('#broadcastConsoleView div[style*="font-family: monospace"], #broadcastConsoleView div.font-mono, #broadcastConsoleView .bg-slate-900');
        if (!terminalBody) return;

        // Display ping results returned from the Python daemon/node
        if (data.pingResult && data.pingResult !== window._lastPingResult) {
            window._lastPingResult = data.pingResult;
            const resDiv = document.createElement('div');
            resDiv.style.cssText = "margin-bottom: 0.75rem; color: #10b981;";
            resDiv.innerHTML = `${escapeHtml(data.pingResult)}`;
            terminalBody.appendChild(resDiv);
            terminalBody.scrollTop = terminalBody.scrollHeight;
        }

        // Display browse results returned from the Python daemon
        if (data.browseResult && data.browseResult !== window._lastBrowseResult) {
            window._lastBrowseResult = data.browseResult;
            const resDiv = document.createElement('div');
            resDiv.style.cssText = "margin-bottom: 0.75rem; color: #38bdf8;";
            resDiv.innerHTML = `<i class="fa-solid fa-folder-tree"></i> ${escapeHtml(data.browseResult)}`;
            terminalBody.appendChild(resDiv);
            terminalBody.scrollTop = terminalBody.scrollHeight;
        }

        // Display pull results returned from the Python daemon
        if (data.pullResult && data.pullResult !== window._lastPullResult) {
            window._lastPullResult = data.pullResult;
            const resDiv = document.createElement('div');
            resDiv.style.cssText = "margin-bottom: 0.75rem; color: #10b981;";
            resDiv.innerHTML = `${escapeHtml(data.pullResult)}`;
            terminalBody.appendChild(resDiv);
            terminalBody.scrollTop = terminalBody.scrollHeight;
        }

        // Display push results returned from the Python daemon
        if (data.pushResult && data.pushResult !== window._lastPushResult) {
            window._lastPushResult = data.pushResult;
            const resDiv = document.createElement('div');
            resDiv.style.cssText = "margin-bottom: 0.75rem; color: #10b981;";
            resDiv.innerHTML = `${escapeHtml(data.pushResult)}`;
            terminalBody.appendChild(resDiv);
            terminalBody.scrollTop = terminalBody.scrollHeight;
        }
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
