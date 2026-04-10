using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MovieRating.Data;
using MovieRating.Models;

namespace MovieRating.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RatingsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHttpClientFactory _clientFactory;

        public RatingsController(AppDbContext context, IHttpClientFactory clientFactory)
        {
            _context = context;
            _clientFactory = clientFactory;
        }

        // GET: api/Ratings
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Rating>>> GetRatings()
        {
            var ratings = await _context.Ratings
                .OrderByDescending(r => r.RatedAt)
                .ThenByDescending(r => r.Id)
                .ToListAsync();

            return ratings
                .GroupBy(r => new { r.TmdbId, r.MediaType })
                .Select(group => group.First())
                .ToList();
        }

        // GET: api/Ratings/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Rating>> GetRating(int id)
        {
            var rating = await _context.Ratings.FindAsync(id);
            return rating == null ? NotFound() : rating;
        }

        // GET: api/Ratings/trending
        [HttpGet("trending")]
        public async Task<ActionResult> GetTrending()
        {
            var tmdbToken = Environment.GetEnvironmentVariable("TMDB_KEY") ?? string.Empty;

            if (string.IsNullOrEmpty(tmdbToken))
                return BadRequest(new { message = "TMDB_KEY not found in environment." });

            var client = _clientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tmdbToken);

            var response = await client.GetAsync("https://api.themoviedb.org/3/trending/all/day?language=en-US");

            if (!response.IsSuccessStatusCode)
                return BadRequest(new { message = "TMDB API Error", status = response.StatusCode });

            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }

        // POST: api/Ratings
        [HttpPost]
        public async Task<ActionResult<Rating>> PostRating(Rating rating)
        {
            var tmdbToken = Environment.GetEnvironmentVariable("TMDB_KEY") ?? string.Empty;

            if (string.IsNullOrEmpty(tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            bool isTv = string.Equals(rating.MediaType, "tv", StringComparison.OrdinalIgnoreCase);
            rating.MediaType = isTv ? "tv" : "movie";

            var client = _clientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tmdbToken);

            string? movieTitle = null;
            string? posterPath = null;

            try
            {
                if (isTv)
                {
                    var tvResponse = await client.GetAsync(
                        $"https://api.themoviedb.org/3/tv/{rating.TmdbId}?language=en-US");

                    if (tvResponse.IsSuccessStatusCode)
                    {
                        var tvData = await tvResponse.Content.ReadFromJsonAsync<TmdbTvResponse>();
                        movieTitle = tvData?.Name;
                        posterPath = tvData?.PosterPath;
                    }
                }
                else
                {
                    var movieResponse = await client.GetAsync(
                        $"https://api.themoviedb.org/3/movie/{rating.TmdbId}?language=en-US");

                    if (movieResponse.IsSuccessStatusCode)
                    {
                        var movieData = await movieResponse.Content.ReadFromJsonAsync<TmdbMovieResponse>();
                        movieTitle = movieData?.Title;
                        posterPath = movieData?.PosterPath;
                    }
                }
            }
            catch (Exception ex)
            {
                return BadRequest($"TMDB API error: {ex.Message}");
            }

            if (string.IsNullOrEmpty(movieTitle))
                return BadRequest("Could not fetch title from TMDB. Check TMDB_KEY or TmdbId.");

            rating.MovieTitle = movieTitle;
            rating.PosterPath = posterPath;
            rating.RatedAt = DateTime.UtcNow;

            try
            {
                var existingRating = await _context.Ratings
                    .Where(r => r.TmdbId == rating.TmdbId && r.MediaType == rating.MediaType)
                    .OrderByDescending(r => r.RatedAt)
                    .ThenByDescending(r => r.Id)
                    .FirstOrDefaultAsync();

                if (existingRating == null)
                {
                    _context.Ratings.Add(rating);
                }
                else
                {
                    existingRating.Score = rating.Score;
                    existingRating.MovieTitle = rating.MovieTitle;
                    existingRating.PosterPath = rating.PosterPath;
                    existingRating.RatedAt = rating.RatedAt;
                    rating = existingRating;
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Database error: {ex.Message}");
            }

            return Ok(rating);
        }
    }

    public class TmdbTvResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("name")]
        public string? Name { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("poster_path")]
        public string? PosterPath { get; set; }
    }
}
