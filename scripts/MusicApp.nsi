; MusicApp NSIS Installer Script
; 生成一个 Windows 安装程序：双击安装 → 桌面快捷方式 → 点击图标启动
; 编译: makensis MusicApp.nsi

!define APP_NAME "音乐创作软件"
!define APP_NAME_EN "MusicApp"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "MusicApp"
!define APP_URL "http://localhost:3001"
!define APP_REGKEY "Software\MusicApp"
!define APP_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\MusicApp"

; 使用现代 UI
!include "MUI2.nsh"
!include "LogicLib.nsh"

; 压缩
SetCompressor /SOLID lzma

Name "${APP_NAME}"
OutFile "MusicApp-Setup.exe"
InstallDir "$LOCALAPPDATA\MusicApp"
InstallDirRegKey HKCU "${APP_REGKEY}" "InstallDir"
ShowInstDetails show
ShowUnInstDetails show
RequestExecutionLevel user
Unicode True

; 版本信息
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_NAME} Setup"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "LegalCopyright" "C 2026 ${APP_PUBLISHER}"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"

; MUI 设置
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_TITLE "Setup Complete"
!define MUI_FINISHPAGE_TEXT "Setup finished!\n\nDouble-click the '音乐创作软件' icon on your Desktop to start."

; 安装页面
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; 卸载页面
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; 语言
!insertmacro MUI_LANGUAGE "SimpChinese"

; ==================== 安装逻辑 ====================
Section "Install" SecInstall
  SectionIn RO
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer

  ; --- 核心文件 ---
  File "staging\node.exe"
  File "staging\start-installer.mjs"
  File "staging\server.mjs"
  File "staging\launch.bat"
  File "staging\stop.bat"

  ; --- 前端构建产物 ---
  SetOutPath "$INSTDIR\dist"
  File /r "staging\dist\*.*"

  ; --- 数据库迁移 ---
  SetOutPath "$INSTDIR\server\migrations"
  File "staging\server\migrations\*.*"

  ; --- node_modules（仅 @libsql 相关） ---
  SetOutPath "$INSTDIR\node_modules"
  File /r "staging\node_modules\*.*"

  ; --- 创建数据目录 ---
  CreateDirectory "$INSTDIR\data"

  ; --- 写注册表 ---
  WriteRegStr HKCU "${APP_REGKEY}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${APP_REGKEY}" "Version" "${APP_VERSION}"

  ; --- 卸载信息 ---
  WriteRegStr HKCU "${APP_UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${APP_UNINST_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "${APP_UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${APP_UNINST_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${APP_UNINST_KEY}" "InstallLocation" "$INSTDIR"

  ; --- 桌面快捷方式（指向 launch.bat，cmd 保证编码正确） ---
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" \
    "$INSTDIR\launch.bat" \
    "" \
    "$INSTDIR\node.exe" \
    0 \
    "" \
    "" \
    "Double-click to start Music Studio"

  ; --- 开始菜单快捷方式 ---
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" \
    "$INSTDIR\launch.bat" \
    "" \
    "$INSTDIR\node.exe" \
    0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Stop.lnk" \
    "$INSTDIR\stop.bat" \
    "" \
    "$INSTDIR\node.exe" \
    0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" \
    "$INSTDIR\uninstall.exe" \
    "" \
    "$INSTDIR\uninstall.exe" \
    0

  ; --- 卸载程序 ---
  WriteUninstaller "$INSTDIR\uninstall.exe"

SectionEnd

; ==================== 卸载逻辑 ====================
Section "Uninstall"
  ; --- 停止正在运行的服务 ---
  nsExec::ExecToLog 'taskkill /F /IM node.exe /T'
  Sleep 1000

  ; --- 删除文件 ---
  Delete "$INSTDIR\node.exe"
  Delete "$INSTDIR\start-installer.mjs"
  Delete "$INSTDIR\server.mjs"
  Delete "$INSTDIR\launch.bat"
  Delete "$INSTDIR\stop.bat"
  Delete "$INSTDIR\uninstall.exe"

  ; --- 删除目录 ---
  RMDir /r "$INSTDIR\dist"
  RMDir /r "$INSTDIR\server"
  RMDir /r "$INSTDIR\node_modules"
  RMDir /r "$INSTDIR\data"
  RMDir /r "$INSTDIR\release"

  ; --- 删除快捷方式 ---
  Delete "$DESKTOP\${APP_NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APP_NAME}"

  ; --- 清理注册表 ---
  DeleteRegKey HKCU "${APP_REGKEY}"
  DeleteRegKey HKCU "${APP_UNINST_KEY}"

  ; --- 删除空安装目录 ---
  RMDir "$INSTDIR"
SectionEnd
