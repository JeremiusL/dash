$ErrorActionPreference = "Stop"

$conn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    exit 0
}

$env:NODE_ENV = "production"
Start-Process -FilePath "cmd.exe" `
    -ArgumentList '/c', 'node dist\index.js >> data\server.log 2>&1' `
    -WorkingDirectory "E:\projects\dash\backend" `
    -WindowStyle Hidden
