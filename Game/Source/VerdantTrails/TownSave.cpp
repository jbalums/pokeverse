#include "TownSave.h"
#include "Serialization/BufferArchive.h"
#include "Serialization/MemoryReader.h"
#include "Misc/Crc.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"

namespace TownSave
{
    constexpr uint32 Magic=0x31435456;
    constexpr uint32 Schema=1;
    constexpr int32 RecordBytes=48;
    bool Valid(const FSnapshot& S)
    {
        return S.Revision>=0 && S.Revision<MAX_int32 && static_cast<uint8>(S.Quest)<=3
            && !S.Position.ContainsNaN() && S.Position.Z>=70 && S.Position.Z<=350
            && TownRules::IsSafeGround(S.Position);
    }
    bool Encode(const FSnapshot& S,TArray<uint8>& Bytes)
    {
        Bytes.Empty();
        if (!Valid(S)) return false;
        FBufferArchive Ar;
        uint32 Tag=Magic,Version=Schema,Revision=S.Revision,Quest=static_cast<uint32>(S.Quest),Motion=S.bReducedMotion?1:0;
        double X=S.Position.X,Y=S.Position.Y,Z=S.Position.Z;
        Ar<<Tag<<Version<<Revision<<Quest<<Motion<<X<<Y<<Z;
        uint32 CRC=FCrc::MemCrc32(Ar.GetData(),Ar.Num());
        Ar<<CRC;
        Bytes.Append(Ar.GetData(),Ar.Num());
        return Bytes.Num()==RecordBytes;
    }
    bool Decode(const TArray<uint8>& Bytes,FSnapshot& S)
    {
        if (Bytes.Num()!=RecordBytes) return false;
        uint32 StoredCRC=0;
        FMemory::Memcpy(&StoredCRC,Bytes.GetData()+RecordBytes-4,4);
        if (StoredCRC!=FCrc::MemCrc32(Bytes.GetData(),RecordBytes-4)) return false;
        FMemoryReader Ar(Bytes,true);
        uint32 Tag=0,Version=0,Revision=0,Quest=0,Motion=0;
        double X=0,Y=0,Z=0;
        Ar<<Tag<<Version<<Revision<<Quest<<Motion<<X<<Y<<Z;
        if (Ar.IsError() || Tag!=Magic || Version!=Schema || Revision>=MAX_int32 || Quest>3 || Motion>1) return false;
        FSnapshot Candidate;
        Candidate.Revision=static_cast<int32>(Revision);
        Candidate.Quest=static_cast<TownRules::EQuest>(Quest);
        Candidate.bReducedMotion=Motion==1;
        Candidate.Position=FVector(X,Y,Z);
        if (!Valid(Candidate)) return false;
        S=Candidate;
        return true;
    }
    FString Path(const FString& Slot)
    {
        return FPaths::ProjectSavedDir()/TEXT("SaveGames")/(Slot+TEXT(".vcs"));
    }
    bool Exists(const FString& Slot) { return IFileManager::Get().FileExists(*Path(Slot)); }
    bool Read(const FString& Slot,FSnapshot& S)
    {
        // Check length before allocation; arbitrary oversized files are rejected.
        if (IFileManager::Get().FileSize(*Path(Slot))!=RecordBytes) return false;
        TArray<uint8> Bytes;
        return FFileHelper::LoadFileToArray(Bytes,*Path(Slot)) && Decode(Bytes,S);
    }
    bool Write(const FString& Slot,const FSnapshot& S)
    {
        TArray<uint8> Bytes;
        if (!Encode(S,Bytes)) return false;
        const FString File=Path(Slot);
        if (!IFileManager::Get().MakeDirectory(*FPaths::GetPath(File),true)) return false;
        if (!FFileHelper::SaveArrayToFile(Bytes,*File)) return false;
        FSnapshot Verify;
        return Read(Slot,Verify) && Verify.Revision==S.Revision && Verify.Quest==S.Quest
            && Verify.Position.Equals(S.Position,.0001) && Verify.bReducedMotion==S.bReducedMotion;
    }
}
