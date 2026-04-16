namespace MovieRating.DTOs
{
    public class MovieDetailsDto
    {
        public int Id { get; set; }
        public string? Title { get; set; }
        public string? Name { get; set; }
        public string? Overview { get; set; }
        public string? PosterPath { get; set; }
        public string? BackdropPath { get; set; }
        public double VoteAverage { get; set; }
        public string? ReleaseDate { get; set; }
        public string? FirstAirDate { get; set; }
        public string MediaType { get; set; } = "movie";
        public List<PersonCreditDto> Cast { get; set; } = new();
        public List<PersonCreditDto> Music { get; set; } = new();
        public List<PersonCreditDto> Creators { get; set; } = new();
    }

    public class PersonCreditDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Role { get; set; }
        public string? ProfilePath { get; set; }
    }
}
