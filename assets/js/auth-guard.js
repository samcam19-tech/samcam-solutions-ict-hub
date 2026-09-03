/* ==========================================================================
   SAMCAM SOLUTIONS - DUAL AUTHENTICATION & ROUTING GUARD SCRIPT
   - Redirects unauthenticated users away from protected pages to login.
   - Redirects already-authenticated users away from login to the assessments portal.
   ========================================================================== */

(function () {
  'use strict';

  function handleAuthRouting() {
    try {
      const sessionData = localStorage.getItem('portal_session') || sessionStorage.getItem('portal_session');
      const hasSession = !!sessionData;
      
      const pathname = window.location.pathname;
      
      // Determine if the current page is a protected subfolder page
      const isSubfolderPage = pathname.includes('/classes/') || 
                            pathname.includes('/quiz/') || 
                            pathname.includes('/forum/') ||
                            pathname.includes('/blogs/') || 
                            pathname.includes('/deep-staff/') ||
                            pathname.includes('/network-manager/') || 
                            pathname.includes('/payments/') ||
                            pathname.includes('/logs/') || 
                            pathname.includes('/logs/') || 
                            pathname.includes('/profile/') || 
                            pathname.includes('/super-admin/') ||    
                            pathname.includes('/assessments/') || 
                            pathname.includes('/library-dashboard/') || 
                            pathname.includes('/e-library/') ||
                            pathname.includes('/formula/') ||
                            pathname.includes('/announcements/');

      const isLoginPage = !isSubfolderPage && (pathname.endsWith('index.html') || pathname.endsWith('/') || pathname === '');

      if (isLoginPage) {
        // Rule 1: If already logged in, skip the login page and route straight to assessments
        if (hasSession) {
          try {
            const session = JSON.parse(sessionData);
            if (session && (session.name || session.email || session.role || session.userType)) {
              window.location.replace('/e-library/');
              return;
            }
          } catch (err) {
            // Invalid session payload, allow login form view
          }
        }
      } else {
        // Rule 2: If NOT logged in, block access to protected subfolder pages and send to login
        if (!hasSession) {
          window.location.replace('/');
          return;
        }

        // Validate session structural integrity
        const session = JSON.parse(sessionData);
        if (!session || (!session.name && !session.email && !session.role && !session.userType)) {
          window.location.replace('/');
        }
      }
    } catch (e) {
      console.error("Auth routing validation error:", e);
      // Fail-safe: boot unverified states back to login if outside root index
      if (!window.location.pathname.endsWith('index.html') || window.location.pathname.includes('/classes/')) {
        window.location.replace('/');
      }
    }
  }

  // Execute immediately during document parsing to prevent content flashing
  handleAuthRouting();
})();
