local _,P=...
local C=P.colors
local function plain(value) return (tostring(value or ''):gsub('|','||')) end
local function color(region,token,alpha)
    local c=C[token]; region:SetColorTexture(c[1],c[2],c[3],alpha or 1)
end
local function text(parent,size,token)
    local f=parent:CreateFontString(nil,'OVERLAY')
    f:SetFont(P.font,size,''); f:SetTextColor(unpack(C[token or 'ink']))
    f:SetJustifyH('LEFT'); f:SetJustifyV('TOP'); f:SetWordWrap(true)
    return f
end
local function button(parent,label,width,height,action,primary)
    local b=CreateFrame('Button',nil,parent)
    b:SetSize(width,height)
    b.bg=b:CreateTexture(nil,'BACKGROUND'); b.bg:SetAllPoints()
    color(b.bg,primary and 'primary' or 'selected',primary and 1 or 0.35)
    b.label=text(b,14,primary and 'white' or 'ink'); b.label:SetPoint('CENTER')
    b.label:SetJustifyH('CENTER'); b.label:SetText(label)
    b:SetScript('OnEnter',function() color(b.bg,primary and 'primary' or 'hover') end)
    b:SetScript('OnLeave',function() color(b.bg,primary and 'primary' or 'selected',primary and 1 or 0.35) end)
    b:SetScript('OnClick',action)
    return b
end
local function rule(parent,y)
    local t=parent:CreateTexture(nil,'BORDER'); color(t,'rule',0.65)
    t:SetHeight(1); t:SetPoint('TOPLEFT',0,y); t:SetPoint('TOPRIGHT',0,y)
end
local function surface(frame,alpha)
    frame:SetBackdrop({bgFile='Interface\\Buttons\\WHITE8X8',edgeFile='Interface\\Buttons\\WHITE8X8',edgeSize=1})
    frame:SetBackdropColor(C.surface[1],C.surface[2],C.surface[3],alpha)
    frame:SetBackdropBorderColor(C.border[1],C.border[2],C.border[3],0.85)
end
function P.CloseMenu() if P.menu then P.menu:Hide() end end
function P.RestoreGeometry()
    local s=P.db.settings; local f=P.frame
    P.restoring=true
    f:SetResizeBounds(340,s.collapsed and 36 or 300,900,1000)
    f:ClearAllPoints()
    f:SetSize(math.min(s.width,UIParent:GetWidth()-24),s.collapsed and 36 or math.min(s.height,UIParent:GetHeight()-24))
    if s.x and s.y then
        f:SetPoint('CENTER',UIParent,'BOTTOMLEFT',s.x*UIParent:GetWidth(),s.y*UIParent:GetHeight())
    else f:SetPoint('RIGHT',UIParent,'RIGHT',-40,0) end
    P.restoring=false; P.Layout()
end
function P.ToggleCollapse()
    P.CloseMenu(); P.SaveGeometry()
    P.db.settings.collapsed=not P.db.settings.collapsed
    local f=P.frame; local left,top=f:GetLeft(),f:GetTop()
    P.restoring=true
    f:SetResizeBounds(340,P.db.settings.collapsed and 36 or 300,900,1000)
    f:ClearAllPoints(); f:SetPoint('TOPLEFT',UIParent,'BOTTOMLEFT',left,top)
    f:SetHeight(P.db.settings.collapsed and 36 or P.db.settings.height)
    P.restoring=false
    P.Layout(); P.SaveGeometry()
end
function P.MakeAnswer(index)
    local row=CreateFrame('Button',nil,P.content)
    row.bg=row:CreateTexture(nil,'BACKGROUND'); row.bg:SetAllPoints()
    row.rule=row:CreateTexture(nil,'BORDER'); row.rule:SetHeight(1)
    row.rule:SetPoint('BOTTOMLEFT'); row.rule:SetPoint('BOTTOMRIGHT'); color(row.rule,'rule',0.65)
    row.mark=text(row,16); row.mark:SetPoint('TOPLEFT',10,-12); row.mark:SetWidth(24)
    row.mark:SetFont(P.symbolFont,16,'')
    row.letter=text(row,16); row.letter:SetPoint('TOPLEFT',35,-12); row.letter:SetWidth(20)
    row.body=text(row,16); row.body:SetPoint('TOPLEFT',60,-12)
    row:SetScript('OnClick',function() P.Select(index) end)
    row:SetScript('OnEnter',function()
        local s=P.db.session
        if s and not s.revealed and not P.IsCombat() and s.selected~=index then color(row.bg,'hover',0.8) end
    end)
    row:SetScript('OnLeave',function() P.RefreshAnswers() end)
    return row
