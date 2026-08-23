' =====================================================================
' Music Studio - Stopper (VBS)
' Silently kills any node.exe subtrees that are running from the
' install directory (so it won't accidentally kill unrelated Node apps).
' =====================================================================
Option Explicit

Dim fso, sh, installDir, nodeExe
Dim wmi, procs, proc, cmdLine

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

installDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = LCase(fso.BuildPath(installDir, "node.exe"))

On Error Resume Next
Set wmi = GetObject("winmgmts://./root/cimv2")
If Err.Number <> 0 Then
  ' Fallback: brute force (acceptable for stop script)
  sh.Run "taskkill /F /IM node.exe /T", 0, True
  WScript.Quit
End If
On Error GoTo 0

Set procs = wmi.ExecQuery("SELECT ProcessId, ExecutablePath, CommandLine FROM Win32_Process WHERE Name='node.exe'")
For Each proc In procs
  cmdLine = LCase("" & proc.CommandLine)
  ' Only kill node.exe launched from our install dir (matches start-installer.mjs)
  If InStr(cmdLine, LCase(installDir)) > 0 And _
     InStr(cmdLine, "start-installer.mjs") > 0 Then
    On Error Resume Next
    sh.Run "taskkill /F /PID " & proc.ProcessId & " /T", 0, True
    On Error GoTo 0
  End If
Next
