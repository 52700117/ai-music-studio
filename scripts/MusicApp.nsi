; MusicApp NSIS Installer - REAL DESKTOP APP Edition
; ============================================================
; Final user experience is indistinguishable from a "real" app:
;   1. Download + run Setup, click Next, Finish
;   2. Desktop has a 音乐创作软件 shortcut → double click
;   3. NO BLACK CONSOLE WINDOW, NO BROWSER
;   4. A native Win32 window appears (title bar + minimize/maximize +
;      taskbar icon) containing the music studio UI
;
; How: launcher.vbs (wscript.exe, hidden) launches node.exe silently,
; waits for server to respond, then runs mshta.exe app.hta (HTA host
; = native windowed app with IE engine, no browser chrome).
; ============================================================

!define APP_NAME "音乐创作软件"
!define APP_NAME_EN "MusicApp"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "MusicApp"
!define APP_REGKEY "Software\MusicApp"
!define APP_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\MusicApp"

!include "MUI2.nsh"
!include "LogicLib.nsh"

SetCompressor /SOLID lzma

Name "${APP_NAME}"
OutFile "MusicApp-Setup.exe"
InstallDir "$LOCALAPPDATA\MusicApp"
InstallDirRegKey HKCU "${APP_REGKEY}" "InstallDir"
ShowInstDetails show
ShowUnInstDetails show
RequestExecutionLevel user
Unicode True

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_NAME} Setup"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "LegalCopyright" "C 2026 ${APP_PUBLISHER}"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_TITLE "Setup Complete"
!define MUI_FINISHPAGE_TEXT "Setup finished!\n\nDouble-click the '音乐创作软件' icon on your Desktop to launch the app."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

; ==================== Install ====================
Section "Install" SecInstall
  SectionIn RO
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer

  ; --- Runtime core ---
  File "staging\node.exe"
  File "staging\start-installer.mjs"
  File "staging\server.mjs"

  ; --- Desktop app GUI (no browser!) ---
  File "staging\app.hta"
  File "staging\launcher.vbs"
  File "staging\stopper.vbs"

  ; --- Frontend build ---
  SetOutPath "$INSTDIR\dist"
  File /r "staging\dist\*.*"

  ; --- DB migrations ---
  SetOutPath "$INSTDIR\server\migrations"
  File "staging\server\migrations\*.*"

  ; --- Dependencies (@libsql Windows native binary) ---
  SetOutPath "$INSTDIR\node_modules"
  File /r "staging\node_modules\*.*"

  ; --- Runtime data dirs ---
  CreateDirectory "$INSTDIR\data"

  ; --- Registry: install info ---
  WriteRegStr HKCU "${APP_REGKEY}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${APP_REGKEY}" "Version" "${APP_VERSION}"

  ; --- Registry: add to "Add/Remove Programs" ---
  WriteRegStr HKCU "${APP_UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${APP_UNINST_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "${APP_UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${APP_UNINST_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${APP_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${APP_UNINST_KEY}" "DisplayIcon" "$INSTDIR\node.exe,0"

  ; --- Desktop shortcut: wscript.exe launcher.vbs (NO cmd window) ---
  ; Using wscript.exe explicitly + quoting for paths with spaces
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" \
    "$SYSDIR\wscript.exe" \
    '"$INSTDIR\launcher.vbs"' \
    "$INSTDIR\node.exe" \
    0 \
    "" \
    "" \
    "Double-click to open Music Studio"

  ; --- Start Menu folder ---
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" \
    "$SYSDIR\wscript.exe" \
    '"$INSTDIR\launcher.vbs"' \
    "$INSTDIR\node.exe" \
    0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Stop.lnk" \
    "$SYSDIR\wscript.exe" \
    '"$INSTDIR\stopper.vbs"' \
    "$INSTDIR\node.exe" \
    0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" \
    "$INSTDIR\uninstall.exe" \
    "" \
    "$INSTDIR\uninstall.exe" \
    0

  ; --- Uninstaller binary ---
  WriteUninstaller "$INSTDIR\uninstall.exe"

SectionEnd

; ==================== Uninstall ====================
Section "Uninstall"
  ; --- Stop the app first ---
  nsExec::ExecToLog '"$SYSDIR\wscript.exe" "$INSTDIR\stopper.vbs"'
  Sleep 1500
  ; Extra safety: kill any remaining node.exe from our dir
  nsExec::ExecToLog 'taskkill /F /IM node.exe /T'
  Sleep 500

  ; --- Core files ---
  Delete "$INSTDIR\node.exe"
  Delete "$INSTDIR\start-installer.mjs"
  Delete "$INSTDIR\server.mjs"
  Delete "$INSTDIR\app.hta"
  Delete "$INSTDIR\launcher.vbs"
  Delete "$INSTDIR\stopper.vbs"
  Delete "$INSTDIR\uninstall.exe"
  Delete "$INSTDIR\port.txt"

  ; --- Directories ---
  RMDir /r "$INSTDIR\dist"
  RMDir /r "$INSTDIR\server"
  RMDir /r "$INSTDIR\node_modules"
  RMDir /r "$INSTDIR\data"
  RMDir /r "$INSTDIR\release"

  ; --- Shortcuts ---
  Delete "$DESKTOP\${APP_NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APP_NAME}"

  ; --- Registry ---
  DeleteRegKey HKCU "${APP_REGKEY}"
  DeleteRegKey HKCU "${APP_UNINST_KEY}"

  RMDir "$INSTDIR"
SectionEnd
