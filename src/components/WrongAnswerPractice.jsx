import { createContext, useContext } from 'react';

// The app supplies its classic MCQ engine without coupling this entry point to App.
export const McqPracticeContext = createContext(null);

export default function WrongAnswerPractice(props) {
  const runtime = useContext(McqPracticeContext);
  if (!runtime) throw new Error('WrongAnswerPractice requires McqPracticeProvider');
  const { Component, progress, onProgressChange } = runtime;
  return <Component {...props} progress={progress} onProgressChange={onProgressChange} />;
}
