; NexusAkari Pro (v4.0.0) — NSIS Windows x64 Desktop Installer Script
; Compiles on GitHub Actions `windows-latest` via `makensis src-tauri/installer.nsi`

Unicode True
!include "MUI2.nsh"

Name "NexusAkari Pro v4.0.0"
OutFile "..\release-bundles\NexusAkari-Pro-v4.0.0-Windows-x64-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\NexusAkariPro"
RequestExecutionLevel user
SetCompressor /SOLID lzma

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\nexus-akari-pro.exe"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动 NexusAkari Pro (英雄联盟三通道战术工作台)"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Section "NexusAkari Pro Core & Runtime" SecMain
  SetOutPath "$INSTDIR"
  File /r "..\release-stage\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateDirectory "$SMPROGRAMS\NexusAkari Pro"
  CreateShortCut "$SMPROGRAMS\NexusAkari Pro\NexusAkari Pro.lnk" "$INSTDIR\nexus-akari-pro.exe"
  CreateShortCut "$SMPROGRAMS\NexusAkari Pro\卸载 NexusAkari Pro.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortCut "$DESKTOP\NexusAkari Pro.lnk" "$INSTDIR\nexus-akari-pro.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\NexusAkari Pro.lnk"
  Delete "$SMPROGRAMS\NexusAkari Pro\NexusAkari Pro.lnk"
  Delete "$SMPROGRAMS\NexusAkari Pro\卸载 NexusAkari Pro.lnk"
  RMDir "$SMPROGRAMS\NexusAkari Pro"
  RMDir /r "$INSTDIR"
SectionEnd
