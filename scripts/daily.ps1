# Daily Workable routine: buy forecasts, score outcomes, rebuild + redeploy the demo, push to GitHub.
# Run by hand:  powershell -ExecutionPolicy Bypass -File scripts\daily.ps1
# Costs up to $0.60 of testnet USDC a day (12 sites x 4 windows, capped; see scripts/daily-decisions.ts).
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force "data\logs" | Out-Null
$log = "data\logs\daily-$(Get-Date -Format yyyy-MM-dd).log"
function Step($name, [scriptblock]$cmd) {
  "=== $name $(Get-Date -Format o)" | Out-File -Append -Encoding utf8 $log
  & $cmd 2>&1 | Where-Object { "$_" -notmatch "anjoman_" } | Out-File -Append -Encoding utf8 $log
}
Step "daily decisions" { npm run -s daily }
Step "outcomes"      { npm run -s outcomes }
Step "build"         { npm run -s build }
Step "deploy"        { Push-Location dist; vercel deploy --prod --yes --name workable-telegraph; Pop-Location }
Step "commit+push"   { git add data fixtures; git commit -q -m "Daily data $(Get-Date -Format yyyy-MM-dd)"; git push -q }
"=== done $(Get-Date -Format o)" | Out-File -Append -Encoding utf8 $log
