# change of Kotlin file must follow the instruction: C:\Dev\BreakLoop\BreakLoop-Native\spec\development_workflow_guide.md

# Branches:
## fix/native_migration_1-BasicTimingLogic: 
the last stable branch. From it build the production apk: BreakLoop_V0, which has the stable quick task and intervention flow. but the flow is too complicated for the root cuase.

### Known Bug
1. one apparent error is the spotify music stopped when quick task dialog start
2.  sometimes there are background voice from xhs when intervention flow started on xhs
 but the two app shall be fixed in Migration 2, because Migration 2 takes the codebase form Migration 1, we shall not do anything in Migration 1 anymore.

## main (15.02): almost the same as fix/native_migration_1-BasicTimingLogic

## native_migration2
take the codebase from fix/native_migration_1-BasicTimingLogic, however not deleted the community,inbox, Social configuration and debug session under Settings yet. That's the only starting difference.
Status(15.02): implemented Phase B1 slice 1, but not tested yet. need to find a way to build and test. The last effective implementaion agnet is "Fix Build Errors".



# branch and name overview
Branch							                App Display Name	     		Package ID						            Can Install Together?
fix/Native_Migration_1-BasicTimingLogic			BreakLoop_V0				    com.anonymous.breakloopv0				    ✅ Yes (unique package)
main							                BreakLoop_V0				    com.anonymous.breakloopnative				❌ Conflicts with native_migration2
native_migration2					            breakloop-native	               com.anonymous.breakloopnative			❌ Conflicts with main