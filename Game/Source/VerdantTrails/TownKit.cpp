#include "TownKit.h"
#include "TownRules.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/PostProcessComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/TextureCube.h"
#include "Materials/MaterialInterface.h"

ATownKit::ATownKit()
{
    PrimaryActorTick.bCanEverTick = false;
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("TownOrigin"));
    auto* Sun = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("LateAfternoonSun"));
    Sun->SetupAttachment(RootComponent);
    Sun->SetMobility(EComponentMobility::Movable);
    Sun->SetRelativeRotation(FRotator(-48, -28, 0));
    Sun->SetIntensity(4.5f);
    Sun->SetLightColor(FLinearColor(1.f, .94f, .82f));
    Sun->DynamicShadowDistanceMovableLight = 11000;
    Sun->LightSourceAngle = 3.5f;
    auto* Sky = CreateDefaultSubobject<USkyLightComponent>(TEXT("SoftSky"));
    Sky->SetupAttachment(RootComponent);
    Sky->SetMobility(EComponentMobility::Movable);
    Sky->SetIntensity(1.3f);
    Sky->SourceType = ESkyLightSourceType::SLS_SpecifiedCubemap;
    Sky->Cubemap = LoadObject<UTextureCube>(nullptr,TEXT("/Engine/MapTemplates/Sky/DaylightAmbientCubemap.DaylightAmbientCubemap"));
    Sky->SetLightColor(FLinearColor(.68f, .81f, 1.f));
    Sky->bLowerHemisphereIsBlack = false;
    auto* Fog = CreateDefaultSubobject<UExponentialHeightFogComponent>(TEXT("DistantHaze"));
    Fog->SetupAttachment(RootComponent);
    Fog->SetFogDensity(.0008f);
    Fog->SetFogInscatteringColor(FLinearColor(.44f, .62f, .65f));
    auto* Post = CreateDefaultSubobject<UPostProcessComponent>(TEXT("PainterlyGrade"));
    Post->SetupAttachment(RootComponent);
    Post->bUnbound = true;
    Post->Settings.bOverride_AutoExposureMethod = true;
    Post->Settings.AutoExposureMethod = EAutoExposureMethod::AEM_Manual;
    Post->Settings.bOverride_AutoExposureBias = true;
    Post->Settings.AutoExposureBias = 0.f;
    Post->Settings.bOverride_AutoExposureApplyPhysicalCameraExposure = true;
    Post->Settings.AutoExposureApplyPhysicalCameraExposure = false;
    Post->Settings.bOverride_BloomIntensity = true;
    Post->Settings.BloomIntensity = .18f;
    Post->Settings.bOverride_VignetteIntensity = true;
    Post->Settings.VignetteIntensity = .22f;
    Post->Settings.bOverride_AmbientOcclusionIntensity = true;
    Post->Settings.AmbientOcclusionIntensity = .8f;
    Post->Settings.bOverride_AmbientOcclusionRadius = true;
    Post->Settings.AmbientOcclusionRadius = 110;
    Post->Settings.bOverride_ColorSaturation = true;
    Post->Settings.ColorSaturation = FVector4(1.08f, 1.06f, 1.02f, 1.f);
}

