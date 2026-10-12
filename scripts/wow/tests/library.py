"""Stage-one library checks using the shared nonvisual native UI harness."""
from pathlib import Path
import runpy
root=Path(__file__).resolve().parent
vm=runpy.run_path(str(root/'appearance.py'))['vm']
vm.execute(r'''
assert(P.NormalizeSearch('ΚΑΤΆΘΛΙΨΗ')==P.NormalizeSearch('κατάθλιψη'))
assert(P.NormalizeSearch('ΨΥΧΩΣΕΙΣ')==P.NormalizeSearch('ψυχώσεις'))
assert(P.NormalizeSearch('Ϊ Ϋ ΐ ΰ')=='ι υ ι υ')
P.bank={bankVersion='search-test',questions={
    {id=3,topic='Διάθεση',stem='Πότε εμφανίζεται κατάθλιψη;',correct=0,options={'A','B'}},
    {id=1,topic='Διάθεση',stem='ΚΑΤΑΘΛΙΨΗ και A+B',correct=0,options={'A','B'}},
    {id=2,topic='Ψυχώσεις',stem='Διάγνωση ψυχώσεων',correct=0,options={'A','B'}}}}
P.db={settings=P.Copy(P.defaults),derived={['1']={correctCount=3,wrongCount=1,masteryLevel=5,nextReviewAt=1},
    ['3']={wrongCount=2,masteryLevel=1,nextReviewAt=2000000000},
    ['999']={correctCount=1000,wrongCount=1000,masteryLevel=5}},installId='test'}
P.InitializeQuiz(); P.StartSession(); P.Select(2)
local saved=P.db.session
local results,total=P.SearchQuestions('ΚΑΤΆΘΛΙΨΗ')
assert(total==2 and results[1].id==1 and results[2].id==3)
results,total=P.SearchQuestions('διάθεση καταθλιψη'); assert(total==2)
results,total=P.SearchQuestions('a+b'); assert(total==1 and results[1].id==1,'search interpreted patterns')
results,total=P.SearchQuestions('#3'); assert(total==1 and results[1].id==3)
assert(select(2,P.SearchQuestions('ψυχώσεις'))==1)
assert(select(2,P.SearchQuestions('unknown'))==0 and select(2,P.SearchQuestions(' '))==0)
local overview=P.ProgressOverview()
assert(overview.total==3 and overview.attempted==2 and overview.mastered==1 and overview.due==1)
assert(overview.correct==3 and overview.wrong==3,'removed bank items contaminated overview')
assert(overview.topics['Διάθεση'].attempted==2 and overview.topics['Ψυχώσεις'].attempted==0)
P.gear.scripts.OnClick(); assert(P.menuTitle.value=='PsychQuiz')
P.OpenProgress(); assert(P.db.session==saved and saved.selected==2)
P.rowPool[2].scripts.OnClick(); assert(P.menuTitle.value=='Έναρξη συνεδρίας' and P.db.session==saved)
P.OpenSearch(); assert(P.searchBox.autoFocus==false and P.db.session==saved)
P.searchBox:SetText('καταθλιψη'); P.searchBox:SetFocus(); P.searchBox.scripts.OnEnterPressed(P.searchBox)
assert(not P.searchBox.focus and P.searchQuery=='καταθλιψη')
P.rowPool[3].scripts.OnClick(); assert(P.menuTitle.value=='MCQ #1' and P.db.session==saved)
P.rowPool[2].scripts.OnClick()
assert(P.db.session~=saved and #P.db.session.ids==1 and P.CurrentQuestion().id==1)
assert(not P.db.session.revealed and P.db.session.selected==nil)
P.Select(2); P.Submit(); P.Next(); P.StartWrongRetake()
assert(#P.db.session.ids==1 and P.db.session.selected==nil,'single search question could not be retaken')
P.OpenSearch(); P.searchBox:SetFocus(); P.searchBox.scripts.OnEscapePressed()
assert(not P.menu.visible and not P.searchBox.focus)
-- Search result cap is explicit, stable, and invalidates after bank replacement.
P.bank={bankVersion='new-search-bank',questions={}}
for i=60,1,-1 do P.bank.questions[#P.bank.questions+1]={id=i,topic='Common',stem='common question',options={},correct=0} end
results,total=P.SearchQuestions('common')
assert(total==60 and #results==40 and results[1].id==1 and results[40].id==40)
assert(select(2,P.SearchQuestions('καταθλιψη'))==0,'stale index survived bank replacement')
''')
print('PASS: Greek search, exact IDs, plain substring matching, current-bank progress, non-destructive browsing, native search callbacks, one-question practice/retakes, focus cleanup, caps and cache invalidation.')
