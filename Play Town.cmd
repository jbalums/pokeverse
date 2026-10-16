@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Play-Town.ps1"
if errorlevel 1 pause
