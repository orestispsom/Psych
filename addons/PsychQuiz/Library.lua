local _,P=...
-- Greek search normalization is deterministic and leaves authored text untouched.
local fold={['Α']='α',['Β']='β',['Γ']='γ',['Δ']='δ',['Ε']='ε',['Ζ']='ζ',['Η']='η',
    ['Θ']='θ',['Ι']='ι',['Κ']='κ',['Λ']='λ',['Μ']='μ',['Ν']='ν',['Ξ']='ξ',['Ο']='ο',
    ['Π']='π',['Ρ']='ρ',['Σ']='σ',['Τ']='τ',['Υ']='υ',['Φ']='φ',['Χ']='χ',['Ψ']='ψ',['Ω']='ω',
    ['Ά']='α',['Έ']='ε',['Ή']='η',['Ί']='ι',['Ό']='ο',['Ύ']='υ',['Ώ']='ω',
    ['ά']='α',['έ']='ε',['ή']='η',['ί']='ι',['ό']='ο',['ύ']='υ',['ώ']='ω',
    ['ϊ']='ι',['ΐ']='ι',['ϋ']='υ',['ΰ']='υ',['Ϊ']='ι',['Ϋ']='υ',['ς']='σ'}
function P.NormalizeSearch(value)
    return (tostring(value or ''):gsub('[%z\1-\127\194-\244][\128-\191]*',function(char)
        return fold[char] or (#char==1 and string.lower(char) or char)
    end))
end
function P.SearchQuestions(query,limit)
    query=P.NormalizeSearch(query):match('^%s*(.-)%s*$')
    if query=='' then return {},0 end
    if not P.searchIndex or P.searchBankVersion~=P.bank.bankVersion then
        P.searchIndex={}; P.searchBankVersion=P.bank.bankVersion
        for _,q in ipairs(P.bank.questions) do
            P.searchIndex[#P.searchIndex+1]={q=q,text=P.NormalizeSearch(q.topic..' '..q.stem)}
        end
    end
    local matches={}; local numeric=query:match('^#?(%d+)$')
    for _,entry in ipairs(P.searchIndex) do
        local include=true
        if numeric then include=tostring(entry.q.id)==numeric
        else
            for term in query:gmatch('%S+') do
                if not entry.text:find(term,1,true) then include=false; break end
            end
        end
        if include then matches[#matches+1]=entry.q end
    end
    table.sort(matches,function(a,b) return a.id<b.id end)
    local total=#matches
    while #matches>(limit or 40) do matches[#matches]=nil end
    return matches,total
end
function P.ProgressOverview()
    local out={total=#P.bank.questions,attempted=0,mastered=0,due=0,correct=0,wrong=0,topics={}}
    for _,q in ipairs(P.bank.questions) do
        local state=P.db.derived[tostring(q.id)] or {}
        local topic=out.topics[q.topic]
        if not topic then
            topic={title=q.topic,total=0,attempted=0,mastered=0,due=0,correct=0,wrong=0}
            out.topics[q.topic]=topic
        end
        local correct=tonumber(state.correctCount) or 0
        local wrong=tonumber(state.wrongCount) or 0
        local attempted=correct+wrong>0 and 1 or 0
        local mastered=(tonumber(state.masteryLevel) or 0)>=5 and 1 or 0
        local due=P.IsDue(state) and 1 or 0
        out.attempted=out.attempted+attempted; out.mastered=out.mastered+mastered; out.due=out.due+due
        out.correct=out.correct+correct; out.wrong=out.wrong+wrong
        topic.total=topic.total+1; topic.attempted=topic.attempted+attempted
        topic.mastered=topic.mastered+mastered; topic.due=topic.due+due
        topic.correct=topic.correct+correct; topic.wrong=topic.wrong+wrong
    end
    return out
end
