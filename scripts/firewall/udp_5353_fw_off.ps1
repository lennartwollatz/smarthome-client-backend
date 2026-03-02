### 1. UDP 5353 Regel (mDNS)

$ruleName = "Allow UDP 5353"
$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if (-not $rule) {
    Write-Host "Erstelle Firewall-Regel '$ruleName'..." -ForegroundColor Cyan

    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol UDP `
        -LocalPort 5353 `
        -Profile Private

    Write-Host "Regel wurde erstellt." -ForegroundColor Green
} else {
    Write-Host "Regel '$ruleName' existiert bereits. Stelle sicher, dass sie aktiviert ist." -ForegroundColor Yellow
    Enable-NetFirewallRule -DisplayName $ruleName
}

### 2. UDP 5540 Regel

$ruleName = "Allow UDP 5540"
$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if (-not $rule) {
    Write-Host "Erstelle Firewall-Regel '$ruleName'..." -ForegroundColor Cyan

    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol UDP `
        -LocalPort 5540 `
        -Profile Private

    Write-Host "Regel wurde erstellt." -ForegroundColor Green
} else {
    Write-Host "Regel '$ruleName' existiert bereits. Stelle sicher, dass sie aktiviert ist." -ForegroundColor Yellow
    Enable-NetFirewallRule -DisplayName $ruleName
}


### 3. SSID auf Privat setzen

$SSID = "Wollatz 3"
$profile = Get-NetConnectionProfile | Where-Object { $_.Name -eq $SSID }

if ($null -eq $profile) {
    Write-Host "SSID '$SSID' nicht gefunden." -ForegroundColor Red
}

Set-NetConnectionProfile -InterfaceIndex $profile.InterfaceIndex -NetworkCategory Private
Write-Host "SSID '$SSID' wurde als Privat eingestuft." -ForegroundColor Green


### 4. mDNS Multicast-Regel (separate, sauber)

$mdnsRule = Get-NetFirewallRule -DisplayName "Allow Multicast DNS (UDP 5353)" -ErrorAction SilentlyContinue

if (-not $mdnsRule) {
    New-NetFirewallRule `
        -DisplayName "Allow Multicast DNS (UDP 5353)" `
        -Direction Inbound `
        -Action Allow `
        -Protocol UDP `
        -LocalPort 5353 `
        -RemoteAddress 224.0.0.251 `
        -Profile Private

    Write-Host "mDNS-Regel erstellt." -ForegroundColor Green
} else {
    Enable-NetFirewallRule -DisplayName "Allow Multicast DNS (UDP 5353)"
    Write-Host "mDNS-Regel bereits vorhanden und aktiviert." -ForegroundColor Yellow
}
Read-Host "Weiter mit Enter..."