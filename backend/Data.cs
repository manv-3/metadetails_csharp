using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace MetaDetective.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<Scan> Scans { get; set; }
}

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string HashedPassword { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Scan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? UserId { get; set; }
    public string ScanType { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public JsonDocument Result { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
