$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$destination = Join-Path $projectRoot 'public\ffmpeg'
$singleSource = Join-Path $projectRoot 'node_modules\@ffmpeg\core\dist\esm'
$multiSource = Join-Path $projectRoot 'node_modules\@ffmpeg\core-mt\dist\esm'

New-Item -ItemType Directory -Force -Path (Join-Path $destination 'single') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $destination 'multi') | Out-Null

Copy-Item -LiteralPath (Join-Path $singleSource 'ffmpeg-core.js') -Destination (Join-Path $destination 'single\ffmpeg-core.js') -Force
Copy-Item -LiteralPath (Join-Path $singleSource 'ffmpeg-core.wasm') -Destination (Join-Path $destination 'single\ffmpeg-core.wasm') -Force
Copy-Item -LiteralPath (Join-Path $multiSource 'ffmpeg-core.js') -Destination (Join-Path $destination 'multi\ffmpeg-core.js') -Force
Copy-Item -LiteralPath (Join-Path $multiSource 'ffmpeg-core.wasm') -Destination (Join-Path $destination 'multi\ffmpeg-core.wasm') -Force
Copy-Item -LiteralPath (Join-Path $multiSource 'ffmpeg-core.worker.js') -Destination (Join-Path $destination 'multi\ffmpeg-core.worker.js') -Force

Write-Host 'Copied self-hosted FFmpeg runtime assets to public/ffmpeg.'
