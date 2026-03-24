

namespace MovieRating.Models
{
    public class TmdbMovieResponse
    {
        public string Title { get; set; } = string.Empty;
        public string Overview { get; set; } = string.Empty;
        public string? Poster_Path { get; set; }
    }
}
