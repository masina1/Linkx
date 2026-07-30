# Packages the Linkx extension into a Chrome Web Store ZIP.
# Entry names use forward slashes (ZIP spec 4.4.17), which Windows PowerShell's
# Compress-Archive / ZipFile.CreateFromDirectory do NOT guarantee. Run from repo root:
#   powershell -ExecutionPolicy Bypass -File tools\pack.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot            # repo root (tools/..)
$src  = Join-Path $root 'linkx'
$ver  = (Get-Content (Join-Path $src 'manifest.json') | ConvertFrom-Json).version
$zip  = Join-Path $root "linkx-$ver.zip"

# Files to ship, as: <path relative to linkx/> (also used as the ZIP entry name).
$entries = @(
  'manifest.json',
  'background.js',
  'options.html',
  'options.css',
  'options.js',
  'lib/logic.js',
  'lib/storage.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
)

if (Test-Path $zip) { Remove-Item -Force $zip }
Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

$fs = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($name in $entries) {
    $file = Join-Path $src ($name -replace '/', '\')
    if (-not (Test-Path $file)) { throw "Missing file: $file" }
    $entry = $archive.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)  # name kept verbatim -> forward slashes
    $es = $entry.Open()
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $es.Write($bytes, 0, $bytes.Length)
    $es.Dispose()
  }
} finally {
  $archive.Dispose()
  $fs.Dispose()
}
Write-Host "Created $zip"
