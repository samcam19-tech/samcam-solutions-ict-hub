/* ==========================================================================
   SAMCAM SOLUTIONS - ACADEMIC PORTAL HUB ENGINE (v2.5 - Final Integrated)
   ========================================================================== */

let allResources = [];
let currentClass = 'ALL';
let currentCategory = 'ALL';
let searchQuery = '';

// --- PAGINATION STATE ---
let currentPage = 1;
const itemsPerPage = 6; // Number of resource cards per page

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Theme
  initTheme();

  // Load state from URL parameters first before fetching data
  loadStateFromURL();

  // Always load fresh data from data.json first (bypasses local caching issues)
  fetchDataJSON();

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
   DATA FETCHING & INITIALIZATION
   ========================================================================== */
function fetchDataJSON() {
  // Append timestamp parameter to force browser/GitHub Pages cache invalidation
  fetch('./data.json?v=' + new Date().getTime())
    .then(response => {
      if (!response.ok) throw new Error("HTTP error " + response.status);
      return response.json();
    })
    .then(data => {
      allResources = data;
      // Clear outdated local storage to maintain absolute sync with data.json
      localStorage.removeItem('portal_resources');
      initPortal();
    })
    .catch(error => {
      console.error("Error loading resources from data.json:", error);
      // Offline / Error Fallback to local storage if network request fails
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
    });
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
  
  // Explicitly clear search input element value as requested
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
  renderCards();
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
   3. RESOURCE CARDS RENDERER & SMART PAGINATION WITH ELLIPSIS
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
    const matchesSearch = !searchQuery || 
      (item.title && item.title.toLowerCase().includes(searchQuery)) ||
      (item.description && item.description.toLowerCase().includes(searchQuery)) ||
      (item.class && item.class.toLowerCase().includes(searchQuery)) ||
      (item.category && item.category.toLowerCase().includes(searchQuery));

    return matchesClass && matchesCat && matchesSearch;
  });

  if (countBadge) {
    countBadge.textContent = `Showing ${filtered.length} Resource${filtered.length === 1 ? '' : 's'}`;
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

  // --- PAGINATION CALCULATIONS ---
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filtered.slice(startIndex, endIndex);

  paginatedItems.forEach(item => {
    const fileMeta = getFileTypeIcon(item.fileUrl);
    const isALevel = item.class === 'S5' || item.class === 'S6';
    const classTagStyle = isALevel ? 'tag-alevel' : 'tag-olevel';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <div class="card-tags">
          <span class="tag ${classTagStyle}">${item.class}</span>
          <span class="tag tag-cat">${item.category}</span>
          <span class="tag tag-ext">${fileMeta.label}</span>
        </div>
        <h3 class="card-title">${item.title}</h3>
        <p class="card-description">${item.description || 'No description provided.'}</p>
      </div>
      
      <div class="card-footer">
        <small class="card-date"><i class="fa-regular fa-calendar"></i> ${item.date || '2026'}</small>
        <div style="display:flex; gap:0.5rem;">
          <button onclick="openPreviewModal('${encodeURIComponent(JSON.stringify(item))}')" class="btn-icon-only" title="Preview Details">
            <i class="fa-solid fa-eye"></i>
          </button>
          <a href="${item.fileUrl || '#'}" download class="download-btn">
            <i class="fa-solid ${fileMeta.icon}"></i> Download
          </a>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  // --- SHOW / HIDE & RENDER SMART PAGINATION CONTROLS ---
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
    nextBtn.disabled = currentPage === totalPages;
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
    <span class="tag tag-cat" style="margin-bottom:0.5rem; display:inline-block;">${item.class} • ${item.category}</span>
    <h2 style="font-size:1.25rem; margin-bottom:0.75rem;">${item.title}</h2>
    <p style="color:#475569; font-size:0.9rem; margin-bottom:1.25rem;">${item.description || 'No detailed description available.'}</p>
    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:1rem;">
      <small style="color:#64748b;"><i class="fa-solid fa-file"></i> Format: ${fileMeta.label}</small>
      <a href="${item.fileUrl || '#'}" download class="download-btn">
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
