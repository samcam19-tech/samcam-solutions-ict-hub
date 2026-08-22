/* ==========================================================================
   FIREBASE-CONNECTED ICT BLOG ENGINE (blog.js)
   ========================================================================== */

// Application State
let blogPosts = [];
let currentCategory = 'all';
let searchQuery = '';
let currentPage = 1;
const postsPerPage = 4;

// Initialize Blog and Attach Firestore Real-Time Listeners
document.addEventListener('DOMContentLoaded', () => {
  fetchBlogPostsFromCloud();
});

/* ==========================================================================
   FIRESTORE DATA RETRIEVAL (Reverse Chronological Order)
   ========================================================================== */
function fetchBlogPostsFromCloud() {
  const gridContainer = document.getElementById('blogGrid');
  gridContainer.innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Syncing live ICT insights from Firestore...</div>`;

  // Query Firestore collection 'blog_posts', ordered by publication timestamp descending (newest first)
  db.collection('blog_posts')
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      blogPosts = [];
      snapshot.forEach((doc) => {
        blogPosts.push({
          id: doc.id,
          ...doc.data()
        });
      });
      renderBlog();
    }, (error) => {
      console.error("Error fetching blog posts: ", error);
      gridContainer.innerHTML = `<div class="no-posts" style="color:var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load cloud posts. Please check your Firebase configuration.</div>`;
    });
}

/* ==========================================================================
   RENDERING & FILTERING ENGINE
   ========================================================================== */
function renderBlog() {
  const gridContainer = document.getElementById('blogGrid');
  
  let filteredPosts = [...blogPosts];

  // 1. Filter by Category Tab
  if (currentCategory !== 'all') {
    filteredPosts = filteredPosts.filter(post => post.category && post.category.toLowerCase() === currentCategory.toLowerCase());
  }

  // 2. Filter by Search Query
  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase();
    filteredPosts = filteredPosts.filter(post => 
      (post.title && post.title.toLowerCase().includes(query)) || 
      (post.excerpt && post.excerpt.toLowerCase().includes(query)) ||
      (post.category && post.category.toLowerCase().includes(query))
    );
  }

  // 3. Handle Pagination Slicing
  const totalPosts = filteredPosts.length;
  const totalPages = Math.ceil(totalPosts / postsPerPage) || 1;
  
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * postsPerPage;
  const paginatedPosts = filteredPosts.slice(startIndex, startIndex + postsPerPage);

  // 4. Render HTML Cards
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

    // Handle Firestore Timestamp formatting
    let formattedDate = "Recent";
    if (post.createdAt) {
      const dateObj = post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
      formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    htmlContent += `
      <article class="blog-card">
        <div class="blog-card-header">
          <span class="blog-badge ${badgeClass}">${post.category || 'General'}</span>
          <span class="blog-date"><i class="fa-regular fa-calendar"></i> ${formattedDate}</span>
        </div>
        <div class="blog-card-body">
          <h3>${post.title}</h3>
          <p>${post.excerpt}</p>
          <div class="blog-card-footer">
            <span class="blog-author"><i class="fa-solid fa-user-pen"></i> ${post.author || 'Samcam ICT'}</span>
            <button class="read-more-btn" onclick="openPostDetail('${post.id}')">
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
   PUBLISH NEW POST TO FIRESTORE
   ========================================================================== */
function openPublishModal() {
  document.getElementById('publishModal').style.display = 'flex';
}

function closePublishModal() {
  document.getElementById('publishModal').style.display = 'none';
  document.getElementById('publishForm').reset();
}

function handlePublishSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('submitPostBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving to Cloud...';

  const newPostData = {
    title: document.getElementById('newTitle').value,
    category: document.getElementById('newCategory').value,
    author: document.getElementById('newAuthor').value,
    excerpt: document.getElementById('newExcerpt').value,
    content: document.getElementById('newContent').value,
    createdAt: firebase.firestore.FieldValue.serverTimestamp() // Ensures precise chronological ordering
  };

  db.collection('blog_posts').add(newPostData)
    .then(() => {
      alert('🚀 ICT post successfully published to Firestore!');
      closePublishModal();
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Publish to Cloud';
    })
    .catch((error) => {
      console.error("Error adding post: ", error);
      alert('Failed to publish post. Check console logs.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Publish to Cloud';
    });
}

/* ==========================================================================
   CONTROLS & INTERACTIONS
   ========================================================================== */
function filterByCategory(category) {
  currentCategory = category;
  currentPage = 1;

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
  searchQuery = document.getElementById('blogSearchInput').value;
  currentPage = 1;
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

function openPostDetail(postId) {
  const post = blogPosts.find(p => p.id === postId);
  if (post) {
    let dateStr = "Recent";
    if (post.createdAt && post.createdAt.toDate) {
      dateStr = post.createdAt.toDate().toLocaleDateString();
    }
    alert(`📖 ${post.title}\n\nCategory: ${post.category}\nAuthor: ${post.author} (${dateStr})\n\n----------------------------------------\n${post.content}`);
  }
}
