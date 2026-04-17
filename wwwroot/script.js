// ── CONFIG ───────────────────────────────────────────────────────
const API = resolveApiBase();
const AUTH = `${API}/Auth`;
const RATINGS = `${API}/Ratings`;
const MOVIES = `${API}/Movies`;
const RECOMMEND = `${API}/Recommend`;
const IMG = "https://image.tmdb.org/t/p/w500";
const IMG_LOGO = "https://image.tmdb.org/t/p/w92";
const IMG_PROFILE = "https://image.tmdb.org/t/p/w185";
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
let genreMap = {};
let ratingsList = [];
let ratingsMap = new Map();
let modalRequestKey = null;
let currentUser = null;
let authMode = "login";

// Recommend state
let recType = "movie";
let recSelectedGenres = [];
let recExcludeIds = [];
let recCurrentItem = null;

// Filter state
let filterMinRating = 0;
let filterMaxRating = 10;
let filterGenreIds = [];
let filterAgeRating = "";
let appliedAgeRating = "";
let advFilterOpen = false;

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    setupNavTabs();
    setupSearch();
    setupStars();
    setupSort();
    setupHamburger();
    setupDetailsTabs();
    setupAuth();
    updateUserUi();
    loadView(currentView);

    const user = await fetchCurrentUser();
    if (user) await handleSignedIn(user);
});

// ── AUTH ─────────────────────────────────────────────────────────
function setupAuth() {
    document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);
    document.getElementById('registerForm').addEventListener('submit', handleRegisterSubmit);
    document.getElementById('showRegisterBtn').addEventListener('click', () => showAuthScreen("register"));
    document.getElementById('showLoginBtn').addEventListener('click', () => showAuthScreen("login"));
    document.getElementById('loginTriggerBtn')?.addEventListener('click', () => showAuthScreen("login"));
    document.getElementById('mobileLoginBtn')?.addEventListener('click', () => showAuthScreen("login"));
    document.getElementById('authCloseBtn')?.addEventListener('click', hideAuthScreen);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);
    document.getElementById('authShell').addEventListener('click', event => {
        if (event.target.id === 'authShell') hideAuthScreen();
    });
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        setAuthStatus("login", "Please enter your username and password.");
        return;
    }

    setAuthStatus("login", "Signing you in...", false);

    try {
        const user = await fetchJSON(`${AUTH}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        await handleSignedIn(user);
    } catch (err) {
        setAuthStatus("login", await readFriendlyError(err, "Could not sign you in."));
    }
}

async function handleRegisterSubmit(event) {
    event.preventDefault();

    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (!username || !password || !confirmPassword) {
        setAuthStatus("register", "Please fill in all fields.");
        return;
    }

    if (password !== confirmPassword) {
        setAuthStatus("register", "Passwords do not match.");
        return;
    }

    setAuthStatus("register", "Creating your profile...", false);

    try {
        const user = await fetchJSON(`${AUTH}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        await handleSignedIn(user);
    } catch (err) {
        setAuthStatus("register", await readFriendlyError(err, "Could not create your account."));
    }
}

async function fetchCurrentUser() {
    try {
        return await fetchJSON(`${AUTH}/me`);
    } catch (err) {
        if (String(err.message).includes("HTTP 401")) return null;
        console.error("Auth session could not be loaded:", err);
        return null;
    }
}

async function handleSignedIn(user) {
    currentUser = user;
    document.getElementById('mobileMenu').classList.remove('open');
    updateUserUi();
    hideAuthScreen();
    clearAuthStatus();
    resetAuthForms();
    await refreshRatingsState(true);
}

function handleSignedOut(message = "") {
    currentUser = null;
    ratingsList = [];
    ratingsMap = new Map();
    currentItem = null;
    selectedScore = 0;
    closeModal();
    document.getElementById('mobileMenu').classList.remove('open');
    updateUserUi();
    if (currentView === "myratings") {
        switchView("trending");
    } else {
        refreshVisibleRatedState();
    }

    if (message) showAuthScreen("login", message);
    else hideAuthScreen();
}

function showAuthScreen(mode, message = "") {
    authMode = mode;
    document.getElementById('authShell').classList.add('show');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('.auth-panel').forEach(panel =>
        panel.classList.toggle('active', panel.dataset.authPanel === mode));

    clearAuthStatus();
    if (message) setAuthStatus(mode, message);
}

function hideAuthScreen() {
    document.getElementById('authShell').classList.remove('show');
    document.body.style.overflow = '';
    clearAuthStatus();
}

async function logout() {
    try {
        await fetch(`${AUTH}/logout`, withCredentials({ method: "POST" }));
    } catch (err) {
        console.error("Logout failed:", err);
    }

    handleSignedOut();
}

