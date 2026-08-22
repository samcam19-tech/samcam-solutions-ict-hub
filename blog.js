/* ==========================================================================
   WORLD-CLASS ICT BLOG ENGINE (blog.js)
   ========================================================================== */

// Sample Professional ICT Dataset (Pre-populated with rich articles spanning categories)
let blogPosts = [
  {
    id: 1,
    title: "Mastering UNEB Subsidiary ICT Practical Spreadsheets: Advanced XLOOKUP & Nested IFs",
    category: "Practical",
    date: "2026-08-20",
    author: "Samcam ICT Dept",
    excerpt: "A complete step-by-step breakdown of handling complex financial and academic database models using modern spreadsheet lookup vectors.",
    content: "Full article content covering absolute referencing, data validation error trapping, and matrix sorting formulas for senior classes."
  },
  {
    id: 2,
    title: "Understanding Electronic Waste Management Protocols in Modern Computer Laboratories",
    category: "General",
    date: "2026-08-18",
    author: "Environmental Tech Unit",
    excerpt: "Exploring green computing principles, cathode-ray tube disposal safety measures, and institutional recycling frameworks.",
    content: "Full article content addressing toxic heavy metal components, municipal e-waste collection standards, and sustainable hardware procurement."
  },
  {
    id: 3,
    title: "Database Normalization Made Easy: From First Normal Form to Boyce-Codd",
    category: "Theory",
    date: "2026-08-15",
    author: "Database Architecture Team",
    excerpt: "A simplified conceptual guide designed for Advanced Level students tackling relational database integrity and functional dependencies.",
    content: "Full article content illustrating repeating groups elimination, primary-foreign key linkages, and anomaly prevention techniques."
  },
  {
    id: 4,
    title: "Standardized Assessment Datasets for Senior 3 & Senior 4 Termly Practical Exams",
    category: "Datasets",
    date: "2026-08-10",
    author: "Curriculum Specialist",
    excerpt: "Download curated CSV and Microsoft Access template files structured for competency-based evaluation rubrics.",
    content: "Full article content outlining raw table structures, record relationships, and automated grading benchmark keys."
  },
  {
    id: 5,
    title: "Optimizing Client-Side PDF Generation with JavaScript and jsPDF AutoTable",
    category: "Practical",
    date: "2026-08-05",
    author: "Web Engineering Unit",
    excerpt: "Learn how to build dynamic student performance report slips directly in the browser without server-side rendering dependencies.",
    content: "Full article content detailing canvas scaling, multi-page document pagination, and custom table cell styling scripts."
  },
  {
    id: 6,
    title: "Network Printer Troubleshooting: Resolving Error 0x0000011b on Windows Environments",
    category: "General",
    date: "2026-07-28",
    author: "System Support Desk",
    excerpt: "Quick registry modifications and RPC configuration steps to restore shared departmental network printing connectivity.",
    content: "Full article content covering RpcAuthnLevelPrivacyEnabled adjustments and patch management protocols."
  }
];

// Application State
let currentCategory = 'all';
let searchQuery = '';
let currentPage = 1;
const postsPerPage = 4;

// Initialize Blog on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  renderBlog();
});

/* ==========================================================================
   CORE RENDERING & SORTING LOGIC (Reverse Chronological Order)
   ========================================================================== */
function renderBlog() {
  const gridContainer = document.getElementById('blogGrid');
  
  // 1. Sort posts in Reverse Chronological Order (Newest date first)
  let filteredPosts = blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 2. Filter by Category Tab
  if (currentCategory !== 'all') {
    filteredPosts = filteredPosts.filter(post => post.category.toLowerCase() === currentCategory.toLowerCase());
  }

  // 3. Filter by Search Query (Title, excerpt, or category match)
  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase();
    filteredPosts = filteredPosts.filter(post => 
      post.title.toLowerCase().includes(query) || 
      post.excerpt.toLowerCase().includes(query) ||
      post.category.toLowerCase().includes(query)
    );
  }

  // 4. Handle Pagination Slicing
  const totalPosts = filteredPosts.length;
  const totalPages = Math.ceil(totalPosts / postsPerPage) || 1;
  
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * postsPerPage;
  const paginatedPosts = filteredPosts.slice(startIndex, startIndex + postsPerPage);

  // 5. Render HTML Cards
  if (paginatedPosts.length === 0) {
    gridContainer.innerHTML = `<div class="no-posts"><i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 0.75rem; display: block;"></i>No ICT posts found matching your criteria.</div>`;
    updatePaginationControls(0, 1);
    return;
  }

  let htmlContent = '';
  paginatedPosts.forEach(post => {
    let badgeClass = 'badge-general';
    if (post.category === 'Practical') badgeClass = 'badge-practical';
    else if (post.category === 'Theory') badgeClass = 'badge-theory';
    else if (post.category === 'Datasets') badgeClass = 'badge-datasets';

    htmlContent += `
      <article class="blog-card">
        <div class="blog-card-header">
          <span class="blog-badge ${badgeClass}">${post.category}</span>
          <span class="blog-date"><i class="fa-regular fa-calendar"></i> ${formatDate(post.date)}</span>
        </div>
        <div class="blog-card-body">
          <h3>${post.title}</h3>
          <p>${post.excerpt}</p>
          <div class="blog-card-footer">
            <span class="blog-author"><i class="fa-solid fa-user-pen"></i> ${post.author}</span>
            <button class="read-more-btn" onclick="openPostDetail(${post.id})">
              Read Article <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  });

  gridContainer.innerHTML = htmlContent;
  updatePaginationControls(totalPosts, totalPages);
}

/* ==========================================================================
   INTERACTION HANDLERS & FILTERS
   ========================================================================== */
function filterByCategory(category) {
  currentCategory = category;
  currentPage = 1; // Reset to first page on category change

  // Update active states on tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-category') === category) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderBlog();
}

function handleSearch() {
  const inputElem = document.getElementById('blogSearchInput');
  searchQuery = inputElem.value;
  currentPage = 1; // Reset to first page on search
  renderBlog();
}

function changePage(direction) {
  currentPage += direction;
  renderBlog();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePaginationControls(totalPosts, totalPages) {
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const indicator = document.getElementById('pageIndicator');

  indicator.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
}

function openPostDetail(postId) {
  const post = blogPosts.find(p => p.id === postId);
  if (post) {
    alert(`📖 Reading: ${post.title}\n\nAuthor: ${post.author}\nPublished: ${post.date}\n\nSummary: ${post.content}`);
  }
}
