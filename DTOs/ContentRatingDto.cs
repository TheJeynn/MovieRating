using System.Text.Json.Serialization;

namespace MovieRating.DTOs
{
    public class ContentRatingDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("content_rating")]
        public string? ContentRating { get; set; }

        [JsonPropertyName("content_rating_age")]
        public int? ContentRatingAge { get; set; }
    }
}
