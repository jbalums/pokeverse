#include "VerdantGame.h"
#include "TownKit.h"
#include "TownSave.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "Components/CapsuleComponent.h"
#include "Components/InputComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Kismet/KismetMaterialLibrary.h"
#include "Materials/MaterialParameterCollection.h"
#include "Materials/MaterialInterface.h"
#include "EngineUtils.h"
#include "Engine/Canvas.h"
#include "CanvasItem.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "GameFramework/PlayerStart.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "HAL/PlatformFileManager.h"
#include "UnrealClient.h"
#include "RenderUtils.h"

AVerdantGameMode::AVerdantGameMode()
{
    DefaultPawnClass = AVerdantCharacter::StaticClass();
    HUDClass = AVerdantHUD::StaticClass();
    PrimaryActorTick.bCanEverTick=true;
}

void AVerdantGameMode::StartPlay()
{
    if (!TActorIterator<ATownKit>(GetWorld())) GetWorld()->SpawnActor<ATownKit>();
    Super::StartPlay();
    bSmoke=FParse::Param(FCommandLine::Get(),TEXT("VerdantSmoke"));
    bCapture=FParse::Param(FCommandLine::Get(),TEXT("VerdantCapture"));
}

UStaticMeshComponent* AVerdantCharacter::BodyPart(USceneComponent* Parent,
    const FString& Name, const FString& MeshPath, const FString& Material, FVector P, FVector Scale)
{
    auto* Part = CreateDefaultSubobject<UStaticMeshComponent>(*Name);
    Part->SetupAttachment(Parent);
    Part->SetStaticMesh(LoadObject<UStaticMesh>(nullptr,*MeshPath));
    const FString Path=TEXT("/Game/Art/Materials/M_")+Material+TEXT(".M_")+Material;
    Part->SetMaterial(0,LoadObject<UMaterialInterface>(nullptr,*Path));
    Part->SetRelativeLocation(P);
    Part->SetRelativeScale3D(Scale);
    Part->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    return Part;
}

