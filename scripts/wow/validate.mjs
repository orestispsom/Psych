export function validateEvents(events,bank) {
  if(!Array.isArray(events))throw new Error('Events must be an array');
  const byId=new Map(bank.questions.map(q=>[q.id,q])),seen=new Set();
  for(const e of events){
    if(!e||e.schemaVersion!==1||e.profileId!=='orestis'||e.source!=='wow'||typeof e.eventId!=='string'||!/^wow:[\w-]+:\d+$/.test(e.eventId)||seen.has(e.eventId))throw new Error('Malformed or duplicate event');
    seen.add(e.eventId);
    const q=byId.get(e.questionId);
    if(!q)throw new Error('Unknown question '+e.questionId+'; preserve export and resolve bank mapping');
    if(q.contentHash!==e.questionHash)throw new Error('Question content changed: '+q.id+'; resolve against the original bank before synchronization');
    if(!Number.isInteger(e.selectedIndex)||e.selectedIndex<0||e.selectedIndex>=q.options.length||e.correctIndex!==q.correct||e.isCorrect!==(e.selectedIndex===q.correct))throw new Error('Invalid answer event '+e.eventId);
    if(!Number.isInteger(e.answeredAt)||e.answeredAt<0||e.answeredAt>Date.now()/1000+300)throw new Error('Invalid event time');
    if(typeof e.sessionId!=='string'||!e.sessionId.startsWith('wow-session:')||e.confidence!==3||!['random','category','weakness','due','exam','quick'].includes(e.mode)||typeof e.bankVersion!=='string')throw new Error('Invalid session metadata');
  }
  return events;
}
