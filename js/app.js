/**
 * FeedFlow RSS Reader
 * Free Open Source RSS Reader
 * https://github.com/Jaseph/feedflow
 */

const FeedFlow = {
    // State
    feeds: [],
    settings: {},
    currentFeed: null,
    currentPage: 1,
    searchQuery: '',
    isLoading: false,

    // API base URL
    apiUrl: 'api.php',

    // Initialize app
    async init() {
        this.bindEvents();
        this.initTheme();
        await this.loadFeeds();
        await this.loadArticles();
    },

    // Bind all event listeners
    bindEvents() {
        // Search
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchQuery = e.target.value;
                this.currentPage = 1;
                this.loadArticles();
            }, 300);
        });

        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

        // Refresh button
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshCurrentFeed());

        // Add feed button
        document.getElementById('addFeedBtn')?.addEventListener('click', () => this.showAddFeedModal());

        // Settings button
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showSettingsModal());

        // Mobile menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', () => this.toggleSidebar());

        // Sidebar overlay close
        document.getElementById('sidebarOverlay')?.addEventListener('click', () => this.closeSidebar());

        // Modal close buttons
        document.querySelectorAll('.modal-close, .cancel-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Modal backdrop close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeAllModals();
            });
        });

        // Add feed form
        document.getElementById('addFeedForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addFeed();
        });

        // Settings form
        document.getElementById('settingsForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
            if (e.key === '/' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                searchInput?.focus();
            }
        });
    },

    // Theme management
    initTheme() {
        const saved = localStorage.getItem('feedflow-theme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
        }
        // Default is light mode (no data-theme attribute needed)
        this.updateThemeIcon();
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('feedflow-theme', newTheme);
        this.updateThemeIcon();
    },

    updateThemeIcon() {
        const btn = document.getElementById('themeToggle');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (btn) {
            btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            btn.title = isDark ? 'Light Mode' : 'Dark Mode';
        }
    },

    // Mobile sidebar
    toggleSidebar() {
        document.querySelector('.sidebar')?.classList.toggle('open');
        document.getElementById('sidebarOverlay')?.classList.toggle('active');
    },

    closeSidebar() {
        document.querySelector('.sidebar')?.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
    },

    // API calls
    async api(action, options = {}) {
        const url = new URL(this.apiUrl, window.location.href);
        url.searchParams.set('action', action);

        if (options.params) {
            Object.entries(options.params).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });
        }

        const fetchOptions = {
            method: options.method || 'GET',
            headers: {}
        };

        if (options.body) {
            fetchOptions.method = 'POST';
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, fetchOptions);
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Unknown error');
            }
            return data;
        } catch (error) {
            this.showToast(error.message, 'error');
            throw error;
        }
    },

    // Load feeds list
    async loadFeeds() {
        try {
            const data = await this.api('feeds');
            this.feeds = data.feeds || [];
            this.settings = data.settings || {};
            this.renderFeedsList();
        } catch (error) {
            console.error('Failed to load feeds:', error);
        }
    },

    // Render feeds in sidebar
    renderFeedsList() {
        const container = document.getElementById('feedsList');
        if (!container) return;

        // Group by category
        const categories = {};
        this.feeds.forEach(feed => {
            const cat = feed.category || 'Uncategorized';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(feed);
        });

        let html = `
            <div class="feed-item ${!this.currentFeed ? 'active' : ''}" data-feed="all">
                <span class="feed-icon">📚</span>
                <span class="feed-title">All Feeds</span>
                <span class="feed-count">${this.feeds.length}</span>
            </div>
        `;

        Object.entries(categories).forEach(([category, feeds]) => {
            html += `<div class="feed-category">${this.escapeHtml(category)}</div>`;
            feeds.forEach(feed => {
                html += `
                    <div class="feed-item ${this.currentFeed === feed.id ? 'active' : ''}" data-feed="${feed.id}">
                        <span class="feed-icon">${feed.icon || '📰'}</span>
                        <span class="feed-title">${this.escapeHtml(feed.title)}</span>
                        <button class="feed-remove" data-id="${feed.id}" title="Remove feed">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            });
        });

        container.innerHTML = html;

        // Bind click events
        container.querySelectorAll('.feed-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.feed-remove')) return;
                const feedId = item.dataset.feed;
                this.currentFeed = feedId === 'all' ? null : feedId;
                this.currentPage = 1;
                this.loadArticles();
                this.renderFeedsList();
                this.closeSidebar();
            });
        });

        // Remove feed buttons
        container.querySelectorAll('.feed-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFeed(btn.dataset.id);
            });
        });
    },

    // Load articles
    async loadArticles() {
        if (this.isLoading) return;
        this.isLoading = true;
        this.showLoading(true);

        try {
            const params = {
                page: this.currentPage
            };
            if (this.currentFeed) {
                params.feeds = this.currentFeed;
            }
            if (this.searchQuery) {
                params.search = this.searchQuery;
            }

            const data = await this.api('articles', { params });
            this.renderArticles(data.items || []);
            this.renderPagination(data.pagination);

            // Update header title
            const headerTitle = document.querySelector('.main-title');
            if (headerTitle) {
                if (this.currentFeed) {
                    const feed = this.feeds.find(f => f.id === this.currentFeed);
                    headerTitle.textContent = feed?.title || 'Articles';
                } else {
                    headerTitle.textContent = 'All Articles';
                }
            }
        } catch (error) {
            console.error('Failed to load articles:', error);
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    },

    // Render articles grid
    renderArticles(items) {
        const container = document.getElementById('articlesGrid');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-rss"></i>
                    <h3>No articles found</h3>
                    <p>${this.searchQuery ? 'Try a different search term' : 'Add some feeds to get started'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => this.renderArticleCard(item)).join('');
    },

    // Render single article card
    renderArticleCard(item) {
        const timeAgo = this.timeAgo(item.timestamp);
        const image = item.image ? `<img src="${this.escapeHtml(item.image)}" alt="" class="article-image" loading="lazy" onerror="this.style.display='none'">` : '';

        return `
            <article class="article-card">
                <a href="${this.escapeHtml(item.link)}" target="_blank" rel="noopener" class="article-link">
                    ${image}
                    <div class="article-content">
                        <div class="article-meta">
                            <span class="article-source">
                                ${item.feedIcon || '📰'} ${this.escapeHtml(item.feedTitle || '')}
                            </span>
                            <span class="article-time">${timeAgo}</span>
                        </div>
                        <h3 class="article-title">${this.escapeHtml(item.title)}</h3>
                        <p class="article-description">${this.escapeHtml(item.description || '')}</p>
                        ${item.author ? `<span class="article-author"><i class="fas fa-user"></i> ${this.escapeHtml(item.author)}</span>` : ''}
                    </div>
                </a>
            </article>
        `;
    },

    // Render pagination
    renderPagination(pagination) {
        const container = document.getElementById('pagination');
        if (!container || !pagination) return;

        if (pagination.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<div class="pagination">';

        // Previous button
        if (pagination.page > 1) {
            html += `<button class="page-btn" data-page="${pagination.page - 1}"><i class="fas fa-chevron-left"></i></button>`;
        }

        // Page numbers
        const start = Math.max(1, pagination.page - 2);
        const end = Math.min(pagination.totalPages, pagination.page + 2);

        if (start > 1) {
            html += `<button class="page-btn" data-page="1">1</button>`;
            if (start > 2) html += `<span class="page-dots">...</span>`;
        }

        for (let i = start; i <= end; i++) {
            html += `<button class="page-btn ${i === pagination.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (end < pagination.totalPages) {
            if (end < pagination.totalPages - 1) html += `<span class="page-dots">...</span>`;
            html += `<button class="page-btn" data-page="${pagination.totalPages}">${pagination.totalPages}</button>`;
        }

        // Next button
        if (pagination.page < pagination.totalPages) {
            html += `<button class="page-btn" data-page="${pagination.page + 1}"><i class="fas fa-chevron-right"></i></button>`;
        }

        html += '</div>';
        container.innerHTML = html;

        // Bind click events
        container.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentPage = parseInt(btn.dataset.page);
                this.loadArticles();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    },

    // Refresh current feed
    async refreshCurrentFeed() {
        if (this.currentFeed) {
            try {
                await this.api('refresh', { params: { id: this.currentFeed } });
                this.showToast('Feed refreshed', 'success');
            } catch (error) {
                // Error already shown
            }
        }
        await this.loadArticles();
    },

    // Add feed modal
    showAddFeedModal() {
        document.getElementById('addFeedModal')?.classList.add('active');
        document.getElementById('feedUrl')?.focus();
    },

    // Add feed
    async addFeed() {
        const urlInput = document.getElementById('feedUrl');
        const titleInput = document.getElementById('feedTitle');
        const categoryInput = document.getElementById('feedCategory');
        const iconInput = document.getElementById('feedIcon');

        const url = urlInput?.value.trim();
        if (!url) {
            this.showToast('Please enter a feed URL', 'error');
            return;
        }

        const submitBtn = document.querySelector('#addFeedForm button[type="submit"]');
        const originalText = submitBtn?.textContent;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';
        }

        try {
            await this.api('add', {
                body: {
                    url: url,
                    title: titleInput?.value.trim() || '',
                    category: categoryInput?.value.trim() || 'Uncategorized',
                    icon: iconInput?.value.trim() || '📰'
                }
            });

            this.showToast('Feed added successfully', 'success');
            this.closeAllModals();

            // Clear form
            if (urlInput) urlInput.value = '';
            if (titleInput) titleInput.value = '';
            if (categoryInput) categoryInput.value = '';
            if (iconInput) iconInput.value = '';

            await this.loadFeeds();
            await this.loadArticles();
        } catch (error) {
            // Error already shown
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    },

    // Remove feed
    async removeFeed(feedId) {
        if (!confirm('Remove this feed?')) return;

        try {
            await this.api('remove', { body: { id: feedId } });
            this.showToast('Feed removed', 'success');

            if (this.currentFeed === feedId) {
                this.currentFeed = null;
            }

            await this.loadFeeds();
            await this.loadArticles();
        } catch (error) {
            // Error already shown
        }
    },

    // Settings modal
    showSettingsModal() {
        document.getElementById('cacheMinutes').value = this.settings.cacheMinutes || 15;
        document.getElementById('itemsPerPage').value = this.settings.itemsPerPage || 20;
        document.getElementById('settingsModal')?.classList.add('active');
    },

    // Save settings
    async saveSettings() {
        const cacheMinutes = parseInt(document.getElementById('cacheMinutes')?.value) || 15;
        const itemsPerPage = parseInt(document.getElementById('itemsPerPage')?.value) || 20;

        try {
            await this.api('settings', {
                body: { cacheMinutes, itemsPerPage }
            });

            this.settings.cacheMinutes = cacheMinutes;
            this.settings.itemsPerPage = itemsPerPage;

            this.showToast('Settings saved', 'success');
            this.closeAllModals();
            this.loadArticles();
        } catch (error) {
            // Error already shown
        }
    },

    // Close all modals
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    },

    // Show/hide loading
    showLoading(show) {
        const loader = document.getElementById('loadingSpinner');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }
    },

    // Toast notifications
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer') || this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${this.escapeHtml(message)}</span>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => toast.classList.add('show'));

        // Close button
        toast.querySelector('.toast-close')?.addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    },

    // Utility: Time ago
    timeAgo(timestamp) {
        const seconds = Math.floor((Date.now() / 1000) - timestamp);

        const intervals = [
            { label: 'year', seconds: 31536000 },
            { label: 'month', seconds: 2592000 },
            { label: 'week', seconds: 604800 },
            { label: 'day', seconds: 86400 },
            { label: 'hour', seconds: 3600 },
            { label: 'minute', seconds: 60 }
        ];

        for (const interval of intervals) {
            const count = Math.floor(seconds / interval.seconds);
            if (count >= 1) {
                return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
            }
        }

        return 'Just now';
    },

    // Utility: Escape HTML
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => FeedFlow.init());
