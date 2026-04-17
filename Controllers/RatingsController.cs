using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MovieRating.Data;
using MovieRating.Models;

namespace MovieRating.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
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
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var ratings = await _context.Ratings
                .Where(rating => rating.UserId == userId.Value)
                .OrderByDescending(rating => rating.RatedAt)
                .ThenByDescending(rating => rating.Id)
                .ToListAsync();

            return ratings
                .GroupBy(rating => new { rating.TmdbId, rating.MediaType })
                .Select(group => group.First())
                .ToList();
        }

        // GET: api/Ratings/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Rating>> GetRating(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var rating = await _context.Ratings
                .FirstOrDefaultAsync(candidate => candidate.Id == id && candidate.UserId == userId.Value);

            return rating == null ? NotFound() : rating;
        }

        // GET: api/Ratings/trending
        [HttpGet("trending")]
        [AllowAnonymous]
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
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var tmdbToken = Environment.GetEnvironmentVariable("TMDB_KEY") ?? string.Empty;

            if (string.IsNullOrEmpty(tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            var isTv = string.Equals(rating.MediaType, "tv", StringComparison.OrdinalIgnoreCase);
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

            rating.UserId = userId.Value;
            rating.MovieTitle = movieTitle;
            rating.PosterPath = posterPath;
            rating.RatedAt = DateTime.UtcNow;

            try
            {
                var existingRating = await _context.Ratings
                    .Where(existing => existing.UserId == userId.Value
                        && existing.TmdbId == rating.TmdbId
                        && existing.MediaType == rating.MediaType)
                    .OrderByDescending(existing => existing.RatedAt)
                    .ThenByDescending(existing => existing.Id)
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

        // DELETE: api/Ratings/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRating(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var rating = await _context.Ratings
                .AsNoTracking()
                .FirstOrDefaultAsync(candidate => candidate.Id == id && candidate.UserId == userId.Value);

            if (rating == null)
                return NotFound("Rating not found.");

            var ratingsToDelete = await _context.Ratings
                .Where(candidate => candidate.UserId == userId.Value
                    && candidate.TmdbId == rating.TmdbId
                    && candidate.MediaType == rating.MediaType)
                .ToListAsync();

            if (ratingsToDelete.Count == 0)
                return NotFound("Rating not found.");

            _context.Ratings.RemoveRange(ratingsToDelete);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private int? GetCurrentUserId()
        {
            var rawUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(rawUserId, out var userId) ? userId : null;
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
