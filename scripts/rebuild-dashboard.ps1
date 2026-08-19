$ErrorActionPreference = "Stop"
Set-Location "E:\projects\dash"

git pull --ff-only
npm run build

& "E:\projects\dash\scripts\restart-dashboard.ps1"
