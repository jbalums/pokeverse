using UnrealBuildTool;
using System.Collections.Generic;

public class VerdantTrailsEditorTarget : TargetRules
{
    public VerdantTrailsEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("VerdantTrails");
    }
}
