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
        private readonly string _tmdbToken;

        public RatingsController(AppDbContext context)
        {
            _context = context;
            _tmdbToken = Environment.GetEnvironmentVariable("TMDB_KEY") ?? string.Empty;
        }

        [HttpPost]
        public async Task<ActionResult<Rating>> PostRating(Rating rating, [FromServices] IHttpClientFactory clientFactory)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            var client = clientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tmdbToken);

            var response = await client.GetAsync(
                $"https://api.themoviedb.org/3/movie/{rating.TmdbId}?language=en-US");

            if (!response.IsSuccessStatusCode)
                return BadRequest("Could not fetch data from TMDB. Check TMDB_KEY or TmdbId.");

            var movieData = await response.Content.ReadFromJsonAsync<TmdbMovieResponse>();

            if (movieData == null)
                return BadRequest("Could not parse TMDB response.");

            rating.MovieTitle = movieData.Title;
            rating.PosterPath = movieData.PosterPath;

            if (string.IsNullOrEmpty(rating.MovieTitle) || rating.MovieTitle == "string")
                return BadRequest("Movie details are missing! Skipping save.");

            _context.Ratings.Add(rating);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetRating), new { id = rating.Id }, rating);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Rating>>> GetRatings()
        {
            return await _context.Ratings.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Rating>> GetRating(int id)
        {
            var rating = await _context.Ratings.FindAsync(id);
            return rating == null ? NotFound() : rating;
        }

        [HttpGet("trending")]
        public async Task<ActionResult> GetTrending([FromServices] IHttpClientFactory clientFactory)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest(new { message = "TMDB_KEY not found in environment." });

            var client = clientFactory.CreateClient("TmdbClient");
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tmdbToken);

            var response = await client.GetAsync("trending/all/day?language=en-US");

            if (!response.IsSuccessStatusCode)
                return BadRequest(new { message = "TMDB API Error", status = response.StatusCode });

            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }
    }
}