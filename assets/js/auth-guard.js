/* ==========================================================================
   SAMCAM SOLUTIONS - AUTHENTICATION GUARD SCRIPT
   Secures protected pages by validating active portal session storage.
   ========================================================================== */

(function () {
  'use strict';

  function validateUserSession() {
    try {
      // Check both local and session storage for active credentials
      const sessionData = localStorage.getItem('portal_session') || sessionStorage.getItem('portal_session');
      
      if (!sessionData) {
        redirectToLogin();
        return;
      }

      const session = JSON.parse(sessionData);

      // Verify that the session object contains basic required identifiers
      if (!session || (!session.name && !session.email && !session.role && !session.userType)) {
        redirectToLogin();
        return;
      }

      // Optional: Check if a schoolId is mandatory for your multi-tenant portal
      // if (!session.schoolId && !session.schoolID && !session.institutionId) {
      //   redirectToLogin();
      //   return;
      // }

    } catch (e) {
      console.error("Session validation error:", e);
      redirectToLogin();
    }
  }

  function redirectToLogin() {
    // Prevent infinite redirect loops if already on the login index page
    const currentPath = window.location.pathname;
    if (currentPath.endsWith('index.html') || currentPath === '/' || currentPath === '') {
      return;
    }

    // Determine correct relative path back to root index.html based on depth
    // If your pages are in a subfolder (e.g., /portal/dashboard.html), '../index.html' works.
    // Adjust path string if pages reside deeper.
    window.location.replace('../index.html');
  }

  // Execute immediately before DOM rendering finishes to prevent content flashing
  validateUserSession();
})();
