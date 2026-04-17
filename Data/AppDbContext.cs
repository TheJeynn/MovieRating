using Microsoft.EntityFrameworkCore;
using MovieRating.Models;

namespace MovieRating.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<AppUser> Users { get; set; }
        public DbSet<Rating> Ratings { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<AppUser>(entity =>
            {
                entity.HasIndex(user => user.Username).IsUnique();
                entity.Property(user => user.Username).HasMaxLength(32);
                entity.Property(user => user.PasswordHash).IsRequired();
            });

            modelBuilder.Entity<Rating>(entity =>
            {
                entity.HasIndex(rating => new { rating.UserId, rating.TmdbId, rating.MediaType }).IsUnique();
                entity.Property(rating => rating.MediaType).HasMaxLength(16);

                entity.HasOne(rating => rating.User)
                    .WithMany(user => user.Ratings)
                    .HasForeignKey(rating => rating.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
