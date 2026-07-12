param(
  [Parameter(Mandatory = $true)]
  [string]$RepositoryUrl
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
  throw "This folder is not a git repository."
}

$existingOrigin = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0 -and $existingOrigin) {
  if ($existingOrigin -notlike "https://github.com/*") {
    git remote rename origin sites-backup
  } else {
    git remote set-url origin $RepositoryUrl
  }
}

$originAfterRename = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0 -or -not $originAfterRename) {
  git remote add origin $RepositoryUrl
}

git push -u origin main