function updateUserUi() {
    const navGuest = document.getElementById('navGuest');
    const navUser = document.getElementById('navUser');
    const mobileGuest = document.getElementById('mobileGuest');
    const mobileAccount = document.getElementById('mobileAccount');
    if (!currentUser) {
        navGuest.classList.add('show');
        navUser.classList.remove('show');
        mobileGuest.classList.add('show');
        mobileAccount.classList.remove('show');
        document.getElementById('navUserName').textContent = "";
        document.getElementById('mobileUserName').textContent = "";
        return;
    }

    navGuest.classList.remove('show');
    document.getElementById('navUserName').textContent = currentUser.username;
    mobileGuest.classList.remove('show');
    document.getElementById('mobileUserName').textContent = currentUser.username;
    navUser.classList.add('show');
    mobileAccount.classList.add('show');
}

function setAuthStatus(mode, message, isError = true) {
    const status = document.getElementById(mode === "register" ? 'registerStatus' : 'loginStatus');
    status.textContent = message;
    status.classList.toggle('show', Boolean(message));
    status.classList.toggle('error', isError && Boolean(message));
    status.classList.toggle('success', !isError && Boolean(message));
}

function clearAuthStatus() {
    ['loginStatus', 'registerStatus'].forEach(id => {
        const el = document.getElementById(id);
        el.textContent = "";
        el.classList.remove('show', 'error', 'success');
    });
}

function resetAuthForms() {
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
}

async function readFriendlyError(err, fallback) {
    if (err?.response) {
        try {
            const text = await err.response.text();
            return text || fallback;
        } catch {
            return fallback;
        }
    }

    return fallback;
}

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
    filterGenreIds = [];

    document.querySelectorAll('.nav-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.view === view));

    const isRec = view === "recommend";
    document.getElementById('hero').style.display = isRec ? "none" : ["trending", "movies", "series", "toprated"].includes(view) ? "block" : "none";
    document.getElementById('recommendPage').style.display = isRec ? "block" : "none";
    document.getElementById('mainContent').style.display = isRec ? "none" : "block";

    if (isRec) { initRecommend(); return; }

    const titles = { trending: "Trending Today", movies: "Popular Movies", series: "Popular Series", toprated: "Top Rated", myratings: "My Ratings" };
    document.getElementById('sectionTitle').textContent = titles[view] || "";
    document.getElementById('resultCount').textContent = "";

    const showGenreBar = ["movies", "series"].includes(view);
    document.getElementById('genreQuickBar').style.display = showGenreBar ? "block" : "none";
    if (view === "movies") loadGenres("movie");
    else if (view === "series") loadGenres("tv");
    else document.getElementById('genreFilter').innerHTML = "";

    if (advFilterOpen) toggleAdvancedFilter();
    loadView(view);
}

// ── LOAD VIEW ────────────────────────────────────────────────────
async function loadView(view, append = false) {
    if (!append) showGridLoading();
    try {
        let data;
        const includeContentRatings = shouldIncludeContentRatings();
        switch (view) {
            case "trending": data = await fetchJSON(`${MOVIES}/trending?page=${currentPage}${includeContentRatings ? '&includeContentRatings=true' : ''}`); break;
            case "movies": data = currentGenre
                ? await fetchJSON(`${MOVIES}/discover?type=movie&genreId=${currentGenre}&page=${currentPage}${includeContentRatings ? '&includeContentRatings=true' : ''}`)
                : await fetchJSON(`${MOVIES}/popular?type=movie&page=${currentPage}${includeContentRatings ? '&includeContentRatings=true' : ''}`); break;
            case "series": data = currentGenre
                ? await fetchJSON(`${MOVIES}/discover?type=tv&genreId=${currentGenre}&page=${currentPage}${includeContentRatings ? '&includeContentRatings=true' : ''}`)
                : await fetchJSON(`${MOVIES}/popular?type=tv&page=${currentPage}${includeContentRatings ? '&includeContentRatings=true' : ''}`); break;
            case "toprated": data = await fetchJSON(`${MOVIES}/toprated?type=movie&page=${currentPage}${includeContentRatings ? '&includeContentRatings=true' : ''}`); break;
            case "myratings":
                if (!currentUser) {
                    showGridEmpty("Sign in to see your personal rating history.");
                    document.getElementById('loadMoreWrap').classList.remove('show');
                    showAuthScreen("login", "Sign in to open your personal ratings.");
                    return;
                }

                await refreshRatingsState();
                renderMyRatings(ratingsList); return;
        }

        const results = (data?.results ?? []).filter(isSupportedMedia);
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

        const hasActiveFilters = filterMinRating > 0
            || filterMaxRating < 10
            || filterGenreIds.length > 0
            || Boolean(filterAgeRating);

        renderGrid(append && !hasActiveFilters ? results : getFilteredItems(), append && !hasActiveFilters);
        updateLoadMore();
        document.getElementById('resultCount').textContent =
            data?.total_results ? `${data.total_results.toLocaleString()} titles` : "";

    } catch (err) {
        console.error(err);
        showGridEmpty("Something went wrong. Please try again.");
    }
}

