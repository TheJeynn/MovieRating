using System.Text.Json.Serialization;

namespace MovieRating.Models
{
    public class TmdbMovieResponse
    {
        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("poster_path")]
        public string? PosterPath { get; set; }
    }
}