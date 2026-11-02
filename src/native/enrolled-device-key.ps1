# Read public keys and sign validated official challenges using existing user-authorized CNG enrollment.
# Never creates, exports private keys, deletes keys or alters enrollment.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$key = $null
$ecdsa = $null
try {
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $id = [string]$request.keyId
    if ($id -cnotmatch '^dk_osn_[A-Za-z0-9_-]{43}$') { throw 'Invalid Pebble key identifier' }
    $name = 'OpenAI Codex device key ' + $id
    $provider = [System.Security.Cryptography.CngProvider]::MicrosoftSoftwareKeyStorageProvider
    if ($request.action -notin @('public', 'sign')) { throw 'Unsupported action' }
    $key = [System.Security.Cryptography.CngKey]::Open($name, $provider)
    if ($key.ExportPolicy -ne [System.Security.Cryptography.CngExportPolicies]::None) { throw 'Unexpected export policy' }
    if ($request.action -eq 'sign') {
        $payload = [Convert]::FromBase64String([string]$request.payloadBase64)
        if ($payload.Length -lt 1 -or $payload.Length -gt 16384) { throw 'Invalid payload size' }
        $document = [System.Text.Encoding]::UTF8.GetString($payload) | ConvertFrom-Json
        if ($document.domain -cne 'codex-device-key-sign-payload/v1') { throw 'Invalid signing domain' }
        $p = $document.payload
        if ($p.targetOrigin -cne 'https://chatgpt.com') { throw 'Invalid challenge origin' }
        if ($p.type -ceq 'remoteControlClientEnrollment') {
            if ($p.targetPath -cne '/backend-api/codex/remote/control/client/refresh/finish' -or $p.audience -cne 'remote_control_client_enrollment') { throw 'Invalid refresh challenge' }
        } elseif ($p.type -ceq 'remoteControlClientConnection') {
            if ($p.targetPath -cne '/backend-api/codex/remote/control/client' -or $p.audience -cne 'remote_control_client_websocket') { throw 'Invalid socket challenge' }
        } else { throw 'Unsupported signing type' }
        $ecdsa = New-Object System.Security.Cryptography.ECDsaCng($key)
        $signature = $ecdsa.SignData($payload, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
        $result = @{ signatureP1363Base64 = [Convert]::ToBase64String($signature) }
    } else {
        $public = $key.Export([System.Security.Cryptography.CngKeyBlobFormat]::EccPublicBlob)
        $result = @{ keyId = $id; publicBlobBase64 = [Convert]::ToBase64String($public); algorithm = 'ecdsa_p256_sha256'; protectionClass = 'os_protected_nonextractable'; exportPolicy = [int]$key.ExportPolicy }
    }
    $result | ConvertTo-Json -Compress
} catch {
    # Do not print input, payloads or detailed crypto error internals.
    [Console]::Error.WriteLine('Pebble CNG operation failed')
    exit 1
} finally {
    if ($null -ne $ecdsa) { $ecdsa.Dispose() }
    if ($null -ne $key) { $key.Dispose() }
}
