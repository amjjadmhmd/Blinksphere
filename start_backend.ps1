#!/usr/bin/env pwsh
# start_backend.ps1 — تشغيل الباك إند بأمر واحد من جذر المشروع
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $Root

Write-Host "[1/4] التحقق من تثبيت تبعيات بايثون..." -ForegroundColor Cyan
pip install --only-binary=:all: --upgrade pip numpy scipy scikit-learn astropy astroquery fastapi uvicorn python-multipart pydantic | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] التثبيت من المستودعات الثنائية فشل، 재محاولة بدون --only-binary..." -ForegroundColor Yellow
    pip install -r backend/requirements.txt | Out-Null
}

Write-Host "[2/4] تجهيز المكعب الاصطناعي (fallback)..." -ForegroundColor Cyan
python scripts/prepare_data.py | Out-Null
if ($LASTEXITCODE -ne 0) { throw "فشل تشغيل prepare_data.py" }

Write-Host "[3/4] تشغيل خادم FastAPI على http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Write-Host "افتح الواجهة في مجلد frontend באמצעות: npm run dev" -ForegroundColor Green
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
