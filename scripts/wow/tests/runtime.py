"""Executes production Lua logic with a minimal nonvisual WoW API test double.
This is logic verification, never evidence of in-game visual correctness.
Requires Python package lupa. No user SavedVariables are loaded or written.
"""
from pathlib import Path
from lupa.lua51 import LuaRuntime
root=Path(__file__).resolve().parents[3]
vm=LuaRuntime(unpack_returned_tuples=True)
vm.execute('''
unpack=unpack or table.unpack
function GetServerTime() return 1800000000 end
function InCombatLockdown() return combat or false end
SlashCmdList={}
function CreateFrame() return {RegisterEvent=function() end,SetScript=function() end} end
P={}
''')
def load(name):
    vm.execute('local f=assert(loadstring(...)); f("PsychQuiz",P)',(root/'addons/PsychQuiz'/name).read_text(encoding='utf8'))
for name in ['SavedVariablesSeed.lua','Seed.lua','Core.lua','Questions.lua','ProfileImport.lua','Progress.lua','Quiz.lua']:
    load(name)
vm.execute('''
-- Real private snapshot is read, but test state never leaves this runtime.
P.InitializeProgress(); P.InitializeQuiz()
P.Refresh=function() end
P.scroll={SetVerticalScroll=function() end}
assert(#P.bank.questions==2072)
local baseline=P.Copy(P.db.baseline)
P.StartSession()
assert(#P.db.session.ids==25)
local q=P.CurrentQuestion()
P.Select(q.correct+1); P.Submit(); P.Submit()
assert(#P.db.events==1,'double submission')
assert(P.db.session.answered==1)
assert(P.db.derived[tostring(q.id)].correctCount==((baseline.questions[tostring(q.id)] or {}).correctCount or 0)+1)
assert((P.db.baseline.questions[tostring(q.id)] or {}).correctCount==(baseline.questions[tostring(q.id)] or {}).correctCount)
local first=P.db.events[1].eventId
local before=P.db.derived[tostring(q.id)].correctCount
P.InitializeProgress(); P.InitializeQuiz()
assert(P.db.derived[tostring(q.id)].correctCount==before,'reload double-counted event')
P.Next(); q=P.CurrentQuestion(); P.Select(1)
combat=true; P.Submit(); assert(#P.db.events==2,'combat answer was blocked')
combat=false
assert(P.db.events[2].eventId~=first)
-- Regeneration cannot unlock an already recorded question for duplicate submission.
P.db.session.bankVersion='previous-bank'
local answeredIndex=P.db.session.index
P.InitializeQuiz()
assert(P.db.session.index==answeredIndex+1 and not P.db.session.revealed)
-- Sixth answer must be stored without coercion.
q=P.byId['3221']; P.RecordAnswer(q,6,P.db.session)
assert(P.db.events[3].selectedIndex==5)
-- A fresh remote aggregate must not reorder pending local history.
local imported=P.Copy(P.import)
local activeSnapshot=P.db.baseline.snapshotId
P.import.snapshotId='newer-test-snapshot'; P.import.generatedAt=P.db.baseline.generatedAt+1
P.InitializeProgress()
assert(P.db.baseline.snapshotId==activeSnapshot and P.db.baselineUpdateDeferred)
-- A fully acknowledged snapshot replaces the baseline without replaying events.
P.import.questions=P.Copy(P.db.derived); P.import.includedEventIds={}
for _,event in ipairs(P.db.events) do P.import.includedEventIds[event.eventId]=true end
local expected=P.db.derived['3221'].seenCount
P.InitializeProgress()
assert(P.db.baseline.snapshotId=='newer-test-snapshot' and P.PendingCount()==0)
assert(P.db.derived['3221'].seenCount==expected)
P.import=imported
-- Old settings migration and future-schema refusal.
PsychQuizDB.schemaVersion=0; P.InitializeProgress(); assert(P.db.schemaVersion==1)
local original=PsychQuizDB
PsychQuizDB.schemaVersion=99
assert(not pcall(P.InitializeProgress)); assert(PsychQuizDB==original and PsychQuizDB.schemaVersion==99)
PsychQuizDB.schemaVersion=1
-- JS app parity: three consecutive correct -> mastered, six-hour wrong review.
local state={}
for i=1,3 do state=P.ApplyAnswer(state,{isCorrect=true,answeredAt=1800000000,selectedIndex=0}) end
assert(state.masteryLevel==5 and state.nextReviewAt==1800000000+21*86400)
state=P.ApplyAnswer(state,{isCorrect=false,answeredAt=1800000000,selectedIndex=1})
assert(state.masteryLevel==3 and state.nextReviewAt==1800000000+21600)
''')
# Compile the UI without substituting a fake visual renderer.
vm.execute('assert(loadstring(...))',(root/'addons/PsychQuiz/UI.lua').read_text(encoding='utf8'))
# Forever fallback restores a seed only when native SavedVariables are absent.
seed=(root/'addons/PsychQuiz/Seed.lua').read_text(encoding='utf8')
vm.execute('PsychQuizDB=nil; PsychQuizSeedDB={marker=42}; local f=assert(loadstring(...)); f(); assert(PsychQuizDB.marker==42)',seed)
vm.execute('PsychQuizDB={marker=7}; PsychQuizSeedDB={marker=42}; local f=assert(loadstring(...)); f(); assert(PsychQuizDB.marker==7)',seed)
print('Lua 5.1: initialization, answer events, double-click guard, baseline immutability, reload, combat interaction, sixth option, migration and mastery checks passed; UI syntax passed.')
