Write-Host "===== Starte Undo-Skript =====" -ForegroundColor Cyan


### 1. Firewall-Regel: Allow UDP 5353

$ruleName = "Allow UDP 5353"
$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($rule) {
    Write-Host "Entferne Regel '$ruleName'..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName $ruleName
    Write-Host "Regel entfernt." -ForegroundColor Green
} else {
    Write-Host "Regel '$ruleName' nicht gefunden." -ForegroundColor DarkYellow
}


### 2. Firewall-Regel: Allow UDP 5540

$ruleName = "Allow UDP 5540"
$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($rule) {
    Write-Host "Entferne Regel '$ruleName'..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName $ruleName
    Write-Host "Regel entfernt." -ForegroundColor Green
} else {
    Write-Host "Regel '$ruleName' nicht gefunden." -ForegroundColor DarkYellow
}


### 3. Firewall-Regel: Allow Multicast DNS (UDP 5353)

$mdnsRuleName = "Allow Multicast DNS (UDP 5353)"
$mdnsRule = Get-NetFirewallRule -DisplayName $mdnsRuleName -ErrorAction SilentlyContinue

if ($mdnsRule) {
    Write-Host "Entferne Regel '$mdnsRuleName'..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName $mdnsRuleName
    Write-Host "mDNS-Regel entfernt." -ForegroundColor Green
} else {
    Write-Host "mDNS-Regel '$mdnsRuleName' nicht gefunden." -ForegroundColor DarkYellow
}


### 4. SSID wieder auf Public setzen

$SSID = "Wollatz 3"
$profile = Get-NetConnectionProfile | Where-Object { $_.Name -eq $SSID }

if ($null -eq $profile) {
    Write-Host "SSID '$SSID' nicht gefunden. Keine Änderung möglich." -ForegroundColor Red
} else {
    Write-Host "Setze SSID '$SSID' wieder auf Public..." -ForegroundColor Yellow
    Set-NetConnectionProfile -InterfaceIndex $profile.InterfaceIndex -NetworkCategory Public
    Write-Host "SSID wurde auf Public gesetzt." -ForegroundColor Green
}


Write-Host "`n===== Undo abgeschlossen =====" -ForegroundColor Cyan