// ── RENDER ───────────────────────────────────────────────────────
function getFilteredItems() {
    return allItems.filter(item => {
        const score = item.vote_average || 0;
        if (score < filterMinRating || score > filterMaxRating) return false;
        if (filterAgeRating) {
            const age = item.content_rating_age ?? item.contentRatingAge;
            if (age !== ageRatingToValue(filterAgeRating)) return false;
        }
        if (filterGenreIds.length > 0) {
            const ig = item.genre_ids || [];
            if (!filterGenreIds.some(g => ig.includes(g))) return false;
        }
        return true;
    });
}

function shouldIncludeContentRatings() {
    return Boolean(filterAgeRating);
}

function hasLoadedContentRatings() {
    return allItems.length > 0 && allItems.every(item =>
        Object.prototype.hasOwnProperty.call(item, 'content_rating_age')
        || Object.prototype.hasOwnProperty.call(item, 'contentRatingAge'));
}

function ageRatingToValue(label) {
    switch (String(label || "").toLowerCase()) {
        case "family": return 0;
        case "13+": return 13;
        case "16+": return 16;
        case "18+": return 18;
        default: return null;
    }
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
    const normalized = normalizeItem(item);
    const title = titleFor(normalized);
    const score = normalized.vote_average ? normalized.vote_average.toFixed(1) : null;
    const type = getItemMediaType(normalized);
    const year = yearFor(normalized);
    const userRating = getRatingForItem(normalized);
    const poster = normalized.poster_path
        ? `${IMG}${normalized.poster_path}`
        : "https://via.placeholder.com/300x450/1e1e2a/5a5a72?text=No+Image";

    const card = document.createElement('div');
    card.className = `movie-card${userRating ? ' is-rated' : ''}`;
    card.innerHTML = `
        <div class="card-img-wrap">
            <img class="card-img" src="${poster}" alt="${escHtml(title)}" loading="lazy">
            <div class="card-hover">
                <button class="card-rate-btn">${userRating ? `Update Rating (${userRating.score}/10)` : '⭐ Rate It'}</button>
            </div>
            <span class="card-badge ${type === 'tv' ? 'badge-tv' : 'badge-movie'}">${type === 'tv' ? 'TV' : 'MOVIE'}</span>
            ${score ? `<span class="card-score">★ ${score}</span>` : ''}
            ${userRating ? `<span class="card-rated-pill">ALREADY RATED</span>` : ''}
        </div>
        <div class="card-body">
            <div class="card-title">${escHtml(title)}</div>
            ${year ? `<div class="card-year">${year}</div>` : ''}
            ${userRating ? `<div class="card-user-score">Your Score: ${userRating.score}/10</div>` : ''}
        </div>`;

    const open = () => openModal(normalized);
    card.addEventListener('click', open);
    card.querySelector('.card-rate-btn')?.addEventListener('click', event => {
        event.stopPropagation();
        open();
    });

    return card;
}

function renderMyRatings(ratings) {
    const grid = document.getElementById('movieGrid');
    grid.innerHTML = "";
    document.getElementById('loadMoreWrap').classList.remove('show');
    document.getElementById('genreQuickBar').style.display = "none";
    if (!ratings || ratings.length === 0) { showGridEmpty("You haven't rated anything yet. Start rating!"); return; }
    document.getElementById('resultCount').textContent = `${ratings.length} rated`;
    ratings.forEach((r, i) => {
        const card = createCard(ratingToItem(r));
        card.style.animationDelay = `${Math.min(i * 25, 350)}ms`;
        grid.appendChild(card);
    });
}

// ── HERO ─────────────────────────────────────────────────────────
function setHero(idx) {
    heroIndex = idx;
    const item = heroItems[idx]; if (!item) return;
    const title = titleFor(item);
    const type = getItemMediaType(item) === "tv" ? "TV SHOW" : "MOVIE";
    const year = yearFor(item);
    const score = item.vote_average?.toFixed(1);
    const bg = item.backdrop_path ? `${IMG_BIG}${item.backdrop_path}` : "";
    const userRating = getRatingForItem(item);

    document.getElementById('heroBg').style.backgroundImage = bg ? `url(${bg})` : "none";
    document.getElementById('heroBadge').textContent = `${type} • TRENDING`;
    document.getElementById('heroTitle').textContent = title;
    document.getElementById('heroDesc').textContent = item.overview || "";
    document.getElementById('heroMeta').innerHTML = `${year ? `<span>📅 ${year}</span>` : ''}${score ? `<span class="hero-score">★ ${score}</span>` : ''}${userRating ? `<span class="hero-score">Your ${userRating.score}/10</span>` : ''}`;
    document.getElementById('heroRateBtn').textContent = userRating ? `Update Rating (${userRating.score}/10)` : '⭐ Rate This';
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
    if (heroItems.length <= 1) return;
    heroTimer = setInterval(() => setHero((heroIndex + 1) % heroItems.length), 6000);
}
function scrollToGrid() { document.querySelector('.content')?.scrollIntoView({ behavior: 'smooth' }); }