AVerdantCharacter::AVerdantCharacter()
{
    PrimaryActorTick.bCanEverTick=true;
    GetCapsuleComponent()->InitCapsuleSize(27,88);
    GetCharacterMovement()->MaxWalkSpeed=340;
    GetCharacterMovement()->MaxAcceleration=1600;
    GetCharacterMovement()->BrakingDecelerationWalking=1900;
    GetCharacterMovement()->bOrientRotationToMovement=false;
    GetCharacterMovement()->MaxStepHeight=40;
    bUseControllerRotationYaw=false;
    Boom=CreateDefaultSubobject<USpringArmComponent>(TEXT("IsometricBoom"));
    Boom->SetupAttachment(RootComponent);
    Boom->SetUsingAbsoluteRotation(true);
    Boom->SetRelativeRotation(FRotator(-38,-45,0));
    Boom->TargetArmLength=2600;
    Boom->bDoCollisionTest=false;
    Boom->bEnableCameraLag=true;
    Boom->CameraLagSpeed=7;
    Camera=CreateDefaultSubobject<UCameraComponent>(TEXT("IsometricCamera"));
    Camera->SetupAttachment(Boom);
    Camera->ProjectionMode=ECameraProjectionMode::Orthographic;
    Camera->OrthoWidth=2350;
    Camera->bAutoCalculateOrthoPlanes=true;
    Camera->bConstrainAspectRatio=false;
    Figure=CreateDefaultSubobject<USceneComponent>(TEXT("TrainerFigure"));
    Figure->SetupAttachment(RootComponent);
    Figure->SetRelativeLocation(FVector(0,0,-88));
    const FString Sphere=TEXT("/Engine/BasicShapes/Sphere.Sphere");
    const FString Cube=TEXT("/Engine/BasicShapes/Cube.Cube");
    BodyPart(Figure,TEXT("Torso"),Sphere,TEXT("Jacket"),FVector(0,0,101),FVector(.48f,.63f,.68f));
    BodyPart(Figure,TEXT("Shirt"),Sphere,TEXT("Cream"),FVector(17,0,105),FVector(.21f,.44f,.49f));
    BodyPart(Figure,TEXT("Backpack"),Sphere,TEXT("Denim"),FVector(-27,0,109),FVector(.3f,.5f,.56f));
    BodyPart(Figure,TEXT("Head"),Sphere,TEXT("Skin"),FVector(0,0,154),FVector(.48f));
    BodyPart(Figure,TEXT("Hair"),Sphere,TEXT("Wood"),FVector(-5,0,166),FVector(.49f,.5f,.31f));
    BodyPart(Figure,TEXT("Cap"),Sphere,TEXT("Red"),FVector(0,0,177),FVector(.55f,.55f,.26f));
    BodyPart(Figure,TEXT("Brim"),Sphere,TEXT("Cream"),FVector(21,0,172),FVector(.44f,.5f,.065f));
    for (int32 Side : {-1,1})
    {
        BodyPart(Figure,FString::Printf(TEXT("Eye%d"),Side),Sphere,TEXT("Iron"),FVector(22,Side*10,155),FVector(.044f,.05f,.06f));
        BodyPart(Figure,FString::Printf(TEXT("Shoe%d"),Side),Cube,TEXT("Red"),FVector(6,Side*15,11),FVector(.35f,.25f,.18f));
    }
    LeftLeg=BodyPart(Figure,TEXT("LeftLeg"),Sphere,TEXT("Denim"),FVector(0,-15,44),FVector(.23f,.23f,.65f));
    RightLeg=BodyPart(Figure,TEXT("RightLeg"),Sphere,TEXT("Denim"),FVector(0,15,44),FVector(.23f,.23f,.65f));
    LeftArm=BodyPart(Figure,TEXT("LeftArm"),Sphere,TEXT("Skin"),FVector(0,-35,96),FVector(.17f,.17f,.55f));
    RightArm=BodyPart(Figure,TEXT("RightArm"),Sphere,TEXT("Skin"),FVector(0,35,96),FVector(.17f,.17f,.55f));
    Companion=CreateDefaultSubobject<USceneComponent>(TEXT("CompanionFigure"));
    Companion->SetupAttachment(RootComponent);
    BodyPart(Companion,TEXT("CompanionBody"),Sphere,TEXT("Mint"),FVector(0,0,29),FVector(.72f,.46f,.43f));
    BodyPart(Companion,TEXT("CompanionHead"),Sphere,TEXT("Mint"),FVector(32,0,43),FVector(.48f,.56f,.49f));
    BodyPart(Companion,TEXT("Bulb"),Sphere,TEXT("LeavesDark"),FVector(-14,0,57),FVector(.52f,.5f,.5f));
    for (int32 Side : {-1,1})
    {
        BodyPart(Companion,FString::Printf(TEXT("Ear%d"),Side),TEXT("/Game/Art/Meshes/Leaf.Leaf"),TEXT("Mint"),FVector(30,Side*19,62),FVector(.18f,.15f,.2f));
        BodyPart(Companion,FString::Printf(TEXT("CompanionEye%d"),Side),Sphere,TEXT("Red"),FVector(52,Side*18,48),FVector(.04f,.09f,.13f));
        for (int32 End : {-1,1})
            BodyPart(Companion,FString::Printf(TEXT("Foot%d%d"),Side,End),Sphere,TEXT("Mint"),FVector(End*23,Side*20,12),FVector(.21f,.17f,.23f));
    }
    MotionCollection=LoadObject<UMaterialParameterCollection>(nullptr,TEXT("/Game/Art/Materials/MPC_Town.MPC_Town"));
}

void AVerdantCharacter::BeginPlay()
{
    Super::BeginPlay();
    LastSafePosition=TownRules::Spawn();
    RestoreProgress();
    CompanionPosition=GetActorLocation()-FVector(90,0,88);
    Trail.Add(CompanionPosition);
    if (auto* PC=Cast<APlayerController>(GetController()))
    {
        PC->bShowMouseCursor=false;
        PC->SetInputMode(FInputModeGameOnly());
    }
}

