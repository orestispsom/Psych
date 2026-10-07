// Legacy exams only stored totals and IDs. Recover them only when the retained
// attempts and current bank account for every answer and agree with those totals.
export function recoverWrittenExam(session, attempts, getQuestion, buildResult, progress) {
  if (session.result?.items?.length === session.total) {
    return { result: session.result, optionOrders: session.optionOrders || {} };
  }
  const questions = (session.questionIds || []).map(getQuestion);
  const answers = {};
  const sessionAttempts = (attempts || []).filter(attempt => attempt.mode === 'written' && attempt.sessionId === session.id);
  for (const attempt of sessionAttempts) {
    if (!Number.isInteger(attempt.selected)) continue;
    if (Object.hasOwn(answers, attempt.questionId) && answers[attempt.questionId] !== attempt.selected) return null;
    answers[attempt.questionId] = attempt.selected;
  }
  if (questions.length !== session.total || questions.some(question => !question)) return null;
  if (Object.keys(answers).length !== session.correct + session.wrong) return null;
  if (questions.some(question => Object.hasOwn(answers, question.id) &&
    (answers[question.id] < 0 || answers[question.id] >= question.options.length))) return null;
  if (sessionAttempts.some(attempt => {
    const question = questions.find(question => String(question.id) === String(attempt.questionId));
    return !question || (typeof attempt.isCorrect === 'boolean' &&
      attempt.isCorrect !== (attempt.selected === question.correct));
  })) return null;
  const result = buildResult(questions, answers, progress);
  if (result.correct !== session.correct || result.wrong !== session.wrong || result.unanswered !== session.unanswered) return null;
  return { result, optionOrders: Object.fromEntries(questions.map(question => [question.id, question.options.map((_, index) => index)])), legacy: true };
}
