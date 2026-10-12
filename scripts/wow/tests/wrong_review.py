"""All-mode wrong-answer review regression checks; nonvisual Lua 5.1 runtime."""
from pathlib import Path
from lupa.lua51 import LuaRuntime
root = Path(__file__).resolve().parents[3]
vm = LuaRuntime(unpack_returned_tuples=True)
vm.execute("""P={}; unpack=unpack or table.unpack; SlashCmdList={}
function GetBuildInfo() return '', '', '', 16001 end
function CreateFrame() return {RegisterEvent=function() end,SetScript=function() end} end
""")
for name in ['Core.lua', 'Quiz.lua', 'UI.lua']:
    vm.execute('local f=assert(loadstring(...)); f("PsychQuiz",P)',
               (root/'addons/PsychQuiz'/name).read_text(encoding='utf8'))
vm.execute(r'''
function region()
    return {SetText=function(self,t) self.value=t end,SetShown=function(self,v) self.visible=v end,
        SetEnabled=function() end,SetAlpha=function() end,SetColorTexture=function() end,SetTextColor=function() end,IsEnabled=function() return true end}
end
P.frame={}; P.Layout=function() end; P.RefreshAnswers=function() end
P.compact=region(); P.topic=region(); P.progress=region(); P.feedback=region(); P.stem=region()
P.headerMode={label=region()}; P.action=region(); P.action.label=region(); P.action.bg=region()
P.summaryNewBtn=region(); P.answers={region(),region()}
P.Now=function() return 1800000000 end
P.bank={bankVersion='test',questions={}}
for i=1,10 do
    P.bank.questions[i]={id=i,topic='A',stem='Question '..i,correct=0,
        options={'correct','wrong'},explanation='Explanation '..i}
end
local events={}
P.RecordAnswer=function(q,selected,s)
    events[#events+1]={questionId=q.id,selected=selected,sessionId=s.id}
    return {isCorrect=selected-1==q.correct}
end
local function answerRun(wrongCount)
    local s=P.db.session
    for i=1,#s.ids do
        P.Select(i<=wrongCount and 2 or 1)
        if not P.IsForeverExam(s) then P.Submit(); P.Submit() end
        P.Next()
    end
    assert(P.db.session==s and not P.CurrentQuestion(),'completed run was replaced automatically')
    assert(P.WrongResultCount()==wrongCount and s.answered==#s.ids)
    assert(s.correct==#s.ids-wrongCount)
    assert(P.summaryNewBtn.visible==(wrongCount>0))
    assert(P.action.label.value==(wrongCount>0 and ('Ξανά λάθη ('..wrongCount..')') or 'Νέα συνεδρία'))
end
for _,forever in ipairs({false,true}) do
    P.isForever=forever
    for _,mode in ipairs({'random','category','weakness','due','exam'}) do
        P.db={installId='test',settings={mode=mode,category='',length=10},derived={}}
        for i=1,10 do P.db.derived[tostring(i)]={wrongCount=1,nextReviewAt=1} end
        P.InitializeQuiz(); P.StartSession()
        local first=P.db.session; local count=#events
        P.StartWrongRetake(); assert(P.db.session==first,'active run allowed a retake')
        answerRun(5)
        assert(#events==count+10,'initial run not recorded exactly once')
        local expected={}
        for _,result in ipairs(first.results) do if not result.isCorrect then expected[#expected+1]=result.questionId end end
        P.StartWrongRetake()
        local retry=P.db.session
        assert(retry~=first and retry.id~=first.id and retry.mode==mode and retry.retryRound==1)
        assert(#retry.ids==5 and retry.correct==0 and retry.answered==0 and #retry.results==0)
        for i,id in ipairs(retry.ids) do assert(id==expected[i],'retake included a correct question') end
        assert(retry.selected==nil and not retry.revealed and next(retry.answersById)==nil)
        assert(P.feedback.value=='' and not P.summaryNewBtn.visible,'previous answers leaked into retake')
        P.Select(2); P.InitializeQuiz(); P.Refresh()
        assert(P.db.session==retry and retry.selected==2,'reload lost active retake choice')
        answerRun(2)
        assert(#events==count+15,'retake did not record five new answers exactly once')
        P.StartWrongRetake()
        local second=P.db.session
        assert(second.id~=retry.id and #second.ids==2 and second.retryRound==2)
        assert(second.ids[1]==retry.ids[1] and second.ids[2]==retry.ids[2])
        answerRun(0)
        assert(#events==count+17)
        P.StartWrongRetake(); assert(P.db.session==second,'empty retry created a run')
        P.StartSession(); assert(P.db.session~=second and #P.db.session.ids==10 and P.db.session.retryRound==0)
        -- Unknown/deleted questions never become retry items.
        P.db.session.index=11; P.db.session.results={{questionId=999,selected=2,isCorrect=false}}
        local empty=P.db.session; P.StartWrongRetake(); assert(P.db.session==empty)
    end
end
-- All-question modes stop at their summary before offering the retry choice.
P.isForever=false
for _,mode in ipairs({'random','weakness','due'}) do
    P.db.settings.mode=mode; P.db.settings.length=0; P.StartSession()
    answerRun(5); P.StartWrongRetake(); assert(#P.db.session.ids==5)
end
''')
print('PASS: both clients, all five modes, 10 -> 5 -> 2 -> 0 retakes, fresh runs, new answer events, no leaked answers, reload and all-question sessions.')
