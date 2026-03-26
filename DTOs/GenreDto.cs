using System.Text.Json.Serialization;

namespace MovieRating.DTOs
{
    public class GenreDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;
    }

    public class GenreResponse
    {
        [JsonPropertyName("genres")]
        public List<GenreDto>? Genres { get; set; }
    }
}
