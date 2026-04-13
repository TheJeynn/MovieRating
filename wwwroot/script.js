// ── CONFIG ───────────────────────────────────────────────────────
const API = "api";
const RATINGS = `${API}/Ratings`;
const MOVIES = `${API}/Movies`;
const RECOMMEND = `${API}/Recommend`;
const IMG = "https://image.tmdb.org/t/p/w500";
const IMG_BIG = "https://image.tmdb.org/t/p/original";
const SCORE_MIN = 0;
const SCORE_MAX = 10;
const DEFAULT_REC_MIN_SCORE = 6.5;
const DEFAULT_REC_MAX_SCORE = 10;

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
let contentRatingCache = { movie: {}, tv: {} };

// Recommend state
let recType = "movie";
let recSelectedGenres = [];
let recExcludeIds = [];
let recCurrentItem = null;
let recMinRating = DEFAULT_REC_MIN_SCORE;
let recMaxRating = DEFAULT_REC_MAX_SCORE;
let recAgeRating = "all";

// Filter state
let filterMinRating = 0;
let filterMaxRating = 10;
let filterGenreIds = [];
let filterGenreMode = "any";
let filterAgeRating = "all";
let advFilterOpen = false;

// Genre name map (populated from API)
let genreMap = {};

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupNavTabs();
    setupSearch();
    setupStars();
    setupSort();
    setupHamburger();
    syncMainFilterControls();
    resetRecommendFilters();
    loadView("trending");
});

// ── NAV ──────────────────────────────────────────────────────────
function setupNavTabs() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
            document.getElementById('mobileMenu').classList.remove('open');
        });
    });
}

function switchView(view) {
    currentView = view;
    currentPage = 1;
    currentGenre = null;
    allItems = [];
    heroItems = [];
    clearInterval(heroTimer);
    resetFilterState();
    currentSort = "default";
    document.getElementById('sortSelect').value = currentSort;
    hideSearchDropdown();

    document.querySelectorAll('.nav-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.view === view));

    const isRecommend = view === "recommend";
    document.getElementById('hero').style.display = isRecommend ? "none" : ["trending", "movies", "series", "toprated"].includes(view) ? "block" : "none";
    document.getElementById('recommendPage').style.display = isRecommend ? "block" : "none";
    document.getElementById('mainContent').style.display = isRecommend ? "none" : "block";

    if (isRecommend) { initRecommend(); return; }

    const titles = { trending: "Trending Today", movies: "Popular Movies", series: "Popular Series", toprated: "Top Rated", myratings: "My Ratings" };
    document.getElementById('sectionTitle').textContent = titles[view] || "";
    document.getElementById('resultCount').textContent = "";
    updateFilterControlsVisibility(view);

    const showGenreBar = ["movies", "series"].includes(view);
    document.getElementById('genreQuickBar').style.display = showGenreBar ? "block" : "none";
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
                data = await fetchJSON(`${MOVIES}/trending?page=${currentPage}`); break;
            case "movies":
                data = currentGenre
                    ? await fetchJSON(`${MOVIES}/discover?type=movie&genreId=${currentGenre}&page=${currentPage}`)
                    : await fetchJSON(`${MOVIES}/popular?type=movie&page=${currentPage}`); break;
            case "series":
                data = currentGenre
                    ? await fetchJSON(`${MOVIES}/discover?type=tv&genreId=${currentGenre}&page=${currentPage}`)
                    : await fetchJSON(`${MOVIES}/popular?type=tv&page=${currentPage}`); break;
            case "toprated":
                data = await fetchJSON(`${MOVIES}/toprated?type=movie&page=${currentPage}`); break;
            case "myratings":
                const ratings = await fetchJSON(RATINGS);
                renderMyRatings(ratings);
                return;
        }

        const results = data?.results ?? [];
        totalPages = data?.total_pages ?? 1;

        if (!append) {
            allItems = results;
            if (results.length > 0 && ["trending", "movies", "series"].includes(view)) {
                heroItems = results.filter(r => r.backdrop_path).slice(0, 6);
                if (heroItems.length) { setHero(0); startHeroTimer(); renderHeroDots(); }
            }
        } else {
            allItems = [...allItems, ...results];
        }

        if (filterAgeRating !== "all") {
            await ensureItemsHaveContentRatings(append ? results : allItems);
        }

        const shouldAppend = append && !hasActiveFilters() && currentSort === "default";
        renderGrid(shouldAppend ? results : getFilteredItems(), shouldAppend);
        updateLoadMore();
        document.getElementById('resultCount').textContent =
            data?.total_results ? `${data.total_results.toLocaleString()} titles` : "";

    } catch (err) {
        console.error(err);
        showGridEmpty("Something went wrong. Please try again.");
    }
}