void AVerdantCharacter::SetupPlayerInputComponent(UInputComponent* Input)
{
    Super::SetupPlayerInputComponent(Input);
    Input->BindAxis(TEXT("Forward"),this,&AVerdantCharacter::Forward);
    Input->BindAxis(TEXT("Right"),this,&AVerdantCharacter::Right);
    Input->BindAction(TEXT("Interact"),IE_Pressed,this,&AVerdantCharacter::Interact);
    Input->BindAction(TEXT("Sprint"),IE_Pressed,this,&AVerdantCharacter::SprintOn);
    Input->BindAction(TEXT("Sprint"),IE_Released,this,&AVerdantCharacter::SprintOff);
    Input->BindAction(TEXT("Menu"),IE_Pressed,this,&AVerdantCharacter::Menu);
    Input->BindAction(TEXT("ZoomIn"),IE_Pressed,this,&AVerdantCharacter::ZoomIn);
    Input->BindAction(TEXT("ZoomOut"),IE_Pressed,this,&AVerdantCharacter::ZoomOut);
    Input->BindAction(TEXT("Reset"),IE_Pressed,this,&AVerdantCharacter::ResetPosition);
    Input->BindAction(TEXT("Motion"),IE_Pressed,this,&AVerdantCharacter::ToggleMotion);
}

void AVerdantCharacter::Forward(float V)
{
    if (!bMenuOpen && !IsDialogueOpen()) AddMovementInput(FVector(.7071068f,-.7071068f,0),V);
}
void AVerdantCharacter::Right(float V)
{
    if (!bMenuOpen && !IsDialogueOpen()) AddMovementInput(FVector(.7071068f,.7071068f,0),V);
}
void AVerdantCharacter::SprintOn() { bSprinting=true; }
void AVerdantCharacter::SprintOff() { bSprinting=false; }
void AVerdantCharacter::ZoomIn() { if (!bMenuOpen) TargetZoom=FMath::Max(1750.f,TargetZoom-150); }
void AVerdantCharacter::ZoomOut() { if (!bMenuOpen) TargetZoom=FMath::Min(3300.f,TargetZoom+150); }
void AVerdantCharacter::Menu()
{
    if (IsDialogueOpen()) { Dialogue.Empty(); return; }
    bMenuOpen=!bMenuOpen;
    GetCharacterMovement()->StopMovementImmediately();
    if (bMenuOpen) SaveProgress();
}
void AVerdantCharacter::ToggleMotion()
{
    bReducedMotion=!bReducedMotion;
    SaveProgress();
}
void AVerdantCharacter::ResetPosition()
{
    if (!bMenuOpen) return;
    SetActorLocation(TownRules::Spawn(),false,nullptr,ETeleportType::TeleportPhysics);
    LastSafePosition=TownRules::Spawn();
    Trail.Empty();
    CompanionPosition=GetActorLocation()-FVector(90,0,88);
    SaveProgress();
    bMenuOpen=false;
}

TownRules::EFocus AVerdantCharacter::Focus() const
{
    return TownRules::Focus(GetActorLocation(),Quest);
}

FString AVerdantCharacter::Objective() const
{
    switch (Quest)
    {
        case TownRules::EQuest::MeetGardener: return TEXT("Speak with the gardener by the cottage");
        case TownRules::EQuest::FindHerb: return TEXT("Find the blue herb across the bridge");
        case TownRules::EQuest::ReturnHerb: return TEXT("Bring the herb back to the gardener");
        default: return TEXT("A little kindness, a greener town. Thank you!");
    }
}

void AVerdantCharacter::Interact()
{
    if (bMenuOpen) return;
    if (IsDialogueOpen()) { Dialogue.Empty(); return; }
    const TownRules::EFocus Target=Focus();
    switch (Target)
    {
        case TownRules::EFocus::Gardener:
            if (Quest==TownRules::EQuest::MeetGardener)
                Dialogue=TEXT("GARDENER\nThe blue herbs are blooming again! Could you bring me one?\nCross the timber bridge and follow the little path to the right.");
            else if (Quest==TownRules::EQuest::ReturnHerb)
                Dialogue=TEXT("GARDENER\nJust what the garden needed. Thank you, both of you!\nTake your time here. The river sounds lovely this afternoon.");
            else if (Quest==TownRules::EQuest::Complete)
                Dialogue=TEXT("GARDENER\nA small garden can make a whole town feel like home.\nYou're always welcome in Verdant Town.");
            else Dialogue=TEXT("GARDENER\nLook for the blue flowers beyond the bridge.\nYour little companion seems to know the way!");
            break;
        case TownRules::EFocus::Herb:
            Dialogue=TEXT("BLUE HERB\nYou carefully picked a fragrant blue herb.\nThe gardener will be pleased."); break;
        case TownRules::EFocus::Sign:
            Dialogue=TEXT("VERDANT TOWN\nWest: cottage garden    |    East: herb meadow\nPlease leave the riverbank flowers for everyone to enjoy."); break;
        case TownRules::EFocus::Cottage:
            Dialogue=TEXT("GARDEN COTTAGE\nGone to tend the flowers. Find me by the bench!\nThe cottage interior is closed for this town visit."); break;
        default: return;
    }
    GetCharacterMovement()->StopMovementImmediately();
    if (TownRules::Advance(Quest,Target)) SaveProgress();
}

