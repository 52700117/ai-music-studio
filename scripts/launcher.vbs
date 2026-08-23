' =====================================================================
' Music Studio - Silent Launcher (VBS)
' =====================================================================
' 1. Runs node.exe start-installer.mjs IN THE BACKGROUND (no black cmd
'    window appears at all) via WshShell.Run intWindowStyle=0.
' 2. Waits for port.txt to appear in install dir (max 30 seconds).
' 3. Probes http://127.0.0.1:<port>/api/health to confirm server is up.
' 4. Opens app.hta via mshta.exe (= Native Win32 app window, no browser).
'
' Everything in this script uses only built-in Windows components:
'   wscript.exe, mshta.exe, WScript.Shell, Scripting.FileSystemObject,
'   WinHttp.WinHttpRequest.
' No extra download required. Works on Win 7 / 8 / 10 / 11 x64.
' =====================================================================
Option Explicit

Dim fso, sh, shellApp
Dim installDir, nodeExe, entryScript, portFile, htaPath
Dim port, i, ok
Dim startT, maxSeconds

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

' ----- Resolve paths (script is in same dir as node.exe/app.hta) -----
installDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe    = fso.BuildPath(installDir, "node.exe")
entryScript= fso.BuildPath(installDir, "start-installer.mjs")
portFile   = fso.BuildPath(installDir, "port.txt")
htaPath    = fso.BuildPath(installDir, "app.hta")

' ----- Clean stale port.txt so we don't pick up a dead port -----
On Error Resume Next
If fso.FileExists(portFile) Then fso.DeleteFile portFile, True
On Error GoTo 0

' ----- Kill any old orphan node.exe from our dir first (soft) -----
On Error Resume Next

' ----- Start node.exe SILENTLY (windowStyle=0 = hidden, no wait) -----
' Second arg: 0 = hide window completely. Third arg: False = don't wait.
sh.Run """" & nodeExe & """ """ & entryScript & """", 0, False

' ----- Wait for port.txt to be written (max 30s) -----
maxSeconds = 30
startT = Timer()
port = 0
Do While Timer() - startT < maxSeconds
  If fso.FileExists(portFile) Then
    On Error Resume Next
    Dim txt
    txt = Trim(fso.OpenTextFile(portFile, 1).ReadAll())
    If IsNumeric(txt) Then
      port = CInt(txt)
      If port > 0 And port < 65536 Then Exit Do
    End If
    On Error GoTo 0
  End If
  WScript.Sleep 300
Loop

If port = 0 Then
  ' Fallback — try default port anyway
  port = 3001
End If

' ----- Probe /api/health until server responds (max 20s more) -----
startT = Timer()
ok = False
Dim http
Do While Timer() - startT < 20
  On Error Resume Next
  Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
  If Err.Number = 0 Then
    http.Open "GET", "http://127.0.0.1:" & port & "/api/health", False
    http.SetTimeouts 800, 800, 1500, 1500
    http.Send
    If Err.Number = 0 Then
      If http.Status = 200 Then
        ok = True
        Exit Do
      End If
    End If
    Err.Clear
  Else
    Err.Clear
  End If
  Set http = Nothing
  On Error GoTo 0
  WScript.Sleep 500
Loop

' ----- Open the native app window (mshta = HTA host, no cmd window) -----
sh.Run "mshta.exe """ & htaPath & """", 1, False
