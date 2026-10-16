using UnrealBuildTool;

public class VerdantTrails : ModuleRules
{
    public VerdantTrails(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new [] {
            "Core", "CoreUObject", "Engine", "InputCore", "UMG", "Slate", "SlateCore", "RenderCore"
        });
    }
}
