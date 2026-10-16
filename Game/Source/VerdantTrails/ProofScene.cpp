#include "ProofScene.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "EngineUtils.h"
#include "CanvasItem.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpectatorPawn.h"
#include "HAL/PlatformFileManager.h"
#include "InputCoreTypes.h"
#include "Kismet/KismetMaterialLibrary.h"
#include "Materials/MaterialParameterCollection.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "RenderUtils.h"
#include "UnrealClient.h"

AVerdantProofGameMode::AVerdantProofGameMode()
{
    DefaultPawnClass = ASpectatorPawn::StaticClass();
    HUDClass = AVerdantProofHUD::StaticClass();
}

AVerdantProofDirector::AVerdantProofDirector()
{
    PrimaryActorTick.bCanEverTick = true;
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("ProofOrigin"));
}

void AVerdantProofDirector::BeginPlay()
{
    Super::BeginPlay();
    bCapture = FParse::Param(FCommandLine::Get(), TEXT("ProofCapture"));
    bDiagnostics = !bCapture;
    bReducedMotion = FParse::Param(FCommandLine::Get(), TEXT("ProofReducedMotion"));
    EvidenceDir = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir() / TEXT("../output/asset-evidence/s1-proof-v001"));
    IFileManager::Get().MakeDirectory(*EvidenceDir, true);
    const FString RunName = FDateTime::UtcNow().ToString(TEXT("%Y%m%dT%H%M%S")) + FString::Printf(TEXT("_%u"),FPlatformProcess::GetCurrentProcessId());
    IFileManager::Get().MakeDirectory(*(EvidenceDir / RunName),true);
    CaptureRelativePath = RunName / (bReducedMotion ? TEXT("02-reduced-motion.png") : TEXT("01-comparison.png"));
    CaptureRelativePath.ReplaceInline(TEXT("\\"),TEXT("/"));
    CapturePath = EvidenceDir / CaptureRelativePath;
    if (auto* PC = GetWorld()->GetFirstPlayerController())
    {
        for (TActorIterator<ACameraActor> It(GetWorld()); It; ++It)
        {
            if (It->ActorHasTag(TEXT("VerdantProofCamera")))
            {
                PC->SetViewTarget(*It);
                break;
            }
        }
        PC->bShowMouseCursor = false;
        PC->SetInputMode(FInputModeGameOnly());
    }
    SetMotion();
}

void AVerdantProofDirector::SetMotion()
{
    for (TActorIterator<AActor> It(GetWorld()); It; ++It)
    {
        TInlineComponentArray<USkeletalMeshComponent*> Components(*It);
        for (auto* Component : Components) Component->SetPlayRate(bReducedMotion ? 0.f : 1.f);
    }
    if (auto* Collection = LoadObject<UMaterialParameterCollection>(nullptr,
        TEXT("/Game/Verdant/Production/Proofs/Materials/MPC_Proof.MPC_Proof")))
    {
        UKismetMaterialLibrary::SetScalarParameterValue(this, Collection, TEXT("Motion"), bReducedMotion ? 0.f : 1.f);
    }
}

void AVerdantProofDirector::Tick(float Dt)
{
    Super::Tick(Dt);
    Elapsed += Dt;
    if (auto* PC = GetWorld()->GetFirstPlayerController())
    {
        if (PC->WasInputKeyJustPressed(EKeys::M)) { bReducedMotion = !bReducedMotion; SetMotion(); }
        if (PC->WasInputKeyJustPressed(EKeys::Tab)) bExpandedParty = !bExpandedParty;
        if (PC->WasInputKeyJustPressed(EKeys::F1)) bDiagnostics = !bDiagnostics;
        if (!bCapture && PC->WasInputKeyJustPressed(EKeys::Escape)) PC->ConsoleCommand(TEXT("quit"));
    }
    if (!bCapture) return;
    // Warm the real renderer before the repeatable comparison capture.
    if (!bRequested && Elapsed >= 30.f)
    {
        FScreenshotRequest::RequestScreenshot(CapturePath, true, false);
        bRequested = true;
    }
    if (bRequested && Elapsed >= 33.f)
    {
        WriteCaptureEvidence();
        FPlatformMisc::RequestExitWithStatus(true, IFileManager::Get().FileSize(*CapturePath) > 32 ? 0 : 1);
    }
}

