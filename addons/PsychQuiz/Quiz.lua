local _,P=...
P.modeLabels={random='Τυχαίες',category='Ανά κατηγορία',weakness='Αδύναμες',due='Για επανάληψη',exam='Εξέταση'}
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
    end
end
function P.IsDue(state)
    return state and ((state.nextReviewAt and state.nextReviewAt<=P.Now()) or
        (not state.nextReviewAt and ((state.correctCount or 0)+(state.wrongCount or 0)>0)))
end
function P.StartSession()
    if P.IsCombat() then return end
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
        mode=mode,answered=0,correct=0,selected=nil,revealed=false,results={},resultsById={},endless=length==0,bankVersion=P.bank.bankVersion}
    if P.scroll then P.scroll:SetVerticalScroll(0) end
    if P.Refresh then P.Refresh() end
end
function P.CurrentQuestion()
    local s=P.db.session
    return s and P.byId[tostring(s.ids[s.index])] or nil
end
function P.Select(index)
    local s=P.db.session
    if not s or s.revealed or P.IsCombat() then return end
    s.selected=index; P.Refresh()
end
function P.Submit()
    local s=P.db.session; local q=P.CurrentQuestion()
    if not s or not q or s.revealed or not s.selected or P.IsCombat() then return end
    local event=P.RecordAnswer(q,s.selected,s)
    if not event then return end
    s.revealed=true; s.answered=s.answered+1; s.correct=s.correct+(event.isCorrect and 1 or 0)
    local res={questionId=q.id,selected=s.selected,isCorrect=event.isCorrect}
    s.results[#s.results+1]=res
    s.resultsById=s.resultsById or {}
    s.resultsById[tostring(q.id)]=res
    P.Refresh()
end
function P.RestoreQuestionState()
    local s=P.db.session
    if not s then return end
    local q=P.CurrentQuestion()
    P.showExplanation=nil
    if q and s.resultsById and s.resultsById[tostring(q.id)] then
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
    if not s or s.index<=1 then return end
    s.index=s.index-1
    while s.index>1 and not P.byId[tostring(s.ids[s.index])] do s.index=s.index-1 end
    P.RestoreQuestionState()
    if P.scroll then P.scroll:SetVerticalScroll(0) end
    P.Refresh()
end
function P.Next()
    local s=P.db.session
    if not s or P.IsCombat() then return end
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
