using MovieRating.Data;
using Microsoft.EntityFrameworkCore;
using MovieRating.Services;

// --- STEP 1: LOAD .ENV AT THE VERY START ---
var root = Directory.GetCurrentDirectory();
var dotenvPath = Path.Combine(root, ".env");

if (File.Exists(dotenvPath))
{
    foreach (var line in File.ReadAllLines(dotenvPath))
    {
        if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#")) continue;
        var parts = line.Split('=', 2);
        if (parts.Length != 2) continue;
        Environment.SetEnvironmentVariable(parts[0].Trim(), parts[1].Trim());
    }
}

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddUserSecrets<Program>()
    .AddEnvironmentVariables();

// --- STEP 2: SERVICES ---
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<TmdbContentRatingService>();

var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION")
                       ?? builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

var tmdbApiKey = builder.Configuration["TmdbSettings:ApiKey"];

builder.Services.AddSingleton(tmdbApiKey ?? string.Empty);

builder.Services.AddHttpClient("TmdbClient", client =>
{
    client.BaseAddress = new Uri("https://api.themoviedb.org/3/");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

var app = builder.Build();

// --- STEP 3: MIDDLEWARE ---
//app.UseHttpsRedirection();
app.UseCors("AllowAll");
app.UseDefaultFiles();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthorization();
app.MapControllers();

// --- STEP 4: AUTO MIGRATION ---
using (var scope = app.Services.CreateScope())
{
    try
    {
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        context.Database.Migrate();
        Console.WriteLine("--> Migration OK.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"--> Migration Error: {ex.Message}");
    }
}

app.Run();
