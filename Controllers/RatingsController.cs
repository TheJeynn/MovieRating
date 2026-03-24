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

        public RatingsController(AppDbContext context)
        {
            _context = context;
        }
        [HttpPost]
        public async Task<ActionResult<Rating>> PostRating(Rating rating, [FromServices] IHttpClientFactory clientFactory, [FromServices] IConfiguration config)
        {
            var client = clientFactory.CreateClient("TmdbClient");
            var apiKey = config["TMDB_KEY"];

            var response = await client.GetAsync($"https://api.themoviedb.org/3/movie/{rating.TmdbId}?api_key={apiKey}&language=tr-TR");

            if (response.IsSuccessStatusCode)
            {
                var movieData = await response.Content.ReadFromJsonAsync<TmdbMovieResponse>();
                if (movieData != null)
                {

                    rating.MovieTitle = movieData.Title;
                }
            }

            _context.Ratings.Add(rating);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetRating", new { id = rating.Id }, rating);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Rating>> GetRating(int id)
        {
            var rating = await _context.Ratings.FindAsync(id);

            if (rating == null)
            {
                return NotFound();
            }

            return rating;
        }
    }
}
