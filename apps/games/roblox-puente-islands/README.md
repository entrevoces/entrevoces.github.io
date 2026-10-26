# Puente Islands — ENTRE VOCES in Roblox Studio

An obby of meaning: three floating islands (Plaza, AI Lab, Harbor of Records) linked by bridges that only open when you carry Spanish tech terms into English for the islanders who need them. Points are **Puente Points**; bridges cost points; the final island keeps a wall of every term you carried.

This is a *Studio deliverable*, not a web page: Roblox Luau cannot run in a browser tab, and pretending otherwise would be slop. Everything needed is in `src/` — no toolbox assets, no external models (FBX/GLB would need manual import; this world builds itself from parts so the import cannot break).

## Install (5 minutes, empty Baseplate)

1. Roblox Studio → New → Baseplate. Delete nothing; scripts build around SpawnLocation.
2. Create the objects and paste each file's contents in:
   - `ReplicatedStorage/PuenteTerms` (ModuleScript) ← `src/ReplicatedStorage/PuenteTerms.lua`
   - `ReplicatedStorage/PuenteAnswer` (RemoteEvent, create empty)
   - `ServerScriptService/BuildWorld` (Script) ← `src/ServerScriptService/BuildWorld.server.lua`
   - `ServerScriptService/PuenteServer` (Script) ← `src/ServerScriptService/PuenteServer.server.lua`
   - `StarterPlayer/StarterPlayerScripts/PuenteClient` (LocalScript) ← `src/StarterPlayerScripts/PuenteClient.client.lua`
3. Press Play. The world builds itself: plaza, bridges (locked, priced), islanders with BillboardGui speech, and your HUD (term prompt + four answer buttons).

## How it plays

Walk to an islander → prompt appears (Spanish AI term in a sentence) → tap the English carrying → +20 Puente Points, islander celebrates, streak grows. Wrong: gentle crack sound, term stays. Bridges open at 60 / 140 points. Harbor wall lists carried terms. Leaderstats persist per session (add DataStore in `PuenteServer` where marked for published places).

## Engine tie-in

Terms mirror `packages/engine-core/seed-data.js` (domain `ai-technology`, ES→EN) — generated into `PuenteTerms.lua` by hand for this seed; regenerate after seed edits with the Admin pattern (`admin generate practice --domain ai-technology`). Published places can POST evidence to the CPE from an external backend; in-Studio play keeps points local by design (Roblox servers cannot hold the CPE author token — and must never try).
