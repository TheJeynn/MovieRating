using System.Text.Json.Serialization;

namespace MovieRating.DTOs
{
    public class MovieDto
    {
        public int Id { get; set; }

        [JsonPropertyName("title")]
        public string Title { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("overview")]
        public string Overview { get; set; }

        [JsonPropertyName("poster_path")]
        public string PosterPath { get; set; }

        [JsonPropertyName("vote_average")]
        public double VoteAverage { get; set; }

        [JsonPropertyName("release_date")]
        public string ReleaseDate { get; set; }
    }
    public class TmdbResponse
    {
        [JsonPropertyName("results")]
        public List<MovieDto> Results { get; set; }
    }
}
