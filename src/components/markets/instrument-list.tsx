<?xml version="1.0" encoding="utf-8"?>
<PowerShellMetadata xmlns="http://schemas.microsoft.com/cmdlets-over-objects/2009/11">
    <Class ClassName="ROOT/Microsoft/Windows/SMB/MSFT_SmbServerConfiguration">
        <Version>1.0</Version>
        
        <DefaultNoun>SmbServerConfiguration</DefaultNoun>
        <StaticCmdlets>
            <!--

            //
            // Get-SmbServer
            //

            -->
            <Cmdlet>
                <CmdletMetadata Verb="Get" ConfirmImpact="Medium" HelpUri="http://go.microsoft.com/fwlink/?LinkID=241950" Aliases="gsmbsc"/>
                <Method MethodName="GetConfiguration">
                    <ReturnValue>
                        <Type PSType="uint32" />
                        <CmdletOutputMetadata>
                            <ErrorCode />
                        </CmdletOutputMetadata>
                    </ReturnValue>
                    <Parameters>
                        <Parameter ParameterName="Output">
                            <Type PSType="Microsoft.Management.Infrastructure.CimInstance" />
                            <CmdletOutputMetadata />
                        </Parameter>
                    </Parameters>
                </Method>
            </Cmdlet>


            <!--

            //
            // Reset-SmbServer
            //

            -->
            <Cmdlet>
                <CmdletMetadata Verb="Reset" ConfirmImpact="High" HelpUri="" Aliases="rsmbsc"/>
                <Method MethodName="ResetConfiguration">
                    <ReturnValue>
                        <Type PSType="uint32" />
                        <CmdletOutputMetadata>
                            <ErrorCode />
                        </CmdletOutputMetadata>
                    </ReturnValue>
                    <Parameters>
                        <Parameter ParameterName="Output">
                            <Type PSType="Microsoft.Management.Infrastructure.CimInstance" />
                            <CmdletOutputMetadata />
                        </Parameter>
                        <Parameter ParameterName="All">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="AnnounceComment">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="AnnounceServer">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="AsynchronousCredits">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="AuditClientCertificateAccess">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="AuditClientDoesNotSupportEncryption">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="AuditClientDoesNotSupportSigning">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="AuditInsecureGuestLogon">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="AuditSmb1Access">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>

                        <Parameter ParameterName="AutoShareServer">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="AutoShareWorkstation">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="CachedOpenLimit">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="DisableCompression">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="DisableSmbEncryptionOnSecureConnection">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="DurableHandleV2TimeoutInSeconds">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="EnableDirectoryHandleLeasing">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="EnableDownlevelTimewarp">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="EnableLeasing">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="EnableMailslots">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="EnableMultiChannel">
                            <Type PSType="System.Management.Automation.SwitchParameter" />
                            <CmdletParameterMetadata>
                            </CmdletParameterMetadata>
                        </Parameter>
                        <Parameter ParameterName="EnableOplocks">