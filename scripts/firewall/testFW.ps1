Write-Host "===== Diagnose für SSID 'Wollatz' und UDP 5353 =====" -ForegroundColor Cyan

# 1. Netzwerkprofil prüfen
$profile = Get-NetConnectionProfile | Where-Object { $_.Name -eq "Wollatz 3" }

if ($profile) {
    Write-Host "`n[+] Netzwerkprofil gefunden:" -ForegroundColor Green
    Write-Host "SSID: $($profile.Name)"
    Write-Host "Kategorie: $($profile.NetworkCategory)"
} else {
    Write-Host "`n[-] SSID 'Wollatz' nicht gefunden." -ForegroundColor Red
}


# 2. Firewallregeln für Port 5353 (NICHT blockierend)
Write-Host "`n===== Firewallregeln für Port 5353 ====="

$rules5353 = Get-NetFirewallRule |
    Get-NetFirewallPortFilter |
    Where-Object { $_.LocalPort -eq 5353 -and $_.Protocol -eq "UDP" } |
    Select-Object -ExpandProperty AssociatedNetFirewallRuleName |
    ForEach-Object { Get-NetFirewallRule -Name $_ }


if ($rules5353) {
    Write-Host "[+] Es wurden Regeln für Port 5353 gefunden:" -ForegroundColor Green
    $rules5353 | Select-Object DisplayName, Enabled, Direction, Profile | Format-Table -AutoSize
} else {
    Write-Host "[-] Keine Regeln für Port 5353 gefunden." -ForegroundColor Red
}


# 3. Prüfen, ob deine eigene Regel existiert
Write-Host "`n===== Eigene Regel ====="

$myRule = Get-NetFirewallRule -DisplayName "Allow Multicast DNS (UDP 5353)" -ErrorAction SilentlyContinue

if ($myRule) {
    Write-Host "[+] Eigene Regel ist vorhanden." -ForegroundColor Green
} else {
    Write-Host "[-] Eigene Regel nicht gefunden." -ForegroundColor Yellow
}


# 4. Zusammenfassung
Write-Host "`n===== Zusammenfassung =====" -ForegroundColor Cyan

if ($profile) {
    Write-Host "Netzwerkprofil: $($profile.NetworkCategory)"
} else {
    Write-Host "Netzwerkprofil: nicht gefunden"
}

if ($rules5353) {
    Write-Host "Port 5353: Regeln vorhanden"
} else {
    Write-Host "Port 5353: keine Regeln"
}

if ($myRule) {
    Write-Host "Eigene Regel: vorhanden"
} else {
    Write-Host "Eigene Regel: nicht vorhanden"
}

Write-Host "`nDiagnose beendet.`n" -ForegroundColor Cyan
