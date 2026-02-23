param(
  [string]$BaseUrl = "http://localhost:3000",
  [Parameter(Mandatory = $true)]
  [string]$AccessToken,
  [string]$OrgName = "Smoke Test Org"
)

$ErrorActionPreference = "Stop"

function Step([string]$Message) {
  Write-Host "==> $Message"
}

Step "Health check"
$health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/health"
if (-not $health.ok) {
  throw "Health check failed."
}

$authHeaders = @{
  Authorization = "Bearer $AccessToken"
}

Step "Create organization"
$orgBody = @{ name = "$OrgName $(Get-Date -Format 'yyyyMMdd-HHmmss')" } | ConvertTo-Json -Compress
$orgResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/organizations" -Headers $authHeaders -ContentType "application/json" -Body $orgBody
$orgId = $orgResponse.data.id
if (-not $orgId) {
  throw "Organization id not returned."
}

$orgHeaders = @{
  Authorization = "Bearer $AccessToken"
  "x-org-id" = $orgId
}

Step "Create location"
$locationResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/locations" -Headers $orgHeaders -ContentType "application/json" -Body '{"name":"Main Warehouse","code":"MAIN"}'
$locationId = $locationResponse.data.id
if (-not $locationId) {
  throw "Location id not returned."
}

Step "Create material"
$materialResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/materials" -Headers $orgHeaders -ContentType "application/json" -Body '{"sku":"MAT-001","name":"Cement","uom":"bag","min_stock":10}'
$materialId = $materialResponse.data.id
if (-not $materialId) {
  throw "Material id not returned."
}

Step "Create supplier"
$supplierResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/suppliers" -Headers $orgHeaders -ContentType "application/json" -Body '{"name":"Acme Supply","lead_time_days":5}'
$supplierId = $supplierResponse.data.id
if (-not $supplierId) {
  throw "Supplier id not returned."
}

Step "Create stock movement"
$movementBody = @{
  material_id = $materialId
  location_id = $locationId
  quantity_delta = 25
  reason = "adjustment"
} | ConvertTo-Json -Compress
$movementResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/stock/movements" -Headers $orgHeaders -ContentType "application/json" -Body $movementBody
$movementId = $movementResponse.data.movement_id
if (-not $movementId) {
  throw "Stock movement id not returned."
}

Step "Create purchase order"
$poBody = @{
  supplier_id = $supplierId
  lines = @(
    @{
      material_id = $materialId
      quantity_ordered = 5
      unit_price = 10
    }
  )
} | ConvertTo-Json -Depth 5 -Compress
$poResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/purchase-orders" -Headers $orgHeaders -ContentType "application/json" -Body $poBody
$poId = $poResponse.data.id
$poLineId = $poResponse.data.lines[0].id
if (-not $poId -or -not $poLineId) {
  throw "Purchase order or line id not returned."
}

Step "Receive purchase order"
$receiveBody = @{
  receipts = @(
    @{
      po_line_id = $poLineId
      location_id = $locationId
      quantity_received = 2
    }
  )
} | ConvertTo-Json -Depth 5 -Compress
Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/purchase-orders/$poId/receive" -Headers $orgHeaders -ContentType "application/json" -Body $receiveBody | Out-Null

Step "Check reports"
$lowStock = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/alerts/low-stock" -Headers $orgHeaders
$stockHealth = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/reports/stock-health" -Headers $orgHeaders

Step "Smoke test passed"
[pscustomobject]@{
  org_id = $orgId
  location_id = $locationId
  material_id = $materialId
  supplier_id = $supplierId
  stock_movement_id = $movementId
  purchase_order_id = $poId
  low_stock_count = $lowStock.data.Count
  stock_health = $stockHealth.data
} | ConvertTo-Json -Depth 5
