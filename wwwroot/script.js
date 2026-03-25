const API_BASE_URL = "http://localhost:5128/api/Ratings";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

let currentView = "trending";
let selectedScore = 0;
let currentItem = null;

// ─── VIEW SWITCHER ───────────────────────────────────────────────
function switchView(view) {
    currentView = view;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (view === "trending") {
        document.getElementById('pageTitle').textContent = "Trending Today: Movies & TV Shows";
        loadTrendingContent();
    } else {
        document.getElementById('pageTitle').textContent = "My Rated Movies";
        loadRatedContent();
    }
}

// ─── TRENDING ────────────────────────────────────────────────────
async function loadTrendingContent() {
    const grid = document.getElementById('movieGrid');
    grid.innerHTML = '<div class="loading-spinner">Discovering Trends...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/trending`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        const results = data.results ?? (Array.isArray(data) ? data : []);

        if (results.length === 0) {
            grid.innerHTML = "<p class='error-msg'>No content found.</p>";
            return;
        }

        grid.innerHTML = "";
        results.forEach(item => renderCard(item, grid));

    } catch (error) {
        console.error("Error:", error);
        grid.innerHTML = "<p class='error-msg'>Oops! Something went wrong while loading trends.</p>";
    }
}

// ─── MY RATINGS ──────────────────────────────────────────────────
async function loadRatedContent() {
    const grid = document.getElementById('movieGrid');
    grid.innerHTML = '<div class="loading-spinner">Loading your ratings...</div>';

    try {
        const response = await fetch(API_BASE_URL);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const ratings = await response.json();

        if (!ratings || ratings.length === 0) {
            grid.innerHTML = "<p class='error-msg'>You haven't rated anything yet. Go rate some movies!</p>";
            return;
        }

        grid.innerHTML = "";
        ratings.forEach(rating => renderRatedCard(rating, grid));

    } catch (error) {
        console.error("Error:", error);
        grid.innerHTML = "<p class='error-msg'>Could not load your ratings.</p>";
    }
}

// ─── RENDER CARDS ────────────────────────────────────────────────
function renderCard(item, grid) {
    const title = item.title || item.name || "Unknown Content";
    const score = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
    const type = item.media_type === "tv" ? "TV SHOW" : "MOVIE";
    const poster = item.poster_path
        ? `${IMG_BASE}${item.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Poster";

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
        <div class="type-badge">${type}</div>
        <img src="${poster}" alt="${title}">
        <div class="card-content">
            <h3>${title}</h3>
            <span>⭐ ${score}/10</span>
            <button class="rate-btn" onclick='openModal(${JSON.stringify(item)})'>Rate It</button>
        </div>
    `;
    grid.appendChild(card);
}

function renderRatedCard(rating, grid) {
    const poster = rating.posterPath
        ? `${IMG_BASE}${rating.posterPath}`
        : "https://via.placeholder.com/500x750?text=No+Poster";

    const card = document.createElement('div');
    card.className = 'movie-card rated-card';
    card.innerHTML = `
        <div class="type-badge user-badge">RATED</div>
        <img src="${poster}" alt="${rating.movieTitle}">
        <div class="card-content">
            <h3>${rating.movieTitle}</h3>
            <span class="user-score">🎯 Your Score: ${rating.score}/10</span>
        </div>
    `;
    grid.appendChild(card);
}

// ─── MODAL ───────────────────────────────────────────────────────
function openModal(item) {
    currentItem = item;
    selectedScore = 0;

    document.getElementById('modalTitle').textContent = item.title || item.name || "Unknown";
    document.getElementById('modalType').textContent = item.media_type === "tv" ? "📺 TV Show" : "🎬 Movie";
    document.getElementById('modalPoster').src = item.poster_path
        ? `${IMG_BASE}${item.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Poster";
    document.getElementById('modalStatus').textContent = "";
    document.getElementById('ratingLabel').textContent = "Select a score";
    document.getElementById('submitRating').disabled = false;

    document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    currentItem = null;
    selectedScore = 0;
}

// Star interactions
document.addEventListener('DOMContentLoaded', () => {
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
});

// ─── SUBMIT RATING ───────────────────────────────────────────────
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
        posterPath: currentItem.poster_path || ""
    };

    try {
        const response = await fetch(API_BASE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            document.getElementById('modalStatus').textContent = "✅ Rating saved!";
            setTimeout(closeModal, 1200);
        } else {
            const err = await response.text();
            document.getElementById('modalStatus').textContent = `❌ Error: ${err}`;
            btn.disabled = false;
        }
    } catch (error) {
        document.getElementById('modalStatus').textContent = "❌ Could not connect to server.";
        btn.disabled = false;
    }
}

// ─── SEARCH FILTER ───────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.movie-card').forEach(card => {
        const title = card.querySelector('h3')?.innerText.toLowerCase() ?? '';
        card.style.display = title.includes(term) ? "block" : "none";
    });
});

// ─── INIT ────────────────────────────────────────────────────────
loadTrendingContent();