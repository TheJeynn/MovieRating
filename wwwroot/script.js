// ── CONFIG ───────────────────────────────────────────────────────
const API = "http://localhost:5128/api";
const RATINGS = `${API}/Ratings`;
const MOVIES = `${API}/Movies`;
const IMG = "https://image.tmdb.org/t/p/w500";
const IMG_BIG = "https://image.tmdb.org/t/p/original";

// ── STATE ────────────────────────────────────────────────────────
let currentView = "trending";
let currentPage = 1;
let totalPages = 1;
let currentGenre = null;
let currentSort = "default";
let allItems = [];
let heroItems = [];
let heroIndex = 0;
let heroTimer = null;
let selectedScore = 0;
let currentItem = null;
let searchTimer = null;
let genres = { movie: [], tv: [] };

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupNavTabs();
    setupSearch();
    setupStars();
    setupSort();
    setupHamburger();
    loadView("trending");
});

// ── NAV TABS ─────────────────────────────────────────────────────
function setupNavTabs() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
            // close mobile menu
            document.getElementById('mobileMenu').classList.remove('open');
        });
    });
}

function switchView(view) {
    currentView = view;
    currentPage = 1;
    currentGenre = null;
    allItems = [];

    document.querySelectorAll('.nav-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.view === view));

    const titles = {
        trending: "Trending Today",
        movies: "Popular Movies",
        series: "Popular Series",
        toprated: "Top Rated",
        myratings: "My Ratings"
    };
    document.getElementById('sectionTitle').textContent = titles[view] || "";
    document.getElementById('resultCount').textContent = "";

    // Show/hide hero & genres
    const showHero = ["trending", "movies", "series", "toprated"].includes(view);
    document.getElementById('hero').style.display = showHero ? "block" : "none";

    if (view === "movies") loadGenres("movie");
    else if (view === "series") loadGenres("tv");
    else document.getElementById('genreFilter').innerHTML = "";

    loadView(view);
}

// ── LOAD VIEW ────────────────────────────────────────────────────
async function loadView(view, append = false) {
    if (!append) showGridLoading();

    try {
        let data;
        switch (view) {
            case "trending":
                data = await fetchJSON(`${MOVIES}/trending?page=${currentPage}`);
                break;
            case "movies":
                data = currentGenre
                    ? await fetchJSON(`${MOVIES}/discover?type=movie&genreId=${currentGenre}&page=${currentPage}`)
                    : await fetchJSON(`${MOVIES}/popular?type=movie&page=${currentPage}`);
                break;
            case "series":
                data = currentGenre
                    ? await fetchJSON(`${MOVIES}/discover?type=tv&genreId=${currentGenre}&page=${currentPage}`)
                    : await fetchJSON(`${MOVIES}/popular?type=tv&page=${currentPage}`);
                break;
            case "toprated":
                data = await fetchJSON(`${MOVIES}/toprated?type=movie&page=${currentPage}`);
                break;
            case "myratings":
                const ratings = await fetchJSON(RATINGS);
                renderMyRatings(ratings);
                return;
        }

        const results = data?.results ?? [];
        totalPages = data?.total_pages ?? 1;

        if (!append) {
            allItems = results;
            // Set hero for first load
            if (results.length > 0 && ["trending", "movies", "series"].includes(view)) {
                heroItems = results.slice(0, 5);
                setHero(0);
                startHeroTimer();
                renderHeroDots();
            }
        } else {
            allItems = [...allItems, ...results];
        }

        renderGrid(append ? results : allItems, append);
        updateLoadMore();
        document.getElementById('resultCount').textContent =
            data?.total_results ? `${data.total_results.toLocaleString()} titles` : "";

    } catch (err) {
        console.error(err);
        showGridEmpty("Something went wrong. Please try again.");
    }
}

// ── RENDER GRID ──────────────────────────────────────────────────
function renderGrid(items, append = false) {
    const grid = document.getElementById('movieGrid');
    if (!append) grid.innerHTML = "";

    if (!items || items.length === 0) {
        showGridEmpty("No content found.");
        return;
    }

    const sorted = sortItems([...items]);
    sorted.forEach((item, i) => {
        const card = createCard(item);
        card.style.animationDelay = append ? "0ms" : `${Math.min(i * 30, 300)}ms`;
        grid.appendChild(card);
    });
}

function createCard(item) {
    const title = item.title || item.name || "Unknown";
    const score = item.vote_average ? item.vote_average.toFixed(1) : null;
    const type = item.media_type === "tv" ? "tv" : "movie";
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const poster = item.poster_path
        ? `${IMG}${item.poster_path}`
        : "https://via.placeholder.com/300x450/1e1e2a/5a5a72?text=No+Poster";

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
        <div class="card-img-wrap">
            <img class="card-img" src="${poster}" alt="${title}" loading="lazy">
            <div class="card-hover">
                <button class="card-rate-btn" onclick='openModal(${JSON.stringify(item)})'>⭐ Rate It</button>
            </div>
            <span class="card-badge ${type === 'tv' ? 'badge-tv' : 'badge-movie'}">${type === 'tv' ? 'TV' : 'MOVIE'}</span>
            ${score ? `<span class="card-score">★ ${score}</span>` : ''}
        </div>
        <div class="card-body">
            <div class="card-title">${title}</div>
            ${year ? `<div class="card-year">${year}</div>` : ''}
        </div>
    `;
    return card;
}

function renderMyRatings(ratings) {
    document.getElementById('hero').style.display = "none";
    const grid = document.getElementById('movieGrid');
    grid.innerHTML = "";
    document.getElementById('loadMoreWrap').classList.remove('show');

    if (!ratings || ratings.length === 0) {
        showGridEmpty("You haven't rated anything yet. Start rating!");
        return;
    }

    document.getElementById('resultCount').textContent = `${ratings.length} rated`;

    ratings.forEach((r, i) => {
        const poster = r.posterPath
            ? `${IMG}${r.posterPath}`
            : "https://via.placeholder.com/300x450/1e1e2a/5a5a72?text=No+Poster";

        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.animationDelay = `${Math.min(i * 30, 300)}ms`;
        card.innerHTML = `
            <div class="card-img-wrap">
                <img class="card-img" src="${poster}" alt="${r.movieTitle}" loading="lazy">
                <span class="card-badge badge-rated">RATED</span>
                <span class="card-score">★ ${r.score}</span>
            </div>
            <div class="card-body">
                <div class="card-title">${r.movieTitle}</div>
                <div class="card-user-score">Your Score: ${r.score}/10</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ── HERO ─────────────────────────────────────────────────────────
function setHero(index) {
    heroIndex = index;
    const item = heroItems[index];
    if (!item) return;

    const title = item.title || item.name || "Unknown";
    const type = item.media_type === "tv" ? "TV SHOW" : "MOVIE";
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const score = item.vote_average?.toFixed(1);
    const bg = item.backdrop_path ? `${IMG_BIG}${item.backdrop_path}` : "";

    document.getElementById('heroBg').style.backgroundImage = bg ? `url(${bg})` : "none";
    document.getElementById('heroBadge').textContent = `${type} • TRENDING`;
    document.getElementById('heroTitle').textContent = title;
    document.getElementById('heroDesc').textContent = item.overview || "";
    document.getElementById('heroMeta').innerHTML = `
        ${year ? `<span>📅 ${year}</span>` : ""}
        ${score ? `<span class="hero-score">★ ${score}</span>` : ""}
    `;

    document.getElementById('heroRateBtn').onclick = () => openModal(item);

    // Update dots
    document.querySelectorAll('.hero-dot').forEach((d, i) =>
        d.classList.toggle('active', i === index));
}

function renderHeroDots() {
    const dots = document.getElementById('heroDots');
    dots.innerHTML = heroItems.map((_, i) =>
        `<button class="hero-dot ${i === 0 ? 'active' : ''}" onclick="goHero(${i})"></button>`
    ).join('');
}

function goHero(i) {
    clearInterval(heroTimer);
    setHero(i);
    startHeroTimer();
}

function startHeroTimer() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => {
        setHero((heroIndex + 1) % heroItems.length);
    }, 6000);
}