void AVerdantCharacter::Tick(float Dt)
{
    Super::Tick(Dt);
    GetCharacterMovement()->MaxWalkSpeed=bSprinting?520:340;
    const FVector P=GetActorLocation();
    if (P.Z<-220 || FMath::Abs(P.X)>2620 || FMath::Abs(P.Y)>2290)
    {
        SetActorLocation(LastSafePosition,false,nullptr,ETeleportType::TeleportPhysics);
        GetCharacterMovement()->StopMovementImmediately();
        Trail.Empty();
        CompanionPosition=LastSafePosition-FVector(90,0,88);
    }
    else if (GetCharacterMovement()->IsMovingOnGround() && TownRules::IsSafeGround(P)) LastSafePosition=P;
    const float Speed=GetVelocity().Size2D();
    WalkPhase+=Dt*Speed*.035f;
    const float Swing=Speed>15?FMath::Sin(WalkPhase)*25:0;
    LeftLeg->SetRelativeRotation(FRotator(Swing,0,0));
    RightLeg->SetRelativeRotation(FRotator(-Swing,0,0));
    LeftArm->SetRelativeRotation(FRotator(-Swing*.8f,0,0));
    RightArm->SetRelativeRotation(FRotator(Swing*.8f,0,0));
    if (Speed>10) Figure->SetWorldRotation(FMath::RInterpTo(Figure->GetComponentRotation(),GetVelocity().Rotation(),Dt,12));
    Boom->bEnableCameraLag=!bReducedMotion;
    Camera->OrthoWidth=bReducedMotion?TargetZoom:FMath::FInterpTo(Camera->OrthoWidth,TargetZoom,Dt,7);
    if (MotionCollection)
    {
        UKismetMaterialLibrary::SetScalarParameterValue(this,MotionCollection,TEXT("Motion"),bReducedMotion?0.f:1.f);
        UKismetMaterialLibrary::SetVectorParameterValue(this,MotionCollection,TEXT("Player"),FLinearColor(P.X,P.Y,P.Z-88,1));
    }
    const FVector Foot=P-FVector(0,0,88);
    if (Trail.IsEmpty() || FVector::DistSquared(Trail.Last(),Foot)>400) Trail.Add(Foot);
    if (Trail.Num()>8)
    {
        FVector Delta=Trail[0]-CompanionPosition;
        const float Step=(Speed>350?570.f:380.f)*Dt;
        if (Delta.Size()<Step+5) { CompanionPosition=Trail[0]; Trail.RemoveAt(0); }
        else CompanionPosition+=Delta.GetSafeNormal()*Step;
        if (Delta.Size2D()>2) Companion->SetWorldRotation(FMath::RInterpTo(Companion->GetComponentRotation(),Delta.Rotation(),Dt,10));
    }
    if (Trail.Num()>128) Trail.RemoveAt(0,Trail.Num()-128);
    Companion->SetWorldLocation(CompanionPosition+FVector(0,0,bReducedMotion?0:FMath::Sin(WalkPhase)*FMath::Min(Speed/50,4.f)));
    for (TActorIterator<ATownKit> It(GetWorld());It;++It) It->SetHerbVisible(Quest==TownRules::EQuest::FindHerb);
}

namespace
{
    FString SlotName(bool bA)
    {
        const FString Prefix=FParse::Param(FCommandLine::Get(),TEXT("VerdantSmoke"))
            ? FString::Printf(TEXT("VerdantSmoke_%u"),FPlatformProcess::GetCurrentProcessId()) : TEXT("VerdantCorner");
        return Prefix+(bA?TEXT("_A"):TEXT("_B"));
    }
}

