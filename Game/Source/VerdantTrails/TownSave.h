#pragma once

#include "CoreMinimal.h"
#include "TownRules.h"

namespace TownSave
{
    // Fixed 48-byte record: magic/schema/revision/quest/motion/XYZ doubles/CRC32.
    // Never pass potentially corrupt bytes to Unreal's UObject/FName deserializer.
    struct FSnapshot
    {
        int32 Revision=0;
        TownRules::EQuest Quest=TownRules::EQuest::MeetGardener;
        bool bReducedMotion=false;
        FVector Position=TownRules::Spawn();
    };
    bool Valid(const FSnapshot& Snapshot);
    bool Encode(const FSnapshot& Snapshot,TArray<uint8>& Bytes);
    bool Decode(const TArray<uint8>& Bytes,FSnapshot& Snapshot);
    bool Exists(const FString& Slot);
    bool Read(const FString& Slot,FSnapshot& Snapshot);
    bool Write(const FString& Slot,const FSnapshot& Snapshot);
}
