using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

public static class HealthEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
    }
}
