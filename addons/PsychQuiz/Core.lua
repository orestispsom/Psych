local name, P = ...
P.name = name
P.schemaVersion = 1
local interfaceVersion = select(4, GetBuildInfo()) or 0
P.isForever = interfaceVersion >= 16000 and interfaceVersion < 17000
P.font = 'Interface\\AddOns\\PsychQuiz\\Media\\FiraSans-Regular.ttf'
P.symbolFont = 'Interface\\AddOns\\PsychQuiz\\Media\\NotoSansSymbols2-Regular.ttf'
P.defaults = {width=410, height=570, fontSize=16, opacity=0.96, collapsed=false,
    open=false, mode='random', category='', length=25, autoExplanation=true, locked=false}
P.colors = {
    surface={0.085,0.095,0.11}, ink={0.89,0.88,0.84}, muted={0.67,0.70,0.73},
    border={0.31,0.29,0.25}, selected={0.27,0.22,0.14}, hover={0.18,0.20,0.23},
    button={0.14,0.16,0.19}, primary={0.80,0.64,0.36}, primaryHover={0.89,0.73,0.44},
    primaryText={0.10,0.085,0.065}, accent={0.91,0.75,0.45}, white={0.94,0.93,0.89},
    correct={0.56,0.87,0.66}, wrong={0.97,0.63,0.58}, rule={0.26,0.28,0.31},
    correctFill={0.105,0.23,0.17}, wrongFill={0.30,0.13,0.13},
}

function P.Copy(value)
    if type(value) ~= 'table' then return value end
    local out = {}; for k,v in pairs(value) do out[k]=P.Copy(v) end; return out
end
function P.Now() return GetServerTime() end
function P.SaveGeometry()
    if not P.frame or not P.db then return end
    local x,y = P.frame:GetCenter()
    if x and y then
        P.db.settings.x = x / UIParent:GetWidth()
        P.db.settings.y = y / UIParent:GetHeight()
    end
    if not P.db.settings.collapsed then
        P.db.settings.width = P.frame:GetWidth()
        P.db.settings.height = P.frame:GetHeight()
    end
end
local events=CreateFrame('Frame')
events:RegisterEvent('ADDON_LOADED')
events:RegisterEvent('PLAYER_LOGOUT')
events:RegisterEvent('DISPLAY_SIZE_CHANGED')
events:SetScript('OnEvent', function(_, event, addon)
    if event=='ADDON_LOADED' and addon==name then
        local ok,err=pcall(P.InitializeProgress)
        if not ok then print('|cffff6666PsychQuiz: '..tostring(err)..'|r'); return end
        P.InitializeQuiz(); P.CreateUI()
        if P.db.settings.open then P.frame:Show() end
    elseif P.db and P.frame then
        if event=='PLAYER_LOGOUT' then P.SaveGeometry()
        elseif event=='DISPLAY_SIZE_CHANGED' then P.RestoreGeometry()
        end
    end
end)
SLASH_PSYCHQUIZ1='/psych'
SlashCmdList.PSYCHQUIZ=function(msg)
    if not P.frame then print('PsychQuiz: initialization failed; check Lua errors.'); return end
    if msg=='reset-position' then
        P.db.settings.x=nil; P.db.settings.y=nil
        P.db.settings.width=410; P.db.settings.height=570
        P.RestoreGeometry(); P.frame:Show(); P.db.settings.open=true
    else
        local show=not P.frame:IsShown()
        P.db.settings.open=show; P.frame:SetShown(show)
    end
end
