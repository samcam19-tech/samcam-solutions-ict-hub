/* ==========================================================================
   SAMCAM SOLUTIONS - ACADEMIC PORTAL HUB ENGINE (v2.7 - Tenant Isolated & Hardened)
   ========================================================================== */

let allResources = [];
let currentClass = 'ALL';
let currentCategory = 'ALL';
let searchQuery = '';
let currentSchoolId = ''; // Global schoolId filter context

// --- PAGINATION STATE ---
let currentPage = 1;
const itemsPerPage = 6; // Number of resource cards per page

/* ==========================================================================
   BUSINESS PAYMENT CONFIGURATION
   ========================================================================== */
const SAMCAM_BUSINESS_ACCOUNTS = {
  MTN: { name: "SAMCAM SOLUTIONS", number: "0761230833", color: "#facc15" },    // MTN Yellow accent
  AIRTEL: { name: "AKUGIZIBWE SAMUEL", number: "0703999089", color: "#ef4444" } // Airtel Red accent
};


/* ==========================================================================
   SAMCAM SOLUTIONS - MAIN APP SCRIPT
   ========================================================================== */

// Use the global db instance initialized in firebase-config.js
const db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Theme
  initTheme();

  // Load state from URL parameters first before fetching data
  loadStateFromURL();

  // Fetch data live from Firebase Firestore filtered securely by tenant context
  fetchResourcesFromFirestore();

  // Scroll listener for Back to Top Button
  window.addEventListener('scroll', handleScroll);

  // Listen to browser back/forward navigation buttons to sync state seamlessly
  window.addEventListener('popstate', () => {
    loadStateFromURL();
    renderCards();
    syncUIControls();
  });
});

/* ==========================================================================
   URL STATE SYNCHRONIZATION & DEEP LINKING
   ========================================================================== */
function loadStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('page')) currentPage = parseInt(params.get('page'), 10) || 1;
  if (params.has('class')) currentClass = params.get('class');
  if (params.has('category')) currentCategory = params.get('category');
  if (params.has('schoolId')) currentSchoolId = params.get('schoolId').toLowerCase().trim();
  if (params.has('q')) {
    searchQuery = params.get('q').toLowerCase().trim();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = searchQuery;
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = searchQuery.length > 0 ? 'block' : 'none';
  }
}

function updateURL() {
  const params = new URLSearchParams();
  if (currentPage > 1) params.set('page', currentPage);
  if (currentClass !== 'ALL') params.set('class', currentClass);
  if (currentCategory !== 'ALL') params.set('category', currentCategory);
  if (currentSchoolId) params.set('schoolId', currentSchoolId);
  if (searchQuery.trim() !== '') params.set('q', searchQuery);

  const newQueryString = params.toString();
  const newRelativePathQuery = window.location.pathname + (newQueryString ? '?' + newQueryString : '');
  history.replaceState(null, '', newRelativePathQuery);
}