void ATownKit::Piece(const FString& Mesh, const FString& Material, FVector P,
                    FVector Scale, FRotator Rotation, bool bCollision)
{
    const FString Key = Mesh.Replace(TEXT("/"),TEXT("_")).Replace(TEXT("."),TEXT("_"))
        + Material + (bCollision ? TEXT("_solid") : TEXT("_deco"));
    auto* Found = Pools.Find(Key);
    UInstancedStaticMeshComponent* Pool = Found ? Found->Get() : nullptr;
    if (!Pool)
    {
        Pool = NewObject<UInstancedStaticMeshComponent>(this, *Key);
        Pool->SetupAttachment(RootComponent);
        const FString MeshPath = Mesh.StartsWith(TEXT("/")) ? Mesh
            : TEXT("/Game/Art/Meshes/") + Mesh + TEXT(".") + Mesh;
        UStaticMesh* Asset = LoadObject<UStaticMesh>(nullptr, *MeshPath);
        ensureAlwaysMsgf(Asset, TEXT("Missing town mesh: %s"), *MeshPath);
        Pool->SetStaticMesh(Asset);
        const FString MaterialPath = TEXT("/Game/Art/Materials/M_") + Material + TEXT(".M_") + Material;
        auto* Surface = LoadObject<UMaterialInterface>(nullptr, *MaterialPath);
        ensureAlwaysMsgf(Surface, TEXT("Missing town material: %s"), *MaterialPath);
        Pool->SetMaterial(0, Surface);
        Pool->SetCollisionEnabled(bCollision ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
        Pool->SetCollisionResponseToAllChannels(ECR_Block);
        Pool->SetMobility(EComponentMobility::Movable);
        AddInstanceComponent(Pool);
        Pool->RegisterComponent();
        Pools.Add(Key, Pool);
    }
    Pool->AddInstance(FTransform(Rotation, P, Scale));
}

void ATownKit::Box(const FString& Mat, FVector P, FVector Size, FRotator R, bool Solid)
{
    Piece(TEXT("/Engine/BasicShapes/Cube.Cube"), Mat, P, Size / 100.f, R, Solid);
}

void ATownKit::Tree(FVector P, float S, int32 Variant)
{
    const FString Green = Variant % 3 == 0 ? TEXT("LeavesLight") :
        (Variant % 3 == 1 ? TEXT("Leaves") : TEXT("LeavesDark"));
    Piece(TEXT("Trunk"), TEXT("Wood"), P, FVector(.72f,.72f,3.3f)*S, FRotator::ZeroRotator, true);
    for (int32 L=0; L<7; ++L)
    {
        const float A = L * 2.39996f + Variant;
        const float Radius = L == 6 ? 0 : 85*S;
        const FVector Offset(FMath::Cos(A)*Radius, FMath::Sin(A)*Radius,
            (L == 6 ? 420 : 300 + L*12)*S);
        Piece(TEXT("Canopy"), Green, P + Offset, FVector(2.35f,2.1f,1.65f)*S,
            FRotator(0,L*47,0));
    }
    // Root flare visually anchors the trunk into the ground.
    for (int32 I=0; I<3; ++I)
        Box(TEXT("Wood"), P+FVector(0,0,18*S), FVector(95,22,24)*S, FRotator(0,I*60,0));
}

void ATownKit::Flower(FVector P, float S, int32 Palette)
{
    const FString Petal = Palette % 3 == 0 ? TEXT("FlowerCream") :
        (Palette % 3 == 1 ? TEXT("FlowerPink") : TEXT("FlowerBlue"));
    Piece(TEXT("Flower"), Petal, P, FVector(S), FRotator(0,Random.FRandRange(0,360),0));
    Piece(TEXT("/Engine/BasicShapes/Sphere.Sphere"), TEXT("Gold"), P+FVector(0,0,41*S), FVector(.1f,.1f,.08f)*S);
    Box(TEXT("LeavesDark"), P+FVector(0,0,18*S), FVector(3,3,36)*S);
}

void ATownKit::Fence(FVector A, FVector B)
{
    const FVector Delta = B-A;
    const int32 Count = FMath::Max(1,FMath::RoundToInt(Delta.Size2D()/180));
    const float Yaw = Delta.Rotation().Yaw;
    for (int32 I=0; I<=Count; ++I)
    {
        const FVector P = FMath::Lerp(A,B,float(I)/Count);
        Box(TEXT("Wood"),P+FVector(0,0,63),FVector(22,22,126),FRotator(0,Yaw,0),true);
        Box(TEXT("WoodLight"),P+FVector(0,0,130),FVector(28,28,9),FRotator(0,Yaw,0));
        if (I<Count)
        {
            const FVector Mid = FMath::Lerp(A,B,(I+.5f)/Count);
            for (float Z : {43.f,91.f})
                Box(TEXT("Wood"),Mid+FVector(0,0,Z),FVector(Delta.Size2D()/Count,13,17),FRotator(0,Yaw,0));
        }
    }
}

void ATownKit::Lamp(FVector P)
{
    Piece(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"),TEXT("Iron"),P+FVector(0,0,150),FVector(.12f,.12f,3.f));
    Box(TEXT("Iron"),P+FVector(0,0,12),FVector(50,50,24));
    Box(TEXT("Glow"),P+FVector(0,0,309),FVector(31,31,50));
    for (int32 X : {-1,1}) for (int32 Y : {-1,1})
        Box(TEXT("Iron"),P+FVector(X*19,Y*19,310),FVector(5,5,60));
    Piece(TEXT("Roof"),TEXT("Iron"),P+FVector(0,0,335),FVector(.55f,.55f,.42f));
    auto* Light = NewObject<UPointLightComponent>(this);
    Light->SetupAttachment(RootComponent);
    Light->SetRelativeLocation(P+FVector(0,0,310));
    Light->SetLightColor(FLinearColor(1,.66f,.25f));
    Light->SetIntensity(500);
    Light->SetAttenuationRadius(270);
    Light->SetCastShadows(false);
    AddInstanceComponent(Light);
    Light->RegisterComponent();
}

void ATownKit::Bench(FVector P)
{
    for (int32 I=0; I<4; ++I)
        Box(TEXT("Wood"),P+FVector(0,I*15,61),FVector(180,12,11));
    for (int32 I=0; I<3; ++I)
        Box(TEXT("Wood"),P+FVector(0,55,90+I*19),FVector(180,10,14));
    for (int32 X : {-65,65})
    {
        Box(TEXT("Iron"),P+FVector(X,22,30),FVector(12,65,60),FRotator::ZeroRotator,true);
        Box(TEXT("Iron"),P+FVector(X,55,100),FVector(10,10,90));
    }
}

void ATownKit::Cottage(FVector P)
{
    // P is the door anchor. Rotate the authored module so its door faces the
    // fixed camera's west side, keeping the garden path clear.
    const FRotator Facing(0,-90,0);
    auto Box=[this,P,Facing](const FString& M,FVector Pos,FVector Size,
        FRotator R=FRotator::ZeroRotator,bool Solid=false) {
        this->Box(M,P+Facing.RotateVector(Pos-P),Size,FRotator(R.Pitch,R.Yaw-90,R.Roll),Solid);
    };
    auto Piece=[this,P,Facing](const FString& Mesh,const FString& M,FVector Pos,FVector Size,
        FRotator R=FRotator::ZeroRotator,bool Solid=false) {
        this->Piece(Mesh,M,P+Facing.RotateVector(Pos-P),Size,FRotator(R.Pitch,R.Yaw-90,R.Roll),Solid);
    };
    auto Flower=[this,P,Facing](FVector Pos,float S,int32 Palette) {
        this->Flower(P+Facing.RotateVector(Pos-P),S,Palette);
    };
    auto Lamp=[this,P,Facing](FVector Pos) { this->Lamp(P+Facing.RotateVector(Pos-P)); };
    Box(TEXT("Stone"),P+FVector(0,300,40),FVector(760,650,80),FRotator::ZeroRotator,true);
    Box(TEXT("Plaster"),P+FVector(0,310,260),FVector(700,580,450),FRotator::ZeroRotator,true);
    Piece(TEXT("Roof"),TEXT("Roof"),P+FVector(0,310,485),FVector(8.f,7.f,4.2f));
    for (int32 X : {-340,340})
        Box(TEXT("Wood"),P+FVector(X,12,270),FVector(24,24,440));
    Box(TEXT("Wood"),P+FVector(0,12,461),FVector(720,24,25));
    Box(TEXT("Wood"),P+FVector(0,10,180),FVector(130,24,250));
    Box(TEXT("WoodLight"),P+FVector(0,-5,180),FVector(100,10,220));
    Box(TEXT("Glow"),P+FVector(0,-13,238),FVector(67,4,68));
    Box(TEXT("Wood"),P+FVector(0,-18,238),FVector(6,4,72));
    Box(TEXT("Wood"),P+FVector(0,-18,238),FVector(72,4,6));
    Piece(TEXT("/Engine/BasicShapes/Sphere.Sphere"),TEXT("Gold"),P+FVector(40,-18,157),FVector(.09f));
    for (int32 X : {-220,220})
    {
        Box(TEXT("Wood"),P+FVector(X,5,284),FVector(140,22,170));
        Box(TEXT("Glass"),P+FVector(X,-9,284),FVector(112,5,140));
        Box(TEXT("WoodLight"),P+FVector(X,-14,284),FVector(9,6,140));
        Box(TEXT("WoodLight"),P+FVector(X,-14,284),FVector(112,6,9));
        for (int32 Side : {-1,1})
            Box(TEXT("LeavesDark"),P+FVector(X+Side*87,-5,284),FVector(40,17,166));
        Box(TEXT("Wood"),P+FVector(X,-45,187),FVector(150,65,43));
        for (int32 F=0;F<6;++F)
            Flower(P+FVector(X-60+F*24,-45,210),.6f,F);
    }
    Box(TEXT("Stone"),P+FVector(0,-70,14),FVector(210,140,28),FRotator::ZeroRotator,true);
    Box(TEXT("Stone"),P+FVector(0,-175,7),FVector(270,90,14),FRotator::ZeroRotator,true);
    Box(TEXT("Stone"),P+FVector(230,410,645),FVector(100,100,310));
    Box(TEXT("Wood"),P+FVector(230,410,807),FVector(125,125,20));
    Lamp(P+FVector(340,-100,0));
}

void ATownKit::BeginPlay()
{
    Super::BeginPlay();
    if (Pools.IsEmpty()) { Random.Initialize(41723); BuildTown(); }
}

void ATownKit::OnConstruction(const FTransform& Transform)
{
    Super::OnConstruction(Transform);
    // The same town is visible in the editor and in a packaged game.
    for (auto& Entry : Pools) if (Entry.Value) Entry.Value->DestroyComponent();
    Pools.Empty();
    if (HerbMarker) { HerbMarker->DestroyComponent(); HerbMarker=nullptr; }
    TArray<UPointLightComponent*> OldLights;
    GetComponents(OldLights);
    for (auto* Light : OldLights) if (Light->CreationMethod==EComponentCreationMethod::Instance) Light->DestroyComponent();
    Random.Initialize(41723);
    BuildTown();
}

void ATownKit::SetHerbVisible(bool bVisible)
{
    if (HerbMarker) HerbMarker->SetVisibility(bVisible);
}

void ATownKit::BuildTown()
{
    // Extend scenery beyond the bounded play area so the camera never reveals a diorama edge.
    Box(TEXT("Grass"),FVector(-4000,0,-40),FVector(8520,20000,80),FRotator::ZeroRotator,true);
    Box(TEXT("Grass"),FVector(5000,0,-40),FVector(7920,20000,80),FRotator::ZeroRotator,true);
    Piece(TEXT("WaterPlane"),TEXT("Water"),FVector(650,0,-70),FVector(7.8f,200.f,1));
    Box(TEXT("Soil"),FVector(650,0,-160),FVector(790,20000,80));
    // Walkable paths are thin overlays; the ground owns their collision.
    Box(TEXT("Dirt"),FVector(-800,-260,1),FVector(2200,350,2));
    Box(TEXT("Dirt"),FVector(1550,-260,1),FVector(1000,350,2));
    Box(TEXT("Dirt"),FVector(1580,200,1),FVector(320,950,2));
    Box(TEXT("Paving"),FVector(-1500,-50,2),FVector(1050,1200,4));
    Box(TEXT("Paving"),FVector(-1800,-740,2),FVector(650,280,4));
    Cottage(FVector(-1540,-740,0));
    Bench(FVector(-1230,110,0));
    Lamp(FVector(-1950,-200,0));
    Lamp(FVector(-530,200,0));
    Fence(FVector(-2330,-1250,0),FVector(-550,-1250,0));
    Fence(FVector(-550,-1250,0),FVector(-550,-550,0));
    Fence(FVector(1160,140,0),FVector(1160,1150,0));
    Fence(FVector(-2400,1770,0),FVector(-400,1770,0));
    // Bank barriers have a single bridge opening and cannot trap the character.
    for (float X : {TownRules::RiverWest,TownRules::RiverEast})
    {
        for (int32 Y=-2380;Y<=2380;Y+=90)
        {
            if (FMath::Abs(Y-TownRules::BridgeY)<245) continue;
            Piece(TEXT("Rock"),TEXT("Stone"),FVector(X+Random.FRandRange(-24,24),Y,-60),
                FVector(Random.FRandRange(1.1f,1.7f),1.35f,Random.FRandRange(1.6f,2.1f)),FRotator(0,Random.FRandRange(0,360),0));
        }
        // Invisible blocking boxes agree with the readable stone bank and leave the deck clear.
        for (const auto& Span : {FVector2D(-2500,-410),FVector2D(-110,2500)})
            Box(TEXT("Invisible"),FVector(X,(Span.X+Span.Y)/2,70),FVector(30,Span.Y-Span.X,230),FRotator::ZeroRotator,true);
    }
    // Arched timber bridge: narrow deck boards, four capped posts, rope rails.
    for (int32 I=0;I<15;++I)
    {
        const float T=I/14.f;
        const float X=225+T*850;
        const float Z=20+FMath::Sin(T*PI)*28;
        Box(TEXT("Wood"),FVector(X,-260,Z),FVector(60,300,20),FRotator::ZeroRotator,true);
        for (float Y : {-388.f,-132.f})
            Piece(TEXT("/Engine/BasicShapes/Sphere.Sphere"),TEXT("Rope"),FVector(X,Y,Z+100),FVector(.64f,.055f,.055f));
    }
    for (float X : {240.f,650.f,1060.f}) for (float Y : {-410.f,-110.f})
    {
        Box(TEXT("Wood"),FVector(X,Y,74),FVector(28,28,148),FRotator::ZeroRotator,true);
        Box(TEXT("WoodLight"),FVector(X,Y,153),FVector(36,36,12));
    }
    // Rail collision is continuous; water cannot be walked on.
    for (float Y : {-418.f,-102.f})
        Box(TEXT("Invisible"),FVector(650,Y,100),FVector(900,12,200),FRotator::ZeroRotator,true);
    // Stream ripples and waterfall ribbons share an animated foam material.
    for (int32 I=0;I<90;++I)
    {
        const float X=Random.FRandRange(330,970), Y=Random.FRandRange(-2400,2400);
        Box(TEXT("Foam"),FVector(X,Y,-65),FVector(Random.FRandRange(12,50),Random.FRandRange(40,130),1));
    }
    for (int32 I=0;I<12;++I)
    {
        const FVector P(Random.FRandRange(350,950),Random.FRandRange(-2350,2350),-95);
        if (FMath::Abs(P.Y+260)<300) continue;
        Piece(TEXT("Rock"),TEXT("Stone"),P,FVector(1.3f,1.2f,.8f),FRotator(0,I*61,0));
    }
    // Forest boundary and a few foreground silhouettes.
    for (int32 I=0;I<31;++I)
    {
        FVector P;
        if (I<12) P=FVector(-2350+I*205,1930+Random.FRandRange(0,250),0);
        else if (I<22) P=FVector(-2400+Random.FRandRange(-100,0),-2000+(I-12)*370,0);
        else P=FVector(2250+Random.FRandRange(0,150),-1900+(I-22)*450,0);
        if (P.X>0 && P.X<1200) continue;
        Tree(P,Random.FRandRange(.8f,1.25f),I);
    }
    Tree(FVector(-250,850,0),1.1f,0);
    Tree(FVector(1760,1330,0),1.f,1);
    Tree(FVector(-2040,-1600,0),.95f,2);
    // Grass meadow and garden borders, kept clear of the main route.
    for (int32 I=0;I<1200;++I)
    {
        FVector P(Random.FRandRange(-2260,2350),Random.FRandRange(-1900,1750),0);
        if (!TownRules::IsSafeGround(P) || TownRules::IsBridge(P)) continue;
        if (FMath::Abs(P.Y+260)<240) continue;
        if (P.X<-900 && P.Y>-240) continue;
        if (P.X>1330 && P.X<1810 && P.Y>-500 && P.Y<800) continue;
        const bool Meadow=P.X<-650 && P.Y<-650;
        if (Meadow || I%5==0)
            Piece(TEXT("GrassTuft"),I%3==0?TEXT("LeavesLight"):TEXT("Leaves"),P,
                FVector(Random.FRandRange(.5f,1.05f)),FRotator(0,Random.FRandRange(0,360),0));
        if (!Meadow && I%8==0) Flower(P,Random.FRandRange(.6f,1.1f),I);
        if (I%29==0) Piece(TEXT("Canopy"),TEXT("LeavesDark"),P+FVector(0,0,28),FVector(.9f,.8f,.6f));
    }
    for (int32 I=0;I<40;++I)
    {
        const float X=I%2==0 ? 160.f : 1150.f;
        const float Y=-2000+I*100;
        if (FMath::Abs(Y+260)<300) continue;
        Flower(FVector(X+Random.FRandRange(-40,40),Y,0),.8f,I);
    }
    // Small signpost, herb interaction, and gardener figure.
    Box(TEXT("Wood"),FVector(-80,-540,75),FVector(17,17,150));
    Box(TEXT("WoodLight"),FVector(-80,-540,152),FVector(150,18,64));
    Box(TEXT("Wood"),FVector(-60,-540,205),FVector(125,17,42));
    for (int32 I=0;I<9;++I) Flower(TownRules::Herb()+FVector((I%3-1)*27,(I/3-1)*27,0),1.1f,2);
    HerbMarker=NewObject<UStaticMeshComponent>(this,TEXT("HerbGlow"));
    HerbMarker->SetupAttachment(RootComponent);
    HerbMarker->SetStaticMesh(LoadObject<UStaticMesh>(nullptr,TEXT("/Engine/BasicShapes/Sphere.Sphere")));
    HerbMarker->SetMaterial(0,LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/Art/Materials/M_Glow.M_Glow")));
    HerbMarker->SetRelativeLocation(TownRules::Herb()+FVector(0,0,95));
    HerbMarker->SetRelativeScale3D(FVector(.13f));
    HerbMarker->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    AddInstanceComponent(HerbMarker);
    HerbMarker->RegisterComponent();
    FVector N=TownRules::Gardener();
    Piece(TEXT("/Engine/BasicShapes/Sphere.Sphere"),TEXT("Skin"),N+FVector(0,0,145),FVector(.46f));
    Piece(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"),TEXT("Straw"),N+FVector(0,0,168),FVector(.85f,.85f,.08f));
    Piece(TEXT("/Engine/BasicShapes/Sphere.Sphere"),TEXT("Straw"),N+FVector(0,0,179),FVector(.54f,.54f,.3f));
    Box(TEXT("LeavesDark"),N+FVector(0,0,95),FVector(48,34,67),FRotator::ZeroRotator,true);
    for (int32 Side : {-1,1})
    {
        Box(TEXT("Denim"),N+FVector(Side*15,0,38),FVector(18,23,62));
        Box(TEXT("Wood"),N+FVector(Side*15,-9,9),FVector(22,38,18));
        Piece(TEXT("/Engine/BasicShapes/Sphere.Sphere"),TEXT("Skin"),N+FVector(Side*34,0,86),FVector(.16f,.18f,.44f));
        Piece(TEXT("/Engine/BasicShapes/Sphere.Sphere"),TEXT("Iron"),N+FVector(Side*9,-21,148),FVector(.045f));
    }
    // Outer boundaries: grounded, invisible, and independent from decorative trees.
    for (float X : {-2550.f,2550.f}) Box(TEXT("Invisible"),FVector(X,0,200),FVector(40,5000,400),FRotator::ZeroRotator,true);
    for (float Y : {-2200.f,2200.f}) Box(TEXT("Invisible"),FVector(0,Y,200),FVector(5100,40,400),FRotator::ZeroRotator,true);
}
