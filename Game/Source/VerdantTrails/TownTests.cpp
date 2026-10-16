#include "TownRules.h"
#include "Misc/AutomationTest.h"
#include "TownSave.h"

#if WITH_DEV_AUTOMATION_TESTS
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FTownQuestTest,"Verdant.Corner.QuestTransactions",EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FTownQuestTest::RunTest(const FString& Parameters)
{
    auto Quest=TownRules::EQuest::MeetGardener;
    TestFalse(TEXT("Cannot collect before request"),TownRules::Advance(Quest,TownRules::EFocus::Herb));
    TestTrue(TEXT("Gardener starts errand"),TownRules::Advance(Quest,TownRules::EFocus::Gardener));
    TestFalse(TEXT("Repeating gardener cannot skip collection"),TownRules::Advance(Quest,TownRules::EFocus::Gardener));
    TestTrue(TEXT("Collect once"),TownRules::Advance(Quest,TownRules::EFocus::Herb));
    TestFalse(TEXT("Repeated pickup cannot duplicate progress"),TownRules::Advance(Quest,TownRules::EFocus::Herb));
    TestTrue(TEXT("Return completes errand"),TownRules::Advance(Quest,TownRules::EFocus::Gardener));
    TestFalse(TEXT("Completion is terminal"),TownRules::Advance(Quest,TownRules::EFocus::Gardener));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FTownRouteTest,"Verdant.Corner.RouteSafety",EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FTownRouteTest::RunTest(const FString& Parameters)
{
    TestTrue(TEXT("Spawn is safe"),TownRules::IsSafeGround(TownRules::Spawn()));
    TestFalse(TEXT("River is unsafe"),TownRules::IsSafeGround(FVector(650,700,100)));
    TestFalse(TEXT("Outside world is unsafe"),TownRules::IsSafeGround(FVector(2600,0,100)));
    for (int32 X=-900;X<=1650;X+=25)
        TestTrue(TEXT("Entire bridge path supports recovery checkpoints"),TownRules::IsSafeGround(FVector(X,-260,110)));
    TestTrue(TEXT("Gardener is reachable focus"),TownRules::Focus(TownRules::Gardener(),TownRules::EQuest::MeetGardener)==TownRules::EFocus::Gardener);
    TestTrue(TEXT("Herb hidden until request"),TownRules::Focus(TownRules::Herb(),TownRules::EQuest::MeetGardener)==TownRules::EFocus::None);
    TestTrue(TEXT("Herb focus after request"),TownRules::Focus(TownRules::Herb(),TownRules::EQuest::FindHerb)==TownRules::EFocus::Herb);
    TestTrue(TEXT("Cannot pick at a distance"),TownRules::Focus(TownRules::Herb()+FVector(400,0,0),TownRules::EQuest::FindHerb)==TownRules::EFocus::None);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FTownSaveTest,"Verdant.Corner.SaveSerialization",EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FTownSaveTest::RunTest(const FString& Parameters)
{
    TownSave::FSnapshot Save;
    Save.Quest=TownRules::EQuest::ReturnHerb;
    Save.Revision=7;
    Save.Position=FVector(1500,400,88);
    Save.bReducedMotion=true;
    TArray<uint8> Bytes;
    TestTrue(TEXT("Serialize snapshot"),TownSave::Encode(Save,Bytes));
    TestEqual(TEXT("Bounded record size"),Bytes.Num(),48);
    TownSave::FSnapshot Read;
    TestTrue(TEXT("Deserialize snapshot"),TownSave::Decode(Bytes,Read));
    TestTrue(TEXT("Quest preserved"),Read.Quest==TownRules::EQuest::ReturnHerb);
    TestEqual(TEXT("Revision preserved"),Read.Revision,7);
    TestTrue(TEXT("Position preserved"),Read.Position.Equals(Save.Position));
    TestTrue(TEXT("Motion preference preserved"),Read.bReducedMotion);
    TArray<uint8> Corrupt={1,2,3,4};
    TestFalse(TEXT("Invalid bytes rejected before deserialization"),TownSave::Decode(Corrupt,Read));
    for (int32 I=0;I<Bytes.Num();++I)
    {
        auto Damaged=Bytes;
        Damaged[I]^=0x40;
        TestFalse(TEXT("Every byte protected by checksum"),TownSave::Decode(Damaged,Read));
    }
    auto Unsafe=Save;
    Unsafe.Position=FVector(650,700,88);
    TestFalse(TEXT("Unsafe checkpoint rejected"),TownSave::Encode(Unsafe,Corrupt));
    Unsafe=Save;
    Unsafe.Quest=static_cast<TownRules::EQuest>(99);
    TestFalse(TEXT("Unknown quest state rejected"),TownSave::Encode(Unsafe,Corrupt));
    return true;
}
#endif
