"""Nonvisual native UI interaction and contrast checks; no rendering claim."""
from pathlib import Path
from lupa.lua51 import LuaRuntime
from fontTools.ttLib import TTFont
root = Path(__file__).resolve().parents[3]
vm = LuaRuntime(unpack_returned_tuples=True)
vm.execute(r'''
P={}; SlashCmdList={}; unpack=unpack or table.unpack; frames={}
function GetBuildInfo() return '', '', '', 16001 end
function GetServerTime() return 1800000000 end
local noop=function() end
local methods={
    SetScript=function(self,k,v) self.scripts[k]=v end,
    SetText=function(self,v) self.value=v end,GetText=function(self) return self.value or '' end,
    SetShown=function(self,v) self.visible=v end,Show=function(self) self.visible=true end,
    Hide=function(self) self.visible=false end,IsShown=function(self) return self.visible end,
    SetSize=function(self,w,h) self.width=w; self.height=h end,
    SetWidth=function(self,w) self.width=w end,SetHeight=function(self,h) self.height=h end,
    GetWidth=function(self) return self.width or 410 end,GetHeight=function(self) return self.height or 300 end,
    GetStringHeight=function() return 18 end,GetLeft=function() return 0 end,GetTop=function() return 500 end,
    GetCenter=function() return 200,300 end,GetFrameLevel=function() return 1 end,
    SetEnabled=function(self,v) self.enabled=v end,IsEnabled=function(self) return self.enabled~=false end,
    SetVerticalScroll=function(self,v) self.scroll=v end,GetVerticalScroll=function(self) return self.scroll or 0 end,
    StartMoving=function(self) self.moving=true end,StopMovingOrSizing=function(self) self.moving=false; self.sizing=false end,
    StartSizing=function(self) self.sizing=true end,
    SetColorTexture=function(self,...) self.color={...} end,
    SetTextColor=function(self,...) self.textColor={...} end,
}
function object(kind,parent)
    return setmetatable({kind=kind,parent=parent,scripts={},visible=true}, {__index=function(self,key)
        if key=='Low' or key=='High' then return nil end
        return methods[key] or (key:match('^[A-Z]') and noop or nil)
    end})
end
methods.CreateTexture=function(self) return object('Texture',self) end
methods.CreateFontString=function(self) return object('FontString',self) end
function CreateFrame(kind,name,parent) local f=object(kind,parent); frames[#frames+1]=f; return f end
UIParent=object('Frame'); UIParent.width=1800; UIParent.height=1000
''')
for name in ['Core.lua','Quiz.lua','UI.lua']:
    vm.execute('local f=assert(loadstring(...)); f("PsychQuiz",P)',
               (root/'addons/PsychQuiz'/name).read_text(encoding='utf8'))
vm.execute(r'''
P.db={settings=P.Copy(P.defaults),installId='test',derived={},events={},feedback={}}
P.bank={bankVersion='test',questions={{id=1,topic='A',stem='Question',correct=0,
    options={'correct','wrong','other'},explanation='Long explanation'}}}
P.PendingCount=function() return 0 end
P.RecordAnswer=function(q,i) return {isCorrect=i-1==q.correct} end
P.InitializeQuiz(); P.CreateUI(); P.StartSession()
P.Select(2)
assert(P.answers[2].mark.value=='●' and P.answers[1].mark.value=='○')
P.action.scripts.OnClick()
assert(P.answers[1].mark.value=='✓' and P.answers[2].mark.value=='×')
assert(P.answers[1].bg.color[2]==P.colors.correctFill[2])
assert(P.answers[2].bg.color[1]==P.colors.wrongFill[1])
assert(P.feedback.value:find('Long explanation',1,true) and P.explanationBtn.visible)
P.explanationBtn.scripts.OnClick()
assert(not P.feedback.value:find('Long explanation',1,true))
assert(P.feedback.value:find('Σωστή:',1,true),'hide explanation also hid correct answer')
P.explanationBtn.scripts.OnClick(); assert(P.feedback.value:find('Long explanation',1,true))
P.Next(); assert(not P.explanationBtn.visible)
P.db.settings.mode='exam'; P.StartSession(); P.Select(2); P.Refresh()
assert(P.answers[1].mark.value=='○' and P.answers[2].mark.value=='●','exam leaked correctness')
assert(P.feedback.value=='' and not P.explanationBtn.visible)
P.isForever=false; P.Submit()
assert(P.answers[1].mark.value=='○' and not P.explanationBtn.visible,'Classic exam leaked correctness')
local header
for _,frame in ipairs(frames) do if frame.parent==P.frame and frame.scripts.OnDragStart then header=frame end end
assert(header)
header.scripts.OnDragStart(); assert(P.frame.moving); header.scripts.OnDragStop()
P.OpenSettings(); P.rowPool[1].scripts.OnClick()
assert(P.db.settings.locked and not P.resize.visible)
header.scripts.OnDragStart(); assert(not P.frame.moving,'locked frame moved')
P.resize.scripts.OnMouseDown(nil,'LeftButton'); assert(not P.frame.sizing,'locked frame resized')
P.rowPool[1].scripts.OnClick(); assert(not P.db.settings.locked and P.resize.visible)
P.rowPool[2].scripts.OnClick(); assert(not P.db.settings.autoExplanation)
P.db.settings.mode='random'; P.StartSession(); P.Select(2); P.Submit()
assert(not P.feedback.value:find('Long explanation',1,true) and P.explanationBtn.visible)
P.explanationBtn.scripts.OnClick(); assert(P.feedback.value:find('Long explanation',1,true))
assert(P.gear.label.value=='☰' and P.headerArrow.value=='▾')
''')
colors = vm.globals().P.colors
def rgb(token): return [colors[token][i] for i in range(1,4)]
def luminance(color):
    v=[c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4 for c in color]
    return sum(a*b for a,b in zip(v,[0.2126,0.7152,0.0722]))
def ratio(a,b):
    values=sorted([luminance(a),luminance(b)])
    return (values[1]+0.05)/(values[0]+0.05)
pairs=[('ink','surface'),('muted','surface'),('primaryText','primary'),
       ('ink','button'),('accent','selected'),('correct','correctFill'),('wrong','wrongFill')]
for foreground,background in pairs:
    contrast=ratio(rgb(foreground),rgb(background))
    assert contrast>=4.5,(foreground,background,contrast)
# Default opacity over a white scene; low opacity is user-controlled.
worst=[0.96*c+0.04 for c in rgb('surface')]
assert ratio(rgb('ink'),worst)>=4.5 and ratio(rgb('muted'),worst)>=4.5
font=TTFont(root/'addons/PsychQuiz/Media/NotoSansSymbols2-Regular.ttf')
for char in '☰▾●○✓×': assert any(ord(char) in table.cmap for table in font['cmap'].tables),char
print('PASS: answer colors/icons, exam privacy, explanation toggles, settings, drag/resize lock, default contrast and bundled glyph coverage. Native rendering unverified.')
