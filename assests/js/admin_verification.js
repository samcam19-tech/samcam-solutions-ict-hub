/* ==========================================================================
   ADMIN & TEACHER PAYMENT RECONCILIATION SCRIPT (SESSION-BASED)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  checkAdminAuthorization();
});

let pendingPaymentsList = [];
let currentSchoolId = ''; // Global schoolId tracking context for payments

// 1. Role Guard: Read session data from localStorage and check user role
function checkAdminAuthorization() {
  const restrictedView = document.getElementById('authRestrictedView');
  const allowedPanel = document.getElementById('adminVerificationPanel');

  let sessionUser = null;
  try {
    sessionUser = JSON.parse(localStorage.getItem('portal_session'));
  } catch (e) {
    console.error("Error parsing portal session:", e);
  }

  // Check if session exists and role is Admin or Teacher (case-insensitive check)
  const role = sessionUser && sessionUser.role ? sessionUser.role.trim().toLowerCase() : '';
  const isAuthorized = role === 'admin' || role === 'teacher';

  if (!isAuthorized) {
    if (restrictedView) restrictedView.style.display = 'block';
    if (allowedPanel) allowedPanel.style.display = 'none';
    return;
  }

  if (restrictedView) restrictedView.style.display = 'none';
  if (allowedPanel) allowedPanel.style.display = 'block';

  // Extract schoolId from URL parameters if present
  const params = new URLSearchParams(window.location.search);
  if (params.has('schoolId')) {
    currentSchoolId = params.get('schoolId').toLowerCase().trim();
  } else if (sessionUser && sessionUser.schoolId) {
    currentSchoolId = sessionUser.schoolId.toLowerCase().trim();
  }

  // Load real-time pending payments queue
  fetchPendingPayments();
}

// 2. Fetch Pending Payments from Firestore (Scoped by schoolId if active)
function fetchPendingPayments() {
  if (!window.db) return;

  let queryRef = window.db.collection("pending_payments").where("status", "==", "pending");
  
  if (currentSchoolId) {
    queryRef = queryRef.where("schoolId", "==", currentSchoolId);
  }

  queryRef.onSnapshot((snapshot) => {
    pendingPaymentsList = [];
    snapshot.forEach((doc) => {
      pendingPaymentsList.push({
        id: doc.id,
        ...doc.data()
      });
    });

    renderPendingTable(pendingPaymentsList);
  }, (error) => {
    console.error("Error fetching pending payments:", error);
  });
}

// 3. Render Table Data
function renderPendingTable(payments) {
  const tbody = document.getElementById("pendingPaymentsTableBody");
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding: 2rem;">No pending payment verifications found.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  payments.forEach((item) => {
    const formattedDate = item.createdAt && item.createdAt.toDate ? item.createdAt.toDate().toLocaleString() : 'Just now';
    const badgeColor = item.network === 'MTN' ? '#eab308' : '#ef4444';
    const itemSchoolId = item.schoolId || 'global';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formattedDate}</td>
      <td>
        <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;"><i class="fa-solid fa-school"></i> ${itemSchoolId.toUpperCase()}</span>
      </td>
      <td>
        <span style="background: ${badgeColor}; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${item.network}</span>
        <br><strong style="font-size: 0.85rem;">${item.phone}</strong>
      </td>
      <td style="font-size: 0.85rem; color: var(--text-muted); font-family: monospace;">${item.resourceId ? item.resourceId.substring(0, 10) : ''}...</td>
      <td><code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: var(--primary);">${item.transactionId}</code></td>
      <td><span class="badge" style="background: #fef3c7; color: #92400e;">Pending Review</span></td>
      <td>
        <button onclick="approvePayment('${item.id}', '${item.resourceId}')" class="btn-action btn-approve" title="Confirm Received on Line">
          <i class="fa-solid fa-check"></i> Approve
        </button>
        <button onclick="rejectPayment('${item.id}')" class="btn-action btn-delete" title="Reject Invalid TID">
          <i class="fa-solid fa-xmark"></i> Reject
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 4. Approve Payment: Matches the line and marks it approved
async function approvePayment(paymentId, resourceId) {
  if (!confirm("Are you sure you have verified this Transaction ID on your physical phone/line statement?")) return;

  let approverName = 'Admin';
  try {
    const session = JSON.parse(localStorage.getItem('portal_session'));
    if (session && session.name) {
      approverName = session.name;
    }
  } catch (e) {
    // fallback
  }

  try {
    await window.db.collection("pending_payments").doc(paymentId).update({
      status: "approved",
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      approvedBy: approverName
    });

    alert("✅ Payment approved successfully! The transaction is now reconciled.");
  } catch (error) {
    console.error("Error approving payment:", error);
    alert("Failed to update approval status.");
  }
}

// 5. Reject Invalid Payment
async function rejectPayment(paymentId) {
  const reason = prompt("Enter reason for rejection (e.g., Invalid TID or funds not received):");
  if (!reason) return;

  try {
    await window.db.collection("pending_payments").doc(paymentId).update({
      status: "rejected",
      rejectionReason: reason,
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Payment request rejected.");
  } catch (error) {
    console.error("Error rejecting payment:", error);
  }
}

// 6. Search / Filter Table Function
function filterPendingPayments() {
  const query = document.getElementById("paymentSearch").value.toLowerCase();
  const filtered = pendingPaymentsList.filter(item => 
    item.phone.toLowerCase().includes(query) ||
    item.transactionId.toLowerCase().includes(query) ||
    item.network.toLowerCase().includes(query) ||
    (item.schoolId && item.schoolId.toLowerCase().includes(query))
  );
  renderPendingTable(filtered);
}
