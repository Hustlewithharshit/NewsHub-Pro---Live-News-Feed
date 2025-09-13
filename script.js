class NewsApp {
            constructor() {
                this.currentCategory = '';
                this.currentQuery = '';
                this.articles = [];
                this.isLoading = false;
                
                this.init();
            }

            init() {
                this.bindEvents();
                this.loadNews();
                this.updateLastUpdated();
            }

            bindEvents() {
                // Search functionality
                document.getElementById('searchBtn').addEventListener('click', () => {
                    this.handleSearch();
                });

                document.getElementById('searchInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.handleSearch();
                    }
                });

                // Refresh button
                document.getElementById('refreshBtn').addEventListener('click', () => {
                    this.loadNews();
                });

                // Category buttons
                document.querySelectorAll('.category-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        this.handleCategoryChange(e.target);
                    });
                });
            }

            handleSearch() {
                const query = document.getElementById('searchInput').value.trim();
                if (query.length < 2) {
                    alert('Please enter at least 2 characters for search');
                    return;
                }
                this.currentQuery = query;
                this.loadNews();
            }

            handleCategoryChange(button) {
                // Update active button
                document.querySelectorAll('.category-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');

                this.currentCategory = button.dataset.category;
                this.currentQuery = '';
                document.getElementById('searchInput').value = '';
                this.loadNews();
            }

            async loadNews() {
                if (this.isLoading) return;
                
                this.showLoading(true);
                this.isLoading = true;
                
                try {
                    // Using a combination of free APIs for better coverage
                    let articles = [];
                    
                    // Try multiple sources
                    const sources = [
                        this.fetchFromHackerNews(),
                        this.fetchFromReddit(),
                        this.fetchFromGitHubTrending()
                    ];

                    const results = await Promise.allSettled(sources);
                    
                    results.forEach(result => {
                        if (result.status === 'fulfilled' && result.value) {
                            articles = articles.concat(result.value);
                        }
                    });

                    // Filter articles based on category and search
                    articles = this.filterArticles(articles);
                    
                    // Sort by date (newest first)
                    articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
                    
                    this.articles = articles.slice(0, 20); // Limit to 20 articles
                    this.displayNews(this.articles);
                    this.updateNewsCount(this.articles.length);
                    this.updateLastUpdated();
                    
                } catch (error) {
                    console.error('Error fetching news:', error);
                    this.showError('Failed to load news. Please try again later.');
                } finally {
                    this.showLoading(false);
                    this.isLoading = false;
                }
            }

            async fetchFromHackerNews() {
                try {
                    const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty');
                    const storyIds = await response.json();
                    
                    const articles = await Promise.all(
                        storyIds.slice(0, 10).map(async (id) => {
                            try {
                                const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json?print=pretty`);
                                const story = await storyResponse.json();
                                
                                if (story && story.title && story.url) {
                                    return {
                                        title: story.title,
                                        description: story.title,
                                        url: story.url,
                                        urlToImage: 'https://via.placeholder.com/400x200/FF6600/ffffff?text=Hacker+News',
                                        publishedAt: new Date(story.time * 1000).toISOString(),
                                        source: { name: 'Hacker News' },
                                        category: 'technology',
                                        score: story.score || 0
                                    };
                                }
                            } catch (e) {
                                return null;
                            }
                        })
                    );
                    
                    return articles.filter(article => article !== null);
                } catch (error) {
                    console.error('HackerNews API error:', error);
                    return [];
                }
            }

            async fetchFromReddit() {
                try {
                    const subreddits = ['worldnews', 'technology', 'science', 'business'];
                    const articles = [];
                    
                    for (const subreddit of subreddits) {
                        try {
                            const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=5`);
                            const data = await response.json();
                            
                            if (data.data && data.data.children) {
                                data.data.children.forEach(post => {
                                    const p = post.data;
                                    if (p.title && !p.is_self && p.url && !p.url.includes('reddit.com')) {
                                        articles.push({
                                            title: p.title,
                                            description: p.selftext || p.title,
                                            url: p.url,
                                            urlToImage: p.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || 
                                                       'https://via.placeholder.com/400x200/FF4500/ffffff?text=Reddit',
                                            publishedAt: new Date(p.created_utc * 1000).toISOString(),
                                            source: { name: `r/${subreddit}` },
                                            category: this.mapSubredditToCategory(subreddit),
                                            score: p.score || 0
                                        });
                                    }
                                });
                            }
                        } catch (e) {
                            console.error(`Error fetching from r/${subreddit}:`, e);
                        }
                    }
                    
                    return articles;
                } catch (error) {
                    console.error('Reddit API error:', error);
                    return [];
                }
            }

            async fetchFromGitHubTrending() {
                try {
                    const response = await fetch('https://api.github.com/search/repositories?q=created:>2024-01-01&sort=stars&order=desc&per_page=5');
                    const data = await response.json();
                    
                    if (data.items) {
                        return data.items.map(repo => ({
                            title: `🔥 Trending: ${repo.name}`,
                            description: repo.description || 'Popular GitHub repository gaining attention',
                            url: repo.html_url,
                            urlToImage: 'https://via.placeholder.com/400x200/333333/ffffff?text=GitHub',
                            publishedAt: repo.updated_at,
                            source: { name: 'GitHub Trending' },
                            category: 'technology',
                            score: repo.stargazers_count
                        }));
                    }
                } catch (error) {
                    console.error('GitHub API error:', error);
                }
                return [];
            }

            mapSubredditToCategory(subreddit) {
                const mapping = {
                    'worldnews': 'politics',
                    'technology': 'technology',
                    'science': 'science',
                    'business': 'business',
                    'sports': 'sports',
                    'entertainment': 'entertainment'
                };
                return mapping[subreddit] || 'general';
            }

            filterArticles(articles) {
                let filtered = articles;
                
                // Filter by category
                if (this.currentCategory) {
                    filtered = filtered.filter(article => 
                        article.category === this.currentCategory
                    );
                }
                
                // Filter by search query
                if (this.currentQuery) {
                    const query = this.currentQuery.toLowerCase();
                    filtered = filtered.filter(article =>
                        article.title.toLowerCase().includes(query) ||
                        (article.description && article.description.toLowerCase().includes(query))
                    );
                }
                
                return filtered;
            }

            displayNews(articles) {
                const container = document.getElementById('newsContainer');
                
                if (!articles || articles.length === 0) {
                    container.innerHTML = `
                        <div class="no-results fade-in">
                            <div class="no-results-icon">📭</div>
                            <h3>No articles found</h3>
                            <p>Try adjusting your search terms or browse different categories.</p>
                        </div>
                    `;
                    return;
                }

                const newsHTML = articles
                    .filter(article => article && article.title)
                    .map(article => this.createNewsCard(article))
                    .join('');

                container.innerHTML = newsHTML;
                
                // Add fade-in animation
                container.classList.add('fade-in');
                setTimeout(() => container.classList.remove('fade-in'), 500);
            }

            createNewsCard(article) {
                const publishedDate = new Date(article.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const categoryEmojis = {
                    'technology': '💻',
                    'business': '💼',
                    'science': '🔬',
                    'sports': '⚽',
                    'health': '🏥',
                    'entertainment': '🎬',
                    'politics': '🏛️'
                };

                const categoryDisplay = this.currentCategory || article.category || 'general';
                const emoji = categoryEmojis[categoryDisplay] || '📰';

                return `
                    <div class="news-card" onclick="window.open('${article.url}', '_blank')">
                        <img src="${article.urlToImage}" alt="${article.title}" class="news-image" 
                             onerror="this.src='https://via.placeholder.com/400x200/6366f1/ffffff?text=News+Image'">
                        <div class="news-content">
                            <div class="news-category">${emoji} ${categoryDisplay.toUpperCase()}</div>
                            <h3 class="news-title">${article.title}</h3>
                            <p class="news-description">${article.description || 'Click to read more...'}</p>
                            <div class="news-meta">
                                <span class="news-source">${article.source.name}</span>
                                <span class="news-date">${publishedDate}</span>
                            </div>
                            <button class="read-more">📖 Read Full Article</button>
                        </div>
                    </div>
                `;
            }

            updateNewsCount(count) {
                const countElement = document.getElementById('newsCount');
                countElement.textContent = `${count} articles loaded`;
            }

            updateLastUpdated() {
                const lastUpdatedElement = document.getElementById('lastUpdated');
                const now = new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                lastUpdatedElement.textContent = `Last updated: ${now}`;
            }

            showLoading(show) {
                const loadingDiv = document.getElementById('loadingDiv');
                loadingDiv.style.display = show ? 'block' : 'none';
            }

            showError(message) {
                const container = document.getElementById('newsContainer');
                container.innerHTML = `
                    <div class="error-message fade-in">
                        <div class="error-icon">⚠️</div>
                        <div class="error-title">Oops! Something went wrong</div>
                        <p>${message}</p>
                        <button class="search-btn" onclick="location.reload()" style="margin-top: 16px;">
                            🔄 Try Again
                        </button>
                    </div>
                `;
            }
        }

        // Initialize the app
        document.addEventListener('DOMContentLoaded', () => {
            window.newsApp = new NewsApp();
            
            // Auto-refresh every 5 minutes
            setInterval(() => {
                if (!window.newsApp.isLoading) {
                    window.newsApp.loadNews();
                }
            }, 300000); // 5 minutes
        });

        // Add some keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Press 'R' to refresh
            if (e.key === 'r' || e.key === 'R') {
                if (e.target.tagName !== 'INPUT') {
                    e.preventDefault();
                    window.newsApp.loadNews();
                }
            }
            
            // Press '/' to focus search
            if (e.key === '/') {
                if (e.target.tagName !== 'INPUT') {
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                }
            }
        });