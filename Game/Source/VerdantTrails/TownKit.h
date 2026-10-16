#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TownKit.generated.h"

class UInstancedStaticMeshComponent;
class UMaterialInterface;

// Every model is instanced by mesh/material/collision. These assembly functions
// are the reusable kit: centimetres, Z up, deterministic seed, no editor dependencies.
UCLASS()
class VERDANTTRAILS_API ATownKit : public AActor
{
    GENERATED_BODY()
public:
    ATownKit();
    virtual void BeginPlay() override;
    virtual void OnConstruction(const FTransform& Transform) override;
    void SetHerbVisible(bool bVisible);

private:
    UPROPERTY() TMap<FString, TObjectPtr<UInstancedStaticMeshComponent>> Pools;
    UPROPERTY() TObjectPtr<UStaticMeshComponent> HerbMarker;
    FRandomStream Random;
    void Piece(const FString& Mesh, const FString& Material, FVector P, FVector Scale,
               FRotator Rotation = FRotator::ZeroRotator, bool bCollision = false);
    void Box(const FString& Material, FVector P, FVector Size,
             FRotator Rotation = FRotator::ZeroRotator, bool bCollision = false);
    void Tree(FVector P, float Scale, int32 Variant);
    void Flower(FVector P, float Scale, int32 Palette);
    void Fence(FVector A, FVector B);
    void Lamp(FVector P);
    void Cottage(FVector P);
    void Bench(FVector P);
    void BuildTown();
};