function syncUIControls() {
  // Sync Class segment active state
  document.querySelectorAll('#classFilterGroup .segment-btn').forEach(btn => {
    const btnText = btn.textContent.trim();
    if (btnText.toUpperCase() === currentClass.toUpperCase()) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Sync Category segment active state
  document.querySelectorAll('#categoryFilterGroup .segment-btn').forEach(btn => {
    const btnText = btn.textContent.trim();
    if (btnText.toUpperCase() === currentCategory.toUpperCase()) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/* ==========================================================================
   DATA FETCHING & TENANT-ISOLATED INITIALIZATION (FIREBASE FIRESTORE)
   ========================================================================== */
function fetchResourcesFromFirestore() {
  if (!db) {
    console.error("Firestore 'db' not initialized. Check your firebase-config.js script inclusion.");
    fallbackToLocalData();
    return;
  }

  // 1. Automatically detect schoolId from user session if not explicitly defined in global state
  if (!currentSchoolId) {
    const session = JSON.parse(localStorage.getItem('portal_session') || localStorage.getItem('currentLoggedInUser') || '{}');
    if (session.schoolId || session.schoolID) {
      currentSchoolId = (session.schoolId || session.schoolID).toLowerCase().trim();
    }
  }

  // 2. Fetch all documents from the root collection and handle filtering in client code 
  // to prevent missing items due to compound index limitations or missing fields.
  let queryRef = db.collection('e_library_resources');

  queryRef.onSnapshot((snapshot) => {
    allResources = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const resSchoolId = (data.schoolId || '').toLowerCase();
      const isGlobalRes = data.isGlobal === true || resSchoolId === 'global' || resSchoolId === 'all';
      const isCurrentSchool = currentSchoolId && resSchoolId === currentSchoolId;

      // Include if it's marked global/all or explicitly belongs to the logged-in school
      if (isGlobalRes || isCurrentSchool || !currentSchoolId || currentSchoolId === 'global' || currentSchoolId === 'all') {
        allResources.push({
          id: doc.id,
          title: data.title || 'Untitled Resource',
          description: data.description || '',
          class: data.classLevel || 'S1',        
          category: data.category || 'Notes',
          accessType: data.accessType || 'free',  
          price: Number(data.price) || 0,         
          schoolId: resSchoolId || 'global',    
          isGlobal: data.isGlobal === true, // <--- FIXED: Explicitly map isGlobal here
          fileUrl: data.fileUrl || '#',
          fileName: data.fileName || '',
          fileType: data.fileType || '',
          date: data.date || '2026',
          downloads: Number(data.downloads) || 0,  
          createdAt: data.createdAt
        });
      }
    });

    try {
      localStorage.setItem('portal_resources', JSON.stringify(allResources));
    } catch (e) {
      console.warn("Could not save resources to localStorage:", e);
    }

    initPortal();
  }, (error) => {
    console.error("Error fetching live resources from Firestore:", error);
    fallbackToLocalData();
  });
}

function fallbackToLocalData() {
  const localData = localStorage.getItem('portal_resources');
  if (localData) {
    try {
      allResources = JSON.parse(localData);
    } catch (e) {
      allResources = [];
    }
  } else {
    allResources = [];
  }
  initPortal();
}

function initPortal() {
  syncUIControls();
  updateStatsCounters();
  renderCards();
}

/* ==========================================================================
   1. SEARCH & FILTERING LOGIC
   ========================================================================== */
function handleSearchInput(e) {
  currentPage = 1; // Reset to page 1 on search
  searchQuery = e.target.value.toLowerCase().trim();
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) {
    clearBtn.style.display = searchQuery.length > 0 ? 'block' : 'none';
  }
  updateURL();
  renderCards();
}

function clearSearch() {
  currentPage = 1; // Reset to page 1 on clearing search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    searchQuery = '';
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    updateURL();
    renderCards();
  }
}

function filterClass(cls, event) {
  currentPage = 1; // Reset to page 1 on class filter
  currentClass = cls;
  updateActiveButtons('#classFilterGroup .segment-btn', event ? event.currentTarget || event.target : null);
  updateURL();
  renderCards();
}

function filterCategory(cat, event) {
  currentPage = 1; // Reset to page 1 on category filter
  currentCategory = cat;
  updateActiveButtons('#categoryFilterGroup .segment-btn', event ? event.currentTarget || event.target : null);
  updateURL();
  renderCards();
}

function updateActiveButtons(selector, targetBtn) {
  if (!targetBtn) return;
  const button = targetBtn.closest('.segment-btn') || targetBtn;
  const parent = button.closest('.segmented-control');
  const group = parent ? parent.querySelectorAll('.segment-btn') : document.querySelectorAll(selector);

  group.forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
}

function resetFilters() {
  currentPage = 1; // Reset to page 1 on reset
  currentClass = 'ALL';
  currentCategory = 'ALL';
  currentSchoolId = '';
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  searchQuery = '';
  
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  
  document.querySelectorAll('.segmented-control .segment-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent.trim().toUpperCase() === 'ALL') {
      btn.classList.add('active');
    }
  });
  
  updateURL();
  fetchResourcesFromFirestore(); // Re-fetch data refresh
}

// --- DOWNLOAD COUNTER INCREMENT HELPER ---
async function trackDownload(resourceId) {
  if (!db) return;
  try {
    const docRef = db.collection('e_library_resources').doc(resourceId);
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) return;
      const newDownloads = (doc.data().downloads || 0) + 1;
      transaction.update(docRef, { downloads: newDownloads });
    });
  } catch (err) {
    console.warn("Failed to increment download count:", err);
  }
}

