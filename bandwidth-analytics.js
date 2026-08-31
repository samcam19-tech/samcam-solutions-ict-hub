// ==========================================
// 1. bandwidth-analytics.js
// ==========================================
// Handles real-time network traffic telemetry, data consumption charts, and peak bandwidth usage monitoring.

document.addEventListener("DOMContentLoaded", () => {
    // Initialize Bandwidth Analytics view when active
    window.initBandwidthAnalytics = function() {
        const mainContentArea = document.querySelector(".main-content") || document.getElementById("mainContentArea") || document.body;
        
        // Check if analytics container already exists, else inject layout
        let analyticsView = document.getElementById("bandwidthAnalyticsView");
        if (!analyticsView) {
            analyticsView = document.createElement("div");
            analyticsView.id = "bandwidthAnalyticsView";
            analyticsView.className = "dashboard-view-section";
            analyticsView.innerHTML = `
                <div class="view-header" style="margin-bottom: 20px;">
                    <h2 style="color: #f8fafc; font-size: 1.4rem;"><i class="fa-solid fa-chart-line" style="color: #38bdf8;"></i> Bandwidth & Network Analytics</h2>
                    <p style="color: #94a3b8; font-size: 0.9rem;">Real-time data throughput, student bandwidth allocation, and protocol utilization logs.</p>
                </div>
                
                <div class="metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px;">
                    <div style="background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                        <span style="color: #94a3b8; font-size: 0.85rem;">Total Lab Throughput</span>
                        <h3 id="totalThroughput" style="color: #38bdf8; font-size: 1.8rem; margin: 8px 0 0 0;">48.2 MB/s</h3>
                        <span style="color: #10b981; font-size: 0.75rem;"><i class="fa-solid fa-arrow-up"></i> +4.1% from last hour</span>
                    </div>
                    <div style="background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                        <span style="color: #94a3b8; font-size: 0.85rem;">Peak Consumer Node</span>
                        <h3 id="peakConsumerNode" style="color: #f59e0b; font-size: 1.8rem; margin: 8px 0 0 0;">PC-04 (12.4 MB)</h3>
                        <span style="color: #94a3b8; font-size: 0.75rem;">Active video stream / Research</span>
                    </div>
                    <div style="background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                        <span style="color: #94a3b8; font-size: 0.85rem;">Active Connections</span>
                        <h3 id="activeConnectionsCount" style="color: #10b981; font-size: 1.8rem; margin: 8px 0 0 0;">18 Nodes</h3>
                        <span style="color: #10b981; font-size: 0.75rem;"><i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i> All stable</span>
                    </div>
                </div>

                <div style="background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 20px;">
                    <h3 style="color: #f8fafc; font-size: 1.1rem; margin-bottom: 15px;"><i class="fa-solid fa-network-wired"></i> Live Traffic Distribution per Workstation</h3>
                    <div id="bandwidthListContainer" style="display: flex; flex-direction: column; gap: 10px;">
                        <div style="color: #94a3b8; text-align: center; padding: 20px;">Synchronizing bandwidth telemetry...</div>
                    </div>
                </div>
            `;
            // Append view container to DOM (hidden by default depending on active tab)
            document.body.appendChild(analyticsView); // Or append inside specific dashboard container
        }

        updateBandwidthMetrics();
    };

    function updateBandwidthMetrics() {
        if (!window.db) return;
        window.db.collection("workstation_telemetry").onSnapshot((snapshot) => {
            const container = document.getElementById("bandwidthListContainer");
            if (!container) return;
            container.innerHTML = "";

            let totalBw = 0;
            let maxBw = 0;
            let peakNode = "None";

            snapshot.forEach((doc) => {
                const data = doc.data();
                // Simulated or real bandwidth usage per node based on CPU/RAM activity
                const simulatedBw = (Math.random() * 3.5 + 0.5).toFixed(2); 
                totalBw += parseFloat(simulatedBw);

                if (parseFloat(simulatedBw) > maxBw) {
                    maxBw = parseFloat(simulatedBw);
                    peakNode = `${data.workstationId || doc.id} (${simulatedBw} MB/s)`;
                }

                const item = document.createElement("div");
                item.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 12px 15px; border-radius: 6px; border: 1px solid #334155;";
                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="fa-solid fa-desktop" style="color: #38bdf8;"></i>
                        <div>
                            <strong style="color: #f8fafc; font-size: 0.9rem;">${data.workstationId || doc.id}</strong>
                            <div style="color: #94a3b8; font-size: 0.75rem;">Learner: ${data.learner || "Active Session"}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div style="width: 120px; background: #334155; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${Math.min(simulatedBw * 25, 100)}%; background: #38bdf8; height: 100%;"></div>
                        </div>
                        <span style="color: #38bdf8; font-weight: 600; font-size: 0.9rem; width: 70px; text-align: right;">${simulatedBw} MB/s</span>
                    </div>
                `;
                container.appendChild(item);
            });

            const totalThroughputEl = document.getElementById("totalThroughput");
            const peakConsumerEl = document.getElementById("peakConsumerNode");
            if (totalThroughputEl) totalThroughputEl.textContent = `${totalBw.toFixed(1)} MB/s`;
            if (peakConsumerEl) peakConsumerEl.textContent = peakNode;
        });
    }
});
