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
$sourcePath = Join-Path $root 'supabase\functions\quran-page\index.ts'
$client = [Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)

try {
  $multipart = [Net.Http.MultipartFormDataContent]::new()
  $stream = [IO.File]::OpenRead($sourcePath)
  try {
    $metadata = @{ name = 'quran-page'; entrypoint_path = 'index.ts'; verify_jwt = $false } | ConvertTo-Json -Compress
    $multipart.Add([Net.Http.StringContent]::new($metadata, [Text.Encoding]::UTF8), 'metadata')
    $content = [Net.Http.StreamContent]::new($stream)
    $content.Headers.ContentType = [Net.Http.Headers.MediaTypeHeaderValue]::new('application/typescript')
    $multipart.Add($content, 'file', 'index.ts')
    $response = $client.PostAsync(
      "https://api.supabase.com/v1/projects/$projectRef/functions/deploy?slug=quran-page",
      $multipart
    ).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) { throw "Supabase API HTTP $([int]$response.StatusCode): $body" }
    Write-Output 'Fungsi quran-page berjaya dideploy.'
  }
  finally { $stream.Dispose(); $multipart.Dispose() }
}
finally { $client.Dispose(); $token = $null; $blob = $null }
