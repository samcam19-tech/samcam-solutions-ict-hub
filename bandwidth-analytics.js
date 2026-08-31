// bandwidth-analytics.js
// Connects to Firestore to pull live telemetry streams and interface load metrics.

window.initBandwidthAnalytics = function() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.warn("Firebase not initialized for Bandwidth Analytics.");
        return;
    }

    const db = firebase.firestore();
    
    // Listen to real-time bandwidth metrics from Firestore
    db.collection("network_telemetry").doc("bandwidth_stats")
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                updateBandwidthDOM(data);
            } else {
                // Initialize default metrics document if missing
                const initialData = {
                    ingress: "842.6 Mbps",
                    egress: "318.2 Mbps",
                    latency: "4.2 ms",
                    dropRate: "0.01 %",
                    ingressTrend: "+12.4% from baseline",
                    egressTrend: "+4.1% stable load"
                };
                db.collection("network_telemetry").doc("bandwidth_stats").set(initialData);
            }
        }, (error) => {
            console.error("Error fetching bandwidth telemetry: ", error);
        });
};

window.refreshBandwidthMetrics = function() {
    const refreshBtn = document.querySelector('#bandwidthAnalyticsView .btn-primary');
    if (!refreshBtn) return;

    const originalHTML = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Syncing...';

    if (typeof firebase !== 'undefined' && firebase.apps.length) {
        const db = firebase.firestore();
        // Simulate real-time metric fluctuations on refresh and push to Firestore
        const randomIngress = (700 + Math.random() * 200).toFixed(1) + " Mbps";
        const randomEgress = (250 + Math.random() * 100).toFixed(1) + " Mbps";
        const randomLatency = (3.0 + Math.random() * 3.0).toFixed(1) + " ms";

        db.collection("network_telemetry").doc("bandwidth_stats").update({
            ingress: randomIngress,
            egress: randomEgress,
            latency: randomLatency
        }).then(() => {
            setTimeout(() => {
                refreshBtn.innerHTML = originalHTML;
            }, 600);
        }).catch((err) => {
            console.error("Failed to update telemetry metrics:", err);
            refreshBtn.innerHTML = originalHTML;
        });
    } else {
        setTimeout(() => {
            refreshBtn.innerHTML = originalHTML;
        }, 600);
    }
};

function updateBandwidthDOM(data) {
    const view = document.getElementById('bandwidthAnalyticsView');
    if (!view) return;

    const cards = view.querySelectorAll('div[style*="background: #ffffff"]');
    if (cards.length >= 4) {
        if (data.ingress) cards[0].querySelector('div:nth-child(2)').innerHTML = `${data.ingress.split(' ')[0]} <span style="font-size: 0.9rem; font-weight: 500; color: #0284c7;">Mbps</span>`;
        if (data.ingressTrend) cards[0].querySelector('div:nth-child(3)').innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> ${data.ingressTrend}`;

        if (data.egress) cards[1].querySelector('div:nth-child(2)').innerHTML = `${data.egress.split(' ')[0]} <span style="font-size: 0.9rem; font-weight: 500; color: #7c3aed;">Mbps</span>`;
        if (data.egressTrend) cards[1].querySelector('div:nth-child(3)').innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> ${data.egressTrend}`;

        if (data.latency) cards[2].querySelector('div:nth-child(2)').innerHTML = `${data.latency.split(' ')[0]} <span style="font-size: 0.9rem; font-weight: 500; color: #059669;">ms</span>`;
        if (data.dropRate) cards[3].querySelector('div:nth-child(2)').innerHTML = `${data.dropRate.split(' ')[0]} <span style="font-size: 0.9rem; font-weight: 500; color: #dc2626;">%</span>`;
    }
}
