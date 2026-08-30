// brand-loader.js - Dynamic Global Branding Engine
document.addEventListener("DOMContentLoaded", () => {
  const checkDbInterval = setInterval(async () => {
    if (window.db) {
      clearInterval(checkDbInterval);
      await loadGlobalPlatformBranding();
    }
  }, 50);
});

async function loadGlobalPlatformBranding() {
  try {
    const docSnap = await window.db.collection("system_config").doc("super_admin_settings").get();
    if (docSnap.exists) {
      const data = docSnap.data();
      
      // Match Firestore field names: systemName, systemLogoUrl, systemSlogan
      const systemName = data.systemName;
      const logoUrl = data.systemLogoUrl;
      const slogan = data.systemSlogan;

      // Dynamically update elements across any page using specific class hooks
      if (systemName) {
        document.querySelectorAll(".dynamic-system-name").forEach(el => {
          el.textContent = systemName;
        });
        // Update document title if not explicitly set otherwise
        if (!document.title.includes(systemName)) {
          document.title = `${systemName} | Portal`;
        }
      }

      if (logoUrl) {
        document.querySelectorAll(".dynamic-system-logo").forEach(el => {
          if (el.tagName === "IMG") {
            el.src = logoUrl;
          } else {
            el.style.backgroundImage = `url('${logoUrl}')`;
          }
        });
      }

      if (slogan) {
        document.querySelectorAll(".dynamic-system-slogan").forEach(el => {
          el.textContent = slogan;
        });
      }
    }
  } catch (error) {
    console.error("Failed to load global platform branding:", error);
  }
}