function initiateMoMoPayment(resourceId, resourceTitle, price) {
  let modal = document.getElementById('momoPaymentModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'momoPaymentModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:9999; padding: 1rem;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="card" style="width: 100%; max-width: 450px; position: relative; background: var(--card-bg); border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
      
      <!-- Modal Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem;">
        <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-mobile-screen-button" style="color: var(--primary);"></i> Mobile Money Checkout
        </h3>
        <button type="button" onclick="closeMomoModal()" style="background: #f1f5f9; border: none; width: 30px; height: 30px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-main); transition: background 0.2s;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
        Unlocking Resource: <strong style="color: var(--text-main);">${escapeHtml(resourceTitle)}</strong>
      </p>

      <!-- Amount and Merchant Box -->
      <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 1.2rem; border: 1px solid var(--border-color);">
        <div style="display:flex; justify-content:space-between; font-size: 0.95rem; margin-bottom: 8px;">
          <span style="color: var(--text-muted);">Amount Payable:</span>
          <strong style="color: var(--primary); font-size: 1.05rem;">UGX ${price.toLocaleString()}</strong>
        </div>
        <hr style="border:0; border-top:1px solid #e2e8f0; margin: 8px 0;">
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 600;">SEND MONEY TO OFFICIAL LINES:</div>
        
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem;">
          <div style="display: flex; align-items: center; justify-content: background; background: #fefce8; padding: 6px 10px; border-radius: 6px; border-left: 4px solid #eab308;">
            <span>🟡 <strong>MTN MoMo:</strong> ${SAMCAM_BUSINESS_ACCOUNTS.MTN.number}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: background; background: #fef2f2; padding: 6px 10px; border-radius: 6px; border-left: 4px solid #ef4444;">
            <span>🔴 <strong>Airtel Money:</strong> ${SAMCAM_BUSINESS_ACCOUNTS.AIRTEL.number}</span>
          </div>
        </div>
        <div style="margin-top: 6px; font-size: 0.72rem; color: var(--text-muted); text-align: right;">Name: <strong>SAMCAM SOLUTIONS</strong></div>
      </div>

      <!-- Payment Form -->
      <form onsubmit="verifyManualPayment(event, '${resourceId}')">
        <div class="form-group" style="margin-bottom: 0.8rem;">
          <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 3px;">Your Mobile Network</label>
          <select id="studentNetwork" required style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.9rem;">
            <option value="MTN">MTN Uganda</option>
            <option value="AIRTEL">Airtel Uganda</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0.8rem;">
          <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 3px;">Your Phone Number (Sender)</label>
          <input type="tel" id="studentPhone" placeholder="e.g. 0772123456 / 0752123456" required style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.9rem;">
        </div>

        <div class="form-group" style="margin-bottom: 1.2rem;">
          <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 3px;">Transaction ID / Confirmation Code</label>
          <input type="text" id="transactionId" placeholder="e.g. PP260821.1234.F12345" required style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.9rem;">
          <small style="color: var(--text-muted); font-size: 0.72rem;">Enter the message ID received from your telecom operator.</small>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 0.6rem;">
          <button type="button" onclick="closeMomoModal()" class="btn-secondary" style="flex: 1; justify-content: center; padding: 0.65rem;">
            Cancel
          </button>
          <button type="submit" id="verifyBtn" class="btn-primary" style="flex: 2; justify-content: center; padding: 0.65rem;">
            <i class="fa-solid fa-circle-check"></i> Verify & Unlock
          </button>
        </div>
      </form>
    </div>
  `;

  modal.style.display = 'flex';
}

function closeMomoModal() {
  const modal = document.getElementById('momoPaymentModal');
  if (modal) modal.style.display = 'none';
}

async function verifyManualPayment(e, resourceId) {
  e.preventDefault();
  const phone = document.getElementById('studentPhone').value.trim();
  const network = document.getElementById('studentNetwork').value;
  const rawTxId = document.getElementById('transactionId').value.trim();
  const transactionId = rawTxId.toUpperCase(); // Normalize for consistent matching
  const verifyBtn = document.getElementById('verifyBtn');

  verifyBtn.disabled = true;
  verifyBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking Transaction ID...`;

  try {
    // 1. Check if this Transaction ID has already been used in Firestore
    const existingTxQuery = await db.collection("pending_payments")
      .where("transactionId", "==", transactionId)
      .get();

    if (!existingTxQuery.empty) {
      alert("❌ Error: This Transaction ID has already been used or submitted. Each payment code can only be used once.");
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verify & Unlock`;
      return; // Stop execution
    }

    // 2. If unique, save the submission to Firestore for admin review, attaching current schoolId context if active
    await db.collection("pending_payments").add({
      resourceId,
      phone,
      network,
      transactionId,
      schoolId: currentSchoolId || "global",
      status: "pending", // Will change to 'approved' once you match it on your phone line
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("✅ Payment submitted successfully! Once verified against our line, your download link will be fully enabled.");
    closeMomoModal();

  } catch (error) {
    console.error("Error verifying transaction:", error);
    alert("An error occurred while validating your transaction code. Please try again.");
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verify & Unlock`;
  }
}

/* ==========================================================================
   2. FILE TYPE ICON RESOLVER (Includes Zip Folders Support)
   ========================================================================== */
function getFileTypeIcon(url) {
  if (!url) return { icon: 'fa-file', label: 'FILE' };
  const ext = url.split('?')[0].split('#')[0].split('.').pop().toLowerCase();

  switch (ext) {
    case 'pdf':
      return { icon: 'fa-file-pdf', label: 'PDF' };
    case 'doc':
    case 'docx':
      return { icon: 'fa-file-word', label: 'WORD' };
    case 'xls':
    case 'xlsx':
    case 'csv':
      return { icon: 'fa-file-excel', label: 'EXCEL' };
    case 'ppt':
    case 'pptx':
      return { icon: 'fa-file-powerpoint', label: 'POWERPOINT' };
    case 'accdb':
    case 'mdb':
      return { icon: 'fa-database', label: 'ACCESS' };
    case 'zip':
    case 'rar':
    case '7z':
      return { icon: 'fa-file-zipper', label: 'ZIPPED FOLDER' };
    default:
      return { icon: 'fa-file-lines', label: ext.toUpperCase() };
  }
}

/* ==========================================================================
   UPDATED RESOURCE CARDS RENDERER WITH PAYMENT GATE & DOWNLOAD COUNTS
   ========================================================================== */
function renderCards() {
  const container = document.getElementById('resource-grid');
  const countBadge = document.getElementById('resource-count');
  const paginationContainer = document.getElementById('paginationContainer');
  if (!container) return;

  container.innerHTML = '';

  const filtered = allResources.filter(item => {
    const matchesClass = currentClass === 'ALL' || item.class === currentClass;
    const matchesCat = currentCategory === 'ALL' || item.category === currentCategory;
    
    // Updated Tenant Isolation & Global Visibility Rule: 
    // Item is shown if it's explicitly marked global (isGlobal: true or schoolId global/all) 
    // OR matches the active tenant school.
    const itemSchool = (item.schoolId || 'global').toLowerCase();
    const activeSchool = (currentSchoolId || '').toLowerCase();
    const isGlobalRes = item.isGlobal === true || itemSchool === 'global' || itemSchool === 'all';
    const matchesSchool = !activeSchool || activeSchool === 'all' || isGlobalRes || itemSchool === activeSchool;

    const matchesSearch = !searchQuery || 
      (item.title && item.title.toLowerCase().includes(searchQuery)) ||
      (item.description && item.description.toLowerCase().includes(searchQuery)) ||
      (item.class && item.class.toLowerCase().includes(searchQuery)) ||
      (item.category && item.category.toLowerCase().includes(searchQuery)) ||
      (item.schoolId && item.schoolId.toLowerCase().includes(searchQuery));

    return matchesClass && matchesCat && matchesSchool && matchesSearch;
  });

  if (countBadge) {
    countBadge.textContent = `Showing ${filtered.length} Resource${filtered.length === 1 ? '' : 'S'}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="no-data-card" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
        <i class="fa-solid fa-folder-open" style="font-size:2.5rem; color:var(--text-muted, #94a3b8); margin-bottom:1rem;"></i>
        <h3>No materials found</h3>
        <p style="color: #64748b;">No resources match your selected search or filter criteria.</p>
        <button onclick="resetFilters()" class="btn-action btn-upload" style="margin-top:1rem;">Reset Filters</button>
      </div>
    `;
    if (paginationContainer) paginationContainer.style.display = 'none';
    return;
  }

  // --- PAGINATION CALCULATIONS & FIXES ---
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filtered.slice(startIndex, endIndex);

  // Check if current logged-in user is an admin
  const isAdmin = localStorage.getItem('samcam_is_admin') === 'true';

  paginatedItems.forEach(item => {
    const fileMeta = getFileTypeIcon(item.fileUrl);
    const isALevel = item.class === 'S5' || item.class === 'S6';
    const classTagStyle = isALevel ? 'tag-alevel' : 'tag-olevel';
    
    const accessType = item.accessType || 'free';
    const price = item.price || 0;
    const downloadCount = item.downloads || 0;
    const itemSchoolId = item.schoolId || 'global';

    // Determine Action Button Markup based on Access Type & User Role
    let actionButtonHTML = '';

    if (accessType === 'paid' && !isAdmin) {
      // Student view for Paid items: Hide direct link, show Payment Trigger
      actionButtonHTML = `
        <button onclick="initiateMoMoPayment('${item.id}', '${escapeHtml(item.title)}', ${price})" class="download-btn" style="background: var(--warning, #d97706); color: #fff;">
          <i class="fa-solid fa-lock"></i> Pay UGX ${price.toLocaleString()} to Unlock
        </button>
      `;
    } else {
      // Free items or Admin view: Direct download link visible with download tracking hook
      let badgeLabel = accessType === 'paid' ? ` <span style="font-size:0.7rem; background:#fee2e2; color:#991b1b; padding:1px 4px; border-radius:3px; margin-left:4px;">Admin Direct</span>` : '';
      actionButtonHTML = `
        <a href="${item.fileUrl || '#'}" target="_blank" download onclick="trackDownload('${item.id}')" class="download-btn">
          <i class="fa-solid ${fileMeta.icon}"></i> Download${badgeLabel}
        </a>
      `;
    }

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <div class="card-tags">
          <span class="tag ${classTagStyle}">${item.class}</span>
          <span class="tag tag-cat">${item.category}</span>
          <span class="tag tag-ext">${fileMeta.label}</span>
          <span class="tag" style="background:#e0f2fe; color:#0369a1;"><i class="fa-solid fa-school"></i> ${itemSchoolId.toUpperCase()}</span>
          ${accessType === 'paid' ? '<span class="tag" style="background:#fef3c7; color:#92400e;"><i class="fa-solid fa-lock"></i> Paid</span>' : ''}
          <span class="tag" style="background:#f1f5f9; color:#475569; margin-left:auto;"><i class="fa-solid fa-download"></i> ${downloadCount} downloads</span>
        </div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-description">${escapeHtml(item.description || 'No description provided.')}</p>
      </div>
      
      <div class="card-footer">
        <small class="card-date"><i class="fa-regular fa-calendar"></i> ${escapeHtml(item.date || '2026')}</small>
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <button onclick="openPreviewModal('${encodeURIComponent(JSON.stringify(item))}')" class="btn-icon-only" title="Preview Details">
            <i class="fa-solid fa-eye"></i>
          </button>
          ${actionButtonHTML}
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  // Ensure pagination container visibility is correctly managed based on total pages
  if (paginationContainer) {
    if (totalPages > 1) {
      paginationContainer.style.display = 'flex';
      renderPaginationControls(totalPages);
    } else {
      paginationContainer.style.display = 'none';
    }
  }
}
function renderPaginationControls(totalPages) {
  const pageNumbersContainer = document.getElementById('pageNumbers');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (!pageNumbersContainer) return;

  if (prevBtn) {
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => changePage(-1);
  }
  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.onclick = () => changePage(1);
  }

  // Smart Ellipsis Range Generation Logic
  const getPageRange = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    range.push(1);
    for (let i = current - delta; i <= current + delta; i++) {
      if (i < total && i > 1) {
        range.push(i);
      }
    }
    if (total > 1) range.push(total);

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }
    return rangeWithDots;
  };

  const pages = getPageRange(currentPage, totalPages);
  let pagesHTML = '';

  pages.forEach(page => {
    if (page === '...') {
      pagesHTML += `<span style="padding: 0 6px; color: var(--text-muted); display:inline-flex; align-items:center;">…</span>`;
    } else {
      const isActive = page === currentPage;
      pagesHTML += `
        <button class="page-number-btn ${isActive ? 'active' : ''}" 
                onclick="goToPage(${page})" 
                ${isActive ? 'aria-current="page"' : ''} 
                aria-label="Page ${page}">
          ${page}
        </button>
      `;
    }
  });

  pageNumbersContainer.innerHTML = pagesHTML;
}

function changePage(direction) {
  currentPage += direction;
  updateURL();
  renderCards();
  scrollToResourceGrid();
}

function goToPage(pageNumber) {
  currentPage = pageNumber;
  updateURL();
  renderCards();
  scrollToResourceGrid();
}

function scrollToResourceGrid() {
  const gridSection = document.getElementById('resource-grid');
  if (gridSection) {
    const yOffset = -100;
    const y = gridSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}

function updateStatsCounters() {
  const statTotal = document.getElementById('statTotal');
  const statSupport = document.getElementById('statSupport');
  const statPapers = document.getElementById('statPapers');

  if (statTotal) statTotal.textContent = allResources.length;
  if (statSupport) {
    const count = allResources.filter(r => r.category === 'Support File' || (r.fileUrl && (r.fileUrl.endsWith('.xlsx') || r.fileUrl.endsWith('.accdb') || r.fileUrl.endsWith('.zip') || r.fileUrl.endsWith('.rar') || r.fileUrl.endsWith('.7z')))).length;
    statSupport.textContent = count;
  }
  if (statPapers) {
    const count = allResources.filter(r => r.category === 'Question Paper').length;
    statPapers.textContent = count;
  }
}

/* ==========================================================================
   4. MODAL & THEME UTILITIES
   ========================================================================== */
function openPreviewModal(encodedItem) {
  const item = JSON.parse(decodeURIComponent(encodedItem));
  const fileMeta = getFileTypeIcon(item.fileUrl);
  const modal = document.getElementById('previewModal');
  const content = document.getElementById('modalContent');

  if (!modal || !content) return;

  content.innerHTML = `
    <span class="tag tag-cat" style="margin-bottom:0.5rem; display:inline-block;">${item.class} • ${item.category} • School: ${(item.schoolId || 'global').toUpperCase()}</span>
    <h2 style="font-size:1.25rem; margin-bottom:0.75rem;">${escapeHtml(item.title)}</h2>
    <p style="color:#475569; font-size:0.9rem; margin-bottom:1.25rem;">${escapeHtml(item.description || 'No detailed description available.')}</p>
    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:1rem;">
      <small style="color:#64748b;"><i class="fa-solid fa-file"></i> Format: ${fileMeta.label} | <i class="fa-solid fa-download"></i> ${item.downloads || 0} downloads</small>
      <a href="${item.fileUrl || '#'}" target="_blank" download onclick="trackDownload('${item.id}')" class="download-btn">
        <i class="fa-solid ${fileMeta.icon}"></i> Download File
      </a>
    </div>
  `;

  modal.style.display = 'flex';
}

function closePreviewModal(e) {
  if (e.target.id === 'previewModal') {
    closePreviewModalDirect();
  }
}

function closePreviewModalDirect() {
  const modal = document.getElementById('previewModal');
  if (modal) modal.style.display = 'none';
}

function initTheme() {
  const savedTheme = localStorage.getItem('portal_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    updateThemeButtonUI(themeBtn, savedTheme);
    themeBtn.removeEventListener('click', toggleTheme); // Prevent duplicate event listeners
    themeBtn.addEventListener('click', toggleTheme);
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('portal_theme', newTheme);
  
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    updateThemeButtonUI(themeBtn, newTheme);
  }
}

function updateThemeButtonUI(btn, theme) {
  const icon = btn.querySelector('i');
  if (icon) {
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

function handleScroll() {
  const btn = document.getElementById('backToTopBtn');
  if (btn) {
    btn.style.display = window.scrollY > 300 ? 'flex' : 'none';
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}