void AVerdantProofDirector::WriteCaptureEvidence()
{
    int32 SkeletalComponents = 0;
    int32 PlayingComponents = 0;
    int32 ZeroRateComponents = 0;
    for (TActorIterator<AActor> It(GetWorld()); It; ++It)
    {
        TInlineComponentArray<USkeletalMeshComponent*> Components(*It);
        for (auto* Component : Components)
        {
            if (Component->GetSkeletalMeshAsset()) ++SkeletalComponents;
            if (Component->IsPlaying()) ++PlayingComponents;
            if (Component->GetSkeletalMeshAsset() && FMath::IsNearlyZero(Component->GetPlayRate())) ++ZeroRateComponents;
        }
    }
    const bool bImageExists = IFileManager::Get().FileSize(*CapturePath) > 32;
    const FString Report = FString::Printf(
        TEXT("{\n  \"schema\":\"verdant.unreal-proof-capture.v1\",\n  \"capture_exists\":%s,\n  \"capture_relative_path\":\"%s\",\n  \"reduced_motion\":%s,\n  \"elapsed_game_seconds\":%.3f,\n  \"skeletal_components\":%d,\n  \"playing_components\":%d,\n  \"zero_play_rate_components\":%d,\n  \"engine_version\":\"%s\",\n  \"player_save_access\":false,\n  \"visual_approval\":\"pending\",\n  \"canonical_package_verification\":\"not_run_game_dev_unavailable\",\n  \"performance_acceptance\":\"not_measured\"\n}\n"),
        bImageExists ? TEXT("true") : TEXT("false"), *CaptureRelativePath, bReducedMotion ? TEXT("true") : TEXT("false"),
        Elapsed, SkeletalComponents, PlayingComponents, ZeroRateComponents, *FEngineVersion::Current().ToString());
    FFileHelper::SaveStringToFile(Report, *(EvidenceDir / (bReducedMotion ? TEXT("capture-reduced-motion.json") : TEXT("capture.json"))), FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
}

void AVerdantProofHUD::Disc(float X, float Y, float R, FLinearColor C)
{
    TArray<FCanvasUVTri> Triangles;
    for (int32 I = 0; I < 64; ++I)
    {
        const float A = I * 2.f * PI / 64.f;
        const float B = (I + 1) * 2.f * PI / 64.f;
        FCanvasUVTri T;
        T.V0_Pos = FVector2D(X,Y) * Scale;
        T.V1_Pos = FVector2D(X + FMath::Cos(A)*R,Y + FMath::Sin(A)*R) * Scale;
        T.V2_Pos = FVector2D(X + FMath::Cos(B)*R,Y + FMath::Sin(B)*R) * Scale;
        T.V0_UV = T.V1_UV = T.V2_UV = FVector2D::ZeroVector;
        T.V0_Color = T.V1_Color = T.V2_Color = C;
        Triangles.Add(T);
    }
    FCanvasTriangleItem Item(Triangles,GWhiteTexture);
    Item.BlendMode = SE_BLEND_Translucent;
    Canvas->DrawItem(Item);
}

void AVerdantProofHUD::Rounded(float X,float Y,float W,float H,float R,FLinearColor C)
{
    TArray<FVector2D> Outline;
    const FVector2D Corners[]={{X+R,Y+R},{X+W-R,Y+R},{X+W-R,Y+H-R},{X+R,Y+H-R}};
    const float Starts[]={PI,1.5f*PI,0,.5f*PI};
    for(int32 Corner=0; Corner<4; ++Corner) for(int32 I=0; I<=8; ++I)
    {
        const float A=Starts[Corner]+I*PI/16;
        Outline.Add((Corners[Corner]+FVector2D(FMath::Cos(A),FMath::Sin(A))*R)*Scale);
    }
    TArray<FCanvasUVTri> Triangles;
    for(int32 I=0; I<Outline.Num(); ++I)
    {
        FCanvasUVTri T;
        T.V0_Pos=FVector2D(X+W/2,Y+H/2)*Scale;
        T.V1_Pos=Outline[I]; T.V2_Pos=Outline[(I+1)%Outline.Num()];
        T.V0_UV=T.V1_UV=T.V2_UV=FVector2D::ZeroVector;
        T.V0_Color=T.V1_Color=T.V2_Color=C;
        Triangles.Add(T);
    }
    FCanvasTriangleItem Item(Triangles,GWhiteTexture);
    Item.BlendMode=SE_BLEND_Translucent;
    Canvas->DrawItem(Item);
}

void AVerdantProofHUD::Label(const FString& Text,float X,float Y,float Size,FLinearColor C)
{
    auto* Font = GEngine->GetMediumFont();
    FCanvasTextItem Item(FVector2D(X,Y)*Scale,FText::FromString(Text),Font,C);
    Item.Scale = FVector2D(Size/FMath::Max(1.f,static_cast<float>(Font->GetMaxCharHeight()))*Scale);
    Item.EnableShadow(FLinearColor(0,0,0,.25f));
    Canvas->DrawItem(Item);
}

void AVerdantProofHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!Canvas) return;
    AVerdantProofDirector* Director = nullptr;
    for (TActorIterator<AVerdantProofDirector> It(GetWorld()); It; ++It) { Director = *It; break; }
    Scale = Canvas->ClipY/941.f;
    const float W = Canvas->ClipX/Scale, H = 941.f;
    const FLinearColor White(.97f,.98f,.94f,1.f), Ink(.055f,.075f,.065f,.82f);
    Rounded(26,21,224,48,24,FLinearColor(.12f,.065f,.055f,.76f));
    Disc(51,43,8,White);
    Label(TEXT("Verdant Town"),77,32,22,White);
    const float MX = W-122, MY = 126, MR = 102;
    Disc(MX,MY,MR+3,White); Disc(MX,MY,MR,FLinearColor(.29f,.48f,.30f,.96f));
    // S1 schematic illustration. The production map artwork/data binding is pending.
    for (int32 I=0; I<42; ++I)
    {
        const float A=I*2.399963f, Radius=FMath::Sqrt((I+.5f)/42.f)*88.f;
        const float TX=FMath::Cos(A)*Radius, TY=FMath::Sin(A)*Radius;
        if (TX>12 && TX<34) continue;
        Disc(MX+TX,MY+TY,4.f+(I%3),FLinearColor(.12f,.30f,.16f,.95f));
    }
    DrawLine((MX+22)*Scale,(MY-91)*Scale,(MX+20)*Scale,(MY+91)*Scale,FLinearColor(.22f,.68f,.78f,1),12*Scale);
    DrawLine((MX-78)*Scale,(MY+12)*Scale,(MX+70)*Scale,(MY+12)*Scale,FLinearColor(.77f,.65f,.37f,1),6*Scale);
    Disc(MX,MY-MR,17,Ink); Label(TEXT("N"),MX-8,MY-MR-13,24,White);
    for (const auto& Pos : {FVector2D(-43,-28),FVector2D(57,7),FVector2D(-49,55)})
    { Disc(MX+Pos.X,MY+Pos.Y,9,White); Disc(MX+Pos.X,MY+Pos.Y,6,FLinearColor(.67f,.14f,.13f)); }
    Disc(MX,MY+8,8,FLinearColor(.18f,.59f,.94f));
    const int32 PortraitCount = Director && Director->bExpandedParty ? 6 : 3;
    const TCHAR* Initials[] = {TEXT("P"),TEXT("B"),TEXT("C"),TEXT("4"),TEXT("5"),TEXT("6")};
    for (int32 I=0; I<PortraitCount; ++I)
    {
        const float X=73+I*105;
        Disc(X,H-101,44,White); Disc(X,H-101,41,Ink);
        // Explicit unavailable-art state. Do not substitute an unapproved portrait.
        Label(Initials[I],X-12,H-121,32,FLinearColor(.68f,.74f,.67f));
        Rounded(X-41,H-54,82,12,5,White);
        Rounded(X-38,H-51,76,6,3,FLinearColor(.34f,.9f,.20f));
    }
    const float BX=W-173, BY=H-81, MenuX=W-79;
    Disc(BX,BY,39,White); Disc(BX,BY,36,Ink);
    Rounded(BX-16,BY-13,32,34,5,White);
    DrawLine((BX-10)*Scale,(BY-16)*Scale,(BX-6)*Scale,(BY-23)*Scale,White,4*Scale);
    DrawLine((BX+10)*Scale,(BY-16)*Scale,(BX+6)*Scale,(BY-23)*Scale,White,4*Scale);
    Disc(MenuX,BY,39,White); Disc(MenuX,BY,36,Ink);
    for(int32 I=-1; I<=1; ++I) Rounded(MenuX-17,BY+I*11-2,34,4,2,White);
    if (Director && Director->bDiagnostics)
    {
        Rounded(26,85,470,86,12,Ink);
        Label(TEXT("S1 source proofs  |  visual approval pending"),42,99,18,White);
        Label(TEXT("M  Motion   TAB  3/6 party layout   F1  Details   ESC  Exit"),42,129,14,White);
        Label(TEXT("Portrait artwork unavailable; initials show missing-art state."),26,H-29,13,White);
    }
}
