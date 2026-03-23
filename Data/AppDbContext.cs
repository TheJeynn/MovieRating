using Microsoft.EntityFrameworkCore;
using MovieRating.Models;

namespace MovieRating.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Rating> Ratings { get; set; }
    }
}
