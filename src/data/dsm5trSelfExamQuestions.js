export const dsm5trSelfExamChapters = [
  { id: "dsm5tr_ch01", chapter: 1, title: "Neurodevelopmental Disorders", questions: [] },
  { id: "dsm5tr_ch02", chapter: 2, title: "Schizophrenia Spectrum and Other Psychotic Disorders", questions: [] },
  { id: "dsm5tr_ch03", chapter: 3, title: "Bipolar and Related Disorders", questions: [] },
  { id: "dsm5tr_ch04", chapter: 4, title: "Depressive Disorders", questions: [] },
  { id: "dsm5tr_ch05", chapter: 5, title: "Anxiety Disorders", questions: [] },
  { id: "dsm5tr_ch06", chapter: 6, title: "Obsessive-Compulsive and Related Disorders", questions: [] },
  { id: "dsm5tr_ch07", chapter: 7, title: "Trauma- and Stressor-Related Disorders", questions: [] },
  { id: "dsm5tr_ch08", chapter: 8, title: "Dissociative Disorders", questions: [] },
  { id: "dsm5tr_ch09", chapter: 9, title: "Somatic Symptom and Related Disorders", questions: [] },
  { id: "dsm5tr_ch10", chapter: 10, title: "Feeding and Eating Disorders", questions: [] },
  { id: "dsm5tr_ch11", chapter: 11, title: "Elimination Disorders", questions: [] },
  { id: "dsm5tr_ch12", chapter: 12, title: "Sleep-Wake Disorders", questions: [] },
  { id: "dsm5tr_ch13", chapter: 13, title: "Sexual Dysfunctions", questions: [] },
  { id: "dsm5tr_ch14", chapter: 14, title: "Gender Dysphoria", questions: [] },
  { id: "dsm5tr_ch15", chapter: 15, title: "Disruptive, Impulse-Control, and Conduct Disorders", questions: [] },
  { id: "dsm5tr_ch16", chapter: 16, title: "Substance-Related and Addictive Disorders", questions: [] },
  { id: "dsm5tr_ch17", chapter: 17, title: "Neurocognitive Disorders", questions: [] },
  { id: "dsm5tr_ch18", chapter: 18, title: "Personality Disorders", questions: [] },
  { id: "dsm5tr_ch19", chapter: 19, title: "Paraphilic Disorders", questions: [] },
  { id: "dsm5tr_ch20", chapter: 20, title: "Medication-Induced Movement Disorders and Other Adverse Effects of Medication", questions: [] },
  { id: "dsm5tr_ch21", chapter: 21, title: "Assessment Measures (DSM-5-TR Section III)", questions: [] },
  { id: "dsm5tr_ch22", chapter: 22, title: "Cultural and Psychiatric Diagnosis (DSM-5-TR Section III)", questions: [] },
  { id: "dsm5tr_ch23", chapter: 23, title: "Alternative DSM-5 Model for Personality Disorders (DSM-5-TR Section III)", questions: [] },
];

export const dsm5trSelfExamQuestions = dsm5trSelfExamChapters.flatMap(chapter =>
  chapter.questions.map(question => ({
    ...question,
    chapter: question.chapter ?? chapter.chapter,
    chapterTitle: question.chapterTitle || chapter.title,
  }))
);

export default dsm5trSelfExamChapters;
