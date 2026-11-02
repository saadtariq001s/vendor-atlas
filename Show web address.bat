@echo off
rem Prints the current free web address of Vendor Atlas (the "quick" tunnel)
rem and, if set up, the permanent link that always forwards to it.
cd /d "%~dp0"
powershell -NoProfile -Command "$m = @(docker compose --profile quick logs quick 2>$null | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches | ForEach-Object { $_.Matches } | ForEach-Object { $_.Value }); Write-Host ''; if ($m.Count -gt 0) { Write-Host '  Vendor Atlas is at:' $m[-1] -ForegroundColor Green; Set-Clipboard -Value $m[-1]; Write-Host '  (copied to the clipboard)' } else { Write-Host '  No address found. Is it running? In this folder run:'; Write-Host '    docker compose --profile quick up -d'; Write-Host '    docker compose --profile quick logs quick' }; $r = Select-String -Path .env -Pattern '^LINK_REPO=([^/\s]+)/(\S+)' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($r) { $o = $r.Matches[0].Groups[1].Value.ToLower(); $n = $r.Matches[0].Groups[2].Value; Write-Host ''; Write-Host ('  Permanent link (never changes): https://' + $o + '.github.io/' + $n + '/') -ForegroundColor Cyan }; Write-Host ''"
pause
