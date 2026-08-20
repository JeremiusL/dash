param(
    [string]$LogPath = "E:\projects\dash\backend\data\rebuild.log"
)

& {
    $ErrorActionPreference = "Stop"
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Set-Location "E:\projects\dash"

    try {
        Write-Output "[rebuild] git pull..."
        git pull --ff-only

        Write-Output "[rebuild] npm run build..."
        npm run build

        Write-Output "[rebuild] restarting..."
        # restart-dashboard.ps1 kills whoever owns port 3001 — which is an
        # ancestor of this very script (backend -> this rebuild script).
        # Killing an ancestor process can tear down its whole process tree
        # on Windows, taking this script down with it before the new node
        # process gets started. Running the restart as its own independent
        # Start-Process keeps it alive through that kill.
        Start-Process -FilePath "powershell.exe" `
            -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "E:\projects\dash\scripts\restart-dashboard.ps1" `
            -WindowStyle Hidden

        Write-Output "[rebuild] done."
    } catch {
        Write-Output "[rebuild] FAILED: $_"
        exit 1
    }
} *>&1 | Out-File -FilePath $LogPath -Append -Encoding utf8
