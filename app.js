let allResources = [];
let currentClass = 'ALL';
let currentCategory = 'ALL';

document.addEventListener("DOMContentLoaded", () => {
  fetch('data.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      allResources = data;
      renderCards();
    })
    .catch(error => {
      console.error("Error loading resources:", error);
      const container = document.getElementById('resource-grid');
      if (container) {
        container.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2.5rem; background: #fef2f2; border-radius: 12px; border: 1px solid #fecaca;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
            <p style="font-weight: 600;">Failed to load resource data.</p>
            <p style="font-size: 0.85rem; color: #991b1b;">Please check if data.json exists or is properly formatted.</p>
          </div>`;
      }
    });
});

// FILTER BY CLASS (S.1 - S.6)
function filterClass(cls, btnElement) {
  currentClass = cls;
  updateActiveButtons('.filter-row:nth-child(1) .segment-btn', btnElement);
  renderCards();
}

// FILTER BY CATEGORY (Notes, Question Papers, Marking Guides)
function filterCategory(cat, btnElement) {
  currentCategory = cat;
  updateActiveButtons('.filter-row:nth-child(2) .segment-btn', btnElement);
  renderCards();
}

// REAL-TIME SEARCH TRIGGER
function searchResources() {
  renderCards();
}

// TOGGLE ACTIVE STATE ON SEGMENTED BUTTONS
function updateActiveButtons(selector, targetBtn) {
  const element = targetBtn || event?.target;
  if (!element) return;
  
  document.querySelectorAll(selector).forEach(btn => btn.classList.remove('active'));
  element.classList.add('active');
}

// RENDER ELEVATED CARDS & UPDATE COUNTER
function renderCards() {
  const container = document.getElementById('resource-grid');
  const countBadge = document.getElementById('resource-count');
  const searchInput = document.getElementById('searchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (!container) return;
  container.innerHTML = '';

  // FILTER LOGIC
  const filtered = allResources.filter(item => {
    const matchesClass = currentClass === 'ALL' || item.class === currentClass;
    const matchesCat = currentCategory === 'ALL' || item.category === currentCategory;
    
    const titleMatch = (item.title || '').toLowerCase().includes(query);
    const descMatch = (item.description || '').toLowerCase().includes(query);
    const classMatch = (item.class || '').toLowerCase().includes(query);
    const catMatch = (item.category || '').toLowerCase().includes(query);
    const matchesSearch = !query || titleMatch || descMatch || classMatch || catMatch;

    return matchesClass && matchesCat && matchesSearch;
  });

  // UPDATE COUNTER BADGE
  if (countBadge) {
    countBadge.textContent = `Showing ${filtered.length} ${filtered.length === 1 ? 'Resource' : 'Resources'}`;
  }

  // EMPTY STATE DISPLAY
  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 3.5rem 1rem;">
        <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 0.75rem;"></i>
        <h3 style="font-size: 1.1rem; color: #0f172a; font-weight: 700;">No resources found</h3>
        <p style="font-size: 0.9rem;">Try adjusting your search query or switching your class/category filters.</p>
      </div>`;
    return;
  }

  // RENDER CARDS
  filtered.forEach(item => {
    // Badge styling: S1-S4 (Blue O-Level), S5-S6 (Amber A-Level)
    const isALevel = item.class === 'S5' || item.class === 'S6';
    const classTagStyle = isALevel ? 'tag-alevel' : 'tag-olevel';
    
    // File format icon indicator
    const fileType = item.fileType || 'PDF';
    const fileIcon = fileType.toLowerCase().includes('doc') ? 'fa-file-word' : 'fa-file-pdf';

    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <div class="card-tags">
          <span class="tag ${classTagStyle}">${item.class}</span>
          <span class="tag tag-cat">${item.category}</span>
        </div>
        <h3 class="card-title">${item.title}</h3>
        <p class="card-description">${item.description || ''}</p>
      </div>

      <div class="card-footer">
        <span class="file-meta">
          <i class="fa-regular ${fileIcon}"></i> ${fileType}
        </span>
        <a href="${item.fileUrl || item.downloadUrl || '#'}" target="_blank" class="download-btn" ${item.fileUrl ? 'download' : ''}>
          <i class="fa-solid fa-download"></i> Download
        </a>
      </div>
    `;
    container.appendChild(card);
  });
}