end
function P.RefreshAnswers()
    local q=P.CurrentQuestion(); local s=P.db.session
    local letters={'Α','Β','Γ','Δ','Ε','ΣΤ','Ζ','Η'}
    for i,row in ipairs(P.answers) do
        if q and i<=#q.options then
            local selected=s.selected==i
            color(row.bg,'selected',selected and 0.85 or 0)
            row.mark:SetText(selected and '●' or '○')
            row.letter:SetText(letters[i] or tostring(i))
            row.body:SetText(plain(q.options[i]))
            local token='ink'
            if s.revealed and s.mode~='exam' then
                if i-1==q.correct then token='correct'; row.mark:SetText('✓')
                elseif selected then token='wrong'; row.mark:SetText('×') end
            end
            row.mark:SetTextColor(unpack(C[token])); row.body:SetTextColor(unpack(C[token]))
            row:EnableMouse(not s.revealed and not P.IsCombat())
        end
    end
end
function P.Layout()
    if not P.frame then return end
    local f=P.frame; local settings=P.db.settings
    local collapsed=settings.collapsed
    P.main:SetShown(not collapsed); P.resize:SetShown(not collapsed)
    P.collapse.label:SetText(collapsed and '+' or '−')
    local w=f:GetWidth()-40
    P.topic:SetWidth(math.max(170,f:GetWidth()-130))
    local modeY=math.max(81,49+P.topic:GetStringHeight()+8)
    P.mode:ClearAllPoints(); P.mode:SetPoint('TOPLEFT',18,-modeY)
    P.bodyRule:ClearAllPoints(); P.bodyRule:SetPoint('TOPLEFT',0,-modeY-39); P.bodyRule:SetPoint('TOPRIGHT',0,-modeY-39)
    P.scroll:ClearAllPoints(); P.scroll:SetPoint('TOPLEFT',18,-modeY-57); P.scroll:SetPoint('BOTTOMRIGHT',-18,76)
    P.scrollbar:ClearAllPoints(); P.scrollbar:SetPoint('TOPRIGHT',-5,-modeY-57); P.scrollbar:SetPoint('BOTTOMRIGHT',-5,76)
    P.content:SetWidth(w)
    local size=settings.fontSize
    P.stem:SetFont(P.font,size+1,''); P.stem:SetWidth(w)
    P.feedback:SetFont(P.font,size,''); P.feedback:SetWidth(w)
    local q=P.CurrentQuestion(); local y=0
    P.stem:SetPoint('TOPLEFT',0,0)
    y=P.stem:GetStringHeight()+18
    for i,row in ipairs(P.answers) do
        row:SetShown(q~=nil and i<=#q.options)
        if q and i<=#q.options then
            row:ClearAllPoints(); row:SetPoint('TOPLEFT',0,-y); row:SetWidth(w)
            row.body:SetFont(P.font,size,''); row.body:SetWidth(w-72)
            local height=math.max(44,row.body:GetStringHeight()+24)
            row:SetHeight(height); y=y+height
        end
    end
    if P.feedback:GetText() and P.feedback:GetText()~='' then
        y=y+18; P.feedback:ClearAllPoints(); P.feedback:SetPoint('TOPLEFT',0,-y)
        y=y+P.feedback:GetStringHeight()+12
    end
    P.content:SetHeight(math.max(1,y))
    P.scroll:UpdateScrollChildRect()
    local range=math.max(0,y-P.scroll:GetHeight())
    P.scroll:SetVerticalScroll(math.min(P.scroll:GetVerticalScroll(),range))
    P.scrollbar:SetMinMaxValues(0,range); P.scrollbar:SetValue(P.scroll:GetVerticalScroll())
    P.scrollbar:SetShown(range>0)
    surface(f,settings.opacity)
    if not P.restoring and not collapsed then P.SaveGeometry() end
end
function P.Refresh()
    if not P.frame then return end
    local s=P.db.session; local q=P.CurrentQuestion(); local combat=P.IsCombat()
    local finished=s and not q
    local score=s and s.answered>0 and (' · '..math.floor(s.correct/s.answered*100+0.5)..'%') or ''
    if s and s.mode=='exam' and not finished then score='' end
    P.compact:SetText(s and (s.answered..'/'..#s.ids..score) or '')
    P.topic:SetText(combat and 'Παύση στη μάχη' or q and q.topic or 'Η μελέτη σου, στον χρόνο σου')
    P.progress:SetText(s and (math.min(s.index,#s.ids)..' / '..#s.ids) or '')
    P.mode.label:SetText(P.modeLabels[s and q and s.mode or P.db.settings.mode]..'  >')
    P.feedback:SetText(''); P.explain:Hide()
    if q then
        P.stem:SetText(plain(q.stem))
        for i=1,#q.options do if not P.answers[i] then P.answers[i]=P.MakeAnswer(i) end end
        P.RefreshAnswers()
        if s.revealed then
            P.action.label:SetText('Επόμενη')
            if s.mode=='exam' then P.feedback:SetText('Η απάντηση καταγράφηκε. Αποτελέσματα στο τέλος.')
            else
                local correct=s.selected-1==q.correct
                local title=correct and 'Σωστή απάντηση' or 'Λάθος απάντηση'
                local message=title..'\n\nΣωστή: '..plain(q.options[q.correct+1])
                if P.db.settings.autoExplanation or P.showExplanation then message=message..'\n\n'..plain(q.explanation)
                else P.explain:Show() end
                P.feedback:SetText(message)
            end
        else P.action.label:SetText('Απάντηση') end
    elseif finished then
        P.stem:SetText(#s.ids==0 and 'Δεν υπάρχουν ερωτήσεις για αυτά τα φίλτρα.' or 'Η συνεδρία ολοκληρώθηκε')
        local out={s.correct..' σωστές από '..s.answered..' απαντήσεις.'}
        if s.mode=='exam' then
            for _,result in ipairs(s.results) do
                local item=P.byId[tostring(result.questionId)]
                if item then
                    out[#out+1]=(result.isCorrect and 'Σωστά: ' or 'Λάθος: ')..plain(item.stem)..'\nΣωστή: '..plain(item.options[item.correct+1])..'\n'..plain(item.explanation)
                end
            end
        end
        P.feedback:SetText(table.concat(out,'\n\n')); P.action.label:SetText('Νέα συνεδρία')
    else
        P.stem:SetText('Λίγος χρόνος για μία ερώτηση.')
        P.feedback:SetText('Επίλεξε τρόπο μελέτης και ξεκίνα όταν έχεις χρόνο.\n\n'..#P.bank.questions..' ερωτήσεις · '..#P.topics..' κατηγορίες\n\nΣύρε την κεφαλίδα για μετακίνηση και την κάτω γωνία για αλλαγή μεγέθους.')
        P.action.label:SetText('Έναρξη')
    end
    P.action:SetEnabled(not combat and (not q or s.revealed or s.selected~=nil))
    P.action.label:SetAlpha(P.action:IsEnabled() and 1 or 0.5)
    P.status:SetText(combat and 'Η μελέτη συνεχίζεται μετά τη μάχη.' or s and s.revealed and 'Καταγράφηκε τοπικά' or 'Με τον δικό σου ρυθμό')
    P.Layout()
end
local function menuRow(label,action)
    P.rowCursor=(P.rowCursor or 0)+1
    P.rowPool=P.rowPool or {}
    local b=P.rowPool[P.rowCursor]
    if not b then b=button(P.menuContent,label,100,34,action); P.rowPool[P.rowCursor]=b end
    b:ClearAllPoints(); b:SetHeight(34); b.label:SetWidth(0); b.label:SetFont(P.font,14,'')
    b.label:SetText(label); b:SetScript('OnClick',action); b:Show()
    b.label:SetJustifyH('LEFT'); b.label:ClearAllPoints(); b.label:SetPoint('LEFT',10,0)
    b:SetPoint('TOPLEFT',0,-P.menuY); b:SetPoint('RIGHT',P.menuContent,'RIGHT',0,0)
    P.menuY=P.menuY+38; P.menuRows[#P.menuRows+1]=b
    return b
end
local function menuTitle(label)
    P.titleCursor=(P.titleCursor or 0)+1; P.titlePool=P.titlePool or {}
    local f=P.titlePool[P.titleCursor] or text(P.menuContent,13,'muted'); P.titlePool[P.titleCursor]=f
    f:ClearAllPoints(); f:SetWidth(P.frame:GetWidth()-68); f:SetText(label); f:SetPoint('TOPLEFT',6,-P.menuY-5); f:Show()
    P.menuY=P.menuY+math.max(30,f:GetStringHeight()+14); P.menuRows[#P.menuRows+1]=f
end
local function menuSlider(label,minimum,maximum,step,value,onChange)
    menuTitle(label)
    P.sliderCursor=(P.sliderCursor or 0)+1; P.sliderPool=P.sliderPool or {}
    local slider=P.sliderPool[P.sliderCursor] or CreateFrame('Slider',nil,P.menuContent,'OptionsSliderTemplate')
    P.sliderPool[P.sliderCursor]=slider; slider:SetScript('OnValueChanged',nil); slider:ClearAllPoints(); slider:Show()
    slider:SetPoint('TOPLEFT',12,-P.menuY); slider:SetPoint('RIGHT',P.menuContent,'RIGHT',-12,0)
    slider:SetHeight(20); slider:SetMinMaxValues(minimum,maximum); slider:SetValueStep(step)
    slider:SetObeyStepOnDrag(true); slider:SetValue(value)
    if slider.Low then slider.Low:SetText('') end; if slider.High then slider.High:SetText('') end
    slider:SetScript('OnValueChanged',function(_,v) onChange(v); P.Refresh() end)
    P.menuY=P.menuY+32; P.menuRows[#P.menuRows+1]=slider
end
function P.OpenMenu(page)
    if P.IsCombat() then return end
    if not P.menu then
        local m=CreateFrame('Frame',nil,P.frame,'BackdropTemplate'); P.menu=m
        m:SetPoint('TOPLEFT',12,-42); m:SetPoint('BOTTOMRIGHT',-12,62)
        m:SetFrameLevel(P.frame:GetFrameLevel()+30); m:EnableMouse(true); surface(m,1)
        local title=text(m,16); title:SetText('Μελέτη & εμφάνιση'); title:SetPoint('TOPLEFT',14,-14)
        local close=button(m,'×',28,28,P.CloseMenu); close:SetPoint('TOPRIGHT',-8,-8)
        P.menuScroll=CreateFrame('ScrollFrame',nil,m)
        P.menuScroll:SetPoint('TOPLEFT',10,-48); P.menuScroll:SetPoint('BOTTOMRIGHT',-10,10)
        P.menuContent=CreateFrame('Frame',nil,P.menuScroll); P.menuScroll:SetScrollChild(P.menuContent)
        P.menuScroll:EnableMouseWheel(true)
        P.menuScroll:SetScript('OnMouseWheel',function(self,delta)
            self:SetVerticalScroll(math.max(0,math.min(self:GetVerticalScroll()-delta*42,math.max(0,P.menuY-self:GetHeight()))))
        end)
    end
    for _,row in ipairs(P.menuRows or {}) do row:Hide() end
    P.menuRows={}; P.menuY=0; P.rowCursor=0; P.titleCursor=0; P.sliderCursor=0; P.menu:Show()
    P.menuContent:SetWidth(P.frame:GetWidth()-44)
    local settings=P.db.settings
    if page=='categories' then
        menuRow('‹ Πίσω',function() P.OpenMenu() end)
        menuRow('Όλες οι κατηγορίες',function() settings.category=''; P.OpenMenu() end)
        for _,topic in ipairs(P.topics) do
            local value=topic
            local b=menuRow(value,function() settings.category=value; P.OpenMenu() end)
            b.label:SetWidth(P.frame:GetWidth()-68); b.label:SetFont(P.font,13,'')
            local h=math.max(34,b.label:GetStringHeight()+16); b:SetHeight(h); P.menuY=P.menuY+h-34
        end
    elseif page=='confirm' then
        menuTitle('Νέα συνεδρία; Το ιστορικό απαντήσεων διατηρείται.')
        menuRow('Συνέχεια τρέχουσας',P.CloseMenu)
        menuRow('Έναρξη νέας συνεδρίας',function() P.CloseMenu(); P.StartSession() end)
    else
        menuTitle('Τρόπος μελέτης · ισχύει στη νέα συνεδρία')
        for _,mode in ipairs({'random','category','weakness','due','exam','quick'}) do
            local value=mode
            menuRow((settings.mode==value and '[x] ' or '[ ] ')..P.modeLabels[value],function()
                settings.mode=value; P.OpenMenu(); P.Refresh()
            end)
        end
        menuTitle('Κατηγορία')
        local cat=menuRow(settings.category=='' and 'Όλες οι κατηγορίες  ›' or settings.category,function() P.OpenMenu('categories') end)
        cat.label:SetWidth(P.frame:GetWidth()-70); cat.label:SetFont(P.font,12,'')
        local catHeight=math.max(34,cat.label:GetStringHeight()+16); cat:SetHeight(catHeight); P.menuY=P.menuY+catHeight-34
        menuTitle('Ερωτήσεις ανά συνεδρία')
        for _,n in ipairs({10,25,50,100,0}) do
            local value=n
            menuRow((settings.length==value and '[x] ' or '[ ] ')..(value==0 and 'Χωρίς όριο' or tostring(value)),function()
                settings.length=value; P.OpenMenu()
            end)
        end
        menuRow('Νέα συνεδρία',function() P.OpenMenu('confirm') end)
        menuSlider('Αδιαφάνεια φόντου',0.65,1,0.01,settings.opacity,function(v) settings.opacity=v end)
        menuSlider('Μέγεθος γραμμάτων',14,24,1,settings.fontSize,function(v) settings.fontSize=math.floor(v+0.5) end)
        menuRow((settings.autoExplanation and '[x] ' or '[ ] ')..'Αυτόματη αιτιολόγηση',function()
            settings.autoExplanation=not settings.autoExplanation; P.OpenMenu(); P.Refresh()
        end)
        menuTitle(P.PendingCount()..' απαντήσεις χωρίς επιβεβαίωση συγχρονισμού')
        if P.db.baselineUpdateDeferred then menuTitle('Η νέα εισαγωγή αναμένει τον συγχρονισμό των τοπικών απαντήσεων.') end
        menuTitle('Για εξαγωγή: /reload και μετά το εξωτερικό εργαλείο.')
    end
    P.menuContent:SetHeight(math.max(1,P.menuY)); P.menuScroll:SetVerticalScroll(0)
end
function P.CreateUI()
    local f=CreateFrame('Frame','PsychQuizFrame',UIParent,'BackdropTemplate'); P.frame=f
    f:Hide(); f:SetFrameStrata('MEDIUM'); f:SetClampedToScreen(true)
    f:SetMovable(true); f:SetResizable(true); f:SetResizeBounds(340,300,900,1000); f:EnableMouse(true)
    local header=CreateFrame('Frame',nil,f); header:SetPoint('TOPLEFT'); header:SetPoint('TOPRIGHT'); header:SetHeight(36)
    header:EnableMouse(true); header:RegisterForDrag('LeftButton')
    header:SetScript('OnDragStart',function() P.CloseMenu(); f:StartMoving() end)
    header:SetScript('OnDragStop',function() f:StopMovingOrSizing(); P.SaveGeometry() end)
    local title=text(header,18); title:SetText('PsychQuiz'); title:SetPoint('LEFT',16,0)
    P.compact=text(header,12,'muted'); P.compact:SetPoint('RIGHT',-83,0)
    P.collapse=button(header,'−',28,26,P.ToggleCollapse); P.collapse:SetPoint('RIGHT',-42,0)
    local close=button(header,'×',28,26,function() P.db.settings.open=false; f:Hide() end); close:SetPoint('RIGHT',-10,0)
    rule(f,-36)
    P.main=CreateFrame('Frame',nil,f); P.main:SetAllPoints()
    P.topic=text(P.main,13,'muted'); P.topic:SetPoint('TOPLEFT',18,-49); P.topic:SetWidth(255)
    P.progress=text(P.main,13,'muted'); P.progress:SetPoint('TOPRIGHT',-18,-49)
    P.mode=button(P.main,'',148,28,function()
        if P.menu and P.menu:IsShown() then P.CloseMenu() else P.OpenMenu() end
    end); P.mode:SetPoint('TOPLEFT',18,-81)
    P.bodyRule=P.main:CreateTexture(nil,'BORDER'); color(P.bodyRule,'rule',0.65); P.bodyRule:SetHeight(1)
    P.scroll=CreateFrame('ScrollFrame',nil,P.main); P.scroll:SetPoint('TOPLEFT',18,-138); P.scroll:SetPoint('BOTTOMRIGHT',-18,76)
    P.content=CreateFrame('Frame',nil,P.scroll); P.scroll:SetScrollChild(P.content)
    P.scroll:EnableMouseWheel(true)
    P.scroll:SetScript('OnMouseWheel',function(self,delta)
        local range=math.max(0,P.content:GetHeight()-self:GetHeight())
        local value=math.max(0,math.min(range,self:GetVerticalScroll()-delta*42))
        self:SetVerticalScroll(value); P.scrollbar:SetValue(value)
    end)
    P.scrollbar=CreateFrame('Slider',nil,P.main)
    P.scrollbar:SetPoint('TOPRIGHT',-5,-138); P.scrollbar:SetPoint('BOTTOMRIGHT',-5,76); P.scrollbar:SetWidth(6)
    P.scrollbar:SetOrientation('VERTICAL'); P.scrollbar:SetMinMaxValues(0,1)
    local thumb=P.scrollbar:CreateTexture(nil,'ARTWORK'); thumb:SetSize(4,30); color(thumb,'primary',0.55)
    P.scrollbar:SetThumbTexture(thumb)
    P.scrollbar:SetScript('OnValueChanged',function(_,v) P.scroll:SetVerticalScroll(v) end)
    P.stem=text(P.content,17); P.feedback=text(P.content,16); P.answers={}
    P.action=button(P.main,'Έναρξη',146,36,function()
        if not P.CurrentQuestion() then P.StartSession()
        elseif P.db.session.revealed then P.Next() else P.Submit() end
    end,true); P.action:SetPoint('BOTTOMRIGHT',-18,17)
    P.explain=button(P.main,'Αιτιολόγηση',125,30,function() P.showExplanation=true; P.Refresh() end)
    P.explain:SetPoint('BOTTOMLEFT',18,20)
    P.status=text(P.main,11,'muted'); P.status:SetPoint('BOTTOMLEFT',18,59); P.status:SetWidth(300)
    P.resize=CreateFrame('Button',nil,f); P.resize:SetSize(18,18); P.resize:SetPoint('BOTTOMRIGHT',-1,1)
    P.resize:SetNormalTexture('Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Up')
    P.resize:SetHighlightTexture('Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Highlight')
    P.resize:SetScript('OnMouseDown',function(_,which) if which=='LeftButton' then P.CloseMenu(); f:StartSizing('BOTTOMRIGHT') end end)
    P.resize:SetScript('OnMouseUp',function() f:StopMovingOrSizing(); P.SaveGeometry() end)
    f:SetScript('OnSizeChanged',function() if not P.restoring then P.Layout() end end)
    f:SetScript('OnHide',function() P.CloseMenu(); f:StopMovingOrSizing() end)
    f:SetScript('OnShow',P.Refresh)
    P.RestoreGeometry(); P.Refresh()
end
