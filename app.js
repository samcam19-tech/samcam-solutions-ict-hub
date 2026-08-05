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

function filterClass(cls) {
  currentClass = cls;
  updateActiveButtons('.filter-btn', event.target);
  renderCards();
}

function filterCategory(cat) {
  currentCategory = cat;
  updateActiveButtons('.cat-btn', event.target);
  renderCards();
}

function updateActiveButtons(selector, targetBtn) {
  document.querySelectorAll(selector).forEach(btn => btn.classList.remove('active'));
  targetBtn.classList.add('active');
}

function renderCards() {
  const container = document.getElementById('resource-grid');
  container.innerHTML = '';

  const filtered = allResources.filter(item => {
    const matchesClass = currentClass === 'ALL' || item.class === currentClass;
    const matchesCat = currentCategory === 'ALL' || item.category === currentCategory;
    return matchesClass && matchesCat;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 2rem;">No materials available for the selected criteria.</p>';
    return;
  }

  filtered.forEach(item => {
    // Determine badge color: S1-S4 get blue (O-Level), S5-S6 get amber (A-Level)
    const isALevel = item.class === 'S5' || item.class === 'S6';
    const classTagStyle = isALevel ? 'tag-alevel' : 'tag-olevel';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <div>
          <span class="tag ${classTagStyle}">${item.class}</span>
          <span class="tag tag-cat">${item.category}</span>
        </div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </div>
      <div class="card-footer">
        <small style="color:#888;">${item.date}</small>
        <a href="${item.fileUrl}" target="_blank" class="download-link">Open File</a>
      </div>
    `;
    container.appendChild(card);
  });
}
