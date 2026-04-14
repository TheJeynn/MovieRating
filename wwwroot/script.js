// ── CONFIG ───────────────────────────────────────────────────────
const API = "http://localhost:5128/api";
const RATINGS = `${API}/Ratings`;
const MOVIES = `${API}/Movies`;
const RECOMMEND = `${API}/Recommend`;
const IMG = "https://image.tmdb.org/t/p/w500";
const IMG_LOGO = "https://image.tmdb.org/t/p/w92";
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

// Recommend state
let recType = "movie";
let recSelectedGenres = [];
let recExcludeIds = [];
let recCurrentItem = null;

// Filter state
let filterMinRating = 0;
let filterMaxRating = 10;
let filterGenreIds = [];
let advFilterOpen = false;

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupNavTabs();
    setupSearch();
    setupStars();
    setupSort();
    setupHamburger();
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
        switch (view) {
            case "trending": data = await fetchJSON(`${MOVIES}/trending?page=${currentPage}`); break;
            case "movies": data = currentGenre
                ? await fetchJSON(`${MOVIES}/discover?type=movie&genreId=${currentGenre}&page=${currentPage}`)
                : await fetchJSON(`${MOVIES}/popular?type=movie&page=${currentPage}`); break;
            case "series": data = currentGenre
                ? await fetchJSON(`${MOVIES}/discover?type=tv&genreId=${currentGenre}&page=${currentPage}`)
                : await fetchJSON(`${MOVIES}/popular?type=tv&page=${currentPage}`); break;
            case "toprated": data = await fetchJSON(`${MOVIES}/toprated?type=movie&page=${currentPage}`); break;
            case "myratings":
                const ratings = await fetchJSON(RATINGS);
                renderMyRatings(ratings); return;
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

        renderGrid(append ? results : getFilteredItems(), append);
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
        if (filterGenreIds.length > 0) {
            const ig = item.genre_ids || [];
            if (!filterGenreIds.some(g => ig.includes(g))) return false;
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
                <button class="card-rate-btn" onclick='openModal(${JSON.stringify(item)})'>⭐ Rate It</button>
            </div>
            <span class="card-badge ${type === 'tv' ? 'badge-tv' : 'badge-movie'}">${type === 'tv' ? 'TV' : 'MOVIE'}</span>
            ${score ? `<span class="card-score">★ ${score}</span>` : ''}
        </div>
        <div class="card-body">
            <div class="card-title">${escHtml(title)}</div>
            ${year ? `<div class="card-year">${year}</div>` : ''}
        </div>`;
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
            </div>`;
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
function startHeroTimer() { clearInterval(heroTimer); heroTimer = setInterval(() => setHero((heroIndex + 1) % heroItems.length), 6000); }
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

function updateRatingFilter() {
    filterMinRating = parseFloat(document.getElementById('ratingMinRange').value);
    filterMaxRating = parseFloat(document.getElementById('ratingMaxRange').value);
    if (filterMinRating > filterMaxRating) { [filterMinRating, filterMaxRating] = [filterMaxRating, filterMinRating]; }
    document.getElementById('ratingMin').textContent = filterMinRating;
    document.getElementById('ratingMax').textContent = filterMaxRating;
}

function applyFilters() { renderGrid(getFilteredItems()); toggleAdvancedFilter(); }
function clearFilters() {
    filterMinRating = 0; filterMaxRating = 10; filterGenreIds = [];
    document.getElementById('ratingMinRange').value = 0;
    document.getElementById('ratingMaxRange').value = 10;
    document.getElementById('ratingMin').textContent = 0;
    document.getElementById('ratingMax').textContent = 10;
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
        dd.innerHTML = results.map(item => {
            const title = item.title || item.name || "Unknown";
            const type = item.media_type === 'tv' ? 'TV Show' : 'Movie';
            const year = (item.release_date || item.first_air_date || "").slice(0, 4);
            const score = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
            const poster = item.poster_path ? `${IMG}${item.poster_path}` : "https://via.placeholder.com/40x56/1e1e2a/5a5a72?text=?";
            return `
                <div class="search-result-item" onclick='searchSelect(${JSON.stringify(item)})'>
                    <img src="${poster}" alt="${escHtml(title)}">
                    <div class="search-result-info">
                        <h4>${escHtml(title)}</h4>
                        <span>${type}${year ? ' • ' + year : ''}</span>
                    </div>
                    <span class="search-result-score">★ ${score}</span>
                </div>`;
        }).join('');
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

    // Reset watch section
    document.getElementById('watchLoading').style.display = "flex";
    document.getElementById('watchContent').style.display = "none";
    document.getElementById('watchContent').innerHTML = "";

    document.getElementById('modalOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';

    // Fetch watch providers async
    const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
    loadWatchProviders(item.id, mediaType);
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    document.body.style.overflow = '';
    currentItem = null; selectedScore = 0;
}

// ── WATCH PROVIDERS ──────────────────────────────────────────────
async function loadWatchProviders(id, type) {
    try {
        const data = await fetchJSON(`${MOVIES}/providers/${id}?type=${type}`);
        renderWatchProviders(data);
    } catch (err) {
        console.error("Watch providers could not be rendered:", err);
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
    const payload = { tmdbId: currentItem.id, score: selectedScore, movieTitle: currentItem.title || currentItem.name || "Unknown", posterPath: currentItem.poster_path || "", mediaType: currentItem.media_type || "movie" };
    try {
        const res = await fetch(RATINGS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (res.ok) { document.getElementById('modalStatus').textContent = "✅ Rating saved!"; setTimeout(closeModal, 1000); }
        else { const err = await res.text(); document.getElementById('modalStatus').textContent = `❌ ${err}`; btn.disabled = false; }
    } catch { document.getElementById('modalStatus').textContent = "❌ Could not connect to server."; btn.disabled = false; }
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
        recCurrentItem = item; recExcludeIds.push(item.id); showRecCard(item);
    } catch {
        document.getElementById('recLoading').style.display = "none";
        document.getElementById('recError').style.display = "block";
        document.getElementById('recErrorMsg').textContent = "No match found. Try different genres.";
    }
}

function showRecCard(item) {
    const title = item.title || item.name || "Unknown";
    const type = item.mediaType === "tv" ? "TV SHOW" : "MOVIE";
    const year = (item.releaseDate || item.firstAirDate || item.release_date || item.first_air_date || "").slice(0, 4);
    const score = item.voteAverage || item.vote_average;
    const poster = item.posterPath || item.poster_path;
    const overview = item.overview || "No description available.";
    const gids = item.genreIds || item.genre_ids || [];

    document.getElementById('recPoster').src = poster ? `${IMG}${poster}` : "https://via.placeholder.com/260x380/1e1e2a/5a5a72?text=?";
    document.getElementById('recBadge').textContent = type;
    document.getElementById('recTitle').textContent = title;
    document.getElementById('recYear').textContent = year;
    document.getElementById('recOverview').textContent = overview;
    document.getElementById('recScore').textContent = score ? `★ ${(+score).toFixed(1)}` : "";
    document.getElementById('recGenreTags').innerHTML = gids.map(id => `<span class="rec-genre-tag">${genreMap[id] || id}</span>`).join('');
    document.getElementById('recRateBtn').onclick = () => openModal({ id: item.id, title: item.title, name: item.name, overview: item.overview, poster_path: poster, vote_average: score, release_date: item.releaseDate || item.release_date, first_air_date: item.firstAirDate || item.first_air_date, media_type: item.mediaType || "movie" });
    document.getElementById('recLoading').style.display = "none";
    document.getElementById('recCard').style.display = "block";
}

function skipRecommendation() { findRecommendation(); }
function markWatchedAndSkip() { if (recCurrentItem) recExcludeIds.push(recCurrentItem.id); findRecommendation(); }

// ── HAMBURGER ────────────────────────────────────────────────────
function setupHamburger() {
    document.getElementById('hamburger').addEventListener('click', () => document.getElementById('mobileMenu').classList.toggle('open'));
}

// ── HELPERS ──────────────────────────────────────────────────────
async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}
function showGridLoading() {
    document.getElementById('movieGrid').innerHTML = `<div class="grid-loading"><div class="spinner"></div><span>Loading content...</span></div>`;
    document.getElementById('loadMoreWrap').classList.remove('show');
}
function showGridEmpty(msg) {
    document.getElementById('movieGrid').innerHTML = `<div class="grid-empty"><h3>${msg}</h3></div>`;
}
function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
