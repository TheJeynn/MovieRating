namespace MovieRating.Models
{
    public class Rating
    {
        public int Id { get; set; }
        public int TmdbId { get; set; }
        public string ContentType { get; set; }
        public double UserScore { get; set; }
        public string Comment { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
