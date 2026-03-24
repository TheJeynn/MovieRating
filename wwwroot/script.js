const API_BASE_URL = "http://localhost:5128/api/Ratings";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

async function loadTrendingContent() {
    const grid = document.getElementById('movieGrid');
    grid.innerHTML = '<div class="loading-spinner">Discovering Trends...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/trending`);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const results = data.results ?? (Array.isArray(data) ? data : []);

        if (results.length === 0) {
            grid.innerHTML = "<p class='error-msg'>No content found.</p>";
            return;
        }

        grid.innerHTML = "";

        results.forEach(item => {
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
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Error:", error);
        grid.innerHTML = "<p class='error-msg'>Oops! Something went wrong while loading trends.</p>";
    }
}

loadTrendingContent();

// Search Filter
document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.movie-card');
    cards.forEach(card => {
        const title = card.querySelector('h3')?.innerText.toLowerCase() ?? '';
        card.style.display = title.includes(term) ? "block" : "none";
    });
});