/**
 * Filter audit trail rows dynamically based on search text and status.
 */
function filterAuditLogs() {
  const searchText = document.getElementById('auditSearchInput').value.toLowerCase();
  const statusFilter = document.getElementById('auditStatusFilter').value;
  const rows = document.querySelectorAll('#auditLogsTableBody tr');
  
  let visibleCount = 0;

  rows.forEach(row => {
    const textContent = row.innerText.toLowerCase();
    const rowStatus = row.getAttribute('data-status');

    const matchesSearch = textContent.includes(searchText);
    const matchesStatus = (statusFilter === 'ALL' || rowStatus === statusFilter);

    if (matchesSearch && matchesStatus) {
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
 */
function refreshAuditLogs() {
  console.log('Fetching latest audit logs from server...');
  alert('Audit logs refreshed successfully.');
}

/**
 * Triggered when clicking Export CSV.
 */
function exportAuditLogs() {
  console.log('Exporting audit logs dataset to CSV format...');
  alert('CSV export triggered. File download will start shortly.');
}
