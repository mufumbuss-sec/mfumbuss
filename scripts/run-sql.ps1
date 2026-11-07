param([string]$SqlFile = "supabase\schema.sql")

$token = $env:SUPABASE_ACCESS_TOKEN
if (-not $token) {
  throw "Set the SUPABASE_ACCESS_TOKEN environment variable before running this script."
}

$project = $env:SUPABASE_PROJECT_ID
if (-not $project) {
  throw "Set the SUPABASE_PROJECT_ID environment variable before running this script."
}

$sql = Get-Content -Raw -Path $SqlFile
$body = ConvertTo-Json -InputObject @{ query = $sql } -Compress -Depth 3
$uri = "https://api.supabase.com/v1/projects/$project/database/query"
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
try {
  $res = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body
  Write-Output "OK"
  $res | ConvertTo-Json -Depth 5
} catch {
  Write-Output $_.Exception.Message
  if ($_.ErrorDetails.Message) { Write-Output $_.ErrorDetails.Message }
}
