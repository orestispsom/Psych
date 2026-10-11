"""All-mode wrong-answer review regression checks; nonvisual Lua 5.1 runtime."""
from pathlib import Path
from lupa.lua51 import LuaRuntime
root = Path(__file__).resolve().parents[3]
vm = LuaRuntime(unpack_returned_tuples=True)
vm.execute("P={}; unpack=unpack or table.unpack")
for name in ['Quiz.lua', 'UI.lua']:
    vm.execute('local f=assert(loadstring(...)); f("PsychQuiz",P)',
               (root/'addons/PsychQuiz'/name).read_text(encoding='utf8'))
vm.execute(r'''
function region()
    return {SetText=function(self,t) self.value=t end,SetShown=function(self,v) self.visible=v end,
        SetEnabled=function() end,SetAlpha=function() end,IsEnabled=function() return true end}
end
P.colors={}; P.frame={}; P.Layout=function() end; P.RefreshAnswers=function() end
P.compact=region(); P.topic=region(); P.progress=region(); P.feedback=region(); P.stem=region()
P.headerMode={label=region()}; P.action=region(); P.action.label=region()
P.summaryNewBtn=region(); P.answers={region(),region()}
P.Now=function() return 1800000000 end
P.bank={bankVersion='test',questions={
    {id=1,topic='A',stem='First',correct=0,options={'correct','wrong'},explanation='First explanation'},
    {id=2,topic='A',stem='Second',correct=0,options={'correct','wrong'},explanation='Second explanation'},
    {id=3,topic='A',stem='Third',correct=0,options={'correct','wrong'},explanation='Third explanation'}}}
local events=0
P.RecordAnswer=function(q,selected,s)
    events=events+1; return {isCorrect=selected-1==q.correct}
end
for _,forever in ipairs({false,true}) do
    P.isForever=forever
    for _,mode in ipairs({'random','category','weakness','due','exam'}) do
        P.db={installId='test',settings={mode=mode,category='',length=10},derived={}}
        for i=1,3 do P.db.derived[tostring(i)]={wrongCount=1,nextReviewAt=1} end
        P.InitializeQuiz(); P.StartSession()
        local s=P.db.session
        P.StartWrongReview(); assert(not P.IsWrongReview(),'review opened during active session')
        local first=P.CurrentQuestion().id
        P.Select(2); if not P.IsForeverExam(s) then P.Submit() end
        P.Next(); P.Select(1); if not P.IsForeverExam(s) then P.Submit() end
        P.Next(); local last=P.CurrentQuestion().id
        P.Select(2); if not P.IsForeverExam(s) then P.Submit() end
        P.Next()
        assert(P.db.session==s and P.CurrentQuestion()==nil,'session silently restarted')
        assert(P.WrongResultCount()==2 and s.answered==3 and s.correct==1)
        assert(P.action.label.value=='Λάθη (2)' and P.summaryNewBtn.visible)
        local recorded=events
        P.StartWrongReview()
        assert(P.CurrentQuestion().id==first and s.selected==2 and s.revealed)
        assert(P.feedback.value:find(P.CurrentQuestion().explanation,1,true))
        assert(P.feedback.value:find('Η απάντησή σου',1,true) and P.feedback.value:find('Σωστή απάντηση',1,true))
        assert(not P.summaryNewBtn.visible)
        P.Select(1); P.Submit(); assert(s.selected==2 and events==recorded)
        P.Next(); assert(P.CurrentQuestion().id==last and s.reviewWrongIndex==2)
        P.InitializeQuiz(); P.Refresh()
        assert(P.CurrentQuestion().id==last and s.revealed and s.selected==2,'reload lost review')
        P.Prev(); assert(P.CurrentQuestion().id==first)
        P.Next(); P.Next()
        assert(not P.IsWrongReview() and P.CurrentQuestion()==nil)
        assert(events==recorded and s.correct==1 and s.answered==3,'review mutated results')
        P.StartWrongReview(); s.bankVersion='old'; P.InitializeQuiz()
        assert(s.index==#s.ids+1 and s.selected==2 and s.revealed,'bank refresh corrupted summary index')
        P.EndWrongReview()
        s.results={}; P.Refresh(); P.StartWrongReview()
        assert(not P.IsWrongReview() and P.action.label.value=='Νέα συνεδρία' and not P.summaryNewBtn.visible)
        s.results={{questionId=999,selected=2,isCorrect=false}}
        assert(P.WrongResultCount()==0,'removed bank question entered review')
        P.StartSession(); assert(P.db.session~=s and not P.IsWrongReview())
    end
end
-- All-questions lengths also retain the finished session instead of erasing results.
P.isForever=false
for _,mode in ipairs({'random','weakness','due'}) do
    P.db.settings.mode=mode; P.db.settings.length=0; P.StartSession()
    local s=P.db.session
    for i=1,#s.ids do P.Select(2); P.Submit(); P.Next() end
    assert(P.db.session==s and P.CurrentQuestion()==nil and P.WrongResultCount()==3)
end
''')
print('PASS: both clients, all five modes, all-question sessions, summary controls, read-only review, navigation, reload, bank updates, empty/no-wrong results.')
