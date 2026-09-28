local _,P=...
P.modeLabels={random='Τυχαίες',category='Ανά κατηγορία',weakness='Αδύναμες',due='Για επανάληψη',exam='Εξέταση'}
function P.IsForeverExam(session)
    local s=session or (P.db and P.db.session)
    return P.isForever and s and s.mode=='exam'
end
local function countExamAnswers(session)
    local count=0
    for _ in pairs(session.answersById or {}) do count=count+1 end
    return count
end
local function normalizeForeverExam(session)
    if not P.IsForeverExam(session) or session.index>#session.ids then return end
    session.answersById=session.answersById or {}
    session.recordedById=session.recordedById or {}
    for _,result in ipairs(session.results or {}) do
        local id=tostring(result.questionId)
        if session.answersById[id]==nil then session.answersById[id]=result.selected end
        session.recordedById[id]=result.selected
    end
    session.elapsedSeconds=math.max(0,tonumber(session.elapsedSeconds) or 0)
    session.answered=countExamAnswers(session)
    session.selected=session.answersById[tostring(session.ids[session.index])]
    session.revealed=false
end
function P.InitializeQuiz()
    local settings=P.db.settings
    if not P.modeLabels[settings.mode] then settings.mode='random' end
    if type(settings.category)~='string' then settings.category='' end
    if settings.length~=0 and settings.length~=10 and settings.length~=25 and settings.length~=50 and settings.length~=100 then settings.length=25 end
    P.byId={}; P.topics={}; local topics={}
    for _,q in ipairs(P.bank.questions) do P.byId[tostring(q.id)]=q; topics[q.topic]=true end
    for topic in pairs(topics) do P.topics[#P.topics+1]=topic end; table.sort(P.topics)
    local s=P.db.session
    if s and (type(s.ids)~='table' or not P.modeLabels[s.mode]) then P.db.session=nil end
    s=P.db.session
    if s then
        if s.results and not s.resultsById then
            s.resultsById={}
            for _,res in ipairs(s.results) do
                s.resultsById[tostring(res.questionId)]=res
            end
        end
        if s.bankVersion~=P.bank.bankVersion then
            -- Never make a recorded answer submit-able again after a bank update.
            if s.revealed then s.index=s.index+1 end
            s.selected=nil; s.revealed=false; s.bankVersion=P.bank.bankVersion
        end
        -- Stable IDs survive regeneration; missing items are skipped, never reassigned.
        while s.index<=#s.ids and not P.byId[tostring(s.ids[s.index])] do s.index=s.index+1 end
        normalizeForeverExam(s)
    end
end
function P.IsDue(state)
    return state and ((state.nextReviewAt and state.nextReviewAt<=P.Now()) or
        (not state.nextReviewAt and ((state.correctCount or 0)+(state.wrongCount or 0)>0)))
end
function P.StartSession()
    local settings=P.db.settings
    P.showExplanation=nil
    local mode=settings.mode
    if mode=='exam' then
        settings.category=''
        settings.length=100
    elseif mode=='category' then
        settings.length=0
    else
        settings.category=''
    end
    local candidates={}
    for _,q in ipairs(P.bank.questions) do
        local state=P.db.derived[tostring(q.id)] or {}
        local category=settings.category=='' or settings.category==q.topic
        local include=category and (mode~='due' or P.IsDue(state)) and
            (mode~='weakness' or (state.wrongCount or 0)>0 or ((state.correctCount or 0)>0 and (state.masteryLevel or 0)<3))
        if include then
            local weight=1
            if mode=='weakness' or mode=='due' then
                weight=1+(state.wrongCount or 0)*2+(5-(state.masteryLevel or 0))+(P.IsDue(state) and 3 or 0)
            end
            candidates[#candidates+1]={q=q,key=-math.log(math.max(0.000001,math.random()))/weight}
        end
    end
    table.sort(candidates,function(a,b) return a.key<b.key end)
    local length=mode=='exam' and 100 or settings.length
    local count=length==0 and #candidates or math.min(length,#candidates)
    local ids={}; for i=1,count do ids[i]=candidates[i].q.id end
    P.db.sessionSequence=(P.db.sessionSequence or 0)+1
    P.db.session={id='wow-session:'..P.db.installId..':'..P.db.sessionSequence,ids=ids,index=1,
        mode=mode,answered=0,correct=0,selected=nil,revealed=false,results={},resultsById={},endless=length==0,
        bankVersion=P.bank.bankVersion,startedAt=P.Now(),elapsedSeconds=0,answersById={},recordedById={}}
    if P.scroll then P.scroll:SetVerticalScroll(0) end
    if P.Refresh then P.Refresh() end
end
function P.CurrentQuestion()
    local s=P.db.session
    local review=P.CurrentWrongResult and P.CurrentWrongResult(s)
    if review then return P.byId[tostring(review.questionId)] end
    return s and P.byId[tostring(s.ids[s.index])] or nil
end
local function wrongResults(session)
    local wrong={}
    for _,result in ipairs((session and session.results) or {}) do
        if not result.isCorrect then wrong[#wrong+1]=result end
    end
    return wrong
end
function P.WrongResultCount(session)
    return #wrongResults(session or (P.db and P.db.session))
end
function P.IsWrongReview(session)
    local s=session or (P.db and P.db.session)
    return P.IsForeverExam(s) and type(s.reviewWrongIndex)=='number' and s.reviewWrongIndex>=1
end
function P.CurrentWrongResult(session)
    local s=session or (P.db and P.db.session)
    if not P.IsWrongReview(s) then return nil end
    return wrongResults(s)[s.reviewWrongIndex]
end
local function restoreWrongReviewState(session)
    local result=P.CurrentWrongResult(session)
    if not result then return false end
    session.selected=result.selected
    session.revealed=true
    return true
end
function P.StartWrongReview()
    local s=P.db and P.db.session
    if not P.IsForeverExam(s) or P.WrongResultCount(s)==0 then return end
    s.reviewWrongIndex=1
    restoreWrongReviewState(s)
    if P.scroll then P.scroll:SetVerticalScroll(0) end
    P.Refresh()
end
function P.EndWrongReview()
    local s=P.db and P.db.session
    if not s then return end
    s.reviewWrongIndex=nil; s.selected=nil; s.revealed=false
    if P.scroll then P.scroll:SetVerticalScroll(0) end
    P.Refresh()
end
function P.Select(index)
    local s=P.db.session
    if not s or P.IsWrongReview(s) or (s.revealed and not P.IsForeverExam(s)) then return end
    s.selected=index
    if P.IsForeverExam(s) then
        s.answersById=s.answersById or {}
        s.answersById[tostring(s.ids[s.index])]=index
        s.answered=countExamAnswers(s)
    end
    P.Refresh()
end
function P.Submit()
    local s=P.db.session; local q=P.CurrentQuestion()
    if not s or not q or s.revealed or not s.selected then return end
    if P.IsForeverExam(s) then return end
    local event=P.RecordAnswer(q,s.selected,s)
    if not event then return end
    s.revealed=true; s.answered=s.answered+1; s.correct=s.correct+(event.isCorrect and 1 or 0)
    local res={questionId=q.id,selected=s.selected,isCorrect=event.isCorrect}
    s.results[#s.results+1]=res
    s.resultsById=s.resultsById or {}
    s.resultsById[tostring(q.id)]=res
    P.Refresh()
end
function P.CompleteForeverExam()
    local s=P.db.session
    if not P.IsForeverExam(s) then return end
    s.results={}; s.resultsById={}; s.answered=0; s.correct=0
    s.recordedById=s.recordedById or {}
    for _,questionId in ipairs(s.ids) do
        local id=tostring(questionId)
        local q=P.byId[id]
        local selected=s.answersById and s.answersById[id]
        if q and selected then
            local isCorrect=selected-1==q.correct
            if s.recordedById[id]~=selected then
                P.RecordAnswer(q,selected,s)
                s.recordedById[id]=selected
            end
            local result={questionId=q.id,selected=selected,isCorrect=isCorrect}
            s.results[#s.results+1]=result; s.resultsById[id]=result
            s.answered=s.answered+1; s.correct=s.correct+(isCorrect and 1 or 0)
        end
    end
    s.completedAt=P.Now(); s.reviewWrongIndex=nil; s.selected=nil; s.revealed=false; s.index=#s.ids+1
    if P.scroll then P.scroll:SetVerticalScroll(0) end
    P.Refresh()
end
function P.RestoreQuestionState()
    local s=P.db.session
    if not s then return end
    local q=P.CurrentQuestion()
    P.showExplanation=nil
    if q and P.IsForeverExam(s) then
        s.answersById=s.answersById or {}
        s.selected=s.answersById[tostring(q.id)]
        s.revealed=false
    elseif q and s.resultsById and s.resultsById[tostring(q.id)] then
        local res=s.resultsById[tostring(q.id)]
        s.selected=res.selected
        s.revealed=true
    else
        s.selected=nil
        s.revealed=false
    end
end
function P.Prev()
    local s=P.db.session
    if P.IsWrongReview(s) then
        if s.reviewWrongIndex<=1 then return end
        s.reviewWrongIndex=s.reviewWrongIndex-1; restoreWrongReviewState(s)
        if P.scroll then P.scroll:SetVerticalScroll(0) end
        P.Refresh(); return
    end
    if not s or s.index<=1 then return end
    s.index=s.index-1
    while s.index>1 and not P.byId[tostring(s.ids[s.index])] do s.index=s.index-1 end
    P.RestoreQuestionState()
    if P.scroll then P.scroll:SetVerticalScroll(0) end
    P.Refresh()
end
function P.Next()
    local s=P.db.session
    if not s then return end
    if P.IsWrongReview(s) then
        if s.reviewWrongIndex>=P.WrongResultCount(s) then P.EndWrongReview(); return end
        s.reviewWrongIndex=s.reviewWrongIndex+1; restoreWrongReviewState(s)
        if P.scroll then P.scroll:SetVerticalScroll(0) end
        P.Refresh(); return
    end
    if P.IsForeverExam(s) and s.index>=#s.ids then
        P.CompleteForeverExam()
        return
    end
    if s.index>=#s.ids then
        if s.revealed then
            s.index=#s.ids+1
            if s.endless then P.StartSession(); return end
            if P.scroll then P.scroll:SetVerticalScroll(0) end
            P.Refresh()
        end
        return
    end
    s.index=s.index+1
    while s.index<=#s.ids and not P.byId[tostring(s.ids[s.index])] do s.index=s.index+1 end
    if s.index>#s.ids and s.endless then P.StartSession(); return end
    P.RestoreQuestionState()
    if P.scroll then P.scroll:SetVerticalScroll(0) end
    P.Refresh()
end
