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
function P.CloseMenu()
    if P.menu then P.menu:Hide() end
    if P.feedbackDialog then P.feedbackDialog:Hide() end
end
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
        if s and not s.revealed and s.selected~=index then color(row.bg,'hover',0.8) end
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
            row:EnableMouse(not s.revealed)
        end
    end
end
function P.Layout()
    if not P.frame then return end
    local f=P.frame; local settings=P.db.settings
    local collapsed=settings.collapsed
    P.main:SetShown(not collapsed); P.resize:SetShown(not collapsed)
    P.collapse.label:SetText(collapsed and '+' or '−')
    local maxHeaderBtnWidth=math.max(120,math.min(240,f:GetWidth()-210))
    P.headerMode:SetWidth(maxHeaderBtnWidth)
    P.headerMode.label:SetWidth(maxHeaderBtnWidth-14)
    local w=f:GetWidth()-40
    P.topic:SetWidth(math.max(160,f:GetWidth()-110))
    local topY=math.max(70,48+P.topic:GetStringHeight()+8)
    P.bodyRule:ClearAllPoints(); P.bodyRule:SetPoint('TOPLEFT',0,-topY); P.bodyRule:SetPoint('TOPRIGHT',0,-topY)
    P.scroll:ClearAllPoints(); P.scroll:SetPoint('TOPLEFT',18,-topY-14); P.scroll:SetPoint('BOTTOMRIGHT',-18,60)
    P.scrollbar:ClearAllPoints(); P.scrollbar:SetPoint('TOPRIGHT',-5,-topY-14); P.scrollbar:SetPoint('BOTTOMRIGHT',-5,60)
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
    local s=P.db.session; local q=P.CurrentQuestion()
    local finished=s and not q
    local score=s and s.answered>0 and (' · '..math.floor(s.correct/s.answered*100+0.5)..'%') or ''
    if s and s.mode=='exam' and not finished then score='' end
    P.compact:SetText(s and (s.answered..'/'..#s.ids..score) or '')
    P.topic:SetText(q and q.topic or 'Η μελέτη σου, στον χρόνο σου')
    P.progress:SetText(s and (math.min(s.index,#s.ids)..' / '..#s.ids) or '')
    local settings=P.db.settings
    local mode=s and q and s.mode or settings.mode
    local label=P.modeLabels[mode] or 'Τυχαίες'
    local modeText=label
    if mode=='exam' then
        modeText='Εξέταση (100)'
    elseif mode=='category' then
        local cat=(s and q and q.topic) or (settings.category~='' and settings.category) or 'Όλες'
        if #cat>20 then cat=string.sub(cat,1,18)..'..' end
        modeText=cat
    else
        local len=settings.length==0 and 'Όλες' or tostring(settings.length)
        modeText=label..' ('..len..')'
    end
    P.headerMode.label:SetText(modeText..' ▾')
    P.feedback:SetText('')
    if P.feedbackBtn then
        if q then
            local hasComment=P.db and P.db.feedback and P.db.feedback[tostring(q.id)] and P.db.feedback[tostring(q.id)].text~=''
            P.feedbackBtn.label:SetText(hasComment and 'Σχόλια (*)' or 'Σχόλια')
            P.feedbackBtn:Show()
            if P.prevBtn then
                P.prevBtn:Show()
                P.prevBtn:SetEnabled(s~=nil and s.index>1)
                P.prevBtn.label:SetAlpha(P.prevBtn:IsEnabled() and 1 or 0.35)
            end
            if P.nextBtn then
                P.nextBtn:Show()
                P.nextBtn:SetEnabled(s~=nil and (s.index<#s.ids or (s.revealed and s.index==#s.ids)))
                P.nextBtn.label:SetAlpha(P.nextBtn:IsEnabled() and 1 or 0.35)
            end
        else
            P.feedbackBtn:Hide()
            if P.prevBtn then P.prevBtn:Hide() end
            if P.nextBtn then P.nextBtn:Hide() end
        end
    end
    if q then
        P.stem:SetText(plain(q.stem))
        for i=1,#q.options do if not P.answers[i] then P.answers[i]=P.MakeAnswer(i) end end
        P.RefreshAnswers()
        if s.revealed then
            P.action.label:SetText(s.index<#s.ids and 'Επόμενη' or 'Ολοκλήρωση')
            if s.mode=='exam' then P.feedback:SetText('Η απάντηση καταγράφηκε. Αποτελέσματα στο τέλος.')
            else
                local correct=s.selected-1==q.correct
                local title=correct and 'Σωστή απάντηση' or 'Λάθος απάντηση'
                local message=title..'\n\nΣωστή: '..plain(q.options[q.correct+1])
                message=message..'\n\n'..plain(q.explanation)
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
        P.stem:SetText('Λίγος χρόνος για μελέτη.')
        P.feedback:SetText('Επίλεξε τρόπο μελέτης από την κεφαλίδα και ξεκίνα όταν έχεις χρόνο.\n\n'..#P.bank.questions..' ερωτήσεις · '..#P.topics..' κατηγορίες\n\nΣύρε την κεφαλίδα για μετακίνηση και την κάτω γωνία για αλλαγή μεγέθους.')
        P.action.label:SetText('Έναρξη')
    end
    P.action:SetEnabled(not q or s.revealed or s.selected~=nil)
    P.action.label:SetAlpha(P.action:IsEnabled() and 1 or 0.5)
    P.Layout()
end
local function ensureMenu(titleText)
    if not P.menu then
        local m=CreateFrame('Frame',nil,P.frame,'BackdropTemplate'); P.menu=m
        m:SetPoint('TOPLEFT',10,-38); m:SetPoint('BOTTOMRIGHT',-10,10)
        m:SetFrameLevel(P.frame:GetFrameLevel()+30); m:EnableMouse(true); surface(m,1)
        P.menuTitle=text(m,15); P.menuTitle:SetPoint('TOPLEFT',14,-12)
        local close=button(m,'×',26,24,P.CloseMenu); close:SetPoint('TOPRIGHT',-8,-8)
        P.menuScroll=CreateFrame('ScrollFrame',nil,m)
        P.menuScroll:SetPoint('TOPLEFT',10,-42); P.menuScroll:SetPoint('BOTTOMRIGHT',-10,10)
        P.menuContent=CreateFrame('Frame',nil,P.menuScroll); P.menuScroll:SetScrollChild(P.menuContent)
        P.menuScroll:EnableMouseWheel(true)
        P.menuScroll:SetScript('OnMouseWheel',function(self,delta)
            self:SetVerticalScroll(math.max(0,math.min(self:GetVerticalScroll()-delta*42,math.max(0,P.menuY-self:GetHeight()))))
        end)
    end
    P.menuTitle:SetText(titleText or '')
    for _,row in ipairs(P.menuRows or {}) do row:Hide() end
    P.menuRows={}; P.menuY=0; P.rowCursor=0; P.titleCursor=0; P.sliderCursor=0; P.menu:Show()
    P.menuContent:SetWidth(P.frame:GetWidth()-40)
end

local function menuRow(label,sublabel,action,isPrimary)
    P.rowCursor=(P.rowCursor or 0)+1
    P.rowPool=P.rowPool or {}
    local b=P.rowPool[P.rowCursor]
    if not b then
        b=button(P.menuContent,'',100,36,nil,isPrimary)
        b.subtext=text(b,11,'muted')
        P.rowPool[P.rowCursor]=b
    end
    color(b.bg,isPrimary and 'primary' or 'selected',isPrimary and 1 or 0.35)
    b.label:SetTextColor(unpack(C[isPrimary and 'white' or 'ink']))
    b:ClearAllPoints(); b.label:ClearAllPoints(); b.label:SetJustifyH('LEFT'); b.label:SetFont(P.font,13,'')
    b.label:SetText(label)
    if sublabel and sublabel~='' then
        b.subtext:ClearAllPoints(); b.subtext:SetPoint('TOPLEFT',12,-22)
        b.subtext:SetWidth(P.frame:GetWidth()-68); b.subtext:SetText(sublabel); b.subtext:Show()
        b.label:SetPoint('TOPLEFT',12,-5); b.label:SetWidth(P.frame:GetWidth()-68)
        local h=math.max(46,26+b.subtext:GetStringHeight())
        b:SetHeight(h); b:SetPoint('TOPLEFT',0,-P.menuY); b:SetPoint('RIGHT',P.menuContent,'RIGHT',0,0)
        P.menuY=P.menuY+h+4
    else
        b.subtext:Hide(); b.label:SetPoint('LEFT',12,0); b.label:SetWidth(P.frame:GetWidth()-68)
        local h=math.max(34,b.label:GetStringHeight()+14)
        b:SetHeight(h); b:SetPoint('TOPLEFT',0,-P.menuY); b:SetPoint('RIGHT',P.menuContent,'RIGHT',0,0)
        P.menuY=P.menuY+h+4
    end
    b:SetScript('OnClick',action); b:Show()
    P.menuRows[#P.menuRows+1]=b
    return b
end

local function menuTitle(label)
    P.titleCursor=(P.titleCursor or 0)+1; P.titlePool=P.titlePool or {}
    local f=P.titlePool[P.titleCursor] or text(P.menuContent,12,'muted'); P.titlePool[P.titleCursor]=f
    f:ClearAllPoints(); f:SetWidth(P.frame:GetWidth()-68); f:SetText(label); f:SetPoint('TOPLEFT',6,-P.menuY-4); f:Show()
    P.menuY=P.menuY+math.max(26,f:GetStringHeight()+10); P.menuRows[#P.menuRows+1]=f
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

function P.OpenSettings()
    ensureMenu('Ρυθμίσεις')
    local settings=P.db.settings
    menuTitle('Εμφάνιση παραθύρου')
    menuSlider('Αδιαφάνεια φόντου',0.65,1,0.01,settings.opacity,function(v) settings.opacity=v end)
    menuSlider('Μέγεθος γραμμάτων',14,24,1,settings.fontSize,function(v) settings.fontSize=math.floor(v+0.5) end)
    menuTitle('Συγχρονισμός & Δεδομένα')
    menuTitle(P.PendingCount()..' απαντήσεις χωρίς επιβεβαίωση συγχρονισμού')
    local fbCount=0
    if P.db and P.db.feedback then for _ in pairs(P.db.feedback) do fbCount=fbCount+1 end end
    if fbCount>0 then menuTitle(fbCount..' αποθηκευμένα σχόλια') end
    if P.db.baselineUpdateDeferred then menuTitle('Η νέα εισαγωγή αναμένει τον συγχρονισμό των τοπικών απαντήσεων.') end
    menuTitle('Για εξαγωγή: /reload και μετά το εξωτερικό εργαλείο.')
    P.menuContent:SetHeight(math.max(1,P.menuY)); P.menuScroll:SetVerticalScroll(0)
end

function P.OpenModeWizard(step,state)
    step=step or 'mode'
    state=state or {
        mode=P.db.settings.mode,
        category=P.db.settings.category,
        length=P.db.settings.length,
    }

    if step=='category' then
        ensureMenu('Επιλογή κατηγορίας')
        menuRow('‹ Πίσω','',function() P.OpenModeWizard('mode',state) end)
        for _,topic in ipairs(P.topics) do
            local count,pct=P.GetCategoryStats(topic)
            local sub=pct..'% mastery · '..count..' ερωτήσεις'
            menuRow(topic,sub,function()
                state.mode='category'
                state.category=topic
                state.length=0
                P.OpenModeWizard('confirm',state)
            end)
        end
    elseif step=='length' then
        ensureMenu('Πλήθος ερωτήσεων')
        menuRow('‹ Πίσω','',function() P.OpenModeWizard('mode',state) end)
        local counts={10,25,50,100,0}
        for _,n in ipairs(counts) do
            local label=(n==0) and 'Όλες οι ερωτήσεις' or (tostring(n)..' ερωτήσεις')
            local sub=(n==0) and 'Χωρίς αριθμητικό όριο' or ('Συνεδρία '..n..' ερωτήσεων')
            menuRow(label,sub,function()
                state.length=n
                P.OpenModeWizard('confirm',state)
            end)
        end
    elseif step=='confirm' then
        ensureMenu('Έναρξη συνεδρίας')
        menuRow('‹ Πίσω','',function()
            if state.mode=='category' then
                P.OpenModeWizard('category',state)
            elseif state.mode=='exam' then
                P.OpenModeWizard('mode',state)
            else
                P.OpenModeWizard('length',state)
            end
        end)
        menuTitle('Τρόπος μελέτης: '..(P.modeLabels[state.mode] or state.mode))
        if state.mode=='exam' then
            menuTitle('100 ερωτήσεις από όλες τις ενότητες.\nΑποτελέσματα και απαντήσεις στο τέλος.')
        elseif state.mode=='category' then
            local count,pct=P.GetCategoryStats(state.category)
            menuTitle('Κατηγορία: '..state.category..'\n'..count..' ερωτήσεις (όλες) · '..pct..'% mastery')
        else
            local nStr=state.length==0 and 'Όλες οι διαθέσιμες ερωτήσεις' or (state.length..' ερωτήσεις')
            menuTitle('Ερωτήσεις: '..nStr)
        end
        menuTitle('Το ιστορικό προηγούμενων απαντήσεων διατηρείται.')
        menuRow('▶ Έναρξη νέας συνεδρίας','',function()
            P.db.settings.mode=state.mode
            P.db.settings.category=state.category or ''
            P.db.settings.length=state.length
            P.CloseMenu()
            P.StartSession()
            P.Refresh()
        end,true)
        menuRow('Ακύρωση','',P.CloseMenu)
    else -- 'mode'
        ensureMenu('Επιλογή τρόπου μελέτης')
        menuRow('Εξέταση (100)','100 ερωτήσεις · προσομοίωση από όλες τις κατηγορίες',function()
            state.mode='exam'
            state.category=''
            state.length=100
            P.OpenModeWizard('confirm',state)
        end)
        menuRow('Ανά κατηγορία','Μελέτη όλων των ερωτήσεων συγκεκριμένης κατηγορίας',function()
            state.mode='category'
            state.length=0
            P.OpenModeWizard('category',state)
        end)
        menuRow('Τυχαίες','Τυχαία επιλογή ερωτήσεων από όλες τις κατηγορίες',function()
            state.mode='random'
            state.category=''
            P.OpenModeWizard('length',state)
        end)
        menuRow('Αδύναμες','Ερωτήσεις με λάθη ή χαμηλή εμπέδωση',function()
            state.mode='weakness'
            state.category=''
            P.OpenModeWizard('length',state)
        end)
        menuRow('Για επανάληψη','Ερωτήσεις που έχουν φτάσει σε χρόνο επανάληψης',function()
            state.mode='due'
            state.category=''
            P.OpenModeWizard('length',state)
        end)
    end
    P.menuContent:SetHeight(math.max(1,P.menuY))
    P.menuScroll:SetVerticalScroll(0)
end
P.OpenMenu=P.OpenModeWizard

function P.OpenFeedbackDialog()
    local q=P.CurrentQuestion()
    if not q then return end
    if not P.feedbackDialog then
        local dlg=CreateFrame('Frame',nil,P.frame,'BackdropTemplate'); P.feedbackDialog=dlg
        dlg:SetPoint('TOPLEFT',10,-38); dlg:SetPoint('BOTTOMRIGHT',-10,10)
        dlg:SetFrameLevel(P.frame:GetFrameLevel()+35); dlg:EnableMouse(true); surface(dlg,1)
        local title=text(dlg,15); title:SetText('Σχόλια ερώτησης'); title:SetPoint('TOPLEFT',14,-12)
        local close=button(dlg,'×',26,24,function() dlg:Hide() end); close:SetPoint('TOPRIGHT',-8,-8)
        dlg.info=text(dlg,12,'muted'); dlg.info:SetPoint('TOPLEFT',14,-38); dlg.info:SetWidth(P.frame:GetWidth()-48)
        local sf=CreateFrame('ScrollFrame',nil,dlg,'BackdropTemplate'); dlg.sf=sf
        sf:SetPoint('TOPLEFT',12,-72); sf:SetPoint('BOTTOMRIGHT',-12,50)
        surface(sf,0.4)
        local eb=CreateFrame('EditBox',nil,sf); dlg.eb=eb
        eb:SetMultiLine(true); eb:SetFont(P.font,13,''); eb:SetTextColor(unpack(C.ink))
        eb:SetWidth(P.frame:GetWidth()-54); eb:SetPoint('TOPLEFT',8,-8)
        eb:SetMaxLetters(2000); eb:SetAutoFocus(true)
        eb:SetScript('OnEscapePressed',function() dlg:Hide() end)
        eb:SetScript('OnCursorChanged',function(self,_,y,_,cursorHeight)
            local offset=sf:GetVerticalScroll()
            local height=sf:GetHeight()
            if -y<offset then sf:SetVerticalScroll(-y)
            elseif -y+cursorHeight>offset+height then sf:SetVerticalScroll(-y+cursorHeight-height) end
        end)
        sf:SetScrollChild(eb)
        dlg.saveBtn=button(dlg,'Αποθήκευση',110,30,function()
            local txt=dlg.eb:GetText() or ''
            txt=txt:gsub('^%s+',''):gsub('%s+$','')
            P.db.feedback=P.db.feedback or {}
            local curQ=P.CurrentQuestion()
            if curQ then
                local idStr=tostring(curQ.id)
                if txt~='' then
                    P.db.feedback[idStr]={
                        questionId=curQ.id,
                        topic=curQ.topic,
                        text=txt,
                        savedAt=P.Now(),
                    }
                else
                    P.db.feedback[idStr]=nil
                end
            end
            dlg:Hide(); P.Refresh()
        end,true)
        dlg.saveBtn:SetPoint('BOTTOMRIGHT',-12,12)
        dlg.cancelBtn=button(dlg,'Ακύρωση',85,30,function() dlg:Hide() end)
        dlg.cancelBtn:SetPoint('RIGHT',dlg.saveBtn,'LEFT',-8,0)
        dlg.clearBtn=button(dlg,'Διαγραφή',85,30,function() dlg.eb:SetText('') end)
        dlg.clearBtn:SetPoint('BOTTOMLEFT',12,12)
    end
    local idStr=tostring(q.id)
    P.feedbackDialog.info:SetText('Ερώτηση #'..q.id..' · '..q.topic..'\nΠληκτρολόγησε παρακάτω παρατηρήσεις ή διορθώσεις:')
    local existing=P.db.feedback and P.db.feedback[idStr] and P.db.feedback[idStr].text or ''
    P.feedbackDialog.eb:SetText(existing)
    P.feedbackDialog.eb:SetWidth(P.frame:GetWidth()-54)
    P.feedbackDialog:Show()
    P.feedbackDialog.eb:SetFocus()
end

function P.CreateUI()
    local f=CreateFrame('Frame','PsychQuizFrame',UIParent,'BackdropTemplate'); P.frame=f
    f:Hide(); f:SetFrameStrata('MEDIUM'); f:SetClampedToScreen(true)
    f:SetMovable(true); f:SetResizable(true); f:SetResizeBounds(340,300,900,1000); f:EnableMouse(true)
    local header=CreateFrame('Frame',nil,f); header:SetPoint('TOPLEFT'); header:SetPoint('TOPRIGHT'); header:SetHeight(36)
    header:EnableMouse(true); header:RegisterForDrag('LeftButton')
    header:SetScript('OnDragStart',function() P.CloseMenu(); f:StartMoving() end)
    header:SetScript('OnDragStop',function() f:StopMovingOrSizing(); P.SaveGeometry() end)

    P.headerMode=button(header,'',160,26,function()
        if P.menu and P.menu:IsShown() and P.menuTitle and P.menuTitle:GetText()~='Ρυθμίσεις' then
            P.CloseMenu()
        else
            P.OpenModeWizard('mode')
        end
    end)
    P.headerMode:SetPoint('LEFT',10,0)
    P.headerMode.label:SetFont(P.font,13,'')
    P.headerMode.label:SetJustifyH('LEFT')
    P.headerMode.label:ClearAllPoints()
    P.headerMode.label:SetPoint('LEFT',8,0)

    P.compact=text(header,12,'muted'); P.compact:SetPoint('RIGHT',-112,0)

    P.gear=button(header,'⚙',26,26,function()
        if P.menu and P.menu:IsShown() and P.menuTitle and P.menuTitle:GetText()=='Ρυθμίσεις' then
            P.CloseMenu()
        else
            P.OpenSettings()
        end
    end)
    P.gear:SetPoint('RIGHT',-76,0)
    P.gear.label:SetFont(P.symbolFont,16,'')

    P.collapse=button(header,'−',26,26,P.ToggleCollapse); P.collapse:SetPoint('RIGHT',-44,0)
    local close=button(header,'×',26,26,function() P.db.settings.open=false; f:Hide() end); close:SetPoint('RIGHT',-12,0)
    rule(f,-36)

    P.main=CreateFrame('Frame',nil,f); P.main:SetAllPoints()
    P.topic=text(P.main,13,'muted'); P.topic:SetPoint('TOPLEFT',18,-48); P.topic:SetWidth(255)
    P.progress=text(P.main,13,'muted'); P.progress:SetPoint('TOPRIGHT',-18,-48)
    P.bodyRule=P.main:CreateTexture(nil,'BORDER'); color(P.bodyRule,'rule',0.65); P.bodyRule:SetHeight(1)

    P.scroll=CreateFrame('ScrollFrame',nil,P.main); P.scroll:SetPoint('TOPLEFT',18,-100); P.scroll:SetPoint('BOTTOMRIGHT',-18,60)
    P.content=CreateFrame('Frame',nil,P.scroll); P.scroll:SetScrollChild(P.content)
    P.scroll:EnableMouseWheel(true)
    P.scroll:SetScript('OnMouseWheel',function(self,delta)
        local range=math.max(0,P.content:GetHeight()-self:GetHeight())
        local value=math.max(0,math.min(range,self:GetVerticalScroll()-delta*42))
        self:SetVerticalScroll(value); P.scrollbar:SetValue(value)
    end)

    P.scrollbar=CreateFrame('Slider',nil,P.main)
    P.scrollbar:SetPoint('TOPRIGHT',-5,-100); P.scrollbar:SetPoint('BOTTOMRIGHT',-5,60); P.scrollbar:SetWidth(6)
    P.scrollbar:SetOrientation('VERTICAL'); P.scrollbar:SetMinMaxValues(0,1)
    local thumb=P.scrollbar:CreateTexture(nil,'ARTWORK'); thumb:SetSize(4,30); color(thumb,'primary',0.55)
    P.scrollbar:SetThumbTexture(thumb)
    P.scrollbar:SetScript('OnValueChanged',function(_,v) P.scroll:SetVerticalScroll(v) end)

    P.stem=text(P.content,17); P.feedback=text(P.content,16); P.answers={}
    P.action=button(P.main,'Έναρξη',120,34,function()
        if not P.CurrentQuestion() then P.StartSession()
        elseif P.db.session.revealed then P.Next() else P.Submit() end
    end,true); P.action:SetPoint('BOTTOMRIGHT',-18,16)

    P.nextBtn=button(P.main,'›',34,34,function() P.Next() end)
    P.nextBtn:SetPoint('RIGHT',P.action,'LEFT',-6,0)
    P.nextBtn.label:SetFont(P.font,18,'')

    P.prevBtn=button(P.main,'‹',34,34,function() P.Prev() end)
    P.prevBtn:SetPoint('RIGHT',P.nextBtn,'LEFT',-4,0)
    P.prevBtn.label:SetFont(P.font,18,'')

    P.feedbackBtn=button(P.main,'Σχόλια',85,34,function() P.OpenFeedbackDialog() end)
    P.feedbackBtn:SetPoint('BOTTOMLEFT',18,16)

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
