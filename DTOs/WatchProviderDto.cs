namespace MovieRating.DTOs
{
    public class WatchProviderDto
    {
        public int Id { get; set; }
        public string Region { get; set; } = string.Empty;
        public string? Link { get; set; }
        public List<string> Stream { get; set; } = new();
        public List<string> Rent { get; set; } = new();
        public List<string> Buy { get; set; } = new();
    }
}
