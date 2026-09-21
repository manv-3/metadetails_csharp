using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.Text.Json;
using System.Security.Claims;
using MetaDetective.Api.Data;
using System.Net.Http;
using System.Text.Json.Nodes;

public static class AnalyzeEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/analyze", async (HttpRequest request, AppDbContext db, ClaimsPrincipal user) =>
        {
            if (!request.HasFormContentType) return Results.BadRequest(new { error = "Expected form-data" });

            var form = await request.ReadFormAsync();
            var files = form.Files.Where(f => f.Name == "files" || f.Name == "file").ToList();
            if (files.Count == 0) return Results.BadRequest(new { error = "No file uploaded" });

            var results = new List<object>();
            
            foreach (var file in files)
            {
                var tempPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + "_" + file.FileName);
                
                using (var stream = new FileStream(tempPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                JsonNode? metadata = null;
                try
                {
                    var output = await RunExifToolAsync(tempPath);
                    var jsonArray = JsonNode.Parse(output) as JsonArray;
                    if (jsonArray != null && jsonArray.Count > 0)
                    {
                        metadata = jsonArray[0];
                    }
                }
                catch (Exception ex)
                {
                    metadata = JsonNode.Parse($@"{{ ""Error"": {JsonSerializer.Serialize(ex.Message)} }}");
                }
                finally
                {
                    if (File.Exists(tempPath)) File.Delete(tempPath);
                }

                results.Add(new {
                    filename = file.FileName,
                    metadata = metadata
                });
            }

            var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(userIdStr, out var userId))
            {
                var scan = new Scan
                {
                    UserId = userId,
                    ScanType = "file",
                    Name = files.Count == 1 ? files[0].FileName : $"{files.Count} files",
                    Result = JsonSerializer.SerializeToDocument(results)
                };
                db.Scans.Add(scan);
                await db.SaveChangesAsync();
            }

            return Results.Ok(results);
        });

        app.MapPost("/api/scrape", async ([FromBody] ScrapeRequest req, AppDbContext db, ClaimsPrincipal user) =>
        {
            var results = new List<object>();
            JsonNode? metadata = null;
            try
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.Add("User-Agent", "MetaDetective/1.0");
                var html = await client.GetStringAsync(req.Url);
                var doc = new HtmlAgilityPack.HtmlDocument();
                doc.LoadHtml(html);
                var title = doc.DocumentNode.SelectSingleNode("//title")?.InnerText ?? "No Title";

                metadata = JsonNode.Parse($@"{{ ""url"": ""{req.Url}"", ""title"": ""{title}"" }}");
            }
            catch (Exception ex)
            {
                metadata = JsonNode.Parse($@"{{ ""error"": {JsonSerializer.Serialize(ex.Message)} }}");
            }
            
            results.Add(new {
                filename = req.Url,
                metadata = metadata
            });

            var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(userIdStr, out var userId))
            {
                var scan = new Scan
                {
                    UserId = userId,
                    ScanType = "url",
                    Name = req.Url,
                    Result = JsonSerializer.SerializeToDocument(results)
                };
                db.Scans.Add(scan);
                await db.SaveChangesAsync();
            }

            return Results.Ok(results);
        });

        app.MapPost("/api/geocode", async ([FromBody] GeocodeRequest req) =>
        {
            using var client = new HttpClient();
            client.DefaultRequestHeaders.Add("User-Agent", "MetaDetective/1.0");
            var url = $"https://nominatim.openstreetmap.org/reverse?format=json&lat={req.Lat}&lon={req.Lon}";
            
            try
            {
                var response = await client.GetStringAsync(url);
                return Results.Ok(JsonDocument.Parse(response));
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });
    }

    private static async Task<string> RunExifToolAsync(string filePath)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "exiftool",
            Arguments = $"-j \"{filePath}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(psi);
        if (process == null) throw new Exception("Could not start exiftool");

        var output = await process.StandardOutput.ReadToEndAsync();
        await process.WaitForExitAsync();
        
        return string.IsNullOrWhiteSpace(output) ? "[]" : output;
    }
}

public class ScrapeRequest
{
    public string Url { get; set; } = string.Empty;
}

public class GeocodeRequest
{
    public double Lat { get; set; }
    public double Lon { get; set; }
}
