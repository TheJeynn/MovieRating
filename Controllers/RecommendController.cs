using Microsoft.AspNetCore.Mvc;
using MovieRating.DTOs;
using MovieRating.Services;
using System.Globalization;
using System.Net.Http.Json;
using System.Text;

namespace MovieRating.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RecommendController : ControllerBase
    {
        private readonly IHttpClientFactory _clientFactory;
        private readonly TmdbContentRatingService _contentRatingService;
        private readonly string _tmdbToken;

        public RecommendController(IHttpClientFactory clientFactory, TmdbContentRatingService contentRatingService)
        {
            _clientFactory = clientFactory;
            _contentRatingService = contentRatingService;
            _tmdbToken = Environment.GetEnvironmentVariable("TMDB_KEY") ?? string.Empty;
        }

        // POST: api/Recommend
        // Body: { "type": "movie"|"tv", "genreIds": [28, 12], "excludeIds": [123, 456], "genreMode": "all"|"any", "minRating": 6.5, "maxRating": 10, "ageRating": "13+" }
        [HttpPost]
        public async Task<IActionResult> GetRecommendation([FromBody] RecommendRequest request)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found.");

            var selectedGenres = request.GenreIds
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            if (selectedGenres.Count == 0)
                return BadRequest("At least one genre is required.");

            var client = _clientFactory.CreateClient("TmdbClient");
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tmdbToken);

            var type = string.Equals(request.Type, "tv", StringComparison.OrdinalIgnoreCase) ? "tv" : "movie";
            var genreMode = string.Equals(request.GenreMode, "any", StringComparison.OrdinalIgnoreCase) ? "any" : "all";
            var genreSeparator = genreMode == "all" ? "," : "|";
            var genreParam = string.Join(genreSeparator, selectedGenres);
            var selectedAgeRating = NormalizeAgeRating(request.AgeRating);
            var (minRating, maxRating) = NormalizeRatingRange(request.MinRating, request.MaxRating);
            var excludeIds = request.ExcludeIds == null
                ? new HashSet<int>()
                : new HashSet<int>(request.ExcludeIds);

            var rng = new Random();

            for (int attempt = 0; attempt < 6; attempt++)
            {
                var page = rng.Next(1, 11);
                var url = BuildDiscoverUrl(type, genreParam, minRating, maxRating, page);

                var response = await client.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                    continue;

                var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>();
                if (data?.Results == null || data.Results.Count == 0)
                    continue;

                var candidates = data.Results
                    .Where(item => !excludeIds.Contains(item.Id))
                    .Where(item => !string.IsNullOrWhiteSpace(item.PosterPath))
                    .Where(item => item.GenreIds.Count > 0)
                    .ToList();

                if (candidates.Count == 0)
                    continue;

                IReadOnlyDictionary<int, ContentRatingDto> ratingLookup = new Dictionary<int, ContentRatingDto>();
                if (selectedAgeRating.HasValue)
                {
                    ratingLookup = await _contentRatingService.GetContentRatingsAsync(
                        client,
                        type,
                        candidates.Select(item => item.Id),
                        HttpContext.RequestAborted);

                    candidates = candidates
                        .Where(item =>
                            ratingLookup.TryGetValue(item.Id, out var rating) &&
                            rating.ContentRatingAge == selectedAgeRating.Value)
                        .ToList();

                    if (candidates.Count == 0)
                        continue;
                }

                var candidatePool = candidates
                    .OrderByDescending(item => item.VoteAverage)
                    .Take(Math.Min(candidates.Count, 12))
                    .ToList();

                var pick = candidatePool[rng.Next(candidatePool.Count)];
                pick.MediaType = type;

                if (selectedAgeRating.HasValue)
                {
                    if (ratingLookup.TryGetValue(pick.Id, out var selectedRating))
                    {
                        pick.ContentRating = selectedRating.ContentRating;
                        pick.ContentRatingAge = selectedRating.ContentRatingAge;
                    }
                }
                else
                {
                    var selectedRating = await _contentRatingService.GetContentRatingAsync(
                        client,
                        type,
                        pick.Id,
                        HttpContext.RequestAborted);

                    pick.ContentRating = selectedRating?.ContentRating;
                    pick.ContentRatingAge = selectedRating?.ContentRatingAge;
                }

                return Ok(pick);
            }

            return NotFound("No recommendation found. Try different genres.");
        }

        private static (double MinRating, double MaxRating) NormalizeRatingRange(double? minRating, double? maxRating)
        {
            var normalizedMin = Math.Clamp(minRating ?? 6.5, 0, 10);
            var normalizedMax = Math.Clamp(maxRating ?? 10, 0, 10);

            return normalizedMin <= normalizedMax
                ? (normalizedMin, normalizedMax)
                : (normalizedMax, normalizedMin);
        }

        private static int? NormalizeAgeRating(string? ageRating)
        {
            return ageRating?.Trim().ToLowerInvariant() switch
            {
                "family" => 0,
                "13" or "13+" => 13,
                "16" or "16+" => 16,
                "18" or "18+" => 18,
                _ => null
            };
        }

        private static string BuildDiscoverUrl(string type, string genreParam, double minRating, double maxRating, int page)
        {
            var query = new List<string>
            {
                "language=en-US",
                $"page={Math.Max(page, 1)}",
                "include_adult=false",
                "sort_by=popularity.desc",
                "vote_count.gte=200",
                $"vote_average.gte={minRating.ToString("0.0", CultureInfo.InvariantCulture)}",
                $"vote_average.lte={maxRating.ToString("0.0", CultureInfo.InvariantCulture)}",
                $"with_genres={genreParam}"
            };

            var builder = new StringBuilder($"discover/{type}?");
            builder.Append(string.Join("&", query));
            return builder.ToString();
        }
    }

    public class RecommendRequest
    {
        public string Type { get; set; } = "movie";
        public List<int> GenreIds { get; set; } = new();
        public List<int>? ExcludeIds { get; set; }
        public string GenreMode { get; set; } = "all";
        public double? MinRating { get; set; }
        public double? MaxRating { get; set; }
        public string? AgeRating { get; set; }
    }
}
