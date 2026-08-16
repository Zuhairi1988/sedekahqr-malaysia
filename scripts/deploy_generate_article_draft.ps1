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

$blob = [CredentialReader]::ReadBlob('Supabase CLI:supabase')
$token = [Text.Encoding]::Unicode.GetString($blob).Trim([char]0)
if ($token -notmatch '^sbp_') { $token = [Text.Encoding]::UTF8.GetString($blob).Trim([char]0) }
if ($token -notmatch '^sbp_[A-Za-z0-9_-]{20,}$') { throw 'Format kelayakan Supabase tidak sah.' }

$projectRef = 'wfujqvmqlwqmqmzdkepi'
$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'supabase\functions\generate-article-draft\index.ts'
$secretBytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($secretBytes)
$rng.Dispose()
$automationSecret = [Convert]::ToBase64String($secretBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
$client = [Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)

try {
  $secretBody = '[{"name":"ARTICLE_AUTOMATION_SECRET","value":"' + $automationSecret + '"}]'
  $secretResponse = $client.PostAsync(
    "https://api.supabase.com/v1/projects/$projectRef/secrets",
    [Net.Http.StringContent]::new($secretBody, [Text.Encoding]::UTF8, 'application/json')
  ).GetAwaiter().GetResult()
  if (-not $secretResponse.IsSuccessStatusCode) {
    $secretError = $secretResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    throw "Tidak dapat menyimpan token automasi: $secretError"
  }

  $sql = "select vault.create_secret('$automationSecret', 'article_automation_secret', 'Token dalaman untuk penjana draf artikel');"
  $dbBody = @{ query = $sql; read_only = $false } | ConvertTo-Json -Compress
  $dbResponse = $client.PostAsync(
    "https://api.supabase.com/v1/projects/$projectRef/database/query",
    [Net.Http.StringContent]::new($dbBody, [Text.Encoding]::UTF8, 'application/json')
  ).GetAwaiter().GetResult()
  if (-not $dbResponse.IsSuccessStatusCode) { throw "Tidak dapat menyimpan token automasi dalam Vault." }

  $multipart = [Net.Http.MultipartFormDataContent]::new()
  $stream = [IO.File]::OpenRead($sourcePath)
  try {
    $metadata = @{ name = 'generate-article-draft'; entrypoint_path = 'index.ts'; verify_jwt = $false } | ConvertTo-Json -Compress
    $multipart.Add([Net.Http.StringContent]::new($metadata, [Text.Encoding]::UTF8), 'metadata')
    $content = [Net.Http.StreamContent]::new($stream)
    $content.Headers.ContentType = [Net.Http.Headers.MediaTypeHeaderValue]::new('application/typescript')
    $multipart.Add($content, 'file', 'index.ts')
    $response = $client.PostAsync(
      "https://api.supabase.com/v1/projects/$projectRef/functions/deploy?slug=generate-article-draft",
      $multipart
    ).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) { throw "Supabase API HTTP $([int]$response.StatusCode): $body" }
    Write-Output 'Fungsi draf artikel berjaya dideploy dan token automasi disimpan.'
  }
  finally { $stream.Dispose(); $multipart.Dispose() }
}
finally { $client.Dispose(); $token = $null; $blob = $null; $automationSecret = $null; $secretBytes = $null }
