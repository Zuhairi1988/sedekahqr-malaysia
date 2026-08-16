$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

if (-not ('CredentialReader' -as [type])) {
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct Credential {
    public uint Flags; public uint Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
    public uint AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredRead(string target, uint type, int reservedFlag, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", SetLastError = true)] private static extern void CredFree(IntPtr credentialPtr);
  public static byte[] ReadBlob(string target) {
    IntPtr pointer; if (!CredRead(target, 1, 0, out pointer)) throw new InvalidOperationException("Kelayakan Supabase tidak ditemui.");
    try { Credential credential = Marshal.PtrToStructure<Credential>(pointer); byte[] blob = new byte[credential.CredentialBlobSize]; Marshal.Copy(credential.CredentialBlob, blob, 0, blob.Length); return blob; }
    finally { CredFree(pointer); }
  }
}
'@
}

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env'
if (-not (Test-Path -LiteralPath $envPath)) { throw '.env tidak ditemui.' }
$values = @{}
Get-Content -LiteralPath $envPath | ForEach-Object {
  if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$') { $values[$Matches[1]] = $Matches[2].Trim('"', "'") }
}
$required = @('DEEPSEEK_API_KEY', 'DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD')
foreach ($name in $required) { if ([string]::IsNullOrWhiteSpace($values[$name])) { throw "$name tiada dalam .env." } }

$blob = [CredentialReader]::ReadBlob('Supabase CLI:supabase')
$token = [Text.Encoding]::Unicode.GetString($blob).Trim([char]0)
if ($token -notmatch '^sbp_') { $token = [Text.Encoding]::UTF8.GetString($blob).Trim([char]0) }
if ($token -notmatch '^sbp_[A-Za-z0-9_-]{20,}$') { throw 'Format kelayakan Supabase tidak sah.' }

$projectRef = 'wfujqvmqlwqmqmzdkepi'
$secrets = @($required | ForEach-Object { @{ name = $_; value = $values[$_] } })
$body = ConvertTo-Json -InputObject $secrets -Depth 3 -Compress
$client = [Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)

try {
  $response = $client.PostAsync(
    "https://api.supabase.com/v1/projects/$projectRef/secrets",
    [Net.Http.StringContent]::new($body, [Text.Encoding]::UTF8, 'application/json')
  ).GetAwaiter().GetResult()
  $responseBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if (-not $response.IsSuccessStatusCode) { throw "Supabase API HTTP $([int]$response.StatusCode): $responseBody" }
  Write-Output 'DeepSeek dan DataForSEO secrets berjaya diselaraskan ke Supabase.'
}
finally {
  $client.Dispose(); $token = $null; $blob = $null; $values.Clear(); $body = $null
}
