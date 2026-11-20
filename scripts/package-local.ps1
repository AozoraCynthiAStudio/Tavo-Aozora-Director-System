param([string]$Version)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot=Split-Path $PSScriptRoot -Parent
if(!$Version){$Version=(Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Encoding UTF8 -Raw | ConvertFrom-Json).version}
$dest=Join-Path $projectRoot 'dist'
function Get-ProjectRelative([string]$base,[string]$full){
  $baseUri=[Uri]([IO.Path]::GetFullPath($base).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar)
  $fileUri=[Uri][IO.Path]::GetFullPath($full)
  return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($fileUri).ToString())
}
function New-ProjectArchive([string]$target,[string]$base,[string[]]$entries){
  $stream=[IO.File]::Open($target,[IO.FileMode]::Create)
  $zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
  try{foreach($entry in $entries){$full=Join-Path $base $entry;$files=if(Test-Path -LiteralPath $full -PathType Leaf){Get-Item -LiteralPath $full}else{Get-ChildItem -LiteralPath $full -File -Recurse};foreach($file in $files){if($file.FullName -match '[\\/]__pycache__[\\/]'){continue};$relative=Get-ProjectRelative $base $file.FullName;if($relative -eq 'src/assets/legacy-style-literal.txt'){continue};[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal) | Out-Null}}}finally{$zip.Dispose();$stream.Dispose()}
}
New-ProjectArchive (Join-Path $dest "Aozora_Director_System_V$Version.tpg") (Join-Path $dest 'plugin') @('.')
New-ProjectArchive (Join-Path $dest "Aozora_Director_${Version}_source.zip") $projectRoot @('src','scripts','tests','docs/marketplace-copy.md','package.json','README.md','THIRD_PARTY_NOTICES.txt')
Get-Item -LiteralPath (Join-Path $dest "Aozora_Director_System_V$Version.tpg"),(Join-Path $dest "Aozora_Director_${Version}_source.zip") | Select-Object Name,Length
