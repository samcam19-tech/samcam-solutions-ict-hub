let allResources = [];
let currentClass = 'ALL';
let currentCategory = 'ALL';

document.addEventListener("DOMContentLoaded", () => {
  fetch('data.json')
    .then(response => response.json())
    .then(data => {
      allResources = data;
      renderCards();
    })
    .catch(error => console.error("Error loading resources:", error));
});

// Helper function to resolve file icons based on URL or file extension
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
      return { icon: 'fa-file-powerpoint', label: 'PPT' };
    case 'accdb':
    case 'mdb':
      return { icon: 'fa-database', label: 'ACCESS' };
    case 'zip':
    case 'rar':
      return { icon: 'fa-file-zipper', label: 'ZIP' };
    default:
      return { icon: 'fa-file-lines', label: ext.toUpperCase() };
  }
}

// Pass 'event' or 'this' explicitly from HTML onclick
function filterClass(cls, btnElement) {
  currentClass = cls;
  updateActiveButtons('#class-filter-container .segment-btn', btnElement);
  renderCards();
}

function filterCategory(cat, btnElement) {
  currentCategory = cat;
  updateActiveButtons('#category-filter-container .segment-btn', btnElement);
  renderCards();
}

function updateActiveButtons(selector, targetBtn) {
  if (!targetBtn) return;
  
  // Ensures we select the button even if an <i> or <span> inside was clicked
  const button = targetBtn.closest('.segment-btn') || targetBtn;
  
  // Target the specific segmented control group
  const parentContainer = button.closest('.segmented-control');
  const buttonsGroup = parentContainer 
    ? parentContainer.querySelectorAll('.segment-btn') 
    : document.querySelectorAll(selector);

  buttonsGroup.forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
}

function renderCards() {
  const container = document.getElementById('resource-grid');
  if (!container) return;
  container.innerHTML = '';

  const filtered = allResources.filter(item => {
    const matchesClass = currentClass === 'ALL' || item.class === currentClass;
    const matchesCat = currentCategory === 'ALL' || item.category === currentCategory;
    return matchesClass && matchesCat;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="no-data">No materials available for the selected criteria.</p>';
    return;
  }

  filtered.forEach(item => {
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
        <p class="card-description">${item.description || ''}</p>
      </div>
      
      <div class="card-footer">
        <small class="card-date"><i class="fa-regular fa-calendar"></i> ${item.date || 'N/A'}</small>
        <a href="${item.fileUrl || '#'}" download class="download-btn">
          <i class="fa-solid ${fileMeta.icon}"></i> Download
        </a>
      </div>
    `;
    container.appendChild(card);
  });
}
