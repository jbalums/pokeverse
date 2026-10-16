using UnrealBuildTool;
using System.Collections.Generic;

public class VerdantTrailsTarget : TargetRules
{
    public VerdantTrailsTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("VerdantTrails");
    }
}