// ── GENRES ───────────────────────────────────────────────────────
async function loadGenres(type) {
    if (genres[type].length > 0) { renderGenres(genres[type]); return; }
    try {
        const data = await fetchJSON(`${MOVIES}/genres?type=${type}`);
        genres[type] = data || [];
        data.forEach(g => genreMap[g.id] = g.name);
        renderGenres(genres[type]);
    } catch { }
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
function toggleAdvancedFilter() {
    advFilterOpen = !advFilterOpen;
    document.getElementById('advancedFilter').style.display = advFilterOpen ? "block" : "none";
    document.getElementById('filterToggleBtn').classList.toggle('active', advFilterOpen);
    if (advFilterOpen) populateAdvGenres();
}

function populateAdvGenres() {
    const type = currentView === "series" ? "tv" : "movie";
    const list = genres[type];
    document.getElementById('advGenreList').innerHTML =
        list.map(g =>
            `<button class="adv-genre-chip ${filterGenreIds.includes(g.id) ? 'selected' : ''}"
             onclick="toggleAdvGenre(${g.id},this)">${g.name}</button>`
        ).join('');
}

function toggleAdvGenre(id, btn) {
    btn.classList.toggle('selected');
    if (filterGenreIds.includes(id)) filterGenreIds = filterGenreIds.filter(g => g !== id);
    else filterGenreIds.push(id);
}

function updateAgeFilter() {
    filterAgeRating = document.getElementById('ageRatingSelect').value;
}

function updateRatingFilter() {
    filterMinRating = parseFloat(document.getElementById('ratingMinRange').value);
    filterMaxRating = parseFloat(document.getElementById('ratingMaxRange').value);
    if (filterMinRating > filterMaxRating) { [filterMinRating, filterMaxRating] = [filterMaxRating, filterMinRating]; }
    document.getElementById('ratingMin').textContent = filterMinRating;
    document.getElementById('ratingMax').textContent = filterMaxRating;
}

function applyFilters() {
    const needsReload = ["trending", "movies", "series", "toprated"].includes(currentView)
        && (filterAgeRating !== appliedAgeRating || (filterAgeRating && !hasLoadedContentRatings()));

    appliedAgeRating = filterAgeRating;

    if (needsReload) {
        currentPage = 1;
        allItems = [];
        loadView(currentView);
    } else {
        renderGrid(getFilteredItems());
    }

    toggleAdvancedFilter();
}

function clearFilters() {
    filterMinRating = 0; filterMaxRating = 10; filterGenreIds = []; filterAgeRating = "";
    document.getElementById('ratingMinRange').value = 0;
    document.getElementById('ratingMaxRange').value = 10;
    document.getElementById('ratingMin').textContent = 0;
    document.getElementById('ratingMax').textContent = 10;
    document.getElementById('ageRatingSelect').value = "";
    document.querySelectorAll('.adv-genre-chip').forEach(c => c.classList.remove('selected'));
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

function loadMore() { currentPage++; loadView(currentView, true); }
function updateLoadMore() {
    document.getElementById('loadMoreWrap').classList.toggle('show', currentPage < totalPages && !["myratings", "recommend"].includes(currentView));
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
        results.forEach(item => {
            const normalized = normalizeItem(item);
            const title = titleFor(normalized);
            const type = getItemMediaType(normalized) === 'tv' ? 'TV Show' : 'Movie';
            const year = yearFor(normalized);
            const score = normalized.vote_average ? normalized.vote_average.toFixed(1) : "N/A";
            const poster = normalized.poster_path ? `${IMG}${normalized.poster_path}` : "https://via.placeholder.com/40x56/1e1e2a/5a5a72?text=?";
            const userRating = getRatingForItem(normalized);

            const row = document.createElement('div');
            row.className = 'search-result-item';
            row.innerHTML = `
                <img src="${poster}" alt="${escHtml(title)}">
                <div class="search-result-info">
                    <h4>${escHtml(title)}</h4>
                    <span>${type}${year ? ' • ' + year : ''}</span>
                    ${userRating ? `<div class="search-result-rated">Already rated ${userRating.score}/10</div>` : ''}
                </div>
                <span class="search-result-score">★ ${score}</span>`;
            row.addEventListener('click', () => searchSelect(normalized));
            dd.appendChild(row);
        });
    } catch { dd.innerHTML = `<div class="search-empty">Search failed. Try again.</div>`; }
}

function searchSelect(item) {
    document.getElementById('searchDropdown').classList.remove('show');
    document.getElementById('searchInput').value = "";
    openModal(item);
}

// ── MODAL ────────────────────────────────────────────────────────
function setupDetailsTabs() {
    document.querySelectorAll('.details-tab').forEach(btn => {
        btn.addEventListener('click', () => selectDetailsTab(btn.dataset.tab));
    });
}

function openModal(item) {
    if (!currentUser) {
        showAuthScreen("login", "Sign in or create an account to rate titles.");
        return;
    }

    currentItem = normalizeItem(item);
    if (!currentItem?.id) return;

    modalRequestKey = `${Date.now()}-${currentItem.id}-${getItemMediaType(currentItem)}`;
    resetModalSections();
    applyModalItemData(currentItem);
    syncModalRatingState();
    clearModalStatus();

    document.getElementById('modalOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';

    const mediaType = getItemMediaType(currentItem);
    loadItemDetails(currentItem.id, mediaType, modalRequestKey);
    loadWatchProviders(currentItem.id, mediaType, modalRequestKey);
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    document.body.style.overflow = '';
    currentItem = null;
    selectedScore = 0;
    modalRequestKey = null;
    clearModalStatus();
}

function resetModalSections() {
    selectDetailsTab('cast');
    document.getElementById('detailsLoading').style.display = "flex";
    document.getElementById('detailsPanelCast').innerHTML = "";
    document.getElementById('detailsPanelMusic').innerHTML = "";
    document.getElementById('detailsPanelCreators').innerHTML = "";
    document.getElementById('watchLoading').style.display = "flex";
    document.getElementById('watchContent').style.display = "none";
    document.getElementById('watchContent').innerHTML = "";
}

function applyModalItemData(item) {
    currentItem = normalizeItem({ ...currentItem, ...item });

    const title = titleFor(currentItem);
    const type = getItemMediaType(currentItem) === 'tv' ? 'TV SHOW' : 'MOVIE';
    const year = yearFor(currentItem);
    const score = currentItem.vote_average ? currentItem.vote_average.toFixed(1) : "—";
    const poster = currentItem.backdrop_path
        ? `${IMG_BIG}${currentItem.backdrop_path}`
        : currentItem.poster_path
            ? `${IMG}${currentItem.poster_path}`
            : "https://via.placeholder.com/720x280/1e1e2a/5a5a72?text=No+Image";

    document.getElementById('modalPoster').src = poster;
    document.getElementById('modalPoster').alt = title;
    document.getElementById('modalBadge').textContent = type;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalYear').textContent = year;
    document.getElementById('modalOverview').textContent = currentItem.overview || "No description available.";
    document.getElementById('modalTmdbScore').textContent = score;
}

function syncModalRatingState() {
    const rating = getRatingForItem(currentItem);
    selectedScore = rating?.score ?? 0;
    updateStars(selectedScore);
    document.getElementById('ratingLabel').textContent = selectedScore ? `${selectedScore} / 10` : "Select a score";
    document.getElementById('submitRating').textContent = rating ? "Update Rating" : "Save Rating";
    document.getElementById('submitRating').disabled = selectedScore === 0;
}

function selectDetailsTab(tab) {
    document.querySelectorAll('.details-tab').forEach(button =>
        button.classList.toggle('active', button.dataset.tab === tab));

    document.querySelectorAll('.details-panel').forEach(panel =>
        panel.classList.toggle('active', panel.dataset.panel === tab));
}

async function loadItemDetails(id, type, requestKey) {
    try {
        const data = await fetchJSON(`${MOVIES}/details/${id}?type=${type}`);
        if (requestKey !== modalRequestKey) return;
        applyModalItemData(data);
        renderPeoplePanels(data);
    } catch (err) {
        console.error("Credits could not be rendered:", err);
        if (requestKey !== modalRequestKey) return;
        renderPeoplePanels(null);
    }
}

function renderPeoplePanels(data) {
    document.getElementById('detailsLoading').style.display = "none";
    document.getElementById('detailsPanelCast').innerHTML = buildPeoplePanel(data?.cast, "Cast info is not available for this title.");
    document.getElementById('detailsPanelMusic').innerHTML = buildPeoplePanel(data?.music, "No music credits were returned for this title.");
    document.getElementById('detailsPanelCreators').innerHTML = buildPeoplePanel(data?.creators, "Director and writer info is not available for this title.");
}

function buildPeoplePanel(list, emptyMessage) {
    if (!list || list.length === 0) {
        return `<div class="details-empty">${escHtml(emptyMessage)}</div>`;
    }

    return `<div class="people-grid">${list.map(person => buildPersonCard(person)).join('')}</div>`;
}

function buildPersonCard(person) {
    const name = person?.name || "Unknown";
    const role = person?.role || "Crew";
    const photo = person?.profilePath
        ? `<img src="${IMG_PROFILE}${person.profilePath}" alt="${escHtml(name)}" loading="lazy">`
        : `<div class="person-photo-fallback">${escHtml(initialsFor(name))}</div>`;

    return `
        <article class="person-card">
            <div class="person-photo">${photo}</div>
            <div class="person-meta">
                <div class="person-name">${escHtml(name)}</div>
                <div class="person-role">${escHtml(role)}</div>
            </div>
        </article>`;
}

// ── WATCH PROVIDERS ──────────────────────────────────────────────
async function loadWatchProviders(id, type, requestKey) {
    try {
        const data = await fetchJSON(`${MOVIES}/providers/${id}?type=${type}`);
        if (requestKey !== modalRequestKey) return;
        renderWatchProviders(data);
    } catch (err) {
        console.error("Watch providers could not be rendered:", err);
        if (requestKey !== modalRequestKey) return;
        renderWatchProviders(null);
    }
}

function renderWatchProviders(data) {
    document.getElementById('watchLoading').style.display = "none";
    const content = document.getElementById('watchContent');
    content.style.display = "block";

    const hasFlat = data?.flatrate?.length > 0;
    const hasFree = data?.free?.length > 0;
    const hasAds = data?.ads?.length > 0;
    const hasRent = data?.rent?.length > 0;
    const hasBuy = data?.buy?.length > 0;

    if (!data || (!hasFlat && !hasFree && !hasAds && !hasRent && !hasBuy)) {
        content.innerHTML = `
            <div class="watch-header">Where to Watch</div>
            <div class="watch-message">
                <span class="watch-emoji">😔</span>
                <span>Not available on any known streaming platform right now.</span>
            </div>`;
        return;
    }

    let html = `<div class="watch-header">Where to Watch</div>`;

    if (hasFlat) {
        html += buildProviderGroup("🎬 Stream", data.flatrate);
    }
    if (hasFree) {
        html += buildProviderGroup("🎁 Free", data.free);
    }
    if (hasAds) {
        html += buildProviderGroup("📺 With Ads", data.ads);
    }
    if (hasRent) {
        html += buildProviderGroup("💳 Rent", data.rent);
    }
    if (hasBuy) {
        html += buildProviderGroup("🛒 Buy", data.buy);
    }

    // Friendly message
    const firstPlatform = (data.flatrate?.[0] || data.free?.[0] || data.ads?.[0] || data.rent?.[0] || data.buy?.[0])?.providerName || "";
    if (firstPlatform) {
        html += `<div class="watch-message" style="margin-top:10px">
            <span class="watch-emoji">🍿</span>
            <span>Enjoy it on <strong>${escHtml(firstPlatform)}</strong> and more!</span>
        </div>`;
    }

    if (data.link) {
        html += `<a class="watch-link" href="${data.link}" target="_blank" rel="noopener">
            View all options on JustWatch ↗
        </a>`;
    }

    content.innerHTML = html;
}

function buildProviderGroup(label, providers) {
    const logos = providers.map(p => {
        const logo = p.logoPath
            ? `<img src="${IMG_LOGO}${p.logoPath}" alt="${escHtml(p.providerName)}" title="${escHtml(p.providerName)}">`
            : `<div style="width:36px;height:36px;background:var(--bg3);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:var(--text3)">${escHtml(p.providerName.slice(0, 4))}</div>`;
        return `<div class="watch-provider">${logo}<span>${escHtml(p.providerName)}</span></div>`;
    }).join('');

    return `
        <div class="watch-group">
            <div class="watch-group-label">${label}</div>
            <div class="watch-providers-row">${logos}</div>
        </div>`;
}

// ── STARS ────────────────────────────────────────────────────────
function setupStars() {
    const stars = document.querySelectorAll('.star');
    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            updateStars(+star.dataset.value);
        });
        star.addEventListener('mouseout', () => {
            updateStars(selectedScore);
        });
        star.addEventListener('click', () => {
            selectedScore = +star.dataset.value;
            document.getElementById('ratingLabel').textContent = `${selectedScore} / 10`;
            updateStars(selectedScore);
            document.getElementById('submitRating').disabled = false;
            clearModalStatus();
        });
    });
}

