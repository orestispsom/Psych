-- Forever beta fallback. A client that loads SavedVariables normally always wins.
if PsychQuizDB == nil and type(PsychQuizSeedDB) == 'table' then
    PsychQuizDB = PsychQuizSeedDB
end
