/* ==========================================================================
   FIREBASE-CONNECTED ICT BLOG ENGINE WITH INLINE CARD EXPANSION & AVATARS (blog.js)
   ========================================================================== */

// Application State
let blogPosts = [];
let currentCategory = 'all';
let searchQuery = '';
let currentPage = 1;
const postsPerPage = 4;
let currentUser = null;
let expandedPostId = null; // Tracks which card is currently expanded
let currentSchoolId = ''; // Tracks active school context for multi-tenancy

// Initialize Blog, Load Session, and Attach Firestore Real-Time Listeners
document.addEventListener('DOMContentLoaded', () => {
  loadUserSession();
  detectSchoolContext();
  fetchBlogPostsFromCloud();
});

/* ==========================================================================
   SESSION, ROLE & MULTI-TENANT CONTEXT MANAGEMENT
   ========================================================================== */
function loadUserSession() {
  try {
    const sessionData = localStorage.getItem('portal_session');
    if (sessionData) {
      currentUser = JSON.parse(sessionData);
    }
  } catch (err) {
    console.warn("Error reading portal session:", err);
  }
  
  updateBlogUIPermissions();
}

function detectSchoolContext() {
  // Extract schoolId from URL parameters or session if present
  const params = new URLSearchParams(window.location.search);
  if (params.has('schoolId')) {
    currentSchoolId = params.get('schoolId').toLowerCase().trim();
  } else if (currentUser && currentUser.schoolId) {
    currentSchoolId = currentUser.schoolId.toLowerCase().trim();
  } else {
    try {
      const session = JSON.parse(localStorage.getItem('portal_session'));
      if (session && session.schoolId) {
        currentSchoolId = session.schoolId.toLowerCase().trim();
      }
    } catch (e) {}
  }
}

function updateBlogUIPermissions() {
  const newPostBtn = document.getElementById('openNewPostBtn');
  if (!newPostBtn) return;

  if (!currentUser) {
    newPostBtn.style.display = 'none';
    return;
  }

  const roleLower = (currentUser.role || '').toLowerCase();
  // Allow only Teachers, Admins, and Administrators to publish articles
  if (roleLower === 'teacher' || roleLower === 'admin' || roleLower === 'administrator') {
    newPostBtn.style.display = 'inline-flex';
  } else {
    newPostBtn.style.display = 'none';
  }
}

/* ==========================================================================
   FIRESTORE DATA RETRIEVAL (Reverse Chronological Order, School-Scoped)
   ========================================================================== */
