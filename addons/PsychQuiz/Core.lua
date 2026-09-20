local name, P = ...
P.name = name
P.schemaVersion = 1
P.font = 'Interface\\AddOns\\PsychQuiz\\Media\\FiraSans-Regular.ttf'
P.symbolFont = 'Interface\\AddOns\\PsychQuiz\\Media\\NotoSansSymbols2-Regular.ttf'
P.defaults = {width=410, height=570, fontSize=16, opacity=0.96, collapsed=false,
    open=false, mode='random', category='', length=25, autoExplanation=true}
P.colors = {
    surface={0.85,0.92,0.96}, ink={0.085,0.20,0.27}, muted={0.24,0.37,0.45},
    border={0.55,0.70,0.79}, selected={0.70,0.85,0.92}, hover={0.78,0.89,0.95},
    primary={0.17,0.36,0.53}, white={0.97,0.99,1}, correct={0.09,0.36,0.25},
    wrong={0.58,0.19,0.19}, rule={0.61,0.75,0.83},
}
function P.Copy(value)
    if type(value) ~= 'table' then return value end
    local out = {}; for k,v in pairs(value) do out[k]=P.Copy(v) end; return out
end
function P.Now() return GetServerTime() end
function P.IsCombat() return InCombatLockdown() and true or false end
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
events:RegisterEvent('PLAYER_REGEN_DISABLED')
events:RegisterEvent('PLAYER_REGEN_ENABLED')
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
        elseif event=='PLAYER_REGEN_DISABLED' or event=='PLAYER_REGEN_ENABLED' then
            -- Only our ordinary, unprotected frames are changed. No game bindings/actions.
            P.CloseMenu(); P.Refresh()
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
