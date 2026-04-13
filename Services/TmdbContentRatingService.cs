using MovieRating.DTOs;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace MovieRating.Services
{
    public sealed class TmdbContentRatingService
    {
        private const string PreferredRegion = "US";

        public async Task<IReadOnlyDictionary<int, ContentRatingDto>> GetContentRatingsAsync(
            HttpClient client,
            string type,
            IEnumerable<int> ids,
            CancellationToken cancellationToken = default)
        {
            var normalizedType = NormalizeType(type);
            var selectedIds = ids
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            if (selectedIds.Count == 0)
                return new Dictionary<int, ContentRatingDto>();

            var tasks = selectedIds.Select(async id =>
            {
                var rating = await GetContentRatingAsync(client, normalizedType, id, cancellationToken);
                return new ContentRatingFetchResult(id, rating);
            });

            var results = await Task.WhenAll(tasks);

            return results
                .Where(result => result.Rating != null)
                .ToDictionary(
                    result => result.Id,
                    result => result.Rating!);
        }

        public async Task EnrichContentRatingsAsync(
            HttpClient client,
            string type,
            IEnumerable<MovieDto> items,
            CancellationToken cancellationToken = default)
        {
            var selectedItems = items
                .Where(item => item.Id > 0)
                .ToList();

            if (selectedItems.Count == 0)
                return;

            var ratings = await GetContentRatingsAsync(
                client,
                type,
                selectedItems.Select(item => item.Id),
                cancellationToken);

            foreach (var item in selectedItems)
            {
                if (!ratings.TryGetValue(item.Id, out var rating))
                    continue;

                item.ContentRating = rating.ContentRating;
                item.ContentRatingAge = rating.ContentRatingAge;
            }
        }

        public async Task<ContentRatingDto?> GetContentRatingAsync(
            HttpClient client,
            string type,
            int id,
            CancellationToken cancellationToken = default)
        {
            if (id <= 0)
                return null;

            var rating = await GetRatingInfoAsync(client, NormalizeType(type), id, cancellationToken);
            if (rating == null)
                return null;

            return new ContentRatingDto
            {
                Id = id,
                ContentRating = rating.Label,
                ContentRatingAge = rating.Age
            };
        }

        private static string NormalizeType(string? type)
        {
            return string.Equals(type, "tv", StringComparison.OrdinalIgnoreCase) ? "tv" : "movie";
        }

        private static async Task<ContentRatingInfo?> GetRatingInfoAsync(
            HttpClient client,
            string type,
            int id,
            CancellationToken cancellationToken)
        {
            try
            {
                var endpoint = type == "tv"
                    ? $"tv/{id}/content_ratings"
                    : $"movie/{id}/release_dates";

                using var response = await client.GetAsync(endpoint, cancellationToken);
                if (!response.IsSuccessStatusCode)
                    return null;

                if (type == "tv")
                {
                    var data = await response.Content.ReadFromJsonAsync<TvContentRatingsResponse>(cancellationToken: cancellationToken);
                    return ExtractTvRating(data);
                }

                var movieData = await response.Content.ReadFromJsonAsync<MovieReleaseDatesResponse>(cancellationToken: cancellationToken);
                return ExtractMovieRating(movieData);
            }
            catch
            {
                return null;
            }
        }

        private static ContentRatingInfo? ExtractMovieRating(MovieReleaseDatesResponse? response)
        {
            var preferred = response?.Results?
                .FirstOrDefault(result => string.Equals(result.Iso31661, PreferredRegion, StringComparison.OrdinalIgnoreCase));

            var candidates = preferred?.ReleaseDates?
                .Select(result => result.Certification)
                .Where(certification => !string.IsNullOrWhiteSpace(certification))
                .Select(certification => certification!)
                .ToList();

            if (candidates is { Count: > 0 })
                return SelectBestRating(candidates!);

            return SelectBestRating(response?.Results?
                .SelectMany(result => result.ReleaseDates ?? Enumerable.Empty<MovieReleaseDateItem>())
                .Select(result => result.Certification)
                .Where(certification => !string.IsNullOrWhiteSpace(certification))
                .Select(certification => certification!)
                .ToList());
        }

        private static ContentRatingInfo? ExtractTvRating(TvContentRatingsResponse? response)
        {
            var preferred = response?.Results?
                .Where(result => !string.IsNullOrWhiteSpace(result.Rating))
                .OrderByDescending(result => string.Equals(result.Iso31661, PreferredRegion, StringComparison.OrdinalIgnoreCase))
                .Select(result => result.Rating!)
                .ToList();

            return SelectBestRating(preferred);
        }

        private static ContentRatingInfo? SelectBestRating(IEnumerable<string>? certifications)
        {
            return certifications?
                .Select(MapCertification)
                .Where(rating => rating != null)
                .OrderByDescending(rating => rating!.Age)
                .FirstOrDefault();
        }

        private static ContentRatingInfo? MapCertification(string? certification)
        {
            if (string.IsNullOrWhiteSpace(certification))
                return null;

            var raw = certification.Trim();
            var normalized = raw.ToUpperInvariant();

            if (normalized is "NR" or "UNRATED" or "NOT RATED")
                return null;

            if (normalized is "TV-MA" or "R" or "NC-17" or "X" or "AO")
                return new ContentRatingInfo("18+", 18);

            if (normalized is "TV-14" or "MA15+")
                return new ContentRatingInfo("16+", 16);

            if (normalized is "PG-13" or "TV-PG")
                return new ContentRatingInfo("13+", 13);

            if (normalized is "G" or "PG" or "TV-G" or "TV-Y" or "TV-Y7")
                return new ContentRatingInfo("Family", 0);

            var numberMatch = Regex.Match(normalized, @"\d+");
            if (!numberMatch.Success || !int.TryParse(numberMatch.Value, out var age))
                return null;

            if (age >= 18)
                return new ContentRatingInfo("18+", 18);

            if (age >= 15)
                return new ContentRatingInfo("16+", 16);

            if (age >= 12)
                return new ContentRatingInfo("13+", 13);

            return new ContentRatingInfo("Family", 0);
        }

        private sealed record ContentRatingInfo(string Label, int Age);
        private sealed record ContentRatingFetchResult(int Id, ContentRatingDto? Rating);

        private sealed class MovieReleaseDatesResponse
        {
            [JsonPropertyName("results")]
            public List<MovieReleaseDateRegion>? Results { get; set; }
        }

        private sealed class MovieReleaseDateRegion
        {
            [JsonPropertyName("iso_3166_1")]
            public string? Iso31661 { get; set; }

            [JsonPropertyName("release_dates")]
            public List<MovieReleaseDateItem>? ReleaseDates { get; set; }
        }

        private sealed class MovieReleaseDateItem
        {
            [JsonPropertyName("certification")]
            public string? Certification { get; set; }
        }

        private sealed class TvContentRatingsResponse
        {
            [JsonPropertyName("results")]
            public List<TvContentRatingItem>? Results { get; set; }
        }

        private sealed class TvContentRatingItem
        {
            [JsonPropertyName("iso_3166_1")]
            public string? Iso31661 { get; set; }

            [JsonPropertyName("rating")]
            public string? Rating { get; set; }
        }
    }
}