function updateStars(value) {
    document.querySelectorAll('.star').forEach(star => {
        star.classList.toggle('active', +star.dataset.value <= value);
    });
}

// ── SUBMIT RATING ────────────────────────────────────────────────
async function submitRating() {
    if (!currentUser) {
        handleSignedOut("Sign in again to save your ratings.");
        return;
    }

    if (!currentItem || selectedScore === 0) return;

    const btn = document.getElementById('submitRating');
    btn.disabled = true;
    clearModalStatus();
    const payload = {
        tmdbId: currentItem.id,
        score: selectedScore,
        movieTitle: titleFor(currentItem),
        posterPath: currentItem.poster_path || "",
        mediaType: getItemMediaType(currentItem)
    };

    try {
        const res = await fetch(RATINGS, withCredentials({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }));
        if (res.status === 401) {
            handleSignedOut("Your session ended. Please sign in again.");
            return;
        }

        if (res.ok) {
            closeModal();
            await refreshRatingsState(true);
            return;
        }

        const err = await res.text();
        setModalStatus(err || "Could not save rating.");
    } catch {
        setModalStatus("Could not connect to server.");
    } finally {
        if (currentItem) btn.disabled = selectedScore === 0;
    }
}

// ── RECOMMEND ────────────────────────────────────────────────────
function initRecommend() { recType = "movie"; recSelectedGenres = []; recExcludeIds = []; recCurrentItem = null; showRecStep(1); }
function showRecStep(n) {
    [1, 2, 3].forEach(i => document.getElementById(`recStep${i}`).style.display = i === n ? "block" : "none");
}
function selectType(type) { recType = type; recSelectedGenres = []; showRecStep(2); loadRecGenres(type); }

