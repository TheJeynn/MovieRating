namespace MovieRating.Models
{
    public class Rating
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int TmdbId { get; set; }
        public int Score { get; set; }
        public string MediaType { get; set; } = "movie"; // "movie" or "tv"
        public string MovieTitle { get; set; } = string.Empty;
        public string? PosterPath { get; set; }

        public DateTime RatedAt { get; set; }

        public AppUser? User { get; set; }
    }
}
