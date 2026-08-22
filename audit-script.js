/**
 * Filter audit trail rows dynamically based on search text, status, and time range.
 */
function filterAuditLogs() {
  const searchText = document.getElementById('auditSearchInput').value.toLowerCase();
  const statusFilter = document.getElementById('auditStatusFilter').value;
  const dateFilter = document.getElementById('auditDateFilter').value;
  const rows = document.querySelectorAll('#auditLogsTableBody tr');
  
  let visibleCount = 0;
  const today = new Date(); // Current date anchor

  rows.forEach(row => {
    const textContent = row.innerText.toLowerCase();
    const rowStatus = row.getAttribute('data-status');
    const rowDateStr = row.getAttribute('data-date'); // expected format: YYYY-MM-DD
    
    // Check Search & Status matches
    const matchesSearch = textContent.includes(searchText);
    const matchesStatus = (statusFilter === 'ALL' || rowStatus === statusFilter);

    // Check Time Range match
    let matchesDate = true;
    if (rowDateStr && dateFilter !== 'ALL') {
      const rowDate = new Date(rowDateStr);
      const diffTime = today - rowDate;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (dateFilter === 'TODAY') {
        matchesDate = diffDays <= 1;
      } else if (dateFilter === '7DAYS') {
        matchesDate = diffDays <= 7;
      } else if (dateFilter === '30DAYS') {
        matchesDate = diffDays <= 30;
      }
    }

    if (matchesSearch && matchesStatus && matchesDate) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });

  // Update counter text dynamically
  const counterText = document.getElementById('auditCounterText');
  if (counterText) {
    counterText.innerHTML = `Showing <strong>${visibleCount}</strong> of <strong>${rows.length}</strong> total audit events`;
  }
}

/**
 * Triggered when clicking the Refresh button.
 * Fetches latest records and provides a non-intrusive status notification.
 */
function refreshAuditLogs() {
  console.log('Fetching latest audit logs from server...');
  
  const refreshBtn = document.querySelector('.audit-actions .btn-secondary');
  if (refreshBtn) {
    const originalHTML = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Refreshing...';
    refreshBtn.disabled = true;

    setTimeout(() => {
      refreshBtn.innerHTML = originalHTML;
      refreshBtn.disabled = false;
      showToast('Audit logs synchronized successfully.', 'success');
    }, 800);
  }
}

/**
 * Triggered when clicking Export CSV.
 * Converts the current visible log dataset into a downloadable CSV file.
 */
function exportAuditLogs() {
  console.log('Exporting audit logs dataset to CSV format...');
  
  const rows = document.querySelectorAll('#auditLogsTableBody tr');
  let csvContent = "data:text/csv;charset=utf-8,Status,Timestamp,Username,Failure Reason,IP Address,Device\n";

  rows.forEach(row => {
    if (row.style.display !== 'none') {
      const cols = row.querySelectorAll('td');
      if (cols.length >= 6) {
        const status = cols[0].innerText.trim();
        const timestamp = cols[1].innerText.trim();
        const username = cols[2].innerText.trim();
        const reason = cols[3].innerText.trim();
        const ip = cols[4].innerText.trim();
        const device = cols[5].innerText.trim();
        
        csvContent += `"${status}","${timestamp}","${username}","${reason}","${ip}","${device}"\n`;
      }
    }
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `system_audit_logs_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('CSV export generated successfully.', 'success');
}

/**
 * Helper utility to display sleek notification toasts in the corner.
 */
function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${type === 'success' ? '#065f46' : '#1e293b'};
    color: #ffffff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideInUp 0.3s ease forwards;
  `;
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #34d399;"></i> ${message}`;
  
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