async function loadRecGenres(type) {
    const grid = document.getElementById('recGenreGrid');
    grid.innerHTML = `<div style="color:var(--text2);padding:20px 0;">Loading genres...</div>`;
    if (genres[type].length === 0) {
        try { const data = await fetchJSON(`${MOVIES}/genres?type=${type}`); genres[type] = data || []; data.forEach(g => genreMap[g.id] = g.name); }
        catch { grid.innerHTML = `<p style="color:var(--red)">Failed to load genres.</p>`; return; }
    }
    const emojis = { 28: "⚔️", 12: "🌍", 16: "🎨", 35: "😂", 80: "🔫", 99: "📽️", 18: "💔", 10751: "👨‍👩‍👧", 14: "🧙", 36: "📜", 27: "👻", 10402: "🎵", 9648: "🔍", 10749: "❤️", 878: "🚀", 10770: "📺", 53: "😰", 10752: "🎖️", 37: "🤠", 10759: "⚡", 10762: "👶", 10763: "📰", 10764: "🎯", 10765: "🔮", 10766: "💞", 10767: "🎤", 10768: "🎖️" };
    grid.innerHTML = genres[type].map(g =>
        `<button class="rec-genre-chip" data-id="${g.id}" onclick="toggleRecGenre(${g.id},this)">
            <span>${emojis[g.id] || '🎬'}</span> ${g.name}
        </button>`).join('');
}

