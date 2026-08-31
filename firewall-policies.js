// ==========================================
// 2. firewall-policies.js
// ==========================================
// Manages lab network rules, website blocking/whitelisting, and security enforcement policies.

document.addEventListener("DOMContentLoaded", () => {
    window.initFirewallPolicies = function() {
        let firewallView = document.getElementById("firewallPoliciesView");
        if (!firewallView) {
            firewallView = document.createElement("div");
            firewallView.id = "firewallPoliciesView";
            firewallView.className = "dashboard-view-section";
            firewallView.innerHTML = `
                <div class="view-header" style="margin-bottom: 20px;">
                    <h2 style="color: #f8fafc; font-size: 1.4rem;"><i class="fa-solid fa-shield-halved" style="color: #ef4444;"></i> Firewall & Lab Security Policies</h2>
                    <p style="color: #94a3b8; font-size: 0.9rem;">Enforce URL filters, block distracting domains, and manage student internet access levels.</p>
                </div>

                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                    <div style="background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                        <h3 style="color: #f8fafc; font-size: 1.1rem; margin-bottom: 15px;"><i class="fa-solid fa-ban"></i> Restricted Domains & URL Blacklist</h3>
                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <input type="text" id="newBlockedUrl" placeholder="e.g. socialmedia.com or gaming site" style="flex: 1; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 10px; border-radius: 6px;" />
                            <button id="addBlockRuleBtn" style="background: #ef4444; border: none; color: #fff; padding: 0 20px; border-radius: 6px; cursor: pointer; font-weight: 600;"><i class="fa-solid fa-plus"></i> Block Domain</button>
                        </div>
                        <div id="blockedDomainsList" style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">
                            <!-- Populated dynamically -->
                        </div>
                    </div>

                    <div style="background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <h3 style="color: #f8fafc; font-size: 1.1rem; margin-bottom: 15px;"><i class="fa-solid fa-sliders"></i> Global Security Preset</h3>
                            <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 20px;">Instantly switch lab-wide firewall restriction enforcement tiers.</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <label style="display: flex; align-items: center; gap: 10px; color: #f8fafc; cursor: pointer; background: #0f172a; padding: 10px; border-radius: 6px; border: 1px solid #334155;">
                                    <input type="radio" name="firewallTier" value="strict" checked />
                                    <div>
                                        <strong style="display: block; font-size: 0.85rem;">Strict Exam Mode</strong>
                                        <span style="font-size: 0.75rem; color: #94a3b8;">Blocks all external sites except approved portal</span>
                                    </div>
                                </label>
                                <label style="display: flex; align-items: center; gap: 10px; color: #f8fafc; cursor: pointer; background: #0f172a; padding: 10px; border-radius: 6px; border: 1px solid #334155;">
                                    <input type="radio" name="firewallTier" value="guided" />
                                    <div>
                                        <strong style="display: block; font-size: 0.85rem;">Guided Research</strong>
                                        <span style="font-size: 0.75rem; color: #94a3b8;">Allows educational search & docs, blocks social media</span>
                                    </div>
                                </label>
                                <label style="display: flex; align-items: center; gap: 10px; color: #f8fafc; cursor: pointer; background: #0f172a; padding: 10px; border-radius: 6px; border: 1px solid #334155;">
                                    <input type="radio" name="firewallTier" value="open" />
                                    <div>
                                        <strong style="display: block; font-size: 0.85rem;">Open Lab</strong>
                                        <span style="font-size: 0.75rem; color: #94a3b8;">Standard unrestricted student access</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <button id="applyFirewallPreset" style="margin-top: 20px; background: #0ea5e9; border: none; color: #fff; padding: 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">Apply Firewall Tier</button>
                    </div>
                </div>
            `;
            document.body.appendChild(firewallView);
        }

        initFirewallListeners();
    };

    function initFirewallListeners() {
        const addBtn = document.getElementById("addBlockRuleBtn");
        const input = document.getElementById("newBlockedUrl");
        const listContainer = document.getElementById("blockedDomainsList");

        // Default static/dynamic sample blacklisted items
        let blockedDomains = ["discord.com", "facebook.com", "tiktok.com", "steamcommunity.com"];

        const renderBlacklist = () => {
            if (!listContainer) return;
            listContainer.innerHTML = "";
            blockedDomains.forEach((domain, idx) => {
                const row = document.createElement("div");
                row.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 10px 14px; border-radius: 6px; border: 1px solid #334155;";
                row.innerHTML = `
                    <span style="color: #f8fafc; font-size: 0.9rem;"><i class="fa-solid fa-globe" style="color: #ef4444; margin-right: 8px;"></i> ${domain}</span>
                    <button class="remove-domain-btn" data-index="${idx}" style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 0.9rem;"><i class="fa-solid fa-trash"></i></button>
                `;
                listContainer.appendChild(row);
            });

            // Bind remove buttons
            document.querySelectorAll(".remove-domain-btn").forEach(btn => {
                btn.onclick = (e) => {
                    const index = e.currentTarget.dataset.index;
                    blockedDomains.splice(index, 1);
                    renderBlacklist();
                };
            });
        };

        if (addBtn && input) {
            addBtn.onclick = () => {
                const val = input.value.trim().toLowerCase();
                if (val && !blockedDomains.includes(val)) {
                    blockedDomains.push(val);
                    input.value = "";
                    renderBlacklist();
                }
            };
        }

        renderBlacklist();

        const applyPresetBtn = document.getElementById("applyFirewallPreset");
        if (applyPresetBtn) {
            applyPresetBtn.onclick = async () => {
                const selectedTier = document.querySelector('input[name="firewallTier"]:checked').value;
                if (window.db) {
                    try {
                        await window.db.collection("lab_settings").doc("firewall").set({
                            tier: selectedTier,
                            blockedDomains: blockedDomains,
                            updatedAt: new Date().toISOString()
                        });
                        alert(`Firewall Policy successfully updated to: ${selectedTier.toUpperCase()}`);
                    } catch (err) {
                        console.error("Error updating firewall policy:", err);
                        alert("Failed to synchronize firewall settings to Firestore.");
                    }
                }
            };
        }
    }
});
