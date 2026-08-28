/* ==========================================================================
   SAMCAM SOLUTIONS - ADMIN LIBRARY ENGINE (v2.8 - Multi-Tenant Isolated)
   ========================================================================== */

let allResources = [];
let downloadsChartInstance = null;
let selectedResourceIds = new Set();

document.addEventListener("DOMContentLoaded", () => {
  initTenantContext();
  fetchLibraryResources();
});

function initTenantContext() {
  if (typeof currentSchoolId === 'undefined' || !currentSchoolId) {
    const session = JSON.parse(localStorage.getItem('portal_session') || localStorage.getItem('currentLoggedInUser') || '{}');
    window.currentSchoolId = (session.schoolId || session.schoolID || '').toLowerCase().trim();
  }
}

// Lightweight small ID generator (7 characters alphanumeric)
function generateSmallId(length = 7) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function togglePriceField() {
  const accessType = document.getElementById("resAccessType").value;
  const priceGroup = document.getElementById("priceGroup");
  const priceInput = document.getElementById("resPrice");

  if (accessType === "paid") {
    priceGroup.style.display = "block";
    priceInput.required = true;
  } else {
    priceGroup.style.display = "none";
    priceInput.required = false;
    priceInput.value = "";
  }
}

// Fetch resources from Firestore collection 'e_library_resources' filtered strictly by schoolId
async function fetchLibraryResources() {
  const tbody = document.getElementById("libraryTableBody");
  if (!db) return;

  initTenantContext();

  try {
    let query = db.collection("e_library_resources");
    
    // Strict Tenant Filtering: If schoolId is defined, limit query to this tenant only
    if (typeof currentSchoolId !== 'undefined' && currentSchoolId) {
      query = query.where("schoolId", "==", currentSchoolId);
    } else {
      console.warn("Warning: currentSchoolId is not set. Fetching global/unfiltered data.");
    }
     
    const snapshot = await query.orderBy("createdAt", "desc").get();
    allResources = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Double check tenant match client-side as a security guardrail
      if (!currentSchoolId || (data.schoolId || '').toLowerCase() === currentSchoolId.toLowerCase()) {
        allResources.push({ id: doc.id, ...data });
      }
    });
     
    updateKpiMetrics();
    renderResourceStatsTable();
    renderDownloadsChart();
    applyAdvancedFilters();
  } catch (error) {
    console.error("Error fetching library data:", error);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--danger);">Error loading resources for your school.</td></tr>`;
  }
}

// Update KPI Metrics Cards
function updateKpiMetrics() {
  const total = allResources.length;
  const free = allResources.filter(r => r.accessType === 'free').length;
  const paid = allResources.filter(r => r.accessType === 'paid').length;

  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiFree").textContent = free;
  document.getElementById("kpiPaid").textContent = paid;
}

// Render or Update Chart.js Bar Graph
function renderDownloadsChart() {
  const ctx = document.getElementById("downloadsChart").getContext("2d");

  const classes = ["S1", "S2", "S3", "S4", "S5", "S6", "General"];
  
  const downloadCountsByClass = classes.map(cls => {
    return allResources
      .filter(r => r.classLevel === cls)
      .reduce((sum, r) => sum + (Number(r.downloads) || 0), 0);
  });

  if (downloadsChartInstance) {
    downloadsChartInstance.data.datasets[0].data = downloadCountsByClass;
    downloadsChartInstance.update();
    return;
  }

  downloadsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ["Senior 1", "Senior 2", "Senior 3", "Senior 4", "Senior 5", "Senior 6", "General"],
      datasets: [{
        label: 'Total Downloads',
        data: downloadCountsByClass,
        backgroundColor: '#4f46e5',
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { font: { family: 'Inter', size: 12 }, boxWidth: 14, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Inter', size: 13 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'Inter' }, precision: 0 },
          title: { display: true, text: 'Number of Downloads', font: { family: 'Inter', size: 12, weight: '600' }, color: '#475569' }
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Inter' } },
          title: { display: true, text: 'Class Level', font: { family: 'Inter', size: 12, weight: '600' }, color: '#475569' }
        }
      }
    }
  });
}