void AVerdantCharacter::RestoreProgress()
{
    TOptional<TownSave::FSnapshot> Best;
    for (const FString& Slot : {SlotName(true),SlotName(false)})
    {
        if (!TownSave::Exists(Slot)) continue;
        TownSave::FSnapshot S;
        if (TownSave::Read(Slot,S))
        {
            if (!Best.IsSet() || S.Revision>Best->Revision) Best=S;
        }
        else bLoadFailed=true;
    }
    if (Best.IsSet())
    {
        Quest=Best->Quest;
        SaveRevision=Best->Revision;
        bReducedMotion=Best->bReducedMotion;
        LastSafePosition=Best->Position;
        bHasSave=true;
        bLoadFailed=false;
    }
    SetActorLocation(LastSafePosition,false,nullptr,ETeleportType::TeleportPhysics);
}

void AVerdantCharacter::SaveProgress()
{
    // Alternating verified snapshots preserve the previous good slot on failure.
    // Corrupt/unknown saves are retained and never automatically overwritten.
    if (bLoadFailed) { bSaveFailed=true; return; }
    TownSave::FSnapshot S;
    S.Quest=Quest;
    S.Position=LastSafePosition;
    S.bReducedMotion=bReducedMotion;
    S.Revision=SaveRevision+1;
    const FString Slot=SlotName(S.Revision%2!=0);
    bSaveFailed=!TownSave::Write(Slot,S);
    if (!bSaveFailed) { SaveRevision=S.Revision; bHasSave=true; }
}

void AVerdantHUD::Disc(float X,float Y,float R,FLinearColor C)
{
    TArray<FCanvasUVTri> Triangles;
    for (int32 I=0;I<32;++I)
    {
        const float A=I*2*PI/32, B=(I+1)*2*PI/32;
        FCanvasUVTri T;
        T.V0_Pos=FVector2D(X,Y)*UIScale;
        T.V1_Pos=FVector2D(X+FMath::Cos(A)*R,Y+FMath::Sin(A)*R)*UIScale;
        T.V2_Pos=FVector2D(X+FMath::Cos(B)*R,Y+FMath::Sin(B)*R)*UIScale;
        T.V0_UV=T.V1_UV=T.V2_UV=FVector2D::ZeroVector;
        T.V0_Color=T.V1_Color=T.V2_Color=C;
        Triangles.Add(T);
    }
    FCanvasTriangleItem Item(Triangles,GWhiteTexture);
    Item.BlendMode=SE_BLEND_Translucent;
    Canvas->DrawItem(Item);
}