function toggleRecGenre(id, btn) {
    btn.classList.toggle('selected');
    if (recSelectedGenres.includes(id)) recSelectedGenres = recSelectedGenres.filter(g => g !== id);
    else recSelectedGenres.push(id);
    document.getElementById('recFindBtn').disabled = recSelectedGenres.length === 0;
}

function backToStep1() { showRecStep(1); }
function backToStep2() { showRecStep(2); }

async function findRecommendation() {
    if (!recSelectedGenres.length) return;
    showRecStep(3);
    document.getElementById('recLoading').style.display = "flex";
    document.getElementById('recCard').style.display = "none";
    document.getElementById('recError').style.display = "none";
    try {
        const item = await fetchJSON(RECOMMEND, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: recType, genreIds: recSelectedGenres, excludeIds: recExcludeIds }) });
        recCurrentItem = normalizeItem({ ...item, media_type: item.mediaType || item.media_type });
        recExcludeIds.push(recCurrentItem.id);
        showRecCard(recCurrentItem);
    } catch {
        document.getElementById('recLoading').style.display = "none";
        document.getElementById('recError').style.display = "block";
        document.getElementById('recErrorMsg').textContent = "No match found. Try different genres.";
    }
}

function showRecCard(item) {
    const normalized = normalizeItem(item);
    recCurrentItem = normalized;
    const title = titleFor(normalized);
    const type = getItemMediaType(normalized) === "tv" ? "TV SHOW" : "MOVIE";
    const year = yearFor(normalized);
    const score = normalized.vote_average;
    const poster = normalized.poster_path;
    const overview = normalized.overview || "No description available.";
    const gids = normalized.genre_ids || item.genreIds || [];
    const userRating = getRatingForItem(normalized);

    document.getElementById('recPoster').src = poster ? `${IMG}${poster}` : "https://via.placeholder.com/260x380/1e1e2a/5a5a72?text=?";
    document.getElementById('recBadge').textContent = type;
    document.getElementById('recTitle').textContent = title;
    document.getElementById('recYear').textContent = year;
    document.getElementById('recOverview').textContent = overview;
    document.getElementById('recScore').textContent = score ? `★ ${(+score).toFixed(1)}` : "";
    document.getElementById('recGenreTags').innerHTML = gids.map(id => `<span class="rec-genre-tag">${genreMap[id] || id}</span>`).join('');
    document.getElementById('recRateBtn').textContent = userRating ? `Update Rating (${userRating.score}/10)` : '⭐ Rate This';
    document.getElementById('recRateBtn').onclick = () => openModal(normalized);
    document.getElementById('recLoading').style.display = "none";
    document.getElementById('recCard').style.display = "block";
}

function skipRecommendation() { findRecommendation(); }
function markWatchedAndSkip() {
    if (recCurrentItem && !recExcludeIds.includes(recCurrentItem.id)) recExcludeIds.push(recCurrentItem.id);
    findRecommendation();
}

// ── HAMBURGER ────────────────────────────────────────────────────
function setupHamburger() {
    document.getElementById('hamburger').addEventListener('click', () => document.getElementById('mobileMenu').classList.toggle('open'));
}

