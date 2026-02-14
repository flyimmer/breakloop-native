change of Kotlin file must follow the instruction: C:\Dev\BreakLoop\BreakLoop-Native\spec\development_workflow_guide.md

Branches:

1. fix/Native_Migration_1-BasicTimingLogic: from which the apk BreakLoop_V0 is created. This apk has a stable quick task and intervention flow. 
Release note:
- known bugs: 1 Spotify music will be paused when quick task dialog appears. 2. background Mucis/voice from xhs can still be heared while the intervention flow for xhs.
- UX Flow not good, especially for alternative and root cause identification. user will not go such a long journey to use it

2. origin/native_migration2: Branch "native_migration 2" is to implement phase B to further migrate JS into Native. Now implemented Phase B1 slice 1, but not tested yet.  
This branch does not have the latest flow yet.


Another project: "WebAPP3": react native for web demo only.
WebAPP3: is implemeting the new UI/UX concept to let me first feel my idea.
