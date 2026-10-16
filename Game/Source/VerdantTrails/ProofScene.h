#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/HUD.h"
#include "ProofScene.generated.h"

// Separate art-review mode: never loads or changes the town errand/player saves.
UCLASS()
class VERDANTTRAILS_API AVerdantProofGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    AVerdantProofGameMode();
};

UCLASS()
class VERDANTTRAILS_API AVerdantProofDirector : public AActor
{
    GENERATED_BODY()
public:
    AVerdantProofDirector();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    bool bReducedMotion = false;
    bool bExpandedParty = false;
    bool bDiagnostics = true;
private:
    float Elapsed = 0.f;
    bool bCapture = false;
    bool bRequested = false;
    FString EvidenceDir;
    FString CapturePath;
    FString CaptureRelativePath;
    void SetMotion();
    void WriteCaptureEvidence();
};

UCLASS()
class VERDANTTRAILS_API AVerdantProofHUD : public AHUD
{
    GENERATED_BODY()
public:
    virtual void DrawHUD() override;
private:
    float Scale = 1.f;
    void Disc(float X, float Y, float Radius, FLinearColor Color);
    void Label(const FString& Text, float X, float Y, float Size, FLinearColor Color);
    void Rounded(float X, float Y, float W, float H, float Radius, FLinearColor Color);
};