// ── RATINGS ──────────────────────────────────────────────────────
async function refreshRatingsState(shouldRefreshUi = false) {
    if (!currentUser) {
        ratingsList = [];
        ratingsMap = new Map();
        if (shouldRefreshUi) refreshVisibleRatedState();
        return;
    }

    try {
        const ratings = await fetchJSON(RATINGS);
        ratingsList = Array.isArray(ratings) ? ratings : [];
        ratingsMap = new Map(ratingsList.map(rating => [buildRatingKey(rating.tmdbId, rating.mediaType), rating]));
    } catch (err) {
        if (err?.response?.status === 401) {
            handleSignedOut("Your session ended. Please sign in again.");
            return;
        }

        console.error("Ratings could not be loaded:", err);
        ratingsList = [];
        ratingsMap = new Map();
    }

    if (shouldRefreshUi) refreshVisibleRatedState();
}

function refreshVisibleRatedState() {
    if (currentView === "myratings") {
        renderMyRatings(ratingsList);
        return;
    }

    if (allItems.length > 0) renderGrid(getFilteredItems());
    if (heroItems.length > 0) setHero(Math.min(heroIndex, heroItems.length - 1));
    if (recCurrentItem) showRecCard(recCurrentItem);
}

function getRatingForItem(item) {
    if (!item) return null;
    const id = item.id ?? item.tmdbId;
    if (!id) return null;
    return ratingsMap.get(buildRatingKey(id, getItemMediaType(item))) ?? null;
}

function buildRatingKey(tmdbId, mediaType) {
    return `${normalizeMediaType(mediaType)}:${tmdbId}`;
}

// ── HELPERS ──────────────────────────────────────────────────────
function resolveApiBase() {
    const { protocol, hostname, port, origin } = window.location;
    const isHttpApp = protocol === "http:" || protocol === "https:";
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
    const isBackendPort = port === "5128" || port === "7025";

    if (isHttpApp && (!isLocalHost || isBackendPort)) {
        return `${origin}/api`;
    }

    return "http://localhost:5128/api";
}

function withCredentials(options = {}) {
    return { ...options, credentials: options.credentials || "include" };
}

async function fetchJSON(url, options) {
    const res = await fetch(url, withCredentials(options));
    if (!res.ok) {
        const error = new Error(`HTTP ${res.status}`);
        error.response = res;
        throw error;
    }

    return res.json();
}
function showGridLoading() {
    document.getElementById('movieGrid').innerHTML = `<div class="grid-loading"><div class="spinner"></div><span>Loading content...</span></div>`;
    document.getElementById('loadMoreWrap').classList.remove('show');
}
function showGridEmpty(msg) {
    document.getElementById('movieGrid').innerHTML = `<div class="grid-empty"><h3>${escHtml(msg)}</h3></div>`;
}
function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function titleFor(item) {
    return item?.title || item?.name || item?.movieTitle || "Unknown";
}

function yearFor(item) {
    return (item?.release_date || item?.first_air_date || item?.releaseDate || item?.firstAirDate || "").slice(0, 4);
}

function normalizeMediaType(type) {
    return type === "tv" ? "tv" : "movie";
}

function getItemMediaType(item) {
    const rawType = item?.media_type || item?.mediaType;
    if (rawType === "tv") return "tv";
    if (rawType === "movie") return "movie";
    if (item?.first_air_date || item?.firstAirDate || (!item?.title && item?.name)) return "tv";
    return "movie";
}

function normalizeItem(item) {
    if (!item) return null;

    return {
        ...item,
        id: item.id ?? item.tmdbId,
        title: item.title ?? item.movieTitle ?? null,
        name: item.name ?? null,
        overview: item.overview ?? null,
        poster_path: item.poster_path ?? item.posterPath ?? null,
        backdrop_path: item.backdrop_path ?? item.backdropPath ?? null,
        vote_average: item.vote_average ?? item.voteAverage ?? 0,
        release_date: item.release_date ?? item.releaseDate ?? null,
        first_air_date: item.first_air_date ?? item.firstAirDate ?? null,
        genre_ids: item.genre_ids ?? item.genreIds ?? [],
        content_rating: item.content_rating ?? item.contentRating ?? null,
        content_rating_age: item.content_rating_age ?? item.contentRatingAge ?? null,
        media_type: getItemMediaType(item)
    };
}

function ratingToItem(rating) {
    return normalizeItem({
        id: rating.tmdbId,
        title: rating.mediaType === "movie" ? rating.movieTitle : null,
        name: rating.mediaType === "tv" ? rating.movieTitle : null,
        poster_path: rating.posterPath,
        media_type: rating.mediaType
    });
}

function isSupportedMedia(item) {
    return !item?.media_type || item.media_type === "movie" || item.media_type === "tv";
}

function initialsFor(name) {
    return String(name)
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || '')
        .join('') || '?';
}

function setModalStatus(message = "") {
    const status = document.getElementById('modalStatus');
    status.textContent = message;
    status.classList.toggle('show', Boolean(message));
}

function clearModalStatus() {
    setModalStatus("");
}
