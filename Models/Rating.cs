namespace MovieRating.Models
{
    public class Rating
    {
        public int Id { get; set; }
        public int TmdbId { get; set; }
        public int Score { get; set; }

        public string MovieTitle { get; set; } = string.Empty;
        public string? PosterPath { get; set; }
    }
}