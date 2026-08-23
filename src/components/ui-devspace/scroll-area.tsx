<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v3" manifestVersion="1.0" copyright="Copyright (c) Microsoft Corporation. All Rights Reserved.">
  <assemblyIdentity name="Microsoft-Windows-WinPE-LanguagePack-Package" version="10.0.26100.5600" processorArchitecture="amd64" language="ro-RO" buildType="release" publicKeyToken="31bf3856ad364e35" />
  <package identifier="WinPE Language Pack" releaseType="Language Pack">
    <parent buildCompare="EQ" disposition="detect" distributionCompare="EQ" integrate="separate" revisionCompare="EQ" serviceCompare="EQ">
      <assemblyIdentity name="Microsoft-Windows-WinPE-Package" version="10.0.26100.5600" processorArchitecture="amd64" language="neutral" buildType="release" publicKeyToken="31bf3856ad364e35" />
    </parent>
    <update description="ro-RO language pack for Windows" displayName="WinPE Language Pack" name="WinPE Language Pack">
      <package contained="true" integrate="hidden">
        <assemblyIdentity name="Microsoft-Windows-WinPEFoundation-LanguagePack-Package" version="10.0.26100.1" processorArchitecture="amd64" language="ro-RO" buildType="release" publicKeyToken="31bf3856ad364e35" versionScope="nonSxS" />
      </package>
    </update>
    <update description="Resource SDP package for WinPE Drivers for ro-RO" displayName="Resource SDP package for WinPE Drivers" name="WinpeDrivers-ResourcePackage_update">
      <package contained="true" integrate="hidden">
        <assemblyIdentity name="Microsoft-Windows-Winpe-Drivers-Package" version="10.0.26100.5562" processorArchitecture="amd64" language="ro-RO