function fetchBlogPostsFromCloud() {
  const gridContainer = document.getElementById('blogGrid');
  gridContainer.innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Syncing live ICT insights from Firestore...</div>`;

  let queryRef = db.collection('blog_posts').orderBy('createdAt', 'desc');
  
  // Apply multi-tenant scope if schoolId is active
  if (currentSchoolId) {
    queryRef = queryRef.where('schoolId', '==', currentSchoolId);
  }

  queryRef.onSnapshot((snapshot) => {
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
   ADMIN CONTROLS: EDIT & DELETE
   ========================================================================== */
function deletePost(postId) {
  if (confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
    db.collection('blog_posts').doc(postId).delete()
      .then(() => alert("Post deleted successfully!"))
      .catch((err) => console.error("Error deleting post:", err));
  }
}

function editPost(postId) {
  const post = blogPosts.find(p => p.id === postId);
  if (!post) return;

  // Re-use your existing publish modal, but switch it to "Edit Mode"
  document.getElementById('newTitle').value = post.title;
  document.getElementById('newCategory').value = post.category;
  document.getElementById('newExcerpt').value = post.excerpt;
  document.getElementById('newContent').value = post.content;
  
  // Change submit button behavior
  const submitBtn = document.getElementById('submitPostBtn');
  submitBtn.innerText = 'Update Post';
  submitBtn.onclick = function(e) { updatePostInFirestore(e, postId); };
  
  document.getElementById('publishModal').style.display = 'flex';
}

function updatePostInFirestore(e, postId) {
  e.preventDefault();
  const updatedData = {
    title: document.getElementById('newTitle').value,
    category: document.getElementById('newCategory').value,
    excerpt: document.getElementById('newExcerpt').value,
    content: document.getElementById('newContent').value,
    schoolId: currentSchoolId || 'global',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('blog_posts').doc(postId).update(updatedData)
    .then(() => {
      alert("Post updated!");
      closePublishModal();
      // Reset button back to original
      location.reload(); 
    })
    .catch(err => console.error(err));
}

/* ==========================================================================
   RENDERING & FILTERING ENGINE
   ========================================================================== */
function renderBlog() {
  const gridContainer = document.getElementById('blogGrid');
  
  let filteredPosts = [...blogPosts];

  // If a post is expanded, isolate that specific post so it takes over the view container fully
  if (expandedPostId) {
    filteredPosts = filteredPosts.filter(post => post.id === expandedPostId);
    gridContainer.classList.add('single-expanded-view');
  } else {
    gridContainer.classList.remove('single-expanded-view');

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
  }

  // 3. Handle Pagination Slicing (Bypassed if a single post is expanded)
  const totalPosts = filteredPosts.length;
  const totalPages = Math.ceil(totalPosts / postsPerPage) || 1;
  
  let paginatedPosts = filteredPosts;
  if (!expandedPostId) {
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * postsPerPage;
    paginatedPosts = filteredPosts.slice(startIndex, startIndex + postsPerPage);
  }

  // 4. Render HTML Cards
  if (paginatedPosts.length === 0) {
    gridContainer.innerHTML = `<div class="no-posts"><i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 0.75rem; display: block;"></i>No ICT posts found matching your criteria.</div>`;
    updatePaginationControls(0, 1);
    return;
  }

  // Check if current user has administrative permissions
  const roleLower = (currentUser?.role || '').toLowerCase();
  const isAdmin = roleLower === 'teacher' || roleLower === 'admin' || roleLower === 'administrator';

  let htmlContent = '';
  paginatedPosts.forEach(post => {
    let badgeClass = 'badge-general';
    if (post.category === 'Practical') badgeClass = 'badge-practical';
    else if (post.category === 'Theory') badgeClass = 'badge-theory';
    else if (post.category === 'Datasets') badgeClass = 'badge-datasets';

    let formattedDate = "Recent";
    if (post.createdAt) {
      const dateObj = post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
      formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    const isExpanded = expandedPostId === post.id;
    const postSchoolId = post.schoolId || 'global';

    // Resolve Author Avatar (Fallback to default local avatar if missing)
    const defaultAvatar = "images/default-avatar.png";
    const authorPic = post.authorAvatar || defaultAvatar;

    // Build Admin Action Buttons if authorized
    let adminControls = '';
    if (isAdmin) {
      adminControls = `
        <div class="admin-post-controls" style="margin-top: 0.75rem; border-top: 1px dashed #cbd5e1; padding-top: 0.75rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button onclick="editPost('${post.id}')" style="background: #f59e0b; color: white; border: none; padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 500;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button onclick="deletePost('${post.id}')" style="background: #ef4444; color: white; border: none; padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 500;"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      `;
    }

    htmlContent += `
      <article class="blog-card ${isExpanded ? 'expanded-card full-page-card' : ''}" ${isExpanded ? 'style="width: 100%; max-width: 900px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1);"' : ''}>
        <div class="blog-card-header" style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="blog-badge ${badgeClass}">${post.category || 'General'}</span>
            <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;"><i class="fa-solid fa-school"></i> ${postSchoolId.toUpperCase()}</span>
          </div>
          <span class="blog-date"><i class="fa-regular fa-calendar"></i> ${formattedDate}</span>
        </div>
        <div class="blog-card-body">
          <h3 style="${isExpanded ? 'font-size: 1.75rem; margin-bottom: 1rem;' : ''}">${post.title}</h3>
          
          <!-- Dynamic Content Expansion -->
          ${isExpanded 
            ? `<div class="expanded-content" style="margin-bottom: 1.5rem; white-space: pre-line; color: var(--text-main, #334155); font-size: 1.05rem; line-height: 1.8;">${post.content || post.excerpt}</div>` 
            : `<p>${post.excerpt}</p>`
          }

          <div class="blog-card-footer" style="display: flex; align-items: center; justify-content: space-between; margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 0.75rem;">
            <div class="blog-author" style="display: flex; align-items: center; gap: 0.5rem;">
              <img src="${authorPic}" alt="${post.author || 'Author'}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1px solid #cbd5e1;" onerror="this.src='images/default-avatar.png'">
              <span style="font-weight: 500; font-size: 0.9rem; color: var(--text-main, #334155);">${post.author || 'Samcam ICT'}</span>
            </div>
            <button class="read-more-btn" onclick="toggleCardExpansion('${post.id}')" style="font-weight: 600;">
              ${isExpanded ? 'Close Article <i class="fa-solid fa-arrow-up"></i>' : 'Read Article <i class="fa-solid fa-arrow-right"></i>'}
            </button>
          </div>

          <!-- Render Edit/Delete controls for teachers/admins -->
          ${adminControls}
        </div>
      </article>
    `;
  });

  gridContainer.innerHTML = htmlContent;
  if (expandedPostId) {
    updatePaginationControls(1, 1);
    window.scrollTo({ top: gridContainer.offsetTop - 50, behavior: 'smooth' });
  } else {
    updatePaginationControls(totalPosts, totalPages);
  }
}

