@echo off
rem Prints the current free web address of Vendor Atlas (the "quick" tunnel).
rem It changes when the PC or Docker restarts, so run this after a restart.
cd /d "%~dp0"
powershell -NoProfile -Command "$m = docker compose --profile quick logs quick 2>$null | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches | ForEach-Object { $_.Matches.Value }; if ($m) { Write-Host ''; Write-Host 'Vendor Atlas is at:' $m[-1]; Write-Host '' } else { Write-Host 'No address yet. Is it running? Try: docker compose --profile quick up -d' }"
pause
