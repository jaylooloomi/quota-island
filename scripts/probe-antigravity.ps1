# Read-only discovery and quota probe. Never print process command lines,
# authentication material, user identities or full provider responses.
$servers = @(Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'language_server.exe' -and $_.ExecutablePath -like '*\Programs\Antigravity\*'
})
$results = @()
foreach ($server in $servers) {
  $csrfMatch = [regex]::Match($server.CommandLine, '--csrf_token(?:=|\s+)("[^"]+"|\S+)')
  if (-not $csrfMatch.Success) { continue }
  $csrf = $csrfMatch.Groups[1].Value.Trim('"')
  $ports = @(Get-NetTCPConnection -State Listen -OwningProcess $server.ProcessId -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort -Unique)
  foreach ($port in $ports) {
    foreach ($method in @('RetrieveUserQuotaSummary', 'GetUserStatus')) {
      $uri = "https://127.0.0.1:$port/exa.language_server_pb.LanguageServerService/$method"
      try {
        $response = Invoke-WebRequest -Uri $uri -Method Post -ContentType 'application/json' -Headers @{
          'Connect-Protocol-Version'='1'; 'x-codeium-csrf-token'=$csrf
        } -Body '{"metadata":{"ideName":"antigravity","extensionName":"antigravity","ideVersion":"unknown","locale":"en"}}' -SkipCertificateCheck -MaximumRedirection 0 -TimeoutSec 6 -ErrorAction Stop
        $data = $response.Content | ConvertFrom-Json
        $models = @($data.userStatus.cascadeModelConfigData.clientModelConfigs | Where-Object { $null -ne $_.quotaInfo.remainingFraction } | ForEach-Object {
          [PSCustomObject]@{ Model=$_.label; RemainingPercent=[math]::Round($_.quotaInfo.remainingFraction * 100,2); ResetsAt=$_.quotaInfo.resetTime }
        })
        $summary = if ($null -ne $data.response) { $data.response } else { $data }
        if ($summary -is [string]) { $summary = $summary | ConvertFrom-Json }
        $groups = @($summary.groups | Where-Object { $null -ne $_ } | ForEach-Object {
          $group = $_
          $_.buckets | ForEach-Object {
            [PSCustomObject]@{ Group=$group.displayName; Bucket=$_.displayName; RemainingPercent=if ($null -ne $_.remaining.remainingFraction) { [math]::Round($_.remaining.remainingFraction*100,2) } else { $null }; Description=$_.description }
          }
        })
        $examples = @($summary.groups | ForEach-Object { $_.buckets | ForEach-Object { $_ | Select-Object bucketId,displayName,remaining,window,resetTime } })
        $results += [PSCustomObject]@{ Method=$method; Port=$port; Status=[int]$response.StatusCode; Fields=@($data.PSObject.Properties.Name); SummaryFields=@($summary.PSObject.Properties.Name); Models=$models; QuotaGroups=$groups; BucketExamples=$examples }
      } catch {
        $status = if ($null -ne $_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'transport_unavailable' }
        $results += [PSCustomObject]@{ Method=$method; Port=$port; Status=$status }
      }
    }
  }
}
$results | ConvertTo-Json -Depth 7
