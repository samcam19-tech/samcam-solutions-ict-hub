// ==========================================
// 3. broadcast-console.js
// ==========================================
// Advanced broadcast command center for pushing code snippets, quiz triggers, and announcement logs.

document.addEventListener("DOMContentLoaded", () => {
    window.initBroadcastConsole = function() {
        let broadcastView = document.getElementById("broadcastConsoleView");
        if (!broadcastView) {
            broadcastView = document.createElement("div");
            broadcastView.id = "broadcastConsoleView";
            broadcastView.className = "dashboard-view-section";
            broadcastView.innerHTML = `
                <div class="view-header" style="margin-bottom: 20px;">
                    <h2 style="color: #f8fafc; font-size: 1.4rem;"><i class="fa-solid fa-terminal" style="color: #10b981;"></i> Advanced Broadcast & Command Console</h2>
                    <p style="color: #94a3b8; font-size: 0.9rem;">Dispatch instant announcements, execute remote terminal commands, or push quick formative assessment prompts.</p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div style="background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                        <h3 style="color: #f8fafc; font-size: 1.1rem; margin-bottom: 15px;"><i class="fa-solid fa-paper-plane"></i> Quick Broadcast Dispatcher</h3>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; color: #94a3b8; font-size: 0.8rem; margin-bottom: 6px;">Broadcast Target Channel</label>
                            <select id="broadcastTargetChannel" style="width: 100%; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 10px; border-radius: 6px;">
                                <option value="all">All Connected Class Terminals</option>
                                <option value="active">Active Learners Only</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; color: #94a3b8; font-size: 0.8rem; margin-bottom: 6px;">Message / Instruction Content</label>
                            <textarea id="consoleBroadcastInput" placeholder="Enter clear instructions, starter code snippets, or alert notes..." style="width: 100%; height: 120px; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 10px; border-radius: 6px; resize: none;"></textarea>
                        </div>
                        <button id="dispatchConsoleMessageBtn" style="background: #10b981; border: none; color: #fff; width: 100%; padding: 12px; border-radius: 6px; font-weight: 600; cursor: pointer;"><i class="fa-solid fa-bullhorn"></i> Broadcast to Class</button>
                    </div>

                    <div style="background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155; display: flex; flex-direction: column;">
                        <h3 style="color: #f8fafc; font-size: 1.1rem; margin-bottom: 15px;"><i class="fa-solid fa-clock-rotate-left"></i> Recent Broadcast History</h3>
                        <div id="broadcastHistoryList" style="flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px; overflow-y: auto; max-height: 250px; display: flex; flex-direction: column; gap: 8px;">
                            <div style="color: #94a3b8; font-size: 0.85rem; text-align: center; padding: 20px;">No recent broadcast logs recorded in current session.</div>
                        </div>
                        <button id="clearBroadcastLogsBtn" style="margin-top: 15px; background: #475569; border: none; color: #fff; padding: 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer;">Clear Logs</button>
                    </div>
                </div>
            `;
            document.body.appendChild(broadcastView);
        }

        initBroadcastConsoleLogic();
    };

    function initBroadcastConsoleLogic() {
        const dispatchBtn = document.getElementById("dispatchConsoleMessageBtn");
        const textarea = document.getElementById("consoleBroadcastInput");
        const historyList = document.getElementById("broadcastHistoryList");
        const clearBtn = document.getElementById("clearBroadcastLogsBtn");

        let historyLogs = [];

        const renderHistory = () => {
            if (!historyList) return;
            if (historyLogs.length === 0) {
                historyList.innerHTML = `<div style="color: #94a3b8; font-size: 0.85rem; text-align: center; padding: 20px;">No recent broadcast logs recorded in current session.</div>`;
                return;
            }
            historyList.innerHTML = "";
            historyLogs.forEach(log => {
                const item = document.createElement("div");
                item.style.cssText = "background: #1e293b; padding: 8px 10px; border-radius: 4px; border-left: 3px solid #10b981; font-size: 0.85rem;";
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; color: #38bdf8; font-size: 0.75rem; margin-bottom: 3px;">
                        <span><i class="fa-solid fa-paper-plane"></i> Broadcast Sent</span>
                        <span>${log.time}</span>
                    </div>
                    <div style="color: #f8fafc; word-break: break-word;">${log.text}</div>
                `;
                historyList.appendChild(item);
            });
        };

        if (dispatchBtn && textarea) {
            dispatchBtn.onclick = async () => {
                const text = textarea.value.trim();
                if (!text) {
                    alert("Please enter a message before dispatching.");
                    return;
                }

                if (window.db) {
                    try {
                        const snapshot = await window.db.collection("workstation_telemetry").get();
                        const batch = window.db.batch();
                        const timestamp = new Date().toISOString();

                        snapshot.forEach((doc) => {
                            const ref = window.db.collection("workstation_telemetry").doc(doc.id);
                            batch.update(ref, {
                                pushedPrompt: {
                                    type: "console_broadcast",
                                    content: text,
                                    timestamp: timestamp
                                }
                            });
                        });

                        await batch.commit();

                        historyLogs.unshift({
                            text: text,
                            time: new Date().toLocaleTimeString()
                        });
                        renderHistory();
                        textarea.value = "";
                        alert("Broadcast successfully sent to all workstations via Console!");
                    } catch (err) {
                        console.error("Console broadcast error:", err);
                        alert("Failed to push broadcast. Check console logs.");
                    }
                }
            };
        }

        if (clearBtn) {
            clearBtn.onclick = () => {
                historyLogs = [];
                renderHistory();
            };
        }
    }
});
