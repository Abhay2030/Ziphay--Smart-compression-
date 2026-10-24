; ==============================================================================
; Ziphay AI — NSIS Custom Lifecycle Script
; Publisher: Abhay Sachin Donde
; Cleans up all Windows File Explorer context-menu registry entries on uninstall
; ==============================================================================

!macro customUnInstall
  DetailPrint "Removing Ziphay AI Windows File Explorer context-menu entries..."
  
  ; Remove cascading context menu keys from HKCU
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\image\shell\ZiphayAI"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\video\shell\ZiphayAI"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\ZiphayAI"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.webp\shell\ZiphayAI"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.heic\shell\ZiphayAI"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.avif\shell\ZiphayAI"
  DeleteRegKey HKCU "Software\Classes\*\shell\ZiphayAI"

  DetailPrint "Windows File Explorer integration removed cleanly."
!macroend