// ── RENDER GRID ──────────────────────────────────────────────────
function getFilteredItems() {
    return allItems.filter(item => {
        const score = item.vote_average || 0;
        if (score < filterMinRating || score > filterMaxRating) return false;

        if (!matchesSelectedAge(item.contentRatingAge ?? item.content_rating_age, filterAgeRating)) {
            return false;
        }

        if (filterGenreIds.length > 0) {
            const itemGenres = item.genre_ids || item.genreIds || [];
            const matchesGenres = filterGenreMode === "all"
                ? filterGenreIds.every(g => itemGenres.includes(g))
                : filterGenreIds.some(g => itemGenres.includes(g));

            if (!matchesGenres) return false;
        }
        return true;
    });
}

function renderGrid(items, append = false) {
    const grid = document.getElementById('movieGrid');
    if (!append) grid.innerHTML = "";
    if (!items || items.length === 0) { showGridEmpty("No content found."); return; }
    sortItems([...items]).forEach((item, i) => {
        const card = createCard(item);
        card.style.animationDelay = append ? "0ms" : `${Math.min(i * 25, 350)}ms`;
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
        : "https://via.placeholder.com/300x450/1e1e2a/5a5a72?text=No+Image";

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
        <div class="card-img-wrap">
            <img class="card-img" src="${poster}" alt="${escHtml(title)}" loading="lazy">
            <div class="card-hover">
                <button class="card-rate-btn" type="button">⭐ Rate It</button>
            </div>
            <span class="card-badge ${type === 'tv' ? 'badge-tv' : 'badge-movie'}">${type === 'tv' ? 'TV' : 'MOVIE'}</span>
            ${score ? `<span class="card-score">★ ${score}</span>` : ''}
        </div>
        <div class="card-body">
            <div class="card-title">${escHtml(title)}</div>
            ${year ? `<div class="card-year">${year}</div>` : ''}
        </div>`;
    card.querySelector('.card-rate-btn')?.addEventListener('click', event => {
        event.stopPropagation();
        openModal(item);
    });
    return card;
}

function renderMyRatings(ratings) {
    const grid = document.getElementById('movieGrid');
    grid.innerHTML = "";
    document.getElementById('loadMoreWrap').classList.remove('show');
    document.getElementById('genreQuickBar').style.display = "none";

    if (!ratings || ratings.length === 0) {
        showGridEmpty("You haven't rated anything yet. Start rating!");
        return;
    }
    document.getElementById('resultCount').textContent = `${ratings.length} rated`;

    ratings.forEach((r, i) => {
        const poster = r.posterPath ? `${IMG}${r.posterPath}` : "https://via.placeholder.com/300x450/1e1e2a/5a5a72?text=?";
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.animationDelay = `${Math.min(i * 25, 350)}ms`;
        card.innerHTML = `
            <div class="card-img-wrap">
                <img class="card-img" src="${poster}" alt="${escHtml(r.movieTitle)}" loading="lazy">
                <span class="card-badge badge-rated">RATED</span>
                <span class="card-score">★ ${r.score}</span>
            </div>
            <div class="card-body">
                <div class="card-title">${escHtml(r.movieTitle)}</div>
                <div class="card-user-score">Your Score: ${r.score}/10</div>
                <div class="my-rating-actions">
                    <button class="btn-ghost small card-remove-rating" type="button">Take Back Rating</button>
                </div>
            </div>`;
        card.querySelector('.card-remove-rating')?.addEventListener('click', event => {
            event.stopPropagation();
            deleteRating(r.id, event.currentTarget);
        });
        grid.appendChild(card);
    });
}

// ── HERO ─────────────────────────────────────────────────────────
function setHero(idx) {
    heroIndex = idx;
    const item = heroItems[idx]; if (!item) return;
    const title = item.title || item.name || "Unknown";
    const type = item.media_type === "tv" ? "TV SHOW" : "MOVIE";
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const score = item.vote_average?.toFixed(1);
    const bg = item.backdrop_path ? `${IMG_BIG}${item.backdrop_path}` : "";

    document.getElementById('heroBg').style.backgroundImage = bg ? `url(${bg})` : "none";
    document.getElementById('heroBadge').textContent = `${type} • TRENDING`;
    document.getElementById('heroTitle').textContent = title;
    document.getElementById('heroDesc').textContent = item.overview || "";
    document.getElementById('heroMeta').innerHTML = `${year ? `<span>📅 ${year}</span>` : ''}${score ? `<span class="hero-score">★ ${score}</span>` : ''}`;
    document.getElementById('heroRateBtn').onclick = () => openModal(item);
    document.querySelectorAll('.hero-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

function renderHeroDots() {
    document.getElementById('heroDots').innerHTML = heroItems.map((_, i) =>
        `<button class="hero-dot ${i === 0 ? 'active' : ''}" onclick="goHero(${i})"></button>`).join('');
}
function goHero(i) { clearInterval(heroTimer); setHero(i); startHeroTimer(); }
function startHeroTimer() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => setHero((heroIndex + 1) % heroItems.length), 6000);
}
function scrollToGrid() { document.querySelector('.content')?.scrollIntoView({ behavior: 'smooth' }); }

// ── GENRES ───────────────────────────────────────────────────────
async function loadGenres(type) {
    const list = await ensureGenresLoaded(type);
    if (!list.length) return;

    renderGenres(list);
}

async function ensureGenresLoaded(type) {
    if (genres[type].length > 0) return genres[type];

    try {
        const data = await fetchJSON(`${MOVIES}/genres?type=${type}`);
        genres[type] = data || [];
        genres[type].forEach(g => genreMap[g.id] = g.name);
    } catch {
        genres[type] = [];
    }

    return genres[type];
}

function renderGenres(list) {
    document.getElementById('genreFilter').innerHTML =
        `<button class="genre-btn active" onclick="selectGenre(null,this)">All</button>` +
        list.slice(0, 10).map(g =>
            `<button class="genre-btn" data-id="${g.id}" onclick="selectGenre(${g.id},this)">${g.name}</button>`
        ).join('');
}

function selectGenre(id, btn) {
    currentGenre = id; currentPage = 1; allItems = [];
    document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadView(currentView);
}

// ── ADVANCED FILTER ───────────────────────────────────────────────
async function toggleAdvancedFilter() {
    advFilterOpen = !advFilterOpen;
    const panel = document.getElementById('advancedFilter');
    const btn = document.getElementById('filterToggleBtn');
    panel.style.display = advFilterOpen ? "block" : "none";
    btn.classList.toggle('active', advFilterOpen);

    if (advFilterOpen) await populateAdvGenres();
}

async function populateAdvGenres() {
    const list = await getAdvancedGenreList();
    const container = document.getElementById('advGenreList');

    syncMainFilterControls();
    syncFilterGenreModeButtons();

    if (!list.length) {
        container.innerHTML = `<span class="search-empty">Genres unavailable right now.</span>`;
        return;
    }

    container.innerHTML = list.map(g =>
        `<button class="adv-genre-chip ${filterGenreIds.includes(g.id) ? 'selected' : ''}"
         onclick="toggleAdvGenre(${g.id},this)">${g.name}</button>`
    ).join('');
}

async function getAdvancedGenreList() {
    if (currentView === "series") {
        return ensureGenresLoaded("tv");
    }

    if (currentView === "trending") {
        const [movieGenres, tvGenres] = await Promise.all([
            ensureGenresLoaded("movie"),
            ensureGenresLoaded("tv")
        ]);

        return [...movieGenres, ...tvGenres]
            .filter((genre, index, arr) => arr.findIndex(g => g.id === genre.id) === index)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    return ensureGenresLoaded("movie");
}

function setFilterGenreMode(mode) {
    filterGenreMode = mode === "all" ? "all" : "any";
    syncFilterGenreModeButtons();
}

async function setFilterAgeRating(value) {
    filterAgeRating = normalizeAgeOption(value);
    syncAgeFilterButtons('ageFilterGroup', filterAgeRating);

    if (filterAgeRating !== "all" && allItems.length > 0) {
        await ensureItemsHaveContentRatings(allItems);
    }
}

function syncFilterGenreModeButtons() {
    document.getElementById('matchAnyBtn')?.classList.toggle('active', filterGenreMode === "any");
    document.getElementById('matchAllBtn')?.classList.toggle('active', filterGenreMode === "all");
}

function toggleAdvGenre(id, btn) {
    btn.classList.toggle('selected');
    if (filterGenreIds.includes(id)) filterGenreIds = filterGenreIds.filter(g => g !== id);
    else filterGenreIds.push(id);
}

function updateRatingFilter(source = "range") {
    const minValue = source === "input"
        ? document.getElementById('ratingMinInput').value
        : document.getElementById('ratingMinRange').value;
    const maxValue = source === "input"
        ? document.getElementById('ratingMaxInput').value
        : document.getElementById('ratingMaxRange').value;

    [filterMinRating, filterMaxRating] = normalizeScorePair(minValue, maxValue, filterMinRating, filterMaxRating);
    syncMainFilterControls();
}

async function applyFilters() {
    if (filterAgeRating !== "all" && allItems.length > 0) {
        showGridLoading();
        await ensureItemsHaveContentRatings(allItems);
    }

    renderGrid(getFilteredItems());
    updateLoadMore();

    if (advFilterOpen) await toggleAdvancedFilter();
}

function clearFilters() {
    resetFilterState();
    if (allItems.length > 0 && currentView !== "myratings") {
        renderGrid(getFilteredItems());
        updateLoadMore();
    }
}

// ── SORT ─────────────────────────────────────────────────────────
function setupSort() {
    document.getElementById('sortSelect').addEventListener('change', e => {
        currentSort = e.target.value;
        renderGrid(getFilteredItems());
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
function loadMore() { currentPage++; loadView(currentView, true); }
function updateLoadMore() {
    document.getElementById('loadMoreWrap').classList.toggle(
        'show', currentPage < totalPages && !["myratings", "recommend"].includes(currentView));
}

// ── SEARCH ───────────────────────────────────────────────────────
function setupSearch() {
    const input = document.getElementById('searchInput');
    const dd = document.getElementById('searchDropdown');

    input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const q = input.value.trim();
        if (q.length < 2) { dd.classList.remove('show'); return; }
        dd.innerHTML = `<div class="search-loading">Searching...</div>`;
        dd.classList.add('show');
        searchTimer = setTimeout(() => performSearch(q), 380);
    });

    document.addEventListener('click', e => { if (!e.target.closest('.nav-search')) dd.classList.remove('show'); });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') { dd.classList.remove('show'); input.blur(); } });
}

async function performSearch(query) {
    const dd = document.getElementById('searchDropdown');
    try {
        const data = await fetchJSON(`${MOVIES}/search?query=${encodeURIComponent(query)}`);
        const results = (data?.results || []).filter(r => r.media_type !== 'person').slice(0, 8);

        if (!results.length) { dd.innerHTML = `<div class="search-empty">No results for "${escHtml(query)}"</div>`; return; }

        dd.innerHTML = "";
        const frag = document.createDocumentFragment();

        results.forEach(item => {
            const title = item.title || item.name || "Unknown";
            const type = item.media_type === 'tv' ? 'TV Show' : 'Movie';
            const year = (item.release_date || item.first_air_date || "").slice(0, 4);
            const score = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
            const poster = item.poster_path ? `${IMG}${item.poster_path}` : "https://via.placeholder.com/40x56/1e1e2a/5a5a72?text=?";
            const result = document.createElement('div');
            result.className = 'search-result-item';
            result.innerHTML = `
                <img src="${poster}" alt="${escHtml(title)}">
                <div class="search-result-info">
                    <h4>${escHtml(title)}</h4>
                    <span>${type}${year ? ' • ' + year : ''}</span>
                </div>
                <span class="search-result-score">★ ${score}</span>`;
            result.addEventListener('click', () => searchSelect(item));
            frag.appendChild(result);
        });

        dd.appendChild(frag);
    } catch { dd.innerHTML = `<div class="search-empty">Search failed. Try again.</div>`; }
}

function searchSelect(item) {
    document.getElementById('searchDropdown').classList.remove('show');
    document.getElementById('searchInput').value = "";
    openModal(item);
}

// ── MODAL ────────────────────────────────────────────────────────
function openModal(item) {
    currentItem = item; selectedScore = 0;
    const title = item.title || item.name || "Unknown";
    const type = item.media_type === 'tv' ? 'TV SHOW' : 'MOVIE';
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const score = item.vote_average ? item.vote_average.toFixed(1) : "—";
    const poster = item.poster_path ? `${IMG}${item.poster_path}` : "https://via.placeholder.com/480x210/1e1e2a/5a5a72?text=No+Image";

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
    currentItem = null; selectedScore = 0;
}

// ── STARS ────────────────────────────────────────────────────────
function setupStars() {
    const stars = document.querySelectorAll('.star');
    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const v = +star.dataset.value;
            stars.forEach(s => s.classList.toggle('active', +s.dataset.value <= v));
        });
        star.addEventListener('mouseout', () => {
            stars.forEach(s => s.classList.toggle('active', +s.dataset.value <= selectedScore));
        });
        star.addEventListener('click', () => {
            selectedScore = +star.dataset.value;
            document.getElementById('ratingLabel').textContent = `${selectedScore} / 10`;
            stars.forEach(s => s.classList.toggle('active', +s.dataset.value <= selectedScore));
        });
    });
}

// ── SUBMIT RATING ────────────────────────────────────────────────
async function submitRating() {
    if (!currentItem || selectedScore === 0) {
        document.getElementById('modalStatus').textContent = "⚠️ Please select a score first."; return;
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
        const res = await fetch(RATINGS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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

async function deleteRating(id, button) {
    if (!id || !confirm("Take back this rating? This will remove it from My Ratings.")) {
        return;
    }

    const btn = button instanceof HTMLElement ? button : null;
    const originalLabel = btn?.textContent ?? "";

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Removing...";
    }

    try {
        const res = await fetch(`${RATINGS}/${id}`, { method: "DELETE" });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(err || `HTTP ${res.status}`);
        }

        if (currentView === "myratings") {
            await loadView("myratings");
        }
    } catch (err) {
        console.error(err);
        alert("Rating could not be removed. Please try again.");

        if (btn) {
            btn.disabled = false;
            btn.textContent = originalLabel;
        }
    }
}

// ── RECOMMEND ────────────────────────────────────────────────────
function initRecommend() {
    recType = "movie"; recSelectedGenres = []; recExcludeIds = []; recCurrentItem = null;
    resetRecommendFilters();
    document.getElementById('recFindBtn').disabled = true;
    showRecStep(1);
}

function showRecStep(n) {
    document.getElementById('recStep1').style.display = n === 1 ? "block" : "none";
    document.getElementById('recStep2').style.display = n === 2 ? "block" : "none";
    document.getElementById('recStep3').style.display = n === 3 ? "block" : "none";
}

function selectType(type) {
    recType = type; recSelectedGenres = []; recExcludeIds = []; recCurrentItem = null;
    document.getElementById('recFindBtn').disabled = true;
    showRecStep(2);
    loadRecGenres(type);
}

async function loadRecGenres(type) {
    const grid = document.getElementById('recGenreGrid');
    grid.innerHTML = `<div style="color:var(--text2);padding:20px 0;">Loading genres...</div>`;

    const list = await ensureGenresLoaded(type);
    if (!list.length) { grid.innerHTML = `<p style="color:var(--red)">Failed to load genres.</p>`; return; }

    const genreEmojis = {
        28: "⚔️", 12: "🌍", 16: "🎨", 35: "😂", 80: "🔫", 99: "📽️", 18: "💔",
        10751: "👨‍👩‍👧", 14: "🧙", 36: "📜", 27: "👻", 10402: "🎵", 9648: "🔍",
        10749: "❤️", 878: "🚀", 10770: "📺", 53: "😰", 10752: "🎖️", 37: "🤠",
        10759: "⚡", 10762: "👶", 10763: "📰", 10764: "🎯", 10765: "🔮",
        10766: "💞", 10767: "🎤", 10768: "🎖️"
    };

    grid.innerHTML = list.map(g => `
        <button class="rec-genre-chip" data-id="${g.id}" onclick="toggleRecGenre(${g.id},this)">
            <span>${genreEmojis[g.id] || '🎬'}</span> ${g.name}
        </button>`).join('');
}

function toggleRecGenre(id, btn) {
    btn.classList.toggle('selected');
    if (recSelectedGenres.includes(id)) recSelectedGenres = recSelectedGenres.filter(g => g !== id);
    else recSelectedGenres.push(id);
    document.getElementById('recFindBtn').disabled = recSelectedGenres.length === 0;
}

function setRecommendAgeRating(value) {
    recAgeRating = normalizeAgeOption(value);
    syncAgeFilterButtons('recAgeFilterGroup', recAgeRating);
}

function updateRecommendRatingFilter(source = "range") {
    const minValue = source === "input"
        ? document.getElementById('recRatingMinInput').value
        : document.getElementById('recRatingMinRange').value;
    const maxValue = source === "input"
        ? document.getElementById('recRatingMaxInput').value
        : document.getElementById('recRatingMaxRange').value;

    [recMinRating, recMaxRating] = normalizeScorePair(minValue, maxValue, recMinRating, recMaxRating);
    syncRecommendRatingControls();
}

function backToStep1() { showRecStep(1); }
function backToStep2() { showRecStep(2); }

async function findRecommendation() {
    if (recSelectedGenres.length === 0) return;
    showRecStep(3);
    document.getElementById('recLoading').style.display = "flex";
    document.getElementById('recCard').style.display = "none";
    document.getElementById('recError').style.display = "none";

    try {
        const item = await fetchJSON(RECOMMEND, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: recType,
                genreIds: recSelectedGenres,
                excludeIds: [...new Set(recExcludeIds)],
                genreMode: "all",
                minRating: recMinRating,
                maxRating: recMaxRating,
                ageRating: recAgeRating
            })
        });

        recCurrentItem = item;
        if (!recExcludeIds.includes(item.id)) recExcludeIds.push(item.id);
        showRecCard(item);
    } catch (err) {
        document.getElementById('recLoading').style.display = "none";
        document.getElementById('recError').style.display = "block";
        document.getElementById('recErrorMsg').textContent = "No match found. Try different genres.";
    }
}

function showRecCard(item) {
    const title = item.title || item.name || "Unknown";
    const mediaType = item.mediaType || item.media_type;
    const type = mediaType === "tv" ? "TV SHOW" : "MOVIE";
    const year = (item.releaseDate || item.firstAirDate || item.release_date || item.first_air_date || "").slice(0, 4);
    const score = item.voteAverage || item.vote_average;
    const poster = item.posterPath || item.poster_path;
    const overview = item.overview || "No description available.";
    const contentRating = item.contentRating || item.content_rating;

    document.getElementById('recPoster').src = poster ? `${IMG}${poster}` : "https://via.placeholder.com/260x380/1e1e2a/5a5a72?text=?";
    document.getElementById('recBadge').textContent = type;
    document.getElementById('recTitle').textContent = title;
    document.getElementById('recYear').textContent = year;
    document.getElementById('recOverview').textContent = overview;
    document.getElementById('recScore').textContent = score ? `★ ${(+score).toFixed(1)}` : "";
    document.getElementById('recContentRating').textContent = contentRating ? `Age ${contentRating}` : "";
    document.getElementById('recContentRating').style.display = contentRating ? "inline-flex" : "none";

    // Genre tags
    const gids = item.genreIds || item.genre_ids || [];
    document.getElementById('recGenreTags').innerHTML =
        gids.map(id => `<span class="rec-genre-tag">${genreMap[id] || id}</span>`).join('');

    document.getElementById('recRateBtn').onclick = () => openModal({
        id: item.id, title: item.title, name: item.name,
        overview: item.overview, poster_path: item.posterPath || item.poster_path,
        vote_average: score, release_date: item.releaseDate || item.release_date,
        first_air_date: item.firstAirDate || item.first_air_date,
        media_type: mediaType || "movie"
    });

    document.getElementById('recLoading').style.display = "none";
    document.getElementById('recCard').style.display = "block";
}

function skipRecommendation() { findRecommendation(); }

function markWatchedAndSkip() {
    if (!recCurrentItem) return;
    skipRecommendation();
}

// ── HAMBURGER ────────────────────────────────────────────────────
function setupHamburger() {
    document.getElementById('hamburger').addEventListener('click', () => {
        document.getElementById('mobileMenu').classList.toggle('open');
    });
}

// ── HELPERS ──────────────────────────────────────────────────────
function hasActiveFilters() {
    return filterMinRating > SCORE_MIN ||
        filterMaxRating < SCORE_MAX ||
        filterGenreIds.length > 0 ||
        filterAgeRating !== "all";
}

function resetFilterState() {
    filterMinRating = SCORE_MIN;
    filterMaxRating = SCORE_MAX;
    filterGenreIds = [];
    filterGenreMode = "any";
    filterAgeRating = "all";
    advFilterOpen = false;

    document.getElementById('advancedFilter').style.display = "none";
    document.getElementById('filterToggleBtn').classList.remove('active');
    syncMainFilterControls();
    syncFilterGenreModeButtons();
    syncAgeFilterButtons('ageFilterGroup', filterAgeRating);
}

function resetRecommendFilters() {
    recMinRating = DEFAULT_REC_MIN_SCORE;
    recMaxRating = DEFAULT_REC_MAX_SCORE;
    recAgeRating = "all";
    syncRecommendRatingControls();
}

function syncMainFilterControls() {
    syncScoreControls(
        {
            minLabelId: 'ratingMin',
            maxLabelId: 'ratingMax',
            minInputId: 'ratingMinInput',
            maxInputId: 'ratingMaxInput',
            minRangeId: 'ratingMinRange',
            maxRangeId: 'ratingMaxRange',
            shellId: 'ratingRangeShell'
        },
        filterMinRating,
        filterMaxRating
    );
    syncAgeFilterButtons('ageFilterGroup', filterAgeRating);
}

function syncRecommendRatingControls() {
    syncScoreControls(
        {
            minLabelId: 'recRatingMinLabel',
            maxLabelId: 'recRatingMaxLabel',
            minInputId: 'recRatingMinInput',
            maxInputId: 'recRatingMaxInput',
            minRangeId: 'recRatingMinRange',
            maxRangeId: 'recRatingMaxRange',
            shellId: 'recRatingRangeShell'
        },
        recMinRating,
        recMaxRating
    );
    syncAgeFilterButtons('recAgeFilterGroup', recAgeRating);
}

function syncScoreControls(config, minValue, maxValue) {
    const minText = formatScoreValue(minValue);
    const maxText = formatScoreValue(maxValue);

    document.getElementById(config.minLabelId).textContent = minText;
    document.getElementById(config.maxLabelId).textContent = maxText;
    document.getElementById(config.minInputId).value = minText;
    document.getElementById(config.maxInputId).value = maxText;
    document.getElementById(config.minRangeId).value = minText;
    document.getElementById(config.maxRangeId).value = maxText;

    const rangeStart = `${((minValue - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100}%`;
    const rangeEnd = `${((maxValue - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100}%`;
    document.getElementById(config.shellId).style.setProperty('--range-start', rangeStart);
    document.getElementById(config.shellId).style.setProperty('--range-end', rangeEnd);
}

function syncAgeFilterButtons(containerId, selectedValue) {
    document.querySelectorAll(`#${containerId} .age-filter-chip`).forEach(btn => {
        const isSelected = btn.dataset.value === selectedValue;
        btn.classList.toggle('active', isSelected);
        btn.classList.toggle('selected', isSelected);
    });
}

function normalizeAgeOption(value) {
    return ["all", "family", "13", "16", "18"].includes(String(value)) ? String(value) : "all";
}

function getAgeOptionValue(value) {
    switch (normalizeAgeOption(value)) {
        case "family": return 0;
        case "13": return 13;
        case "16": return 16;
        case "18": return 18;
        default: return null;
    }
}

function matchesSelectedAge(ageValue, selectedValue) {
    const selectedAge = getAgeOptionValue(selectedValue);
    if (selectedAge === null) return true;

    const normalizedAge = Number(ageValue);
    return Number.isFinite(normalizedAge) && normalizedAge === selectedAge;
}

function normalizeScorePair(minValue, maxValue, fallbackMin = SCORE_MIN, fallbackMax = SCORE_MAX) {
    let normalizedMin = Number.parseFloat(minValue);
    let normalizedMax = Number.parseFloat(maxValue);

    if (!Number.isFinite(normalizedMin)) normalizedMin = fallbackMin;
    if (!Number.isFinite(normalizedMax)) normalizedMax = fallbackMax;

    normalizedMin = clampScore(normalizedMin);
    normalizedMax = clampScore(normalizedMax);

    if (normalizedMin > normalizedMax) {
        const temp = normalizedMin;
        normalizedMin = normalizedMax;
        normalizedMax = temp;
    }

    return [roundScore(normalizedMin), roundScore(normalizedMax)];
}

function clampScore(value) {
    return Math.min(SCORE_MAX, Math.max(SCORE_MIN, value));
}

function roundScore(value) {
    return Math.round(value * 10) / 10;
}

function formatScoreValue(value) {
    return roundScore(value).toFixed(1);
}

async function ensureItemsHaveContentRatings(items) {
    if (!items || items.length === 0) return;

    const pendingByType = { movie: [], tv: [] };

    items.forEach(item => {
        if (!item?.id) return;

        const type = getItemMediaType(item);
        const existing = readItemContentRating(item);
        if (existing) {
            contentRatingCache[type][item.id] = existing;
            applyContentRatingToItem(item, existing);
            return;
        }

        const cached = contentRatingCache[type][item.id];
        if (cached !== undefined) {
            applyContentRatingToItem(item, cached);
            return;
        }

        pendingByType[type].push(item.id);
    });

    await Promise.all(Object.entries(pendingByType)
        .filter(([, ids]) => ids.length > 0)
        .map(async ([type, ids]) => {
            const uniqueIds = [...new Set(ids)];

            try {
                const query = uniqueIds.map(id => `ids=${id}`).join('&');
                const data = await fetchJSON(`${MOVIES}/content-ratings?type=${type}&${query}`);
                const foundIds = new Set();

                (data || []).forEach(entry => {
                    const rating = {
                        contentRating: entry.contentRating ?? entry.content_rating ?? null,
                        contentRatingAge: entry.contentRatingAge ?? entry.content_rating_age ?? null
                    };

                    contentRatingCache[type][entry.id] = rating;
                    foundIds.add(entry.id);
                });

                uniqueIds.forEach(id => {
                    if (!foundIds.has(id)) contentRatingCache[type][id] = null;
                });
            } catch {
                uniqueIds.forEach(id => {
                    if (contentRatingCache[type][id] === undefined) contentRatingCache[type][id] = null;
                });
            }
        }));

    items.forEach(item => {
        if (!item?.id) return;
        applyContentRatingToItem(item, contentRatingCache[getItemMediaType(item)][item.id] ?? null);
    });
}

function getItemMediaType(item) {
    return item.mediaType === "tv" || item.media_type === "tv" ? "tv" : "movie";
}

function readItemContentRating(item) {
    const contentRating = item.contentRating ?? item.content_rating ?? null;
    const contentRatingAge = item.contentRatingAge ?? item.content_rating_age ?? null;

    return contentRating || contentRatingAge !== null
        ? { contentRating, contentRatingAge }
        : null;
}

function applyContentRatingToItem(item, rating) {
    item.contentRating = rating?.contentRating ?? null;
    item.content_rating = rating?.contentRating ?? null;
    item.contentRatingAge = rating?.contentRatingAge ?? null;
    item.content_rating_age = rating?.contentRatingAge ?? null;
}

function updateFilterControlsVisibility(view) {
    const controls = document.querySelector('.filter-right');
    if (!controls) return;

    controls.style.display = view === "myratings" ? "none" : "flex";
}

function hideSearchDropdown() {
    document.getElementById('searchDropdown').classList.remove('show');
}

async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function showGridLoading() {
    document.getElementById('movieGrid').innerHTML =
        `<div class="grid-loading"><div class="spinner"></div><span>Loading content...</span></div>`;
    document.getElementById('loadMoreWrap').classList.remove('show');
}

function showGridEmpty(msg) {
    document.getElementById('movieGrid').innerHTML = `<div class="grid-empty"><h3>${msg}</h3></div>`;
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