/* ==========================================================================
   INLINE CARD EXPANSION LOGIC
   ========================================================================== */
function toggleCardExpansion(postId) {
  if (expandedPostId === postId) {
    expandedPostId = null; // Collapse back to grid view
  } else {
    expandedPostId = postId; // Expand target card to full-page view
  }
  renderBlog();
}

/* ==========================================================================
   PUBLISH NEW POST TO FIRESTORE (Secured for Teachers & Admins)
   ========================================================================== */
async function openPublishModal() {
  if (!currentUser) {
    alert("Please log in as a teacher or administrator to publish new posts.");
    return;
  }

  const roleLower = (currentUser.role || '').toLowerCase();
  if (roleLower !== 'teacher' && roleLower !== 'admin' && roleLower !== 'administrator') {
    alert("Access Denied: Only teachers and administrators are authorized to publish blog posts.");
    return;
  }

  // Fetch the latest user profile directly from Firestore using their username/ID
  try {
    const userDocId = currentUser.username || currentUser.id;
    if (userDocId) {
      const userDoc = await db.collection('users').doc(userDocId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        currentUser.profilePic = userData.profilePic || currentUser.profilePic;
        currentUser.fullName = userData.fullName || currentUser.fullName;
      }
    }
  } catch (err) {
    console.warn("Could not fetch latest user profile from Firestore:", err);
  }

  // Pre-fill author name from session if available
  const authorField = document.getElementById('newAuthor');
  if (authorField && currentUser.fullName) {
    authorField.value = currentUser.fullName;
  }

  document.getElementById('publishModal').style.display = 'flex';
}

function closePublishModal() {
  document.getElementById('publishModal').style.display = 'none';
  document.getElementById('publishForm').reset();
}

async function handlePublishSubmit(e) {
  e.preventDefault();
  
  if (!currentUser) {
    alert("Session expired. Please log in again.");
    return;
  }

  const submitBtn = document.getElementById('submitPostBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving to Cloud...';

  // Ensure we grab the absolute latest profilePic directly from Firestore right before saving
  let latestAvatar = currentUser.profilePic || currentUser.avatar || '';
  try {
    const userDocId = currentUser.username || currentUser.id;
    if (userDocId) {
      const userDoc = await db.collection('users').doc(userDocId).get();
      if (userDoc.exists && userDoc.data().profilePic) {
        latestAvatar = userDoc.data().profilePic;
      }
    }
  } catch (err) {
    console.warn("Could not fetch latest avatar from Firestore:", err);
  }

  const newPostData = {
    title: document.getElementById('newTitle').value,
    category: document.getElementById('newCategory').value,
    author: document.getElementById('newAuthor').value || currentUser.fullName || 'Samcam ICT Dept',
    authorAvatar: latestAvatar, // Captures the guaranteed profile picture link
    excerpt: document.getElementById('newExcerpt').value,
    content: document.getElementById('newContent').value,
    schoolId: currentSchoolId || currentUser.schoolId || 'global', // Embeds school context for multi-tenancy
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
  expandedPostId = null; // Reset expansion on filter

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
  expandedPostId = null; // Reset expansion on search
  renderBlog();
}

function changePage(direction) {
  currentPage += direction;
  expandedPostId = null; // Reset expansion on page change
  renderBlog();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePaginationControls(totalPosts, totalPages) {
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const indicator = document.getElementById('pageIndicator');

  if (indicator) indicator.textContent = `Page ${currentPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}