void AVerdantGameMode::Tick(float Dt)
{
    Super::Tick(Dt);
    if (!bSmoke) return;
    auto* P=Cast<AVerdantCharacter>(UGameplayStatics::GetPlayerCharacter(this,0));
    if (!P) return;
    SmokeTime+=Dt;
    SmokeStepTime+=Dt;
    if (SmokeTime>180 || SmokeStepTime>45)
    {
        UE_LOG(LogTemp,Error,TEXT("VERDANT_SMOKE_FAILED step=%d position=%s"),SmokeStep,*P->GetActorLocation().ToString());
        FPlatformMisc::RequestExitWithStatus(false,1);
        bSmoke=false;
        return;
    }
    auto Next=[this]() { ++SmokeStep; SmokeStepTime=0; };
    auto Capture=[this](const FString& Name) {
        if (!bCapture) return;
        const FString Folder=FPaths::ConvertRelativePathToFull(FPaths::ProjectDir()/TEXT("../output/screenshots"));
        IFileManager::Get().MakeDirectory(*Folder,true);
        FScreenshotRequest::RequestScreenshot(Folder/Name+TEXT(".png"),true,false);
    };
    auto Walk=[P,Next](FVector Target) {
        const FVector Delta=Target-P->GetActorLocation();
        if (Delta.Size2D()<45) Next();
        else P->AddMovementInput(FVector(Delta.X,Delta.Y,0).GetSafeNormal());
    };
    switch (SmokeStep)
    {
        case 0: if (SmokeStepTime>20) { Capture(TEXT("01-town")); Next(); } break;
        case 1: Walk(FVector(-1330,-170,110)); break;
        case 2: P->Interact(); Next(); break;
        case 3: if (SmokeStepTime>1) { Capture(TEXT("02-gardener")); P->Interact(); Next(); } break;
        case 4: Walk(FVector(-700,-260,110)); break;
        case 5: Walk(FVector(650,-260,150)); break;
        case 6: if (SmokeStepTime>2) { Capture(TEXT("03-bridge")); Next(); } break;
        case 7: Walk(FVector(1580,-260,110)); break;
        case 8: Walk(FVector(1580,340,110)); break;
        case 9: P->Interact(); Next(); break;
        case 10: if (SmokeStepTime>1) { P->Interact(); Next(); } break;
        case 11: Walk(FVector(1580,-260,110)); break;
        case 12: Walk(FVector(-700,-260,110)); break;
        case 13: Walk(FVector(-1330,-170,110)); break;
        case 14: P->Interact(); Next(); break;
        case 15: if (SmokeStepTime>1) { P->Interact(); Capture(TEXT("04-complete")); Next(); } break;
        case 16:
            if (SmokeStepTime>2)
            {
                const bool Ok=P->Quest==TownRules::EQuest::Complete && P->bHasSave && !P->bSaveFailed;
                const FString Result=FString::Printf(TEXT("{\"passed\":%s,\"quest\":%d,\"saved\":%s,\"seconds\":%.2f,\"rendered\":%s}"),
                    Ok?TEXT("true"):TEXT("false"),static_cast<int32>(P->Quest),P->bHasSave?TEXT("true"):TEXT("false"),SmokeTime,bCapture?TEXT("true"):TEXT("false"));
                FFileHelper::SaveStringToFile(Result,*(FPaths::ProjectDir()/TEXT("../output/gameplay-smoke.json")));
                if (Ok) { UE_LOG(LogTemp,Display,TEXT("VERDANT_SMOKE_SUCCESS %s"),*Result); }
                else { UE_LOG(LogTemp,Error,TEXT("VERDANT_SMOKE_FAILED %s"),*Result); }
                bSmoke=false;
                FPlatformMisc::RequestExitWithStatus(false,Ok?0:1);
            }
            break;
    }
}
void AVerdantHUD::Panel(float X,float Y,float W,float H,FLinearColor C,float R)
{
    TArray<FVector2D> Outline;
    const FVector2D Corners[]={{X+R,Y+R},{X+W-R,Y+R},{X+W-R,Y+H-R},{X+R,Y+H-R}};
    const float Starts[]={PI,1.5f*PI,0,.5f*PI};
    for (int32 Corner=0;Corner<4;++Corner) for (int32 I=0;I<=8;++I)
    {
        const float A=Starts[Corner]+I*PI/16;
        Outline.Add((Corners[Corner]+FVector2D(FMath::Cos(A),FMath::Sin(A))*R)*UIScale);
    }
    TArray<FCanvasUVTri> Tris;
    for (int32 I=0;I<Outline.Num();++I)
    {
        FCanvasUVTri T;
        T.V0_Pos=FVector2D(X+W/2,Y+H/2)*UIScale;
        T.V1_Pos=Outline[I]; T.V2_Pos=Outline[(I+1)%Outline.Num()];
        T.V0_UV=T.V1_UV=T.V2_UV=FVector2D::ZeroVector;
        T.V0_Color=T.V1_Color=T.V2_Color=C;
        Tris.Add(T);
    }
    FCanvasTriangleItem Item(Tris,GWhiteTexture);
    Item.BlendMode=SE_BLEND_Translucent;
    Canvas->DrawItem(Item);
}
void AVerdantHUD::Label(const FString& Text,float X,float Y,float Size,FLinearColor C)
{
    FCanvasTextItem Item(FVector2D(X,Y)*UIScale,FText::FromString(Text),GEngine->GetMediumFont(),C);
    const float FontHeight=FMath::Max(1.f,static_cast<float>(GEngine->GetMediumFont()->GetMaxCharHeight()));
    Item.Scale=FVector2D(Size/FontHeight*UIScale);
    Item.EnableShadow(FLinearColor(0,0,0,.4f));
    Canvas->DrawItem(Item);
}