function scrollToGrid() {
    document.querySelector('.content').scrollIntoView({ behavior: 'smooth' });
}

// ── GENRES ───────────────────────────────────────────────────────
async function loadGenres(type) {
    if (genres[type].length > 0) {
        renderGenres(genres[type]);
        return;
    }
    try {
        const data = await fetchJSON(`${MOVIES}/genres?type=${type}`);
        genres[type] = data || [];
        renderGenres(genres[type]);
    } catch { }
}

function renderGenres(list) {
    const container = document.getElementById('genreFilter');
    container.innerHTML = `<button class="genre-btn active" data-id="" onclick="selectGenre(null, this)">All</button>` +
        list.slice(0, 8).map(g =>
            `<button class="genre-btn" data-id="${g.id}" onclick="selectGenre(${g.id}, this)">${g.name}</button>`
        ).join('');
}

function selectGenre(id, btn) {
    currentGenre = id;
    currentPage = 1;
    allItems = [];
    document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadView(currentView);
}

// ── SORT ─────────────────────────────────────────────────────────
function setupSort() {
    document.getElementById('sortSelect').addEventListener('change', e => {
        currentSort = e.target.value;
        renderGrid(allItems);
    });
}

function sortItems(items) {
    switch (currentSort) {
        case "rating_high": return items.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        case "rating_low": return items.sort((a, b) => (a.vote_average || 0) - (b.vote_average || 0));
        case "title_az": return items.sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""));
        default: return items;
    }
}

