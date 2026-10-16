#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/HUD.h"
#include "TownRules.h"
#include "VerdantGame.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UStaticMeshComponent;
class UMaterialParameterCollection;

UCLASS()
class VERDANTTRAILS_API AVerdantCharacter : public ACharacter
{
    GENERATED_BODY()
public:
    AVerdantCharacter();
    virtual void Tick(float DeltaSeconds) override;
    virtual void BeginPlay() override;
    virtual void SetupPlayerInputComponent(UInputComponent* Input) override;
    TownRules::EQuest Quest = TownRules::EQuest::MeetGardener;
    FString Dialogue;
    bool bMenuOpen = false;
    bool bReducedMotion = false;
    bool bSaveFailed = false;
    bool bHasSave = false;
    bool bLoadFailed = false;
    TownRules::EFocus Focus() const;
    FString Objective() const;
    void SaveProgress();
    bool IsDialogueOpen() const { return !Dialogue.IsEmpty(); }
    void Interact();

private:
    UPROPERTY() TObjectPtr<USpringArmComponent> Boom;
    UPROPERTY() TObjectPtr<UCameraComponent> Camera;
    UPROPERTY() TObjectPtr<USceneComponent> Figure;
    UPROPERTY() TObjectPtr<USceneComponent> Companion;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> LeftLeg;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> RightLeg;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> LeftArm;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> RightArm;
    UPROPERTY() TObjectPtr<UMaterialParameterCollection> MotionCollection;
    float WalkPhase = 0.f;
    float TargetZoom = 2350.f;
    FVector LastSafePosition;
    FVector CompanionPosition;
    TArray<FVector> Trail;
    bool bSprinting = false;
    int32 SaveRevision = 0;
    UStaticMeshComponent* BodyPart(USceneComponent* Parent, const FString& Name,
        const FString& MeshPath, const FString& Material, FVector P, FVector Scale);
    void Forward(float Value);
    void Right(float Value);
    void SprintOn();
    void SprintOff();
    void Menu();
    void ZoomIn();
    void ZoomOut();
    void ResetPosition();
    void ToggleMotion();
    void RestoreProgress();
};

UCLASS()
class VERDANTTRAILS_API AVerdantGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    AVerdantGameMode();
    virtual void StartPlay() override;
    virtual void Tick(float DeltaSeconds) override;
private:
    int32 SmokeStep = 0;
    float SmokeTime = 0.f;
    float SmokeStepTime = 0.f;
    bool bSmoke = false;
    bool bCapture = false;
};

UCLASS()
class VERDANTTRAILS_API AVerdantHUD : public AHUD
{
    GENERATED_BODY()
public:
    virtual void DrawHUD() override;
private:
    float UIScale = 1.f;
    void Panel(float X, float Y, float W, float H, FLinearColor Color, float Radius=18);
    void Disc(float X, float Y, float Radius, FLinearColor Color);
    void Label(const FString& Text, float X, float Y, float Size, FLinearColor Color);
};