void AVerdantHUD::DrawHUD()
{
    Super::DrawHUD();
    auto* P=Cast<AVerdantCharacter>(GetOwningPawn());
    if (!P || !Canvas) return;
    UIScale=FMath::Clamp(Canvas->ClipY/900.f,.65f,2.f);
    const float W=Canvas->ClipX/UIScale, H=Canvas->ClipY/UIScale;
    const FLinearColor Ink(.035f,.09f,.075f,.94f), White(.96f,.96f,.87f), Muted(.7f,.79f,.69f), Gold(.94f,.72f,.35f);
    Panel(28,28,280,68,Ink);
    Disc(58,60,11,Gold);
    Label(TEXT("VERDANT TOWN"),82,40,23,White);
    Label(TEXT("The cottage garden"),82,69,13,Muted);
    if (!P->bMenuOpen && !P->IsDialogueOpen())
    {
        Panel(28,108,FMath::Min(530.f,W-56),65,Ink,14);
        Label(P->Quest==TownRules::EQuest::Complete?TEXT("A FAVOR FOR THE GARDENER  /  COMPLETE"):TEXT("A FAVOR FOR THE GARDENER"),46,120,13,Gold);
        Label(P->Objective(),46,143,16,White);
    }
    // True position map: the blue strip is the river, the gold bar is the bridge.
    if (W>1000)
    {
        const float MX=W-170, MY=112;
        Disc(MX,MY,82,White);
        Disc(MX,MY,78,FLinearColor(.18f,.31f,.22f,.96f));
        DrawRect(FLinearColor(.18f,.54f,.62f,1),(MX+6)*UIScale,(MY-71)*UIScale,22*UIScale,142*UIScale);
        DrawRect(Gold,(MX-1)*UIScale,(MY+3)*UIScale,35*UIScale,7*UIScale);
        const FVector Pos=P->GetActorLocation();
        Disc(MX+Pos.X/36,MY-Pos.Y/36,5,White);
        Disc(MX-1330/36.f,MY,4,Gold);
        Label(TEXT("N"),MX-5,MY-74,15,White);
    }
    Panel(28,H-94,260,65,Ink);
    Disc(61,H-62,21,FLinearColor(.3f,.62f,.49f));
    Label(TEXT("01"),49,H-73,19,White);
    Label(TEXT("BULBASAUR"),96,H-79,17,White);
    Label(TEXT("A curious little companion"),96,H-52,12,Muted);
    Panel(W-272,H-84,244,55,Ink);
    Label(TEXT("E  Interact     ESC  Journal"),W-254,H-68,16,White);
    if (W>1150) Label(TEXT("WASD / left stick  Move     SHIFT  Run     Scroll  Zoom"),W/2-220,H-42,14,White);
    const auto Focus=P->Focus();
    if (Focus!=TownRules::EFocus::None && !P->IsDialogueOpen() && !P->bMenuOpen)
    {
        const FString Action=Focus==TownRules::EFocus::Herb?TEXT("E / A   Pick blue herb"):
            Focus==TownRules::EFocus::Gardener?TEXT("E / A   Talk to gardener"):TEXT("E / A   Read");
        Panel(W/2-145,H-175,290,48,Ink);
        Label(Action,W/2-122,H-162,18,White);
    }
    if (P->IsDialogueOpen())
    {
        const float BoxW=FMath::Min(W-80,840.f);
        Panel((W-BoxW)/2,H-300,BoxW,173,Ink);
        Label(P->Dialogue,(W-BoxW)/2+26,H-280,18,White);
        Label(TEXT("E / A  Continue    |    ESC  Close"),(W-BoxW)/2+26,H-163,14,Gold);
    }
    if (P->bMenuOpen)
    {
        DrawRect(FLinearColor(.01f,.03f,.025f,.68f),0,0,Canvas->ClipX,Canvas->ClipY);
        Panel(W/2-280,H/2-226,560,452,Ink,24);
        Label(TEXT("A moment in Verdant"),W/2-243,H/2-192,31,White);
        Label(TEXT("JOURNAL"),W/2-241,H/2-137,13,Gold);
        Label(P->Objective(),W/2-241,H/2-109,17,White);
        Label(TEXT("WASD / arrows / left stick     Walk\nShift / left stick click             Run\nE / gamepad A                        Interact\nMouse wheel                          Zoom\nM                                             Toggle reduced motion\nR                                              Return to town entrance\nESC / Start                             Return to the garden"),W/2-241,H/2-53,16,Muted);
        Label(P->bLoadFailed?TEXT("Save could not be read. Original files retained."):
            P->bSaveFailed?TEXT("Save failed. Previous snapshot retained."):
            P->bHasSave?TEXT("Progress saved on this computer."):TEXT("Progress has not been saved yet."),W/2-241,H/2+179,15,P->bSaveFailed?Gold:Muted);
    }
    if (P->bSaveFailed && !P->bMenuOpen)
        Label(TEXT("Could not save. Open journal to retry."),28,189,16,Gold);
}
