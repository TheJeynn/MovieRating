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
        public async Task<ActionResult<Rating>> AddRating(Rating rating)
        {
            _context.Ratings.Add(rating);
            await _context.SaveChangesAsync();
            return Ok(rating);
        }
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Rating>>> GetAllRatings()
        {
            return await _context.Ratings.ToListAsync();
        }
    }
}