// ── LOAD MORE ────────────────────────────────────────────────────
function loadMore() {
    currentPage++;
    loadView(currentView, true);
}

function updateLoadMore() {
    const wrap = document.getElementById('loadMoreWrap');
    wrap.classList.toggle('show', currentPage < totalPages && currentView !== 'myratings');
}

// ── SEARCH ───────────────────────────────────────────────────────
function setupSearch() {
    const input = document.getElementById('searchInput');
    const dropdown = document.getElementById('searchDropdown');

    input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const q = input.value.trim();
        if (q.length < 2) { dropdown.classList.remove('show'); return; }
        dropdown.innerHTML = `<div class="search-loading">Searching...</div>`;
        dropdown.classList.add('show');
        searchTimer = setTimeout(() => performSearch(q), 400);
    });

    // Close on outside click
    document.addEventListener('click', e => {
        if (!e.target.closest('.nav-search')) dropdown.classList.remove('show');
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') { dropdown.classList.remove('show'); input.blur(); }
    });
}

async function performSearch(query) {
    const dropdown = document.getElementById('searchDropdown');
    try {
        const data = await fetchJSON(`${MOVIES}/search?query=${encodeURIComponent(query)}`);
        const results = (data?.results || []).filter(r => r.media_type !== 'person').slice(0, 8);

        if (results.length === 0) {
            dropdown.innerHTML = `<div class="search-empty">No results found for "${query}"</div>`;
            return;
        }

        dropdown.innerHTML = results.map(item => {
            const title = item.title || item.name || "Unknown";
            const type = item.media_type === "tv" ? "TV Show" : "Movie";
            const year = (item.release_date || item.first_air_date || "").slice(0, 4);
            const score = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
            const poster = item.poster_path
                ? `${IMG}${item.poster_path}`
                : "https://via.placeholder.com/40x56/1e1e2a/5a5a72?text=?";

            return `
                <div class="search-result-item" onclick='searchSelectItem(${JSON.stringify(item)})'>
                    <img src="${poster}" alt="${title}">
                    <div class="search-result-info">
                        <h4>${title}</h4>
                        <span>${type} ${year ? '• ' + year : ''}</span>
                    </div>
                    <span class="search-result-score">★ ${score}</span>
                </div>
            `;
        }).join('');

    } catch {
        dropdown.innerHTML = `<div class="search-empty">Search failed. Try again.</div>`;
    }
}