// Advanced Filtering (Combining Search, Class Level, and Access Type)
function applyAdvancedFilters() {
  const searchQuery = document.getElementById("librarySearch").value.toLowerCase().trim();
  const classFilter = document.getElementById("filterClass").value;
  const accessFilter = document.getElementById("filterAccess").value;

  const filtered = allResources.filter(r => {
    const matchesSearch = (r.title || '').toLowerCase().includes(searchQuery) ||
                          (r.category || '').toLowerCase().includes(searchQuery) ||
                          (r.description || '').toLowerCase().includes(searchQuery);
    
    const matchesClass = !classFilter || r.classLevel === classFilter;
    const matchesAccess = !accessFilter || r.accessType === accessFilter;

    return matchesSearch && matchesClass && matchesAccess;
  });

  renderLibraryTable(filtered);
}

function renderLibraryTable(resources) {
  const tbody = document.getElementById("libraryTableBody");
  if (!tbody) return;

  if (resources.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding: 2rem;">No matching resources found for your school.</td></tr>`;
    return;
  }

  tbody.innerHTML = resources.map(res => {
    const isChecked = selectedResourceIds.has(res.id) ? 'checked' : '';
    return `
      <tr class="${isChecked ? 'selected-row' : ''}">
        <td>
          <input type="checkbox" value="${res.id}" ${isChecked} onclick="toggleRowSelection('${res.id}', this)">
        </td>
        <td>
          <strong>${escapeHtml(res.title)}</strong><br>
          <small style="color:var(--text-muted);">${escapeHtml(res.description || res.fileName || 'No description provided')}</small>
        </td>
        <td>
          <span class="badge" style="background:#e0f2fe; color:#0369a1;">${res.classLevel}</span>
          <span style="font-size:0.8rem; color:var(--text-muted); display:block; margin-top:2px;">${res.category}</span>
        </td>
        <td>
          <span class="badge ${res.accessType === 'paid' ? 'badge-paid' : 'badge-free'}">
            ${res.accessType === 'paid' ? 'Paid / Private' : 'Free'}
          </span>
        </td>
        <td>${res.accessType === 'paid' ? `UGX ${Number(res.price || 0).toLocaleString()}` : '-'}</td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            <button onclick="editResource('${res.id}')" class="btn-action btn-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button onclick="deleteResource('${res.id}', '${res.fileUrl || ''}')" class="btn-action btn-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Row & Bulk Selection Management
function toggleRowSelection(id, checkbox) {
  if (checkbox.checked) {
    selectedResourceIds.add(id);
  } else {
    selectedResourceIds.delete(id);
  }
  updateBulkActionBar();
}

function toggleSelectAll(selectAllCheckbox) {
  const checkboxes = document.querySelectorAll('#libraryTableBody input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = selectAllCheckbox.checked;
    if (selectAllCheckbox.checked) {
      selectedResourceIds.add(cb.value);
    } else {
      selectedResourceIds.delete(cb.value);
    }
  });
  updateBulkActionBar();
}

function updateBulkActionBar() {
  const bar = document.getElementById("bulkActionBar");
  const countSpan = document.getElementById("selectedCount");
  const count = selectedResourceIds.size;

  if (count > 0) {
    bar.style.display = "flex";
    countSpan.textContent = count;
  } else {
    bar.style.display = "none";
  }
}

// Bulk Delete Action with Tenant Ownership Verification
async function bulkDeleteResources() {
  showCustomModal(
    "Confirm Bulk Deletion", 
    `Are you sure you want to delete ${selectedResourceIds.size} selected resources?`, 
    "warning", 
    true, 
    async function(confirmed) {
      if (!confirmed) return;

      try {
        const batchPromises = Array.from(selectedResourceIds).map(async id => {
          const res = allResources.find(r => r.id === id);
          
          // Security Guardrail: Confirm document matches tenant schoolId before deleting
          if (res && (!currentSchoolId || res.schoolId === currentSchoolId)) {
            await db.collection("e_library_resources").doc(id).delete();
            if (res.fileUrl) {
              try {
                await firebase.storage().refFromURL(res.fileUrl).delete();
              } catch (e) {
                console.warn("Storage delete warning:", e);
              }
            }
          }
        });

        await Promise.all(batchPromises);
        selectedResourceIds.clear();
        updateBulkActionBar();
        
        showCustomModal("Success", "Selected resources deleted successfully.", "success");
        fetchLibraryResources();
      } catch (error) {
        console.error("Bulk delete error:", error);
        showCustomModal("Error", "Failed to complete bulk deletion.", "error");
      }
    }
  );
}

// Handle Form Submission with Enforced Tenant schoolId Injection
async function handleLibraryFormSubmit(e) {
  e.preventDefault();
  initTenantContext();

  if (!currentSchoolId) {
    showCustomModal("Configuration Error", "No school context (schoolId) detected. Action aborted.", "error");
    return;
  }

  const editingId = document.getElementById("editingResourceId").value;
  const title = document.getElementById("resTitle").value.trim();
  const description = document.getElementById("resDescription").value.trim();
  const classLevel = document.getElementById("resClass").value;
  const category = document.getElementById("resCategory").value;
  const accessType = document.getElementById("resAccessType").value;
  const price = accessType === 'paid' ? Number(document.getElementById("resPrice").value) : 0;
  const fileInput = document.getElementById("resFile");
  const file = fileInput.files[0];
  const saveBtn = document.getElementById("saveResourceBtn");

  try {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;

    let fileUrl = "";
    let fileName = "";
    let fileType = "";

    if (file) {
      const storageRef = firebase.storage().ref();
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
      // Namespace file path by schoolId for complete storage tenant isolation
      const fileRef = storageRef.child(`e_library_resources/${currentSchoolId}/${classLevel}/${safeName}`);
      
      const snapshot = await fileRef.put(file);
      fileUrl = await snapshot.ref.getDownloadURL();
      fileName = file.name;
      fileType = file.type || 'unknown';
    }

    if (editingId) {
      // Verify ownership before updating
      const existingRes = allResources.find(r => r.id === editingId);
      if (existingRes && existingRes.schoolId !== currentSchoolId) {
        throw new Error("Unauthorized: Cannot modify resources belonging to another school.");
      }

      const updateData = {
        title,
        description,
        classLevel,
        category,
        accessType,
        price,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (fileUrl) {
        updateData.fileUrl = fileUrl;
        updateData.fileName = fileName;
        updateData.fileType = fileType;
      }

      await db.collection("e_library_resources").doc(editingId).update(updateData);
      showCustomModal("Success", "Resource updated successfully!", "success");
    } else {
      if (!file) {
        showCustomModal("Validation Error", "Please select a file for a new resource.", "warning");
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fa-solid fa-upload"></i> Save Resource`;
        return;
      }

      const customSmallId = generateSmallId(7);

      // Force inject currentSchoolId into the document payload
      await db.collection("e_library_resources").doc(customSmallId).set({
        id: customSmallId,
        schoolId: currentSchoolId, 
        title,
        description,
        classLevel,
        category,
        accessType,
        price,
        fileUrl,
        fileName,
        fileType,
        downloads: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showCustomModal("Success", "Resource uploaded successfully for your school!", "success");
    }

    resetLibraryForm();
    fetchLibraryResources();

  } catch (error) {
    console.error("Error saving resource:", error);
    showCustomModal("Error", error.message || "Operation failed. Check console for details.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="fa-solid fa-upload"></i> Save Resource`;
  }
}

// Load data into form for editing with security verification
function editResource(id) {
  const res = allResources.find(r => r.id === id);
  if (!res) return;

  if (currentSchoolId && res.schoolId && res.schoolId !== currentSchoolId) {
    showCustomModal("Access Denied", "You do not have permission to edit resources from another school.", "error");
    return;
  }

  document.getElementById("editingResourceId").value = res.id;
  document.getElementById("resTitle").value = res.title || '';
  document.getElementById("resDescription").value = res.description || '';
  document.getElementById("resClass").value = res.classLevel || 'S1';
  document.getElementById("resCategory").value = res.category || 'Notes';
  document.getElementById("resAccessType").value = res.accessType || 'free';
  togglePriceField();
  document.getElementById("resPrice").value = res.price || '';

  document.getElementById("formTitle").innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Resource`;
  document.getElementById("saveResourceBtn").innerHTML = `<i class="fa-solid fa-check"></i> Update Changes`;
  document.getElementById("cancelEditBtn").style.display = "inline-flex";

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetLibraryForm() {
  document.getElementById("libraryResourceForm").reset();
  document.getElementById("editingResourceId").value = "";
  togglePriceField();
  document.getElementById("formTitle").innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Upload New Resource`;
  document.getElementById("saveResourceBtn").innerHTML = `<i class="fa-solid fa-upload"></i> Save Resource`;
  document.getElementById("cancelEditBtn").style.display = "none";
}

// Delete Single Resource with Tenant Validation
async function deleteResource(id, fileUrl) {
  const res = allResources.find(r => r.id === id);
  if (res && currentSchoolId && res.schoolId && res.schoolId !== currentSchoolId) {
    showCustomModal("Access Denied", "Cannot delete resources belonging to another tenant.", "error");
    return;
  }

  showCustomModal(
    "Confirm Deletion", 
    "Are you sure you want to delete this resource?", 
    "warning", 
    true, 
    async function(confirmed) {
      if (!confirmed) return;

      try {
        await db.collection("e_library_resources").doc(id).delete();

        if (fileUrl) {
          try {
            const desertRef = firebase.storage().refFromURL(fileUrl);
            await desertRef.delete();
          } catch (storageErr) {
            console.warn("Could not delete physical file from storage:", storageErr);
          }
        }

        showCustomModal("Success", "Resource deleted successfully.", "success");
        fetchLibraryResources();
      } catch (error) {
        console.error("Error deleting resource:", error);
        showCustomModal("Error", "Failed to delete resource.", "error");
      }
    }
  );
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toggleMobileMenu() {
  const actions = document.getElementById('headerActions');
  const icon = document.getElementById('menuIcon');
  actions.classList.toggle('active');
  if (actions.classList.contains('active')) {
    icon.className = 'fa-solid fa-xmark';
  } else {
    icon.className = 'fa-solid fa-bars';
  }
}

let modalCallback = null;

function showCustomModal(title, message, type = 'info', isConfirm = false, callback = null) {
  const modal = document.getElementById("customModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalMessage = document.getElementById("modalMessage");
  const modalIcon = document.getElementById("modalIcon");
  const cancelBtn = document.getElementById("modalCancelBtn");
  const confirmBtn = document.getElementById("modalConfirmBtn");

  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalCallback = callback;

  if (type === 'success') {
    modalIcon.className = "fa-solid fa-circle-check";
    modalIcon.style.color = "#059669";
  } else if (type === 'error') {
    modalIcon.className = "fa-solid fa-circle-exclamation";
    modalIcon.style.color = "#dc2626";
  } else if (type === 'warning') {
    modalIcon.className = "fa-solid fa-triangle-exclamation";
    modalIcon.style.color = "#d97706";
  } else {
    modalIcon.className = "fa-solid fa-circle-info";
    modalIcon.style.color = "#4f46e5";
  }

  if (isConfirm) {
    cancelBtn.style.display = "block";
    confirmBtn.textContent = "Yes, Proceed";
  } else {
    cancelBtn.style.display = "none";
    confirmBtn.textContent = "OK";
  }

  modal.style.display = "flex";
}

function closeCustomModal(result) {
  const modal = document.getElementById("customModal");
  modal.style.display = "none";

  if (modalCallback && typeof modalCallback === 'function') {
    modalCallback(result);
    modalCallback = null;
  }
}

function renderResourceStatsTable() {
  const tbody = document.getElementById("resourceStatsTableBody");
  if (!tbody) return;

  if (allResources.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding: 1.5rem;">No resources available for your school.</td></tr>`;
    return;
  }

  const sortedResources = [...allResources].sort((a, b) => (Number(b.downloads) || 0) - (Number(a.downloads) || 0));

  tbody.innerHTML = sortedResources.map(res => `
    <tr>
      <td>
        <span class="stat-resource-title">${escapeHtml(res.title)}</span>
        <span class="stat-resource-cat">${escapeHtml(res.category || 'General')}</span>
      </td>
      <td class="text-center">
        <span class="badge" style="background:#e0f2fe; color:#0369a1; font-size: 0.75rem; padding: 2px 8px;">${res.classLevel}</span>
      </td>
      <td class="text-right">
        <span class="stat-download-count">${Number(res.downloads || 0).toLocaleString()}</span>
      </td>
    </tr>
  `).join('');
}
