#pragma once

#include "CoreMinimal.h"

// World-space interaction and progression rules shared by runtime and automation tests.
namespace TownRules
{
    constexpr float RiverWest = 260.f;
    constexpr float RiverEast = 1040.f;
    constexpr float BridgeY = -260.f;
    constexpr float BridgeHalfWidth = 150.f;
    constexpr float InteractionRadius = 230.f;
    inline FVector Spawn() { return FVector(-850, -260, 110); }
    inline FVector Gardener() { return FVector(-1330, 0, 0); }
    inline FVector Herb() { return FVector(1580, 460, 0); }

    enum class EQuest : uint8 { MeetGardener, FindHerb, ReturnHerb, Complete };
    enum class EFocus : uint8 { None, Gardener, Herb, Sign, Cottage };

    inline bool IsBridge(const FVector& P)
    {
        return P.X >= RiverWest - 80 && P.X <= RiverEast + 80
            && FMath::Abs(P.Y - BridgeY) <= BridgeHalfWidth;
    }
    inline bool IsSafeGround(const FVector& P)
    {
        return FMath::Abs(P.X) < 2500 && FMath::Abs(P.Y) < 2150
            && (P.X < RiverWest || P.X > RiverEast || IsBridge(P));
    }
    inline EFocus Focus(const FVector& P, EQuest Quest)
    {
        const auto Near = [&P](const FVector& Target) {
            return FVector::DistSquared2D(P, Target) <= FMath::Square(InteractionRadius);
        };
        if (Near(Gardener())) return EFocus::Gardener;
        if (Quest == EQuest::FindHerb && Near(Herb())) return EFocus::Herb;
        if (Near(FVector(-80, -540, 0))) return EFocus::Sign;
        if (Near(FVector(-1540, -740, 0))) return EFocus::Cottage;
        return EFocus::None;
    }
    inline bool Advance(EQuest& Quest, EFocus Target)
    {
        if (Quest == EQuest::MeetGardener && Target == EFocus::Gardener)
            { Quest = EQuest::FindHerb; return true; }
        if (Quest == EQuest::FindHerb && Target == EFocus::Herb)
            { Quest = EQuest::ReturnHerb; return true; }
        if (Quest == EQuest::ReturnHerb && Target == EFocus::Gardener)
            { Quest = EQuest::Complete; return true; }
        return false;
    }
}
