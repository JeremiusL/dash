$ErrorActionPreference = "Stop"
Set-Location -Path "E:\projects\dash\backend"
$env:NODE_ENV = "production"
node dist/index.js *> "E:\projects\dash\backend\data\server.log"
