I copied from the cursor, cursor made it by checking the code(26.12.2025)

┌─────────┐
│  IDLE   │ ←──────────────────────────────────────────────┐
└────┬────┘                                                 │
     │ User opens monitored app                             │
     │ BEGIN_INTERVENTION                                   │
     ▼                                                      │
┌─────────────┐                                            │
│  BREATHING  │ ──[Auto: BREATHING_TICK every 1s]───┐     │
└──────┬──────┘                                        │     │
       │ breathingCount reaches 0                     │     │
       │ Auto-transition                               │     │
       ▼                                               │     │
┌──────────────┐                                       │     │
│ ROOT-CAUSE   │ ──[User selects causes]──┐           │     │
└──────┬───────┘                          │           │     │
       │                                  │           │     │
       │ PROCEED_TO_ALTERNATIVES          │           │     │
       │ (requires at least 1 cause)      │           │     │
       ▼                                  │           │     │
┌──────────────┐                          │           │     │
│ALTERNATIVES  │                          │           │     │
└──────┬───────┘                          │           │     │
       │                                  │           │     │
       │ SELECT_ALTERNATIVE               │           │     │
       ▼                                  │           │     │
┌──────────────┐                          │           │     │
│   ACTION     │                          │           │     │
└──────┬───────┘                          │           │     │
       │                                  │           │     │
       │ START_ALTERNATIVE                 │           │     │
       │ (parses duration, starts timer)  │           │     │
       ▼                                  │           │     │
┌──────────────┐                          │           │     │
│ ACTION_TIMER │ ──[Auto: ACTION_TIMER_TICK]──┐      │     │
└──────┬───────┘                            │         │     │
       │                                    │         │     │
       │ FINISH_ACTION (manual)             │         │     │
       │ OR actionTimer reaches 0           │         │     │
       ▼                                    │         │     │
┌──────────────┐                            │         │     │
│  REFLECTION  │                            │         │     │
└──────┬───────┘                            │         │     │
       │                                    │         │     │
       │ FINISH_REFLECTION                  │         │     │
       ▼                                    │         │     │
┌──────────────┐                            │         │     │
│    IDLE      │────────────────────────────┘         │     │
└──────────────┘                                        │     │
                                                        │     │
┌──────────────┐                                        │     │
│    TIMER     │ ──[User chose "I really need it"]     │     │
└──────┬───────┘                                        │     │
       │                                                │     │
       │ (Unlock app for X minutes)                    │     │
       │ RESET_INTERVENTION                            │     │
       └────────────────────────────────────────────────┘     │
                                                              │
┌──────────────┐                                              │
│   ACTION     │ ──[GO_BACK_FROM_ACTION]─────────────────────┘
└──────────────┘
       │
       │ (User clicks back button)
       ▼
┌──────────────┐
│ALTERNATIVES  │
└──────────────┘