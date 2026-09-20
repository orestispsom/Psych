local _,P=...
local intervals={1,3,7,14,21}
function P.ApplyAnswer(state,event)
    local next=P.Copy(state or {})
    next.correctCount=(next.correctCount or 0)+(event.isCorrect and 1 or 0)
    next.wrongCount=(next.wrongCount or 0)+(event.isCorrect and 0 or 1)
    next.seenCount=(next.seenCount or 0)+1
    next.consecutiveCorrect=event.isCorrect and ((next.consecutiveCorrect or 0)+1) or 0
    next.consecutiveWrong=event.isCorrect and 0 or ((next.consecutiveWrong or 0)+1)
    local mastery=next.masteryLevel or 0
    if event.isCorrect then mastery=math.min(5,mastery+1)
    elseif mastery>=5 then mastery=3 else mastery=math.max(0,mastery-2) end
    if next.consecutiveCorrect>=3 then mastery=5 end
    next.masteryLevel=mastery
    next.nextReviewAt=event.answeredAt+(event.isCorrect and (intervals[math.max(1,mastery)]*86400) or 21600)
    next.lastAnsweredAt=event.answeredAt; next.lastSelected=event.selectedIndex
    next.lastCorrect=event.isCorrect
    return next
end
function P.InitializeProgress()
    local db=P.Copy(PsychQuizDB)
    if db and (type(db)~='table' or (db.schemaVersion and db.schemaVersion>P.schemaVersion)) then
        error('Saved data is from an unsupported version. It has been preserved.')
    end
    if db and db.profileId and db.profileId~='orestis' then error('Profile mismatch. Saved data preserved.') end
    if P.import.profileId~='orestis' or P.import.schemaVersion~=1 then error('Invalid imported baseline.') end
    db=db or {schemaVersion=1,profileId='orestis',events={},sequence=0}
    -- Schema 0 -> 1 adds preferences without deleting existing events.
    db.schemaVersion=1; db.profileId='orestis'; db.events=db.events or {}; db.sequence=db.sequence or 0
    db.settings=db.settings or {}
    for k,v in pairs(P.defaults) do if db.settings[k]==nil then db.settings[k]=v end end
    db.settings.width=math.max(340,math.min(900,tonumber(db.settings.width) or 410))
    db.settings.height=math.max(300,math.min(1000,tonumber(db.settings.height) or 570))
    db.settings.fontSize=math.max(14,math.min(24,tonumber(db.settings.fontSize) or 16))
    db.settings.opacity=math.max(0.65,math.min(1,tonumber(db.settings.opacity) or 0.96))
    db.installId=db.installId or (tostring(P.Now())..'-'..tostring(math.random(100000000,999999999)))
    -- A newer aggregate cannot be chronologically rebased with older pending
    -- events without complete history. Keep the current baseline until every
    -- local event is acknowledged by the candidate snapshot.
    db.baseline=db.baseline or P.Copy(P.import)
    db.baselineUpdateDeferred=false
    if db.baseline.snapshotId~=P.import.snapshotId and P.import.snapshotId~='empty' then
        local safe=true
        for _,event in ipairs(db.events) do
            if not (P.import.includedEventIds or {})[event.eventId] then safe=false end
        end
        if (P.import.generatedAt or 0)>=(db.baseline.generatedAt or 0) then
            if safe then db.baseline=P.Copy(P.import) else db.baselineUpdateDeferred=true end
        end
    end
    db.derived=P.Copy(db.baseline.questions or {})
    local seen={}
    for _,event in ipairs(db.events) do
        if seen[event.eventId] then error('Duplicate local event ID; saved data preserved.') end
        seen[event.eventId]=true
        if not (db.baseline.includedEventIds or {})[event.eventId] then
            local id=tostring(event.questionId)
            db.derived[id]=P.ApplyAnswer(db.derived[id],event)
        end
    end
    P.db=db; PsychQuizDB=db
end
function P.RecordAnswer(question,index,session)
    if P.IsCombat() then return nil end
    assert(index>=1 and index<=#question.options,'Invalid answer index')
    local db=P.db
    db.sequence=db.sequence+1
    local event={schemaVersion=1,eventId='wow:'..db.installId..':'..db.sequence,
        profileId='orestis',questionId=question.id,questionHash=question.contentHash,
        bankVersion=P.bank.bankVersion,answeredAt=P.Now(),selectedIndex=index-1,
        correctIndex=question.correct,isCorrect=(index-1)==question.correct,
        sessionId=session.id,mode=session.mode,source='wow',confidence=3}
    db.events[#db.events+1]=event
    local id=tostring(question.id)
    db.derived[id]=P.ApplyAnswer(db.derived[id],event)
    return event
end
function P.PendingCount()
    local n=0
    for _,e in ipairs(P.db.events) do
        if not (P.db.baseline.includedEventIds or {})[e.eventId] then n=n+1 end
    end
    return n
end
