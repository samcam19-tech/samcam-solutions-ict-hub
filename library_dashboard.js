let allResources = [];

document.addEventListener("DOMContentLoaded", () => {
  fetchLibraryResources();
});

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

// Fetch resources from Firestore collection 'e_library_resources'
async function fetchLibraryResources() {
  const tbody = document.getElementById("libraryTableBody");
  if (!db) return;

  try {
    const snapshot = await db.collection("e_library_resources").orderBy("createdAt", "desc").get();
    allResources = [];
    snapshot.forEach(doc => {
      allResources.push({ id: doc.id, ...doc.data() });
    });
    renderLibraryTable(allResources);
  } catch (error) {
    console.error("Error fetching library data:", error);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--danger);">Error loading resources.</td></tr>`;
  }
}

function renderLibraryTable(resources) {
  const tbody = document.getElementById("libraryTableBody");
  if (!tbody) return;

  if (resources.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No resources found.</td></tr>`;
    return;
  }

  tbody.innerHTML = resources.map(res => `
    <tr>
      <td>
        <strong>${escapeHtml(res.title)}</strong><br>
        <small style="color:var(--text-muted);">${escapeHtml(res.fileName || 'No file attached')}</small>
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
  `).join('');
}

function filterLibraryTable() {
  const query = document.getElementById("librarySearch").value.toLowerCase().trim();
  const filtered = allResources.filter(r => 
    (r.title || '').toLowerCase().includes(query) ||
    (r.category || '').toLowerCase().includes(query) ||
    (r.classLevel || '').toLowerCase().includes(query)
  );
  renderLibraryTable(filtered);
}

// Handle Form Submission for Create & Update
async function handleLibraryFormSubmit(e) {
  e.preventDefault();

  const editingId = document.getElementById("editingResourceId").value;
  const title = document.getElementById("resTitle").value.trim();
  const description = document.getElementById("resDescription").value.trim(); // Captured description field
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

    // If a new file is uploaded, push it to Firebase Storage
    if (file) {
      const storageRef = firebase.storage().ref();
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
      const fileRef = storageRef.child(`e_library_resources/${classLevel}/${safeName}`);
      
      const snapshot = await fileRef.put(file);
      fileUrl = await snapshot.ref.getDownloadURL();
      fileName = file.name;
      fileType = file.type || 'unknown';
    }

    if (editingId) {
      // UPDATE EXISTING RECORD
      const updateData = {
        title,
        description, // Include description in update payload
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
      alert("Resource updated successfully!");
    } else {
      // CREATE NEW RECORD
      if (!file) {
        alert("Please select a file for a new resource.");
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fa-solid fa-upload"></i> Save Resource`;
        return;
      }

      await db.collection("e_library_resources").add({
        title,
        description, // Include description in creation payload
        classLevel,
        category,
        accessType,
        price,
        fileUrl,
        fileName,
        fileType,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert("Resource uploaded successfully!");
    }

    resetLibraryForm();
    fetchLibraryResources();

  } catch (error) {
    console.error("Error saving resource:", error);
    alert("Operation failed. Check console for details.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="fa-solid fa-upload"></i> Save Resource`;
  }
}

// Load data into form for editing
function editResource(id) {
  const res = allResources.find(r => r.id === id);
  if (!res) return;

  document.getElementById("editingResourceId").value = res.id;
  document.getElementById("resTitle").value = res.title || '';
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

// Delete Resource
async function deleteResource(id, fileUrl) {
  if (!confirm("Are you sure you want to delete this resource?")) return;

  try {
    // Delete document from Firestore
    await db.collection("e_library_resources").doc(id).delete();

    // Optional: Attempt to delete file from Firebase Storage if URL exists
    if (fileUrl) {
      try {
        const desertRef = firebase.storage().refFromURL(fileUrl);
        await desertRef.delete();
      } catch (storageErr) {
        console.warn("Could not delete physical file from storage:", storageErr);
      }
    }

    alert("Resource deleted successfully.");
    fetchLibraryResources();
  } catch (error) {
    console.error("Error deleting resource:", error);
    alert("Failed to delete resource.");
  }
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