function searchSelectItem(item) {
    document.getElementById('searchDropdown').classList.remove('show');
    document.getElementById('searchInput').value = "";
    openModal(item);
}

// ── MODAL ────────────────────────────────────────────────────────
function openModal(item) {
    currentItem = item;
    selectedScore = 0;

    const title = item.title || item.name || "Unknown";
    const type = item.media_type === "tv" ? "TV SHOW" : "MOVIE";
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const score = item.vote_average ? item.vote_average.toFixed(1) : "—";
    const poster = item.poster_path
        ? `${IMG}${item.poster_path}`
        : "https://via.placeholder.com/500x280/1e1e2a/5a5a72?text=No+Image";

    document.getElementById('modalPoster').src = poster;
    document.getElementById('modalBadge').textContent = type;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalYear').textContent = year;
    document.getElementById('modalOverview').textContent = item.overview || "No description available.";
    document.getElementById('modalTmdbScore').textContent = score;
    document.getElementById('modalStatus').textContent = "";
    document.getElementById('ratingLabel').textContent = "—";
    document.getElementById('submitRating').disabled = false;
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));

    document.getElementById('modalOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    document.body.style.overflow = '';
    currentItem = null;
    selectedScore = 0;
}

// ── STARS ────────────────────────────────────────────────────────
function setupStars() {
    const stars = document.querySelectorAll('.star');
    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const val = parseInt(star.dataset.value);
            stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= val));
        });
        star.addEventListener('mouseout', () => {
            stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= selectedScore));
        });
        star.addEventListener('click', () => {
            selectedScore = parseInt(star.dataset.value);
            document.getElementById('ratingLabel').textContent = `${selectedScore} / 10`;
            stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= selectedScore));
        });
    });
}

// ── SUBMIT RATING ────────────────────────────────────────────────
async function submitRating() {
    if (!currentItem || selectedScore === 0) {
        document.getElementById('modalStatus').textContent = "⚠️ Please select a score first.";
        return;
    }

    const btn = document.getElementById('submitRating');
    btn.disabled = true;
    document.getElementById('modalStatus').textContent = "Saving...";

    const payload = {
        tmdbId: currentItem.id,
        score: selectedScore,
        movieTitle: currentItem.title || currentItem.name || "Unknown",
        posterPath: currentItem.poster_path || "",
        mediaType: currentItem.media_type || "movie"
    };

    try {
        const res = await fetch(RATINGS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            document.getElementById('modalStatus').textContent = "✅ Rating saved!";
            setTimeout(closeModal, 1000);
        } else {
            const err = await res.text();
            document.getElementById('modalStatus').textContent = `❌ ${err}`;
            btn.disabled = false;
        }
    } catch {
        document.getElementById('modalStatus').textContent = "❌ Could not connect to server.";
        btn.disabled = false;
    }
}

// ── HAMBURGER ────────────────────────────────────────────────────
function setupHamburger() {
    document.getElementById('hamburger').addEventListener('click', () => {
        document.getElementById('mobileMenu').classList.toggle('open');
    });
}

// ── HELPERS ──────────────────────────────────────────────────────
async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function showGridLoading() {
    document.getElementById('movieGrid').innerHTML = `
        <div class="grid-loading">
            <div class="spinner"></div>
            <span>Loading content...</span>
        </div>`;
    document.getElementById('loadMoreWrap').classList.remove('show');
}

function showGridEmpty(msg) {
    document.getElementById('movieGrid').innerHTML = `
        <div class="grid-empty">
            <h3>${msg}</h3>
        </div>`;
}